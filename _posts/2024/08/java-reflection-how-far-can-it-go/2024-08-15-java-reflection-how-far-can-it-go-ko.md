---
title: "자바 리플렉션 어디 까지 가능할까"
author: 이영수
date: 2024-08-15T15:12:45.442Z
tags: ['리플렉션', '우테코', '자바', '쿼리 검사기']
categories: ['백엔드', '자바']
description: PR 올리기 전 내 모든 메소드가 쿼리를 몇 번 실행 하는지 검사 & 리포트를 가능하게
image:
  path: https://velog.velcdn.com/images/dragonsu/post/5b399bce-a867-4519-8220-3ca1a1dbf68a/image.jpeg
lang: ko
permalink: /posts/java-reflection-how-far-can-it-go/
---
( 저희 프로젝트 캐릭터 입니다 귀엽죠?🙂 )

해당 내용은 리플렉션&어노테이션을 활용해서 동적 메소드 실행을 통해 결과를 얻는 내용입니다.
joyson5582@gmail.com 이나 댓글로 더 좋은 방법이 의견을 주시면 답변하겠습니다!

## 서론 : 리플렉션에 대해서

리플렉션에 대해 간단히 설명을 하면
`Heap` 영역에 저장된 클래스 자체 정보들의 값을 사용할 수 있는 API이다.

```java
class Person{
	
	private Long id;  
	  
	private long roomId;  
	  
	private long memberId;
}
```

일반적으로 이런 객체가 있다고 하면?

```java
Participation participation = new Participation(1L, 1L, 1L);  
assertThat(participation.getClass()).isEqualTo(Participation.class);
```

`Participation.class` 나 `getClass` 를 통해 받는 값이 클래스 자체 정보의 값이다.
그러면 어떤 것들을 제공할까?

- getMethods
- getAnnotations
- getConsturctors
- getFields
- getInterfaces

우리가 `클래스에서 가져올 수 있나?` 라고 생각하는 모든 것들이 가능하다.
( 이외에도, `getSuperClass`, `getEnumConstants` 등등도 존재한다. )

```java
Participation participation = new Participation(1L, 1L, 1L);  
Class<Participation> clazz = Participation.class;  

Arrays.stream(clazz.getMethods()).forEach(System.out::println);  

Arrays.stream(clazz.getAnnotations()).forEach(System.out::println);  

Arrays.stream(clazz.getFields()).forEach(System.out::println);  

Arrays.stream(clazz.getConstructors()).forEach(System.out::println);
```

> 왜 clazz 일까? # [Why do Java programmers like to name a variable "clazz"? [closed]](https://stackoverflow.com/questions/2529974/why-do-java-programmers-like-to-name-a-variable-clazz)
> JDK 1.0 부터, `class` 라는 키워드를 피해서 자주 사용했다.
> 영어권에서는 s 를 -> z 로 바꾸는게 자주 사용되기 떄문에 ㅇ.ㅇ

출력해보면?

```java
//clazz.getMethods
public java.lang.Long corea.participation.domain.Participation.getId()
public long corea.participation.domain.Participation.getRoomId()
public long corea.participation.domain.Participation.getMemberId()
public final void java.lang.Object.wait(long,int) throws java.lang.InterruptedException
public final void java.lang.Object.wait() throws java.lang.InterruptedException
public final native void java.lang.Object.wait(long) throws java.lang.InterruptedException
...
```

상속하는 클래스들의 메소드 까지 다 출력된다.

```java
//clazz.getDeclaredMethods()
public java.lang.Long corea.participation.domain.Participation.getId()
public long corea.participation.domain.Participation.getMemberId()
public long corea.participation.domain.Participation.getRoomId()
```

`getDeclaredMethods` 를 하면, 클래스 내에 존재하는 메소드들만 가져온다.

( => 즉, 해당 클래스에서 선언한 무언가가 필요하다면, `DeclaredXX` 를 가져오자. )

이렇게, 단순 사용할 때는 몰랐지만 자바는 매우 정교(더럽게?)하게 구성되어 있다.
Method 는 -> `java.lang.reflect.Method`
Method 의 Parameter 는 -> `java.lang.reflect.Parameter`
Class 의 Field 는 -> `java.lang.Field`
Class 의 Constructor 는 -> `java.lang.Constructor`

로 되어있고, 서로들을 통해 구성이 되어있다.

