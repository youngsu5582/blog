---
title: "ControllerAdvice 가 예외를 처리하는 법"
author: 이영수
date: 2025-02-10T07:17:05.765Z
tags: ['Ordered', 'controlleradvice', '스프링']
categories: ['백엔드', '스프링']
description: "ControllerAdvice checks based on the cause. Be careful!"
permalink: /posts/how-controlleradvice-handles-exceptions/
image:
image:
  path: https://velog.velcdn.com/images/dragonsu/post/3588d57c-24b5-4785-ba6f-1bffa28368f9/image.png
permalink: /posts/how-controlleradvice-handles-exceptions/
---
> 해당 내용은 ControllerAdvice 트러블 슈팅을 하며 다룬 내용입니다.
틀린 부분이 있다면 joyson5582@gmail.com 이나 댓글로 남겨주세요 🙂


도메인 간 분리를 위해 `@ControllerAdvice` 도 분리하며 코드를 작성하던 중 의아한 부분이 발생했습니다.

```kotlin
class AuthenticatedMemberArgumentResolver(
	override fun resolveArgument( ...){
		...
		try {  
		    val memberId = tokenService.decodeToken(AccessToken(token))  
		    val memberData = memberService.readMember(memberId)  
		    return AuthenticatedMember(  
		        id = memberData.id,  
		        email = memberData.email  
		    )  
		}catch (e:IllegalArgumentException){  
		    throw ResponseStatusException(HttpStatus.UNAUTHORIZED,e.message,e)  
		}
}
```

```kotlin
package auth.config  
  
@ControllerAdvice  
class AuthExceptionHandler {  
  
    @ExceptionHandler(ResponseStatusException::class)  
    fun handleResponseStatusException(ex: ResponseStatusException): ApiResponse<Any?> {  
        return ApiResponse(  
            success = false,  
            status = ex.statusCode.value(),  
            message = ex.reason ?: "에러가 발생했습니다.",  
            data = null  
        )  
    }  
}

```

이와같이, 인증 도중 발생한 예외를 잡아서 `UNAUTHORIZED` 로 던지는 로직을 구현했습니다.

```
{
    "success": false,
    "status": 400,
    "message": "잘못된 형식의 토큰입니다"
}
```

하지만, 결과는 계속 `400` 이였습니다.
문제 해결을 위해, 디버깅을 하던 도중 원인을 발견했습니다.

```kotlin
package lotto

@ControllerAdvice  
class LottoExceptionHandler {

	@ExceptionHandler(IllegalArgumentException::class)  
	fun handleIllegalException(ex: IllegalArgumentException): ApiResponse<Void> {  
	    logger.warn { ex.stackTraceToString() }  
	    return ApiResponse.fail(message = ex.message)  
	}
}
```

생뚱맞게, 다른 `Advice` 의 `IllegalArgumentException` 에 잡히고 있었습니다.

그러면, 이제 왜 이런 문제가 발생했는지 탐구해보겠습니다.

## 탐구

우선, 요청 처리 중 예외가 발생하면?
우리의 컨트롤러 로직은

DispatcherServlet - InvocableHandlerMethod 를 통해 실제로 수행이 됩니다.
우리는 인증을 위한 Resolver 를 실행하다가 에외가 발생했으니, `methodArgumentValues` 에서

```kotlin
// InvocableHandlerMethod
protected Object[] getMethodArgumentValues(NativeWebRequest request, @Nullable ModelAndViewContainer mavContainer,  
       Object... providedArgs) throws Exception {
	       ...
	       try {  
			    args[i] = this.resolvers.resolveArgument(parameter, mavContainer, request, this.dataBinderFactory);  
			}  
			catch (Exception ex) {  
			    // Leave stack trace for later, exception may actually be resolved and handled...  
			    if (logger.isDebugEnabled()) {  
			       String exMsg = ex.getMessage();  
			       if (exMsg != null && !exMsg.contains(parameter.getExecutable().toGenericString())) {  
			          logger.debug(formatArgumentError(parameter, exMsg));  
			       }  
			    }  
			    throw ex;  
			}
		}
	}
}

```

와 같이 예외가 던져집니다.

