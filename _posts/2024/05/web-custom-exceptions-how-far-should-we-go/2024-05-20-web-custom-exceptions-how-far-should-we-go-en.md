---
title: "Web Custom Exceptions: How Far Should We Go?"
author: 이영수
date: 2024-05-20T10:51:02.466Z
tags: ['Status Code', 'Exception', 'Wooteco']
categories: ['Programming']
description: "No more struggling and worrying about web custom exceptions"
image:
  path: https://velog.velcdn.com/images/dragonsu/post/10b8fb5d-b705-40d3-bf64-a24c439c9347/image.png
lang: en
permalink: /posts/web-custom-exceptions-how-far-should-we-go/
---

> This post has been translated from Korean to English by Gemini CLI.

First, before explaining web custom exceptions,
we need to look at HTTP Status Codes.

### Status Code

All of these contents will be written based on MDN Web Docs.
(Because it is the most prominent and official document that everyone can see)
#### 400 : Bad Request

> A status code indicating that the server detected a client error (e.g., malformed request syntax, invalid request message framing) and cannot or will not process the request.

It is quite ambiguous and vague.
Client error? To what extent is it a client's error or fault?
#### 404 : Not Found

> A status code indicating that the server cannot find the requested resource.
> (If the resource has been permanently deleted, the 410 (Gone) status code should be used.)
##### 410 : Gone

> Indicates that the target resource is no longer accessible from the origin server,
> and the condition is likely to be permanent.
> (If it is unknown whether the condition is temporary or permanent, 404 should be used.)

This is also quite ambiguous.
Even if it is permanently deleted, can't 410 be used if there is a possibility of recovery?
Even if it is judged that it cannot be permanently recovered, should it be changed if a logic that allows recovery is added later?
#### 409 : Conflict

 >A status code indicating that the request conflicts with the current state of the server.
 >(Most likely to occur in response to a PUT request.)
 
Most of the content explains that if a new PUT request has a lower version than the current version, assuming there is a Version.

Then, based on the word Conflict, shouldn't it be used to handle conflicts between requests (data already exists in the DB)?
#### 422 : Unprocessable Content

> A status code indicating that the server understood the request and the syntax was correct, but it was unable to process the requested instructions.

Thus, the status code seems clear but is very ambiguous.

- If the format of the input parameter is wrong, is it 400 or 422?
- Is an exception for an existing ID or constraint 400 or 409?

To think more ignorantly,
why don't we consider everything as 400?

- Isn't it a bad request even if you're not logged in?
- Isn't it a bad request even if the parameters are wrong?
- Isn't it a bad request even if you go to the wrong page?
### Exception

I will pause this content for a moment and explain IllegalArgument/State and CustomException.

```java
@ExceptionHandler(value = IllegalArgumentException.class)  
public ResponseEntity<ErrorResponse> handleArgumentException(final IllegalArgumentException exception) {  
    return ResponseEntity.badRequest()  
            .body(new ErrorResponse(exception));  
}
```

```java
public class ExistReservationException extends IllegalArgumentException {  
  
    public ExistReservationException(final ExceptionDomainType exceptionDomainType, final long id) {  
        super(String.format("%s ID %d에 해당하는 예약이 존재합니다.", exceptionDomainType.getMessage(), id));  
    }  
}

@ExceptionHandler(value = ExistReservationException.class)  
public ResponseEntity<ErrorResponse> handleExistReservationException(final ExistReservationException exception) {  
    return ResponseEntity.status(HttpStatus.BAD_REQUEST)  
            .body(new ErrorResponse(exception));  
}
```

The above is a comprehensive Illegal.
The one below is a Custom Exception to catch cases where a reservation exists and is being deleted.

Through custom exceptions,
you can clearly identify what kind of exception it is through the class name + easily create messages.

Is it a good exception??
=> In my opinion, it is a very bad exception.

It is code that has only disadvantages except for the advantages mentioned above.

- Increased management points
- No additional logic
- The returned status code is also the same.

> So, in the end, is it best to use only 400 and IllegalArgument / IllegalState Exception?

=> Similar to the above, I think it's the best.

