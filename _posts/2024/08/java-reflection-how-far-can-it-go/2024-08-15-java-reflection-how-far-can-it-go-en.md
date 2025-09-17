---
title: "How Far Can Java Reflection Go?"
author: 이영수
date: 2024-08-15T15:12:45.442Z
tags: ['Reflection', 'Wooteco', 'Java', 'Query Inspector']
categories: ['Backend', 'Java']
description: "Enable checking & reporting how many times all my methods execute queries before submitting a PR"
image:
  path: https://velog.velcdn.com/images/dragonsu/post/5b399bce-a867-4519-8220-3ca1a1dbf68a/image.jpeg
lang: en
permalink: /posts/java-reflection-how-far-can-it-go/
---
(This is our project character. Isn't it cute? 🙂)

This post is about getting results through dynamic method execution using reflection & annotations.
If you have a better way or opinion, please let me know at joyson5582@gmail.com or in the comments!

## Introduction: About Reflection

To briefly explain reflection, it is an API that allows you to use the values of the class itself stored in the `Heap` area.

```java
class Person{

	private Long id;

	private long roomId;

	private long memberId;
}
```

If you have an object like this?

```java
Participation participation = new Participation(1L, 1L, 1L);
assertThat(participation.getClass()).isEqualTo(Participation.class);
```

The value received through `Participation.class` or `getClass` is the value of the class itself.
So what does it provide?

- getMethods
- getAnnotations
- getConstructors
- getFields
- getInterfaces

Everything you can think of as `can I get it from the class?` is possible.
(Besides these, there are also `getSuperClass`, `getEnumConstants`, etc.)

```java
Participation participation = new Participation(1L, 1L, 1L);
Class<Participation> clazz = Participation.class;

Arrays.stream(clazz.getMethods()).forEach(System.out::println);

Arrays.stream(clazz.getAnnotations()).forEach(System.out::println);

Arrays.stream(clazz.getFields()).forEach(System.out::println);

Arrays.stream(clazz.getConstructors()).forEach(System.out::println);
```

> Why clazz? # [Why do Java programmers like to name a variable "clazz"? [closed]](https://stackoverflow.com/questions/2529974/why-do-java-programmers-like-to-name-a-variable-clazz)
> Since JDK 1.0, it has been frequently used to avoid the `class` keyword.
> In English, it's common to change s to z ㅇ.ㅇ

If you print it out?

```java
//clazz.getMethods
public java.lang.Long corea.participation.domain.Participation.getId()
public long corea.participation.domain.Participation.getRoomId()
public long corea.participation.domain.Participation.getMemberId()
public final void java.lang.Object.wait(long,int) throws java.lang.InterruptedException
public final void java.lang.Object.wait() throws java.lang.InterruptedException
public final native void java.lang.Object.wait(long) throws java.lang.InterruptedException
...
```

It prints out all the methods of the inherited classes.

```java
//clazz.getDeclaredMethods()
public java.lang.Long corea.participation.domain.Participation.getId()
public long corea.participation.domain.Participation.getMemberId()
public long corea.participation.domain.Participation.getRoomId()
```

If you use `getDeclaredMethods`, it only brings the methods that exist within the class.

( => In other words, if you need something declared in that class, let's get `DeclaredXX`. )

In this way, Java is very elaborately (or messily?) constructed, although we didn't know it when we just used it.
Method is -> `java.lang.reflect.Method`
Method's Parameter is -> `java.lang.reflect.Parameter`
Class's Field is -> `java.lang.Field`
Class's Constructor is -> `java.lang.Constructor`

and they are composed of each other.

Generally, method calls are determined at compile time, and the JVM executes the method directly at runtime.

```java
public void simpleMethod() {
    int sum = 0;
    for (int i = 0; i < 1000; i++) {
        sum += i;
    }
}
```

A simple function like this

```java
// 1. Direct call
long startDirect = System.nanoTime();
for (int i = 0; i < 100000; i++) {
    benchmark.simpleMethod();
}

long endDirect = System.nanoTime();
long durationDirect = endDirect - startDirect;
System.out.println("Direct call time: " + durationDirect + " ns");
```

```java
// 2. Reflection call
Method method = ReflectionBenchmark.class.getMethod("simpleMethod");
long startReflection = System.nanoTime();
for (int i = 0; i < 100000; i++) {
    method.invoke(benchmark);
}
long endReflection = System.nanoTime();
long durationReflection = endReflection - startReflection;
System.out.println("Reflection call time: " + durationReflection + " ns");
```

After repeating this about 10 times, the result is

```
Direct call time: 9959708 ns
Reflection call time: 13870958 ns

Direct call time: 2193666 ns
Reflection call time: 18574792 ns

Direct call time: 2079875 ns
Reflection call time: 2095750 ns

Direct call time: 2555333 ns
Reflection call time: 2215291 ns

Direct call time: 2314250 ns
Reflection call time: 2266584 ns

Direct call time: 2112292 ns
Reflection call time: 2169792 ns

Direct call time: 2191375 ns
Reflection call time: 2185667 ns

Direct call time: 2074167 ns
Reflection call time: 2366333 ns

```

As a result, direct calls are slightly faster. (Wouldn't that be obvious? It loads and executes dynamically - Step increase)
Although performance is degraded, performance is not very important when intentionally executing a function as desired + testing.
Let's run a query inspector on all requests through reflection.

## Request Query Inspector

> Actually, I'm still in the process of writing this, and this method requires a lot of prerequisites.
> I was thinking of using a real request (RestAssured), but since it's the same from a query perspective except for the AccessToken verification part, I'm tracking the controller.

### Prerequisite 1. Perfect Context + Specification

First, our team agreed to use `Spring-openai`.
This is to ensure consistency with the code, for additional explanations and ease of writing, and to facilitate communication with the frontend. (Thanks to Ash, who wrote it so meticulously 🙂)
```java
@Tag(name = "Feedback", description = "Feedback related API")
public interface DevelopFeedbackControllerSpecification {

    @Operation(summary = "Write development related feedback.",
            description = "Write feedback on the development ability of the reviewee assigned to you. <br>"
                    + "When requesting, you must include `Bearer JWT token` in the `Authorization Header`. "
                    + "Based on this token, an `AuthInfo` object is created and the user's information is automatically injected. <br>"
                    + "The user information extracted from the JWT token provides the authenticated user information necessary for writing feedback. "
                    + "<br><br>**Note:** To use this API, a valid JWT token is required, "
                    + "and an authentication error will occur if the token is missing or invalid.",
            tags = {"DevelopFeedback API"})
    @ApiErrorResponses(value = {ExceptionType.ALREADY_COMPLETED_FEEDBACK, ExceptionType.NOT_MATCHED_MEMBER})
    ResponseEntity<Void> create(
            @Parameter(description = "Room ID", example = "1")
            long roomId,
            AuthInfo authInfo,
            DevelopFeedbackRequest request);
	}
}
```

The method is specified like this, and

```java
@Schema(description = "Request to write feedback on development ability")
public record DevelopFeedbackRequest(@Schema(description = "Reviewee ID", example = "2")
                                     long receiverId,

                                     @Schema(description = "Evaluation score", example = "4")
                                     int evaluationPoint,

                                     @Schema(description = "Selected feedback keywords", example = "[\"The code was easy to understand\", \"The convention was well followed\"]")
                                     List<String> feedbackKeywords,

                                     @Schema(description = "Additional feedback text that can be written", example = "I heard it was your first time with Java, but the code was much better structured than I thought. ...")
                                     String feedbackText,

                                     @Schema(description = "Recommendation score required for ranking", example = "2")
                                     int recommendationPoint)
)
```

Inside the DTO, example values are written with a schema.
We will use the example values of `@Parameter` and `@Schema`.
Therefore, there must be a DB context that does not cause exceptions or problems even when executed with these values.
### Prerequisite 2. Intercepting SQL Queries

This content will be omitted as I will write a separate post on query interception.

So, shall we begin?

---
### ParameterExtractor

```java
public Object constructParameter(Parameter parameter) {
    try {
        if (parameter.isAnnotationPresent(io.swagger.v3.oas.annotations.Parameter.class)) {
            io.swagger.v3.oas.annotations.Parameter paramAnnotation = parameter.getAnnotation(io.swagger.v3.oas.annotations.Parameter.class);
            String exampleValue = paramAnnotation.example();
            return castValueToType(exampleValue, parameter.getType());
        }

        if (parameter.getType()
                .isRecord()) {
            return constructRecord((Class<? extends Record>) parameter.getType());
        }

        if (parameter.getType() == AuthInfo.class) {
            return AUTH_INFO;
        }

    } catch (Exception e) {
        throw new RuntimeException(e);
    }
    throw new NoSuchParameterException(String.format("%s is not a supported parameter.",parameter));
}
```

Actually, this part is all of the inspector. Because it dynamically generates parameters.
AUTH_INFO is just a basic authentication value (`new AuthInfo(1L, "youngsu5582", "yuyoungsu5582@gmail.com")`).

#### If there is a Swagger parameter?
 ![](https://i.imgur.com/duRbWUX.png)

If there is a `@Parameter` like `long roomId`, it extracts the internal example value.
#### If the type is a record? ( We made all DTOs that receive web requests as records. )

Check with `isRecord`, which is supported in Java since 16, and

```java
private Object constructRecord(Class<? extends Record> clazz) throws NoSuchMethodException, InvocationTargetException, InstantiationException, IllegalAccessException {
    RecordComponent[] components = clazz.getRecordComponents();
    Object[] args = new Object[components.length];

    for (int i = 0; i < components.length; i++) {
        RecordComponent component = components[i];
        Method accessor = component.getAccessor();
        Schema schema = accessor.getAnnotation(Schema.class);

        if (schema != null) {
            String exampleValue = schema.example();
            args[i] = castValueToType(exampleValue, component.getType());
        } else {
            args[i] = getDefaultValue(component.getType());
        }
    }

    Constructor constructor = clazz.getDeclaredConstructor(getClassesFromComponents(components));
    return constructor.newInstance(args);
}

private Class<?>[] getClassesFromComponents(RecordComponent[] components) {
    Class<?>[] classes = new Class[components.length];
    for (int i = 0; i < components.length; i++) {
        classes[i] = components[i].getType();
    }
    return classes;
}
```

1. Get the components of the record.
2. Get the accessor of the component.
> Why not a variable, but an accessor?
> The variables of a record are immutable. They are automatically generated as private final, and to access the fields,
> an accessor method corresponding to the variable name is automatically generated.
> -> Therefore, you must check if there is an annotation through a function for a record.
3. Get the example value of `@Schema`.

![](https://i.imgur.com/binMQRM.png)

4. Create a new object with the converted values.
	1. Get the types of each component.
	2. Get the appropriate constructor through the types.
#### Value Conversion

The received example values are strings, so they must be converted from strings to a specific type.

![400](https://i.imgur.com/IaGQjN2.png)

( By GPT )
### MethodExtractor

```java
private final ParameterExtractor parameterExtractor;

public Object[] extract(Method method) {
    try {
        Parameter[] parameters = method.getParameters();
        return Arrays.stream(parameters)
                .map(parameter -> parameterExtractor.constructParameter(parameter))
                .toArray();
    } catch (Exception e) {
        throw e;
    }
}
```

It receives each parameter, assembles the value for the parameter, and returns it as an array.
This next part is difficult,, let's go 😎😎
### ControllerExecutor

This part is still incomplete. ( Because I can't spend all my time on my personal trial and error )

```java
public void executeAllMethod(Object execution) {
    Class<?> clazz = AopProxyUtils.ultimateTargetClass(execution);
    log.debug("Specification : {}", clazz);

    Class<?> specificationClass = extractSpecificationClass(clazz);

    Method[] methods = clazz.getDeclaredMethods();

    Map<String, Method> specificationInfo = extractMethod(specificationClass);
    Map<String, Method> executionInfo = extractMethod(clazz);

    Arrays.stream(methods)
            .forEach(method -> executeMethod(execution, specificationInfo.get(method.getName()), executionInfo.get(method.getName())));
}
```

Finally, the last part.
You might be wondering what `AopProxyUtils.ultimateTargetClass` is.
Spring wraps classes with numerous proxies.

![450](https://i.imgur.com/OEy74Ht.png)
( Numerous methods that come out even when using `getDeclareMethods()` )

Generally, if you use the controller as is, you cannot extract only the complete methods.
This function gets the complete class with the proxies removed.

```java
private Class<?> extractSpecificationClass(Class<?> controllClass) {
    return Arrays.stream(controllClass.getInterfaces())
            .filter(aClass -> aClass.getName()
                    .contains("Specification"))
            .findFirst()
            .orElse(controllClass.getInterfaces()[0]);
}
```

Extract the `XXXSpecification` interface

```java
private Map<String, Method> extractMethod(Class<?> specificationClass) {
    return Arrays.stream(specificationClass.getDeclaredMethods())
            .collect(Collectors.toMap(
                    Method::getName, Function.identity()
            ));
}
```

Group the methods by name ( to map the method to be executed with the `Specification` method )

```java
public void executeMethod(Object executeClass, Method specificationMethod, Method method) {
    Object[] args = methodExtractor.extract(specificationMethod);
	try {
	    log.debug("Executing function. Function name({}.{}) Execution parameters({})", method.getDeclaringClass()
	            .getName(), method.getName(), args);
	    Object result = method.invoke(executeClass, args);
	} catch (RuntimeException e) {
	    log.warn("This method({}) does not match the specification. Assembled parameters({}) Error({}", method.getName(), args, e);
	} catch (InvocationTargetException e) {
	    throw new RuntimeException(e);
	} catch (IllegalAccessException e) {
	    throw new RuntimeException(e);
	}
}
```

Assemble the parameters of the execution methods -> execute the method through the subject class to be executed (`executeClass`).
That's it.

So, shall we check if it works well?
## Result

```java
public class RoomController implements RoomControllerSpecification {
	@GetMapping("/opened")
	public ResponseEntity<RoomResponses> openedRooms(@AccessedMember AuthInfo authInfo,
	                                                 @RequestParam(value = "classification", defaultValue = "all") String expression,
	                                                 @RequestParam(defaultValue = "0") int page) {
	    RoomResponses response = roomService.findOpenedRooms(authInfo.getId(), expression, page);
	    return ResponseEntity.ok(response);
	}
}
```

```java
ResponseEntity<RoomResponses> openedRooms(AuthInfo authInfo,

                                          @Parameter(description = "방 분야", example = "AN")
                                          String expression,

                                          @Parameter(description = "페이지 정보", example = "1")
                                          int page);
```

```java
@Test
@DisplayName("Execute a specific method.")
void execute_specific_method(){
    Class<RoomController> controllerClass = RoomController.class;
    Class<RoomControllerSpecification> specClass = RoomControllerSpecification.class;
    var methodInfo = getMethodInfo(controllerClass);
    var specMethodInfo = getMethodInfo(specClass);

    controllerExecutor.executeMethod(roomController,specMethodInfo.get("openedRooms"),methodInfo.get("openedRooms"));
}
```
If you execute this value?

```java
[2024-08-15 22:26:01:6577] [Test worker] DEBUG [corea.global.aspect.ControllerExecutor.executeMethod:56] - Executing function. Function name(corea.room.controller.RoomController.openedRooms) Execution parameters([AuthInfo{id=1, name='youngsu5582', email='yuyoungsu5582@gmail.com'}, AN, 1])

[2024-08-15 22:26:01:6589] [Test worker] DEBUG [corea.global.aspect.query.QueryLoggingAspect.logSqlStatements:49] - corea.room.controller.RoomController.openedRooms executed with queries: 
select r1_0.id,r1_0.classification,r1_0.content,r1_0.current_participants_size,r1_0.keyword,r1_0.limited_participants_size,r1_0.manager_id,r1_0.matching_size,r1_0.recruitment_deadline,r1_0.repository_link,r1_0.review_deadline,r1_0.status,r1_0.thumbnail_link,r1_0.title from room r1_0 left join participation p1_0 on r1_0.id=p1_0.room_id and p1_0.member_id=? where p1_0.id is null and r1_0.classification=? and r1_0.status=? and r1_0.manager_id<>? offset ? rows fetch first ? rows only : 1

select count(r1_0.id) from room r1_0 left join participation p1_0 on r1_0.id=p1_0.room_id and p1_0.member_id=? where p1_0.id is null and r1_0.classification=? and r1_0.status=? and r1_0.manager_id<>? : 1
```

The function is executed with the values in the Specification, and the query statement that occurred while executing the function is printed as a log.
### Ultimate Goal

What does it mean to print as a log?
-> It means it can be saved as a file. ( `FileAppender` )

Assuming that only a consistent context is maintained,
it has become possible to run all methods and implement something like test coverage based on this.

It is possible to predict how many warn(methods where the query count exceeds the threshold) there are, or how many times a specific method generates a query statement.
It could be a CI in an action by checking the context through a gradle command and showing the result based on it.

---

In Java, there is nothing impossible using reflection and annotations (I think).
It's just that what's possible is useful for our project, or it depends on how much effort it takes to apply it.
If it's possible to agree with the team members and make an effort, let's add features that are helpful for a meaningful project.

This content deals with the part to be applied to [2024-corea](https://github.com/woowacourse-teams/2024-corea). ( To be reflected after discussion with team members ) Please show a lot of interest!

```