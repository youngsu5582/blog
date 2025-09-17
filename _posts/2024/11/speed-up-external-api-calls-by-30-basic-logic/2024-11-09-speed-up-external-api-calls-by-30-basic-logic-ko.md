---
title: "외부 API 호출을 30% 가량 빠르게(1) - 기본 로직"
author: 이영수
date: 2024-11-09T09:56:06.095Z
tags: ['비동기', '외부api', '우테코', '코레아', '스프링']
description: API 호출 시간을 딸깍 하고 싶은자 BE동기로...
image:
  path: https://velog.velcdn.com/images/dragonsu/post/65fbb24a-0ca2-436e-a625-b4b45bcf71c1/image.svg
lang: ko
permalink: /posts/speed-up-external-api-calls-by-30-basic-logic
---
해당 내용은[프로젝트](https://github.com/woowacourse-teams/2024-corea)에서 사용자 경험을 위해 API 호출 시간을 줄이기 위해 구현하며 작성한 글입니다. 
혹시, 잘못된 내용이나 다른 방법등이 있다면 댓글로 또는`joyson5582@gmail.com`로 남겨주세요!


---

저희 프로젝트는 코드 리뷰 완료를 확인하는 기능이 있습니다.

코드 리뷰 완료를 하기 위해서 두 가지 API 를 사용하고 있습니다.
- `https://api.github.com/repos/<org>/<repo>/pulls/<pull-number>/reviews` - 리뷰 조회
- `https://api.github.com/repos/<org>/<repo>/issues/<pull-number>/comments` - 코멘트 조회

> 두개를 조회하는 이유
> `Review changes` 뿐만 아니라, 단순 `Comment` 도 감지하기 위해서 같이 조회합니다.

![](https://i.imgur.com/YA3xBEb.png)

그리고, 이 외부 API 는 매우 오랜 시간을 잡아먹습니다.
이 코드들을 어떻게 처리해야 하는지 `기존 코드` -> `변경된 코드` 순으로 설명하겠습니다.

## 기존 코드 - 동기적 호출

```java
public GithubPullRequestReviewInfo getGithubPullRequestReviewInfoSync(String prLink) {
	validatePrLink(prLink);
	List<GithubPullRequestReview> commentFuture = commentClient.getPullRequestReviews(prLink);
	List<GithubPullRequestReview> reviewFuture = reviewClient.getPullRequestReviews(prLink);

	return new GithubPullRequestReviewInfo(collectPullRequestReviews(reviewFuture,commentFuture));
}

private Map<String, GithubPullRequestReview> collectPullRequestReviews(List<GithubPullRequestReview> reviews, List<GithubPullRequestReview> comments) {  
    return collectByGithubUserId(Stream.concat(reviews.stream(), comments.stream()));  
}
```

1. PR 링크를 검증한다.
2. API 를 각각 호출해 값을 가져온다.
3. 두 값을 합쳐서 검증하기 위한 객체를 만든다.

```java
public List<GithubPullRequestReview> getPullRequestReviews(String prLink) {  
    String githubApiUrl = prLinkToGithubApiUrl(prLink);  
    return Stream.iterate(1, page -> page + 1)  
            .map(page -> getPullRequestReviewsForPage(page, githubApiUrl))  
            .takeWhile(this::hasMoreReviews)  
            .flatMap(Arrays::stream)  
            .toList();  
}

private boolean hasMoreReviews(GithubPullRequestReview[] reviews) {  
    return reviews.length > 0;  
}
```

API 를 호출할 때는 처음 페이지 부터 빈 배열이 나올때 까지 호출하게 했습니다.

### 문제점

해당 코드에서 발생할 문제점은 두가지 있습니다.

1. 두 요청이 동기적으로 발생해 첫번째 API(리뷰) 가 늦게 끝나면 두번째 API(코멘트) 도 늦게 시작한다.
2. 각 요청에서 페이지네이션 API 가 동기적으로 발생한다.

#### 두 요청의 순서 의존

일반적으로 리뷰 조회 API 가 오래 걸립니다.
`Review Changes` 에서 남긴게 모두 포함되기 때문인데요.

https://github.com/woowacourse/java-blackjack/pull/652
해당 링크에 API 를 발생해서 걸리는 시간을 확인 하겠습니다.

![](https://i.imgur.com/WxP4iGh.png)

3개를 가져오는데 0.3초가 걸립니다.

![](https://i.imgur.com/muyCxkB.png)

97개를 가져오는데, 평균 0.7초 ~ 0.9초가 걸립니다. 

```java
List<GithubPullRequestReview> reviewFuture = reviewClient.getPullRequestReviews(prLink);
List<GithubPullRequestReview> commentFuture = commentClient.getPullRequestReviews(prLink);
```

이와같은 순서가 되어 있으면 짧은 요청이 긴 요청을 기다리는 문제가 발생합니다.
 - 첫번째 요청에서 실패시 다음 요청도 실패
 - 직렬화를 통해 총 시간이 더 오래 걸리는 성능 저하

#### 페이지네이션 동기적 호출

깃허브는 한번에 최대 100개씩 밖에 가져오지 못합니다.
혹시나 대화가 엄청나게 많아서 100개를 넘으면 다음 페이지에서도 가져와야 합니다.

![](https://i.imgur.com/vQMEfqw.png)

![](https://i.imgur.com/YObXpwb.png)

각 요청당 평균 1~1.5 초가 걸립니다.

대략 대화가 300개가 넘는 PR을 호출할때는

사용자는 1.5 `*` 3 + 0.3 = 4.8초의 시간을 대기하게 됩니다.

![](https://i.imgur.com/NXQTfdi.png)

[출처 링크](https://brunch.co.kr/@rightbrain/61)

사용자는 5초만 넘어도 이탈률이 `90%` 이상이라고 합니다...
물론, 코드 리뷰 완료 버튼을 누르고 기다리는 것이므로 기다릴 수도 있겠지만 반복된다면 분명히 불편을 느낄겁니다.

## 해결 코드 - 비동기적 호출
### 첫 번째 문제 해결

첫 번째 문제부터 해결해보겠습니다.

```java
public GithubPullRequestReviewInfo getGithubPullRequestReviewInfoAsync(String prLink) {  
    validatePrLink(prLink);  
    CompletableFuture<List<GithubPullRequestReview>> reviewFuture = supplyAsync(() -> reviewClient.getPullRequestReviewsAsync(prLink));  
    CompletableFuture<List<GithubPullRequestReview>> commentFuture = supplyAsync(() -> commentClient.getPullRequestReviewsAsync(prLink));  
  
    return reviewFuture  
            .thenCombine(commentFuture, this::collectPullRequestReviews)  
            .exceptionally(e -> {throw new CoreaException(ExceptionType.GITHUB_SERVER_ERROR);})  
            .thenApply(GithubPullRequestReviewInfo::new)  
            .join();  
}
```

코드가 다소 달라진 모습입니다.
하나씩 설명하겠습니다. 🙂

```java
public static <T> CompletableFuture<T> supplyAsync(Supplier<T> supplier) {  
    return CompletableFuture.supplyAsync(() -> {  
        return supplier.get();  
    });  
}
```

이와같은 유틸 메소드를 만들었습니다.
실행 함수의 리턴타입을 `CompletableFuture<T>` 로 만들어줍니다.

#### CompletableFuture

Java에서 제공해주는 비동기 프로그래밍 지원 클래스입니다. ( Java 8에 도입 )
아래 작업을 가능하게 해줍니다.
- 비동기 작업 : 별도의 스레드에서 작업 실행 후 결과 비동기 처리 가능
- 콜백 작업 : 작업 완료 후, 추가적인 작업 실행 가능
- 병렬 처리 : 병렬 실행 후, 결과 조합 가능

`supplyAsync` 는 값을 반환하는 비동기 작업을 실행해줍니다.

다시 코드에 대해 설명하면

```java
return reviewFuture  
		.thenCombine(commentFuture, this::collectPullRequestReviews)  
		.exceptionally(e -> {throw new CoreaException(ExceptionType.GITHUB_SERVER_ERROR);})  
		.thenApply(GithubPullRequestReviewInfo::new)  
		.join();  
```

- thenCombine :  두 개를 병렬로 실행 후, 둘 다 끝나면 합치는 함수를 실행합니다.
( 두 번쨰 매개변수 : `BiFunction<? super T,? super U,? extends V> fn` )
- exceptionally : 예외를 잡아서 새로운 값으로 변환
- thenApply : 합쳐진 값을 통해 적용할 함수
- join : 비동기 작업이 완료되면 그 결과 값을 반환

`stream` 이랑  비슷한듯 안 비슷합니다.

=> `두 요청의 순서 의존` 라는 문제는 요청 두개를 병렬적으로 실행하여 해결됐습니다.

### 두 번째 문제 해결

두 번째 문제를 해결하기 위해선 먼저 `페이지네이션` 을 해결해야 합니다.
현재 빈 배열이 올 때 까지 요청을 보내서 종료하는 식으로 검증했습니다. 끝을 알 수 없었기 떄문인데요.
이를 깃허브가 주는 `Link` 헤더를 통해 해결해보겠습니다.

#### 링크(Link) 헤더

[Link 대한 MDN 링크](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Link)

링크(Link) 헤더는 요청된 리소스에 대한 **메타데이터**를 포함하는 또 다른 리소스를 클라이언트에게 알려주는 데 사용됩니다.
`Link: <uri-reference>; param1=value1;` 의 형식으로 되어 있습니다.

깃허브는 이 링크 헤더를 통해 마지막 값이 뭔지에 대해서 알려줍니다.

```
<https://api.github.com/repositories/238385653/issues/652/comments?page=2&per_page=100>; rel="next", <https://api.github.com/repositories/238385653/issues/652/comments?page=2&per_page=100>; rel="last"
```

이 값을 통해서 마지막을 찾을 수 있습니다!
하지만, 이 값을 통해 바로 정하는게 아닌 **조금 더 효율적**으로 찾겠습니다.

`https://api.github.com/repos/woowacourse/java-blackjack/pulls/652/reviews?page=1000&per_page=100`
-> 이와같이 값이 무조건 존재하지 않는 요청을 보냅니다.

100개를 받아오는 `page=1` 에 요청을 보내면 받아오는 시간이 걸립니다. ( 1.8초 ~ 2.0초 )
빈 값을 받아올 때는 비교적 짧은 시간이 걸립니다. ( 0.3초 )

![](https://i.imgur.com/3epLerk.png)

( 일종의 `Preflight` 요청입니다. )

이 lastPage 를 사용해서 페이지네이션을 병렬로 요청 보내보겠습니다.

```java
List<CompletableFuture<GithubPullRequestReview[]>> futureReviews = IntStream.rangeClosed(1, lastPage)  
        .mapToObj(page -> supplyAsync(() -> getPullRequestReviewsForPage(page, githubApiUrl),executorService))  
        .toList();

return CompletableFuture.allOf(futureReviews.toArray(CompletableFuture[]::new))  
        .thenApply(v -> futureReviews.stream()  
                .map(CompletableFuture::join)
                .flatMap(Arrays::stream)
                .toList())
        .join();
```

- allOf : 모든 비동기 작업이 완료될 때까지 대기

먼저 병렬로 비동기 요청을 보냅니다.
그리고, 그 비동기 요청들이 다 끝나면 List 로 변환합니다. ( 꽤나 간단하죠? 🙂)

```java
public GithubPullRequestReviewInfo getGithubPullRequestReviewInfoAsync(String prLink) {  
    validatePrLink(prLink);  
    CompletableFuture<List<GithubPullRequestReview>> reviewFuture = supplyAsync(() -> reviewClient.getPullRequestReviewsAsync(prLink));  
    CompletableFuture<List<GithubPullRequestReview>> commentFuture = supplyAsync(() -> commentClient.getPullRequestReviewsAsync(prLink));  
  
    return reviewFuture  
            .thenCombine(commentFuture, this::collectPullRequestReviews)  
            .exceptionally(e -> {throw new CoreaException(ExceptionType.GITHUB_SERVER_ERROR);})  
            .thenApply(GithubPullRequestReviewInfo::new)  
            .join();  
}
```

이를 통해 두 가지 문제점을 해결한 비동기 코드가 완성되었습니다.

## 결론 

비동기 코드의 속도를 측정해보겠습니다.

속도 측정은 두 가지 PR에서 진행하겠습니다.
- 매우 많은 코멘트와 리뷰가 있는 PR
- 평범한 PR
- 거의 없는 PR

### 매우 많은 코멘트와 리뷰가 있는 PR
[34명, 291개 대화 - 자바 크리스마스](https://github.com/h-beeen/java-christmas-6-h-beeen/pull/1)

6기 프리코스 하며 제가 본 것 중 가장 많은 대화가 발생한 해빈님의 크리스마스 PR입니다.

```
기존 코드 : Elapsed Time: 3 seconds, 184 milliseconds, 657 microseconds, 667 nanoseconds
첫 번째 문제만 해결 : Elapsed Time: 2 seconds, 881 milliseconds, 774 microseconds, 0 nanoseconds
둘다 해결 : Elapsed Time: 1 seconds, 461 milliseconds, 261 microseconds, 333 nanoseconds
```

### 평범한 PR

[11명, 76개 대화 - 자바 로또](https://github.com/woowacourse-precourse/java-lotto-6/pull/1067)

제 프리코스 PR 입니다. 

```
기존 코드 : Elapsed Time: 1 seconds, 535 milliseconds, 113 microseconds, 375 nanoseconds
첫 번째 문제만 해결 : Elapsed Time: 1 seconds, 336 milliseconds, 732 microseconds, 375 nanoseconds
둘다 해결 : Elapsed Time: 1 seconds, 53 milliseconds, 398 microseconds, 83 nanoseconds
```

### 거의 없는 PR
[5명, 15개 대화 - 숫자 야구 게임](https://github.com/woowacourse-precourse/java-baseball-6/pull/1338)

이것도 제 프리코스 PR 입니다. 🥲

```
기존 코드 : Elapsed Time: 1 seconds, 423 milliseconds, 599 microseconds, 792 nanoseconds
첫 번째 문제만 해결 : Elapsed Time: 0 seconds, 738 milliseconds, 485 microseconds, 167 nanoseconds
둘다 해결 : Elapsed Time: 0 seconds, 870 milliseconds, 887 microseconds, 917 nanoseconds
```

이렇게, 비동기 요청을 통해 평균 30~50% 정도의 시간이 단축된 걸 볼 수 있습니다.
최대 페이지가 1인데 둘다 비동기로 처리 시 조금 더 느려진걸 볼 수 있습니다.

그러면 여러 개의 요청도 검증해보겠습니다.

```
execute(() -> githubReviewProvider.getGithubPullRequestReviewInfoSync(baseBallUrl), "기존 코드 : ",20);
```

20번씩 반복해보겠습니다.

```
기존 코드 : Elapsed Time: 9 seconds, 693 milliseconds, 803 microseconds, 917 nanoseconds
첫 번째 문제만 해결 : Elapsed Time: 9 seconds, 569 milliseconds, 496 microseconds, 333 nanoseconds
둘다 해결 : Elapsed Time: 9 seconds, 797 milliseconds, 58 microseconds, 125 nanoseconds
```

의외로 동일한 결과가 나옵니다.
이상하지 않나요...? 

확인을 해보기 위해 각 비동기 요청들이 현재 작업중인 스레드 이름을 출력해보겠습니다.

```java
public static <T> CompletableFuture<T> supplyAsync(Supplier<T> supplier) {  
    return CompletableFuture.supplyAsync(() -> {  
        log.info("Running in thread: {}", Thread.currentThread().getName());  
        return supplier.get();  
    });  
}
```

```
[2024-11-09 18:45:18:12776] [ForkJoinPool.commonPool-worker-7] INFO  [corea.global.util.FutureUtil.lambda$supplyAsync$0:13] - Running in thread: ForkJoinPool.commonPool-worker-7 
[2024-11-09 18:45:18:12776] [ForkJoinPool.commonPool-worker-1] INFO  [corea.global.util.FutureUtil.lambda$supplyAsync$0:13] - Running in thread: ForkJoinPool.commonPool-worker-1 
[2024-11-09 18:45:18:12776] [ForkJoinPool.commonPool-worker-2] INFO  [corea.global.util.FutureUtil.lambda$supplyAsync$0:13] - Running in thread: ForkJoinPool.commonPool-worker-2 
[2024-11-09 18:45:18:12776] [ForkJoinPool.commonPool-worker-3] INFO  [corea.global.util.FutureUtil.lambda$supplyAsync$0:13] - Running in thread: ForkJoinPool.commonPool-worker-3 
[2024-11-09 18:45:18:12777] [ForkJoinPool.commonPool-worker-6] INFO  [corea.global.util.FutureUtil.lambda$supplyAsync$0:13] - Running in thread: ForkJoinPool.commonPool-worker-6 
[2024-11-09 18:45:18:12776] [ForkJoinPool.commonPool-worker-4] INFO  [corea.global.util.FutureUtil.lambda$supplyAsync$0:13] - Running in thread: ForkJoinPool.commonPool-worker-4 
[2024-11-09 18:45:18:12777] [ForkJoinPool.commonPool-worker-5] INFO  [corea.global.util.FutureUtil.lambda$supplyAsync$0:13] - Running in thread: ForkJoinPool.commonPool-worker-5 
[2024-11-09 18:45:18:12778] [ForkJoinPool.commonPool-worker-7] INFO  [corea.global.util.FutureUtil.lambda$supplyAsync$0:13] - Running in thread: ForkJoinPool.commonPool-worker-7 
[2024-11-09 18:45:18:12778] [ForkJoinPool.commonPool-worker-3] INFO  [corea.global.util.FutureUtil.lambda$supplyAsync$0:13] - Running in thread: ForkJoinPool.commonPool-worker-3 
[2024-11-09 18:45:18:12778] [ForkJoinPool.commonPool-worker-6] INFO  [corea.global.util.FutureUtil.lambda$supplyAsync$0:13] - Running in thread: ForkJoinPool.commonPool-worker-6 
[2024-11-09 18:45:18:12778] [ForkJoinPool.commonPool-worker-4] INFO  [corea.global.util.FutureUtil.lambda$supplyAsync$0:13] - Running in thread: ForkJoinPool.commonPool-worker-4
```

이와같이 `ForkJoinPool.commonPool` 에서 최대 7까지만 스레드가 동작하는걸 볼 수 있습니다.
그래서 시간이 달라지지 않고 유사하게 나온거 같네요 🙂

다음 내용은 `ForkJoinPool` 은 뭔지, 스레드 관리를 통해 여러개의 요청이 들어와도 성능이 좋아지게 해보겠습니다.

감사합니다!
