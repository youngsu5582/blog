---
title: "스레드,스레드풀 in Java"
author: 이영수
date: 2025-01-17T03:02:53.648Z
tags: ['스레드', '스레드풀', '우테코']
categories: ['백엔드', '자바']
description: 왜 여러개의 스레드 풀이 하나의 스레드 풀보다 좋은가
image:
  path: https://velog.velcdn.com/images/dragonsu/post/79c55bba-2e1b-42ca-a175-773ff9480ae6/image.jpeg
permalink: /posts/thread-threadpool-in-java/
lang: ko
---
>  해당 내용은 `왜 여러개의 스레드 풀이 필요한가?` 를 고민하며 다룬 내용입니다.
실제 테스트를 하며 작성한 내용이라 틀린 부분이 있을수 있습니다.
틀린 부분이 있다면 `joyson5582@gmail.com` 이나 댓글로 남겨주세요 🙂 
 
> 자바에서 스레드와 스레드풀을 정리하기 전
O.S 에서 스레드는 어떻게 동작을 하는지 알아보고 시작을 한다.
그래야, 자바에서 어떻게 현명하게 스레드와 스레드풀을 관리 및 사용할지 알기 쉽기 떄문이다.

> 개념에 대한 자세한 내용 및 설명은 다루지 않습니다.

# 스레드 in O.S

흔히 자주 들어봤을것이다.
스레드는 프로세스 내 존재하는 일꾼들
그러면 이 스레드가 어떻게 우리의 프로그램 내에서 잘 동작할까


## 하드웨어 스레드

컴퓨터는 코어를 가지고 있다.
이 코어는 프로그램의 명령어를 처리하고 계산을 수행하는 역할을 한다.
코어는 4개,8개 16개 등 매우 적은 숫자이므로 매우매우 빠르게 효율적으로 처리가 되어야 한다.

코어의 고민 : 메모리에서 데이터를 기다리는 시간이 꽤 오래 걸린다.
( 메모리와 관련된 작업을 하는동안 코어가 쉬게되므로 )

-> 메모리에 접근하는 공간마다 다른 작업을 수행하게 하자!
=> 서로 다른 스레드를 실행해 시간을 낭비하지 않게 하자.

이게 하드웨어 스레드이다.

#### -threading in Intel : 물리적인 코어마다 하드웨어 스레드가 두개 배치

- O.S 관점에서 가상의 코어
> 싱글 코어 CPU 에 하드웨어 스레드가 두개라면?
> -> O.S 는 이 CPU 를 듀얼 코어로 인식해 듀얼 코어에 맞게 O.S 레벨 스레드 스케줄링을 한다.


## 커널, O.S 스레드

### 커널이란?

운영체제의 핵심이다.
리눅스에 한정되는게 아닌 윈도우,IOS,리눅스 등 모두에게 적용되는 용어이다.

- 시스템 전반을 관리 / 감독하는 역할
- 하드웨어와 관련된 작업을 직접 수행

( 하단 `유저 스레드` 부분에서 커널이 왜 필요한지 조금 더 설명한다. )

### O.S 스레드

커널 레벨에서 생성되고 관리되는 스레드
( CPU 에서 실제 실행되는 단위, CPU 스케줄링의 단위가 O.S 스레드 )

- O.S 스레드 컨텍스트 스위칭은 커널이 개입한다 -> 비용 발생
- 사용자 코드, 커널 코드 모두 O.S 스레드 단 실행

우리가 작성한 코드에서, `System Call` 같은 요소들을 사용하면?
-> 커널 코드를 OS Thread 가 실행한다.
-> 다시 유저 모드로 돌아와서, 우리가 작성한 코드가 실행된다.

> 아래와 같이 불리기도 한다.
> 네티이브 스레드
> 커널 스레드 ( 맥락에 따라 다른 의미로 사용될 수 있다. O.S 커널의 역할을 수행하는 스레드 )
> 커널-레벨 스레드
> OS-레벨 스레드

### 유저 스레드

`User Program` 과 관련 ( Java, Python, Go... )
`유저-레벨 스레드` 라고 불린다.

스레드 개념을 프로그래밍 레벨에서 추상화한 것이다.

```java
Thread thread = new Thread();
thread.start();
```

와 같이, 프로그래밍 언어에서 제공해준다.
`thread.start` 를 좀 더 살펴보면

```java
public synchronized void start() {
        if (threadStatus != 0)
            throw new IllegalThreadStateException();

        group.add(this);

        boolean started = false;
        try {
            start0();
            started = true;
        } finally {
            try {
                if (!started) {
                    group.threadStartFailed(this);
                }
            } catch (Throwable ignore) {
            }
        }
    }
    
private native void start0();
```

start0은 JNI 를 통해 O.S 의 System Call 을 호출한다.
-> Clone 이라는 시스템을 호출해 O.S 레벨의 스레드를 하나 생성 ( in Linux )
-> O.S 레벨 스레드가 자바의 유저 스레드와 연결이 된다.
- 유저 스레드가 CPU 에서 실행 되려면, O.S 스레드와 반드시 연결이 되어야 한다. ( 아래 Model 에서 좀 더 설명 )

