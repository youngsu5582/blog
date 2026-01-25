---
title: ISMS-P 인증을 위한 탈퇴 회원 기록 소거 이슈 회고
tags:
  - ISMS-P
  - 데이터 처리
  - 소거 이슈
  - 기술 회고
description: ISMS-P 인증을 위한 탈퇴 회원 기록 소거 이슈에 대한 회고와 데이터 처리 과정에서의 어려움 및 해결 방안을 정리합니다.
page_id: isms-p-certification-deleted-member-records-issue-review
permalink: /posts/isms-p-certification-deleted-member-records-issue-review/
author: 이영수
date: 2026-01-25T13:24:49.568Z
---
현재, 회사에선 ISMS-P 획득을 위해 다양한 팀들이 부랴부랴 다양한 보안 작업들을 하고 있다.
그중, 나는 우리 팀이 담당하고 있는 서비스에서 `탈퇴한 회원들의 기록을 처리`하는 이슈를 맡았다.

다른 이슈들도 함께 있었는데, 카프카를 학습할 수 있을 기회라고 생각해서 한다고 했다.
그렇게, 자신만만하게 시작한 이슈는 생각보다 호락호락하지 않음을 느꼈다...

12월 중순 즈음에 이슈를 할당받고, 현재까지 계속 진행중이다.

> 그래서, 문제 정의와 왜 어려움을 느꼈는지에 대해 정리하는 `기,승` 이 내용의 주를 이룹니다.

## 기

### 데이터 구조의 변화

단순히, `기록을 소거한다.` 로직 구현이 아닌 체계를 구축해야했다.

우리 서비스의 데이터는 크게 3가지 정도의 문제가 있었다.

- 데이터 구조의 변화

예전에는 특정 요청들은

```java
"inputImageUrl" : ...
```

다른 요청들은

```java
"imageUrl" : ...
```

또 다른 요청들은


```java
"url" : ...
```

와 같은 형태로 저장이 되어있었다.

이런 형태에서, 요구사항이 추가될 때마다 & 각각 다른 형태를 벗어나기 위해서
내가 배열 형태로 구조를 개선하는 이슈를 받았었고, 진행을 했었다.

최신 데이터는

```java
"inputFileList": [
	{
	  "key": "...",
	  "url": "...",
	  "bucket": "...",
	  "inputFileType": "originalImage"
	}
]

```

의 형태로 저장되어 있다.
즉, 두 구조의 간극을 해결해줘야 했다.

### 너무 많은 기능

현재, 우리의 기능은 18개가 있다.
그리고, 기능들마다 요청을 생성한 Feature - 요청을 실제로 처리한 결과 Task 의 형식으로 구성이 되어있다.

이 기능들이 모두 잘 동작할 것을 보장해야만 했다...

그 외에도..

- 어떤곳은 S3 URL 이 아닌 Cloudfront URL 이 저장되어있다
- 예전 데이터는 s3 bucket, key, url 형태가 아닌 url 만 저장되어있다
- 특정 S3 URL 은 공동으로 사용해서, 제거가 되지 않게 필터링 해야한다

등등등 데이터와 관련된 다양한 요구사항들이 숨겨져있었다..

### 데이터 규모

최대로 요청한 사용자의 데이터를 찾아봤을때 25,000 ~ 28,000 번 가량의 요청을 했다.
추가로, 요청중 특정 요청은 이미지 4개를 처리해주고 보여주는 경우도 존재한다.

`client 테이블 - feature 테이블 - task 테이블`

의 구조와 각 기능들에서 나오는 s3 URL 들을 전부 깔끔하게 처리해줘야 했다.
그리고, 시간이 지날수록 한 사용자당 데이터의 개수는 결국 더 늘어나게 된다.

이런 점들을 통해 한번에 전부 처리가 아닌, 현명한 배치 처리가 필요했다.

## 승

### 인터페이스 정립

