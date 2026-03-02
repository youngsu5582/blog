---
title: 'Spring 3.4, 3.5 및 Java 25의 변화점'
tags:
  - 스프링
  - 자바
  - 변화점
  - 기술
description: 스프링 3.3에서 3.5까지의 주요 변화와 자바 25의 새로운 기능을 정리합니다.
page_id: spring-3-5-java-25-change-points
permalink: /posts/spring-3-5-java-25-change-points/
author: 이영수
date: 2025-09-23T15:35:30.419Z
image:
  path: assets/img/thumbnail/2025-09-23-spring-3-5-java-25-change-points.png
lang: ko
---
팀 내 스프링 버전을 3.4로 올라가고, 사이드 프로젝트 3.5 버전으로 진행하는 겸 3.3 에서 3.5 까지 주요 변화점들을 정리해본다.

추가로, 스프링 4가 되어야 자바 25를 사용할 수 있을 것 같지만, 자바 개발자로서 25의 변화를 살펴보지 않을 수 없으므로 자바 25까지의 변화도 간단히 살펴보자.

## 3.4

[Spring Boot 3.4 Release Note](https://github.com/spring-projects/spring-boot/wiki/Spring-Boot-3.4-Release-Notes)

### Graceful Shutdown

우아하게 종료시켜주는 설정, graceful shutdown 이 default 가 되었다.

이전과 동일한 동작을 원한다면, `server.shutdown : immediate`로 설정하면 된다.

### Dynamic Properties

```java
@ActiveProfiles("test")  
@SpringBootTest  
@Testcontainers  
public abstract class IntegrationTestSupport {  
  
    private static final String POSTGRES_IMAGE_NAME = "postgres:15.3";  
  
    @Container  
    private static final PostgreSQLContainer<?> postgresqlContainer = new PostgreSQLContainer<>(POSTGRES_IMAGE_NAME)  
        .withDatabaseName("spring_test")  
        .withUsername("testuser")  
        .withPassword("testpass");  
  
    @DynamicPropertySource  
    public static void setProperties(DynamicPropertyRegistry registry) {  
        registry.add("spring.datasource.url", postgresqlContainer::getJdbcUrl);  
        registry.add("spring.datasource.username", postgresqlContainer::getUsername);  
        registry.add("spring.datasource.password", postgresqlContainer::getPassword);  
    }  
}
```

```yml
spring:  
  jpa:  
    database-platform: org.hibernate.dialect.PostgreSQLDialect
```

기존 TestContainer 가 테스트를 위한 설정을 이렇게 구현했다면?

```java
@ActiveProfiles("test")  
@SpringBootTest  
@Testcontainers  
public abstract class IntegrationTestSupport {  
  
    private static final String POSTGRES_IMAGE_NAME = "postgres:15.3";  
  
    @Container  
    @ServiceConnection    
    static PostgreSQLContainer<?> postgresqlContainer = new PostgreSQLContainer<>(POSTGRES_IMAGE_NAME)  
            .waitingFor(Wait.forListeningPort());  
}
```

Container 는 ServiceConnection을 통해 자동으로 값을 주입해준다.
추가로, 간혹 DB 방언을 설정해주지 않으면 TestContainer 가 인식하지 못하는 문제도 있었는데
이 역시도 깔끔하게 해결해준다.

### Structured Logging

```yml
logging:  
  structured:  
    format:  
      console: ecs | gelf | logstash
```

구조화된 로그를 기본적으로 제공한다.

`2025-09-04T01:04:02.264+09:00  INFO 68248 --- [    Test worker] y.t.ai_tracker.LoggingVerificationTests  : This is a structured log test.`

기존 로그는 사용자가 이해하기 쉬운 형식이다.
`타임 스탬프 - 로그 레벨 - 프로세스 아이디 - 스레드 이름 - 로그 클래스 - 로그 메시지`

하지만, 컴퓨터가 알아보기는 어렵다. 어디에서 끊을지, 뭐가 정확하게 뭔지 등등등

이를 위해 구조화된 로그 포맷을 사용한다.

- ecs : Elastic Common Schema
ELK 환경에서 로그를 통합적으로 수집,검색,분석 하기 쉽게 해준다.

```json
{
	"@timestamp":"2025-09-03T15:54:43.877750Z",
	"log":{"level":"INFO","logger":"youngsu5582.tool.ai_tracker.LoggingVerificationTests"},
	"process":{"pid":66614,"thread":{"name":"Test worker"}},
	"service":{"node":{}},
	"message":"This is a structured log test.",
	"ecs":{"version":"8.11"}
}
```

프로세스와, 스레드 까지 제공해주는 것도 주요 포인트이다.

- GELF : Graylog Extended Log Format

```json
{
  "version": "1.1",
  "short_message": "This is a structured log test.",
  "timestamp": 1756915205.371,
  "level": 6,
  "_level_name": "INFO",
  "_process_pid": 66945,
  "_process_thread_name": "Test worker",
  "_log_logger": "youngsu5582.tool.ai_tracker.LoggingVerificationTests"
}
```

version 은 gelf 의 버전, level 은 로그 레벨
잘 모르겠지만, 네트워크 전송에 최적화되어 있다고 한다. ( 압축 지원 및 chunk 분할 가능 )

- logstash : Logstash JSON Event Format

```json
{
  "@timestamp": "2025-09-04T01:01:16.96477+09:00",
  "@version": "1",
  "message": "This is a structured log test.",
  "logger_name": "youngsu5582.tool.ai_tracker.LoggingVerificationTests",
  "thread_name": "Test worker",
  "level": "INFO",
  "level_value": 20000
}
```

ECS 보다 간단하고, flat 한 구조 ( 전부 펼쳐져 있음 )

### ⭐️ Hibernate 방식 변경

이게 몹시 중요하다.

Hibernate 버전이 6.6으로 업데이트되면서 변경된 동작 방식이 있다.

- 참고 링크 : [Spring Boot 3.4.0 lets integration tests with JPA/Hibernate fail](https://stackoverflow.com/questions/79228209/spring-boot-3-4-0-lets-integration-tests-with-jpa-hibernate-fail)

```java
@Test  
@DisplayName("ID를 수동으로 할당한 새 엔티티를 persist하면 예외가 발생할 수 있다 (Spring Boot 3.4+).")
void persist_newEntityWithId_throwsException() {  
    TestEntity entity = new TestEntity(2L, "");  
    assertThatThrownBy(()->testEntityRepository.save(entity))  
        .isInstanceOf(ObjectOptimisticLockingFailureException.class);  
}
```

이와 같이, 실제로 존재하지 않는 엔티티에 ID를 지정한 채 persist 하면 에러가 발생한다.

```
Row was updated or deleted by another transaction (or unsaved-value mapping was incorrect): [$TestEntity#2]
org.hibernate.StaleObjectStateException: Row was updated or deleted by another transaction (or unsaved-value mapping was incorrect)
```

DefaultMergeEventListener 의 코드에 변화가 생겼기 때문인데

- 이전 버전의 코드

```java
if ( result == null ) {
	//TODO: we should throw an exception if we really *know* for sure
	//      that this is a detached instance, rather than just assuming
	//throw new StaleObjectStateException(entityName, id);

	// we got here because we assumed that an instance
	// with an assigned id was detached, when it was
	// really persistent
	entityIsTransient( event, clonedIdentifier, copyCache );
} else {
	...
}
```

- 현재 버전의 코드

```java
if ( result == null ) {  
    LOG.trace( "Detached instance not found in database" );  
    // we got here because we assumed that an instance  
    // with an assigned id and no version was detached,
	// when it was really transient (or deleted)    
	final Boolean knownTransient = persister.isTransient( entity, source );  
    if ( knownTransient == Boolean.FALSE ) {  
       // we know for sure it's detached (generated id or a version property), and so the instance       
       // must have been deleted by another transaction
       throw new StaleObjectStateException( entityName, id );  
    } else {  
       // we know for sure it's transient, or we just  
       // don't have information (assigned id and no version property
       // so keep assuming transient
       entityIsTransient( event, clonedIdentifier, copyCache );  
	}
}
```

내용을 읽어보면
엔티티가 detached 상태임이 확실하고, DB에서 발견되지 않으면 ( 삭제든 뭐든 ) StableObjectException 를 던지도록 변경되었다.

TODO 사항이 개선되어, Transient 인지 확실히 확인한다.

> 왜 이런 변경을 하게 되었는가?
> 이전 `merge` 동작이 데이터베이스에 존재하지 않는 `detached` 엔티티를 `INSERT` 해 오히려 예상치 못한 결과를 초래하고, 낙관적 잠금 규칙을 위반할 가능성이 있었다.
> ( 물론, 우리는 이런 위험함을 알고 실제 상황에선 거의 절대 안 나오게 잘 하고 있었다지만 )
> -> 엔티티의 상태(새로운 것인지, 삭제된 것인지)를 더 정확하게 구별하여 충돌 상황에서 적절한 예외를 발생시킨다.

이런 변경으로 인해 이제 테스트에서도 존재하지 않는 ID 를 넣어서 임의로 처리하면 안된다.

### MockitoBean

사소한 변경이지만, `MockBean` 이 Deprecated 되었다.

MockBean 은 작동 방식이

1. Spring 의 TestContext 설정에 따라 Application Context 를 생성
2. MockBean 리스너가 만들어진 컨텍스트에 개입해, 특정 Bean 을 찾아서 Mock 프록시 객체로 교체

였다. ( 완성된 컨텍스트를 수정하므로, Spring 이 해당 컨텍스트를 오염되었다고 판단해 새롭게 생성할 수 있음 )

그리고, MockBean 의 패키지는 `org.springframework.boot.test.mock.mockito` 와 같이 Spring Boot 하위 의존성이였다.
( 놀랍게도 Spring boot 가 아니라면, MockBean 을 사용할 수 없었다...! )

이제 대신, `MockitoBean` 을 사용하라고 권장한다.

작동 방식이

1. TestContext 프레임어크가 Application Context 생성하기 전, `@MockitoBean` 커스터마이저가 먼저 동작
2. 커스터마이저가 Mock 으로 만들 Bean 을 오버라이딩
3. 스프링이 처음부터 재정의된 Bean 을 사용해 ApplicationContext 생성

이다. ( 컨텍스트를 수정하는 과정이 없어 오염 X )

그리고, MockitoBean 의 패키지는 `org.springframework.test.context.bean.override.mockito` 이다.

## 3.5

[Spring Boot 3.5 Release Note](https://github.com/spring-projects/spring-boot/wiki/Spring-Boot-3.5-Release-Notes)

### Actuator headump endpoint

힙덤프 엔드포인트가 `access=NONE` 으로 바뀌었다.
사용하려면 접근 권한을 명시적으로 부여해야 한다.

### `@ServletRegistration`, `@FilterRegistration`

현재 방식은 Servlet 과 Filter 는 구현 후, `@Configuration - @Bean` 을 통해 직접 관리한다.

```java
@Order(1)  
public class BodyFilter implements Filter {
	@Override  
	public void doFilter(ServletRequest servletRequest, ServletResponse servletResponse, FilterChain filterChain) throws IOException, ServletException {
	...
	}
}

@Bean  
public FilterRegistrationBean<BodyFilter> bodyFilterBean() {  
    var registrationBean = new FilterRegistrationBean<BodyFilter>();  
    registrationBean.setFilter(new BodyFilter());  
    registrationBean.setOrder(1);  
    return registrationBean;  
}
```

Filter 는 스프링 프레임워크 기술이 아닌, 자바 서블릿 표준 기술이였다.
즉, 원래 필터의 생명주기 ( 생성, 설정, 실행 등등등 ) 는 서블릿 컨테이너가 관리했다.
( 그렇기에, web.xml 파일에 등록을 해서 관리를 해야했다나 뭐라나 )

스프링 부트에선 이런 서블릿 컨테이너를 편리하게 해주기 위해 중간자 빈을 제공해줬다.
( `FilterRegistrationBean` 는 `org.springframework.boot.web.servlet` 패키지에 포함된다. )

이 빈 정보를 기반으로 서블릿 컨테이너에 전달해서 대신 등록하게 해줬다.

하지만, 이 역시도 일종의 불편함 처럼 느껴졌나 보다.

```java
@Component
@Order(1)
@WebFilter(urlPatterns = "/api/")
public class BodyFilter implements Filter {
	@Override  
	public void doFilter(ServletRequest servletRequest, ServletResponse servletResponse, FilterChain filterChain) throws IOException, ServletException {
	...
	}
}
```

스프링 부트가 좋아하는 방식인 어노테이션 기반으로 코드가 훨씬 더 간결해지게 만들었다.

### AsyncTaskExecutor with Custom Executor

스프링 부트는 `@Async` 어노테이션 지원을 위해 `AsyncTaskExecutor` 이름의 스레드 풀 Bean 을 자동으로 설정해준다. (`SimpleAsyncTaskExecutor`)

근데 사용자가 같은 타입 Bean 을 생성하면 사용자 설정을 우선시한다. ( backs off )

그렇기에 아래와 같은 문제가 발생할 수 있다.

- Async 어노테이션이 붙은 메소드가 비동기로 동작하지 않거나, 어떤 스레드 풀 사용하지 몰라 에러 발생 가능
- Executor 타입 빈이 있다고 생각해, Async 를 위한 AsyncTaskExecutor 자동 설정 포기

`spring.task.execution.mode=force` 를 선언하면
사용자가 선언한 빈이 있어도 기본 AsyncTaskExecutor 를 추가로 생성해준다.

---

## Java 25

Java 25 가 마참내 소개되었다!

그래서, 겸사겸사 간단하게
[New Features in Java 25](https://www.baeldung.com/java-25-features) 해당 내용을 참고해서 정리한다.

### Primitive Types in Patterns - JEP 507

```java
if(obj instanceof int i){
	System.out.println(i);
}
```

와 같이 Wrapper + 객체가 아닌 Primitive 타입도 패턴 검사가 가능하다.

실제로 이런 사례를 사용해보진 않았는데 추가되서 전혀 나쁠게 없는 코드니 뭐 😎

### Module Import Declarations - JEP 511 Preview

꽤나 지대한 변화일지도...?

``` java
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
```

우리가 흔히 비즈니스 로직을 작성할 때 불필요한 라인들이 발생한다.

위 코드를

```java
import module java.util;
```

이와같이 모듈을 import 하는걸로 변경하게 해준다.

대신, 모듈에서 이름이 같은 클래스로 모호함을 유발한다면

```java
import module java.base;
import module java.sql;

import java.sql.Date;
```

와 같이 명시를 해줘야 한다.

> 아직, 프리뷰 이므로 좀 더 지켜봐야한다.
> Nest.js 를 한참 공부할 때도 모듈 패턴이 있었는데, 응집성과 오히려 의도를 해칠수 있다고 느꼈는데 이런 이유 때문에 아직 프리뷰지 않을까

### Instance Main Methods - JEP 512

```
void main() {
	System.out.println("Hello from Java 25!!!");
}
```

드디어 자바도 불필요한, class - main 패턴이 아닌, 최상단 main 선언이 가능해졌다...

JVM 의 규칙 ( public static void main ) 은 유지하고, 컴파일러가 규칙을 만족하는 코드를 대신 만들어주는 `문법적 설탕` 이다.
(이게 어디인가..)

### Flexible Constructor Bodies - JEP 513

자바 생성자의 문법이 유연하게 변경됐다.

한참 우테코를 다니며 객체지향적인 코드를 작성할 때,
생성자가 생성자의 역할을 하라는 내용이 있었다.

예를 들어, 학생 클래스는 `6 <= x <= 20` 와 같은 요구사항이 있으면

```java
Student(String name, int age) {
	if (age < 6 || age > 20)
		throw new IllegalArgumentException("Age must be between 6 and 20");
	super(age);
	this.name = name;
}
```

생성할 때 예외를 던져야 한다는 것이였다.

하지만, 기존 자바 문법은 super 나 this 생성자 문법이 무조건 첫번째 라인이 되어야 했다.
그래서 정적 팩토리를 만들고 정적 팩토리에서 검사를 한 후, 생성자를 통해 객체를 생성하는 형식이였다.

```java
public static Student from(String name, int age){
	validateAge(age);
	return new Student(age,name);
}
```

이제는 super, this 가 맨 첫 번째 문장이 아니여도 가능하게 되었다.
( 단, 당연히 super 나 this 를 호출하기 전 `this.` 는 접근할 수 없다 )
### Scoped Values - JEP 506 - final

ScopedValues 는 ThreadLocal 을 대체하기 위해 나왔다고 한다.

- 경량(lightweight)
- 불변(immutable)
- 스레드 안전(thread-safe)

> ThreadLocal 이 JDK 1.2 에 도입 됐으므로 당연히 여러가지 결함이 있는건 당연할지도..

이 Scoped Value 에 대해선 좀 더 자세히 정리하고 알아봐야 할 거 같다.

일단, 가장 큰 이유는 ThreadLocal 은 기존 스레드를 위해 나왔고 내부에 ThreadLocalMap 과 같은 해시 테이블 형태로 되어있다.
가상 스레드 하나하나가 각자의 ThreadLocal 을 사용하면 아래와 같은 문제가 발생한다.

- 메모리 문제 : 수백만 개의 ThreadLocalMap 이 생성된다면..? 어마어마할 것
- 성능 문제 : 부모 스레드의 값을 상속 받으려면 자식 스레드가 생성될 때마다 부모의 MAP 을 복사해야 한다. - 이 역시도 무시하지 못할 것
- 데이터 관리 복잡성 : 스레드 풀 환경에서 Thraed Local 사용 후, remove 호출하지 않으면 다른 요청 처리하는 스레드가 이전 요청 데이터를 그대로 사용할 수 있다

코드 스타일은 크게 차이 안나는 것 같다..?

```java
private static final ThreadLocal<String> nameContext = new TheradLocal<>();

public void process(String name) {
	nameContext.set(name);
	try {
		nameContext.get();
		...
	} finally {
		nameContext.remove();
	}
}
```

기존 ThreadLocal 이라면

```java
private static final ScopedValue<String> nameContext = ScopedValue.newInstance();

public void process(String name) {
	ScopedValue.where(nameContext, user)
			.run(() -> {
				...
				nameContext.get();
				new Thread(() -> System.out.println("자식 스레드"))
			}).start();
	}
}
```

ScopedValue 로 범위 내 불변 데이터를 안전하고 효율적으로 공유할 수 있다.
자식 스레드에 상속 되는 것 역시도 덤

run 내부에 들어갈 때, user 값을 세팅한 상태로 들어가고 끝나면 자동으로 반환이 된다고 한다.
적응하면 간편할지도...?

### Structured Concurrency - JEP 505 - Fifth Preview

> Fifth Preview : 다섯 번째 프리뷰라는 의미, 개선 과정을 무려 4번이나 거친 프리뷰...!

관련된 스레드들을 적절한 라이프사이클로 동시성을 단순화 하는 걸 목표로 해준다.

```java
static String fetchUser() throws InterruptedException {  
    Thread.sleep(1000);  
    return "Alice";  
}  
  
static String fetchOrder() {  
    try {  
        Thread.sleep(1500);  
    } catch (InterruptedException e) {  
        throw new CompletionException(e);  
    }  
    return "Order#42";  
}  
  
public static void execute() {  
    ExecutorService executor = Executors.newFixedThreadPool(2);  
    try {  
        CompletableFuture<String> userFuture = CompletableFuture.supplyAsync(() -> {  
            try { return fetchUser(); } catch (InterruptedException e) { throw new CompletionException(e); }  
        }, executor);  
  
        CompletableFuture<String> orderFuture = CompletableFuture.supplyAsync(() -> fetchOrder(), executor);
  
        CompletableFuture<String> combinedFuture = userFuture  
            .thenCombine(orderFuture, (user, order) -> user + " - " + order);  
  
        combinedFuture.join();  
  
    } catch (CompletionException e) {  
        System.err.println("[CF] 작업 실패: " + e.getCause().getMessage());  
    } finally {  
        executor.shutdown();  
    }  
}
```

이와같이, 비동기를 연산 작업하는 건 생각보다 많은 보일러 플레이트를 유발한다.

```java
public static void execute() {  
    try {  
        try (var scope = new StructuredTaskScope.ShutdownOnFailure()) {  
        
            var userTask = scope.fork(() -> fetchUser());  
            var orderTask = scope.fork(() -> fetchOrder());  
  
            scope.join();  
            scope.throwIfFailed();  
  
            System.out.println(userTask.resultNow() + " - " + orderTask.resultNow());  
        }  
    } catch (Exception e) {  
        System.err.println("[STS] 전체 작업 실패 원인: " + e.getMessage());  
    }  
}
```

Scope 를 사용해 작업을 단순하게, 안전하게 처리 가능하다.
( 하나가 실패하면 자동으로 취소, try-with-resources 로 자동으로 반환 )

근데, ThreadPool 이 없는거 같은데? 라고 생각이 들면 정상이다.

StructuredTaskScope 는 Virtual Thread 를 사용해 스레드들을 할당해준다.

> 아직 스레드 풀을 없이 뭔가를 처리한다는게 흠칫 흠칫 하긴 하지만...

### Stable Value - JEP 502 Preview

아직 첫 번째 프리뷰이므로 간단히 설명하고 넘어가겠다.

StableValue 는 Optional 과 매우 유사한 API 를 가지고 있으며, 불변 데이터를 담는 객체이다.
JVM 이 상수로 취급해서 필드를 final 로 선언할 때와 동일한 성능 최적화를 하게 해준다나 뭐라나..?

핵심 목표는 지연 초기화를 하면서도, final 필드와 같은 성능을 내게 해주는 것이다.

말만 들으면, 왜 존재하는지 갸우뚱 할 수 있는데 우리가 흔히 사용하는 보일러 플레이트를 간단하게 해결해준다!

```java
private Logger INSTANCE = null;
Logger getLogger() {
	if (logger == null) {
		logger = Logger.create(Controller.class);
	}
	return logger;
}
```

시작 시간을 위해 지연 초기화를 해야 하는 요구사항이 있다고 가정할 때,
이와 같이 `final` 을 선언하지 못하는 점 + `if` 문으로 이미 초기화가 되었는지 검증해야 한다.

물물론, 메모리 가시성 + 경쟁 상태 등등 어쩌고를 대비하려면

```java
private volatile Logger INSTANCE = null;

public Logger getLogger() {
	if (INSTANCE == null) {
		synchronized(this) {
			if (INSTANCE == null) {
				INSTANCE = Logger.create(Controller.class);
			}
		}
	}
	return INSTANCE;
}
```

이런식의 코드로 더 더러워진다.

하지만, StableValue 를 사용하면

```java
private final StableValue<Logger> logger = StableValue.of();

Logger getLogger() {
	return logger.orElseSet(() -> Logger.create(OrderController.class));
}
```

final 이 가능하고 + 매우 간결해진다!
( 추가로, optional 과 비슷해서 크게 러닝 커브도 없을거 같음 )

다른,
`PEM Encodings ,Vector API, Key Derivation` 등은 별로 흥미가 안땡겨서 생략 😔

### 기타 변화점

- AOT Command-Line Ergonomics - JEP 514 Final : AOT 컴파일 환경을 시뮬레이션 하기 위해 동적 기능을 비활성화

AOT 기반으로 성능 향상을 위해선 런타임에 클래스를 동적으로 로딩하거나 리플렉션을 줄여나가야 한다.
플래그를 통해 강제 비활성화 하고 AOT 환경에 잘 맞는지 확인 및 문제가 되는 부분을 식별할 수 있다.

- Compact Object Headers - JEP 519 Final : 64비트 아키텍처에서 Java 객체의 헤더 크기를 줄임

Java 객체는 메모리에 자신을 식별하고 관리하기 위한 정보를 담는 헤더를 가지고 있다.
헤더에 객체 해시코드, GC 정보, 락 등을 가지고 있다.

> 이 헤더에 대해 더 알고 싶다면, Java Object Layout 이라는 라이브러리를 사용해서 탐구해볼 것을 추천
> [알아도 정말 쓸데없는 자바 잡학사전 with JOL](/posts/useless-java-trivia-with-jol) 이 내용을 참고해도 좋다.

이 헤더의 레이아웃을 더 압축해 크기를 줄여 개선을 했다고 한다.
개발자 입장에선 아무것도 안했는데 객체의 메모리 사용량이 줄어드는 효과를 누릴수 있으니, 행복한 상황이지 않을까

---

## 마무리

`혁신이다!` 라는 변화점은 느껴지지 않았으나 꾸준히 언어가 더욱 개선해나가는게 느껴진다.

특히, 가상 스레드를 향해 끝없이 나아가는게 느껴져서 좋은거 같다.
자바가 최고의 언어는 아닌거 같지만 레거시 & 저물어가는 언어인가? 라는 질문에는 확실히 아니다 라고 대답할 수 있지 않을까.

스프링의 편의성도, 자바의 개선도, 여전한 커뮤니티도
(해외에서는 다를수도 있을라나...)
