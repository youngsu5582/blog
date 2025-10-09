---
title: Reflecting on Six Months as a Junior Developer
tags:
  - Junior Developer
  - Reflection
  - Software Development
  - Experience Sharing
description: >-
  This article reflects on six months of experience and lessons learned as a
  junior developer, and summarizes the mindset needed to excel as a developer.
page_id: 6-months-new-developer-reflection
permalink: /posts/6-months-new-developer-reflection/
author: Lee Youngsu
date: 2025-10-07T07:33:12.078Z
image:
  path: assets/img/thumbnail/2025-10-07-6-months-new-developer-reflection.png
lang: en
---
Suddenly, six months have passed since I started as a newcomer.
Since joining on April 1st until October, time has really flown by... (Where did my time go?)

I originally intended to write a reflection as a three-month developer but didn't find the time, so I'm taking this opportunity to write it now.

I'll roughly describe the most memorable experiences during these six months and conclude by discussing the mindset I should carry as a developer at the company.

## My Six Months

### Hello World

After joining the team, I started the Hello World project around the second week of April and continued until early May.

The requirements provided information on what libraries & technologies our team uses, what problems were solved, etc., which I then had to implement and get confirmed by the team leader.

Through this process, I quickly identified the technologies necessary for contributing code to the team project and what I needed to learn.

Initially, I tried to write clean code and adhere to object-oriented principles (since I learned that at Woowa Tech Camp...)

But I realized that quickly understanding technology, its usage, and precautions were more important, so I shifted my focus.

### Server Downtime

From early May, I started receiving issues and writing code for the team project!

I received issues related to project code refactoring.
For example, improving logic using enums, adding logs to the logic, and enhancing code.

I found modifying and deploying existing code to be scarier than expected. (After the first deployment, I constantly monitored the changed areas and the DB)

Handling issues led to a server downtime issue around early June.
While I can't explain all the details, the problematic code was roughly as follows.

> Our logic includes a mechanism called credits, and the amount provided differs between paid and free users. 
> Moreover, each preset and each language (Korean, Japanese, English) have different credit amounts.

1. The existing table data made it hard to understand what credits were for.
2. Added new data.
3. Cleaned up unused data in the code.

For client compatibility, DTOs had to retain existing columns while filling data elsewhere.

```java
if (entity.getCredit() != null) {
	dto.getCredit().setValue(dto.getPresetInfoByLanguage().getKo().getValue());
}
```

The columns in the entity were to be removed, so the approach was to fill DTO elements if the entity existed. Doesn’t that seem precarious somehow...? 🫠

> In defense, our logic heavily relies on back office. (Since it involves AI features, it must be easily debuggable and measurable.)
> Given the complex nature of DTOs and usage limited to the back office, I handled it to pull Korean values.

The same DTO was used in the API logic, and the API returned DTOs containing only elements of specific languages. 
(Meaning, English elements were fetched only for English, with the Korean part left empty.)

