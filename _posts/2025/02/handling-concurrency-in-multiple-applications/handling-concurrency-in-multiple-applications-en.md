---
title: "Handling Concurrency in Multiple Applications"
author: 이영수
date: 2025-02-25T15:15:48.141Z
tags: ['concurrency', 'idempotency', 'pessimistic lock']
categories: ['Backend', 'Concurrency']
description: "Conditional Updates, Unique Indexes, Pessimistic Locking, Idempotency"
permalink: /posts/handling-concurrency-in-multiple-applications/
image:
  path: https://velog.velcdn.com/images/dragonsu/post/da3193d2-99cd-4f7f-ba6d-fafd50777d1d/image.webp
---
> This post covers learning about concurrency in multiple applications.
If you find any mistakes, please let me know at joyson5582@gmail.com or in the comments 🙂

## Setup

This time, let's not just test on the service level, but run an actual server and test it.

This is because while the service layer can be tested in a single application, it cannot guarantee that concurrency will occur across multiple servers.

For this, I used `docker-compose` and `nginx`.

```conf
upstream lotto_backend {
    server lotto-back-1:8080;
    server lotto-back-2:8080;
    server lotto-back-3:8080;
    server lotto-back-4:8080;
}

server {
    listen 80;
    server_name localhost;

    location / {
        proxy_pass http://lotto_backend/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

```yml
lotto-back-1:
  build:
    context: ../
  container_name: lotto-back-1
  ports:
    - "8081:8080"
  depends_on:
    lotto-mysql:
      condition: service_healthy
  volumes:
    - ../build/libs/spring-lotto-0.0.1-SNAPSHOT.jar:/app/app.jar
  environment:
    SERVER_NAME: "lotto-back-1"
    SPRING_PROFILES_ACTIVE: dev
  networks:
    - app-network
  deploy:
    resources:
      limits:
        cpus: '0.5'
        memory: '512M'
```

I ran four servers with the same file.
- Identified servers via `SERVER_NAME`
- Limited CPU and MEMORY via `limits`

```
for i in {1..20}; do curl -s http://localhost:8080/ping; done

{"success":true,"status":200,"message":"ok","data":"lotto-back-1"}
{"success":true,"status":200,"message":"ok","data":"lotto-back-1"}
{"success":true,"status":200,"message":"ok","data":"lotto-back-2"}
...
{"success":true,"status":200,"message":"ok","data":"lotto-back-3"}
{"success":true,"status":200,"message":"ok","data":"lotto-back-4"}
{"success":true,"status":200,"message":"ok","data":"lotto-back-1"}
```

Requests are distributed in a round-robin fashion.

```typescript
const order = http.post(`${baseUrl}/api/orders`, orderPayload, {
  headers: { "Content-Type": "application/json" },
});

check(order, {
  "Order creation request successful": (r) => r.status === 200,
});

// On successful order creation, extract lottoPublishId and orderId from the response JSON
let orderData = order.json().data || {};
let lottoPublishId = orderData.lottoPublishId;

// Wait for payment process
sleep(0.8);

// Proceed with payment approval
const paymentPayload = JSON.stringify({
  lottoPublishId: orderData.lottoPublishId,
  purchaseHttpRequest: {
    orderId: orderData.orderId,
    paymentKey: orderData.orderId,
  },
});

for (let i = 0; i < 5; i++) {
  requests.push([
    "POST",
    `${baseUrl}/api/tickets`,
    paymentPayload,
    {
      headers: {
        "Content-Type": "application/json",
    },
  }
]);
}

const responses = http.batch(requests);
```

After sending the order creation API, I send the payment approval API.

> Since I can't send a real request, I use the order ID as the PaymentKey and send it to the server.

- `http.batch`: A feature provided by k6 that allows a single VU to open multiple concurrent socket connections and send multiple requests in parallel. (Expecting concurrency testing)

With this setup and test script, I assumed a situation where `a single user presses the request button multiple times, causing concurrency`.

I also bypassed the code a bit for testing.

```kotlin
orderValidator.checkOrderValid(lottoPurchaseRequest.toOrderDataRequest())
lottoPublisher.pending(lottoPublishId)
val purchase = purchaseProcessor.purchase(lottoPurchaseRequest.toPurchaseRequest())
val lottoPublish = lottoPublisher.complete(lottoPublishId)
val bill = lottoWriter.saveBill(purchase.getId(),lottoPublishId, authenticated.memberId)
return LottoBillData(
    id = bill.getId()!!,
    purchase = PurchaseData.from(purchase),
    lottoPublish = LottoPublishData.from(lottoPublish)
)
```

Since I can't send a real request from the existing service code,

```kotlin
// purchaseProcessor.purchase part

