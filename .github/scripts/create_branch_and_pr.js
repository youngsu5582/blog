/**
 * 파일 위치: .github/scripts/create_branch_and_pr.js
 * 역할: 이슈 정보를 받아, 개별 스크립트를 순차적으로 호출하여 포스트 생성의 전체 과정을 오케스트레이션합니다.
 *   1. 임시 파일 생성
 *   2. 메타데이터 생성 스크립트 호출 → 임시 파일에 frontmatter 추가 (tags, description, page_id)
 *   3. 최종 파일명으로 변경 후, 이미지 생성 스크립트 호출 → 썸네일 생성 및 frontmatter에 image.path 추가
 *   4. 최종 파일을 Git에 커밋하고 PR 생성
 */

import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'
import { Octokit } from '@octokit/rest'
import * as core from '@actions/core'
import matter from 'gray-matter'

// --- Helper Functions ---

function getEnvVars() {
  const repoFullName = process.env.REPOSITORY
  const issueNumber  = process.env.ISSUE_NUMBER
  const rawTitle     = process.env.ISSUE_TITLE
  const issueBodyRaw = process.env.ISSUE_BODY
  const token = process.env.GH_PAT || process.env.GITHUB_TOKEN

  if (!repoFullName || !issueNumber || !rawTitle || !issueBodyRaw || !token) {
    core.setFailed('Action 실행에 필요한 환경 변수가 누락되었습니다.')
    process.exit(1)
  }

  let decodedTitle
  try {
    decodedTitle = decodeURIComponent(rawTitle)
  } catch {
    decodedTitle = rawTitle
  }

  core.info('✅ 환경 변수 모두 읽어왔습니다.')
  return { repoFullName, issueNumber, issueTitle: decodedTitle, issueBodyRaw, token }
}

function initClients(token) {
  const octokit = new Octokit({ auth: token })
  core.info('✅ Octokit 클라이언트 초기화 완료')
  return { octokit }
}

