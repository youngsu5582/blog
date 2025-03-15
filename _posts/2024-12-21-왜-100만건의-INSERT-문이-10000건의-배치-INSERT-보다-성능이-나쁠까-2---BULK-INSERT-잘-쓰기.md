---
title: "왜 100만건의 INSERT 문이 10000건의 배치 INSERT 보다 성능이 나쁠까? (2) - BULK INSERT 잘 쓰기"
author: 이영수
date: 2024-12-21T07:40:09.779Z
tags: ['Batch Insert', 'JPA', '우테코', '스프링']
categories: ['백엔드', '스프링']
description: 저는 BATCH INSERT 를 구현했습니다. ( IDENTITY 전략 엔티티와 함께 사용하며 )
---
> 이번 내용은 `BATCH INSERT` 중 놓치기 쉬운 부분에 대해 다룹니다. 혹시, 잘못된 내용이 있다면 댓글로 또는 joyson5582@gmail.com로 남겨주세요!

이번 시리즈는 두가지 내용을 다룹니다.

- 애플리케이션 단에선 BATCH INSERT 와 INSERT 의 차이가 없게 스프링이 제공해주는 기능
- 스프링 + JPA 에서 BATCH INSERT 를 `잘` 사용

해당 내용에선 두 번째 내용을 다루겠습니다.

# BATCH INSERT

이제, 실제로 Spring + JPA 에서 INSERT를 할때 BATCH INSERT 가 작동하게 해보겠습니다.

> 영속성 컨텍스트를 사용하지 않는 `BULK INSERT` 의 내용은 다루지 않습니다.

## SETTING

BATCH INSERT 를 확인하기 위해 아래 예제와 설정을 가지고 실험합니다.

```java
@Entity  
public class Hello {  
  
    @Id  
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "hello_seq")  
    @SequenceGenerator(  
            name = "hello_seq",  
            sequenceName = "test_sequence",  
            allocationSize = 30
    )  
    private Long id;

	...
}
```

```java
@Entity  
public class Sample {  
    @GeneratedValue  
    @Id    private Long id;
    ...
}
```

```yml
spring:  
  jpa:  
    properties:  
      hibernate:  
        id:  
          optimizer:  
            pooled:  
              preferred: pooled-lo  
        jdbc:  
          batch_size: 60  
        order_inserts: true  
        order_updates: true  
    open-in-view: false  
  datasource:  
    driver-class-name: com.mysql.cj.jdbc.Driver  
    url: jdbc:mysql://localhost:3306/corea?rewriteBatchedStatements=true
```

이때 `order_inserts` ,`rewriteBatchedStatements=true` 가 중요합니다.
우선, `rewriteBatchedStatements` 가 설정되어 있지 않으며 DB 에 쿼리가 단건으로 나갑니다.

이 세팅만 하면 끝입니다!너무 간단한데요 🥲 
이대로만 하면 끝일까요? 여기에 사용을 하며 놓치기 쉬운 요소들이 존재합니다.


### order_inserts 가 false 이면?

```java
create table test_sequence (next_val bigint) engine=InnoDB
create table sample_seq (next_val bigint) engine=InnoDB
```

이와 같이 둘다 시퀸스를 만들어놓고

```java
for(int i=0;i<100;i++){  
    helloRepository.save(new Hello());  
    sampleRepository.save(new Sample());  
}
```

와 같이 엔티티를 동시에 저장한다고 하면?

```java
insert into hello (num,sample_id,id) values (912032728,null,22) [com.zaxxer.hikari.pool.ProxyStatement.executeBatch(ProxyStatement.java:127)]
insert into sample (id) values (22) [com.zaxxer.hikari.pool.ProxyStatement.executeBatch(ProxyStatement.java:127)]
insert into hello (num,sample_id,id) values (630905141,null,23)[com.zaxxer.hikari.pool.ProxyStatement.executeBatch(ProxyStatement.java:127)]
insert into sample (id) values (23) [com.zaxxer.hikari.pool.ProxyStatement.executeBatch(ProxyStatement.java:127)]
```

정렬이 되지 않아 INSERT 가 단건으로 따로 나가게 됩니다.

> IDENTITY 면 `executeUpdate`
> SEQUENCE 면 `executeBatch`
> 가 나갑니다.

order_inserts 가 true 이면

```java
insert into hello (num,sample_id,id) values (-1109778298,null,1),(657005443,null,2), ....
insert into hello (num,sample_id,id) values (-2018046374,null,61),(1237383384,null,62), ...

insert into sample (id) values (1),(2),(3),(4), ...
insert into sample (id) values (61),(62),(63),(64), ...
```

