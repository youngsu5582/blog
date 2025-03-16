#벨로그에 올린 글들을 jekyll 형식으로 가져오게 해줍니다.

import requests
import os
import datetime
import re

GRAPHQL_URL = "https://v2.velog.io/graphql"
AUTHOR = "이영수"
USERNAME = "dragonsu"

def sanitize_text(text):
    return re.sub(r'[\x00-\x08\x0B-\x1F\x7F]', '', text)

def get_posts(username, limit=100):
    payload = {
        "operationName": "Posts",
        "variables": {
            "username": username,
            "limit": limit
        },
        "query": (
            "query Posts($username: String, $limit: Int) {"
            "\n  posts(username: $username, limit: $limit) {"
            "\n    url_slug"
            "\n  }"
            "\n}"
        )
    }
    response = requests.post(GRAPHQL_URL, json=payload)
    data = response.json()
    posts = data["data"]["posts"]
    return posts

def get_post_detail(username, url_slug):
    payload = {
        "operationName": "ReadPost",
        "variables": {
            "username": username,
            "url_slug": url_slug
        },
        "query": (
            "query ReadPost($username: String, $url_slug: String) {"
            "\n  post(username: $username, url_slug: $url_slug) {"
            "\n    title"
            "\n    released_at"
            "\n    tags"
            "\n    body"
            "\n    short_description"
            "\n    thumbnail"
            "\n    url_slug"
            "\n  }"
            "\n}"
        )
    }
    response = requests.post(GRAPHQL_URL, json=payload)
    data = response.json()
    return data["data"]["post"]

def save_post_as_markdown(post, output_dir="posts"):
    # 각 필드를 sanitize 처리
    title = sanitize_text(post.get("title", "Untitled"))
    released_at = sanitize_text(post.get("released_at", ""))
    body = sanitize_text(post.get("body", ""))
    short_description = sanitize_text(post.get("short_description", ""))
    tags = post.get("tags", [])
    url_slug = sanitize_text(post.get("url_slug", "post"))
    thumbnail = sanitize_text(post.get("thumbnail", "")) if post.get("thumbnail") else None

    try:
        date_str = datetime.datetime.fromisoformat(released_at.replace("Z", "+00:00")).strftime("%Y-%m-%d")
    except Exception:
        date_str = "unknown-date"

    # 파일명용으로 안전한 제목 생성 (알파벳, 숫자, 공백, 하이픈, 밑줄만 허용)
    safe_title = "".join(c for c in title if c.isalnum() or c in " -_").strip().replace(" ", "-")
    filename = f"{date_str}-{safe_title}.md"

    # YAML 프론트매터 작성 (조건에 따라 항목 추가)
    front_matter_lines = ["---"]
    front_matter_lines.append(f'title: "{title}"')
    front_matter_lines.append(f"author: {AUTHOR}")
    if released_at:
        front_matter_lines.append(f"date: {released_at}")
    if tags:
        front_matter_lines.append(f"tags: {tags}")
    if short_description:
        front_matter_lines.append(f"description: {short_description}")
    if url_slug:
        front_matter_lines.append(f"url_slug: {url_slug}")
    if thumbnail:
        front_matter_lines.append("image:")
        front_matter_lines.append(f"  path: {thumbnail}")
    front_matter_lines.append("---\n")
    front_matter = "\n".join(front_matter_lines)

    content = front_matter + body

    os.makedirs(output_dir, exist_ok=True)
    file_path = os.path.join(output_dir, filename)
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"저장완료: {file_path}")

def main():
    print("포스트 목록 가져오기 시작")
    posts = get_posts(USERNAME)
    print(f"포스트 개수: {len(posts)}")
    
    for p in posts:
        url_slug = p.get("url_slug")
        if not url_slug:
            continue
        print(f"포스트 가져오기: {url_slug}")
        post_detail = get_post_detail(USERNAME, url_slug)
        save_post_as_markdown(post_detail)

if __name__ == "__main__":
    main()