> System Call 을 호출하면
> User Mode -> Kernel Mode 로 전환된다.
> 1. 프로그램 현재 CPU 상태 저장
> 2. 커널이 인터럽트나 시스템 콜 직접 처리 ( CPU 가 커널 코드 실행 )
> 3. 처리가 완료되면 중단된 프로그램의 CPU 상태 복원
> 통제권을 반환해 Kernel Mode -> User Mode 로 전환된다.

> 시스템 전반적인 부분을 보호하기 위해
> ( 하드웨어 함부로 정의 및 전체 시스템 붕괴 등을 불러올 수 있으므로 )

- Interrupt : 시스템에서 발생한 다양한 종류 이벤트 혹은 이벤트 알려주는 메커니즘

I/O 작업 완료, 시간이 다 됐을 때(time), 0으로 나눌 때, 잘못된 메모리 공간 접근 등등 ( Java 에선, `InterruptedException` 이 존재한다. )
-> CPU 가 즉각적으로 인터럽트 처리 위해 커널 코드를 커널 모드에서 실행한다.

- System Call : 프로그램이 OS 커널이 제공하는 서비스 이용하고 싶을 때 사용

프로세스/스레드, 파일 I/O, 소켓 관련, 프로세스 통신 관련 등을 할 때 호출한다.
호출이 되면, 해당 커널 코드를 커널 모드에서 실행한다.

>CASE : 파일 READ 작업
>파일 읽기 작업을 수행하는 t1, 다른 작업 수행하는 t2 가정
>
>t1 이 Read 라는 System Call 을 호출해 커널 모드 진입한다.
>- 파일 읽을 때 까지 WAITING 상태로 바꾼다.
>- CPU 가 스케줄링을 통해 t2 를 READY -> RUNNING 으로 바꿔 작동하게 한다.
>커널 모드에서 유저 모드로 전환이 된다.
>
>t2 가 작업을 수행하는 도중, SSD(File System) 가 파일을 준비했다는 Interrupt 를 발생시킨다.
  Interrupt 를 처리하기 위해 커널 모드로 바꾼다. ( 기존 작업중인 t2 CPU 저장 )
>- t1 을 WAITING -> READY 으로 바꾼다.
>t2 CPU 를 복원하고, 다시 작업을 처리한다.
>
>Time Slice 를 통해 타어미가 주어진 시간을 다 썼다는 Interrupt 를 발생시킨다. 
>Interrupt 를 처리하기 위해 커널 모드로 바꾼다. ( 기존 작업중인 t2 CPU 저장 )
>- t1 이 READY -> RUNNING 상태가 된다.
>- t2 는 READY 상태가 된다.

그러면 이런 유저 스레드는 어떻게 처리되고, 관리가 될까?
이는 프로그래밍 언어가 설계한 방법에 따라 다르다.
이를 `... Model` 이라고 한다.
#### One-To-One Model

자바에서 사용하는 방법이다. ( 그러므로, O.S 스레드와 무조건 연결이 되어 있어야 한다고 설명한 것 )
스레드 관리를 O.S 에 위임, 스케줄링도 커널이 수행한다.
O.S가 처리하므로 멀티코어도 잘 활용한다.

- 하나의 스레드가 BLOCK 이 되어도 다른 스레드들은 잘 동작한다. ( 1:1 관계이므로 )
-> Race Condition 이 발생할 순 있다.

#### Many-To-One Model

유저 스레드 N개 : O.S 스레드 1개
코루틴과 연관있다. - 코루틴이 Many-To-One Model 은 아니나, 그렇게 사용될 수 있다.

- 컨텍스트 스위칭이 더 빠름 ( 커널이 개입 X, 애플리케이션 단에서 스위칭 처리 )
- O.S 레벨에서 Race Condition 이 발생할 가능성이 거의 없다. ( 유저 레벨에서 발생 )
- 멀티코어는 활용 못함 ( 하나만 활성화 되어 있는 상태이므로 )
- O.S 스레드가 블락 되면, 모든 유저 스레드가 블락 된다. ( Non Blocking IO 가 나오게 된 이유 )

#### Many-To-Many Model

유저 스레드 N개 : O.S 스레드 N개

- 위 두가지 모델의 장점을 합쳐서 만든 모델
- O.S 스레드가 블락 되어도, 다른 O.S 스레드가 처리한다.
- 구현이 복잡하다. ( Go가 지원 )

#### 그린 스레드?

Java 초창기 버전에서 `Many-To-One` 스레딩 모델 사용했다고 한다.
이때, 유저 스레드들을 `그린 스레드` 라고 호칭했다.

계속 확장되어, 현재는 `OS 와 독립적으로 유저 레벨에서  스케줄링되는 스레드` 의 의미로도 사용된다.
참고만 하면 될 것 같다.

### 멀티태스킹 ⭐️

>해당 부분은 계속해서 중요하다.
왜, 스레드 풀이란게 필요한지에 대한 근본적인 접근일 수 있기 때문이다.

CPU는 한 번에 하나의 프로세스 혹은 스레드만 실행될 수 있다는 제약이 있다. ( 우선, 싱글스레드로 가정 )
-> 멀티태스킹을 통해 해결한다.

아주 짧은 CPU 시간을 할당해 주고, 시간 다 사용하면 다음 스레드가 실행되게 하는 방식
( t1 -> t2 -> t3 -> t1 -> t2 -> ... )

