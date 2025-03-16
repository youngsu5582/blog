# 태그, 특정 태그로 변환

import os
import re

FILE_PATH = "/Users/dragonsu/IdeaProjects/blog/_posts"
REMOVE_SELECTOR = "categories:"

TRANSFORM_MAP = [
    {
        "remove_if_present": ["코틀린"],  # 이 둘이 모두 있으면
        "add_tags": ["백엔드", "코틀린"],             # => 둘 다 제거 후 '스프링백엔드' 추가
    }
    # 원하는 규칙을 계속 추가 가능
]

def transform_tags_line(line: str) -> str:
    stripped = line.strip()
    if not stripped.startswith(REMOVE_SELECTOR):
        return line  # tags: 로 시작하지 않으면 변경 없음

    # 정규식으로 tags: [ ... ] 형태에서 대괄호 안의 내용 추출
    pattern = r'^' + re.escape(REMOVE_SELECTOR) + r'\s*\[(.*?)\]\s*$'
    match = re.match(pattern, stripped)
    if not match:
        return line  # 대괄호 형식이 아니면 그대로 반환

    content = match.group(1)  # 예: 백엔드, 스프링, something
    items = [x.strip() for x in content.split(",")]
    actual_tags = [i.strip("'\"") for i in items]

    for rule in TRANSFORM_MAP:
        remove_list = rule.get("remove_if_present", [])
        add_list = rule.get("add_tags", [])

        if all(r in actual_tags for r in remove_list):
            actual_tags = [tag for tag in actual_tags if tag not in remove_list]
            actual_tags.extend(add_list)

    new_items = [f"'{tag}'" for tag in actual_tags]
    joined = ", ".join(new_items)
    new_line = f"{REMOVE_SELECTOR} [{joined}]\n"
    return new_line

def transform_tags_in_directory(posts_dir="_posts"):
    for filename in os.listdir(posts_dir):
        if not filename.endswith(".md"):
            continue

        file_path = os.path.join(posts_dir, filename)
        with open(file_path, "r", encoding="utf-8") as f:
            lines = f.readlines()

        new_lines = []
        changed = False
        for line in lines:
            new_line = transform_tags_line(line)
            if new_line != line:
                changed = True
            new_lines.append(new_line)

        if changed:
            with open(file_path, "w", encoding="utf-8") as f:
                f.writelines(new_lines)
            print(f"[변경됨] {file_path}")

def main():
    transform_tags_in_directory(FILE_PATH)
    print(f"{REMOVE_SELECTOR} 변환 규칙에 따른 변경이 완료되었습니다.")

if __name__ == "__main__":
    main()