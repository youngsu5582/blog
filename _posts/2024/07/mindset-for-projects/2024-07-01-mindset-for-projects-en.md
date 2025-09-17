---
title: "Mindset for Projects"
author: 이영수
date: 2024-07-01T09:31:59.202Z
tags: ['Woowa Bros Tech Course', 'Wooteco', 'Project']
categories: ['Etc', 'Mindset']
description: "What kind of mindset is needed for a project? I thought about it lightly by myself during the vacation. It's not the answer, just my simple thoughts. At first, I thought about conventions and discussion points. (Whether to always wrap List in DTO, whether to include parentheses and detailed content in commit messages, etc.)"
image:
  path: https://velog.velcdn.com/images/dragonsu/post/b90da758-8e56-43a0-bf39-0f8fb1dd7b1f/image.png
lang: en
permalink: /posts/mindset-for-projects/
---

> This post has been translated from Korean to English by Gemini CLI.

What kind of mindset is needed for a project?
I thought about it lightly by myself during the vacation. It's not the answer, just my simple thoughts.

### Soft Skills for Projects

At first, I thought about conventions and discussion points.
(Whether to always wrap List in DTO, whether to include parentheses and detailed content in commit messages, etc.)

However, would conventions or technology be meaningful if the project cannot even start or if there is no mutual communication among team members?
Especially, I think I only thought about the mindset from a backend perspective.

Ultimately, I'm collaborating with frontend or Android developers whom I haven't met,
so I don't think technical requirements are the top priority.

It's a very tight schedule as I have to propose a topic right after school starts the next day,
but I hope there will be enough time to get to know who the other people are and their passion and goals for the project.

It's a long or short Level 3 and Level 4, and these are the people I'll be with.
To become good colleagues who complete the project together and have a good relationship,
I need to try to build bonds with each other steadily, without being too slow so as not to hinder the project.

### Project Topic

During the vacation, I thought about what kind of project topic to choose and what scale it should be.

My conclusion is that
I want to create a project that continuously reflects and adds requirements,
targeting people who can generate even about 20 traffic.

What I felt most strongly while doing Level 1 and 2 is that
what kind of technology, what kind of DDD, what kind of package structure
is meaningless unless you expand traffic and requirements.

Even when I encountered adding requirements and changing the technology used in a simple project like an escape room,
countless test codes broke, the service structure became disorganized from the original, and armchair discussions were meaningless.

Traffic is the same as the above.
Even if you say you introduced Kafka and asynchronous processing in preparation for an increase in users, what does it all mean if there is no traffic?

Therefore, even if the topic is a bit bad, or even if it already exists, if I think I can attract users,
I will not hesitate to persuade them to do that topic.

### Project Code

This is about how far to set conventions.

Wooteco did not teach us absolute conventions or code styles.
Lectures and reviews only provided direction.

Everyone will have their own code style, test style, package style, etc.
Would it even make sense to correct this? (If someone says something or touches me, I'll probably think, `Who are you?`)

1. So, I'm going to try my best to create an interface.
I'll only set the minimum limits and things to follow, and within that, implement it in various ways + as I want.

> To ensure consistency in communication with the frontend, if it's a List<`DTO`>, wrap it and
> create one more DTO to pass it on!
> EX) List<`ReservationResponse`> -> ReservationsResponse 

2. Additionally, if all team members are okay with it, I definitely want to do code reviews.

Because I believe that I can continuously lead to better quality + consistency.
Of course, I need to distribute it well so that it doesn't feel like a burden or a kind of stress.
(About once a week, a light code review or peer review for each other)

---

Rather than the quality or idea of the project,
I think I'll try to find my feelings and myself as a developer in the field among the projects I can show + control.

It would be a great happiness if I could launch or maintain a service,
but I want to proceed with projects focusing on what I can take care of rather than what I can't control and what is future-oriented.

Let's strive to be a person who can experience many experiences, deep bonds, and the happiness of creating services.
