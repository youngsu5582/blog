---
title: "나만의 Workflow 파일 만들기 ( 부제 : 이슈 기반 PR 자동 생성기 )"
author: 이영수
date: 2024-07-28T08:41:23.943Z
tags: ['automation', 'github action', '우테코', '워크플로우']
categories: ['개발자 생산성']
description: 워크플로우 Run 200번의 삽질을 하며 느낀점
image:
  path: https://velog.velcdn.com/images/dragonsu/post/b26d4a57-c842-4b4b-be05-3524bb1e5040/image.png
---
해당 내용은 원하는 기능의 워크플로우를 만들기 위해 
수많은 삽질과 시간 낭비를 하며 느낀점들과  삽질 피하는법 + 워크플로우를 만드는 방법에 대해 다룬다.
`joyson5582@gmail.com` 이나 댓글로 궁금함이나 의견을 나타내면 제 의견을 좀 더 설명하겠습니다.

우선, 방법에 대해 설명하기에 앞서
내가 만들고 싶은 워크플로우는 `이슈를 기반으로 PR을 자동생성 해주는 워크플로우` 였다.

만들고 싶은 이유로는

1. 똑같은 내용 ( 라벨, 이슈 번호, Assignee )이나 복사해서 만들어야 하는 불편함
2. 각자가 직접 PR 작성시, 컨벤션에 혼동이 올 수 있다
3. 프론트와 백엔드의 템플릿을 분리하고 싶다

이다.

