---
title: "CodePipeline 에서 프라이빗 서브모듈 도입기( Token VS SSH In Github )"
author: 이영수
date: 2024-08-07T16:04:25.567Z
tags: ['CodePipeline', 'aws', 'codebuild', '우테코']
categories: ['인프라', 'CI/CD']
description: 이번에도 50번 정도의 삽질을 하며...
image:
  path: https://velog.velcdn.com/images/dragonsu/post/44daa2e8-33e2-4da3-a7e2-b75002a79f27/image.png
---
Github OAuth Login, JWT Token 들을 사용하기 시작하면서 키 관리가 필요해졌다.

키 관리에 대해 고민하던 중 우리는 `Submodule` 을 사용하기로 했다.
팀원들이 모두 일관된 상태로 키를 관리할 수 있는점 + 변경이 관리가 된다는 점들 때문이였다.

로컬에서 테스트를 성공적으로 돌리고 CodePipeline 에 배포를 한 결과?
보기좋게 실패가 떴다..

확인을 해 보니 서브모듈이 `CodeBuild` 에서 제대로 해결이 안되는 부분이였다..
분명히 `CodeCommit` 에서는

![350](https://i.imgur.com/miYvYnk.png)

이렇게 git 하위 모듈을 활성화 한다고 되어 있는데 동작하지 않았다.

애초에 
https://stackoverflow.com/questions/69593932/submodule-error-repository-not-found-for-primary-source-and-source-version

해당 내용에서는 두 가지 선택지를 제공한다.

1. `- git submodule update --init --recursive` 를 통해 submodule 을 초기화 및 업데이트하라
2. `Under "Connection Status", try Disconnecting from Github -> Re-connect your login in the OAuth window prompt`
		Github 와 연결을 끊고, OAuth 를 재 로그인 하라. ( 권한을 받기 전 OAuth 여서 권한이 인증 안되는 경우를 대비해서 인거 같다?? )

하지만, 둘 다 되지 않았고 다른 방법을 찾아야 했다.

![350](https://i.imgur.com/u3PJ5XR.png)
( 무수히 많은 삽질.. )

핵심은 서브모듈에서 값을 못 받아오는 문제였다.
이때 서브모듈에서 값을 가져오기 위해 `.git/config` 를 수정해야 한다.

### .git/config ??

GIT 을 많이 사용했지만 `.git/config` 는 자주 접하지 않았을 것이다.
GIT 설정 파일 관련이 있겠네?

```git
[core]
        repositoryformatversion = 0
        filemode = true
        bare = false
        logallrefupdates = true
        ignorecase = true
        precomposeunicode = true
[submodule "backend/src/main/resources/corea-prod"]
        active = true
        url = https://github.com/youngsu5582/<private repository>.git

```

서브모듈이 적용된 프로젝트를 보면 이렇게 `submodule` 에 대해서도 내용이 들어있다.

```bash
[Container] 2024/08/06 12:49:40.841414 Running command cat .git/config
[core]
    repositoryformatversion = 0
    filemode = true
    bare = false
    logallrefupdates = true
```

하지만 실행해본 결과 config 내 submodule 관련이 없다.
submodule 에 대한 내용을 넣어줘야 한다.

```bash
[Container] 2024/08/06 12:56:30.329651 Running command git config --add submodule.backend/src/main/resources/corea-prod.active true

[Container] 2024/08/06 12:56:30.335527 Running command git config --add submodule.backend/src/main/resources/corea-prod.url https://github.com/youngsu5582/<private repository>.git
```

이와같이 config 를 직접 추가하면

```
[submodule "backend/src/main/resources/corea-prod"]
        active = true
        url = https://github.com/youngsu5582/<private repository>.git
```

해당 내용이 추가가 된다.
하지만, `git submodule update --init --recursive` 을 하면 동작을 하지 않는다.

왜일까?

이 문제를 해결하기 위해선 서브모듈의 원리를 알고 있어야 하는데
서브모듈을 업데이트 하려면 
1. 원격 저장소와 연결 & 기본 저장소 올바르게 초기화
2. 최신 데이터를 가져와 특정 커밋으로 체크아웃
가 되어야 한다.

```
# 0. 깃 파일 초기화 ( .git/config 생성 )
git init

# 1. 원격 저장소 연결 
git remote add origin https://github.com/user/repo.git

# 2. 원격 저장소에서 최신 데이터 가져오기
git fetch

# 2. 특정 커밋으로 체크아웃
git checkout -f 1a2b3c4d5e6f7g8h9i0j
```

오케이, 추가해서 실행해볼까?

```
fatal: repository 'https://github.com/youngsu5582/<private repository>.git/' not found
fatal: clone of 'https://github.com/<private repository>.git' into submodule path ...
Failed to clone 'backend/src/main/resources/config' a second time, aborting
```

이와 비슷하게 뜰것이다. ( 나도 실제로 한 부분을 못 찾아서 대략 들고왔다. )

CodeBuild 는 독립적인 인스턴스에서 빌드를 진행한다.
당연히 이 인스턴스는 깃허브에 Private Repository에 접근 할 수 없다.
우리는 권한을 줘야만 한다.
### 방법 1. SSH

깃허브는 일반적인 `https://~~~.git` 을 통해 git clone 하는 방법 말고도 SSH 방법으로도 통신이 가능하다.

`git@github.com:woowacourse-teams/2024-corea.git` 이렇게 앞에만 git 으로 바꾸면 되는데
Settings - SSH and GPG keys 에서 SSH keys 를 등록해줘야 한다.

이떄는 CodeBuild 가 접속하려는 클라이언트 - 깃허브가 접속을 받는 서버 이므로
깃허브에 공개키를, CodeBuild에 암호키를 넣고 연결을 해야 한다.

키 생성을 하려면?
`ssh-keygen -t ed25519 -C "joyson5582@google.com" -f ~/.ssh/id_rsa_2024_corea`

당연히, 옵션들은 필요없다. 명령어를 실행하면 공개키, 암호키를 같이 생성해준다.
( -C : Comment, 마지막 설명 -f : FileSystem, 파일 경로 지정 )

![350](https://i.imgur.com/Zbjc1Lw.png)

깃허브에 키를 넣고, AWS CodeBuild 는?

```yml
- mkdir -p ~/.ssh
- echo "$SSH_KEY" | tr ' ' '\n' > ~/.ssh/ssh_key
- sed -i '1i -----BEGIN OPENSSH PRIVATE KEY-----' ~/.ssh/ssh_key
- echo "-----END OPENSSH PRIVATE KEY-----" >> ~/.ssh/ssh_key
- chmod 600 ~/.ssh/ssh_key
- eval "$(ssh-agent -s)"
- ssh-add ~/.ssh/ssh_key
- git config --global url."git@github.com:".insteadOf "https://github.com/"
```

꽤나 복잡해보이지만 단순하다.

> Q : 2,3,4 번째 줄이 뭘하는 건가요?
> A : 
> -----BEGIN OPENSSH PRIVATE KEY-----
	asodlalksjd....
-----END OPENSSH PRIVATE KEY-----
  PEM 키는 이렇게 줄 바꿈 문자를 통해 들어와있다. 이때 이 값들을 통째로 ENV 에 넣으면 줄 바꿈을 인식하지 못한다.
  KEY 값을 먼저 넣고 가운데 넣고 첫 번째 줄, 마지막 줄에 BEGIN,END 를 넣는다.

파일을 넣고, 실행권한을 주고
`eval "$(ssh-agent -s)"` 를 실행해서 에이전트를 현재 셀에서 실행하고
에이전트에 key 를 추가한다.

마지막으로! ssh 를 사용하기 위해 `git@github.com` 으로 변경하면 끝이다!!

```yml
version: 0.2

env:
  variables:
    remote_origin: "git@github.com:woowacourse-teams/2024-corea.git"
    SSH_KEY: "${SSH_KEY}"

phases:
  install:
    commands:
      - mkdir -p ~/.ssh
      - echo "$SSH_KEY" | tr ' ' '\n' > ~/.ssh/ssh_key
      - sed -i '1i -----BEGIN OPENSSH PRIVATE KEY-----' ~/.ssh/ssh_key
      - echo "-----END OPENSSH PRIVATE KEY-----" >> ~/.ssh/ssh_key
      - cat ~/.ssh/ssh_key
      - chmod 600 ~/.ssh/ssh_key
      - eval "$(ssh-agent -s)"
      - ssh-add ~/.ssh/ssh_key
      - git config --global url."git@github.com:".insteadOf "https://github.com/"
      - |
        if [ ! -d ".git" ]; then
          git init
          git remote add origin "$remote_origin"
          git fetch
          git checkout -f "$CODEBUILD_RESOLVED_SOURCE_VERSION"
        fi
      - git submodule init
      - git submodule update --recursive
```


```
Cloning into '/codebuild/output/src1137548401/src/backend/src/main/resources/corea-prod'...
Submodule path 'backend/src/main/resources/corea-prod': checked out 'fd95100314b9eccbb0ec8ca123ce4328207ab3ee'
```

이렇게 성공적으로 `submodule update` 를 해온다.
### 방법 2. OAUTH

```
version: 0.2

env:
  variables:
    remote_origin: "https://github.com/woowacourse-teams/2024-corea.git"
    GITHUB_TOKEN: "${GITHUB_TOKEN}"  # PAT를 환경 변수로 설정

phases:
  install:
    commands:
      - git config --global url."https://${GITHUB_TOKEN}:x-oauth-basic@github.com/".insteadOf "https://github.com/"
      - |
        if [ ! -d ".git" ]; then
          git init
          git remote add origin "$remote_origin"
          git fetch
          git checkout -f "$CODEBUILD_RESOLVED_SOURCE_VERSION"
        fi
      - git submodule init
      - git submodule update --recursive
```

사실 이 방법으로 처음 하려고 엄청 삽질했는데 위 방법보다 더 간단했다.
( 밑에를 하지 않고, 위에 토큰 부분만 삽질하다 포기한게 핵심 )

SSH 를 넣어주듯이 GITHUB_TOKEN 만 넣어주면 끝이다.
( 이때 뒤에 있는 `x:oauth-basic` 도 필요없다... )

정말정말 간단하다! 마참내 서브모듈을 포함해 빌드를 성공했다.
### 결론

어떤 방법이든 깃에서 추가적인 로직이 가능하다. ( 서브모듈 말고도, pull push 역시도 할려면 와이낫 )
깃허브에서 만큼은 SSH 보다 OAuth Token 방식을 권장한다.

[In what ways is an SSH Key different from tokens for git authentication?](https://stackoverflow.com/questions/67077837/in-what-ways-is-an-ssh-key-different-from-tokens-for-git-authentication)

해당 내용에서 자세히 설명이 되어있는데

토큰은
- 고유함 : Github 특정, 각 사용자 or 서비스마다 생성
- 롤백성?(Revocable) : 토큰은 언제든 철회, 다른 자격 증명에 영향 X
- 제한적 사용 : 토큰은 사용 사례 맞게 필요 접근 권한만 허용하게 범위 설정 가능 ( 특정 저장소에만 읽기 권한 허용 가능 )
- 무작위성 : 토큰 자체가 무작위 문자열, 무차별 대입 공격에 영향을 받지 않음

이렇기에 쓸수 있다면 깃허브 토큰을 사용해서 깃허브를 사용하자.
