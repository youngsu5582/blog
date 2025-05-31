/**
 * 파일 위치: .github/scripts/create_branch_and_pr.js
 * 역할: 이슈 번호/제목/본문을 받아서
 *   1) 브랜치 생성(예: issue-123-spring-webflux-vs-mvc)
 *   2) _posts/아래에 Markdown 파일 생성(날짜-제목.md)
 *   3) Frontmatter 자동 삽입: title, author, date, tags, description, image.path
 *   4) OpenAI에 본문을 보내 tags/description 생성, DALL·E로 썸네일 생성
 *   5) Git 커밋 후 푸시, PR 생성
 */

import fs from 'fs'
import path from 'path'
import { Octokit } from '@octokit/rest'
import * as core from '@actions/core'
import slugify from 'slugify'
import OpenAI from 'openai'    // 최신 openai 패키지 기본 클래스

// OpenAI 이미지 생성 옵션
const DALL_E_SIZE = '1024x1024'

async function run() {
  try {
    // 1) 환경 변수 읽기
    const repoFullName = process.env.REPOSITORY       // ex) user/repo
    const issueNumber = process.env.ISSUE_NUMBER     // ex) "123"
    const issueTitle = process.env.ISSUE_TITLE      // ex) "[블로그 초안] Spring WebFlux vs Spring MVC"
    const issueBodyRaw = process.env.ISSUE_BODY       // JSON 문자열: "\"# 제목\\n본문\""
    const token = process.env.GITHUB_TOKEN
    const openaiApiKey = process.env.OPENAI_API_KEY

    if (!repoFullName || !issueNumber || !issueTitle || !issueBodyRaw
      || !token || !openaiApiKey) {
      core.setFailed('필요한 환경 변수가 누락되었습니다.')
      return
    }

    // 2) Octokit 및 OpenAI 인스턴스 생성
    const octokit = new Octokit({ auth: token })
    const openai = new OpenAI({ apiKey: openaiApiKey })

    const [owner, repo] = repoFullName.split('/')

    // 3) 기본 브랜치(이후 커밋 및 PR 대상) 조회
    const { data: repoData } = await octokit.repos.get({ owner, repo })
    const defaultBranch = repoData.default_branch   // 보통 "main" 또는 "master"

    // 4) 브랜치명 및 파일명 생성
    const cleanedTitle = issueTitle.replace(/^\[.*?\]\s*/, '').trim()
    const slug = slugify(cleanedTitle, { lower: true, strict: true })

    // 오늘 날짜(UTC) "YYYY-MM-DD" 형식
    const now = new Date()
    const yyyy = now.getUTCFullYear()
    const mm = String(now.getUTCMonth() + 1).padStart(2, '0')
    const dd = String(now.getUTCDate()).padStart(2, '0')
    const datePrefix = `${yyyy}-${mm}-${dd}`

    // 파일명: "YYYY-MM-DD-슬러그.md"
    const fileName = `${datePrefix}-${slug}.md`
    // 저장 경로: "_posts/파일명.md"
    const postsDir = path.posix.join(process.cwd(), '_posts')
    const filePath = path.posix.join('_posts', fileName)

    // 5) 기본 브랜치의 최신 커밋 SHA 조회 → 새 브랜치 생성
    const { data: refData } = await octokit.git.getRef({
      owner, repo, ref: `heads/${defaultBranch}`
    })
    const baseCommitSha = refData.object.sha

    const branchName = `issue-${issueNumber}-${slug}`  // 예: issue-123-spring-webflux-vs-spring-mvc
    await octokit.git.createRef({
      owner, repo,
      ref: `refs/heads/${branchName}`,
      sha: baseCommitSha
    })

    // 6) 이슈 본문 복원(escaping 된 JSON → 원문 텍스트)
    const issueBody = JSON.parse(issueBodyRaw)

    // 7) _posts 디렉토리 생성(존재하지 않으면)
    if (!fs.existsSync(postsDir)) {
      fs.mkdirSync(postsDir, { recursive: true })
    }

    // =====================================================
    // 8) OpenAI 호출: tags, description 생성
    // =====================================================
    const tagDescSystemMsg = `
You are a helpful assistant that extracts metadata from a technical blog post draft.
Given the full Markdown content of the post (below), please respond in JSON format exactly with two fields:
1. "tags": an array of 2 to 4 concise tags (in Korean, without quotes), representing key topics.
2. "description": a short summary of the post in Korean, 50~100자 이내.

Respond only with valid JSON. Do not include any extra text.
`
    const tagDescUserMsg = `
### 블로그 초안 Markdown 내용 (본문만) ###
\`\`\`
${issueBody.trim()}
\`\`\`
`
    // ChatCompletion 요청
    const tagDescResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: tagDescSystemMsg },
        { role: "user", content: tagDescUserMsg }
      ],
      temperature: 0.3,
      max_tokens: 300
    })

    let tags = []
    let description = ""
    try {
      const jsonText = tagDescResponse.choices[0].message.content.trim()
      const metadata = JSON.parse(jsonText)
      tags = Array.isArray(metadata.tags) ? metadata.tags : []
      description = typeof metadata.description === 'string' ? metadata.description : ""
    } catch (parseErr) {
      core.warning("OpenAI로부터 받은 태그/설명 JSON 파싱 실패, 기본값으로 대체합니다.")
      tags = []
      description = ""
    }

    // =====================================================
    // 9) OpenAI DALL·E 호출: 썸네일 이미지 생성
    // =====================================================
    const imagePrompt = `기술 블로그 썸네일: "${cleanedTitle}". 깔끔하고 전문가용 섬네일 스타일, 한국어 키워드 없이 간결히.`
    const imageResponse = await openai.images.generate({
      prompt: imagePrompt,
      n: 1,
      size: DALL_E_SIZE,
      response_format: 'b64_json'
    })

    const b64Image = imageResponse.data[0].b64_json
    // 이미지 파일 저장 경로: "assets/img/thumbnail/YYYY-MM-DD-슬러그.png"
    const thumbnailDir = path.posix.join(process.cwd(), 'assets', 'img', 'thumbnail')
    if (!fs.existsSync(thumbnailDir)) {
      fs.mkdirSync(thumbnailDir, { recursive: true })
    }
    const imageFileName = `${datePrefix}-${slug}.png`
    const imageFilePath = path.posix.join(thumbnailDir, imageFileName)
    const imageBuffer = Buffer.from(b64Image, 'base64')
    fs.writeFileSync(imageFilePath, imageBuffer)

    const imagePathForFrontmatter = `assets/img/thumbnail/${imageFileName}`

    // =====================================================
    // 10) Frontmatter 작성
    // =====================================================
    const isoDate = now.toISOString()  // 예: "2024-06-18T05:09:00.427Z"

    const frontmatterLines = [
      '---',
      `title: "${cleanedTitle.replace(/"/g, '\\"')}"`,
      `author: "이영수"`,
      `date: ${isoDate}`,
      `tags: [${tags.map(tag => `"${tag.replace(/"/g, '\\"')}"`).join(', ')}]`,
      `description: "${description.replace(/"/g, '\\"')}"`,
      'image:',
      `  path: ${imagePathForFrontmatter}`,
      '---',
      ''
    ]
    const frontmatter = frontmatterLines.join('\n')

    const fullMarkdown = frontmatter + issueBody.trim() + '\n'

    // =====================================================
    // 11) GitHub API로 Blob→Tree→Commit→Branch→PR 생성
    // =====================================================
    // 11-1) Blob 생성
    const blobResponse = await octokit.git.createBlob({
      owner, repo,
      content: Buffer.from(fullMarkdown).toString('base64'),
      encoding: 'base64'
    })
    const blobSha = blobResponse.data.sha

    // 11-2) baseCommit -> Tree 조회
    const { data: baseCommit } = await octokit.git.getCommit({
      owner, repo, commit_sha: baseCommitSha
    })
    const baseTreeSha = baseCommit.tree.sha

    // 11-3) 새 Tree 생성 (파일 하나 추가)
    const { data: newTree } = await octokit.git.createTree({
      owner, repo,
      base_tree: baseTreeSha,
      tree: [
        {
          path: filePath,
          mode: '100644',
          type: 'blob',
          sha: blobSha
        }
      ]
    })
    const newTreeSha = newTree.sha

    // 11-4) 새 Commit 생성
    const commitMessage = `Add blog draft: ${fileName} (from issue #${issueNumber})`
    const { data: newCommit } = await octokit.git.createCommit({
      owner, repo,
      message: commitMessage,
      tree: newTreeSha,
      parents: [baseCommitSha]
    })
    const newCommitSha = newCommit.sha

    // 11-5) 새 브랜치 ref 업데이트
    await octokit.git.updateRef({
      owner, repo,
      ref: `heads/${branchName}`,
      sha: newCommitSha
    })

    // 11-6) Pull Request 생성
    const prTitle = `[블로그 초안] ${cleanedTitle}`
    const prBody = `자동 생성된 PR입니다. 이슈 #${issueNumber}의 내용을 기반으로 작성된 블로그 초안 파일(\`${filePath}\`)을 검토해주세요.`

    await octokit.pulls.create({
      owner, repo,
      head: branchName,
      base: defaultBranch,
      title: prTitle,
      body: prBody
    })

    core.info(`✅ 브랜치(${branchName})와 PR이 성공적으로 생성되었습니다`)
    core.info(`✅ 썸네일 이미지 저장 경로: ${imageFilePath}`)
  } catch (error) {
    core.setFailed(`오류 발생: ${error.message}`)
  }
}

run()
