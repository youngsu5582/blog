# 불필요한 요소를 찾아서 제거

import os

FILE_PATH = "/Users/dragonsu/IdeaProjects/blog/_posts"
REMOVE_ELEMENT = "url_slug:"

def remove_url_slug_line(posts_dir):
    for filename in os.listdir(posts_dir):
        if filename.endswith(".md"):
            file_path = os.path.join(posts_dir, filename)

            with open(file_path, "r", encoding="utf-8") as f:
                lines = f.readlines()

            new_lines = []
            for line in lines:
                # url_slug: 로 시작하는 줄은 제거
                if not line.strip().startswith(REMOVE_ELEMENT):
                    new_lines.append(line)

            # 변경된 내용으로 파일 덮어쓰기
            with open(file_path, "w", encoding="utf-8") as f:
                f.writelines(new_lines)

if __name__ == "__main__":
    remove_url_slug_line(FILE_PATH)
    print("url_slug: 라인을 제거했습니다.")
