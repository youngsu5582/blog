---
title: "Business Logic vs. Domain Logic?"
author: 이영수
date: 2024-06-28T03:55:29.297Z
tags: ['Domain Logic', 'Business Logic', 'Application Service Logic', 'Wooteco']
categories: ['Programming', 'Clean Code']
description: It's quite confusing. What is domain logic, and what is business logic? Domain logic is the logic executed by a simple domain, is business logic not a larger logic like a method within a service? I don't know about others, but this is what I was thinking. Then, code to calculate and accrue points? Code to convert dollars to Korean Won?
image:
  path: https://velog.velcdn.com/images/dragonsu/post/cc07d2c7-7cf8-4533-ae40-058c6bdd4235/image.png
lang: en
permalink: /posts/business-logic-vs-domain-logic/
---
It's quite confusing.
What is domain logic, and what is business logic?

`Domain logic is the logic executed by a simple domain,` `is business logic not a larger logic like a method within a service?`

I don't know about others, but this is what I was thinking.

Then,

> Code to calculate and accrue points?

> Code to convert dollars to Korean Won?

The latter can confidently be called domain logic, but the former is somewhat confusing.

```
If I'm accruing, shouldn't it be saved in the DB too..? Then is it service logic?
But then calculation and accrual are user-domain interactions for points, so is it domain logic..?
```

To answer directly, business logic and domain logic are the same term.

![](https://i.imgur.com/NpYR0Ps.png)

And the reason for the ambiguity is that domain (business) logic and application service logic are not separated.
What is application service logic?
### Domain Logic in Software Engineering

> This section was written based on the video [Understanding Business Logic and Domain Logic in Software Architecture at Once](https://www.youtube.com/watch?v=gbzDG_2XQYk).

Considering the domains that exist in a banking app?
-> Interest rates, balances, withdrawals, account opening, account closing, etc., are domains.

What about TikTok's domains?
-> Video editing, comment viewing, sharing, etc., are domains.

- If the code is making decisions about real-world problems?
	-> <span style="color:#00b0f0">Domain Logic</span>
- If it helps users make decisions outside of real-world problems, such as DB connection, backend server API calls, video caching, and adding animations?
	-> <span style="color:#00b0f0">Application Service Logic</span> (Not Domain Logic)

For example,
if it's a case of mobile money transfer in a mobile money transfer app?

```
1. "Check if account balance is sufficient"
2. "Activate transfer button", display "error message" if invalid
3. "Calculate transfer fee" according to user membership level
4. "Request external service to process payment" for calculated transfer fee
5. "Decrease user balance" by fee and transfer amount
6. "Save user balance to DB"
```
#### Domain Logic

1. Check if account balance is sufficient
	-> <span style="color:#00b050">Decision-making</span> on whether transfer is possible
3. Calculate transfer fee according to user membership level
	-> <span style="color:#00b050">Decision-making</span> on the cost of transfer according to fee policy or membership policy
5. Decrease user balance by fee and transfer amount
	-> <span style="color:#00b050">Calculation</span> of balance after transfer
#### Application Service Logic
2. "Activate transfer button", display "error message" if invalid
	-> UI Logic
4. Request external service to process payment for calculated transfer fee
	-> Networking with external service
6. Save user balance to DB
	-> Persistence Logic

---

### Separation of Domain Logic and Application Service Logic

So, let's go back to the beginning and separate `calculate and accrue points`.

The content is:
```
1. Calculate points based on user's accrual rate from total amount.
2. Accrue user's points.
3. Reflect user's changed points in DB.
```

It has become very specific and long.
1, 2 are domain logic (calculate points, accrue points)
3 is application logic (save to DB)

Then, what about the logic for purchasing a new course on Inflearn with more complex logic?
(Too long, so I'll omit the error message return UI logic)

```
0. After frontend processes external service payment (Kakao Pay, card payment, etc.),
   `payment details (payment ID) & coupon ID, point amount & course ID, user token` etc. are sent to the server.

1. "Check if coupon is valid for user"
2. "Check if user's points are greater than points used"
3. "Calculate amount after discount and applied points from course amount"
4. "Query external service to check if amount and payment amount are same"
5. "Decrease user's points"
6. "Accrue points based on amount according to user's level"
7. "Save payment details to DB, reflect user's changed points in DB"
8. "Send payment summary to frontend & render"
```

Here, business logic is 1, 2, 3, 5, 6.
Logic that makes direct decisions for requirements (e.g., check if coupon domain applies to user domain, check user domain's point amount, etc.)

Application service logic is 4, 7, 8.
(4 is external service networking logic, 7 is persistence logic, 8 is UI logic)

### Why should they be separated?

Then, let's think about why application service logic and domain logic should be separated.
#### Ease of Testing

Application service logic, as you can see, is all difficult to test.
(DB logic, UI logic, external network calls)

If these logics are together, testing becomes difficult.

3. Calculate amount after discount and applied points from course amount
4. Query external service to check if amount and payment amount are same

The above 3, 4 can be combined into a logic like `calculate discounted amount from course amount and verify if it's the same`.

Then, to test the logic that calculates the discounted amount from the course amount?
-> You need to complete the implementation of external service query to test.
Moreover, to perform calculation logic, you need to verify integration with external services..!

```java
@Transactional  
public ApplyResponse approveApply(final long adminId, final ApplyChangeRequest request) {  
    validateAdmin(adminId);  
    final ApplyForm form = applyFormRepository.getByIdOrThrow(request.applyId());  
    form.approve(request.judgeDetail(), adminId);  
    return toResponse(form);  
}
```

When there is a logic to approve an application,
putting the logic to send the approval result by email into this code versus putting it outside this code changes the difficulty of testing.

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

To verify the logic inside the method, you unnecessarily need Mocking, and you can only check if it was called via Spy.
The bigger problem is, if the email logic changes? -> The approve logic must also change.

```java
@PostMapping("/apply/approve")  
public ResponseEntity<Void> approveApply(@AuthenticationPrincipal final UserPrincipal userPrincipal, @RequestBody final ApplyChangeRequest request) {  
    final ApplyResponse result = applyService.approveApply(userPrincipal.getUserId(), request);  
    emailSender.sendApplyJudgeMail(result.contractName(),result.contactEmail(),result.applyStatus());  
    return ResponseEntity.ok()  
            .build();  
}
```

- applyService is purely application approval logic
- emailSender is email sending logic

If separated?
You can test the email sending logic if you want, or not if you don't.

#### Clear Domain Separation

Sometimes, it's confusing whether it should be service logic or domain logic.
In this case, separating application service logic and domain logic can clearly separate them!
The longer you write use cases, the more detailed you explain the logic, the more they separate.

Just like OSI 7 layers, the more you separate, the easier it becomes to reuse logic and replace it.

---

Actually, these contents

![500](https://i.imgur.com/k8rFIDB.png)

came from a slightly different topic: whether it's the service's role or the domain's role, and who is responsible among passwordEncoder, user, and passwordMatcher.

However, based on the above contents, I realized that it doesn't matter who does it; it's just domain logic.
(Of course, there might be a better object-oriented solution in terms of code.)

Additionally,
![](https://i.imgur.com/coXxF1.png)

There is also a perspective of separating business logic and domain logic.
Just think of it lightly as an interface and implementation.

p.s. Always grateful to the reviewers and coaches for their help.
