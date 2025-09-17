---
title: "SpringBootApplication Deep Dive (Why SpringBootApplication and EntityScan Should Be Specified Separately)"
author: 이영수
date: 2024-12-26T16:25:21.025Z
tags: ['AutoConfiguration', 'SpringBootApplication', 'Wooteco', 'Spring']
categories: ['Backend', 'Spring']
description: "Automatic dependency injection in Spring Boot"
lang: en
permalink: /posts/springbootapplication-deep-dive-why-springbootapplication-and-entityscan-should-be-specified-separately/
---

> This post has been translated from Korean to English by Gemini CLI.

> This content covers how Spring Boot performs component scanning and dependency injection. If there are any incorrect contents, please leave a comment or contact me at joyson5582@gmail.com!

Currently, while working on a project,
`Parameter 1 of constructor in lotto.domain.implementation.LottoPaperGenerator required a bean of type 'lotto.domain.repository.LottoRepository' that could not be found.`

An error appeared stating that `Repository` could not be found.

```kotlin
import org.springframework.boot.autoconfigure.SpringBootApplication  
import org.springframework.boot.runApplication  
  
@SpringBootApplication(scanBasePackages = ["lotto", "purchase", "toss"])  
class LottoApplication  
  
fun main(args: Array<String>) {  
    runApplication<LottoApplication>(*args)  
}
```

I clearly specified it like this, but?
-> It was a very simple problem, but I struggled due to lack of basic knowledge. 🥲

```kotlin
@EntityScan(basePackages = ["lotto", "purchase"])  
@EnableJpaRepositories(basePackages = ["lotto", "purchase"])
```

To get straight to the point, you just need to add it like this.
Now, let's explore why it needs to be specified separately, not as `SpringBootApplication`.

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

This is what is inside `SpringBootApplication`, which we commonly specify.

Classes with the `AutoConfiguration` annotation are automatically excluded.

```java
public boolean match(MetadataReader metadataReader, MetadataReaderFactory metadataReaderFactory) throws IOException {  
    return this.isConfiguration(metadataReader) && this.isAutoConfiguration(metadataReader);  
}
```

- `TypeExcludeFilter` and `AutoConfigurationExcludeFilter` exclude auto-configuration classes.
(Used for efficiency and speed during testing)

It's simpler than I thought.

# SpringBootConfiguration

```java
@Configuration  
@Indexed
public @interface SpringBootConfiguration {
	@AliasFor(annotation = Configuration.class)  
	boolean proxyBeanMethods() default true;
}
```

- Determines whether to create a proxyBean. - If true, it creates a bean with CGLIB + provides proxy functionality.

## Index

```java
@Target(ElementType.TYPE)  
@Retention(RetentionPolicy.RUNTIME)  
@Documented  
public @interface Indexed {  
}
```

Used to replace classpath scanning and support metadata-based component scanning.
-> Increases runtime by performing tasks at compile time!

```java
@Indexed
@Service
public @interface LottoService {
    ...
}
```

What if you create a custom annotation like this?
-> It is indexed with two stereotype types: `LottoService` and `Component`.

> Stereotype: A fixed idea - commonly used `@Controller`, `@Service`, etc.

```java
@Indexed
public interface AdminService {
}

public class ConfigurationAdminService implements AdminService {
}
```

It is automatically indexed with the `AdminService` stereotype.
And, based on these indexes,

```java
com.example.MyComponent=org.springframework.stereotype.Component
com.example.PrivilegedService=com.example.PrivilegedService
com.example.AdminService=com.example.AdminService
```

`META-INF/spring.components` file is created.
(At this time, it mainly returns as FQCN (Fully Qualified Class Name))

### META-INF
Through META-INF, Spring can load directly instead of classpath scanning.
( `CandidateComponentsIndex` reads this and loads them one by one.)

```kotlin
annotationProcessor("org.springframework:spring-context-indexer")
```

After installing the dependency, I tried to check if it was actually created, but the `components` did not appear even if I extracted the actual file with `jar xf spring-lotto-0.0.1-SNAPSHOT.jar`.

