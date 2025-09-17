---
title: "Dockerfile 진짜 잘 써보기"
author: 이영수
date: 2024-07-24T12:38:37.980Z
tags: ['dockerfile', '도커', '우테코', '프로젝트']
categories: ['인프라', '도커']
description: 당신의 도커 파일 이대로 괜찮은가
image:
  path: https://velog.velcdn.com/images/dragonsu/post/a1396c78-9052-48df-8a52-fade878e5c71/image.png
lang: ko
permalink: /posts/how-to-write-a-good-dockerfile/
---
해당 내용은 도커파일을 통해 이미지를 만드는 방법중 실수 및 생각해볼만한 내용을 정리했다.
밑에서도 말하지만, 이는 내 의견으로 틀릴수도 생각이 다를수도 있다.
`joyson5582@gmail.com` 이나 댓글로 의견을 나타내면 제 의견을 좀 더 설명하겠습니다.

Dockerfile 은 내부 명령어들을 기반으로 
1. 이미지를 빌드
2. 빌드 된 이미지로 컨테이너를 생성
을 가능하게 해준다.

검색하면 이미 많은 블로그 내용이나 샘플 파일들이 있다.
이때 주의해야 할 부분들이 뭐가 있을까?

## 잘못된 도커파일이란?
### 타당한 예시 파일

```dockerfile
# Offical Image로 자바 베이스 설정  
FROM openjdk:17 
  
# 작업 경로 지정  
WORKDIR /app/backend  
  
# JAR 파일 위치 지정
ARG JAR_FILE=build/libs/*.jar  
COPY ${JAR_FILE} app.jar  
  
EXPOSE 8080  

ENTRYPOINT ["java", "-jar", "app.jar"]
```

현재 대부분의 Spring Dockerfile을 보면
해당 내용과 같이 작성이 되어 있다.

그러면, 왜 Dockerfile 에서 빌드를 하지 않는 걸까?
대부분의 Nest 나 React 프레임워크를 빌드하는 파일들은

```dockerfile
FROM node:20.5.0
  
WORKDIR /app

COPY package.json .

RUN npm install

COPY . .

RUN npx prisma generate dev

EXPOSE 8000

CMD ["npm", "run","start:dev"]
```

이와 같이
1. package.json 을 통해 라이브러리들을 설치
2. 파일들 복사
3. 서버 실행

과 같이 되어있다. ( 예전에 내가 작성한 도커파일 ... )
이를 스프링 버전의 도커파일로 변환해서 같이 설명하겠다.

### 잘못된 도커 파일

```dockerfile
FROM eclipse-temurin:17-jdk-jammy  
  
WORKDIR /app/backend  

# 라이브러리 설치
COPY gradlew .  
COPY gradle gradle  
COPY build.gradle .  
COPY settings.gradle .  

RUN ./gradlew dependencies --no-daemon  

# 파일들 복사
COPY ./src ./src  
  
RUN chmod +x ./gradlew  

RUN ./gradlew bootJar  
  
EXPOSE 8080  
  
ARG JAR_FILE=build/libs/*.jar  
COPY ${JAR_FILE} app.jar  

# 서버 실행
CMD ["java","-jar","app.jar"]
```

그러면 해당 내용들이 뭐가 잘못된것일까?

#### 의존성 설치

의존성 설치는 많은 시간과 위험성을 초래한다.
- 매번 의존성이 변경함에 따라 캐시를 하지 못해 배포 단계에서 중요하지 않은 의존성 설치에 시간 소요
- 의존성 구성 및 의존성 설치에 실패하면 배포가 Fail

>빌드의 일부를 외부에 존재가 제어하게 양도하면 할수록, 빌드가 실패했을 떄 손 쓸 수 없는 상황이 발생할 확률도 커진다. - 자바 개발자를 위한 데브옵스 툴

그렇기에, 외부에서 의존성 관리 & 의존성 설치를 하는것이 타당하다고 생각한다.

```
실제로는 의존성에 오류가 발생했는데
기존에 설치되어 있는 파일들 때문에 오류가 드러나지 않으면 어떻게 하죠?

내가 생각하기에 ( 물론 틀릴수 있음 )
Dockerfile의 존재 의의는 컨테이너에 원하는 프로그램을 빌드하는 것이다。
빌드할때 의존성이 문제가 있는지 / 없는지는 중요하지 않다。

그렇기에, 외부에서 의존성 관리를 해도 상관이 없다고 결론을 내린다。
```


#### 파일 복사

파일 복사는 매우 위험하다.
도커는 정말 수많은 레이어로 계층을 나눴다.
그리고, 이 레이어간 각자 파일 시스템을 가지고 있다.

내가 특정 레이어에서만 사용하고, 값을 삭제하면? 당연히 맨 마지막에는 그 값이 안보인다.

하지만, 누가 특정 레이어의 값에서 찾아내려고 하면 그 값은 보일 수 밖에 없다.
빌드 파일이 아니라면, 애초에 어떤 파일도 복사를 하지 않는게 가장 좋다.
( `COPY ./ ./` 은 당연히 죄악이다.)

즉, 의존성 설치와 마찬가지로 외부에서 하고 도커에 넣어주자.

