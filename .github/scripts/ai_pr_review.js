/**
 * 파일 위치: .github/scripts/ai_pr_review.js
 * 역할: PR의 변경 파일 중 Markdown 파일을 찾아
 *   - 파일 내용 라인별로 AI에게 “테크니컬 라이팅 리뷰 요청”
 *   - AI의 응답(JSON)을 파싱해 PR 파일에 리뷰 코멘트 작성
 */

import {Octokit} from '@octokit/rest'
import {Configuration, OpenAIApi} from 'openai'
import * as core from '@actions/core'

// 1) 환경 변수 로드
const repoFullName = process.env.REPOSITORY     // ex) "user/repo"
const prNumber = process.env.PR_NUMBER
const token = process.env.GITHUB_TOKEN
const openaiKey = process.env.OPENAI_API_KEY

if (!repoFullName || !prNumber || !token || !openaiKey) {
  core.setFailed('필요한 환경 변수가 누락되었습니다.')
  process.exit(1)
}

const [owner, repo] = repoFullName.split('/')

// 2) Octokit 초기화 (GitHub API)
const octokit = new Octokit({auth: token})

// 3) OpenAI 초기화
const configuration = new Configuration({apiKey: openaiKey})
const openai = new OpenAIApi(configuration)

async function run() {
  try {
    // 4) PR의 변경된 파일 목록 조회
    const {data: files} = await octokit.pulls.listFiles({
      owner, repo,
      pull_number: Number(prNumber)
    })

    // 5) 변경 파일 중 Markdown(.md)만 선택
    const mdFiles = files.filter(
      file => file.filename.endsWith('.md') && file.status !== 'removed')
    if (mdFiles.length === 0) {
      core.info('변경된 Markdown 파일이 없습니다. 종료합니다.')
      return
    }

    // 6) 각 Markdown 파일별로 리뷰 진행
    for (const file of mdFiles) {
      const filePath = file.filename            // ex) "content/spring-webflux-vs-spring-mvc.md"

      // 6-1) 파일 원본 전체 내용 가져오기
      //      → 리포지토리의 HEAD 커밋 기준으로 파일 읽음
      const {data: fileContent} = await octokit.repos.getContent({
        owner, repo,
        path: filePath,
        ref: `refs/heads/${file.patch ? file.sha : file.blob_url}`  // 정확한 ref 지정
      })
      // GitHub API는 base64로 반환
      const decodedContent = Buffer.from(fileContent.content,
        'base64').toString('utf-8')
      const lines = decodedContent.split('\n')

      // 7) AI에게 “테크니컬 라이터 관점” 피드백 요청 프롬프트 생성
      //    → 각 줄 번호와 해당 줄 텍스트를 포함해서 보내면, AI가 라인 단위로 의견을 달기 수월
      const promptLines = lines.map((line, idx) => {
        return `${idx + 1} | ${line}`
      }).join('\n')

      // 8) 프롬프트 템플릿
      const systemMessage = `
You are a senior technical writer. 아래 Markdown 파일 내용을 라인 번호와 함께 읽고,
기술적 정확성, 문법·표현, 글 구조, 가독성 등을 기준으로 부족한 부분이 있다면
“라인 번호| 피드백 내용” 형식으로만 응답하세요.
최대한 구체적이고 간결하게 작성해주세요.
`
      const userMessage = `
파일 경로: ${filePath}

라인 번호| 텍스트 명단:
\`\`\`
${promptLines}
\`\`\`
`

      // 9) OpenAI ChatCompletion 호출
      const completion = await openai.createChatCompletion({
        model: "gpt-4o-mini",   // 가능한 최신 모델 사용
        messages: [
          {role: "system", content: systemMessage},
          {role: "user", content: userMessage}
        ],
        temperature: 0.3,
        max_tokens: 1000
      })

      const aiResponse = completion.data.choices[0].message.content.trim()
      // ex: "5 | 'WebFlux 비동기 처리이다.' -> 'WebFlux는 비동기 처리 방식입니다.'\n12 | 헤더 수준 개선 필요 ..."

      // 10) AI 응답 파싱: "라인 번호| 피드백 내용" 형태를 JSON으로 변환
      const commentEntries = aiResponse.split('\n').map(line => {
        const parts = line.split('|').map(p => p.trim())
        const lineNumber = parseInt(parts[0])
        const commentText = parts.slice(1).join('|').trim()
        return {lineNumber, commentText}
      }).filter(entry => !isNaN(entry.lineNumber) && entry.commentText)

      if (commentEntries.length === 0) {
        core.info(`AI가 ${filePath}에 대해 피드백을 제공하지 않았습니다.`)
        continue
      }

      // 11) PR Review Comment API를 이용해 각 줄에 코멘트 작성
      for (const entry of commentEntries) {
        await octokit.pulls.createReviewComment({
          owner, repo,
          pull_number: Number(prNumber),
          commit_id: file.sha,                // PR HEAD 커밋 SHA (files API에서 제공된 SHA 사용)
          path: filePath,
          line: entry.lineNumber,
          side: 'RIGHT',                      // 변경된 버전(HEAD) 기준
          body: entry.commentText
        })
      }

      core.info(
        `✅ ${filePath}에 대해 ${commentEntries.length}개의 AI 리뷰 코멘트를 생성했습니다.`)
    }
  } catch (error) {
    core.setFailed(`오류 발생: ${error.message}`)
  }
}

run()
