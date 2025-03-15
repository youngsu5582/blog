---
title: "PR 병합때 알림 받는 내용을 의미있게 with naver pr stats 워크플로우"
author: 이영수
date: 2024-10-13T11:17:56.144Z
tags: ['pr-stats', '우아한 테크코스', '협업']
categories: ['개발자 생산성']
description: 팀원들이 리뷰를 몇 시간 내 해주는지, PR이 얼마나 오래걸리는지, 대화의 수, 파일 / 라인이 얼마나 변했는지 궁금한 당신이라면
image:
  path: https://velog.velcdn.com/images/dragonsu/post/f11aaab6-ca8c-4af0-a646-8eab04247a19/image.svg
---
여러분 들의 팀들은 PR 과 코드 리뷰를 하시나요?
슬랙 디스코드와 같은 협업용 앱을 사용 하시나요?

이때, `PR 을 머지하면 유의미한 정보들을 받고 싶다!` 라는 생각이 있다면
해당 내용은 유용할 수 있습니다.

혹시, 잘못된 내용이나 다른 좋은 요소들이 있다면 댓글로 또는 `joyson5582@gmail.com`로 남겨주세요!

### 기존 슬랙의 문제점

현재, 저희 팀은 팀원간 소통을 위해 슬랙을 사용하고 있습니다.
( 기존 우테코가 슬랙으로 커뮤니티를 해서 이미 다들 익숙해졌다고 판단 했습니다. )
슬랙에서 제공해주는 `Github Integration`  을 통해 머지될 시 슬랙이 보여주는 정보는

