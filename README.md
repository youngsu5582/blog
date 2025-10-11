# 이영수 기술 블로그

[![Blog-Post](https://github.com/youngsu5582/blog/actions/workflows/issue_branch_pr.yml/badge.svg)](https://github.com/youngsu5582/blog/actions/workflows/issue_branch_pr.yml)
[![Deploy-Pages](https://github.com/youngsu5582/blog/actions/workflows/pages-deploy.yml/badge.svg)](https://github.com/youngsu5582/blog/actions/workflows/pages-deploy.yml)

개인 기술 블로그 리포지토리입니다. Jekyll 기반으로 구축되었으며, GitHub Actions와 AI를 활용하여 콘텐츠 생성부터 발행까지의 과정을 자동화했습니다.

**[블로그 바로가기](https://youngsu5582.life/archives/)**

---

## ✨ 주요 컨셉: Issue-Driven Blogging

이 블로그의 모든 콘텐츠 관리는 GitHub 이슈에서 시작됩니다. `블로그 초안` 템플릿을 사용하여 새 이슈를 작성하는 것만으로 포스트 생성, AI 리뷰, 썸네일 생성, 번역, 발행까지의 모든 과정이 자동화된 파이프라인을 통해 처리됩니다.

## 🚀 자동화 워크플로우

블로그 포스트 하나가 발행되기까지의 전체 과정은 아래와 같습니다.

### 1. ✍️ 초안 작성 (`issue` 생성)

1.  **`New Issue`** 버튼을 클릭하고 **`블로그 초안 – AI 리뷰 요청`** 템플릿을 선택합니다.
2.  이슈 제목과 본문에 블로그 글의 제목과 내용을 작성합니다.
3.  `draft` 라벨이 자동으로 할당되며, 이 라벨을 기준으로 자동화 워크플로우가 시작됩니다.

### 2. 🛠️ 브랜치 및 PR 자동 생성 (`workflow: issue_branch_pr.yml`)

`draft` 라벨이 감지되면 GitHub Actions가 실행되어 다음을 자동으로 처리합니다.

-   **AI 메타데이터 생성**: **OpenAI (GPT-4o-mini)**를 사용하여 글의 내용에 맞는 `tags`, `description`, `slug`를 생성하고 파일의 머리말(frontmatter)에 추가합니다.
-   **브랜치 및 커밋 생성**: `post-{이슈번호}-{slug}` 형식의 브랜치를 생성하고, 생성된 마크다운 파일을 커밋합니다.
-   **PR 생성**: `main` 브랜치로 향하는 Pull Request를 자동으로 생성합니다.

### 3. 🎨 AI 썸네일 생성 (`workflow: pr_generate_thumbnail.yml`)

생성된 PR에 `thumbnail` 라벨을 추가하면, AI가 블로그 내용에 맞는 썸네일 이미지를 생성합니다.

-   **Google Gemini** 모델이 글의 전체 내용과 미리 제공된 샘플 이미지를 분석하여 16:9 비율의 썸네일을 생성합니다.
-   생성된 이미지는 `assets/img/thumbnail/` 경로에 저장되고, 해당 브랜치에 자동으로 커밋됩니다.

### 4. 🤖 AI 콘텐츠 리뷰 (`workflow: pr_open_ai_review.yml`)

PR에 `review` 라벨을 추가하면, AI가 시니어 개발자의 관점에서 글을 리뷰하고 PR에 직접 코멘트를 남깁니다.

-   **OpenAI (GPT-4o-mini)**가 기술적 깊이, 설명의 명확성, 글의 구조, 독창성 등을 기준으로 리뷰합니다.
-   수정이 필요한 문장은 `suggestion` 기능을 통해 제안하고, 내용에 대한 종합적인 의견도 코멘트로 제공합니다.

### 5. 🌐 자동 번역 (`workflow: translate_openai.yml`)

PR에 `translate` 라벨을 추가하면, AI가 글을 영어로 번역합니다.

-   **OpenAI (GPT-4o)** 모델이 frontmatter를 포함한 글 전체를 영어로 번역합니다.
-   기존 파일을 `ko`, `en` 버전으로 분리하여 동일한 브랜치에 커밋합니다.

### 6. ✅ 발행 및 리소스 정리 (`workflow: pr_cleanup.yml`)

PR에 `complete` 라벨을 추가하면, 발행 및 뒷정리 작업이 자동으로 수행됩니다.

-   PR을 `squash and merge` 방식으로 `main` 브랜치에 병합합니다.
-   연관된 이슈와 PR을 모두 `closed` 상태로 변경합니다.
-   작업이 완료된 브랜치를 삭제합니다.

### 7. 🚀 자동 배포 (`workflow: pages-deploy.yml`)

`main` 브랜치에 변경 사항이 병합되면, Jekyll 빌드 및 GitHub Pages 배포가 자동으로 실행됩니다.

---

## 🛠️ 기술 스택

-   **Framework**: Jekyll
-   **Automation**: GitHub Actions
-   **AI Services**:
    -   **OpenAI (GPT-4o, GPT-4o-mini)**: 메타데이터 생성, 콘텐츠 리뷰, 자동 번역
    -   **Google Gemini**: 썸네일 이미지 생성
-   **Core Scripts**: Node.js