정렬 및 BATCH INSERT 가 제대로 동작합니다.
### with stragety = IDENTITY 
```java
@Entity  
public class Sample {  
    @GeneratedValue(strategy = GenerationType.IDENTITY)  
    @Id  
    private Long id;

	...
}

create table sample (id bigint not null auto_increment, primary key (id))
```

이와 같이 IDENTITY 를 통해 AUTO_INCREMENT 가 된다면?

```java
insert into hello (num,sample_id,id) values (912032728,null,22) [com.zaxxer.hikari.pool.ProxyStatement.executeBatch(ProxyStatement.java:127)]
insert into sample (id) values (22) [com.zaxxer.hikari.pool.ProxyStatement.executeBatch(ProxyStatement.java:127)]
insert into hello (num,sample_id,id) values (630905141,null,23)[com.zaxxer.hikari.pool.ProxyStatement.executeBatch(ProxyStatement.java:127)]
insert into sample (id) values (23) [com.zaxxer.hikari.pool.ProxyStatement.executeBatch(ProxyStatement.java:127)]
```

아까와 같이 INSERT 가 나가게 됩니다.
이유는 JPA 가 IDENTITY 일때는 batch insert 를 안되게 합니다.

> For IDENTITY columns, the only way to know the identifier value is to execute the SQL INSERT. Hence, the INSERT is executed when the persist method is called and cannot be disabled until flush time.
> 
> For this reason, Hibernate disables JDBC batch inserts for entities using the IDENTITY generator strategy.

JPA 영속 컨텍스트는 엔티티를 식별할때 엔티티 타입과 엔티티의 id 값으로 엔티티를 식별 합니다.
하지만, IDENTITY 엔티티는 insert 문을 실행해야만 id 값을 확인 가능하기 때문에 batch insert 를 비활성화 합니다.

즉, BATCH INSERT 는 IDENTITY 를 사용하는 엔티티와 같이 사용이 되면 안됩니다.

## connection need 2

```java
for (int i = 0; i < 100; i++) {  
    helloRepository.save(new Hello());  
    sampleRepository.save(new Sample());  
}
```

그러면 

```yml
spring:
	datasource:  
	  hikari:  
	    maximum-pool-size: 1
	    connection-timeout: 5000
```

커넥션을 1로 하면 어떻게 될까요?

DeadLock 이 걸리게 됩니다.
`어차피 DB 에 INSERT 를 할때는 하나의 커넥션에서 처리하는거 아닌가?` 라고 생각할 수 있지만 `SEQUENCE` 의 방식에 차이점이 있습니다.

```java
select next_val as id_val from test_sequence for update 
[Created on: Sat Dec 21 02:53:08 KST 2024, duration: 1, connection-id: 698, statement-id: 0, resultset-id: 0

insert into hello (num,sample_id,id) values (1219424968,null,1),(1962670487,null,2),(1886671140,null,3),(1195103281,null,4),(1709743905,null,5)
connection-id: 697, statement-id: 0, resultset-id: 0
```

시퀸스를 가져오는 작업은 기존 작업과 분리된 커넥션 에서 해당 작업을 처리해야 합니다.

- `for update` 를 통해 동시성 제어 해야함 - 다른 커넥션과 동일한 ID 가져오는 것 방지
- 작업과 별도 상태로 관리되어야 한다 - 작업이 롤백되어도 시퀸스는 롤백이 되지 않아야 한다

즉, 기존 커넥션과 무관한 별도의 커넥션 개수가 필요하게 됩니다.
( 두 개의 시퀸스에서 가져와야 하더라도, 하나의 커넥션으로 동작 합니다. - 당연 )

> IDENTITY 는 커넥션 하나로 수행이 됩니다.
> DB 에 추가적인 호출을 보낼 필요가 없기 때문

## batch_size , max_allowed_packet

BATCH SIZE 는 JPA 가 엔티티를 묶는 개수를 지정하는 옵션입니다.
MAX_ALLOWED_PACKET 은 DB에서 받을 수 있는 최대 패킷의 크기가 있습니다.
( `show variables where Variable_name = 'max_allowed_packet';` 를 통해 확인 가능 )

그러면, 특정 엔티티 묶음이 크기를 초과할 수도 있지 않을까요?

```java
@Entity  
public class BigEntity {  
  
    @Id  
    @GeneratedValue(strategy = GenerationType.SEQUENCE)  
    private Long id;  
  
    @Column(name = "large_data", length = 1024)  
    private String largeData;  
  
    public BigEntity() {  
        final char[] data = new char[1024];  
        Arrays.fill(data, 'A');
        this.largeData = new String(data);  
    }
    ...
}
```

