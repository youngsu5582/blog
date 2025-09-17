---
title: "Is 1 Million INSERT Statements Really Worse Than 10,000 Batch INSERTs in Performance? (1) - Spring and DB"
author: 이영수
date: 2024-12-20T16:58:38.247Z
tags: ['Batch Insert', 'JPA', 'Wooteco', 'Spring']
categories: ['Backend', 'Spring']
description: "Getting familiar with Spring - JPA"
lang: en
permalink: /posts/is-1-million-insert-statements-really-worse-than-10000-batch-inserts-performance1-spring-and-db/
---

> This post has been translated from Korean to English by Gemini CLI.

> Of course, it's worse, but this content focuses on `why?` and covers how Spring helps prevent performance degradation. If there's anything wrong or you have any opinions, please leave a comment or email me at joyson5582@gmail.com!

This series covers two topics:

- Features provided by Spring that make no difference between BATCH INSERT and INSERT at the application level.
- How to perform BATCH INSERT in Spring + JPA.

In this content, I will first cover the first topic.

# Spring and DB

Spring and JPA provide a lot of features related to DB.
(I will explore from the perspective of `Hibernate`.)

`jdbc:mysql://localhost:3306/corea?profileSQL=true`
As such, I will output the actual SQL sent to the DB to check it more clearly.

## Connection Pool

DB is also a type of WAS.
This is because it `sends a request to a DB on a different IP, performs logic, and then receives the result.`
Therefore, network I/O occurs and proceeds in the following steps:

1. DB driver opens DB connection - JDBC, ORM are responsible.
2. DB driver creates & connects TCP socket to read/write data.
3. Data communication through TCP socket - client sends SQL commands, server processes commands & returns data.
4. DB driver requests connection termination - `Connection.close`.
5. TCP socket termination.

Additionally, connections are also managed objects.
-> When the connection ends, this object needs to be GC processed.

- Prevents repeated TCP connection establishment & termination.
- Prevents repeated GC.

So, to compensate for the above disadvantages, DB Connection Pool manages 1, 2, 4, and 5.
We just need to execute JPA methods + query methods, and commands are automatically sent + data is returned to the DB.

> Additionally, HikariCP starts connections very wisely.
> Regardless of the number of max-connections, it first requests 1 synchronously.
> After the connection is successful, it connects the rest asynchronously.
> -> To increase application startup speed and efficiently use resources during initialization.

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

What happens if you use Spring's transactional annotation like this?

```java
[QUERY] SET autocommit=0 [Created on: Fri Dec 20 22:56:02 KST 2024, duration: 1, connection-id: 442, statement-id: -1, resultset-id: 0,	at com.zaxxer.hikari.pool.ProxyConnection.setAutoCommit(ProxyConnection.java:402)]
[FETCH]  [Created on: Fri Dec 20 22:56:02 KST 2024, duration: 0, connection-id: 442, statement-id: -1, resultset-id: 0,	at com.zaxxer.hikari.pool.ProxyConnection.setAutoCommit(ProxyConnection.java:402)]

// Perform logic

[QUERY] COMMIT [Created on: Fri Dec 20 22:56:07 KST 2024, duration: 2, connection-id: 442, statement-id: -1, resultset-id: 0,	at com.zaxxer.hikari.pool.ProxyConnection.commit(ProxyConnection.java:378)]
[FETCH]  [Created on: Fri Dec 20 22:56:07 KST 2024, duration: 0, connection-id: 442, statement-id: -1, resultset-id: 0,	at com.zaxxer.hikari.pool.ProxyConnection.commit(ProxyConnection.java:378)]

[QUERY] SET autocommit=1 [Created on: Fri Dec 20 22:56:07 KST 2024, duration: 2, connection-id: 442, statement-id: -1, resultset-id: 0,	at com.zaxxer.hikari.pool.ProxyConnection.setAutoCommit(ProxyConnection.java:402)]
[FETCH]  [Created on: Fri Dec 20 22:56:07 KST 2024, duration: 0, connection-id: 442, statement-id: -1, resultset-id: 0,	at com.zaxxer.hikari.pool.ProxyConnection.setAutoCommit(ProxyConnection.java:402)]
```

```java
@Transactional(isolation = Isolation.SERIALIZABLE)

[QUERY] SET SESSION TRANSACTION ISOLATION LEVEL SERIALIZABLE com.zaxxer.hikari.pool.ProxyConnection.setTransactionIsolation(ProxyConnection.java:421)]
```

Spring automatically sets ISOLATION LEVEL, AUTOCOMMIT, and COMMIT.

#### If there is an annotation, it tries to acquire a connection from the entry point.

```yml
hikari:  
  maximum-pool-size: 1  
```

Limit connection to one.

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

This line will not appear all 1, 2, and 3, but one by one.

This is because it tries to acquire a connection directly from the method entry point through the transactional annotation.


What if there is no annotation?
-> Of course, it prints all 3 and waits.


> Additionally, connections are received in the order they are waited for.

=> That is, even if you send multiple INSERTs, they are performed only within a single connection.
## QueryPlanCache

https://www.baeldung.com/hibernate-query-plan-cache

All JPQL queries and Criteria queries are parsed into an `Abstract Syntax Tree (AST)` before SQL statement generation.

