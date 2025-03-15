---
title: "SpringBootApplication 톺아보기 ( SpringBootApplication 와 EntityScan 를 따로 지정해야 하는 이유 )"
author: 이영수
date: 2024-12-26T16:25:21.025Z
tags: ['AutoConfiguration', 'SpringBootApplication', '우테코', '스프링']
categories: ['백엔드', '스프링']
description: 스프링 부트의 자동 의존성 주입
---
> 이번 내용은 스프링부트가 어떻게 컴포넌트 스캔 및 의존성 설정을 하는지 부분에 대해 다룹니다. 혹시, 잘못된 내용이 있다면 댓글로 또는 joyson5582@gmail.com로 남겨주세요!

현재, 프로젝트를 진행하며 
`Parameter 1 of constructor in lotto.domain.implementation.LottoPaperGenerator required a bean of type 'lotto.domain.repository.LottoRepository' that could not be found.`

이와같이 `Repository` 를 발견하지 못한다는 에러가 나왔다.

```kotlin
import org.springframework.boot.autoconfigure.SpringBootApplication  
import org.springframework.boot.runApplication  
  
@SpringBootApplication(scanBasePackages = ["lotto", "purchase", "toss"])  
class LottoApplication  
  
fun main(args: Array<String>) {  
    runApplication<LottoApplication>(*args)  
}
```

이와같이 분명히 지정했는데?
-> 되게 간단한 문제였지만, 기초지식 부족으로 헤맸다. 🥲

```kotlin
@EntityScan(basePackages = ["lotto", "purchase"])  
@EnableJpaRepositories(basePackages = ["lotto", "purchase"])
```

정답부터 보면, 이와 같이 추가만 해주면 된다.
그러면, 이제 왜 이와같이 `SpringBootApplication` 가 아니라 따로 지정을 해줘야 하는지 탐구해본다.

# SpringBootApplication

```java
@Inherited  
@SpringBootConfiguration  
@EnableAutoConfiguration  
@ComponentScan(  
    excludeFilters = {@Filter(  
    type = FilterType.CUSTOM,  
    classes = {TypeExcludeFilter.class}  
), @Filter(  
    type = FilterType.CUSTOM,  
    classes = {AutoConfigurationExcludeFilter.class}  
)}  
)  
public @interface SpringBootApplication {
```

우리가 흔히 지정하는 `SpringBootApplication` 내부에는 이와같이 되어있다.

`AutoConfiguration` 어노테이선을 가지는 클래스는 자동으로 제외한다.

```java
public boolean match(MetadataReader metadataReader, MetadataReaderFactory metadataReaderFactory) throws IOException {  
    return this.isConfiguration(metadataReader) && this.isAutoConfiguration(metadataReader);  
}
```

- `TypeExcludeFilter` 와 `AutoConfigurationExcludeFilter` 는 자동 구성 클래스들을 제외하게 한다.
( 테스트때 효율성 및 속도를 위해 사용하는 것 )

생각보다 단조롭게 되어있다.

# SpringBootConfiguration

```java
@Configuration  
@Indexed
public @interface SpringBootConfiguration {
	@AliasFor(annotation = Configuration.class)  
	boolean proxyBeanMethods() default true;
}
```

- proxyBean 을 생성할지 결정한다. - true 시, CGLIB 로 빈 생성 + 프록시 기능 제공 

## Index

```java
@Target(ElementType.TYPE)  
@Retention(RetentionPolicy.RUNTIME)  
@Documented  
public @interface Indexed {  
}
```

클래스패스 스캐닝을 대체하고, 메타데이터 기반 컴포넌트 스캔을 지원하기 위해 사용
-> 컴파일 때 작업을 통해 런타임 때 시간을 늘린다!

```java
@Indexed
@Service
public @interface LottoService {
    ...
}
```

이와같이 커스텀 어노테이션을 만들면?
-> `LottoService` 와 `Component` 두 가지 스테레오 타입으로 인덱싱이 된다.

