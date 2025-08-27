lang: ko
---
title: '[블로그 초안] 자동화 워크플로우 테스트'
author: 이영수
date: 2025-08-27T15:07:37.765Z
tags:
  - 자동화
  - 테스트
  - 워크플로우
description: 이 포스트는 블로그 자동화 시스템의 테스트 절차를 설명합니다.
image:
  path: assets/img/thumbnail/2025-08-27-automation-workflow-testing.png
page_id: automation-workflow-testing
---
## 📋 초안 제목
자동화 워크플로우 테스트

## 📝 초안 내용 (Markdown)

자동화 워크플로우 테스트

이 포스트는 새로 구축된 블로그 자동화 시스템을 테스트하기 위해 작성되었습니다.

테스트 절차

1. 이슈가 생성되면, 잠시 후 자동으로 Pull Request가 생성되어야 합니다.
2. 생성된 PR에 review 라벨을 추가하면, 게시글이 영어로 번역되고 파일 구조가 변경되어야 합니다.
3. 마지막으로, PR에 complete 라벨을 추가하면 PR과 이슈가 닫히고 브랜치가 삭제되어야 합니다.

이 모든 과정이 순조롭게 진행되는지 확인합니다.