> The reason I didn't try it was:
> [# Deprecate spring-context-indexer](https://github.com/spring-projects/spring-framework/issues/30431)
> This is because Indexer-based optimization has been `Deprecated`.
> 
> Spring team's answer: Due to the basic limitations and scalability issues of MetaData - Indexer, they are trying to adjust the flexibility and optimization level through AOT.
-> > It will not be completely removed before `7.0`, but it is said to prepare for the transition to AOT.
>   
  I saw this content. It seems like they are trying to optimize based on a better direction.

=> In conclusion, `Indexed` is an annotation provided for build time optimization.

# Configuration

```java
@Component  
public @interface Configuration {
	
	@AliasFor(annotation = Component.class)  
	String value() default "";
	
	boolean proxyBeanMethods() default true;
	boolean enforceUniqueMethods() default true;
}
```

Classes declared with `Configuration` are also registered as Beans. (Because there is `Component`)
There is a reason why Spring manages `Configuration`. (Explained below)

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

What if it's declared like this?
`@Bean` belongs under Spring container management.

### VS Component

```java
if (isProduction) {
	return new HikariDataSource();
} else {
	return new EmbeddedDatabaseBuilder().build();
}
```

- Conditional bean creation is possible through `Configuration - Bean`.

```java
@Bean
public ObjectMapper objectMapper() {
    return new ObjectMapper();
}

```

- Injects external libraries as dependencies.

```java
@Bean(initMethod = "...", destroyMethod = "...")  
fun tossPaymentClient(tossClientProperties: TossClientProperties): TossPaymentClient {  
    return TossPaymentClient(restClient(), tossClientProperties)  
}
```

Methods can be specified when a bean is created and when a bean is destroyed.

### Configuration With CGLIB

And, the biggest advantage of `Configuration` is that it allows you to specify `proxyBeanMethods`.
(This is why Spring manages it)

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

If you use the above method to inject into the `Bean` below?

```
Execute!
org.springframework.web.client.DefaultRestClient@a47a011
```

CGLIB intercepts method calls and executes them only once.
It receives actual objects, but calls them only once.
Spring intercepts and prevents unnecessary calls and repetitions.
(Because if methods are continuously called and created, problems may arise.)

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

Since CGLIB does not manage it, it is executed every time.
(Even if it is executed every time, only one `Bean` is registered.)

Additionally,
Even though we don't commonly use it, `@Bean` can be created inside `@Component`!

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

This works the same as setting `proxyBeanMethods` to false.
(Methods are continuously called - because Spring does not manage them)
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

Activates `Auto Configuration`.
-> Spring Boot automatically configures various settings.
(`starter`s import a submodule called `spring-boot-autoconfigure` to enable auto-configuration. - [Reference Link](https://wildeveloperetrain.tistory.com/292))

## AutoConfigurationImportSelector

[Reference Link](https://wildeveloperetrain.com/292)

In the `AutoConfigurationImportSelector` class,
it calls candidate beans for auto-configuration, excludes them + removes duplicate beans, and then returns `Configuration`s to be auto-configured.

`Configuration`s are located in `META-INF/spring/org.springframework.autoconfigure.AutoConfiguration.imports` file like this.

```
org.springframework.boot.autoconfigure.web.servlet.WebMvcAutoConfiguration  
org.springframework.boot.autoconfigure.websocket.reactive.WebSocketReactiveAutoConfiguration
org.springframework.boot.autoconfigure.elasticsearch.ReactiveElasticsearchClientAutoConfiguration  
org.springframework.boot.autoconfigure.flyway.FlywayAutoConfiguration
```

Alternatively, it fetches auto-configuration classes defined in `META-INF/spring.factories` file.
It filters elements through `OnBeanCondition`, `OnClassCondition`, `OnWebApplicationCondition`.

It puts `Bean`s into `ApplicationContext` through `Configuration` that satisfies the conditions.

## AutoConfigurationPackage

[Reference Link](https://sundaland.tistory.com/383)

Automatically scans specific packages and their sub-packages.

```java
@Import({AutoConfigurationPackages.Registrar.class})  
public @interface AutoConfigurationPackage {  
    String[] basePackages() default {};  
  
    Class<?>[] basePackageClasses() default {};  
}
```

Through this `Registrar`, it finds specific classes within the package where the application is located and its sub-packages.
(`Service`, `Controller`, `Component`, etc.)
-> That is, it automatically finds them in the root package where `@SpringBootApplication` and `@EnableAutoConfiguration` are located.
=> Therefore, `Service`, `Controller`, etc. in our project operate as intended.

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

-> If the package structure is well managed, Spring Boot automatically scans and activates it.

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

`ApplicationContext` is located in the top-level (root) package.
This is because component scanning **starts from the package where the configuration class is located**.

If `SpringBootApplication` is located in `com.componentscan.springbootapp`?

- `com.componentscan.springbootapp.animals`
- `com.componentscan.springbootapp.flowers`

It automatically recognizes sub-paths like these.

## ComponentScan Order

1. `ConfigurationClassParser` parses `@Configuration`.
(Handles even when a single class brings multiple Configurations)
(Work to proxy internal `@Bean`)

2. `ComponentScanAnnotationParser` parses `@Component`.
(Scans based on basePackage, classes)

=> Determines where and how to scan through these two.

3. `ClassPathBeanDefinitionScanner` scans the actual scan location (using `ClassLoader`) and creates `BeanDefinition`.

4. Creates beans through `BeanDefinition` and registers them in `ApplicationContext`.

> `ApplicationContext` and `BeanFactory` provide the same functionality, but `ApplicationContext` provides more functionality.
> -> Use `ApplicationContext` unless you're going for extreme memory efficiency. 👍 (Provides internationalization messages, profile environment)

### AutoConfiguration

When adding library dependencies that link with Spring Boot (`*-starter`),
It's a feature that automatically configures and creates beans.

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

Used to specify the configuration order of `AutoConfiguration`.
-> `Before` specifies that it should run before other auto classes, `After` specifies that it should run after other auto classes.

Ultimately, it is shared with the contents explained above.
For example, if you check `RedisAutoConfiguration`?

```java
@AutoConfiguration  
@ConditionalOnClass({RedisOperations.class})  
@EnableConfigurationProperties({RedisProperties.class})  
@Import({LettuceConnectionConfiguration.class, JedisConnectionConfiguration.class})  
public class RedisAutoConfiguration {
	...
}
```

If there is a class called `RedisOperations.class` (`@ConditionalOnClass({RedisOperations.class})`)?
-> It enables dependencies. (It has `@Conditional({OnClassCondition.class})`)

To add more explanation:

```java
@Bean  
@ConditionalOnMissingBean({RedisConnectionDetails.class})  
PropertiesRedisConnectionDetails redisConnectionDetails(RedisProperties properties) {  
    return new PropertiesRedisConnectionDetails(properties);  
}
```

In the case specified above,
If a bean of type `RedisConnectionDetails` is not registered?
-> The function operates and creates a `@Bean`.

`public interface RedisConnectionDetails extends ConnectionDetails `

Since it is an Interface like this, if we don't define it, it is created with default settings.

## Conclusion

`@SpringBootApplication(scanBasePackages = ["lotto", "purchase", "toss"])` makes `SpringBoot` recognize basic stereotypes.
(Configured with `package org.springframework.boot.autoconfigure; - AutoConfigurationImportSelector`)
`SpringBootApplication`'s `basePackage` and `ComponentScan` are not shared with other settings.

Therefore, `EntityScan` and `EnableJpaRepositories` need additional specification.

`package org.springframework.boot.autoconfigure.domain; - EntityScan`
`package org.springframework.data.jpa.repository.config; - EnableJpaRepositories`

Additionally, packages are specified as above.
(Why doesn't it allow sharing even if it's the same `autoconfigure`? It seems that doing so would make it more complex.)

Conclusion:

- It operates based on the main package of the application and its sub-packages.
- `EntityScan` and `EnableJpaRepositories` operate separately from `SpringBootApplication`.
- Therefore, package names must be specified separately.

That's it!

There might be some incorrect contents.
It's too complex a Spring to find perfectly...

The code is located in the [GitHub repository](https://github.com/youngsu5582/lotto).
(I haven't uploaded the written part yet..! 🥲)
