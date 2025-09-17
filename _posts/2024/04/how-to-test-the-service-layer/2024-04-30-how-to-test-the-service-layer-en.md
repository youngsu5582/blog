---
title: "How to Test the Service Layer?"
author: 이영수
date: 2024-04-30T00:36:15.562Z
tags: ['Unit Test', 'Service Layer Test', 'Test', 'Wooteco']
categories: ['Programming', 'Test']
description: "To you who are contemplating whether to test the service layer with sociable tests vs. solitary tests"
image:
  path: https://velog.velcdn.com/images/dragonsu/post/5cb29b53-7d18-46b6-afcd-7ad042db367e/image.jpg
lang: en
permalink: /posts/how-to-test-the-service-layer/
---

> This post has been translated from Korean to English by Gemini CLI.

While doing this Wooteco mission,
I separated Controller-Service-Repository through the MVC pattern.

And, thinking about the requirements of Wooteco Level 1,
I tried to test the implementation.

At this time, a problem occurred.

```java
public class ReservationService {  
    private final ReservationRepository reservationRepository;  
    private final ReservationTimeRepository reservationTimeRepository;
    
	public ReservationCreateResponse createReservation(final ReservationCreateRequestInService request) {  
	    final long reservationTimeId = request.timeId();  
	    final ReservationTime reservationTime = 
		    reservationTimeRepository.findById(reservationTimeId)  
	            .orElseThrow(() -> new NotExistReservationTimeException(reservationTimeId));  
	            
	    final Reservation reservation = Reservation.builder()  
	                                               .name(request.name())  
	                                               .date(request.date())  
	                                               .time(reservationTime)  
	                                               .build();  
	  
	    final long reservationId = reservationRepository.create(reservation, reservationTimeId);  
	    return ReservationCreateResponse.from(reservationId, reservation);  
	}
}
```

It's about how to handle the repository dependency to test when there is a logic like the code above.
#### Prior Knowledge
- Sociable Test: If the unit under test has a cooperative relationship with other units, test the other units together.
```java
final long id = reservationTimeRepository.create(ReservationTime.from("10:00"));  
  
final var result = sut.createReservation(  
        new ReservationCreateRequestInService("Joysun", "2023-10-03", id));  
  
Assertions.assertThat(result)  
          .isInstanceOf(ReservationCreateResponse.class);
```

- Solitary Test: Test only the unit under test.
```java
//Given  
when(reservationTimeRepository.findById(1))  
        .thenReturn(Optional.of(ReservationTime.from(1L, "10:00")));  
when(reservationRepository.create(  
        Reservation.from(  
                null,  
                "Joysun",  
                "2021-10-03",  
                ReservationTime.from(1L, "10:00")), 1L))  
        .thenReturn(1L);  
  
//When  
final var actual =  
        sut.createReservation(  
                new ReservationCreateRequestInService("Joysun", "2021-10-03", 1l)  
        );  
  
//Then  
assertThat(actual).isInstanceOf(ReservationCreateResponse.class);
```
### Problems with Sociable Tests?

At first, I thought that a sociable test using a real object was good for a simple approach. (See the reason below)
1. It verifies by actually connecting to the DB.
2. When specifying through mocking, the test code must know a certain amount about the implementation.
3. Readability is poor due to the when clause.

