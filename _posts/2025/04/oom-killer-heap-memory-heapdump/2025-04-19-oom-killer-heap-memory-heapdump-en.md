---
author: 이영수
date: 2025-04-19 17:32:24.832000+00:00
description: Through the Hello World project, I explored OOM Killer and memory management. I wrote code in Java to induce memory shortage, and also looked at the working principle of OOM Killer and how to set memory limits. In addition, I managed heap memory and experimented with various options related to GC. Through this, I realized the importance of memory problems in server development.
image:
  path: assets/img/thumbnail/2025-04-19-oom killer, heap memory, heapdump.png
tags:
- jvm
- oom-killer
- heamdump
title: oom killer, heap memory, heapdump
lang: en
permalink: /posts/oom-killer-heap-memory-heapdump/

---

> This post has been translated from Korean to English by Gemini CLI.

I'm organizing this on my blog after a long time because there was a part that I explored shallowly while working on the Hello World project.

## killed process in container

There is a logic below that intentionally causes an OOM.

```java
private final AtomicInteger counter = new AtomicInteger();  
private final Map<Integer, byte[]> map = new HashMap<>();  
  
@GetMapping("/oom")  
public ResponseEntity<Map<String, String>> causeOom() {  
    // 100MB  
    final var bytes = createSize(1024 * 1024 * 100);  
    map.put(counter.getAndIncrement(), bytes);  
    return ResponseEntity.ok(  
        Map.of(  
            "Total Memory", String.valueOf(Runtime.getRuntime().totalMemory()),  
            "Max Memory", String.valueOf(Runtime.getRuntime().maxMemory()),  
            "Free Memory", String.valueOf(Runtime.getRuntime().freeMemory()),  
            "Used Memory", String.valueOf(Runtime.getRuntime().totalMemory() - Runtime  
                .getRuntime().freeMemory())  
        )  
    );  
}
```

- 100MB is accumulated in the heap memory per request.
- It responds with memory-related metric information.

```yml
deploy:  
  resources:  
    limits:  
      memory: 2G
```

I intentionally limited the container's memory to 2G through the deploy settings.

`java -Dserver.port=8080 -Xmx2048m -Xmx2048m app.jar`

While trying to send 20 requests after starting the server with the above command,

the server died with `Killed`.

> Why is the application turning off, not the container dying..?

This kind of processing is done by an element called OOM Killer.
### OOM Killer

Containers limit the memory they can use through cgroup.
cgroup detects whether the memory specified at the operating system level has been reached (memory shortage situation).
→ If it has been reached, something called OOM Killer inside Linux kills the process.

> I don't like that it kills the server on its own.

There is a way to set it when configuring the container.

```
oom_kill_disable: true
oom_score_adj: -1000
```

You can disable the OOM Killer to prevent the process from being killed.

However, you should never do this.

→ The process that is occupying the full memory will not be terminated, so the container will actually stop.

`bash: start_pipeline: pgrp pipe: Too many open files in system`

appears and it does not process any requests (not only web requests, but all Linux commands, etc.).

```
nginx    | 172.18.0.1 - - [16/Apr/2025:04:08:53 +0000] "GET /actuator/prometheus HTTP/1.1" 499 0 "-" "Prometheus/2.45.1" "-"
nginx    | 2025/04/16 04:08:53 [crit] 30#30: accept4() failed (23: Too many open files in system)
nginx    | 2025/04/16 04:08:54 [alert] 30#30: epoll_ctl(1, 7) failed (12: Cannot allocate memory)
```

Therefore, you must set the Java maximum heap memory,
and you must also prevent the OOM Killer from destroying the process container (instance).

