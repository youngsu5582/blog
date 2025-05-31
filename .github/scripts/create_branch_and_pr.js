/**
 * 파일 위치: .github/scripts/create_branch_and_pr.js
 * 역할: 이슈 번호/제목/본문을 받아서
 *   1) 브랜치 생성(예: issue-123-spring-webflux-vs-spring-mvc)
 *   2) _posts/아래에 Markdown 파일 생성(날짜-제목.md)
 *   3) Frontmatter 자동 삽입: title, author, date, tags, description, image.path
 *   4) OpenAI에 본문을 보내 tags/description 생성, v1/images/generations로 썸네일 URL 얻기 → 이미지 다운로드
 *   5) Markdown 파일 및 썸네일 이미지를 함께 Git 커밋 → 푸시 → PR 생성
 */

import fs from 'fs'
import path from 'path'
import https from 'https'
import {Octokit} from '@octokit/rest'
import * as core from '@actions/core'
import slugify from 'slugify'
import OpenAI from 'openai'

// 이미지 생성 시 사용할 크기 옵션
const DALL_E_SIZE = '1024x1024'

// 한글 슬러그
function slugI18N(str) {
  const nonKorean = /[^ㄱ-ㅎ|ㅏ-ㅣ|가-힣]+/g;
  let slugResult = str.trim().replaceAll(' ', '-').split(nonKorean);
  slugResult = slugResult.map(x => {
    return nonKorean.test(x) ? slugify(x) : encodeURI(x);
  }).join('');
  return slugResult
}

/**
 * 환경 변수를 읽고, 누락됐을 때는 프로세스를 종료합니다.
 */
function getEnvVars() {
  const repoFullName = process.env.REPOSITORY       // ex) "user/repo"
  const issueNumber = process.env.ISSUE_NUMBER     // ex) "123"
  const rawTitle = process.env.ISSUE_TITLE      // ex) "[블로그 초안] Spring WebFlux vs Spring MVC"
  const issueBodyRaw = process.env.ISSUE_BODY       // JSON 문자열: "\"# 제목\\n본문\""
  const token = process.env.GITHUB_TOKEN
  const openaiApiKey = process.env.OPENAI_API_KEY

  if (!repoFullName || !issueNumber || !rawTitle || !issueBodyRaw || !token
    || !openaiApiKey) {
    core.setFailed('필요한 환경 변수가 누락되었습니다.')
    process.exit(1)
  }

  let decodedTitle
  try {
    decodedTitle = decodeURIComponent(rawTitle)
  } catch {
    // 혹시 인코딩 오류가 있으면 그대로 rawTitle을 사용
    decodedTitle = rawTitle
  }

  core.info(`✅ 원본 ISSUE_TITLE (디코딩 전): ${rawTitle}`)
  core.info(`✅ 디코딩된 ISSUE_TITLE: ${decodedTitle}`)

  core.info('✅ 환경 변수 모두 읽어왔습니다.')
  return {
    repoFullName,
    issueNumber,
    issueTitle: decodedTitle,
    issueBodyRaw,
    token,
    openaiApiKey
  }
}

/**
 * Octokit과 OpenAI 클라이언트를 생성합니다.
 */
function initClients(token, openaiApiKey) {
  const octokit = new Octokit({auth: token})
  const openai = new OpenAI({apiKey: openaiApiKey})
  core.info('✅ Octokit 및 OpenAI 클라이언트 초기화 완료')
  return {octokit, openai}
}

/**
 * issueTitle에서 대괄호 [] 부분을 제거한 후
 * Frontmatter용 title, slug, cleanedTitle을 생성해 반환합니다.
 * strict:false 옵션을 사용해 한글도 그대로 유지되도록 합니다.
 */
