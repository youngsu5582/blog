---
title: "Creating My Own Workflow File (Subtitle: Issue-Based PR Auto-Generator)"
author: 이영수
date: 2024-07-28T08:41:23.943Z
lang: en
permalink: /posts/my-own-workflow-file-creation-issue-based-pr-auto-generator/
tags: ['automation', 'github action', 'wooteco', 'workflow']
categories: ['Developer Productivity']
description: "What I learned from running the workflow 200 times through trial and error"
image:
  path: https://velog.velcdn.com/images/dragonsu/post/b26d4a57-c842-4b4b-be05-3524bb1e5040/image.png
---
This post covers what I learned through numerous trials and errors while creating a desired workflow, how to avoid those pitfalls, and how to build a workflow.
If you have any questions or opinions, please contact me at `joyson5582@gmail.com` or leave a comment, and I will explain my views further.

First, before explaining the method,
the workflow I wanted to create was an `issue-based PR auto-generator`.

The reasons for wanting to create it were:

1. The inconvenience of having to copy and paste the same content (labels, issue numbers, assignees).
2. The possibility of confusion in conventions when each person creates a PR manually.
3. The desire to separate templates for frontend and backend.

![500](https://i.imgur.com/JxOU5dG.png)

(The number of runs I went through for this...)

Now, I will introduce the method I learned for creating my own workflow through trial and error.
## Find Existing Actions

Wait, why am I telling you to find existing actions when this is about creating your own workflow?

Most workflows already exist.
The problem is whether we can apply them depending on how much we can customize them and how well they work.

If you find an action that works well, there's no need to create the process yourself.

For my part, I found the `peter-evans/create-pull-request` action.
### Don't Use Actions Blindly

![500](https://i.imgur.com/YAqzVFV.png)

Most actions have very good explanations.
The README or Docs of the action explain the usage and input values very well.
It's much more important to understand the usage by reading the documentation than by just looking at GPT or example code.

> To use labels, write them as a comma-separated or newline-separated list.
> Assignees are a comma-separated or newline-separated list, and you should put the GitHub username.

Reading the official documentation like this is very important.
Before putting it directly into your workflow, study how to customize and use the action and what to be careful about with variable values.

I didn't know how to use this action and just put it in, and combined with errors in the workflow's development language (YAML + Bash + CLI), I ended up with 70-80 trials and errors...
### Understand Exactly What the Action Can Do

The beginning of the action or the `Action behaviour` section explains the intention and role of the action well.
[peter-evans/create-pull-request](https://github.com/peter-evans/create-pull-request)

```
A GitHub action to create a pull request for changes to your repository in the actions workspace.

Changes to a repository in the Actions workspace persist between steps in a workflow.
This action is designed to be used in conjunction with other steps that modify or add files to your repository.
The changes will be automatically committed to a new branch and a pull request created.
```

This is from the Preview section of the repository above.
`A GitHub action to create a pull request for changes to your repository in the actions workspace.`
`The changes will be automatically committed to a new branch and a pull request created.`
-> This action creates a PR for changes within the actions workspace.
-> It creates a new branch and automatically creates a PR.

```
The default behaviour of the action is to create a pull request that will be continually updated with new changes until it is merged or closed.
Changes are committed and pushed to a fixed-name branch, the name of which can be configured with the `branch` input.
Any subsequent changes will be committed to the _same_ branch and reflected in the open pull request.

How the action behaves:

- If there are changes (i.e. a diff exists with the checked-out base branch), the changes will be pushed to a new `branch` and a pull request created.
```

This is from the `Action behaviour` section of the repository.
`If there are changes (i.e. a diff exists with the checked-out base branch), the changes will be pushed to a new `branch` and a pull request created.`
-> If there are changes (compared to the checked-out base branch), the changes are pushed to a new branch, and a PR is created.

That's right... it's different from my intended purpose.
I wanted a branch to be created for an issue, and after working and pushing, a PR to be automatically created for that issue.

Therefore, you must find an existing action -> don't use it blindly -> understand exactly what the action can do before using it.
## Workflow Trial and Error

### Faithfully Understand the Basic Syntax

Through the trial and error above, I couldn't find the action I wanted, so I tried to create the workflow somehow.
As I said above, the trial and error without a faithful understanding of the basic language was just countless failures and meaningless failures.

To be honest, I still don't fully understand this part.
Still, I will explain what I have understood.
#### Basics
```bash
issue_number="${BASH_REMATCH[2]}"
```

When declaring a variable, there should be no space around the equals sign (`=`).

```bash
echo "BRANCH_NAME=$branch_name" >> $GITHUB_ENV
```

You can save a value to GITHUB ENV using the echo command. (Of course, you might be able to save it elsewhere, but I did it in ENV.)

> The value of ENV is shared within a single workflow. (Not shared across multiple workflows)

```bash
issue_number="${{ env.ISSUE_NUMBER }}"
```

A value defined in a previous step or initially in ENV is used with `${{ }}`.
#### Conditionals, Exits, and Regex
```bash
if [[ "$branch_name" =~ ^(feat|fix|refactor)/#([0-9]+)$ ]]; then
  branch_prefix="${BASH_REMATCH[1]}"
  issue_number="${BASH_REMATCH[2]}"
  echo "BRANCH_PREFIX=$branch_prefix" >> $GITHUB_ENV
  echo "ISSUE_NUMBER=$issue_number" >> $GITHUB_ENV
else
  exit 0
fi
```

A conditional statement consists of if - then / else / fi.
If you use if, fi is essential.

`exit 0` means exit with success, `exit 1` means exit with failure. (1 will naturally result in a red ❌, 0 in a ✅).

Actually, you might find this code strange.
Why is there a `=~`? - Surprisingly, it's an operator for matching regular expressions in Github Actions.
I'll skip the details of the regex. The result of the regex is stored in `BASH_REMATCH`.
#### curl & jq

```bash
response=$(curl -s -H "Authorization: token ${{ secrets.GITHUB_TOKEN }}" \
                  -H "Accept: application/vnd.github.v3+json" \
                  "https://api.github.com/repos/${{ github.repository }}/issues/$issue_number")
```

`curl` is very similar to the existing command.
Here, `secrets.GITHUB_TOKEN` is provided by default.
GitHub provides a lot of information by default.
[github-context](https://docs.github.com/en/actions/learn-github-actions/contexts#about-contexts)
- `github.event_name`: The event that occurred, such as push, pull_request, comment, etc.
- `github.actor`: The username of the actor who executed the workflow.
- `github.repository`: The repository where the workflow was executed.

I'll skip the values that come in the request and explain jq.

```json
  "labels": [
    {
      "id": 7165282542,
      "node_id": "LA_kwDOMSLtQ88AAAABqxWI7g",
      "url": "https://api.github.com/repos/youngsu5582/project-test/labels/bug",
      "name": "bug",
      "color": "d73a4a",
      "default": true,
      "description": "Something isn't working"
    },
    {
      "id": 7186191292,
      "node_id": "LA_kwDOMSLtQ88AAAABrFSTvA",
      "url": "https://api.github.com/repos/youngsu5582/project-test/labels/BE",
      "name": "BE",
      "color": "bfd4f2",
      "default": false,
      "description": "For backend"
    }
  ],
```

If the labels are like this?

```bash
echo "LEGACY_LABELS : $(echo "$response" | jq -r '.labels[].name')"
echo "REFACTOR_LABELS2 : $(echo "$response" | jq -r '.labels[].name' | awk '{ORS=", "}1')"
echo "LABELS : $(echo "$response" | jq -r '.labels[].name' | awk '{ORS=", "}1' | sed 's/, $//')"
```

What's the difference between these three?

```bash
LEGACY_LABELS : bug
BE
REFACTOR_LABELS : bug, BE, 
LABELS : bug, BE
```

- LEGACY recognizes `\n` as an actual newline.
- REFACTOR converts `\n` to `, `.
- LABELS removes the comma at the end.

Let's use them according to our preference (some actions work with a comma at the end, some don't).

`jq` is a command-line JSON processor.

I'll explain assuming all values are `"key":"value"`.
- `-r`: raw string output (`jq -r '.key'` -> `value`)
- `-e`: check filter condition (`jq -e '.key == "value"'` -> `0(true)`, otherwise `1(false)`)

Honestly, I think these two are enough.

> ORS is a value I learned for the first time.
> It's the Output Record Separator, which specifies the output record delimiter.
> The default is `\n`, but I changed it to `, `.

`sed 's/, $//'` -> convert the comma at the end of the string to an empty string.

### GH CLI

GitHub provides a very wide range of features.
https://cli.github.com/manual/

Through this, you can do everything from viewing PR lists to creating PRs, creating reviews, and creating views.

The features I need are:

1. Check if a PR from a specific branch to the base branch already exists. (Prevent re-creation, overwriting)
2. Automatically create a PR based on an issue.

Why didn't I use gh for issue search?

![500](https://i.imgur.com/fMJpw6t.png)

`gh` doesn't provide a lot of information. It gives it simply for the CLI.

```
existing_pr=$(gh pr list --state open -H "$branch_name" -B develop --json number -q '.[] | .number')
```

But what if you're checking if a PR that meets the conditions exists in the list like this?
(Status is Open, Head Branch is the branch we pushed, Base Branch is the target branch
-> get only the number in json format, and extract the number in jq format)

It's perfectly possible with `gh`.

```
gh pr create --assignee "${{ env.ASSIGNEES }}" --title "${{ env.PR_TITLE }}" --body "${{ env.PR_BODY }}" --base "develop" --label "${{ env.LABELS }}"
```

This command is even clearer. It creates a PR according to the options.

```yml
name: Auto Create Pull Request
on:
  push:
    branches:
      - 'feat/#*'
      - 'refactor/#*'
      - 'fix/#*'

jobs:
  auto-pull-request:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Extract Branch Prefix, Issue Number
        id: extract
        run: |
          branch_name="${GITHUB_REF#refs/heads/}"
          echo "BRANCH_NAME=$branch_name" >> $GITHUB_ENV
          if [[ "$branch_name" =~ ^(feat|fix|refactor)/#([0-9]+)$ ]]; then
            branch_prefix="${BASH_REMATCH[1]}"
            issue_number="${BASH_REMATCH[2]}"
            echo "BRANCH_PREFIX=$branch_prefix" >> $GITHUB_ENV
            echo "ISSUE_NUMBER=$issue_number" >> $GITHUB_ENV
          else
            exit 0
          fi

      - name: Check for Already Exist
        id: check_pr
        run: |
          branch_name=${{ env.BRANCH_NAME }}
          existing_pr=$(gh pr list --state open -H "$branch_name" -B develop --json number -q '.[] | .number')
          if [ -n "$existing_pr" ]; then
            echo "EXISTED=TRUE" >> $GITHUB_ENV
            echo "Alreadt Exist in https://github.com/${{ github.repository }}/pull/$existing_pr"
            exit 0
          fi
        env:
          GH_TOKEN: ${{ github.token }}

      - name: Fetch Issue Detail
        if: ${{ !env.EXISTED }}
        run: |
          issue_number="${{ env.ISSUE_NUMBER }}"
          response=$(curl -s -H "Authorization: token ${{ secrets.GITHUB_TOKEN }}" \
                            -H "Accept: application/vnd.github.v3+json" \
                            "https://api.github.com/repos/${{ github.repository }}/issues/$issue_number")
          assignees=$(echo "$response" | jq -r '.assignees[].login' | tr '\n' ',' | sed 's/, $//')
          assignees=$(echo "$assignees" | rev | cut -c 2- | rev)
          title=$(echo "$response" | jq -r '.title')
          labels=$(echo "$response" | jq -r '.labels[].name' | tr '\n' ',' | sed 's/, $//')
          labels=$(echo "$labels" | rev | cut -c 2- | rev)
          pr_title="${title}(#${issue_number})"
          echo "$response" | jq -r '.body' > issue_body.txt
          echo "ASSIGNEES=$assignees" >> $GITHUB_ENV
          echo "LABELS=$labels" >> $GITHUB_ENV
          echo "TITLE=$title" >> $GITHUB_ENV
          echo "PR_TITLE=$pr_title" >> $GITHUB_ENV
          echo "ISSUE_BODY_FILE=issue_body.txt" >> $GITHUB_ENV

      - name: Generate PR Body
        if: ${{ !env.EXISTED }}
        id: generate-body
        run: |
          issue_number="${{ env.ISSUE_NUMBER }}"
          echo "## 📌 Related Issue" >> body.md
          echo "" >> body.md
          echo "- closed : #${issue_number} " >> body.md
          echo "" >> body.md
          echo "## ✨ PR Details" >> body.md
          echo "" >> body.md
          echo "<!-- Please write down the modified/added content. -->" >> body.md
          summary=$(cat body.md)
          echo "PR_BODY<<EOF" >> $GITHUB_ENV
          echo "$summary" >> $GITHUB_ENV
          echo "EOF" >> $GITHUB_ENV

      - name: Create Pull Request
        if: ${{ !env.EXISTED }}
        run: |
          gh pr create --assignee "${{ env.ASSIGNEES }}" --title "${{ env.PR_TITLE }}" --body "${{ env.PR_BODY }}" --base "develop" --label "${{ env.LABELS }}"
        env:
          GH_TOKEN: ${{ github.token }}
```

That's right! Through this file, I have completed my own `issue-based PR auto-generator workflow`.

Of course, there might be unnecessary commands that can be made cleaner or omitted by using output between steps.
So what? It's a program I made myself.

![500](https://i.imgur.com/dJS8taj.png)

This also works with the reviewer auto-assignment workflow I made based on labels, making automation even easier.
### Conclusion

Workflows make everything a developer has ever thought of possible.
(What can't I do when I do something on GitHub?)

Especially

- GH CLI provided by GitHub
- curl for actual HTTP requests
- Numerous steps already created by people

Why not try making your own workflow through this kind of trial and error?

The repository containing the workflow is the Wooteco project I'm currently working on.
https://github.com/woowacourse-teams/2024-corea

As for future workflow plans (I'm tired after so much trial and error...),
I'm thinking of automatically creating a branch based on `develop` based on labels so that I can pull and start developing right away,
or sending a mention via Slack Webhook so that everyone pulls when there's a change in the `develop` branch.
(Of course, if I feel the need and the team members think it would be good to have)
#### Useless tips?

- Workflows operate based on the files in the branch you are currently working on. (Not the base branch ❌)
- It's best to start by logging what values you are giving and how to use them. (It's very difficult to check what values GitHub gives.)

![500](https://i.imgur.com/lT5DjsQ.png)

There are various values in the Payload like this, but I don't know if I just couldn't find them,
but there are many parts that are objects, and the Payloads received depending on the Action type are quite different.
That's why I think starting with `echo $RESPONSE` is a really good start.

- A PR created by a GitHub action (gh) does not trigger other workflows. (The reviewer assignment workflow has PR `opened`, but it doesn't work)
- Similarly, the actor becomes `github-action-bot`.
- You can't perfectly predict how a workflow will behave until you run it anyway. (In your own project, keep running it while paying attention to syntax and debugging)

If you have any other tips, I'd be grateful if you'd share them.
