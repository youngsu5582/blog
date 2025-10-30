# Lee Young-soo's Tech Blog

[한국어](./README.md)

[![Blog-Post](https://github.com/youngsu5582/blog/actions/workflows/issue_branch_pr.yml/badge.svg)](https://github.com/youngsu5582/blog/actions/workflows/issue_branch_pr.yml)
[![Deploy-Pages](https://github.com/youngsu5582/blog/actions/workflows/pages-deploy.yml/badge.svg)](https://github.com/youngsu5582/blog/actions/workflows/pages-deploy.yml)

This is a personal tech blog repository. It is built with Jekyll and automates the process from content creation to publishing using GitHub Actions and AI.

**[Go to Blog](https://youngsu5582.life/archives/)**

---

## ✨ Key Concept: Issue-Driven Blogging

All content management for this blog starts with a GitHub issue. By simply creating a new issue using the `Blog Draft` template, the entire process from post creation, AI review, thumbnail generation, translation, and publishing is handled through an automated pipeline.

## 🚀 Automation Workflow

The entire process for publishing a single blog post is as follows.

### 1. ✍️ Draft Writing (Create `issue`)

1.  Click the **`New Issue`** button and select the **`Blog Draft – AI Review Request`** template.
2.  Write the title and content of the blog post in the issue title and body.
3.  The `draft` label is automatically assigned, and the automation workflow starts based on this label.

### 2. 🛠️ Automatic Branch and PR Creation (`workflow: issue_branch_pr.yml`)

When the `draft` label is detected, GitHub Actions runs and automatically handles the following:

-   **AI Metadata Generation**: Uses **OpenAI (GPT-4o-mini)** to generate `tags`, `description`, and `slug` that match the content of the post and adds them to the file's frontmatter.
-   **Branch and Commit Creation**: Creates a branch in the format `post-{issue_number}-{slug}` and commits the generated markdown file.
-   **PR Creation**: Automatically creates a Pull Request to the `main` branch.

### 3. 🎨 AI Thumbnail Generation (`workflow: pr_generate_thumbnail.yml`)

When the `thumbnail` label is added to the created PR, AI generates a thumbnail image that matches the blog content.

-   The **Google Gemini** model analyzes the entire content of the post and pre-provided sample images to generate a 16:9 ratio thumbnail.
-   The generated image is saved in the `assets/img/thumbnail/` path and automatically committed to the corresponding branch.

### 4. 🤖 AI Content Review (`workflow: pr_open_ai_review.yml`)

When the `review` label is added to the PR, AI reviews the post from a senior developer's perspective and leaves comments directly on the PR.

-   **OpenAI (GPT-4o-mini)** reviews based on technical depth, clarity of explanation, structure of the post, and originality.
-   Sentences that need correction are suggested through the `suggestion` feature, and a comprehensive opinion on the content is also provided as a comment.

### 5. 🌐 Automatic Translation (`workflow: translate_openai.yml`)

When the `translate` label is added to the PR, AI translates the post into English.

-   The **OpenAI (GPT-4o)** model translates the entire post, including the frontmatter, into English.
-   The existing file is split into `ko` and `en` versions and committed to the same branch.

### 6. ✅ Publishing and Resource Cleanup (`workflow: pr_cleanup.yml`)

When the `complete` label is added to the PR, publishing and cleanup tasks are automatically performed.

-   The PR is merged into the `main` branch using the `squash and merge` method.
-   All related issues and PRs are changed to the `closed` state.
-   The completed branch is deleted.

### 7. 🚀 Automatic Deployment (`workflow: pages-deploy.yml`)

When changes are merged into the `main` branch, the Jekyll build and GitHub Pages deployment are automatically executed.

---

## 🛠️ Tech Stack

-   **Framework**: Jekyll
-   **Automation**: GitHub Actions
-   **AI Services**:
    -   **OpenAI (GPT-4o, GPT-4o-mini)**: Metadata generation, content review, automatic translation
    -   **Google Gemini**: Thumbnail image generation
-   **Core Scripts**: Node.js
