---
title: "Speeding Up External (GitHub) Calls by About 30% Asynchronously (2) - Thread Tuning, Measurement"
author: 이영수
date: 2024-11-09T15:56:34.506Z
tags: ['Asynchronous', 'External API', 'Wooteco', 'Corea', 'Spring']
description: "Thread tuning and performance measurement methods"
image:
  path: https://velog.velcdn.com/images/dragonsu/post/ab1835c7-151a-4d97-abcf-e406d69893be/image.png
lang: en
permalink: /posts/speed-up-external-api-calls-by-30-asynchronously2-thread-tuning-measurement
---

> This post has been translated from Korean to English by Gemini CLI.

This content was written while implementing a way to reduce API call time for user experience in the [project](https://github.com/woowacourse-teams/2024-corea). 
If there are any incorrect contents or other methods, please leave a comment or contact me at `joyson5582@gmail.com`! 


---

This content continues from [# Speeding Up External (GitHub) Calls by About 30% Asynchronously (1) - Basic Logic](https://velog.io/@dragonsu/%EC%99%B8%EB%B6%80%EA%B9%83%ED%97%88%EB%B8%8C-%ED%98%B8%EC%B6%9C%EC%9D%84-%EB%B9%84%EB%8F%99%EA%B8%B0%EB%A1%9C-30-%EA%B0%80%EB%9F%89-%EB%B9%A0%EB%A5%B4%EA%B2%8C1-%EA%B8%B0%EB%B3%B8-%EB%A1%9C%EC%A7%81).

```
[2024-11-09 18:45:18:12776] [ForkJoinPool.commonPool-worker-7] INFO  [corea.global.util.FutureUtil.lambda$supplyAsync$0:13] - Running in thread: ForkJoinPool.commonPool-worker-7 
[2024-11-09 18:45:18:12776] [ForkJoinPool.commonPool-worker-1] INFO  [corea.global.util.FutureUtil.lambda$supplyAsync$0:13] - Running in thread: ForkJoinPool.commonPool-worker-1 
[2024-11-09 18:45:18:12776] [ForkJoinPool.commonPool-worker-2] INFO  [corea.global.util.FutureUtil.lambda$supplyAsync$0:13] - Running in thread: ForkJoinPool.commonPool-worker-2 
[2024-11-09 18:45:18:12776] [ForkJoinPool.commonPool-worker-3] INFO  [corea.global.util.FutureUtil.lambda$supplyAsync$0:13] - Running in thread: ForkJoinPool.commonPool-worker-3 
[2024-11-09 18:45:18:12777] [ForkJoinPool.commonPool-worker-6] INFO  [corea.global.util.FutureUtil.lambda$supplyAsync$0:13] - Running in thread: ForkJoinPool.commonPool-worker-6 
[2024-11-09 18:45:18:12776] [ForkJoinPool.commonPool-worker-4] INFO  [corea.global.util.FutureUtil.lambda$supplyAsync$0:13] - Running in thread: ForkJoinPool.commonPool-worker-4 
[2024-11-09 18:45:18:12777] [ForkJoinPool.commonPool-worker-5] INFO  [corea.global.util.FutureUtil.lambda$supplyAsync$0:13] - Running in thread: ForkJoinPool.commonPool-worker-5 
[2024-11-09 18:45:18:12778] [ForkJoinPool.commonPool-worker-7] INFO  [corea.global.util.FutureUtil.lambda$supplyAsync$0:13] - Running in thread: ForkJoinPool.commonPool-worker-7 
```

I confirmed that asynchronous operations were performed using 7 default threads provided by `ForkJoinPool.commonPool`.
Let's first learn about `ForkJoinPool`.
## ForkJoinPool

It is a framework introduced in Java 7.
It helps parallel processing by maximizing the use of all processor cores.

```
  Model Name:	MacBook Air
  Model Identifier:	Mac14,2
  Model Number:	Z15Y0002AKH/A
  Chip:	Apple M2
  Total Cores:	8 (4 performance and 4 efficiency)
```

My MacBook has a total of 8 cores, so it was using 7 threads!

> Why does it have core -1 threads?
> Leaving 1 core free can reduce competition between system tasks and application threads, and improve parallel processing performance.
> Limiting to core - 1 makes the system operate more stably and reduces task waiting time.

```java
Runtime.getRuntime().availableProcessors();  
ForkJoinPool.commonPool().getParallelism();
```

If you print both, you get 8 and 7.

Let's check if performance really degrades when the number is higher.
>Additionally, for more diverse tests, I tested with different lists of comments between 100 and 200.

```java
private <T> void execute(String text, int count) {  
    long startTime = System.nanoTime();  
    List<CompletableFuture<T>> futures = ary.stream()  
            .map(integer -> (CompletableFuture<T>) FutureUtil.supplyAsync(() -> githubReviewProvider.provideReviewInfo("https://github.com/woowacourse-precourse/java-racingcar-6/pull/" + integer)))  
            .toList();  
    CompletableFuture<Void> allOf = CompletableFuture.allOf(futures.toArray(new CompletableFuture[0]));  
    allOf.join(); // Wait until all requests are completed
    long endTime = System.nanoTime();  
    printElapsedTime(text, endTime - startTime);  
}
```


```
ForkedJoinPool count: 7
Existing code: Elapsed Time: 36 seconds, 614 milliseconds, 556 microseconds, 958 nanoseconds
Only first problem solved: Elapsed Time: 26 seconds, 993 milliseconds, 992 microseconds, 208 nanoseconds
Both solved: Elapsed Time: 25 seconds, 805 milliseconds, 255 microseconds, 291 nanoseconds
```


```
ForkedJoinPool count: 20
Existing code: Elapsed Time: 35 seconds, 821 milliseconds, 2 microseconds, 625 nanoseconds
Only first problem solved: Elapsed Time: 26 seconds, 53 milliseconds, 833 microseconds, 625 nanoseconds
Both solved: Elapsed Time: 25 seconds, 250 milliseconds, 377 microseconds, 334 nanoseconds
```

(The time difference doesn't seem to be significant.)

However, the above experiment is not very important.
The core of `ForkedJoinPool` is to divide tasks into small units (`Fork`), execute them in parallel, and combine the results (`Join`).
In other words, it is not meant to execute multiple network operations at once. - **Avoid any blocking in** **_ForkJoinTasks_.** [in Baeldung](https://www.baeldung.com/java-fork-join)
(`parallelStream()` uses this `ForkedJoinPool`.)

Then, what should I use to efficiently handle asynchronous operations when doing such tasks?

## ThreadPoolExecutor
Before looking at this class, let's learn about `ThreadPool`.

### ThreadPool

It is very inefficient to create and release threads every time you perform parallel operations.
-> This is because it is basically mapped to system-level resources.
(Of course, from Java 19, you can create virtual threads like `Thread.ofVirtual()`.)

Through a thread pool, you can use pre-created threads and keep them without deleting them.
If you write and submit code in a `parallel task form` to the thread pool, it executes and manages the tasks.

### Creation Method

You can create it simply by using a constructor.

```java
ThreadPoolExecutor executor = new ThreadPoolExecutor(
    2, // corePoolSize
    4, // maximumPoolSize
    60, // keepAliveTime
    TimeUnit.SECONDS, // keepAliveTime unit
    new ArrayBlockingQueue<>(10) // task waiting queue,
    new ThreadPoolExecutor.CallerRunsPolicy()); // rejection execution handler
);
```

This content was also learned in the [Tomcat Implementation Mission](https://github.com/woowacourse/java-http/pull/760).
- `corePoolSize`: The minimum number of threads in the pool - prevents time spent on creation by using pre-prepared threads.
- `maximumPoolSize`: The maximum number of threads that can be held - prevents too many threads from being created and occupying too many resources.
- `keepAliveTime`: The time a thread remains after a task - prevents time spent on thread deletion & creation.
- `timeUnit`: The unit of `keepAliveTime`.
- `blockingQueue`: A data structure that implements Queue - used because it provides the ability to put threads in a waiting state and wait until conditions are met when the queue is empty or full.
- `rejectedExecutionHandler`: A handler that specifies how to handle rejected executions.
    - `CallerRunsPolicy`: If Queue and Thread are all in a working state, the Main thread also performs the task. (Performs all 10 tasks)
    - `AbortPolicy`: If all are in a working state, throws `RejectedExecutionException`. (Performs only 4 + 2 tasks)
    - `DiscardPolicy`: If all are in a working state, silently rejects the task. (Performs only 4 + 2 tasks)
    - `DiscardOldPolicy`: If all are in a working state, removes and replaces the previously waiting task - the current Queue's tasks keep changing. (Performs only 4 + 2 tasks)

### ExecutorService?

There is `ExecutorService` that appears with the above contents.
It is an interface, and implementations like `ThreadPoolExecutor` and `ForkJoinPool` are also child classes of `AbstractExecutorService` that implement this interface.
It creates implementations using the `Executors` factory method. (Used when creating simply without needing specific settings)

```java
public static ExecutorService newFixedThreadPool(int nThreads) {
	return new ThreadPoolExecutor(nThreads, nThreads,
								  0L, TimeUnit.MILLISECONDS,
								  new LinkedBlockingQueue<Runnable>());
}
```

```java
public static ExecutorService newCachedThreadPool() {  
    return new ThreadPoolExecutor(0, Integer.MAX_VALUE,  
                                  60L, TimeUnit.SECONDS,  
                                  new SynchronousQueue<Runnable>());  
}
```

It can be created easily like this.
We will use `ThreadPoolExecutor` for more complex tuning.
### In Spring Bean

```java
@Bean
public Executor taskExecutor() {
    ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
    executor.setCorePoolSize(5);
    executor.setMaxPoolSize(10);
    executor.setQueueCapacity(25);
    executor.initialize();
    return executor;
}

===

public TaskService(@Qualifier("customExecutor") Executor customExecutor) {
	this.customExecutor = customExecutor;
}

@Async("customExecutor") // Specify a specific Executor
public void executeAsyncTask(int i) {
	...
}
```

It can be registered and injected as a bean like this.

## Performance Measurement

### Pre-configuration

First, let's measure the time again using a basic Thread Pool.

```java
@Bean(name = "apiExecutor")  
public Executor apiExecutor() {  
    ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();  
    executor.setCorePoolSize(10);  
    executor.setMaxPoolSize(100);  
    executor.setQueueCapacity(25);  
    executor.initialize();  
    return executor;  
}  
  
@Bean(name = "clientExecutor")  
public Executor clientExecutor() {  
    ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();  
    executor.setCorePoolSize(10);  
    executor.setMaxPoolSize(100);  
    executor.setQueueCapacity(25);  
    executor.initialize();  
    return executor;  
}
```

```java
public GithubReviewProvider(final GithubPullRequestReviewClient reviewClient,  
                            final GithubPullRequestCommentClient commentClient,  
                            final @Qualifier("apiExecutor") Executor executor) {  
    this.reviewClient = reviewClient;  
    this.commentClient = commentClient;  
    this.executor = executor;  
}

public GithubPullRequestCommentClient(RestClient restClient,  
                                      GithubPullRequestUrlExchanger githubPullRequestUrlExchanger,  
                                      GithubPersonalAccessTokenProvider githubPersonalAccessTokenProvider,  
                                      @Qualifier("clientExecutor")Executor executor) {  
    super(restClient, githubPullRequestUrlExchanger, githubPersonalAccessTokenProvider,executor);  
}
```

I configured and injected `Executor` as above.

```
[2024-11-09 23:34:34:14131] [clientExecutor-10] INFO  [corea.global.util.FutureUtil.lambda$supplyAsync$1:20] - Running in thread: clientExecutor-10 
[2024-11-09 23:34:34:14131] [apiExecutor-14] INFO  [corea.global.util.FutureUtil.lambda$supplyAsync$1:20] - Running in thread: apiExecutor-14 
```

If you check the logs, it successfully provides threads.

### Multiple Tests

Tests were conducted in two ways:
- Measure total time by executing each request synchronously.
```java
startTime = System.nanoTime();  
ary.forEach(integer -> githubReviewProvider.getGithubPullRequestReviewInfoSync(baseBallUrl)); 
endTime = System.nanoTime();  
printElapsedTime("Existing code: ", endTime - startTime);
```

- Measure total time by executing requests asynchronously at once.
```java
private <T> void executeAsync(String text) {  
    long startTime = System.nanoTime();  
    List<CompletableFuture<T>> futures = ary.stream()  
            .map(integer -> (CompletableFuture<T>) FutureUtil.supplyAsync(() -> githubReviewProvider.getGithubPullRequestReviewInfoAsync("https://github.com/woowacourse-precourse/java-racingcar-6/pull/" + integer)))  
            .toList();  
    CompletableFuture<Void> allOf = CompletableFuture.allOf(futures.toArray(new CompletableFuture[0]));  
    allOf.join();
    long endTime = System.nanoTime();  
    printElapsedTime(text, endTime - startTime);  
}
```

```
Existing code: Elapsed Time: 37 seconds, 226 milliseconds, 116 microseconds, 417 nanoseconds
Only first problem solved: Elapsed Time: 29 seconds, 496 milliseconds, 377 microseconds, 584 nanoseconds
Both solved: Elapsed Time: 27 seconds, 292 milliseconds, 174 microseconds, 42 nanoseconds

Existing code: Elapsed Time: 6 seconds, 385 milliseconds, 892 microseconds, 541 nanoseconds
Only first problem solved: Elapsed Time: 3 seconds, 164 milliseconds, 544 microseconds, 83 nanoseconds
Both solved: Elapsed Time: 3 seconds, 568 milliseconds, 894 microseconds, 125 nanoseconds
```

```
Existing code: Elapsed Time: 40 seconds, 564 milliseconds, 653 microseconds, 83 nanoseconds
Only first problem solved: Elapsed Time: 27 seconds, 4 milliseconds, 581 microseconds, 709 nanoseconds
Both solved: Elapsed Time: 28 seconds, 122 milliseconds, 420 microseconds, 667 nanoseconds

Existing code: Elapsed Time: 5 seconds, 969 milliseconds, 698 microseconds, 83 nanoseconds
Only first problem solved: Elapsed Time: 3 seconds, 35 milliseconds, 963 microseconds, 917 nanoseconds
Both solved: Elapsed Time: 3 seconds, 319 milliseconds, 663 microseconds, 208 nanoseconds
```

Results are as follows:

- First case: 26.68~33.41% reduction
- Second case: 44.13~49.16% reduction

(I'm not sure why solving only the first problem was shorter.. 🥲)
(I realized that the time difference was due to the Preflight request sent earlier. Most of them don't cause additional pagination, but rather increase the time.)

```java
@Bean(name = "apiExecutor")  
public Executor apiExecutor() {  
    ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();  
    executor.setCorePoolSize(20);  
    executor.setMaxPoolSize(50);  
    executor.setMaxPoolSize(100);  
    executor.setQueueCapacity(25);  
    executor.initialize();  
    return executor;  
}  
  
@Bean(name = "clientExecutor")  
public Executor clientExecutor() {  
    ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();  
    executor.setCorePoolSize(10);  
    executor.setMaxPoolSize(30);  
    executor.setQueueCapacity(50);  
    executor.initialize();  
    return executor;  
}
```

What if you change it like this?

```
Existing code: Elapsed Time: 39 seconds, 303 milliseconds, 886 microseconds, 125 nanoseconds
Only first problem solved: Elapsed Time: 29 seconds, 721 milliseconds, 726 microseconds, 334 nanoseconds
Both solved: Elapsed Time: 28 seconds, 156 milliseconds, 877 microseconds, 208 nanoseconds

Existing code: Elapsed Time: 5 seconds, 757 milliseconds, 605 microseconds, 500 nanoseconds
Only first problem solved: Elapsed Time: 2 seconds, 885 milliseconds, 556 microseconds, 875 nanoseconds
Both solved: Elapsed Time: 3 seconds, 560 milliseconds, 182 microseconds, 916 nanoseconds
```

You can see that there is no significant difference.

## Conclusion


Let's check the metrics before and after the introduction through Grafana.

![600](https://i.imgur.com/hhgczmf.png)

Response time became **33%** faster after asynchronous introduction, from 600ms to about 400ms.

![600](https://i.imgur.com/TNd2Xew.png)

Hip memory also shows no significant peaks.
(Of course, there may be CPU overhead issues, but I haven't confirmed this yet.)

Thus,
- How far to introduce asynchronous operations
- How much time efficiency is gained through asynchronous operations
- Whether there are heap memory or CPU issues when performing asynchronously

Each team should check these and introduce them as appropriate for their situation! 🙂

> I think user experience is always the top priority, but we need to compromise appropriately.
> (Because if the server crashes due to too many threads in the Thread Pool or infinite queues for excessive user experience, it would be even worse.)
