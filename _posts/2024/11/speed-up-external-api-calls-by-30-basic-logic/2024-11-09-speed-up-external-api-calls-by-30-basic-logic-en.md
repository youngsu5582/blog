---
title: "Speeding Up External API Calls by About 30% (1) - Basic Logic"
author: 이영수
date: 2024-11-09T09:56:06.095Z
tags: ['Asynchronous', 'External API', 'Wooteco', 'Corea', 'Spring']
description: "Those who want to click and speed up API calls, BE synchronized..."
image:
  path: https://velog.velcdn.com/images/dragonsu/post/65fbb24a-0ca2-436e-a625-b4b45bcf71c1/image.svg
lang: en
permalink: /posts/speed-up-external-api-calls-by-30-basic-logic
---

> This post has been translated from Korean to English by Gemini CLI.

This article was written while implementing a way to reduce API call time for user experience in the [project](https://github.com/woowacourse-teams/2024-corea). 
If there are any incorrect contents or other methods, please leave a comment or contact me at `joyson5582@gmail.com`! 


---

Our project has a feature to confirm code review completion.

To complete a code review, we use two APIs:
- `https://api.github.com/repos/<org>/<repo>/pulls/<pull-number>/reviews` - Review query
- `https://api.github.com/repos/<org>/<repo>/issues/<pull-number>/comments` - Comment query

> Reason for querying both:
> We query both to detect not only `Review changes` but also simple `Comments`.

![500](https://i.imgur.com/YA3xBEb.png)

And, this external API takes a very long time.
I will explain how to process these codes in the order of `existing code` -> `changed code`.

## Existing Code - Synchronous Call

```java
public GithubPullRequestReviewInfo getGithubPullRequestReviewInfoSync(String prLink) {
	validatePrLink(prLink);
	List<GithubPullRequestReview> commentFuture = commentClient.getPullRequestReviews(prLink);
	List<GithubPullRequestReview> reviewFuture = reviewClient.getPullRequestReviews(prLink);

	return new GithubPullRequestReviewInfo(collectPullRequestReviews(reviewFuture,commentFuture));
}

private Map<String, GithubPullRequestReview> collectPullRequestReviews(List<GithubPullRequestReview> reviews, List<GithubPullRequestReview> comments) {  
    return collectByGithubUserId(Stream.concat(reviews.stream(), comments.stream()));  
}
```

1. Validate PR link.
2. Call each API to get values.
3. Combine the two values to create an object for verification.

```java
public List<GithubPullRequestReview> getPullRequestReviews(String prLink) {  
    String githubApiUrl = prLinkToGithubApiUrl(prLink);  
    return Stream.iterate(1, page -> page + 1)  
            .map(page -> getPullRequestReviewsForPage(page, githubApiUrl))  
            .takeWhile(this::hasMoreReviews)  
            .flatMap(Arrays::stream)  
            .toList();  
}

private boolean hasMoreReviews(GithubPullRequestReview[] reviews) {  
    return reviews.length > 0;  
}
```

When calling the API, I made it call from the first page until an empty array appeared.

### Problems

There are two problems that can occur in this code.

1. If two requests occur synchronously and the first API (review) ends late, the second API (comment) also starts late.
2. Pagination API occurs synchronously in each request.

#### Order Dependency of Two Requests

Generally, the review query API takes a long time.
This is because all comments left in `Review Changes` are included.

https://github.com/woowacourse/java-blackjack/pull/652
I will check the time taken by calling the API at this link.

![500](https://i.imgur.com/WxP4iGh.png)

It takes 0.3 seconds to fetch 3.

![500](https://i.imgur.com/muyCxkB.png)

It takes an average of 0.7 to 0.9 seconds to fetch 97.

```java
List<GithubPullRequestReview> reviewFuture = reviewClient.getPullRequestReviews(prLink);
List<GithubPullRequestReview> commentFuture = commentClient.getPullRequestReviews(prLink);
```

If the order is like this, the problem arises where a short request waits for a long request.
 - If the first request fails, the next request also fails.
 - Performance degradation due to longer total time through serialization.

#### Synchronous Pagination Calls

GitHub can only fetch up to 100 items at a time.
If there are too many conversations and it exceeds 100, it needs to fetch from the next page.

![500](https://i.imgur.com/vQMEfqw.png)

![500](https://i.imgur.com/YObXpwb.png)

Each request takes an average of 1 to 1.5 seconds.

When calling a PR with over 300 conversations, approximately:

The user waits for 1.5 `*` 3 + 0.3 = 4.8 seconds.

![500](https://i.imgur.com/NXQTfdi.png)

[Source Link](https://brunch.co.kr/@rightbrain/61)

Users have a bounce rate of `90%` or more even if it takes only 5 seconds...
Of course, since it's waiting after pressing the code review completion button, they might wait, but if it's repeated, they will definitely feel uncomfortable.

## Solution Code - Asynchronous Call
### Solving the First Problem

Let's solve the first problem.

```java
public GithubPullRequestReviewInfo getGithubPullRequestReviewInfoAsync(String prLink) {  
    validatePrLink(prLink);  
    CompletableFuture<List<GithubPullRequestReview>> reviewFuture = supplyAsync(() -> reviewClient.getPullRequestReviewsAsync(prLink));  
    CompletableFuture<List<GithubPullRequestReview>> commentFuture = supplyAsync(() -> commentClient.getPullRequestReviewsAsync(prLink));  
  
    return reviewFuture  
            .thenCombine(commentFuture, this::collectPullRequestReviews)  
            .exceptionally(e -> {throw new CoreaException(ExceptionType.GITHUB_SERVER_ERROR);})  
            .thenApply(GithubPullRequestReviewInfo::new)  
            .join();  
}
```

The code looks somewhat different.
I will explain each one. 🙂

```java
public static <T> CompletableFuture<T> supplyAsync(Supplier<T> supplier) {  
    return CompletableFuture.supplyAsync(() -> {  
        return supplier.get();  
    });  
}
```

I created a utility method like this.
It makes the return type of the execution function `CompletableFuture<T>`.

#### CompletableFuture

It is an asynchronous programming support class provided by Java. (Introduced in Java 8)
It enables the following operations:
- Asynchronous operation: Can execute operations in a separate thread and process results asynchronously.
- Callback operation: Can execute additional operations after the operation is completed.
- Parallel processing: Can combine results after parallel execution.

`supplyAsync` executes an asynchronous operation that returns a value.

To explain the code again:

```java
return reviewFuture  
		.thenCombine(commentFuture, this::collectPullRequestReviews)  
		.exceptionally(e -> {throw new CoreaException(ExceptionType.GITHUB_SERVER_ERROR);})  
		.thenApply(GithubPullRequestReviewInfo::new)  
		.join();  
```

- `thenCombine`: Executes two in parallel, then runs a combining function when both are finished.
(Second parameter: `BiFunction<? super T,? super U,? extends V> fn`)
- `exceptionally`: Catches exceptions and converts them to new values.
- `thenApply`: A function to apply to the combined value.
- `join`: Returns the result value when the asynchronous operation is completed.

It's similar to `stream`, but not quite.

=> The problem of `order dependency of two requests` was solved by executing the two requests in parallel.

### Solving the Second Problem

To solve the second problem, we first need to solve `pagination`.
Currently, I verified by sending requests until an empty array came, and then terminating. This was because I couldn't know the end.
I will try to solve this using the `Link` header provided by GitHub.

#### Link Header

[MDN Link for Link](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Link)

The Link header is used to inform the client about another resource that contains **metadata** about the requested resource.
It is in the format of `Link: <uri-reference>; param1=value1;`.

GitHub tells us what the last value is through this link header.

```
<https://api.github.com/repositories/238385653/issues/652/comments?page=2&per_page=100>; rel="next", <https://api.github.com/repositories/238385653/issues/652/comments?page=2&per_page=100>; rel="last"
```

We can find the last one through this value!
However, instead of directly determining it through this value, I will find it **more efficiently**.

`https://api.github.com/repos/woowacourse/java-blackjack/pulls/652/reviews?page=1000&per_page=100`
-> As such, we send a request that definitely does not have a value.

It takes time to receive 100 items when sending a request to `page=1`. (1.8 seconds ~ 2.0 seconds)
It takes relatively short time to receive empty values. (0.3 seconds)

![500](https://i.imgur.com/3epLerk.png)

(It's a kind of `Preflight` request.)

I will use this `lastPage` to send pagination requests in parallel.

```java
List<CompletableFuture<GithubPullRequestReview[]>> futureReviews = IntStream.rangeClosed(1, lastPage)  
        .mapToObj(page -> supplyAsync(() -> getPullRequestReviewsForPage(page, githubApiUrl),executorService))  
        .toList();

return CompletableFuture.allOf(futureReviews.toArray(CompletableFuture[]::new))  
        .thenApply(v -> futureReviews.stream()  
                .map(CompletableFuture::join)
                .flatMap(Arrays::stream)
                .toList())
        .join();
```

- `allOf`: Waits until all asynchronous operations are completed.

First, send asynchronous requests in parallel.
Then, when all asynchronous requests are finished, convert them to a List. (Quite simple, isn't it? 🙂)

```java
public GithubPullRequestReviewInfo getGithubPullRequestReviewInfoAsync(String prLink) {  
    validatePrLink(prLink);  
    CompletableFuture<List<GithubPullRequestReview>> reviewFuture = supplyAsync(() -> reviewClient.getPullRequestReviewsAsync(prLink));  
    CompletableFuture<List<GithubPullRequestReview>> commentFuture = supplyAsync(() -> commentClient.getPullRequestReviewsAsync(prLink));  
  
    return reviewFuture  
            .thenCombine(commentFuture, this::collectPullRequestReviews)  
            .exceptionally(e -> {throw new CoreaException(ExceptionType.GITHUB_SERVER_ERROR);})  
            .thenApply(GithubPullRequestReviewInfo::new)  
            .join();  
}
```

Through this, asynchronous code that solves two problems has been completed.

## Conclusion 

Let's measure the speed of asynchronous code.

Speed measurement will be performed on two PRs:
- PR with many comments and reviews
- Normal PR
- PR with almost no comments/reviews

### PR with many comments and reviews
[34 people, 291 conversations - Java Christmas](https://github.com/h-beeen/java-christmas-6-h-beeen/pull/1)

This is Haebin's Christmas PR, which had the most conversations I've seen during the 6th pre-course.

```
Existing code: Elapsed Time: 3 seconds, 184 milliseconds, 657 microseconds, 667 nanoseconds
Only first problem solved: Elapsed Time: 2 seconds, 881 milliseconds, 774 microseconds, 0 nanoseconds
Both solved: Elapsed Time: 1 seconds, 461 milliseconds, 261 microseconds, 333 nanoseconds
```

### Normal PR

[11 people, 76 conversations - Java Lotto](https://github.com/woowacourse-precourse/java-lotto-6/pull/1067)

This is my pre-course PR.

```
Existing code: Elapsed Time: 1 seconds, 535 milliseconds, 113 microseconds, 375 nanoseconds
Only first problem solved: Elapsed Time: 1 seconds, 336 milliseconds, 732 microseconds, 375 nanoseconds
Both solved: Elapsed Time: 1 seconds, 53 milliseconds, 398 microseconds, 83 nanoseconds
```

### PR with almost no comments/reviews
[5 people, 15 conversations - Number Baseball Game](https://github.com/woowacourse-precourse/java-baseball-6/pull/1338)

This is also my pre-course PR. 🥲

```
Existing code: Elapsed Time: 1 seconds, 423 milliseconds, 599 microseconds, 792 nanoseconds
Only first problem solved: Elapsed Time: 0 seconds, 738 milliseconds, 485 microseconds, 167 nanoseconds
Both solved: Elapsed Time: 0 seconds, 870 milliseconds, 887 microseconds, 917 nanoseconds
```

As such, you can see that the time is reduced by an average of 30-50% through asynchronous requests.
When the maximum page is 1 and both are processed asynchronously, it can be seen that it is slightly slower.

Then, I will also verify multiple requests.

```
execute(() -> githubReviewProvider.getGithubPullRequestReviewInfoSync(baseBallUrl), "Existing code: ",20);
```

I will repeat it 20 times.

```
Existing code: Elapsed Time: 9 seconds, 693 milliseconds, 803 microseconds, 917 nanoseconds
Only first problem solved: Elapsed Time: 9 seconds, 569 milliseconds, 496 microseconds, 333 nanoseconds
Both solved: Elapsed Time: 9 seconds, 797 milliseconds, 58 microseconds, 125 nanoseconds
```

Surprisingly, the results are the same.
Isn't that strange? 

To check, I will print the thread name of each asynchronous request that is currently running.

```java
public static <T> CompletableFuture<T> supplyAsync(Supplier<T> supplier) {  
    return CompletableFuture.supplyAsync(() -> {  
        log.info("Running in thread: {}", Thread.currentThread().getName());  
        return supplier.get();  
    });  
}
```

```
[2024-11-09 18:45:18:12776] [ForkJoinPool.commonPool-worker-7] INFO  [corea.global.util.FutureUtil.lambda$supplyAsync$0:13] - Running in thread: ForkJoinPool.commonPool-worker-7 
[2024-11-09 18:45:18:12776] [ForkJoinPool.commonPool-worker-1] INFO  [corea.global.util.FutureUtil.lambda$supplyAsync$0:13] - Running in thread: ForkJoinPool.commonPool-worker-1 
[2024-11-09 18:45:18:12776] [ForkJoinPool.commonPool-worker-2] INFO  [corea.global.util.FutureUtil.lambda$supplyAsync$0:13] - Running in thread: ForkJoinPool.commonPool-worker-2 
[2024-11-09 18:45:18:12776] [ForkJoinPool.commonPool-worker-3] INFO  [corea.global.util.FutureUtil.lambda$supplyAsync$0:13] - Running in thread: ForkJoinPool.commonPool-worker-3 
[2024-11-09 18:45:18:12777] [ForkJoinPool.commonPool-worker-6] INFO  [corea.global.util.FutureUtil.lambda$supplyAsync$0:13] - Running in thread: ForkJoinPool.commonPool-worker-6 
[2024-11-09 18:45:18:12776] [ForkJoinPool.commonPool-worker-4] INFO  [corea.global.util.FutureUtil.lambda$supplyAsync$0:13] - Running in thread: ForkJoinPool.commonPool-worker-4 
[2024-11-09 18:45:18:12777] [ForkJoinPool.commonPool-worker-5] INFO  [corea.global.util.FutureUtil.lambda$supplyAsync$0:13] - Running in thread: ForkJoinPool.commonPool-worker-5 
[2024-11-09 18:45:18:12778] [ForkJoinPool.commonPool-worker-7] INFO  [corea.global.util.FutureUtil.lambda$supplyAsync$0:13] - Running in thread: ForkJoinPool.commonPool-worker-7 
[2024-11-09 18:45:18:12778] [ForkJoinPool.commonPool-worker-3] INFO  [corea.global.util.FutureUtil.lambda$supplyAsync$0:13] - Running in thread: ForkJoinPool.commonPool-worker-3 
[2024-11-09 18:45:18:12778] [ForkJoinPool.commonPool-worker-6] INFO  [corea.global.util.FutureUtil.lambda$supplyAsync$0:13] - Running in thread: ForkJoinPool.commonPool-worker-6 
[2024-11-09 18:45:18:12778] [ForkJoinPool.commonPool-worker-4] INFO  [corea.global.util.FutureUtil.lambda$supplyAsync$0:13] - Running in thread: ForkJoinPool.commonPool-worker-4
```

As such, you can see that only up to 7 threads are running in `ForkJoinPool.commonPool`.
So the time didn't change and came out similarly 🙂

Next, I will explain what `ForkJoinPool` is and how to improve performance even when multiple requests come in through thread management.

Thank you!