일반적으로는 컴파일 타임에 메소드 호출이 결정되고 실행 시 JVM이 메소드를 직접 해서 동작한다.

```java
public void simpleMethod() {  
    int sum = 0;  
    for (int i = 0; i < 1000; i++) {  
        sum += i;  
    }
}
```

이와 같이 간단한 함수를

```java
// 1. 직접 호출  
long startDirect = System.nanoTime();  
for (int i = 0; i < 100000; i++) {  
    benchmark.simpleMethod();  
}
  
long endDirect = System.nanoTime();  
long durationDirect = endDirect - startDirect;
System.out.println("직접 호출 시간: " + durationDirect + " ns");
```

```java
// 2. 리플렉션 호출  
Method method = ReflectionBenchmark.class.getMethod("simpleMethod");  
long startReflection = System.nanoTime();  
for (int i = 0; i < 100000; i++) {  
    method.invoke(benchmark);
}
long endReflection = System.nanoTime();  
long durationReflection = endReflection - startReflection;
System.out.println("리플렉션 호출 시간: " + durationReflection + " ns");
```

을 통해, 10정도 반복해본 결과

```
직접 호출 시간: 9959708 ns
리플렉션 호출 시간: 13870958 ns

직접 호출 시간: 2193666 ns
리플렉션 호출 시간: 18574792 ns

직접 호출 시간: 2079875 ns
리플렉션 호출 시간: 2095750 ns

직접 호출 시간: 2555333 ns
리플렉션 호출 시간: 2215291 ns

직접 호출 시간: 2314250 ns
리플렉션 호출 시간: 2266584 ns

직접 호출 시간: 2112292 ns
리플렉션 호출 시간: 2169792 ns

직접 호출 시간: 2191375 ns
리플렉션 호출 시간: 2185667 ns

직접 호출 시간: 2074167 ns
리플렉션 호출 시간: 2366333 ns

```

와 같은 결과로, 대략 직접 호출이 조금 더 빠르다. ( 당연하지 않을까? 불러와서 동적으로 실행하므로 - Step 증가 )
성능이 떨어지나, 의도적으로 원하는 대로 함수를 실행 + 테스트를 할때는 성능이 크게 중요하지 않다.
등을 통해 리플렉션을 통해 모든 요청에 쿼리 검사기를 돌려보자.

## 요청 쿼리 검사기

> 사실, 나도 아직 작성중에 있으며 이 방법은 상당히 많은 대전제가 필요하다.
> 실제 요청( RestAssured ) 을 쓸까 했으나, 어차피 AccessToken 검사 부분을 제외하곤
쿼리 관점에선 동일하다 생각해 컨트롤러를 트래킹

### 대전제 1. 완벽한 Context + Specification

먼저, 우리팀은 `Spring-openai` 를 쓰기로 합의했다.
코드와 일관성, 추가적인 설명 및 작성 용이 등과 프론트와 소통을 원활히 하기 위해서다. ( 엄청 꼼꼼히 작성한, 애쉬에게 감사를 🙂 )
```java
@Tag(name = "Feedback", description = "피드백 관련 API")  
public interface DevelopFeedbackControllerSpecification {  
  
    @Operation(summary = "개발 관련 피드백을 작성합니다.",  
            description = "자신에게 배정된 리뷰이의 개발 능력 관련 피드백을 작성합니다. <br>" +  
                    "요청 시 `Authorization Header`에 `Bearer JWT token`을 포함시켜야 합니다. " +  
                    "이 토큰을 기반으로 `AuthInfo` 객체가 생성되며 사용자의 정보가 자동으로 주입됩니다. <br>" +  
                    "JWT 토큰에서 추출된 사용자 정보는 피드백 작성에 필요한 인증된 사용자 정보를 제공합니다. " +  
                    "<br><br>**참고:** 이 API를 사용하기 위해서는 유효한 JWT 토큰이 필요하며, " +  
                    "토큰이 없거나 유효하지 않은 경우 인증 오류가 발생합니다.",  
            tags = {"DevelopFeedback API"})
    @ApiErrorResponses(value = {ExceptionType.ALREADY_COMPLETED_FEEDBACK, ExceptionType.NOT_MATCHED_MEMBER})
    ResponseEntity<Void> create(  
            @Parameter(description = "방 아이디", example = "1")  
            long roomId,  
            AuthInfo authInfo,  
            DevelopFeedbackRequest request);
	}
}
```

