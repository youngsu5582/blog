---
title: "What is it like to use a service that real users use? - Retrospective"
author: 이영수
date: 2024-11-05T14:50:36.577Z
tags: ['Real User', 'Wooteco', 'Project', 'Retrospective']
categories: ['Retrospective', '2024']
description: "Can users replace the wheels of a car traveling at 180km/h?"
image:
  path: https://velog.velcdn.com/images/dragonsu/post/101929c4-58b7-4e43-91e5-bd28baa2c797/image.png
lang: en
permalink: /posts/what-is-it-like-to-use-a-service-that-real-users-use-retrospective
---

> This post has been translated from Korean to English by Gemini CLI.

This article is a retrospective on my experiences while working on the project.
If you have any questions, please leave a comment or contact me at joyson5582@gmail.com!

---

Currently, our team is test-operating a project targeting prospective 7th-term students of Woowa Brothers Tech Course.

```
Code Review Matching Platform
The puzzle of development growth completed with CoReA: Code, Review, and You

CoReA (Code-Review-Area) is a mission code review matching platform.
We create 'growth together' through code reviews and mutual feedback.

- Repository Link: https://github.com/woowacourse-teams/2024-corea
- Site Link: https://code-review-area.com/
```

![500](https://i.imgur.com/sQZkq9b.png)

(This is the user growth rate. We have now exceeded 300 users! 🙇‍)

As such, I was able to have a valuable experience developing a project and welcoming users.
Now, I will write about what I felt while operating a service with such users.

## The mindset for static feature development and dynamic feature development is different.

It was very easy to develop features for a project with given requirements.
I just had to create a new package, and then create `controller`, `service`, and `domain` packages in it and add them.

However, I felt that additional requirements, which were not initially thought of as feature development, caused great difficulty.
Most of them are modifications and additions to existing code. It becomes very difficult if you don't have a good understanding of the code you need to work on.

And it's very busy. If before it was just feature development, now additional tasks such as `server management`, `feature modification`, and `error handling` have arisen.
On top of that, I also have to reflect feedback and develop desired features.

## There is no code without a story ⭐️

I felt this in many parts.
What I learned most meaningfully during Levels 1-2 was object-oriented code and clean code.
However, the project could not perfectly take care of this.

### Code always runs away

Requirements do not wait for development time.
Everyone knows that this is not the best, but if you make an RC (Request Change), you cannot meet the deadline.
This code continuously accumulates.
At some point, the next person in charge will not want to touch the code.
- Lack of understanding of the function because I didn't write it.
- The code is dirty and tests are weak.

I asked the coaches and former reviewers about this, but the conclusion I reached was:
"It seems that we should tolerate a certain degree of dirtiness, but when the threshold approaches, the person who feels the dirtiness should refactor." 

> In particular, I think I had the thought, `Is it possible to do a pit stop`, which is to stop all feature development and proceed?
> Therefore, I also felt that `changing a rolling wheel`, which is to continuously develop a service with actual users, truly helps a developer's growth.
> (Even for a single feature, I am more careful + pay attention to ensure that existing code does not cause problems.)

### Object-oriented is not DB-oriented.

As I said above, Levels 1 and 2 were a series of object-oriented code.
I tried to write the code as object-oriented as possible in the project as well.

However, I felt some regret in several places while `testing indexes` + `analyzing queries` for DB performance improvement requirements.
- N+1 occurs in various places where entities have other entities.

```java
public void participate() {  
    if (memberRole.isReviewer()) {  
        room.increaseReviewerCount();  
        return;    
        }  
    if (memberRole.isBoth()) {  
        room.increaseBothCount();  
    }  
}
```

(If you think there's another correct answer? `There's no code without a story.` 🥲)

- It does not help improve performance.

I tried to make objects have variables that fit the object.
I thought, "It's natural for a room to have its own status, deadline, and development field (Android, backend, etc.)."
However, I felt great difficulty in improving the performance of such data through indexes. (Especially, there was no significant reduction. 😭)

> Of course, I don't know if this can be clearly solved through entity separation and JOIN.

Ultimately, I felt that it was as important as object-orientation to consider how an entity would operate.
(To solve this, separating entities - domains like DDD might be a good method. ☺️)

## Lack of Testing, QA

Busy schedules led to insufficient testing and QA.
In fact, it might be more accurate to say that I failed to perform perfect tests on more complex features and added features, rather than just busy schedules.

This time, I realized that among the logics,
there was a logic that completed code review -> moved to the development feedback writing page for the corresponding target.
Here, the frontend caused an error where `undefined` occurred because it fetched a value from a wrong State, making it unable to render the page.
I checked for problems on the development server, but a problem occurred in conjunction with the logic that was added recently: `If you don't leave feedback for the other person, it will be masked.`

The most important problem occurs here.

## There must be a quick communication channel with users.

This error was not detected by the project team members,

![350](https://i.imgur.com/NDAQzAB.png)

![350](https://i.imgur.com/0cScmMI.png)

We found out after users submitted problems.
In particular, there might be users who encountered errors without directly contacting us. 😭😭 (I'm sorry,,)

Additionally, this is also a recent error where `entities created when participating in a review room`
caused `NonUniqueResultException` because only one person out of 394 had 3 duplicate entities.
(I haven't figured out the exact cause yet 🥲)

![500](https://i.imgur.com/eYaFqiG.png)

I checked the logs for this content, but there was no way to contact the user.
So, I informed them of the error reason + resolution plan via GitHub comments.

For these reasons, I felt the need for a clear and quick communication channel.
We used to receive contacts through Google Forms, but we felt that Google Forms were not suitable as a communication channel.
- Fast two-way communication is not possible. (Because it has to be sent via email)
- It is difficult to explain specific cases at once.

Currently, we have an open chat room for quick communication.

## The server is surprisingly robust.

Before launching the service, my biggest fear was, `What if the server crashes...?`
To prepare for this, I even created a spare instance just in case and continuously monitored it after promotion.

Despite such worries, the server has not crashed yet. 🥲

> To briefly explain the infrastructure,
> it is load-balanced through ALB,
> and consists of one small type and one micro type.
> The DB is separated into Reader-Writer through RDS.

First, for heap memory,

Based on `small`
![500](https://i.imgur.com/7PIaOmU.png)

It approached an average of 30%.

Based on `micro`
![500](https://i.imgur.com/dHfzM3A.png)

It approached an average of 50-60%.

![500](https://i.imgur.com/eMBwFh2.png)

Requests also showed stable peaks, except for those using external APIs (login, review completion).
Even in load tests, `Connection Timeout` occurred due to too many requests, but no server crashes were found.

> We haven't applied optimizations like indexing and caching yet.
> As a result of index tests, when about 1 million data were inserted, we saw a performance improvement of about 3 seconds -> 0.5 seconds,
> but there were many parts where I wondered if this was really necessary.
> (Because 1 million data are not generated at once.)

(It seems okay to complete and launch the feature without too much fear ☺️)

## Reduce time spent on non-functional tasks.

This is a part I paid a lot of attention to. It was about improving `developer productivity`.

Developers actually don't just develop features. They do a lot of things in a project.

- Meetings on how to set policies (EX: Should feedback be shown after the room is finished?)
- How to promote the project, how to recruit reviewers
- What features to implement and how to distribute roles
- Pair programming with frontend (how to handle API DTOs, paths, etc.)
- Checking data, server deployment status, and logs

(In addition, I was buried in the mission requirements given by the coaches...)

In this way, I do a lot of internal/external development work.
So, I tried and made efforts to reduce the time spent on non-functional tasks in many areas.

```
I couldn't help but complain and repeat tasks like, "Isn't this unavoidable?" and "Do I have to do it again? It's too annoying."
I believe that repeated tasks waste team members' time and energy, and ultimately reduce project productivity.

Therefore, I tried and performed various tasks to improve developer productivity.
```

At first, I also had thoughts like, `Is it really necessary?` and `The return on effort is not good.`
However, I think that all these things accumulated and became decisive tools that saved team members' time.

1. [Choosing CI & CD Strategy (Subtitle: CodePipeline Usage)](https://velog.io/@dragonsu/CI-CD-%EC%A0%84%EB%9E%B5-%EC%84%A0%ED%83%9D%ED%95%98%EA%B8%B0-%EB%B6%80%EC%A0%9C-CodePipeline-%EC%82%AC%EC%9A%A9%EA%B8%B0) - July 27, 2024
2. [Creating My Own Workflow File (Subtitle: Issue-based PR Auto Generator)](https://velog.io/@dragonsu/%EB%82%98%EB%A7%8C%EC%9D%98-Workflow-%ED%8C%8C%EC%9D%BC-%EB%A7%8C%EB%93%A4%EA%B8%B0-%EB%B6%80%EC%A0%9C-%EC%9D%B4%EC%8A%88-%EA%B8%B0%EB%B0%98-PR-%EC%9E%90%EB%8F%99-%EC%83%9D%EC%84%B1%EA%B8%B0) - July 28, 2024
3. [JPA Query Interception: Inspecting Queries in All Controller Methods](https://velog.io/@dragonsu/%EC%BF%BC%EB%A6%AC-%EA%B0%80%EB%A1%9C%EC%B1%84%EA%B8%B0-%EB%AA%A8%EB%93%A0-%EC%BB%A8%ED%8A%B8%EB%A1%A4%EB%9F%AC-%EB%A9%94%EC%86%8C%EB%93%9C-%EC%BF%BC%EB%A6%AC-%EA%B2%80%EC%82%AC) - August 18, 2024
4. [Learning GitHub from Basics (3) - Improving Efficiency with Custom Commands](https://velog.io/@dragonsu/%EA%B9%83%ED%97%88%EB%B8%8C-%EA%B8%B0%EC%B4%88%EB%B6%80%ED%84%B0-%EC%8B%9C%EC%9E%91%ED%95%98%EA%B8%B03-%EC%BB%A4%EC%8A%A4%ED%85%80-%EB%AA%85%EB%A0%B9%EC%96%B4%EB%A5%BC-%ED%86%B5%ED%95%B4-%ED%9A%A8%EC%9C%A8%EC%84%B1-%ED%96%A5%EC%83%81%ED%95%98%EA%B8%B0) - August 30, 2024
5. [Monitoring Journey (2) - Prometheus, Loki, Grafana Installation & Connection](https://velog.io/@dragonsu/%EB%AA%A8%EB%8B%88%ED%84%B0%EB%A7%81-%EC%9D%B4%EB%8F%99%EA%B8%B02-%ED%94%84%EB%A1%9C%EB%A9%94%ED%85%8C%EC%9A%B0%EC%8A%A4%EB%A1%9C%ED%82%A4%EA%B7%B8%EB%9D%BC%ED%8C%8C%EB%82%98-%EC%84%A4%EC%B9%98-%EC%97%B0%EA%B2%B0) - September 22, 2024
6. [Creating Fake Data for Data Testing - Bash Script](https://velog.io/@dragonsu/%EB%8D%B0%EC%9D%B4%ED%84%B0-%ED%85%8C%EC%8A%A4%ED%8A%B8%EB%A5%BC-%EC%9C%84%ED%95%9C-%EA%B0%80%EC%A7%9C-%EB%8D%B0%EC%9D%B4%ED%84%B0-%EB%A7%8C%EB%93%A4%EA%B8%B0-Bash-%EC%8A%A4%ED%81%AC%EB%A6%BD%ED%8A%B8) - October 8, 2024
7. [Meaningful PR Merge Notifications with Naver PR Stats Workflow](https://velog.io/@dragonsu/PR-%EB%B3%91%ED%95%A9%EB%95%8C-%EC%95%8C%EB%A6%BC-%EB%B0%9B%EB%8A%94-%EB%82%B4%EC%9A%A9%EC%9D%84-%EC%9D%98%EB%AF%B8%EC%9E%88%EA%B2%8C-with-naver-pr-stats-%EC%9B%8C%ED%81%AC%ED%94%8C%EB%A1%9C%EC%9A%B0) - October 13, 2024
8. [When the Server Deploys, Slack Notifications with Deployment Results and Commits? with AWS CodePipeline](https://velog.io/@dragonsu/%EC%84%9C%EB%B2%84%EA%B0%80-%EB%B0%B0%ED%8F%AC%EB%90%98%EB%A9%B4-%EC%8A%AC%EB%9E%99%EC%9C%BC%EB%A1%9C-%EB%B0%B0%ED%8F%AC-%EA%B2%B0%EA%B3%BC%EC%99%80-%EB%B0%B0%ED%8F%AC%ED%95%9C-%EC%BB%A4%EB%B0%8B%EA%B9%8C%EC%A7%80-with-AWS-CodePipeline) - November 4, 2024

As a result of continuous efforts like this, I was able to work very efficiently in many areas.
(If you go into the contents, they are all things that can be sufficiently introduced within the team.)

`+` It's also one of the advantages to hear positive feedback within the team. 🙂

Currently,

![600](https://i.imgur.com/bCnMwo7.png)

As such, we are creating a data dashboard that is easy for frontend developers to view.

## Conclusion

This concludes a very long article.
I started this project in July and it's now nearing its end, and I've had a really fun and valuable experience.

What made me happiest was realizing `how to do it in the real world` from Level 2 onwards.
(In particular, finding precedents to see if email information is also recognized as personal information will be a very new experience. ☺️)

Among them, the biggest realization is that `everything doesn't have to be perfect` when launching a project.
When I first launched the service, I had many worries such as `index optimization is not done...` `features are lacking...` `there is no monitoring alert system...`.
However, despite these worries, the project somehow works. (There are still many parts that need improvement and application.)

And, I felt that I could truly grow when creating a project with users.
Let's move forward to satisfy and make even one user happy! 🫡

Thank you again for reading this long article. 🙇‍♂️
## Appendix

This content is a brief reflection, so I left it as an appendix.
(It's really without any standards, purely my opinion.)

### Is domain-based packaging okay?

Our team used a `domain package structure`. (Each domain package owns `service`, `controller`, `domain`)
At first, I thought it would allow me to use the domain more completely and make the structure flexible. (Separation through inter-domain packages)
However, at some point, they became mixed, and some were located in one domain, and others in another.
From this perspective, I thought it might be a good idea to place all layers together. 🙂
(It's faster to find and you can simply use ambiguous concepts.)

### Does beautiful code make development faster?

As I said above, I don't think our current project has very beautiful code.
However, to solve this, "refactoring and redesign" inevitably takes time.
And, as feedback is received, features are modified and changed very frequently.
-> I'm still wondering how far to write beautiful code and how much time to spend.

### Is it okay for entities to have convenience columns?

Currently, entities have unnecessary columns.

```java
public class Room extends BaseTimeEntity {
    private int reviewerCount;

    private int bothCount;
	...
}
```

This can be solved by `count(*)`, but it's not an important value + I placed it because I didn't want to generate unnecessary queries.

```java
public class MatchResult extends BaseTimeEntity {
    @Enumerated(EnumType.STRING)
    private ReviewStatus reviewStatus;
    ...
}
```

This is solved by changing the Status without creating an entity called `Review`.
I think I need to learn more about these contents. 🥲

This is the end of the appendix~ If you have any opinions or thoughts about the appendix, please feel free to leave them 🫡








