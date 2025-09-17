---
title: "Ending a 3-Month Job Search"
author: 이영수
date: 2025-03-19T05:59:22.989Z
categories: ['Retrospective', '2025']
tags: ['backend', 'woowacourse', 'job search', 'retrospective']
description: "Lessons and growth from a 3-month job search. A summary of experiences and regrets from preparing for interviews, resumes, and coding tests after Woowacourse."
url_slug: ending-job-search
permalink: /posts/ending-job-search/
image:
  path: https://velog.velcdn.com/images/dragonsu/post/dc19b912-a470-4c28-8ef8-cba4276a6c21/image.png
permalink: /posts/ending-job-search/
---
Actually, I've finished a not-so-long job search.
After Woowacourse ended, I started job hunting in earnest around mid-December, so it took about 3 months to get a job.

This post is to write about the emotions I felt, the efforts I made, and the regrets I have from the past 3 months of job searching.

## December's Emotions

### Sadness

After the `Recruiting Day` held at Woowacourse in mid-November, my job search progressed very quickly.
About 2 weeks later, I received notifications that I had passed the document screening for `KCD`, `Toss Bank`, and `Woowa Brothers`.
The KCD interview was in person, while Woowa Brothers and Toss Bank were remote.

And the interview results?

![400](https://i.imgur.com/OlDP7e0.png)

![500](https://i.imgur.com/Uuu0kNw.png)

![500](https://i.imgur.com/kojpCz4.png)

I failed them all. In particular, I had interviews with all three companies in one week, and the results came in one after another over the course of a week.
At that time, I cried and had regrets.

```
Why, as the time for employment approached, did I not study for interviews or C.S.
and instead waste my time on projects or personal study...
```

![](https://i.imgur.com/tYct9wR.png)

### Anger & Envy

After the feeling of sadness subsided, anger welled up.

> Since I cannot talk about the interview and recruitment process, I will speak abstractly and refer to the overall experience, not a specific company.

`Why are they bringing the entity all the way up to the controller to filter -> remove??`
`What's the point of live coding to serialize and return JSON?`
`How am I supposed to know if Redis has GC? (I've never even used it)`

In particular, I had a lot of anger towards the HR process.

- Are they really able to hire people with skills or passion?
- Does not knowing the answer to a question hinder my ability to work at the company?
- There were reviews saying they look at your blog and GitHub, but there was none of that?

![](https://i.imgur.com/QtTFsva.png)

I wanted to showcase my in-depth stories from my project experience in the interview.
However, I was not asked such questions, or they moved on to other questions in less than 5 minutes.

I complained a lot to my Woowacourse crew members and people around me. And I felt envious of people.

Due to the nature of Woowacourse, there were many people around me who had been accepted to Toss Bank, Woowa Brothers, or DH (Delivery Hero).
Not everyone got a job (out of 80 backend developers, about 20 got a job almost immediately), but what can you do when you only see the successful people, like on Instagram.

I think I asked myself a lot of questions too. `Am I a failure?` `Am I not cut out to be a developer?`

## January's Efforts

Nevertheless, I had to get a job.

So, I applied to every new graduate position that came up on Wanted.

![500](https://i.imgur.com/SJkPZy3.png)

![500](https://i.imgur.com/1eofuvK.png)

And the results this time?

I failed all of them except for passing one coding test. (And I failed that coding test too.)
Honestly, it was a bit of a shock. I applied to places I had never even heard of just to get interview experience, and I failed all of them.

I thought I needed to make a conscious effort and improve.
### Metacognition & Resume Revision

Around early to mid-January, I took another look at myself.
Why I wanted to get a job as a developer, and what kind of company I wanted to work for.
This was because banks and large SI companies were also starting to have open recruitment at that time.

I had heard a lot of negative things about SI, but I wanted to work at a place that creates its own services.
I realized through projects that it's very fun to create and improve the services I use.
And that when a service grows, troubleshooting and 고민 arise, and the developer grows with it.

Additionally, I wanted to go to a place that has a culture for developers, at least on the surface. (`code reviews`, `in-house studies`, `education expense support`, etc.)
For these reasons, I didn't even apply to large SI companies like Autoever or Hanwha, or to banks. (Maybe it would have been okay for coding test practice...?)

Since my document screening pass rate was so low, I had to revise my resume as well.
I went to Woowacourse coach Lisa and asked her to look at the problems with my resume. The feedback I received was mainly in three areas.

- My strengths and appeal are not felt in my self-introduction.
- I used Figma, but there are many parts where the margins and alignment are broken.
- There are only simple numbers, and there is no explanation for them. (+ It's not concise either.)

> At that time, I got scolded for not being able to show my strengths 🙂


To briefly show my resume before the revision:

```
I am Lee Young-soo, a backend developer who grows through recording and conversation.

I am systematizing and developing my knowledge by organizing what I have explored on GitHub and my blog.
At 'Woowa Tech Course', I tried to gain a perspective on clean code and problem-solving through 841 conversations with industry professionals.
I enjoy saving my team members' time and increasing project efficiency by using automation tools.
I believe that the key to being a good developer is to find the optimal solution by analyzing various options and trade-offs.
```

This was my self-introduction, and

```
Asynchronous parallel implementation of GitHub API within the review completion logic - Blog post summary

Problem: The two requests operated synchronously, resulting in an average response time of 0.6-0.8 seconds, with a maximum of 2-3 seconds.
Solution: As a result of measurement, the most efficient asynchronous execution of the two requests + synchronous selection of the pagination API was chosen.
Result: After implementation, the metric measurement result showed an average API time of 0.4-0.5 seconds and a 33% reduction.
```

The project description consisted of numerical content, but no explanation of the why.

Based on the feedback,

1. Switched my resume to Rallit - Since basic templates are provided, I only need to focus on the content. (I don't think developers should use Figma. 🥲)
2. Made my self-introduction interesting to people.
3. Made the project content concise but containing the reasons and actions.

I revised my resume as follows.

![500](https://i.imgur.com/VTfaGnP.png)

In my self-introduction, I included specific experiences and content that people could look up if they were curious.

![500](https://i.imgur.com/j3SOxfw.png)

I wrote the project content to include `numbers`, `reasons`, and `actions`.

### C.S & Coding Test

To be honest, I still don't know why `C.S` and `coding tests` are the criteria for hiring developers.
(Maybe my thoughts will change after I start working?)

My own reasoning is:

C.S is actually composed of 7-8 subjects (Operating Systems, Databases, Networks, Algorithms, Data Structures, Programming, Java, Spring).
I don't know if I can answer everything perfectly when asked a question out of the blue, and I don't know if it's meaningful to truly memorize all of this.

(Do you know how many bytes a Java ENUM is? What is two's complement?)

> I have my own realization about this, which I will write more about below.

For coding tests, I don't know about the mid-gold level, but above that,
I don't know if it's meaningful to have an algorithm that you can never solve if you don't know it, or if your first approach is correct, or if you're in good condition that day.

However, since most companies' HR follows this, I have to follow it.

> Lead, follow, or get out of the way! - 11 ways to work better in Songpa-gu

For C.S, I prioritized learning as broadly as possible in a BFS format.
This was to be able to answer the first question as perfectly as possible.

```
Q: What do Equals & HashCode do in Java?
A: I understand that they are used to determine the equality of objects.

Q: So where are they used?
A: I understand that they are used to identify in Hash elements or collections.

Q: Can you explain Hash in more detail?
A: I learned that Hash is a means of retrieving data in a short time of O(1).

Q: How is Hash used in Java?
A: I know there is something called System.identityHashCode, and I remember that it gives a unique value that does not overlap.

Q: So, how is that IdentityHashCode determined?
A: From what I've learned, I remember that the value is determined based on the address value of the virtual memory. Is my explanation correct?
Q: ...
```

I think it's okay if I can't answer the follow-up questions that go on for 2 or 3 times.

> At this time, I also think that the context of `From what I've learned...` & `It's been a while since I learned it, so I don't remember it well, but is it okay if I tell you what I remember?` is more important than just saying I don't know.

![600](https://i.imgur.com/sXfCbo5.png)

I organized the elements I didn't know well one by one like this.

And, after Woowacourse ended, I participated in an algorithm study group called [Almumol](https://github.com/hjk0761/Almumol) with the crew members.
It was a study group where we solved algorithm problems steadily every week, and I wanted to develop the habit and consistency of solving problems.

1. Learned basic algorithms.
2. Repeatedly solved problems from [Coding Test Problem Type Summary](https://velog.io/@pppp0722/%EC%BD%94%EB%94%A9%ED%85%8C%EC%8A%A4%ED%8A%B8-%EB%AC%B8%EC%A0%9C-%EC%9C%A0%ED%98%95-%EC%A0%95%EB%A6%AC) - The problems are well organized by category needed for coding tests.
3. Solved random defense problems & solved problems provided by Aru-sensei in a bundle.

There is no right answer to this part, but
- Not losing your touch: Being able to identify the direction and approach any problem that comes up.
- Being certain: Being able to solve any pattern or type of problem you have solved before.
I think this is really important.

## February's Regrets

As I revised my resume, my document screening pass rate increased quite a bit.

![600](https://i.imgur.com/E78qGll.png)

Thankfully, I had 5 interviews scheduled over 2 weeks.

There were both remote and in-person interviews. There were also various numbers of interviewers, such as 1-on-1, 2-on-1, and 3-on-1.

I'm going to write about the regrets I had about myself while experiencing the interviews.

### What are startup interviews like?

Startup interviews were not all about technical interviews.
Of course, it was written as a technical interview, and they asked about technology, but that wasn't everything.

- Why did you apply to our startup?
- Have you ever used our product?
- How can you improve the service?

Questions related to the company also came up frequently.
This was because the backend leader who leads the entire backend or the CTO would come out.

`I applied because the new graduate position was posted on Wanted..?` Isn't that too lame?
Whether it's a technical interview or a culture interview, I think it's good to go with basic information about the company and a service analysis. (Of course, there are companies that don't do this.)

Based on this, it would be possible to prepare for follow-up questions or keywords that might come up in advance.

### Interviews are cold.

There were also very cold and meaningless interviews.

```
A: We wanted a developer with 3 years of experience.

B: 😳😳 Then, why did you want to interview me?

A: I heard that Woowacourse students are good, so I called you for an interview, but it seems you lack a lot of experience.
```

```
A: Why do you use a disk DB when a memory DB has better performance?

B: I haven't used a memory DB, so I don't know for sure, but could I get a little hint?

A: I don't know either, so I'm asking because I'm curious. Please answer what you know.

B: I think a disk DB has its own advantages. For example, there might be security issues or volatility issues.

A: I think you have some incorrect information. The cost issue would be the number one priority. (blah blah blah)
```

> These are dramatized versions of the content.

I was very flustered when I experienced this.
I was advised never to apologize, so I didn't, but
it felt like a time for making excuses, not a time to appeal my charm.

If I were to experience this situation again, I think I would push back.

`What do you think is the standard for 3 years of experience?`, `Since there are no hints, I think this part is the most important.`

I'm not saying you should pick a fight with the other person, but you should try to understand their role and intention somehow.

### Interview Study and Retrospective

This is the part I regret the most while interviewing.

Most interviews do not go as intended. The other person is not a GPT. (It doesn't go the way I want.)

> I think the most important skill in an interview is actually to cook yourself and induce questions.

You need `quick-wittedness` to be able to answer well when you receive a question you didn't expect.
You need to `check` if your answer is valid and what kind of questions the other person asks based on your answer.

```
Q: Have you used Spring JDBC?
A: No. I've only used it in missions where we use JDBC and then switch to JPA.
Q: Then, what is the difference between PreparedStatement and Statement?
A: Uh... I haven't used either of them. (Actually, I used it in the JDBC mission lol)
Q: Okay. Well. I see.
A: But, if I infer from the keywords, I think PreparedStatement helps to prepare something.
So, I think it would do things like injecting values or preventing SQL Injection.
I think Statement would only do simple query work without those functions.
By any chance, was my explanation and approach correct...?

```

> This is what I actually answered.
> I also felt that quick-wittedness is important, and that they are not looking for perfect C.S knowledge, but rather the process of reasoning and approaching. (A reflection on why they want C.S questions)

For this, the most important thing is that the other person is meaningful as a subject for an interview study.
I think about how helpful it would be for job seekers who have never had an interview to do an interview study together.

You only know the depth of the questions, the scope of the questions, and the thoughts on the answers after you have experienced an interview.
If two frogs in a well talk about the world, can they accurately describe the world?

> The key is not whether you have had an interview, but whether doing it with the other person can be helpful to each other.
> If you don't have a suitable interview study partner, I think it's a good idea to find a service like Inflearn and experience paid interview preparation.

After the interview is over, I think it's essential to organize the questions and do a self-retrospective on the interview.
Wouldn't it be too unfair to make the same mistake again on a question you received, similar to a coding test?

- Please explain how the Dispatcher Servlet is configured - [Do we use the DispatcherServlet?](https://youngsu5582.life/posts/DispatcherServlet-%EC%9D%84-%EC%9A%B0%EB%A6%AC%EA%B0%80-%EC%82%AC%EC%9A%A9%ED%95%98%EB%82%98%EC%9A%94/)
- Why are multiple thread pools necessary? - [Threads, Thread Pools in Java (Why are multiple thread pools better than a single thread pool?)](https://youngsu5582.life/posts/%EC%8A%A4%EB%A0%88%EB%93%9C%EC%8A%A4%EB%A0%88%EB%93%9C%ED%92%80-in-Java/)

I learned how to answer the questions and organized the flow of the interview.

## March's Me to Past Me

I was lucky enough to get a job and my job search is over.

> As an aside, the interview was a 3-on-1 in-person interview for 4 hours... 💀

I got a job at one of the companies from the interview schedule above.

![500](https://i.imgur.com/FbXtmM4.png)

If I could say something to people like me who felt anxious and stressed every day? (꼰대 moment)
### You only need to get into one company that fits you well.

Every company will have a different ideal candidate. (Even in the same affiliate, even on the same team, and even depending on the interviewer and the role of the interviewer.)
You don't have to be a 100% match for everyone.

Some companies may see as their ideal candidate someone who

- tries to solve a problem somehow when they receive a topic they don't know
- just answers perfectly
- admits what they don't know and talks about what they have learned

And some companies may focus on

- interesting content in the resume, regardless of the blog or GitHub
- the technology and domain used by the company
- content that shows your efforts, such as a blog or GitHub

Don't blame yourself too much even if you mess up an interview. Even if your self-esteem doesn't drop, your confidence might.
As coach Jason said, `Don't forget. The company you passed is a company you can afford to fail.`

### Conscious Effort

I also left this in a [previous post](https://velog.io/@dragonsu/2024-%ED%9A%8C%EA%B3%A0-%EC%9A%B0%ED%85%8C%EC%BD%94%EB%A5%BC-%EB%A7%88%EB%AC%B4%EB%A6%AC%ED%95%98%EB%A9%B0), but I felt it even more while job searching & finishing.

The result may not be good. However, the methods used for that result (resume, project experience, coding test skills, etc.) should not be reused.
It's similar to the `interview study and retrospective` part, but

- You lack project experience? - I started a side project. - [Lotto service available with cards and simple payment](https://github.com/youngsu5582/lotto)
- You don't have many projects that have actually been deployed? - I deployed a side project 2 days after the interview. [Deploying with only the free tier](https://youngsu5582.life/posts/%ED%94%84%EB%A6%AC%ED%8B%B0%EC%96%B4%EB%A1%9C%EB%A7%8C-%EB%B0%B0%ED%8F%AC%ED%95%B4%EB%B3%B4%EA%B8%B0/) , [Deployed service address](https://lotto.web.youngsu5582.life/)

There is something that people often say.
`Let's do it 'well', not 'hard'`
It's a controversial statement, but I strongly agree.

These days, the developer market is very cold, and I think that in order to get into the company you want, a `conscious effort` to do well is inevitable.

Let's think about whether you want to do endless professional learning or get a job.
-> Most people will naturally be the latter.

Then, you have to start job hunting right away. (Not from tomorrow, but as soon as you become conscious of it.)
There is no end to studying. If you really study everything and then try to get a job, you will never get a job.

=> You have to operate on two tracks.

You must constantly verify and improve whether your current efforts are recognized.

> I also used to really like deep dives and exploration.
> Deep dives like checking all the code while debugging the internals of an interface, or how the Object Layout is in Java,
> and exploration of keywords like what is an acceptance test, what is an integration test, what is BDD
> -> It will definitely be helpful, but is it the number one priority for getting a job as a developer? You need to be skeptical about that.

However, let's not completely stop what you were doing before.
It's a `two-track` approach. I think it's absurd for a developer to give up `development` to get a job.

While preparing for coding tests, CS, resume revisions, and interviews, I did [review activities](https://github.com/next-step/spring-basic-roomescape-playground/pulls?q=is%3Apr+reviewed-by%3Ayoungsu5582+) and side projects to maintain my coding sense.
Let's not give up on growth for the sake of the basics (coding tests, CS...).

### You can do it

I felt that I was not taking care of my health and life myself.

- A life pattern of sleeping at 2 am and waking up around 9 am
- Early symptoms of carpal tunnel syndrome from sitting at a desk every day and looking at a monitor or typing on a keyboard
- Even on weekends, the greatest happiness was studying at a cafe for rest, not going out to play

These times were not at all unhelpful in getting accepted.

However, I don't think it helped me grow as a person. This is because if the job search had been longer, it would not have been a sustainable life at all.
(Why do you try to make code sustainable for growth, but not look back on yourself?)

Even if you live diligently, I hope you don't lose yourself.
- Set short-term goals, decide on rewards for those goals, and work hard to achieve them.
- Do your best, and even if the results are not good, don't blame yourself, but regroup and move forward again.

## Conclusion

Currently, I am planning to transfer my personal blog (I plan to move my blog to [Lee Young-soo's Development Blog](https://youngsu5582.life/)), organize what I have learned, and plan a trip.
Now that I have to start anew, I will take a short break and then move forward again.

I applied to about 30 companies and had 8 interviews. I think they were all valuable experiences that made me a more growing developer.

As I realized my shortcomings and what I missed during the interviews, I learned hard skills, and I felt the importance of soft skills, such as speaking concisely but conveying meaning.

Next time, I think it will be a retrospective as a new junior developer. 🙂


Thank you for reading this long post~
