---
title: "Summary of How to Use AI Technology Video and My Thoughts"
author: "이영수"
date: 2025-08-20T13:35:20.897Z
lang: en
permalink: /posts/ai-tech-usage-summary-thoughts/
tags: ["AI Technology", "Developer", "Collaboration", "Coding Tools"]
description: "This article summarizes the discussion on the development of AI technology and the changing role of developers, and how to use AI coding tools."
image:
  path: assets/img/thumbnail/2025-08-20-개발자라면-꼭-알아야-할-AI-기술-활용법-영상에-대한-정리-및-간단한-사담.png
page_id: ai-tech-usage-summary-thoughts
---

> This post has been translated from Korean to English by Gemini CLI.

While watching the video, I thought the content was so good that I decided to post a simple summary on my blog and write down my thoughts lightly below.

[Video Link](https://www.youtube.com/watch?v=mYMvFZDTC_M)

# Video Content

For developers, this is truly an era of AI chaos.

![500](https://i.imgur.com/XMGaYlA.png)

![500](https://i.imgur.com/RHc9vfF.png)

Opinions are divided on whether developers' jobs will disappear or remain.

There is also talk that senior developers are at risk.

=> In short, it's chaos.

What is certain is that
a developer will no longer be a fixed job function, but a fluid concept that will be constantly redefined with AI.
## AI Coding Tools

There is no clear term that everyone agrees on.

- AI Coding
- AI Development
- Vibe Coding
- Augmented Coding

etc.

## AI Coding Level Spectrum

Coding using AI has a very wide spectrum.
-> The spectrum is defined in stages according to the level of autonomy. [Link](https://eclipsesource.com/blogs/2025/06/26/ai-coding-spectrum-levels-of-assistance/)

### Level 0 - Static Tools

- Linters, formatters - rule-based, deterministic

### Level 1 - Token-level Completion

- Token-level completion - EX) Typing only 'S' suggests 'String'
- Local context-based token, word prediction (IDE)

### Level 2 - Block-level Completion

> GitHub Copilot came out 3 years ago...!

- Block-level completion - EX) Completing a line or an entire method
- Intellij's Inline Completion
- Github Copilot Completion
- Cursor Tab

#### Actively utilize inline auto-completion

- Inline auto-completion uses recent accept/reject signals as weights and also utilizes a local cache.
- A new CDHF model is trained to predict the acceptance probability by collecting telemetry (suggestion, accept/reject logs).

> CDHF: Context Decision with Human Feedback - Reinforcement learning based on human feedback

- It is attached to the front of the pipeline through a separate model (ranker, gate, etc.).
- The model itself is not retrained, but it is designed to increase the suggestion acceptance rate through various strategies.
### Level 3 - Intent-based Chat Agent

Integrated into IDEs, etc.

- A conversational agent that suggests code changes when you ask questions or explain goals in natural language.
- Copilot ask, AI Assistant Ask, Cursor Ask

### Level 4 - Local Autonomous Agent

- Receives functional requirements, the agent makes its own plan, modifies multiple files, runs tests, and repeats modifications if they fail.

> I used to be bad at Spring development, but now I'm great at it.

- JetBrains Junie, Cursor Agent, Copilot Agent, Claude Code, Gemini CLI

### Level 5 - Fully Autonomous Dev Agent

- Acts like a single developer, from selecting tasks to planning, implementing, writing tests, and creating PRs.

## AI Development Support Tools

- Dedicated IDEs: Cursor, Windsurf, Kiro
- IDE Plugins: Github Copilot, JetBrains AI Assistant/Junie, Jemini Code Assist, Amazon Q
- Terminal / CLI Agents: Claude Code, Gemini CLI, Amazon Q CLI, Codex CLI
- Repository-integrated

---

## Human-AI Collaboration

Human-AI collaboration exists on a diverse spectrum beyond a simple dichotomy of human-led and AI-led.

-> You need to be able to select and switch to the optimal collaboration model depending on the nature of the task.

### AI-in-the-Loop

- Assistant: assistant, secretary, copilot
- Humans have full control over the entire development process.
- AI is used as a tool to make tasks more efficient.
- AI autonomy levels 1-3
- Suitable for tasks that deal with `complex domain problems` or require `subtle judgment` such as architecture.

-> The way we chat, get information, and interact.
### Human-in-the-Loop (HITL)

The person is in the loop.

- The Supervised Agent
- AI leads the development process, but requires human verification and approval at key decision stages.

-> The way we ask Gemini-CLI, it writes the code and asks if we want to review it.

### Human-on-the-loop

The person is on top of the loop.

- Autonomous Agent
- AI performs tasks autonomously.
- Humans act as supervisors, intervening only when necessary or reviewing the final output.
- Autonomy levels 4-5
- Claude Code / Junie / Cursor modifies and retries the code until the tests pass.
- Effective for `well-defined` and `repetitive tasks`.

-> It does a great job if you give it a task with certain conditions or a repetitive task.
(It can also perform multiple tasks in parallel, like a shadow clone jutsu.)

=> We should not stay in only one of these three models.
We need to become "Mode Switchers" who flexibly switch collaboration models depending on the nature and complexity of the task.

## Architectural Design for AI Collaboration

How should we collaborate with AI? An architecture just for AI? An architecture that AI creates itself?
-> That's not the story for now.

> If you ask AI to do TDD, it just creates a test, creates the code, and passes it all at once.
> AI may not need such a process.

The common consensus is that what is considered good architecture and code for humans is also preferred by AI.
In particular, since AI has learned from code snippets uploaded to the internet, it converges to an average level.

### The Renaissance of Test-Driven Development (TDD)

AI-specialized companies like Claude also say they prefer TDD when creating tools.

Instead of humans creating the code and having AI pass it,
have AI create the tests and then pass them.

> Nowadays, you don't even need to type, the recognition is so good.

Why is TDD important for collaboration?

- Provides clear success criteria
- Acts as the ultimate guardrail - a safety device to prevent AI's mistakes

> AI is a kind of slot machine haha (the code that comes out today and the code that comes out tomorrow are different every time)


#### AI-assisted TDD workflow

- Human prompt - "Create a failing test for a certain feature"
- AI test generation
- Human verification - Run the generated test to confirm that it fails for the expected reason
- Human request - "Make the test pass, `but don't modify the test code`"
- AI implementation - Write and modify the necessary code until the test passes
- Human review and refactoring
- Commit code

[Reference Link](https://www.anthropic.com/engineering/claude-code-best-practices)
## Exploration and Exploitation

Many companies around are interested in productivity.
(If AI does 50%, does that mean we don't have to hire 50% more developers? - Developers are very expensive...)

Everyone is talking about how fast they can develop with AI.
OR
They are only talking about productivity...

> It's bound to come up.
> Because AI can produce code about 1000 times faster than humans.
> (AI doesn't sleep either.)

=> There is a dilemma here.

### The Exploration-Exploitation Dilemma in Reinforcement Learning

- Exploitation
Using the best-known choice so far to maximize profit.

- Exploration
Going out to find other choices that are not the best to see if there is a possibility of a better choice than the best known so far.

You have to balance these two appropriately.

- AI dramatically improves productivity, but at the same time raises concerns about developer skill stagnation or regression.
After a few prompts with the cursor, the development is over. Rather, you can't build knowledge of React or Components and become dependent on AI again.
-> In the end, the overall productivity drops.
(You have to give good instructions, but because of the limits of your knowledge, you can only make requests that way...)

- ⭐️ A strategic approach that harmonizes the pursuit of immediate productivity with intentional efforts for continuous learning and skill development is necessary!!!
- Ultimately leads to sustainable growth and high performance.

### Vibe Coding and Productivity-First Approach

There are quite a few attempts to use it in practice.

- Vibe coding is not just about speed.
- It is a fundamental change that shifts the developer's cognitive load from detailed implementation to intent specification and high-level coordination.
- Accessibility, development speed, productivity improvement, and intent-driven development.
- The role of the developer may shift to product engineer, intent designer, creative director, prompter, guide...
(It doesn't take long to request that, does it?)

### AI for Competency Enhancement and Learning

- Use of AI as a learning catalyst
	- Understanding complex code
	- Learning new languages, technologies, or APIs

You no longer need to ask on Stack Overflow, in open chat rooms, or search on Google.
You can grow even more by learning with AI.

### The habit of unconditionally accepting at levels 3-5 is not good.

When it generates code, it says, `Do you want more explanation?`, `This code is composed of...`, but
people just accept it without thinking, the so-called 'click-click'.
(It's like a senior developer next to you giving you instructions without getting tired or annoyed, and you say "I'll do it myself".)

- When you request code generation in Ask or Agent mode,
	- It refines your request,
	- Shows you what plan it has to solve the problem,
	- And shows you in detail what it's thinking at each step.

'''
Give me 3 coding problems every morning to learn this skill. (easy, medium, hard)
Go to the official documentation, understand it, and translate it for me. (I'm too lazy for that. Summarize it in 3 lines for me.)
'''

### Securing dedicated time for learning

When you decide to use a new technology, you need to have time to practice, not just time to code right away.
(If you're not given time, you have to do it in your own time. Of course. We are experts (pros). We need to practice constantly.)

- Organizations and individual developers should allocate specific time to use AI tools in exploration mode.
- Set challenging or unfamiliar area goals.
- Actively utilize AI as a learning partner.

### Deliberate Practice

- All methods should utilize AI at various levels.
- It is necessary to periodically try developing at level 0 without AI intervention.
- Code Katas: Solving small programming problems in various ways.
- Toy Projects and Re-implementation: Creating your own designed side project and trying to remake or reconfigure it with various approaches.

## Augmented Developer

### The Growth Mindset of an Augmented Developer

- We need to transform into augmented developers who skillfully combine human intelligence and AI efficiency.
- AI is constantly evolving, and accordingly, the role of the developer will also continue to change.

Developers will eventually be needed for a while. Rather, because they are developers, they may be able to perform even better with AI.

---

# My brief personal thoughts

AI is developing too fast.
Even when I was working on a side project in February of this year, I was impressed by Cursor's front-end implementation skills,
but now it's as if it's a given, and it's integrating with other MCPs to become more sophisticated or even encroaching on the back-end.

So, will developers become unnecessary now?
No one can predict (not even Toby), but it seems that the era of developers is still here.
Of course, even if its appearance or work may be different from before.

The biggest thing I felt while using AI was that my ability to accomplish things grew very steeply.
Here, the ability to accomplish things means `what we want`, `making things work`.

But the more I do it, the more I wonder if this is really okay.
The code that AI produces varies greatly depending on how I construct the prompt, the context, or the AI's condition.

It's a dilemma whether the code is dirty or perfect.
It takes a very long time to clean up code that has been dirtied by AI once, and in addition, you have to follow the AI's thinking, not a human's.
With code written by a human, you can at least ask `Why did you do it this way?` or look for `comments` or `issues`.

How do I ask AI about this? Do I have to go back to the context, the model, the prompt at that time and ask?
Even if I find it and ask, will it give me a perfect answer and solution?

If the code is perfect, we will have to continue to rely on AI unless we fully internalize it.
How is this different from calling the old TV an idiot box?

I think for now, we need someone to mediate this illusion and contamination of AI.
If we can't have 100% trust in AI, we need to intervene and manage, and people need to develop.

As Toby said above, let's become people who get help from AI, but don't just exploit it, but also learn and explore.
