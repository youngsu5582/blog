---
title: "비즈니스 로직 vs 도메인 로직?"
author: 이영수
date: 2024-06-28T03:55:29.297Z
tags: ['도메인 로직', '비즈니스 로직', '애플리케이션 서비스 로직', '우테코']
categories: ['프로그래밍', '클린코드']
description: 꽤나 아리송하다.도메인 로직은 뭐고, 비즈니스 로직은 뭘까?도메인 로직은 간단한 도메인이 실행하는 로직, 비즈니스 로직은 서비스내 메소드 처럼 더 큰 로직 아니야?다른 사람들은 모르겠으나, 나는 이렇게 생각하고 있었다.그러면포인트를 계산해서 적립하는 코드는?달러 ->
image:
  path: https://velog.velcdn.com/images/dragonsu/post/cc07d2c7-7cf8-4533-ae40-058c6bdd4235/image.png
lang: ko
permalink: /posts/business-logic-vs-domain-logic/
---
꽤나 아리송하다.
도메인 로직은 뭐고, 비즈니스 로직은 뭘까?

`도메인 로직은 간단한 도메인이 실행하는 로직,` `비즈니스 로직은 서비스내 메소드 처럼 더 큰 로직 아니야?`

다른 사람들은 모르겠으나, 나는 이렇게 생각하고 있었다.

그러면

> 포인트를 계산해서 적립하는 코드는?

> 달러 -> 원화로 바꾸는 코드는?

아래는 자신있게 도메인 로직이라 할 수 있으나, 위는 뭔가 헷갈린다. 

```
적립할꺼면 DB에 저장도 하지 않나..? 그러면 서비스 로직인가? 
근데 또 계산과 적립은 포인트 - 사용자의 도메인 상호작용인데 도메인 로직인가..?
```

정답부터 말하면 비즈니스 로직과 도메인 로직은 같은 용어이다.

