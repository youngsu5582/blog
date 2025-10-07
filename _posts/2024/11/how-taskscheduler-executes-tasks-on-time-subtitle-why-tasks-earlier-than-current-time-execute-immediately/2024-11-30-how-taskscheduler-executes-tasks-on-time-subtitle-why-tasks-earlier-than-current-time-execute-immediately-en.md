---
title: "How does TaskScheduler execute tasks on time? (Subtitle: Why tasks earlier than the current time execute immediately)"
author: 이영수
date: 2024-11-30T10:38:49.272Z
description: "How Spring wisely registers tasks"
categories: ['Backend', 'Spring']
image:
  path: https://velog.velcdn.com/images/dragonsu/post/40bba5ee-0980-4a84-8816-368ad65685c4/image.png
lang: en
permalink: /posts/how-taskscheduler-executes-tasks-on-time-subtitle-why-tasks-earlier-than-current-time-execute-immediately/
---

> This post has been translated from Korean to English by Gemini CLI.

> Warning⚠️ This content is very long. It may be incorrect. If there is any incorrect content, please leave a comment or contact me at `joyson5582@gmail.com`!

Currently, [our project](https://github.com/woowacourse-teams/2024-corea) uses TaskScheduler to automatically match rooms at a specified time.

How does Spring automatically execute requests at a specified time?
Surprisingly, Spring implemented this using existing Java code without writing much code.

Then, let's look at two things:
- Registering tasks to be executed at a specified time
- Executing tasks at a specified time

# Registering tasks at a specified time
## ThreadPoolTaskScheduler.schedule

This class is located in `package org.springframework.scheduling.concurrent;`. - [Official Documentation](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/scheduling/concurrent/ThreadPoolTaskExecutor.html)

```java
@Override  
public ScheduledFuture<?> schedule(Runnable task, Instant startTime) {  
    ScheduledExecutorService executor = getScheduledExecutor();  
    Duration delay = Duration.between(this.clock.instant(), startTime);  
    try {  
       return executor.schedule(errorHandlingTask(task, false), NANO.convert(delay), NANO);  
    }  
    catch (RejectedExecutionException ex) {  
       throw new TaskRejectedException(executor, task, ex);  
    }  
}
```

It gets the `ScheduledExecutorService` to execute the thread. - By default, it gets `ThreadPoolTaskScheduler`.
It calculates the time difference and converts it to nanoseconds, allowing for very precise operation.
Then, it registers the schedule.

## ScheduledThreadPoolExecutor - schedule
This class is located in `package java.util.concurrent;`. - [Official Documentation](https://docs.oracle.com/javase/7/docs/api/java/util/concurrent/ScheduledThreadPoolExecutor.html)

```java
public ScheduledFuture<?> schedule(Runnable command, long delay, TimeUnit unit) {
        if (command == null || unit == null)
            throw new NullPointerException();
            
        RunnableScheduledFuture<Void> t = decorateTask(command,
            new ScheduledFutureTask<Void>(command, null,
                                          triggerTime(delay, unit),
                                          sequencer.getAndIncrement()));
        delayedExecute(t);
        return t;
    }


protected <V> RunnableScheduledFuture<V> decorateTask(  
    Runnable runnable, RunnableScheduledFuture<V> task) {  
    return task;  
}

private long triggerTime(long delay, TimeUnit unit) {  
    return triggerTime(unit.toNanos((delay < 0) ? 0 : delay));  
}

private long triggerTime(long delay) {  
    return System.nanoTime() +  
        ((delay < (Long.MAX_VALUE >> 1)) ? delay : overflowFree(delay));  
}
```

It gets the value of `system's current time + delay (nanoseconds)` through `triggerTime`.
If the time is too large, it prevents overflow.

### ScheduledThreadPoolExecutor.ScheduledFutureTask

```java
ScheduledFutureTask(Runnable r, V result, long triggerTime,  
                    long sequenceNumber) {  
    super(r, result);  
    this.time = triggerTime;  
    this.period = 0;  
    this.sequenceNumber = sequenceNumber;  
}

public FutureTask(Runnable runnable, V result) {  
    this.callable = Executors.callable(runnable, result);  
    this.state = NEW;       // ensure visibility of callable  
}
```

This class provides the ability to perform tasks after a specific time.

In the superclass,
- Converts runnable to callable
- Sets thread state to NEW
  These are also added.

I will cover this class in more detail in the `Executing tasks` section below.

## ScheduledThreadPoolExecutor - delayedExecute if section

```java
private void delayedExecute(RunnableScheduledFuture<?> task) {  
    if (isShutdown())  
        reject(task);  
    else {  
        super.getQueue().add(task);  
        if (!canRunInCurrentRunState(task) && remove(task))  
            task.cancel(false);  
        else            
	        ensurePrestart();  
    }  
}

boolean canRunInCurrentRunState(RunnableScheduledFuture<?> task) {  
    if (!isShutdown())  
        return true;  
    if (isStopped())  
        return false;  
    return task.isPeriodic()  
        ? continueExistingPeriodicTasksAfterShutdown  
        : (executeExistingDelayedTasksAfterShutdown  
           || task.getDelay(NANOSECONDS) <= 0);  
}
```

If the current state is SHUTDOWN, it rejects the task.

### ThreadPoolExecutor - isShutdown, reject

This class is located in `package java.util.concurrent;`. - [Official Documentation](https://docs.oracle.com/javase/8/docs/api/java/util/concurrent/ThreadPoolExecutor.html)

```java
...
private final AtomicInteger ctl = new AtomicInteger(ctlOf(RUNNING, 0));

private static final int COUNT_BITS = Integer.SIZE - 3;
private static final int SHUTDOWN = 0 << COUNT_BITS;

private static int ctlOf(int rs, int wc) { return rs | wc; }

public boolean isShutdown() {  
    return runStateAtLeast(ctl.get(), SHUTDOWN);  
}

private static boolean runStateAtLeast(int c, int s) {  
    return c >= s;  
}
```

Here, the explanation for `ctl` is very detailed in the comments.

In short,
- 29 bits represent the number of currently started threads. - wc (WorkerCount)
- 3 bits represent the current state of the thread pool. - rs (RunState)

If the `ctl` number is less than 0, it is considered SHUTDOWN.

```java
// ThreadPoolExecutor
...
private volatile RejectedExecutionHandler handler;

final void reject(Runnable command) {  
    handler.rejectedExecution(command, this);  
}
```

Then the rejection handler rejects the `Runnable`.

## ScheduledThreadPoolExecutor - delayedExecute else section

```java
private void delayedExecute(RunnableScheduledFuture<?> task) {  
    if (isShutdown())  
        reject(task);  
    else {  
        super.getQueue().add(task);  
        if (!canRunInCurrentRunState(task) && remove(task))  
            task.cancel(false);  
        else            
	        ensurePrestart();  
    }  
}

boolean canRunInCurrentRunState(RunnableScheduledFuture<?> task) {  
    if (!isShutdown())  
        return true;  
    if (isStopped())  
        return false;  
    return task.isPeriodic()  
        ? continueExistingPeriodicTasksAfterShutdown  
        : (executeExistingDelayedTasksAfterShutdown  
           || task.getDelay(NANOSECONDS) <= 0);  
}
```

It adds the task to the task queue.
When adding, it returns true if it is in `stop` state, or if it is not a periodic task, or if it is an immediately executable task after the delay time has passed.

> `executeExistingDelayedTasksAfterShutdown || task.getDelay(NANOSECONDS) <= 0);`
> `executeExistingDelayedTasksAfterShutdown` is a variable that determines whether to perform existing tasks when the thread pool is terminated.
> (If true, existing tasks are executed even if the thread pool is terminated)
> `task.getDelay(...)` returns the remaining time by comparing it with `System.nanoTime` of the current task.
> ⭐ This is the part that explains why tasks that are earlier than the current time are also included.

### ThreadPoolExecutor - ensurePrestart

This method guarantees that at least one thread can be executed. (Even if `corePoolSize` is 0!)

```java
// Same as prestartCoreThread except arranges that at least one thread is started even if corePoolSize is 0.
void ensurePrestart() {  
    int wc = workerCountOf(ctl.get());  
    if (wc < corePoolSize)  
        addWorker(null, true);  
    else if (wc == 0)  
        addWorker(null, false);  
}

private boolean addWorker(Runnable firstTask, boolean core) {
	...
}
```

1. Gets the number of currently working threads (workerCount).
  - If it's less than the number of cores, it sets `core` to true and adds the task.
  - If the number of working threads is 0, it sets `core` to false and adds the task.

### ThreadPoolExecutor - addWorker

> Since the code is about 80 lines long, I will only explain the necessary parts.

 ```java
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
