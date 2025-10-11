
import OpenAI from 'openai';
import fs from 'fs/promises';
import path from 'path';
import matter from 'gray-matter';

const postsDir = path.resolve(process.cwd(), '_posts');

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error('Error: No file path provided.');
    process.exit(1);
  }

  console.log(`Processing file: ${filePath}`);

  const match = path.basename(filePath).match(/^(\d{4})-(\d{2})-(\d{2})-(.*)\.md$/);
  if (!match) {
    console.error(`Error: File name format is incorrect. Expected YYYY-MM-DD-slug.md, but got ${path.basename(filePath)}.`);
    process.exit(1);
  }

  const [, year, month, day, slug] = match;
  const datePrefix = `${year}-${month}-${day}`;
  const newDir = path.join(postsDir, year, month, day, slug);
  await fs.mkdir(newDir, { recursive: true });

  const originalContent = await fs.readFile(filePath, 'utf-8');

  // 1. Translate content to English using OpenAI
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: 'You are a professional translator. Translate the following markdown blog post from Korean to English. Maintain the original markdown formatting, including frontmatter, code blocks, and links. In the YAML frontmatter, quote all string values with double quotes (") and NEVER with single quotes (\'). Only output the translated text, with no additional commentary or explanations.'
      },
      {
        role: 'user',
        content: originalContent
      }
    ]
  });

  const translation = response.choices[0].message.content.trim();

  // --- Fix: frontmatter의 작은따옴표 값을 큰따옴표로 교체 (title: 'Developer's ...' 같은 경우 방지)
  function fixFrontmatterQuotes(md) {
    const m = md.match(/^---\n([\s\S]*?)\n---\n?/);
    if (!m) return md; // frontmatter 없음
    let fm = m[1];
    // key: '...'(단일 라인) 형태만 안전하게 변환. 내부의 " 는 이스케이프
    fm = fm.replace(
      /^(\s*[A-Za-z0-9_-]+:\s*)'(.*)'(\s*)$/gm,
      (_full, key, val, tail) => `${key}"${val.replace(/"/g, '\\"')}"${tail}`
    );
    return `---
${fm}
---
` + md.slice(m[0].length);
  }
  const safeTranslation = fixFrontmatterQuotes(translation);

  let translatedMatter;
  try {
    translatedMatter = matter(safeTranslation);
  } catch (e) {
    // 만약 예외가 나면, 원문 frontmatter를 유지하고 본문만 번역본으로 쓰는 안전장치
    console.warn('Warning: Failed to parse translated frontmatter. Falling back to original frontmatter.', e.message);
    const orig = matter(originalContent);
    const translatedBody = safeTranslation.replace(/^---[\s\S]*?---\n?/, '');
    translatedMatter = { data: orig.data, content: translatedBody };
  }

  // 2. Create the new English file with 'lang: en'
  translatedMatter.data.lang = 'en';
  translatedMatter.data.author = 'Lee Youngsu'; // Set English author

  const enContent = matter.stringify(translatedMatter.content, translatedMatter.data);

  const enFilePath = path.join(newDir, `${datePrefix}-${slug}-en.md`);
  await fs.writeFile(enFilePath, enContent);
  console.log(`Successfully created English version: ${enFilePath}`);

  // 3. Create the new Korean file with 'lang: ko'
  const originalMatter = matter(originalContent);
  originalMatter.data.lang = 'ko';
  const koContent = matter.stringify(originalMatter.content, originalMatter.data);

  const koFilePath = path.join(newDir, `${datePrefix}-${slug}-ko.md`);
  await fs.writeFile(koFilePath, koContent);
  console.log(`Successfully created Korean version: ${koFilePath}`);

  // 4. Delete the original file
  await fs.unlink(filePath);
  console.log(`Successfully deleted original file: ${filePath}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
