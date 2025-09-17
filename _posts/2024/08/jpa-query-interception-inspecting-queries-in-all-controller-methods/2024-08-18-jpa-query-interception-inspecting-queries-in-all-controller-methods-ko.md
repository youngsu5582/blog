---
title: "JPA 사용 중 쿼리 가로채기, 모든 컨트롤러 메소드 중 발생하는 쿼리 검사"
author: 이영수
date: 2024-08-18T08:48:52.600Z
tags: ['Hibernate', 'requestScope', '우테코', '쿼리 검사기']
categories: ['백엔드', '스프링']
description: 이 글은 그 전 글인 자바 리플렉션 어디 까지 가능할까에 대한 추가적인 내용이다.매우 간단한 내용이므로, 쿼리 가로채기를 어떻게 구현했는지 + 최종적으로 내가 만든 결과서에 대해서 보여주고 마무리 할 예정이다.사실상, 하나의 요청에 나가는 쿼리 개수를 효율적으로 세어보
image:
  path: https://velog.velcdn.com/images/dragonsu/post/a217ea86-66a1-41cb-8fac-4ae011cf7a12/image.jpeg
lang: ko
permalink: /posts/jpa-query-interception-inspecting-queries-in-all-controller-methods/
---
이 글은 그 전 글인 [자바 리플렉션 어디 까지 가능할까](https://velog.io/@dragonsu/%EC%9E%90%EB%B0%94-%EB%A6%AC%ED%94%8C%EB%A0%89%EC%85%98-%EC%96%B4%EB%94%94-%EA%B9%8C%EC%A7%80-%EA%B0%80%EB%8A%A5%ED%95%A0%EA%B9%8C-%EB%B6%80%EC%A0%9C-PR-%EC%98%AC%EB%A6%AC%EA%B8%B0-%EC%A0%84-%EB%82%B4-%EB%AA%A8%EB%93%A0-%EB%A9%94%EC%86%8C%EB%93%9C%EA%B0%80-%EB%A0%8C%EB%8D%94%EB%A7%81-%ED%95%98%EB%8A%94%EC%A7%80-%EA%B2%80%EC%82%AC)에 대한 추가적인 내용이다.

매우 간단한 내용이므로, 쿼리 가로채기를 어떻게 구현했는지 + 최종적으로 내가 만든 결과서에 대해서 보여주고 마무리 할 예정이다.

사실상, [하나의 요청에 나가는 쿼리 개수를 효율적으로 세어보자 (Hibernate StatementInspector, Spring AOP)](https://dgjinsu.tistory.com/62)
이분의 글을 참고해 만든게 다이다.

## 쿼리 가로채기

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

우선, 쿼리의 정보를 가지고 값들을 담당하는 `QueryInfo` 라는 인터페이스를 만들었다.

> 왜 인터페이스인가요?
> 나는, 이 QueryInfo 를 앞 게시글인 쿼리 실행 결과 보고서를 위해서도 사용할 예정이라 분리를 했다.
> 즉, 테스트나 검사(`Inspect`) 상황에서도 쓰고 싶어서 만든것

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

이렇게, 알아서 구현하고 Profile 과 RequestScope 만 다르게 했다.
실제 요청에서 싱글톤으로 스코프를 지정할 시, 여러 요청들이 하나의 컴포넌트를 침범해서 문제가 발생한다.
-> 이를 위해서 각 요청마다 새로운 컴포넌트를 만들어주는 `RequestScope` 를 사용했다.

하지만, 검사할 때는 단일 요청에서 발생하므로 상관이 없다.

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

`StatementInspector` 가 뭐지?
-> Hibernate 가 쿼리를 생성하고, DB에 보내기 전 SQL 문을 검사하고 조작하게 해주는 인터페이스이다.

> Inspector : 검사하다

즉, 여기서 쿼리를 받아서 로깅을 위해 QueryInfo 에 값을 넣는다.

이때, 실행하는 분기를

- 프로파일이 `inspect` ( 검사 때를 위한 설정 )
- RequestAttributes 가 있을 때 ( 실제 요청이 발생할 때 - 이때, 테스트에서 동작 시킨다면 `SpringBootTest 를 RANDOM or DEFINED` 로 해도 똑같이 에러가 발생한다. )

로 지정했다.
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
            log.warn("{}.{} exceeded query limit(count:{{}}): \n{{}}", className, methodName, queryInfo.getCount(), logs);
        } else {
            log.debug("{}.{} executed with queries: \n{{}}", className, methodName, logs);
        }
        return result;
    }
}
```

해당 부분에서 나는 AOP를 사용했다.
Interceptor 나 Filter 보다 더 사용하기 용이해서인데, 어차피 운영 서버내 동작 X + 로깅용 이기에 부담없이 수용하기로 결정했다.
만약, 임계치를 넘었다면 `WARN` 으로, 아니라면 `DEBUG` 로 로깅한다.

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

그후, hibernateProperties 에 넣기만 하면 끝이다.
이때, 어떻게 타입이 추론되고, 저 안에 넣는거지? 라고 생각할 수 있는데 매우 간단하다.

```java
@FunctionalInterface
public interface HibernatePropertiesCustomizer {
    void customize(Map<String, Object> hibernateProperties);
}
```

프로퍼티 커스터마이저를 함수형 인터페이스로 제공하기 때문이다. 
StatementInspector 설정에 넣으면 끝!

> 여러개의 Inspector 라면?
> QueryInspector 내부에 여러개의 StatementInspector 를 담아서 그 여러개를 포함하는 QueryInspector 를 포함시키자.

매우 간단하다.

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

이떄, 로깅 레벨은 hibernate 와 따로 논다. 주의하자!

---
## 쿼리 검사 결과기

어느정도, 유의미하게 쿼리 검사에 대해서 그리고, 공유가 가능해져서 설명한다.
기존 `ControllerExecutor` 와 동일하므로, 그 전의 설명은 생략한다.

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

이렇게, 모든 컨트롤러를 가져와서 실행하면?

![500](https://i.imgur.com/eHvcQmf.png)

로그에 값을 저장시킨다.

그 후, 로그에서 값을 추출해서 html 파일로 변환한다.
변환 코드는 GPT 의 도움을 받아 파이선으로 만들었다.
[코드 링크-gist](https://gist.github.com/youngsu5582/2408497586800cd28ba0e5dfa3920a97)

너무 코드 라인이 길어서 GIST 로 대체한다.. 🥲

![450](https://i.imgur.com/fU5NLOD.png)

결과들을 가져와서
- 각 DML 들이 몇개 발생했는지
- 총 몇개 발생했는지
- 임계치를 넘은 메소드 비율

![](https://i.imgur.com/segSzBF.png)

메소드 명을 클릭 시
- 어떤 값과 함께 실행이 되었는지
- 어떤 쿼리가 발생했는지
- 에러가 발생했는지

![](https://i.imgur.com/Tkqa0B4.png)

명세와 일치하지 않은 메소드는
- 어떤 값과 함께 했는지
- 어떤 에러가 발생 했는지

를 드러낸다. ( `405 Not Allowed` 는 왜 저러는지 모르겠다... )

디자인은 당연히, 크게 신경 안쓰고
전 글에서도 말했듯 완벽한 컨텍스트, 완벽한 문서화라면 큰 효율을 보일 것이라고 생각한다.
하지만, 이건 당연히 팀원들과 협의와 얘기를 한 후 해나가야 할 부분이다. 🙂🙂

도입이 된다면, 관련 이슈+PR, 링크를 추가하겠다.

```