class TossPaymentFakeClient(
    private val jdbcTemplate: JdbcTemplate
) : PaymentClient {
    override fun process(request: PurchaseRequest): PurchaseData {
        ifCustomHeaderThrowException()
        Thread.sleep(Random.nextLong(100, 500)) 
        jdbcTemplate.update("INSERT INTO purchase_key (payment_key) VALUES (?)", request.paymentKey)
        return PurchaseData(
            totalAmount = request.amount,
            paymentKey = request.paymentKey,
            orderId = request.orderId,
            status = PurchaseStatus.SUCCESS,
            purchaseProvider = PurchaseProvider.TOSS,
            method = PaymentMethod.CARD,
        )
    }
}
```

I created a fake object and implemented it to wait for a random amount of time.
Additionally, to check if duplicate payment requests are coming in,

```sql
* CREATE TABLE purchase_key (
*     payment_key VARCHAR(50) NOT NULL,
*     PRIMARY KEY (payment_key)
* );
```

I created a table so that if a duplicate INSERT occurs, it returns a 500 status code with a `DuplicateKeyException`.

```ts
responses.forEach((res, idx) => {
  if (res.status === 200) {
    successCount++;
  } else if (res.status === 400) {
    badRequestCount++;
  } else if (res.status === 500){
    concurrencyCount++;
  }
});

// Desired condition: "only 1 request is 200, the other 4 are 400"check({
  successCount,
  badRequestCount,
}, {
  "exactly 1 success and 4 bad requests": (obj) =>
    obj.successCount === 1 && obj.badRequestCount === 4,
});
```

The purpose of this test is to make only one request return 200, and the rest return 400 or be rejected.

## Existing Concurrency

```kotlin
val isCompleted = publishCompletionStatus.computeIfAbsent(lottoPublishId) { AtomicBoolean(false) }
if (!isCompleted.compareAndSet(false, true)) {
    throw IllegalStateException("Payment is already in progress.")
}

orderValidator.checkOrderValid(lottoPurchaseRequest.toOrderDataRequest())
lottoPublisher.pending(lottoPublishId)
val purchase = purchaseProcessor.purchase(lottoPurchaseRequest.toPurchaseRequest())
val lottoPublish = lottoPublisher.complete(lottoPublishId)
val bill = lottoWriter.saveBill(purchase.getId(),lottoPublishId, authenticated.memberId)
return LottoBillData(
    id = bill.getId()!!,
    purchase = PurchaseData.from(purchase),
    lottoPublish = LottoPublishData.from(lottoPublish)
)
```

If we run the test using the existing concurrency as is,

```sh
//console.log(successCount+"\t"+badRequestCount+"\t"+concurrencyCount);

INFO[0015] 1	1	3                                         source=console
INFO[0016] 1	3	1                                         source=console
INFO[0017] 1	4	0                                         source=console
INFO[0017] 1	2	2                                         source=console
INFO[0017] 1	3	1                                         source=console
INFO[0018] 1	1	3                                         source=console
INFO[0018] 1	3	1                                         source=console
```

It fails indiscriminately.

## Solving Concurrency

### Conditional Update

This method may be somewhat unfamiliar.
I also just thought of it and applied it this time.
When you send an UPDATE query to the DB, an `X LOCK` is automatically applied.
So, other transactions cannot access that record at the same time -> the state changes, so other elements can access it.

```kotlin
    @Modifying
    @Transactional
    @Query("UPDATE LottoPublish lp SET lp.status = :newStatus WHERE lp.id = :id AND lp.status = :oldStatus")
    fun updateStatus(
        @Param("id") id: Long,
        @Param("newStatus") newStatus: LottoPublishStatus,
        @Param("oldStatus") oldStatus: LottoPublishStatus
    ): Int
```

```kotlin
    @Transaction
    @Write
    fun pending(publishId: Long): LottoPublish {
        val lottoPublish = getLottoPublish(publishId)
        val changed = 
            lottoPublishRepository.updateStatus(publishId, LottoPublishStatus.PENDING, LottoPublishStatus.WAITING)
        if (changed == 0) {
            throw IllegalStateException("Completion is only possible in the payment waiting state")
        }
        return lottoPublish
    }
