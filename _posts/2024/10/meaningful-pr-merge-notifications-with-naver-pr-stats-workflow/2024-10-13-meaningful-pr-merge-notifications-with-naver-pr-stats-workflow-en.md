---
title: "Meaningful PR Merge Notifications with Naver PR Stats Workflow"
author: 이영수
date: 2024-10-13T11:17:56.144Z
tags: ['pr-stats', 'Woowa Bros Tech Course', 'Collaboration']
categories: ['Developer Productivity']
description: "If you're curious about how many hours your team members review, how long PRs take, the number of conversations, and how many files/lines have changed"
image:
  path: https://velog.velcdn.com/images/dragonsu/post/f11aaab6-ca8c-4af0-a646-8eab04247a19/image.svg
lang: en
permalink: /posts/meaningful-pr-merge-notifications-with-naver-pr-stats-workflow
---

> This post has been translated from Korean to English by Gemini CLI.

Do your teams do PRs and code reviews?
Do you use collaboration apps like Slack or Discord?

At this time, if you have a thought like `I want to receive meaningful information when I merge a PR!`
This content can be useful.

If there are any incorrect contents or other good elements, please leave a comment or contact me at `joyson5582@gmail.com`! 

### Problems with existing Slack

Currently, our team uses Slack for communication among team members.
(We judged that everyone was already familiar with Slack because Wooteco used Slack for community.)
When merged through `Github Integration` provided by Slack, the information Slack shows is:

![350](https://i.imgur.com/z6kCQ0k.png)

It shows as above.

![350](https://i.imgur.com/qpd6Xqb.png)

(It shows opened ones so well, but why...)

As you can see, the information received when merged is somewhat disappointing.
Then, what information is important?

`https://api.github.com/repos/woowacourse-teams/2024-corea/pulls/594`
([PR Payload Official Document](https://docs.github.com/en/rest/pulls/pulls?apiVersion=2022-11-28#get-a-pull-request))

As such, when you query a PR, it returns countless information such as `labels`, `assignees`, `reviewers`, `merged time`, `body`, and `title`.

## Setting Notification Elements

This may vary in importance for each project & team.
Below are the parts that [our team](https://github.com/woowacourse-teams/2024-corea) considered important.

- Number of conversations
- Number of changed files / lines
- Average review response time
- Average approval time
- Total PR duration (creation time ~ merged time)

Our team has busy schedules with missions & job hunting, so we decided to aim for short issues & short PRs.
(To avoid putting too much burden and to allow them to take on code reviews & tasks)

Therefore,

Number of changed files / lines, PR duration - how small the issue and PR are
Average review response time / approval time - how quickly they participated in the review, whether the review was completed
Number of conversations - whether the code review was meaningful

I thought these were important factors.

![500](https://i.imgur.com/ZwaYPll.png)

(If these three are harmoniously combined like this triangle, it will be the best.)

However, when simply querying a PR, you cannot immediately receive enough of this information.
(Requires `reviews` query + `comments` query + additional queries)

However, doing it manually is very annoying.

There is a workflow that solves this!
It is https://github.com/naver/pr-stats, a workflow created by Naver.

(It extracts various information, not just single PRs, but all PRs, and information for each user! 🙂🙂)

![350](https://i.imgur.com/ncrAkAn.png)

You can find out more by visiting the site!

## Writing the Script

We used this content to send requests to Slack.

![350](https://i.imgur.com/ZCryN1z.png)

(It gives notifications as above.)

We created it using [workflow](https://github.com/woowacourse-teams/2024-corea/blob/develop/.github/workflows/pr-stats.yml) and [Python](https://github.com/woowacourse-teams/2024-corea/blob/develop/.github/scripts/pr-stats.py).
To briefly explain only the important parts:

```yml
- name: Analyze PR Stats and Notify
run: |
  python .github/scripts/pr-stats.py
env:
  SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
  PR_HTML_URL: ${{ github.event.pull_request.html_url }}
  ASSIGNEE: ${{ github.event.pull_request.assignee.login }}
  PR_NUMBER: ${{ github.event.pull_request.number }}
```

- `html_url` for hyperlinks
- `assignee` for praise 🙂
- `PR_NUMBER` to find the desired PR
- `WEBHOOK_URL` to send requests

```python
slack_webhook_url = os.getenv("SLACK_WEBHOOK_URL")
pr_html_url = os.getenv("PR_HTML_URL")
assignee = os.getenv("ASSIGNEE")
pr_number = os.getenv("PR_NUMBER")
```

These are passed when executing the Python file.

```python
def analyze_csv(file_path):
    with open(file_path, newline='') as csvfile:
        reader = csv.DictReader(csvfile)
        stats = []
        for row in reader:
            stats.append(row)
    return stats
```

Extract information from the CSV file.

```python
def extract_important_info(pr_data):
    return next((pr for pr in pr_data if pr['number'] == pr_number), None)
```

And then, find information that matches the current number.

```python
def format_duration(ms):
    if ms == 'NaN':
        return "N/A"

    total_seconds = int(round(float(ms))) / 1000
    days, remainder = divmod(total_seconds, 86400)  # 86400 seconds = 1 day
    hours, remainder = divmod(remainder, 3600)  # 3600 seconds = 1 hour
    minutes, _ = divmod(remainder, 60)

    if days > 0:
        return f"{int(days)} days {int(hours)} hours {int(minutes)} minutes 😢"
    else:
        return f"{int(hours)} hours {int(minutes)} minutes 🙂"

# response_time = format_duration(pr['averageResponseTime'])
```

Round and extract ms.
> Since it calculates the average, it includes ms and decimals.

After that, build Slack data.
(Create the desired form in [Slack Block Kit Builder](https://app.slack.com/block-kit-builder/)!)

## Conclusion

Currently, the created function does not work meaningfully because we are launching & deploying a real operating server. (Most of them are reviewed and merged in a short time)

However, by looking at these messages,
if you become conscious of `better code reviews`, `faster average response times`, and `shorter issue (PR) units`,
I think it will help even a little. ☺️

### References

> GitHub Integration cannot prevent merged ones from being received,
so opened ones are also turned off like `/github unsubscribe woowacourse-teams/2024-corea pulls`. 🥲

https://github.com/naver/pr-stats