```kotlin
// DispatcherServlet
protected void doDispatch(HttpServletRequest request, HttpServletResponse response) throws Exception {
	...
	catch (Exception ex) {  
	    dispatchException = ex;  
	}
	...
	processDispatchResult(processedRequest, response, mappedHandler, mv, dispatchException);
}
```

이 예외를 DispatcherServlet 이 받아서 예외를 가지고 처리를 합니다.

```java
// DispatcherServlet
protected ModelAndView processHandlerException(HttpServletRequest request, HttpServletResponse response,  
       @Nullable Object handler, Exception ex) throws Exception {
		...
		if (this.handlerExceptionResolvers != null) {
		    for (HandlerExceptionResolver resolver : this.handlerExceptionResolvers) {
		       exMv = resolver.resolveException(request, response, handler, ex);
		       if (exMv != null) {
		          break;
		       }
		    }
		}
	...
}
```

그리고, `ExceptionResolver` 들을 통해 처리를 할 수 있는지 찾습니다.

```java
// HandlerExceptionResolverComposite : HandlerExceptionResolver
public ModelAndView resolveException(
       HttpServletRequest request, HttpServletResponse response, @Nullable Object handler, Exception ex) {

    if (this.resolvers != null) {
       for (HandlerExceptionResolver handlerExceptionResolver : this.resolvers) {
          ModelAndView mav = handlerExceptionResolver.resolveException(request, response, handler, ex);
          if (mav != null) {
             return mav;
          }
       }
    }
    return null;
}
```

추상 클래스 `ExceptionHandlerExceptionResolver` 로 처리가 넘어옵니다.

```kotlin
//ExceptionHandlerExceptionResolver
protected ModelAndView doResolveHandlerMethodException(HttpServletRequest request,
   HttpServletResponse response, @Nullable HandlerMethod handlerMethod, Exception exception) {

	ServletWebRequest webRequest = new ServletWebRequest(request, response);
	ServletInvocableHandlerMethod exceptionHandlerMethod = getExceptionHandlerMethod(handlerMethod, exception, webRequest);
}

protected ServletInvocableHandlerMethod getExceptionHandlerMethod(  
       @Nullable HandlerMethod handlerMethod, Exception exception, ServletWebRequest webRequest) {
	       ...
	    if (handlerMethod != null) {
		    handlerType = handlerMethod.getBeanType();
		    ExceptionHandlerMethodResolver resolver = this.exceptionHandlerCache.computeIfAbsent(  
       handlerType, ExceptionHandlerMethodResolver::new);
	   }
	   ...
	   for (Map.Entry<ControllerAdviceBean, ExceptionHandlerMethodResolver> entry : this.exceptionHandlerAdviceCache.entrySet()) {  
		    ControllerAdviceBean advice = entry.getKey();  
		    if (advice.isApplicableToBeanType(handlerType)) {  
		       ExceptionHandlerMethodResolver resolver = entry.getValue();  
		       for (MediaType mediaType : acceptedMediaTypes) {  
		          ExceptionHandlerMappingInfo mappingInfo = resolver.resolveExceptionMapping(exception, mediaType);  
		          ...
		        }
		    }
		}
	}
}
```

- handleMethod : lotto.controller.LottoPurcahseController#purchase
- handlerType : lotto.controller.LottoPurcahseController
- exception : ResponseStatusException

Cache 를 통해 예외를 처리하는 값을 가져오거나, 새로 생성합니다.
아직까지도, 예외가 변하지 않고 유지되어 있습니다.

```java
//ExceptionHandlerMethodResolver

public ExceptionHandlerMappingInfo resolveExceptionMapping(Throwable exception, MediaType mediaType) {  
    ExceptionHandlerMappingInfo mappingInfo = resolveExceptionMappingByExceptionType(exception.getClass(), mediaType);  
    if (mappingInfo == null) {  
       Throwable cause = exception.getCause();  
       if (cause != null) {  
          mappingInfo = resolveExceptionMapping(cause, mediaType);  
       }  
    }  
    return mappingInfo;  
}

public ExceptionHandlerMappingInfo resolveExceptionMappingByExceptionType(Class<? extends Throwable> exceptionType, MediaType mediaType) {  
    ExceptionHandlerMappingInfo mappingInfo = this.lookupCache.get(new ExceptionMapping(exceptionType, mediaType));  
    return (mappingInfo != NO_MATCHING_EXCEPTION_HANDLER ? mappingInfo : null);  
}
```

