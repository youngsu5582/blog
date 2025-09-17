---
title: "Wootech Course Level 2 Retrospective (Quite Long)"
author: 이영수
date: 2024-06-18T05:09:00.427Z
tags: ['Wootech Course', 'Retrospective']
categories: ['Retrospective', '2024']
description: Growth log during Wootech Course Level 2
image:
  path: https://velog.velcdn.com/images/dragonsu/post/e07ac4ff-1fc1-4fab-87e8-369be12681f8/image.png
lang: en
permalink: /posts/wooteco-level2-retrospective-a-bit-long/
---

This content starts from the Try section of [Wootech Course Level 1 Retrospective (Light)](https://velog.io/@dragonsu/%EC%9A%B0%ED%85%8C%EC%BD%94-%EB%A0%88%EB%B2%A81-%ED%9A%8C%EA%B3%A0-%EA%B0%80%EB%B2%BC%EC%9A%B4).

## Retrospective on Try Achievements from Level 1

During the Level 1 retrospective, I tried to improve through KPT.

The Try section included:

- Organizing thoughts
- Consciously recording content
- Deepening understanding of content

I would say I didn't follow these well (except for organizing thoughts).

To make an excuse, not just an excuse:
`Was it an unsuitable strategy for Spring?` I think so. I'll explain why I felt this way below.
#### Deepening understanding of content

Deepening understanding of content is not a bad strategy.
When the scope of what I need to study is limited and the answers are relatively fixed.

However, Spring is different.
`What about Controller?`, `What about Controller Advice?`, `What about JPA?`
and so on, my study goals changed every week.

At this point, do I really need to explore the source code to confirm how a Controller in some Spring code
`catches an annotation and attaches a specific technology to enable RequestMapping methods within the class`?

Digging deep isn't bad.
But if there are 5 holes to dig 2m deep, and I dig one hole 4m deep without digging the others, is it meaningful?

In developer jargon, it's like having an interface but insisting on finding the implementation.
In a logic of Request -> Interface -> Response, what we need to know is the format of the Request and Response.

We don't need to know how the Interface is implemented.

Therefore, the goal of `deepening understanding of content` was no longer meaningful.
I decided that my scope of knowledge would be `If I attach the Controller annotation and RequestMapping, it receives web requests!`
#### Consciously recording content

>After class,
  I always spend 20-40 minutes organizing the content.
  (If it ends in the morning? -> I can do it after lunch. If it ends in the afternoon and I don't have time? -> I can do it after dinner.)

I decided to take time to organize content after class.
However, since I already had basic knowledge through the Nest Framework, the class content wasn't 100% new to me.
(Especially up to Mission 1 and 2)

So, I don't think I focused much on the class content.
Instead, I became interested in the differences between languages & frameworks - `Oh, this is how Java-Spring approaches it?`

What is HandleArgumentResolver, what is Interceptor, what is Spring MVC...
I filled my knowledge broadly and shallowly.
This is similar to the counter-argument I made above regarding `deepening understanding of content`.
### Organizing thoughts

In my opinion, I achieved significant progress in organizing thoughts during Level 2.
Before asking a question:
1. What am I curious about?
2. What have I studied & found?
3. Explanation of my thoughts/arguments
4. The opinion the other person should provide in response

I asked questions in this manner.

![500](https://i.imgur.com/XrcW28A.png)

I asked reviewers and coaches in this way.
It took me a long time, but it reduced the time the other person had to spend.

- Time to check how much prior knowledge I had
- Time to confirm what the other person wanted to hear about the question
- Time to confirm what part they needed to answer

I kept in mind that it was online, not offline, and that the other people were busy working professionals, and tried my best to be considerate.
Also, by organizing my thoughts to ask questions, I was able to delve deeper into knowledge I had missed or didn't know.

In Level 3 and 4, I will proceed with projects without code reviews, but I will also strive to organize my thoughts and make arguments or ask for opinions from project teammates to facilitate meaningful discussions and growth.

## Level 2 Retrospective

### Soft Skills

Before I knew it, stages 1 and 2 were ending, and I was about 50% through the course.

Now, it's almost time to look for a job.
When I first entered Wootech Course, I had a desperate thought: `I'm still so lacking... I want to study to my heart's content for about another year without thinking about getting a job.`
Now?

I still lack knowledge. And, I hung out a lot with Wootech Course people.
(Level 1 people, Level 2 people, and Bangwidong people...)
Sometimes I thought, `I entered Wootech Course to study to my heart's content, but I'm playing around??`,
but I think this was also a really great experience for me.

In my 3rd and 4th years of university, while preparing for employment, I always went to a friend's lab and studied for employment & backend with another friend.
I studied hard then, but `was it truly meaningful?` I'm not sure.
I consciously studied C.S and consciously solved coding test problems, but it wasn't out of passion for programming, but simply due to anxiety about getting a job.

In fact, I think my interest in development was fading at that time.
If I think about the reason, I mostly studied alone, and I couldn't shake the doubt of `will what I studied actually be used?`

Becoming friends with strangers,
`having in-depth discussions about the same field` and `talking about curiosities and concerns with current reviewers` was an enormous blessing.

For me, who lived in the small well of university (even in university, I only maintained relationships with close friends), the world of Wootech Course was quite vast.
I met people with diverse personalities and became friends with developers who were completely unrelated to my life, which helped me build my own soft skills and ideal image as a developer.
### Coffee Chat

In Level 1, I listed `Cosuta (Chat with Coach)` and `Tiki-Taka with Reviewers` as Keep (things to maintain).
During Level 2, I was very satisfied with these.

As Neo, whom I often went to ask questions, became my assigned coach,
I practically went to have casual conversations with him whenever he was at work.

```
Did you know that China can't even use RDS due to traffic?
Do you know what MDC is?
Did you know Amazon doesn't have product managers?
```

These were topics completely unrelated to the mission. But they were quite interesting.

It was like this. Coffee chats in Level 2 actually went beyond development topics.
Coffee chats with Gugu, with Lisa, with Wedge.

Why Gugu joined Baemin, a new startup, anecdotes about dating shows with Lisa, or stubbornness with Wedge.
These were not directly necessary for immediate development growth, but precisely because they were not about growth, I could talk more relaxed and comfortably. 🙂

I plan to apply for coffee chats with other reviewers, and I wonder if the conversations will be similar then.
### Building My Own Standards

As I mentioned above, I said I didn't `consciously record content`, but I tried very hard to `organize my own thoughts` while implementing missions.
What I realized even more keenly during Level 2 was that `there is no single right answer in programming`.
Right now, `Swagger VS RestDocs`, `how to test`, `how to create custom exceptions`, etc., are pouring out.

So, during Level 2, I tried to create my own standards and thoughts rather than just seeking the right answer.

```
Me: Can't we do it this way?
XX: Oh, why do you want to use this?
Me: I saw this on a blog before, and it looked good. Or, because this is the right answer?
XX: ...
```

Instead of that, it was like this:

```
XX: Joysun! What documentation tool should we use for our project this time?

I think
Swagger based on SpringDocs is better than RestDocs.

XX: Why?

Although annotations intrude into runtime code,
I think it's okay to use it based on the points that there's no need for unnecessary Controller slice tests + the ability to separate unnecessary annotations and Spring annotations through an Interface.
```

I didn't just acquire knowledge and seek answers; I built my own standards as a developer.
What if this isn't the right answer? Who and how will set the standard for what is the right answer?
(Of course, if it's an absolute right answer + conceptual elements like C.S, I should quietly follow it haha)

In particular, I tried not to blindly rely on current industry practices.
As I will write in my mindset for the project, I had quite a fantasy about current industry practices.

I accepted the reviewer's words as them simply expressing their thoughts as a developer.
(Not necessarily how it's done at their company + not that it's the right answer because it's done this way in the industry)
Therefore, I confidently asked reviewers questions about my opinions and code.
## Level 3 Mindset

> I will write separately about my mindset for the project.

### C.S Study

My resolution for Level 3 is to study C.S.
However, instead of just blindly going through it from beginning to end, I plan to delve into concepts I encounter during projects.

```
Me: Gugu. This time, I tried to study C.S and opened the HTTP guide,
but HTTP 0.9 came up and it was so boring that I closed it...

Gugu: (It's natural for that to be boring...)
Rather than consciously doing it too much right now, I recommend studying parts by delving deeply into C.S you encounter during projects.
Things you don't actually use or apply will inevitably be boring.

If you study one thing, follow-up questions and related knowledge will come along,
and I think that's a good way to study.
```

This was also a topic from a coffee chat with Gugu.
This way, whether in an interview or if someone asks later, I think I can answer well based on my experience.
### Separating Developer and Non-Developer Life

This content was also discussed in the Flexibility Enhancement Study. ([Related writing](https://github.com/woowacourse/woowa-writing/pull/214))
During Level 2, I lived quite diligently and immersed myself in missions.

Level 2 was busy, but I expect Level 3 to be even busier.
Due to passion for the project + anxiety about upcoming employment.

During Level 3, I will try even harder to maintain a balanced life as a non-developer.
Speed is not important. Only those who steadily move forward are important.

Let's adjust the pace to avoid stopping.

---

I worked hard during Level 2, but thanks to the Level 1 Lisa team and Level 2 Neo team crews, I managed to get through it without much mental stress.
I did TekoTalk, had coffee chats, and even ranked 3rd for the most comments on PRs during missions haha.
![](https://velog.velcdn.com/images/dragonsu/post/d14db53f-ad14-49db-8d4f-2d1c0b7615f9/image.png)
(A rather exciting message I received because I often asked the reviewer questions)

I did well in Level 2, so I'm sure I'll continue to do well in Level 3. Happiness is not far away ☺️