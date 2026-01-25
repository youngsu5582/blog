// ─────────── .github/scripts/ai_pr_review.js 
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

    const commentsToAdd = []

    // ─── 6) 각 Markdown 파일별로 AI 리뷰 요청 (단일 호출로 통합) ─────────────────────
    for (const file of mdFiles) {
      const filePath = file.filename

      const {data: fileContent} = await octokit.repos.getContent({
        owner,
        repo,
        path: filePath,
        ref: headSha,
      })

      const decodedContent = Buffer.from(
        fileContent.content,
        'base64'
      ).toString('utf-8')
      const lines = decodedContent.split('\n')

      const promptLines = lines
      .map((line, idx) => `${idx + 1} | ${line}`)
      .join('\n')

      const systemMessage = `
  당신은 명확하고 깊이 있는 기술 아티클을 작성하는 것으로 유명한 시니어 개발자이자 전문가 테크 블로거입니다. 당신의 역할은 주니어 개발자가 작성한 블로그 글을 리뷰하며 그가 더
  나은 기술 필자로 성장할 수 있도록 멘토링하는 것입니다.

  아래 Markdown 형식의 글을 읽고, 다음 기준들을 종합적으로 고려하여 리뷰를 제공해 주세요.

  [리뷰 기준]
   1. 기술적 깊이와 정확성: 설명하는 기술적 내용이 정확한가? 독자에게 충분한 깊이의 정보를 제공하는가, 혹은 너무 피상적인가?
   2. 설명의 명확성: 핵심 개념과 주장이 독자(예: 주니어 개발자)가 이해하기 쉽게 작성되었는가? 사용된 비유나 예시는 효과적인가?
   3. 글의 구조와 흐름: 도입부가 문제를 잘 제시하고, 본문이 논리적으로 전개되며, 결론이 핵심을 잘 요약하는가?
   4. 코드 예제의 품질: 글에 포함된 코드 예제가 명확하고, 내용과 관련성이 높으며, 모범 사례를 따르는가?
   5. 독창성 및 설득력: 저자만의 관점이나 경험이 잘 드러나는가? 글의 주장이 설득력이 있는가?

  [응답 형식]
  리뷰는 아래 두 가지 형식 중 하나를 선택하여 응답해 주세요.

   1. 문장 수정: 문법, 오타, 더 나은 표현 등 간단한 문장 수정이 필요한 경우
       * 형식: [문장 수정] {라인 번호} | {기존 문장} → {제안된 수정 문장}
       * 예시: [문장 수정] 10 | 그것은 매우 빠르게 동작합니다. → 그 기능은 빠른 속도로 동작합니다.

   2. 내용 제안: 기술적 깊이, 설명 방식, 구조, 예제 등 설명이 필요한 내용에 대한 종합적인 의견 제시
       * 형식: [내용 제안] {라인 번호 또는 문단 범위} | {의견 및 제안}
       * 예시: [내용 제안] 15-20 | '메모리 관리'에 대한 설명이 조금 추상적입니다. 독자들이 개념을 쉽게 이해할 수 있도록, 가비지 컬렉션의 간단한 동작 방식을 코드 예시와 함께
         보여주는 문단을 추가하면 글의 깊이가 더해질 것 같습니다.
      `
      const userMessage = `
파일 경로: ${filePath}

라인 번호 | 텍스트 명단:
\`\`\
${promptLines}
\`\`\
      `

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {role: 'system', content: systemMessage},
          {role: 'user', content: userMessage},
        ],
        temperature: 0.4,
        max_tokens: 1500,
      })

      const aiResponse = completion.choices[0]?.message?.content?.trim() || ''

      // =======================================================================
      // 요청에 따라 AI의 원본 응답을 로그로 출력
      core.info(`\n===== AI Raw Response for ${filePath} =====\n${aiResponse}\n==============================================\n`)
      // =======================================================================

      const rawLines = aiResponse.split('\n')
      const suggestionRegex = /.*\[문장 수정\]\s*(\d+)\s*\|\s*(.+?)→(.+)/ // Modified regex to be more robust
      const opinionRegex = /.*\[내용 제안\]\s*([\d-]+)\s*\|\s*(.+)/ // Modified regex to be more robust

      const maxLine = lines.length // 파일의 실제 라인 수

      for (const line of rawLines) {
        const suggestionMatch = line.match(suggestionRegex)
        if (suggestionMatch) {
          const [, lineNumber, , suggestion] = suggestionMatch
          let targetLine = parseInt(lineNumber, 10)

          // 라인 번호가 파일 범위를 벗어나면 마지막 라인으로 조정
          if (targetLine > maxLine) {
            core.warning(`⚠️ 라인 ${targetLine}이 파일 범위(${maxLine})를 벗어나 마지막 라인으로 조정합니다.`)
            targetLine = maxLine
          }

          commentsToAdd.push({
            path: filePath,
            line: targetLine,
            side: 'RIGHT',
            body: `\`\`\`suggestion\n${suggestion.trim()}\n\`\`\``,
          })
          continue
        }

        const opinionMatch = line.match(opinionRegex)
        if (opinionMatch) {
          const [, lineRange, body] = opinionMatch
          // Extract the last number from the line range for the 'line' property
          let targetLine = parseInt(lineRange.split('-').pop(), 10)

          // 라인 번호가 파일 범위를 벗어나면 마지막 라인으로 조정
          if (targetLine > maxLine) {
            core.warning(`⚠️ 라인 ${targetLine}이 파일 범위(${maxLine})를 벗어나 마지막 라인으로 조정합니다.`)
            targetLine = maxLine
          }

          commentsToAdd.push({
            path: filePath,
            line: targetLine,
            side: 'RIGHT',
            body: body.trim(),
          })
        }
      }
      core.info(`✅ ${filePath}에 대한 AI 리뷰 처리를 완료했습니다.`)
    }

    // ─── 7) 수집된 모든 코멘트를 하나의 리뷰로 제출 ───────────────────────────────
    if (commentsToAdd.length > 0) {
      await octokit.pulls.createReview({
        owner,
        repo,
        pull_number: Number(prNumber),
        commit_id: headSha,
        body: 'AI 리뷰가 완료되었습니다. 아래 코멘트를 확인해주세요.',
        event: 'COMMENT',
        comments: commentsToAdd,
      })
      core.info(`🎉 총 ${commentsToAdd.length}개의 코멘트를 하나의 리뷰로 생성했습니다.`)
    } else {
      core.info('AI가 리뷰할 내용을 찾지 못했습니다.')
    }
  } catch (error) {
    core.setFailed(`오류 발생: ${error.message}`)
  }
}

run()