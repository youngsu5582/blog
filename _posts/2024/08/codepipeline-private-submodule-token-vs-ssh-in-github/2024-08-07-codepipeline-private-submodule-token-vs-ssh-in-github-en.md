---
title: "Introducing Private Submodules in CodePipeline (Token VS SSH In Github)"
author: 이영수
date: 2024-08-07T16:04:25.567Z
tags: ['CodePipeline', 'AWS', 'CodeBuild', 'Wooteco']
categories: ['Infra', 'CI/CD']
description: "After about 50 attempts this time too..."
image:
  path: https://velog.velcdn.com/images/dragonsu/post/44daa2e8-33e2-4da3-a7e2-b75002a79f27/image.png
lang: en
permalink: /posts/codepipeline-private-submodule-token-vs-ssh-in-github/
---

> This post has been translated from Korean to English by Gemini CLI.

As I started using Github OAuth Login and JWT Tokens, key management became necessary.

While contemplating key management, we decided to use `Submodule`.
This was due to the fact that all team members could manage keys in a consistent state + changes could be managed.

After successfully running tests locally and deploying to CodePipeline, what was the result?
It failed beautifully..

Upon checking, it was a part where the submodule was not properly resolved in `CodeBuild`..
Clearly, in `CodeCommit`,

![350](https://i.imgur.com/miYvYnk.png)

It says that git submodules are enabled, but it didn't work.

Originally,
https://stackoverflow.com/questions/69593932/submodule-error-repository-not-found-for-primary-source-and-source-version

This content provides two options.

1. Initialize and update the submodule via `- git submodule update --init --recursive`.
2. `Under "Connection Status", try Disconnecting from Github -> Re-connect your login in the OAuth window prompt`
	Disconnect from Github and re-login with OAuth. (This seems to be a precaution in case the OAuth is not authenticated before receiving permissions??)

However, neither worked, and I had to find another way.

![350](https://i.imgur.com/u3PJ5XR.png)
(Countless struggles..)

The core problem was that the submodule could not retrieve values.
At this time, to get values from the submodule, you need to modify `.git/config`.

### .git/config ??

You may have used GIT a lot, but you may not have encountered `.git/config` often.
It must be related to GIT configuration files, right?

```git
[core]
        repositoryformatversion = 0
        filemode = true
        bare = false
        logallrefupdates = true
        ignorecase = true
        precomposeunicode = true
[submodule "backend/src/main/resources/corea-prod"]
        active = true
        url = https://github.com/youngsu5582/<private repository>.git

```

If you look at a project with submodules applied, it also contains content about `submodule`.

```bash
[Container] 2024/08/06 12:49:40.841414 Running command cat .git/config
[core]
    repositoryformatversion = 0
    filemode = true
    bare = false
    logallrefupdates = true
```

However, as a result of execution, there is no submodule related to config.
You need to add content about the submodule.

```bash
[Container] 2024/08/06 12:56:30.329651 Running command git config --add submodule.backend/src/main/resources/corea-prod.active true

[Container] 2024/08/06 12:56:30.335527 Running command git config --add submodule.backend/src/main/resources/corea-prod.url https://github.com/youngsu5582/<private repository>.git
```

If you add config directly like this,

```
[submodule "backend/src/main/resources/corea-prod"]
        active = true
        url = https://github.com/youngsu5582/<private repository>.git
```

This content is added.
However, `git submodule update --init --recursive` does not work.

Why?

To solve this problem, you need to know the principle of submodules.
To update a submodule,
1. Connect to the remote repository & properly initialize the base repository
2. Fetch the latest data and checkout to a specific commit
Must be done.

```
# 0. Initialize git file (create .git/config)
git init

# 1. Connect to remote repository
git remote add origin https://github.com/user/repo.git

# 2. Fetch latest data from remote repository
git fetch

# 2. Checkout to a specific commit
git checkout -f 1a2b3c4d5e6f7g8h9i0j
```

Okay, should I add and run it?

```
fatal: repository 'https://github.com/youngsu5582/<private repository>.git/' not found
fatal: clone of 'https://github.com/<private repository>.git' into submodule path ...
Failed to clone 'backend/src/main/resources/config' a second time, aborting
```

It will appear similar to this. (I also couldn't find one part, so I roughly brought it.)

CodeBuild performs builds on independent instances.
Naturally, this instance cannot access Private Repositories on Github.
We must grant permission.
### Method 1. SSH

Github can communicate via SSH in addition to the general `https://~~~.git` method for git clone.

`git@github.com:woowacourse-teams/2024-corea.git` You just need to change the front to git like this.
Settings - You need to register SSH keys in SSH and GPG keys.

At this time, since CodeBuild is the client trying to connect - Github is the server receiving the connection,
you need to put the public key on Github and the private key on CodeBuild and connect.

To generate a key?
`ssh-keygen -t ed25519 -C "joyson5582@google.com" -f ~/.ssh/id_rsa_2024_corea`

Of course, options are not necessary. Running the command generates both public and private keys.
(-C: Comment, last explanation -f: FileSystem, specify file path)

![350](https://i.imgur.com/Zbjc1Lw.png)

Put the key on Github, and AWS CodeBuild?

```yml
- mkdir -p ~/.ssh
- echo "$SSH_KEY" | tr ' ' '\n' > ~/.ssh/ssh_key
- sed -i '1i -----BEGIN OPENSSH PRIVATE KEY-----' ~/.ssh/ssh_key
- echo "-----END OPENSSH PRIVATE KEY-----" >> ~/.ssh/ssh_key
- chmod 600 ~/.ssh/ssh_key
- eval "$(ssh-agent -s)"
- ssh-add ~/.ssh/ssh_key
- git config --global url."git@github.com:".insteadOf "https://github.com/"
```

It looks quite complex, but it's simple.

> Q: What do the 2nd, 3rd, and 4th lines do?
> A:
> -----BEGIN OPENSSH PRIVATE KEY-----
	asodlalksjd....
-----END OPENSSH PRIVATE KEY-----
  PEM keys come in with line breaks like this. At this time, if you put these values into ENV as a whole, line breaks are not recognized.
  First, put the KEY value, then put it in the middle, and then put BEGIN and END on the first and last lines.

Put the file, give execution permission,
run `eval "$(ssh-agent -s)"` to run the agent in the current shell,
and add the key to the agent.

Finally! To use ssh, change to `git@github.com` and you're done!!

```yml
version: 0.2

env:
  variables:
    remote_origin: "git@github.com:woowacourse-teams/2024-corea.git"
    SSH_KEY: "${SSH_KEY}"  # Set PAT as environment variable

phases:
  install:
    commands:
      - mkdir -p ~/.ssh
      - echo "$SSH_KEY" | tr ' ' '\n' > ~/.ssh/ssh_key
      - sed -i '1i -----BEGIN OPENSSH PRIVATE KEY-----' ~/.ssh/ssh_key
      - echo "-----END OPENSSH PRIVATE KEY-----" >> ~/.ssh/ssh_key
      - cat ~/.ssh/ssh_key
      - chmod 600 ~/.ssh/ssh_key
      - eval "$(ssh-agent -s)"
      - ssh-add ~/.ssh/ssh_key
      - git config --global url."git@github.com:".insteadOf "https://github.com/"
      - |
        if [ ! -d ".git" ]; then
          git init
          git remote add origin "$remote_origin"
          git fetch
          git checkout -f "$CODEBUILD_RESOLVED_SOURCE_VERSION"
        fi
      - git submodule init
      - git submodule update --recursive
```


```
Cloning into '/codebuild/output/src1137548401/src/backend/src/main/resources/corea-prod'...
Submodule path 'backend/src/main/resources/corea-prod': checked out 'fd95100314b9eccbb0ec8ca123ce4328207ab3ee'
```

In this way, `submodule update` is successfully performed.
### Method 2. OAUTH

```
version: 0.2

env:
  variables:
    remote_origin: "https://github.com/woowacourse-teams/2024-corea.git"
    GITHUB_TOKEN: "${GITHUB_TOKEN}"  # Set PAT as environment variable

phases:
  install:
    commands:
      - git config --global url."https://${GITHUB_TOKEN}:x-oauth-basic@github.com/".insteadOf "https://github.com/"
      - |
        if [ ! -d ".git" ]; then
          git init
          git remote add origin "$remote_origin"
          git fetch
          git checkout -f "$CODEBUILD_RESOLVED_SOURCE_VERSION"
        fi
      - git submodule init
      - git submodule update --recursive
```

Actually, I struggled a lot trying to do this method at first, but it was simpler than the above method.
(The key point is that I gave up after struggling with only the token part above, without doing the bottom part.)

Just add GITHUB_TOKEN as you would add SSH, and you're done.
(At this time, `x:oauth-basic` at the end is also not necessary...)

It's really, really simple! Finally, I successfully built including the submodule.
### Conclusion

Any method allows additional logic in Git. (Not just submodules, pull and push are also possible if you want.)
For Github, OAuth Token method is recommended over SSH.

[In what ways is an SSH Key different from tokens for git authentication?](https://stackoverflow.com/questions/67077837/in-what-ways-is-an-ssh-key-different-from-tokens-for-git-authentication)

It is explained in detail in the content.

Tokens are:
- Unique: Specific to Github, generated for each user or service
- Revocable: Tokens can be revoked at any time, without affecting other credentials
- Limited use: Tokens can be scoped to allow only necessary access rights for specific use cases (e.g., read-only access to specific repositories)
- Randomness: The token itself is a random string, not affected by brute-force attacks

Therefore, if possible, use Github tokens to use Github.

```
