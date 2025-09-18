/**
 * 역할: 지정된 마크다운 파일의 전체 내용과 샘플 이미지들을 기반으로 Gemini를 통해 이미지를 생성하고,
 *      해당 파일의 frontmatter에 이미지 경로를 업데이트합니다.
 *
 * 사용법:
 * node .github/scripts/generate_image_from_file.js --file=_posts/YYYY-MM-DD-some-post.md
 */

import fs from 'fs'
import path from 'path'
import * as core from '@actions/core'
import matter from 'gray-matter'

// --- Helper Functions (logging, env, args) ---

function redact(str, head = 6, tail = 4) {
  if (!str) {
    return ''
  }
  const s = String(str)
  if (s.length <= head + tail) {
    return s[0] + '…'
  }
  return s.slice(0, head) + '…' + s.slice(-tail)
}

async function logAndFetchJSON(url, options = {}, label = '') {
  const method = options.method || 'GET'
  const headers = Object.assign({}, options.headers)
  const loggedHeaders = {...headers}
  if (loggedHeaders['x-goog-api-key']) {
    loggedHeaders['x-goog-api-key'] = redact(loggedHeaders['x-goog-api-key'])
  }

  core.info(`🔎 [REQ ${label}] ${method} ${url}`)
  core.debug(`🔎 [REQ ${label}] headers: ${JSON.stringify(loggedHeaders)}`)

  const res = await fetch(url, options)
  const rawText = await res.text()

  core.info(`📥 [RES ${label}] status: ${res.status} ${res.statusText}`)

  const textForLog = rawText.replace(
      /("data"\s*:\s*")([A-Za-z0-9+/=]{100,})(")/g, '$1<omitted>$3')
  core.debug(`📥 [RES ${label}] body (<=2000 chars): ${textForLog.slice(0,
      2000)}${textForLog.length > 2000 ? '…' : ''}`)

  let json
  try {
    json = JSON.parse(rawText)
  } catch (e) {
    throw new Error(`HTTP ${res.status} 응답 JSON 파싱 실패: ${e.message}`)
  }

  if (!res.ok) {
    throw new Error(
        `HTTP ${res.status} ${res.statusText}: ${JSON.stringify(json)}`)
  }
  return json
}