![](https://velog.velcdn.com/images/dragonsu/post/560a75de-6ff3-4281-b43b-ee3a98212ab4/image.png)

( 의존성 설치와 파일 복사를 내부에서 한 것과 하지 않은 것의 크기 차이 )
( 파일 복사는 당장에는 크지 않을 수 있으나, 확장됨에 따라 필연적으로 늘어날 수 밖에 없는 요소 )

추가로, 이미지는 최대한 작게 구성을 해야 한다.
`<none>:<none>` 이나 `backend:latest` 와 같이 태그를 갱신다고 하면 모르겠으나 ( 해도 문제이다. )
태그를 버저닝(Versioning)에 사용하거나 여러 이미지들을 만든다면
이미지의 크기는 저장 공간에 지대한 부담을 주게 된다.

이 이미지 크기를 기반으로 컨테이너 크기에도 영향을 주기 때문에 신경을 쓰자

#### 불필요한 레이어

```dockerfile
COPY gradlew .  
COPY gradle gradle  
COPY build.gradle .  
COPY settings.gradle .  
```

이렇게 따로 있는게 더욱 깔끔하다고 생각할 수 있다.

각 명령어는 각각의 레이어를 생성한다.
레이어를 불필요하게 늘릴 필요가 없다.

```dockerfile
COPY gradlew gradle build.gradle settings.gradle ./
```

더러워 보일 순 있으나, 레이어 4개를 불필요하게 생성하는 것이 아닌 1개로 구성한다.

#### CMD 와 ENTRYPOINT 차이점 인지
```dockerfile
CMD ["java","-jar","app.jar"]
```
빌드가 실행은 된다.
하지만, ENTRYPOINT가 원칙이다.
- ENTRYPOINT : 컨테이너가 실행될 때 기본 명령어
- CMD : 기본적으로 실행되는 명령어, 인수 정의
- RUN : Docker 이미지를 빌드할 때 실행하는 명령어

CMD는 
ENTRYPOINT 가 없을 경우, 기본 실행 명령어 인수로 작동
ENTRYPOINT 가 있을 경우, 함께 사용할 기본 인수로 정의

## 타당한 도커파일 훑어보기

```dockerfile
ENTRYPOINT ["echo"]
CMD ["Hello, World!"]

-> echo "Hello, World! 실행
```

```dockerfile
# Offical Image로 자바 베이스 설정  
FROM openjdk:17 
  
# 작업 경로 지정  
WORKDIR /app/backend  
  
# JAR 파일 위치 지정
ARG JAR_FILE=build/libs/*.jar  
COPY ${JAR_FILE} app.jar  
  
EXPOSE 8080  

ENTRYPOINT ["java", "-jar", "app.jar"]
```

그렇기에, 이 도커파일은 꽤나 깔끔하고 잘 만들어진 도커파일이다.

조금 더, 깊게 들어가보자

### 취약성 파악 & From Image 결정하기

Docker Desktop 을 통해 레이어를 확인해보면 더욱 자세히 내용들을 알 수 있다.

위 Dockerfile은
`oraclelinux:8-slim` -> `openjdk:17, 17-jdk...` -> `내가 만든 이미지` 와 같은 계층을 가지고 있다.

그리고, 높은 취약성을 보여준다.

확인해보면?
대략적인 내용은 `네트워크를 통해 다양한 프로토콜로 접근할 수 있는 인증되지 않은 공격자가 이 취약점을 이용할 수 있습니다.`  ( By  GPT )
로 개발자로서 상당히 섬뜩한 말이다.

우리가 단순한 프로젝트나 도커를 구동용으로만 사용한다면 중요하지 않다.
하지만, 개발자라면 자신이 사용하는 파일에 관심을 가지고 신경을 써야만 하지 않을까?

JDK 17 버전용 Official Image는 다양하다.
( eclipse-temurin:17, amazoncorretto:17, zulu-openjdk:17 등등 )

https://hub.docker.com/_/amazoncorretto
https://hub.docker.com/r/azul/zulu-openjdk
https://hub.docker.com/_/openjdk ( deprecated )

각각의 공식 페이지를 들어가서 지원하는 태그들을 확인해서 적용해보자

나는, azul/zulu 가 취약점이 없기에 이를 사용하기로 <span style="color:#00b0f0">결정</span>했다.

### Inspect & Files 확인하기

이미지를 생성할 때는 Env 의 값을 환경변수에 설정하거나 application.yml 을 넣을 수 있다.
혹시나, 그렇다면 이 Docker Image 역시도 노출이 안되도록 매우 주의해야 한다.

![](https://velog.velcdn.com/images/dragonsu/post/b5024da3-7900-4a51-b686-fbfa2c3ea78d/image.png)

ENV 에 주입을 했더라도, 이렇게 Inspect 에는 모든 것이 드러난다.

![](https://velog.velcdn.com/images/dragonsu/post/0cd9f324-e905-4e2e-950b-b58d33085366/image.png)

자신이 실수로 넣은 파일이 있는지, 설정한 ENV 중 민감한 정보가 없는지 확인을 필수적이다.
( docker build -- secret 라는 옵션이 있다는데 아직 학습 하지 않음 )

### 마무리

> 나는, azul/zulu 가 취약점이 없기에 이를 사용하기로 결정했다.

이때 결정이란 말은 상당히 의미가 있다.
누군가는 취약점이 중요하지 않고, 빌드 속도나 이미지의 크기가 중요할 수 있다.
( 실제로, 아마존 alpine은 344 MB로 매우 적은 용량, zulu는 446 MB )

그렇기에, openjdk를 사용해도 상관없다.

하지만, 모르고 그냥 사용함과 <-> 알고 판단하여 결정하는 것은 상당히 큰 차이다.
항상 이유를 가지고, 기준을 만들어 결정을 하도록 하자.



