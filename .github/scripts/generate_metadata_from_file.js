/**
 * 역할: 지정된 마크다운 파일의 제목과 본문을 기반으로 OpenAI를 통해 메타데이터(tags, description)를 생성하고,
 *      해당 파일의 frontmatter를 업데이트합니다.
 *
 * 사용법:
 * node .github/scripts/generate_metadata_from_file.js --file=_posts/YYYY-MM-DD-some-post.md
 */

import fs from 'fs'
import path from 'path'
import * as core from '@actions/core'
import matter from 'gray-matter'

// --- Helper Functions (logging, env, args) ---

function redact(str, head = 6, tail = 4) {
  if (!str) return ''
  const s = String(str)
  if (s.length <= head + tail) return s[0] + '…' + s.slice(-tail)
  return s.slice(0, head) + '…' + s.slice(-tail)
}

function extractJsonFromText(text) {
  if (!text) return ''
  let t = String(text).trim()
  if (t.startsWith('```')) {
    t = t.replace(/^```(?:json)?\s*/i, '').replace(/```$/m, '').trim()
  }
  if (!t.startsWith('{')) {
    const start = t.indexOf('{')
    const end = t.lastIndexOf('}')
    if (start !== -1 && end !== -1 && end > start) {
      t = t.slice(start, end + 1)
    }
  }
  return t
}

async function logAndFetchJSON(url, options = {}, label = '') {
  const method = options.method || 'GET'
  const headers = Object.assign({}, options.headers)
  const loggedHeaders = { ...headers }
  if (loggedHeaders.Authorization) {
    loggedHeaders.Authorization = `Bearer ${redact(loggedHeaders.Authorization.replace('Bearer ', ''))}`
  }

  core.info(`🔎 [REQ ${label}] ${method} ${url}`)
  core.debug(`🔎 [REQ ${label}] headers: ${JSON.stringify(loggedHeaders)}`)

  const res = await fetch(url, options)
  const rawText = await res.text()
  core.info(`📥 [RES ${label}] status: ${res.status} ${res.statusText}`)

  let json
  try {
    json = JSON.parse(rawText)
  } catch (e) {
    throw new Error(`HTTP ${res.status} 응답 JSON 파싱 실패: ${e.message}`)
  }

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText}: ${JSON.stringify(json)}`)
  }
  return json
}

function getEnvVars() {
  const openaiApiKey = process.env.OPENAI_API_KEY
  if (!openaiApiKey) {
    throw new Error('환경 변수 OPENAI_API_KEY가 필요합니다.')
  }
  return { openaiApiKey }
}

function parseArgs(argv) {
  const args = {}
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg.startsWith('--')) {
      const [key, value] = arg.substring(2).split('=')
      if (value !== undefined) {
        args[key] = value
      } else if (i + 1 < argv.length && !argv[i + 1].startsWith('--')) {
        args[key] = argv[i + 1]
        i++
      } else {
        args[key] = true
      }
    }
  }
  return args
}

// --- Core Logic ---

async function generateMetadata(openaiApiKey, body, title) {
  core.info('🔄 OpenAI에 메타데이터 생성을 요청합니다...')
  const systemMsg = `
You are a helpful assistant that extracts metadata from a technical blog post draft.
Given the full Markdown content and the title of the post, please respond in JSON format exactly with three fields:
1. "tags": an array of 2 to 4 concise tags (in Korean), representing key topics.
2. "description": a short summary of the post in Korean, 50~100자 이내.
3. "slug": a URL-friendly slug for the title. It should be in lowercase English, with words separated by hyphens.

Title: "${title}"

Respond only with valid JSON. Do not include any extra text.
`.trim()

  const userMsg = `
### 블로그 초안 Markdown 내용 (본문만) ###
\
${body.trim()}
\
`.trim()

  const payload = {
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemMsg },
      { role: 'user', content: userMsg }
    ],
    temperature: 0.3,
    max_tokens: 350,
    response_format: { type: 'json_object' }
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
  const cleaned = extractJsonFromText(raw)
  try {
    const meta = JSON.parse(cleaned)
    const tags = Array.isArray(meta.tags) ? meta.tags : []
    const description = typeof meta.description === 'string' ? meta.description : ''
    const slug = typeof meta.slug === 'string' ? meta.slug.trim() : ''
    core.info('✅ OpenAI 메타데이터 생성 완료')
    return { tags, description, slug }
  } catch (e) {
    core.warning('🔶 OpenAI 메타데이터 파싱 실패')
    throw e
  }
}

async function run() {
  try {
    const args = parseArgs(process.argv.slice(2))
    const filePath = args.file
    if (!filePath) {
      throw new Error('--file=<markdown-file-path> 인자가 필요합니다.')
    }

    const fullPath = path.resolve(filePath)
    if (!fs.existsSync(fullPath)) {
      throw new Error(`파일을 찾을 수 없습니다: ${fullPath}`)
    }

    core.info(`--- ${filePath} 파일 처리 시작 ---`)

    // 1. 환경변수 및 파일 정보 읽기
    const config = getEnvVars()
    const fileContent = fs.readFileSync(fullPath, 'utf8')
    const { data: frontmatter, content: body } = matter(fileContent)
    const title = frontmatter.title

    if (!title) {
      throw new Error('파일의 Frontmatter에 \'title\'이 없습니다.')
    }

    // 2. 메타데이터 생성
    const { tags, description, slug } = await generateMetadata(config.openaiApiKey, body, title)

    // 3. 마크다운 파일 업데이트
    frontmatter.tags = tags
    frontmatter.description = description
    // page_id가 있는 경우, 생성된 slug로 업데이트
    if (frontmatter.page_id) {
        frontmatter.page_id = slug
    }

    const newFileContent = matter.stringify(body, frontmatter)
    fs.writeFileSync(fullPath, newFileContent)

    core.info('✅ 성공적으로 메타데이터를 업데이트했습니다.')
    core.info(`  - Tags: ${tags.join(', ')}`)
    core.info(`  - Description: ${description}`)
    core.info(`  - Suggested Slug / Page ID: ${slug}`)

  } catch (error) {
    core.setFailed(error.message)
  }
}

run()