function generateSlugAndTitle(issueTitle) {
  const cleanedTitle = issueTitle.replace(/^\[.*?\]\s*/, '').trim()
  const title = cleanedTitle.replace(/"/g, '\\"')
  let slug = slugI18N(cleanedTitle)

  // slug가 빈 문자열이라면, fallback으로 로마자 변환 후 다시 slugify
  if (!slug) {
    try {
      // `transliteration` 라이브러리가 설치되어 있다고 가정
      // import { transliterate } from 'transliteration'
      // const romanized = transliterate(cleanedTitle)
      const romanized = cleanedTitle // transliteration이 없다면 그대로 두고
      slug = slugify(romanized, {lower: true, strict: true})
    } catch {
      slug = `${Date.now()}` // 그래도 안되면 타임스탬프 사용
    }
  }

  core.info(`제목 (Frontmatter용): ${title}`)
  core.info(`슬러그 (파일명용): ${slug}`)
  return {cleanedTitle, title, slug}
}

/**
 * 현재 날짜(UTC)로부터 "YYYY-MM-DD" 형식을 생성해 반환합니다.
 */
function getDatePrefix() {
  const now = new Date()
  const yyyy = now.getUTCFullYear()
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(now.getUTCDate()).padStart(2, '0')
  const datePrefix = `${yyyy}-${mm}-${dd}`
  core.info(`오늘 날짜 프리픽스: ${datePrefix}`)
  return {now, datePrefix}
}

/**
 * owner/repo의 기본 브랜치 이름을 조회해 반환합니다.
 */
async function fetchDefaultBranch(octokit, owner, repo) {
  const {data: repoData} = await octokit.repos.get({owner, repo})
  const defaultBranch = repoData.default_branch
  core.info(`기본 브랜치 이름: ${defaultBranch}`)
  return defaultBranch
}

/**
 * 기본 브랜치의 최신 커밋 SHA를 구하고, 새 브랜치를 생성합니다.
 * 이미 브랜치가 존재할 경우 해당 커밋 SHA를 그대로 반환합니다.
 */
async function createBranch(octokit, owner, repo, defaultBranch, branchName) {
  const {data: refData} = await octokit.git.getRef({
    owner,
    repo,
    ref: `heads/${defaultBranch}`
  })
  const baseCommitSha = refData.object.sha

  try {
    await octokit.git.createRef({
      owner,
      repo,
      ref: `refs/heads/${branchName}`,
      sha: baseCommitSha
    })
    core.info(`✅ 새 브랜치 생성 완료: ${branchName}`)
  } catch (err) {
    if (err.status === 422 && err.message.includes(
      'Reference already exists')) {
      core.warning(`브랜치가 이미 존재합니다: ${branchName} (기존 커밋 SHA 유지)`)
    } else {
      throw err
    }
  }

  return baseCommitSha
}

/**
 * OpenAI ChatCompletion API를 통해 tags, description을 생성해 반환합니다.
 */
async function generateMetadata(openai, issueBody) {
  const tagDescSystemMsg = `
You are a helpful assistant that extracts metadata from a technical blog post draft.
Given the full Markdown content of the post (below), please respond in JSON format exactly with two fields:
1. "tags": an array of 2 to 4 concise tags (in Korean), representing key topics.
2. "description": a short summary of the post in Korean, 50~100자 이내.

Respond only with valid JSON. Do not include any extra text.
`
  const tagDescUserMsg = `
### 블로그 초안 Markdown 내용 (본문만) ###
\`\`\`
${issueBody.trim()}
\`\`\`
`
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {role: "system", content: tagDescSystemMsg},
      {role: "user", content: tagDescUserMsg}
    ],
    temperature: 0.3,
    max_tokens: 300
  })

  const content = response.choices[0].message.content.trim()
  let tags = []
  let description = ""
  try {
    const metadata = JSON.parse(content)
    tags = Array.isArray(metadata.tags) ? metadata.tags : []
    description = typeof metadata.description === "string"
      ? metadata.description : ""
    core.info(`✅ OpenAI 태그 생성: ${JSON.stringify(tags)}`)
    core.info(`✅ OpenAI 설명 생성: ${description}`)
  } catch (parseErr) {
    core.warning("🔶 OpenAI로부터 받은 태그/설명 JSON 파싱 실패")
    throw parseErr
  }
  return {tags, description}
}

/**
 * OpenAI v1/images/generations 엔드포인트를 사용해 이미지를 생성하고,
 * 응답에서 b64_json 또는 url을 판단해 로컬에 저장한 뒤, 상대 경로를 반환합니다.
 */
