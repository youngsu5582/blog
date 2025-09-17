---
title: "Concurrency in a Single Application"
author: 이영수
date: 2025-02-14T09:43:06.369Z
tags: ['single application', 'concurrency', 'woowacourse', 'kotlin']
categories: ['Backend', 'Concurrency']
description: "Handling concurrency in a single Kopring application"
permalink: /posts/concurrency-in-a-single-application/
permalink: /posts/concurrency-in-a-single-application/
---

While studying how to handle concurrency in an application.
Of course, the answer is:
`Handling concurrency in multiple applications -> requires a distributed server that also handles single-instance processing -> elements like distributed locks and pessimistic locks become necessary.`
However, I wanted to learn about and summarize how to handle concurrency even in a single application.

### Testing Method

```kotlin
@Test  
fun `when multiple requests come in simultaneously, only one succeeds`() {  
    val results = ConcurrentTestUtil.concurrent(numberOfRequests = 20) {  
        lottoPurchaseService.purchase(  
            lottoPurchaseRequest = LottoPurchaseRequest(  
                purchaseType = PurchaseType.CARD,  
                currency = Currency.KRW,  
                amount = BigDecimal(1000),  
                paymentKey = "paymentKey",  
                orderId = "orderId"  
            ),  
            lottoPublishId = lottoPublishId,  
            authenticated = AuthenticatedMember("ID", "user@email.com")  
        )  
    }  

    results.successCount() shouldBe 1  
    results.failureCount(IllegalStateException::class) shouldBe 19  
}  

fun concurrent(numberOfRequests: Int = 10, wait: Long = 5, block: () -> Unit): ConcurrentResult {  
    val executor = Executors.newFixedThreadPool(numberOfRequests)  
    val latch = CountDownLatch(1)  // A latch to start all tasks simultaneously  
    val results = ConcurrentLinkedQueue<Result<Unit>>() // A concurrent collection to store the results of each task  
  
    // Create [numberOfRequests] Callable tasks  
    val tasks = (1..numberOfRequests).map {  
        Callable {  
            // Wait until the latch is released  
            latch.await()  
            try {  
                block()  
                results.add(Result.success(Unit))  
            } catch (e: Exception) {  
                results.add(Result.failure(e))  
            }  
        }  
    }  
    // Submit the tasks to the executor  
    tasks.forEach { executor.submit(it) }  
  
    // Release the latch so that all threads run simultaneously  
    latch.countDown()  
  
    // Wait for tasks to complete  
    executor.shutdown()  
    if (!executor.awaitTermination(wait, TimeUnit.SECONDS)) {  
        executor.shutdownNow()  
    }  
    return ConcurrentResult(results)  
}
```

I tested by measuring successes and failures like this, and also measuring how many failures occurred for a specific exception.

## Basic Logic

```kotlin
orderValidator.checkOrderValid(lottoPurchaseRequest.toOrderDataRequest())  
val purchase = purchaseProcessor.purchase(lottoPurchaseRequest.toPurchaseRequest())  
val lottoPublish = lottoPublisher.complete(lottoPublishId)  
val bill = lottoWriter.saveBill(purchase.getId(), lottoPublish.getId(), authenticated.memberId)  
return LottoBillData(  
    id = bill.getId()!!,  
    purchase = PurchaseData.from(purchase),  
    lottoPublish = LottoPublishData.from(lottoPublish)  
)
```

```kotlin
@Transaction  
@Write  
fun complete(publishId: Long): LottoPublish {  
    val lottoPublish = getLottoPublish(publishId)  
    lottoPublish.complete()  
    return lottoPublish  
}

// LottoPublish
fun complete() {  
    if (this.status != LottoPublishStatus.WAITING) {  
        throw IllegalStateException("Completion is only possible in the payment waiting state")  
    }  
    this.status = LottoPublishStatus.COMPLETE  
}
```

The key with logic like this is:
- Do not send multiple payment requests for a single request.
- Propagate to the DB and change the state only once.

## No Concurrency Handling

Without handling concurrency,

