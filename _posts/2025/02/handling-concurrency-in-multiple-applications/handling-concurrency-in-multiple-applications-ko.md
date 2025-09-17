---
title: "다중 애플리케이션에서 동시성 처리"
author: 이영수
date: 2025-02-25T15:15:48.141Z
tags: ['동시성', '멱등성', '비관적 락']
categories: ['백엔드', '동시성']
description: "Conditional Updates, Unique Indexes, Pessimistic Locking, Idempotency"
permalink: /posts/handling-concurrency-in-multiple-applications/
image:
  path: https://velog.velcdn.com/images/dragonsu/post/da3193d2-99cd-4f7f-ba6d-fafd50777d1d/image.webp
---
> 해당 내용은 다중 애플리케이션에서 동시성을 학습하는 내용입니다.
틀린 부분이 있다면 joyson5582@gmail.com 이나 댓글로 남겨주세요 🙂

## 세팅

이번에는 단순, 서비스 상 테스트가 아닌 실제 서버를 구동해서 테스트를 해보자.

서비스 단은 단일 애플리케이션에서를 테스트 할 수 있으나 여러 서버에서 동시성이 발생한다는건 보장할 수 없기 때문이다.

이를 위해서, `docker-compose` 와 `nginx` 를 사용했다.

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

서버를 같은 파일로 4개를 작동시켰다.
- `SERVER_NAME` 을 통해 서버 식별
- `limits` 를 통해 CPU와 MEMORY 제한

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

요청은 라운드 로빈 형식으로 분산이 된다.

```typescript
const order = http.post(`${baseUrl}/api/orders`, orderPayload, {
  headers: { "Content-Type": "application/json" },
});

check(order, {
  "주문 생성 요청 성공": (r) => r.status === 200,
});

// 주문 생성 성공 시, 응답 JSON에서 lottoPublishId, orderId 추출
let orderData = order.json().data || {};
let lottoPublishId = orderData.lottoPublishId;

// 결제 프로세스 대기
sleep(0.8);

// 결제 승인 진행
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
  ]);
}

const responses = http.batch(requests);
```

주문 생성 API 를 보낸후, 결제 승인 API를 보낸다.

> 실제 요청을 보낼수 없으므로, 주문 ID를 PaymentKey로 하고 서버에 보낸다.

- http.batch : k6 에서 제공해주는 기능으로, 하나의 VU가 동시 여러개 소켓 연결이 열려 여러 요청을 병렬로 보내게 해준다. ( 동시성 테스트 기대 )

이와같은 설정과 테스트 스크립트를 통해 `하나의 사용자가 여러번 요청을 눌러 동시성 발생` 을 가정했다.

테스트를 위해 코드도 조금 우회를 했다.

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

기존 서비스 코드에서 실제 요청을 날릴순 없으므로

```kotlin
// purchaseProcessor.purchase 부분

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

페이크 객체를 만들고 랜덤 시간을 대기하는 식으로 구현했다.
추가로, 중복 결제 요청이 들어오는지 확인하기 위해

```sql
* CREATE TABLE purchase_key (
*     payment_key VARCHAR(50) NOT NULL,
*     PRIMARY KEY (payment_key)
* );
```

테이블을 만들어 중복된 INSERT 가 일어나면 `DuplicateKeyException` 예외로 500 상태코드를 반환시켜

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

// 원하는 조건: "1개의 요청만 200, 나머지 4개는 400"check({ successCount, badRequestCount }, {
  "exactly 1 success and 4 bad requests": (obj) =>
    obj.successCount === 1 && obj.badRequestCount === 4,
});
```

1개의 요청만 200, 나머지 요청은 400 또는 요청을 거부되게 만드는게 이번 테스트의 목적이다.

## 기존 동시성

```kotlin
val isCompleted = publishCompletionStatus.computeIfAbsent(lottoPublishId) { AtomicBoolean(false) }
if (!isCompleted.compareAndSet(false, true)) {
    throw IllegalStateException("이미 결제가 진행되었습니다.")
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

기존의 동시성을 그대로 사용해 테스트를 실행해보면?

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

무차별적으로 실패한다.

## 동시성 해결

### 조건부 업데이트

해당 방법은 다소 낯설수 있다.
나도 이번에 생각해서 적용한 부분이다.
DB에 UPDATE 쿼리를 보내면, `X LOCK` 이 자동으로 걸린다.
그래서, 동시에 다른 트랜잭션이 해당 레코드에 접근할 수가 없고 -> 상태가 변경되므로 다른 요소들은 이에 접근할 수 있게 된다.

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
            throw IllegalStateException("결제 대기 상태에서만 완료가 가능합니다")
        }
        return lottoPublish
    }
```