QueryPlanCache is used to store information about parameters and return values, and for every SQL execution, it checks the Cache to see if a Query Plan exists.
If not, it creates a new Query Plan and stores it in the Cache.

To check if it stores cache:

```java
public void logQueryPlanCacheStats() {  
    final Statistics statistics = sessionFactory.getStatistics();  
  
    System.out.println("Query Plan Cache Hit Count: " + statistics.getQueryPlanCacheHitCount());  
    System.out.println("Query Plan Cache Miss Count: " + statistics.getQueryPlanCacheMissCount());  
    System.out.println("Query Execution Count: " + statistics.getQueryExecutionCount());  
    Arrays.stream(statistics.getQueries()).forEach(System.out::println);  
}
```

Check using the following:

```java
@Query(value = "SELECT h FROM Hello h WHERE h.id IN :ids")  
List<Hello> findByIds(@Param("ids") List<Long> ids);  
  
@Query(value = "SELECT h FROM Hello h WHERE h.num IN :nums")  
List<Hello> findByNums(@Param("nums") List<Long> nums);
```

JPQL like this:

```java
2024-12-20T21:09:21.558+09:00  INFO 49271 --- [curious-spring-test] [           main] j.c.CuriousSpringTestApplication         : Started CuriousSpringTestApplication in 3.474 seconds (process running for 3.892)
Query Plan Cache Hit Count: 0
Query Plan Cache Miss Count: 2
Query Execution Count: 0
SELECT h FROM Hello h WHERE h.id IN :ids
SELECT h FROM Hello h WHERE h.num IN :nums
```

When using queries, caching is applied and generated.

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

- CRITERIA methods do not apply caching, and only the execution count increases.
- NativeQuery also applies caching.

Our INSERT statements are also cached in the query plan.

![500](https://i.imgur.com/T8LaREr.png)

=> That is, whether you send multiple INSERTs or bundle them, it doesn't cause any problems at the application level.

## Prepared Statement

Hibernate basically provides `PreparedStatement`.
`Hibernate: insert into hello (num, sample_id) values (?, ?)`
This is the syntax we see when using `show-sql`.

Hibernate prepares the query statement in advance and injects values generated from the application into the `?` values when used.

```java
PreparedStatement pstmt = connection.prepareStatement("SELECT * FROM hello WHERE num = ?");
pstmt.setInt(1, 10);
```

(When we use JDBC, we also use `PreparedStatement` when injecting directly.)

```java
try {
		NativeQuery<?> spSQLQuery = session.createSQLQuery("insert into hello (num, sample_id) values (?, ?)");
		
		spSQLQuery.setParameter(1, -1666999672);
		spSQLQuery.setParameter(2, null);
		spSQLQuery.executeUpdate();
		transaction.commit();
}
    
```

It injects values internally like this.
This allows queries to be executed efficiently even when new values are used each time.

### ParameterMetadata

Hibernate manages parameter metadata (name, order, type information).

```java
Query query = entityManager.createQuery("SELECT h FROM Hello h WHERE h.num = :num");  
ParameterMetadata parameterMetadata = ((org.hibernate.query.Query<?>) query).getParameterMetadata();

QueryParameter<?> queryParameter = parameterMetadata.getQueryParameter("num");  
System.out.println("Parameter Name: " + queryParameter.getName());  
System.out.println("Parameter Type: " + queryParameter.getParameterType());
```

Queries have parameter data, so `Prepared Statement` can determine how/where to insert them.

![500](https://i.imgur.com/d42yJI9.png)

It has values like this.

>`hibernate.query.plan_cache_max_size`: Maximum number of query plans that can be stored (default: 2024)
>`hibernate.query.plan_parameter_metadata_max_size`: Maximum number of ParameterMetadata (default: 128)

> These elements can increase and cause problems,
> but this content does not cover them.
> [# Hibernate's in_clause_parameter_padding option that makes both DBAs and developers happy](https://meetup.nhncloud.com/posts/211)

=> That is, even if the VALUE in INSERT changes continuously, it does not cause any problems at the application level.

# BATCH INSERT

However, the help of the above Springs ultimately cannot prevent network I/O (returning requests and responses from the DB every time).

If you send a request as shown in the picture below,

![400](https://i.imgur.com/9rxW2Vu.png)

It returns a response like `Query OK, ...`.

That is, even if a query execution request can end very quickly, like 0.00 seconds, network I/O for requests and responses occurs.
-> 1 million network round trips occur, and network bandwidth usage rapidly increases + time is consumed.

```
Whether it's bundling 5 INSERTs or sending 1 INSERT 5 times,
Even if the execution time in the DB is the same, there is a difference in network I/O.

- Managing connections or pre-connecting is meaningless.
- It is meaningless to do it in a single transaction like `SET AUTOCOMMIT = 0;` `...` `COMMMIT` `SET AUTOCOMMIT = 1;`.
```


=> Even if bundled at once, valid queries should be bundled and sent for better performance.

For this, JPA provides BATCH INSERT.
In the next content, I will fully cover the BATCH INSERT part.

---

### Source

[Database Connection Pool and HikariCP](https://hudi.blog/dbcp-and-hikaricp/#HikariCP-%EA%B3%B5%EC%8B%9D)
[# How to set up Hibernate batch in Spring Boot in MySQL environment](https://techblog.woowahan.com/2695/)
