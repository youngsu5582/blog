---
title: "ATDD 작성해보기"
author: 이영수
date: 2024-06-12T06:47:47.002Z
tags: ['TDD', 'atdd', '테스트', '우테코']
categories: ['프로그래밍', '테스트']
description: ATDD 에 대해 조금 더 들어가보기
image:
  path: https://velog.velcdn.com/images/dragonsu/post/11a2e334-be00-4187-8bce-2ac11acebef4/image.png
lang: ko
permalink: /posts/writing-atdd/
---
### 인수 테스트란?

해당 코드는 인수 테스트 일까?

```java
@Test  
@DisplayName("날짜,시간,테마가 똑같은 예약이 있다면 409를 반환한다.")  
void it_returns_409_with_duplicate_reservation_reservationTime_date_theme() {  
    final ThemeResponse themeResponse = 테마_생성();  
    final ReservationTimeResponse reservationTimeResponse = 예약_시간_생성();  
    예약_생성("2024-10-03", themeResponse.id(), reservationTimeResponse.id(), token);  
  
    final ReservationRequest request = new ReservationRequest(  
            "2024-10-03",  
            reservationTimeResponse.id(),  
            themeResponse.id()  
    );
  
    //@formatter:off  
    RestAssured.given().cookie(token).body(request).contentType(ContentType.JSON)  
            .when().post("/reservations")  
            .then().assertThat().statusCode(409);  
    //@formatter:on  
}
```

대부분의 사람들이 인수 테스트를 `단순히 웹을 통해 실제 요청을 보내고 검증하면 되는거 아니야?` 라고 생각하는 경우가 있었다.

하지만 해당 코드는 내가 생각하기에 완벽한 인수 테스트가 아니다. ( 반박시 내 말이 틀림 )
우선
1. 비개발자가 알아보기 어렵다. - 음 요청을 보내는 건 알겠어요,,, contentType 이 뭐고 409가 뭐죠...?
2. 통합 테스트로도 충분히 의도를 변환이 가능하다 - 서비스 들끼리 조합해서 에러를 검증하므로 확인 가능

그러면 내가 생각하는 인수 테스트라면?

```java
@Test  
void 동일한_이메일로_회원가입을_시도할_시_실패한다() {  
    회원가입(사용자_정보_생성(이름, 이메일, 비밀번호));  
  
    final var 결과 = 회원가입(사용자_정보_생성(이름, 이메일, 비밀번호));  
  
    잘못된_요청인지_검증(결과);  
}

========================================

@Test
void 운영자가_대기_취소를_할시_다음_예약자가_예약_상태가_된다() {  
    final var 첫번째_사용자_정보 = 이메일로_멤버_생성후_로그인("alphaka@gmail.com");  
    final var 예약_결과 = 예약_생성(날짜, 테마, 시간, 첫번째_사용자_정보);  
  
    final var 두번째_사용자_정보 = 이메일로_멤버_생성후_로그인("joyson5582@gmail.com");  
    final var 대기_결과 = 예약에_대한_대기_생성(예약_결과, 두번째_사용자_정보);  
  
    final var 세번째_사용자_정보 = 이메일로_멤버_생성후_로그인("brown@gmail.com");  
    예약에_대한_대기_생성(예약_결과, 세번째_사용자_정보);  
  
    final var 운영자_정보 = 운영자_로그인();  
    운영자가_대기_취소(운영자_정보, 대기_결과);  
  
    예약_취소(첫번째_사용자_정보, 예약_결과);  
  
    final var 결과 = 본인_예약_조회(세번째_사용자_정보);  
    내_예약중_예약_상태가_있는지_검증(결과);  
}
```

( 사실 final var 역시도 없어도 되나, 자바의 문제점... )
 
더 코드를 깎을 여지도 있고, 반박할 여지들도 충분히 존재한다. ( 저래도 모르는 건 똑같은 거 아니야? 통합 테스트로도 할 수 있는거 아니야? )

하지만, 내가 생각하는 인수 테스트는 이러하다.
그러면 인수 테스트가 뭔지에 대해 설명을 해보자면 

> `유비쿼터스 언어` 를 통해 비개발자가 봐도 요구사항이 충족된지, 충족이 안된지를 명확히 알 수 있는 테스트 라고 생각한다.

그러면 인수 테스트를 작성하기 전 유비쿼터스가 먼지, 어떻게 코드에 드러내야 하는지 알아보자.
### 유비쿼터스 언어

프로젝트 관계자 ( 개발자,비개발자 ) 모두 이해하는 공통 용어를 사용하자

예약을 생성하면 201을 반환한다? - ❌
예약이 존재하는데 시간을 삭제하면 예외를 발생한다? - ❌

예약 생성에 성공한다 - ✅
시간을 삭제하려 할 때, 해당 시간을 사용한 예약이 있으면 실패한다 - ✅

>200을 반환하든,201을 반환하든 상관 없는거야?
    -> 이는 개발자들끼리 논의할 일이지, 비개발자의 시선에서 전혀 중요하지 않다.
  기술적인 ( DB,Kafka,Infra 등등 ) 에 대한 내용이 하나도 없어도 되는거야?
    -> 예약을 생성,삭제 한다고 할 때 비개발자의 입장에서는 DB에 저장하든,애플리케이션 서버 자체 저장하든 중요한게 아니다.

코드가 어떻게 구현이 되어도 상관 없는거야?
-> 이 역시 위와 같이 정확하다. interface 를 만들어 가는 것이지, 구현체를 만들어 가는 과정이 아니다

그러면 인수 테스트를 작성 해나가는 방법에 대해서도 살펴보자.
#### with Given-When-Then ??