1번 (오래전부터 쌓인 데이터 정합성), 2번 (너무 많은 기능) 을 해결하기 위해 적극적으로 인터페이스를 사용했다.

우리는 추상적인 FeatureEntity, TaskEntity, ResultEntity 라는 인터페이스만 있었는데
이와 별도로 `입력된 파일 정보를 입력받는다`, `생성된 파일 정보를 제공한다`  파일과 관련된 interface 를 레이어별로 만들었다.

`FileInputEntity`, `FileGenerateTaskEntity`, `FileGenerateResult` 

```java
public interface FileInputEntity extends FeatureEntity {  
  List<InputFileInfo> getInputFileList();  
}
```

```java
public interface FileInputOption {
  List<InputFileInfo> getInputFileList();
}
```

```java
public interface FileGenerateTaskEntity<T extends FileGenerateResult> extends TaskEntity {
	List<GenerateFileInfo> getGenerateFileList();
}
```


```java
public interface FileGenerateResult extends AIGenerateResult {  
  List<GenerateFileInfo> getFileList();
```

그리고, 이전 요청들에 있는 값들을 이 배열을 만들게 묶었다.

```java
@Override
public List<InputFileInfo> getInputFileList() {  
    if (CollectionUtils.isEmpty(inputFileList)) {  
        var files = new ArrayList<InputFileInfo>();  
        if (StringUtils.hasText(inputImageUrl)) {  
            files.add(  
                    InputFileInfo.builder()  
                            .key(key)  
                            .bucket(bucket)  
                            .url(url)  
                            .inputFileType(InputFileType.ORIGINAL_IMAGE)  
                            .build()  
            );  
        }
        return files;  
    }  
    return inputFileList;  
}
```

```java
@Override  
public List<GenerateFileInfo> getFileList() {  
    if (CollectionUtils.isEmpty(fileList)) {  
        var list = new ArrayList<GenerateFileInfo>();  
        if (StringUtils.hasText(url)) {  
            list.add(GenerateFileInfo.builder()  
                    .url(url)  
                    .type(GenerateFileType.RESULT_IMAGE)  
                    .mimeType(extension.getMimeTypeString())  
                    .build());  
        }
		if (StringUtils.hasText(webpUrl)) {  
		    list.add(GenerateFileInfo.builder()  
		            .url(webpUrl)  
		            .type(GenerateFileType.RESULT_IMAGE)  
		            .mimeType(FileExtension.WEBP.getMimeTypeString())  
		            .build());  
		}
	}
	return fileList;
}
```

이를 통해서, 이전 데이터와 현재 데이터의 응답 포맷이 동일한 것을 보장했다.

### 구조 설계

일단, Kafka 를 사용했다.
이유에 대해 간략히 설명하면

- 지정된 시간에 처리를 하고 싶다

꽤나, 로직상으로도 데이터적으로도 DB 나 우리 서비스에 부하를 줄 여지가 있었다.
특정 Feature, Task 들은 긴 Prompt 를 현재 그대로 저장하고 있어서 1000개씩 가져오더라도 데이터가 생각보다 크다.

> 차차 개선의 여지...

이런점들 때문에 사람 피크가 없는 새벽에 천천히 돌려야 했다.
`+` 실시간으로, 빠른 시간내 처리될 필요 없이 처리가 된다는 걸 보장만 하면 된다는 것도 이유

- 똑같은 사용자의 요청 처리를 서버 한대만 처리하는걸 보장하고 싶다

현재는 api 서버가 많이 없지만, 이런 서버의 개수가 늘어날 때 해당 로직이 영향을 주는것이 싫었다.

동일 사용자의 요청을 동시에 처리하는 것을 방지하려면, 일반적으로 LOCK 을 많이 쓴다.
DB 의 LOCK 이든, Redis 의 LOCK 이든.

하지만, 해당 방식에선 LOCK 이 필요없다고 생각했다. 굳이 불필요한 경합을 발생시키는 것 같았다.

