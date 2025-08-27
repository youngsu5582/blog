// ─────────── slug-hyphen.js ───────────
// 이 파일은 ES 모듈(ESM) 방식으로 작성되었습니다.
// package.json에 "type": "module"이 있으면 .js 파일은 ESM으로 처리됩니다.

import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

/**
 * @description
 *   한글·영문·숫자 외 문자를 모두 하이픈(-)으로 치환하고,
 *   연속된 하이픈은 하나로 줄이며, 문자열 앞뒤의 하이픈을 제거합니다.
 *   예) "예외 깊게 살펴보기, 예외 동적으로 던지기" →
 *       "예외-깊게-살펴보기-예외-동적으로-던지기"
 *
 * @param {string} title
 * @returns {string}
 */
export function slugifyWithHyphens(title) {
  return title
  .trim()
  // 한글(가-힣), 영문(a-zA-Z), 숫자(0-9) 외의 모든 문자를 하이픈으로 바꾼다
  .replace(/[^가-힣a-zA-Z0-9]+/g, '-')
  // 연속된 하이픈(--, --- 등)을 하나로 줄인다
  .replace(/-+/g, '-')
  // 문자열이 하이픈으로 시작하거나 끝나면 제거
  .replace(/^-+|-+$/g, '')
}

/**
 * @description
 *   날짜(dateString)와 제목(title)을 받아서
 *   "assets/img/thumbnail/{date}-{slug}.png" 형태의 경로를 반환합니다.
 *
 * @param {string} title       원본 제목
 * @param {string} dateString  yyyy-MM-dd 형태 날짜
 * @returns {string}
 */
export function makeImagePath(title, dateString) {
  const slug = slugifyWithHyphens(title)
  return `assets/img/thumbnail/${dateString}-${slug}.png`
}

/**
 * === 직접 실행 시 (node slug-hyphen.js) 터미널에 결과를 출력하기 위한 코드 ===
 *
 * ES 모듈에서는 require.main === module 패턴 대신,
 * import.meta.url을 이용하여 현재 모듈 경로를 비교해야 합니다.
 */
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// process.argv[1]은 node 명령어 뒤에 들어온 실행 스크립트 파일 경로이다.
// import.meta.url에서 변환한 __filename과 비교하여 '직접 실행' 여부를 판단한다.
if (process.argv[1] === __filename) {
  const demoTitle = '예외 깊게 살펴보기, 예외 동적으로 던지기'
  const demoDate = '2025-05-31'

  console.log('원본 제목  :', demoTitle)
  console.log('슬러그 결과:', slugifyWithHyphens(demoTitle))
  console.log('이미지 경로:', makeImagePath(demoTitle, demoDate))
}
