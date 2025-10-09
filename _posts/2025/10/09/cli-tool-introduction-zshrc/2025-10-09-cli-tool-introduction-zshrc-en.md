---
title: >-
  CLI that Saves Seconds, Minutes, and Hours for Developers (1) - Introduction
  to zshrc and CLI Tools
tags:
  - CLI
  - Development Tools
  - zsh
  - Efficiency
description: >-
  Introducing ways for developers to enhance work efficiency through CLI and
  useful tools.
page_id: cli-tool-introduction-zshrc
permalink: /posts/cli-tool-introduction-zshrc/
author: Lee Youngsu
date: 2025-10-09T04:38:20.279Z
image:
  path: assets/img/thumbnail/2025-10-09-cli-tool-introduction-zshrc.png
lang: en
---
Developers have to type countless commands. From starting with GIT, connecting to servers via SSH, working with AWS, or handling databases, etc.

But entering these commands repeatedly is not only tedious but also difficult to memorize. By automating repetitive tasks through CLI, developers can focus on more important work.

This content will explain zshrc and introduce various CLI tools as well. (There are really very, very useful ones!)

> I used zsh + oh my zsh + Warp Terminal to set up in the zsh folder of the home directory. It shouldn't be too different, so you might refer accordingly.

The installation and introduction of zsh and oh my zsh are well documented in other blogs, so I'll omit it! 🫡

