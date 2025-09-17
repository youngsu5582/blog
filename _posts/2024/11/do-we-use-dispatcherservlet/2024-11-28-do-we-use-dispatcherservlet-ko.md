---
title: "DispatcherServlet 을 우리가 사용하나요?"
author: 이영수
date: 2024-11-28T16:30:25.636Z
tags: ['DispatcherServlet', '삽질', '우테코', '스프링']
categories: ['백엔드', '스프링']
description: DispatcherServlet Depth 가 어디까지 깊어질까. 재귀의 재귀의 재귀
image:
  path: https://velog.velcdn.com/images/dragonsu/post/997a2190-cbf4-4773-a723-5fd526bd9e27/image.png
lang: ko
permalink: /posts/do-we-use-dispatcherservlet
---
> 주의⚠️ 해당 내용은 정말 템포가 깁니다. 틀릴수도 있습니다.
이번에 KCD 면접을 보며 스프링의 웹 흐름을 말해달라는 질문에 명확하게 대답하지 못해서 스스로 코드를 파보며 작성한 내용입니다.
혹시, 잘못된 내용이 있다면 댓글로 또는 `joyson5582@gmail.com`로 남겨주세요!


## DispatcherServlet

`DispatcherServlet` 이란 뭘까요? 들어본적은 있지만 실제 코드에서는 한번도 본적이 없을수도 있을겁니다.
( 물론, 우테코 미션 [java-mvc](https://github.com/woowacourse/java-mvc) 에서 이를 비슷하게 구현하는 내용이 있습니다.🥲 )

그러면 이에 대해 정의 및 잘 설명이 되어 있는 블로그가 있어서 먼저 남깁니다. 
( 저는 코드를 직접 탐색하는 부분을 해나갈 예정 )

> HTTP 프로토콜로 들어오는 모든 요청을 가장 먼저 받아 적합한 컨트롤러에 위임해주는 프론트 컨트롤러(Front Controller) 라고 한다.
   [출처 : 망나니개발자님 블로그](https://mangkyu.tistory.com/18)

스프링에서 우리가 흔히 사용한 `RequestMapping` , `ServletRequest`  , `@RequestBody` 어노테이션들이 모두 이 `DispatcherServlet` 에 의해서 관리되어 요청을 실행합니다.

어떤 코드들을 거치는지 살펴보겠습니다.

[공식 문서 - DispatcherServlet](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/web/servlet/DispatcherServlet.html)

## doDispatch

요청을 받아서 핸들러를 찾고, 핸들러 메소드를 실행해서 응답을 반환해줍니다. - [공식 문서](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/web/servlet/DispatcherServlet.html#doDispatch(jakarta.servlet.http.HttpServletRequest,jakarta.servlet.http.HttpServletResponse))
그렇기에 매개변수로 Request 와 Response 를 가집니다.

>우선, Tomcat 부분은 제외하고 `HttpServletRequest` , `HttpServletResponse` 가 들어온 부분부터 다룹니다.

> Multipart, AsyncManager,CORS,Cache 와 같은 부가적인 요소는 전부 빼고 단순 요청에 대해서 설명합니다.

```java
protected void doDispatch(HttpServletRequest request, HttpServletResponse response) throws Exception {
	HttpServletRequest processedRequest = request;  
	HandlerExecutionChain mappedHandler = null;  
	boolean multipartRequestParsed = false;  
	  
	try {  
	    try {  
	       mappedHandler = getHandler(processedRequest);  
	       ...
	    }
	}
}
```

이와 같이 값들을 할당 후 요청에 대한 핸들러를 가져옵니다.

## DispatcherServlet - getHandler

```java
@Nullable  
protected HandlerExecutionChain getHandler(HttpServletRequest request) throws Exception {  
    if (this.handlerMappings != null) {  
       for (HandlerMapping mapping : this.handlerMappings) {  
          HandlerExecutionChain handler = mapping.getHandler(request);  
          if (handler != null) {  
             return handler;  
          }  
       }  
    }  
    return null;  
}
```

DispatcherServlet 이 가지고 있는 `HandlerMapping` List 중에서 request 를 처리할 수 있는 핸들러를 가져옵니다.

```java
public interface HandlerMapping {
    @Nullable  
    HandlerExecutionChain getHandler(HttpServletRequest request) throws Exception;  
}
```

### AbstractHandlerMapping - getHandler
인터페이스에 대한 정말 다양한 구현체들이 있지만 `AbstractHandlerMapping` 를 통해 설명하겠습니다. - [공식 문서](https://docs.spring.io/spring-framework/docs/3.1.3.RELEASE_to_3.2.0.RC2/Spring%20Framework%203.1.3.RELEASE/org/springframework/web/servlet/handler/AbstractHandlerMapping.html)
( 대부분의 구현체가 이 `AbstractHandlerMapping` 를 상속하기 때문 )

> 스프링은 이와 같이 interface - abstract 형식을 매우 많이 사용했다.
> ( 구현을 해야 하는 메소드가 뭔지 정의 후 이를 공통적으로 로직 재사용이 가능하게 하기 위해서 )

```java
@Override  
@Nullable  
public final HandlerExecutionChain getHandler(HttpServletRequest request) throws Exception {  
    Object handler = getHandlerInternal(request);  
    ...
}

@Nullable  
protected abstract Object getHandlerInternal(HttpServletRequest request) throws Exception;
```

이와 같이 `getHandlerInternal` 이라는 메소드를 사용하고 또 추상화가 되어 있습니다.

### AbstractHandlerMethodMapping - getHandlerInternal

현재 가장 일반적으로 사용하는 `@RequestMapping` 을 매핑 시켜주는 추상 구현체 `AbstractHandlerMethodMapping` 를 통해 설명하겠습니다. - [공식 문서](https://docs.spring.io/spring-framework/docs/3.1.3.RELEASE_to_3.2.0.RC2/Spring%20Framework%203.1.3.RELEASE/org/springframework/web/servlet/handler/AbstractHandlerMethodMapping.html)

```java
@Override  
protected HandlerMethod getHandlerInternal(HttpServletRequest request) throws Exception {  
    String lookupPath = initLookupPath(request);  
    this.mappingRegistry.acquireReadLock();  
    try {  
       HandlerMethod handlerMethod = lookupHandlerMethod(lookupPath, request);  
       return (handlerMethod != null ? handlerMethod.createWithResolvedBean() : null);  
    }  
    finally {  
       this.mappingRegistry.releaseReadLock();  
    }  
}

@Nullable  
protected HandlerMethod lookupHandlerMethod(String lookupPath, HttpServletRequest request) throws Exception {


	List<Match> matches = new ArrayList<>();  
	List<T> directPathMatches = this.mappingRegistry.getMappingsByDirectPath(lookupPath);
	
	if (directPathMatches != null) {  
	    addMatchingMappings(directPathMatches, matches, request);  
	}

	if (!matches.isEmpty()) {
	
		Comparator<Match> comparator = new MatchComparator(getMappingComparator(request));  
		matches.sort(comparator);  
		bestMatch = matches.get(0);
		
		handleMatch(bestMatch.mapping, lookupPath, request);  
		return bestMatch.getHandlerMethod();
	}
}

private void addMatchingMappings(Collection<T> mappings, List<Match> matches, HttpServletRequest request) {  
    for (T mapping : mappings) {  
       T match = getMatchingMapping(mapping, request);  
       if (match != null) {  
          matches.add(new Match(match, this.mappingRegistry.getRegistrations().get(mapping)));  
       }  
    }

```

경로를 계속 파싱하며 일치한 정보들이 있는지 확인 + 수행하는 핸들러가 있는지 찾습니다. - `lookupHandlerMethod`
그후, HandlerMethod 라는걸 찾아서 `createWithResolvedBean()` 라는 메소드를 통해 돌려줍니다.
#### HandlerMethod

`AnnotationMethod` 를 상속하고 있는 클래스 입니다. - [HandlerMethod](https://docs.spring.io/spring-framework/docs/3.1.3.RELEASE_to_3.2.0.RC2/Spring%20Framework%203.1.3.RELEASE/org/springframework/web/method/HandlerMethod.html) - [AnnotatedMethod](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/core/annotation/AnnotatedMethod.html)
스프링에서 다양한 어노테이션을(RequestParam,RequestBody ...) 가지는 핸들러(Controller) 메소드를 조금 더 관리하기 쉽게 만든 클래스입니다.

```java
private HandlerMethod(HandlerMethod handlerMethod, @Nullable Object handler, boolean initValidateFlags) {  
    super(handlerMethod);
    ...
}

protected AnnotatedMethod(AnnotatedMethod annotatedMethod) {  
    this.method = annotatedMethod.method;  
    this.bridgedMethod = annotatedMethod.bridgedMethod;  
    this.parameters = annotatedMethod.parameters;  
    this.inheritedParameterAnnotations = annotatedMethod.inheritedParameterAnnotations;  
}
```

- 실행할 메소드
- 메소드 파리미터
- 메소드 매개변수에 대한 어노테이션 정보 저장

```java
public HandlerMethod createWithResolvedBean() {  
    Object handler = this.bean;  
    Object var3 = this.bean;  
    if (var3 instanceof String beanName) {  
        handler = this.beanFactory.getBean(beanName);  
    }  
    return new HandlerMethod(this, handler, false);  
}
```

빈팩토리를 통해 빈 인스턴스(컨트롤러)를 초기화 한 후, HandlerMethod 를 반환합니다.
즉, 이 HandlerMethod 는 실행 가능한 객체입니다. ( 빈을 가지고 있으므로 )

#### AbstractHandlerMethodMapping - getHandlerInternal 이후

여기까지 `getHandlerInternal` 을 통해 HandlerMethod 또는 다른 무언가를 가져옵니다.
> 현재 AbstractHandlerMethodMapping 은 HandlerMethod 를 가져오나 다른 HandlerMapping 은 다른걸 가져올 수도 있습니다.

```java
public final HandlerExecutionChain getHandler(HttpServletRequest request) throws Exception {  
    Object handler = getHandlerInternal(request);  
    if (handler == null) {  
       handler = getDefaultHandler();  
    }  
    if (handler == null) {  
       return null;  
    }  
    if (handler instanceof String handlerName) {  
       handler = obtainApplicationContext().getBean(handlerName);  
    }  
    
    HandlerExecutionChain executionChain = getHandlerExecutionChain(handler, request);  
    return executionChain;
}

protected HandlerExecutionChain getHandlerExecutionChain(Object handler, HttpServletRequest request) {  
    HandlerExecutionChain chain = (handler instanceof HandlerExecutionChain handlerExecutionChain ?  
          handlerExecutionChain : new HandlerExecutionChain(handler));  
  
    for (HandlerInterceptor interceptor : this.adaptedInterceptors) {  
       if (interceptor instanceof MappedInterceptor mappedInterceptor) {  
          if (mappedInterceptor.matches(request)) {  
             chain.addInterceptor(mappedInterceptor.getInterceptor());  
          }  
       }  
       else {  
          chain.addInterceptor(interceptor);  
       }  
    }  
    return chain;  
}
```

가져온 Handler 가 없다면? 기본을, 마저 없으면 `null` 을 반환합니다.
그리고 Handler 를 포함하고 실행할 인터셉터들을 추가해서 `HandlerExecutionChain` 을 반환합니다. - [공식 문서](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/web/servlet/HandlerExecutionChain.html)

이 과정을 통해서 
- 실행 가능한 메소드
- 메소드와 함께 실행해야 하는 인터셉터
를 가진 `HandlerExceutionChain` 을 반환합니다.

## DispatcherServlet - getHandlerAdapter,handle

```java
protected void doDispatch(HttpServletRequest request, HttpServletResponse response) throws Exception {
	...
	HandlerAdapter ha = getHandlerAdapter(mappedHandler.getHandler());
	...

	if (!mappedHandler.applyPreHandle(processedRequest, response)) {  
	    return;  
	}
	
	...

	mv = ha.handle(processedRequest, response, mappedHandler.getHandler());
	
	mappedHandler.applyPostHandle(processedRequest, response, mv);
}

protected HandlerAdapter getHandlerAdapter(Object handler) throws ServletException {  
    if (this.handlerAdapters != null) {  
       for (HandlerAdapter adapter : this.handlerAdapters) {  
          if (adapter.supports(handler)) {  
             return adapter;  
          }  
       }  
    }  
    throw new ServletException("No adapter for handler [" + handler +  
          "]: The DispatcherServlet configuration needs to include a HandlerAdapter that supports this handler");  
}

public interface HandlerAdapter {
	boolean supports(Object handler);
}
```

HandlerAdapter 라는 값을 가져오고 이를 통해 handler 를 처리합니다.
그 이전에 인터셉터의 `preHandle`이 동작하고, 요청이 끝난 후 `postHandle` 이 동작합니다.

### AbstractHandlerMethodAdapter - supports

위에서 `AbstractHandlerMethodMapping` 를 통해 설명한 것과 같은 이치로 추상 클래스`AbstractHandlerMethodAdapter` 를 통해 설명합니다. - [공식 문서](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/web/servlet/mvc/method/AbstractHandlerMethodAdapter.html)
핸들러를 처리할 수 있는 어댑터를 찾은 후 가져옵니다.

```java
@Override  
public final boolean supports(Object handler) {  
    return (handler instanceof HandlerMethod handlerMethod && supportsInternal(handlerMethod));  
}

// RequestMappingHandlerAdapter
@Override
protected boolean supportsInternal(HandlerMethod handlerMethod) {
	return true;
}
```

RequestMapping 이 있으면 항상 참을 반환하게 되어있습니다. (HandlerMethod 자체가 가지고 있는게 보장되므로)

### AbstractHandlerMethodAdapter - handle

```java
@Override  
@Nullable  
public final ModelAndView handle(HttpServletRequest request, HttpServletResponse response, Object handler)  
       throws Exception {  
  
    return handleInternal(request, response, (HandlerMethod) handler);  
}
```

`AbstractHandlerMethodMapping` 과 비슷하게 `handleInternal` 라는게 있습니다.

```java
@Override  
@Nullable  
protected ModelAndView handleInternal(HttpServletRequest request,  
       HttpServletResponse response, HandlerMethod handlerMethod) throws Exception {  
  
    ModelAndView mav;  
    checkRequest(request);  
  
    // Execute invokeHandlerMethod in synchronized block if required.  
    if (this.synchronizeOnSession) {  
	    ...
    }  
    else {  
       mav = invokeHandlerMethod(request, response, handlerMethod);  
    }  
    return mav;  
}
```

요청을 체크하고, 핸들러 메소드를 실행합니다.

### AbstractHandlerMethodAdapter - InvokeHandlerMethod

그러면 어떻게 컨트롤러의 메소드를 실행할까요?

```java
@Nullable  
protected ModelAndView invokeHandlerMethod(HttpServletRequest request,  
       HttpServletResponse response, HandlerMethod handlerMethod) throws Exception {  
  
    ServletWebRequest webRequest = (asyncWebRequest instanceof ServletWebRequest ?  
          (ServletWebRequest) asyncWebRequest : new ServletWebRequest(request, response));  
  
    ServletInvocableHandlerMethod invocableMethod = createInvocableHandlerMethod(handlerMethod);  
    if (this.argumentResolvers != null) {  
       invocableMethod.setHandlerMethodArgumentResolvers(this.argumentResolvers);  
    }  
    if (this.returnValueHandlers != null) {  
       invocableMethod.setHandlerMethodReturnValueHandlers(this.returnValueHandlers);  
    }  
    invocableMethod.invokeAndHandle(webRequest, mavContainer);  
  
    return getModelAndView(mavContainer, modelFactory, webRequest);  
}

protected ServletInvocableHandlerMethod createInvocableHandlerMethod(HandlerMethod handlerMethod) {  
    return new ServletInvocableHandlerMethod(handlerMethod);  
}
```

`ServletInvocableHandlerMethod` 로 한번 더 래핑 한 후
`argumentResolvers` 와 `returnValueHandlers` 를 세팅합니다.
그리고 메소드를 호출 및 핸들링합니다.

#### ServletInvocableHandlerMethod - invokeAndHandle

핸들러 메소드 호출과 메소드 반환값 처리를 합니다. - [공식 문서](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/web/servlet/mvc/method/annotation/ServletInvocableHandlerMethod.html)

```java
// 실행 및 핸들링
public void invokeAndHandle(ServletWebRequest webRequest, ModelAndViewContainer mavContainer,  
       Object... providedArgs) throws Exception {  
  
    Object returnValue = invokeForRequest(webRequest, mavContainer, providedArgs);  
    setResponseStatus(webRequest);  

	...
    try {  
       this.returnValueHandlers.handleReturnValue(  
             returnValue, getReturnValueType(returnValue), mavContainer, webRequest);  
    }  
    catch (Exception ex) {  
	    ...
       throw ex;  
    }  
}

// 매개변수 검증 - 요청 - 응답 검증
public Object invokeForRequest(NativeWebRequest request, @Nullable ModelAndViewContainer mavContainer, Object... providedArgs) throws Exception {  
    Object[] args = this.getMethodArgumentValues(request, mavContainer, providedArgs);  
  
    if (this.shouldValidateArguments() && this.methodValidator != null) {  
        this.methodValidator.applyArgumentValidation(this.getBean(), this.getBridgedMethod(), this.getMethodParameters(), args, this.validationGroups);  
    }  
  
    Object returnValue = this.doInvoke(args);  
    if (this.shouldValidateReturnValue() && this.methodValidator != null) {  
        this.methodValidator.applyReturnValueValidation(this.getBean(), this.getBridgedMethod(), this.getReturnType(), returnValue, this.validationGroups);  
    }  
  
    return returnValue;  
}

// 메소드 매개변수에 값 주입
protected Object[] getMethodArgumentValues(NativeWebRequest request, @Nullable ModelAndViewContainer mavContainer, Object... providedArgs) throws Exception {  
    MethodParameter[] parameters = this.getMethodParameters();  
    if (ObjectUtils.isEmpty(parameters)) {  
        return EMPTY_ARGS;  
    } else {  
        Object[] args = new Object[parameters.length];  
  
        for(int i = 0; i < parameters.length; ++i) {  
            MethodParameter parameter = parameters[i];  
            if (args[i] == null) {  
                if (!this.resolvers.supportsParameter(parameter)) {  
                    throw new IllegalStateException(formatArgumentError(parameter, "No suitable resolver"));  
                }  
  
                try {  
                    args[i] = this.resolvers.resolveArgument(parameter, mavContainer, request, this.dataBinderFactory);  
                } catch (Exception var10) {  
	                    ...
                    throw ex;  
                }  
            }  
        }  
        return args;  
    }  
}
```

꽤나 길지만 주석에 적힌대로의 기능만 수행합니다.

1. 매개변수에 `resolver` 통해 값 주입
2. 매개변수 올바른지 검증
3. 실행
4. 결과가 올바른지 검증
5. 결과 처리

우리가 흔히 사용하는 CustomerArgumentResolver 도 해당 부분에서, `@RequestMapping` , `@RequestBody` 와 같은 요소들도 여기서 처리가 됩니다.
View 를 사용하지 않으면 mv 의 view 는 null 이 들어갑니다.

## DispatcherServlet - processDispatchResult

```java
protected void doDispatch(HttpServletRequest request, HttpServletResponse response) throws Exception {
	...
	processDispatchResult(processedRequest, response, mappedHandler, mv, dispatchException);
	...
}
```

그 후, 결과를 처리합니다.

```java
private void processDispatchResult(HttpServletRequest request, HttpServletResponse response,  
       @Nullable HandlerExecutionChain mappedHandler, @Nullable ModelAndView mv,  
       @Nullable Exception exception) throws Exception {  
  
    boolean errorView = false;  
  
    if (exception != null) {  
       if (exception instanceof ModelAndViewDefiningException mavDefiningException) {  
          mv = mavDefiningException.getModelAndView();  
       }  
       else {  
          Object handler = (mappedHandler != null ? mappedHandler.getHandler() : null);  
          mv = processHandlerException(request, response, handler, exception);  
          errorView = (mv != null);  
       }  
    }  
  
    if (mv != null && !mv.wasCleared()) {  
       render(mv, request, response);  
       if (errorView) {  
          WebUtils.clearErrorRequestAttributes(request);  
       }  
    }  
    else {  
	    ...
    }  
  
    if (mappedHandler != null) {  
       // Exception (if any) is already handled..  
       mappedHandler.triggerAfterCompletion(request, response, null);  
    }  
}
```

( `processHandlerException` 는 View 관련 작업을 한 후 다시 throw 합니다. )
추가 Model-View 관련 작업을 하고, 인터셉터의 `afterCompletion` 을 끝으로 doDispatch 는 끝이 나게 됩니다.

![500](https://i.imgur.com/4i1DDrr.png)

사진으로 설명하면 이와 같은 플로우가 되겠네요.
물론, 이는 추상(Abstract) 으로만 분석 + 부가적인 요소는 생략 했으니 참고만 해주세요.
## 실제로는?

![500](https://i.imgur.com/cT7dam5.png)

해당 컨트롤러를 디버깅해서 `Step Over` 를 하면 아래와 같이 나옵니다.

1. DispatcherServlet.doDispatch -> getHandler
2. AbstractHandlerMapping.getHandler -> getHandlerInternal
3. Dispatcher.getHandlerAdapter
4. AbstractHandlerMethodAdapter.supports
5. 인터셉터들 `preHandle` 실행
6. AbstractHandlerMethodAdapter.handle
7. RequestMappingHandlerAdapter.handleInternal -> invokdHandlerMethod
8. ServletInvocableHandlerMethod.invokdAndHandle -> invokeForRequest
9. InvocableHandlerMethod.invokeForRequest -> doInvoke
10. 실제 Method 수행
11. InvocableHandlerMethod.doInvoke -> invokeForRequest 결과 리턴
12. RequestMappingHandlerAdapter.invokdHandlerMethod -> handleInternal 결과 리턴
13. AbstractHandlerMethodAdapter.handle 결과 리턴
14. 인터셉터들 `postHandle` 실행
15. DispatcherServlet.processDispatchResult 실행
16. 인터셉터들 `afterCompletion` 실행

정말 스프링이 매우 많은걸 해주는걸 알 수 있습니다.
( 모르고 써도 될 거 같네요. 🥲 )

이 DispatcherServlet 을 가능하게 해주는 기능으로
- Tomcat 이 요청을 받아서 `HttpServletRequest` 로 변환 & `HttpServletResponse` 통해 응답
- 핸들러를 빈 컨테이너에서 의존성 주입

등이 있겠네요.
이에 대해서는 나중에 좀 더 알아보겠습니다. 이상으로 긴 탐구글 감사합니다!
