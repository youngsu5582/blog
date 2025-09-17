---
title: "진짜 100만건의 INSERT 문이 10000건의 배치 INSERT 보다 성능이 나쁠까? (1) - 스프링과 DB"
author: 이영수
date: 2024-12-20T16:58:38.247Z
tags: ['Batch Insert', 'JPA', '우테코', '스프링']
categories: ['백엔드', '스프링']
description: 스프링 - JPA 와 친해져보기
lang: ko
permalink: /posts/is-1-million-insert-statements-really-worse-than-10000-batch-inserts-performance1-spring-and-db/
---
> 당연히 더 나쁘지만 이번 내용은 `왜?` 에 초점을 맞추고, 스프링이 성능 저하 방지를 위해 도와주는 부분을 다룹니다. 혹시, 잘못된 내용이 있다면 댓글로 또는 joyson5582@gmail.com로 남겨주세요!

이번 시리즈는 두가지 내용을 다룹니다.

- 애플리케이션 단에선 BATCH INSERT 와 INSERT 의 차이가 없게 스프링이 제공해주는 기능
- 스프링 + JPA 에서 BATCH INSERT 를 하는 방법

해당 내용에선 첫 번째 내용을 먼저 다루겠습니다.

# 스프링과 DB

스프링과 JPA 가 DB 와 관련해서 제공해주는 건 매우 많습니다.
(  `Hibernate` 의 관점에서 탐구를 합니다. )

`jdbc:mysql://localhost:3306/corea?profileSQL=true`
이와같이 실제 DB 에 보내는 SQL 을 출력하게 해서 좀 더 명확하게 확인합니다.

##  커넥션 풀 

DB 역시 일종의 WAS 입니다.
`다른 IP 에 있는 DB 에 요청을 보내 로직을 수행한 후 결과를 받아온다.` 를 하기 때문입니다.
그렇기에, 네트워크 IO 가 발생하며 아래의 단계와 같이 이루어집니다.

1. DB 드라이버가 DB 연결 연다 - JDBC, ORM 이 담당
2. DB 드라이버가 데이터를 읽기 / 쓰기 위해 TCP 소켓 생성 & 연결
3. TCP 소켓 통해 데이터 통신 - 클라이언트가 SQL 명령어 전송, 서버는 명령어 처리 & 데이터 반환
4. DB 드라이버가 연결 종료 요청 - `Connection.close`
5. TCP 소켓 종료

추가로, 커넥션들 역시 관리되는 객체들입니다.
-> 연결이 끝나면 이 객체는 GC 처리가 되야하는 존재

- 매번 TCP 연결 수립 & 해제 방지
- 매번 GC 방지

그래서 위 단점을 상쇄하기 위해 1,2,4,5 을 관리해주는게 DB Connection Pool 이다.
우리는, JPA 메소드 + 쿼리 메소드 실행만 하면 자동으로 명령어를 전송 + 데이터를 반환이 DB 와 이루어집니다.

> 추가적으로 HikariCP 는 매우 현명하게 연결을 시작한다.
> max-connection 개수가 몇개인지 상관없이 우선 제일 처음 1개를 동기로 요청을 한다.
> 그 후, 연결이 성공하면 나머지를 비동기로 연결한다.
> -> 애플리케이션 시작 속도를 높이고, 초기화때 리소스를 효율적으로 사용하기 위함

```
com.zaxxer.hikari.HikariDataSource       : HikariPool-1 - Starting...
[QUERY] SET autocommit=1 [at com.zaxxer.hikari.util.DriverDataSource.getConnection(DriverDataSource.java:137)]
com.zaxxer.hikari.pool.HikariPool        : HikariPool-1 - Added connection com.mysql.cj.jdbc.ConnectionImpl@74a74070
com.zaxxer.hikari.HikariDataSource       : HikariPool-1 - Start completed.
....
....
[QUERY] SET autocommit=1 [at com.zaxxer.hikari.util.DriverDataSource.getConnection(DriverDataSource.java:137)]
[QUERY] SET autocommit=1 [at com.zaxxer.hikari.util.DriverDataSource.getConnection(DriverDataSource.java:137)]
```