동일하게 부여되는 CPU 시간을 `time slice` or `quantum` ( 몇 ~ 몇십 ms )

이 slice 는 고정이 아니다!

고정된 slice 라면?
-> 동시, 실행된 스레드 수가 늘어날수록 스레드가 실행되고 다시 자기 차례 올때가지 대기하는 시간이 길어진다.
=> 동시 실행되는 스레드 수에 따라 `time slice` 를 조정한다. ( CFS 스케줄러 )

> 현재, 리눅스 6.6 부터 `eevdf` 라는 스케줄러로 교체가 되었다고 한다.
> https://www.reddit.com/r/linux_gaming/comments/17rohqp/linux_66_with_eevdf_the_new_cpu_scheduler_gaming/
> CFS 는 공정성 중점, EEVDF 는 지연 시간 고려
> -> 복잡성을 제거하고, 지연 시간을 낮춘다.
> 해당 내용은 CFS 를 기반으로 설명한다. ( 큰 맥락 및 자바 - 스레드 풀 관점에서 깊게 다룰 내용은 아니므로 )

- target latency : 작업이 CPU 할당받는 목표 시간
- time slice : 작업이 진행되는 시간 ( Context Switching 이 일어나는 간격 )

20ms + 작업 개수 4개 => time slice 는 5ms

스레드 수가 많아질수록 컨텍스트 스위칭이 빈번하게 일어난다.
추가로, `공유 자원` 에 대한 동기화가 필연적으로 발생하게 된다.

그러면 스레드가 많아질수록 안좋다는 건 알겠는데 이게 애플리케이션 단까지 적용이 될까?
이제 `스레드 in Java` 를 시작한다.


# 스레드 in Java

자바에서 스레드는 위에서 말한 것처럼 운영체제 단 스레드와 1:1 매핑된다. ( 운영 체제 스레드의 Wrapper )

> `Virtual Thread` 관점에서 다루지 않는다.
> ( 아직, `캐리어 스레드` 단 피닝 발생 이슈 및 다양한 유스케이스가 없기 때문에 )

그래서 Java 는 아래와 같은 특징을 가진다.

- 스레드를 무제한 생성하면, 리소스가 매우 빠르게 고갈된다. - 운영체제의 리소스를 사용하므로
- 생성 및 소멸이 오래 걸린다. - 운영체제 수준의 관리작업이 필요하므로
- I/O 작업을 만나면 블로킹 된다. - Interrupt 호출

그러므로, `스레드를 무제한 생성하지 않기 위해` + `계속 생성 및 삭제` 하지 않기 위해 스레드 풀이 필요하게 된다. 

## 스레드 - 스레드 풀

스레드 풀(Pool)은 정말 말 그대로 스레드 연못이다.
스레드를 미리 생성해두고, 사용할때 하나씩 꺼내 사용하게 해준다.
자바에서는 스레드 풀을 어떻게 동작시킬까?

> `ThreadPoolExecutor` 과 `AbstractExecutorService` 를 기반으로 설명한다.

스레드 풀은 아래 단계로 동작한다.

1. Task Submitter 가 작업을 Thread Pool 에 전달한다. - AbstractExecutorService.submit
2. 전달받은 작업은 Thread Pool 의 Queue 에 순차적 저장 - `workQueue.offer`
3. 유후 Thread 가 존재하면, Queue 에서 작업을 꺼내 처리한다. - `ThreadPoolExecutor.getTask`
4. 만약 유후 Thread가 존재하지 않으면, Queue에서 처리할 때 까지 대기
5. 작업 마친 Thread 는 Queue 에서 새로운 작업 도착할 때까지 대기

코드로 좀 더 살펴보자.

```java
// AbstractExecutorService.submit

public <T> Future<T> submit(Runnable task, T result) {  
    if (task == null) throw new NullPointerException();  
    RunnableFuture<T> ftask = newTaskFor(task, result);  
    execute(ftask);  
    return ftask;  
}
```


```java
// ThreadPoolExecutor.execute

public void execute(Runnable command) {  
    int c = ctl.get();  
	if (workerCountOf(c) < corePoolSize) {  
	    if (addWorker(command, true))  
	        return;  
	    c = ctl.get();  
	}
	
	if (isRunning(c) && workQueue.offer(command)) {  
	    int recheck = ctl.get();  
	    if (! isRunning(recheck) && remove(command))  
	        reject(command);  
	    else if (workerCountOf(recheck) == 0)  
	        addWorker(null, false);  
	}  
	else if (!addWorker(command, false))  
	    reject(command);
}
```

- 워커 스레드 개수가 코어보다 작다면?
-> 워커스레드를 추가한다.

- 현재 스레드풀이`RUNNING` 이며 && 작업대기열에 제공이 성공했다면?
-> 다시 확인결과, `RUNNING` 이 아니며 && 작업 대기열 제거가 성공하면? - 거절한다.
-> 워커스레드 개수가 0이라면? - 워커스레드 추가한다.

- 워커스레드 추가를 실패하면? - 거절한다.