[Reference](https://blog.2dal.com/2017/03/27/docker-and-oom-killer/)

It checks as if it has allocated memory to the process, not actually allocating memory. - Memory Commit
-> A kind of Over Commit that allocates more than the memory can occur.

If the actually used memory is not over, a memory shortage error and kill may not occur.
(If it exceeds 100%, OOM-killer is used to secure it by killing the process under the condition)
## Xms and Commited Memory Correlation

When running the JVM, Xms and Xmx are options that determine the minimum and maximum amount of memory to occupy.

> The `X` option is a Non-Standard Option that performs macro-level tuning.

When the JVM feels that the currently allocated memory (Committed Memory) is insufficient,
it requests the OS to allocate additional physical pages.
-> If the allocation (Committed) fails, an OOM exception occurs.

Then, if the memory usage decreases, will the Committed Memory also decrease accordingly?

First of all, the answer is that the released memory also remains part of the heap.

![](https://i.imgur.com/muySY3X.png)

I had seen the content below, so I was always curious about `why it is not being returned continuously?`.

```
- G1 GC adjusts the heap size and returns the released memory to the OS. - JEP 346
- ZGC returns unused memory to the OS - JEP 351
```

The setting to return Committed Memory to the OS is disabled by default.
(As far as I have confirmed)

```
-XX:G1PeriodicGCInterval=5000 (5 seconds) etc. to trigger Idle GC periodically.
// The default is 0 (periodic GC is disabled, it is activated only when GC is judged to be necessary)
-XX:G1PeriodicGCSystemLoadThreshold=0 (set the load threshold related to the idle state)
// The default value is also 0 
-XX:G1PeriodicGCInvokesConcurrent (whether to proceed with Concurrent GC or Full GC)
// The default is false (FULL GC)
```

The reason for this is that returning memory by interacting with the OS after each release consumes a lot of CPU resources.

> In many production environments, it is important to maintain a constant heap size for application performance and predictable GC pauses.
> (There is a risk that periodic heap reduction will rather induce frequent GC and cause unnecessary GC pauses.)

`java -Xms512m -Xmx1024m -XX:G1PeriodicGCInterval=5000 -jar app.jar`

![](https://i.imgur.com/1JntkQy.png)

A periodic GC occurs and the committed memory is also reduced immediately.
(It is also returned immediately upon intentional GC calls such as System.gc)

> At this time, I intentionally caused an OOM and checked if the return was made properly.
> In other situations and settings, the content I have summarized may be different. (Check it yourself)

### Heap Dump

Since the Commited Memory did not decrease, I went down to the heap dump to see why.

> The Used Memory also didn't go down right away, so I did it anyway, but it went down after waiting. 🥲

> `jmap -dump:live` dump live will cause an explicit GC to occur and return Committed Memroy

`jmap -dump:live,format=b,file=heapdump.hprof <pid>`

`-dump`: command to take a dump
`live`: dump only live objects (perform GC and dump only live objects)
`format`: only supports binary
`file`: specify file name

If you take a heap dump and check it
(I checked with the elements provided by default in IDEA. - Profiler)

On the left side of the heap dump main screen,
there are elements called `Count, Shallow, Retained`.

![](https://i.imgur.com/YWGLzuQ.png)

- Count: Indicates how many instances of the class type exist
- Shallow: The memory size occupied by an individual object
  (The heap memory consumed by an object to store only itself - the entire size of the array)
- Retained: The total memory size that the object is holding
  (Assuming that the object is no longer referenced by the GC, the sum of the Shallow sizes of all objects that can be cleaned up together)

> `Node[]` is a bucket array instance, `Node` is a chained node

If you double-click the object you are curious about, the right screen will change.

![](https://i.imgur.com/GPHUxfx.png)

You can see which object dominates which element through Dominators.
(byte by Node, Node by Node`[]`, ...)

On the right side of the heap dump main screen, there is useful information such as `Biggest Objects`, `Summary`, and `Packages`.

- Biggest Objects: The largest object
- Summary: Information such as heap memory size and thread status
- Packages: Heap memory size occupied per package

```java
@GetMapping("/clear")  
public ResponseEntity<Map<String, String>> clear() {  
    map.clear();
    ...
}
```

If you clear the map and break the array reference?

![](https://i.imgur.com/pBoec0y.png)

The byte array in Map Value loses its retained size and becomes a GC target.

![](https://i.imgur.com/NoaImAL.png)

Over time, the used memory decreases.
(Committed Memory does not decrease X)

## Conclusion

In fact, it was an area that I didn't look at because I thought, `our server will never have an OOM`.
(Whether it's a side project or a simple team project, it's all from scratch anyway)

I didn't look at the heap dump in detail either, but while looking at it, I realized a little bit why I should look at the heap dump when there is a problem with the server.

- A certain library may be used to cause a bottleneck - [A story about JVM memory leak that might be helpful](https://techblog.woowahan.com/2628/)
- A certain logic is not processed quickly and moves on to FULL GC
- Identify the parent classes that have a certain class
- Whether the thread is BLOCKED

etc.

In the end, I think I need to slowly build up the foundation from the basics to become a great server developer.