```java
@Transactional  
public void save() {  
    final var result = IntStream.rangeClosed(0, 20)  
            .mapToObj(i -> new BigEntity())  
            .toList();  
    bigEntityRepository.saveAll(result);  
}
```

의도적으로 큰 값을 생성하고 저장을 하면?

```java
insert into big_entity (large_data,id) values ('AA ... (truncated) [Created on: Sat Dec 21 13:36:13 KST 2024, duration: 2, connection-id: 23, statement-id: 0, resultset-id: 0,	at com.zaxxer.hikari.pool.ProxyStatement.executeBatch(ProxyStatement.java:127)]
...
```

이 INSERT 쿼리가 20번이 아닌 10번 발생합니다.
Hibernate 가  DB 의 `max_allowed_packet` 값과 쿼리의 길이를 비교하여 `max_allowed_packet` 미만으로 분할하여 전송하게 해줍니다.

즉, 60개를 묶어서 보내라고 했지만 크기를 감지하고 2개씩 묶어서 요청을 보낸 것입니다.

```java
@Transactional  
public void batchInsert() {  
    final var entities = IntStream.rangeClosed(0, 20)  
            .mapToObj(i -> new BigEntity())  
            .toList();  
    StringBuilder sqlBuilder = new StringBuilder("INSERT INTO big_entity (id, large_data) VALUES ");  
  
    for (final BigEntity entity : entities) {  
        sqlBuilder.append("(").append(entity.getId()).append(", ").append("'").append(entity.getLargeData()).append("'").append("),");  
  
        sqlBuilder = new StringBuilder("INSERT INTO big_entity (id, large_data) VALUES ");  
    }  
    entityManager.createNativeQuery(sql).executeUpdate();
}
```

이와같이 의도적으로 NativeQuery 를 작성해서 보내면?

```java
com.mysql.cj.jdbc.exceptions.PacketTooBigException: 
Packet for query is too large (10,399 > 4,096). You can change this value on the server by setting the 'max_allowed_packet' variable.
```

지정된 패킷 크기보다 크다고 `PacketTooBigException` 가 발생하게 됩니다.
Hibernate 를 사용하면 `max_allowed_packet` 문제를 발생시킬 걱정은 크게 없을거 같습니다

> 물론, 하나의 엔티티 크기 자체가 `max_allowed_apcket` 보다 크다면 동일하게 발생합니다.
> Packet for query is too large (1,080 > 1,024).

해당 부분에선 추가적으로 생각해야 하는 요소가 있습니다.
결국, DB 서버도 WAS 인 만큼 네트워크 IO 를 고려해야 합니다.

하나의 커넥션에서 최대 발생할 수 있는 네트워크 IO 및 총 커넥션에서 발생할 네트워크 대역폭을 고려해야 합니다.

- 엔티티 저장 작업이 4MB 발생 -> 동시에 스케줄러를 통해 10개의 저장 작업 발생 가능? -> 최대 40MB(+a) 까지 가능
- 여러 개의 서버에서 작업, 하나의 서버가 평균적으로 40MB 네트워크 IO 발생 -> 40MB `*` n 발생!
- 응답 데이터 역시도 네트워크 IO 에 속한다.

이런 관점이 될 수 있기 때문에 BATCH_SIZE 는 조금 더 고려가 필요합니다.
( 사실상, DB - WAS 네트워크 IO 를 증가시키는 주범이므로 )


## pooled-lo / pooled optimizer
이 두개는 Hibernate 에서 시퀸스 / 테이블 전략에서 사용합니다.

차이점은 시퀸스 값을 어떻게 가져오냐에 따라 다릅니다.

- `pooled` 는 시퀀스의 값이 `<현재 시퀀스 값> - <증분 크기> + 1`에서 `<현재 시퀀스 값>` 사이의 ID 값을 생성합니다.
- `pooled-lo`는 시퀀스의 값을 `<현재 시퀀스 값>`에서 `<현재 시퀀스 값> + <증분 크기> - 1` 사이의 ID로 간주합니다.

즉, `pooled-lo` 는 다음 하한 값을 받아오고, `pooled` 는 다음 상한 값을 받아오는 것입니다.

