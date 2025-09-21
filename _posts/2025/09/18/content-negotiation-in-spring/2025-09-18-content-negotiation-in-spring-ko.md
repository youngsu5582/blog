---
title: Content Negotiation in Spring
tags:
  - 스프링
  - 콘텐츠 협상
  - HTTP
  - 웹 개발
description: 스프링에서 콘텐츠 협상(Content Negotiation)을 처리하는 방법과 관련된 메커니즘을 설명합니다.
page_id: content-negotiation-in-spring
permalink: /posts/content-negotiation-in-spring/
author: 이영수
date: 2025-09-18T15:08:55.877Z
image:
  path: assets/img/thumbnail/2025-09-18-content-negotiation-in-spring.png
lang: ko
---

## Content Negotiation

동일한 URI 에서 리소스의 서로 다른 버전을 제공하기 위해 사용하는 메커니즘

- 클라이언트가 보내는 특정 HTTP 헤더를 이용해, 서버 주도 협상으로 이루어짐
- 서버에 의해 전달되는 상태 코드 `300(다중 선택)` 및 `406` 등을 사용하여 폴백 형식으로 이루어짐

## 서버 주도 협상

브라우저는 URL 과 몇 개의 HTTP 헤더를 전송한다.
서버는 그 헤더를 기반으로 클라이언트에게 제공할 최선의 컨텐츠를 선택한다.

![500](https://i.imgur.com/slhSyRl.png)

서버는 어떤 헤더가 사용되는지를 가르키기 위해 `Vary`  를 사용한다. - 캐시를 최적으로 동작하게 해줌
( 특정 헤더가 달라졌거나, 없어졌으면 캐시 적용하지 않고 다른 요소로 처리 )

가장 일반적인 방식이나, 몇 가지 결점 역시 존재한다.

- 서버가 브라우저에 대한 전체적인 지식을 가지고 있지 않다. - 수용 능력을 모름
- 주어진 리소스에 몇몇의 프레젠테이션이 전송되므로, 캐시가 덜 효율적이고 서버 구현도 복잡해질 수 있다.

### Accept

에이전트가 처리하고자 하는 미디어 리소스의 MIME 타입
컨텍스트에 따라 다양할 수 있다. ( 주소창에 입력된 문서를 받는다거나, 이미지 & 비디오 등을 다운 받는다거나 )

> 일반적인, 웹 브라우저는 
> `text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7`
> 이런 식으로 보낸다.
> html -> xml -> webp,avif -> `*.*`

### User-Agent

요청을 전송하는 브라우저를 식별하게 해준다.

- PostmanRuntime/7.45.0 : 포스트맨임을 명시 + 버전
- Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/140.0.0.0 Safari/537.36 : 어떤 브라우저 + 버전 ( 추가로, 기기 OS 정보도 전달 )

> 이 User-Agent 를 담지 않으면, 요청을 거부하는 서비스들도 있다.
> EX) GITHUB API, pexels

---

그러면, 스프링에선? 매우 간편하게 협상을 처리할 수 있다.

개발자가 직접 코드를 작성하지 않아도
ContentNegotiationManager 가 여러 HttpMessageConverter 들과 동작해서 처리해준다.

