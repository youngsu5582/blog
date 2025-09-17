---
title: "Preventing Repeated Calls with ETag Preflight during GitHub API Request Implementation"
author: 이영수
date: 2024-08-26T15:58:29.228Z
tags: ['ETag', 'GitHub', 'External API', 'Wooteco']
description: "How to cache external APIs"
image:
  path: https://velog.velcdn.com/images/dragonsu/post/9cb4ea53-5003-4e49-b952-907ce2c269ed/image.jpeg
lang: en
permalink: /posts/github-api-request-etag-preflight-prevent-repeated-calls/
---

> This post has been translated from Korean to English by Gemini CLI.

These contents were implemented based on my personal thoughts.
If there are any incorrect parts or opinions, please leave a comment or contact me at joyson5582@gmail.com! 

Currently, while implementing a feature, a function that needs to call the GitHub API has emerged.

This is a method to verify whether applicants actually participated in the mission before matching them for code reviews.
We decided to verify participation in the mission based on whether a PR was submitted to the mission repository. (Of course, it might have been submitted as an empty PR... - that's beyond our scope)
## Feature Implementation Done! Done..?
```java
public PullRequestData getPullRequestListWithPageNumber(String repositoryLink, int perPageSize, int pageNumber) {  
    String requestLink = constructApiLink(repositoryLink, perPageSize, pageNumber);  
    log.debug("Request Link:{}", requestLink);  
    PullRequestResponse[] response = restClient.get()  
            .uri(requestLink)  
            .accept(APPLICATION_JSON)  
            .retrieve()  
            .body(PullRequestResponse[].class);  
    log.debug("Count:{}, Response Data:{}", response.length, response);  
    return new PullRequestData(response);  
}

public PullRequestInfo getUntilDeadline(String repositoryLink, LocalDateTime deadline) {  
    log.debug("Repository Link:{}, Deadline:{}", repositoryLink, deadline);  
    LocalDateTime utcDeadline = convertUtc(deadline);  
    return new PullRequestInfo(Stream.iterate(1, page -> page + 1)  
            .map(page -> githubPullRequestClient.getPullRequestListWithPageNumber(repositoryLink, PAGE_SIZE, page))  
            .takeWhile(data -> !(data.isLastPage() || data.isAfterPage(utcDeadline)))  
            .flatMap(PullRequestData::responseToStream)  
            .filter(pullRequestResponse -> pullRequestResponse.isBefore(utcDeadline))  
            .collect(Collectors.toMap(PullRequestResponse::getUserId, Function.identity())));  
}
```

As such,
1. Assemble API link
2. After API request, receive data
3. Create data as a Map, and then verify actual submission through it

> At this time, the above code is not reusable in addition to the content below, so I inevitably had to come up with a reuse method.

It was implemented in the flow of. Is it the end? No.
When calling an external API, you should not only think about requests and responses such as parameters & body, but also `whether calls can continue` and `what to do if calls fail`.
## Can calls continue?
Calls cannot be made indefinitely.
This is because GitHub has a `Rate Limit`.
https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api?apiVersion=2022-11-28#about-secondary-rate-limits

```
You can make unauthenticated requests if you are only fetching public data. Unauthenticated requests are associated with the originating IP address, not with the user or application that made the request.

The primary rate limit for unauthenticated requests is 60 requests per hour.
```

When sending unauthenticated requests, the limit is up to 60 requests per hour.

![600](https://i.imgur.com/2ycYEvN.png)

If you send more than 60 requests, it will inform you of information such as:

- 403 rate limit exceeded
- Limit Remaining, Used - how much is left/used of the limit
- Reset - when it will be reset

60 is too small, isn't it?

```
GitHub Apps authenticating with an installation access token use the installation's minimum rate limit of 5,000 requests per hour. If the installation is on a GitHub Enterprise Cloud organization, the installation has a rate limit of 15,000 requests per hour.

Primary rate limits for GitHub App user access tokens (as opposed to installation access tokens) are dictated by the primary rate limits for the authenticated user. This rate limit is combined with any requests that another GitHub App or OAuth app makes on that user's behalf and any requests that the user makes with a personal access token.
```

As such, authenticated users can make up to 5000 requests.
(Note that it operates based on the user, not 5000 requests per PAT.)
## Increasing Calls
5000 times should be enough, right?
(Of course, it's perfectly fine. There's no traffic yet, and it's 5000 requests per hour, so it's enough, but I'm going a little deeper.)
### Using Multiple PATs
You can use PATs from multiple accounts! It's very simple.

```yml
tokens:  
  - ghp_testToken1  
  - ghp_testToken2
```

If you put values like this in application.yml or a file,

```java
public record PullRequest(List<String> tokens) {  
}
```

Values are automatically received as an array.
If you ask each team member to issue a PAT, it becomes possible like `5000 * x`.
### Using ETag
Even if each team member receives a PAT, let's assume the project is a huge success and missions are carried out in various repositories.
Even if you receive 100 requests like Wooteco's pre-course, what if it reaches 22 pages?

If you send requests every time, not only is the receiving time a problem, but the number of calls will also be exhausted.
GitHub provides ETag for API reusability.

> What is ETag?
> An identifier for the server to identify a specific state of a resource.
> It allows verification of changes between previous request data and the latest data.

Through this tag, it is possible to determine whether there are changes to the resource.
If you send the tag in `If-None-Match` and get a 304, you can fetch the value from the DB and use it as is.

![600](https://i.imgur.com/CoWn4BA.png)

![600](https://i.imgur.com/jHpGTVK.png)

As you can see, the time difference is not significant, but the Size is dramatically reduced.
However, even this can be further optimized.
### ETag Preflight
As above, the Size is reduced, but it feels very inefficient to have a similar time to the request without receiving data.
Let's use ETag more efficiently.

Anyway, at first, we check whether the data is up-to-date based on ETag.
Then, if we save the value of `page=1 & per_page=1` for ETag and send that request first before receiving data, we can reduce both time and Size.

![600](https://i.imgur.com/FYgJrgI.png)

You can see that the time has also been reduced by 1/4!
## Updating Data

Now, let's assume that ETag returns 200 instead of `Not Modified`.

 First: `W/"72e044737d041387ecaa4790a8520e42cf447d5483fe58027984c46f31ab11e9"` -> `W/"e7d8bec70da75e6a8c650be1aab232e90d23085e581fd303d69037530385d54d"`

Second: `W/"560bbfc631a843f03654258cf1e7c4aaca0c7e1635c823de9ff3c8a8aa024bd7"` -> `W/"db71f7719d23fe3b9fde1d068da1f2222d6f847e4de97ff90ff7921aebb7f07c"`

When a new value is created, the `ETag` value keeps changing from beginning to end.
Then, even if it's saved in the DB, how do we know how far it's saved?
Asking whether each column exists before saving to the DB would be even more inefficient.

### Also save the latest updated time
From this part, there seems to be no correct answer yet. (Need to think more)
The method I thought of is to save the latest updated date, similar to ETag.

- It guarantees that PRs before that time are fetched and saved.
- It is possible to perform duplicate verification at the application level and API calls without making multiple calls to the DB.

### Saving the total number of PRs
```
https://api.github.com/repos/woowacourse-precourse/java-baseball-6/pulls?page=9999&per_page=1
```

If you send a non-existent value for `page` and `per_page` as 1 like this,
` <https://api.github.com/repositories/706422026/pulls?state=all&page=2813&per_page=1>; rel="prev", <https://api.github.com/repositories/706422026/pulls?state=all&page=2813&per_page=1>; rel="last", <https://api.github.com/repositories/706422026/pulls?state=all&page=1&per_page=1>; rel="first"`

It sends the Link header like this.
Based on `last`, you can check the total number of PRs.
One method is to subtract the existing total from the current total and fetch only that amount.

However, saving it along with the latest updated time seems to be a valid method.
This is because we cannot see the changed values of `Opened` and `Closed`. (We don't know where it was Closed or Opened)

---
## Conclusion
I thought that simply implementing the request function would be the end, but the deeper I delved, the more I felt that there was no end.
We need to minimize external API calls + come up with efficient calling methods.

And, since external APIs are uncontrollable, we need to consider the branches that occur.

```
1. If the data was `opened` previously, but `closed` now, what should we do with these values..?
2. The principle of ETag changing is not explained in detail, so if the existing value is closed and ETag changes, will it cause confusion?
```

I think I need to discuss the above with my team members again.
These contents will be applied to [2024-corea](https://github.com/woowacourse-teams/2024-corea).