![350](https://i.imgur.com/z6kCQ0k.png)

위와 같이 보여줍니다.

![350](https://i.imgur.com/qpd6Xqb.png)

( 오픈된건 이렇게 잘 보여주면서 왜... )

다소, 머지될 때는 받는 정보들이 아쉬운걸 알 수 있습니다.
그러면 어떤 정보들이 중요할까요?

`https://api.github.com/repos/woowacourse-teams/2024-corea/pulls/594`
( [PR 페이로드 공식 문서](https://docs.github.com/en/rest/pulls/pulls?apiVersion=2022-11-28#get-a-pull-request) )

이와 같이 PR 을 조회 해보면 `라벨`,`어사인니`,`리뷰어`,`머지된 시간`,`본문` , `제목` 등등 수많은 정보들을 반환해줍니다.

## 알림 요소 정하기

이는 각자의 프로젝트 & 팀마다 중요도가 다를 수 있습니다.
아래는 [저희 팀](https://github.com/woowacourse-teams/2024-corea)에서 중요하다고 생각한 부분들 입니다.

- 대화 수
- 변경 파일 / 라인 수
- 평균 리뷰 응답 시간 
- 평균 승인(Approve) 시간
- 총 PR 기간 ( 생성된 시간 ~ 머지된 시간 )

저희 팀은 미션 & 취업으로 다들 바쁜 일정이 있기에, 짧은 이슈 & 짧은 PR 을 지향하기로 했습니다.
( 크게 부담을 주지 않고, 코드 리뷰 & 작업을 맡게 하기 위해 )

그렇기에 

변경 파일 / 라인 수, PR 기간 - 이슈 및 PR 이 얼마나 작은지
평균 리뷰 응답 시간 / 승인 시간 - 얼마나 빨리 리뷰에 참여했는지, 리뷰가 끝났는지
대화 수 - 코드 리뷰가 유의미 했는지

가 중요한 요소라고 생각했습니다.

![](https://i.imgur.com/ZwaYPll.png)

( 이 삼각형 처럼 세 가지가 조화롭게 이루어진다면 베스트 일겁니다. )

하지만, 단순 PR을 조회할 때는 해당 내용들을 바로 충분하게 받을 수 없습니다.
( `reviews` 조회 + `comments` 조회 + 추가 조회 필요 )

하지만, 일일히 직접 하는건 매우 귀찮은 일입니다.

이를 해결해주는 워크플로우가 있습니다!
네이버에서 만든 워크플로우인 https://github.com/naver/pr-stats 입니다.

( 단일 PR 말고도 모든 PR,각 유저별 정보 등 다양하게 추출 해줍니다! 🙂🙂 )

![350](https://i.imgur.com/ncrAkAn.png)

사이트를 들어가보면 더 자세히 알 수 있습니다!

## 스크립트 작성

이 내용으로 저희는 슬랙에 요청을 보내서 전달하는 방식으로 사용했습니다.

![](https://i.imgur.com/ZCryN1z.png)

( 위와 같이 알림을 줍니다. )

[워크 플로우](https://github.com/woowacourse-teams/2024-corea/blob/develop/.github/workflows/pr-stats.yml)와 [파이선](https://github.com/woowacourse-teams/2024-corea/blob/develop/.github/scripts/pr-stats.py)을 사용해서 만들었습니다.
중요한 부분들에 대해서만 간단하게 설명 하자면

```yml
- name: Analyze PR Stats and Notify
run: |
  python .github/scripts/pr-stats.py
env:
  SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
  PR_HTML_URL: ${{ github.event.pull_request.html_url }}
  ASSIGNEE: ${{ github.event.pull_request.assignee.login }}
  PR_NUMBER: ${{ github.event.pull_request.number }}
```

- 하이퍼링크를 위한 `html_url`
- 칭찬을 위한 `assignee` 🙂
- 원하는 PR 을 찾기 위한 `PR_NUMBER`
- 요청을 보내기 위한 `WEBHOOK_URL`

```python
slack_webhook_url = os.getenv("SLACK_WEBHOOK_URL")
pr_html_url = os.getenv("PR_HTML_URL")
assignee = os.getenv("ASSIGNEE")
pr_number = os.getenv("PR_NUMBER")
```

를 파이선 파일을 실행할 때 넣습니다.

```python
def analyze_csv(file_path):
    with open(file_path, newline='') as csvfile:
        reader = csv.DictReader(csvfile)
        stats = []
        for row in reader:
            stats.append(row)
    return stats
```

CSV 파일에서 정보를 추출하고

```python
def extract_important_info(pr_data):
    return next((pr for pr in pr_data if pr['number'] == pr_number), None)
```

그리고, 현재 번호와 일치한 정보를 찾습니다.

```python
def format_duration(ms):
    if ms == 'NaN':
        return "N/A"

    total_seconds = int(round(float(ms))) / 1000
    days, remainder = divmod(total_seconds, 86400)  # 86400초 = 1일
    hours, remainder = divmod(remainder, 3600)  # 3600초 = 1시간
    minutes, _ = divmod(remainder, 60)

    if days > 0:
        return f"{int(days)}일 {int(hours)}시간 {int(minutes)}분 😢"
    else:
        return f"{int(hours)}시간 {int(minutes)}분 🙂"

# response_time = format_duration(pr['averageResponseTime'])
```

ms 를 반올림해서 추출합니다.
> 평균을 구해주므로 ms 이나 소수점을 포함합니다.

그 후에는 슬랙 데이터를 빌더합니다.
( [Slack Block Kit Builder](https://app.slack.com/block-kit-builder/) 에서 원하는 형태를 만들어 보세요! )

## 결론

현재는 실제 운영 서버 런칭 & 배포를 한다고
만든 기능이 유의미하게 작동하진 않습니다. ( 대부분이 짧은 시간 내 리뷰 및 머지 )

하지만, 해당 메시지들을 보며 
`더 좋은 코드 리뷰`, `평균 응답 시간을 더 빠르게` `이슈(PR) 단위를 짧게` 를 의식하게 된다면
조금이라도 도움이 되리라고 생각합니다. ☺️

### 참고

> Github Integration 은 merged 만 안받게 할 수 없으므로
`/github unsubscribe woowacourse-teams/2024-corea pulls` 와 같이 opened 까지 같이 꺼지게 됩니다. 🥲

https://github.com/naver/pr-stats