![](https://i.imgur.com/NpYR0Ps.png)

그리고, 애매함을 느끼는 이유는 도메인(비즈니스) 로직 - 애플리케이션 서비스 로직이 분리가 되어 있지 않아서이다.
애플리케이션 서비스 로직은 뭐지?
### 도메인 로직 in 소프트웨어 공학

> 해당 부분은 [개발 아키텍처에서 말하는 비즈니스 로직•도메인 로직 한 방에 이해하기](https://www.youtube.com/watch?v=gbzDG_2XQYk) 이 영상을 토대로 작성했다.

은행 앱에서 존재하는 도메인들을 생각해보면?
-> 이자율,잔액,출금,계좌 개설,계좌 해지 등이 도메인

틱톡의 도메인은?
-> 영상 편집,댓글 조회,공유 등이 도메인

- 코드가 현실 세상 문제에 대해 의사결정을 하고 있다면?
	-> <span style="color:#00b0f0">도메인 로직</span>
- DB 연결, 백엔드 서버 API 호출, 동영상 캐싱, 애니메이션 추가 같이 현실 세상 문제 외적으로 사용자의 의사결정을 도와 준다면? 
	-> <span style="color:#00b0f0">어플리케이션 서비스 로직</span> ( 도메인 로직 X )

예시를 들어보면
모바일 송금 앱에서 모바일 송금을 하는 케이스라면?

```
1. "계좌의 잔액"이 충분한지 확인
2. "송금 버튼 활성화", 유효하지 않으면 "에러 메시지" 띄움
3. 사용자 멤버쉽 등급에 맞는 "송금 수수료 계산"
4. 계산한 송금 수수료를 "결제하도록 외부 서비스에 요청"
5. 수수료와 송금액만큼 "사용자의 잔액을 감소"
6. 사용자의 잔액 "DB 저장"
```
#### 도메인 로직

1. 계좌 잔액 충분한지 확인
	-> 송금이 가능한지 대한 <span style="color:#00b050">의사결정</span>
3.  사용자의 멤버쉽 등급에 맞춰 송금 수수료를 계산
	-> 송금에 드는 비용을 수수료 정책이나 멤버십 정책에 따라 <span style="color:#00b050">결정하는것</span>
5. 수수료와 송금액만큼 사용자의 잔액을 감소시킨다.
	-> 송금후 잔액이 얼마인지 <span style="color:#00b050">계산</span> 
#### 애플리케이션 서비스 로직
2. "송금 버튼 활성화", 유효하지 않으면 "에러 메시지" 띄움
	-> UI 로직
4. 계산한 송금 수수료를 "결제하도록 외부 서비스에 요청"
	-> 외부 서비스와의 네트워킹
6. 사용자의 잔액 "DB 저장"
	-> 영속성 로직

---

### 도메인 로직,애플리케이션 서비스 로직의 분리

자 그러면, 다시 처음으로 돌아가서
`포인트를 계산해서 적립한다.` 를 분리해보자.

해당 내용은
```
1. 총 금액에서 사용자의 적립률을 통해 포인트를 계산한다.
2. 사용자의 포인트를 적립한다.
3. 사용자 변동 포인트를 DB에 반영한다.
```

되게 구체적이고, 길어진 것을 볼 수 있다.
1,2번은 도메인 로직 ( 포인트를 계산, 포인트를 적립 )
3번은 애플리케이션 로직 ( DB에 저장 )

그러면 좀더 복잡한 로직으로 인프런에서 새로운 강의를 결제할때 로직은?
( 너무 길어지므로, 예외 메시지 반환 UI 로직은 생략 )

```
0. 프론트에서 외부 서비스 결제(카카오페이,카드 결제등) 진행후, 
   `결제 내역(결제 ID) & 쿠폰 ID, 포인트 금액 & 강의 ID, 사용자 토큰`등을 서버로 전달한다.

1. "쿠폰"이 사용자에게 유효한지 확인
2. 사용자의 포인트가 "사용한 포인트" 보다 큰지 확인
3. 강의 금액에서 할인과 적용한 포인트를 적용한 금액 계산
4. 금액과 결제 금액이 같은지 외부 서비스에 내역 조회
5. 사용자의 포인트를 감소
6. 사용자의 등급에 따라 금액에 따른 포인트 계산 후, 적립
7. 결제 내역 DB 저장, 사용자 변동 포인트 DB 반영
8. 결제 요약 정보 프론트에 전달 & 렌더링
```

이때 비즈니스 로직은 1, 2, 3, 5, 6 번
요구사항을 위해 직접적인 의사결정을 하는 로직 ( 쿠폰 도메인이 사용자 도메인에게 적용되는지 확인, 사용자 도메인이 가지고 있는 포인트 금액 확인 등등 ) 

애플리케이션 서비스 로직은 4, 7, 8번
( 4번은 외부 서비스 네트워킹 로직, 7번은 영속성 로직, 8번은 UI 로직 )

### 왜 나눠야 할까?

그러면 애플리케이션 서비스 로직과 도메인 로직은 왜 나눠야 하는지 생각해보자.
#### 테스트 용이

애플리케이션 서비스 로직은 보면 느끼듯이 다 테스트가 어려운 것들이다.
( DB 로직, UI 로직, 외부 네트워크 호출 )

이런 로직들이 같이 있으면 테스트가 어려워진다.

3. 강의 금액에서 할인과 적용한 포인트를 적용한 금액 계산
4. 금액과 결제 금액이 같은지 외부 서비스에 내역 조회

위 3,4번은 합쳐서 `강의 금액에서 할인된 금액을 계산하여 동일한지 검증한다.` 라는 로직이 될수도 있다.

이러면, 강의 금액에서 할이된 금액을 계산하는 로직을 테스트 하려면?
-> 외부 서비스 내역 조회까지 기능 구현 완료를 해야 테스트가 가능해진다.
심지어, 계산 로직을 하려면 외부 서비스와 연동을 확인해야만 한다..!

```java
@Transactional  
public ApplyResponse approveApply(final long adminId, final ApplyChangeRequest request) {  
    validateAdmin(adminId);  
    final ApplyForm form = applyFormRepository.getByIdOrThrow(request.applyId());  
    form.approve(request.judgeDetail(), adminId);  
    return toResponse(form);  
}
```

지원서를 승인하는 로직이 있을때
승인한 결과를 이메일로 보내는 로직을 해당 코드에 넣는것과 해당 코드 외부에 두는것은 테스트의 난이도를 다르게 해준다.

```java
@MockBean  
private EmailSender emailSender;

@Test  
void 운영자가_지원서를_승인한다() {  
    final long userId = 5;  
    final ApplyForm applyForm = applyFormRepository.save(getDomain(userId, getRequest()));  
  
    sut.approveApply(ADMIN.getId(), new ApplyChangeRequest(  
            applyForm.getId(),  
            "승인 완료"  
    ));  
  
    final var result = sut.findApplyFormWithUserId(userId);  
    assertThat(result.applyStatus()).isEqualTo(FormStatus.APPROVE.name());  
    Mockito.verify(emailSender,Mockito.times(1))  
            .sendApplyJudgeMail(result.contractName(), result.contactEmail(),result.applyStatus());  
}
```

메소드 내부에 있는 로직을 검증해야 하므로 불필요하게 Mocking을 해야하고, Spy를 통해 호출이 되었는지 확인할 수 밖에 없다.
더 문제는 이메일 로직이 바뀌면? -> approve 로직이 같이 변경이 되야만 한다.

```java
@PostMapping("/apply/approve")  
public ResponseEntity<Void> approveApply(@AuthenticationPrincipal final UserPrincipal userPrincipal, @RequestBody final ApplyChangeRequest request) {  
    final ApplyResponse result = applyService.approveApply(userPrincipal.getUserId(), request);  
    emailSender.sendApplyJudgeMail(result.contractName(),result.contactEmail(),result.applyStatus());  
    return ResponseEntity.ok()  
            .build();  
}
```

- applyService 는 온전히 지원서 승인 로직
- emailSender 는 이메일을 보내는 로직

분리를 하면?
이메일을 보내는 로직은 실제로 테스트 하고 싶으면 하고, 하기 싫으면 하지 않으면 된다.

#### 명확한 도메인 분리

가끔씩 서비스가 해야하는 로직일까, 도메인이 해야하는 로직일까 고민이 되는 경우가 있다.
이때도, 애플리케이션 서비스 로직 - 도메인 로직을 분리하면 명확하게 분리 가능하다!
유스 케이스를 길게 작성할수록, 로직에 대해 자세하게 설명할수록 두개는 분리된다.

OSI 7 계층처럼 분리하면 분리할수록 더욱 로직의 재사용이 쉬워지고 + 교체가 용이해진다.

---

사실 이 내용들은

![500](https://i.imgur.com/k8rFIDB.png)

서비스가 하는 역활인지, 도메인이 하는 역활인지 + passwordEncoder,user,passwordMatcher 중 책임이 누구한테 있는가?
라는 다소 다른 주제에서 나왔다.

하지만, 위 내용들을 토대로 누가하든 상관이 없으며, 그냥 도메인 로직임을 깨달았다.
( 물론, 코드적으로 객체지향적으로 더 나은 최선책은 있을 거라 생각 )

추가적으로
![](https://i.imgur.com/coXxF1.png)

비즈니스 로직과 도메인 로직을 분리하는 관점도 있다.
가볍게 인터페이스와 구현체라고 생각만 하자.

p.s 항상 도움을 주는 리뷰어님과 코치에게 감사를.

