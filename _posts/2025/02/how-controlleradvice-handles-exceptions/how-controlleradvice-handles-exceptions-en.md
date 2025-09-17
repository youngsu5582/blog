---
title: "How ControllerAdvice Handles Exceptions"
author: 이영수
date: 2025-02-10T07:17:05.765Z
tags: ['Ordered', 'controlleradvice', 'spring']
categories: ['Backend', 'Spring']
description: "ControllerAdvice checks based on the cause. Be careful!"
permalink: /posts/how-controlleradvice-handles-exceptions/
image:
  path: https://velog.velcdn.com/images/dragonsu/post/3588d57c-24b5-4785-ba6f-1bffa28368f9/image.png
permalink: /posts/how-controlleradvice-handles-exceptions/
---
> This post covers a troubleshooting experience with ControllerAdvice.
If you find any mistakes, please let me know at joyson5582@gmail.com or in the comments 🙂


While separating `@ControllerAdvice` for different domains, I encountered a puzzling situation.

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
            message = ex.reason ?: "An error occurred.",  
            data = null  
        )  
    }  
}

```

I implemented logic to catch exceptions during authentication and throw them as `UNAUTHORIZED`.

```
{
    "success": false,
    "status": 400,
    "message": "Invalid token format"
}
```

However, the result was consistently `400`.
While debugging to solve the problem, I found the cause.

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

Strangely, it was being caught by the `IllegalArgumentException` handler in a different `Advice`.

Now, let's investigate why this problem occurred.

## Investigation

First, what happens when an exception occurs during request processing?
Our controller logic is actually executed through `DispatcherServlet` - `InvocableHandlerMethod`.
Since the exception occurred while executing the `Resolver` for authentication, in `methodArgumentValues`:

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

The exception is thrown as shown.

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

The `DispatcherServlet` receives this exception and processes it.

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

And it searches for an `ExceptionResolver` that can handle it.

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

Processing is passed to the abstract class `ExceptionHandlerExceptionResolver`.

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

- `handleMethod`: `lotto.controller.LottoPurcahseController#purchase`
- `handlerType`: `lotto.controller.LottoPurcahseController`
- `exception`: `ResponseStatusException`

It retrieves a value for handling the exception from the cache or creates a new one.
The exception remains unchanged so far.

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

Now, for the final part 🙂

1. It checks if there is a method to handle the exception type (`ResponseStatusException`).
2. If not, it gets the `Cause`.
3. Then, it performs recursive processing based on the `Cause`.
4. If a matching value is found, it is retrieved.

My exception was `throw ResponseStatusException(HttpStatus.UNAUTHORIZED,e.message,e)`.
The reason it was caught elsewhere was that the cause included `IllegalArgumentException`.

> I wondered why it keeps using recursion based on the cause.
> I think this is necessary to catch top-level exception classes like `@ExceptionHandler(Exception::class)`.

## Solution
### Remove the Cause

```kotlin
catch (e:IllegalArgumentException){  
    throw ResponseStatusException(HttpStatus.UNAUTHORIZED,e.message,e)  
}
```

Removing `e` from this part solves it.
Since `IllegalArgumentException` is not caught in the cause, it won't be a problem.

However, this is a very dangerous method as it removes the `trace` of where the problem originated.

### Adjusting Order with the Order Annotation

```kotlin
public abstract class AbstractHandlerExceptionResolver implements HandlerExceptionResolver, Ordered {
```


The `AbstractHandlerExceptionResolver` that handles exceptions implements `Ordered` like this.

```java
public interface Ordered {  
  
    int HIGHEST_PRECEDENCE = Integer.MIN_VALUE;  
  
    int LOWEST_PRECEDENCE = Integer.MAX_VALUE;  
  
  
     int getOrder();  
}
```

Spring allows adjusting the order of multiple `Component`s through the `Ordered` interface.

If we make `AuthExceptionHandler` process before `LottoExceptionHandler`?
It will first process based on `ResponseStatusException` (without iterating to handle `IllegalArgumentException`).

```java
@Retention(RetentionPolicy.RUNTIME)  
@Target({ElementType.TYPE, ElementType.METHOD, ElementType.FIELD})  
@Documented  
public @interface Order {  
  
    int value() default Ordered.LOWEST_PRECEDENCE;
}
```

And the `Order` annotation is what simplifies handling this `Ordered` interface.

```java
@ControllerAdvice  
@Order(Ordered.HIGHEST_PRECEDENCE)
```

Spring has a class called `AnnotationAwareOrderComparator` that handles this `Ordered` interface.

> Additionally, if you specify `Order` on only one object, the order of the rest may not be guaranteed.

## Conclusion

To handle comprehensive Java exceptions (`IllegalArgumentException`, `IllegalStateException`) through `ControllerAdvice`, it seems you need to be careful about `avoiding duplicates` or `managing the order`.

I placed `AuthExceptionHandler` at the highest priority because I thought it was appropriate for it to be processed first.
It seems you can control the processing method appropriately through ordering according to the actual situation.

![](https://velog.velcdn.com/images/dragonsu/post/a8e36919-3f42-45dc-af57-3d19273bd27e/image.png)

In conclusion, the content explained above seems to have this kind of flow.
Thank you for reading this long post!  ☺️