![200](https://i.imgur.com/3ygTlAz.png)
(When reservation time does not exist, when theme does not exist, when reservation exists, when reservation time exists...)

Will it be meaningful to catch all situations with custom exceptions + will it be manageable?

If you separate by domain, exceptions will also be separated and there won't be many??
-> Anyway, `@ControllerAdvice` manages it, so management points are already increased!

Can't we just catch only the top-level class through inheritance and separate it?
-> The meaning of Custom is already faded, and not all exceptions can be clearly grouped!

One might think that Custom Exceptions can be created for extensibility,
but here it goes the other way. - Since it was not created in advance, only the necessary parts can be added without modification.
#### But why have status codes become so diverse?

Status codes are ultimately one of the results of communication between a web server and a client.

What if 400 occurred for another reason, and you need to identify it?
```java
public void deleteReservationTime(final long id) {  
    if (reservationRepository.existsByTimeId(id)) {  
        throw new IllegalArgumentException(String.format("A reservation for reservation time ID %d to be deleted exists!",id));  
    }  
    if (reservationTimeRepository.deleteReservationTimeById(id) == 0) {  
        throw new IllegalArgumentException(String.format("Data for %d does not exist!", id));  
    }  
}
```

The client has no way to distinguish between these two.

```javascript
if (!response.ok) {
	if (message.includes("A reservation exists")) {
		console.error(`Error: ${message}`);
		alert(`Error: ${message}`);
	} else if (message.includes("Data does not exist")) {
		console.error(`Error: ${message}`);
		alert(`Error: ${message}`);
	}
}
```

Since the status codes are the same, they are distinguished only by messages.

```java
if (reservationTimeRepository.deleteReservationTimeById(id) == 0) {  
    throw new NotExistException(RESERVATION_TIME, id);  
}

@ExceptionHandler(value = NotExistException.class)  
public ResponseEntity<ErrorResponse> handleNotExistException(final NotExistException exception) {  
    return ResponseEntity.status(HttpStatus.NOT_FOUND)  
            .body(new ErrorResponse(exception));  
}
```

```java
if (!response.ok) {
	const errorMessage = await response.text();
	if (response.status === 409) {
		console.error(`Conflict error: ${errorMessage}`);
		alert(`Error: ${errorMessage}`);
	} else if (response.status === 404) {
		console.error(`Not found error: ${errorMessage}`);
		alert(`Error: ${errorMessage}`);
}
```

In such cases, status codes can be used so that the front-end and server can clearly recognize each other.
Also, it implicitly allows them to expect the status they will exchange.
- If there is no resource for the path, it will return 404, right?
- If the format of the provided parameter is wrong, it will return 422, right?
(Of course, in addition, status codes exist not only for server-client communication but also for `browsers, proxies, caches` - here, it's a code-based approach.)

Therefore, even if the status code is somewhat ambiguous, it doesn't matter if you use 400 until it's needed!
### Conclusion

It's a sudden conclusion, but

In my opinion, custom exceptions are not necessary unless the front-end needs to control the logic (status codes are needed for easy distinction) or
the server needs additional logic for exceptions (logging, sending messages via Kafka, etc.).

From the perspective of server-client communication in the first place,
there is no need to know or explain the reason why the 400 status code came about.

If it becomes necessary on the client side, the server can then think carefully and create and separate custom exceptions.
But what if even more detailed control is needed there?

```java
@ExceptionHandler(CustomException.class)
public ResponseEntity<ErrorResponse> handleCustomException(CustomException ex) {
	Map<String, Object> errorDetails = new HashMap<>();
	errorDetails.put("message", ex.getMessage());
	errorDetails.put("businessCode", ex.getBusinessCode());
	return ResponseEntity.status(HttpStatus.BAD_REQUEST)  
		.body(new ErrorResponse(ex,errorDetails));
}
```

You can put the status code in the exception and send it to the front-end!

As for exceptions, don't create or prepare in advance for excessive over-engineering and extensibility,
but create them as needed.

### References

https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/400
https://stackoverflow.com/questions/16133923/400-vs-422-response-to-post-of-data
https://stackoverflow.com/questions/77768346/what-is-the-purpose-of-using-http-status-codes-to-describe-rest-api-domain-error
[Related Mission Feedback](https://github.com/woowacourse/spring-roomescape-member/pull/70#discussion_r1588889181)
