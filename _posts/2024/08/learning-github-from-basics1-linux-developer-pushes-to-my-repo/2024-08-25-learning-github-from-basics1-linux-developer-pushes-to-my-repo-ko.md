---
title: "깃허브 기초부터 학습하기(1) - 리눅스 개발자가 내 레포에 푸시를?"
author: 이영수
date: 2024-08-25T06:58:18.868Z
tags: ['git', '깃', '깃허브', '우테코']
categories: ['깃허브']
description: 깃허브 커밋은 어떻게 될까
image:
  path: https://velog.velcdn.com/images/dragonsu/post/5d4d7bf9-586f-4b6e-8b4b-35082b7b08dd/image.png
lang: ko
permalink: /posts/learning-github-from-basics1-linux-developer-pushes-to-my-repo/
---
해당 내용들은 프로그래머스 블로그에 되게 좋은 글들이 있어서 이 내용들과 내 호기심들을 기반으로 정리한 것이다.
- [왕초보를 위한 Git 명령어 모음집 (1)](https://prgms.tistory.com/220)
- [왕초보를 위한 Git 명령어 모음집 (2)](https://prgms.tistory.com/221)
- [Git, GitHub 명령어 사용 꿀팁](https://prgms.tistory.com/217)

정리한 이유는 
프로젝트에서도 깃허브를 사용하고, 개발자는 깃허브를 사용할 수 밖에 없는데
원리도 제대로 모르고 + 명령어나 기능들도 잘 모르고 무지성으로 사용하는 거 같아서이다.

## 처음부터 시작하기

### 설정 파일

Git 은 설정 파일을 범위별로 설정 가능하다.

- system : 시스템 전체 설정 파일 - `/etc/gitconfig` 지정 가능
- global : 현재 사용자 ( 쉘에 접속한 사용자 ) - `~/.gitconfig` 지정 가능
- local : 현재 작업중인 저장소 - `.git/config` 지정 가능

해당 설정들은 system -> global -> local 순으로 불러온다.
( 즉, local 에서 오버라이딩한 설정이 있으면 local 을 기준으로 적용 )

그러면, 이제 커밋을 하기 전 `user.name`, `user.email` 을 설정해야 한다. ( 오래전에 해서 까먹었을 수도 )

```
git config --local user.name pobi
git config --local user.email pobi@gmail.com
```

근데, 이렇게 내 이메일이나 이름이 아닌 값으로 설정을 하면 어떻게 될까?

![](https://i.imgur.com/xvsSHfY.png)

이렇게, 온전히 Push 가 동작이 된다.

![200](https://i.imgur.com/eOvRD0n.png)

왜일까?
깃에서 설정하는 name 과 email 은 단순히, 커밋을 누가 했는지에 대한 서명일 뿐이다. 인증을 위한게 아니다.

그렇기에, Push 를 하면 해당 이름과 이메일을 통해 올라가게 된다.

![](https://i.imgur.com/xxgzvqc.png)

당연히, 유명한 사람(위는 리눅스의 창시자)이 올린것처럼 위장도 가능

그러면, 누가 나를 사칭하거나 유명인을 사칭하는 것도 가능한 거 아닌가 생각할 수 있다.
( 물론, 원격 저장소에 Push 를 할 때는 SSH 이나 PAT 을 기반으로 동작한다. )

이런, 불확실성을 해결하기 위해서 깃허브는 GPG 라는게 존재한다.
### GPG

GPG 은 GNU Privacy Guard 의 약자이다.
맥을 기준으로
```
brew install gnupg
```
으로 설치한다.

공개키 - 암호화 키를 통해 데이터 기밀성&무결성&인증을 보장한다.
그리고 OpenPGP ( 공개 키 암호화 위한 표준 ) 을 따른다.

```
gpg --full-generate-key
```
를 통해, 키를 생성을 시작하면

```
Please select what kind of key you want:
   (1) RSA and RSA
   (2) DSA and Elgamal
   (3) DSA (sign only)
   (4) RSA (sign only)
   (9) ECC (sign and encrypt) *default*
  (10) ECC (sign only)
  (14) Existing key from card
```
와 같이 암호화 방식을 묻고

```
RSA keys may be between 1024 and 4096 bits long.
What keysize do you want? (3072) 4096
Requested keysize is 4096 bits
```
키의 사이즈를 묻고

```
Real name: pobi
Email address: i894@naver.com
Comment: "Test Key"
You selected this USER-ID:
    "pobi ("Test Key") <i894@naver.com>"
```
실제 이름,이메일,커멘트를 유저 ID로 받는다.

```
public and secret key created and signed.

pub   rsa4096 2024-08-25 [SC]
      2C072860295ADFD4E2A50D725366C23D85105AF9
uid                      pobi ("Test Key") <i894@naver.com>
sub   rsa4096 2024-08-25 [E]
```
그러면, 이를 기반으로 키가 만들어진다.

이 키를
Settings -> SSH and GPG keys 에 들어가서
```
gpg --armor --export pobi
```
퍼블릭 키를 출력후, 복사해서 넣으면 된다. ( 이때, name,email,comment 뭐든 넣어서 export 가능하다. )

그 후
```
git commit -S
```
커밋할 때, `-S` 옵션을 통해 서명을 한다.
이때, 서명은 user.email 을 기반으로 자동으로 암호화 키를 가져와 서명한다.

그러면, 깃허브에는 서명된 커밋이 올라가게 된다!

---

여기까지 하면서 드는 생각으로
"어차피, 다른 사람 이름과 이메일로 만들어서 키를 등록하면 똑같은거 아닌가?" 라고 생각할 수 있다.
정상이다. 나도 그랬다.

하지만
![](https://i.imgur.com/bEjTkFF.png)
이와 같이 자신의 계정에서 인증한 이메일이 아니면 `Unverified` 가 뜬다.

![](https://i.imgur.com/83VfaZW.png)
이렇게, 내가 인증한 이메일에 대한 GPG Key 가 있을때만 인증이 된다.
### 결론

`Unverified` 와 아무 값이 없는 커밋은 신뢰되지 않은 커밋이다.
누가 악의적으로, 사칭을 하고 커밋을 할 수도 있는 것이다.

하지만, 이 모든걸 신뢰를 하지 않기엔 너무 귀찮겠지...?
프로젝트에서는 굳이, 의심 하지 않고 신뢰 기반으로 가도 괜찮을 거 같다.

```
git config --global commit.gpgSign true
```

자동으로 모든 커밋을 서명이 되게 하려면 해당 옵션을 키면 된다.