```java
// ThreadPoolExecutor.addWorker

private boolean addWorker(Runnable firstTask, boolean core) {
	Worker w = null;  
	try {  
	    w = new Worker(firstTask);  
	    final Thread t = w.thread;
	    if (t != null) {  
		    final ReentrantLock mainLock = this.mainLock;  
		    mainLock.lock();
		    try {
			    ...
			    workers.add(w);  
				workerAdded = true;
				}
			} finally {  
			    mainLock.unlock();  
			}  
			if (workerAdded) {  
			    t.start();  
			    workerStarted = true;  
			}
			...
	return workerStarted;
```

```java
 // ThreadPoolExecutor.Worker
 
private final class Worker  
    extends AbstractQueuedSynchronizer  
    implements Runnable  
{
	Worker(Runnable firstTask) {  
	    setState(-1); // inhibit interrupts until runWorker  
	    this.firstTask = firstTask;  
	    this.thread = getThreadFactory().newThread(this);  
	}
	
	public void run() {  
	    runWorker(this);  
	}
}

private volatile ThreadFactory threadFactory;
```

1. ThreadFactory 에서 스레드를 생성해서 워커를 지정한다.
2. `ReentrantLock` 을 통해 Lock 을 건다.
3. 워커큐에 추가한다.
4. 추가되면, 워커 스레드가 시작된다. - ( 1. `t.start()` 2. `Worker.run` 3. `ThreadPoolExecutor.runWorker` )

```java
// ThreadPoolExecutor.runWorker
final void runWorker(Worker w) {
        Thread wt = Thread.currentThread();
        Runnable task = w.firstTask;
        w.firstTask = null;
        w.unlock(); // allow interrupts
        boolean completedAbruptly = true;
        try {
            while (task != null || (task = getTask()) != null) {
	            w.lock();
                try {
                    beforeExecute(wt, task);
                    try {
                        task.run();
                        afterExecute(task, null);
                    } catch (Throwable ex) {
                        afterExecute(task, ex);
                        throw ex;
                    }
                } finally {
                    task = null;
                    w.completedTasks++;
                    w.unlock();
                }
            }
            completedAbruptly = false;
        } finally {
            processWorkerExit(w, completedAbruptly);
        }
    }
```

태스크를 받아와 수행한다.
`firstTask` 또는 `getTask()` 를 통해 작업을 가져와서 실행한다.
 (`getTask()` 부분은 Interface 형식으로 되어있다. )
이렇게 스레드 풀이 계속해서 Task 를 가져와서 작업을 수행해주는 건 알겠다.

그러면, 스레드 풀을 사용하고 사용하지 않는 것은 얼마나 차이가 날까?

