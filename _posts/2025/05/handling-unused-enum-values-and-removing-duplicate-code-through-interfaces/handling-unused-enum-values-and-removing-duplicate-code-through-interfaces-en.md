---
author: 이영수
date: 2025-05-25 15:32:24.832000+00:00
description: While recently considering ways to manage defensive code, I explained two approaches to handling unused ENUM values. The first is to add an UNKNOWN value to maintain existing values, and the second is to manage activation status. After examining the pros and cons of each approach, I proposed a plan to efficiently manage common validation logic through interfaces and default methods, emphasizing that duplicate code can be reduced.
image:
  path: assets/img/thumbnail/2025-05-25-사용하지-않는-ENUM 값 대응,Interface-통한-중복-코드-제거.png
tags:
- java
- enum
- interface
title: Handling Unused ENUM Values and Removing Duplicate Code Through Interfaces
permalink: /posts/handling-unused-enum-values-and-removing-duplicate-code-through-interfaces/
---

Recently, while thinking about how to remove duplicate code in the validation layer, I came across an interesting method, so I'm writing a light post about it.

What I learned while writing practical code was that I had to respond with defensive code, considering various cases.

- When a user enters an incorrect value
- When the frontend passes an incorrect value
- When a value that is no longer used is used

Because of this defensive code,
validation code is generated in `SaveDto`, `UpdateDto`, `EntityDto`, etc.

This post focuses on the third case, `when a value that is no longer used is used`.

## Unused ENUM Values

```java
public enum AiApiType {  
    OPEN_AI("openai"),  
    GEMINI("gemini"),  
    BARD("bard"),  
    GROK("grok");
    private final String name;  
  
    AiApiType(String name) {  
        this.name = name;  
    }  
}
```

Let's assume that when we have a simple ENUM like this, the `BARD` element should no longer be used.

Isn't it cleanest to just delete the `BARD` element?
You might think so, but an exception occurs when loading previously saved entities.

There are two options.

### 1. UNKNOWN

This is to add a value to handle when an unknown value is retrieved.

```java
public enum AiApiType {  
    OPEN_AI("openai"),  
    GEMINI("gemini"),  
    GROK("grok"),
    UNKNOWN("unknown")
    ;
    private final String name;  
  
    AiApiType(String name) {  
        this.name = name;  
    }  
}
```

```java
@JsonCreator  
public static AiApiType fromValue(String value) {  
    for (AiApiType type : AiApiType.values()) {  
        if (type.name.equals(value)) {  
            return type;  
        }  
    }
    return UNKNOWN;  
}
```

> If the value is part of the object to be serialized, declare `JsonCreator`.

If you create a default value like this, no problem will occur even if you delete the existing value.

```java
@JsonValue  
public String getApiName() {  
    if(this == UNKNOWN){  
        return "";  
    }  
    return alias;  
}
```

However, the user will receive an unnecessary `UNKNOWN` value.
You can mask the returned string by specifying `JsonValue`.

To solve this problem,

```java
public record AiApiTypeValue(  
    AiApiType apiType,  
    String value  
) {
    @JsonCreator  
    public static AiApiTypeValue of(String value) {  
        return new AiApiTypeValue(AiApiType.fromValue(value), value);  
    }

    @JsonValue  
    public String getApiTypeName() {  
        if (apiType == AiApiType.UNKNOWN) {  
            return value;  
        }  
        return apiType.name();  
    }
```

It can be solved by wrapping the code that was being used well, as shown above,
but if you reflect it all, the change propagation can be enormous.

### 2. active

```java
public enum AiApiType {  
    OPEN_AI("openai", true),  
    GEMINI("gemini", true),  
    BARD("bard", false),  
    GROK("grok", true);
    ...
    private final boolean active;
}
```

You distinguish between used and unused elements with a variable.
You can retrieve the value and validate it based on `active`.

Of course, since you are not deleting the code, it is simple and there is no sense of propagation.

However, what if the number of unused elements keeps increasing?

- Unnecessary code increase
- When trying to use the code, unused elements may appear in IDEA's recommendations.

I think the above problems will exist.

You can choose between the two appropriately according to the characteristics of the data.

- Whether the data is frequently activated and deactivated
- Whether there is a possibility that a once-deleted value will come back

and so on.

> I thought about getting rid of the ENUM and creating a data table, but I didn't consider it for now.
> This is because there are logics that use ENUM.

## Validation

Then, as these unused values are created, defensive code is added to the code.

`SaveDto`, `UpdateDto` including `AiApiType`...
Objects that have `AiApiType`...
Business logic that uses `AiApiType`

If you write validation code in all these places,

```java
void validateAiApiType() {  
    if(aiApiType == null){  
        throw new IllegalArgumentException("External API cannot be null.");  
    }  
  
    if (aiApiType == AiApiType.UNKNOWN) {  
        throw new IllegalArgumentException("External API cannot be UNKNOWN.");  
    }  
}
```

```java
void validateAiApiType() {  
    if (aiApiType.isInactive()) {  
        throw new IllegalArgumentException("Inactive API type. (apiType: %s)".formatted(aiApiType));  
    }  
}
```

This kind of code will increase in multiple places.

![](https://i.imgur.com/WAVJCj3.png)

By this time, IDEA will also give you a warning.

However, it would be too unnecessary to think about abstraction or grouping for all the places that use these elements.

This problem can be easily solved with Lombok's `@Getter` and the `default` keyword in an interface.

```java
public interface AiApiTypeValidator {  
    AiApiType getAiApiType();  
  
    default void validateAiApiType() {  
        if (getAiApiType().isInactive()) {  
            throw new IllegalArgumentException("Inactive API type. (AiApiType: %s)".formatted(getAiApiType()));  
        }  
    }  
}
```

If you get an `AiApiType`, you can create a method to validate it.

```java
@Getter
public class CreateImageOption implements ModelTypeValidator {
    private AiApiType aiApiType;

    ...
}
```

If you implement the interface in the required class + declare a variable,

```java
public void validate() {  
    option.validateModelType();
}
```

You can use the `default` method to perform the desired validation.

By using an interface,

- It doesn't matter if you `implements` multiple interfaces.
- If necessary, you can override it and validate it in a different way (e.g., the model type for a special image is always fixed).
- Even if a child object has it instead of the object itself, you can use the validation as long as you adhere to the getter.

These seem to be the big advantages.
In conclusion, this method prevented 24 duplicate validation codes in two ENUMs.

When I was at Woowacourse, I was curious about why the `default` method came out and how it was used.
I think I have resolved my curiosity to some extent.

I don't think there is a fixed answer, but isn't it to maintain the cleanest code at that moment?
My own design pattern.