```

So, if you change the state like this and there are no changed values,
it is treated as a failure.

```
INFO[0017] 1	4	0                                         source=console
INFO[0017] 1	4	0                                         source=console
INFO[0018] 1	4	0                                         source=console
INFO[0018] 1	4	0                                         source=console
```

> http_req_duration..............: avg=212.02ms min=16.39ms med=118.16ms max=2.09s  p(90)=480.78ms p(95)=599.08ms
> { expected_response:true }...: avg=309.25ms min=16.39ms med=267.2ms  max=1.35s  p(90)=594.93ms p(95)=712.15ms

You can think of it as a kind of CAS (Compare And Swap) that the DB does for you.
### DB UNIQUE

For testing,

```sql
* CREATE TABLE purchase_key (
*     payment_key VARCHAR(50) NOT NULL,
*     PRIMARY KEY (payment_key)
* );
```

A format like `jdbcTemplate.update("INSERT INTO purchase_key (payment_key) VALUES (?)", request.paymentKey)`
is also a valid way to solve concurrency.

This is because, before sending the payment, it ensures that the payment is processed only in one request through an INSERT into the DB.
(The rest receive an exception and return a failure.)

```kotlin
try {
    jdbcTemplate.update("INSERT INTO purchase_key (payment_key) VALUES (?)", request.paymentKey)
}catch (e : DuplicateKeyException){
    throw PurchaseException(PurchaseExceptionCode.ALREADY_PROCESS,e)
}
```

If a duplicate key exception occurs when INSERTing data before the payment logic, it is judged that some other request is already inserting data and processing, and an exception is thrown.

```
//console.log(successCount+"\t"+badRequestCount+"\t"+concurrencyCount);

INFO[0012] 1	4	0                                         source=console
INFO[0012] 1	4	0                                         source=console
INFO[0013] 1	4	0                                         source=console
INFO[0013] 1	4	0                                         source=console
INFO[0014] 1	4	0                                         source=console
INFO[0014] 1	4	0                                         source=console
INFO[0014] 1	4	0                                         source=console
INFO[0015] 1	4	0                                         source=console
```

In the case of concurrent requests,
it throws a `Caused by: org.springframework.dao.DuplicateKeyException: PreparedStatementCallback; SQL [INSERT INTO purchase_key (payment_key) VALUES (?)];
Duplicate entry '963b5667-ddd4-4235-bc99-02470261739b' for key 'purchase_key.PRIMARY'` error.

And if the payment is completed and reflected in the DB,

```kotlin
fun pending() {
    if (this.status != LottoPublishStatus.WAITING) {
        throw IllegalStateException("Completion is only possible in the payment waiting state")
    }
    this.status = LottoPublishStatus.PENDING
}
```

Then, the concurrent requests that came in after that will throw an exception at this point.
As we intended, we get 1 success and 4 intended exceptions, ensuring that the request is sent to the external payment API only once.

### DB LOCK

This is solved through optimistic and pessimistic locking.

#### Optimistic Lock

```kotlin
@Version
private var version: Long? = null
```

When trying to modify,
JPA automatically checks if the entity-based version is the same + replaces the version.

```kotlin
@Lock(LockModeType.OPTIMISTIC)
@Query("select lp from LottoPublish lp where lp.id = :id")
fun findByIdWithOptimistic(@Param("id") id: Long): LottoPublish?
```

```
//console.log(successCount+"\t"+badRequestCount+"\t"+concurrencyCount);