이와 같이 메소드가 명시되어있고

```java
@Schema(description = "개발 능력 관련 피드백 작성 요청")  
public record DevelopFeedbackRequest(@Schema(description = "리뷰이 아이디", example = "2")  
                                     long receiverId,  
  
                                     @Schema(description = "평가 점수", example = "4")  
                                     int evaluationPoint,  
  
                                     @Schema(description = "선택한 피드백 키워드", example = "[\"코드를 이해하기 쉬웠어요\", \"컨벤션이 잘 지켜졌어요\"]")  
                                     List<String> feedbackKeywords,  
  
                                     @Schema(description = "부가 작성 가능한 피드백 텍스트", example = "처음 자바를 접해봤다고 했는데 생각보다 매우 잘 구성되어 있는 코드였습니다. ...")  
                                     String feedbackText,  
  
                                     @Schema(description = "랭킹에 필요한 추천 점수", example = "2")  
                                     int recommendationPoint)
)
```

DTO 내부에는 스키마로, 예시값들이 작성되어 있다.
우리는 `@Parameter` 와 `@Schema` 의 example 값을 사용할 예정이다.
그렇기에 이 값 들을 통해 실행을 해도 예외나, 문제가 없는 DB 컨텍스트가 존재해야 한다.
### 대전제 2. SQL 쿼리 가로채기

해당 내용은 다음 글인 쿼리 가로채기 글을 작성할 것이므로 생략하겠다.

그러면 시작해볼까?

---
### ParameterExtractor

```java
public Object constructParameter(Parameter parameter) {
    try {
        if (parameter.isAnnotationPresent(io.swagger.v3.oas.annotations.Parameter.class)) {
            io.swagger.v3.oas.annotations.Parameter paramAnnotation = parameter.getAnnotation(io.swagger.v3.oas.annotations.Parameter.class);
            String exampleValue = paramAnnotation.example();
            return castValueToType(exampleValue, parameter.getType());
        }
        
        if (parameter.getType()
                .isRecord()) {
            return constructRecord((Class<? extends Record>) parameter.getType());
        }
        
        if (parameter.getType() == AuthInfo.class) {
            return AUTH_INFO;
        }
        
    } catch (Exception e) {
        throw new RuntimeException(e);
    }
    throw new NoSuchParameterException(String.format("%s 는 지원되지 않는 파라미터입니다.",parameter));
}
```

사실, 해당 부분이 검사기의 전부이다. 동적으로, 파라미터를 생성해내기 때문이다.
AUTH_INFO 는 그냥 기본적인 인증 값(`new AuthInfo(1L, "youngsu5582", "yuyoungsu5582@gmail.com")`)이다.

