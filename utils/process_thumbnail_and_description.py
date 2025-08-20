import os
import re
from openai import OpenAI

import frontmatter
import requests
from pathlib import Path
import textwrap

file_path_str = "_posts/2025-03-20-샘플링.md"

client = OpenAI(api_key=os.environ.get('OPENAI_API_KEY', ''))
workspace = Path.cwd().resolve()

system_message = {
    "role": "system",
    "content": (
        "출력되는 요약문은 반드시 50자 이상 100자 이하로 작성되어야 하며, 문장이 중간에서 끊기지 않고, "
        "마지막에 마침표 등으로 자연스럽게 마무리되어야 합니다. 추가적인 설명이나 문구는 포함하지 마세요."
        "사람이 작성하는 것과 같은 느낌으로 작성한다."
    )
}

def generate_and_save_image(prompt: str, save_path: Path):
    print("thumbnail 생성을 위해 DALL-E API를 보냅니다.")
    response = client.images.generate(
        prompt=prompt,
        model="dall-e-3",
        n=1,
        quality="hd",
        size="1024x1024"
    )
    print("thumbnail 생성을 위해 DALL-E API가 완료 됐습니다.")

    image_url = response.data[0].url
    img_data = requests.get(image_url).content
    with open(save_path, 'wb') as f:
        f.write(img_data)

def generate_thumbnail_prompt(title: str, description: str) -> str:
    return f"""
백엔드 기술 블로그 게시물에 사용한 깔끔하고 현대적인 썸네일 일러스트를 생성하세요.
I NEED to test how the tool works with extremely simple prompts. DO NOT add any detail, just use it AS‑IS.

📌 게시물 제목: "{title}"
📝 게시물 설명: "{description}"

🎯 스타일 및 콘텐츠 가이드라인:
1. 게시물 제목과 설명에 부합하는 직관적인 아이콘 중심의 그림을 만드세요.
2. 제목과 관련있는 키워드에 대한 글자가 포함되게 해주세요.
3. 어둡거나 과도하게 채도 높은 색상은 피하고, 밝은 하늘색 계열의 부드러운 분위기를 유지하세요. 배경은 단순하고 밝게 유지합니다.
4. 최대한 아이콘과 심볼만으로 의미를 전달해주세요.
5. 복잡한 UI 요소 없이 심플하고 직관적인 구성을 우선시하세요.
""".strip()

def generate_description(prompt: str, language="ko") -> str:
    print("description 생성을 위해 API를 보냅니다.")
    completion = client.chat.completions.create(
        model="gpt-4o-mini-2024-07-18",
        messages=[
            system_message,
            {"role": "user", "content": prompt}
        ],
        temperature=1,
        max_tokens=350,
    )
    print("description 생성을 위해 API가 완료 됐습니다.")
    summary = completion.choices[0].message.content.strip()
    return summary

def generate_summary_prompt(content: str, language: str = "ko") -> str:
    return f"""아래 글을 {language}로 간결하게 요약하되,
요약문의 길이는 반드시 50자 이상 100자 이하로 작성해줘.
문장 중간이 끊기지 않도록 주의하고, 마지막에는 마침표 등으로 자연스럽게 마무리해줘.
출력은 요약문만 작성하고, 그 외 다른 설명이나 문구는 쓰지 말아줘.

글:
{content}""".strip()

def check_exist(post, element):
    return element in post and post[element]

def main():
    if not re.match(r'^(_posts|_articles)/.*\.(md|markdown)$', file_path_str):
      print(f"파일 타입 불일치 : {file_path_str}")
      return

    path = workspace / file_path_str
    file_path = Path(path)
    print("파일 처리 : ", file_path)
    if not file_path.exists():
        print(f"실제로 존재하지 않습니다 : {file_path}")
        return

    post = frontmatter.load(file_path)
    if check_exist(post, 'description') and check_exist(post, 'image'):
        print(f"{file_path_str}은 이미 설명과 이미지가 존재합니다.")
        return

    if not check_exist(post, 'description'):
        prompt_for_description = generate_summary_prompt(post.content)
        summary = generate_description(prompt_for_description, language="ko")
        post['description'] = summary

    if not check_exist(post, 'image'):
        if not check_exist(post, 'title'):
            raise ValueError("The post does not have a title. Cannot generate an image prompt without a title.")
        prompt_for_image = generate_thumbnail_prompt(post["title"], post["description"])

        image_save_dir = workspace / "assets" / "img" / "thumbnail"
        image_save_dir.mkdir(parents=True, exist_ok=True)

        image_filename = file_path.stem + ".png"
        save_path = image_save_dir / image_filename

        generate_and_save_image(prompt_for_image, save_path)

        relative_path = str(save_path.relative_to(workspace)).replace("\\", "/")
        post['image'] = {'path': relative_path}

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(frontmatter.dumps(post))
    print(f"처리 완료 : {file_path_str}")

if __name__ == "__main__":
    main()
