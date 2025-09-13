/**
 * 파일 위치: .github/scripts/create_branch_and_pr.js
 * 역할: 이슈 번호/제목/본문을 받아서
 *   1) 브랜치 생성/재사용(예: issue-123)
 *   2) _posts/아래에 Markdown 파일 생성(날짜-영어-slug.md)
 *   3) Frontmatter 자동 삽입: title, author, date, tags, description, image.path
 *   4) OpenAI에 본문을 보내 tags/description/slug(영어) 생성, v1/images/generations로 썸네일 얻기 → 이미지 저장
 *   5) Markdown + 썸네일을 커밋 → 브랜치 업데이트 → PR 생성
 *   6) 요약을 GitHub Job Summary에 출력
 */

import fs from 'fs'
import path from 'path'
import https from 'https'
import { Octokit } from '@octokit/rest'
import * as core from '@actions/core'
import matter from 'gray-matter'

// 이미지 생성 시 사용할 크기 옵션
const DALL_E_SIZE = '1024x1024'

// --- Logging & Parse helpers ---

/** 민감키 마스킹 */
function redact(str, head = 6, tail = 4) {
  if (!str) return ''
  const s = String(str)
  if (s.length <= head + tail) return s[0] + '…'
  return s.slice(0, head) + '…' + s.slice(-tail)
}

/** 코드펜스/잡텍스트 제거하고 JSON 블록만 추출 */
function extractJsonFromText(text) {
  if (!text) return ''
  let t = String(text).trim()

  // ```json ... ``` 제거
  if (t.startsWith('```')) {
    t = t.replace(/^```(?:json)?\s*/i, '').replace(/```$/m, '').trim()
  }
  // 앞뒤에 설명이 붙은 경우 최초 { 부터 마지막 } 까지 추출
  if (!t.startsWith('{')) {
    const start = t.indexOf('{')
    const end = t.lastIndexOf('}')
    if (start !== -1 && end !== -1 && end > start) {
      t = t.slice(start, end + 1)
    }
  }
  return t
}

/**
 * 요청/응답 전체를 로깅하면서 JSON을 반환.
 * - Authorization 은 마스킹
 * - 이미지 생성 응답의 큰 b64_json은 로그에서 생략
 */