![500](https://i.imgur.com/JxOU5dG.png)

( 이를 위해 삽질한 runs 의 수... )

그러면 내가 삽질하며 느낀 나만의 워크플로우를 만드는 방법에 대해 소개하겠다.
## 이미 있는지 액션 찾기

아니, 나만의 워크플로우를 만드는 방법인데 왜 액션이 있는지 찾으라고 하는가??

대부분의 워크플로우는 이미 존재한다.
우리가 얼마나 커스터마이징 할 수 있는지, 잘 동작하는지의 문제에서 적용을 할 수 있는지 / 못하는지 때문이다.

자신이 확인 했을때 액션이 잘 되어 있다면 당연히 굳이 그 과정을 만들 필요가 없다.

나로서는 `peter-evans/create-pull-request` 라는 액션을 찾아갔다.
### 액션 무턱대고 바로 사용하지 않기

![500](https://i.imgur.com/YAqzVFV.png)

액션은 대부분이 설명을 정말정말 설명을 잘해놨다.
액션의 README 나 Docs 에 설명 및 사용법 과 Input 값을 정말 잘 작성했다.
그냥, GPT나 예시코드를 보고 사용하는것보다 문서를 보며 사용법을 이해하는게 훨씬 더 중요하다.

> labels 를 쓰려면 comma(,) 나 줄로 구분한 리스트로 작성하라
> assigness 는 comma 나 줄로 구분한 리스트이며, Github username 을 넣어라

이렇게 공식 문서를 보는게 매우 중요하다.
본인 워크플로우에 바로 넣는것보다 액션을 어떻게 커스터마이징 하여 사용할 수 있는지 + 변수 값의 주의해야할 점이 무엇인지에 대해서 공부를 하자

나는 이 액션을 어떻게 사용해야 하는지를 모르고 단순히 넣고 동작 + 워크플로우의 개발 언어 ( YAML + Bash + CLI ) 오류와 겹치며 70~80여번의 삽질을 해버렸다...
### 액션이 무엇을 할 수 있는지 정확하게 인지하기

액션 처음이나 액션 동작(`Action behaviour` ) 에서 액션의 의도 & 역활을 잘 알려준다.
\
[peter-evans/create-pull-request](https://github.com/peter-evans/create-pull-request)

```
A GitHub action to create a pull request for changes to your repository in the actions workspace.

Changes to a repository in the Actions workspace persist between steps in a workflow. 
This action is designed to be used in conjunction with other steps that modify or add files to your repository. 
The changes will be automatically committed to a new branch and a pull request created.
```

해당 내용은 위 Repository 에서 Preview 부분의 내용이다.
`A GitHub action to create a pull request for changes to your repository in the actions workspace.`
`The changes will be automatically committed to a new branch and a pull request created.`
-> 이 엑션은 actions workspace 내에서 변화에 대해 PR을 만든다.
-> 새로운 브랜치를 만들고 PR을 자동으로 만든다.

```
The default behaviour of the action is to create a pull request that will be continually updated with new changes until it is merged or closed. 
Changes are committed and pushed to a fixed-name branch, the name of which can be configured with the `branch` input. 
Any subsequent changes will be committed to the _same_ branch and reflected in the open pull request.

How the action behaves:

- If there are changes (i.e. a diff exists with the checked-out base branch), the changes will be pushed to a new `branch` and a pull request created.
```

해당 내용은 Repository 의 `Action behaviour` 이다.
`If there are changes (i.e. a diff exists with the checked-out base branch), the changes will be pushed to a new `branch` and a pull request created.`
-> 변화가 있다면 ( checked-out base branch와 비교해서 ) 변화를 새로운 branch 에 push 하고, PR 을 생성한다.

그렇다... 내가 의도한 목적과 다르다.
나는 이슈에 대한 브랜치를 파고 작업 후 Push를 하면 이슈에 대해서 PR이 자동으로 생성이 되길 원했다.

그렇기에 이미 있는 액션을 찾고 -> 액션을 무턱대고 사용하지 않고 -> 액션이 무엇을 할 수 있는지 정확하게 인지 를 한 후 사용을 해야만 한다.
## 워크플로우 삽질

### 기본 문법 충실히 이해하기

위의 삽질을 통해 내가 원하는 액션을 못 찾은 나는 워크플로우를 어떻게든 만들어내려고 했다.
위에서 말했듯 기본 언어에 대해 충실히 이해하지 못하고 한 삽질은 수없이 많은 실패와 의미없는 실패일 뿐이였다.

사실 해당부분에 대해서는 아직도 완벽하게 이해하지 못했다.
그래도 나름대로의 이해한 부분에 대해서 설명을 하겠다.
#### 기초
```bash
issue_number="${BASH_REMATCH[2]}"
```

변수를 선언할 때 `괄호(=)` 사이는 무조건 붙혀야 한다.

```bash
echo "BRANCH_NAME=$branch_name" >> $GITHUB_ENV
```

echo 문을 통해서 GITHUB ENV에 값을 저장할 수 있다. ( 물론, ENV 말고 다른 곳에 저장이 가능할 수 있으나 나는 ENV에서 했다. )

> ENV 의 값은 하나의 워크플로우 내에서 공유된다. ( 여러 워크플로우에서 공유 X )

```bash
issue_number="${{ env.ISSUE_NUMBER }}"
```

기존 step 에서 정의 or 처음 ENV에서 정의한 값은 `${{ }}`와 함께 값을 사용한다.
#### 조건문 & 종료 & 정규식
```bash
if [[ "$branch_name" =~ ^(feat|fix|refactor)/#([0-9]+)$ ]]; then  
  branch_prefix="${BASH_REMATCH[1]}"  
  issue_number="${BASH_REMATCH[2]}"  
  echo "BRANCH_PREFIX=$branch_prefix" >> $GITHUB_ENV  
  echo "ISSUE_NUMBER=$issue_number" >> $GITHUB_ENV  
else  
  exit 0  
fi
```

조건문은 if - then / else / fi 문으로 구성되어 있다.
if 문을 쓰면 fi 는 필수적이다.

exit 0은 성공하며 종료, exit 1은 실패하며 종료이다. ( 1은 당연히 빨간색 ❌, 0은 ✅ 로 결과가 나온다. )

사실, 해당 코드를 보면 이상함을 느낄거다.
왠 =~ 가 있지?? - 놀랍게도 Github Action에서 정규 표현식을 매칭하기 위한 연산자이다.
정규식에 대한 내용은 당연히 생략한다. 정규식의 결과는 `BASH_REMATCH` 에 저장이 된다.
#### curl & jq

```bash
response=$(curl -s -H "Authorization: token ${{ secrets.GITHUB_TOKEN }}" \  
                  -H "Accept: application/vnd.github.v3+json" \  
                  "https://api.github.com/repos/${{ github.repository }}/issues/$issue_number")
```

curl 은 매우 기존 명령어와 매우 동일하다.
이때 secrete.GITHUB_TOKEN 은 기본적으로 제공해준다.
github는 꽤나 많은 정보들을 기본적으로 제공해준다.
[github-context](https://docs.github.com/en/actions/learn-github-actions/contexts#about-contexts)
- github.event_name : push,pull_request,comment 등등 발생한 이벤트
- github.actor : 워크플로우 실행한 행위자 username
- github.repository : 워크플로우 실행한 repository

요청에 나오는 값은 생략하고 jq 에 대해 설명하겠다.

```json
  "labels": [
    {
      "id": 7165282542,
      "node_id": "LA_kwDOMSLtQ88AAAABqxWI7g",
      "url": "https://api.github.com/repos/youngsu5582/project-test/labels/bug",
      "name": "bug",
      "color": "d73a4a",
      "default": true,
      "description": "Something isn't working"
    },
    {
      "id": 7186191292,
      "node_id": "LA_kwDOMSLtQ88AAAABrFSTvA",
      "url": "https://api.github.com/repos/youngsu5582/project-test/labels/BE",
      "name": "BE",
      "color": "bfd4f2",
      "default": false,
      "description": "백엔드용"
    }
  ],
```

labels 가 이렇게 되어 있다면?

```bash
echo "LEGACY_LABELS : $(echo "$response" | jq -r '.labels[].name')"  
echo "REFACTOR_LABELS2 : $(echo "$response" | jq -r '.labels[].name' | awk '{ORS=", "}1')"
echo "LABELS : $(echo "$response" | jq -r '.labels[].name' | awk '{ORS=", "}1' | sed 's/, $//')"
```

이 3가지의 차이는?

```bash
LEGACY_LABELS : bug
BE
REFACTOR_LABELS : bug, BE,
LABELS : bug, BE
```

- LEGACY 는 `\n` 을 실제 개행으로 인식
- REFACTOR 는 `\n` 을 `, ` 으로 변환
- LABELS 는 마지막에 쉼표 제거

각자 기호에 맞게 잘 사용하자 ( 뒤에 쉼표가 있어도 동작하는 액션이 있고, 동작하지 않는 액션이 있다. )

jq는 커맨드라인에서 JSON 작업을 도와주는 프로세서이다.

모든 값은 "key":"value" 라고 생각하고 설명한다.
- -r : 원시 문자열 출력 ( jq -r '.key' -> `value` )
- -e : 필터 조건 검사 ( jq -e '.key == "value"' -> `0(true)`, 아니면 1(false) ) 

솔직히 이거 두개만 해도 충분하지 않을까 생각한다.

> ORS 는 나도 처음 안 값이다.
> Output Record Separator 로, 출력 레코드 구분자를 지정한다.
> 기본값은 `\n` 인데 `, ` 로 변경한다.

`sed 's/, $//'` -> 문자열 끝에 쉼표를 빈 문자열로 변환하자

### GH CLI

깃허브는 매우 다양한 기능을 제공해준다.
https://cli.github.com/manual/

이를 통해 PR LIST 조회 + PR 생성 + 리뷰 생성 + 이뷰 생성 등등 모든걸 다 할 수 있다.

내가 필요한 기능은 

1. 이미 특정 브랜치 -> 베이스 브랜치로 향하는 PR이 있는지 조회한다. ( 재 생성, 덮어쓰기 방지 )
2. 이슈를 기반으로 PR 자동 생성

왜 이슈 검색은 gh으로 안했는가?

![500](https://i.imgur.com/fMJpw6t.png)

gh 로 주는 정보는 다양하게 주지 않는다. CLI 에 맞게 간편하게 준다.

```
existing_pr=$(gh pr list --state open -H "$branch_name" -B develop --json number -q '.[] | .number')
```

하지만, 이렇게 리스트에 조건에 맞는 PR이 있는지 확인하는 거라면?
( 상태가 Open이고, Head Branch 는 우리가 Push한 브랜치, Base Branch 는 향하는 브랜치를
-> json 형식으로 number 만 받고, jq 형식으로 해서 number 추출 )

충분히 gh 로 가능하다.

```
gh pr create --assignee "${{ env.ASSIGNEES }}" --title "${{ env.PR_TITLE }}" --body "${{ env.PR_BODY }}" --base "develop" --label "${{ env.LABELS }}"
```

해당 명령어는 더욱 명확하다. PR을 옵션에 맞게 생성하는 것이다.

```yml
name: Auto Create Pull Request  
  
on:  
  push:  
    branches:  
      - 'feat/#*'  
      - 'refactor/#*'  
      - 'fix/#*'  
  
jobs:  
  auto-pull-request:  
    runs-on: ubuntu-latest  
  
    steps:  
      - name: Checkout code  
        uses: actions/checkout@v4  
  
      - name: Extract Branch Prefix, Issue Number  
        id: extract  
        run: |  
          branch_name="${GITHUB_REF#refs/heads/}"  
          echo "BRANCH_NAME=$branch_name" >> $GITHUB_ENV  
            
          if [[ "$branch_name" =~ ^(feat|fix|refactor)/#([0-9]+)$ ]]; then  
            branch_prefix="${BASH_REMATCH[1]}"  
            issue_number="${BASH_REMATCH[2]}"  
            echo "BRANCH_PREFIX=$branch_prefix" >> $GITHUB_ENV  
            echo "ISSUE_NUMBER=$issue_number" >> $GITHUB_ENV  
          else  
            exit 0  
          fi  
  
      - name: Check for Already Exist  
        id: check_pr  
        run: |  
          branch_name=${{ env.BRANCH_NAME }}  
          existing_pr=$(gh pr list --state open -H "$branch_name" -B develop --json number -q '.[] | .number')  
            
          if [ -n "$existing_pr" ]; then  
            echo "EXISTED=TRUE" >> $GITHUB_ENV  
            echo "Alreadt Exist in https://github.com/${{ github.repository }}/pull/$existing_pr"  
            exit 0  
          fi  
        env:  
          GH_TOKEN: ${{ github.token }}  
  
      - name: Fetch Issue Detail  
        if: ${{ !env.EXISTED }}  
        run: |  
          issue_number="${{ env.ISSUE_NUMBER }}"  
            
          response=$(curl -s -H "Authorization: token ${{ secrets.GITHUB_TOKEN }}" \  
                            -H "Accept: application/vnd.github.v3+json" \  
                            "https://api.github.com/repos/${{ github.repository }}/issues/$issue_number")  
            
          assignees=$(echo "$response" | jq -r '.assignees[].login' | tr '\n' ', ' | sed 's/, $//')  
          assignees=$(echo "$assignees" | rev | cut -c 2- | rev)  
            
          title=$(echo "$response" | jq -r '.title')  
            
          labels=$(echo "$response" | jq -r '.labels[].name' | tr '\n' ', ' | sed 's/, $//')  
          labels=$(echo "$labels" | rev | cut -c 2- | rev)  
            
          pr_title="${title}(#${issue_number})"  
            
          echo "$response" | jq -r '.body' > issue_body.txt  
            
          echo "ASSIGNEES=$assignees" >> $GITHUB_ENV  
          echo "LABELS=$labels" >> $GITHUB_ENV  
          echo "TITLE=$title" >> $GITHUB_ENV  
          echo "PR_TITLE=$pr_title" >> $GITHUB_ENV  
          echo "ISSUE_BODY_FILE=issue_body.txt" >> $GITHUB_ENV  
  
      - name: Generate PR Body  
        if: ${{ !env.EXISTED }}  
        id: generate-body  
        run: |  
          issue_number="${{ env.ISSUE_NUMBER }}"  
            
          echo "## 📌 관련 이슈" >> body.md  
          echo "" >> body.md  
          echo "- closed : #${issue_number} " >> body.md  
          echo "" >> body.md  
          echo "## ✨ PR 세부 내용" >> body.md  
          echo "" >> body.md  
          echo "<!-- 수정/추가한 내용을 적어주세요. -->" >> body.md  
            
          summary=$(cat body.md)  
          echo "PR_BODY<<EOF" >> $GITHUB_ENV  
          echo "$summary" >> $GITHUB_ENV  
          echo "EOF" >> $GITHUB_ENV  
  
      - name: Create Pull Request  
        if: ${{ !env.EXISTED }}  
        run: |  
          gh pr create --assignee "${{ env.ASSIGNEES }}" --title "${{ env.PR_TITLE }}" --body "${{ env.PR_BODY }}" --base "develop" --label "${{ env.LABELS }}"  
        env:  
          GH_TOKEN: ${{ github.token }}
```

그렇다! 해당 파일을 통해 나는 나만의 `이슈를 기반으로 PR을 자동생성 해주는 워크플로우` 를 완성했다.

당연히, step 간 output 을 사용해서 더 깔끔하게 또는 생략 가능한 불필요한 명령어들이 들어있을 수 있다.
뭐 어떤가? 내가 만든 엄연한 프로그램인걸.

![500](https://i.imgur.com/dJS8taj.png)

이는 또, 내가 만든 라벨에 따른 리뷰어 자동 배정 워크플로우와도 함께 동작을 해서 더욱 자동화를 용이하게 해준다.
### 결론

워크플로우는 개발자가 한번즈음 생각한 모든 것들을 가능하게 해준다.
( 내가 깃허브에 무슨 행동을 했을 때 어떤 작업을 할 수 없나?? )

특히

- Github 가 제공해주는 GH CLI
- 실제 HTTP 요청을 보내는 curl
- 이미 사람들이 만들어 놓은 수많은 Step

한 번 즈음은 이런 삽질을 하며 자신만의 워크플로우를 만들어보는건 어떨까?

워크플로우가 들어있는 저장소는 현재 진행중인 우테코 프로젝트인
https://github.com/woowacourse-teams/2024-corea 이다.

앞으로의 계획만 하는 워크플로우로는 ( 수없이 삽질을 했더니 힘들다... )
라벨을 기반으로 브랜치 `develop` 기반으로 자동으로 만들어서 pull 해서 바로 개발 가능하게 한다던지
`develop` 브랜치에 변화가 생기면 모두가 pull 하게 Slack Webhook 으로 멘션을 보내게 할까도 생각중이다.
( 물론, 필요성을 느끼고 팀원들도 있으면 좋겠다고 한다면 )
#### 쓰잘데기 없는 꿀팁?

- 워크플로우는 현재 자기가 작업중인 브랜치 파일을 기반으로 동작한다. ( 베이스 브랜치 ❌ )
- 왠만하면 로그를 찍어서 어떤 값을 주고, 어떻게 사용해야 하는지 확인하고 시작하자. ( 깃허브가 어떤 값을 주는지 확인하기는 매우 어렵다. )

![500](https://i.imgur.com/lT5DjsQ.png)

이렇게 Payload 에 다양한 값들이 들어가는데 내가 못찾은건지 모르겠으나
object 로 되어있는 부분들도 많고, Action type 에 따라 받는 Payload들도 상당히 다르다.
그렇기에 `echo $RESPONSE` 로 시작하는건 정말 좋은 시작이라고 생각한다.

- 깃허브 액션(gh) 가 만드는 PR은 다른 워크플로우를 트리거 하지 않는다. ( 리뷰어 할당 워크플로우에는 PR `opened` 가 있는데 작동 안함 )
- 위와 마찬가지로 actor 가 github-action-bot 이 된다.
- 어차피 실행하기 전까지 워크플로우가 어떻게 동작할지 완벽하게 예상못한다. ( 자신의 프로젝트에서, 디버깅과 함께 문법을 신경쓰며 계속 실행하자 )

이 밖에도 자신의 꿀팁이 있다면 공유해줘도 감사히 받겠습니다.