## 스레드 풀 성능 비교
코드는 [이를](https://github.com/youngsu5582/curious-java-study/tree/6ff099cf4356816cb1c9bc9eb601d18d7b50769f/src/main/java/joyson/threadpool) 참고한다.
작업들이 같이 묶여있어도 하나씩 직접 실행해서 측정을 했다. ( 매우 반복적인 노가다... )

> 맥북에서 활성 상태 보기 - 프로세스 더블 클릭 - 통계 - 문맥 전환
> 을 통해 확인할 수 있다. ( Linux 에서는 [perf](https://kernel.bz/boardPost/118679/8) 라는 도구가 있다. )

> 본인의 맥북은 m2 에어이며, 8코어이다. 메모리는 16GB - 성능 사양상 참고

### CPU Intensive

```java
static class CpuMemoryIntensiveTask implements Runnable {  
    private static final int DATA_SIZE = 10_000; // 10KB 메모리  
    private static final int ITERATIONS = 9000000; // 반복 횟수  
    private static final Random RANDOM = new Random();

		@Override  
	public void run() {  
	    int[] data = new int[DATA_SIZE]; // 10KB 배열 생성  
	  
	    // 배열에 랜덤값 저장  
	    for (int i = 0; i < DATA_SIZE; i++) {  
	        data[i] = RANDOM.nextInt();  
	    }  
	  
	    // 랜덤 메모리 접근 작업  
	    for (int i = 0; i < ITERATIONS; i++) {  
	        int index = RANDOM.nextInt(DATA_SIZE);  
	        data[index] = (int) (data[index] + Math.tan(data[index]));  
	    }  
	}
}
```

큰 메모리 + RANDOM ACCESS
-> 메모리 캐시를 계속 지워야 한다.
-> CPU 작업량이 증가한다.

이로 인해 우리는 CPU Intensive 한 작업일 때 성능 비교를 할 수 있다.

```
runWithThreadPool(4, 10); // 스레드 풀 사용  
runWithoutThreadPool(10); // 스레드 풀 없이 직접 생성

Execution Time (ThreadPool): 7799 ms
Execution Time (Without ThreadPool): 19487 ms
```

```
Execution Time (ThreadPool): 15250 ms
Execution Time (Without ThreadPool): 32587 ms
```

스레드 풀없이 작업하는게 시간이 더 오래 걸린다.

```
pool-1-thread-3 running start : taskId : 4time : 1736945552855
pool-1-thread-1 finished : taskId : 0time : 1736945552869
pool-1-thread-1 running start : taskId : 5time : 1736945552869
pool-1-thread-2 finished : taskId : 1time : 1736945552888
pool-1-thread-2 running start : taskId : 6time : 1736945552888
```

```
Thread-4 running start : taskId : 4time : 1736945565048
Thread-5 running start : taskId : 5time : 1736945565048
Thread-6 running start : taskId : 6time : 1736945565048
Thread-7 running start : taskId : 7time : 1736945565051
Thread-8 running start : taskId : 8time : 1736945565060
Thread-9 running start : taskId : 9time : 1736945565078
...
```

스레드 풀 없이 동작하는 로직은 거의 동시에 시작했음에도 불구하고

```
...
Thread-7 finished : taskId : 7time : 1736945597620
Thread-17 finished : taskId : 17time : 1736945597622
Thread-1 finished : taskId : 1time : 1736945597629
Thread-16 finished : taskId : 16time : 1736945597633
```

종료시간이 고루지 않게 끝나는걸 볼 수 있다.

-> 즉, 같이 작업이 실행되더라도 CPU 가 실행해주는 시간은 필연적으로 걸린다.

```java
runWithThreadPool(4, 30); // 스레드 풀 사용  
runWithThreadPool(8, 30); // 스레드 풀 사용  
runWithThreadPool(12, 30); // 스레드 풀 사용

Execution Time (ThreadPool): 22479 ms
Execution Time (ThreadPool): 70021 ms
Execution Time (ThreadPool): 68767 ms

```

그러면, 위에서 말한 내용처럼 정말 스레드 풀 내 개수가 늘어나도 시간이 줄어들지 않는지 확인하자.

```java
runWithThreadPool(4, 30); // 스레드 풀 사용  
runWithThreadPool(8, 30); // 스레드 풀 사용  
runWithThreadPool(12, 30); // 스레드 풀 사용

Execution Time (ThreadPool): 22479 ms
Execution Time (ThreadPool): 70021 ms
Execution Time (ThreadPool): 68767 ms

...

Execution Time (ThreadPool): 22415 ms
Execution Time (ThreadPool): 56424 ms
Execution Time (ThreadPool): 54439 ms
```

오히려, 시간이 상당히 늘어나는걸 볼 수 있다.

CPU Context Switching 은 얼마나 일어난지 측정해본 결과

`runWithThreadPool(4, 30)` 은 18,439번
`runWithThreadPool(8, 30)` 은 410,752번
`runWithoutThreadPool(20)` 은 401,040번

이 발생했다.

-> 이를 통해 잘못된 설정이 얼마나 성능 저하를 불러일으키는지 알 수 있었다.

### 파일 IO

파일을 생성하고, 연결해서 내용을 작성해 IO 작업을 구현했다.

```java
try (BufferedWriter writer = new BufferedWriter(new FileWriter(fileName))) {  
    for (int i = 0; i < 10000; i++) { // 파일에 10000줄 쓰기  
        writer.write("Task " + taskId + " - Line " + i + "
");  
    }  
} catch (IOException e) {  
    e.printStackTrace();  
}
```

버퍼가 꽉차면, 파일에 flush 를 자동으로 날린다.

```java
int taskCount = 2000;  
runWithThreadPool(8, taskCount);  
runWithThreadPool(100, taskCount);  
runWithoutThreadPool(taskCount);

Execution Time (ThreadPool): 3821 ms
Execution Time (ThreadPool): 10966 ms
Execution Time (Without ThreadPool): 14274 ms
```

![](https://i.imgur.com/G8fP1s5.png)

당연하게도. 스레드 생성 소멸이 처리되지 않으므로
스레드 풀이 더 효율적으로 나온다.

그리고, CPU 시간도 매우 적게 사용한다.

### 네트워크 IO

파일 IO 는 알겠고 네트워크 IO 는?
두가지로 접근해볼텐데 ( 요청이 빨리 끝나는, 요청이 늦게 끝나는 )

```java
URL url = new URL(urlStr);  
HttpURLConnection connection = (HttpURLConnection) url.openConnection();  
connection.setRequestMethod("GET");  
connection.setConnectTimeout(5000); // 연결 시간 초과 설정 (5초)  
connection.setReadTimeout(5000); // 읽기 시간 초과 설정 (5초)
```

이렇게 네트워크 요청을 보낸다.

#### 빨리 끝나는 요청

```java
//final String urlStr = "https://jsonplaceholder.typicode.com/posts/1"; 요청
runWithThreadPool(8, taskCount);
runWithThreadPool(100, taskCount);
runWithoutThreadPool(taskCount);

Execution Time (ThreadPool): 1150 ms
Execution Time (ThreadPool): 774 ms
Execution Time (Without ThreadPool): 864 ms
```

![](https://i.imgur.com/BDmDTNQ.png)

네트워크 IO 역시도 CPU 는 시간도 매우 적게 받고, 컨텍스트 스위칭도 매우 적게 발생한다.

#### 느린 요청

> `https://httpbin.org/delay/2` 해당 경로에 요청을 보내서 처리한다.
해당 경로에 요청을 보내면 `delay/{number}` 만큼 대기를 한 후 다시 응답을 해준다.

```java
//final String urlStr = "https://httpbin.org/delay/2"; 요청
Execution Time (ThreadPool): 41596 ms
Execution Time (ThreadPool): 6000 ms
Execution Time (Without ThreadPool): 6445 ms
```

![](https://i.imgur.com/ick0Cm3.png)

와 같은 결과가 나온다.
시간이 오래 걸려도, CPU 에 영향을 주는 부분은 없다.

![](https://i.imgur.com/F94qVgV.png)

차지하는 힙 메모리는 각각 차이가 난다.

우리는 이를 통해 IO 작업은 힙 메모리와 처리량(throughput) 이 비례 관계임을 알 수 있다.
 그리고, CPU Context Switching 이 비교적 적게 일어나는 사실 역시도 알 수 있다.
 
### OOM

그러면, 힙 메모리를 줄이기 위해 다소 실행 시간을 포기하고 스레드 풀 내 개수를 줄이면?
제목에서 볼 수 있듯이 이는 오히려 OOM 을 발생 시킬 수 있다.

```java
int taskCount = Integer.MAX_VALUE; // 작업 개수
runWithThreadPool(1, taskCount);
```

의도적으로 스레드풀에 스레드를 하나만 만들고, 작업을 21억개를 넣으면?

![](https://i.imgur.com/9YYuGKC.png)


빠르게 메모리르 초과하고, CPU 시간 및 컨텍스트 스위칭도 어마어마하게 일어난다.

```java
pool-1-thread-1 running start : taskId : 6time : 1736990425896
pool-1-thread-1 running start : taskId : 7time : 1736990447620

Exception in thread "main" java.lang.OutOfMemoryError: Java heap space

	at java.base/java.util.concurrent.LinkedBlockingQueue.offer(LinkedBlockingQueue.java:409)
	at java.base/java.util.concurrent.ThreadPoolExecutor.execute(ThreadPoolExecutor.java:1357)
	at java.base/java.util.concurrent.AbstractExecutorService.submit(AbstractExecutorService.java:123)
	at joyson.threadpool.ThreadPoolDiffInNetworkIOIntensive.runWithThreadPool(ThreadPoolDiffInNetworkIOIntensive.java:29)
	at joyson.threadpool.ThreadPoolDiffInNetworkIOIntensive.main(ThreadPoolDiffInNetworkIOIntensive.java:16)
	
pool-1-thread-1 running start : taskId : 8time : 1736990480824
pool-1-thread-1 running start : taskId : 9time : 1736990483422
```

코드에서도 OOM 이 발생한다.
이때, 흥미로운 점은 OOM 이 발생해도 스레드 작업은 일어난다는 것이다.
( 찾아보니, OFFER 부분에서 OOM 이 터져도, 다른 스레드는 작업을 처리한다. )

```java
ExecutorService threadPool = Executors.newFixedThreadPool(1);

public static ExecutorService newFixedThreadPool(int nThreads) {  
    return new ThreadPoolExecutor(nThreads, nThreads,  
                                  0L, TimeUnit.MILLISECONDS,  
                                  new LinkedBlockingQueue<Runnable>());  
}

public LinkedBlockingQueue() {  
    this(Integer.MAX_VALUE);  
}
```

기본적인 LInkedBlockingQueue 는 대기열을 `INTEGER.MAX_VALUE` 까지 받는다.
작업은 무제한으로 계속 Queue 에 추가되어 메모리르 치자한다.

그러므로, 스레드 개수를 조절해서 빠르게 처리되게 하거나 or  큐의 대기열 개수를 조절을 해야한다.
추가로, 큐가 다차면 요청을 어떻게 거절 및 처리할지에 대해서도 정할 수 있다. - `rejecetedExceptionHandler`


이 부분에 대해선 우테코를 다니며 미션 중 정리한 내용이 있어서 갈음한다. - [미션 중 정리 링크](https://github.com/woowacourse/java-http/pull/760#discussion_r1765201226)

### 결론

1. 스레드 풀을 사용하지 않고, 스레드만 사용하는 경우는 대부분 성능상 더 안 좋다. ( System Call 작업 + 생성 & 소멸 )
2. CPU 작업은 스레드가 많아지는게 오히려 더 안좋다. ( Context Switching )
3. IO 작업은 스레드가 많아져도 상관이 없다. ( 대부분이 Interrupt 를 받을 때 까지 `WAITING` )
4. 스레드 풀 스레드 개수는 힙 메모리 용량과 비례한다.
5. 스레드 풀의 스레드 개수와 대기열은 적절하게 정해져야 한다.

그러면, 이제 대망의 `왜 여러개의 스레드 풀이 필요할까??` 에 다뤄보자.


## 왜 여러개의 스레드 풀이 필요한가?

찾아봤는데 이 부분에 대한 검색 내용이 매우 없었다.
그래서, 직접 해서 나온 결과를 기반으로 설명한다.

### 성능 저하

그러면, 우리가 기존에 확인했던 CPU,파일 IO,네트워크 IO 작업들을
한 스레드 풀 VS 여러 스레드 풀로 나뉘어서 성능을 확인해보자.

```java
for (int i = 0; i < taskCount; i++) {  
    final int taskId = i;  
  
    if (taskId % 3 == 0) {  
        futures.add(threadPool.submit(() ->  
                measureTaskLog("FileIO Task-" + taskId, taskId, () -> performIO(taskId))  
        ));  
    } else if (taskId % 3 == 1) {  
        futures.add(threadPool.submit(() ->  
                measureTaskLog("NetworkIO Task-" + taskId, taskId, () -> performNetworkIO(taskId))  
        ));  
    } else {  
        futures.add(threadPool.submit(() ->  
                measureTaskLog("CPU Task-" + taskId, taskId, () -> performCPU(taskId))  
        ));  
    }  
}
```

작업이 하나의 유형만 들어가는게 아니라 골고루 들어가게 했다.
( 여러개의 스레드 풀에선 `threadPool` 통일이 아니라, `networkPool`,`cpuPool`,`fileIOPool` 과 같이 들어간다. )

되게, 복잡해서 이는 직접 측정이 아니라 자바에서 제공해주는 걸로 테스트한다.

```java
final long startTime = System.currentTimeMillis();  
final long threadCpuStartTime = cpuTimeSupported ? threadMXBean.getCurrentThreadCpuTime() : -1;  
  
performCPU(taskId);  
  
final long endTime = System.currentTimeMillis();  
final long threadCpuEndTime = cpuTimeSupported ? threadMXBean.getCurrentThreadCpuTime() : -1;  
  
final long cpuTimeUsed = (threadCpuStartTime != -1 && threadCpuEndTime != -1)  
        ? (threadCpuEndTime - threadCpuStartTime) / 1_000_000  
        : -1;
```

```java
final ThreadMXBean threadMXBean = ManagementFactory.getThreadMXBean();
```

threadMXBean 을 통해 현재 스레드가 얼마나 CPU Time 을 받았는지 측정한다.

```java
private static void saveDataToFile(final String filename, final List<TaskLog> logs) {  
    try (final BufferedWriter writer = new BufferedWriter(new FileWriter(filename))) {  
        writer.write("TaskID,Thread,Type,StartTime,EndTime,ExecutionTime,CPUTime(ms)
"); // CSV 헤더  
        for (final TaskLog log : logs) {  
            writer.write(log.toCsv() + "
");  
        }  
    } catch (final IOException e) {  
        e.printStackTrace();  
    }  
}
```

그 후, 이렇게 CSV 에 작성해서 비교한다.
먼저, 여러개의 스레드 풀 부터 살펴보면?

### 여러개 스레드 풀

```
Multiple Thread Pools Time Taken: 25811ms
```

> CSV 형식이라 보기 어려울 수 있으므로 앞부분만 캡처해서 보여준다.

![](https://i.imgur.com/mMqfZ4M.png)

스레드풀이 작업을 순차적으로 받아서 스레드에게 할당을 하며
CPU 작업도 빠른 시간내 끝나는 것을 볼 수 있다. ( 오래 걸리는거 아닌가? 라고 생각하는데 밑을 보면 달라진다. )
네트워크 IO 는 네트워크의 문제도 존재하는 것 같다. 🥲

### 단일 스레드 풀

```
Single Thread Pool Time Taken: 30783ms
```

싫행시간은 대략 5초가 차이가 났다.

![](https://i.imgur.com/bRpBkKN.png)

각 요청들은 여러 스레드 풀에 의해 시작하고 종료까지 매우 시간이 오래 걸린다.
작업을 수행하는데 걸리는 시간 + CPU 에 타임 슬롯을 할당받는 시간을 생가하면 정말정말 오래 걸린다.

## 심층 분석

GPT 의 도움을 받아 ( 사실 그냥 Map 으로 만들어준게 다임 )
- Task 유형별 평균 CPUTime
- Task별 CPUTime 분포
- Thread별 CPUTime 분포

로 측정을 해본다.

### 멀티 스레드

```java
=== Average CPU Time by Task Type ===
Task Type: NetworkIO Task, Average CPU Time: 3.57 ms
Task Type: CPU Task, Average CPU Time: 1012.72 ms
Task Type: FileIO Task, Average CPU Time: 2.05 ms
```

```java
TaskID: 248, Type: CPU Task, CPU Time: 1068 ms
TaskID: 119, Type: CPU Task, CPU Time: 1058 ms
TaskID: 242, Type: CPU Task, CPU Time: 1056 ms
TaskID: 53, Type: CPU Task, CPU Time: 1055 ms
...
TaskID: 125, Type: CPU Task, CPU Time: 951 ms
TaskID: 194, Type: CPU Task, CPU Time: 935 ms
TaskID: 4, Type: NetworkIO Task, CPU Time: 14 ms
TaskID: 7, Type: NetworkIO Task, CPU Time: 14 ms
TaskID: 22, Type: NetworkIO Task, CPU Time: 13 ms
TaskID: 43, Type: NetworkIO Task, CPU Time: 12 ms
TaskID: 199, Type: NetworkIO Task, CPU Time: 4 ms
TaskID: 283, Type: NetworkIO Task, CPU Time: 4 ms
TaskID: 30, Type: FileIO Task, CPU Time: 3 ms
TaskID: 36, Type: FileIO Task, CPU Time: 3 ms
TaskID: 42, Type: FileIO Task, CPU Time: 3 ms
TaskID: 45, Type: FileIO Task, CPU Time: 3 ms
```

각 작업별 최대 ~ 최소 시간도 비교적 균일하다.

### 싱글 스레드

```java
=== Average CPU Time by Task Type ===
Task Type: NetworkIO Task, Average CPU Time: 26.60 ms
Task Type: CPU Task, Average CPU Time: 1049.45 ms
Task Type: FileIO Task, Average CPU Time: 3.28 ms
```

```java
TaskID: 419, Type: CPU Task, CPU Time: 1172 ms
TaskID: 416, Type: CPU Task, CPU Time: 1169 ms
TaskID: 53, Type: CPU Task, CPU Time: 1162 ms
TaskID: 365, Type: CPU Task, CPU Time: 1151 ms
...
TaskID: 125, Type: CPU Task, CPU Time: 978 ms
TaskID: 497, Type: CPU Task, CPU Time: 958 ms
TaskID: 4, Type: NetworkIO Task, CPU Time: 185 ms
TaskID: 91, Type: NetworkIO Task, CPU Time: 82 ms
TaskID: 3, Type: FileIO Task, CPU Time: 42 ms
TaskID: 346, Type: NetworkIO Task, CPU Time: 40 ms
...
TaskID: 55, Type: NetworkIO Task, CPU Time: 14 ms
TaskID: 85, Type: NetworkIO Task, CPU Time: 14 ms
TaskID: 343, Type: NetworkIO Task, CPU Time: 14 ms
TaskID: 12, Type: FileIO Task, CPU Time: 13 ms
TaskID: 18, Type: FileIO Task, CPU Time: 13 ms
```

평균적으로 시간이 스레드 풀 여러개 보다 더 발생했으며
IO 작업에서 특히 최대와 최소 시간 차이가 큰 것을 볼 수 있다.
( CPU Context Switching 이 많이 일어나서라고 생각 )
### Task 혼용

I/O 는 CPU 를 받지 않으니까 상관 없는거 아니야?
하지만, 스레드가 그 동안 대기를 한다.

`I/O 성 작업`, `CPU 성 작업`이 같이 있게 되면 I/O 작업을 수행하고 있는 스레드들이 대기한다.
-> CPU 성 작업은 스레드를 할당받아 0.01 초만 수행을 하게 되더라도 할당받기 전까지 대기하게 된다.
=> 위에서 본 것처럼 OOM 을 유발시킬 수 있다.

### 데드락 발생 가능성

이 부분은 DB Connection Pool DeadLock 과 동일하다.
일반적으로, 스레드 풀의 개수를 크게 하므로 문제가 발생할 것 같진 않지만 가능하다.

```java
ExecutorService executor = Executors.newFixedThreadPool(1);  
try {  
    CompletableFuture<Void> parentFuture = CompletableFuture.runAsync(() -> {  
        CompletableFuture<Void> childFuture = CompletableFuture.runAsync(() -> {  
            try {  
                Thread.sleep(1000); // 작업 시뮬레이션  
            } catch (InterruptedException e) {  
                Thread.currentThread().interrupt();  
            }  
        }, executor);  
  
        childFuture.join(); // 자식 작업 완료를 기다림  
    }, executor);  
    parentFuture.join(); // 부모 작업 완료를 기다림  
} finally {  
    executor.shutdown();  
}
```

또는

```java
ExecutorService executor = Executors.newFixedThreadPool(9);

for (int i = 0; i < 9; i++) {  
    final int parentId = i;  
    parentFutures[i] = CompletableFuture.runAsync(() -> {  
        try {  
            Thread.sleep(500);
            }
        CompletableFuture<Void> childFuture = CompletableFuture.runAsync(() -> {
	        // 나머지 동일
			...
```

하나의 로직에서 스레드 풀이 9개인데, 스레드 9개를 생생해 추가적인 작업을 하면?

```
pool-1-thread-6 - Parent Task 5 started
pool-1-thread-7 - Parent Task 6 started
pool-1-thread-8 - Parent Task 7 started
pool-1-thread-1 - Parent Task 0 started
pool-1-thread-2 - Parent Task 1 started
pool-1-thread-5 - Parent Task 4 started
pool-1-thread-3 - Parent Task 2 started
pool-1-thread-9 - Parent Task 8 started
pool-1-thread-4 - Parent Task 3 started
```

이와같이 시작되고, 스레드 개수가 없어서 데드락 상태에 걸린다.

## 결론

- 일단 무조건 적으로, 성능상 차이가 난다. - 작업 간 리소스 분리해 간섭 제거
- IO 가 처리해야 하는 스레드를 차지한다. - 다른 작업들이 계속 대기한다
- 데드락이 발생할 가능성이 있다. - 작업 간 의존성이 있는 작업이 계속 대기할 수 있다

핵심은 `getTask` 를 통해 태스크를 받고, `Worker` 스레드를 할당 받아야 O.S 가 CPU 를 할당해준다 임을 명심하자.
( 하나의 스레드 풀은 태스크가 혼용되어 있어서 정체된다. )

 >### **비유: 단일 고속도로 vs. 작업별 전용 차선** - By GPT

>- **단일 스레드 풀**: 하나의 고속도로에 여러 종류의 차량(트럭, 버스, 오토바이)이 함께 운행.
    - 트럭(Network IO 작업)이 느리게 움직이면 뒤따르는 차량(CPU 작업)이 지연됨.
- **여러 스레드 풀**: 작업 유형별로 전용 차선을 가진 고속도로.
    - 트럭은 느리게 가도 CPU 작업은 영향을 받지 않고 별도 차선에서 독립적으로 운행.


긴 글이 끝났다.
토스뱅크 면접을 보며 매우 허점이 찔린 질문이였다.
`왜 하나의 스레드풀 보다 여러개의 스레드풀이 성능이 더 좋다고 생각한건가요?`
단순, 기술이 아닌 기술에 내재된 C.S 를 알아나가도록 노력하자.