> 스테레오 타입 : 고정관념 - 흔히 사용하는 `@Controller` , `@Service` 등등

```java
@Indexed
public interface AdminService {
}

public class ConfigurationAdminService implements AdminService {
}
```

`AdminService` 라는 스테레오타입으로 자동 인덱싱된다.
그리고, 이런 인덱스들을 기반으로

```java
com.example.MyComponent=org.springframework.stereotype.Component
com.example.PrivilegedService=com.example.PrivilegedService
com.example.AdminService=com.example.AdminService
```

`META-INF/spring.components` 라는 파일이 생성된다.
( 이때, FQCN(Fully Qualified Class Name) 으로 주로 반환 )

### META-INF
META-INF 를 통해 스프링은 클래스패스 스캐닝 대신 바로 로딩을 할 수 있게 된다.
( 이를 `CandidateComponentsIndex` 가 읽어서 하나씩 불러온다. )

```kts
annotationProcessor("org.springframework:spring-context-indexer")
```

의존성 설치 후, 실제 생성이 되는걸 확인하려 했는데 

`jar xf spring-lotto-0.0.1-SNAPSHOT.jar` 와 같이 실제 파일을 풀어도 `components` 들이 나타나지 않았다.

> 시도해보지 않은 이유로
> [# Deprecate spring-context-indexer](https://github.com/spring-projects/spring-framework/issues/30431)
> Indexer 기반 최적화가 `Deprecated` 됐기 때문이다.
> 
> 스프링 팀 답변 : MetaData - Indexer 의 기본적인 한계 및 확장성 문제로, AOT 를 통해 유연성과 최적화 정도를 조정하려고 한다.
-> > `7.0` 이전에 완전히 제거가 되진 않으나, AOT 로 전환을 준비하라고 한다.
>   
  라는 내용을 봤다. 더 좋은 방향성을 기반으로 최적화를 해나가려고 하는것 같다.

=> 결론적으로 `Indexed` 는 빌드 시간 최적화를 위해 제공해주는 어노테이션이다.

## Configuration

```java
@Component  
public @interface Configuration {
	
	@AliasFor(annotation = Component.class)  
	String value() default "";
	
	boolean proxyBeanMethods() default true;
	boolean enforceUniqueMethods() default true;
}
```

`Configuration` 이 선언된 클래스 역시도 Bean 으로 등록된다. ( `Component` 가 있으므로 )
`Configuration` 을 스프링이 관리하는 이유가 있다. ( 하단에서 설명 )

```java
@Configuration
public class AppConfig {

    @Bean
    public MyServiceImpl myService() {
        return new MyServiceImpl();
    }

    @Bean
    public AnotherServiceImpl anotherService() {
        return new AnotherServiceImpl(myService());
    }
}
```

이와같이 선언되어 있으면?
`@Bean` 은 스프링 컨테이너 관리하에 속하게 된다.

### VS Component

```java
if (isProduction) {
	return new HikariDataSource();
} else {
	return new EmbeddedDatabaseBuilder().build();
}
```

- `Configuration - Bean` 을 통해 조건부 적으로 빈 생성이 가능하다.

```java
@Bean
public ObjectMapper objectMapper() {
    return new ObjectMapper();
}

```

- 외부 라이브러리를 의존성으로 주입한다.

```java
@Bean(initMethod = "...", destroyMethod = "...")  
fun tossPaymentClient(tossClientProperties: TossClientProperties): TossPaymentClient {  
    return TossPaymentClient(restClient(), tossClientProperties)  
}
```

빈이 생성될떄 메소드, 빈이 소멸될때 메소드를 지정 가능하다.

### Configuration With CGLIB

그리고, `Configuration` 의 가장 큰 장점은 `proxyBeanMethods` 를 지정 가능하게 하는 것이다.
( 이게 스프링이 관리하는 이유 )

```kotlin
@Configuration
@EnableConfigurationProperties(TossClientProperties::class)  
class TossClientConfig {  
    @Bean  
    fun restClient(): RestClient {  
        println("Execute!")  
        return RestClient.builder().baseUrl("https://api.tosspayments.com").build()  
    }  
  
    @Bean  
    fun tossPaymentClient(tossClientProperties: TossClientProperties): TossPaymentClient {  
        println(restClient())  
        return TossPaymentClient(restClient(), tossClientProperties)  
    }  
}
```

이와같이 위 메소드를 사용해 아래 `Bean` 에 주입을 하면?

```
Execute!
org.springframework.web.client.DefaultRestClient@a47a011
```

CGLIB 가 메소드 호출을 가로채서 한번만 실행을 하게 해준다.
실제 객체를 받지만, 호출은 한번만 한다.
스프링이 가로채서 불필요한 호출 및 반복을 방지한다.
( 계속 메소드가 호출되어 생성된다면 문제가 되는 일도 존재할 것이므로 )

```java
@Configuration(proxyBeanMethods = false)  
@EnableConfigurationProperties(TossClientProperties::class)  
class TossClientConfig {  
    @Bean  
    fun restClient(): RestClient {  
        println("Execute!")  
        return RestClient.builder().baseUrl("https://api.tosspayments.com").build()  
    }  
  
    @Bean  
    fun tossPaymentClient(tossClientProperties: TossClientProperties): TossPaymentClient {  
        println(restClient())  
        return TossPaymentClient(restClient(), tossClientProperties)  
    }  
}
```

```
Execute!
org.springframework.web.client.DefaultRestClient@480d3c40
Execute!
Execute!
```

CGLIB 가 관리해주지 않으므로 매번 실행이 된다.
( 매번 실행을 해도, `Bean` 에는 하나만 등록이 되긴 한다. )

추가로,
우리가 흔히 사용하지 않아서 그렇지, `@Component` 내부에서도 `@Bean` 은 생성 가능하다!

```kotlin
@Component
class TossPaymentClient{
	@Bean  
	fun createMyBean(): MyBean {  
	    println("Execute")  
	    return MyBean()  
	}  
	  
	@Bean  
	fun createAnotherBean(): AnotherBean {  
	    println(createMyBean())  
	    println(createMyBean())  
	    return AnotherBean(createMyBean())  
	}
}
```

이러면 proxyBeanMethods 를 false 로 한것과 동일하게 작동한다.
( 메소드 계속 호출 - 스프링이 관리해주지 않으므로 )
# EnableAutoConfiguration

```java
@AutoConfigurationPackage
@Import({AutoConfigurationImportSelector.class})  
public @interface EnableAutoConfiguration {  
    String ENABLED_OVERRIDE_PROPERTY = "spring.boot.enableautoconfiguration";  
  
    Class<?>[] exclude() default {};  
  
    String[] excludeName() default {};  
}
```

`Auto Configuration` 을 활성화한다.
-> Spring Boot 가 다양한 설정 자동으로 구성하게 해준다.
( `starter` 들은 spring-boot-autoconfigure 라는 하위 모듈을 Import 해 자동 구성이 되게 한다. - [참고 링크](https://wildeveloperetrain.tistory.com/292) )

## AutoConfigurationImportSelector

[참고 링크](https://wildeveloperetrain.tistory.com/292)

AutoConfigurationImportSelector 클래스에서
자동 구성할 후보 빈들을 불러서 제외 + 중복된 빈들을 제거하는 작업을 거친 후 자동 구성할 `Configuration` 들을 반환해준다.

`META-INF/spring/org.springframework.autoconfigure.AutoConfiguration.imports` 라는 파일에 이와같이 `Configuration` 들이 위치한다.

```
org.springframework.boot.autoconfigure.web.servlet.WebMvcAutoConfiguration  
org.springframework.boot.autoconfigure.websocket.reactive.WebSocketReactiveAutoConfiguration
org.springframework.boot.autoconfigure.elasticsearch.ReactiveElasticsearchClientAutoConfiguration  
org.springframework.boot.autoconfigure.flyway.FlywayAutoConfiguration
```

또는, `META-INF/spring.factories` 파일에 정의된 자동 구성 클래스들을 가져온다.
`OnBeanCondition, OnClassCondition, OnWebApplicationCondition` 을 통해 요소들을 필터링한다.

조건에 만족한 `Configuration` 을 통해 `Bean` 들을 `ApplicationContext` 에 넣는다.

## AutoConfigurationPackage

[참고 링크](https://sundaland.tistory.com/383)

특정 패키지와 그 하위 패키지들을 자동으로 스캔하게 해준다.

```java
@Import({AutoConfigurationPackages.Registrar.class})  
public @interface AutoConfigurationPackage {  
    String[] basePackages() default {};  
  
    Class<?>[] basePackageClasses() default {};  
}
```

이 `Registrar` 를 통해 애플리케이션이 위치한 패키지,하위 패키지내 특정 클래스들을 찾게 해준다.
( `Service`, `Controller`, `Component` 등등 )
-> 즉, `@SpringBootApplication` , `@EnableAutoConfiguration` 이 위치한 루트 패키지에서 자동으로 찾아주는 것
=> 그래서, 우리 프로젝트 내 `Service`,`Controller` 등이 의도대로 동작하게 해주는 것이다.

```java
static class Registrar implements ImportBeanDefinitionRegistrar, DeterminableImports {

	@Override
	public void registerBeanDefinitions(AnnotationMetadata metadata, BeanDefinitionRegistry registry) {
		register(registry, new PackageImports(metadata).getPackageNames().toArray(new String[0]));
	}

	@Override
	public Set<Object> determineImports(AnnotationMetadata metadata) {
		return Collections.singleton(new PackageImports(metadata));
	}

}
```

-> 패키지 구조만 잘 관리하면 스프링 부트가 자동으로 스캔 및 활성화

# ComponentScan

```java
String[] basePackages() default {};
@ComponentScan(  
    excludeFilters = {@Filter(  
    type = FilterType.CUSTOM,  
    classes = {TypeExcludeFilter.class}  
), @Filter(  
    type = FilterType.CUSTOM,  
    classes = {AutoConfigurationExcludeFilter.class}  
)}  
)
public @interface SpringBootApplication {
```

ApplicationContext 는 최상위(root) 패키지에 위치하게 되어있다.
컴포넌트 스캔이 **설정 클래스가 위치한 패키지부터 시작**되기 때문이다.

`com.componentscan.springbootapp` 에 `SpringBootApplication` 가 위치하면?

- `com.componentscan.springbootapp.animals`
- `com.componentscan.springbootapp.flowers`

와 같은 하위 경로를 자동으로 인식한다.

## ComponentScan 순서

1. `ConfigurationClassParser` 가 `@Configuration` 을 파싱한다.
( 하나의 클래스가 여러개 Configuration 가져오는 거 까지 처리 )
( 내부 `@Bean` 을 프록시 처리하기 위한 작업 )

2. `ComponentScanAnnotationParser` 가 `@Component`
( basePackage, classes 기반으로 스캔 )

=> 두개를 통해 어디를 스캔할지, 어떻게 스캔할지 결정

3. `ClassPathBeanDefinitionScanner` 을 통해 실제 스캔 위치 스캔해 ( `ClassLoader` ) `BeanDefinition` 생성

4. `BeanDefinition` 통해 빈 생성해서 `ApplicationContext` 에 등록

> ApplicationContext 와 BeanFactory 는 같은 기능을 제공하나 ApplicationContext 가 더 많은 기능을 제공한다.
> -> 메모리 효율 극한으로 할 게 아니면 ApplicationContext 를 사용하자. 👍 ( 국제화 메시지, 프로파일 환경 제공 )

### AutoConfiguration

Spring Boot 와 연동되는 라이브러리 의존성을 추가시 ( `*-starter` )
빈 설정과 생성을 자동으로 해주는 기능

```java
@Configuration(proxyBeanMethods = false)
@AutoConfigureBefore
@AutoConfigureAfter
public @interface AutoConfiguration {

	@AliasFor(annotation = Configuration.class)
	String value() default "";

	@AliasFor(annotation = AutoConfigureBefore.class, attribute = "value")
	Class<?>[] before() default {};

	@AliasFor(annotation = AutoConfigureBefore.class, attribute = "name")
	String[] beforeName() default {};

	@AliasFor(annotation = AutoConfigureAfter.class, attribute = "value")
	Class<?>[] after() default {};

	@AliasFor(annotation = AutoConfigureAfter.class, attribute = "name")
	String[] afterName() default {};
}
```

`AutoConfiguration` 의 구성 순서를 지정하기 위해 사용한다.
-> `Before` 를 통해 다른 자동 클래스보다 먼저 실행되야 함을 지정, `After` 를 통해 다른 자동 클래스보다 나중에 실행되야 함을 지정

결국 위에서 설명한 내용들과 공유된다.
예시로, `RedisAutoConfiguration` 을 확인해보면?

```java
@AutoConfiguration  
@ConditionalOnClass({RedisOperations.class})  
@EnableConfigurationProperties({RedisProperties.class})  
@Import({LettuceConnectionConfiguration.class, JedisConnectionConfiguration.class})  
public class RedisAutoConfiguration {
	...
}
```

`@ConditionalOnClass({RedisOperations.class})` `RedisOperations.class` 라는 클래스가 있으면?
-> 의존성을 동작하게 한다. ( `@Conditional({OnClassCondition.class})`  를 가지고 있음 )

추가적으로 설명을 더하면

```java
@Bean  
@ConditionalOnMissingBean({RedisConnectionDetails.class})  
PropertiesRedisConnectionDetails redisConnectionDetails(RedisProperties properties) {  
    return new PropertiesRedisConnectionDetails(properties);  
}
```

위와같이 명시된 경우에는
`RedisConnectionDetails` 타입의 빈이 등록되어 있지 않다면?
-> 함수가 동작해서 `@Bean` 을 생성한다.

`public interface RedisConnectionDetails extends ConnectionDetails `

이와같이 Interface 로 되어 있어서 우리가 정의해놓지 않으면 기본으로 설정해서 생성된다.

## 결론

`@SpringBootApplication(scanBasePackages = ["lotto", "purchase", "toss"])`  는 `SpringBoot` 의 기본적인 스테레오타입을 인지하게 해준다.
( `package org.springframework.boot.autoconfigure; - AutoConfigurationImportSelector` 로 구성 )
`SpringBootApplication` 의 `basePackage` 및 `ComponentScan` 은 다른 설정들과 공유하지 않는다.

그렇기에, `EntityScan` 과 `EnableJpaRepositories` 는 추가적인 지정을 해줘야 한다.

`package org.springframework.boot.autoconfigure.domain; - EntityScan`
`package org.springframework.data.jpa.repository.config; - EnableJpaRepositories`

추가로, 패키지는 이와같이 지정되어 있다.
( 왜, 같은 `autoconfigure` 인데 공유를 하게 해주지 않을까? 이를 한다면, 더 복잡해지는 경우가 있기 때문일거 같다. )

결론은

- 애플리케이션의 메인 패키지 및 그 하위 패키지를 기반으로 작동한다.
- `EntityScan` 와 `EnableJpaRepositories` 는 `SpringBootApplication` 와 별도로 동작한다.
- 그러므로, 별도로 패키지명들을 지정해줘야 한다.

이다!

아마, 틀린 내용들도 있을거 같다.
완벽하게 찾기엔, 너무나 복잡한 스프링인걸...

코드는 [깃허브 저장소](https://github.com/youngsu5582/lotto) 에 위치합니다.
( 아직, 작성한 부분은 올리지 않았습니다..! 🥲 )
