---
title: "Why BDD? (A Cucumber Usage Review)"
author: 이영수
date: 2024-08-16T16:19:59.783Z
tags: ['bdd', 'cucumber', 'test', 'wooteco', 'behavior test']
categories: ['Programming', 'Test']
description: "If you're tired of TDD and ATDD, but still want to write tests"
image:
  path: https://velog.velcdn.com/images/dragonsu/post/14adcdaf-b763-4407-886c-b122b719369d/image.jpeg
lang: en
permalink: /posts/why-bdd-cucumber-usage
---
This content is organized in the [Cucumber Learning Repository](https://github.com/youngsu5582/cucumber-test/tree/main/src/test/java).
It's not based on professional use or learning, but rather on what I felt after a rough look and use.
I would appreciate it if you could leave any questions or point out any errors in the comments or at `joyson5582@gmail.com`.

---

BDD might be an unfamiliar word to most people.
TDD is Test Driven Development, but what is B??

## BDD

Here, B stands for Behavior.
In Korean? It's 행위 (haeng-wi).

To understand this better, let's interpret and understand BDD as explained by Cucumber.
```
https://cucumber.io/docs/bdd/

BDD is a way for software teams to work that closes the gap between business people and technical people by:

- Encouraging collaboration across roles to build shared understanding of the problem to be solved
- Working in rapid, small iterations to increase feedback and the flow of value
- Producing system documentation that is automatically checked against the system’s behaviour

We do this by focusing collaborative work around concrete, real-world examples that illustrate how we want the system to behave. We use those examples to guide us from concept through to implementation, in a process of continuous collaboration.

```

BDD closes the gap between business people and technical people by

1. Encouraging collaboration
2. Rapid and small iterations
3. Producing system documentation and automatically checking behavior

it says.
What, isn't this just an explanation of the agile process?
( Encouraging collaboration, small and fast units, closing the gap, etc. )

That's right!
BDD does not replace your existing agile process, but
as the saying goes, `BDD does not replace your existing agile process, it enhances it.`

So, to apply BDD?

![450](https://i.imgur.com/WnJs1wM.png)

BDD is said to consist of three iterative processes.

1. Take a small, planned system item, and discuss concrete examples of the new feature to discover and agree on the details.
2. Document these examples in an automatable way and confirm agreement.
3. Implement the behavior described in each documented example.

The idea is to make each change small, iterate quickly, and go up a level whenever more information is needed.
-> Every time you automate and implement a new example, you are adding something valuable to the system and are ready to respond to feedback.

Isn't it similar to TDD?
1. Write a failing test.
2. Make the failing code pass as quickly as possible.
3. Refactor the production code & test code.

Of course, what each step means is different, but through the TDD cycle,
if you write test code, implement the feature, and repeat refactoring to complete it,
you can have the mindset that `errors and mistakes in this code are now outside of my domain`.

Similarly, with BDD, if you write and pass everything based on the derived details,
as mentioned above, you have added a feature and are ready to respond to feedback. ( Because you would have derived it by talking with the business person when agreeing on the details )

So, how should we write features based on BDD?

## Getting Started with BDD

### Discovery

```
> The hardest single part of building a software system is deciding precisely what to build.
> 
> – Fred Brooks, The mythical man-month
```

The hardest part of development is deciding exactly what to build.
To create valuable and working software, which is the true goal,
you must talk to the stakeholders who imagine and provide it (the business people).

BDD minimizes the time spent in meetings and maximizes the production of valuable code.
( It helps the team work in small units by discovering low-priority features that can be excluded from the story scope. )

And, until this `Discovery` is mastered, the bottom two are also meaningless. ( - as the official Cucumber documentation says. ㅇ.ㅇ )
> EX ) If we need to implement a room for reviews, what should we do first?
> Well, first, when implementing a room, we should prevent putting in a value earlier than the current time.
> For the fun of the room, how about automatically generating and recommending a picture of the room?
> 
> For the user's fun, let's start with the picture generation logic,
> and put the verification part in the backlog and work on it later!
> ( Of course, the above are my thoughts on what BDD looks like )

### Formulation

If you have discovered valuable examples in Discovery?
We can `formulate` them into structured documentation.
Based on this formulation, we can see if we understand the same thing, and it is possible to propagate the content to be implemented to the entire team.

And, we can guide implementation development based on content that can be read by both humans and computers.
( This also allows for a connection to the code part )

### Automation

Since we have executable specifications as the actual work to be performed, we can guide implementation development.
It helps to check what the system is currently doing + to change it safely without breaking it.
-> It reduces the burden of manual regression testing and allows for more interesting work.

This is all about BDD and how to get started with BDD.
Now, let's look at what kind of content Cucumber uses for documentation.

---

Cucumber helps with BDD through a syntax they proposed called `Gherkin`.

## Cucumber in Spring

Roughly,
```cucumber
Feature
	Background:
		...
	Scenario(Also works the same as Example):
		Given
		When
		Then		
```

It is written in a format like this.

In addition, there are `And`, `But`, etc.
It's not important to put `And` after Given, or to use only one Then, etc.
There is no difference in the actual operation, it just makes it more readable. ( 10 Thens are OK, 1 Then + 9 Ands are also OK )

- Background : A step to prevent repetition when the same step is needed before executing a scenario.
- Given : A step that defines the environment you want to perform in the test.
- When : A step that performs the desired action in the test.
- Then : A step that expresses the result you want to get in a BDD test.
- And,But : A step to additionally define & perform & express after a step.

Now, let's look at the existing code and explain what changes when using Cucumber.

```
Scenario: Perform social login through the user lookup API with the appropriate code received from GitHub.
Given the web client passes the appropriate code.
And a user with the username "corea" does not already exist.
When performing social login through the code.
Then a user with the username "corea" should be looked up.
```

The scenario is about testing a general social login.

```java
@Test
public void if_user_does_not_exist_after_lookup_based_on_code_proceed_with_signup() {

	final String username = "corea";
	//    Given the web client passes the appropriate code.
	when(githubClient.getAccessToken(mockCode)).thenReturn(mockAccessToken);
	when(githubClient.getUserInfo(mockAccessToken)).thenReturn(new GithubUserInfo(
			"corea",
			"조희선",
			"thumbnailLink"
			"corea@email.com"
	));

	// And a user with the username "corea" does not already exist.
	memberStep.verify_if_user_with_username_exists(username);


	//When performing social login through the code.
	final LoginRequest loginRequest = new LoginRequest(mockCode);
	final Response response = signup(loginRequest);

	//    Then a user with the username "corea" should be looked up.
	memberStep.lookup_by_username(username);
}
```

```java
@Component
public class MemberStep {
    @Autowired
    MemberRepository memberRepository;

    public void lookup_by_username(final String username){
        assertThat(memberRepository.findByUsername(username)).isPresent();
    }
}
```

In this way, dependencies are mixed or the code is invaded, so the scenario cannot be clearly revealed.
> If you ask why MemberStep uses MemberRepository,
> we don't have a feature to directly look up a member - I think code created for testing is not good.

Isn't this code natural?
Using Cucumber doesn't change much, but you can expect separation of concerns and separation at the code level.

```java
@Given("the web client passes the appropriate code.")
public String generate_appropriate_code() {
    final String mockCode = "mocking-code";
    final String mockAccessToken = "mocking-access-token";
    when(githubClient.getAccessToken(mockCode)).thenReturn(mockAccessToken);
    when(githubClient.getUserInfo(mockAccessToken)).thenReturn(new GithubUserInfo(
            "corea",
            "조희선",
            "thubmnailUrl"
            "corea@email.com"
    ));
    cucumberClient.addData(GITHUB_CODE, mockCode);
    return mockCode;
}
```

Pass the appropriate code and

```java
@And("a user with the username {string} does not already exist.")
public void verify_if_user_with_username_exists(final String username) {
    if (memberRepository.findByUsername(username)
            .isPresent()) {
        throw new IllegalStateException(String.format("A user for %s already exists.", username));
    }
}
```

Check if a user does not exist and

```java
@When("performing social login through the code.")
public void signup() {
    final LoginRequest loginRequest = new LoginRequest(cucumberClient.getData(GITHUB_CODE, String.class));
    //@formatter:off
    final Response response = RestAssured.given().body(loginRequest).contentType(ContentType.JSON)
            .when().post("/login")
            .then().assertThat().extract().response();
    //@formatter:on
    cucumberClient.setResponse(response);
}
```

Proceed with signup and

```java
@Then("a user with the username {string} should be looked up.")
public void lookup_user_by_username(final String username) {
    assertThat(memberRepository.findByUsername(username)).isPresent();
}
```

Look up if a user exists by username.

These code snippets?

```java
public class MemberAndStepDefinitions {

    @Autowired
    CucumberClient cucumberClient;

    @Autowired
    MemberRepository memberRepository;

    @And("a user with the username {string} does not already exist.")
public void verify_if_user_with_username_exists(final String username) {
    if (memberRepository.findByUsername(username)
            .isPresent()) {
        throw new IllegalStateException(String.format("A user for %s already exists.", username));
    }
}

	@And("a user with the username {string} already exists.")
	public void create_user_with_username(final String username) {
	    final Member member = memberRepository.save(new Member(username, "thumbnialUrl", "조희선", "corea@email.com", false));
	    cucumberClient.addData("MEMBER", member);
	}
	
	@Then("a user with the username {string} should be looked up.")
	public void lookup_user_by_username(final String username) {
	    assertThat(memberRepository.findByUsername(username)).isPresent();
	}
}
```

They are explicitly separated into these snippets.
Dependency injection also injects only the necessary values + Steps do not need to be exposed as Components.
( No need to import from other places, each operates separately within Cucumber )

![](https://i.imgur.com/VpBQ20T.png)

The best things are
that you can write scenarios in a language that both humans and machines can understand, and
that you can freely insert variable values.

So, are there only good things??

### Disadvantages...?

```
3 Scenarios (3 passed)
12 Steps (12 passed)
0m5.416s
```

It takes a relatively long time of about 5 seconds to perform these values.
I guess it's inevitable because an additional Step ( Cucumber ) is created.

```java
@TestComponent
@ScenarioScope
public class CucumberClient {

    private final Map<String, Object> dataStorage = new HashMap<>();

    private Response response;

    private String token;

	public void addData(final String key, final Object value) {
	    dataStorage.put(key, value);
	}
	
	public <T> T getData(final String key, final Class<T> clazz) {
	    final Object data = dataStorage.get(key);
	
	    if (data == null) {
	        throw new NullPointerException(String.format("There is no value for %s.", key));
	    }
	
	    if (!clazz.isInstance(data)) {
	        throw new ClassCastException(String.format("%s and %s are of different types.", clazz, data));
	    }
	
	    return clazz.cast(data);
	}
}

```

And, there is a Client that saves the progress and various values, but
I felt that I should be careful about cases where this is too convenient and makes the test more complicated, or where values are overwritten.

In addition, the number of steps keeps increasing, and

```java
@And("a user with the username {string} already exists.")
public void create_user_with_username(final String username) {
    final Member member = memberRepository.save(new Member(username, "thumbnialUrl", "조희선", "corea@email.com", false));
    cucumberClient.addData("MEMBER", member);
}
```

This value can be used as both `And` and `Given`, so there might be some confusing points.

Of course, I don't think I can introduce this to the team project I'm currently doing right away.
It's not that I don't think it's essential enough to prepare for the time for team members to learn and introduce it.

I don't think it can be denied that it has enough merit.
I think it's also a good point that it can make documentation clearer than simple ATDD.
( ATDD focuses on whether requirements are met, BDD on software behavior )
-> Therefore, it's OK to let go of the developer's perspective a little more from the user's perspective.


In addition, here, some parts were tested with `
RestAssured` and some with `Repository`.
I did this because I was in a hurry, and

> It seems to be connected to the lower layer you mentioned, but it feels like the abstraction level of the test's verification is different.

Like this content, let's maintain layer consistency as much as possible.

---

When using Cucumber in Intellij IDEA, it can be very laggy.
In this case, try installing `Cucumber Scenarios Indexer`.
It seems to index files, and the speed difference with and without it is quite large.

![](https://velog.velcdn.com/images/dragonsu/post/bb076f02-3060-4964-ab58-ef2b81dc1f7b/image.gif)

( This is without it applied )

![](https://velog.velcdn.com/images/dragonsu/post/f4b7a3e3-c0ea-46c0-88bc-2791eb79bb9f/image.gif)

( This is with it applied )

It may be different for each computer, but if you experience lag while using Cucumber, give it a try.
