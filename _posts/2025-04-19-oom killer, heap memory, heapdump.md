---
author: 이영수
date: 2025-04-19 17:32:24.832000+00:00
description: 헬로우 월드 프로젝트를 통해 OOM Killer와 메모리 관리에 대해 탐구하였다. Java로 메모리 부족을 유발하는 코드를
  작성하고, OOM Killer의 작동 원리와 메모리 제한 설정 방법도 살펴보았다. 또한, 힙 메모리를 관리하며 GC와 관련된 다양한 옵션을 실험하였다.
  이를 통해 서버 개발시 메모리 문제의 중요성을 깨닫게 되었다.
image:
  path: assets/img/thumbnail/2025-04-19-oom killer, heap memory, heapdump.png
tags:
- jvm
- oom-killer
- heamdump
title: oom killer, heap memory, heapdump
---

헬로우 월드 프로젝트를 진행하며 얕게나마 탐구한 부분이 있어서 오랜만에 블로그에 정리한다.

## killed process in container

의도적으로 OOM 을 발생시키는 아래와 같은 로직이 있다.

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

- 한번 요청시, 100MB 씩 힙 메모리에 쌓인다.
- 메모리 관련 매트릭 정보를 응답한다.

```yml
deploy:  
  resources:  
    limits:  
      memory: 2G
```

deploy 설정을 통해 의도적으로 컨테이너의 메모리를 2G로 제한했다.

`java -Dserver.port=8080 -Xmx2048m -Xmx2048m app.jar`

로 서버를 실행시키고 20번을 요청을 보내려고 하던 도중

`Killed` 와 함께 서버가 죽었다.

> 컨테이너가 죽는게 아니고, 왜 애플리케이션이 꺼지지..?

이와같은 처리는 OOM Killer 라는 요소 때문에 동작한다.
### OOM Killer

컨테이너들은 cgroup 을 통해 사용할 수 있는 메모리를 제한한다.
cgroup 이 운영체제 레벨에서 지정된 메모리 까지 도달했는지 ( 메모리 부족 상황 ) 상황을 감지한다.
→ 도달했다면 Linux 내부에는 OOM Killer 라는게 프로세스를 죽인다.

> 서버를 자기 멋대로 killed 하는게 너무 별로 같은데?

컨테이너를 설정할때 설정할 수 있는 방법이 있다.

```
oom_kill_disable: true
oom_score_adj: -1000
```

프로세스가 죽지 않게 하기 위해 OOM Killer 를 Disable 을 할 순 있다.

하지만, 이렇게 하면 절대 안된다.

→ 메모리를 꽉 차지 하고 있는 프로세스가 종료되지 않으므로 컨테이너가 사실상 멈추게 된다.

`bash: start_pipeline: pgrp pipe: Too many open files in system`

와 같이 뜨고 모든 요청들을 처리하지 않는다. ( 웹 요청 뿐 아니라, 리눅스 커맨드 등등 전부 )

```
nginx    | 172.18.0.1 - - [16/Apr/2025:04:08:53 +0000] "GET /actuator/prometheus HTTP/1.1" 499 0 "-" "Prometheus/2.45.1" "-"
nginx    | 2025/04/16 04:08:53 [crit] 30#30: accept4() failed (23: Too many open files in system)
nginx    | 2025/04/16 04:08:54 [alert] 30#30: epoll_ctl(1, 7) failed (12: Cannot allocate memory)
```

그렇기에 무조건 Java 최대 힙 메모리도 걸고
만약에도 OOM Killer 를 통해서 프로세스가 컨테이너(인스턴스) 를 파괴하지 않게 해줘야 한다.

