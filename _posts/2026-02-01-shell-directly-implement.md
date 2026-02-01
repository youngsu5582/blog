---
title: Shell 직접 만들어보기
tags:
  - 프로그래밍
  - Shell
  - 개발자
  - 테스트
description: 'Shell을 직접 구현하며 개발자로서의 기본기를 다지고, 다양한 개념을 학습한 경험을 공유합니다.'
page_id: shell-directly-implement
permalink: /posts/shell-directly-implement/
author: 이영수
date: 2026-02-01T06:22:03.291Z
---
## 왜 이런걸 하게 되었는가?

GeekNews 에서 [프로그래밍 프로젝트 아이디어: 깃, 도커, 레디스를 직접 개발하며 배우는 법](https://news.hada.io/topic?id=25462) 라는 게시글을 보았다.

`언어나 프레임워크의 기초를 뗀 후, 다음 단계의 도약을 고민하는 개발자들을 위한 수준 높은 프로젝트 가이드` 라는 소개와
`우리가 매일 쓰는 시스템의 '내부 원리'를 파헤치는 프로젝트들을 제안` 이 매력적으로 다가왔다.

그렇게, [codercrafters](https://app.codecrafters.io) 를 알게됐다.

### codercrafters

우리가 사용하던 요소들을 직접 구현할 수 있게 단계별로 제공해주는 프로젝트다.
백엔드 개발자라면, 흥미를 가질

- Kafka
- Redis
- Shell
- SQLite

등을 만들수 있다!

![image](https://darhcarwm16oo.cloudfront.net/2017fd93590993e6449c9c2381ac3e2f.png)

요금제가 존재하고 ( 할인 해줘도 조금 비싼듯... )
매달 1개씩의 Challenges 는 제공해준다고 한다.

![image](https://darhcarwm16oo.cloudfront.net/2f6dceb3412997773d3160a4b1e97648.png)

C, C#, Go, Kotlin, Java, Javascript, Typescript 등등
다양한 언어로 미션을 수행할 수 있다.

![image](https://darhcarwm16oo.cloudfront.net/1e5b285eff83d0ea90209f0c5de27350.png)

이번달은 Shell 구현이 무료로 제공되어서 해보았다.
추가로, Kotlin 을 학습해보고 싶어서 Kotlin 으로 진행했다.

### 진행방법

진행 방법은 

![500](https://darhcarwm16oo.cloudfront.net/e4964449aabffbe5c5a996aea1c7f55f.png)

1. 주어진 Task 를 수행하면 된다.
2. 그 후, 작업을 커밋한다. - `git commit -am "[any message]"`
3. 작업을 push 한다. - `git push origin master`

그러면 웹사이트에서 테스트가 진행된다.

![image](https://darhcarwm16oo.cloudfront.net/97014be314d3e9d733a04795ca267fdd.png)

테스트를 통과하면 다음 Step 으로 넘어간다.

> 매번, commit - push 를 통해 테스트 하는게 번거롭다면
> codecrafters cli 를 설치하고, codecrafters test 를 입력하면 된다.
> 그리고, 테스트를 통과하면 codecrafters submit 로 제출도 가능하다.

## 구현하며 느낀점

충분히 만족스러운 서비스였다.
개발자로서 오랜만에, 직접 코드를 짜보고, 다른 도메인을 개발하는 느낌이였다.

### 기본기

`Shell 구현 정도는 어렵지 않겠지` 라고 생각했는데 큰 오산이였다.

Step 을 구현하는 식이다보니, 다음 Step 을 구현하려고 할 때마다 코드 구조가 깨지게 되었다.
`어디까지 리팩토링을 해야하는지` & `다음에 어떻게 확장이 되어야할지` 를 계속 고민하게 만들었다.

기존, 구축되어 있는 프로젝트가 아닌

- 내가 주도하여 처음부터 구조 작성 및 개선
- 요구사항에 맞게 코드를 계속 반영
- 기존 요구사항은 준수


이를 위해, 객체지향과 클린코드 등을 생각해야만 했다. (오랜만에 우테코 미션을 하는 느낌)
추가로, LLM 의 도움을 안받고 코드 자체를 오랜만에 짜보니까 뇌가 굳은게 느껴져서 스스로도 현타가 좀 왔었다.

### 구현 중 나오는 키워드를 통한 BFS 학습

- File API
- ProcessBuilder
- InputStream, OutputStream

등 회사에선 이슈를 위해 사용만 하던 요소들에 대한 개념들이 쏟아져 나왔다.

특히 우리팀은 이미지 프로세싱 때문에 node process 가 필요해서, ProcessBuilder 를 사용하고 있었지만
이미 세팅이 되어있었기에 크게 관심을 안가지고 있었다.

하지만, ProcessBuilder 를 사용하게 되면서 사용법, 흐름, 내부 설계 등에 대해 자세히 학습하게 되었다.

- 왜 `Runtime.exec` -> `ProcessBuilder` 가 나오게 되었는지
- Zero-Copy 가 뭔지, Native Memory 가 뭔지
- InputStream, OutputStream, Redirection 이 뭔지
- InputStream 을 비워주지 않으면, 왜 데드락이 발생할 수 있는지

등 구현 하며 나온 내용들에 대해 탐구를 해나갔다.
특히, byte 배열과 stream 의 차이에 대해 한번 더 생각하게 되었다.

우리 서비스 구조상 입력된 이미지 크기를 제한 받고 있으니 byte 배열을 그대로 사용했지만 Stream 을 사용해
힙 메모리, 네이티브 메모리를 더 개선할 수 있겠다는 가능성을 보았다.

> 물론, 이는 대규모 코드 공사를 유발하긴 하겠지만...

![image](https://darhcarwm16oo.cloudfront.net/def5179f737d60cff054a3e801b2b16e.png)

### 테스트의 중요성

Step 별로 진행을 하니, 이전 Step 까지 동작을 보장을 해줘야했다.

이번 Step 을 고치면서, 다른 Step 에서 한 내용을 건들수가 있었다.
EX) Shell Command 를 추가하며, Built-In Command 처리 방식이 달라진다든지

그래서, 통합 테스트 코드를 작성했다.

```kotlin
private fun execute(command: String, pathList: List<String> = emptyList()): String {  
    val input = ByteArrayInputStream(command.toByteArray())  
    val output = ByteArrayOutputStream()  
  
    val app = ShellApplication(input, output, pathList)  
    app.start()  
  
    return output.toString()  
}
```

```kotlin
/**  
 * exit 를 입력해야만, 종료가 되므로 맨 마지막에 무조건 종료가 되게 커맨드 구성  
 */  
private fun buildCommand(builder: StringBuilder.() -> Unit): String {  
    return StringBuilder().apply {  
        builder()  
        append("exit")  
        append(System.lineSeparator())  
    }.toString()  
}

val command = buildCommand {  
    appendLine("type not-exist-command")  
}
```

- Application 외부에서 InputStream, OutputStream 을 주입해서 테스트에서 검증하도록 설정
- 맨 마지막에는, 무조건 exit 가 되게 보장

```kotlin
@Test  
fun `type {command} 를 찾지 못한다면, command not found 를 출력한다`() {  
    val command = buildCommand {  
        appendLine("type not-exist-command")  
    }  
  
    val result = execute(command, pathList = pathList)  
    assertTrue { result.contains("not-exist-command: not found") }  
}
```

그 후, 입력 - 출력을 통해 결과를 검증했다.

결론적으론, Step 마다 테스트를 작성해서 

![image](https://darhcarwm16oo.cloudfront.net/1b3da3223852b920bac2464cf414bd5b.png)

29개의 테스트를 작성했다.

그리고, 

![image](https://darhcarwm16oo.cloudfront.net/f09c732e7464f4e3eac91b0c668d77fd.png)

각 객체들에 대해 테스트를 작성해서 세부 로직을 검증했다.
이를 통해

- 코드 수정의 불안함을 줄인다.
- 내가 구현한 내용을 문서화한다.
- 테스트를 작성하며, 코드의 복잡함을 다시 한번 고민하게 된다.

의 효과를 얻었다.
회사에서 한동안 까먹었던 테스트의 장점을 다시 한번 느낄수 있었다.

## 마무리
터미널에서 제공되던 기능들을 어떻게 구현했을지 상상 및 구현하게 해주고, 평소에 지나쳤던 개념들에 대해서도 더욱 깊은 학습을 하게 됐던거 같다.

특히, 점진적으로 요구사항이 추가되는 환경에서
구조를 어떻게 유연히 가져갈지 고민하는게 실무에서도 도움이 되는거 같다.

내가 작성한 코드는 [youngsu5582/shell-implement-challenge](https://github.com/youngsu5582/shell-implement-challenge) 에 있다.
모두 한번즈음 시도해봐도 좋을거 같다.

모든 Step 을 완료하진 않았다.

- 기본 Stages
- Navigation
- Quoting
- Redirection
- Pipeliens

![500](https://darhcarwm16oo.cloudfront.net/71da7406964143da5c18fb6dda850194.png)

를 완료했다.

>  Autocompletion, History, History Persistence 는
>  Jline 이라는 라이브러리를 사용해야 하는 내용들이 있어서 하지않았다.
>  (화살표 기능 제공 및 Tab 입력시 자동 완선 기능 등은 일반적인 프로그래밍으로는 불가능)

> Quoting 는 맨 마지막 명령어 처리 부분에서 계속 실패하고 있어서 Progress 상태..
