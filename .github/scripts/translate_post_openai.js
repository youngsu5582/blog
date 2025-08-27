
import OpenAI from 'openai';
import fs from 'fs/promises';
import path from 'path';

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
        content: 'You are a professional translator. Translate the following markdown blog post from Korean to English. Maintain the original markdown formatting, including frontmatter, code blocks, and links. Only output the translated text, with no additional commentary or explanations.'
      },
      {
        role: 'user',
        content: originalContent
      }
    ]
  });

  const translation = response.choices[0].message.content.trim();

  // 2. Create the new English file with 'lang: en'
  const enFilePath = path.join(newDir, `${slug}-en.md`);
  const enContent = `lang: en\n${translation}`;
  await fs.writeFile(enFilePath, enContent);
  console.log(`Successfully created English version: ${enFilePath}`);

  // 3. Create the new Korean file with 'lang: ko'
  const koFilePath = path.join(newDir, `${slug}-ko.md`);
  const koContent = `lang: ko\n${originalContent}`;
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
