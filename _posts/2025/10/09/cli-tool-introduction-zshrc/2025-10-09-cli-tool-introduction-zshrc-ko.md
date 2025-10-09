---
title: '개발자의 1초, 1분, 1시간을 단축시키는 CLI (1) - zshrc 및 cli tool 소개'
tags:
  - CLI
  - 개발도구
  - zsh
  - 효율성
description: 개발자가 CLI를 통해 작업 효율성을 높이는 방법과 유용한 도구들을 소개합니다.
page_id: cli-tool-introduction-zshrc
permalink: /posts/cli-tool-introduction-zshrc/
author: 이영수
date: 2025-10-09T04:38:20.279Z
image:
  path: assets/img/thumbnail/2025-10-09-cli-tool-introduction-zshrc.png
lang: ko
---
개발자는 수많은 명령어들을 입력하게 된다.
GIT 부터 시작해서, SSH 로 서버 접속 이라든가, AWS 작업을 한다던가, DB 작업을 한다던가 등등

근데 이런걸 매번 입력하는건 너무 귀찮을 뿐 더러 외우기에는 어려울 수 있다.
CLI 를 통해 반복적인 작업을 자동화하면 개발자는 더 중요한 작업에 집중할 수 있다.

이번 내용은 zshrc 에 대한 설명 및 여러 CLI tool 들도 같이 소개 할 예정이다. ( 진짜 매우매우 유용한게 많다! )

> 나는 zsh + oh my zsh + Warp Terminal 를 사용해서 홈 디렉토리의 zsh 폴더에서 설정을 했다.
> 크게 설정이 달라지지 않으니 적절히 참고하면 될 거 같다.

zsh, oh my zsh 설치 및 소개에 대한 내용은 다른 블로그들에도 잘 되어있으므로 생략한다! 🫡