[Perfect Guide to Optimizing Terminal Environment Using .bashrc and .zshrc](https://notavoid.tistory.com/161)
[My .zshrc Zsh Configuration, Annotated](https://olets.dev/posts/my-zshrc-zsh-configuration-annotated/)
[Installing Zsh and Oh My Zsh](https://blackinkgj.github.io/zsh-installation/)
These might be helpful for reference.

## zshrc

zsh + rc (run command) is a configuration file that runs automatically every time the terminal starts. Typically, it exists in our home directory in the form of `.zshrc`.

We can define `environment variables`, `Alias`, `functions`, `setopt` in this file.

```sh
export PATH="$HOME/bin:$PATH"
export GEMINI_API_KEY={API_KEY}

alias obsidian='cd /Users/iyeongsu/Desktop/obsidian'
alias blog='cd ~/Documents/GitHub/blog/'

alias g='gemini'

function my-server() {
    sshpass -p 'password' ssh iyeongsu@192.168.112.24
}

bindkey -s '^h' 'history\n'

setopt CORRECT

setopt AUTO_CD
setopt AUTO_PUSHD
setopt PUSHD_MINUS
setopt PUSHD_SILENT
```

### export

When using commands, we sometimes need to set specific values in the ENV. (When trying to use GEMINI-CLI, for example, we use GEMINI_API_KEY in the ENV)

Through such environment variables, important values can be set and used without exposure to outside.

However, entering and executing `export GEMINI_API_KEY={API_KEY}` in a specific terminal each time would be very inconvenient. By putting `export` in the zshrc, we can use the environment variables without having to remember or type them each time.

### alias

It is literally a nickname. Using alias allows for shortening long commands for convenience.

`cd ~/Documents/GitHub/blog/` -> `blog`
`gemini` -> `g`

It can be used easily like this.

### function

The point that simplifies our tedious tasks. There are limitations with alias alone.

For example?
`I want to select a folder and then perform additional tasks there.`
`Bring AWS Log immediately and save it to a file.`

and so on. Such complex elements can be written as functions. (Function examples will be covered in the next post!)

### key binds

This maps keyboard shortcuts to zsh. `bindkey -s '^h' 'history\n'` means that pressing Ctrl + h will execute the history command.

Through key bindings, frequently used commands can be executed by shortcut keys, increasing work speed.

>If you like keyboard shortcuts, it might be fine...?
I seem more accustomed to shortening with aliases and typing them directly, so I usually use it that way.

### setopt

These are some settings provided by zsh. It turns on and off various features of zsh.

- setopt ... : Role to turn on specific options
- unsetopt ... : Role to turn off specific options

[Options](https://zsh.sourceforge.io/Doc/Release/Options.html)

There are various options to refer to.
For example,

```
# Shows correction suggestions before executing if there are typos in the command.
# Example: gti -> git? [y,n,a,e]
setopt CORRECT

# Move to the directory by entering the path without the 'cd' command.
# Example: Entering /etc and pressing enter moves to /etc.
setopt AUTO_CD
```

There are options like these.

### source

After adding all the above elements, a single zshrc file can exceed 1000 lines making it difficult to manage. In that case, files can be divided by each function or setting to manage.

```sh
# ~/.zshrc
# This file loads shell configuration from files in ~/.config/zsh and ~/.config/zsh/functions

# Define colors for output
C_YELLOW='\033[1;33m'
C_CYAN='\033[0;36m'
C_RESET='\033[0m'

echo -e "${C_YELLOW}--- Loading Zsh configuration ---${C_RESET}"

# Source configuration files
for config_file in "$HOME/.config/zsh/"*.zsh; do
  if [ -f "$config_file" ]; then
    echo -e "  -> Sourcing ${C_CYAN}$(basename "$config_file")${C_RESET}"
    source "$config_file"
  fi
done

# Source function files
if [ -d "$HOME/.config/zsh/functions" ]; then
    echo -e "${C_YELLOW}--- Loading Zsh functions ---${C_RESET}"
    for function_file in "$HOME/.config/zsh/functions/"*.zsh; do
      if [ -f "$function_file" ]; then
        echo -e "  -> Sourcing ${C_CYAN}$(basename "$function_file")${C_RESET}"
        source "$function_file"
      fi
    done
fi

# Unset loop variables and colors
unset config_file function_file C_YELLOW C_CYAN C_RESET
echo -e "${C_YELLOW}--- Zsh configuration loaded ---${C_RESET}"
```

It loads elements from the folder into zsh.

![](https://i.imgur.com/dx47ziy.png)

> The above C_YELLOW, C_CYAN, etc., are color designations for better readability.

## Recommended CLI Tools

> This content is mainly targeted at backend developers, but I think it would be useful for other developers as well...?
>  p.s As I summarize, why are there so many?

A brief list of the elements below

```
* File system navigation and search: eza, fd, bat, glow
* Text search and processing: rg
* Network and API Testing: httpie, httpyac
* Development and Infrastructure Management: gh, git-delta, jira-cli, aws-cli, lazydocker
* Editors: neovim & lazyvim, btop
```

Let's start with simpler elements.

### tldr

Sometimes when trying to view command help via the manual, it can be too complex.
tldr collects simple command samples that can be used immediately and shows them.

![](https://i.imgur.com/HCfZ3Fy.png)

It provides quite a few commands that can be used conveniently.

![](https://i.imgur.com/xOsDdzf.png)

If missing,

```
This page doesn't exist yet!
Submit new pages here: https://github.com/tldr-pages/tldr
```

You can contribute to open source!

### eza

Replaces the existing ls.

![](https://i.imgur.com/zWB6OuI.png)

(Left is eza, right is ls)

It adds color, makes sizes human-readable, etc., and provides conveniences.
It is written in rust, so it is also fast.

- eza -lT -L 2 : Shows directories in a tree format (shows files inside folders, `-L 2` : search up to depth 2)
- eza -l -r -s size : Shows files in descending order of size.

```
(choices: name, Name, size, extension, Extension, modified, changed, accessed, created, inode, type, none)
```

are available choices.

### fd

Replaces find. It is faster than the traditional find through parallel processing.
Additionally, it respects files in `.gitignore` by default when searching, but you can include hidden and ignore files with -H, -I.

- fd txt : Searches for files with the txt extension.
- fd "^2024" : Searches for files containing strings starting with 2024.
- fd "spring" -x bat : Executes the command on the searched elements.

The biggest advantage is searching files without unnecessary options.

### rg (ripgrep)

Replaces grep. It is faster than grep and offers convenient features.
Additionally, like fd, it respects `.gitignore`.

- rg -l "import" -t js : Searches for filenames containing import among js files
  (`find . -name "*.js" -print0 | xargs -0 grep -n "import"`: The traditional way is quite complex.)

- rg "my_function" : Searches recursively in the current directory
  (`grep -r -n --color=auto "my_function" .`: rg inherently provides recursion + line number.)

### bat

Replaces cat.
Instead of simply showing the file content, it formats the code and shows line numbers, etc.

![](https://i.imgur.com/q52fNLJ.png)

- bat -p : Shows flat comments without line numbers.

It looks almost like an IDE when viewing from the terminal, which is nice.

### glow

Formats and shows markdown.
Of course, images, etc., are not shown, but like bat, it improves readability through highlighting.

![](https://i.imgur.com/MdaV8Bh.png)

- `glow github.com/eza-community/eza`: Retrieves and views the README.md on GitHub.
- `glow https://example.com/file.md`: Views md at a specific URL.

### httpie

It is an HTTP Client in command-line format.
It replaces the existing curl, wget.

It has advantages like intuitive syntax, output formatting and specification, additional features (authentication, session, redirection, etc.)

- `http -f POST https://example.com/upload cv@/path/to/my_resume.pdf`: Sends a POST + path + assigns the file to the cv field request.
- `http -p HhBb :3000/data`:  GET format + Request's Header, Body + only Response's Header, Body output.

![](https://i.imgur.com/x9GRvjO.png)

It also outputs JSON nicely.

There is an initial learning curve, but once adapted, you can request more clearly & diversely than with the existing curl and wget.

### httpyac

It lets you execute `.http` files on the CLI.

```http
POST http://localhost:8100/oauth2/api/accounts/login  
Content-Type:application/json  
Accept:application/json  
  
{  
  "username": "yslee",  
  "password": "password!"
}
```

It also supports other protocols (gRPC, graphQL ...)

- httpyac send -a : Sequentially sends all requests in the http file.
- httpyac send --junit : Outputs formatted as Junit tests.
- httpyac send auth.http -n login --json | jq -r '.response.body.accessToken': Specifies login with -n + outputs formatted as JSON + outputs only necessary parts with jq.

```sh
# 1. Sends login request, gets result as JSON with --json option
# Extracts accessToken from response body using jq
echo "Attempting to log in..."
ACCESS_TOKEN=$(httpyac send auth.http -n login --json | jq -r '.response.body.accessToken')

if [ -z "$ACCESS_TOKEN" ]; then
 echo "❌ Failed to get access token."
 exit 1
fi

echo "🔑 Login successful. Token acquired."

# 2. Sends extracted token to the next request with --var option
echo "Fetching private data with the token..."
httpyac send data.http -n getMyData --var token="$ACCESS_TOKEN"
```

Through such scripts, it can also be handled!
Most servers may require processing once authenticated, allowing you to store and send various logic requests through similar codes for easy management.

> httpie makes HTTP requests elegantly like modern Java, while httpyac provides systematic management based on http files.

### gh

GitHub Official CLI
Manages all GitHub features from the terminal - repository, issues, PR, workflows, etc.

In fact, it has so many options that it needs to be examined personally to have meaning.
Another advantage is that it can be executed even before the workflow is merged. (Workflows do not appear on the GitHub page before merging)

#### git-delta

Applies formatting to git show, git diff, git log commands.

![700](https://i.imgur.com/8kp9TcD.png)

```
[core]
	pager = delta
[interactive]
	diffFilter = delta --color-only
[delta]
	navigate = true
	side-by-side = true
    line-numbers = true
    navigate = true  # Activates file navigation with n/N in less
    keep-plus-minus-markers = true # Retain +/- symbols

[merge]
	conflictStyle = zdiff3
```

You need to add options to `.gitconfig` for it to work.

### jira-cli

Allows using Jira in the CLI.
Board, sprint view, issue list and view, etc.

- jira open {issue}: Opens issue in web browser
- jira issue view {issue}: Retrieves and displays the issue in the terminal

jira-cli is more about allowing additional tasks in the terminal than providing diverse functionality.

### aws-cli

Lets you perform most AWS functions in the CLI.

There is nothing it can't do, from downloading S3 files, EC2 viewing, EC2 overview, DynamoDB, to CloudWatch.

- `aws ec2 describe-instances --filters "Name=tag:Name,Values=*Value*" "Name=instance-state-name,Values=running"`:
  Queries the status of ec2, which has `*Value*` as name and ec2's state as running.

- `aws s3 cp "s3://$bucket/$object_key" "./$filename"`: Copies the file in s3 to local folder.

- `aws logs filter-log-events --log-group-name "$log_group" --start-time "$start_time" --end-time "$end_time"`:
  Searches logs corresponding to log group name + from start time to end time.

### lazydocker

Makes managing docker really pleasant in CLI.

![700](https://i.imgur.com/2KoHQPs.png)

Generally, rancher desktop or docker desktop is nice to see but a bit difficult to manage, thanks to the menus it provides when you press x it makes management easy.

![](https://i.imgur.com/m7MjJIL.png)

Everything can be done with the keyboard, like remove, restart, etc.
This CLI tool comes highly recommended! ⭐

### neovim & lazyvim

Actually, I don't particularly like working with vim?
There are times when firing up vscode or idea feels bothersome + I have to manage it through a terminal.

Even then, if you use this neovim, you can work almost like with an IDE.

Forked from Vim in 2014, it has Lua Script, built-in LSP, asynchronous features, etc., and has more advantages than traditional VIM.

However, simply installing neovim requires doing the settings and plugins from start to finish.
Using lazyvim offers default settings and provides additional useful features.

![700](https://i.imgur.com/m5vSdX6.png)

File search, recent files, projects, etc., and

![700](https://i.imgur.com/hvE4FkK.png)

Automatically manages plugins.

![700](https://i.imgur.com/COQkiSe.png)

The default view when setting it seems sufficient on its own...?

### btop

![](https://i.imgur.com/vX33bBW.png)

Displays it more neatly than existing htop, top.
If you found it useful before, this might be useful too?

## fzf ⭐️⭐️⭐️

This fzf is categorized separately at the top.
That much, it dramatically enhances user UX through this fzf.

[GitHub Link](https://github.com/junegunn/fzf)

`A command-line fuzzy finder` enables searches by rough patterns without needing exact matches.

- Executes additional tasks based on input received by fzf through xargs
- Shows other elements as preview

It performs functions like these.

As a simple example, when managing files using `git stash`.

![](https://i.imgur.com/cgkh1B5.png)

Viewing through `list` requires understanding through titles, presenting occasional difficulties.

```sh
function gs() {
    local selected_stash
    selected_stash=$(git log -g refs/stash --pretty=format:'%gd%x09%ci%x09%an%x09%s' \
        | fzf --reverse --prompt="Select Stash > " --header="ID | Date | Author | Message" \
               --preview="git stash show -p {1} | bat --color=always --paging=never")

    if [[ -n "$selected_stash" ]]; then
        local stash_id
        stash_id=$(echo "$selected_stash" | awk '{print $1}')
        echo
        read -k1 "action? (a)pply, (p)op, (d)rop, or (c)ancel? "
        echo
        case "$action" in
            a|A) git stash apply "$stash_id" ;;
            p|P) git stash pop "$stash_id" ;;
            d|D) git stash drop "$stash_id" ;;
            *)   echo "Cancelled." ;;
        esac
    fi
}
```

With functions like this

![](https://i.imgur.com/Hae2zVL.png)

Stashes can be managed:

- Appropriately filters and displays according to search keywords (very fast, although not evident now due to its simplicity)
- Previews elements on the right
- Allows actions like apply, pop, drop with a, p, d keys upon selection

Thus, fzf allows easy search and management, making complex tasks more straightforward.

- `fzf --reverse`: Displays list order reversed
- `fzf --query="youngsu5582"`: Pre-input initial search term in the search box
- `fzf --preview=git stash show -p {1} | bat --color=always`:
  Provides a preview of the currently selected item, now shows the selected commit with show -> nicely formatted with bat


In the next post, we'll delve into how to manage with this fzf 🙂