[# Hibernate pooled and pooled-lo identifier generators](https://vladmihalcea.com/hibernate-hidden-gem-the-pooled-lo-optimizer/)

해당 내용에서 그림으로 명확하게 알려줍니다.
추가로, 밑에 실제 할당 내용과 함께 좀 더 설명하겠습니다. 

### ID 할당 

```java
@Entity  
public class Hello {
	@Id  
	@GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "hello_seq")  
	@SequenceGenerator(  
	        name = "hello_seq",  
	        sequenceName = "test_sequence",  
	        allocationSize = 30 // 배치를 위해 한번에 가져올 ID 개수  
	)
	private Long id;
	...
}

====================================

final var list = IntStream.range(0, 100)  
        .mapToObj(ig -> {  
            return new Hello();  
        })  
        .toList();  
helloRepository.saveAll(list);
```

이와같이 30개씩 받는데, 100개를 저장한다고 하면?
ID 값이 어떻게 되는지 살펴보겠습니다.

먼저, 한번 호출하고 -> 종료 -> 다시 호출의 형식으로 하면?

```java
...
|  98 |   109501640 |      NULL |
|  99 |   753818929 |      NULL |
| 100 |  -206975272 |      NULL |
| 121 |  -540423795 |      NULL |
| 122 | -1952149142 |      NULL |
| 123 |  -141241656 |      NULL |
...
| 217 |  1356764370 |      NULL |
| 218 | -1757673762 |      NULL |
| 219 |  -751942886 |      NULL |
| 220 |   714429396 |      NULL |
+-----+-------------+-----------+
```

pooled-lo 방식

```java
...
|  98 |   109501640 |      NULL |
|  99 |   753818929 |      NULL |
| 100 |  -206975272 |      NULL |
| 122 | -1952149142 |      NULL |
| 123 |  -141241656 |      NULL |
...
| 218 | -1757673762 |      NULL |
| 219 |  -751942886 |      NULL |
| 220 |   714429396 |      NULL |
| 221 |  1356764370 |      NULL |
+-----+-------------+-----------+
```

pooled 방식

pooled-lo 는 
1. 처음 호출이 다음의 하한값인 120을 받아옵니다.
2. 그 다음 호출은 121 ~ 149 를 받아옵니다.
3. 그렇기에 마지막은 220 입니다.

pooled 는
1. 처음 호출이 다음의 상한값인 121을 받아옵니다.
2. 그 다음 호출은 151을 받아옵니다. ( 122 ~ 151 까지 사용 ) - 151 - 30 + 1 = 122 ( `<현재 시퀀스 값> - <증분 크기> + 1`에서 `<현재 시퀀스 값>` )
3. 그렇기에 마지막은 221이 됩니다.

> 그러면, 둘 중에 뭘 써야 하나? 에 대한 질문은 사실 명확히 잘 모르겠습니다.
> 
> ID 범위가 항상 **시퀀스 값부터 시작**하기 때문에 예측 가능성이 높고 안정적입니다.
> 라고 GPT + 및 많은 블로그에 내용이 나오나 실제로 엄청나게 많은 서버 + 데이터를 사용하지 않을뿐 명확하지 않은걸 느꼈습니다.
> 


> 단순, 시퀸스를 받아와 데이터를 넣는 로직에서 걸리는 시간은 아래와 같았습니다.
>
   pooled
> 	1000 : 실행 시간 259ms (259170416ns)
	   10만 : 실행 시간: 0분 10초 152ms (10152567541ns)
	   100만 : 실행 시간 1분 35초 179ms
   pooled-lo
	1000 : 실행 시간: 0분 0초 183ms (183099958ns)
	 10만 : 실행 시간: 0분 9초 593ms (9593086833ns)
	 100만 : 실행 시간: 1분 29초 962ms (89962198875ns)
	 
왠만하면 `pooled-lo` 방식을 사용하면 될 거 같습니다. ( 성능 + 안정성 )

## 결론

위 요소들은 `Batch-Insert` 를 하기 위해 `saveAll` 만 하거나, `stragety=SEQUENCE` 만 적용하면 발생할 수 있는 요소들에 대해 다뤘습니다.

이 외에도 더 자세히 살펴봐야 하는 요소들이 존재하겠지만, 이는 실제 마주하거나 부하 테스트를 통해 세밀하게 제어를 해야 한다고 생각이 듭니다.
( 어떤 BATCH-SIZE, SEQUENCE 할당 개수가 성능이 좋은가 or 이로 인해 커넥션 데드락은 안 걸리는가 )


이상입니다. 감사합니다!

### 참고

[MySQL 환경의 스프링부트에 하이버네이트 배치 설정해 보기](https://techblog.woowahan.com/2695/)
[Hibernate pooled and pooled-lo identifier generators](https://vladmihalcea.com/hibernate-hidden-gem-the-pooled-lo-optimizer/)
