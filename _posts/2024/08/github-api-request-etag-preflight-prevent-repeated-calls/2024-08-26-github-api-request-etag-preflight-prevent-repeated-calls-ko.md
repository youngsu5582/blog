---
title: "깃허브 API 요청 구현중 ETag Preflight 를 통해 반복되는 호출 방지하기"
author: 이영수
date: 2024-08-26T15:58:29.228Z
tags: ['etag', '깃허브', '외부 API', '우테코']
description: 외부 API 는 어떻게 캐싱을 할 수 있을까
image:
  path: https://velog.velcdn.com/images/dragonsu/post/9cb4ea53-5003-4e49-b952-907ce2c269ed/image.jpeg
lang: ko
permalink: /posts/github-api-request-etag-preflight-prevent-repeated-calls/
---
해당 내용들은 제 개인적인 생각에 따라 구현을 했습니다.
혹시나, 틀린 부분이 있거나 의견이 있다면 댓글이나 joyson5582@gmail.com 로 연락주시면 감사하겠습니다! 

현재, 기능을 구현하던 도중 깃허브 API를 호출해야 하는 기능이 생겼다.

신청자들을 코드 리뷰 매칭을 해주기 전, 실제로 미션에 참여했는지에 대해 검증하는 방법이다.
우리는 미션 레포지토리에 PR을 제출했는지를 기반으로 미션을 참여했음을 검증하기로 했다. ( 물론, 빈 PR 로 제출했을 수도 있다.. - 그것은 우리의 영역 밖 )
## 기능 구현 끝! 끝..?
```java
public PullRequestData getPullRequestListWithPageNumber(String repositoryLink, int perPageSize, int pageNumber) {  
    String requestLink = constructApiLink(repositoryLink, perPageSize, pageNumber);  
    log.debug("요청 링크:{}", requestLink);  
    PullRequestResponse[] response = restClient.get()  
            .uri(requestLink)  
            .accept(APPLICATION_JSON)  
            .retrieve()  
            .body(PullRequestResponse[].class);  
    log.debug("개수:{}, 응답 데이터:{}", response.length, response);  
    return new PullRequestData(response);  
}

public PullRequestInfo getUntilDeadline(String repositoryLink, LocalDateTime deadline) {  
    log.debug("레포지토리 링크:{}, 마감 기한:{}", repositoryLink, deadline);  
    LocalDateTime utcDeadline = convertUtc(deadline);  
    return new PullRequestInfo(Stream.iterate(1, page -> page + 1)  
            .map(page -> githubPullRequestClient.getPullRequestListWithPageNumber(repositoryLink, PAGE_SIZE, page))  
            .takeWhile(data -> !(data.isLastPage() || data.isAfterPage(utcDeadline)))  
            .flatMap(PullRequestData::responseToStream)  
            .filter(pullRequestResponse -> pullRequestResponse.isBefore(utcDeadline))  
            .collect(Collectors.toMap(PullRequestResponse::getUserId, Function.identity())));  
}
```

이와 같이, 
1. API 링크를 조립
2. API 요청 후, 데이터 수신
3. 데이터들을 Map 으로 만든 후, 이를 통해 실제 제출했는지 검증

> 이때, 위의 코드는 아래의 내용 뿐만이 아니라 재사용이 불가능하므로, 필연적으로 재사용 방법을 생각해내야 했다.

의 흐름으로 구현하였다. 끝일까? 아니다.
외부 API 를 호출하면, 단순히 파라미터 & 바디등 요청과 응답만 생각하는게 아닌 `호출이 계속 가능한지` 와 `호출에 실패하면 어떻게 해야 되는지` 에 대해서도 생각을 해야한다.
## 호출이 계속 가능한가
호출이 무한정 가능하지 않다.
깃허브는 `Rate Limit` 이 존재하기 때문이다.
https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api?apiVersion=2022-11-28#about-secondary-rate-limits

```
You can make unauthenticated requests if you are only fetching public data. Unauthenticated requests are associated with the originating IP address, not with the user or application that made the request.

The primary rate limit for unauthenticated requests is 60 requests per hour.
```

인증되지 않은 요청을 보낼 시, 시간 당 60번의 요청 까지 제한이다.

