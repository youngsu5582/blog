---
title: "왜 BDD 인가 ( Cucumber 사용기 )"
author: 이영수
date: 2024-08-16T16:19:59.783Z
tags: ['bdd', 'cucumber', '테스트', '우테코', '행위 테스트']
categories: ['프로그래밍', '테스트']
description: TDD, ATDD 에 질리지만, 테스트는 작성하고 싶은 그대라면
image:
  path: https://velog.velcdn.com/images/dragonsu/post/14adcdaf-b763-4407-886c-b122b719369d/image.jpeg
---
해당 내용들은 [Cucumber 학습 레포지토리](https://github.com/youngsu5582/cucumber-test/tree/main/src/test/java)
여기에 정리되어있으며 전문적으로 사용하거나, 학습후 한게 아닌 대략적으로 보고 사용해보고 느낀점들이다.
궁금한 점 및 잘못된 점들은 댓글 및  `joyson5582@gmail.com` 로 남겨주시면 감사하겠습니다.

---

BDD 는 대부분의 사람들이 생소할 수도 있는 단어이다.
TDD 는 Test Drivent Development 인데 B는 뭐지??

## BDD

여기서 B는 Behavior 를 뜻한다.
한국어로는? 행위이다.

이를 좀 더 알기 위해서 Cucumber 에서 설명하는 BDD를 해석하며 이해해보자.
```
https://cucumber.io/docs/bdd/

BDD is a way for software teams to work that closes the gap between business people and technical people by:

- Encouraging collaboration across roles to build shared understanding of the problem to be solved
- Working in rapid, small iterations to increase feedback and the flow of value
- Producing system documentation that is automatically checked against the system’s behaviour

We do this by focusing collaborative work around concrete, real-world examples that illustrate how we want the system to behave. We use those examples to guide us from concept through to implementation, in a process of continuous collaboration.

```

BDD는 비즈니스 담당자 - 기술자 사이 간극을 줄이며

1. 협업을 장려하고
2. 신속하고 작은 반복
3. 시스템 문서를 생성하게 해주고 행동을 자동으로 체크

라고 나타낸다.
뭐야 그냥 애자일 프로세스에 대한 설명 아니야?
( 협업 장려, 작고 빠른 단위, 간극 줄이기 등등 )

맞다!
BDD 는 애자일 프로세스를 대체하는게 아닌
`BDD does not replace your existing agile process, it enhances it.`  말처럼 애자일 프로세스를 강화해주는 것이다.

그러면 BDD를 적용하려면?

![450](https://i.imgur.com/WnJs1wM.png)

BBD는 3가지의 반복적인 프로세스로 이루어진다고 한다.

1. 예정된 작은 시스템 사항을 가지고, 새로운 기능의 구체적인 예를 이야기 해 세부 사항을 발견 및 합의한다.
2. 이 예시를 자동화 가능한 방법으로 문서화하고, 동의 여부를 확인한다.
3. 문서화된 각 예시에서 설명하는 동작을 구현한다.

아이디어는 각 변경 사항을 작게 만들고, 빠르게 반복하며 더 많은 정보가 필요할 때마다 한 단계씩 위로 올라가야 한다.
-> 새로운 예제를 자동하고 구현할 때마다 시스템에 가치 있는 무언가를 추가하고 피드백에 대응할 준비가 된 것이다.

뭔가 TDD 랑 비슷하지 않은가?
1. 테스트를 실패하게 작성한다.
2. 실패한 코드를 최대한 빨리 통과하게 한다.
3. 프로독션 코드 & 테스트 코드 리팩토링

물론 각 단계가 의의하는건 다르지만, TDD 사이클을 통해
테스트 코드를 작성하고 , 기능 구현 하고 리팩토링을 반복해서 완성 하면
`이제 해당 코드에 대한 잘못 및 에러는 본인의 밖의 영역` 이라는 마음을 가질 수 있듯이

BDD 역시도, 도출된 세부 사항을 가지고 전부 작성 및 통과하면
위에서 말했듯 기능을 추가했고, 피드백에 대응할 방법이 준비된 것이다. ( 세부 사항 합의할 때 비즈니스 담당자와 얘기를 하며 도출했을 테니까 )

그러면, BDD 를 기반으로 기능을 작성 하려면 어떻게 해야할까?

## BDD 시작하기

### Discovery

```
> The hardest single part of building a software system is deciding precisely what to build.
> 
> – Fred Brooks, The mythical man-month
```

개발을 할 때 가장 어려운 것은 정확히 무엇을 만들어야 하는지 결정하는 것이다.
진정한 목표인 가치 있고 작동하는 소프트웨어를 만들기 위해선
상상하고 제공하는 관계자들과 얘기를(비즈니스 담당자) 해야만 한다.

BDD는 회의에 소요되는 시간을 최소화 하고, 가치 있는 코드 생산량을 극대화 한다.
( 스토리 범위에서 제외 가능한 순위가 낮은 기능을 발견해 팀이 작은 작업 단위로 작업하게 해준다. )

그리고, 이 `Discovery` 가 마스터 되기 전까진 밑에 2가지 역시도 의미가 없다. ( - 라고 Cucumber 공식 문서가 적어놨다. ㅇ.ㅇ )
> EX ) 저희가 리뷰를 위한 방을 구현 해야 한다면 뭐부터 해야할까요?
> 음 우선, 방을 구현 할 때 현재 시간 보다 이전의 값을 넣는건 막아야 할 꺼 같아요.
> 방의 재미를 위해서 방의 사진을 자동으로 생성후 추천해주는건 어떨까요?
> 
> 사용자의 재미를 위해서 사진 생성 로직부터 시작하고
> 검증부분은 백로그에 올려놓고, 나중에 작업하는 걸로 합시다!
> ( 물론, 위 부분들은 내가 생각하는 BDD의 모습 )

### Formulation

Discovery 에서 가치 있는 예제들을 발견했다면?
우리는 구조화된 문서로 `formulate(공식화)` 가능하다.
이 공식화를 기반으로 서로가 이해하는게 같은지, 팀 전체한테 구현할 내용을 전파가 가능하다.

그리고, 사람-컴퓨터가 모두 읽을수 있는 내용을 기반으로 구현 개발을 안내할 수 있다.
( 이는 코드 부분까지도 연결이 가능하게 해줌 )

### Automation

실제 수행하는 작업으로 실행 가능한 사양이 있으므로, 구현 개발을 안내 할 수 있다.
시스템이 현재 무엇을 하고 있는지 확인 + 깨뜨리지 않고 안전하게 변경 가능하도록 도와준다.
-> 수동 회귀 테스트의 부담을 줄여줘 더 흥미로운 작업을 가능하게 해준다.

여기까지가 BDD 와 BDD 를 시작하는 방법들에 대해서다.
이제 그러면 Cucumber 는 어떤 내용들로 문서화를 하는지 살펴보자.

---

Cucumber 는 자신들이 제안한 `Gherkin` 라는 문법을 통해 BDD 를 도와준다.

## Cucumber in Spring

대략적으로
```cucumber
Feature
	Background:
		...
	Scenario(Example 로도 동일하게 동작):
		Given
		When
		Then		
```

와 같은 형식으로 작성이 된다.

여기에 추가로, `And`, `But` 등이 존재하는데
무조건 Given 뒤에 어떻게 `And` 를 넣고, Then 은 하나만 쓰고 등등은 중요하지 않다.
실제 동작에는 차이가 없고, 단지 가독성을 더 좋게 해준다. ( Then 10개도 OK, Then 1 + And 9개도 OK )

- Background : 시나리오를 실행하기 전, 동일한 Step이 필요할 시 반복되는 것을 막기 위한 Step
- Given : 테스트에서 수행하고자 하는 환경을 정의하는 Step
- When : 테스트에서 원하는 동작을 수행하는 Step
- Then : BDD 테스트에서 얻고자 하는 결과를 표현하는 Step
- And,But : Step 뒤에 추가로 정의 & 수행 & 표현 하고자 하는 Step

그러면, 기존의 코드와 함께 보면서 Cucumber 를 쓰면 어떤게 달라지는지 설명하겠다.

```
Scenario: 깃허브에서 받은 적절한 코드를 통해 유저 조회 API를 사용해서 회원가입을 진행한다.  
Given 웹 클라이언트가 적절한 코드를 전달한다.  
And 이미 "corea"라는 유저네임을 가지는 유저가 존재하지 않는다.  
When 코드를 통해 소셜 로그인을 진행한다.  
Then 유저네임이 "corea"인 유저가 조회되어야 한다.
```

시나리오는 일반적인 소설 로그인을 테스트 하는 내용이다.

```java
@Test  
public void 코드를_기반으로_조회후_유저가_없으면_회원가입을_진행한다() {  

	final String username = "corea";  
	//    Given 웹 클라이언트가 적절한 코드를 전달한다.  
	when(githubClient.getAccessToken(mockCode)).thenReturn(mockAccessToken);  
	when(githubClient.getUserInfo(mockAccessToken)).thenReturn(new GithubUserInfo(  
			username,  
			"조희선",  
			"thumbnailLink"
			"corea@email.com"  
	));  

	// And 이미 "corea"라는 유저네임을 가지는 유저가 존재하지 않는다.  
	memberStep.유저네임에_해당하는_유저가_있는지_검증(username);  


	//When 코드를 통해 소셜 로그인을 진행한다.  
	final LoginRequest loginRequest = new LoginRequest(mockCode);  
	final Response response = 회원가입(loginRequest);  

	//    Then 유저네임이 "corea"인 유저가 조회되어야 한다.  
	memberStep.유저네임을_통해_조회(username);  
}
```

```java
@Component  
public class MemberStep {  
    @Autowired  
    MemberRepository memberRepository;  
  
    public void 유저네임을_통해_조회(final String username){  
        assertThat(memberRepository.findByUsername(username)).isPresent();  
    }
}
```

이와 같이 의존성이 혼합되거나 코드에 침범이 당해서 시나리오를 명확하게 드러내지 못한다.
> MemberStep에서 MemberRepository 를 왜쓰냐고 하면
> 우리는 멤버만 직접적으로 조회하는 기능이 없다 - 테스트를 위해 만드는 코드는 별로라고 생각

이런 코드가 당연하게 아니야?
Cucumber 를 쓴다고 많은 부분이 달라지진 않으나 관심사 분리 및 코드단의 분리는 기대 할 수 있다.

```java
@Given("웹 클라이언트가 적절한 코드를 전달한다.")  
public String 적절한_코드를_생성한다() {  
    final String mockCode = "mocking-code";  
    final String mockAccessToken = "mocking-access-token";  
    when(githubClient.getAccessToken(mockCode)).thenReturn(mockAccessToken);  
    when(githubClient.getUserInfo(mockAccessToken)).thenReturn(new GithubUserInfo(  
            "corea",  
            "조희선",  
            "thubmnailLink"
            "corea@email.com"  
    ));  
    cucumberClient.addData(GITHUB_CODE, mockCode);  
    return mockCode;  
}
```

적절한 코드를 전달하고

```java
@And("이미 {string}라는 유저네임을 가지는 유저가 존재하지 않는다.")  
public void 유저네임을_가지는_유저가_있는지_검증한다(final String username) {  
    if (memberRepository.findByUsername(username)  
            .isPresent()) {  
        throw new IllegalStateException(String.format("%s에 대한 유저가 존재합니다.", username));  
    }  
}
```

유저가 존재하지 않는지 확인하고

```java
@When("코드를 통해 소셜 로그인을 진행한다.")  
public void 회원가입() {  
    final LoginRequest loginRequest = new LoginRequest(cucumberClient.getData(GITHUB_CODE, String.class));  
    //@formatter:off  
    final Response response = RestAssured.given().body(loginRequest).contentType(ContentType.JSON)  
            .when().post("/login")  
            .then().assertThat().extract().response();  
    //@formatter:on  
    cucumberClient.setResponse(response);  
}
```

회원가입을 진행하고

```java
@Then("유저네임이 {string}인 유저가 조회되어야 한다.")  
public void 유저네임으로_유저를_조회한다(final String username) {  
    assertThat(memberRepository.findByUsername(username)).isPresent();  
}
```

유저네임으로 유저가 있는지 조회한다.

이런 코드 조각들은?

```java
public class MemberAndStepDefinitions {  
  
    @Autowired  
    CucumberClient cucumberClient;  
  
    @Autowired  
    MemberRepository memberRepository;
    
    @And("이미 {string}라는 유저네임을 가지는 유저가 존재하지 않는다.")  
public void 유저네임을_가지는_유저가_있는지_검증한다(final String username) {  
    if (memberRepository.findByUsername(username)  
            .isPresent()) {  
        throw new IllegalStateException(String.format("%s에 대한 유저가 존재합니다.", username));  
    }  
}  
  
	@And("이미 {string}라는 유저네임을 가지는 유저가 존재한다.")  
	public void 유저네임을_가진_유저를_생성한다(final String username) {  
	    final Member member = memberRepository.save(new Member(username, "thumbnialUrl", "조희선", "corea@email.com", false));  
	    cucumberClient.addData("MEMBER", member);  
	}  
	  
	@Then("유저네임이 {string}인 유저가 조회되어야 한다.")  
	public void 유저네임으로_유저를_조회한다(final String username) {  
	    assertThat(memberRepository.findByUsername(username)).isPresent();  
	}
}
```

이런 조각조각들로 명시적으로 분리가 된다.
의존 주입도 필요한 값들만 주입을 받고 + Step 들도 Component 로 노출을 하지 않아도 된다.
( 다른 곳에서 import 할 필요 없이, 각각이 Cucumber 내에서 따로 동작 )

![](https://i.imgur.com/VpBQ20T.png)

가장 좋은 점들은
이렇게 사람과 기계가 같이 알수 있는 언어로 시나리오를 작성한다는 점과
가변의 값을 자유자재로 넣을수 있는게 장점인거 같다.

그러면 좋은 점만 있을까??

### 단점...?

```
3 Scenarios (3 passed)
12 Steps (12 passed)
0m5.416s
```

해당 값들을 수행하는데 5초 정도로 비교적 긴 시간이 걸린다.
아무래도, 추가적인 Step ( Cucumber ) 이 생기며 어쩔수 없는거 같다.

```java
@TestComponent  
@ScenarioScope  
public class CucumberClient {  
  
    private final Map<String, Object> dataStorage = new HashMap<>();  
  
    private Response response;  
  
    private String token;

	public void addData(final String key, final Object value) {  
	    dataStorage.put(key, value);  
	}  
	  
	public <T> T getData(final String key, final Class<T> clazz) {  
	    final Object data = dataStorage.get(key);  
	  
	    if (data == null) {  
	        throw new NullPointerException(String.format("%s 에 대한 값이 없습니다.", key));  
	    }  
	  
	    if (!clazz.isInstance(data)) {  
	        throw new ClassCastException(String.format("%s 와 %s는 타입이 다릅니다.", clazz, data));  
	    }  
	  
	    return clazz.cast(data);  
	}
}

```

그리고, 진행상황과 여러 값들을 저장하게 해주는 Client 가 있는데
이게 너무 편리한 나머지 테스트를 더욱 복잡하게 하거나, 값이 덮여지는 경우등을 조심해야 겠다고 느꼈다.

추가로, 스텝이 계속 늘어나는 점과

```java
@And("이미 {string}라는 유저네임을 가지는 유저가 존재한다.")  
public void 유저네임을_가진_유저를_생성한다(final String username) {  
    final Member member = memberRepository.save(new Member(username, "thumbnialUrl", "조희선", "corea@email.com", false));  
    cucumberClient.addData("MEMBER", member);  
}
```

해당 값이 `And` 로도, `Given` 으로도 쓰일 수 있으므로 혼란을 주는 점들이 있을 거 같다.

이를 당연히 현재 하는 팀 프로젝트에는 바로 도입할 수는 없을 거 같다.
팀원들에게 학습을 위한 시간 및 도입을 위한 준비를 할 만큼 이게 필수적이다 라고 생각이 들지 않을 뿐.

충분히 메리트가 있는건 부정할 수 없는거 같다.
단순 ATDD 보다, 문서화를 더 명확하게 할 수 있는것도 좋은 포인트라고 생각한다.
( ATDD 는 요구사항 충족 여부, BDD 는 소프트웨어 행위에 중점 )
-> 그렇기에, 조금은 더 사용자의 관점에서 개발자의 관점으로 내려놓는 것도 OK


추가로, 여기서 어떤 부분은 테스트 할 때 `
RestAssured` 로, 어떤 부분은 `Repository` 로 했는데
급하게 작성한다고 이렇게 해놓았으며

> 말씀하신 하위 계층과 연결이 될 것 같은데, 테스트의 검증의 추상화 레벨이 다른 느낌이 들어서요

해당 내용처럼, 계층 일관성을 최대한 유지시키자.

---

Intellij IDEA 에서 Cucumber 를 사용하면, 매우 버벅 거리는 경우가 있는데
이때 `Cucumber Scenarios Indexer` 를 설치해보자.
파일 인덱싱을 해준다는 것 같은데 있고 없고의 속도 차이가 상당히 크다.

![](https://velog.velcdn.com/images/dragonsu/post/bb076f02-3060-4964-ab58-ef2b81dc1f7b/image.gif)

( 이게, 적용하지 않은 상태 )

![](https://velog.velcdn.com/images/dragonsu/post/f4b7a3e3-c0ea-46c0-88bc-2791eb79bb9f/image.gif)

( 이게, 적용한 상태 )

각자, 컴퓨터마다 다를 순 있으나 혹시나 Cucumber 사용중 렉이 걸린다면 시도해보자.