```kotlin
@Transaction  
@Write  
fun complete(publishId: Long): LottoPublish {  
    val lottoPublish = getLottoPublish(publishId)  
    lottoPublish.complete()  
    Thread.sleep(500)  
    return lottoPublish  
}

fun purchase(purchaseRequest: PurchaseRequest): Purchase {  
    val purchaseData = paymentProcessor.purchase(purchaseRequest, PurchaseProvider.TOSS)  
    val purchase = purchaseWriter.savePurchase(purchaseData)  
    Thread.sleep(1000)  
    return purchase  
}
```

Let's assume we have a 0.5-second wait at the DB level + a 1-second wait at the payment level.

```kotlin
Success count: 2, Failure count: 18
```

As you can see, 2 out of 20 requests succeed.

What if we increase the time to 3 seconds (`Thread.sleep(3000)`)?
```
Success count: 4, Failure count: 16
```
It increases to 4.

If a user gets frustrated and keeps pressing the request button multiple times, it can become a serious problem.

> Of course, most PG companies handle idempotency and concurrency themselves (preventing double payments).
> However, it's a problem for our DB and logic to process it twice, and also to send requests to an external API two to n times, so we need to solve it.

## With Concurrency Handling

The time difference between all the elements below is not significant.
Anyway, once the first request is finished, an exception will occur from then on because the DB value is different. (Excluding Lock-Free - CAS)

### Synchronized

It took `2 sec 270 ms`.

```kotlin
val lock = locks.computeIfAbsent(lottoPublishId) { Any() }  
synchronized(lock) {  
    orderValidator.checkOrderValid(lottoPurchaseRequest.toOrderDataRequest())  
    val purchase = purchaseProcessor.purchase(lottoPurchaseRequest.toPurchaseRequest())  
    val lottoPublish = lottoPublisher.complete(lottoPublishId)  
    val bill = lottoWriter.saveBill(purchase.getId(), lottoPublish.getId(), authenticated.memberId)  
    return LottoBillData(  
        id = bill.getId()!!,  
        purchase = PurchaseData.from(purchase),  
        lottoPublish = LottoPublishData.from(lottoPublish)  
    )  
}
```

```kotlin
Thread: ConcurrentTestUtil-thread-2 (ID: 71, State: BLOCKED)
    at app//lotto.service.LottoPurchaseService.purchase(LottoPurchaseService.kt:53)
    at app//lotto.service.LottoPurchaseServiceConfirmTest$PurchaseCase.when_multiple_requests_come_in_simultaneously_only_one_succeeds$lambda$1(LottoPurchaseServiceConfirmTest.kt:87)
    at app//lotto.service.LottoPurchaseServiceConfirmTest$PurchaseCase$$Lambda/0x0000000701dc1118.invoke(Unknown Source)
    at app//ConcurrentTestUtil.concurrent$lambda$1$lambda$0(ConcurrentTestUtil.kt:28)
    at app//ConcurrentTestUtil$$Lambda/0x0000000701dc1558.call(Unknown Source)
    at java.base@21.0.4/java.util.concurrent.FutureTask.run(FutureTask.java:317)
    at java.base@21.0.4/java.util.concurrent.ThreadPoolExecutor.runWorker(ThreadPoolExecutor.java:1144)
    at java.base@21.0.4/java.util.concurrent.ThreadPoolExecutor$Worker.run(ThreadPoolExecutor.java:642)
    at java.base@21.0.4/java.lang.Thread.runWith(Thread.java:1596)
    at java.base@21.0.4/java.lang.Thread.run(Thread.java:1583)
```

The remaining threads wait in a BLOCKED state.

### compareAndSet

