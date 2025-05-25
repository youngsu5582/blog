---
author: 이영수
date: 2025-05-25 15:32:24.832000+00:00
description: 최근 방어적 코드를 관리하기 위한 방법을 고민하며, 사용하지 않는 ENUM 값 처리에 대한 두 가지 접근법을 설명했다. 첫
  번째는 UNKNOWN 값을 추가해 기존 값을 유지하는 방법이고, 두 번째는 활성화 여부를 관리하는 방식이다. 각 접근법의 장단점을 살펴본 후,
  공통 검증 로직을 인터페이스와 default 메소드를 통해 효율적으로 관리하는 방안을 제시하며, 중복된 코드를 줄일 수 있음을 강조했다.
image:
  path: assets/img/thumbnail/2025-05-25-사용하지-않는-ENUM 값 대응,Interface-통한-중복-코드-제거.png
tags:
- java
- enum
- interface
title: 사용하지 않는 ENUM 값 대응 , Interface 를 통한 중복 코드 제거
---

최근 검증단의 중복 코드를 제거하기 위해서 고민하던 중 재밌는 방법이 있어서 가벼운 글을 작성해본다.

실무 코드를 짜며 느낀점은 다양한 경우를 생각해서 방어적 코드를 대응해야 한다는 것이였다.

- 사용자가 잘못된 값을 입력하는 경우
- 프론트가 잘못된 값을 전달하는 경우
- 더이상 사용하지 않는 값을 사용하는 경우

이런 방어적 코드 때문에
`SaveDto`, `UpdateDto`, `EntityDto` 등에서 검증 코드가 발생을 하게 된다.

이번 내용은 여기서 세번째 케이스 `더이상 사용하지 않는 값을 사용하는 경우` 에 초점이 맞혀져 있다.

## 사용하지 않는 ENUM 값

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

간단하게 이런 ENUM 이 있을때 `BARD` 라는 요소가 이제 사용이 되면 안된다고 가정해보자.

`BARD` 라는 요소를 삭제하는게 제일 깔끔하지 않나?
라고 생각할 수 있지만, 기존까지 저장된 엔티티를 불러올 때 예외가 발생한다.

2가지 선택지가 있다.

### 1. UNKNOWN

알 수 없는 값을 가져올 때 대응할 값을 추가하는 것이다.

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

> JsonCreator 는 값이 직렬화 될 객체의 일부이면, JsonCreator 선언

이와같이 기본값을 만들면 기존의 값을 삭제하더라도, 문제가 발생하지 않는다.

```java
@JsonValue  
public String getApiName() {  
    if(this == UNKNOWN){  
        return "";  
    }  
    return alias;  
}
```

하지만, 사용자는 불필요한 `UNKNOWN` 을 값을 받게 된다.
JsonValue 를 지정해 반환되는 문자열을 마스킹을 할 순 있다.

이 문제를 해결하기 위해선

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

와 같이 잘 사용하고 있던 코드가 래핑이 되면 해결은 가능하나,
전부 다 반영하면 변경 전파가 어마어마 할 수 있다.

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

사용하는 요소와 사용하지 않는 요소를 변수로 구분한다.
값을 가져와서 active 를 기반으로 판단해서 검증하면 된다.

당연히 코드를 삭제하지 않으므로 간편하고, 전파가 느껴지지 않는다.

하지만, 사용하지 않는 요소들이 계속해서 늘어나면?

- 불필요한 코드량 증가
- 코드를 사용하려 할 때 사용하지 않는 요소들이 IDEA 추천으로 뜨는 경우 존재

위의 문제점이 존재할 거 같다.

둘 중 데이터의 특성에 맞게 적절히 선택을 하면 된다.

- 데이터가 자주 활성화, 비활성화가 변경되는지
- 한번 삭제된 값이 다시 돌아올 가능성이 없는지

등등

> ENUM 을 없애고, 데이터 테이블을 만들순 있을거 같지만, 당장은 고려하지 않았다.
> ENUM 을 통해 사용하는 로직들이 존재하기 때문

## Validation

그러면 이렇게 사용하지 않는 값들이 생기면서 코드에는 방어적 코드들이 추가된다.

AiApiType 을 포함한 SaveDto, UpdateDto ...
AiApiType 을 가지고 있는 객체들 ...
AiApiType 을 사용하는 비즈니스 로직들

이 모든 곳에 validate 코드를 짜면

```java
void validateAiApiType() {  
    if(aiApiType == null){  
        throw new IllegalArgumentException("외부 API는 null 일 수 없습니다.");  
    }  
  
    if (aiApiType == AiApiType.UNKNOWN) {  
        throw new IllegalArgumentException("외부 API는 UNKNOWN 일 수 없습니다.");  
    }  
}
```

```java
void validateAiApiType() {  
    if (aiApiType.isInactive()) {  
        throw new IllegalArgumentException("비활성화된 API 타입입니다. (apiType: %s)".formatted(aiApiType));  
    }  
}
```

이런 코드가 다발적으로 늘어날 것이다.

![](https://i.imgur.com/WAVJCj3.png)

이때쯤 되면, IDEA 도 경고 해준다.

그렇다고, 이런 요소들을 사용하는 곳 전부를 생각해서 추상화 or 그룹화를 생각하기에는 너무 불필요한 작업일 것이다.

이 문제를 Lombok 의 `@Getter` 와 Interface 의 `default` 키워드를 통해 간편하게 해결할 수 있다.

```java
public interface AiApiTypeValidator {  
    AiApiType getAiApiType();  
  
    default void validateAiApiType() {  
        if (getAiApiType().isInactive()) {  
            throw new IllegalArgumentException("비활성화된 API 타입입니다. (AiApiType: %s)".formatted(getAiApiType()));  
        }  
    }  
}
```

AiApiType 을 가져오면? -> 그걸로 검증을 하는 메소드를 만들어두고

```java
@Getter
public class CreateImageOption implements ModelTypeValidator {
	private AiApiType aiApiType;

	...
}
```

필요한 클래스에서 인터페이스를 구현하고 + 변수를 선언하면

```java
public void validate() {  
    option.validateModelType();
}
```

default 메소드를 사용해 원하는 검증을 할 수 있다.

인터페이스를 사용해서

- 여러개를 `implements` 해도 상관없는 점
- 필요하다면, 오버라이딩 해서 다른 방법으로 검증해도 되는점 ( 특수 이미지는 무조건 모델타입이 고정 등등 )
- 해당 객체가 아닌 하위 객체가 가지고 있어도, getter 만 준수하면 검증을 사용할 수 있는 점

등이 큰 장점인거 같다.
결론적으로 해당 방법을 통해 ENUM 두개에서 24개의 중복 검증 코드가 방지됐다.

우테코를 할 때 default 메소드가 왜 나온지, 사용을 하는지에 대해 궁금함을 가졌었는데
어느정도 나마 궁금함을 해소한거 같다.

정답이 정해져있는게 아닌 그 순간 가장 깔끔한 코드를 유지하기 위해서 아닐까.
나만의 디자인 패턴.