그래서, 이와같이 상태를 변경하고 상태가 변경된 값이 하나도 없으면?
실패한 것으로 처리한다.

```
INFO[0017] 1	4	0                                         source=console
INFO[0017] 1	4	0                                         source=console
INFO[0018] 1	4	0                                         source=console
INFO[0018] 1	4	0                                         source=console
```

> http_req_duration..............: avg=212.02ms min=16.39ms med=118.16ms max=2.09s  p(90)=480.78ms p(95)=599.08ms
> { expected_response:true }...: avg=309.25ms min=16.39ms med=267.2ms  max=1.35s  p(90)=594.93ms p(95)=712.15ms

일종의 CAS ( Compare And Swap ) 을 DB가 해주는 것이라 생각하면 된다.
### DB UNIQUE

테스트를 위해 

```sql
* CREATE TABLE purchase_key (
*     payment_key VARCHAR(50) NOT NULL,
*     PRIMARY KEY (payment_key)
* );
```

`jdbcTemplate.update("INSERT INTO purchase_key (payment_key) VALUES (?)", request.paymentKey)` 와 같은 형식도
엄연히 동시성을 해결할 수 있는 방식이다.

왜냐하면, 결제를 보내기 전 DB에 INSERT 를 통해 하나의 요청 에서만 결제가 진행을 되게 한다.
( 나머지는, 예외를 받고 실패를 반환 )

```kotlin
try {
    jdbcTemplate.update("INSERT INTO purchase_key (payment_key) VALUES (?)", request.paymentKey)
}catch (e : DuplicateKeyException){
    throw PurchaseException(PurchaseExceptionCode.ALREADY_PROCESS,e)
}
```

결제 로직전 데이터를 INSERT 할때 중복 키 예외가 발생하면, 어떤 곳에서 이미 데이터를 삽입하고 요청이 진행되고 있다고 판단하고 예외를 던진다.

```
//console.log(successCount+"\t"+badRequestCount+"\t"+concurrencyCount);

INFO[0012] 1	4	0                                         source=console
INFO[0012] 1	4	0                                         source=console
INFO[0013] 1	4	0                                         source=console
INFO[0013] 1	4	0                                         source=console
```

동시에 요청이 들어간 경우에는

`Caused by: org.springframework.dao.DuplicateKeyException: PreparedStatementCallback; SQL [INSERT INTO purchase_key (payment_key) VALUES (?)]; Duplicate entry '963b5667-ddd4-4235-bc99-02470261739b' for key 'purchase_key.PRIMARY'` 에러를 던지고

결제까지 완성되어 DB에 반영이 됐다면

```kotlin
fun pending() {
    if (this.status != LottoPublishStatus.WAITING) {
        throw IllegalStateException("결제 대기 상태에서만 완료가 가능합니다")
    }
    this.status = LottoPublishStatus.PENDING
}
```

그 후, 동시에 들어간 요청들은 해당 부분에서 예외가 던져진다.
우리가 의도한 대로 성공 1 및 의도한 예외 4 가 나와서 외부 결제 API에 요청을 한번만 보내는 것을 보장한다.

### DB LOCK

낙관적 락과 비관적 락을 통해서 해결한다.

#### 낙관적 락

```kotlin
@Version
private var version: Long? = null
```

수정하려고 하면
JPA 가 자동으로 엔티티 기반 버전이 같은지 검사 + 버전을 교체해준다.

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

오히려 더 처참하게 실패한다.

`ObjectOptimisticLockingFailureException: Row was updated or deleted by another transaction (or unsaved-value mapping was incorrect`
`StaleObjectStateException: Row was updated or deleted by another transaction (or unsaved-value mapping was incorrect)`