Kafka 는 메시지를 넣을때, Key 를 지정할 수 있다.
파티션이 여러개라면 이 Key 의 값을 기반으로 파티션이 결정된다.

-> 동일한 Key 로 여러 파티션에 들어갈 가능성이 존재할 수 없다.

그리고, 서버 한대는 파티션 한대만 가져와서 메시지를 처리한다.
LOCK 을 잡지 않아도 LOCK 과 동일한 효과를 기대할 수 있을거라고 생각했다.

> 필요에 따라, 확장이 용이한 것도 장점이라고 생각한다.
> 파티션 개수를 늘리면, 가장 기초적인 초식으로 처리량을 늘릴 수 있다.

결론적으론, 나름대로 사용자가 많은 우리 서비스의 탈퇴 정보를 처리하기 위해
배압과 - 처리량은
...

요청을 통해 Kafka 메시지를 생성

-> 지정된 시간이 되면, Kafka 메시지를 수신 후 처리
-> 지정된 시간이 지나면, Kafka 메시지를 수신하는 걸 종료

이때, 데이터를 배치로 처리하는 방식은

1. 클라이언트 테이블 조회 후, 요청한 타입별로 그룹핑

```java
Map<String, List<ClientInfo>> clientInfoByAiGenerateType = clientInfoList.stream()  
        .collect(Collectors.groupingBy(
	        ClientInfo::getType, 
	        Collectors.mapping(Function.identity(), Collectors.toList())));
```

우리 데이터 구조상 해당 데이터는 아직 10만개도 넘기 어렵기에, VARCHAR 칼럼 6개 정도이므로 문제가 없다고 판단했다.

2. 타입별로 배치 처리

```java
for (var entry : clientInfoByAiGenerateType.entrySet()) {  
    var resultInTypeBatch = processBatchInType(event.getRequestId(), entry.getKey(), entry.getValue());  
    deletionResult = deletionResult.addResult(resultInTypeBatch);  
}
```

```java
private DeletionResult processBatchInType(
		UUID requestId,
		String type,
		List<ClientInfo> clientInfoList
) {
	DeletionResult deletionResult = DeletionResult.EMPTY;
	
	log.info("{} 타입 삭제 시작. requestId: {} | 개수: {}", type, requestId, clientInfoList.size());
	List<BatchRange> batchRangeList = BatchRange.split(clientInfoList.size(), BATCH_SIZE);

	for (BatchRange range : batchRangeList) {
		log.info("{} 타입 삭제 {} 번째 배치 시작. requestId: {} | 개수: {}", type, range.index() + 1, requestId, range.size());
		List<ClientInfo> batchClientInfoIds = clientInfoList.subList(range.start(), range.end());

		DeletionResult batchResult = processSingleBatch(
				requestId,
				type,
				batchClientInfoIds
		);
		deletionResult = deletionResult.addResult(batchResult);
		log.info("{} 타입에 삭제 {} 번째 배치 완료. requestId: {} | 완료 결과: {}", type, range.index() + 1, requestId, batchResult);
	}

	log.info("{} 타입 삭제 완료. requestId: {} | 결과: {}", type, requestId, deletionResult);
	return deletionResult;
}
```

- 빈 결과를 생성
- 원하는 개수만큼 작업 쪼개기 - BatchRange
- 배치 처리
- 결과 더하기

배치 처리도 나름대로 고민을 좀 했는데

```java
private DeletionResult processSingleBatch(  
        UUID requestId,  
        String type,  
        List<ClientInfo> batchItem  
) {  
    // 1. 조회 (트랜잭션 X)  
    ErasureTarget targets = deletionDataService.findDeletionTargets(requestId, type, batchItem);  
  
	// 2. S3 삭제 (트랜잭션 X)
	int s3DeleteCount = s3DeletionService.deleteFiles(targets.getS3Files());  
  
	// 3. DB 소거 (트랜잭션 O)  
	ErasureResult dbResult = deletionDataService.executeDbDeletion(requestId, targets);
  
    return DeletionResult.builder()  
            .featureCount(dbResult.featureCount())  
            .taskCount(dbResult.taskCount())  
            .s3FileCount(s3DeleteCount)  
            .build();  
}
```

