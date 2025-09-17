---
title: "After Attending the Kotlin Backend Meetup Conference"
author: 이영수
date: 2025-02-23T09:37:58.651Z
tags: ['meetup', 'backend', 'conference', 'kotlin']
categories: ['Backend', 'Kotlin']
description: "The Kotlin Backend Conference was the best. 👍"
permalink: /posts/after-attending-the-kotlin-backend-meetup-conference/
permalink: /posts/after-attending-the-kotlin-backend-meetup-conference/
permalink: /posts/after-attending-the-kotlin-backend-meetup-conference/
image:
  path: https://velog.velcdn.com/images/dragonsu/post/1255cb9a-d5bb-4762-9ea1-394f170c7622/image.jpeg
---
> I'm writing a review of the conference before it gets too late.
> (Summer homework 🥲)

![](https://i.imgur.com/csmVs8D.png)

Thanks to the grace of the king-god Jason, I was thankfully invited to the Kotlin Backend Meetup.

Actually, it hasn't been long since I started Kotlin in earnest, but
with a little bit of learning and the help of GPT,

```kotlin
@Test  
fun `if the user is not authenticated, payment cancellation fails`() {  
    DocsApiBuilder("cancel-failure-not-authenticated")  
        .setRequest("/api/cancel", HttpMethod.POST) {  
            headers {  
                "Authorization" type DocsFieldType.STRING value "Bearer notValidToken"  
            }  
            body {  
                "billId" type DocsFieldType.NUMBER means "ID of the purchased receipt" value 2  
            }  
        }.setResponse {  
        }.execute(true)  
        .statusCode(401)  
}
```

I created a RestDocs DSL that I was satisfied with myself ([see blog](https://velog.io/@dragonsu/%EC%BD%94%ED%8B%80%EB%A6%B0-DSL-%EC%9D%84-%ED%99%9C%EC%9A%A9%ED%95%B4-RestDocs-%ED%9A%A8%EC%9C%A8%EC%A0%81%EC%9C%BC%EB%A1%9C-%EA%B0%9C%EC%84%A0%ED%95%98%EA%B8%B0-ver-1.0)) and applied to gain insights into Kotlin.

## Presentation Agenda

![](https://i.imgur.com/ih6uInB.png)

The presentation sessions were as above, and
some of the presentation materials are in this repository: https://github.com/Kotlin-User-Groups-Seoul/kotlin-backend-meetup-2025.

I attended `Ktor Framework Starter`, `Gilded Rose Refactoring Challenge`, and `Kotlin TDD`.
Below, I will lightly cover what the content was about and write down my thoughts.

### Ktor Framework Starter

The presentation was conducted in a hands-on lab format where we cloned the project and wrote the code ourselves.

> It was based on this GitHub repository: https://github.com/lolmageap/ktor-practice
> It has a great introduction to Ktor, a comparison with Spring, a roadmap, and is very well-defined for each branch, so if you're interested, I definitely recommend checking it out. 🙂

Ktor is a lightweight, Kotlin-based framework supported by JetBrains.
Its characteristic is that you build the code in a plugin format.
Then, you reassemble the configured code into modules to run the server.

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

You configure the `Module` and run the server through the Netty Engine.
It seems to be a style where you keep adding the elements you want to attach.

#### DB Connection

What if you want to connect to a DB?

> Instead of JPA, I used `Kotlin Exposed`, a Kotlin ORM.

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

It's a freshness I haven't seen in a while.
Instead of configuration injection + automatic connection via `application.yml`, we have to configure it ourselves like this.
And, when it terminates, we also have to `close` the `connector`.

- `SchemaUtils.create(Users)`: Creates a utility for the Users Entity.

Of course, this is also because I used Exposed instead of JPA.

#### Web Request and Response

Web requests and responses come in through an object called `call` that has both the Request and Response.

```kotlin
route("/api/v1") {  
    post("/users", {
        val request = call.receive<CreateUserRequest>()  
        
        // Process business logic
        newSuspendedTransaction {  
            with(request) {  
                userRepository.create(  
                    name = name,  
                    age = age,  
                    birthday = birthday  
                )  
            }  
        }  
          
        call.respondText(status = HttpStatusCode.Created) { "Success" }
    }
}
```

You receive the request as a DTO, process the business logic, and send a response. (The Response elements are more diverse than you might think.)
`newSuspendedTransaction` is a function provided by Exposed for handling transactions in a coroutine environment.

When accessing the DB, it enables processing with asynchronous I/O by allowing a switch to a suspend state through coroutines instead of thread blocking.

#### Dependency Injection

And, Dependency Injection is also a plugin feature, not a built-in one. (Shocking 😮)

```kotlin
implementation("io.insert-koin:koin-ktor:$koin_version")  
implementation("io.insert-koin:koin-logger-slf4j:$koin_version")
```

```kotlin
val userRepository by application.inject<UserRepository>()  
val userRepositoryV2 by application.inject<UserRepository>(named("second"))
```

You can receive and use dependency injection like this.

#### My Thoughts

First of all, as it is lightweight, the application starts up incredibly fast.
`2025-02-23 15:54:07.752 [main] INFO  Application - Application started in 0.452 seconds.` - The server started in less than a second.

And, since most of it is in DSL, I think you can write code in a really Kotlin-like way.
Another advantage is that it is well-integrated with the Kotlin ORM Exposed.
(While the Hibernate Reference is 406 pages long and has become too complex.)

The presenter said they had to use a `lightweight framework` and that `asynchronous environment parallel processing` was very important, which is why they used it.
(Spring JPA is a very heavy ORM + the maximum number of users per server is limited to 2,000, so using something as heavy as Spring was a big cost factor.)

It seems that Kakao Pay is also trying to introduce Ktor this time.
[# Implementing an API server that fits the team environment with Ktor](https://tech.kakaopay.com/post/ktor-api-server/)

Looking at the concluding remarks here as well:

```
We were confident that we could meet all of our team's development specifications even if we developed with Ktor.
Of course, we think there will be a lot of trial and error because the ecosystem is not yet mature and there are not enough reference materials. 
Therefore, we plan to actively recommend Ktor to our team members when a new module with low importance within the team is needed. 
And after confirming the stability of Ktor, we plan to convert some of the functions of the services in operation to Ktor.
```

It seems that it will be possible to approach or use it lightly someday.

### Gilded Rose Refactoring Challenge

https://github.com/emilybache/GildedRose-Refactoring-Kata

In Korean, it's a challenge to refactor the existing code at the Golden Rose Inn.
You can do it in a very wide variety of languages (even Cobol, Perl, etc. exist).

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

The reason for refactoring is that the branching logic is strange depending on the specific ITEM.

This time, it was also conducted in a hands-on lab format.
And, it was too fast and explained verbally, so I can't represent it perfectly here.. 🥲

Jason said the reason he gave this presentation was `to learn the keyboard shortcuts`.

And, he gave the following tips:

- Keep the 10,000-hour rule in mind (get out of your comfort zone, focus with clear and specific goals, and get feedback).
- Instead of rewriting code from scratch, practice gradual design improvement by taking small steps and running tests frequently.
- Refactoring is ultimately about changing only the inside while the INPUT and OUTPUT remain fixed - Jason said he implemented all acceptance tests for the existing logic for this purpose.
### Lint

https://github.com/JLLeitschuh/ktlint-gradle

First, he said he starts by organizing the style guide through Lint.

Install it and run it via `./gradlew ktlintFormat`.
But, this part also has a command like
- `Ctrl + Ctrl`: Run Gradle Task directly.

### Refactor

> This part was too fast, so I'll just leave the general flow.

After that, he modifies repetitive code by selecting the same thing with `Ctrl + G`.

And, through extension functions, he made the object have its own role.
-> Improved readability, and also easy to move to an internal function later.

If you press `Alt + Enter` in front of an If statement, it suggests a surprising variety of functions.

- `invert`: Reverses the order.

```kotlin
// Before
if (items[i].sellIn < 0) {
    ...
}else{

}

// After
if (items[i].sellIn < 0) {
```

- `split`: Splits the `&&` in a conditional statement.

```kotlin
// Before
if (items[i].name != "Aged Brie" && items[i].name != "Backstage passes to a TAFKAL80ETC concert") {

// After
if (items[i].name != "Aged Brie") {  
    if (items[i].name != "Backstage passes to a TAFKAL80ETC concert") {
```

In Kotlin, if there are two or more conditions, it says to change it to a `when` clause.

Intentionally,

```kotlin
quality -= 0
```

There was a place where he put code like this, and IDEA also identifies it as a similar pattern and simplifies the when clause.

```kotlin
private fun Item.updateQuantity(change:Int){
    if(quantity<50) quantity+=change
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

Let's handle it more cleanly with a Lift Function.

### Conclusion

> The conclusion is too abrupt, but as I repeated this, the code was completed in about 30 lines.

Simplification through linting -> simplification for human readability -> then refactoring such as object separation should proceed.
First, SPLIT the conditional statement -> then, FLIP -> REVERT repeatedly.
Change it as you like from the inside as much as possible.
And, let's also find out if there is a lot of green (similar code) by dragging the line.

![](https://i.imgur.com/JWtng7x.png)

Actually, I was thinking about `how to separate objects and modify the code`,
but what was more important than that was creating `intuitive code`.

I felt that object-orientation also starts with code that is easy to look at.

### Kotlin TDD

This content was really similar to the TDD lecture I heard at Woowacourse.

It was a format of implementing a number baseball game through pair programming with a partner.
It was very fun to talk about technical things while pair programming with someone I didn't know well for the first time in a while.

I feel this while working on my side project now, but unit testing is really easy,
but testing services or business logic, and how much to do, seems difficult.

### Wrapping Up

There were quite a few people from Woowacourse.
I couldn't say hello to everyone, but I had a meal with Luca from the 5th cohort and Skull from the 4th cohort, whom I had met once before, and came back.
(Thank you for buying me a meal. 🙇‍♂️)

Conferences are always fun.
Helpful stories, the energy of developers, and meeting new people. I should try to go to a new seminar next time and get insights.
