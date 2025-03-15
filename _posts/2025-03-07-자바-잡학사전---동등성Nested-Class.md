---
title: "자바 잡학사전 - 동등성,Nested Class"
author: 이영수
date: 2025-03-07T12:24:50.832Z
tags: ['우테코', '자바', '자바 잡학사전']
description: 1. Integer,String 의 동등성 2. Nested 클래스 3. JAR
image:
  path: https://velog.velcdn.com/images/dragonsu/post/15883aff-55e5-4c03-b284-911b77e317da/image.webp
---
> 아직까지도 명확하게 알지 못하는 거 같아서 직접 코드로 확인하며, 학습합니다. 🙂


## Integer,String 의 동등성

### `'=='`, `equals`

```java
int i1 = 1;  
Integer i2 = 1;  
Integer i3 = 1;  
Long i4 = 1L;
long i5 = 1L;

System.out.println(i1 == i2);  
System.out.println(i2 == i3);  
System.out.println(i2.equals(i3));  
System.out.println(i4.equals(i1));  
System.out.println(i1 == i4);  
System.out.println(i4.equals(i5));  
```

해당 로직 시 결과는?

```
true
true
true
false
true
true
```

`'=='` 비교는 두가지로 동작한다.
- 기본타입과 래퍼타입이 비교시 자동으로 래퍼타입을 언박싱해준다. ( 즉, 실제값을 비교 )
- 래퍼타입끼리 비교시 참조(메모리 주소)가 같은지 비교한다. 

여기서, `i2==i3` 가 true 인 이유는 Integer 는 캐싱을 통해 값을 관리하고 있으므로 동일하다고 판단한다.

`Integer i2 = 1;` 은 컴파일 하면, `Integer.valueOf(1)` 와 같이 자동으로 변환된다.

```java
public static Integer valueOf(int i) {  
    if (i >= IntegerCache.low && i <= IntegerCache.high)  
        return IntegerCache.cache[i + (-IntegerCache.low)];  
    return new Integer(i);  
}
```

```java
// IntegerCache
static final int low = -128;
static final int high = 128;
static final Integer[] cache;
```

와 같이 범위 내 값이면 캐시에 생성하고 리턴한다.

`equals` 비교도 두가지로 동작한다.
- 기본타입이면 자동으로 오토박싱을 해준다.

```java
System.out.println(var2.equals(Integer.valueOf(var1)));

public boolean equals(Object obj) {  
    if (obj instanceof Integer) {  
        return value == ((Integer)obj).intValue();  
    }  
    return false;  
}
```

> Integer 와 같은 숫자류는 Object를 extends 하는게 Number 를  extends 한다. ( Number 가 암시적으로 Object 를 상속 )

- 래퍼타입이면, Object에서 제공되는 `equals` 나 재정의된 `equals` 를 사용한다.

```java
* @implSpec
* Object 클래스의 equals 메서드는 객체들에 대해 가능한 가장 엄격한 동등 관계를 구현합니다.

* @apiNote
* equals 메서드를 오버라이드할 때는 일반적으로 hashCode 메서드도 함께 오버라이드해야 합니다.

public boolean equals(Object obj) {
    return (this == obj);
}
```

두 객체가 물리적으로 같은 객체인지(동일한 메모리 주소를 가리키는지), 즉 `'=='` 으로 구성되어있다.

```java
int i1 = 1;
Long i4 = 1l;

System.out.println(i4.equals(i1));  
System.out.println(i1 == i4);  
```

Long 과 int 를 비교해보면?

```java
System.out.println(var4.equals(Integer.valueOf(var1)));  
System.out.println((long)var1 == var4);
```

코드가 컴파일 될때, 자동으로 타입 변환 및 `Integer.valueOf` 로 박싱해준다.

```java
public boolean equals(Object obj) {  
    if (obj instanceof Long) {  
        return value == ((Long)obj).longValue();  
    }  
    return false;  
}
```

`instanceof`가 Long이 아니므로 false를 반환
`(long)1 == 1l` 이므로 true를 반환한다.

### Cache,Pool

```java
Integer i6 = Integer.valueOf(128);  
Integer i7 = Integer.valueOf(128);  
System.out.println(i6 == i7);  
System.out.println(i6.equals(i7));  
```

위는 false,true 가 나오는 이유도 캐시가 적용되지 못하기 때문에 주소가 다르되, 값은 동일하기 때문이다.

```
String s1 = "캐시";  
String s2 = "캐시";  
System.out.println(s1 == s2);
```

그러면, 숫자가 아닌 문자열에선 어떨까?
두개는 다른 객체이므로, false 가 나와야 하는거 아닌가?
-> 정답은 `true` 이다.

문자열은 위 Integer 와 비슷하게 JDK 내부에 String Buffer Pool이 존재한다.

