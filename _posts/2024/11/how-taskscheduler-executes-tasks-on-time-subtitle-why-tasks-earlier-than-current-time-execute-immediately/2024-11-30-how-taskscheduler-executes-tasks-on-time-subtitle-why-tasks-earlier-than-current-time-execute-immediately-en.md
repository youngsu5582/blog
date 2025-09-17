---
title: "스레드,스레드풀 in Java"
author: 이영수
date: 2025-01-17T03:02:53.648Z
tags: ['스레드', '스레드풀', '우테코']
categories: ['백엔드', '자바']
description: 왜 여러개의 스레드 풀이 하나의 스레드 풀보다 좋은가
image:
  path: https://velog.velcdn.com/images/dragonsu/post/79c55bba-2e1b-42ca-a175-773ff9480ae6/image.jpeg
lang: ko
permalink: /posts/how-taskscheduler-executes-tasks-on-time-subtitle-why-tasks-earlier-than-current-time-execute-immediately/
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
> https://www.reddit.com/r/linux_gaming/comments/17rohqp/linux_66_with_eevdf_the-new-cpu-scheduler-gaming/
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

- 워커스레드 추가를 실패하면? - 거절한다。

```java
// ThreadPoolExecutor.addWorker

private boolean addWorker(Runnable firstTask, boolean core) {  

    retry:  
    for (int c = ctl.get();;) {  
        // Check if queue empty only if necessary.  
        if (runStateAtLeast(c, SHUTDOWN)  
            && (runStateAtLeast(c, STOP)  
                || firstTask != null  
                || workQueue.isEmpty()))  
            return false;  
  
        for (;;) {  
            if (workerCountOf(c)  
                >= ((core ? corePoolSize : maximumPoolSize) & COUNT_MASK))  
                return false;  
            if (compareAndIncrementWorkerCount(c))  
                break retry;  
            c = ctl.get();  // Re-read ctl  
            if (runStateAtLeast(c, SHUTDOWN))  
                continue retry;  
            // else CAS failed due to workerCount change; retry inner loop  
        }  
    }
	... // Explanation continues immediately below
}

private boolean compareAndIncrementWorkerCount(int expect) {  
    return ctl.compareAndSet(expect, expect + 1);  
}
```

