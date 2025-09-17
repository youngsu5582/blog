---
title: "Writing ATDD"
author: 이영수
date: 2024-06-12T06:47:47.002Z
tags: ['TDD', 'atdd', 'Test', 'Wooteco']
categories: ['Programming', 'Test']
description: "Delving deeper into ATDD"
image:
  path: https://velog.velcdn.com/images/dragonsu/post/11a2e334-be00-4187-8bce-2ac11acebef4/image.png
lang: en
permalink: /posts/writing-atdd/
---

> This post has been translated from Korean to English by Gemini CLI.

### What is Acceptance Testing?

Is this code an acceptance test?

```java
@Test  
@DisplayName("If there is a duplicate reservation with the same date, time, and theme, it returns 409.")  
void it_returns_409_with_duplicate_reservation_reservationTime_date_theme() {  
    final ThemeResponse themeResponse = create_theme();  
    final ReservationTimeResponse reservationTimeResponse = create_reservation_time();  
    create_reservation("2024-10-03", themeResponse.id(), reservationTimeResponse.id(), token);  
  
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

Most people used to think that acceptance tests `simply send actual requests through the web and verify them`.

However, I don't think this code is a perfect acceptance test. (If you refute, I'm wrong)
First,
1. It's difficult for non-developers to understand. - Hmm, I understand that it sends a request,,, but what is contentType and what is 409...?
2. The intention can be sufficiently transformed with integration tests - it can be checked by combining services to verify errors.

Then, what if it's an acceptance test that I think of?

```java
@Test  
void it_fails_when_attempting_to_sign_up_with_the_same_email() {  
    sign_up(create_user_info(name, email, password));  
  
    final var result = sign_up(create_user_info(name, email, password));  
  
    verify_if_it_is_a_bad_request(result);  
}

========================================

@Test
void when_the_operator_cancels_the_waiting_list_the_next_reservator_becomes_reserved() {  
    final var first_user_info = create_member_and_login_with_email("alphaka@gmail.com");  
    final var reservation_result = create_reservation(date, theme, time, first_user_info);  
  
    final var second_user_info = create_member_and_login_with_email("joyson5582@gmail.com");  
    final var waiting_result = create_waiting_for_reservation(reservation_result, second_user_info);  
  
    final var third_user_info = create_member_and_login_with_email("brown@gmail.com");  
    create_waiting_for_reservation(reservation_result, third_user_info);  
  
    final var operator_info = operator_login();  
    operator_cancel_waiting(operator_info, waiting_result);  
  
    cancel_reservation(first_user_info, reservation_result);  
  
    final var result = retrieve_my_reservations(third_user_info);  
    verify_if_there_is_a_reserved_status_in_my_reservations(result);  
}
```

(Actually, final var is not necessary, but it's a Java problem...)
 
There is still room to refine the code, and there is also plenty of room for refutation. (Isn't it the same even if you don't know it? Can't it be done with integration tests?)

However, this is what I think of as an acceptance test.
Then, let me explain what an acceptance test is.

> I think it's a test that allows non-developers to clearly understand whether the requirements are met or not through `ubiquitous language`.

Then, let's find out what ubiquitous language is and how to express it in code before writing acceptance tests.
### Ubiquitous Language

Let's use common terms that all project stakeholders (developers, non-developers) understand.

Returns 201 when a reservation is created? - ❌
Raises an exception if a reservation exists and the time is deleted? - ❌

Successfully creates a reservation - ✅
Fails if there is a reservation using the time when trying to delete the time - ✅

>Does it not matter whether it returns 200 or 201?
    -> This is something for developers to discuss, and it is not important at all from a non-developer's perspective.
  Is it okay if there is no technical content (DB, Kafka, Infra, etc.) at all?
    -> When creating or deleting a reservation, from a non-developer's perspective, it doesn't matter whether it is stored in the DB or in the application server itself.

Does it not matter how the code is implemented?
-> This is also accurate as above. It is the process of creating an interface, not an implementation.

Then, let's look at how to write acceptance tests.
#### with Given-When-Then ??

![500](https://i.imgur.com/ccsRjoS.png)

This is a picture from Brown's [Elegant ATDD](https://www.youtube.com/watch?v=ITVpmjM4mUE&t=4072s).

Dividing it into Given, When, and Then is actually the clearest.

However, due to the nature of acceptance tests, the distinction between clauses can be somewhat ambiguous.
-> In that case, start with what you first wrote in `@DisplayName` as When.
(Given before that, Then after that!)

In the above content?
If a paid lecture that is currently recruiting is closed, you can apply for a waiting list.
When: Apply for waiting list
Given: Paid lecture in recruitment, Paid lecture recruitment closed
Then: Confirm that it is registered on the waiting list

However, the above method
can make it somewhat difficult to write test code for the first time.
(How do I specify Given...? - How do I verify When/Then...?)

In particular, can non-developers (PMs, management teams, etc.) explain what values come in and what values will be returned?
In this case, let's approach acceptance tests with a different approach!
#### with Flow ??

> If it's a manual reservation flow?
> 
	A made a reservation
	B made a reservation
	B made a waiting reservation
	A canceled the reservation
	The administrator approves the waiting reservation
		and B becomes reserved.
	

A series of flows are also possible.
(It's even better if each step can be verified! - Can A make a reservation correctly + is each order valid?)

Even when starting for the first time?

```java
void some{
	//A creates a reservation.  
	
	//B creates a reservation.

	//...
}
```

Just write the flow like this and implement it.

However, it can be somewhat daunting.
(How do I start "A creates a reservation"...?)

Then, let's step back from ATDD and lower the level (originally, ATDD should go up from easy ones in a Bottom-Up fashion).

```java
void reservation_creation_flow(){
	//The operator creates a theme.

	//The operator registers a reservation time.

	//A creates a reservation.
}
```

But what if this is also daunting?
(An operator is created, a theme is created, a reservation time is created... Oh dear,,)

Therefore, let's use TDD!
### ATDD With TDD

What is A? -> User! -> Let's create a domain -> Since we created a domain, let's create a repository/service.
What is an operator? -> The same user! -> Let's add a role in the domain...
Reservation, theme, reservation time? -> `Same as above...`

TDD helps to implement features by breaking them down into smaller pieces.

```java
@Test  
@DisplayName("Creates a theme with name, description, and thumbnail.")  
void create_domain_with_name_and_description_and_thumbnail() {  
    assertThatCode(() -> new Theme(  
            "Escape Level 2", "This is content about escaping Wooteco Level 2.",  
            new Thumbnail("https://i.pinimg.com/236x/6e/bc/46/6ebc461a94a49f9ea3b8bbe2204145d4.jpg")))  
            .doesNotThrowAnyException();  
}
```

```java
@Test  
@DisplayName("Throws an exception if a reservation exists for a specific theme.")  
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

As we implement it like this,
if we can combine them to perform the function of `A creates a reservation`, then let's complete the acceptance test.
(
### Conclusion

Is acceptance testing really necessary for a project between developers? I don't feel like it's absolutely necessary. (All can be implemented with integration tests + there is a risk of harming the intention with non-developer language.)

However,
I think there are advantages such as implementing elements that are annoying to skip when writing unit tests (reserving, operator canceling, canceling waiting, etc. flow...) and
reducing anxiety that there will be errors & loopholes because it follows the user's flow through actual communication.

In particular, as Brown also said in his presentation, I strongly agree that acceptance tests
can be a milestone during the onboarding period for new hires.
(Unit tests give ambiguity -> Acceptance tests help understand ubiquitous language + domain.)