INFO[0017] 0	5	0                                         source=console
INFO[0018] 0	3	2                                         source=console
INFO[0018] 0	4	1                                         source=console
INFO[0018] 0	4	1                                         source=console
INFO[0018] 0	2	3                                         source=console
INFO[0019] 0	3	2                                         source=console
INFO[0019] 0	5	0                                         source=console
INFO[0019] 0	4	1                                         source=console
INFO[0020] 0	2	3                                         source=conso
```

It fails even more miserably.

`ObjectOptimisticLockingFailureException: Row was updated or deleted by another transaction (or unsaved-value mapping was incorrect`
`StaleObjectStateException: Row was updated or deleted by another transaction (or unsaved-value mapping was incorrect)`

Both occur.

```kotlin
@Transaction
@Write
fun pending(publishId: Long): LottoPublish {
    val maxAttempts = 3
    for (attempt in 1..maxAttempts) {
        try {
            val lottoPublish = getLottoPublish(publishId)
            lottoPublish.pending()
            return lottoPublish
        } catch (e: StaleObjectStateException) {
            if (attempt == maxAttempts) {
                throw IllegalArgumentException("A concurrent request occurred while changing the PENDING state. The number of retries has been exceeded.", e)
            }
            Thread.sleep(100)
        }
    }
    throw IllegalStateException("Unexpected error during pending()")
}
```

Even if you catch the concurrency exception and retry,

```
INFO[0015] 1	4	0                                         source=console
INFO[0016] 1	0	4                                         source=console
INFO[0016] 1	2	2                                         source=console
INFO[0016] 1	1	3                                         source=console
INFO[0016] 1	1	3                                         source=console
INFO[0017] 1	4	0                                         source=console
INFO[0018] 1	2	2                                         source=console
```

it is uncertain.

> I wondered, `Why does the exception occur without being caught?`
> I think it's because the state changes in the persistence context managed by JPA, and when it tries to reflect this, it reflects it, so it's not caught.

```kotlin
fun pending() {
    if (this.status != LottoPublishStatus.WAITING) {
        throw IllegalStateException("Completion is only possible in the payment waiting state")
    }
    this.status = LottoPublishStatus.PENDING
}
```

Optimistic locking should be used when you assume that there will not be many conflicts in the first place.
If error handling is required and there are many concurrent accesses, more resources may be consumed in error handling and control.

Ultimately, it may not be possible to clearly detect the entity in only one request.

#### Pessimistic Lock

```kotlin
@Lock(LockModeType.PESSIMISTIC_WRITE)
@Query("select lp from LottoPublish lp where lp.id = :id")
fun findByIdWithOptimistic(@Param("id") id: Long): LottoPublish?
```

When querying, it acquires a lock from the DB and processes it.
It uses an exclusive lock (write lock) to ensure that other connections cannot write to that entity.

```
INFO[0016] 1	4	0                                         source=console
INFO[0016] 1	4	0                                         source=console
INFO[0016] 1	4	0                                         source=console
INFO[0016] 1	4	0                                         source=console
INFO[0017] 1	4	0                                         source=console
INFO[0017] 1	4	0                                         source=console
```

It succeeds as intended through locking.

`select lp1_0.id,lp1_0.issued_at,lp1_0.lotto_round_info_id,lp1_0.status from lotto_publish lp1_0 where lp1_0.id=2758 for update`

```sql
| 527 | lotto | 172.19.0.9:43224  | lotto | Query   |    0 | statistics | select lp1_0.id,lp1_0.issued_at,lp1_0.lotto_round_info_id,lp1_0.status from lotto_publish lp1_0 where lp1_0.id=2726 for update |
| 528 | lotto | 172.19.0.8:46378  | lotto | Query   |    0 | statistics | select lp1_0.id,lp1_0.issued_at,lp1_0.lotto_round_info_id,lp1_0.status from lotto_publish lp1_0 where lp1_0.id=2726 for update |
```

So, in one connection,

```kotlin
fun pending() {
    if (this.status != LottoPublishStatus.WAITING) {
        throw IllegalStateException("Completion is only possible in the payment waiting state")
    }
    this.status = LottoPublishStatus.PENDING
}
```

When the state is changed and committed, the acquired lock is released.
Even if the other elements acquire the lock, since the state has changed, it will cause an `IllegalStateException("Completion is only possible in the payment waiting state")`.

At this time, if you think it's inefficient for other connections to keep holding the lock after one connection has changed the state,

`select lp1_0.id,lp1_0.issued_at,lp1_0.lotto_round_info_id,lp1_0.status from lotto_publish lp1_0 where lp1_0.id=2858 and lp1_0.status='WAITING' for update`

If you put the state in the WHERE clause, one connection can receive it, change the state, and then the other connections will not be able to acquire the lock.

```kotlin
private fun getLottoPublish(publishId: Long, status: LottoPublishStatus): LottoPublish {
    return lottoPublishRepository.findByIdWithOptimistic(publishId, status)
        ?: throw IllegalArgumentException("Not Exist Publish")
}
```

`java.lang.IllegalArgumentException: Not Exist Publish` occurs.
Anyway, since it's in the form of query -> data conversion -> commit, the lock acquisition time is also very low.

> At this time, let's be sure to put an index on the conditional statement.
> For performance improvement and for index locking instead of the record itself.

```sql
SELECT *
FROM lotto_publish
WHERE id = 2726
  AND status = 'COMPLETE'
FOR UPDATE;
```

It waits until `SQL Error [1205] [40001]: Lock wait timeout exceeded; try restarting transaction` and then throws an exception.

You can get the information below through the `SHOW ENGINE INNODB STATUS\G` command.

```
------------
TRANSACTIONS
------------
...
RECORD LOCKS space id 31 page no 10 n bits 352 index PRIMARY of table `lotto`.`lotto_publish` trx id 36386 
lock_mode X locks rec but not gap waiting

```

- Uses an exclusive lock on the PRIMARY index.
- It is not a Next-Key Lock or a Gap Lock.

> Of course, DDL such as `CREATE INDEX idx_id ON lotto_publish(id);` is not possible during a LOCK.

However, using DB resources is quite risky.
The DB should only be used to retrieve resources intact, but it is burdened with unnecessary elements like LOCKs. (Unexpected lock contention can also occur.)

### Idempotency

What is idempotency?

It is the expectation that an API will produce the same result every time it is called.
POST requests are generally not guaranteed to be idempotent.
-> Because the result changes with every request.

Our payment request is also a request to `proceed with payment` every time, so the result cannot be guaranteed.
So, we implement idempotency to ensure that the same request produces the same result.

> You can make it more concise with filters or annotations, but here we will proceed in a straightforward manner.

> Why use Redis?
> -> Redis guarantees atomicity, where commands are executed completely without other client commands intervening in the middle.
> -> You can set a TTL for each data to set an expiration period and prevent duplicate requests within the intended time.


```kotlin
fun purchase(
    lottoPurchaseRequest: LottoPurchaseRequest,
    lottoPublishId: Long,
    authenticated: Authenticated
): LottoBillData = lottoPurchaseRequest.paymentKey.let { paymentKey ->
    returnExistingResultIfDone(paymentKey)?.let { return it }
    checkIdempotent(paymentKey)
  
    runCatching {
        orderValidator.checkOrderValid(lottoPurchaseRequest.toOrderDataRequest())
        lottoPublisher.pending(lottoPublishId)
        val purchase = purchaseProcessor.purchase(lottoPurchaseRequest.toPurchaseRequest())
        val lottoPublish = lottoPublisher.complete(lottoPublishId)
        val bill = lottoWriter.saveBill(purchase.getId(), lottoPublishId, authenticated.memberId)

        markAsDone(paymentKey, bill)

        LottoBillData(
            id = bill.getId()!!,
            purchase = PurchaseData.from(purchase),
            lottoPublish = LottoPublishData.from(lottoPublish)
        )
    }.getOrElse { ex ->
        handleFailure(paymentKey)
        throw ex
    }
}
```

```kotlin
private fun checkIdempotent(paymentKey: String) {
    val key = getRedisKey(paymentKey)
    val ops = redisTemplate.opsForValue()
    val currentStatus = ops.get(key)
  
    when (currentStatus) {
        "IN_PROGRESS" -> {
            throw IllegalStateException("The same request is already in progress. (Payment Key: $paymentKey)")
        }
    }
  
    val isFirstRequest = ops.setIfAbsent(key, "IN_PROGRESS", 2, TimeUnit.MINUTES)
    if (isFirstRequest == false) {
        throw IllegalStateException("The same request is already in progress. (Payment Key: $paymentKey)")
    }
}
```

It retrieves the REDIS value for the KEY and rejects it based on the status, such as `IN_PROGRESS` or `DONE`.
-> Then, it changes the value to `IN_PROGRESS`. - If it's false, it means the value change failed, so it rejects it again.

```kotlin
private fun markAsDone(paymentKey: String, bill: LottoBill) {
    val ops = redisTemplate.opsForValue()
    ops.set(getRedisKey(paymentKey), "DONE:${bill.getId()}", 2, TimeUnit.MINUTES)
}
```

When the logic is complete, it sets it as `DONE:KEY` so that it can be processed by a subsequent request.
(I set it to `2, TimeUnit.MINUTES` because I think the payment will be completed within 2 minutes.)

```
INFO[0010] 1	4	0                                         source=console
INFO[0010] 1	4	0                                         source=console
INFO[0011] 1	4	0                                         source=console
INFO[0012] 1	4	0                                         source=console
INFO[0012] 1	4	0                                         source=console
```

As intended,

`[2025-02-25 14:02:12:499397] [http-nio-8080-exec-8] WARN  [lotto.controller.LottoExceptionHandler.handleIllegalStateException:29] - java.lang.IllegalStateException: The same request is already in progress. (Payment Key: b0d25a50-3ff1-487b-bda5-9cb6e85252d1 )`

it prevents duplicate requests through this.

> http_req_duration..............: avg=92.35ms  min=13.06ms med=29.25ms  max=578.2ms p(90)=320.88ms p(95)=427.14ms
> { expected_response:true }...: avg=206.92ms min=13.43ms med=156.66ms max=578.2ms p(90)=495.93ms p(95)=531.84ms
> -> The response is also very short.

The very short time is also a bonus.
Next time, I plan to cover why `distributed locks` are necessary, `how to handle them when using them`, and `compensating transaction handling`.
(I'm so busy these days that I don't have time for side projects... 😢)

```