```kotlin
private val publishCompletionStatus = ConcurrentHashMap<Long, AtomicBoolean>()

fun purchase(  
    lottoPurchaseRequest: LottoPurchaseRequest,  
    lottoPublishId: Long,  
    authenticated: Authenticated  
): LottoBillData {  
    val isCompleted = publishCompletionStatus.computeIfAbsent(lottoPublishId) { AtomicBoolean(false) }  
  
    if (!isCompleted.compareAndSet(false, true)) {  
        throw IllegalStateException("Payment is already in progress.")  
    }  
  
    orderValidator.checkOrderValid(lottoPurchaseRequest.toOrderDataRequest())  
    val purchase = purchaseProcessor.purchase(lottoPurchaseRequest.toPurchaseRequest())  
    val lottoPublish = lottoPublisher.complete(lottoPublishId)  
    val bill = lottoWriter.saveBill(purchase.getId(), lottoPublish.getId(), authenticated.memberId)  
    return LottoBillData(  
        id = bill.getId()!!,  
        purchase = PurchaseData.from(purchase),  
        lottoPublish = LottoPublishData.from(lottoPublish)  
    )  
}
```

It took `2 sec 207 ms`.

Before making a request, if changing from false to true in the `ConcurrentHashMap` fails,
it is implemented to throw an exception so that only one thread passes through and executes.

Execution time? It takes `1 sec 805 ms` and passes! Very fast.
This type of concurrency handling is called the `Lock-Free` method.

#### Lock-Free

It is an algorithm that guarantees that even if called concurrently from multiple threads, one call will always complete within a specific unit of time.

The method above is called `CAS (Compare And Set)`.
It returns true if the value is changed, and false if it fails to change the value.

```
1. Read the existing value and calculate the value to be changed.
2. If the existing value is the same as the current memory, replace it with the value to be changed.
3. If the existing value is different from the current memory value, do not change the value or retry from 1.
```

At this point, I became curious if it becomes a problem when there are many competing elements.

```kotlin
ConcurrentTestUtil.concurrent(numberOfRequests = 1000, wait = 1000L)
```

If we have 1000 threads competing with each other,

```kotlin
===== Executor thread dump after 1 second =====
===== EXECUTOR THREAD DUMP =====
Thread: ConcurrentTestUtil-thread-1 (ID: 70, State: TIMED_WAITING)
    at java.base@21.0.4/java.lang.Thread.sleep0(Native Method)
    at java.base@21.0.4/java.lang.Thread.sleep(Thread.java:509)
    at app//purchase.domain.implementation.PurchaseProcessor.purchase(PurchaseProcessor.kt:22)
    at app//lotto.service.LottoPurchaseService.purchase(LottoPurchaseService.kt:79)
    at app//lotto.service.LottoPurchaseServiceConfirmTest$PurchaseCase.when_multiple_requests_come_in_simultaneously_only_one_succeeds$lambda$1(LottoPurchaseServiceConfirmTest.kt:87)
    at app//lotto.service.LottoPurchaseServiceConfirmTest$PurchaseCase$$Lambda/0x0000009801dd5560.invoke(Unknown Source)
    at app//ConcurrentTestUtil.concurrent$lambda$1$lambda$0(ConcurrentTestUtil.kt:28)
    at app//ConcurrentTestUtil$$Lambda/0x0000009801dd59a0.call(Unknown Source)
    at java.base@21.0.4/java.util.concurrent.FutureTask.run(FutureTask.java:317)
    at java.base@21.0.4/java.util.concurrent.ThreadPoolExecutor.runWorker(ThreadPoolExecutor.java:1144)
    at java.base@21.0.4/java.util.concurrent.ThreadPoolExecutor$Worker.run(ThreadPoolExecutor.java:642)
    at java.base@21.0.4/java.lang.Thread.runWith(Thread.java:1596)
    at java.base@21.0.4/java.lang.Thread.run(Thread.java:1583)

===== END EXECUTOR THREAD DUMP =====
====================================
```

The competition ends quickly without any problems, and all threads terminate.

https://stackoverflow.com/questions/47569600/is-cas-a-loop-like-spin

This is explained in detail here.

- CAS uses `cmpxchg` to compare and change at the same time (+ guarantees single-threadedness).
- CAS is a single operation that succeeds or fails at once - does not include a separate spin loop.

> The ABA problem can occur in Lock-Free (it checks if the memory value has changed, but in the meantime, it might have changed and then changed back to the original value).
> I don't think this is a factor to consider for about 10 items and a Boolean change.

