---
title: "알아도 정말 쓸데없는 자바 잡학사전 with JOL"
author: 이영수
date: 2024-11-20T05:54:50.276Z
tags: ['JOL', '우테코', '자바', '자바 잡학사전']
categories: ['백엔드', '자바']
description: 알아도 하나도 정말 쓸데없음 주의 
image:
  path: https://velog.velcdn.com/images/dragonsu/post/85edba35-811b-4a32-9dd5-2753478f4af9/image.png
lang: ko
permalink: /posts/useless-java-trivia-with-jol
---
> 주의 ⚠️
  해당 내용들은 정말 몰라도 하나도 상관이 없습니다.
  하지만, 자바 개발자로서 사소한 호기심은 충족시켜줄겁니다.

"ENUM 객체는 몇 바이트인가?" , "멤버 변수를 어떻게 선언해도 크기가 똑같은가?", "한글은 몇 바이트지?" 등등을 다룹니다.
학습을 하게 된 동기는 무심코 사용한 부분들도 최적화나 낭비가 되고 있지 않은가? 입니다.
바로 시작해보겠습니다.

## ENUM 객체는 몇 바이트인가?

정답부터 말하면, ENUM 은 24바이트 입니다.

>이를 확인하기 위해선 [JOL](https://mvnrepository.com/artifact/org.openjdk.jol/jol-core) 을 사용한합니다.
 Java Object Layout 의 약자로,  객체의 구조 및 크기를 알려주는 라이브러리입니다.

```java
public enum SampleEnum {  
    ONE, TWO, THREE  
}

final ClassLayout layout = ClassLayout.parseClass(SampleEnum.class);  
System.out.println(layout.toPrintable());
```

와 같이 `toPrintable` 을 통해 출력을 할 수 있습니다.

```java
joyson.SampleEnum object internals:
OFF  SZ               TYPE DESCRIPTION               VALUE
  0   8                    (object header: mark)     N/A
  8   4                    (object header: class)    N/A
 12   4                int Enum.ordinal              N/A
 16   4   java.lang.String Enum.name                 N/A
 20   4                    (object alignment gap)  
Instance size: 24 bytes
Space losses: 0 bytes internal + 4 bytes external = 4 bytes total
```

ENUM 은 기본적으로 순서(ordinal), 이름(name) 을 가지고 있습니다.
그리고, 64bit 단위 아키텍처 이기 때문에 4 바이트를 패딩으로 넣습니다.

결론적으로 24 바이트가 됩니다.

그러면 Obejct Header 는 뭘까요?

[Memory Layout of Objects in Java](https://www.baeldung.com/java-memory-layout)

해당 내용에 나와있는걸 한글로 설명하는 식으로 하겠습니다.
우선 `Object Header` 는 JVM이 객체 관리에 필요한 **메타데이터**를 저장하는 공간입니다.
mark 부터 살펴보겠습니다.

### Object Header : mark

1. 객체 아이덴티티 해시 코드

JVM 이 식별하기 위한 주소입니다.
-> 변하지 않으므로 mark word 에 저장합니다.
( 우리가 `hashCode` 메소드를 재정의 하지 않으면 메소드도 이를 사용합니다. )

```java
final LocalDate date = Extracter.extract(localDateTime, "date");

long identityHashCode = System.identityHashCode(date);
String hashInHex = String.format("0x%08x", identityHashCode);
String markWord = hashInHex.substring(2) + "01";  
System.out.println("Mark Word: " + markWord);

System.out.println(ClassLayout.parseInstance(date).toPrintable());
```

```
Mark Word: 043b9fd501
java.time.LocalDate object internals:
OFF  SZ    TYPE DESCRIPTION               VALUE
  0   8         (object header: mark)     0x000000 043b9fd501 (hash: 0x043b9fd5; age: 0)
...
```

와 같이 동일하게 주소값을 가지는걸 알 수 있습니다。

2. 객체 잠금 상태

뒤에 01을 붙이는 이유는 현재 객체 상태가 UnLocked 인걸 의미합니다.

```
Unlocked	01	해시 코드가 포함될 수 있는 상태
Lightweight Lock	00	경량 락을 사용할 때
Heavyweight Lock	10	모니터 락이 걸려 있는 상태
Biased Lock	11	Biased Lock이 활성화된 상태
```

( By GPT )

### Object Header : class

객체가 속한 클래스의 메타데이터( EX : `java.lang.class` ) 를 참조합니다.

- 객체가 단순 인스턴스가 아닌 메소드를 호출할 때 사용합니다.
-> Class Pointer 를 통해 메소드 테이블 접근

- 정적(static) 필드 및 메소드도 Class Pointer 를 통해 참조합니다.

추가적으로 이 Header 는 `Ordinary Object Pointers` 라고도 부릅니다.
현재 4바이트라고 되어 있는데 이는 `UseCompressedOops` 를 통해 압축되어 있습니다.

이 Oops 에 대해서는 차후 다시 설명하겠습니다.

이렇게 ENUM 은 기본적으로 24바이트가 된다는걸 알 수 있습니다.
추가로, 어떤 객체든 무조건 12 바이트는 가지고 시작하겠네요 🙂

## 변수 선언에 따라 객체 크기가 달라지는가

결론부터 말하면 달라지지 않습니다.


```java
public class Sample {  
    byte status;  
    int id;  
    long timestamp;  
}

public class RevereSample {  
    long timestamp;  
    int id;  
    byte status;  
}
```

이와같이 차지하는 크기가 큰 long 을 맨밑, 맨위에 올려놓고 테스트 해본결과

```java
final ClassLayout sampleLayout = ClassLayout.parseClass(Sample.class);  
final ClassLayout reverseSampleLayout = ClassLayout.parseClass(RevereSample.class);  
assertThat(sampleLayout.fields()).isEqualTo(reverseSampleLayout.fields());
```

필드가 동일하게 나왔으며

```java
joyson.domain.Sample object internals:
OFF  SZ   TYPE DESCRIPTION               VALUE
  0   8        (object header: mark)     N/A
  8   4        (object header: class)    N/A
 12   4    int Sample.id                 N/A
 16   8   long Sample.timestamp          N/A
 24   1   byte Sample.status             N/A
 25   7        (object alignment gap)    
Instance size: 32 bytes
Space losses: 0 bytes internal + 7 bytes external = 7 bytes total

=====

joyson.domain.RevereSample object internals:
OFF  SZ   TYPE DESCRIPTION               VALUE
  0   8        (object header: mark)     N/A
  8   4        (object header: class)    N/A
 12   4    int RevereSample.id           N/A
 16   8   long RevereSample.timestamp    N/A
 24   1   byte RevereSample.status       N/A
 25   7        (object alignment gap)    
Instance size: 32 bytes
Space losses: 0 bytes internal + 7 bytes external = 7 bytes total
```

출력도 동일한걸 볼 수 있습니다.

```java
public class SampleWithObject {  
    long l1;  
    private Sample sample;  
    private InternalSampleOne internalSample;  
    int i1;  
    private byte b1;  
}

public class RevereSampleWithObject {  
    private Sample sample;  
    private InternalSampleOne internalSample;  
    private byte b1;  
    int i1;  
    long l1;  
}
```

이 역시 동일하게 나오며, 출력을 해보면?

```
joyson.domain.SampleWithObject object internals:
OFF  SZ                              TYPE DESCRIPTION                       VALUE
  0   8                                   (object header: mark)             N/A
  8   4                                   (object header: class)            N/A
 12   4                               int SampleWithObject.i1               N/A
 16   8                              long SampleWithObject.l1               N/A
 24   1                              byte SampleWithObject.b1               N/A
 25   3                                   (alignment/padding gap)           
 28   4              joyson.domain.Sample SampleWithObject.sample           N/A
 32   4   joyson.domain.InternalSampleOne SampleWithObject.internalSample   N/A
 36   4                                   (object alignment gap)            
Instance size: 40 bytes
Space losses: 3 bytes internal + 4 bytes external = 7 bytes total
```

와 같이 내부 3바이트 발생, 외부 4바이트 발생을 볼 수 있습니다.
이는 참조형 객체는 다른 원시형 객체와 분리해서 할당을 합니다.

그리고, `joyson.domain.InternalSampleOne SampleWithObject.internalSample` 와 같이 객체 참조는 4바이트를 가지는걸 볼 수 있습니다.

### Oops

현재 4바이트라고 되어 있는데 이는 `UseCompressedOops` 를 통해 압축되어 있다고 말했습니다.
자바 프로그램을 메모리 32GB 보다 아래로 구동했기 때문인데요. ( 4바이트를 통해서도 32GB 의 모든 주소 가르키기 가능 )

```bash
java -Xmx31G -XX:+UnlockDiagnosticVMOptions -XX:+PrintFlagsFinal -version 2>/dev/null | grep 'UseCompressedOops'  
 
bool UseCompressedOops                        = true
```

```bash
java -Xmx32G -XX:+UnlockDiagnosticVMOptions -XX:+PrintFlagsFinal -version 2>/dev/null | grep 'UseCompressedOops'  

 bool UseCompressedOops                        = false
```

와 같이 32GB 이상으로 키면 자동으로 꺼집니다.
압축을 비활성화 하고 다시 확인해보면?

```
 32   8              joyson.domain.Sample SampleWithObject.sample           N/A
 40   8   joyson.domain.InternalSampleOne SampleWithObject.internalSample   N/A
```

각각 8바이트가 됩니다.

> 여기서 클래스 정보를 가지는 `(object header: class)` 는 4바이트입니다.
> 클래스 정보를 담을때는 32GB 이상까지 필요 없기 때문에 자동으로 압축

결론적으로 자바는 크기에 맞게 최적화 하여 멤버변수 순서에 상관없이 재정렬 해줍니다.
정말 극한까지 따지려면 내부/외부 적으로 패딩 되는 크기가 몇인지 까지 분석은 가능할 거 같네요 🙂.

## 한글은 몇 바이트?

이는 명확하지 않습니다.
이유는 UTF8, UTF16 그리고 `앤디언` 방식에 따라 달라지기 때문입니다.

```java
private final String ascii = "a";  
private final String korean = "ㄱ";
```

이와같이 영어와 한글이 있다고 하면?

```java
assertThat(ascii.getBytes().length).isEqualTo(1);  
assertThat(korean.getBytes().length).isEqualTo(3);
```

1과 3이 나오게 됩니다.

```java
public byte[] getBytes() {  
    return encode(Charset.defaultCharset(), coder(), value);  
}

public static Charset defaultCharset() {  
    if (defaultCharset == null) {  
        synchronized (Charset.class) {  
            String csn = GetPropertyAction  
                    .privilegedGetProperty("file.encoding");  
            Charset cs = lookup(csn);  
            if (cs != null)  
                defaultCharset = cs;  
            else                defaultCharset = sun.nio.cs.UTF_8.INSTANCE;  
        }  
    }  
    return defaultCharset;  
}
```

기본 Charset 이 없으면 UTF 8 을 가져옵니다.
즉, 1 과 3은 UTF 8 을 기준으로 합니다.

이번에는 UTF 16 을 기준으로 가져와보겠습니다.

```java
assertThat(ascii.getBytes(StandardCharsets.UTF_16)).hasSize(4);  
assertThat(korean.getBytes(StandardCharsets.UTF_16)).hasSize(4);
```

둘다 4가 나오게 됩니다.
UTF_16 만 지정하면 문자열의 시작에 `BOM` 라는게 추가됩니다.

- BOM(Byte Order Mark):  UTF-16에서는 데이터의 엔디안을 구분하기 위해 문자열의 시작에 추가되는 것

```java
assertThat(ascii.getBytes(StandardCharsets.UTF_16BE)).hasSize(2);  
assertThat(korean.getBytes(StandardCharsets.UTF_16BE)).hasSize(2);  
  
assertThat(ascii.getBytes(StandardCharsets.UTF_16LE)).hasSize(2);  
assertThat(korean.getBytes(StandardCharsets.UTF_16LE)).hasSize(2);
```

엔디안을 지정해주면 2바이트로 가져옵니다.
( 이를 통해 최적화나 뭔가가 가능한가? 라고 하면 잘 모르겠네요 )

## HashMap 에 1,5,7,3,9 와 같이 넣으면 forEach 순서는?

```java
@Test  
@DisplayName("순서대로 값이 저장된다.")  
void order_by_int_value() {  
    final Map<Integer, String> mp = new HashMap<>();  
    mp.put(3, "first");  
    mp.put(5, "second");  
    mp.put(1, "third");  
    mp.put(9, "fourth");  
    mp.put(7, "fifth");  
    mp.put(3, "sixth");  
    mp.put(15, "last");  
    assertThat(mp.keySet()).containsExactly(1, 3, 5, 7, 9, 15);  
}
```

이와 같이 순서대로 값이 출력되는걸 볼 수 있습니다.
이유는 내부 구현에 있습니다.
HASH_MAP 은

```java
transient Node<K,V>[] table;
```

내부에 table 이라는 배열을 가지고 있습니다.
`put` 을 하면?

```java
if ((p = tab[i = (n - 1) & hash]) == null)
```
null 인지 확인하고 넣거나

```java
for (int binCount = 0; ; ++binCount) {  
    if ((e = p.next) == null) {  
        p.next = newNode(hash, key, value, null);  
        if (binCount >= TREEIFY_THRESHOLD - 1) // -1 for 1st  
            treeifyBin(tab, hash);  
        break;    }
```
다음 값에 넣습니다.
이때, 한계치를 넘으면 트리를 재구성합니다.

여기서 `hash` 의 초기값이

```java
static final int DEFAULT_INITIAL_CAPACITY = 1 << 4; // aka 16
```

와 같이 16으로 지정되어 있습니다.
즉, `%16` 이므로 값이 순서대로 정렬되어 들어가는 것처럼 느껴지는 겁니다.

```java
final Map<Integer, String> mp = new HashMap<>();  
mp.put(3, "first");  
mp.put(5, "second");  
mp.put(1, "third");  
mp.put(17, "last");  
mp.put(33, "last");  
mp.put(49, "last");  
assertThat(mp.keySet()).containsExactly(1, 17, 33, 49, 3, 5);
```

이와같이 `%16` 을 통해 값이 앞에 추가되는걸 볼 수 있습니다.

### HashSet 은?

```java
final Set<Integer> set = new HashSet<>();  
set.add(3);  
set.add(5);  
set.add(1);  
set.add(17);  
set.add(33);  
set.add(49);  
assertThat(set.stream()).containsExactly(1, 17, 33, 49, 3, 5);
```

HashSet 도 이와 동일합니다.
HashSet 은 내부에 HashMap 을 가지고 있습니다.

```java
public class HashSet<E>  
    extends AbstractSet<E>  
    implements Set<E>, Cloneable, java.io.Serializable  
{
	private transient HashMap<E,Object> map;
	
	private static final Object PRESENT = new Object();
	
	...
	
	public boolean add(E e){
		...
		map.put(e, PRESENT);
	}
```

와 같이 Map 에 그냥 key 만 넣고, value 는 빈 값을 넣습니다.

## 결론
정말 쓸데없는 지식들입니다.
하지만, 이를 공부하며 오랫동안 까먹었던 C.S 지식 및 바이트의 소중함을 알게 됐으니까 오케이지 않을까요?

해당 내용은 [호기심-자바 저장소](https://github.com/youngsu5582/curious-java-study) 에 있으니 관심 있다면 구경해도 좋습니다!





