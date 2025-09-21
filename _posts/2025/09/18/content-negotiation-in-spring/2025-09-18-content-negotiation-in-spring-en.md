---
title: Content Negotiation in Spring
tags:
  - Spring
  - Content Negotiation
  - HTTP
  - Web Development
description: >-
  This post explains the mechanisms related to handling content negotiation in
  Spring.
page_id: content-negotiation-in-spring
permalink: /posts/content-negotiation-in-spring/
author: Lee Youngsu
date: 2025-09-18T15:08:55.877Z
image:
  path: assets/img/thumbnail/2025-09-18-content-negotiation-in-spring.png
lang: en
---

## Content Negotiation

A mechanism used to provide different versions of a resource from the same URI.

- Achieved through server-driven negotiation using specific HTTP headers sent by the client.
- Uses status codes like `300 (Multiple Choices)` and `406` for fallback formats.

## Server-driven Negotiation

The browser sends a URL and several HTTP headers.
The server selects the best content to present to the client based on these headers.

![500](https://i.imgur.com/slhSyRl.png)

The server uses `Vary` to indicate which headers are used - allowing optimal caching.
(If a particular header changes or is absent, it treats the request differently rather than applying a cache.)

While the most common approach, it has a few drawbacks:

- The server doesn't have complete knowledge about the browser - unknown capabilities.
- Because several presentations of the given resource are transmitted, the cache may be less efficient and the server implementation can become complex.

### Accept

The MIME type of media resources the agent wishes to process.
It can vary depending on the context (receiving a document entered in the address bar, downloading images & videos, etc.).

> Typically, web browsers send something like 
> `text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7`.
> html -> xml -> webp,avif -> `*.*`

### User-Agent

Identifies the browser sending the request.

- PostmanRuntime/7.45.0: Indicates it is Postman along with the version.
- Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/140.0.0.0 Safari/537.36: Indicates the browser and version (also provides device OS information).

> Some services reject requests if this User-Agent is not included.
> EX) GITHUB API, Pexels

---

Then, what about in Spring? It can be handled very conveniently.

Even without developers writing code directly,
ContentNegotiationManager operates with various HttpMessageConverters to handle it.

![](https://i.imgur.com/3Avw8uH.png)

Dependency injects Strategies and adds them, or adds them if they are resolvers.

![](https://i.imgur.com/WjKjfO2.png)

- PathExtensionContentNegotiationStrategy: Strategy that checks the extension at the end of the path - deactivated, violates REST API and causes security issues.
- ParameterContentNegotiationStrategy: Checks query parameters in the URL ( `?format=xml` ) - deactivated.

`HeaderContentNegotiationStrategy` is the strategy based on `Accept` headers we saw above.

```java
@Override  
public List<MediaType> resolveMediaTypes(NativeWebRequest request)  
       throws HttpMediaTypeNotAcceptableException {
       ...
}
```

When ContentNegotiationStrategy returns media types it can receive based on the request,

![](https://i.imgur.com/5IHHbVw.png)

RequestResponseBodyMethodProcessor
processes conversion based on the media type and returns it.

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

Selecting a converter based on the MediaType, it intelligently handles Content Negotiation by constructing the body.

But doesn't this seem a bit too automatic?

You can configure negotiations from the `WebMvcConfigurer` provided by Spring.

```java
@Override  
public void configureContentNegotiation(ContentNegotiationConfigurer configurer) {  
    // Use Accept Header strategy (default true)
    configurer.ignoreAcceptHeader(false)  
        .defaultContentType(MediaType.APPLICATION_JSON);
}
```

You can specify the default MediaType if no negotiation is found through default.

---

### After Installing XmlMapper, Default returns as XML

> Actually, I studied this because of this content. Haha.

```kotlin
implementation 'com.fasterxml.jackson.dataformat:jackson-dataformat-xml'
```

While handling this issue, there was a requirement to parse xml, so I added the dependency.

![](https://i.imgur.com/lcgwFjC.png)

The API, which was supposed to output as JSON,

![](https://i.imgur.com/shKrUka.png)

was outputting as XML.

```java
@Autowired  
List<HttpMessageConverter> messageConverters;  
  
@PostConstruct  
public void init() {  
    log.info("Application started : {}", messageConverters);  
}
```

You can print out the HttpMessageConverter anywhere like this,

```java
[org.springframework.http.converter.StringHttpMessageConverter@13d26ed3, org.springframework.http.converter.xml.MappingJackson2XmlHttpMessageConverter@39f1bf06, org.springframework.http.converter.json.MappingJackson2HttpMessageConverter@2cea567b]
```

and you can see that XmlHttpMessageConverter is added.

```java
@Override  
public void extendMessageConverters(List<HttpMessageConverter<?>> converters) {  
    converters.removeIf(converter -> converter instanceof MappingJackson2XmlHttpMessageConverter);  
}
```

Identify XmlConverter by using instanceof and remove it.

Then, you can see it returns JSON again as before!
