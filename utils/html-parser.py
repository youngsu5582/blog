import requests
from bs4 import BeautifulSoup

url = "https://youngsu5582.life/tags/"
response = requests.get(url)
soup = BeautifulSoup(response.text, 'html.parser')

tag_divs = soup.select("#tags div")

tags_list = []

for div in tag_divs:
    a_tag = div.select_one("a.tag")
    if not a_tag:
        continue
    
    tag_name = a_tag.contents[0].strip()
    

    count_span = a_tag.select_one("span.text-muted")
    if count_span:
        tag_count = int(count_span.get_text(strip=True))
    else:
        tag_count = 0
    
    tags_list.append((tag_name, tag_count))

tags_list.sort(key=lambda x: x[1], reverse=True)

result_dict = {}
for tag_name, tag_count in tags_list:
    result_dict[tag_name] = f"{tag_name}({tag_count})"


print(result_dict)
