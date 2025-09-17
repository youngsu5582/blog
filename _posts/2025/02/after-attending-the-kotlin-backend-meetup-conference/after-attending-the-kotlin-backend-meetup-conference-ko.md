---
title: "코틀린 백엔드 밋업 컨퍼런스를 다녀오고"
author: 이영수
date: 2025-02-23T09:37:58.651Z
tags: ['밋업', '백엔드', '컨퍼런스', '코틀린']
categories: ['백엔드', '코틀린']
description: "The Kotlin Backend Conference was the best. 👍"
permalink: /posts/after-attending-the-kotlin-backend-meetup-conference/
image:
image:
  path: https://velog.velcdn.com/images/dragonsu/post/1255cb9a-d5bb-4762-9ea1-394f170c7622/image.jpeg
permalink: /posts/after-attending-the-kotlin-backend-meetup-conference/
---
> 더 늦기전에 컨퍼런스를 갔다온 후기를 적는다.
> ( 방학숙제 🥲 )

![](https://i.imgur.com/csmVs8D.png)

킹갓 제이슨의 은헤로 감사하게도 초대장을 받아서 코틀린 백엔드 밋업을 다녀왔다.

사실, 코틀린을 본격적으로 시작한지는 얼마 안됐지만
조금만 학습하고, GPT의 도움을 받았는데

```kotlin
@Test  
fun `인증된 사용자가 아니면 결제 취소를 실패 한다`() {  
    DocsApiBuilder("cancel-failure-not-authenticated")  
        .setRequest("/api/cancel", HttpMethod.POST) {  
            headers {  
                "Authorization" type DocsFieldType.STRING value "Bearer notValidToken"  
            }  
            body {  
                "billId" type DocsFieldType.NUMBER means "구매했던 영수증 ID" value 2  
            }  
        }.setResponse {  
        }.execute(true)  
        .statusCode(401)  
}
```

스스로도 만족스러운 RestDocs DSL을([블로그 참조](https://velog.io/@dragonsu/%EC%BD%94%ED%8B%80%EB%A6%B0-DSL-%EC%9D%84-%ED%99%9C%EC%9A%A9%ED%95%B4-RestDocs-%ED%9A%A8%EC%9C%A8%EC%A0%81%EC%9C%BC%EB%A1%9C-%EA%B0%9C%EC%84%A0%ED%95%98%EA%B8%B0-ver-1.0)) 만들어서 코틀린에 대한 인사이트를 얻고 싶어서 신청을 했다.

## 발표 목차

![](https://i.imgur.com/ih6uInB.png)

발표 세션은 위와 같았고
몇몇 발표 자료는 https://github.com/Kotlin-User-Groups-Seoul/kotlin-backend-meetup-2025 해당 저장소에 있다.

나는, `Ktor Framework Starter`, `Glided Rose 리팩터링 챌린지`, `Kotlin TDD` 를 들었다.
아레에는 어떤 내용인지와 내용에 대한 정보를 가볍게 다루고 느낀점을 적는 형식으로 작성한다.

### Ktro Framework Starter

핸즈 온 랩 형식으로 직접 프로젝트를 클론해서 코드를 작성하는 식으로 발표가 진행이 되었다.

> https://github.com/lolmageap/ktor-practice
> 해당 깃허브를 기반으로 했으며
> Ktor 소개와 Spring과 비교, 로드맵과 브랜치마다 매우 잘 정의되어 있어 관심이 있다면 무조건 참고하면 좋을거 같다. 🙂

Ktor 는 JetBrains 에서 지원하는 Kotlin 기반 경량 프레임워크이다.
특징은 Plugin 형식으로 코드를 구성해나가는 형식이다.
그리고, 구성된 코드들을 다시 모듈로 재조립해서 서버를 실행시킨다.

```kotlin
fun Application.module() {  
    configureRouting()  
    configureDatabases()  
    configureFrameworks()  
    configureMonitoring()  
    configureSerialization()  
    configureException()  
    configureSwagger()  
}

fun main(args: Array<String>) {  
    io.ktor.server.netty.EngineMain.main(args)  
}
```

Module 을 설정하고 Netty Engiene 을 통해 서버를 실행한다.
자기가 붙이고 싶은 요소들을 계속 추가해나가는 식인거 같다.

#### DB 연결

DB 를 연결하고 싶다면?

> JPA 가 아닌, `Kotlin Exposed` 라는 Kotlin ORM 을 사용했다.

```kotlin
implementation("org.jetbrains.exposed:exposed-core:$exposed_version")  
implementation("org.jetbrains.exposed:exposed-jdbc:$exposed_version")  
implementation("org.jetbrains.exposed:exposed-java-time:$exposed_version")
```

```kotlin
fun Application.configureDatabases() {
	val dataSource = DataSource.of(environment.config)  
	val database = with(dataSource) {  
	    Database.connect(  
	        url = url,  
	        driver = driver,  
	        user = user,  
	        password = password  
	    )  
	}  
	  
	transaction {  
	    addLogger(StdOutSqlLogger)  
	    SchemaUtils.create(Users)  
	}  
	  
	  
	monitor.subscribe(ApplicationStopPreparing) {  
	    database.connector().close()  
	}
}
```

꽤나 오랜만에 보는 신선함이다.
`application.yml` 을 통한 설정 주입 + 자동 연결이 아니라 우리가 직접 이렇게 configure 를 해줘야 한다.
그리고, 종료될 때 역시도 `connector` 를 close 해줘야 한다.

- `SchemaUtils.create(Users)` : Users Entity 에 대해 유틸 생성

물론, 이는 JPA 가 아니라 Exposed 를 사용해서 이기도 하다.

#### 웹 요청과 응답

웹 요청과 응답은 Request 와 Response 를 다 가지고 있는 `call` 이라는 객체를 통해 들어온다.

```kotlin
route("/api/v1") {  
    post("/users", {
		val request = call.receive<CreateUserRequest>()  
		
		// 비즈니스 로직 처리
		newSuspendedTransaction {  
		    with(request) {  
		        userRepository.create(  
		            name = name,  
		            age = age,  
		            birthday = birthday  
		        )  
		    }  
		}  
		  
		call.respondText(status = HttpStatusCode.Created) { "성공" }
	}
}
```

요청을 DTO 로 받고, 비즈니스 로직을 처리하고 응답을 한다. ( Response 요소들은 생각보다 다양하다. )
`newSuspendedTransaction` 은 Exposed 에서 제공해주는 코루틴 환경에서 트랜잭션을 다루기 위한 함수이다.

DB 접근 시, 스레드 블로킹이 아닌 코루틴 통한 suspend 상태로 전환될 수 있게해서 비동기 I/O 로 처리가 가능하게 된다.

#### Dependency Injection

그리고, Dependency Injection 역시도 기본 제공이 아닌 플러그인 기능이다. ( 충격😮 )

```kotlin
implementation("io.insert-koin:koin-ktor:$koin_version")  
implementation("io.insert-koin:koin-logger-slf4j:$koin_version")
```

```kotlin
val userRepository by application.inject<UserRepository>()  
val userRepositoryV2 by application.inject<UserRepository>(named("second"))
```

이와같이 의존성 주입을 받고 사용이 가능하다.

#### 느낀점

일단, 경량인 만큼 애플리케이션 구동이 어마어마하게 빠르다.
`2025-02-23 15:54:07.752 [main] INFO  Application - Application started in 0.452 seconds.` - 1초도 안되서 서버가 구동이 됐다.

그리고, 대부분이 다 DSL 로 되어있어서 진짜 코틀린 스럽게 코드를 작성할 수 있는거 같다.
코틀린 ORM Exposed 랑 잘 결합되어 있는것도 장점이라면 장점
( Hibernate Reference 가 406 장이 되며, 너무 복잡해진 와중에 )

발표자분은 `경량 프레임워크` 를 사용해야 했고, `비동기 환경 병렬 처리` 가 되게 중요해서 사용했다고 한다.
( Spring JPA 는 너무 무거운 ORM + 서버당 최대 회원이 2천명으로 제한되어 있는데 스프링처럼 무거운걸 쓰기엔 비용적인 측면이 컸다고 한다. )

카카오페이에서도 이번에 Ktro 도입을 시도해보려고 하는 것 같다.
[# Ktor로 팀 환경에 맞는 API 서버 구현하기](https://tech.kakaopay.com/post/ktor-api-server/)

여기서도 마무리 글을 보면

```
Ktor로 개발해도 팀의 개발 스펙을 모두 충족할 수 있다는 확신이 들었습니다.
물론 아직 생태계가 성숙되지 않았고 참고자료도 부족하기 때문에 많은 시행착오가 있을 것이라 생각합니다. 
따라서 팀 내에서 중요도가 낮은 신규 모듈이 필요할 때 팀원들에게 Ktor를 적극 추천할 생각입니다. 
그리고 Ktor의 안정성을 확인한 이후에는 운영되고 있는 서비스의 일부 기능을 Ktor로 전환해보고자 합니다.
```

언젠가는 가볍게 접근하거나 사용할 수 있을거 같다.

### Glided Rose 리팩토링 챌린지

https://github.com/emilybache/GildedRose-Refactoring-Kata

한국어로, 황금 장미 여관으로 기존 코드에서 리팩토링을 하는 챌린지이다.
매우 다양한 언어 ( 심지어는 Cobol, Perl 등도 존재 ) 로 진행을 할 수 있다.

```kotlin
package com.gildedrose

class GildedRose(var items: List<Item>) {

    fun updateQuality() {
        for (i in items.indices) {
            if (items[i].name != "Aged Brie" && items[i].name != "Backstage passes to a TAFKAL80ETC concert") {
                if (items[i].quality > 0) {
                    if (items[i].name != "Sulfuras, Hand of Ragnaros") {
                        items[i].quality = items[i].quality - 1
                    }
                }
            } else {
                if (items[i].quality < 50) {
                    items[i].quality = items[i].quality + 1

                    if (items[i].name == "Backstage passes to a TAFKAL80ETC concert") {
                        if (items[i].sellIn < 11) {
                            if (items[i].quality < 50) {
                                items[i].quality = items[i].quality + 1
                            }
                        }

                        if (items[i].sellIn < 6) {
                            if (items[i].quality < 50) {
                                items[i].quality = items[i].quality + 1
                            }
                        }
                    }
                }
            }

            if (items[i].name != "Sulfuras, Hand of Ragnaros") {
                items[i].sellIn = items[i].sellIn - 1
            }

            if (items[i].sellIn < 0) {
                if (items[i].name != "Aged Brie") {
                    if (items[i].name != "Backstage passes to a TAFKAL80ETC concert") {
                        if (items[i].quality > 0) {
                            if (items[i].name != "Sulfuras, Hand of Ragnaros") {
                                items[i].quality = items[i].quality - 1
                            }
                        }
                    } else {
                        items[i].quality = items[i].quality - items[i].quality
                    }
                } else {
                    if (items[i].quality < 50) {
                        items[i].quality = items[i].quality + 1
                    }
                }
            }
        }
    }

}
```

리팩토링을 해야 하는 이유는, 특정 ITEM 인지 따라 분기 처리가 이상하게 되어 있다.

이번에도 핸즈 온 랩 형식으로 진행됐다.
그리고, 너무 빠르고 말로 해줘서 여기에 완벽하게 나타내지를 못하겠다.. 🥲

제이슨은 이 발표를 진행한 이유가 `단축키를 학습해보고 싶어서` 였다.

그리고, 위와 같은 팁을 줬다.

- 1만 시간을 명심해라 ( 컴포트 존을 벗어나고, 명확하고 구체적인 목표하에 집중과 피드백 )
- 코드 처음부터 다시 작성하기보다 작은 단계 밟고, 자주 테스트 실행해 점진적 디자인 개선 연습
- 리팩토링이란 결국 INPUT과 OUTPUT 이 고정된 상태에서 내부만 변화를 시키는 것 - 제이슨은 이를 위해 기존 로직에 대한 인수 테스트 전부 구현했다고 한다
### Lint

https://github.com/JLLeitschuh/ktlint-gradle

우선 Lint 를 통해 스타일 규격을 정리하고 시작한다고 했다.

설치해서 `./gradlew ktlintFormat` 를 통해 실 행한다.
근데, 이 부분도 
- `Ctrl + Ctrl` : Gradle Task 바로 실행 가능
와 같은 명령어가 있다.

### Refactor

> 이 부분은 너무 빨라서 대략적인 흐름만 남긴다.

그 후에는 `Ctrl + G`로 똑같은거를 선택되게 해서 반복적인 코드를 수정한다.

그리고, 확장 함수를 통해 객체가 스스로 역할을 가지게 했다.
-> 가독성 향상, 차후 내부 함수로 이동하기에도 용이

If 문 앞에서 `Alt + Enter` 하면, 생각보다 다양한 기능들을 제안해준다.

- invert : 순서를 바꿔준다.

```kotlin
// Before
if (items[i].sellIn < 0) {
	...
}else{

}

// After
if (items[i].sellIn < 0) {
```

- split : 조건문 `&&` 를 분리해준다.

```kotlin
// Before
if (items[i].name != "Aged Brie" && items[i].name != "Backstage passes to a TAFKAL80ETC concert") {

// After
if (items[i].name != "Aged Brie") {  
    if (items[i].name != "Backstage passes to a TAFKAL80ETC concert") {
```

코틀린은 조건이 2개 이상이라면? -> `when` 절로 바꾸라고 한다.

의도적으로

```kotlin
quality -= 0
```

와 같은 코드를 넣은곳이 있었는데 이 역시도 IDEA 가 비슷한 패턴으로 파악해 when 절 간결화를 해준다.

```kotlin
private fun Item.updateQuantity(change:Int){
	if(quantiy<50) quantity+=change
}
```

```kotlin
updateQuantity(
	when(name){
		...
		...
	}
)
```

Lift Function 을 통해 좀 더 깔끔하게 처리하자.

### 결론

> 결론이 너무 갑작스러운데, 이와 같이 반복하니 어느새 30줄 정도로 코드가 완성되어 있었다.

린트를 통해 간결화 -> 사람이 보기 좋게 간결화 -> 그 후 객체 분리 등 리팩토링이 진행되어야 한다.
일단 조건문을 SPLIT -> 그 후, FLIP - > REVERT 반복
최대한 안부터 원하는대로 변경해라.
그리고, 줄을 드래그 해서 초록색 ( 이와 유사한 코드 ) 가 많은지도 찾자.

![](https://i.imgur.com/JWtng7x.png)

사실, `어떻게 객체를 분리하고 코드를 수정할까?` 에 대해 생각했는데
그것보다 더 우선적인게 `직관적인 코드` 를 만드는 것이였다.

객체지향도 우선 보기 좋은 코드에서부터 시작이 된다는 걸 느꼈다.

### Kotlin TDD

해당 내용은 정말 우테코에서 들은 TDD 강의와 유사했다.

숫자 야구 게임을 페어와 페어 프로그래밍으로 구현하는 형식이였다.
오랜만에 잘 모르는 사람과 페어 프로그래밍을 하며 기술적인 얘기를 하니 매우 재밌었다.

현재 사이드 프로젝트를 하면서도 느낀점이지만 단위 테스트까지는 정말 쉽지만
서비스나 비즈니스 로직을 테스트를 하는것과 어디까지 얼마나 해야하는지는 어려운거 같다.

### 마무리

우테코 사람들이 꽤나 있었다.
모두한테 아는척은 못하고, 저번에 한번 본 적이 있는 5기 루카와 4기 스컬과 함께 밥을 먹고 돌아왔다.
( 밥 사주셔서 감사합니다.🙇‍♂️ )

컨퍼런스는 항상 재밌는거 같다.
도움이 되는 얘기도, 개발자들의 에너지도, 새로운 사람들을 만나는 것 까지. 다음에도 새로운 세미나에 가서 인사이트를 얻도록 노력해야겠다.

