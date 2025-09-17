---
title: "Level 3 Retrospective"
author: 이영수
date: 2024-08-20T04:43:08.860Z
tags: ['Woowahan Tech Course', 'Wooteco']
categories: ['Retrospective', '2024']
description: "Level 3 is over. It was a project, and I was both worried and excited, but I think it ended well. First, the KPT retrospective from Level 2 and the mindset for the project were not very helpful. Not only had I not done a project, but before meeting the team"
permalink: /posts/level-3-retrospective/
lang: en
---
> I wrote this a while ago but couldn't upload it, so I'm posting it now. 🥲

---

Level 3 is over.

It was a project, and I was both worried and excited, but I think it ended well.

First, the KPT retrospective from Level 2 and the mindset for the project were not very helpful.
I think it's because I hadn't done a project before, and it was just my mindset and `Try` before meeting the team.

This retrospective will be about the experiences and feelings I had while doing the project.
## Development time was 40-50% of the total time..?

Of course, I like development and trial and error, but I don't think the actual development time was even 50% of the total.

Rather,
- The whole team had planning meetings
- Advanced feature processes and role division according to the meetings
- Sharing sync with frontend team members in charge of features through wireframes
- Preparing for demo day presentations & lectures on projects at Wooteco
- Infrastructure such as launching the server on EC2 or the deployment process
I was very stressed at first.



### Let's just set the big picture, and the people implementing the features will take care of the rest.
Our team's ground rule was `Let's not let meetings go over an hour`, but
when we were starting the day on Monday, the meeting didn't end in an hour, so how could we stop?
So, the opinion in the subtitle came up.

Actually, I don't know if this is the right answer, but I feel that this approach was more efficient.
It was difficult for everyone to participate in the conversation when we tried to decide everything together (even with just 7 people, the meeting room gets quite noisy), and
everyone's opinions can't be the same. At this time, the more you try to accommodate or persuade opposing or different opinions, the more time it takes and the more difficult it becomes.

In particular, there were times when we talked based on predictions or fears about parts we didn't know or couldn't know until we implemented them.
If we were professional and senior developers, I don't know, but for junior developers who are still growing,
words like `As far as I know, isn't this not possible because of this?` are meaningless in a meeting.

So, we only talked about the flow of major features like `ranking feature` and `reviewer -> reviewee matching feature`, and
I discussed error handling & request/response during the flow with the person I was working with.

### The Rolling Hamster Wheel
We had a demo day every two weeks. To be honest, this was an experience I had never had before.
In the graduation project I did before, we were only checked twice in total, once before vacation and once in September after school started.
So, I just developed as I wanted and moved forward towards the big picture without a clear goal.

As a result, I didn't produce a certain amount of speed.
There were weeks when I coded late every night, and weeks when I only developed for about a day.

On the other hand, the project at Wooteco was like a `rolling hamster wheel` where we had to set a clear MVP and all the team members had to perform tasks towards the set MVP.
I was a bit stressed about this part too.

This is because I had to stop even if I wanted to develop more or add more features because of the demo day and other requirements for the demo day (infrastructure construction, logging, documentation, etc.).
Thinking about it now as I write this retrospective, I think this is a natural course of action.

In a company, wouldn't we have to complete the MVP like a demo day while performing many more urgent tasks?
I need to think about how to make this hamster wheel roll more effectively in Level 4.

### All-Round Developer

The project was not just about developing with Java-Spring, but we were involved in many parts.
From non-development elements like feature planning and basic design to DevOps(?) elements like server deployment & instances, and DB management.
And, by dividing the features and collaborating with the frontend, I even learned the basic elements and flow of the frontend.

At this time, what I felt while doing these three major elements was
that they all help to improve the capabilities of a server developer.

#### Planning and Design
It's meaningless to develop without knowing the domain knowledge and planning knowledge.

Not only does it reduce interest, but the development can also go in the wrong direction. (What if you wrote it following TDD, but the logic was wrong from the beginning or you have to scrap everything?)
To be honest, if you think about this part darkly, it can get endlessly dark. (Even if you talk about the plan together, the planner or PM can change or scrap it.)
Nevertheless, because developers participate in the planning, they can prevent the impossible in advance or lead to a better direction.

If the planner wanted A.1, but this increases the time and server load,
isn't it the developer's ability to lead to A.2 and compromise?
#### Server Deployment & Infrastructure Management
Even if I get a job at a large company, can I be completely separated from server deployment or infrastructure?

