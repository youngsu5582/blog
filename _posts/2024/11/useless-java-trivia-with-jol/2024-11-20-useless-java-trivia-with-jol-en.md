---
title: "Useless Java Trivia with JOL"
author: 이영수
date: 2024-11-20T05:54:50.276Z
tags: ['JOL', 'Wooteco', 'Java', 'Java Trivia']
categories: ['Backend', 'Java']
description: "Warning: Absolutely useless knowledge"
image:
  path: https://velog.velcdn.com/images/dragonsu/post/85edba35-811b-4a32-9dd5-2753478f4af9/image.png
lang: en
permalink: /posts/useless-java-trivia-with-jol
---

> This post has been translated from Korean to English by Gemini CLI.

> Warning ⚠️
  These contents are truly irrelevant.
  However, as a Java developer, they will satisfy your minor curiosities.

It covers topics such as "How many bytes is an ENUM object?", "Does the size remain the same regardless of how member variables are declared?", and "How many bytes is Korean?"
The motivation for learning this was to question whether parts I used unconsciously were being optimized or wasted.
Let's start right away.

## How many bytes is an ENUM object?

To answer directly, an ENUM is 24 bytes.

>To confirm this, we use [JOL](https://mvnrepository.com/artifact/org.openjdk.jol/jol-core).
 JOL stands for Java Object Layout, and it is a library that tells you the structure and size of objects.

```java
public enum SampleEnum {  
    ONE, TWO, THREE  
}

final ClassLayout layout = ClassLayout.parseClass(SampleEnum.class);  
System.out.println(layout.toPrintable());
```

You can print it using `toPrintable` as above.

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

ENUMs basically have an order (ordinal) and a name.
And, because it's a 64-bit architecture, it adds 4 bytes for padding.

In conclusion, it becomes 24 bytes.

Then, what is the Object Header?

[Memory Layout of Objects in Java](https://www.baeldung.com/java-memory-layout)

I will explain the content in Korean.
First, `Object Header` is a space where the JVM stores **metadata** necessary for object management.
Let's look at `mark` first.

### Object Header : mark

1. Object Identity Hash Code

This is the address for JVM identification.
-> It is stored in the mark word because it does not change.
(If we don't override the `hashCode` method, the method also uses this.)

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

As you can see, it has the same address value.

2. Object Lock State

Adding 01 at the end means that the current object state is UnLocked.

```
Unlocked	01	State where hash code can be included
Lightweight Lock	00	When using lightweight lock
Heavyweight Lock	10	State where monitor lock is applied
Biased Lock	11	State where Biased Lock is activated
```

(By GPT)

### Object Header : class

Refers to the metadata of the class to which the object belongs (EX: `java.lang.class`).

- Used when the object calls a method, not just an instance.
-> Accesses the method table through Class Pointer.

- Static fields and methods also refer through Class Pointer.

Additionally, this Header is also called `Ordinary Object Pointers`.
It is currently 4 bytes, which means it is compressed through `UseCompressedOops`.

I will explain Oops later.

Thus, we can see that ENUMs are basically 24 bytes.
Additionally, any object will always start with at least 12 bytes 🙂

## Does the object size change depending on variable declaration?

To answer directly, no, it doesn't change.


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

As such, I tested by placing the large `long` at the bottom and top, and the result was:

```java
final ClassLayout sampleLayout = ClassLayout.parseClass(Sample.class);  
final ClassLayout reverseSampleLayout = ClassLayout.parseClass(RevereSample.class);  
assertThat(sampleLayout.fields()).isEqualTo(reverseSampleLayout.fields());
```

The fields were identical.

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

You can see that the output is also identical.

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

This also comes out the same, and if you print it?

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

As you can see, there are 3 bytes of internal padding and 4 bytes of external padding.
This means that reference type objects are allocated separately from other primitive type objects.

And, you can see that object references like `joyson.domain.InternalSampleOne SampleWithObject.internalSample` have 4 bytes.

### Oops

It is currently 4 bytes, which I said is compressed through `UseCompressedOops`.
This is because Java programs are run with less than 32GB of memory. (It is possible to point to all 32GB addresses with 4 bytes.)

```bash
java -Xmx31G -XX:+UnlockDiagnosticVMOptions -XX:+PrintFlagsFinal -version 2>/dev/null | grep 'UseCompressedOops'  
 
bool UseCompressedOops                        = true
```

```bash
java -Xmx32G -XX:+UnlockDiagnosticVMOptions -XX:+PrintFlagsFinal -version 2>/dev/null | grep 'UseCompressedOops'  

 bool UseCompressedOops                        = false
```

As such, if you enable it with more than 32GB, it automatically turns off.
If you disable compression and check again?

```
 32   8              joyson.domain.Sample SampleWithObject.sample           N/A
 40   8   joyson.domain.InternalSampleOne SampleWithObject.internalSample   N/A
```

Each becomes 8 bytes.

> Here, the `(object header: class)` that holds class information is 4 bytes.
> Class information is automatically compressed because it is not needed for more than 32GB.

In conclusion, Java optimizes according to size and reorders member variables regardless of their order.
If you want to go to the extreme, you can even analyze how many bytes are padded internally/externally 🙂.

## How many bytes is Korean?

This is not clear.
This is because it varies depending on UTF8, UTF16, and `endian` methods.

```java
private final String ascii = "a";  
private final String korean = "ㄱ";
```

If you have English and Korean like this?

```java
assertThat(ascii.getBytes().length).isEqualTo(1);  
assertThat(korean.getBytes().length).isEqualTo(3);
```

You get 1 and 3.

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

If there is no default Charset, it fetches UTF 8.
That is, 1 and 3 are based on UTF 8.

This time, let's fetch based on UTF 16.

```java
assertThat(ascii.getBytes(StandardCharsets.UTF_16)).hasSize(4);  
assertThat(korean.getBytes(StandardCharsets.UTF_16)).hasSize(4);
```

Both come out as 4.
If only UTF_16 is specified, `BOM` is added at the beginning of the string.

- BOM (Byte Order Mark): In UTF-16, it is added at the beginning of a string to distinguish the endianness of data.

```java
assertThat(ascii.getBytes(StandardCharsets.UTF_16BE)).hasSize(2);  
assertThat(korean.getBytes(StandardCharsets.UTF_16BE)).hasSize(2);  
  
assertThat(ascii.getBytes(StandardCharsets.UTF_16LE)).hasSize(2);  
assertThat(korean.getBytes(StandardCharsets.UTF_16LE)).hasSize(2);
```

If you specify endianness, it fetches 2 bytes.
(I'm not sure if optimization or anything is possible through this.)

## If you put 1, 5, 7, 3, 9 into HashMap, what is the forEach order?

```java
@Test  
@DisplayName("Values are stored in order.")  
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

You can see that the values are output in order like this.
The reason is in the internal implementation.
HASH_MAP has:

```java
transient Node<K,V>[] table;
```

It has an internal array called `table`.
What happens when you `put`?

```java
if ((p = tab[i = (n - 1) & hash]) == null)
```
Check if it's null and insert, or

```java
for (int binCount = 0; ; ++binCount) {  
    if ((e = p.next) == null) {  
        p.next = newNode(hash, key, value, null);  
        if (binCount >= TREEIFY_THRESHOLD - 1) // -1 for 1st  
            treeifyBin(tab, hash);  
        break;    }
```
Insert into the next value.
At this time, if the limit is exceeded, the tree is reconstructed.

Here, the initial value of `hash` is:

```java
static final int DEFAULT_INITIAL_CAPACITY = 1 << 4; // aka 16
```

It is set to 16.
That is, since it's `%16`, it feels like the values are sorted and inserted in order.

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

As such, you can see that values are added to the front through `%16`.

### HashSet?

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

HashSet is the same.
HashSet has an internal HashMap.

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

It simply puts the key into the Map and an empty value.

## Conclusion
These are truly useless knowledge.
However, by studying this, I learned the value of C.S knowledge and bytes that I had forgotten for a long time, so isn't it okay?

This content is in the [Curious Java Repository](https://github.com/youngsu5582/curious-java-study), so feel free to check it out if you're interested!