async function logAndFetchJSON(url, options = {}, label = '') {
  const method = options.method || 'GET'
  const headers = Object.assign({}, options.headers)

  const loggedHeaders = { ...headers }
  if (loggedHeaders.Authorization) {
    const token = String(loggedHeaders.Authorization).replace(/^Bearer\s+/i, '')
    loggedHeaders.Authorization = `Bearer ${redact(token)}`
  }

  core.info(`🔎 [REQ ${label}] ${method} ${url}`)
  core.debug(`🔎 [REQ ${label}] headers: ${JSON.stringify(loggedHeaders)}`)

  if (options.body) {
    const bodyStr = typeof options.body === 'string' ? options.body : JSON.stringify(options.body)
    core.debug(`🔎 [REQ ${label}] body (<=1000 chars): ${bodyStr.slice(0, 1000)}${bodyStr.length > 1000 ? '…' : ''}`)
  }

  const res = await fetch(url, options)
  const rawText = await res.text()

  // 헤더/바디 로깅 (b64_json 축약)
  const headersObj = {}
  try { for (const [k, v] of res.headers.entries()) headersObj[k] = v } catch {}
  core.info(`📥 [RES ${label}] status: ${res.status} ${res.statusText}`)
  core.debug(`📥 [RES ${label}] headers: ${JSON.stringify(headersObj)}`)

  const textForLog = rawText.replace(/("b64_json"\s*:\s*")([A-Za-z0-9+/=]{100,})(\")/g, '$1<omitted>$3')
  core.debug(`📥 [RES ${label}] body (<=2000 chars): ${textForLog.slice(0, 2000)}${textForLog.length > 2000 ? '…' : ''}`)

  let json
  try {
    json = JSON.parse(rawText)
  } catch (e) {
    core.warning(`JSON 파싱 실패 [${label}]: ${e.message}`)
    throw new Error(`HTTP ${res.status} 응답 JSON 파싱 실패: ${e.message}`)
  }

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText}: ${JSON.stringify(json)}`)
  }
  return json
}

/**
 * 환경 변수를 읽고, 누락됐을 때는 프로세스를 종료합니다.
 */
function getEnvVars() {
  const repoFullName = process.env.REPOSITORY       // ex) "user/repo"
  const issueNumber  = process.env.ISSUE_NUMBER     // ex) "123"
  const rawTitle     = process.env.ISSUE_TITLE      // ex) "[블로그 초안] Spring WebFlux vs Spring MVC"
  const issueBodyRaw = process.env.ISSUE_BODY       // JSON 문자열: "\"# 제목\n본문\""
  // GH_PAT (Personal Access Token)을 우선적으로 사용하고, 없으면 GITHUB_TOKEN을 사용
  const token = process.env.GH_PAT || process.env.GITHUB_TOKEN
  if (process.env.GH_PAT) {
    core.info('✅ 개인용 액세스 토큰(GH_PAT)을 사용하여 인증합니다.')
  } else {
    core.warning('🟠 기본 GITHUB_TOKEN을 사용하여 인증합니다. (다른 워크플로우를 트리거하지 않을 수 있음)')
  }
  // Metadata generation (still needs openai)
  const openaiApiKey = process.env.OPENAI_API_KEY

  if (!repoFullName || !issueNumber || !rawTitle || !issueBodyRaw || !token || !openaiApiKey) {
    core.setFailed('필요한 환경 변수가 누락되었습니다.')
    process.exit(1)
  }

  let decodedTitle
  try {
    decodedTitle = decodeURIComponent(rawTitle)
  } catch {
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
 * Octokit 클라이언트를 생성합니다.
 */
function initClients(token) {
  const octokit = new Octokit({ auth: token })
  core.info('✅ Octokit 클라이언트 초기화 완료')
  return { octokit }
}

/**
 * issueTitle에서 선두의 [태그] 제거 후
 * Frontmatter용 title과 OpenAI용 cleanedTitle을 반환
 */
function generateSlugAndTitle(issueTitle) {
  const cleanedTitle = issueTitle.replace(/^\[.*?]\s*/, '').trim()
  const title = cleanedTitle.replace(/"/g, '\\"')
  core.info(`제목 (Frontmatter용): ${title}`)
  return { title, cleanedTitle }
}

/**
 * 현재 날짜(UTC) "YYYY-MM-DD" 생성
 */
function getDatePrefix() {
  const now = new Date()
  const yyyy = now.getUTCFullYear()
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(now.getUTCDate()).padStart(2, '0')
  const datePrefix = `${yyyy}-${mm}-${dd}`
  core.info(`오늘 날짜 프리픽스: ${datePrefix}`)
  return { now, datePrefix }
}

/**
 * 기본 브랜치 이름 조회
 */
async function fetchDefaultBranch(octokit, owner, repo) {
  const { data: repoData } = await octokit.repos.get({ owner, repo })
  const defaultBranch = repoData.default_branch
  core.info(`기본 브랜치 이름: ${defaultBranch}`)
  return defaultBranch
}

/**
 * 브랜치를 보장(ensure)합니다.
 * - 이미 존재하면: 해당 브랜치 HEAD SHA를 반환 (fast-forward 기준점)
 * - 없으면: 기본 브랜치에서 분기하여 새로 만들고 그 SHA 반환
 */
async function ensureBranch(octokit, owner, repo, defaultBranch, branchName) {
  try {
    const { data } = await octokit.git.getRef({ owner, repo, ref: `heads/${branchName}` })
    core.warning(`브랜치가 이미 존재합니다: ${branchName} @ ${data.object.sha}`)
    return { baseCommitSha: data.object.sha, created: false }
  } catch (e) {
    if (e.status !== 404) throw e
    // 기본 브랜치 HEAD 조회
    const { data: refData } = await octokit.git.getRef({ owner, repo, ref: `heads/${defaultBranch}` })
    const baseCommitSha = refData.object.sha
    // 새 브랜치 생성
    await octokit.git.createRef({
      owner, repo,
      ref: `refs/heads/${branchName}`,
      sha: baseCommitSha
    })
    core.info(`✅ 새 브랜치 생성 완료: ${branchName}`)
    return { baseCommitSha, created: true }
  }
}

/**
 * OpenAI Chat Completions 호출 → tags/description/slug 생성(로그 포함)
 */
async function generateMetadata(openaiApiKey, issueBody, cleanedTitle) {
  const tagDescSystemMsg = `
You are a helpful assistant that extracts metadata from a technical blog post draft.
Given the full Markdown content and the title of the post, please respond in JSON format exactly with three fields:
1. "tags": an array of 2 to 4 concise tags (in Korean), representing key topics.
2. "description": a short summary of the post in Korean, 50~100자 이내.
3. "slug": a URL-friendly slug for the title. It should be in lowercase English, with words separated by hyphens.

Title: "${cleanedTitle}"

Respond only with valid JSON. Do not include any extra text.
`.trim()

  const tagDescUserMsg = `
### 블로그 초안 Markdown 내용 (본문만) ###
\`\`\`
${issueBody.trim()}
\`\`\`
`.trim()

  const payload = {
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: tagDescSystemMsg },
      { role: 'user', content: tagDescUserMsg }
    ],
    temperature: 0.3,
    max_tokens: 350,
    response_format: { type: 'json_object' } // JSON만 반환
  }

  const json = await logAndFetchJSON(
    'https://api.openai.com/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`
      },
      body: JSON.stringify(payload)
    },
    'openai:chat-metadata'
  )

  const raw = json?.choices?.[0]?.message?.content ?? ''
  core.info(`🧾 OpenAI 원문 콘텐츠 (앞 200자): ${raw.slice(0, 200)}${raw.length > 200 ? '…' : ''}`)

  const cleaned = extractJsonFromText(raw)
  let tags = [], description = '', slug = ''
  try {
    const meta = JSON.parse(cleaned)
    tags = Array.isArray(meta.tags) ? meta.tags : []
    description = typeof meta.description === 'string' ? meta.description : ''
    slug = typeof meta.slug === 'string' ? meta.slug.trim() : ''
    if (!slug) throw new Error('OpenAI did not return a valid slug.')
  } catch (e) {
    core.warning('🔶 OpenAI 메타데이터 파싱 실패 (코드펜스 제거 후에도 실패)')
    core.debug(`🔧 cleaned candidate: ${cleaned.slice(0, 500)}${cleaned.length > 500 ? '…' : ''}`)
    throw e
  }

  core.info(`✅ OpenAI 태그 생성: ${JSON.stringify(tags)}`)
  core.info(`✅ OpenAI 설명 생성: ${description}`)
  core.info(`✅ OpenAI 슬러그 생성: ${slug}`)
  return { tags, description, slug }
}