![](https://i.imgur.com/3Avw8uH.png)

Strategy 들을 의존성 주입 받아서 추가하고, resolver 라면 추가해준다.

![](https://i.imgur.com/WjKjfO2.png)

- PathExtensionContentNegotiationStrategy: 경로 끝에 확장자를 확인하는 전략 - 비활성화, REST API 위반 및 보안 문제 야기
- ParameterContentNegotiationStrategy: URL 의 쿼리 파라미터 확인 ( `?format=xml` ) - 비활성화

`HeaderContentNegotiationStrategy` 가 우리가 위에서 본 `Accept` 기반 전략이다.

```java
@Override  
public List<MediaType> resolveMediaTypes(NativeWebRequest request)  
       throws HttpMediaTypeNotAcceptableException {
       ...
}
```

ContentNegotiationStrategy 가 요청을 기반으로 받을 수 있는 미디어 타입을 반환하면

![](https://i.imgur.com/5IHHbVw.png)

RequestResponseBodyMethodProcessor 가
미디어 타입을 기반으로 변환을 처리해서 반환해준다.

```java
/**  
 * Writes the given return type to the given output message. * @param value the value to write to the output message  
 * @param returnType the type of the value  
 * @param inputMessage the input messages. Used to inspect the {@code Accept} header.  
 * @param outputMessage the output message to write to  
 * @throws IOException thrown in case of I/O errors  
 * @throws HttpMediaTypeNotAcceptableException thrown when the conditions indicated  
 * by the {@code Accept} header on the request cannot be met by the message converters  
 * @throws HttpMessageNotWritableException thrown if a given message cannot  
 * be written by a converter, or if the content-type chosen by the server * has no compatible converter. */@SuppressWarnings({"rawtypes", "unchecked", "NullAway"})  
protected <T> void writeWithMessageConverters(@Nullable T value, MethodParameter returnType,  
       ServletServerHttpRequest inputMessage, ServletServerHttpResponse outputMessage)  
       throws IOException, HttpMediaTypeNotAcceptableException, HttpMessageNotWritableException {
       
       
		...
		if (selectedMediaType != null) {  
		    selectedMediaType = selectedMediaType.removeQualityValue();  
		  
		    ResolvableType targetResolvableType = null;  
		    for (HttpMessageConverter converter : this.messageConverters) {
			    ...
			    
		switch (converterTypeToUse) {  
		    case BASE -> converter.write(body, selectedMediaType, outputMessage);  
		    case GENERIC -> ((GenericHttpMessageConverter) converter).write(body, targetType, selectedMediaType, outputMessage);  
		    case SMART -> ((SmartHttpMessageConverter) converter).write(body, targetResolvableType, selectedMediaType, outputMessage, null);  
		}
```

MediaType 을 기반으로, converter 가 선택되어 본문을 작성함으로써 똑똑하게 Content Negotiation 이 처리된다.

그런데, 이러면 너무 자동으로만 이루어지는 것 같지 않은가?

스프링이 제공해주는 `WebMvcConfigurer` 에서 협상을 설정할 수 있다.

```java
@Override  
public void configureContentNegotiation(ContentNegotiationConfigurer configurer) {  
    // Accept Header 전략 사용 ( 기본값 true )
    configurer.ignoreAcceptHeader(false)  
        .defaultContentType(MediaType.APPLICATION_JSON);
}
```

default 를 통해, 협상을 못 찾으면 기본 MediaType 도 지정 가능하다.

---

### XmlMapper 를 설치했더니, 기본이 XML 로 반환

> 사실, 이 내용 때문에 학습을 했다 ㅋ.ㅋ

```kotlin
implementation 'com.fasterxml.jackson.dataformat:jackson-dataformat-xml'
```

이번 이슈를 진행하며, xml 을 파싱해야 하는 요구사항이 있어 의존성을 추가했다.

![](https://i.imgur.com/lcgwFjC.png)

기존과 같이 JSON 으로 나와야 하는 API 가

![](https://i.imgur.com/shKrUka.png)

XML 로 나오는걸 볼 수 있다.

```java
@Autowired  
List<HttpMessageConverter> messageConverters;  
  
@PostConstruct  
public void init() {  
    log.info("Application started : {}", messageConverters);  
}
```

아무곳에서나 이렇게 HttpMessageConverter 를 찍어보면

```java
[org.springframework.http.converter.StringHttpMessageConverter@13d26ed3, org.springframework.http.converter.xml.MappingJackson2XmlHttpMessageConverter@39f1bf06, org.springframework.http.converter.json.MappingJackson2HttpMessageConverter@2cea567b]
```

와 같이 XmlHttpMessageConverter 가 추가된 걸 볼 수 있다.

```java
@Override  
public void extendMessageConverters(List<HttpMessageConverter<?>> converters) {  
    converters.removeIf(converter -> converter instanceof MappingJackson2XmlHttpMessageConverter);  
}
```

instanceof 로 XmlConverter 를 찾아서 제거하자.

그러면, 기존처럼 JSON 을 반환하는걸 볼 수 있다!
