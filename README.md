# 개인 블로그

[블로그 링크](https://youngsu5582.life/archives/)

Jetkyll 기반 커스터마이징
아래 요소들 추가적인 구현

- 아카이브 연도별 작성 게시글 개수 추가
- 카테고리에서 게시글 많은 순으로 정렬
- 라이트, 다크 SCSS 변경
- 유틸함수 통해 간편하게 요소들 변경

## Util

- process_thumbnail_and_description : 게시글을 기반으로 50~100자의 설명과 썸네일 이미지를 생성해준다.
- runner-with-env : env 파일을 불러와서 환경 설정을 통해 특정 스크립티를 실행해준다.

-> `process_thumbnail_and_description` 내부 `file_path_str` 에 수행할 파일명 입력 ( EX : "_posts/2025-03-20-샘플링.md" )
-> `pip install python-dotenv && python3 -m venv venv && source venv/bin/activate && python3 ./utils/runner-with-env.py` 실행