이와같은 코드 흐름으로 진행했다.

1. DB 에서 필요한 데이터들 조회
2. S3 정보를 기반으로 태그 마킹 or 바로 삭제
3. DB 에서 데이터 소거

S3 의 데이터가 가장 중요하다고 생각했다.

- DB 에서 데이터가 처리되면, 특정 S3 객체가 어떤 요청에 의해 생성되었는지 추적 불가능한 구조
- S3 는 없는 파일에 요청 보내면, `No Such ...` 라고 알려주거나, 그대로 처리하는 구조

를 통해, S3 파일이 처리되는건 보장해야 하고, 여러번 요청을 보내도 상관없다는 판단을 내렸다.

이에따라, S3 처리때도 트랜잭션을 가지는건 불필요하기 때문에 트랜잭션을 선언하지 않았다.

## 전?

이와같이 코드를 얼추 흐름대로 다 작성했다고 생각했다.
그래서, AI 를 통해 이런 흐름을 검증할 수 있는 스크립트를 만들어달라고 해서 테스트했다.

하지만, 리뷰를 받으며 + 실제 운영 데이터를 까면서 문제점들이 존재한다는걸 깨달았다.

## 다시 기-승 ...

> 해당 내용은 포괄적인 내용보단, 우리 팀에 따른 이슈다.

### 클라이언트 테이블 정합성 이슈

우리팀은 모든 요청에 대해 식별하는 `client` 라는 엔티티가 있다. (어떤 클라이언트 키가, 어떤 요청을 했는지 등등)

이 테이블은 데이터가 쌓여가고, 단순 인덱싱으로는 한계임을 느낀 필요에 따라 파티셔닝을 하게되었다.
이때, 우리 예전 클라이언트 테이블은 `created_at` 이 없었다.

이를 해결하기 위해, `created_at` 이 있고, 파티셔닝을 처음부터 적용한 새로운 테이블을 만들었다.
하지만, 사용자의 예전 요청도 소거를 해줘야 했다.

문제는, 당연히 이전 테이블들 이기 때문에 정합을 맞춰줘야 했다.

```java
public class CustomClientInfoRepository {
	/**
	 * Legacy 테이블(temp, old)에서 해당 clientKey를 가진 데이터를 모두 조회
    */
    public List<ClientInfo> findAllByClientKey(String clientKey) {
        List<ClientInfo> allResults = new ArrayList<>();

        // 두 테이블 모두 조회하여 합침
        allResults.addAll(selectList(SELECT_CLIENT_OLD_SQL, clientKey, CLIENT_OLD_TABLE));
        allResults.addAll(selectList(SELECT_CLIENT_TEMP_SQL, clientKey, CLIENT_TEMP_TABLE));

        allResults.addAll(clientInfoRepository.findAllByClientKey(clientKey));
        return allResults;
    }
```

```sql
private static final String SELECT_CLIENT_OLD_SQL = """
	SELECT * FROM client_old
	WHERE client_key = :clientKey
	""";
```

CustomXXXRepository 를 만들어서 외부에선 이전 테이블의 요청인지 모르게 처리했다.

### 다른 기능도 처리가능하게 확장

기존에 내가 처리한 것은 `AIGenerate` Feature 였다.
하지만, PDF 에서 글자, 이미지 등 정보들을 추출해서 제공해주는 서비스도 있었다! 🫠

이를 놓친 이유를 회고해보자면

```java
/**  
 * 이미지 생성 요청 타입  
 */  
@Getter  
public enum AIGenerateType {  
  
    /**  
     * 텍스트 투 이미지 요청 타입  
     */  
    TEXT_TO_IMAGE,
    /**  
     * 이미지 투 이미지 요청 타입  
     */  
    IMAGE_TO_IMAGE,
    
	...
}
```