However, in the Woowahan technical blog [Finding the Bluebird of Server-Side Testing](https://techblog.woowahan.com/14874/), it is said that they agreed on the principle of `actively using solitary tests & test doubles for tests where the unit under test has a cooperative or delegation relationship with other units when writing unit tests`.
#### Slow test feedback speed due to @SpringBootTest

To implement a unit test as a sociable test, the service needs all the other classes it depends on at runtime.
-> Doesn't Spring automatically inject them?
-> You can use SpringBootTest.

Using the IoC container through SpringBootTest makes the test feedback fatally slow.
##### beforeEach - Mock
```java
@BeforeEach  
void setUp() {  
    this.reservationRepository = mock(ReservationRepository.class);  
    this.reservationTimeRepository = mock(ReservationTimeRepository.class);  
    this.sut = new ReservationTimeService(reservationTimeRepository, reservationRepository);  
}
```

![300](https://i.imgur.com/GMnO9dg.png)

Very slow when using beforeEach!
##### Constructor - Mock
```java
public ReservationTimeServiceMockTest() {  
    this.reservationRepository = mock(ReservationRepository.class);  
    this.reservationTimeRepository = mock(ReservationTimeRepository.class);  
    this.sut = new ReservationTimeService(reservationTimeRepository, reservationRepository);  
}
```

![300](https://i.imgur.com/cjAlQrX.png)

It's amazing when creating through a constructor!
##### Dependency Injection - Real
```java
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)  
class ReservationTimeServiceTest {  
    ReservationTimeService reservationTimeService;  
    ReservationService reservationService;  
  
    @Autowired  
    public ReservationTimeServiceTest(final ReservationTimeService reservationTimeService, final ReservationService reservationService) {  
        this.reservationTimeService = reservationTimeService;  
        this.reservationService = reservationService;  
    }
```

![300](https://i.imgur.com/HmSrx6i.png)

Execution through Spring Boot Test - constructor injection and setter injection are all the same.

![400](https://i.imgur.com/YubxFKF.png)

In fact, there was not much difference when running the whole thing (I may have set it up wrong, A_StartTest is a class to subtract the initial setup processing time).
#### DB Dependency

Although the DB is very closely related to the application,
it is ultimately an `external dependency` that has a different lifecycle and operation from the application.

A sociable test that the Service performs through a real Repository object inevitably depends on an external dependency that it cannot control, the DB.
-> Can't I just test with an h2 DB?

The book [Unit Testing: Principles, Patterns, and Practices for Productivity and Quality](https://product.kyobobook.co.kr/detail/S000003470704) does not recommend h2 testing.

> You can avoid separating them from each other through an in-memory DB,
> (No need to remove test data, improved work speed, can be instantiated for each test run)
> 
> It is better not to use it because it is not functionally consistent with a general DB.
> (The operating environment - test environment will not match - it will be easy to get false positives and false negatives!)

Then, can't I just manage the test data strictly so that it doesn't overlap & write the test code with that in mind?
![400](https://i.imgur.com/pIUKXww.png)

😮‍💨😮‍💨
Simply put,
```java
@Test  
@DisplayName("Save to DB through domain.")  
void create_reservationTime_with_domain() {  
    final var reservation =  
            Reservation.from(null, "Joysun", "2024-10-03",  
                    ReservationTime.from("10:00"));  
    reservationRepository.create(reservation, 1);  
  
    final var result = reservationRepository.findAll();  
    assertThat(result).hasSize(1);  
}
```

The explanation is that whoever writes the test code should be able to write it simply without looking at other test codes or worrying about the context. (This content & code may be wrong.)

In the end, each test must be performed independently without depending on external dependencies (DB...)!

---

In this way, sociable tests also have their own problems.
So should we use solitary tests?
No.
### Opponents of Solitary Tests

I asked the reviewers and coaches about this.

![350](https://i.imgur.com/oryiwYq.png)

![350](https://i.imgur.com/Pb30kd4.png)

And I received the following opinions.

- Most bugs occur in the DB, especially when manipulating the DB in the service logic.
  So I am of the opinion that in service tests, even if I mock other server APIs or other resources, I should include the dependency on the DB for testing.

- Rather, I tend to worry more about the risks that can arise from mocking the repository when testing the service.
  If you set the mocked behavior of the repository to return a value that cannot actually be returned,
  there is a risk that the service's test will not be stable. This is because it leads to a false negative.

There were also negative views on solitary tests like this.
### How will you test the service layer?

What should I do if both are not good?

I concluded that the answer is both.
Coach Neo said that the type of test and the implementation method do not matter.

He said that the important thing is to clearly define the purpose and intention of the test.

`I really want to see that the service intends this value by connecting to the actual DB.`
`I want the service to give this value when I put in this value.`

Will the test code of the two people be the same?

If you look at the content of [Finding the Bluebird of Server-Side Testing](https://techblog.woowahan.com/14874/) in the `Problems with Sociable Tests` section above,

![400](https://i.imgur.com/n2fH09j.png)

In this way, the gift-giving team also
does not insist on only one testing style! (I intentionally built up to this to explain it here 👍)

I think it's important to create your own testing philosophy!

Therefore, I plan to try a solitary test using mocking in the next mission!
- The service intentionally controls the value of the repository to test the service logic itself completely.
- In the integration test, verify that all logic works intentionally with the DB using the actual DB.

Finally, the most important reason is that I haven't done it before!
(I plan to experience the pros and cons as I go.)

![400](https://velog.velcdn.com/images/dragonsu/post/7ea9f1bc-a68e-4213-b379-a9989ecd60ce/image.png)


##### Reference

[This mission repository](https://github.com/woowacourse/spring-roomescape-admin/tree/youngsu5582)

[Finding the Bluebird of Server-Side Testing](https://techblog.woowahan.com/14874/)

[Unit Testing: Principles, Patterns, and Practices for Productivity and Quality](https://www.aladin.co.kr/shop/wproduct.aspx?ItemId=280870631)