async function generateAndDownloadImage(openaiApiKey, cleanedTitle, datePrefix,
  slug) {
  if (fs.existsSync(`assets/img/thumbnail/${datePrefix}-${slug}.png`)) {
    core.debug(
      `이미지 파일이 이미 존재합니다: assets/img/thumbnail/${datePrefix}-${slug}.png`)
    return `assets/img/thumbnail/${datePrefix}-${slug}.png`
  }

  // 1) 프롬프트 및 요청 바디 구성
  const imagePrompt = `기술 블로그 썸네일: "${cleanedTitle}". 깔끔하고 전문가용 섬네일 스타일, 한국어 키워드 없이 간결히.`
  const requestBody = {
    model: 'gpt-image-1',    // 혹은 'dall-e-2' / 'dall-e-3'
    prompt: imagePrompt,
    n: 1,
    quality: 'medium',
    size: DALL_E_SIZE,
  }

  core.info('🔄 OpenAI v1/images/generations 요청 시작...')
  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${openaiApiKey}`
    },
    body: JSON.stringify(requestBody)
  })
  if (!response.ok) {
    const errText = await response.text()
    throw new Error(
      `이미지 생성 오류: ${response.status} ${response.statusText} - ${errText}`)
  }

  // 2) JSON 파싱
  const payload = await response.json()
  const firstItem = payload.data?.[0]
  if (!firstItem) {
    throw new Error('이미지 생성 응답이 비어 있습니다: ' + JSON.stringify(payload))
  }

  let imageBuffer
  if (firstItem.b64_json) {
    // 3) Base64 방식
    core.info('✅ OpenAI에서 제공된 b64_json 이미지 데이터 확인')
    imageBuffer = Buffer.from(firstItem.b64_json, 'base64')

  } else if (firstItem.url) {
    // 4) URL 다운로드 방식
    const imageUrl = firstItem.url
    core.info(`✅ OpenAI에서 제공된 이미지 URL 확인: ${imageUrl}`)

    const thumbnailDir = path.posix.join(process.cwd(), 'assets', 'img',
      'thumbnail')
    if (!fs.existsSync(thumbnailDir)) {
      fs.mkdirSync(thumbnailDir, {recursive: true})
      core.info(`✅ 썸네일 디렉토리 생성: ${thumbnailDir}`)
    }
    const imageFileName = `${datePrefix}-${slug}.png`
    const imageFilePath = path.posix.join(thumbnailDir, imageFileName)

    core.info('🔄 URL을 통해 이미지를 다운로드 중...')
    await downloadImage(imageUrl, imageFilePath)
    core.info(`✅ URL 이미지 다운로드 완료: ${imageFilePath}`)

    return `assets/img/thumbnail/${imageFileName}`
  } else {
    throw new Error(
      '응답에서 b64_json이나 url을 찾을 수 없습니다: ' + JSON.stringify(payload))
  }

  // 5) Base64로 받은 경우, 파일로 저장
  const thumbnailDir = path.posix.join(process.cwd(), 'assets', 'img',
    'thumbnail')
  if (!fs.existsSync(thumbnailDir)) {
    fs.mkdirSync(thumbnailDir, {recursive: true})
    core.info(`✅ 썸네일 디렉토리 생성: ${thumbnailDir}`)
  }
  const imageFileName = `${datePrefix}-${slug}.png`
  const imageFilePath = path.posix.join(thumbnailDir, imageFileName)

  fs.writeFileSync(imageFilePath, imageBuffer)
  core.info(`✅ Base64 이미지 저장 완료: ${imageFilePath}`)

  return `assets/img/thumbnail/${imageFileName}`
}

/**
 * 지정된 URL에서 이미지를 다운로드해 로컬에 저장하는 헬퍼 함수
 */
function downloadImage(url, filePath) {
  return new Promise((resolve, reject) => {
    const fileStream = fs.createWriteStream(filePath)
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        return reject(new Error(`이미지 다운로드 실패: HTTP ${res.statusCode}`))
      }
      res.pipe(fileStream)
      fileStream.on('finish', () => {
        fileStream.close()
        resolve()
      })
    }).on('error', (err) => {
      fs.unlink(filePath, () => {
      })
      reject(err)
    })
  })
}

/**
 * Frontmatter만 생성해 반환합니다.
 */
function composeFrontmatter(cleanedTitle, tags, description, imagePath, now) {
  const isoDate = now.toISOString()
  const lines = [
    '---',
    `title: "${cleanedTitle.replace(/"/g, '\\"')}"`,
    `author: "이영수"`,
    `date: ${isoDate}`,
    `tags: [${tags.map(tag => `"${tag.replace(/"/g, '\\"')}"`).join(', ')}]`,
    `description: "${description.replace(/"/g, '\\"')}"`,
    'image:',
    `  path: ${imagePath}`,
    '---',
    ''
  ]
  core.info('✅ Frontmatter 작성 완료')
  return lines.join('\n')
}

/**
 * GitHub API를 통해 Markdown과 Image를 Blob으로 만들고,
 * Tree에 추가하여 Commit → 브랜치 업데이트 → PR 생성합니다.
 */
