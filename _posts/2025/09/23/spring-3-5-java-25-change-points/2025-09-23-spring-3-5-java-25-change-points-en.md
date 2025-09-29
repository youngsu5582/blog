---
title: 'Changes in Spring 3.4, 3.5, and Java 25'
tags:
  - Spring
  - Java
  - Changes
  - Technology
description: >-
  Summarizing the major changes from Spring 3.3 to 3.5 and the new features in
  Java 25.
page_id: spring-3-5-java-25-change-points
permalink: /posts/spring-3-5-java-25-change-points/
author: Lee Youngsu
date: 2025-09-23T15:35:30.419Z
image:
  path: assets/img/thumbnail/2025-09-23-spring-3-5-java-25-change-points.png
lang: en
---
As our team upgrades our Spring version to 3.4 and the side project progresses to version 3.5, I've summarized the major changes from versions 3.3 to 3.5.

Additionally, although it seems we'll need Spring 4 to use Java 25, as a Java developer, I can't overlook the changes in Java 25, so let's also briefly examine Java 25's changes.

## 3.4

[Spring Boot 3.4 Release Note](https://github.com/spring-projects/spring-boot/wiki/Spring-Boot-3.4-Release-Notes)

### Graceful Shutdown

The setting for enabling a graceful shutdown is now default.

If you want the behavior to remain the same as before, set `server.shutdown : immediate`.

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

If the existing TestContainer implemented test settings like this:

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

The container now automatically injects values through ServiceConnection.
Additionally, there was sometimes an issue where the dialect wasn't recognized if not set; this too is elegantly resolved.

### Structured Logging

```yml
logging:  
  structured:  
    format:  
      console: ecs | gelf | logstash
```

Structured logs are provided by default.

`2025-09-04T01:04:02.264+09:00  INFO 68248 --- [    Test worker] y.t.ai_tracker.LoggingVerificationTests  : This is a structured log test.`

The existing logs are in a format easy for users to understand.
`Timestamp - Log Level - Process ID - Thread Name - Log Class - Log Message`

However, it's difficult for computers to parse. It's unclear where to split or what's precisely what, etc.

For this, a structured log format is used.

- ecs: Elastic Common Schema
It aids in the integrated collection, search, and analysis of logs in an ELK environment.

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

Providing information about processes and threads is a key point here.

- GELF: Graylog Extended Log Format

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

`version` is the version of gelf, `level` is the log level.
It's said to be optimized for network transmission (supports compression and chunk splitting).

- logstash: Logstash JSON Event Format

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

Simpler and flat structure compared to ECS (everything is unfolded).

### ⭐️ Change in Hibernate Behavior

This is quite important.

With the update to Hibernate version 6.6, there are changes in behavior.

- Reference Link: [Spring Boot 3.4.0 lets integration tests with JPA/Hibernate fail](https://stackoverflow.com/questions/79228209/spring-boot-3-4-0-lets-integration-tests-with-jpa-hibernate-fail)

```java
@Test  
@DisplayName("Persisting a new entity manually assigned an ID can throw an exception (Spring Boot 3.4+).")
void persist_newEntityWithId_throwsException() {  
    TestEntity entity = new TestEntity(2L, "");  
    assertThatThrownBy(() -> testEntityRepository.save(entity))  
        .isInstanceOf(ObjectOptimisticLockingFailureException.class);  
}
```

As seen here, an error occurs if an ID is specified for an entity that doesn't actually exist and then persisted.

```
Row was updated or deleted by another transaction (or unsaved-value mapping was incorrect): [$TestEntity#2]
org.hibernate.StaleObjectStateException: Row was updated or deleted by another transaction (or unsaved-value mapping was incorrect)
```

Changes in the DefaultMergeEventListener code led to this behavior.

- Old version of the code

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

- Current version of the code

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

According to this, it checks whether the entity is in a detached state, and if it is and not found in the database (whether deleted or not), it throws a StaleObjectStateException.

The TODO item has improved to clearly confirm if it's transient.

> Why was this change made?
> The previous `merge` operation could result in unexpected consequences by `INserting` a `detached` entity not present in the database, and there was a potential to violate optimistic locking rules.
> (Of course, we were aware of such dangers and managed it well enough not to let them occur in real situations)
> -> By more accurately distinguishing the entity's state (new or deleted), it appropriately throws an exception in conflict situations.

Due to this change, in tests, you should no longer insert non-existing IDs and handle them arbitrarily.

### MockitoBean

A minor change, but `MockBean` has been deprecated.

The way MockBean works was

1. Creating an Application Context according to Spring's TestContext settings.
2. The MockBean listener intervenes in the created context and replaces the specific Bean with a Mock proxy object.

This involved modifying the completed context, which could lead Spring to consider the context contaminated and recreate it.

Additionally, MockBean belonged to the Spring Boot dependencies, i.e., `org.springframework.boot.test.mock.mockito`.
(Surprisingly, if it wasn't Spring Boot, MockBean couldn't be used!)

Now, instead, it's recommended to use `MockitoBean`.

The way it works is

1. Before the TestContext framework creates the Application Context, the `@MockitoBean` customizer operates first.
2. The customizer overrides the Beans to be mocked.
3. Spring creates the ApplicationContext using the redefined Beans from the start.

Thus, there's no contamination caused by modifying the context.

And, the `MockitoBean` package is `org.springframework.test.context.bean.override.mockito`.

## 3.5

[Spring Boot 3.5 Release Note](https://github.com/spring-projects/spring-boot/wiki/Spring-Boot-3.5-Release-Notes)

### Actuator headump endpoint

The heap dump endpoint's access has changed to `access=NONE`.
Explicit permission must be granted to use it.

### `@ServletRegistration`, `@FilterRegistration`

The current method is to implement Servlet and Filter, then manage them directly through `@Configuration - @Bean`.

```java
@Order(1)  
public class BodyFilter implements Filter {
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

Filter is a Java Servlet standard technology, not a Spring framework technology.
This means that the servlet container manages the lifecycle (creation, setting, execution, etc.) of the filter.
(Therefore, they used to be registered and managed in the web.xml file.)

In Spring Boot, an intermediate bean was provided to facilitate these servlet containers.
(`FilterRegistrationBean` is included in the `org.springframework.boot.web.servlet` package.)

Based on this bean information, it was conveyed to the servlet container for registration.

However, this too seemed to feel like some kind of inconvenience.

```java
@Component
@Order(1)
@WebFilter(urlPatterns = "/api/")
public class BodyFilter implements Filter {
	@Override  
	public void doFilter(ServletRequest servletRequest, ServletResponse servletResponse, FilterChain filterChain) throws IOException, ServletException {
	...
	}
}
```

Using annotation-based code, which Spring Boot prefers, it became much more concise.

### AsyncTaskExecutor with Custom Executor

Spring Boot automatically configures a thread pool Bean named `AsyncTaskExecutor` for supporting the `@Async` annotation. (`SimpleAsyncTaskExecutor`)

But if a user creates a bean of the same type, the user's configuration is prioritized. (backs off)

Therefore, the following issues can arise.

- The method with the Async annotation may not operate asynchronously, or problems might occur due to unknown thread pool usage.
- If there's an Executor type bean, the automatic configuration of AsyncTaskExecutor for Async is skipped.

By declaring `spring.task.execution.mode=force`, the default AsyncTaskExecutor is created in addition to the user-declared bean.

---

## Java 25

Java 25 has finally been introduced!

So, taking this opportunity, let's briefly reference and summarize from [New Features in Java 25](https://www.baeldung.com/java-25-features).

### Primitive Types in Patterns - JEP 507

```java
if(obj instanceof int i){
	System.out.println(i);
}
```

Pattern checks are possible even for primitive types, not just for wrappers or objects.

I haven't actually used such cases, but adding this seems harmless 😎

### Module Import Declarations - JEP 511 Preview

Could this be quite a significant change...?

```java
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
```

When writing business logic, unnecessary lines like these occur.

You can change the above code to:

```java
import module java.util;
```

Instead, if there's ambiguity caused by classes with the same name in a module:

```java
import module java.base;
import module java.sql;

import java.sql.Date;
```

You'd need to specify like this.

> Since it's still in preview, we need to keep an eye on it.
> While studying Nest.js, there was a module pattern which sometimes seemed to disrupt cohesion and intention; perhaps this is why it's still in preview.

### Instance Main Methods - JEP 512

```
void main() {
	System.out.println("Hello from Java 25!!!");
}
```

At last, even Java allows a top-level main declaration instead of the unnecessary class-main pattern...

It preserves the JVM rule (public static void main) while having the compiler create the code to satisfy the rule, essentially being syntactic sugar.
(This is better than nothing...)

### Flexible Constructor Bodies - JEP 513

Java's constructor syntax is becoming more flexible.

While attending the educational institute, it was emphasized that constructors should perform the role of constructors when writing object-oriented code.

For example, a Student class should validate the age while constructing if there are requirements like `6 <= x <= 20`.

```java
Student(String name, int age) {
	if (age < 6 || age > 20)
		throw new IllegalArgumentException("Age must be between 6 and 20");
	super(age);
	this.name = name;
}
```

In the past, the super or this constructor methods had to be the first line due to Java's syntax.
That's why static factories were made, wherein validation occurred before creating the object through a constructor.

```java
public static Student from(String name, int age){
	validateAge(age);
	return new Student(age,name);
}
```

Now, super and this do not necessarily have to be the first statement.
(Of course, `this.` can't be accessed before super or this is called.)

### Scoped Values - JEP 506 - final

ScopedValues have emerged to replace ThreadLocal.

- Lightweight
- Immutable
- Thread-safe

> Since ThreadLocal was introduced in JDK 1.2, naturally it had several drawbacks...

We should delve into this ScopedValue in more detail soon.

Primarily, ThreadLocal was designed for existing threads and is implemented internally with something akin to a hash table, like ThreadLocalMap.
What if each virtual thread used its own ThreadLocal?

- Memory issue: Imagine creating millions of ThreadLocalMaps...? It would be colossal.
- Performance issue: To inherit the value from parent threads, the maps need to be copied every time a child thread is created.
- Complexity in data management: In a thread pool environment, if ThreadLocal is not removed after use, another request dealing with the thread can inadvertently use previous request data.

The code style doesn't seem very different, though...?

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

If it were ThreadLocal

```java
private static final ScopedValue<String> nameContext = ScopedValue.newInstance();

public void process(String name) {
	ScopedValue.where(nameContext, user)
			.run(() -> {
				...
				nameContext.get();
				new Thread(() -> System.out.println("Child thread"))
			}).start();
	}
}
```

ScopedValue allows for securely and efficiently sharing immutable data within a scope.
Inheritance to child threads is also a bonus.

The run operation starts with the user value set and automatically returns after it's done.
Getting used to it might make it quite handy...?

### Structured Concurrency - JEP 505 - Fifth Preview

> Fifth Preview: Meaning it's the fifth preview, having undergone improvements four times...!

Aimed at simplifying concurrency with a proper lifecycle for related threads.

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
        System.err.println("[CF] Task failed: " + e.getCause().getMessage());  
    } finally {  
        executor.shutdown();  
    }  
}
```

Working on tasks asynchronously like this induces a lot of boilerplate code.

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
        System.err.println("[STS] Overall task failure reason: " + e.getMessage());  
    }  
}
```

Using Scope makes handling tasks straightforward and safe.
(Auto-cancels upon failure, automatically returns with try-with-resources)

If you wonder, "But what about ThreadPools?" then you're thinking the right thing.

StructuredTaskScope allocates threads using Virtual Threads.

> It still feels a bit chilling to deal with things without ThreadPools...

### Stable Value - JEP 502 Preview

Since it's only the first preview, let's briefly explain it.

StableValue bears a very similar API to Optional and is an object holding immutable data.
JVM considers it as a constant, allowing the same performance optimizations as when declaring fields final.

The key goal is to allow lazy initialization while achieving performance similar to final fields.

It might seem puzzling why it exists just by listening, but it simply solves the boilerplate we commonly use!

```java
private Logger INSTANCE = null;
Logger getLogger() {
	if (logger == null) {
		logger = Logger.create(Controller.class);
	}
	return logger;
}
```

In a situation requiring lazy initialization for start time,
you cannot declare `final` and must verify via `if`.

Of course, to prepare against memory visibility + race conditions, etc.

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

The code becomes messier.

However, using StableValue:

```java
private final StableValue<Logger> logger = StableValue.of();

