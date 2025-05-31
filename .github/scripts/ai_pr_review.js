// ─────────── .github/scripts/ai_pr_review.js ───────────
// 이 파일은 ESM(ES Modules) 환경을 전제합니다.
// package.json에 "type": "module" 이 반드시 있어야 합니다.

import {Octokit} from '@octokit/rest'
import OpenAI from 'openai'
import * as core from '@actions/core'

// ─── 1) 환경 변수 로드 ─────────────────────────────────────────────────────────
const repoFullName = process.env.REPOSITORY   // ex) "user/repo"
const prNumber = process.env.PR_NUMBER
const token = process.env.GITHUB_TOKEN
const openaiKey = process.env.OPENAI_API_KEY

if (!repoFullName || !prNumber || !token || !openaiKey) {
  core.setFailed('필요한 환경 변수가 누락되었습니다.')
  process.exit(1)
}

const [owner, repo] = repoFullName.split('/')

// ─── 2) Octokit & OpenAI 초기화 ────────────────────────────────────────────────
const octokit = new Octokit({auth: token})
const openai = new OpenAI({apiKey: openaiKey})

async function run() {
  try {
    // ─── 3) pull_request.get으로 현재 PR_HEAD_SHA 얻기 ──────────────────────────────
    const {data: prInfo} = await octokit.pulls.get({
      owner,
      repo,
      pull_number: Number(prNumber),
    })
    const headSha = prInfo.head.sha
    // ex) headSha = "d86a7692bd2c65ade20d9216c9c74abab047f11d"

    // ─── 4) PR의 변경된 파일 목록 조회 ────────────────────────────────────────────────
    const {data: files} = await octokit.pulls.listFiles({
      owner,
      repo,
      pull_number: Number(prNumber),
    })

    // ─── 5) 변경된 MD 파일만 필터링 ─────────────────────────────────────────────────
    const mdFiles = files.filter(
      (file) => file.filename.endsWith('.md') && file.status !== 'removed'
    )
    if (mdFiles.length === 0) {
      core.info('변경된 Markdown 파일이 없습니다. 종료합니다.')
      return
    }

    // ────────────────────────────────────────────────────────────────────────────────
    // “하나의 Review” 로 묶을 모든 코멘트(제안 + 평가)를 모을 배열
    const commentsToAdd = []
    // ────────────────────────────────────────────────────────────────────────────────

    // ─── 6) 각 Markdown 파일별로 AI 리뷰 요청 ─────────────────────────────────────────
    for (const file of mdFiles) {
      const filePath = file.filename // 예: "content/example-post.md"

      // 6-1) “HEAD 커밋” 기준으로 파일 전체 내용 가져오기
      const {data: fileContent} = await octokit.repos.getContent({
        owner,
        repo,
        path: filePath,
        ref: headSha,
      })

      // 6-2) base64 디코딩
      const decodedContent = Buffer.from(
        fileContent.content,
        'base64'
      ).toString('utf-8')
      const lines = decodedContent.split('\n')

      // ─── (A) 코드 Suggestion 요청 처리 ──────────────────────────────────────────────

      // 6-A-1) AI에게 보낼 “라인 번호 | 텍스트” 형태의 프롬프트 생성
      const promptLines = lines
      .map((line, idx) => `${idx + 1} | ${line}`)
      .join('\n')

      // 6-A-2) ChatGPT에게 “diff 추천”을 요청하는 시스템 메시지
      const systemMessageForDiff = `
You are a senior technical writer AND code refactoring assistant.
아래 Markdown 파일(또는 코드 스니펫)을 줄 단위로 읽고, 기술적 정확성·문법·표현·구조·가독성 등을 기준으로
부족하거나 개선할 부분이 있다면, “라인 번호 | 기존 코드 → 제안된 수정 코드” 형태로만 응답하세요.
예시:
10 | String foo = "bar"; → String foo = getFoo();
이 때 “기존 코드”와 “제안된 수정 코드” 사이에 반드시 “→” 기호를 넣어 주세요.
      `
      const userMessageForDiff = `
파일 경로: ${filePath}

라인 번호 | 텍스트 명단:
\`\`\`
${promptLines}
\`\`\`
      `

      // 6-A-3) OpenAI ChatCompletion 호출 (Suggestion 용)
      const completionForDiff = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {role: 'system', content: systemMessageForDiff},
          {role: 'user', content: userMessageForDiff},
        ],
        temperature: 0.3,
        max_tokens: 1000,
      })

      // 6-A-4) AI 응답 추출 (예: "10 | String foo = \"bar\"; → String foo = getFoo();\n…")
      const aiDiffResponse = completionForDiff.choices[0]?.message?.content?.trim()
        || ''

      // 6-A-5) AI 응답 파싱: “라인 번호 | 기존 → 수정” → 배열 of { lineNumber, original, suggestion }
      const rawDiffLines = aiDiffResponse.split('\n')
      const parsedDiffEntries = rawDiffLines
      .map((line) => {
        // “10 | String foo = \"bar\"; → String foo = getFoo();”
        const parts = line.split('|').map((p) => p.trim())
        const lineNumber = parseInt(parts[0], 10)
        // parts[1] = 'String foo = "bar"; → String foo = getFoo();'
        const diffParts = parts[1]?.split('→').map((p) => p.trim()) || []
        const original = diffParts[0] || ''
        const suggestion = diffParts[1] || ''
        return {lineNumber, original, suggestion}
      })
      .filter(
        (entry) =>
          !isNaN(entry.lineNumber) &&
          entry.original.length > 0 &&
          entry.suggestion.length > 0
      )

      // 6-A-6) Suggestion 블록 생성 및 commentsToAdd에 누적
      if (parsedDiffEntries.length > 0) {
        for (const entry of parsedDiffEntries) {
          const suggestionBlock = [
            '```suggestion',
            `${entry.suggestion}`,
            '```',
          ].join('\n')

          commentsToAdd.push({
            path: filePath,
            line: entry.lineNumber,
            side: 'RIGHT',
            body: suggestionBlock,
          })
        }
        core.info(
          `✅ ${filePath}에 대해 ${parsedDiffEntries.length}개의 코드 Suggestion을 준비했습니다.`
        )
      } else {
        core.info(`AI가 ${filePath}에 대해 코드 Suggestion을 제공하지 않았습니다.`)
      }

      // ─── (B) 작성 글 평가 요청 처리 ─────────────────────────────────────────────────

      // 6-B-1) ChatGPT에게 “글 평가”를 요청하는 시스템 메시지
      const systemMessageForReview = `
You are a senior technical writer and editor.
아래 Markdown 파일(전체 내용)을 읽고, **내용의 충실도, 제목과의 연관성, 글의 흐름, 가독성** 등 관점에서
종합적으로 평가하여 간결하고 구체적인 피드백을 주세요.
특히 “무엇이 잘 쓰여 있고, 무엇이 부족하며, 어떻게 개선하면 좋을지”를 포함하세요.
      `
      const userMessageForReview = `
파일 경로: ${filePath}

아래는 해당 Markdown 파일의 전체 내용입니다.
\`\`\`
${decodedContent}
\`\`\`
      `

      // 6-B-2) OpenAI ChatCompletion 호출 (Review 평가용)
      const completionForReview = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {role: 'system', content: systemMessageForReview},
          {role: 'user', content: userMessageForReview},
        ],
        temperature: 0.6,
        max_tokens: 1000,
      })

      // 6-B-3) AI 평가 응답 추출 (자연어 텍스트)
      const aiReviewResponse =
        completionForReview.choices[0]?.message?.content?.trim() || ''

      if (aiReviewResponse.length > 0) {
        // 작성된 글 평가는 “파일의 첫 번째 줄(line: 1)에” 일반 코멘트 형태로 달겠습니다.
        commentsToAdd.push({
          path: filePath,
          line: 1,       // 파일 맨 위(1번 줄)에 평가 코멘트를 남깁니다.
          side: 'RIGHT', // 항상 변경된 HEAD 기준
          body: aiReviewResponse,
        })
        core.info(`✅ ${filePath}에 대해 종합 리뷰(글 평가)를 준비했습니다.`)
      } else {
        core.info(`AI가 ${filePath}에 대해 글 평가를 제공하지 않았습니다.`)
      }
    }

    // ────────────────────────────────────────────────────────────────────────────────
    // ▶ 하나의 Review로 묶어서 업로드
    if (commentsToAdd.length > 0) {
      await octokit.pulls.createReview({
        owner,
        repo,
        pull_number: Number(prNumber),
        commit_id: headSha,
        body: commentsToAdd[commentsToAdd.length - 1].body,
        event: 'COMMENT',
        comments: commentsToAdd.slice(0, commentsToAdd.length - 1),
      })

      core.info(`🎉 총 ${commentsToAdd.length}개의 코멘트(제안 + 평가)를 하나의 리뷰로 생성했습니다.`)
    } else {
      core.info('남은 리뷰 코멘트가 없어 별도 리뷰를 생성하지 않습니다.')
    }
  } catch (error) {
    core.setFailed(`오류 발생: ${error.message}`)
  }
}

run()