async function commitAndCreatePR(octokit, owner, repo, baseCommitSha,
  branchName, mdFilePath, fullMarkdown, imagePath) {
  // 1) Markdown Blob 생성
  const mdBlob = await octokit.git.createBlob({
    owner,
    repo,
    content: Buffer.from(fullMarkdown).toString('base64'),
    encoding: 'base64'
  })
  const mdSha = mdBlob.data.sha
  core.info('✅ Markdown Blob 생성 완료')

  // 2) Image Blob 생성
  const imgBuffer = fs.readFileSync(path.join(process.cwd(), imagePath))
  const imgBlob = await octokit.git.createBlob({
    owner,
    repo,
    content: imgBuffer.toString('base64'),
    encoding: 'base64'
  })
  const imgSha = imgBlob.data.sha
  core.info('✅ Image Blob 생성 완료')

  // 3) baseCommit → Tree 조회
  const {data: baseCommit} = await octokit.git.getCommit({
    owner,
    repo,
    commit_sha: baseCommitSha
  })
  const baseTreeSha = baseCommit.tree.sha

  // 4) 새 Tree 생성 (Markdown + Image)
  const {data: newTree} = await octokit.git.createTree({
    owner,
    repo,
    base_tree: baseTreeSha,
    tree: [
      {
        path: mdFilePath,
        mode: '100644',
        type: 'blob',
        sha: mdSha
      },
      {
        path: imagePath,
        mode: '100644',
        type: 'blob',
        sha: imgSha
      }
    ]
  })
  const newTreeSha = newTree.sha
  core.info('✅ 새 Tree 생성 완료 (Markdown + Image)')

  // 5) 새 Commit 생성
  const commitMessage = `post: ${path.basename(mdFilePath)} 작성`
  const {data: newCommit} = await octokit.git.createCommit({
    owner,
    repo,
    message: commitMessage,
    tree: newTreeSha,
    parents: [baseCommitSha]
  })
  const newCommitSha = newCommit.sha
  core.info(`✅ 새 Commit 생성 완료: ${commitMessage}`)

  await octokit.git.updateRef({
    owner,
    repo,
    ref: `heads/${branchName}`,
    sha: newCommitSha
  })
  core.info(`✅ 브랜치(${branchName})가 새 커밋을 가리키도록 업데이트되었습니다`)

  // 7) PR 생성
  const prTitle = `[블로그 초안] ${path.basename(mdFilePath, '.md').slice(11)}`
  const prBody = `자동 생성된 PR입니다. 블로그 초안 파일(\`${mdFilePath}\`)을 확인해주세요.`
  await octokit.pulls.create({
    owner,
    repo,
    head: branchName,
    base: (await octokit.repos.get({owner, repo})).data.default_branch,
    title: prTitle,
    body: prBody
  })
  core.info(`✅ PR 생성 완료: ${prTitle}`)
}

async function run() {
  try {
    // 1) 환경 변수 읽기
    const {
      repoFullName,
      issueNumber,
      issueTitle,
      issueBodyRaw,
      token,
      openaiApiKey
    } = getEnvVars()
    const [owner, repo] = repoFullName.split('/')
    const issueBodyTrimmed = JSON.parse(issueBodyRaw).trim()

    // 2) 클라이언트 초기화
    const {octokit, openai} = initClients(token, openaiApiKey)

    // 3) 기본 브랜치 조회
    const defaultBranch = await fetchDefaultBranch(octokit, owner, repo)

    // 4) 브랜치명, cleanedTitle, slug 생성
    const {cleanedTitle, slug} = generateSlugAndTitle(issueTitle)
    const {now, datePrefix} = getDatePrefix()
    const branchName = `issue-${issueNumber}-${slug}`
    const mdFileName = `${datePrefix}-${slug}.md`
    const postsDir = path.posix.join(process.cwd(), '_posts')
    const mdFilePath = path.posix.join('_posts', mdFileName)

    // 5) 새 브랜치 생성 (이미 존재해도 무시)
    const baseCommitSha = await createBranch(octokit, owner, repo,
      defaultBranch, branchName)

    // 6) postsDir가 없으면 생성
    if (!fs.existsSync(postsDir)) {
      fs.mkdirSync(postsDir, {recursive: true})
      core.info(`✅ _posts 디렉토리 생성: ${postsDir}`)
    }

    // 7) tags, description 생성
    const {tags, description} = await generateMetadata(openai, issueBodyTrimmed)

    // 8) 썸네일 생성 및 다운로드
    const imagePathForFrontmatter = await generateAndDownloadImage(openaiApiKey,
      cleanedTitle, datePrefix, slug)

    // 9) Frontmatter 작성
    const frontmatter = composeFrontmatter(cleanedTitle, tags, description,
      imagePathForFrontmatter, now)

    // 10) fullMarkdown 구성
    const fullMarkdown = frontmatter + issueBodyTrimmed + '\n'

    // 11) Commit & PR 생성
    await commitAndCreatePR(octokit, owner, repo, baseCommitSha, branchName,
      mdFilePath, fullMarkdown, imagePathForFrontmatter)

    core.info('🎉 모든 단계가 완료되었습니다.')
  } catch (error) {
    core.error(`❌ 실행 중 오류 발생! 오류 이유: ${error.message}`)
    core.setFailed(error.message)
  }
}

run()