![](https://i.imgur.com/dVzJWqo.png)

사진처럼이 끝이다. 대신, 주의해야할 점은 `new String(...)` 을 통해 객체 생성시 문자열 값이 저장되지 않는다.
한번 생성된 문자열 리터럴은 변경될 수 없기 때문이다. 따라서 효율적인 메모리 사용 및 매번 문자열을 생성하는 데 들어갈 시간을 절약하기 위해 존재한다.

이 값은 우선, 컴파일 때 Constant Pool 에 들어간다.

```
Constant pool:
...
	#7 = String             #8             // 인간-캐시
	#8 = Utf8               인간-캐시
```

클래스 로딩 시점에 이 값을 읽어서, 문자열 리터럴을 String Pool 에 intern 해준다.

`0: ldc #7 // String 캐시`
실행할떄 바이트코드는 String 값을 ldc 명령어로 String Pool 에서 가져온다.
( 여러번 리터럴을 선언해도 동일한 리터럴 가져옴 )

---

## Nested 클래스

해당 내용은 오라클 공식 문서에 이미 설명이 잘 되어있다.
[Nested Class](https://docs.oracle.com/javase/tutorial/java/javaOO/nested.html)

사용하는 이유로는

- 논리적 묶음 : 어떤 클래스가 한 곳에 쓰이면, 클래스 내부에 선언하면 패키지가 더 깔끔해진다.
- 캡슐화 강화 : 외부 클래스(A)와 긴밀히 협력하는 클래스(B)가 있을때, B가 A에 내부에 위치하면 A의 멤버를 private 으로 해도 접근 가능하다.
- 가독성, 유지보수 향상 : 작은 클래스를 상위 클래스 내부에 배치해, 코드가 "사용되는 위치 근처"에 놓이게 하여 이해가 쉬워진다.

```java
public class Human {  
    String name;
    
    static class StaticInner {  
        String name;  
  
        public StaticInner(final String name) {  
            this.name = name;  
        }  
    }  
  
    class Inner {  
        String name;  
  
        public Inner(final String name) {  
            this.name = name;  
        }  
    }  
}
```

```java
Human.StaticInner staticInner = new Human.StaticInner("스태틱 이너");  

Human human = new Human("인간");  
Human.Inner inner = human.new Inner("이너");  
```

Static 은 외부에서 생성 가능하며, Inner 는 `human` 을 통해 생성이 가능하다.

왜 사용하는지에 대해 궁금해서 찾아봤는데 [자바의 내부 클래스는 스프링 빈이 될 수 있을까?](https://www.youtube.com/watch?v=2G41JMLh05U) 에서 조금 힌트를 얻었다.

> 내부(Inner) 클래스는 말 그대로 정적 클래스가 될 수 없다.
> -> 중첩 클래스인데 정적 클래스로 만들어야 하는지가 맞는 질문

Static 클래스는 내부에 시켰지만, 외부에 탑 레벨 클래스로 위치시킨거나 똑같다.
-> Outer Class 와 의미적으로 굉장히 관여가 깊이 되어 있는 경우 붙인다.
( 패키지를 분리하는 이유의 반대로 접근 - 굉장히 관여가 깊이 되어있는 경우, Inner-Outer 가 밖에서는 별로 관심사가 아닐때 )
-> 가독성이 좋아진다.

- Static 클래스를 Private 으로 선언하기도 한다.
	-> 외부에서는 사용 못하게, 내부에서만 사용 가능하게 하기 위해 ( 간단하면, 토비도 내부에 넣는다고 한다. 어차피, 언제든 외부 분리 가능 )

Inner 클래스는 밖에 있는 클래스의 인스턴스가 없으면 생성을 할 수 없다.
`InnerClass innerClass = outerClass.new InnerClass();`

- Inner 클래스는 외부 클래스의 멤버 변수에 접근 가능하다.  ( Static 클래스는 당연히 접근 불가능 - 연관관계가 없으므로 )
- 외부 클래스가 GC 대상이 되면, 내부 클래스도 함께 처리된다.

> Outer  Class의 정보를 수집해 모니터링용 빈을 만들때 내부 클래스를 사용한다고 한다.

해당 클래스들은 javac 로 컴파일 시, 각각의 파일로 생성이된다. ( 즉, 클래스 로딩도 따로 된다. )

## JAR

Java Archieve 의 약자이다.
우리가 만든 자바 코드를 묶어서 실행을 할 수 있게 만들어준다.

```txt
Main-Class: joyson.jar.JarMain

```

실행이 되어야 하는 Main Class를 MENIFEST 에서 지정 가능하다.

> 런타임에 `Package` API로 해당 정보 읽을수 있음

`javac -d out/ src/main/java/joyson/jar/*.java` 해당 명령어를 통해 out 폴더에 컴파일
-> 
`jar cfm MyJar.jar src/main/java/joyson/jar/manifest.txt -C out .`

- c : create, 새로운 JAR 파일 생성
- f : file, 다음 인수를 JAR 파일 명으로 인식
- m : manifest, 매니패스트 파일을 사용한다는 의미 ( 관리파일 )
- -C : `out/` 디렉토리로 이동


`jar tvf MyJar.jar` 로 목록 조회

```
 0 Fri Mar 07 20:39:24 KST 2025 META-INF/
95 Fri Mar 07 20:39:24 KST 2025 META-INF/MANIFEST.MF
 0 Fri Mar 07 20:36:48 KST 2025 joyson/
 0 Fri Mar 07 20:36:48 KST 2025 joyson/jar/
500 Fri Mar 07 20:36:48 KST 2025 joyson/jar/JarMain.class
864 Fri Mar 07 20:36:48 KST 2025 joyson/jar/JarUtils.class
```

`jdeps MyJar.jar` 를 통해 JAR 파일의 의존성을 확인할 수 있다.

```
lotto.controller                                   -> lotto.service                                      spring-lotto-0.0.1-SNAPSHOT.jar
lotto.controller                                   -> lotto.service.dto                                  spring-lotto-0.0.1-SNAPSHOT.jar
lotto.controller                                   -> order.domain.vo                                    spring-lotto-0.0.1-SNAPSHOT.jar
lotto.controller                                   -> org.springframework.web.bind.annotation            not found
lotto.controller                                   -> purchase.domain                                    spring-lotto-0.0.1-SNAPSHOT.jar
```

자세하게 경로를 알려준다.
`jar tvf MyJar.jar` 으로 jar 파일 해제 ( `.class` 파일들로 풀어준다. )

다음에는 힙 덤프나 java 설정 관련으로 접근해봐야 겠다. ( 아직도 부족함을 느끼는 )