두개가 발생한다.

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
                throw IllegalArgumentException("PENDING 상태 변경 중 동시 요청이 발생했습니다. 재시도 횟수를 초과했습니다.", e)
            }
            Thread.sleep(100)
        }
    }
    throw IllegalStateException("Unexpected error during pending()")
}
```

동시성 예외를 잡고, 재시도를 해도

```
INFO[0015] 1	4	0                                         source=console
INFO[0016] 1	0	4                                         source=console
INFO[0016] 1	2	2                                         source=console
INFO[0016] 1	1	3                                         source=console
INFO[0016] 1	1	3                                         source=console
INFO[0017] 1	4	0                                         source=console
INFO[0018] 1	2	2                                         source=console
```

불확실하다.

> 왜 `예외가 안잡히고 발생하지?` 에 대해 생각했는데
> JPA 가 관리하는 영속성 컨텍스트에서 상태가 변경되고 이를 반영하려고 할때 반영해서 catch 가 안되는거 같다.

```kotlin
fun pending() {
    if (this.status != LottoPublishStatus.WAITING) {
        throw IllegalStateException("결제 대기 상태에서만 완료가 가능합니다")
    }
    this.status = LottoPublishStatus.PENDING
}
```

낙관적 락은 애초에 크게 충돌이 발생하지 않는다고 가정할 때 사용해야 한다.
오류 처리가 필요하고, 동시 접근이 많이 발생하면 오히려 오류 처리 및 제어하는데 리소스가 더 소모될 수도 있다.

궁극적으로 하나의 요청에서만 엔티티를 감지하는걸 명확하게 못할수도 있다.

#### 비관적 락

```kotlin
@Lock(LockModeType.PESSIMISTIC_WRITE)
@Query("select lp from LottoPublish lp where lp.id = :id")
fun findByIdWithOptimistic(@Param("id") id: Long): LottoPublish?
```

조회할 때 DB에서 잠금을 획득해서 처리한다.
배타락(쓰기 잠금)을 사용해서 다른 커넥션에서 해당 엔티티에 대한 쓰기를 할 수 없게 보장한다.

```
INFO[0016] 1	4	0                                         source=console
INFO[0016] 1	4	0                                         source=console
INFO[0016] 1	4	0                                         source=console
INFO[0016] 1	4	0                                         source=console
INFO[0017] 1	4	0                                         source=console
INFO[0017] 1	4	0                                         source=console
```

잠금을 통해 의도대로 성공한다.

`select lp1_0.id,lp1_0.issued_at,lp1_0.lotto_round_info_id,lp1_0.status from lotto_publish lp1_0 where lp1_0.id=2758 for update`

```sql
| 527 | lotto | 172.19.0.9:43224  | lotto | Query   |    0 | statistics | select lp1_0.id,lp1_0.issued_at,lp1_0.lotto_round_info_id,lp1_0.status from lotto_publish lp1_0 where lp1_0.id=2726 for update |
| 528 | lotto | 172.19.0.8:46378  | lotto | Query   |    0 | statistics | select lp1_0.id,lp1_0.issued_at,lp1_0.lotto_round_info_id,lp1_0.status from lotto_publish lp1_0 where lp1_0.id=2726 for update |
```

그래서, 하나의 커넥션에서

```kotlin
fun pending() {
    if (this.status != LottoPublishStatus.WAITING) {
        throw IllegalStateException("결제 대기 상태에서만 완료가 가능합니다")
    }
    this.status = LottoPublishStatus.PENDING
}
```

상태를 변경하고 커밋이 되면, 점유한 락을 반환한다.
나머지 요소들은 락을 획득해도?  -> 상태가 변경되었기 때문에 `IllegalStateException("결제 대기 상태에서만 완료가 가능합니다")` 를 발생시킨다.

이때 하나의 연결에서 상태를 변경했는데 다른 곳에서 계속 락을 가지는게 비효율적이라고 생각이 된다면?

`select lp1_0.id,lp1_0.issued_at,lp1_0.lotto_round_info_id,lp1_0.status from lotto_publish lp1_0 where lp1_0.id=2858 and lp1_0.status='COMPLETE' for update`

상태까지 WHERE 문에 넣으면, 하나의 커넥션이 받아서 상태를 변경후 나머지 커넥션들은 락을 못 획득하게 할 수 있다.

```kotlin
private fun getLottoPublish(publishId: Long, status: LottoPublishStatus): LottoPublish {
    return lottoPublishRepository.findByIdWithOptimistic(publishId, status)
        ?: throw IllegalArgumentException("Not Exist Publish")
}
```

`java.lang.IllegalArgumentException: Not Exist Publish` 발생
어차피, 조회 -> 데이터 변환 -> 커밋과 같은 형태여서 락 점유시간도 매우 낮다.

> 이때, 조건문에 대해 인덱스를 무조건 걸어놓자.
> 성능 향상과 레코드 자체가 아닌 인덱스 락을 위해

```sql
SELECT *
FROM lotto_publish
WHERE id = 2726
  AND status = 'COMPLETE'