### Transactional

```java
@Transactional  
public void method(){  
    ...
}
```

와 같이 스프링 트랜잭션 어노테이션을 사용하면?

```java
[QUERY] SET autocommit=0 [Created on: Fri Dec 20 22:56:02 KST 2024, duration: 1, connection-id: 442, statement-id: -1, resultset-id: 0,	at com.zaxxer.hikari.pool.ProxyConnection.setAutoCommit(ProxyConnection.java:402)]
[FETCH]  [Created on: Fri Dec 20 22:56:02 KST 2024, duration: 0, connection-id: 442, statement-id: -1, resultset-id: 0,	at com.zaxxer.hikari.pool.ProxyConnection.setAutoCommit(ProxyConnection.java:402)]

// 로직 수행

[QUERY] COMMIT [Created on: Fri Dec 20 22:56:07 KST 2024, duration: 2, connection-id: 442, statement-id: -1, resultset-id: 0,	at com.zaxxer.hikari.pool.ProxyConnection.commit(ProxyConnection.java:378)]
[FETCH]  [Created on: Fri Dec 20 22:56:07 KST 2024, duration: 0, connection-id: 442, statement-id: -1, resultset-id: 0,	at com.zaxxer.hikari.pool.ProxyConnection.commit(ProxyConnection.java:378)]

[QUERY] SET autocommit=1 [Created on: Fri Dec 20 22:56:07 KST 2024, duration: 2, connection-id: 442, statement-id: -1, resultset-id: 0,	at com.zaxxer.hikari.pool.ProxyConnection.setAutoCommit(ProxyConnection.java:402)]
[FETCH]  [Created on: Fri Dec 20 22:56:07 KST 2024, duration: 0, connection-id: 442, statement-id: -1, resultset-id: 0,	at com.zaxxer.hikari.pool.ProxyConnection.setAutoCommit(ProxyConnection.java:402)]
```

```java
@Transactional(isolation = Isolation.SERIALIZABLE)

[QUERY] SET SESSION TRANSACTION ISOLATION LEVEL SERIALIZABLE com.zaxxer.hikari.pool.ProxyConnection.setTransactionIsolation(ProxyConnection.java:421)]
```

스프링이 ISOLATION LEVEL, AUTOCOMMIT 설정, COMMIT 설정을 자동으로 해줍니다.

#### 어노테이션이 있으면 진입점부터 커넥션을 획득하려고 한다.

```yml
hikari:  
  maximum-pool-size: 1  
```

connection 을 하나로 제한하고

```java
@Transactional  
public void sleep(final int threadId){  
    System.out.println("Thread " + threadId + " attempting to acquire connection...");  
    final var result =entityManager.createNativeQuery("SELECT SLEEP(30);").getSingleResult();  
    System.out.println("Thread " + threadId + " finished.");  
}
```

```java
new Thread(() -> connectionService.sleep(1)).start();  
new Thread(() -> connectionService.sleep(2)).start();  
new Thread(() -> connectionService.sleep(3)).start();
```

이와 같이 실행시키면

`System.out.println("Thread " + threadId + " attempting to acquire connection...");` 
해당 줄이 1,2,3 전부 뜨는게 아니라 하나씩 뜨게 됩니다.

이는, 트랜잭션 어노테이션을 통해 메소드 진입점부터 바로 커넥션을 획득하려고 하기 때문입니다.


어노테이션이 없다면? 
-> 당연히 3개를 전부 출력하고 대기를 합니다.


> 추가적으로, 커넥션은 대기한 순으로 차례대로 받는다.

=> 즉, INSERT 여러개를 보내도 하나의 커넥션 안에서만 수행이 됩니다.
## QueryPlanCache

https://www.baeldung.com/hibernate-query-plan-cache

