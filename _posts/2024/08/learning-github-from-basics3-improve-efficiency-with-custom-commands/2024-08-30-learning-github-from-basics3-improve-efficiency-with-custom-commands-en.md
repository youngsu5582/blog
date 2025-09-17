---
title: "Learning GitHub from Basics (3) - Improving Efficiency with Custom Commands"
author: 이영수
date: 2024-08-30T03:38:15.216Z
tags: ['git', 'Git', 'GitHub', 'Wooteco']
categories: ['GitHub']
description: "Custom commands that can reduce 1 second"
image:
  path: https://velog.velcdn.com/images/dragonsu/post/b881b89c-bae0-4165-93e6-09357e7ce87d/image.png
lang: en
permalink: /posts/learning-github-from-basics3-improve-efficiency-with-custom-commands
---

> This post has been translated from Korean to English by Gemini CLI.

This content consists of commands that can be used for efficiency in projects.
If there are any incorrect contents or commands that can be added, please leave a comment or contact me at `joyson5582@gmail.com`! 

This content continues from [the previous content](https://velog.io/@dragonsu/%EA%B9%83%ED%97%88%EB%B8%8C-%EA%B8%B0%EC%B4%88%EB%B6%80%ED%84%B0-%EC%8B%9C%EC%9E%91%ED%95%98%EA%B8%B02-%EB%AA%85%EB%A0%B9%EC%96%B4-%EC%B0%A8%EA%B7%BC%EC%B0%A8%EA%B7%BC-%EC%A0%95%EB%A6%AC%ED%95%98%EA%B8%B0).
### Creating Git Custom Commands

Below, before explaining, I will explain how to create custom commands in Git.

```
git config --global alias.st "status"
```

You can specify it as a command like this.

```
[alias]
	st = status
```

You can also specify it directly in the git file mentioned in the first part.

## Using Git Log

![550](https://i.imgur.com/7UuJuJ1.png)

When `git log` is called, it is detailed, but you cannot see summarized or meaningful values.

```
git log --pretty=format:'%C(blue)%h %C(black)%s %C(magenta)(%cr)%C(bold green) %an'
```

What happens if you run this command?

![600](https://i.imgur.com/hxWQNLU.png)

It appears concisely, as shown above.

To explain the options:
`%C(<color>)`: Specifies the color.
`%h`: Short commit hash value (`%H` is the long hash value).
`%s`: Commit message subject.
`%an`: Author's name (at this time, our project automatically generates it with `github-action`, so it appears like that).
`%cr`: Commit time (relative time).
It is composed like this.
(There are various attributes, so you can output logs as needed - refer to [git log pretty format](https://git-scm.com/docs/git-log#_pretty_formats))

Then, referring to `Creating Git Custom Commands` above,
`git config --global alias.l "log --pretty=format:'%C(blue)%h %C(black)%s %C(magenta)(%cr)%C(bold green) %an'"
When `l` is entered, it becomes the above command.

Let's use these commands more professionally here.

`git l -p backend/src/main/java/corea/feedback/controller/UserFeedbackControllerSpecification.java`

Fetches commits where the file has changed. (`-p` also includes the changed body).

`git l -S '@Profile("dev")'`

Fetches commits where the change `@Profile("dev")` occurred in the file.

`git l --author="youngsu5582`

Fetches commits where the commit author is youngsu5582.

In this way, you can cleanly perform additional searches based on custom commands.

```
reverse = "!f() { \
	if [ -z \"$1\" ]; then \
		l --reverse -n 4 \
	else \
		l --reverse -n ${1} \
	fi; \
	unset -f f; \
}; f"
```

Additionally, you can execute functions using `!f()`.
If there are no parameters? (if statement) -> Output 4 in reverse.
If there are parameters? (else statement) -> Output as many as the number of parameters.

![600](https://i.imgur.com/hUmdHaF.png)

It is also possible to input additional parameters like this.
## Create if branch does not exist / Move if branch exists
Generally,
To create a branch?
-> `git checkout -b XXX`, `git switch -c XXX`
To move a branch?
-> `git checkout XXX`, `git switch XXX` 
Perform as above.

 >Difference between checkout and switch?
 >
 >Checkout is used for various purposes such as branch switching, commit checkout (reverting), etc.
 >Switch can only switch branches.
 >-> It's better to use switch if possible.
 
And, if you try to create an already existing branch?
`fatal: a branch named 'be_dev_deploy' already exists` It warns that it already exists.

You might have felt the inconvenience of being confused about whether it already exists, or wanting to move regardless of that. (I certainly felt it ㅇ.ㅇ..)

 ```
 sw = "!f() { \
		if git show-ref --verify --quiet refs.heads/$1; then \
		   git switch $1; \
		else \
		 git switch -c $1; \
		fi; \
		unset -f f; \
}; f"
```

If you execute the above command, it moves if it exists + creates and moves if it doesn't exist.
How does the `git show-ref --verify --quiet refs/heads/XXX` command detect it?
- `git show-ref` 
GPT says `shows all references in the repository`.
Simply put, it's convenient to think of it as showing pointers to information related to the repository.
```
git show-ref
ec3c0af519649fc8175a18719f11094d1f4582c0 refs/heads/be_dev_deploy
3922afc79a6a8fd1eedc0e34b9f1979af5abf7f4 refs/heads/develop
931a51c702a464494c36252d65f9935ff2b3370f refs/heads/feat/#302
e74920a56c5a86769aaf7239d88181680308a5b refs/remotes/origin/test_deploy
689e0178030b56439bb1d152ae992fcb5622f2a4 refs/stash
87c30e5bdd46f5d2a337ba2d019c5200740d40e3 refs/tags/v1.0.0
```
It shows branches, branches existing in remotes, tags, etc.
If it doesn't exist, `--verify` causes `fatal`, and `quiet` does not generate a result.

> How does it detect if it doesn't generate a result?
> Commands executed within an if statement are designed to return a status code.
> 0 for success, 1 for failure.
> -> `fatal` returns 1.

### refs/heads
What is refs/heads?
Literally, it's the branch where branches are stored.
You can check it yourself.
Like `cd .git/refs/heads`

![600](https://i.imgur.com/lk6XMAA.png)

![600](https://i.imgur.com/P0gsoTg.png)

Folders are created with `/` as the separator. (`feat/#311` -> `feat` + `#311`)
These files cannot be viewed or touched directly.
Work can be done through `show-ref` or `update-ref`. (When we push or fetch commits, these values change.)

In conclusion,
If a branch exists, it moves; if a branch does not exist, it is created!

## Convenience Commands
As for the rest, I looked for more, but they didn't feel revolutionary, just convenient commands.
Is it like IntelliJ shortcuts?

```
l = log --pretty=format:'%C(blue)%h %C(black)%s %C(magenta)(%cr)%C(bold green) %an'
last = "l -1 HEAD"
s = "status"
b = "branch -v"
ob = "branch -rv"
delete = "branch -D"
undo = "reset --soft HEAD~1"
ps = push origin HEAD
head = rev-parse --abbrev-ref HEAD
rbd = git pull origin develop --rebase

reverse = "!f() { \
                if [ -z \"$1\" ]; then \
                 git l --reverse -n 4; \
                else \
                 git l --reverse -n ${1}; \
                fi; \
                unset -f f; \
         }; f"

sw = "!f() { \
			if git show-ref --verify --quiet refs.heads/$1; then \
			   git switch $1; \
			else \
			 git switch -c $1; \
			fi; \
			unset -f f; \
		}; f"
```

This should be about it.
It's very trivial, but if it can reduce even 0.1 seconds of repetition, isn't it meaningful?

Various commands will be possible. (It's possible to receive additional parameters and execute functions.)
It would be good to create and spread elements that team members would find convenient in each project.

```