In other words, since other threads are processed quickly after the operation without having to wait, the time is very short and the performance is high.
### Stamped Lock

```kotlin
val stamp = stampedLock.writeLock()  
try {  
    orderValidator.checkOrderValid(lottoPurchaseRequest.toOrderDataRequest())  
    val purchase = purchaseProcessor.purchase(lottoPurchaseRequest.toPurchaseRequest())  
    val lottoPublish = lottoPublisher.complete(lottoPublishId)  
    val bill = lottoWriter.saveBill(purchase.getId(), lottoPublish.getId(), authenticated.memberId)  
    return LottoBillData(  
        id = bill.getId()!!,  
        purchase = PurchaseData.from(purchase),  
        lottoPublish = LottoPublishData.from(lottoPublish)  
    )  
} finally {  
    stampedLock.unlockWrite(stamp)  
}
```

It took `2 sec 349 ms`.

Features of `Stamped Lock`:

- Three lock modes are supported - `write lock`, `read lock`, `optimistic read lock`.
- It can be released based on a token called `stamp`.
- Lock conversion is easy - can convert from a read lock to a write lock.

You can get high concurrency and performance by allowing optimistic reads in an environment where there are many read operations and relatively few write operations.

```kotlin
Thread: ConcurrentTestUtil-thread-6 (ID: 75, State: WAITING)
    at java.base@21.0.4/jdk.internal.misc.Unsafe.park(Native Method)
    at java.base@21.0.4/java.util.concurrent.locks.LockSupport.park(LockSupport.java:221)
    at java.base@21.0.4/java.util.concurrent.locks.StampedLock.acquireWrite(StampedLock.java:1251)
    at java.base@21.0.4/java.util.concurrent.locks.StampedLock.writeLock(StampedLock.java:480)
    at app//lotto.service.LottoPurchaseService.purchase(LottoPurchaseService.kt:97)
    at app//lotto.service.LottoPurchaseServiceConfirmTest$PurchaseCase.when_multiple_requests_come_in_simultaneously_only_one_succeeds$lambda$1(LottoPurchaseServiceConfirmTest.kt:87)
    at app//lotto.service.LottoPurchaseServiceConfirmTest$PurchaseCase$$Lambda/0x0000000601dbf7e8.invoke(Unknown Source)
    at app//ConcurrentTestUtil.concurrent$lambda$1$lambda$0(ConcurrentTestUtil.kt:28)
    at app//ConcurrentTestUtil$$Lambda/0x0000000601dbfc28.call(Unknown Source)
    at java.base@21.0.4/java.util.concurrent.FutureTask.run(FutureTask.java:317)
    at java.base@21.0.4/java.util.concurrent.ThreadPoolExecutor.runWorker(ThreadPoolExecutor.java:1144)
    at java.base@21.0.4/java.util.concurrent.ThreadPoolExecutor$Worker.run(ThreadPoolExecutor.java:642)
    at java.base@21.0.4/java.lang.Thread.runWith(Thread.java:1596)
    at java.base@21.0.4/java.lang.Thread.run(Thread.java:1583)
```

The rest wait in a WAITING state.

Re-entry is not possible.
If you try to acquire another lock while using the same `StampedLock`, it will be BLOCKED, resulting in a DEADLOCK.

```kotlin
stampedLock.unlockWrite(stamp+1)  

public void unlockWrite(long stamp) {
    ...
}
```

If you intentionally change it and release it?
This also results in a DEADLOCK.

### ReentrantLock

```kotlin
fun purchase(  
    lottoPurchaseRequest: LottoPurchaseRequest,  
    lottoPublishId: Long,  
    authenticated: Authenticated  
): LottoBillData {  
    val lock = locks.computeIfAbsent(lottoPublishId) { ReentrantLock() }  
    return lock.withLock {  
        orderValidator.checkOrderValid(lottoPurchaseRequest.toOrderDataRequest())  
        val lottoPublish = lottoPublisher.complete(lottoPublishId)  
        val purchase = purchaseProcessor.purchase(lottoPurchaseRequest.toPurchaseRequest())  
        val bill = lottoWriter.saveBill(purchase.getId(), lottoPublish.getId(), authenticated.memberId)  
        return LottoBillData(  
            id = bill.getId()!!,  
            purchase = PurchaseData.from(purchase),  
            lottoPublish = LottoPublishData.from(lottoPublish)  
        )  
    }  
}
```