/**
 * OpenAI v1/images/generations 호출 → 이미지 저장
 */
async function generateAndDownloadImage(openaiApiKey, cleanedTitle, datePrefix, slug) {
  const outRelPath = `assets/img/thumbnail/${datePrefix}-${slug}.png`
  const outAbsDir  = path.posix.join(process.cwd(), 'assets', 'img', 'thumbnail')
  const outAbsPath = path.posix.join(outAbsDir, `${datePrefix}-${slug}.png`)

  if (fs.existsSync(outAbsPath)) {
    core.debug(`이미지 파일이 이미 존재합니다: ${outRelPath}`)
    return outRelPath
  }

  const imagePrompt =
    `A minimalist 3D icon representing "${cleanedTitle}". ` +
    `Clean tech blog thumbnail, glassmorphism effect, soft ambient lighting, and vibrant accent colors ` +
    `on a smooth, blurred gradient background. Eye-catching design.`

  const requestBody = {
    model: 'gpt-image-1',   // 혹은 'dall-e-2' / 'dall-e-3'
    prompt: imagePrompt,
    n: 1,
    quality: 'medium',
    size: DALL_E_SIZE,
  }

  core.info('🔄 OpenAI v1/images/generations 요청 시작...')
  const payload = await logAndFetchJSON(
    'https://api.openai.com/v1/images/generations',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`
      },
      body: JSON.stringify(requestBody)
    },
    'openai:image-gen'
  )

  const firstItem = payload.data?.[0]
  if (!firstItem) {
    throw new Error('이미지 생성 응답이 비어 있습니다: ' + JSON.stringify(payload))
  }

  if (!fs.existsSync(outAbsDir)) {
    fs.mkdirSync(outAbsDir, { recursive: true })
    core.info(`✅ 썸네일 디렉토리 생성: ${outAbsDir}`)
  }

  if (firstItem.b64_json) {
    core.info('✅ OpenAI에서 제공된 b64_json 이미지 데이터 확인')
    const imageBuffer = Buffer.from(firstItem.b64_json, 'base64')
    fs.writeFileSync(outAbsPath, imageBuffer)
    core.info(`✅ Base64 이미지 저장 완료: ${outAbsPath}`)
    return outRelPath
  }

  if (firstItem.url) {
    const imageUrl = firstItem.url
    core.info(`✅ OpenAI에서 제공된 이미지 URL 확인: ${imageUrl}`)
    core.info('🔄 URL을 통해 이미지를 다운로드 중...')
    await downloadImage(imageUrl, outAbsPath)
    core.info(`✅ URL 이미지 다운로드 완료: ${outAbsPath}`)
    return outRelPath
  }

  throw new Error('응답에서 b64_json이나 url을 찾을 수 없습니다: ' + JSON.stringify(payload))
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
      fs.unlink(filePath, () => {})
      reject(err)
    })
  })
}

/**
 * Markdown + Image를 Blob으로 만들고, Tree 생성 → 커밋 → 브랜치 업데이트 → PR 생성
 * 반환: { newCommitSha, prUrl (있으면) }
 */
async function commitAndCreatePR(octokit, owner, repo, baseCommitSha,
  branchName, title, mdFilePath, fullMarkdown, imagePath, defaultBranch) {
  // 1) Markdown Blob
  const mdBlob = await octokit.git.createBlob({
    owner, repo,
    content: Buffer.from(fullMarkdown).toString('base64'),
    encoding: 'base64'
  })
  const mdSha = mdBlob.data.sha
  core.info('✅ Markdown Blob 생성 완료')

  // 2) Image Blob
  const imgBuffer = fs.readFileSync(path.join(process.cwd(), imagePath))
  const imgBlob = await octokit.git.createBlob({
    owner, repo,
    content: imgBuffer.toString('base64'),
    encoding: 'base64'
  })
  const imgSha = imgBlob.data.sha
  core.info('✅ Image Blob 생성 완료')

  // 3) baseCommit → Tree 조회
  const { data: baseCommit } = await octokit.git.getCommit({
    owner, repo, commit_sha: baseCommitSha
  })
  const baseTreeSha = baseCommit.tree.sha

  // 4) 새 Tree 생성 (Markdown + Image)
  const { data: newTree } = await octokit.git.createTree({
    owner, repo,
    base_tree: baseTreeSha,
    tree: [
      { path: mdFilePath, mode: '100644', type: 'blob', sha: mdSha },
      { path: imagePath, mode: '100644', type: 'blob', sha: imgSha }
    ]
  })
  const newTreeSha = newTree.sha
  core.info('✅ 새 Tree 생성 완료 (Markdown + Image)')

  // 5) 새 Commit 생성 (부모 = baseCommitSha)
  const commitMessage = `post: ${title} 작성`
  const { data: newCommit } = await octokit.git.createCommit({
    owner, repo,
    message: commitMessage,
    tree: newTreeSha,
    parents: [baseCommitSha]
  })
  const newCommitSha = newCommit.sha
  core.info(`✅ 새 Commit 생성 완료: ${commitMessage}`)

  // 6) 브랜치 heads/{branchName}를 새 커밋으로 fast-forward
  await octokit.git.updateRef({
    owner, repo,
    ref: `heads/${branchName}`,
    sha: newCommitSha,
    force: false // fast-forward만 허용
  })
  core.info(`✅ 브랜치(${branchName})가 새 커밋을 가리키도록 업데이트되었습니다`)

  // 7) PR 생성 (이미 있으면 스킵)
  let prUrl = null
  try {
    const { data: pr } = await octokit.pulls.create({
      owner, repo,
      head: branchName,
      base: defaultBranch,
      title: `[게시글 초안] ${title}`,
      body: `자동 생성된 PR입니다. 게시글 초안 파일(\`${mdFilePath}\`)을 확인해주세요.`
    })
    prUrl = pr.html_url
    core.info(`✅ PR 생성 완료: ${prUrl}`)
  } catch (e) {
    if (e.status === 422 && String(e.message).includes('A pull request already exists')) {
      core.warning('PR가 이미 존재합니다. 생성 단계를 건너뜁니다.')
      // 기존 PR URL을 조회해도 좋지만, 여기서는 생략
    } else {
      throw e
    }
  }

  return { newCommitSha, prUrl }
}