![](https://i.imgur.com/2ycYEvN.png)

요청을 60번 이상 날리면 위와 같이

- 403 rate limit exceeded
- Limit Remaining,Used - 제한 과 얼마나 남아있는지/사용했는지
- Reset - 언제 풀리는지

와 같이 정보를 알려준다.
60번은 너무 턱없이 작은데?

```
GitHub Apps authenticating with an installation access token use the installation's minimum rate limit of 5,000 requests per hour. If the installation is on a GitHub Enterprise Cloud organization, the installation has a rate limit of 15,000 requests per hour.

Primary rate limits for GitHub App user access tokens (as opposed to installation access tokens) are dictated by the primary rate limits for the authenticated user. This rate limit is combined with any requests that another GitHub App or OAuth app makes on that user's behalf and any requests that the user makes with a personal access token.
```

이와 같이, 인증된 사용자는 5000까지도 가능하다.
( 주의할 점은, PAT 마다 5000건이 아닌 유저를 기반으로 동작한다. )
## 호출을 늘려보기
5000 번 정도면 괜찮을 거 같은데?
( 물론, 충분히 괜찮다. 아직까지 트래픽도 없을 뿐더러, 시간당 5000건이므로 충분하나 조금 더 들어가는 것이다. )
### 여러개의 PAT 사용
여러개의 계정으로 된 PAT 들을 사용하면 된다! 매우 간단하다.

```yml
tokens:  
  - ghp_testToken1  
  - ghp_testToken2
```

application.yml 이나 파일에 이렇게 값을 넣으면

```java
public record PullRequest(List<String> tokens) {  
}
```

자동으로 배열로 값들을 받아온다.
팀원들 마다 PAT 를 발급해달라고 하면 `5000 * x` 와 같이 가능해진다.
### ETag 사용하기
팀원들마다 PAT 를 받더라도, 프로젝트가 엄청 성공하고, 다양한 레포지토리에서 미션이 이루어진다고 가정해보자.
우테코 프리코스 처럼 100개씩 요청을 받아와도, 22 페이지에 달한다면?

매번 요청을 보내면 받는 시간도 문제가 아니라 호출 횟수도 고갈이 되게 된다.
깃허브는 이런 API 재사용성을 위해서 ETag 를 제공한다.

> ETag 란?
> 서버가 리소스의 특정 상태를 식별하기 위한 식별자
> 이전 요청 데이터와 최신 데이터의 변경사항을 검증하게 해준다.

이 태그를 통해서 리소스의 변경 사항이 있는지, 없는지를 유무 가능하다.
태그를 `If-None-Match` 에 담아서 보내고 304 가 뜬다면, DB에서 값을 들고와서 그대로 사용하면 된다.

![600](https://i.imgur.com/CoWn4BA.png)

![600](https://i.imgur.com/jHpGTVK.png)

이렇게, 시간은 큰 차이가 나지 않으나 Size 가 비약적으로 줄어든 것을 볼 수 있다.
하지만, 이 마저도 더 최적화 할 수 있다.
### ETag Preflight
위처럼, Size 는 줄였으나, 데이터를 받지 않는데 요청과 비슷한 시간을 가지는 것이 매우 비효율적으로 느껴진다.
ETag를 좀더 효율적으로 사용해보자.

어차피, 처음에 ETag 를 기반으로 데이터의 최신화 유무를 확인한다.
그러면, ETag 를 `page=1 & per_page=1`  의 값을 저장후 해당 요청을 데이터를 받기 전 먼저 보내면 시간도 Size 도 줄일 수 있다.

![600](https://i.imgur.com/FYgJrgI.png)

시간도 1/4 배로 만든 것을 볼 수 있다!
## 데이터 최신화 갱신하기

이제, 그러면 ETag가 `Not Modified`가 아닌 200을 반환한다고 생각해보자.

 첫 번째 : `W/"72e044737d041387ecaa4790a8520e42cf447d5483fe58027984c46f31ab11e9"` -> `W/"e7d8bec70da75e6a8c650be1aab232e90d23085e581fd303d69037530385d54d"`

두 번째 : `W/"560bbfc631a843f03654258cf1e7c4aaca0c7e1635c823de9ff3c8a8aa024bd7"` -> `W/"db71f7719d23fe3b9fde1d068da1f2222d6f847e4de97ff90ff7921aebb7f07c"`

값이 새로 생성이 되면 처음부터 뒤까지 `ETag` 값이 계속 변경이 된다.
그러면, DB에 저장한다고 하더라도 어디까지 저장이 된지 어떻게 알 수 있지?
이를 알기 위해 각 칼럼들이 DB에 저장하기 전 존재하는지 묻는건 오히려 더 비효율적일 테니 말이다.

###  가장 최신화한 시간도 같이 저장하기
해당 부분부터는 아직 정답이 없는거 같다. ( 더 생각해봐야 할듯 )
생각한 방법으로는 ETag 와 같이, 최신화 한 날짜를 저장하는 것이다.

- 그 시간 이전의 PR 까지는 가져와서 저장한 것을 보장한다.
- DB와 여러번의 호출을 하지 않고, 애플리케이션단과 API 호출에서 중복 검증이 가능하다.

### PR 총 개수 저장하기
```
https://api.github.com/repos/woowacourse-precourse/java-baseball-6/pulls?page=9999&per_page=1
```

이와 같이 per_page 를 1로, page 를 존재하지 않는 값을 보내면
` <https://api.github.com/repositories/706422026/pulls?state=all&page=2813&per_page=1>; rel="prev", <https://api.github.com/repositories/706422026/pulls?state=all&page=2813&per_page=1>; rel="last", <https://api.github.com/repositories/706422026/pulls?state=all&page=1&per_page=1>; rel="first"`

Link 헤더를 이렇게 보내준다.
last 를 기반으로, 총 PR의 개수가 몇개인지 확인할 수 있다.
현재 총개수에서 기존의 총개수를 빼고 그만큼의 값만큼만 받아오게 하는것도 하나의 방법이다.

하지만, 역시 최신화한 시간과 같이 저장하는 방법이 타당한것 같다.
`Opened` 와 `Closed` 가 변한 값을 우리가 확인할 수 없기 때문이다. ( 어디서 Closed 가 된지, 어디서 Opened 가 된지 모름 )

---
## 결론
단순히 요청 기능 구현만 하면 끝날줄 알았지만, 깊게 파고 들 수록 끝이 없음을 느꼈다.
최대한 외부 API의 호출은 최소화 + 효율적으로 호출하는 방법을 생각해내야 한다.

그리고, 외부 API는 제어할 수 없는 것이므로 발생하는 분기들도 생각해야한다.

```
1. 기존에 데이터 에서는 `opened` 였으나, `closed` 를 했을시, 이 값들은 어떻게 하지..?
2. ETag 가 변하는 원리를 자세히 알려주지 않는데, 기존의 값이 closed 되서, ETag 가 변경시 혼선을 주게 되는 경우는 없을까?
```

위에 대한 내용은 팀원들과 한번 더 애기해봐야 할 거 같다.
해당 내용들은 [2024-corea](https://github.com/woowacourse-teams/2024-corea) 에 적용될 내용들입니다.












