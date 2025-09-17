---
title: "A Deep Dive into Exceptions, Throwing Exceptions Dynamically"
author: "이영수"
date: 2025-05-31T13:13:50.292Z
tags: [ "exception handling", "java", "code quality", "performance optimization" ]
description: "We will examine the importance of exception handling and how to throw exceptions dynamically, and discuss techniques for improving code quality."
image:
  path: assets/img/thumbnail/2025-05-31-예외-깊게-살펴보기-예외-동적으로-던지기.png
permalink: /posts/a-deep-dive-into-exceptions-throwing-exceptions-dynamically/
---

Recently, while writing code, I received a review about a disappointing aspect of the code.

Here is an example of the problematic code:

```java
// ...BackOfficeSaveDto  

public void validate() {
  try {
    option.validate();
  } catch (IllegalArgumentException e) {
    throw new BusinessException("A problem occurred while saving the back office: %s".formatted(e.getMessage()), e);
  }
}

// ...ClientSaveDto  
public void validate() {
  try {
    option.validate();
  } catch (IllegalArgumentException e) {
    throw new BusinessException("A problem occurred while saving the client: %s".formatted(e.getMessage()), e);
  }
}

// Option  
public void validate() {
  if (model.isInactive()) {
    throw new IllegalArgumentException("The model is inactive. Model type: %s".formatted(model.name()));
  }
}
```

- Duplicate code occurs. - `DRY (Do not repeat yourself!)`
- It catches an exception and simply converts and re-throws it.

I simply thought of using try-catch to separate concerns, but I realized that the code is heavy and not easy to read.