이제, 마지막입니다 🙂

1. 예외 타입 ( ResponseStautsException ) 을 처리하는 메소드가 있는지 가져온다.
2. 없다면, `Cause` 를 가져온다.
3. 그리고, `Cause` 를 기반으로, 재귀 처리를 한다.
4. 일치한 값이 있으면 가져온다.

저의 예외는 `throw ResponseStatusException(HttpStatus.UNAUTHORIZED,e.message,e)` 
이와 같이 cause 를 `IllegalArgumentException` 을 포함한게 다른 곳에서 catch 가 된 이유였습니다.

> 왜, cause 를 기반으로 계속 재귀함수를 하지 생각했는데
> 이렇게 해야, `@ExceptionHandler(Exception::class)`  같은 최상위 예외 클래스를 잡을 수 있을거 같습니다.

## 해결방법
### Cause 제거

```kotlin
catch (e:IllegalArgumentException){  
    throw ResponseStatusException(HttpStatus.UNAUTHORIZED,e.message,e)  
}
```

해당 부분에서 `e` 를 제거하면 끝입니다.
cause 에 `IllegalArgumentException` 이 잡히지 않으니, 문제가 안될겁니다.

하지만, 어디서부터 문제가 발생했는지에 대한 `trace` 를 날리므로 매우 위험한 방법입니다.

### Order 어노테이션 통한 순서 조정

```kotlin
public abstract class AbstractHandlerExceptionResolver implements HandlerExceptionResolver, Ordered {
```


예외를 처리하는 `AbstractHandlerExceptionResolver` 는 이와같이 `Ordered` 를 구현하고 있습니다.

```java
public interface Ordered {  
  
    int HIGHEST_PRECEDENCE = Integer.MIN_VALUE;  
  
	int LOWEST_PRECEDENCE = Integer.MAX_VALUE;  
  
  
     int getOrder();  
}
```

스프링은 `Ordered` 라는 인터페이스를 통해, 여러개의 `Component` 들의 순서를 조정하게 해줍니다.

`AuthExceptionHandler` 가 `LottoExceptionHandler` 보다 먼저 처리를 하게 한다면?
`ResponseStatusException` 를 기반으로 ( 순회해서 `IllegalArgumentException` 처리 X )먼저 처리합니다.

```java
@Retention(RetentionPolicy.RUNTIME)  
@Target({ElementType.TYPE, ElementType.METHOD, ElementType.FIELD})  
@Documented  
public @interface Order {  
  
    int value() default Ordered.LOWEST_PRECEDENCE;
}
```

그리고, 이런 `Ordered` 를 간단하게 처리 해주는게 `Order` 어노테이션 입니다.

```java
@ControllerAdvice  
@Order(Ordered.HIGHEST_PRECEDENCE)
```

스프링은 이런 `Ordered` 를 처리해주는 `AnnotationAwareOrderComparator` 라는 클래스가 있습니다.

> 추가로, 하나의 객체에만 `Order` 를 지정하면, 나머지는 순서가 보장이 안 될수 있습니다.

## 결론

자바의 포괄적인 예외 ( `IllegalArgumentException`,`IllegalStateException` ) 을
`ControllerAdvice` 를 통해 처리하려면 `중복되지 않게` 또는 `순서를` 신경써야 할 거 같습니다.

저는, `AuthExceptionHandler` 가 제일 먼저 처리하는게 타당하다고 생각해 최우선 순위로 배치했습니다.
실 상황에 맞게 적절하게 순서를 통해 처리 방식을 제어하면 될 거 같습니다.

![](https://velog.velcdn.com/images/dragonsu/post/a8e36919-3f42-45dc-af57-3d19273bd27e/image.png)

결론적으론, 위에서 설명한 내용들은 이런 플로우를 가질 거 같습니다.
긴 글 읽어주셔서 감사합니다!  ☺️