#### Swagger 파라미터가 있다면?
 ![](https://i.imgur.com/duRbWUX.png)

`long roomId` 와 같이 `@Parameter` 가 있으면, 내부 example 값을 추출해서 가져온다.
#### 타입이 레코드라면? ( 우리는, 웹 요청이 오는 모든 DTO 를 레코드로 만들었다. )

자바에서, 16부터 지원해주는 `isRecord` 를 통해 확인하고

```java
private Object constructRecord(Class<? extends Record> clazz) throws NoSuchMethodException, InvocationTargetException, InstantiationException, IllegalAccessException {
    RecordComponent[] components = clazz.getRecordComponents();
    Object[] args = new Object[components.length];

    for (int i = 0; i < components.length; i++) {
        RecordComponent component = components[i];
        Method accessor = component.getAccessor();
        Schema schema = accessor.getAnnotation(Schema.class);
        
        if (schema != null) {
            String exampleValue = schema.example();
            args[i] = castValueToType(exampleValue, component.getType());
        } else {
            args[i] = getDefaultValue(component.getType());
        }
    }
    
    Constructor constructor = clazz.getDeclaredConstructor(getClassesFromComponents(components));
    return constructor.newInstance(args);
}

private Class<?>[] getClassesFromComponents(RecordComponent[] components) {
    Class<?>[] classes = new Class[components.length];
    for (int i = 0; i < components.length; i++) {
        classes[i] = components[i].getType();
    }
    return classes;
}
```

1. 레코드의 요소들을 가져온다.
2. 요소의 접근자를 가져온다.
> 왜 변수가 아니라, accesor??
> 레코드의 변수는 불변이다. private final 로 자동 생성되며, 필드 접근을 위해
> 변수명에 해당하는 접근 메소드를 자동으로 생성해준다.
> -> 그렇기에, 레코드는 함수를 통해 어노테이션이 있는지 확인해야 한다.
3. `@Schema` 의 example 값을 가져온다.

![](https://i.imgur.com/binMQRM.png)

4. 변환한 값들을 통해 새로운 객체를 생성한다. 
	1. 각 컴포넌트들의 타입을 가져온다.
	2. 타입들을 통해, 맞는 생성자를 가져온다.
#### 값 변환

받아온 example 값들은 문자열이므로, 문자열에서 특정 타입으로 변환해야 한다.

![400](https://i.imgur.com/IaGQjN2.png)

( By GPT )
### MethodExtractor

```java
private final ParameterExtractor parameterExtractor;

public Object[] extract(Method method) {
    try {
        Parameter[] parameters = method.getParameters();
        return Arrays.stream(parameters)
                .map(parameter -> parameterExtractor.constructParameter(parameter))
                .toArray();
    } catch (Exception e) {
        throw e;
    }
}
```

각 파라미터들을 받아와서, 파라미터에 대한 값을 조립하고 배열로 반환한다.
이 다음이 어렵다,, 가보자 😎😎
### ControllerExecutor

해당 부분 부터는 아직 미완이다. ( 내 개인 삽질에만 시간을 쓸 순 없긴 때문 )

```java
public void executeAllMethod(Object execution) {
    Class<?> clazz = AopProxyUtils.ultimateTargetClass(execution);
    log.debug("명세서 : {}", clazz);

    Class<?> specificationClass = extractSpecificationClass(clazz);

    Method[] methods = clazz.getDeclaredMethods();

    Map<String, Method> specificationInfo = extractMethod(specificationClass);
    Map<String, Method> executionInfo = extractMethod(clazz);

    Arrays.stream(methods)
            .forEach(method -> executeMethod(execution, specificationInfo.get(method.getName()), executionInfo.get(method.getName())));
}
```

드디어, 마지막이다.
`AopProxyUtils.ultimateTargetClass` 가 뭐지? 라고 생각할 수 있는데
스프링은 클래스들을 수많은 프록시로 감싼다.

![450](https://i.imgur.com/OEy74Ht.png)
( `getDeclareMethods()` 를 해도 나오는 수많은 메소드 )

일반적으로, 해당 컨트롤러를 그대로 사용하면 온전한 메소드들만 추출할 수 없다.
해당 함수를 통해 프록시들을 제거한 온전한 클래스를 가져온다.

```java
private Class<?> extractSpecificationClass(Class<?> controllClass) {
    return Arrays.stream(controllClass.getInterfaces())
            .filter(aClass -> aClass.getName()
                    .contains("Specification"))
            .findFirst()
            .orElse(controllClass.getInterfaces()[0]);
}
```

`XXXSpecification` 인터페이스를 추출

```java
private Map<String, Method> extractMethod(Class<?> specificationClass) {
    return Arrays.stream(specificationClass.getDeclaredMethods())
            .collect(Collectors.toMap(
                    Method::getName, Function.identity()
            ));
}
```

메소드들을 이름별로 그룹화 ( 실행할 메소드와 `Specification` 메소드와 매핑하기 위함 )

```java
public void executeMethod(Object executeClass, Method specificationMethod, Method method) {
    Object[] args = methodExtractor.extract(specificationMethod);
	try {
	    log.debug("함수를 실행합니다. 함수명({}.{}) 실행 매개변수({})", method.getDeclaringClass()
	            .getName(), method.getName(), args);
	    Object result = method.invoke(executeClass, args);
	} catch (RuntimeException e) {
	    log.warn("해당 메소드({})는 명세서와 일치하지 않습니다. 조립된 매개변수({}) 에러({}", method.getName(), args, e);
	} catch (InvocationTargetException e) {
	    throw new RuntimeException(e);
	} catch (IllegalAccessException e) {
	    throw new RuntimeException(e);
	}
}
```

실행 메소드들의 파라미터를 조립 -> 실행할 주체 클래스(`executeClass`) 를 통해서 메소드를 실행한다.
끝이다.

그러면, 잘 동작하는지 확인해볼까?
## 결과

```java
public class RoomController implements RoomControllerSpecification {
	@GetMapping("/opened")  
	public ResponseEntity<RoomResponses> openedRooms(@AccessedMember AuthInfo authInfo,  
	                                                 @RequestParam(value = "classification", defaultValue = "all") String expression,  
	                                                 @RequestParam(defaultValue = "0") int page) {
	    RoomResponses response = roomService.findOpenedRooms(authInfo.getId(), expression, page);
	    return ResponseEntity.ok(response);
	}
}
```

```java
ResponseEntity<RoomResponses> openedRooms(AuthInfo authInfo,  
  
                                          @Parameter(description = "방 분야", example = "AN")  
                                          String expression,  
  
                                          @Parameter(description = "페이지 정보", example = "1")  
                                          int page);
```

```java
@Test  
@DisplayName("특정 메소드를 실행합니다.")  
void execute_specific_method(){
    Class<RoomController> controllerClass = RoomController.class;
    Class<RoomControllerSpecification> specClass = RoomControllerSpecification.class;
    var methodInfo = getMethodInfo(controllerClass);
    var specMethodInfo = getMethodInfo(specClass);

    controllerExecutor.executeMethod(roomController,specMethodInfo.get("openedRooms"),methodInfo.get("openedRooms"));
}
```
해당 값을 실행해보면?

```java
[2024-08-15 22:26:01:6577] [Test worker] DEBUG [corea.global.aspect.ControllerExecutor.executeMethod:56] - 함수를 실행합니다. 함수명(corea.room.controller.RoomController.openedRooms) 실행 매개변수([AuthInfo{id=1, name='youngsu5582', email='yuyoungsu5582@gmail.com'}, AN, 1]) 

[2024-08-15 22:26:01:6589] [Test worker] DEBUG [corea.global.aspect.query.QueryLoggingAspect.logSqlStatements:49] - corea.room.controller.RoomController.openedRooms executed with queries: 
select r1_0.id,r1_0.classification,r1_0.content,r1_0.current_participants_size,r1_0.keyword,r1_0.limited_participants_size,r1_0.manager_id,r1_0.matching_size,r1_0.recruitment_deadline,r1_0.repository_link,r1_0.review_deadline,r1_0.status,r1_0.thumbnail_link,r1_0.title from room r1_0 left join participation p1_0 on r1_0.id=p1_0.room_id and p1_0.member_id=? where p1_0.id is null and r1_0.classification=? and r1_0.status=? and r1_0.manager_id<>? offset ? rows fetch first ? rows only : 1

select count(r1_0.id) from room r1_0 left join participation p1_0 on r1_0.id=p1_0.room_id and p1_0.member_id=? where p1_0.id is null and r1_0.classification=? and r1_0.status=? and r1_0.manager_id<>? : 1
```

함수가 Specification 에 들어 있는 값으로 실행되고, 해당 함수를 실행하며 발생한 쿼리문을 로그로 찍어준다.
### 궁극적 목표

로그로 찍는다는 것은?
-> 파일로 저장이 가능한 것이다. ( `FileAppender` )

일관된 컨텍스트만 유지한다는 가정하에
모든 메소드를 돌리고, 이를 기반으로 테스트 커버리지 처럼 구현이 가능해졌다.

warn(쿼리 카운트가 임계치를 넘는 메소드) 가 몇개인지, 특정 메소드가 쿼리문을 몇번 발생시키는지 예상이 가능하다.
gradle 명령어를 통해, 컨텍스트에 대해서 검사를 하고 이를 기반으로 결과를 나타낼수도
액션에 넣어서 CI가 될 수도 있을것이다.

---

자바에서 리플렉션과 어노테이션을 사용해서 불가능은 없다.(라고 생각)
단지, 가능한게 우리 프로젝트에 쓸모가 있거나, 적용하는데 드는 노력이 어느정도 인지에 따를 뿐.
팀원들간 합의가 가능하고, 노력이 가능하다면 유의미한 프로젝트에 도움이 되는 기능들을 추가해 나가자.

해당 내용은 [2024-corea](https://github.com/woowacourse-teams/2024-corea) 에 적용할 부분을 다루었습니다. ( 팀원과 협의 후 반영 예정 ) 많은 관심 부탁드립니다!


```