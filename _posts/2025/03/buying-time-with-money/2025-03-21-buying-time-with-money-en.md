---
author: 이영수
date: 2025-03-21 22:32:50.832000+00:00
description: I automated the creation of introductions and thumbnails when writing blog posts and improved the process using the OpenAI API. This article shares how to handle payments and tokens, shorten time, and increase work efficiency through a script, emphasizing the cost and time-saving benefits.
image:
  path: assets/img/thumbnail/2025-03-21-돈으로-시간-사기.png
tags:
- openai
- blog
- automation
title: 'Buying Time with Money - Subtitle: A script for automatically generating post introductions and thumbnails via OpenAI'
lang: en
permalink: /posts/buying-time-with-money/
---

> This post discusses how I solved an inconvenience I felt while writing my blog.

## The Inconvenience of Creating Introductions and Thumbnails

While blogging, I felt that writing an introduction and including a thumbnail for each post was very important for both SEO and readability.
So, with the help of GPT, I included an introduction and a thumbnail for each post.

At this time, I personally felt some inconvenience.

![500](https://i.imgur.com/769WdYi.png)

I had to go into GPT, copy and paste the post, and then write the content back into the introduction.

![500](https://i.imgur.com/oBNjPTn.png)

I had to use DALL-E to get an attractive image, and it was also inconvenient that I had to select a new model and make a request, rather than using the chat I used for the introduction above.

What can you do... A developer without money has to deal with the inconvenience themselves...
However, now that I have a job, this amount of money is nothing 😎 + I don't think I've ever used the Open AI API in code, so I decided to try it out.

## Payment

> Before explaining the model and how to use it, I will explain the payment integration and method.

Go to [payment-methods](https://platform.openai.com/settings/organization/billing/payment-methods) and register a payment method.

If you enter your card number, CVC, and address, it will be successfully registered as a payment method.
After registration, it will guide you through the payment process.

![400](https://i.imgur.com/Qfxkppo.png)

You decide whether to automatically recharge when the balance falls below the initial amount and threshold.
I set it to recharge $10 when the balance is below $5.

> A 10% tax is incurred. (When you proceed with $5, you will be charged $5.50)

Once the payment is complete,

```
We're happy to share that we've automatically moved your organization to **Usage Tier 1** 
based on your usage history on our platform
```

it will inform you that you have become Tier 1.
Then, let's go to [Limits](https://platform.openai.com/settings/organization/limits) to set the cost and budget.

> The API's Rate Limit is not really important, so we'll skip it.

![](https://i.imgur.com/5GPJWSu.png)

I also set a limit on the cost to avoid incurring too much expense, just in case.

### Pricing
Let's check the prices at [pricing](https://platform.openai.com/docs/pricing).

The price is calculated based on `Price per 1M tokens` (1,000,000).

![500](https://i.imgur.com/KqRpYVI.png)

There are many different models.
You can choose the appropriate model for yourself from among them.

At this time, you have to think about the fundamental question, `How many tokens will be generated?`

### Token Calculation

OpenAI makes it easy to find out how many tokens an input value has through [tiktoken](https://github.com/openai/tiktoken).

```python
import tiktoken

encoding = tiktoken.encoding_for_model("gpt-3.5-turbo")
text = """
...
"""

tokens = encoding.encode(text)
print("Number of tokens:", len(tokens))
```

> I was curious about this, so I studied it a little more.

OpenAI converts text into a sequence of numbers called tokens through BPE (Byte Pair Encoding).
(Surprisingly, it's a data compression algorithm proposed in 1994.)

It performs a method of finding the most frequently occurring pair of consecutive characters and merging them into a single character.
-> The initial dictionary is constructed from the occurring characters.
-> Two consecutive characters are merged into one character.
(Merging is based on frequency.)

From what I've felt while using it,

- The value of a combination does not change. (e.g., 1 is fixed as 16, `cab` is fixed as 55893)
- It creates an optimal set of subwords. (Even if 12346 appears about 10 times, it may be split into 123 and 46)

For a general article ([Ending a 3-month job search](https://youngsu5582.life/posts/3%EA%B0%9C%EC%9B%94-%EA%B0%94%EC%9D%98-%EC%B7%A8%EC%A4%80%EC%9D%84-%EB%81%95%EB%82%B4%EB%A9%B0/), 6652 words),
about 9350 tokens were generated.

### DALL-E 3

You can find more details about DALL-E 3 at the [DALL·E 3 API](https://help.openai.com/en/articles/8555480-dall-e-3-api).

In summary:

- Chat GPT automatically generates more detailed prompts. (Since most users cannot generate clear prompts)
- Only images of size `1024*1024`, `1024*1792`, and `1792*1024` can be generated.
- You can specify the `quality`. (`hd`: high quality, longer waiting time, more expensive <-> `standard`: moderate quality, cheaper)

That's about it.

The cost is as follows (Price per Image):

![](https://i.imgur.com/nq5RDQV.png)

If you generate Quality Standard and HD,
Top: standard, Bottom: hd

![200](https://i.imgur.com/gmpl6CZ.png)

![200](https://i.imgur.com/oEqOpgH.png)

-> It doesn't necessarily mean that only hd is good. (Choose according to your taste)

### Credit Grants

[Credit Grants](https://platform.openai.com/settings/organization/billing/credit-grants)

![](https://i.imgur.com/dtFosoT.png)

It shows you how much of your payment has been used and when it expires.

## Script
```python
client = OpenAI(api_key=os.environ.get('OPENAI_API_KEY', ''))
```

A key is required when creating a client.
It would be very inconvenient to inject this key value every time you run it or to hardcode it. (It's also awkward to upload it to GitHub.)

### runner-with-env.py

```python
# test_run.py  
import os  
import subprocess  
import sys  
from dotenv import load_dotenv  
from pathlib import Path  
  
load_dotenv(dotenv_path=".env")  
process_path = "utils/process_thumbnail_and_description.py"  
  
requirements_path = Path(__file__).resolve().parent / "requirements.txt"  
  
print("📦 Attempting to install requirements.txt... : ", requirements_path)  
  
try:  
    subprocess.run(  
        [sys.executable, "-m", "pip", "install", "-r", str(requirements_path)],  
        check=True  
    )  
except subprocess.CalledProcessError:  
    print("❌ Package installation failed. Please check if requirements.txt is correct.")  
    sys.exit(1)  
  
print("✅ Package installation complete.")  
  
# 3. Run subprocess (actual processing logic)  
print("🚀 Running script.")  
try:  
    subprocess.run(  
        [sys.executable,process_path],  
        check=True  
    )  
except subprocess.CalledProcessError:  
    print("❌ An error occurred while running the processing script.")  
    sys.exit(1)  
  
print("✅ Processing complete.")
```

To make it easier to use,
1. The parent process loads the env and sets the environment variables.
2. Install dependencies.
3. Run the child process.

I have configured another script in this format.
If you want to replace it with another process + replace the dependencies, you just need to change the path.

### Chat Model

```python
def generate_description(prompt: str, language="ko") -> str:  
    print("Sending API request to generate description.")  
    completion = client.chat.completions.create(  
        model="gpt-4o-mini-2024-07-18",  
        messages=[
            system_message,
            {"role": "user", "content": prompt}
        ],  
        temperature=0.2,
        max_tokens=350,  
    )
    print("API request for description generation is complete.")  
    summary = completion.choices[0].message.content.strip()  
    print(completion)  
    return summary

def generate_summary_prompt(content: str, language: str = "ko") -> str:
    return f"""Summarize the following text concisely in {language}.  
The length of the summary must be at least 50 characters and no more than 100 characters.  
Be careful not to cut off sentences in the middle, and end them naturally with a period, etc.  
Only output the summary, and do not write any other explanations or phrases.  
  
Text:  
{content}""".strip()
    ```

It dynamically generates a prompt, sends a request, and receives and uses it.
I limited the temperature to 0.2 because the response should not be too large (350 tokens) and there is no need to guarantee randomness.

```python
system_message = {  
    "role": "system",  
    "content": (
        "The output summary must be at least 50 characters and no more than 100 characters, the sentence must not be cut off in the middle, "  
        "and it must end naturally with a period, etc. Do not include any additional explanations or phrases."
        "Write it as if a person were writing it."
    )
}
```

The `system_message` is also passed.

It returns a `ChatCompletion` that we can use.
(It gives a lot of information.)

Elements we can utilize:

- `created`: Unix Timestamp (EX: 1742559896)
- `choices[].message.content`: The text response generated by the AI
- `usage.prompt_tokens`: The number of tokens consumed in the request
- `usage.completion_tokens`: The number of tokens consumed in the response
- `usage.total_tokens`: The total number of tokens consumed

That's about it.

So, if we calculate the approximate cost here?

Assume that an input of 5208 tokens and an output of 76 tokens occurred.

- 5208 × ($0.150 / 1,000,000) = $0.0007812

- 76 × ($0.600 / 1,000,000) = $0.0000456

> The input and output costs are different.

The sum of the two is about `$0.00083`. -> When converted, it is `₩1`. (Actually, the image is the main culprit for the cost ☺️)

### Image Model

```python
def generate_and_save_image(prompt: str, save_path: Path):  
    print("Sending DALL-E API request to generate thumbnail.")  
    response = client.images.generate(  
        prompt=prompt,  
        model="dall-e-3",  
        n=1,  
        quality="hd",  
        size="1024x1024"
    )
    print("DALL-E API request for thumbnail generation is complete.")  
    print(response)

    image_url = response.data[0].url  
    img_data = requests.get(image_url).content  
    with open(save_path, 'wb') as f:  
        f.write(img_data)

def generate_thumbnail_prompt(title: str, description: str) -> str:
    return f"""  
Create a clean and modern thumbnail illustration for a backend technical blog post.  
I NEED to test how the tool works with extremely simple prompts. DO NOT add any detail, just use it AS-IS.  
  
📌 Post Title: "{title}"  
📝 Post Description: "{description}"  
  
🎯 Style and Content Guidelines:  
...""".strip()
```

Looking at the settings,
I used the DALL-E 3 model, set the size to the minimum, and the quality to hd. (Even if it's a bit expensive, to use a vivid image)

> I NEED to test how the tool works with extremely simple prompts. DO NOT add any detail, just use it AS-IS.

As mentioned above, DALL-E 3 automatically generates prompts, but if you include the above phrase, it will follow the guidelines I set as much as possible. - [Related Guide](https://www.restack.io/p/openai-python-knowledge-answer-dalle-playground-cat-ai)

As for the return value,

- `revised_prompt`: The final prompt that the API has internally refined and actually used.
- `url`: The pre-signed url of the generated image file - You can download and view it through an HTTP Client.

and so on.

Since there is a cost per photo, it costs `$0.08` each time it is run. (`₩117` - I think it's a bit expensive, but also cheap...?)

### main

```python
post = frontmatter.load(file_path)

if not check_exist(post, 'description'):  
    prompt_for_description = generate_summary_prompt(post.content)
    summary = generate_description(prompt_for_description, language="ko")
    post['description'] = summary

if not check_exist(post, 'image'):  
    if not check_exist(post, 'title'):  
        raise ValueError("The post does not have a title. Cannot generate an image prompt without a title.")  
    prompt_for_image = generate_thumbnail_prompt(post["title"], post["description"])
  
    image_save_dir = workspace / "assets" / "img" / "thumbnail"
  
    image_filename = file_path.stem + ".png"
    save_path = image_save_dir / image_filename
  
    generate_and_save_image(prompt_for_image, save_path)
  
    relative_path = str(save_path.relative_to(workspace)).replace("\", "/")
    post['image'] = {'path': relative_path}

with open(file_path, 'w', encoding='utf-8') as f:  
    f.write(frontmatter.dumps(post))
```

`frontmatter` is a kind of metadata.
You can put the title, thumbnail, description, etc. here. (Obsidian also manages tags and information through this.)

It inserts the generated introduction and image values and overwrites the file.

```
description: This article provides a detailed explanation of the process of configuring an infrastructure using AWS Free Tier, including EC2, RDS, ElastiCache, and S3.  
  It covers various elements such as VPC setup, security group configuration, and integration with CodeDeploy and Github Actions, and suggests a cost-effective way to operate a server.  
image:  
  path: assets/img/thumbnail/2025-03-15-프리티어로만-배포해보기.png
```

The `description` and `image` are automatically added to the post.

## Conclusion
If you just change the file path and run it, it will automatically generate the introduction and thumbnail.

```
Processing file:  /Users/dragonsu/IdeaProjects/blog/_posts/2025-03-15-프리티어로만-배포해보기.md

Sending API request to generate description.
API request for description generation is complete.

Sending DALL-E API request to generate thumbnail.
DALL-E API request for thumbnail generation is complete.

Processing complete: _posts/2025-03-15-프리티어로만-배포해보기.md
```

I was originally going to put this element in a Github Action, but

- The fact that I have to commit the changes because the file is added and modified.
- The fact that I have to pull before I write because I am committing.

For these two reasons, I only included it as a utils function.
(I plan to approach whether it can be done through pre-commit in the future.)

I think I saved about 1 minute and 30 seconds.

- Time to go to GPT in a web browser - 10 seconds
- Time to copy the prompt into the input box + put in the article content - 20 seconds
- Time to wait for generation + time to copy - 20-30 seconds
- Use a new GPT Chat -> Time to copy the prompt into the input box + put in the article content - 15 seconds
- Time to wait for image generation + time to copy - 20-30 seconds
- Time to enter `description` in the post and save it in the image folder + enter `image/path` - 20 seconds (It's very annoying to enter `image/path` one by one.)

Now what do we do?

- Change `file_path` in the script - 10 seconds
- Run the script - 5 seconds

That's it! 😎

And, the most important thing is that you can run the synchronous steps above asynchronously with a script, wait, and then push.

Isn't it very efficient to save 1 minute and 30 seconds for `$0.08` (at the current rate (2025.03.21), a cost of ₩117)? 🙂
The cost was lower than I thought, and the time was greatly reduced, so it was a very satisfying task.

The introduction and thumbnail for this post were also automatically generated.

> If you are curious about the entire code, please refer to [process_thumbnail_and_description](https://github.com/youngsu5582/blog/blob/main/utils/process_thumbnail_and_description.py)!