![500](https://i.imgur.com/ccsRjoS.png)

해당 내용은 브라운의 [우아한 ATDD](https://www.youtube.com/watch?v=ITVpmjM4mUE&t=4072s) 의 내용에 있는 사진이다.

이렇게 Given When Then 으로 나누는게 사실 가장 명확하다.

하지만 인수테스트의 특성상 구분 절들이 다소 애매해질 수 있다.
-> 그럴때는 자신이 처음 `@DisplayName` 에 쓴걸 When 으로 시작하자
( 그 전에는 Given, 그 후에는 Then! )

위의 내용에서는?
모집중인 유료 강의에 모집 마감이 되면 <span style="color:#00b0f0">대기 신청</span>을 할 수 있다.
When : 대기 신청
Given : 모집중 유료 강의, 유료 강의가 모집 마감
Then : 대기 등록된지 확인

하지만, 위의 방법은
다소, 테스트 코드의 처음 작성을 어렵게 할 수 있다.
( Given 을 어떻게 명시하지...? - When/Then 을 어떻게 검증 할까...? )

특히, 비개발자(PM,경영팀 등등)들이 어떤 값이 어떻게 들어오고 어떤 값을 반환할거고 설명이 가능할까?
이럴때 다른 접근 방식으로 인수 테스트를 접근해보자!
#### with Flow ??

> 예약 수동 플로우라면?
> 
	A가 예약을 했다
	B가 예약을 했다
	B가 예약 대기를 했다
	A가 예약 취소를 했다
	관리자가 예약 대기를 승인한다
		and B가 예약 상태가 된다.
	

일련의 플로우의 흐름도 가능하다
( 각 단계를 검증 할 수 있다면 더 좋음! - A가 올바르게 예약이 가능한지 + 각 순서가 타당한지 )

처음 시작할때도?

```java
void some{
	//A 가 예약을 생성한다.  
	
	//B 가 예약을 생성한다.

	//...
}
```

와 같이 플로우만 작성하고, 이를 구현해나가면 된다.

하지만, 다소 막막할 수 있다.
( A가 예약을 생성한다를 어떻게 시작하지...? )

그러면, ATDD를 좀더 물러서, 단계를 낮춰보자 ( 원래 ATDD 는 Bottom-Up 형식으로 쉬운 것부터 올라가야 한다. )

```java
void 예약_생성_플로우(){
	//운영자가 테마를 생성한다.

	//운영자가 예약 시간을 등록한다.

	//A가 예약을 생성한다.
}
```

하지만, 이 역시도 막막하다면?
( 운영자가 생기고, 테마가 생기고, 예약 시간이 생기고... 에궁,, )

그렇기에, TDD를 활용하자!
### ATDD With TDD

A는? -> 사용자! -> 도메인을 만들자 -> 도메인을 만들었으니 repository/service 를 만들자
운영자는? -> 똑같은 사용자! -> 도메인에서 역활을 추가하자 ...
예약,테마,예약 시간? -> `이와 동일...`

TDD가 더욱 잘게 쪼개서 기능을 구현하게 도와준다.

```java
@Test  
@DisplayName("이름,설명,섬네일을 통해 테마를 생성한다.")  
void create_domain_with_name_and_description_and_thumbnail() {  
    assertThatCode(() -> new Theme(  
            "레벨2 탈출", "우테코 레벨2를 탈출하는 내용입니다.",  
            new Thumbnail("https://i.pinimg.com/236x/6e/bc/46/6ebc461a94a49f9ea3b8bbe2204145d4.jpg")))  
            .doesNotThrowAnyException();  
}
```

```java
@Test  
@DisplayName("특정 테마에 대한 예약이 존재하면 예외를 발생한다.")  
void throw_exception_when_delete_id_that_exist_reservation() {  
    final Theme theme = themeRepository.save(ThemeFixture.getDomain());  
    final ReservationTime reservationTime = reservationTimeRepository.save(ReservationTimeFixture.getDomain());  
  
    final Member member = memberRepository.save(MemberFixture.getDomain());  
    final ReservationInfo reservationInfo = ReservationInfo.from("2024-04-30", reservationTime, theme);  
    reservationRepository.save(new Reservation(member,reservationInfo));  
  
    final var themeId = theme.getId();  
  
    assertThatThrownBy(() -> sut.deleteTheme(themeId))  
            .isInstanceOf(ExistReservationException.class);  
}
```

이렇게 구현을 해나가다
그 후 이들을 결합하여 `A가 예약을 생성한다` 라는 기능을 수행할 수 있을꺼 같으면? 이때 인수테스트를 완성 시켜나가자.
( 
### 마무리

인수 테스트가 사실 
개발자들끼리의 프로젝트에서 필요할까? 무조건 해야 한다!! 라는 느낌이 들지는 않는다. ( 통합 테스트로 모든걸 구현 가능 + 비개발자적 언어로 오히려 의도를 해칠 우려 가능 )

하지만
단위 테스트를 통해 작성할 시 귀찮아서 넘어가는 요소를( 예약을 하고, 운영자가 취소를 하고, 대기를 취소하고 어쩌거 저쩌고 플로우... ) 구현하는 점과
실제 통신을 통해 사용자의 플로우를 따라가므로 에러&허점이 있을 것이라는 불안을 줄일 수 있다? 라는 장점이 있다고는 생각이 든다.

특히, 브라운도 발표에서 말했듯이 인수 테스트 들이
신입 및 온보딩 기간에 이정표가 될 수 있다는 점은 매우 동의한다. 
( 단위 테스트는 난해함을 줌 -> 인수 테스트는 유비쿼터스 + 도메인을 이해하게 도와줌 )