> This part can be somewhat ambiguous.
> In the article [Code Quality Improvement Techniques Part 1: You can't put spilled error back](https://techblog.lycorp.co.jp/ko/techniques-for-improving-code-quality-1),
>
`If the caller's code is not determined and it is not possible to determine whether it is recoverable, you should consider returning the error in an easy-to-handle way and then converting it to another error on the caller's side.`
This is also a matter of code convention and standards. 🙂

Let's take a look at why we shouldn't use exceptions lightly and how to throw exceptions as desired.

## Exceptions

### Object Creation Overhead

When creating a `Throwable` interface, object memory is allocated from the JVM heap.

- It has several fields such as `detailMessage`, `cause`, and `stackTrace` (especially the stack trace is heavy).
- Exception objects tend to be discarded immediately after use (`short-lived`) - which increases GC costs.

### Stack Trace Collection Cost

In Java, exceptions utilize stack traces for easy tracking.

```java
public Throwable(String message) {
  fillInStackTrace();
  detailMessage = message;
}
```

The constructor of the `Throwable` class has the `fillInStackTrace()` method.

```java
public synchronized Throwable fillInStackTrace() {
  if (stackTrace != null ||
    backtrace != null /* Out of protocol state */) {
    fillInStackTrace(0);
    stackTrace = UNASSIGNED_STACK;
  }
  return this;
}
```

> It is not filled immediately at this point. -
`private static final StackTraceElement[] UNASSIGNED_STACK = new StackTraceElement[0]`
> Similar to a Stream, it is filled and shown when needed (`getStackTrace()`, `printStackTrace`, etc.).

```java
static StackTraceElement[] of(Object x, int depth) {
  StackTraceElement[] stackTrace = new StackTraceElement[depth];
  for (int i = 0; i < depth; i++) {
    stackTrace[i] = new StackTraceElement();
  }

  // VM to fill in StackTraceElement  
  initStackTraceElements(stackTrace, x, depth);
  return of(stackTrace);
}
```

The VM does things like:
`identifying the thread where the exception occurred`, `tracing the frame pointer step` (going up the thread's call stack frame by frame), `looking up the line number`, etc.

Doesn't it look like a lot just by looking at it?

```
at java.base/java.util.ArrayList.forEach(ArrayList.java:1596)
at org.junit.platform.engine.support.hierarchical.SameThreadHierarchicalTestExecutorService.invokeAll(SameThreadHierarchicalTestExecutorService.java:41)
at org.junit.platform.engine.support.hierarchical.NodeTestTask.lambda$executeRecursively$6(NodeTestTask.java:155)
at org.junit.platform.engine.support.hierarchical.ThrowableCollector.execute(ThrowableCollector.java:73)
at org.junit.platform.engine.support.hierarchical.NodeTestTask.lambda$executeRecursively$8(NodeTestTask.java:141)
at org.junit.platform.engine.support.hierarchical.Node.around(Node.java:137)
at org.junit.platform.engine.support.hierarchical.NodeTestTask.lambda$executeRecursively$9(NodeTestTask.java:139)
at org.junit.platform.engine.support.hierarchical.ThrowableCollector.execute(ThrowableCollector.java:73)
at org.junit.platform.engine.support.hierarchical.NodeTestTask.executeRecursively(NodeTestTask.java:138)
at org.junit.platform.engine.support.hierarchical.NodeTestTask.execute(NodeTestTask.java:95)
```

(Showing all these elements doesn't happen like magic. 💣)

Ultimately, this operation occurs every time an exception is added to the stack.

### GC due to Stack Trace

The exception object and the collected `StackTraceElement` are immediately dereferenced and become GC targets.
-> The number of GC collections increases, and the overall responsiveness of the application decreases.

`01:10:27.252 [http-nio-8080-exec-9] [INFO ] [c.m.i.a.t.c.Controller] - StackTrace length: 234`
An exception that occurred in the Spring logic.

```java
public void validate() {
  option.validate();
}
```

What if an exception occurs in the validation part?
`01:10:27.252 [http-nio-8080-exec-9] [INFO ] [c.m.i.a.t.c.Controller] - StackTrace length: 234`
A huge stack trace is generated due to Spring AOP.

Let's go a little deeper.
Let's analyze the direct memory structure using `JOL (Java Object Layout)`.

The stack trace array has 960 bytes. (Estimated as 16 + 940 + 4 (padding) = 960)

`5c2129458        960 [Ljava.lang.StackTraceElement;     .stackTrace                    [(object), (object) ...]`

`5c212c3c8         48 java.lang.StackTraceElement        .stackTrace[187]               (object)`

A simple calculation shows that it occupies more than 960 + 48 * 234 = 12,192 bytes.

> They say the old Mario ran on 4KB...
> We can't even launch 4 exceptions lol

```
Deep size: 18536 bytes
Retained objects count: 300
```

JOL provides information like this.

Of course, even if one exception has already occurred and one more is added,

```
Deep size: 18592 bytes
Retained objects count: 301
```

it doesn't increase dramatically by about 56 bytes.

### Causing Performance Degradation

Since the occurrence of an exception is handled as a rare branch, the `normal path` can be predicted and the pipeline can be filled.
When an exception occurs, the prediction is wrong, and the pipeline must be flushed and refilled.
-> High cycle latency occurs.

The JIT compiler may exclude blocks with a high probability of exceptions from optimization targets.

## Throwing Dynamically

So, what are some ways to throw unnecessary exceptions even once more?

### Flag, Status

```java
public void validate(boolean isBusiness) {
  if (isBusiness) {
    throw new BusinessException("...");
  } else {
    throw new IllegalArgumentException("...");
  }
}
```

```java
public void validate(ExceptionStatus status) {
  switch (status) {
    case PRODUCTION -> ...
    case DEVELOP -> ...
    default -> ...
  }
}
```

In situations like `in what case, what exception is thrown`, `this rule is unlikely to change`, this kind of branching statement can make the code clearer.

-> However, most code cannot predict such changes and it will be difficult to guarantee.

### Reflection

It is also a way to pass a class from the outside without a flag so that it can be changed at any time.

```java
public void validate() {
  option.validateModelType(IllegalArgumentException.class);
}

default void validateModelType(Class<? extends RuntimeException> clazz) {
  if (getModelType().isInactive()) {
    throw createExceptionInstance(clazz,
      "Inactive model type. (modelType: %s)".formatted(getModelType()));`
  }
}
```

```java

@SuppressWarnings("unchecked")
static <E extends RuntimeException> E createExceptionInstance(
  Class<? extends Exception> exceptionType, String message) {
  try {
    return (E) exceptionType.getConstructor(String.class).newInstance(message);
  } catch (ReflectiveOperationException e) {
    throw new IllegalStateException(
      "Failed to create exception: " + exceptionType.getName(), e);
  }
}
```

The calling side passes the class, and it is created internally based on the class information.
If you don't want to use reflection every time,

```java
private static final Map<
  Class<? extends RuntimeException>,
  Function<String, ? extends RuntimeException>
  > EXCEPTION_FACTORIES = Map.of(IllegalArgumentException.class, IllegalArgumentException::new);
```

Putting it in a MAP in advance is also a way.

### Functional

The current code has many shortcomings.

`throw createExceptionInstance(clazz, "Inactive model type. (modelType: %s)".formatted(getModelType()));`

- First, you have to call a method. In particular, you call a static method.
- You pass the class information as a parameter.
- It requires operations such as using reflection or putting it in a MAP in advance.

These three problems can be solved elegantly with a functional approach. 😎

```java
/**
 * A functional interface that creates an exception by receiving a string.  
 * <p>  
 * Use this when you want to determine the exception to be created from the outside.  
 * (Even if you use the same validation logic, you can throw CustomException and IllegalArgumentException differently)  
 * * @param <E> A type that inherits from Exception  
 */
@FunctionalInterface
public interface ExceptionCreator<E extends Exception> {

  /**
   * Creates an exception using a message.  
   * <p>  
   * EX) imageToImageOption.validate(IllegalArgumentException::new);  
   *     * @param message The message to be used for the exception  
   * @return The created exception  
   */
  E create(String message);
}
```

If you create a functional interface that creates a functional type by receiving a string,

```java
public void validate(ExceptionCreator<? extends RuntimeException> exceptionCreator) {
  throw exceptionCreator.create(
    "Cannot process with an external request that does not exist in the enum. External request option: %s".formatted(externalApiOption));
}
```

You don't have to call a method, you create it yourself + you don't need to know the class information either.

```java
public void validate() {
  option.validate(InvalidInputException::new);
}

public void validate() {
  option.validate();
}
```

But, in the end, at some point,
you have to pass the `ExceptionCreator<? extends RuntimeException> exceptionCreator` parameter in a complicated way.

## Conclusion

If you need to write code quickly, you can simply convert it with a try-catch. If you want to consider cleaner code, you can make an appropriate judgment and choose.
Let's create a convention that team members can understand and be satisfied with.