[참고](https://blog.2dal.com/2017/03/27/docker-and-oom-killer/)

실제 메모리를 할당해주는게 아닌 메모리를 프로세스에게 할당해준 것 처럼 체크한다. - Memory Commit
-> 메모리보다 더 많이 할당받는 일종의 Over Commit 이 발생할 수도 있다.

실제 사용하는 메모리를 over 하지 않으면 메모리 부족 에러 및 kill이 발생하지 않을수도 있다.
( 100% 넘기면 OOM-killer 사용해 조건의 프로세스 죽여서 확보 )
## Xms 와 Commited Memory 상관관계

JVM 을 구동할 때 Xms,Xmx 는 최소 점유할 / 최대 점유할 메모리의 양을 정하는 옵션이다.

> `X` 옵션은 Non-Standard Option으로 Macro 한 측면 튜닝을 한다.

JVM 은 현재 할당된 메모리(Committed Memory) 가 부족하다고 느끼면
OS에게 요청해서 물리 페이지를 추가로 할당받는다.
-> 할당(Committed)에 실패하면 OOM 예외가 발생하게 되는것

그러면 메모리 사용량이 감소하면, Committed Memory 도 이에 맞게 감소가 될까?

우선, 정답부터 말하면 해제된 메모리 역시도 힙의 일부로 남게 된다.

![](https://i.imgur.com/muySY3X.png)

아래와 같은 내용을 본적이 있어서 `왜 계속 반환이 안되는거지?` 라는 호기심이 계속 있었다.

```
- G1 GC 는 힙 사이즈를 조정하고 해제된 메모리를 OS에 반환한다. - JEP 346
- ZGC 는 사용하지 않는 메모리 OS에 반환 - JEP 351
```

Committed Memory 를 OS 에 return 하는 설정은 기본적으로 비활성화 되어있다.
( 내가 확인한 바로는 )

```
-XX:G1PeriodicGCInterval=5000 (5초) 등으로 설정하여 주기적으로 Idle GC를 트리거합니다.
// 기본은 0 ( 주기적 GC 비활성화, GC가 필요하다고 판단 될 때만 활성화 되게 )
-XX:G1PeriodicGCSystemLoadThreshold=0 (유휴 상태 관련 로드 임계값 설정)
// 기본값도 0 
-XX:G1PeriodicGCInvokesConcurrent (Concurrent GC로 진행할지, Full GC로 진행할지)
// 기본은 false ( FULL GC )
```

이와같은 이유는 매번 해제 후 OS와 상호작용 해 메모리 반환하는 게 CPU 자원을 많이 소모시키기 때문이다.

> 많은 프로덕션 환경에서는 애플리케이션 성능과 예측 가능한 GC pause를 위해
> 힙 크기를 일정하게 유지하는 것이 중요함
> (주기적 힙 축소가 오히려 자주 GC 유도하고 불필요한 GC Pause 발생시킬 위험이 존재한다. )

`java -Xms512m -Xmx1024m -XX:G1PeriodicGCInterval=5000 -jar app.jar`

![](https://i.imgur.com/1JntkQy.png)

주기적인 GC 가 일어나고 바로 committed memory 도 감소시킨다.
( System.gc 와 같이 의도적 GC 호출시에도 바로 반환 )

> 이때, 나는 의도적으로 OOM 을 발생시키고, 제대로 반환이루어 지는지를 확인한 것이다.
> 혹시나, 다른 상황 및 설정에선 내가 정리한 내용들과 다를 수 있다. ( 직접 확인 )

### Heap Dump

Commited Memory 가 감소하지 않길래 왜 그런지를 확인하기 위해 힙 덤프까지 내려갔다.

> Used Memory 도 바로 안 내려가길래 겸사겸사 한건데 기다리니 내려가더라. 🥲

> `jmap -dump:live` dump live 를 하면, 명시적 GC가 일어나 Committed Memroy 도 반환

`jmap -dump:live,format=b,file=heapdump.hprof <pid>`

`-dump` : dump 따라는 명령어
`live` : 살아있는 객체만 덤프 ( GC를 수행해 살아있는 객체만 덤프 )
`format` : 바이너리만 지원
`file` : 파일명 지정

힙덤프를 따서 확인해보면
( IDEA 에서 기본 제공된 요소들로 확인했다. - Profiler )

힙덤프 메인화면 좌측에는
`Count, Shallow, Retained`  라는 요소들이 있다.

![](https://i.imgur.com/YWGLzuQ.png)

- Count : 해당 클래스 타입 인스턴스가 몇 개 존재하는지 나탄냄
- Shallow : 개별 객체가 차지하는 메모리 크기
  ( 어떤 객체가 자기 자신만을 저장하기 위해소모하는 힙 메모리 - 배열 전체 크기 )
- Retained : 객체가 유지하고 있는 전체 메모리 크기
  ( 객체가 GC 로부터 더 이상 참조되지 않는다고 가정하면, 함께 정리할 수 있는 모든 객체 Shallow size 합 )

> `Node[]`는 버킷 배열 인스턴스, `Node` 는 체이닝된 노드

궁금한 객체를 더블클릭하면 우측 화면이 바뀐다.

![](https://i.imgur.com/GPHUxfx.png)

Dominators 를 통해 어떤 객체가 어떤 요소를 지배하는지 볼 수 있다.
( byte를 Node가, Node를 Node`[]`를 ...  )

힙덤프 메인화면 우측에는 `Biggest Objects`, `Summary`, `Packages` 등 유용한 정보들이 있다.

- Biggest Objects : 가장 큰 객체
- Summary : 힙 메모리 크기, 스레드 상태 등 정보
- Packages : 패키지당 힙 메모리 차지 크기

```java
@GetMapping("/clear")  
public ResponseEntity<Map<String, String>> clear() {  
    map.clear();
    ...
}
```

map 을 clear 해서 배열 참조를 끊으면?

![](https://i.imgur.com/pBoec0y.png)

Map Value 에 있는 byte 배열은 유지하는 크기가 사라져서 GC 대상이 된다.

![](https://i.imgur.com/NoaImAL.png)

시간이 지나면, 사용중인 ( Used ) 메모리가 감소한다.
( Committed Memory 는 감소 X )

## 결론

사실, `우리 서버는 절대 OOM 발생할 일 없어` 라고 생각해서 쳐다보지 않은 영역 이였다.
( 사이드 프로젝트건, 간단한 팀 프로젝트건 결국 처음부터 시작이니 )

힙 덤프 역시도 자세히 보지 않았는데 보면서 왜 서버에 문제가 나면 힙 덤프를 봐야하는지도 조금 깨달았다.

- 어떤 라이브러리를 사용해서 병목이 될 수 있음 - [도움이 될수도 있는 JVM memory leak 이야기](https://techblog.woowahan.com/2628/)
- 어떤 로직이 빨리 처리되지 못해 FULL GC로 넘어감
- 어떤 클래스를 가지고 있는 상위 클래스들 파악
- 스레드가 BLOCK 되는지

등등

결국, 멋진 서버 개발자가 되기 위해선 기초 돌다리부터 천천히 다져나가야 하는거 같다.