> `retry:` uses the `label` feature provided by Java. - [Blog explaining labels](https://all-i-want.tistory.com/191)

The conditional statement prevents adding new workers if the thread pool is in the shutdown process or if the task queue is empty.
Then,
1. Verify if the maximum number of tasks has been exceeded -> return false
2. If `ctl` number is successfully incremented -> break
3. If SHUTDOWN -> continue

Then let's continue with the part after the condition.

```java
private boolean addWorker(Runnable firstTask, boolean core) {
	... // Conditional part
	boolean workerStarted = false;  
	boolean workerAdded = false;  
	Worker w = null;  
	try {  
	    w = new Worker(firstTask);  
	    final Thread t = w.thread;  
	    if (t != null) {  
	        final ReentrantLock mainLock = this.mainLock;  
	        mainLock.lock();  
	        try {  
	            if (isRunning(c) ||  
	                (runStateLessThan(c, STOP) && firstTask == null)) {  
	                if (t.getState() != Thread.State.NEW)  
	                    throw new IllegalThreadStateException();  
	                workers.add(w);  
	                workerAdded = true;  
	                int s = workers.size();  
	                if (s > largestPoolSize)  
	                    largestPoolSize = s;  
	            }  
	        } finally {  
	            mainLock.unlock();  
	        }  
	        if (workerAdded) {  
	            t.start();  
	            workerStarted = true;  
	        }  
	    }  
	} finally {  
	    if (! workerStarted)  
	        addWorkerFailed(w);  
	}  
	return workerStarted;
}
```

1. Create a worker thread.
2. Acquire lock.
3. If RUNNING or not STOP, and first task is null, then work.
4. Add to task queue, set `workerAdded` flag to true, change PoolSize.
5. Release lock.
6. Start thread, set `workerStarted` flag to true.
7. If false, handle failure - decrementWorkerCount, workers.remove(w), tryTerminate call.
8. Return success status.

> Why insert null?
> Since there is no task to execute, it enters a waiting state immediately after starting.
> -> When a task comes into the task queue, it responds immediately (thread pool).
> ⭐ I guess it's to prepare in advance to start the task at the exact time.

Through this process, tasks are added to the task queue + worker threads wait.

# Task execution at specified time

Now let's look at how these registered threads are executed on time.

## ThreadPoolExecutor.runWorker

> Unnecessary parts of the code have been removed. (Initial task setup part,)

ThreadPoolExecutor executes tasks periodically in this way.
(It is executed through the overall `ThreadPoolExecutor`, not specific to `TaskSchedule`.)

```java
final void runWorker(Worker w) {  
    Thread wt = Thread.currentThread();  
    Runnable task = w.firstTask;  
    boolean completedAbruptly = true;  
    try {  
        while (task != null || (task = getTask()) != null) {  
            w.lock();  
            if ((runStateAtLeast(ctl.get(), STOP) ||  
                 (Thread.interrupted() &&  
                  runStateAtLeast(ctl.get(), STOP))) &&  
                !wt.isInterrupted())  
                wt.interrupt();  
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

protected void beforeExecute(Thread t, Runnable r)

protected void afterExecute(Runnable r, Throwable t)
```

1. If there is an initial task (task != null) or a fetched task (getTask() != null)
2. If the thread pool is STOP and the thread is not interrupted, interrupt the thread to stop the task.
3. Method called before task execution - `beforeExecute`
4. Task execution
5. Method called after task execution - `afterExecute`
6. Add to completed tasks
7. Final processing of worker (thread pool termination or worker removal and adjustment)

If you only look at this code, you might be curious how the schedule is executed at the specified time.
Tasks are fetched as intended through the `getTask` part.

## ThreadPoolExecutor.getTask

```java
private Runnable getTask() {  
    boolean timedOut = false;
  
    for (;;) {  
        int c = ctl.get();  
        if (runStateAtLeast(c, SHUTDOWN)  
            && (runStateAtLeast(c, STOP) || workQueue.isEmpty())) {  
            decrementWorkerCount();  
            return null;        
        }  
  
        int wc = workerCountOf(c);  
  
        boolean timed = allowCoreThreadTimeOut || wc > corePoolSize;  
  
        if ((wc > maximumPoolSize || (timed && timedOut))  
            && (wc > 1 || workQueue.isEmpty())) {  
            if (compareAndDecrementWorkerCount(c))  
                return null;  
            continue;        
        }  
  
        try {  
            Runnable r = timed ?  
                workQueue.poll(keepAliveTime, TimeUnit.NANOSECONDS) :  
                workQueue.take();  
            if (r != null)  
                return r;  
            timedOut = true;  
        } catch (InterruptedException retry) {  
            timedOut = false;  
        }  
    }
}
```

It fetches and returns tasks from the Queue. (Unnecessary explanations omitted)
You probably won't understand just by looking at this.
ScheduledThreadPoolExecutor has a Queue called `DelayedWorkQueue`.

### ScheduledThreadPoolExecutor.DelayedWorkQueue

It has a priority queue that sorts tasks by delay time.
-> That is, the task that should be executed first is always at the front of the queue.

```java
public boolean offer(Runnable x) {
	...
	 if (i == 0) {
		queue[0] = e;
		setIndex(e, 0);
	} else {
		siftUp(i, e);
	}
	...
}

private void siftUp(int k, RunnableScheduledFuture<?> key) {  
    while (k > 0) {  
        int parent = (k - 1) >>> 1;  
        RunnableScheduledFuture<?> e = queue[parent];  
        if (key.compareTo(e) >= 0)  
            break;  
        queue[k] = e;  
        setIndex(e, k);  
        k = parent;  
    }  
    queue[k] = key;  
    setIndex(key, k);  
}
```

It guarantees priority through `siftUp` and `siftDown` based on time.
#### ScheduledThreadPoolExecutor.ScheduledFutureTask

```java
public int compareTo(Delayed other) {
	if (other == this) // compare zero if same object
		return 0;
	if (other instanceof ScheduledFutureTask) {
		ScheduledFutureTask<?> x = (ScheduledFutureTask<?>)other;
		long diff = time - x.time;
		if (diff < 0)
			return -1;
		else if (diff > 0)
			return 1;
		else if (sequenceNumber < x.sequenceNumber)
			return -1;
		else
			return 1;
	}
	long diff = getDelay(NANOSECONDS) - other.getDelay(NANOSECONDS);
	return (diff < 0) ? -1 : (diff > 0) ? 1 : 0;
}
```

It enables sorting by task time.

### ScheduledThreadPoolExecutor.poll

```java
public RunnableScheduledFuture<?> poll() {  
    final ReentrantLock lock = this.lock;  
    lock.lock();  
    try {  
        RunnableScheduledFuture<?> first = queue[0];  
        return (first == null || first.getDelay(NANOSECONDS) > 0)  
            ? null  
            : finishPoll(first);  
    } finally {  
        lock.unlock();  
    }  
}

private RunnableScheduledFuture<?> finishPoll(RunnableScheduledFuture<?> f) {  
    int s = --size;  
    RunnableScheduledFuture<?> x = queue[s];  
    queue[s] = null;  
    if (s != 0)  
        siftDown(0, x);  
    setIndex(f, -1);  
    return f;  
}
```

If the time of the first task is still remaining (first.getDelay(NANOSECONDS) > 0), it returns null.
Otherwise, it readjusts the queue and returns.

> Tasks from previous times will naturally be at the very beginning + getDelay will be less than 0.
> Therefore, the task will be executed immediately.

## Conclusion

Task operations are performed at the specified time through this process.

![500](https://i.imgur.com/t6EWUzT.png)

![500](https://i.imgur.com/r3yBna9.png)

Features that enable this include:

- Periodic execution of ThreadPoolExecutor
- Locking through `ReentrantLock`

It is well implemented to fit the meaning of Spring (POJO) by performing entirely through Java classes.
This concludes my long exploration. Thank you!