And, even if I am separated, wouldn't a developer who only knows Java-Spring be a frog in a well?
I think that as MSA elements become more prevalent, the work that a server developer has to do will increase.
(Since it's a small project unit, the server developer will be able to handle it.)

As I'll talk about below, there's a huge difference between not knowing anything and knowing a little. (Of course, it's best to know everything in detail 🙂)
If you think about it, we are already closely related to DevOps elements.
The workflow for CI, the DB address to connect to when using JPA, the address to allow when opening CORS, etc.
We can't leave all of this to DevOps.

#### Feature Collaboration with Frontend

One of the requirements for the 3rd demo day was `collaborating with the frontend on one feature`.

Solar and Bri already told me the answer, but

> The reason I told you to collaborate with the frontend is
> I think a backend developer should be able to confidently say what the flow of the feature they are in charge of is from the front to the back.

If time and circumstances permit, it's very good to know how each other's processes will proceed after the feature is decided with the frontend.

Directly, by sending requests & responses, we could infer the packet size and response time from each other, and
I was able to learn more about C.S elements.
## Passion, Agreement, and Conversation
During the project, I brought up a complaint(?) to the project team members, not a disagreement. (Once again, thanks to the team members who accepted it well 🙏🙏)
I wrote the details in [Level 3 Writing](https://github.com/woowacourse/woowa-writing/pull/344/files).
(It was about not feeling the passion for the project.)

### Passion and Agreement
No one can force passion for a project or development.
As much as I was stressed during the 3rd demo day, I might have been stressed when I went to the reserve forces training during the 4th demo day. (Thanks Ash, Pororo ☺️)

Even if you have 120% passion, you don't know if that passion will continue, and it might be more of a disaster if it does.
(I think I'm at 100%, but what if someone keeps forcing me, saying they don't feel my passion?)

I felt that it's good to define passion with specific and clear visible parts, and to `agree` on whether it's possible/impossible and whether there are any difficulties among them.

Therefore, I decided to invest my passion a little differently. (Of course, for now, it's development elements, but I should try to invest in non-development elements as well..)
I'm interested in the C.S elements that come up during feature implementation. `ETag`, `User-Agent`, `Webhook`, etc.
I'm moving forward in a way that I can provide help or spread knowledge without completely deviating from the project, but I can't force it on others.

### Conversation
In the end, I felt the need to have a conversation. Whether it's a complaint or satisfaction, if you don't have a conversation, the other person won't know.
In addition, it will be important to build a good bond where you can bring up these uncomfortable or difficult elements.

I need to think more about the action plan.
## Direction for Level 4

How should I move forward in Level 4?
### Numerically, a little deeper
Now, the basic construction is complete.
Currently, the meaning and core were simple feature implementation and doing the project with team members, but

- Why did you define it as a problem (numerical - time occurring during web requests, query time processed in DB, business - customers feel uncomfortable, I think it would be good to have)
- Are there any existing patterns or libraries to solve this problem?
- How did you solve it?

I will focus more on these.

Already, our project is facing problems.
Concurrency issues when making the same application at the same time (of course, I wonder if there are such people.)
Depending on an external API, and even if you don't depend on it, you have to load a large value from the DB and work based on it. (The problem of the transaction becoming excessively long)
### Leaving a Record
What was disappointing while doing the project was that I tried to leave a record, but I don't think I was able to leave a perfect record.
In particular, when I'm busy, I think I'll get into the habit of writing even a simple sticky note for the record.

I felt that there was a big difference between relying on simple memory and starting a record based on sticky notes.
At this time, I originally didn't leave notes in Obsidian because I didn't like adding multiple notes (especially unfinished ones), but
on a sticky note

```
2024.08.28 Transactional Outbox Pattern

A pattern that bundles a DB transaction and a message and delivers it to a broker?
Through this, it seems possible to intentionally separate the external logic and the DB logic transaction.

```

I should at least try to leave this much.
### Let's Speak Professionally

This was actually a problem before I entered Wooteco.
It's so difficult to deliver the knowledge in my head professionally and in a way that the other person can easily understand.

While doing Wooteco activities, I was comfortable having pairs or light conversations and confidently expressed my opinions, but
I was still infinitely lacking in TekoTalk, demo days, and activities that everyone participated in.
(In particular, I was going to present at the 4th demo day, but I felt so anxious because the feature was incomplete. - Sorry, Mubin)

To solve this, I think I need to make an effort both internally and externally.
#### Moving Forward on My Own

Previously, I would think in my head and record in my notes, but
I think I need to develop the skill of drawing or organizing what I've thought of.
(This is also to solve the problem of not being able to draw ERDs or flows confidently.)
In addition, I sometimes omit my personal stories or supplementary explanations for understanding for the sake of organizing + showing, but I need to organize and include them better.

#### Making an Effort Externally

I don't know if it will be an interview study, but
I should try to have an opportunity to present the knowledge I've learned or the blog content I've written.
(Level 1 people, Level 2 people, project people, etc.)

Really, I think it's time to try now.

### Conclusion

Instead of KPT like in Level 1 and 2, I left my feelings, but
I thought that Level 3 was not just for development learning, so I focused on my feelings, points for improvement, and direction.
Fighting for Level 4 and Level 5 as well.

---
Looking back, I tried to be `numerical` and `record`, but I still haven't been able to speak professionally 😢
