---
title: "Do We Use DispatcherServlet?"
author: 이영수
date: 2024-11-28T16:30:25.636Z
tags: ['DispatcherServlet', 'Struggles', 'Wooteco', 'Spring']
categories: ['Backend', 'Spring']
description: "How deep can DispatcherServlet Depth go? Recursion of recursion of recursion"
image:
  path: https://velog.velcdn.com/images/dragonsu/post/997a2190-cbf4-4773-a723-5fd526bd9e27/image.png
lang: en
permalink: /posts/do-we-use-dispatcherservlet
---

> This post has been translated from Korean to English by Gemini CLI.

> Warning⚠️ This content is very long. It may be incorrect.
This content was written by myself while digging into the code because I couldn't clearly answer the question about Spring's web flow during the KCD interview.
If there is any incorrect content, please leave a comment or contact me at `joyson5582@gmail.com`! 


## DispatcherServlet

What is `DispatcherServlet`? You may have heard of it, but you may have never seen it in actual code.
(Of course, there is content that implements something similar in the Wooteco mission [java-mvc](https://github.com/woowacourse/java-mvc). 🥲)

Then, I will first leave a blog that defines and explains it well.
(I will proceed with the part where I directly explore the code)

> It is called a Front Controller that first receives all requests coming through the HTTP protocol and delegates them to the appropriate controller.
   [Source: Mangkyu Developer's Blog](https://mangkyu.tistory.com/18)

In Spring, `RequestMapping`, `ServletRequest`, and `@RequestBody` annotations that we commonly use are all managed by this `DispatcherServlet` to execute requests.

Let's look at what codes it goes through.

[Official Documentation - DispatcherServlet](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/web/servlet/DispatcherServlet.html)

## doDispatch

It receives a request, finds a handler, executes the handler method, and returns a response. - [Official Documentation](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/web/servlet/DispatcherServlet.html#doDispatch(jakarta.servlet.http.HttpServletRequest,jakarta.servlet.http.HttpServletResponse))
Therefore, it has Request and Response as parameters.

>First, excluding the Tomcat part, I will cover from the part where `HttpServletRequest` and `HttpServletResponse` come in.

> I will explain only simple requests, excluding all additional elements such as Multipart, AsyncManager, CORS, and Cache.

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

As such, after assigning values, it gets the handler for the request.

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

DispatcherServlet gets the handler that can process the request from the `HandlerMapping` List it has.

```java
public interface HandlerMapping {
    @Nullable  
    HandlerExecutionChain getHandler(HttpServletRequest request) throws Exception;  
}
```

### AbstractHandlerMapping - getHandler
There are really various implementations for the interface, but I will explain it through `AbstractHandlerMapping`. - [Official Documentation](https://docs.spring.io/spring-framework/docs/3.1.3.RELEASE_to_3.2.0.RC2/Spring%20Framework%203.1.3.RELEASE/org/springframework/web/servlet/handler/AbstractHandlerMapping.html)
(Because most implementations inherit this `AbstractHandlerMapping`)

> Spring used interface - abstract format very often like this.
> (To define what methods need to be implemented and then enable common logic reuse.)

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

As such, it uses a method called `getHandlerInternal` and it is also abstracted.

### AbstractHandlerMethodMapping - getHandlerInternal

I will explain it through `AbstractHandlerMethodMapping`, the abstract implementation that maps the most commonly used `@RequestMapping`. - [Official Documentation](https://docs.spring.io/spring-framework/docs/3.1.3.RELEASE_to_3.2.0.RC2/Spring%20Framework%203.1.3.RELEASE/org/springframework/web/servlet/handler/AbstractHandlerMethodMapping.html)

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

It continuously parses the path to check if there is matching information + finds if there is a handler to perform. - `lookupHandlerMethod`
Then, it finds something called `HandlerMethod` and returns it through a method called `createWithResolvedBean()`.
#### HandlerMethod

It is a class that inherits `AnnotationMethod`. - [HandlerMethod](https://docs.spring.io/spring-framework/docs/3.1.3.RELEASE_to_3.2.0.RC2/Spring%20Framework%203.1.3.RELEASE/org/springframework/web/method/HandlerMethod.html) - [AnnotatedMethod](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/core/annotation/AnnotatedMethod.html)
It is a class that makes it easier to manage handler (Controller) methods that have various annotations (RequestParam, RequestBody ...) in Spring.

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

- Method to execute
- Method parameters
- Stores annotation information for method parameters

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

It initializes the bean instance (controller) through the bean factory and then returns `HandlerMethod`.
That is, this `HandlerMethod` is an executable object. (Because it has a bean)

#### After AbstractHandlerMethodMapping - getHandlerInternal

Up to this point, it gets `HandlerMethod` or something else through `getHandlerInternal`.
> Currently, `AbstractHandlerMethodMapping` gets `HandlerMethod`, but other `HandlerMapping`s may get something else.

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

If the fetched Handler is null, it returns the default, or `null` if there is no default.
And it adds interceptors to include the Handler and execute it, then returns `HandlerExecutionChain`. - [Official Documentation](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/web/servlet/HandlerExecutionChain.html)

Through this process,
- Executable method
- Interceptor to be executed with the method
It returns `HandlerExecutionChain` with.

## DispatcherServlet - getHandlerAdapter, handle

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

It gets a value called `HandlerAdapter` and processes the handler through it.
Before that, the interceptor's `preHandle` operates, and after the request ends, `postHandle` operates.

### AbstractHandlerMethodAdapter - supports

Similar to the explanation using `AbstractHandlerMethodMapping` above, I will explain it through the abstract class `AbstractHandlerMethodAdapter`. - [Official Documentation](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/web/servlet/mvc/method/AbstractHandlerMethodAdapter.html)
It finds and retrieves an adapter that can process the handler.

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

If there is `RequestMapping`, it always returns true. (Because `HandlerMethod` itself is guaranteed to have it)

### AbstractHandlerMethodAdapter - handle

```java
@Override  
@Nullable  
public final ModelAndView handle(HttpServletRequest request,  
       HttpServletResponse response, Object handler)  
       throws Exception {  
  
    return handleInternal(request, response, (HandlerMethod) handler);  
}
```

Similar to `AbstractHandlerMethodMapping`, there is `handleInternal`.

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

It checks the request and executes the handler method.

### AbstractHandlerMethodAdapter - InvokeHandlerMethod

Then how does it execute the controller's method?

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

After wrapping it once more with `ServletInvocableHandlerMethod`,
it sets `argumentResolvers` and `returnValueHandlers`.
Then it calls and handles the method.

#### ServletInvocableHandlerMethod - invokeAndHandle

It handles handler method calls and method return values. - [Official Documentation](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/web/servlet/mvc/method/annotation/ServletInvocableHandlerMethod.html)

```java
// Execute and handle
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

// Parameter validation - request - response validation
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

// Inject values into method parameters
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

It's quite long, but it only performs the functions described in the comments.

1. Inject values into parameters via `resolver`.
2. Validate parameters.
3. Execute.
4. Validate results.
5. Process results.

CustomerArgumentResolver, which we commonly use, and elements like `@RequestMapping` and `@RequestBody` are also processed here.
If `View` is not used, `mv`'s view will be null.

## DispatcherServlet - processDispatchResult

```java
protected void doDispatch(HttpServletRequest request, HttpServletResponse response) throws Exception {
	...
	processDispatchResult(processedRequest, response, mappedHandler, mv, dispatchException);
	...
}
```

After that, it processes the results.

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

(`processHandlerException` throws again after doing View-related work.)
After additional Model-View related work, `doDispatch` ends with the interceptor's `afterCompletion`.

![500](https://i.imgur.com/4i1DDrr.png)

This would be the flow explained in the picture.
Of course, this is only an abstract analysis + additional elements are omitted, so please refer to it as such.
## In reality?

![500](https://i.imgur.com/cT7dam5.png)

Debugging the controller and `Step Over` yields the following:

1. DispatcherServlet.doDispatch -> getHandler
2. AbstractHandlerMapping.getHandler -> getHandlerInternal
3. Dispatcher.getHandlerAdapter
4. AbstractHandlerMethodAdapter.supports
5. Interceptors `preHandle` execution
6. AbstractHandlerMethodAdapter.handle
7. RequestMappingHandlerAdapter.handleInternal -> invokdHandlerMethod
8. ServletInvocableHandlerMethod.invokdAndHandle -> invokeForRequest
9. InvocableHandlerMethod.invokeForRequest -> doInvoke
10. Actual Method execution
11. InvocableHandlerMethod.doInvoke -> invokeForRequest result return
12. RequestMappingHandlerAdapter.invokdHandlerMethod -> handleInternal result return
13. AbstractHandlerMethodAdapter.handle result return
14. Interceptors `postHandle` execution
15. DispatcherServlet.processDispatchResult execution
16. Interceptors `afterCompletion` execution

You can see that Spring does a lot.
(It seems okay to use it without knowing. 🥲)

Features that enable this DispatcherServlet include:
- Tomcat receives requests and converts them to `HttpServletRequest` & responds via `HttpServletResponse`.
- Dependency injection of handlers from the bean container.

I will learn more about this later. Thank you for this long exploration!