/**
 * GitHub Job Summary에 결과를 깔끔하게 출력
 */
async function writeJobSummary({
  title, tags, description, slug,
  mdFilePath, imagePath, branchName,
  commitSha, prUrl
}) {
  const fmObject = {
    title,
    author: '이영수',
    date: new Date().toISOString(),
    tags,
    description,
    image: { path: imagePath },
    page_id: slug
  }
  const fmOnly = matter.stringify('', fmObject) // frontmatter만 담긴 문서

  await core.summary
  .addHeading('📑 블로그 초안 생성 결과', 2)
  .addTable([
    [{data: '항목', header: true}, {data: '값', header: true}],
    ['제목', title],
    ['Slug', slug],
    ['브랜치', branchName],
    ['커밋', commitSha ? commitSha.slice(0, 7) : '(n/a)'],
    ['Markdown 경로', mdFilePath],
    ['이미지 경로', imagePath],
    ['PR', prUrl ? `[열기](${prUrl})` : '생성 안 됨/이미 존재']
  ])
  .addHeading('🧩 태그', 3)
  .addRaw(tags && tags.length ? tags.map(t => `\`${t}\``).join(' ') : '(없음)')
  .addHeading('📝 설명', 3)
  .addRaw(description || '(없음)')
  .addHeading('🔧 Frontmatter 미리보기', 3)
  .addCodeBlock(fmOnly, 'yaml')
  .write()
}