우리는 이와 같이 ENUM 에서 모든 요청 타입들을 관리하고 있었다.
추가로, 내가 PDF 쪽 모듈을 처리해본 적 없었다. 영향 범위 파악이 제대로 안된 것이였다.

기존 코드에서 확장이 필요해졌다.

```java
private final List<AIGenerateEntityErasureRepository> erasureRepositories;

@Override
public ClientErasureDataService.DeletionTargets findDeletionTargets(String type, List<ClientInfo> clientInfoList) {  
    var aiGenerateType = AIGenerateType.findByAlias(type);  
    var repository = findRepository(aiGenerateType);
    
    ...
}

private AIGenerateEntityErasureRepository findRepository(AIGenerateType type) {  
    return erasureRepositories.stream()  
            .filter(repo -> repo.getAIGenerateType() == type)  
            .findFirst()  
            .orElseThrow(() -> new IllegalArgumentException("Repository not found: " + type));  
}

public interface AIGenerateEntityErasureRepository {  
  
    /**  
     * Repository가 처리하는 AIGenerateType 반환  
     */  
    AIGenerateType getAIGenerateType();
 
	...   
}
```

기존 코드는 AIGenerateType 이 들어온다고 가정하고 작성이 되어있었고, PDF 는 AIGenerateType 도 없다.

추가로, PDF 는 조금 구현방식이 달랐다.
PDF 의 생성 결과는 AIGenerate 와 다소 다르다.

PDF 는 추출결과 이미지가 하나에 1000개씩도 생성이 될 수 있다.
그렇기에, 기존 fileList 나 다른 변수에 저장해두지 않고

JSON 내부에 fileKeyList 를 저장하고 있었다. ( DB에는 JSON 경로만 존재 )
그래서,  S3 에서 JSON 을 가져오고 -> 그 다음, fileKeyList 를 조립해서 반환을 해줘야했다.

=> 이에따라, Handler 라는 상위 레이어를 하나 더 만들었다.

```java
public interface ErasureHandler {  
  
    boolean supports(String type);
    
    DeletionTargets findDeletionTargets(String type, List<ClientInfo> clientInfoList);   
    
	...
}
```

들어온 타입을 처리할 수 있는지, 어떻게 처리할 지를 명세하는 인터페이스와 함께

```java
public class AIGenerateErasureHandler implements ErasureHandler {
	...	
}
```

```java
public class PdfErasureHandler implements ErasureHandler {
	...	
}
```

두개를 구현했다. 이 구조에서 내가 생각하는 장점은

- AIGenerateType 이 늘어나도, 관심사가 전파되지 않는다

우리 서비스의 구조상, 기능이 더 늘어날 여지가 상당히 존재한다.
( AI 기능 및 AI 기능을 활용한 워크플로우가 나오면, 이를 래핑해서 새로운 feature 로 생성 )

그때마다 Repository 만 추가하면, AIGenerateErasureHandler 가 알아서 처리해준다.

> 각 Feature 들마다 Handler가 있는게 아니라
> AIGenerate / PDF / ... 로 분리

## 전

이런 구현한 내용들을 기반으로 AI 에게 내가 생각한 TC 를 만들어서 제공해줬다.

- [ ] 모든 AI 기능이 소거가 잘 적용되는지 
- [ ] pdf 요소들도 소거가 잘 적용되는지

- [ ] option 에 변수 s3 url 만 있는 경우
- [ ] option 에 변수 cf url 만 있는 경우
- [ ] option 에 bucket, key, cf url 있는 경우
- [ ] option 에 bucket, key, s3 url 있는 경우
- [ ] option 에 inputFileList 안에 값들이 있는 경우 - 배열에는 무조건 key, bucket 이 있는걸 보장

