---
title: "Learning GitHub from Basics (1) - A Linux Developer Pushes to My Repo?"
author: 이영수
date: 2024-08-25T06:58:18.868Z
tags: ['git', 'Git', 'GitHub', 'Wooteco']
categories: ['GitHub']
description: "How GitHub commits work"
image:
  path: https://velog.velcdn.com/images/dragonsu/post/5d4d7bf9-586f-4b6e-8b4b-35082b7b08dd/image.png
lang: en
permalink: /posts/learning-github-from-basics1-linux-developer-pushes-to-my-repo/
---

> This post has been translated from Korean to English by Gemini CLI.

These contents are organized based on my curiosities and the very good articles on the Programmers blog.
- [Git Command Collection for Beginners (1)](https://prgms.tistory.com/220)
- [Git Command Collection for Beginners (2)](https://prgms.tistory.com/221)
- [Git, GitHub Command Usage Tips](https://prgms.tistory.com/217)

The reason for organizing is that
I use GitHub in projects, and developers have no choice but to use GitHub,
but I feel like I'm using it without knowing the principles properly + without knowing the commands or functions well.

## Starting from Scratch

### Configuration Files

Git can configure files by scope.

- system: System-wide configuration file - `/etc/gitconfig` can be specified
- global: Current user (user logged into the shell) - `~/.gitconfig` can be specified
- local: Current working repository - `.git/config` can be specified

These settings are loaded in the order of system -> global -> local.
(That is, if there is a setting overridden in local, it is applied based on local)

Then, before committing, you need to set `user.name` and `user.email`. (You might have forgotten if it's been a long time)

```
git config --local user.name pobi
git config --local user.email pobi@gmail.com
```

But what happens if you set it to a value that is not your email or name?

![350](https://i.imgur.com/xvsSHfY.png)

In this way, Push works completely.

![200](https://i.imgur.com/eOvRD0n.png)

Why?
The name and email set in Git are simply signatures of who made the commit. They are not for authentication.

Therefore, when you Push, it is uploaded with that name and email.

![350](https://i.imgur.com/xxgzvqc.png)

Of course, it is possible to impersonate a famous person (above is the founder of Linux).

Then, you might think that it's possible for someone to impersonate me or a celebrity.
(Of course, when pushing to a remote repository, it operates based on SSH or PAT.)

To solve this uncertainty, GitHub has something called GPG.
### GPG

GPG is an acronym for GNU Privacy Guard.
Based on Mac,
```
brew install gnupg
```
Install with.

It ensures data confidentiality, integrity, and authentication through public key - encryption key.
And it follows OpenPGP (standard for public key cryptography).

```
gpg --full-generate-key
```
If you start generating a key through,

```
Please select what kind of key you want:
   (1) RSA and RSA
   (2) DSA and Elgamal
   (3) DSA (sign only)
   (4) RSA (sign only)
   (9) ECC (sign and encrypt) *default*
  (10) ECC (sign only)
  (14) Existing key from card
```
It asks for the encryption method like this.

```
RSA keys may be between 1024 and 4096 bits long.
What keysize do you want? (3072) 4096
Requested keysize is 4096 bits
```
It asks for the key size.

```
Real name: pobi
Email address: i894@naver.com
Comment: "Test Key"
You selected this USER-ID:
    "pobi ("Test Key") <i894@naver.com>"
```
It receives the real name, email, and comment as the user ID.

```
public and secret key created and signed.

pub   rsa4096 2024-08-25 [SC]
      2C072860295ADFD4E2A50D725366C23D85105AF9
uid                      pobi ("Test Key") <i894@naver.com>
sub   rsa4096 2024-08-25 [E]
```
Then, a key is created based on this.

To put this key in
Settings -> SSH and GPG keys,
```
gpg --armor --export pobi
```
Output the public key and copy and paste it. (At this time, you can export with any name, email, or comment.)

After that,
```
git commit -S
```
When committing, sign with the `-S` option.
At this time, the signature automatically retrieves the encryption key based on `user.email` and signs.

Then, the signed commit will be uploaded to GitHub!

---

With what I've thought so far,
You might think, "Isn't it the same if I create it with someone else's name and email and register the key?"
That's normal. I did too.

However,
![350](https://i.imgur.com/bEjTkFF.png)
If it's not an email authenticated in your account, `Unverified` appears like this.

![350](https://i.imgur.com/83VfaZW.png)
In this way, it is authenticated only when there is a GPG Key for the email I have authenticated.
### Conclusion

`Unverified` and commits with no value are untrusted commits.
Someone could maliciously impersonate and commit.

However, it would be too annoying not to trust all of this, right...?
In a project, it seems okay to go with trust-based without unnecessary suspicion.

```
git config --global commit.gpgSign true
```

To automatically sign all commits, turn on this option.