![700](https://i.imgur.com/p12gGU2.png)

This resulted in NPEs occurring and returning 500 error codes on overseas servers, causing an outage.
While I was in a state of mental freeze, another team member quickly assessed the situation and deployed a hotfix, normalizing the issue 30 minutes later.

I felt that, as a server developer, it is crucial not only to write code but also to develop the following abilities:

- Writing defensive code considering compatibility (without making it ugly)
- The ability to revert operations (deciding whether to hotfix, roll-back, or deploy a compatible script if flyway deployment has occurred)
- Understanding the impact range of one’s code

### Portuguese Deployment

![](https://i.imgur.com/2qGqCn2.png)

Unexpectedly, we had to deploy in a new, non-existing language for service expansion — Portuguese.
And it had to be done urgently!

Discussions started on September 8th, and I was assigned the issue around 3 PM on the 9th. I had to handle it as quickly as possible.

On the 9th, I analyzed and wrote the code, followed by:
-> Reviews and merges on the 10th (+QA)
-> Deployment on the production server on the 11th.

What was particularly impressive was that
deploying the data consistency query with the code caused issues before deployment on the server due to an ENUM problem, so they needed to be deployed separately.

```java
public static EnumValue findByString(String string) {
    for (var value : values()) {
        if (value.getCode().equals(code)) return value;
    }
    throw new IllegalStateException("Unknown Enum Value: " + string);
}
```

(An approximation of such a code)

Although time felt short and there was a slight tension and burden, the deployment concluded smoothly and successfully. 🙂

Additionally, I realized that the more urgent the code, the more thorough you should be.

- What exactly is the issue looking to accomplish?
- What code needs to be changed?
- How will the deployment be verified - any issues on previous servers (how to test and verify)?

If these elements are not clear, even if the code is written quickly, it can lead to delays or even greater problems.
(It can cause a bottleneck during review or deployment.)

### As of Now..?

Although my probation is over, I still feel significantly lacking.
If I were asked whether I could handle any given requirement or complete features quickly, the answer would likely be no.

However, I seem to be finding my way and putting effort into becoming a developer at the company rather than just a developer.

## Mindset as a Company Developer

> I found content that resonates closely with my feelings, and I wish to share it. 
> A senior from Woowa Tech Camp, Sudal's [About the Capability and Growth of a New Developer (feat. Done is better than perfect)](https://medium.com/naverfinancial/%EC%8B%A0%EC%9E%85%EA%B0%9C%EB%B0%9C%EC%9E%90%EC%9D%98-%EC%97%AD%EB%9F%89%EA%B3%BC-%EC%84%B1%EC%9E%A5%EC%97%90-%EB%8C%80%ED%95%B4%EC%84%9C-feat-done-is-better-than-perfect-0e7f3732555f)
> While it's content from a third-year perspective, it's extremely significant as a newcomer.

### Code is Important but Not Everything

When attending Woowa Tech Camp, there were various constraints like object-orientation, immutability, clean code, limiting the number of parameters, etc.
Even during projects, we had a certain leeway, but if something strange was observed, everyone was ready to criticize it through reviews.

Perhaps because of that, a clean code approach eventually turned somewhat uncomfortable.

While coding, I had constraints like:
`Hmm, this might be difficult to test,` `Ah, creating a separate object might make it prettier,` `How can I make the code cleaner?`

Of course, listening to dialogues among the seniors or early camp joiners, I knew clean or beautiful code wasn’t everything.

But what could I do when my body rejected it naturally?

`If I create an object here, it could be really clean...`, `Without needing to mock the service code for testing,` `Putting it into the object itself might work.`

> Of course, I can assure that the code in our team is quite clean.

Initially, I spent too much time trying to write perfect code when receiving an issue.
Putting logic into objects, enabling tests,
writing readable test codes with assertThat chaining, etc.

BUT... I missed the intent.

The issue entailed adding a default value to an ENUM, allowing validations when requests came in and ensuring compatibility when fetching data from the DB.

I hadn't considered why such an issue originated.

![](https://i.imgur.com/IWg6NyJ.png)

As a result, a simple issue submitted on April 30th was merged on May 16th.🥲

As a developer, code is certainly crucial. But, more important than the code is problem-solving and deadlines.
Developers, too, are members of a company aimed at contributing to its objectives and performance.

### Consider your team

When assigned an issue and writing code, I submit a PR.
To check problems in the code and align style within the team.

While wrong code may be merged and deployed, the mistake becomes everyone's responsibility.
Minimizing the fatigue team members experience while reviewing code is essential.

Start with simple techniques like divide and conquer by splitting commits.

But if commits result in different interests within the PR?
(EX: Implementing a code only to find it requires refactoring? -> Separate PRs for refactoring and implementation)

- Courageously split PRs and submit them step by step.

Thus,
1. We gain confidence in the code since changes are within a small scope.
2. Team members can easily review by dragging small pieces of code.

Code reviews mainly proceed by looking at `Files changed`.
Prevent excessive length, wide package excursions, and unnecessary inclusions.

- Additionally, concisely and precisely write commit titles and descriptions.

While performing reviews at the moment is vital, in the future, it serves as a milestone.

Curious about particular parts but unable to figure it out from the commit? -> You’ll have to check JIRA issues & wikis, and if still clueless? -> Need to approach a team member.
=> What if the team member is absent...? ☠️

Include why the code was modified, for what issue it was handled, and what considerations were taken into account.

```
ISSUE-473 Added API URL settings
- Since the developing server uses a TEST account, a separate setting testUrl is used
```

- Moreover, a PR should remain updated and alive with introductions, intent, changes, and emphasized points, maintaining consistency.

After documenting initially, if reviews, oversight, or additions/changes occur, modify the main body to prevent confusion among reviewers.

Furthermore, if code changes receive approval after a review,
notify via Slack regarding correction or addition and briefly explain what was altered.

### Ask questions like UDP

Realizing the importance of `asking questions` was significant as a newbie.

I once received feedback while progressing with a mission during Woowa Tech Camp.

![](https://i.imgur.com/SZBnSsi.png)

> Shout out again to Wedge...

Though I considered myself equipped with soft skills regarding questioning, I was entirely wrong.

If at Woowa Tech Camp, sessions were online with clear relationships (where I was a reviewee and the other a reviewer), now, it happens offline with potential allies crafting codes together.

Especially since each one focuses on tasks during core time, questioning holds significant gravity.
Given light queries, Slack notifications, and top-right pop-ups, concentration disrupts.

Exert maximum effort before inquiring.
Codes, JIRA, Wiki, etc., but if unresolved? Try everything imaginable before asking for help.

- Why do you need to ask?
- Where do you feel stuck or unsure (what answer do you need)?
- What have you tried?

Additionally, avoid phrases like `Could I ask since I seem to be missing something...?`
Inevitably, questions will lead to TCP-like communication, avoid framing them that way initially.

Speaking should be done more crisply. Approach someone knowing precisely the content you want to inquire about.
Otherwise, it leads to saying `Oh, just a moment...` or `I need to check this part.`

Asking questions is not wrong. If delays continue without asking, it’s better to ask.
Yet, the communication should be value-driven.

It's also vital to document in personal notes or share on the Wiki to avoid repeating the question later.

### Find the Right Answer

The most entertaining yet excruciating part of programming is that there’s no definitive answer.
There’s a brute force way to make codes work somehow, but similar to applying DFS & BFS & DP for more efficient code; our codes too can resolve using various approaches.

Imagine needing to work on data consistency.
We might explore different options iteratively.

1. Process with a single SQL file
2. Write a shell script + handle with SQL for repeatability
3. Create temporary packages in existing Spring code, coding via JPA + Spring
4. Add and code with the Spring Batch dependency

Or when deciding what parts to cache, what data to cache, or what data to save to prevent duplication, endless contemplation follows.

My personal insight is to simplify roughly, in a pseudocode-like manner, to complete first.
The content here is somewhat parallel to `Code is Important but Not Everything`, as completing helps grasp the code’s bearings.

`This method doesn’t seem valid...?`, `It must be handled differently.` 

> Especially now, AI appropriately writes test codes aligned with scenarios by parsing the filesystem context.
> Receive test codes for written code -> Using those test codes, modify and enhance code freely.

Though no absolute answer exists, assert an answer by providing reasoned rationale.
Clarify why a particular approach was necessary, what was considered, and the approach taken.

Self-growth and fortifying the team's code stem from this.

### Logs

During the Woowa Tech Camp project, I couldn’t fully grasp where logging had to be placed or why it was necessary.
At the time, I even approached Coach Bree asking, `"I still don't fully understand the meaning of logs."`

While coding for the company, I recognized that logs act as a final line of defense.

For instance:

- A request seems to have succeeded, but the data is missing from DBs.
- A user's request continually triggers 500 responses but remains untraceable.
- You unknowingly omit saving necessary information during code adjustments.

> At first, I wondered if it was necessary to log the entire request and response bodies.
> Provided it's manageable regarding volume and load, it's not necessarily detrimental to log crucial business aspects, (considering security and ISMS-P protocols appropriately)
> This allows unlimited future use + catches errors (Even if incompatible, older versions are pushed, it’s parsed somehow for processing).

![](https://i.imgur.com/jX0XX1p.png)

Generally, logs average at `249B` in size. (Naturally, this varies based on projects and content, so verify accordingly)
With 152KB per minute, it's about 152 / `1024 * 1024` `* 0.76` = 0.0011$ (around 2 KRW).

Additionally, logs facilitate tracing whether certain requests have been processed properly.
For image generation:

Request Reception -> Prompt Verification -> Translation -> Message Dispatch -> Message Reception -> Creation -> Report
Sequential logging like this simplifies identifying the issue point.
(Appropriately + accurately record error logs)

Moreover, in case of errors with images or files, uploading to our S3 for debugging is advisable.
Despite potentially becoming unused files, consuming space and incurring costs?

![](https://i.imgur.com/alGF6NC.png)

As of October 1st, it costs 0.021 (30 KRW) per GB.
Assuming one file is around 4MB,

1GB / 4MB = 250
0.021 / 250 = 0.000084$

This amounts to minimal expense.
Though mindlessly wasting is inadvisable, invest appropriately in needed aspects for phenomena identification and replication.

## Moving Forward

Maybe I’ll return with a reflection as a first-year developer next time...?

Until then, I aspire to become a developer gaining recognition and acquiring experience from team members.
I still feel I'm lacking significantly.

Additionally, I keenly observe the rapid advancements in AI lately.
Yet, it seems apparent that there are limitations still present.

![700](https://i.imgur.com/SHf1cBx.png)
![700](https://i.imgur.com/h7nsRiM.png)

- Original Text: [# Where's the Shovelware? Why AI Coding Claims Don't Add Up](https://mikelovesrobots.substack.com/p/wheres-the-shovelware-why-ai-coding)

Even on GeekNews, strongly negative opinions about AI are evidently present.

In my view:

- We take responsibility for AI-generated code
  As the code cannot yet be trusted completely, it undergoes inspection.
  It could limit developers’ thoughts, narrow their vision, and waste time.

- It cannot understand 200% of the context
  Realistically, solutions beyond mere data context exist, like why issues occur, what ultimately needs solving, etc.
  Despite attaching Jira MCP and Wiki MCP, it can't yield an answer without human insight.

- What’s the point tuning for AI
  Indeed, my interest in AI remains considerable — keeping tabs on MCPs or new open-source models and so forth.
  There are frameworks upgrading 'AI brains' like SuperClaude, SuperGemini,
  as well as various MCPs like sequential thinking, context caching. But in all this, what is the significance? It feels like priorities reverse, where values lie in writing the code ourselves.

Rather, I believe it enhances productivity regarding side effects through AI.
Hence, my next piece might discuss `How I Improved Productivity with AI`.

That’s all!