모든 JPQL 쿼리, Criteria 쿼리는 SQL 문 생성 전 `추상 구문 트리(AST)` 로 파싱된다.

QueryPlanCache를 사용해서 파라미터와 반환값에 대한 정보를 저장하고, 모든 SQL 실행마다 Cache를 확인하여 Query Plan이 있는 지 확인한다. 
없는 경우에만 Query Plan을 새로 생성한 후 캐시에 저장한다.

캐시를 저장하는지 

```java
public void logQueryPlanCacheStats() {  
    final Statistics statistics = sessionFactory.getStatistics();  
  
    System.out.println("Query Plan Cache Hit Count: " + statistics.getQueryPlanCacheHitCount());  
    System.out.println("Query Plan Cache Miss Count: " + statistics.getQueryPlanCacheMissCount());  
    System.out.println("Query Execution Count: " + statistics.getQueryExecutionCount());  
    Arrays.stream(statistics.getQueries()).forEach(System.out::println);  
}
```

아래와 같이 사용해서 확인한다.

```java
@Query(value = "SELECT h FROM Hello h WHERE h.id IN :ids")  
List<Hello> findByIds(@Param("ids") List<Long> ids);  
  
@Query(value = "SELECT h FROM Hello h WHERE h.num IN :nums")  
List<Hello> findByNums(@Param("nums") List<Long> nums);
```

이와 같은 JPQL 은

```java
2024-12-20T21:09:21.558+09:00  INFO 49271 --- [curious-spring-test] [           main] j.c.CuriousSpringTestApplication         : Started CuriousSpringTestApplication in 3.474 seconds (process running for 3.892)
Query Plan Cache Hit Count: 0
Query Plan Cache Miss Count: 2
Query Execution Count: 0
SELECT h FROM Hello h WHERE h.id IN :ids
SELECT h FROM Hello h WHERE h.num IN :nums
```

쿼리를 사용할 때 캐싱이 되며 생성이 된다.

```java

List<Hello> findByNum(long number);

CriteriaBuilder cb = entityManager.getCriteriaBuilder();  
CriteriaQuery<Hello> query = cb.createQuery(Hello.class);  
Root<Hello> root = query.from(Hello.class);  
query.select(root).where(cb.equal(root.get("num"), count++));  
entityManager.createQuery(query).getResultList();

=============================================

Query Plan Cache Hit Count: 0
Query Plan Cache Miss Count: 2
Query Execution Count: 1
[CRITERIA] select h1_0.id,h1_0.num,h1_0.sample_id from hello h1_0 where h1_0.num=?

@Query(value = "SELECT * FROM hello WHERE num = :num and id> :id", nativeQuery = true)  
List<Hello> findHellosByNumNative(@Param("num") Integer num, @Param("id") Long id);

=============================================

Query Plan Cache Hit Count: 0
Query Plan Cache Miss Count: 3
Query Execution Count: 2
SELECT * FROM hello WHERE num = ? and id> ?
```

- CRITERIA 메소드는 캐싱이 적용되지 않고 실행 횟수만 올라간다.
- NativeQuery 도 캐싱을 적용한다.

우리가 사용하는 INSERT 문 역시도 쿼리플랜에 캐싱됩니다.

