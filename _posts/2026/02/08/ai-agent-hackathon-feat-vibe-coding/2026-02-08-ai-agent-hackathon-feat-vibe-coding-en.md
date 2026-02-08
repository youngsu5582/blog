---
title: Attending an AI Agent Hackathon (feat. Vibe Coding)
tags:
  - AI
  - Hackathon
  - Vibe Coding
  - LLM
description: >-
  Sharing experiences and insights from a project utilizing AI agents during the
  recent hackathon.
page_id: ai-agent-hackathon-feat-vibe-coding
permalink: /posts/ai-agent-hackathon-feat-vibe-coding/
author: Lee Youngsu
image:
  path: assets/img/thumbnail/2026-02-08-ai-agent-hackathon-feat-vibe-coding.png
date: 2026-02-08T08:31:30.287Z
lang: en
---
> I briefly summarize the small-scale hackathon I recently attended.

![image](https://darhcarwm16oo.cloudfront.net/2bd12e83a63290bb176107d009cae5ce.png)

I saw a post on the WTC Slack and pondered whether to apply. My curiosity about what the AI Agent SDK is and the desire to code in a different domain were my primary motivations. Additionally, I've noticed a significant improvement in LLMs (like Claude) performance recently, and I wanted to see how well they perform.

> I initially planned to participate with Dobby as a team, but due to Dobby's schedule, I ended up participating alone... lol.

The hackathon was started using [Moru](https://github.com/moru-ai/moru), which is being developed by the host, Minseok, and the hackathon was based on [hackathon-starter](https://github.com/moru-ai/hackathon-starter) already set up with Moru.

## Before Starting

I went with a rough idea: I wanted AI to engage in a discussion with each other.

When I want to learn something, instead of typing it myself, I wanted to observe a conversation between AIs. I decided to use this opportunity to create that.

Moreover, I decided that I would write everything using Vibe Coding.
(In other words, without writing any code myself! Not that I could, anyway)

The flow I approached with Vibe Coding was as follows.

## Vibe Coding

### Repository Analysis & Design

![500](https://darhcarwm16oo.cloudfront.net/1b7d3e41c7487846300ebe5f7d6c4a67.png)

![500](https://darhcarwm16oo.cloudfront.net/e316ff64ecf87095c32f27e38a9a4a85.png)

I analyzed the repository and infused it with my idea I had considered since the day before, asking Gemini whether it could be implemented. (see below)

By inserting examples from a place called other [Skillthon](https://www.linkedin.com/posts/gb-jeong_skillthon%EC%97%90%EC%84%9C-8%EA%B0%9C%EC%9D%98-claude-code-%ED%94%8C%EB%9F%AC%EA%B7%B8%EC%9D%B8%EC%9D%B4-%EB%A7%8C%EB%93%A4%EC%96%B4%EC%A1%8C%EC%8A%B5%EB%8B%88%EB%8B%A4-activity-7420974941359185920-L3Tq/?originalSubdomain=kr)

![500](https://darhcarwm16oo.cloudfront.net/d2bc15b8a53e20f200fefade97cfb1b7.png)

![500](https://darhcarwm16oo.cloudfront.net/dba64369932d68989bb869baabfb0438.png)

I secured meaningful examples

![500](https://darhcarwm16oo.cloudfront.net/c186811efaa509a04056fca7a9ce2975.png)

I then asked questions about feasibility and direction by incorporating the provided GitHub guidelines. Based on this, I created an implementation plan and timetable with Plan mode.

### Deployment Design

Meanwhile, the method of deploying the application was set to progress autonomously according to the guidelines.

![500](https://darhcarwm16oo.cloudfront.net/e56b3d614501a9f186b5fba3aa90fd98.png)

There was a standard like this.
However, the deployment was unfamiliar to me, as it was with Vercel, Supabase for DB, and Agent SDK with Moru.

By passing the guideline markdown,

```
Moru API key - Moru is a sandbox for running the Claude Agent SDK in the cloud. You can run each agent in an isolated environment. Please issue an API key at moru.io/dashboard. It’s free!
Even if it’s not Moru, a sandbox of some form is necessary to deploy the Claude Agent SDK on the web. Please refer to the hosting documentation and secure deployment documentation for more details.

...
Let's deploy together based on this content.
```

![500](https://darhcarwm16oo.cloudfront.net/a7877bdc287fbc897b53be74f7a24508.png)

I sequentially set it up with Claude.

### Document Processing & Miscellaneous Tasks

![500](https://darhcarwm16oo.cloudfront.net/10c96caa57e0a71e68cf61d4bbd3be1b.png)

![500](https://darhcarwm16oo.cloudfront.net/1d364b5297e52b0c554c50aab8c15ee1.png)

The rest were handled as they progressed.

## Completion

The 4-hour time limit didn't feel as tight as initially feared.
While I didn't complete all the features I planned initially, I managed to establish the framework to some extent, adding functionalities one by one.

Since the intention was to facilitate a conversation,

![500](https://darhcarwm16oo.cloudfront.net/1fc4a95c7d33fcd96e635473f2bc2617.png)

I implemented it as a conversation between me and AI rather than AIs talking to each other.

> Since the site will soon be closed, it is replaced with a GitHub repository.
> [hackathon-toron](https://github.com/youngsu5582/hackathon-toron)

![500](https://darhcarwm16oo.cloudfront.net/5705dda3bd75eb92d9156d4568823b18.png)

1. Select a topic as shown in the photo

![500](https://darhcarwm16oo.cloudfront.net/eb3e26795447172cd687a4b2d6ea2785.png)

2. Choose a position

![500](https://darhcarwm16oo.cloudfront.net/2aa32edfc2167b53fcb8150ebda257a6.png)

3. Begin the discussion after providing an explanation of the topic

![500](https://darhcarwm16oo.cloudfront.net/f2cbf06343a378622ed6aae2e1ad65ad.png)

a. Set system prompts in a rebutting voice tone

![500](https://darhcarwm16oo.cloudfront.net/e1fad1384c0957698b75dac484534d98.png)

b. Pull rebuttal evidence from the web.

![500](https://darhcarwm16oo.cloudfront.net/82ca0241b976c4766e4e41d1af792e01.png)

c. Prepare rebuttal evidence through bash permissions.

![500](https://darhcarwm16oo.cloudfront.net/bdd0eb0c027a24c3258549cf6cb3b895.png)

4. Allow the audience to present opinions.

> The participation logic was not verified.

![500](https://darhcarwm16oo.cloudfront.net/c6859dc1bf545094a204174435b84200.png)

5. Allow viewing of ongoing and past discussion results.

## Impressions

### Hackathon

I realized that a hackathon involves not only server development but also tasks like building, deployment, configuration, and presentations. I used new technologies like Vercel, Supabase, Next.js, and Moru.

- Vercel for fast web deployment
- Supabase for quick DB setup
- Next.js for fast web development

Moreover, using something new quickly can lead to issues.
For example, I used Supabase, but there was an issue where the connection didn't align properly in the code made with Vibe Coding. So, the connection depletion issue arose after about the third demonstration.

Through

```sql
SELECT pg_terminate_backend(pid)                       
FROM pg_stat_activity                              
WHERE pid <> pg_backend_pid()                                                                                                                                                                                           
AND state = 'idle'                                                                                                                                                                                  
AND usename = 'postgres';  
```

I solved it by terminating all connections.

Minimizing time spent on non-development aspects and quickly adapting and setting up guide systems are crucial to saving time.

Moreover, I realized the importance of presentations.
Seeing other people's presentations, I understood that effectively PR-ing one's product is a significant capability.
No matter how well-made, if no one is interested or finds it intriguing, it becomes pointless…

I realized, just like at [YOOCON](https://youngsu5582.life/posts/youthcon-presentation-reflections/), that this area needs more improvement.

### The Power of LLM

In my personal opinion, LLM seems to have already surpassed the singularity...
Even thinking from various checklist perspectives,

- [ ] Does it understand an unfamiliar project better?
- [ ] Does it diagnose errors better based on logs?
- [ ] Does it make intended changes to existing code better?
- [ ] Does it add code faster as desired?

In any aspect in this vibe coding from scratch, no one can outdo AI.
This might seem somewhat disheartening…?

During this hackathon, I didn’t write a single line of code myself, nor did I look at the code.
And the fact that parallel work is possible is truly amazing.

In computer science, when learning about operating systems, I thought
‘Is a sort of time-sharing system, where one CPU handles multiple tasks, meaningful?’
But becoming a human CPU made me realize its tremendous efficiency.

Actually, the biggest issue is the conventional human work method.
‘Asking LLM to do something wrong...’, ‘Having to check one by one’, or ‘Causing bottlenecks due to context switching…’

The development pace is incredibly swift…

### Let's Think of Ideas

Since there were non-developers participating as well, I felt that many varied ideas emerged. Many were quite interesting.

- A bot similar to Moltbot
- A podcast where celebrities discuss stories using voice input
- A service that leaves comments so YouTube influencers don’t have to manually
- RPG characters wrapped with LLM

Recently, even while at work, I sensed that there’s no reason not to start a business if you have a really good idea.
Although now, personally created products seem to be pouring out…

## Conclusion

![500](https://darhcarwm16oo.cloudfront.net/ed9ed06b41b66907bc23dcdb074cc1a0.png)

We concluded the hackathon by achieving third place. Although it was my first participation, it was a highly intriguing experience. Lately, although I’ve felt like my brain is marinating in short-form content, focusing for 4 hours felt quite fulfilling!

Next time, I hope to have an even more enjoyable experience with others.