[.bashrc와 .zshrc를 활용한 터미널 환경 최적화 완벽 가이드](https://notavoid.tistory.com/161)
[My .zshrc Zsh Configuration, Annotated](https://olets.dev/posts/my-zshrc-zsh-configuration-annotated/)
[Zsh 및 oh my zsh 설치](https://blackinkgj.github.io/zsh-installation/)
등을 참고하면 좋을거 같다.

## zshrc

zsh + rc ( run command ) 로
터미널이 시작될 때마다 자동으로 실행되는 설정 파일이다.
일반적으로 우리 홈 디렉토리에 `.zshrc` 형태로 존재할 것이다.

우리는 해당 파일에 `환경 변수`, `Alias`, `함수`, `setopt`를 정의할 수 있다.

```sh
export PATH="$HOME/bin:$PATH"
export GEMINI_API_KEY={API_KEY}

alias obsidian='cd /Users/iyeongsu/Desktop/obsidian'
alias blog='cd ~/Documents/GitHub/blog/'

alias g='gemini'

function my-server() {
    sshpass -p 'password' ssh iyeongsu@192.168.112.24
}

bindkey -s '^h' 'history\n'

setopt CORRECT

setopt AUTO_CD
setopt AUTO_PUSHD
setopt PUSHD_MINUS
setopt PUSHD_SILENT
```

###  export

우리는 명령어를 사용할 때 가끔씩 ENV 에 특정 값을 설정해줘야 할 필요가 있다.
(GEMINI-CLI 를 사용하려 할 때, ENV 에 있는 GEMINI_API_KEY 를 사용한다던가)

이런 환경변수들을 통해 외부에 노출하지 않고, 중요한 값들을 설정해서 사용할 수 있다.

하지만, 매번 특정 터미널에서 `export GEMINI_API_KEY={API_KEY}` 를 입력하고 실행하는 것은 매우 불편할 것이다.
`export` 를 zshrc 에 넣으면 우리는 환경 변수를 매번 기억하거나 입력할 필요 없이, 칠 필요 없이 사용할 수 있다.

### alias

이는 의미 그대로 별칭이다.
alias 를 사용하면 긴 명령어를 짧게 줄일 수 있어서 편리하다.

`cd ~/Documents/GitHub/blog/` -> `blog`
`gemini` -> `g`

와 같이 간편하게 사용 가능하다.

### function

우리의 귀찮은 작업들을 간편하게 해주는 포인트
alias 만으로는 한계가 발생한다.

예를 들어?
`폴더를 선택하고 -> 거기서 추가적인 작업을 하고 싶다던가`
`AWS Log 를 바로 가져와서 파일에 저장하게 한다던가`

등등
이런 복잡한 요소들을 함수로 작성할 수 있다. (함수 예시에 대해선 다음 게시물에서 다룰 예정이다!)

### key binds

키보드 단축키를 zsh 에 매핑한다.
`bindkey -s '^h' 'history\n'` 는 Ctrl + h 를 누르면, history 라는 명령어를 실행하도록 매핑 한다는 의미이다.

키 바인딩을 통해 자주 사용하는 명령어를 단축키로 실행해 작업 속도를 높일수도 있다.

>키보드 단축키를 좋아하는 사람이라면, 괜찮을거 같다...?
나는 별칭으로 짧게 줄이고 직접 치는게 더 익숙한 거 같아서 주로 그렇게 사용한다.

### setopt

zsh 에서 제공해주는 일종의 세팅이다.
zsh 의 다양한 기능을 켜고,끄게 해준다.

- setopt ... : 특정 옵션 켜는 역할
- unsetopt ... : 특정 옵션 끄는 역할

[Options](https://zsh.sourceforge.io/Doc/Release/Options.html)

다양한 옵션이 있으니 참고하면 좋을거 같다.
예시로,

```
# 명령어에 오타가 있을 경우, 실행 전에 수정 제안을 보여줌
# 예: gti -> git? [y,n,a,e]
setopt CORRECT

# 'cd' 명령어 없이 디렉토리 경로만 입력해도 해당 디렉토리로 이동
# 예: /etc 입력 후 엔터 시 /etc로 이동
setopt AUTO_CD
```

와 같은 옵션들이 있다.

### source

위의 요소들을 모두 추가하면 하나의 zshrc 파일이 1000 라인씩 넘어가서 관리가 어려울 수 있다.
그때, 각 기능별 또는 설정등으로 파일을 분리해서 관리할 수 있다.

```sh
# ~/.zshrc
# This file loads shell configuration from files in ~/.config/zsh and ~/.config/zsh/functions

# Define colors for output
C_YELLOW='\033[1;33m'
C_CYAN='\033[0;36m'
C_RESET='\033[0m'

echo -e "${C_YELLOW}--- Loading Zsh configuration ---${C_RESET}"

# Source configuration files
for config_file in "$HOME/.config/zsh/"*.zsh; do
  if [ -f "$config_file" ]; then
    echo -e "  -> Sourcing ${C_CYAN}$(basename "$config_file")${C_RESET}"
    source "$config_file"
  fi
done

# Source function files
if [ -d "$HOME/.config/zsh/functions" ]; then
    echo -e "${C_YELLOW}--- Loading Zsh functions ---${C_RESET}"
    for function_file in "$HOME/.config/zsh/functions/"*.zsh; do
      if [ -f "$function_file" ]; then
        echo -e "  -> Sourcing ${C_CYAN}$(basename "$function_file")${C_RESET}"
        source "$function_file"
      fi
    done
fi

# Unset loop variables and colors
unset config_file function_file C_YELLOW C_CYAN C_RESET
echo -e "${C_YELLOW}--- Zsh configuration loaded ---${C_RESET}"
```

폴더에 있는 요소들을 가져와서 zsh 에 로드해준다.

![](https://i.imgur.com/dx47ziy.png)

> 위 C_YELLOW, C_CYAN 등은 가독성 좋게 하기 위해 색깔 지정

## 추천하는 CLI Tool

> 해당 내용은 백엔드 개발자 위주이나, 충분히 다른 개발자들에게도 유용할 거 같다...?
>  p.s 정리하고 보니, 왜이렇게 많지..

아래 있는 요소들에 대한 간략적 목록

```
* 파일 시스템 탐색 및 조회: eza, fd, bat, glow
* 텍스트 검색 및 처리: rg
* 네트워크 및 API 테스트: httpie, httpyac
* 개발 및 인프라 관리: gh, git-delta, jira-cli, aws-cli, lazydocker
* 편집기: neovim & lazyvim, btop
```

간단한 요소부터 시작해보자.
### tldr

가끔씩 manual 을 통해 명령어 help 를 보려고 하면 너무 복잡할 때가 있다.
tldr 은 바로 사용할 수 있는 간단한 명령어 샘플들을 모아서 보여준다.

![](https://i.imgur.com/HCfZ3Fy.png)

꽤나 많은 명령어들에 대해 제공해줘서 유용하게 사용 가능하다.

![](https://i.imgur.com/xOsDdzf.png)

없다면,

```
This page doesn't exist yet!
Submit new pages here: https://github.com/tldr-pages/tldr
```

와 같이 오픈소스에 기여할 수 있다!

### eza

기존 ls 를 대체해준다.

![](https://i.imgur.com/zWB6OuI.png)

(왼쪽이 eza, 오른쪽이 ls)

색깔을 추가해주고, 사람이 읽기 쉬운 용량으로 해주는 등 편한점들을 제공해준다.
rust 로 작성되어 있어 빠른것도 장점이다.

- eza -lT -L 2 : 디렉토리를 트리 형태로 보여준다. ( 폴더 내부 파일들을 보여줌, `-L 2` : 깊이 2까지 탐색 )
- eza -l -r -s size : 파일 크기가 큰 순으로 보여준다.

```
(choices: name, Name, size, extension, Extension, modified, changed, accessed, created, inode, type, none)
```

와 같이 선택 가능하다.

### fd

기존 find 를 대체해준다. 병렬 처리를 통해 기존 find 보다 더 빠르다.
추가로, `.gitignore` 파일을 존중해서 기본적으로 제외한 채 검색해준다. ( -H, -I 를 통해 hideen, ignore 파일도 포함해 검색 )

- fd txt : txt 확장자인 파일들을 검색한다
- fd "^2024" : 2024 로 시작하는 문자열이 있는 파일을 검색한다
- fd "spring" -x bat : 검색한 요소들에 대해 명령어를 실행한다

정규식으로 파일을 검색할 때, 불필요한 옵션들이 필요 없는게 가장 큰 장점이다.

### rg (ripgrep)

grep 을 대체한다. grep 보다 더 빠르고, 편의적 기능을 제공한다.
추가로, fd 와 동일하게 `.gitignore` 를 존중한다.

- rg -l "import" -t js : js 파일중 import 를 포함한 파일명 검색
  (`find . -name "*.js" -print0 | xargs -0 grep -n "import"` : 기존은 상당히 복잡하다)

- `rg "my_function"` : 현재 디렉토리에 재귀적으로 검색
  (`grep -r -n --color=auto "my_function" .` : rg 는 기본적으로 재귀 + line number 를 제공한다)

### bat

cat 을 대체한다.
단순히 파일 내용을 보여주는게 아닌, 코드 포맷 및 줄 번호등을 포함해 보여준다.

![](https://i.imgur.com/q52fNLJ.png)

- bat -p : line number 를 없애고, 평면으로 보여준다

터미널에서 가끔씩 조회할 때도 IDE 와 유사하게 보여줘서 좋다.

### glow

마크다운을 포맷팅해서 보여준다.
물론, 이미지 등은 보여주지 않지만 bat 과 유사하게 하이라이팅을 통해 가독성이 좋아진다.

![](https://i.imgur.com/MdaV8Bh.png)

- `glow github.com/eza-community/eza` :  github 의 README.md 를 가져와서 조회
- `glow https://example.com/file.md` : 특정 URL 에 있는 md 조회

### httpie

커맨드 라인 형식의 HTTP Client 이다.
기존 curl, wget 을 대체해준다.

직관적인 문법, 출력 포맷팅 및 지정, 추가 기능들(인증, 세션, 리다이렉트 등등등) 의 장점이 있다.

- `http -f POST https://example.com/upload cv@/path/to/my_resume.pdf` : POST 형식 + 경로 + cv 라는 필드에 팡리 지정해서 요청
- `http -p HhBb :3000/data` :  GET 형식 + Request 의 Header, Body + Response 의 Hedaer, Body 만 출력

![](https://i.imgur.com/x9GRvjO.png)

JSON 도 이쁘게 출력해준다.

처음의 러닝커브는 존재하나, 적응하면 기존 curl 및 wget 보다 더 명확하게 & 다양하게 요청할 수 있다.

### httpyac

`.http` 파일을 CLI 에서 실행하게 해준다.

```http
POST http://localhost:8100/oauth2/api/accounts/login  
Content-Type:application/json  
Accept:application/json  
  
{  
  "username": "yslee",  
  "password": "password!"
}
```

다른 프로토콜도 물론 지원해준다. ( gRPC, graphQL ... )

- httpyac send -a : http file 에 있는 모든 요청을 순차적으로 보냄
- httpyac send --junit : Junit 테스트 형식으로 포맷팅해서 출력
- httpyac send auth.http -n login --json | jq -r '.response.body.accessToken' : -n 으로 login 지정 + json 형식으로 출력 + jq 로 필요한 부분만 출력

```sh
# 1. 로그인 요청을 보내고, --json 옵션으로 결과를 JSON으로 받음
# jq를 사용해 응답 body에서 accessToken 값을 추출
echo "Attempting to log in..."
ACCESS_TOKEN=$(httpyac send auth.http -n login --json | jq -r '.response.body.accessToken')

if [ -z "$ACCESS_TOKEN" ]; then
 echo "❌ Failed to get access token."
 exit 1
fi

echo "🔑 Login successful. Token acquired."

# 2. 추출한 토큰을 --var 옵션으로 다음 요청에 전달
echo "Fetching private data with the token..."
httpyac send data.http -n getMyData --var token="$ACCESS_TOKEN"
```

이런식의 스크립트로도 처리 가능하다!
대부분의 서버는 인증 후, 무언가 처리를 해야할 텐데 이와 같은 코드를 통해
인증 후 다양한 로직에 요청을 저장해서 여러번 보내게 + 관리하기 용이하게 해준다.

> httpie 는 모던 자바처럼 http 요청을 우아하게, httpyac 는 http 파일을 기반으로 요청을 체계적으로 관리하게 해준다.

### gh

Github 공식 CLI
터미널에서 Github 의 모든 기능을 관리하게 해준다. - 레포지토리, 이슈, PR, 워크플로우 등등등

사실 옵션들이 너무 다양해서 이건 직접 요소들을 살펴봐야 의미가 있다..
추가적인 장점으론 workflow 가 머지 되기 전에도 실행할 수 있다. ( workflow 가 머지 전에는 github 페이지에는 표시되지 않음 )

#### git-delta

git show, git diff, git log 명령어들에 포맷팅을 적용하게 해준다.

![700](https://i.imgur.com/8kp9TcD.png)

```
[core]
	pager = delta
[interactive]
	diffFilter = delta --color-only
[delta]
	navigate = true
	side-by-side = true
    line-numbers = true
    navigate = true  # less 사용 시 n/N 키로 파일 간 이동 활성화
    keep-plus-minus-markers = true # +/- 기호 유지

[merge]
	conflictStyle = zdiff3
```

`.gitconfig` 에 추가로, 옵션들을 설정해줘야 동작한다.

### jira-cli

jira 를 CLI 에서 사용 가능하게 해준다.
보드, 스프린트 조회 및 이슈 목록 및 조회 등등

- jira open {issue} : 이슈를 웹 브라우저로 연다
- jira issue view {issue} : 이슈를 가져와서 터미널에 보여준다

jira-cli 는 기능이 다양하기 보단, 터미널에서 추가적인 작업을 가능하게 해주는 의의가 있다.

### aws-cli

aws 의 대부분 기능들을 CLI 에서 할 수 있게 해준다.

s3 파일 다운로드, ec2 조회, ec2 조회, dynamodb, cloudwatch 등 안되는건 없다.

- `aws ec2 describe-instances --filters "Name=tag:Name,Values=*Value*" "Name=instance-state-name,Values=running"` :
  `*Value*` 라는 name 을 가지고 + ec2 의 상태를 running 인 ec2 의 상태를 조회

- `aws s3 cp "s3://$bucket/$object_key" "./$filename"` : s3 에 있는 파일을 로컬 폴더에 복사

- `aws logs filter-log-events --log-group-name "$log_group" --start-time "$start_time" --end-time "$end_time"` :
  log group 이름에 맞는 + 시작 시간부터, 종료 시간까지 로그를 조회

### lazydocker

docker 를 정말 CLI 로 행복하게 관리하게 해준다.

![700](https://i.imgur.com/2KoHQPs.png)

일반적으로 rancher desktop 이나 docker desktop 은 보기에는 편해도 관리하는게 다소 어려운 점이 있는데
x 를 입력하면 제공해주는 메뉴들 덕분에 관리가 용이하다.

![](https://i.imgur.com/m7MjJIL.png)

키보드로 remove, restart 등등등 모든것들이 가능하다.
해당 CLI tool 은 정말 강추한다! ⭐

### neovim & lazyvim

사실, vim 으로 작업을 하는걸 그렇게 까지 좋아하지 않지만?
vscode 나 idea 를 키거나 하는게 귀찮을 때도 있고 + 터미널로 관리를 해야 할 때가 있다.

그럴때도, 이 neovim 을 사용하면 거의 IDE 와 동일하게 작업 할 수 있다.

2014 년 Vim 에서 포크되고, 기존 VIM 에 비해 Lua Script + 내장 LSP + 비동기 등등 무조건 더 좋은 장점들이 존재한다.

근데, neovim 은 단순히 설치하면 세팅 및 플러그인 등등을 처음부터 끝까지 해야 한다.
lazyvim 을 사용하면, 기본적인 세팅 및 추가적으로 유용한 기능들을 제공해준다.

![700](https://i.imgur.com/m5vSdX6.png)

파일 검색, 최근 파일, 프로젝트 등등 그리고

![700](https://i.imgur.com/hvE4FkK.png)

플러그인도 자동으로 관리해준다.

![700](https://i.imgur.com/COQkiSe.png)

기본 세팅하면 보이는 뷰, 기본 세팅으로도 충분한듯 싶다...?

### btop

![](https://i.imgur.com/vX33bBW.png)

기존 htop, top 을 더욱 깔끔하게 보여준다.
기존에 유용하게 봤다면, 이거 역시도 유용할 거 같다?

## fzf ⭐️⭐️⭐️

이 fzf 는 따로 상위로 분류한다.
그만큼, 이 fzf 를 통해서 사용자 UX 가 엄청 향상할 수 있다.

[깃허브 링크](https://github.com/junegunn/fzf)

`A command-line fuzzy finder` 로 정확히 검색 안해도 대략 비슷한 패턴을 찾아서 검색 하게 해준다.

- xargs 를 통해 fzf 에서 입력받은 걸 기반으로 추가 작업
- preview 를 통해 다른 요소들을 미리 보여줌

와 같은 기능들을 하게 해준다.

간단한 예시로 우리가 `git stash` 를 통해 파일들을 관리할 때

![](https://i.imgur.com/cgkh1B5.png)

`list` 를 통해 조회하면 제목을 통해서 파악 해야해서 한번씩 어려움을 겪는다.

```sh
function gs() {
    local selected_stash
    selected_stash=$(git log -g refs/stash --pretty=format:'%gd%x09%ci%x09%an%x09%s' \
        | fzf --reverse --prompt="Select Stash > " --header="ID | Date | Author | Message" \
               --preview="git stash show -p {1} | bat --color=always --paging=never")

    if [[ -n "$selected_stash" ]]; then
        local stash_id
        stash_id=$(echo "$selected_stash" | awk '{print $1}')
        echo
        read -k1 "action? (a)pply, (p)op, (d)rop, or (c)ancel? "
        echo
        case "$action" in
            a|A) git stash apply "$stash_id" ;;
            p|P) git stash pop "$stash_id" ;;
            d|D) git stash drop "$stash_id" ;;
            *)   echo "Cancelled." ;;
        esac
    fi
}
```

와 같은 함수를 통해

![](https://i.imgur.com/Hae2zVL.png)

stash 를 관리할 수 있는데

- 검색어에 맞게 적절히 필터링 해서 보여준다 ( 매우 빠름, 지금은 너무 간단해서 티가 안남 )
- preview 를 통해 오른쪽에 미리 요소들을 보여준다
- 선택 하면, a,p,d 키를 통해 apply, pop, drop 등을 가능하다
와 같이 기존에서 훨씬 업그레이드 된 방법으로 관리할 수 있다.

이렇게 fzf 를 통해 쉽게 검색하고 관리해, 복잡한 작업을 더 간편하게 수행할 수 있게 해준다.

- `fzf --reverse` : 목록 순서를 뒤집어서 표시
- `fzf --query="youngsu5582"` : 검색창에 미리 입력될 초기 검색어
- `fzf --preview=git stash show -p {1} | bat --color=always` :
  현재 선택된 항목에 대한 미리보기 제공, 지금은 선택된 커밋을 show 로 보여주고 -> bat 을 통해 이쁘게 보여주게 설정


이 fzf 를 통해 어떻게 관리를 할 수 있는지에 대해선 다음 게시글에서 다뤄보자 🙂
