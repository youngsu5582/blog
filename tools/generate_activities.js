import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { marked } from 'marked';
import OpenAI from 'openai';

// --- 설정 --- //
const ACTIVITIES_MD_DIR = 'activities_md';
const OUTPUT_JSON_PATH = 'assets/data/activities.json';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY; // 환경 변수에서만 키를 읽어옵니다.
const SHOULD_TRANSLATE = !process.argv.includes('--no-translate');

// 번역이 필요한 경우에만 API 키를 확인합니다.
if (!OPENAI_API_KEY && SHOULD_TRANSLATE) {
    console.error('❌ OPENAI_API_KEY 환경 변수가 설정되지 않았습니다. 번역을 건너뛰려면 --no-translate 플래그를 사용하세요.');
    process.exit(1);
}

const openai = SHOULD_TRANSLATE ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null;

// --- 번역 함수 --- //
async function translateText(text) {
    if (!text || text.trim() === '' || !SHOULD_TRANSLATE) {
        return text; // 번역이 필요 없거나 텍스트가 비어있으면 원본 반환
    }
    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: `Translate the following Korean text to English. Respond with only the translated text, preserving Markdown formatting.` },
                { role: "user", content: text }
            ],
            temperature: 0.7,
            max_tokens: 2000,
        });
        return response.choices[0].message.content.trim();
    } catch (error) {
        console.error(`🔶 텍스트 번역 중 오류 발생: ${error.message}`);
        return `[Translation Error] ${text}`; // 번역 실패 시 원본 텍스트 반환
    }
}

// --- 메인 로직 --- //
async function generateActivities() {
    console.log(`🔄 활동 마크다운 폴더(${ACTIVITIES_MD_DIR}) 읽는 중...`);
    const files = fs.readdirSync(ACTIVITIES_MD_DIR).filter(file => file.endsWith('.md'));
    const activities = [];

    for (const file of files) {
        console.log(`- 처리 중: ${file}`);
        const filePath = path.join(ACTIVITIES_MD_DIR, file);
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const { data, content } = matter(fileContent);

        if (!data.title || !data.title.ko || !data.description || !data.description.ko || !data.date) {
            console.warn(`🔶 건너뛰기: ${file} 파일의 Front Matter에 title.ko, description.ko, date 필드가 모두 필요합니다.`);
            continue;
        }

        // --- 제목 번역 (필요시) ---
        let enTitle = data.title.en;
        if (!enTitle && SHOULD_TRANSLATE) {
            console.log(`  - 제목 번역 중...`);
            enTitle = await translateText(data.title.ko);
        } else if (!enTitle) {
            enTitle = data.title.ko; // 번역 안 할 경우 한국어 제목으로 대체
        }

        // --- 설명 번역 (필요시) ---
        let enDescription = data.description.en;
        if (!enDescription && SHOULD_TRANSLATE) {
            console.log(`  - 설명 번역 중...`);
            enDescription = await translateText(data.description.ko);
        } else if (!enDescription) {
            enDescription = data.description.ko; // 번역 안 할 경우 한국어 설명으로 대체
        }

        // --- 본문 처리 및 번역 (필요시) ---
        const contentParts = content.split(/^\s*---\s*$/m);
        const contentKo = (contentParts.find(p => p.trim().startsWith('### ko ###')) || contentParts[0] || '').replace(/^### ko ###/, '').trim();
        let contentEn = (contentParts.find(p => p.trim().startsWith('### en ###')) || '').replace(/^### en ###/, '').trim();

        const htmlContentKo = marked(contentKo);
        let htmlContentEn;

        if (contentEn) {
            htmlContentEn = marked(contentEn);
        } else if (SHOULD_TRANSLATE) {
            console.log(`  - 본문 번역 중...`);
            const translatedMarkdownEn = await translateText(contentKo);
            htmlContentEn = marked(translatedMarkdownEn);
        } else {
            htmlContentEn = marked(contentKo); // 번역 안 할 경우 한국어 본문으로 대체
        }

        activities.push({
            title: {
                ko: data.title.ko,
                en: enTitle
            },
            date: data.date,
            images: data.images || [],
            description: {
                ko: data.description.ko,
                en: enDescription
            },
            full_content: {
                ko: htmlContentKo,
                en: htmlContentEn
            },
            latitude: data.latitude || null,
            longitude: data.longitude || null
        });
    }

    // 최신 날짜순으로 정렬
    activities.sort((a, b) => new Date(b.date) - new Date(a.date));

    console.log(`✅ ${activities.length}개의 활동 처리 완료.`);
    fs.writeFileSync(OUTPUT_JSON_PATH, JSON.stringify(activities, null, 2));
    console.log(`🎉 ${OUTPUT_JSON_PATH} 파일이 성공적으로 생성되었습니다.`);
}

generateActivities().catch(error => {
    console.error('❌ 스크립트 실행 중 심각한 오류 발생:', error);
    process.exit(1);
});