- [ ] result 에 변수 url 만 있는 경우
- [ ] result 에 fileList 가 있는 경우

대화를 기반으로 AI 가 실행해서 실제로 검증할 수 있는 스크립트를 만들어줬다.

![](https://i.imgur.com/axsPgIs.png)


## 결

이번 이슈를 하며서 나름대로 느낀게 좀 있어서 정리한다.

### 데이터 파악의 중요성

코드는 결국, 유지보수의 대상이다.
리팩토링을 하건, 필요에 따라 개선을 하건 계속해서 수정이 되어간다.

하지만, 데이터는 다소 다를수 있다.
매번, 코드와 데이터가 일관성을 맞출수 있다면 좋겠지만 그렇지 못하는 경우가 존재한다.

EX) 기존에 2천만개의 데이터가 `url` 이라는 변수에 쌓여있다고 해보자.
이제부터, `fileList` 변수안에 그 값을 넣는다고 할 때 기존의 `url` 변수들은 어떻게 해야할까?

1. flyway script 로 한번에 진행한다.
2. batch 작업을 통해 기존 데이터들의 정합을 맞춘다. (전문 용어로는 backfill)
3. 건들지 않는다. ☠️

생각보다, 데이터 정합을 맞추는건 번거로울 수 있다.
운영중인 DB 에 UPDATE 유발하는 것도, 빠른 배포의 사이클도 방해할 수 있다. ( 어떻게 backfill 을 구성..? 데이터 구조는 롤백..? )

이렇게 데이터의 상태가 중첩된 상태로 존재할 수 있다.
그리고, 이건 코드에서 안 드러날 수 있다.

> 변수가 사라졌다던지, 변수 이름이 바뀌었다던지, null 이 절대 될 수 없다고 생각했던 변수가 null 이 될 수 있다든지...

테이블의 모든 레코드를 다뤄야할 일이 있다면 코드의 커밋 히스토리를 따라가면서, 그때의 데이터 상태를 추적해나가자.
이를 처음에 고려하지 않고 코드를 작성했다간, 곳곳에 수많은 방어적 코드나 예상치 못한 에러가 터질 수 있다.

### interface is good

사실, 인터페이스의 사용법에 대해 아직까지 그렇게 감이 오지 않았다.
이번 이슈를 하면서 인터페이스를 나름대로 만족스럽게 사용한 거 같다.

이슈의 특징은 생각보다 작업의 범위가 크다는 것이였다.
이때, 구현 방향, 데이터 구조 변경, 테스트, 코드 퀄리티 등 모든걸 같이 하려고 하면 이슈 진행이 단일 처리로 병목이 상당히 되었을 것이다.
(우리팀은 3명의 코드 리뷰를 받아야만 머지가 된다.)

인터페이스와 함께 작업의 범위를 잘게 쪼개나갔다.

- 예전부터 존재했던 데이터와 현재 데이터의 구조 간극을 맞추기 위한 인터페이스
- 18개의 기능에서 필요한 메소드를 정의한 인터페이스와 중복 코드를 제거하기 위한 추상클래스
- AIGenerate, PDF 와 같은 작업의 단위로 나누기 위한 인터페이스

가장 큰 장점은 리뷰어가 PR 에서 코드를 보는 컨텍스트가 깨지지 않는다는 것이였다.
이슈 내용 전체를 담다보면, 기존 코드의 결함 때문에 수정되는 부분들이 분명히 존재한다.

하지만, 중요한 내용 보다가 '사소한 수정 내용' 한개가 집중력을 깨버릴수 있다.
`인터페이스를 선언한다. - 인터페이스를 구현한다.`

라는 관심사에서 리뷰어는 부담없이 코드를 볼 수 있다.
그리고, 이 인터페이스를 어떻게 사용할건지 다음 코드의 방향도 미리 알 수 있게 된다.

- 앞으로의 코드 규약에 대한 제약
- 다음 코드의 방향성에 대한 가이드라인
- 리뷰의 관심사 분리

