---
title: AI 에이전트 해커톤을 하고 (feat.바이브코딩)
tags:
  - AI
  - 해커톤
  - 바이브코딩
  - LLM
description: 이번 해커톤에서 AI 에이전트를 활용한 프로젝트를 진행하며 다양한 기술을 경험하고 느낀 점을 공유합니다.
page_id: ai-agent-hackathon-feat-vibe-coding
permalink: /posts/ai-agent-hackathon-feat-vibe-coding/
author: 이영수
date: 2026-02-08T08:31:30.287Z
---
> 이번에 소규모 해커톤을 갔다와서 간략하게만 적어본다.

![image](https://darhcarwm16oo.cloudfront.net/2bd12e83a63290bb176107d009cae5ce.png)

우테코 슬랙에 올라온 글을 보고 할까, 말까? 고민하다가 신청했다.
신청한 이유는 AI Agent SDK 가 뭔지 궁금하기도 했고, 오랜만에 다른 도메인의 코드를 짜보고 싶다는 생각이 있었다.
그리고, 요새 LLM ( Claude ) 의 성능이 진짜 많이 올라간게 느껴졌는데 얼마나 잘 짜는지에 대해서도 확인해보고 싶었다. 

> 원래 도비랑 같이 팀으로 하기로 했는데 도비 일정 때문에 혼자 했다... ㅋ.ㅋ

해커톤은 주최자 민석님이 만들고 있는 [모루](https://github.com/moru-ai/moru) 와 모루가 세팅되어 있는 [hackathon-starter](https://github.com/moru-ai/hackathon-starter) 에서 시작했다.

## 시작하기에 앞서

어제 간략하게 생각해서 갔는데 AI 끼리 서로 토론을 하는걸 생각했다.

내가 학습하고 싶은 내용이 있을때, 직접 치는게 아니라 서로 대화를 하는걸 보고 싶었다.
이번 기회에 이를 만들어 보려고 했다.

그리고, 전부 바이브 코딩으로 작성해봐야 겠다고 마음 먹었다.
(즉, 내가 코드 작성하는건 하나도 없이! 어차피 모르기도 하고)

내가 접근한 바이브 코딩의 흐름은 아래와 같았다.

## 바이브 코딩

### 레포지토리 분석 & 설계

![500](https://darhcarwm16oo.cloudfront.net/1b7d3e41c7487846300ebe5f7d6c4a67.png)

![500](https://darhcarwm16oo.cloudfront.net/e316ff64ecf87095c32f27e38a9a4a85.png)

레포지토리를 분석하고
내가 전날 생각한 아이디어를 Gemini 에게 구체화 한 내용을 넣고 구현할 수 있는지를 질문했다.

이를 기반으로 Plan 모드로 구현 계획서 및 타임 테이블을 작성했다.

### 배포 설계 

그 사이, 해당 애플리케이션에서 배포를 하는 방법을 가이드라인에 따라 알아서 진행되게 했다.

![500](https://darhcarwm16oo.cloudfront.net/e56b3d614501a9f186b5fba3aa90fd98.png)

와 같은 기준이 있었다.
하지만, 배포는 Vercel & DB 는 Supabase & Agent SDK 는 Moru 로 전부 나한테 낯설었다.

가이드라인 마크다운을 넘겨

```
Moru API 키 — Moru는 Claude Agent SDK를 클라우드에서 실행하기 위한 샌드박스입니다. 각 에이전트를 격리된 환경에서 돌릴 수 있어요. moru.io/dashboard에서 API 키를 발급해주세요. 무료입니다!
Claude Agent SDK를 웹에 배포하려면 Moru가 아니더라도 어떤 형태로든 샌드박스가 필요합니다. 자세한 내용은 호스팅 문서와 보안 배포 문서를 참고해주세요.

...
해당 내용 기반으로 같이 배포 해보자.
```

![500](https://darhcarwm16oo.cloudfront.net/a7877bdc287fbc897b53be74f7a24508.png)

Cluade 함께 차례대로 설정을 했다.

### 문서 처리 & 잡무

![500](https://darhcarwm16oo.cloudfront.net/10c96caa57e0a71e68cf61d4bbd3be1b.png)

![500](https://darhcarwm16oo.cloudfront.net/1d364b5297e52b0c554c50aab8c15ee1.png)

나머지는 진행하며 처리하는 식으로 했다.

## 완성

4시간 이라는 시간이 생각보다 빠듯하다는 생각은 들지 않았다.
물론, 내가 처음에 계획한 기능을 전부 만들진 못했지만 어느정도 틀을 완료하고 기능만 하나씩 추가해나가는 식의 흐름이 되었다.

그리고, 대화를 하는게 의도인거 같아서

![500](https://darhcarwm16oo.cloudfront.net/1fc4a95c7d33fcd96e635473f2bc2617.png)

AI 끼리 대화가 아니라, 나와 AI 가 대화하는 형태로 구현했다.

> 사이트를 곧 닫을 예정이므로 깃허브 저장소로 대체한다.
> [hackathon-toron](https://github.com/youngsu5582/hackathon-toron)

![500](https://darhcarwm16oo.cloudfront.net/5705dda3bd75eb92d9156d4568823b18.png)

1. 사진과 같이 주제를 선택

![500](https://darhcarwm16oo.cloudfront.net/eb3e26795447172cd687a4b2d6ea2785.png)

2. 입장을 선택

![500](https://darhcarwm16oo.cloudfront.net/2aa32edfc2167b53fcb8150ebda257a6.png)

3. 주제에 대한 설명후 토론 시작


![500](https://darhcarwm16oo.cloudfront.net/f2cbf06343a378622ed6aae2e1ad65ad.png)

a. 반박을 위한 반박 말투로 시스템 프롬프트 설정

![500](https://darhcarwm16oo.cloudfront.net/e1fad1384c0957698b75dac484534d98.png)

b. 웹에서 반박한 근거를 가져온다.

![500](https://darhcarwm16oo.cloudfront.net/82ca0241b976c4766e4e41d1af792e01.png)

c. bash 권한을 통해 직접 반박할 근거를 준비한다.

![500](https://darhcarwm16oo.cloudfront.net/bdd0eb0c027a24c3258549cf6cb3b895.png)

4. 관중석에선 의견을 제시할 수 있게 한다.

> 참전 로직은 확인 못했다.

![500](https://darhcarwm16oo.cloudfront.net/c6859dc1bf545094a204174435b84200.png)

5. 진행중인 토론과 예전 토론들의 결과를 조회하게 한다.

## 소감

### 해커톤

해커톤은 단순히 서버 개발만 하는게 아니라 빌드, 배포, 설정 그리고 발표 등 다양한 걸 해야하는걸 느꼈다.
Vercel, Supabase, Next.js, Moru 등 새로운 기술들을 사용했다.
 
- 빠른 웹 배포를 위한 Vercel
- 빠르게 DB 세팅을 위한 Supabase
- 빠른 웹 개발을 위한 Next.js

시간을 많이 안쓰고, 빠르게 가이드를 구축하고 적응해야 시간을 아낄수 있다.

그리고, 발표가 생각보다 중요한걸 깨달았다.
다른 분들의 발표를 보며, 자신의 제품을 잘 PR 하는 것도 큰 능력이라고 받았다.
아무리 잘 만들어도, 아무도 관심없고 흥미를 가지지 않으면 의미없을 테니까..

[유스콘](https://youngsu5582.life/posts/youthcon-presentation-reflections/) 에서 처음 발표를 하고 느낀거처럼 이 부분도 좀 더 개선을 해나가야겠다.

### LLM 의 위력

LLM 은 내 개인적인 의견으론 이미 특이점을 넘긴거 같다...
다양한 체크리스트 관점에서 생각해봐도

- [ ] 처음 보는 프로젝트 파악을 더 잘하는가
- [ ] 로그 기반으로 에러 파악을 더 잘하는가
- [ ] 기존 코드에서 의도대로 변경을 더 잘하는가
- [ ] 원하는 대로 코드를 빠르게 추가를 더 잘하는가

어떤거 하나도 처음부터 시작하는 바이브 코딩에선 AI 를 이길순 없다.
꽤나 절망스러운거 같기도...?

이번 해커톤을 하며 내가 직접 작성한 코드는 한 줄도 없다. 코드를 본적도 없고.

그리고, 병렬로 작업이 가능하다는 건 정말 굉장한거 같다.

컴퓨터공학에서 운영체제를 배울때는
`하나의 CPU 가 여러개의 작업을 처리하는 일종의 시분할 시스템이 의미가 있나?` 라고 생각했는데
인간 CPU 가 되니 느껴진다. 엄청나게 효율이 뛰어난거 같다.

사실 가장 큰 문제는 사람이다.
'LLM 에게 잘못 시키거나..', '하나씩 확인해야 하거나', 'Context Switching 이 안되어서 병목이 생긴다거나...'

발전의 속도가 너무나도 빠르다...

### 아아디어를 생각하자

상당히 흥미로운 아이디어들이 많았다.

- Moltbot 과 비슷한 bot
- 보이스를 사용한 사연에 대해 유명인들이 해주는 팟 캐스트
- 유투브 인플루언서들이 일일히 댓글 남기지 않게 댓글 달아주는 서비스
- LLM 으로 래핑한 캐릭터 RPG

등등. 요새, 회사를 다니면서도 느꼈지만 정말 좋은 아이디어가 있다면 창업을 안할 이유가 없다는 생각이 들었다.
물론, 그만큼 이제는 개개인이 만든 프로덕트가 쏟아지고 있긴 하다만...

## 마무리

![500](https://darhcarwm16oo.cloudfront.net/ed9ed06b41b66907bc23dcdb074cc1a0.png)

해커톤은 3등으로 마무리했다. 처음 해봤는데 꽤나 재밌었다.
요새, 숏폼에 두뇌가 절여져 간다고 느꼈는데 4시간 동안 몰입한 경험이었다.

다음에는 다른 사람들이랑 함께 더욱 재밌는 경험을 해봐야겠다.