FOR UPDATE;
```

`SQL Error [1205] [40001]: Lock wait timeout exceeded; try restarting transaction`
와 같이 LOCK TIMEOUT 까지 대기하다가 예외를 발생한다.

`SHOW ENGINE INNODB STATUS\G` 명령어를 통해 아래의 정보를 알 수 있다.

```
------------
TRANSACTIONS
------------
...
RECORD LOCKS space id 31 page no 10 n bits 352 index PRIMARY of table `lotto`.`lotto_publish` trx id 36386 
lock_mode X locks rec but not gap waiting

```

- PRIMARY 인덱스에 걸린 베타적 락 사용
- Next-Key Lock 이나 Gap Lock이 아니다

> LOCK 중에는 당연히 `CREATE INDEX idx_id ON lotto_publish(id);` 와 같은 DDL은 불가능하다.

하지만, DB의 자원을 사용하는건 꽤나 위험하다.
DB는 온전하게 자원을 가져오기 위해서만 사용해야 하는데 LOCK 같은 요소들이나 불필요한 요소들로 부하를 준다. ( 예상치 못한 락 경합도 발생 가능 )

### 멱등성

멱등성이란?

API 가 요청을 하면, 매번 똑같은 값이 나오길 기대하는 것이다.
POST 요청은 일반적으로, 멱등성이 보장이 안되는 요청이다.
-> 매번 요청시, 결과가 달라지므로

우리의 결제 요청도 매번 `결제를 진행` 하는 요청이므로 결과를 보장할 수 없다.
그래서, 멱등성을 구현해 동일 요청에는 동일한 값이 나오게 한다.

> 필터나 어노테이션들을 통해 더 간결하게 할 수 있지만, 여기서는 무식하게 진행한다.

> Redis 를 사용하는 이유?
> -> Redis는 중간에 다른 클라이언트 명령어가 개입되지 않고 완전히 실행되는 원자성을 보장한다.
> -> 각 데이터에 대해 TTL 을 걸 수 있어서 만료 기간을 설정해 의도대로 시간 내 동일 요청을 방지할 수 있다.


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
            throw IllegalStateException("이미 동일 요청이 진행 중입니다. ( 결제 키 : $paymentKey )")
        }
    }

    val isFirstRequest = ops.setIfAbsent(key, "IN_PROGRESS", 2, TimeUnit.MINUTES)
    if (isFirstRequest == false) {
        throw IllegalStateException("이미 동일 요청이 진행 중입니다. ( 결제 키 : $paymentKey )")
    }
}
```

KEY에 대한 REDIS 값을 가져오고 상태에 따라 `동일 진행중`, `완료` 에 따라 거절한다.
-> 그 후, `IN_PROGRESS`로 값을 변경한다. - false 이면, 값 변경을 실패했으므로 다시 거절한다.

```kotlin
private fun markAsDone(paymentKey: String, bill: LottoBill) {
    val ops = redisTemplate.opsForValue()
    ops.set(getRedisKey(paymentKey), "DONE:${bill.getId()}", 2, TimeUnit.MINUTES)
}
```

로직을 완료하면, 차후 요청을 해서 처리할 수 있게 `DONE:KEY` 와 같이 설정한다.
( 결제가 2분안에 완료 될 것이라 생각하므로 `2, TimeUnit.MINUTES` 로 설정했음 )

```
INFO[0010] 1	4	0                                         source=console
INFO[0010] 1	4	0                                         source=console
INFO[0011] 1	4	0                                         source=console
INFO[0012] 1	4	0                                         source=console
INFO[0012] 1	4	0                                         source=console
```

의도대로

`[2025-02-25 14:02:12:499397] [http-nio-8080-exec-8] WARN  [lotto.controller.LottoExceptionHandler.handleIllegalStateException:29] - java.lang.IllegalStateException: 이미 동일 요청이 진행 중입니다. ( 결제 키 : b0d25a50-3ff1-487b-bda5-9cb6e85252d1 )`

를  통해 동일 요청들을 방지한다.

> http_req_duration..............: avg=92.35ms  min=13.06ms med=29.25ms  max=578.2ms p(90)=320.88ms p(95)=427.14ms
> { expected_response:true }...: avg=206.92ms min=13.43ms med=156.66ms max=578.2ms p(90)=495.93ms p(95)=531.84ms
> -> 응답 역시 매우 짧게 나온다.

시간이 매우 짧은 것 역시도 덤이다.
다음에는 왜 `분산락을 써야하는지`, `분산락을 쓸때 처리방식`, `보상 예외 처리` 에 대해서 다뤄볼 예정이다.
( 요새, 너무 바빠서 사이드 프로젝트를 할 시간이 없다... 😢 )

```