It took `2 sec 349 ms`.

It allows for more detailed and flexible control than a synchronized block (`synchronized`).

- Explicit lock control is possible (`lock`, `unlock`).
- Re-entry is possible in the same thread (the same lock can be acquired multiple times, and must be released as many times as it was acquired).
- Through fairness mode, it is possible to assign to threads in the queue in the order they were requested.

```kotlin
Thread: ConcurrentTestUtil-thread-20 (ID: 89, State: WAITING)
    at java.base@21.0.4/jdk.internal.misc.Unsafe.park(Native Method)
    at java.base@21.0.4/java.util.concurrent.locks.LockSupport.park(LockSupport.java:221)
    at java.base@21.0.4/java.util.concurrent.locks.AbstractQueuedSynchronizer.acquire(AbstractQueuedSynchronizer.java:754)
    at java.base@21.0.4/java.util.concurrent.locks.AbstractQueuedSynchronizer.acquire(AbstractQueuedSynchronizer.java:990)
    at java.base@21.0.4/java.util.concurrent.locks.ReentrantLock$Sync.lock(ReentrantLock.java:153)
    at java.base@21.0.4/java.util.concurrent.locks.ReentrantLock.lock(ReentrantLock.java:322)
    at app//lotto.service.LottoPurchaseService.purchase(LottoPurchaseService.kt:125)
    at app//lotto.service.LottoPurchaseServiceConfirmTest$PurchaseCase.when_multiple_requests_come_in_simultaneously_only_one_succeeds$lambda$1(LottoPurchaseServiceConfirmTest.kt:87)
    at app//lotto.service.LottoPurchaseServiceConfirmTest$PurchaseCase$$Lambda/0x0000000601dd7378.invoke(Unknown Source)
    at app//ConcurrentTestUtil.concurrent$lambda$1$lambda$0(ConcurrentTestUtil.kt:28)
    at app//ConcurrentTestUtil$$Lambda/0x0000000601dd77b8.call(Unknown Source)
    at java.base@21.0.4/java.util.concurrent.FutureTask.run(FutureTask.java:317)
    at java.base@21.0.4/java.util.concurrent.ThreadPoolExecutor.runWorker(ThreadPoolExecutor.java:1144)
    at java.base@21.0.4/java.util.concurrent.ThreadPoolExecutor$Worker.run(ThreadPoolExecutor.java:642)
    at java.base@21.0.4/java.lang.Thread.runWith(Thread.java:1596)
    at java.base@21.0.4/java.lang.Thread.run(Thread.java:1583)
```

The rest wait in a WAITING state.

---

## Point of Consideration

```kotlin
orderValidator.checkOrderValid(lottoPurchaseRequest.toOrderDataRequest())  
val lottoPublish = lottoPublisher.complete(lottoPublishId)  
val purchase = purchaseProcessor.purchase(lottoPurchaseRequest.toPurchaseRequest())  
val bill = lottoWriter.saveBill(purchase.getId(), lottoPublish.getId(), authenticated.memberId)  
return LottoBillData(  
    id = bill.getId()!!,  
    purchase = PurchaseData.from(purchase),  
    lottoPublish = LottoPublishData.from(lottoPublish)  
)
```

In code like this, should `judging payment as successful` + `reflecting in DB` be done before or after the payment?

To prevent sending the payment again by reflecting it in the DB, `complete` must come before `purchase`.
However, fundamentally, you have to send a query to the DB even if the payment has been made.

From this perspective, it seems that intentional idempotency handling from the method entry point, like `Lock-Free`, is also necessary.
Next, I plan to try handling concurrency on multiple servers.
