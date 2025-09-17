---
title: "Intercepting Queries While Using JPA, Inspecting Queries Occurring in All Controller Methods"
author: 이영수
date: 2024-08-18T08:48:52.600Z
tags: ['Hibernate', 'requestScope', 'Wooteco', 'Query Inspector']
categories: ['Backend', 'Spring']
description: "This is an additional post to the previous one, 'How Far Can Java Reflection Go?'. As it's very simple content, I'll show you how I implemented query interception + the final report I created and wrap it up. In fact, let's efficiently count the number of queries going out in a single request."
image:
  path: https://velog.velcdn.com/images/dragonsu/post/a217ea86-66a1-41cb-8fac-4ae011cf7a12/image.jpeg
lang: en
permalink: /posts/jpa-query-interception-inspecting-queries-in-all-controller-methods/
---
This is an additional post to the previous one, [How Far Can Java Reflection Go?](https://velog.io/@dragonsu/%EC%9E%90%EB%B0%94-%EB%A6%AC%ED%94%8C%EB%A0%89%EC%85%98-%EC%96%B4%EB%94%94-%EA%B9%8C%EC%A7%80-%EA%B0%80%EB%8A%A5%ED%95%A0%EA%B9%8C-%EB%B6%80%EC%A0%95-%EC%98%AC%EB%A6%AC%EA%B8%B0-%EC%A0%84-%EB%82%B4-%EB%AA%A8%EB%93%A0-%EB%A9%94%EC%86%8C%EB%93%9C%EA%B0%80-%EB%A0%8C%EB%8D%94%EB%A0%91-%ED%95%98%EB%8A%94%EC%A7%80-%EA%B2%80%EC%82%AC).

As it's very simple content, I'll show you how I implemented query interception + the final report I created and wrap it up.

In fact, it's all based on this person's post: [Let's efficiently count the number of queries going out in a single request (Hibernate StatementInspector, Spring AOP)](https://dgjinsu.tistory.com/62).

## Query Interception

### QueryInfo

```java
public interface QueryInfo {

    void increaseQueryCount(String query);

    String toFormatString();

    boolean isExceedQuery();

    int getCount();

    void clear();
}
```

First, I created an interface called `QueryInfo` that is responsible for holding the query information and values.

> Why an interface?
> I separated it because I plan to use this QueryInfo for the query execution result report in the previous post.
> In other words, I created it because I want to use it in test or `Inspect` situations.

```java
import corea.global.aspect.query.QueryInfo;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;
import org.springframework.web.context.annotation.RequestScope;

import java.util.HashMap;
import java.util.Map;

@Component
@RequiredArgsConstructor
@Profile({"dev", "local"})
@RequestScope
@Getter
public class DevQueryInfo implements QueryInfo {

    private static final int MIN_WARN_SIZE = 10;
    private Map<String, Integer> data = new HashMap<>();

    public void increaseQueryCount(String query) {
        data.merge(query, 1, Integer::sum);
    }

    public String toFormatString() {
        StringBuilder sb = new StringBuilder();
        data.forEach((key, value) ->
                sb.append(key)
                        .append(" : ")
                        .append(value)
                        .append(System.lineSeparator())
                        .append(System.lineSeparator())
        );
        return sb.toString();
    }

    @Override
    public boolean isExceedQuery() {
        return data.values()
                .stream()
                .reduce(0, Integer::sum) >= MIN_WARN_SIZE;
    }

    @Override
    public void clear() {
        data.clear();
    }

    @Override
    public int getCount() {
        return sum();
    }

    private int sum() {
        return data.values()
                .stream()
                .mapToInt(Integer::intValue)
                .sum();
    }
}
```

```java
@Component
@RequiredArgsConstructor
@Profile("inspect")
@Getter
public class InspectQueryInfo implements QueryInfo {
	...
}
```

In this way, I implemented it myself and only changed the Profile and RequestScope.
If you specify the scope as a singleton in a real request, problems will occur because multiple requests will invade a single component.
-> For this, I used `RequestScope`, which creates a new component for each request.

However, it doesn't matter when inspecting because it occurs in a single request.

### QueryInspector

```java
package corea.global.aspect.query;

import org.hibernate.resource.jdbc.spi.StatementInspector;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestContextHolder;

import java.util.Arrays;
import java.util.Objects;

@Component
public class QueryInspector implements StatementInspector {

    private final QueryInfo queryInfo;
    private final boolean flag;

    public QueryInspector(final QueryInfo apiQueryCounter, final Environment environment) {
        this.queryInfo = apiQueryCounter;
        this.flag = Arrays.stream(environment.getActiveProfiles())
                .anyMatch(profile -> profile.equals("inspect"));
    }

    @Override
    public String inspect(final String sql) {
        if (isInRequestScope() || flag) {
            queryInfo.increaseQueryCount(sql);
        }
        return sql;
    }

    private boolean isInRequestScope() {
        return Objects.nonNull(RequestContextHolder.getRequestAttributes());
    }
}
```

What is `StatementInspector`?
-> It is an interface that allows you to inspect and manipulate SQL statements before Hibernate generates a query and sends it to the DB.

> Inspector : to inspect

In other words, it receives the query here and puts the value into QueryInfo for logging.

At this time, the execution branch is

- When the profile is `inspect` ( setting for inspection )
- When RequestAttributes exists ( when a real request occurs - at this time, if you run it in a test, an error will occur even if you set `SpringBootTest to RANDOM or DEFINED`. )

I specified it as.
### QueryLoggingAspect

```java
package corea.global.aspect.query;

import lombok.RequiredArgsConstructor;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.annotation.Pointcut;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

@Aspect
@RequiredArgsConstructor
@Component
@Profile("!prod")
public class QueryLoggingAspect {

    private static final Logger log = LogManager.getLogger(QueryLoggingAspect.class);
    private final QueryInfo queryInfo;

    @Pointcut("execution(* corea..*Controller.*(..))")
    public void controllerMethods() {}

    @Around("controllerMethods()")
    public Object logSqlStatements(ProceedingJoinPoint joinPoint) throws Throwable {
        queryInfo.clear();
        Object result = joinPoint.proceed();

        String className = joinPoint.getSignature()
                .getDeclaringTypeName();
        String methodName = joinPoint.getSignature()
                .getName();
        String logs = queryInfo.toFormatString();

        if (queryInfo.isExceedQuery()) {
            log.warn("{}.{} exceeded query limit(count:{}): \n{}", className, methodName, queryInfo.getCount(), logs);
        } else {
            log.debug("{}.{} executed with queries: \n{}", className, methodName, logs);
        }
        return result;
    }
}
```

I used AOP in this part.
It's easier to use than Interceptor or Filter, and since it's for logging and doesn't operate on the production server, I decided to accept it without any burden.
If the threshold is exceeded, it logs as `WARN`, otherwise it logs as `DEBUG`.

```java
package corea.global.config;

import corea.global.aspect.query.QueryInspector;
import lombok.RequiredArgsConstructor;
import org.hibernate.cfg.AvailableSettings;
import org.springframework.boot.autoconfigure.orm.jpa.HibernatePropertiesCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
@RequiredArgsConstructor
public class HibernateConfig {

    private final QueryInspector queryInspector;

    @Bean
    public HibernatePropertiesCustomizer hibernatePropertyConfig() {
        return hibernateProperties ->
                hibernateProperties.put(AvailableSettings.STATEMENT_INSPECTOR, queryInspector);
    }
}
```

Then, just put it in hibernateProperties and you're done.
At this time, you might be wondering how the type is inferred and how it's put in there, but it's very simple.

```java
@FunctionalInterface
public interface HibernatePropertiesCustomizer {
    void customize(Map<String, Object> hibernateProperties);
}
```

This is because it provides a property customizer as a functional interface. 
Just put it in the StatementInspector setting and you're done!

> What if there are multiple Inspectors? 
> Let's put multiple StatementInspectors inside QueryInspector and include the QueryInspector that contains those multiple ones.

It's very simple.

```yml
<springProfile name="inspect">
    <include resource="logs/file-inspect-appender.xml"/>

    <logger name="corea.global.aspect" level="DEBUG" additivity="false">
        <appender-ref ref="FILE-INSPECT"/>
    </logger>

    <logger name="org.springframework" level="WARN"/>
</springProfile>
```

```java
<included>
    <appender class="ch.qos.logback.core.FileAppender" name="FILE-INSPECT">
        <encoder>
            <pattern>${INSPECT_PATTERN}</pattern>
        </encoder>
        <file>inspect.log</file>
        <append>false</append>
    </appender>
</included>
```

At this time, the logging level is separate from hibernate. Be careful!

---
## Query Inspection Result

I'm explaining this because it's become possible to share the query inspection to some extent.
It's the same as the previous `ControllerExecutor`, so I'll omit the previous explanation.

```java
String[] allBeanNames = applicationContext.getBeanDefinitionNames();

for (String beanName : allBeanNames) {
    Object bean = applicationContext.getBean(beanName);
    Class<?> beanClass = AopProxyUtils.ultimateTargetClass(bean);

    if (beanClass.isAnnotationPresent(RestController.class) || beanClass.isAnnotationPresent(Controller.class)) {
        controllerExecutor.executeAllMethod(bean);
    }
}
```

In this way, if you get all the controllers and execute them?

![500](https://i.imgur.com/eHvcQmf.png)

The value is saved in the log.

Then, the value is extracted from the log and converted to an html file.
The conversion code was created in Python with the help of GPT.
[Code Link-gist](https://gist.github.com/youngsu5582/2408497586800cd28ba0e5dfa3920a97)

Too much code, so I'll replace it with a GIST.. 🥲

![450](https://i.imgur.com/fU5NLOD.png)

Bring the results
- How many of each DML occurred
- How many occurred in total
- The ratio of methods that exceeded the threshold

![](https://i.imgur.com/segSzBF.png)

When you click on the method name
- What value it was executed with
- What query occurred
- Whether an error occurred

![](https://i.imgur.com/Tkqa0B4.png)

For methods that do not match the specification
- What value it was with
- What error occurred

It reveals. ( I don't know why it's `405 Not Allowed`... )

Of course, I didn't pay much attention to the design, and
as I said in the previous post, if the context is perfect and the documentation is perfect, I think it will show great efficiency.
However, this is of course a part that needs to be discussed and talked about with the team members. 🙂🙂

If it is introduced, I will add the related issue+PR, link.

```
