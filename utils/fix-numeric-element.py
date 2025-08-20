# 숫자를 찾아서 작은 따옴표로 래핑
import os
import re

FILE_PATH = "/Users/dragonsu/IdeaProjects/blog/_posts"

def fix_numeric_elements_in_list(line: str) -> str:
    stripped = line.strip()
    if not (stripped.startswith("tags:") or stripped.startswith("categories:")):
        return line 

    pattern = r'^(tags|categories):\s*\[(.*?)\]\s*$'
    match = re.match(pattern, stripped)
    if not match:
        return line

    prefix = match.group(1)  # "tags" or "categories"
    content = match.group(2) # 대괄호 안의 내용 e.g. "회고, 2023"

    # 2) 쉼표 기준으로 나누어 요소 분리
    items = [x.strip() for x in content.split(",")]

    # 3) 각 요소가 숫자만 있는지 확인 -> 숫자만 있다면 작은따옴표로 감싸기
    new_items = []
    for item in items:
        if (len(item) >= 2) and ((item.startswith("'") and item.endswith("'")) or
                                 (item.startswith('"') and item.endswith('"'))):
            new_items.append(item)
        else:
            if re.fullmatch(r'\d+', item):
                item = f"'{item}'"
            new_items.append(item)

    # 4) 수정된 items를 다시 합쳐서 라인 재구성
    joined = ", ".join(new_items)
    new_line = f"{prefix}: [{joined}]\n"
    return new_line

def fix_all_posts_in_directory(posts_dir):
    for filename in os.listdir(posts_dir):
        if not filename.endswith(".md"):
            continue

        file_path = os.path.join(posts_dir, filename)
        with open(file_path, "r", encoding="utf-8") as f:
            lines = f.readlines()

        new_lines = []
        for line in lines:
            new_line = fix_numeric_elements_in_list(line)
            new_lines.append(new_line)

        # 파일 덮어쓰기
        with open(file_path, "w", encoding="utf-8") as f:
            f.writelines(new_lines)

def main():
    fix_all_posts_in_directory(FILE_PATH)
    print("모든 .md 파일에 대해 tags:, categories: 배열 내 숫자를 작은따옴표로 감싸는 작업을 마쳤습니다.")

if __name__ == "__main__":
    main()