Logger getLogger() {
	return logger.orElseSet(() -> Logger.create(OrderController.class));
}
```

Final is possible, and it's become highly concise!
(Furthermore, as it resembles Optional, the learning curve seems minimal.)

Other features,
`PEM Encodings ,Vector API, Key Derivation` don't seem very interesting, so I'll skip them 😔

### Other Changes

- AOT Command-Line Ergonomics - JEP 514 Final: Deactivates dynamic features to simulate an AOT compilation environment.

For performance enhancement based on AOT, dynamically loading classes/runtime reflection should be reduced.
The flag allows deactivation to see if it suits the AOT environment and to identify problematic parts.

- Compact Object Headers - JEP 519 Final: Reduces the size of object headers for Java objects on a 64-bit architecture.

Java objects have a header containing information for identification and management in memory.
The header holds object hashcode, GC information, lock, etc.

> If you're curious about this header, I recommend exploring with a library called Java Object Layout.
> [Useless Java Trivia with JOL](https://youngsu5582.life/posts/useless-java-trivia-with-jol) could also be a good reference for this content.

It says the layout of this header has been compressed and improved to reduce size.
For a developer, it's a happy situation where object memory usage automatically reduces without doing anything.

---

## Conclusion

While it doesn't feel like an "innovation!", the language steadily improving is palpable.

Especially, it feels good to see the continuous forward move toward virtual threads.
Java might not be the greatest language, but could it be called a legacy & declining language? I can certainly say, no.

Spring's convenience, Java's improvement, and the continuing community (unless it’s different overseas...)