```java
@Override  
public DeletionTargets findDeletionTargets(String type, List<Long> clientIdList) {  
    var aiGenerateType = AIGenerateType.findByAlias(type);  
    AIGenerateEntityErasureRepository repository = findRepository(aiGenerateType);  
  
    var features = repository.findFeatureByClientIds(clientIdList);  
  
	...
  
    return new DeletionTargets(...);
}
```

이런 삭제할 데이터를 반환하는 로직이 있다고 할 때
내가 Repository 를 18개를 구현했고, Repository 가 구현이 어떻게 되었는지 중요하지 않다.

어떻게든 선언한 메소드 구조로 구현을 할 거고, '이와같은 방식으로 사용 될 것' 만 중요하다.

### 모든것은 Trade-off

이는 회사에서 개발을 하면서도 느꼈지만, 다시 한번 느꼈다.
코드의 사소한 부분 하나하나 까지도 trade-off 의 영역은 다가온다.

예시를 들어보자면

1. 데이터를 처리한다. 어떻게?
	1. 단건으로 처리한다.
	2. 배치로 처리한다.

-> 데이터가 많을수도 있으니, 부하가 될 테니 배치로 처리해야겠어.

- 배치로 처리하다가 중간에 실패를 하면 어떻게 처리?
	- Transacitonal 을 롤백해서 처음부터 다시?
	- 실패를 무시하고 처리?
	- 다시한번 재시도?

2. 데이터를 어떻게 처리하지?
	1. Hard-Delete 를 한다.
	2. Soft-Delete 를 한다.

-> 사용자의 기록이지만, `언제 생성` & `어떤 GPU 로 타임라인이 구성` 등의 데이터가 혹시나 사용될 수 있을테니까
사용자의 기록만 마스킹 처리하는 Soft-Delete 방식으로 해야겠어.

- 데이터를 NULL or `{}` 로 만들었을때 서버 로직상 문제가 되는곳은 없나?
- 클라이언트 측 코드는 갑자기 변하게 된 스키마에 대응이 되어있나?

3. 기록 소거 요청을 다른 팀에게 어떻게 받지?

- 그냥 API 로 열어놓으면?
	- 인증된 사용자인지 어떻게 검증하지?
- 백오피스로 열어놓으면?
	- 직접 와서 작업하기 번거롭지 않을까?

> 차라리, 탈퇴한 사용자 목록을 전부 받고
> 우리팀이 엑셀로 수작업하거나 전용 백오피스 화면을 만드는게 더 효율적일수도 있다.

- 기록 소거 요청이 성공으로 응답되면, 어떻게 처리된다는 걸 무조건 보장해줄 수 있을까?

-> 혹시, 실패하더라도 다시 재처리할 수 있게 DB 에 기록을 남기고, Kafka 메시지로 발행해야겠어.

- Kafka 메시지가 발송시 실패하면 어떻게 하지?
- Kafka 처리가 실패하면, DB 는 어떻게 변경해야 하지?

=> 우리는 끝없이 저울질 하고, 선택을 해야만 한다.

AI 가 정답은 알려주지만 ( 때로는 정답도 안알려주지만 )
무엇이 빨간약, 파란약인지 알 수 없다.

아직까지 이런 

## 마무리

작업이 다 마무리는 안되었지만, 나름대로 큰 작업을 내 손으로 해내가고 있다는게 꽤나 뿌듯하다.

36개 테이블에서 존재하는 이전, 현재 데이터 구조의 차이를 핸들링하고
한 사용자당 최대 25~28,000 요청 & 50,000 개의 이미지 정도를 배치로 부하없이 처리하고
앞으로도 어떤 기능이 추가되든 확장 가능한 형태로 설계하고

이를 테스트 & E2E & 코드 구조적으로 처리해냈다.
앞으로도 더욱 성장할 수 있는 내가 되길.