function getEnvVars() {
  const geminiApiKey = process.env.GEMINI_IMAGE_API_KEY
      || process.env.GEMINI_API_KEY
  const geminiFlashImageUrl = process.env.GEMINI_FLASH_IMAGE_URL

  if (!geminiApiKey || !geminiFlashImageUrl) {
    throw new Error('환경 변수 GEMINI_API_KEY와 GEMINI_FLASH_IMAGE_URL가 필요합니다.')
  }
  return {geminiApiKey, geminiFlashImageUrl}
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

async function generateImageWithGemini(apiKey, apiUrl,
    {fullFileContent, sampleImagesBase64}) {
  core.info(
      `🔄 Gemini에 파일 내용과 ${sampleImagesBase64.length}개의 샘플 이미지를 기반으로 이미지 생성을 요청합니다...`)

  const {data: frontmatter} = matter(fullFileContent)
  const title = frontmatter.title || ''

  const prompt = `
**Persona:** You are a top-tier graphic designer specializing in creating friendly and viral-worthy tech infographics. Your style is clean, modern, and uses cute mascots to make complex topics easy to understand.

**Task:** Create a 16:9 thumbnail image for a technical blog post. The image should be an engaging infographic that is both informative and visually appealing, in a style similar to the provided sample images.

**Analysis:** First, thoroughly analyze the provided "Blog Post Content" to fully grasp the main subject, key components, and their relationships.

**Core Instructions:**
1.  **Visual Style:**
    *   **Overall:** A clean, 2D vector illustration style. The mood must be bright, positive, and professional.
    *   **Characters:** Use cute, simple, and friendly mascot characters to represent technologies or concepts (e.g., a happy robot for an automation tool, a speedy messenger bird for a message queue). The characters should be expressive but not overly childish.
    *   **Reference:** The final image's style and quality should be consistent with the two sample images provided.

2.  **Content & Composition:**
    *   **Layout:** Design a clear, easy-to-follow diagram or scene that visually explains the core message of the blog post. For a comparison post (e.g., "RabbitMQ vs. Kafka"), use a clear side-by-side layout with distinct visual identities for each.
    *   **Clarity:** The composition should guide the viewer's eye logically through the information. Use visual cues like arrows, lines, and logical grouping.

3.  **Typography (CRITICAL):**
    *   **Title:** The blog post title, "${title}", must be the most prominent text element, placed clearly at the top.
    *   **Legibility:** All text, including labels and annotations, MUST be perfectly legible, horizontally aligned, and free of spelling errors. This is the most important requirement.
    *   **Font:** Use a clean, modern, and rounded sans-serif font (similar to 'M PLUS Rounded 1c' or 'Poppins').
    *   **Placement:** Place text within speech bubbles, on clean background shapes, or with ample padding to ensure it stands out and is easy to read. Do not place text directly over complex parts of the illustration.

4.  **Color Palette:**
    *   Use a bright, harmonious, and modern color palette. The colors should enhance readability and create a pleasant viewing experience.
    *   Ensure high contrast between text and its background.

**Blog Post Content to Analyze:**
---
${fullFileContent}
---

**Negative Prompts (What to Avoid):**
Photorealism, 3D rendering, dark or gloomy themes, messy or cluttered layouts, blurry or low-resolution elements, unreadable or distorted text, generic stock-art style.
`.trim();

  core.info(`🎨 Generated Prompt:${prompt.slice(0, 500)}...`)

  // Build the multi-part request
  const parts = [{text: prompt}]
  for (const imageBase64 of sampleImagesBase64) {
    parts.push({
      inline_data: {
        mime_type: 'image/webp',
        data: imageBase64
      }
    })
  }

  const requestBody = {
    contents: [{parts}],
  }

  const payload = await logAndFetchJSON(
      apiUrl,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify(requestBody)
      },
      'gemini:image-gen'
  )

  const imagePart = payload.candidates?.[0]?.content?.parts?.find(
      p => p.inlineData);
  const base64Data = imagePart?.inlineData?.data;

  if (!base64Data) {
    throw new Error(
        'Gemini 응답에 이미지 데이터가 없습니다. 수신된 데이터: ' + JSON.stringify(payload))
  }
  core.info('✅ Gemini로부터 이미지 데이터를 수신했습니다.')
  return Buffer.from(base64Data, 'base64')
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

    // 1. 환경변수, 파일 내용, 샘플 이미지 읽기
    const config = getEnvVars()
    const fileContent = fs.readFileSync(fullPath, 'utf8')
    const {data: frontmatter, content: body} = matter(fileContent)

    const sampleImagePaths = [
      'assets/img/samples/thumbnail/sample-1.webp',
      'assets/img/samples/thumbnail/sample-2.webp'
    ]
    const sampleImagesBase64 = sampleImagePaths.map(
        p => fs.readFileSync(path.resolve(p)).toString('base64'))
    core.info(`✅ ${sampleImagePaths.length}개의 샘플 이미지를 로드했습니다.`)

    // 2. 파일명에서 날짜와 슬러그 추출
    const filename = path.basename(filePath, '.md')
    const match = filename.match(/^(\d{4}-\d{2}-\d{2})-(.*)$/)
    if (!match) {
      throw new Error('파일 형식이 YYYY-MM-DD-slug.md와 일치하지 않습니다.')
    }
    const datePrefix = match[1]
    const slug = match[2]

    // 3. 이미지 생성 (파일 내용과 샘플 이미지 전달)
    const imageBuffer = await generateImageWithGemini(config.geminiApiKey,
        config.geminiFlashImageUrl,
        {fullFileContent: fileContent, sampleImagesBase64})

    // 4. 이미지 저장
    const outRelPath = `assets/img/thumbnail/${datePrefix}-${slug}.png`
    const outAbsPath = path.posix.join(process.cwd(), outRelPath)
    if (!fs.existsSync(path.dirname(outAbsPath))) {
      fs.mkdirSync(path.dirname(outAbsPath), {recursive: true})
    }
    fs.writeFileSync(outAbsPath, imageBuffer)
    core.info(`✅ 이미지를 저장했습니다: ${outRelPath}`)

    // 5. 마크다운 파일 업데이트
    frontmatter.image = {path: outRelPath}
    const newFileContent = matter.stringify(body, frontmatter)
    fs.writeFileSync(fullPath, newFileContent)
    core.info(`✅ 마크다운 파일의 이미지 경로를 업데이트했습니다: ${fullPath}`)

    core.info('🎉 모든 작업이 완료되었습니다.')

  } catch (error) {
    core.setFailed(error.message)
  }
}

run()
