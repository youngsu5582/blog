# 태그 또는 카테고리 내 특정 요소만 제거

import os
import re

FILE_PATH = "/Users/dragonsu/IdeaProjects/blog/_posts"
REMOVE_SELECTOR = "tags:"
REMOVE_ELEMENT = "우테코"

def remove_wooteco_line(line: str) -> str:
    stripped = line.strip()
    if not stripped.startswith(REMOVE_SELECTOR):
        return line  # 대상이 아니면 변경 없음

    pattern = r'^tags:\s*\[(.*?)\]\s*$'
    match = re.match(pattern, stripped)
    if not match:
        return line

    content = match.group(1)  # 예: 우테코, something

    items = [x.strip() for x in content.split(",")]
    actual_tags = [i.strip("'\"") for i in items]

    new_tags = [tag for tag in actual_tags if tag != REMOVE_ELEMENT]

    new_items = [f"'{tag}'" for tag in new_tags]
    joined = ", ".join(new_items)
    new_line = f"{REMOVE_SELECTOR} [{joined}]\n"
    return new_line

def remove_in_directory(posts_dir):
    for filename in os.listdir(posts_dir):
        if not filename.endswith(".md"):
            continue

        file_path = os.path.join(posts_dir, filename)
        with open(file_path, "r", encoding="utf-8") as f:
            lines = f.readlines()

        new_lines = []
        changed = False
        for line in lines:
            new_line = remove_wooteco_line(line)
            if new_line != line:
                changed = True
            new_lines.append(new_line)

        if changed:
            with open(file_path, "w", encoding="utf-8") as f:
                f.writelines(new_lines)
            print(f"[변경됨] {file_path}")

def main():
    remove_wooteco_in_directory(FILE_PATH)
    print(f"{REMOVE_ELEMENT} {REMOVE_SELECTOR} 제거를 완료했습니다.")

if __name__ == "__main__":
    main()
