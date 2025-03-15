---
title: "서버가 배포되면, 슬랙으로 배포 결과와 배포한 커밋까지? with AWS CodePipeline"
author: 이영수
date: 2024-11-04T16:47:37.761Z
tags: ['sns', '람다', '슬랙', '우테코']
categories: ['개발자 생산성']
description: 서버 배포되면, 개발자는 딸깍으로 배포 결과를 알 수 있게 해주세요.
image:
  path: https://velog.velcdn.com/images/dragonsu/post/1c0f6bf5-bc5c-4937-818e-14aa76811a5b/image.png
---
해당 내용은 [프로젝트](https://github.com/woowacourse-teams/2024-corea) 에서 서버 배포 결과를 편하게 확인하기 위해 구현하며 작성한 글입니다.  
혹시, 잘못된 내용이나 다른 방법등이 있다면 댓글로 또는 `joyson5582@gmail.com`로 남겨주세요!

---

현재, 저희팀은 AWS CodePipeline 을 사용해서 서버 배포를 하고 있습니다.
배포를 성공하는걸 알려면 AWS Console 에 직접 들어가서 확인을 해야 했습니다.
( 물론, 그라파나에 들어가도 알 수 있지만, 명확하게 알기 위해선 Console 을 들어가야 했습니다. )

![](https://i.imgur.com/6PzSkye.png)

( 매우 귀차니즘... )

우리가 자주 사용하는 슬랙(디스코드)에서 바로 확인할 수 있으면 정말 좋겠네요 🙂

이를 AWS Lambda 와 SNS 를 통해서 함수를 만들어 해결할 수 있습니다.
그러면, `SNS` 와 `Lambda` 에 대해 간단하게 알아보고 코드에 대해 간략하게 작성한 순으로 가보겠습니다.

### SNS

우리가 흔히, 아는 SNS 가 아닙니다.
약자는 SNS(Simple Notification Service) 이며 구독중인 Service,사용자에게 메시지 전달,전송을 관리하는 서비스입니다.

- 주제(Topic)와 구독(Subscribe)으로 이루어져있다.
-> 주제를 구독하는 구독자들에게 메세지를 전송

즉, 어떤 주제를 만들고 이를 구독하는 서비스를 지정하면 서비스에 메시지를 보내주는 것으로 이해하면 될 거 같습니다. ( Push 방식 )

그리고, AWS CodePipeline 은 `고급 - 트리거` 에서 SNS 를 간편하게 만드는 기능을 제공해준다.

![500](https://i.imgur.com/J0jvTVI.png)

이와 같이 여러 이벤트에 맞게 생성할 수 있습니다.
저희는, 배포 성공 / 실패를 사용하겠습니다.

### Lambda
#### Trigger

![](https://i.imgur.com/O1dn56P.png)

이와같이  트리거 추가에서 나타나는걸 볼 수 있습니다. CodePipeline 에서 만든 SNS 트리거를 추가해줍시다.

```
def lambda_handler(event, context):
```

람다는 기본적으로, event 와 context 를 제공합니다.

#### Event

함수가 실행될 떄 호출한 이벤트 정보입니다.

```json
{
  "Records": [
    {
      "EventSource": "aws:sns",
      "EventVersion": "1.0",
      "EventSubscriptionArn": "arn:aws:sns:ap-northeast-2:123456789012:ExampleTopic:abcdefgh-1234-5678-abcd-1234567890ab",
	  "Sns": {
	        "Type": "Notification",
	        "MessageId": "82c10928-69a4-5aec-9701-************",
	        "TopicArn": "arn:aws:sns:ap-northeast-2:843255971531:2024-corea-backend-deploy-notification",
	        "Subject": "SUCCEEDED: AWS CodeDeploy d-JHPM9HBC8 in ap-northeast-2 to 2024-corea-backend-deploy",
	        "Message": {
	          "region": "ap-northeast-2",
	          "accountId": "843255971531",
	          "eventTriggerName": "2024-corea-backend-dev-trigger",
	          "applicationName": "2024-corea-backend-deploy",
	          "deploymentId": "d-JHPM9HBC8",
	          "deploymentGroupName": "2024-corea-backend-develop-group",
	          "createTime": "Fri Nov 01 06:14:33 UTC 2024",
	          "completeTime": "Fri Nov 01 06:15:13 UTC 2024",
	          "deploymentOverview": {
	            "Succeeded": 1,
	            "Failed": 0,
	            "Skipped": 0,
	            "InProgress": 0,
	            "Pending": 0
	          },
	          "status": "SUCCEEDED",
	          "creator": "user"
		},
    }
  ]
}
```

이와 같이 어떤 이벤트를 통해서 호출했는지 `EventSource` 와 이벤트 소스가 제공해주는 정보들을 가져오는걸 볼 수 있습니다.
Sns 를 사용했으니, Sns 에서 값들을 추가로 제공해줍니다.

저희는 배포 성공 / 배포 실패에 대한 주제를 받습니다.
- 어떤 애플리케이션에서 실행이 되었는지 ( applicationName )
- 어떤 배포 그룹에서 실행이 되었는지 ( deploymentGroupName )
- 언제 시작이( createTime ) 되고, 언제 완성이 되었는지 ( completeTime )
- 성공 했는지 ( status )
- 인스턴스 및 배포를 성공한 정보 ( deploymentOverview )

#### Context

```
LambdaContext(
    aws_request_id = e1e8aaff-227c-****-****-fe102f35fb93,
    log_group_name = /aws/lambda/2024-corea-deploy-notification-lambda,
    log_stream_name = 2024/11/02/[$LATEST]14c92f21****41cebb****8f13e7f8,
    function_name = 2024-corea-deploy-notification-lambda,
    memory_limit_in_mb = 128,
    function_version = $LATEST,
    invoked_function_arn = arn:aws:lambda:ap-northeast-2:843255971531:function:2024-corea-deploy-notification-lambda,
    client_context = None,
    identity = CognitoIdentity(
        cognito_identity_id = None,
        cognito_identity_pool_id = None
    )
)
```

Lambda 함수가 실행될 때 환경과 관련된 정보를 포함하는 객체입니다.
-> 함수 실행 결과를 로깅 및 더 세림하게 처리하기 위해 사용합니다.
( 할당된 메모리, 함수 명, 함수 버전 등등 제공 )
이는, 당장 필요없으니 넘어가겠습니다.

## Code

이제 코드를 작성해보겠습니다.
( 사실, 해당 부분이 핵심이잖아요 🙂 )

```python
def lambda_handler(event, context):
    # Slack Webhook URL 설정
    webhook_url = "***"
    
    message_dict = json.loads(event['Records'][0]['Sns']['Message'])
    
    # SNS 메시지 추출
    deploymentId = message_dict.get('deploymentId')
    createTime = message_dict.get('createTime')
    completeTime = message_dict.get('completeTime')
    deployGroup = message_dict.get('deploymentGroupName')
    status = message_dict.get('status')
    application_name = message_dict.get("applicationName")
    
    status_message = ":white_check_mark:" if status == "SUCCEEDED" else ":x:"
    overview_dict = json.loads(message_dict['deploymentOverview'])
    siteUrl = "https://dev.code-review-area.com" if deployGroup == "2024-corea-backend-develop-group" else "https://code-review-area.com"
    deployment_duration = diff_time(createTime, completeTime)
    
    success_count = overview_dict.get('Succeeded', 0)
    failure_count = overview_dict.get('Failed', 0)
    in_progress_count = overview_dict.get('InProgress', 0)
    pending_count = overview_dict.get('Pending', 0)
```

이와 같이 정보를 가져오게 했습니다.
위에서 설명한 정보들이며 슬랙에 맞게 바로 변환한 부분들도 있습니다. -  `":white_check_mark:" if status == "SUCCEEDED" else ":x:"`

```java
def diff_time(create_time, complete_time):
    create_time = datetime.datetime.strptime(create_time, "%a %b %d %H:%M:%S UTC %Y")
    complete_time = datetime.datetime.strptime(complete_time, "%a %b %d %H:%M:%S UTC %Y")

    deployment_duration = complete_time - create_time
    return deployment_duration.total_seconds()
```

`Sun Sep 01 13:13:26 UTC 2024` - `Sun Sep 01 13:12:48 UTC 2024` 와 같이
완료 시간에서 시작 시간을 뺴서 걸린 시간을 측정했습니다.

슬랙에 보내는 메시지를 만드는 부분은 불필요하다 생각해 생략하겠습니다.

![500](https://i.imgur.com/HW9REXH.png)

( 너무 길기도 하고, 각자 팀에 맞게 만들어 나가는게 중요하니까요 🙂 )

```python
    http = urllib3.PoolManager()
    response = http.request(
        'POST',
        webhook_url,
        body=json.dumps(slack_message).encode('utf-8'),
        headers={'Content-Type': 'application/json'}
    )
```

마지막으로, 요청을 보내면 이렇게, 슬랙에 가게 됩니다!

![500](https://i.imgur.com/ussGneL.png)

## 끝..?

이대로면, 뭔가 다소 아쉬움을 느낄겁니다.
서버 배포의 본질적인 `결과 바로가기`,`배포 인스턴스 개수`,`배포 결과` 등은 알려주지만
`배포가 어떤 소스를 통해 됐는지` 를 알게되면 더 좋을겁니다.
( 배포가 성공은 했는데, 이게 무슨 배포야..? 를 해결하기 위해서 ☺️ )

이는 BOTO3 라는 API 를 통해서 상세정보 들을 추가 해보겠습니다.

### BOTO3

Boto3 는 `AWS SDK for Python` 로, 라이브러리 입니다.
- 공식문서 : https://boto3.amazonaws.com/v1/documentation/api/latest/index.html

> 왜 Boto 인가?
> 아마존 강에 서식하는 민물 돌고래의 이름을 따서 지어졌다고 합니다..

```python
codepipeline = boto3.client('codepipeline')
```

이렇게 서비스에 접근할 수 있는 클라이언트를 만들어줍니다.

각 서비스에 맞게 공식문서가 잘 나와있으니
여기서 맞는 필요한 API 를 찾아서 사용하면 됩니다.
[codepipeline API 문서](https://boto3.amazonaws.com/v1/documentation/api/latest/reference/services/codepipeline.html)

![500](https://i.imgur.com/dcurlff.png)

![500](https://i.imgur.com/iHVcOFH.png)

### 코드 추가

```python
codepipeline = boto3.client('codepipeline')

try:
	# 파이프라인 상태 가져오기
	pipeline_state = codepipeline.get_pipeline_state(name=pipeline_name_mapping.get(deployGroup))
	
	for stage_state in pipeline_state['stageStates']:
		if stage_state['stageName'] == 'Source':
			for action in stage_state['actionStates']:
				if 'currentRevision' in action:
					commit_id = action['currentRevision']['revisionId']
					summary = action['latestExecution'].get('summary', "No summary available")
					entity_url = action.get('entityUrl', "No entity URL available")
					revision_url = action.get('revisionUrl', "No revision URL available")

					# summary를 title과 summary로 분리, github_commit_summary가 없을 경우 빈 문자열로 설정
					github_commit_title, separator, github_commit_summary = summary.partition("\n\n")
					if not github_commit_summary:
						github_commit_summary = ""  # summary가 없을 경우 빈 문자열로 할당

					# summary를 최대 10줄로 제한
					summary_lines = github_commit_summary.splitlines()[:10]  # 처음 10줄까지만 가져옴
					if len(summary_lines) == 10 and len(github_commit_summary.splitlines()) > 10:
						summary_lines.append("...")  # 10줄 이상일 경우 생략 표시 추가
					github_commit_summary = "\n".join(summary_lines)
					# separator는 항상 "\n\n"이므로 title과 summary로 나누는 데 사용합니다.

					# 출력 (또는 추가 작업 수행)

	
except codepipeline.exceptions.PipelineNotFoundException:
	print(f"파이프라인 '{pipeline_name}'을 찾을 수 없습니다.")
except Exception as e:
	print(f"오류 발생: {str(e)}")
```

- Commit ID : 깃허브 커밋 ID - 당장은 쓰지 않으나, 차후 바로 롤백 버튼 만드는 것 역시도 가능할지도..?
- summary : 깃허브 커밋 내용
아래에서, `[BE] 깃허브 ...` 과 `* refactor : ...` 와 같은 정보들입니다.
![500](https://i.imgur.com/ctFMtRN.png)

- entityUrl : 적용된 브랜치 링크
- revisionUrl : 커밋 링크

를 추출했습니다. ( 다른건, Pipeline 각 단계의 상태를 나타내므로 불필요하다 판단 )
추가로, 너무 길어지는걸 방지하기 위해 10줄 제한을 했습니다.

![500](https://i.imgur.com/e3uIUHx.png)

이 결과 서버 배포를 직접 확인하지 않아도, 두 가지 결과를 확인할 수 있게 됐습니다.
- 어떤 커밋을 기반으로, 서버가 배포가 되었는지
- 서버 배포가 인스턴스에 잘 되었는지,  걸린 시간 등

> 추가로, 파이프라인 상태 조회 로직을 수행하기 위해선
> Lambda 실행하는 IAM 에서 `codepipeline:getPipelineState` 권한이 필요합니다!
> ( 흔쾌히 추가해주신 토미에게 감사를 ☺️☺️ )

감사합니다!