function generateSlugAndTitle(issueTitle) {
  const cleanedTitle = issueTitle.replace(/^\\[.*?\\]\s*/, '').trim()
  const title = cleanedTitle.replace(/"/g, '\\"')
  core.info(`제목 (Frontmatter용): ${title}`)
  return { title, cleanedTitle }
}

function getDatePrefix() {
  const now = new Date()
  const yyyy = now.getUTCFullYear()
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(now.getUTCDate()).padStart(2, '0')
  const datePrefix = `${yyyy}-${mm}-${dd}`
  core.info(`오늘 날짜 프리픽스: ${datePrefix}`)
  return { now, datePrefix }
}

async function fetchDefaultBranch(octokit, owner, repo) {
  const { data: repoData } = await octokit.repos.get({ owner, repo })
  const defaultBranch = repoData.default_branch
  core.info(`기본 브랜치 이름: ${defaultBranch}`)
  return defaultBranch
}

async function ensureBranch(octokit, owner, repo, defaultBranch, branchName) {
  try {
    const { data } = await octokit.git.getRef({ owner, repo, ref: `heads/${branchName}` })
    core.warning(`브랜치가 이미 존재합니다: ${branchName} @ ${data.object.sha}`)
    return { baseCommitSha: data.object.sha, created: false }
  } catch (e) {
    if (e.status !== 404) throw e
    const { data: refData } = await octokit.git.getRef({ owner, repo, ref: `heads/${defaultBranch}` })
    const baseCommitSha = refData.object.sha
    await octokit.git.createRef({ owner, repo, ref: `refs/heads/${branchName}`, sha: baseCommitSha })
    core.info(`✅ 새 브랜치 생성 완료: ${branchName}`)
    return { baseCommitSha, created: true }
  }
}

async function commitAndCreatePR(octokit, owner, repo, baseCommitSha, branchName, title, mdFilePath, imagePath, defaultBranch) {
  const fullMarkdown = fs.readFileSync(mdFilePath, 'utf-8')
  const mdBlob = await octokit.git.createBlob({ owner, repo, content: Buffer.from(fullMarkdown).toString('base64'), encoding: 'base64' })
  core.info('✅ Markdown Blob 생성 완료')

  const imgBuffer = fs.readFileSync(path.join(process.cwd(), imagePath))
  const imgBlob = await octokit.git.createBlob({ owner, repo, content: imgBuffer.toString('base64'), encoding: 'base64' })
  core.info('✅ Image Blob 생성 완료')

  const { data: baseCommit } = await octokit.git.getCommit({ owner, repo, commit_sha: baseCommitSha })
  const { data: newTree } = await octokit.git.createTree({
    owner, repo, base_tree: baseCommit.tree.sha,
    tree: [
      { path: mdFilePath, mode: '100644', type: 'blob', sha: mdBlob.data.sha },
      { path: imagePath, mode: '100644', type: 'blob', sha: imgBlob.data.sha }
    ]
  })
  core.info('✅ 새 Tree 생성 완료 (Markdown + Image)')

  const commitMessage = `post: ${title} 작성`
  const { data: newCommit } = await octokit.git.createCommit({ owner, repo, message: commitMessage, tree: newTree.sha, parents: [baseCommitSha] })
  core.info(`✅ 새 Commit 생성 완료: ${commitMessage}`)

  await octokit.git.updateRef({ owner, repo, ref: `heads/${branchName}`, sha: newCommit.sha, force: false })
  core.info(`✅ 브랜치(${branchName})가 새 커밋을 가리키도록 업데이트되었습니다`)

  let prUrl = null
  try {
    const { data: pr } = await octokit.pulls.create({
      owner, repo, head: branchName, base: defaultBranch, title: `[게시글 초안] ${title}`,
      body: `자동 생성된 PR입니다. 게시글 초안 파일(\\\`${mdFilePath}\\\`)을 확인해주세요.`
    })
    prUrl = pr.html_url
    core.info(`✅ PR 생성 완료: ${prUrl}`)
  } catch (e) {
    if (e.status === 422 && String(e.message).includes('A pull request already exists')) {
      core.warning('PR가 이미 존재합니다. 생성 단계를 건너뜁니다.')
    } else {
      throw e
    }
  }
  return { newCommitSha: newCommit.sha, prUrl }
}

async function writeJobSummary({ title, mdFilePath, imagePath, branchName, commitSha, prUrl }) {
  const { data: frontmatter } = matter(fs.readFileSync(mdFilePath, 'utf-8'))
  await core.summary
    .addHeading('📑 블로그 초안 생성 결과', 2)
    .addTable([
      [{data: '항목', header: true}, {data: '값', header: true}],
      ['제목', title],
      ['Permalink', frontmatter.permalink || '(없음)'],
      ['브랜치', branchName],
      ['커밋', commitSha ? commitSha.slice(0, 7) : '(n/a)'],
      ['Markdown 경로', mdFilePath],
      ['이미지 경로', imagePath],
      ['PR', prUrl ? `[열기](${prUrl})` : '생성 안 됨/이미 존재']
    ])
    .addHeading('🧩 태그', 3)
    .addRaw(frontmatter.tags && frontmatter.tags.length ? frontmatter.tags.map(t => `\`${t}\``).join(' ') : '(없음)')
    .addHeading('📝 설명', 3)
    .addRaw(frontmatter.description || '(없음)')
    .write()
}

// --- Main Execution ---

async function run() {
  let tempFilePath = ''
  try {
    // 1. 초기 설정 및 임시 파일 생성
    const { repoFullName, issueNumber, issueTitle, issueBodyRaw, token } = getEnvVars()
    const [owner, repo] = repoFullName.split('/')
    const issueBodyTrimmed = JSON.parse(issueBodyRaw).trim()
    const { title } = generateSlugAndTitle(issueTitle)

    tempFilePath = `temp_issue_${issueNumber}.md`
    // frontmatter에 title을 추가하여 임시 파일 생성
    const tempFileContent = matter.stringify(issueBodyTrimmed, { title })
    fs.writeFileSync(tempFilePath, tempFileContent)
    core.info(`✅ 임시 파일 생성: ${tempFilePath}`)

    // 2. 메타데이터 생성 스크립트 실행
    core.info('--- 메타데이터 생성 스크립트 실행 ---')
    execSync(`node .github/scripts/generate_metadata_from_file.js --file=${tempFilePath}`, { stdio: 'inherit', env: process.env })
    core.info('--- 메타데이터 생성 완료 ---')

    // 3. 최종 파일명 결정 및 파일 이름 변경
    const updatedContent = fs.readFileSync(tempFilePath, 'utf8')
    const { data: frontmatter } = matter(updatedContent)
    const slug = frontmatter.page_id
    if (!slug) {
      throw new Error('메타데이터 생성 후 slug(page_id)를 찾을 수 없습니다.')
    }

    const { datePrefix, now } = getDatePrefix()
    const finalFileName = `${datePrefix}-${slug}.md`
    const finalFilePath = path.posix.join('_posts', finalFileName)

    // _posts 디렉토리 생성
    const postsDir = path.dirname(finalFilePath)
    if (!fs.existsSync(postsDir)) {
      fs.mkdirSync(postsDir, { recursive: true })
    }

    // Frontmatter에 title, author, date 추가 후 파일 이름 변경
    frontmatter.title = title
    frontmatter.author = '이영수'
    frontmatter.date = now
    fs.writeFileSync(tempFilePath, matter.stringify(matter(updatedContent).content, frontmatter))
    fs.renameSync(tempFilePath, finalFilePath)
    tempFilePath = '' // 임시 파일 경로 초기화 (에러 시 삭제 방지)
    core.info(`✅ 최종 파일로 이름 변경: ${finalFilePath}`)

    // 4. 이미지 생성 스크립트 실행
    core.info('--- 이미지 생성 스크립트 실행 ---')
    execSync(`node .github/scripts/generate_image_from_file.js --file=${finalFilePath}`, { stdio: 'inherit', env: process.env })
    core.info('--- 이미지 생성 완료 ---')

    // 5. Git 작업 및 PR 생성
    const { octokit } = initClients(token)
    const defaultBranch = await fetchDefaultBranch(octokit, owner, repo)
    const branchName = `issue-${issueNumber}`
    const { baseCommitSha } = await ensureBranch(octokit, owner, repo, defaultBranch, branchName)

    const finalFileContent = fs.readFileSync(finalFilePath, 'utf-8')
    const imagePath = matter(finalFileContent).data.image.path

    const { newCommitSha, prUrl } = await commitAndCreatePR(
      octokit, owner, repo, baseCommitSha, branchName, title,
      finalFilePath, imagePath, defaultBranch
    )

    // 6. 요약 출력
    await writeJobSummary({ title, mdFilePath: finalFilePath, imagePath, branchName, commitSha: newCommitSha, prUrl })

    core.info('🎉 모든 단계가 완료되었습니다.')

  } catch (error) {
    core.setFailed(error.message)
  } finally {
    // 에러 발생 시 임시 파일 정리
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath)
      core.info(`✅ 임시 파일 삭제: ${tempFilePath}`)
    }
  }
}

run()