![](https://i.imgur.com/T8LaREr.png)

=> 즉, INSERT 를 여러번 날리건 INSERT 를 묶어서 날리건 애플리케이션 단에선 전혀 문제가 되지 않습니다.

## Prepared Statement

하이버네이트는 기본적으로 `PreparedStatement` 를 제공해줍니다.
`Hibernate: insert into hello (num, sample_id) values (?, ?)`
우리가 `show-sql` 을 사용하면 보이는 문법입니다.

Hibernate 는 쿼리문을 미리 준비하고, 사용할 떄 `?` 의 값들 안에 애플리케이션에서 발생한 값들을 주입합니다.

```java
PreparedStatement pstmt = connection.prepareStatement("SELECT * FROM hello WHERE num = ?");
pstmt.setInt(1, 10);
```

( 우리가 JDBC 사용할 때, 직접 주입할 때도 `PreparedStatement` 를 사용합니다. )

```java
try {
		NativeQuery<?> spSQLQuery = session.createSQLQuery("insert into hello (num, sample_id) values (?, ?)");
		
		spSQLQuery.setParameter(1, -1666999672);
		spSQLQuery.setParameter(2, null);
		spSQLQuery.executeUpdate();
		transaction.commit();
}
    
```

내부에서 자체적으로 이와 같이 값을 주입해줍니다.
이를 통해 매번 새로운 값을 통해 쿼리를 수행하지만 효율적으로 실행하게 해줍니다.

### ParameterMetadata

Hibernate가 파라미터의 메타데이터(이름, 순서, 타입 정보) 를 관리합니다.

```java
Query query = entityManager.createQuery("SELECT h FROM Hello h WHERE h.num = :num");  
ParameterMetadata parameterMetadata = ((org.hibernate.query.Query<?>) query).getParameterMetadata();

QueryParameter<?> queryParameter = parameterMetadata.getQueryParameter("num");  
System.out.println("Parameter Name: " + queryParameter.getName());  
System.out.println("Parameter Type: " + queryParameter.getParameterType());
```

쿼리는 파라미터 데이터를 가지고 있어서 `Prepared Statement` 어떻게 / 어디서 넣을지 판단할 수 있습니다.

![](https://i.imgur.com/d42yJI9.png)

이와 같이 값을 가지고 있습니다.

>`hibernate.query.plan_cache_max_size` : 저장할 수 있는 쿼리 플랜 최대 개수 ( default : 2024 )
>`hibernate.query.plan_parameter_metadata_max_size` : ParameterMetadata 최대 개수 ( default : 128 )

> 이 요소들이 늘어나서 문제가 될 수 있지만
> 해당 내용에선 다루지 않습니다.
> [# DBA와 개발자가 모두 행복해지는 Hibernate의 in_clause_parameter_padding 옵션](https://meetup.nhncloud.com/posts/211)

=> 즉, INSERT 에서 VALUE 가 가변으로 계속 바뀌어도 애플리케이션 단에서 전혀 문제가 되지 않습니다.

# BATCH INSERT

하지만, 위 스프링들의 도움도 결국 네트워크 I/O (DB 에서 매 요청과 응답 반환) 를 막지 못합니다.

아래 사진과 같이 요청을 보내면

![400](https://i.imgur.com/9rxW2Vu.png)

`Query OK, ... ` 와 같은 응답을 반환합니다.

즉, 쿼리 실행 요청은 0.00 초와 같이 매우 짧게 끝날 수 있어도 요청 - 응답의 네트워크가 발생합니다.
-> 100만건의 네트워크 왕복이 발생하며 네트워크 대역폭 사용량이 급증 + 시간이 걸립니다.

```
INSERT 5개를 묶어서 하는 시간이나, INSERT 1개를 5개 보내는 시간이나
DB 에서 수행 시간이 동일하더라도 네트워크 I/O 에서 차이가 난다.

- 커넥션을 관리하거나 미리 연결을 해놓는것은 의미가 없다.
- `SET AUTOCOMMIT = 0;` `...` `COMMMIT` `SET AUTOCOMMIT = 1;` 와 같이 하나의 트랜잭션에서 해도 의미가 없다.
```


=> 한번에 묶어도 타당한 쿼리는 묶어서 보내야 성능적 측면에 좋습니다.

이를 위해 JPA 에서는 BATCH INSERT 를 제공해줍니다.
다음 내용에서 BATCH INSERT 의 부분을 본격적으로 다루겠습니다.

---

### 출처

[데이터베이스 커넥션 풀 (Connection Pool)과 HikariCP](https://hudi.blog/dbcp-and-hikaricp/#HikariCP-%EA%B3%B5%EC%8B%9D)
[# MySQL 환경의 스프링부트에 하이버네이트 배치 설정해 보기](https://techblog.woowahan.com/2695/)