/**
 * 실행 진입점
 */
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
    const { octokit } = initClients(token)

    // 3) 기본 브랜치
    const defaultBranch = await fetchDefaultBranch(octokit, owner, repo)

    // 4) 브랜치/제목/날짜
    const { title, cleanedTitle } = generateSlugAndTitle(issueTitle)
    const { now, datePrefix } = getDatePrefix()
    const branchName = `issue-${issueNumber}`

    // 5) 브랜치 보장 (존재 시 그 HEAD를 부모로)
    const { baseCommitSha } = await ensureBranch(octokit, owner, repo, defaultBranch, branchName)

    // 6) _posts 디렉토리 확인
    const postsDir = path.posix.join(process.cwd(), '_posts')
    if (!fs.existsSync(postsDir)) {
      fs.mkdirSync(postsDir, { recursive: true })
      core.info(`✅ _posts 디렉토리 생성: ${postsDir}`)
    }

    // 7) 메타데이터 생성
    const { tags, description, slug } =
      await generateMetadata(openaiApiKey, issueBodyTrimmed, cleanedTitle)
    const mdFileName = `${datePrefix}-${slug}.md`
    const mdFilePath = path.posix.join('_posts', mdFileName)

    // 8) 썸네일 생성 및 저장
    const imagePathForFrontmatter =
      await generateAndDownloadImage(openaiApiKey, cleanedTitle, datePrefix, slug)

    // 9) Frontmatter 구성
    const frontmatterData = {
      title,
      author: '이영수',
      date: now,
      tags,
      description,
      image: { path: imagePathForFrontmatter },
      page_id: slug
    }
    core.info('✅ Frontmatter 데이터 생성 완료')

    // 10) MD 본문 결합
    const fullMarkdown = matter.stringify(issueBodyTrimmed, frontmatterData)
    core.info('✅ gray-matter로 Frontmatter와 본문 결합 완료')

    // 11) 커밋 & PR
    const { newCommitSha, prUrl } = await commitAndCreatePR(
      octokit, owner, repo, baseCommitSha, branchName, title,
      mdFilePath, fullMarkdown, imagePathForFrontmatter, defaultBranch
    )

    // 12) 요약 출력
    await writeJobSummary({
      title, tags, description, slug,
      mdFilePath, imagePath: imagePathForFrontmatter,
      branchName, commitSha: newCommitSha, prUrl
    })

    core.info('🎉 모든 단계가 완료되었습니다.')
  } catch (error) {
    core.error(`❌ 실행 중 오류 발생! 오류 이유: ${error.message}`)
    core.setFailed(error.message)
  }
}

run()
