---
title: "코틀린 DSL 을 활용해 RestDocs 효율적으로 개선하기 ( ver 1.0 )"
author: 이영수
date: 2025-02-09T12:05:37.967Z
tags: ['RestDocs', 'dsl', '우테코', '코틀린']
categories: ['백엔드', '코틀린']
description: "Writing RestDocs with DSL"
permalink: /posts/improving-restdocs-efficiently-with-kotlin-dsl-ver-1.0/
image:
  path: https://velog.velcdn.com/images/dragonsu/post/052075af-38e9-49d1-bdeb-5b3b35ad3f99/image.png
permalink: /posts/improving-restdocs-efficiently-with-kotlin-dsl-ver-1-0/
---


> 해당 내용은 토스의 [# Kotlin으로 DSL 만들기: 반복적이고 지루한 REST Docs 벗어나기](https://toss.tech/article/kotlin-dsl-restdocs) 아티클에서 아이디어를 받아서 적용한 내용입니다.
  그리고, 기초적인 코틀린 문법에 대해서도 다룹니다.
  DSL 또는 코틀린에서 잘못된 지식이 있다면 댓글이나 `joyson5582@gmail.com` 로 남겨주세요.

## RestDocs 의 단점

기존 프로젝트에서는 SpringDoc 을 사용해 어노테이션 기반 문서화를 했었습니다.
아래 두가지와 같은 점 때문인데요

- 어노테이션 기반 간편 문서화 ( 어노테이션이 런타임에 적용되어도 당장 큰 문제가 없다고 판단 )
- 인터페이스를 통해 명세와 구현 의도적 분리 ( MemberControllerSpecification - MemberController )

하지만, 이번에는 RestDocs 만의 장/단점을 느끼고 싶어서 사용을 해봤습니다.

### 장점

느낀 장점으로는

- 테스트를 통해 문서화가 되므로, 테스트가 강제화 되어 코드 퀄리티가 올라간다 ( 물론, MockMVC 인지 RestAssured 인지 따라 달라질 거 같긴 하다. )
- Asciidoc(`adoc` ) 에 문서를 작성해서 관심사가 의도적으로 분리된다. ( 테스트 - 문서 )

하지만, 이런 장점과 함께 불편한 점들도 많이 느껴졌습니다.

### 요청 생성과 필드 문서화시 불필요한 중복

```kotlin
private fun createRequest(
    purchaseType: String = "CARD",
    currency: String = "KRW",
    amount: Int,
    paymentKey: String,
    orderId: String,
    lottoPublishId: Long
): Map<String, Any> {
    return mapOf(
        "purchaseHttpRequest" to mapOf(
            "purchaseType" to purchaseType,
            "currency" to currency,
            "amount" to amount,
            "paymentKey" to paymentKey,
            "orderId" to orderId
        ),
        "lottoPublishId" to lottoPublishId
    )
}
```

이와같이 RestAssured 에 넣을 요청을 만든다고 할 때?

`purchaseHttpRequest` 라는 객체에 `purchase`,`currency`,`amount` 와 같은 요소들이 들어갑니다.
그리고, 각 파라미터의 타입(String,Int) 를 통해 타입을 추론 가능합니다.

하지만, 필드 검증 및 문서화를 할 때는?

```kotlin
private fun commonRequestFields() = requestFields(
    fieldWithPath("purchaseHttpRequest").type(JsonFieldType.OBJECT).description("구매 요청 정보"),
    fieldWithPath("purchaseHttpRequest.purchaseType").type(JsonFieldType.STRING)
        .description("구매 유형 (CARD, CASH 등)"),
    fieldWithPath("purchaseHttpRequest.currency").type(JsonFieldType.STRING)
        .description("결제 통화 (KRW, USD 등)"),
    fieldWithPath("purchaseHttpRequest.amount").type(JsonFieldType.NUMBER).description("결제 금액"),
    fieldWithPath("purchaseHttpRequest.paymentKey").type(JsonFieldType.STRING)
        .description("결제 키 (결제 시스템에서 제공)"),
    fieldWithPath("purchaseHttpRequest.orderId").type(JsonFieldType.STRING)
        .description("주문 ID (결제 시스템에서 제공)"),
    fieldWithPath("lottoPublishId").type(JsonFieldType.NUMBER).description("퍼블리싱 한 로또 번호"),
)
```

- purchaseType,currency 와 같은 경우 앞에 `purchaseHttpRequest` Prefix 를 붙여야 함
- type 이 STRING 인지, NUMBER인지 일일히 알려줘야 한다.

### Header, Query Param  설정 시 번거로움

대부분의 로직은 Body 에서 끝나지만, 가끔 Parameter 나 Header 를 설정할 필요가 존재합니다.

```kotlin
RestAssuredRestDocumentation.document(
	requestHeaders(headerWithName("Authorization").description("Basic auth credentials"))
	queryParameters(parameterWithName("page").description("받는 페이지 번호"))
)
	```

특정 곳에서만 사용해서 이를 관리하는게 어려움이 존재합니다. ( request-headers 가 생성되게 할지, 안되게 할지 )

```kotlin
RestAssuredRestDocumentation.document(  
    "sample",  
    requestHeaders(headerWithName("Authorization").description("Basic auth credentials")),
    RequestDocumentation.queryParameters(  
        RequestDocumentation.parameterWithName(  
            "page"  
        ).description("받는 페이지 번호")  
    )
)
```

이 값들은 document 에 넣어줘야만 문서화가 됩니다.
( 그리고, 이 역시도 값과 필드 문서화에서 중복이 발생해 첫 번째 단점을 고스란히 가집니다. )

### Request, Response 동일한 구조이나 불필요한 분리

```kotlin
PayloadDocumentation.requestFields(  
    fieldWithPath("purchaseHttpRequest").type(JsonFieldType.OBJECT).description("구매 요청 정보")  
),  
PayloadDocumentation.responseFields(  
    fieldWithPath("purchaseHttpRequest").type(JsonFieldType.OBJECT).description("구매 요청 정보")  
),
```

이렇게 request 와 response 를 설정하는건 사실

```java
public static RequestFieldsSnippet requestFields(List<FieldDescriptor> descriptors) {
    return new RequestFieldsSnippet(descriptors);
}

public static ResponseFieldsSnippet responseFields(List<FieldDescriptor> descriptors) {
    return new ResponseFieldsSnippet(descriptors);
}
```

매개변수는 똑같은데 단순히, 반환하는 Snippet이 다를 뿐입니다.

이제, 이런 단점들을 코틀린 DSL 통해 어떻게 해결했는지 설명하겠습니다.

## 코틀린 문법

> 구현한 방법을 설명하기 전, 이에 사용한 코틀린 문법을 먼저 정리합니다.
( 이번 사이드 프로젝트에서 처음 코틀린을 사용하며 기본 문법이 많이 부족해서.. )

### infix

흔히, `prefix`,`postfix` 에서 사용하는 의미와 같습니다.
앞과 뒤에 표기를 해주듯이, `infix` 는 내부에 표기를 해주는 것입니다.

```kotlin
infix fun Int.add(other: Int): Int {
    return this + other
}

println(5 add 3) // 8
```

호출자인 점(.)과 파라미터 괄호(`()`) 를 생략하고 함수명 만으로 호출할 수 있게 해줍니다.

특정 클래스에서만 사용 가능하게 하고 싶으면?

```kotlin
class IntAdder {
    private val histories = mutableListOf<History>()

    fun add(left: Int, right: Int): Int {
        return left add right
    }

	infix fun Int.add(other: Int): Int {
        histories.add(History(this, other))
        return this + other
    }
}
```

이와같이 클래스 내부에 선언하면 됩니다. ( private 을 선언하지 않는 경우도 존재한다. )

### 확장 람다

```kotlin
class Person(val name: String)

fun introduce(block: Person.() -> Unit) {
    val person = Person("Alice")
    person.block()
}

fun main() {
    introduce {
        println("Hello, my name is $name")
        //"Hello, my name is Alice"
    }
}
```

처음에는, 이 부분이 되게 이해가 안가서 어려움을 느낀 부분입니다.
`block: Person.() -> Unit` 이 부분이 확장 람다입니다.

- introduce 함수가 실행될 떄 `val person = Person("Alice")` 을 생성한다.
- 그 후, `println("Hello, my name is $name")` 함수를 Person 클래스 내부에서 실행된다.
( `$name` 에서 `this.` 나 `person.` 와 같은게 생략되는 이유 )

이런 설명만 보면, 이걸 왜 쓰는데? 라고 생각할 수 있습니다.

아래 DSL 부분에서 설명할 내용을 잠시 보면

```kotlin
fun setRequest(
    endpoint: String,
    method: HttpMethod = HttpMethod.POST,
    block: DslContainer.() -> Unit)
{
	...
}

fun DslContainer.body(block: DslBuilder.() -> Unit) {
    body.apply(block)
}

.setRequest("/api/orders", HttpMethod.POST) {
    body {
		    "lottoPublishId" type DocsFieldType.NUMBER means "승인할 로또 발행의 고유 식별자"
		}
}
```

`.setRequest(...)` 해당 부분이 동작하는 원리는
DslContainer 클래스에서 -> body 확장함수 호출 -> DslBuilder 클래스에서 -> String.type 을 활용한다. ( 매우 어렵다... )

쉽게 생각해서 `{ ... }` 내부에서 `내가 원하는 클래스로 실행한다` 라고 생각하면 될 거 같습니다.

### Scope Function

객체의 초기화 및 설정을 간편하게 작성하게 도와주는 함수들입니다.

```kotlin
data class Person(var name: String, var age: Int)

val person = Person().apply {
	name = "Alice"
	age = 25
}
```

this 를 호출하지 않고, 간편하게 설정할 수 있다. 추가로, 다양하게 객체가 설정될 수 있게 도와줍니다.
( 당연히, 멤버변수들은 변할 수 있게 `var` 키워드 )
반환 값은 `apply` 호출 후, 수정한 객체를 반홥합니다.

### object,data object

```kotlin
object Logger {
    fun log(message: String) {
        println("LOG: $message")
    }
}

data object AppConfig {
    val version = "1.0.0"
    val apiUrl = "https://api.example.com"
}


fun main() {
    Logger.log("Hello!")
}
```


공통적으로, 싱글톤 패턴 ( 인스턴스 직접 생성 X, 프로그램 실행 시 한번 만 초기화 ) 입니다.
그냥 `object` 는 Util 성 함수를 만들고 싶을 떄, `data object` 는 상수를 저장하고 싶을때 사용하면 될 거 같습니다.
( `toString`, `equals`, `hashCode` 자동 생성 )

## DSL

해당 부분 부터는 토스의 아티클에서 차용해 나만의 버전으로 도입한 것입니다.

### ApiField

```kotlin
data class ApiField(
    val path: String,
    val docsFieldType: DocsFieldType,
    var value: Any,
    var description: String,
    var optional: Boolean,
    var children: List<ApiField> = emptyList()
)
```

- path : 객체 경로
- docsFieldType : 문서에 기록될 타입

```kotlin
sealed class DocsFieldType(val type: JsonFieldType) {
    open val format: String? = null

    data object NUMBER : DocsFieldType(JsonFieldType.NUMBER)
    data object STRING : DocsFieldType(JsonFieldType.STRING)
    data object BOOLEAN : DocsFieldType(JsonFieldType.BOOLEAN)
    data object OBJECT : DocsFieldType(JsonFieldType.OBJECT)
    data object DATE : DocsFieldType(JsonFieldType.STRING) {
        override val format = "yyyy-MM-dd"
    }
    data object DATETIME : DocsFieldType(JsonFieldType.STRING) {
        override val format = "yyyy-MM-dd HH:mm:ss"
    }

    data class ARRAY(val elementType: DocsFieldType) : DocsFieldType(JsonFieldType.ARRAY)

    data class ENUM<T : Enum<T>>(val enums: Collection<T>) : DocsFieldType(JsonFieldType.STRING) {
        companion object {
            inline fun <reified T : Enum<T>> of(): ENUM<T> {
                return ENUM(T::class.java.enumConstants.asList())
            }
        }
    }
}
```

`ARRAY` 와 `ENUM` 은 값을 내부에 가지고 있게 해 동적으로 사용이 가능하게 합니다.
( 배열 내부의 요소 or ENUM 요소들의 값 )

- value : 실제 요청에 들어갈 값
- optional : 필수인지
- description : 문서에 기록될 설명
- children : 객체일시, 가질 하위 요소

### DslBuilder

```kotlin
class DslBuilder {
    internal val fields = mutableListOf<ApiField>()

    infix fun String.type(docsFieldType: DocsFieldType): ApiField {
        val field = ApiField(
            name = this, docsFieldType = docsFieldType,
            value = "",
            description = "",
            optional =false,
        )
        fields.add(field)
        return field
    }
}
```

DslBuilder 내부에서 inline 함수를 만듭니다.
호출하면, ApiField 를 생성해주고, Builder 내부에 추가를 합니다.

이렇게 한 이유는 쉼표 또는 직접 호출하지 않고 인라인 함수를 호출해 생성하면서도, Builder 가 값을 가지고 있게 하기 위함입니다.

```kotlin
infix fun ApiField.means(description: String): ApiField {
    this.description = description
    return this
}

infix fun ApiField.value(value: Any): ApiField {
    this.value = value
    return this
}

infix fun ApiField.optional(flag: Boolean): ApiField {
    this.optional = flag
    return this
}

infix fun ApiField.withChildren(block: DslBuilder.() -> Unit): ApiField {
    val childBuilder = DslBuilder()
    childBuilder.block()
    this.children = childBuilder.fields
    return this
}
```

그 후, ApiField infix 를 통해서 각각의 값들을 넣어줍니다.

```kotlin
"purchaseHttpRequest" type DocsFieldType.OBJECT means "결제 승인 HTTP 객체" withChildren {
    "purchaseType" type DocsFieldType.ENUM.of<PurchaseType>() means "구매 유형" value purchaseType
    "amount" type DocsFieldType.NUMBER means "취소할 결제 금액" value amount
    "paymentKey" type DocsFieldType.STRING means "취소할 결제 식별자 - 결제 시스템 제공" value paymentKey
}
```

DEPTH 가 있으면, `withChildren` 을 통해 내부 값을 설정할 수 있게 했습니다.

### DslContainer

```kotlin
class DslContainer {
    val headers = DslBuilder()
    val body = DslBuilder()
    val queryParams = DslBuilder()
	...

	fun DslContainer.headers(block: DslBuilder.() -> Unit) {
	    headers.apply(block)
	}

	fun DslContainer.body(block: DslBuilder.() -> Unit) {
	    body.apply(block)
	}

	fun DslContainer.params(block: DslBuilder.() -> Unit) {
	    queryParams.apply(block)
	}
}
```

그 후, 이와 같이 headers,body,queryParam 를 전부 가지는 Container 를 만듭니다.

```kotlin
body {
    ...
}
headers {
	...
}
params {
	...
}
```

`body`,`headers`,`param` 중 필요한 부분들 설정을 할 수 있습니다.

```kotlin
fun convertBody() = body.toValue()
fun convertBodyDescriptors() = body.toFieldDescriptors()
```

와 같이 요청에 넣을 값과 필드 설명으로 변환할 수 있습니다.

```kotlin
fun List<ApiField>.toConvertValue():Map<String,Any>{
    fun processField(field: ApiField): Any {
        return if (field.children.isNotEmpty()) {
            field.children.associate { it.name to processField(it) }
        } else {
            field.value
        }
    }
    return this.associate { it.name to processField(it) }
}
```

```kotlin
fun List<ApiField>.toFieldDescriptors(): List<FieldDescriptor> {
    val descriptors = mutableListOf<FieldDescriptor>()

    fun processField(field: ApiField, parentPath: String = "") {
        val fullPath = if (parentPath.isEmpty()) field.name else "$parentPath.${field.name}"

        fun getArrayPath(type: DocsFieldType, path: String): String {
            return when (type) {
                is DocsFieldType.ARRAY -> getArrayPath(type.elementType, "$path[]")
                else -> path
            }
        }

        val formattedPath = getArrayPath(field.docsFieldType, fullPath)

        val descriptor = fieldWithPath(formattedPath)
            .type(field.docsFieldType.type)
            .description(
                field.description + if (field.docsFieldType is DocsFieldType.ARRAY) {
                    " (요소 타입: ${getArrayTypeString(field.docsFieldType.elementType)})"
                } else "" + (field.docsFieldType.format?.let { " (형식: $it)" } ?: "")
            )
            .attributes(
                Attributes.Attribute("optional", field.optional.toString().uppercase())
            )

        descriptors.add(descriptor)
        field.children.forEach { processField(it, formattedPath) }
    }

    this.forEach { processField(it) }
    return descriptors
}
```

특이점으로 재귀함수의 형식입니다. 아래와 같은 점들이 가능해집니다.

하위 요소가 있는 `OBJECT` 이면, path 를 더해서 계속 설정 ( purchaseRequest -> currencyRequest -> id )
하위 요소가 있는 `ARRAY` 이면, 하위 타입을 가져와서 설명

=> 이를 통해, 의도한대로 값을 설정 및 문서를 만들 수 있습니다.

### DocsDsl
대망의 DSL 입니다.
( 요청을 실행하기 까지 하니 DSL 에 더 가깝힌 하나, 우선 명확한 이름으로 했습니다. )

```kotlin
class DocsApiBuilder(private val documentName: String) {

    private var endpoint: String = ""
    private var requestContainer: DslContainer = DslContainer()
    private var method: HttpMethod = HttpMethod.POST
    private var responseContainer: DslContainer = DslContainer()
```

```kotlin
fun setRequest(
    endpoint: String,
    method: HttpMethod = HttpMethod.POST,
    block: DslContainer.() -> Unit
): DocsApiBuilder {
    this.endpoint = endpoint
    this.method = method
    this.requestContainer = DslContainer().apply(block)
    return this
}
```

요청을 설정합니다.

![](https://i.imgur.com/ssHNeqU.png)

근본적인 `Http Request Message` 라면
- `Requeset Line ( HTTP METHOD, URL )`
- `Request Header`
- `Request Body`
형식이나, 당장 제가 사용할때는 `setRequest` 에 모든걸 다 넣는게 편해서 이와같이 구현했습니다.

```kotlin
fun execute(log: Boolean = false): DocsApiValidator {
    if (log) {
        printLog()
    }
    try {
        var requestSpec: RequestSpecification = RestAssured.given().log().all()
            .contentType(ContentType.JSON)
            .filter(
                RestAssuredRestDocumentation.document(
                    documentName,
                    HeaderDocumentation.requestHeaders(requestContainer.convertHeadersDescriptors()),
                    PayloadDocumentation.requestFields(requestContainer.convertBodyDescriptors()),
                )
            )
            .headers(requestContainer.convertHeaders())
            .queryParams(requestContainer.convertQueryParams())
            .body(requestContainer.convertBody())
        val response = requestSpec
            .filter(
                RestAssuredRestDocumentation.document(
                    documentName,
                    HeaderDocumentation.responseHeaders(responseContainer.convertHeadersDescriptors()),
                    SUCCESS_SNIPPET.andWithPrefix("data.", responseContainer.convertBodyDescriptors())
                )
            )
            .request(method.toMethod(), endpoint)
            .then()
            .extract()
        return DocsApiValidator(response)
    } catch (e: Exception) {
        throw IllegalStateException("API 문서화 중 오류가 발생했습니다: ${e.message}", e)
    }
}
```

Header,Param,Body 에 값 주입 및 문서화를 합니다.

```kotlin
private fun printLog() {
    println("=== DocsApiBuilder ===")
    println("Document: $documentName")
    println("Endpoint: $endpoint")
    println("Request:")
    requestContainer.printRequestInfo()
    println("Response:")
    responseContainer.printRequestInfo()
}
```

```kotlin
Request: =================================
Headers:
Body:
  - 경로(lottoPublishId) 타입(NUMBER): 설명(주문한 영수증 ID) 값(1)
  - 경로(purchaseHttpRequest) 타입(OBJECT): 설명(결제 승인 HTTP 객체)
    - 경로(purchaseType) 타입(ENUM): 설명(구매 유형) 값(CARD)
    - 경로(currency) 타입(ENUM): 설명(결제할 통화 유형) 값(KRW)
    - 경로(amount) 타입(NUMBER): 설명(취소할 결제 금액) 값(1000)
    - 경로(orderId) 타입(STRING): 설명(취소할 주문 번호) 값(order-id-1)
    - 경로(paymentKey) 타입(STRING): 설명(취소할 결제 식별자 - 결제 시스템 제공) 값(paymentKey-id-1)
QueryParams:
Response: =================================
Headers:
Body:
  - 경로(purchaseResponse) 타입(OBJECT): 설명(응답 데이터)
    - 경로(id) 타입(STRING): 설명(취소된 결제의 고유 식별자)
    - 경로(amount) 타입(NUMBER): 설명(취소된 결제 금액)
```

( 상태를 편하게 확인하기 위한 로그성 메소드도 있습니다.🙂 )

## 결론

```kotlin
DocsApiBuilder("purchase-ticket-success")
    .setRequest("/api/tickets", HttpMethod.POST) {
        body {
            "lottoPublishId" type NUMBER means "주문한 영수증 ID" value 1
            "purchaseHttpRequest" type OBJECT means "결제 승인 HTTP 객체" withChildren {
                "purchaseType" type ENUM.of<PurchaseType>() means "구매 유형" value PurchaseType.CARD
                "currency" type ENUM.of<Currency>() means "결제할 통화 유형" value Currency.KRW
                "amount" type NUMBER means "취소할 결제 금액" value 1000
                "orderId" type STRING means "취소할 주문 번호" value "order-id-1"
                "paymentKey" type STRING means "취소할 결제 식별자" value "paymentKey-id-1"
            }
        }
        headers {
            "Payment-Error-Header" type STRING means "토스 임의 에러 코드" value "EXCEED_MAX_ONE_DAY_AMOUNT" optional true
        }
    }.setResponse {
        body {
            "purchaseResponse" type OBJECT means "응답 데이터" withChildren {
                "id" type STRING means "취소된 결제의 고유 식별자"
                "amount" type NUMBER means "취소된 결제 금액"
            }
        }
    }.execute(true)
    .statusCode(200)
```

기존의 분리된 `요청 명세 작성` 과 `요청 값 주입` 이 합쳐지고
JSON 형식과 유사하게 작성할 수 있습니다.
( 다른 개발자들이 봐도, 명확하게 문서화가 되어 있기도 하고요🙂 )

그리고, 다른 장점은

```kotlin
import config.AcceptanceTest
import docs.DocsApiBuilder
import docs.HttpMethod
import docs.field.DocsFieldType.*
import docs.request.DslContainer
```

문서 관련 의존성이 응집되어 `Spring RestDocs` 에 관련된 의존성이 발생하지 않습니다.

### Ver 2.0?

현재는, 로또를 구현하며 재밌는 요소를 발견해서 DSL 을 만들었습니다.
그래서, 급하거나 다소 아쉬운 부분이 있는데 일단락을 했습니다.


```kotlin
"lottoPublishId" type NUMBER means "주문한 영수증 ID" value 1
```

처음에 불만을 가진 요소인데 해결하지 못했습니다.

코틀린에 대해 잘 모르지만, `type NUMBER` 와 `value 1` 은 결국 같은 요소라고 생각합니다.
type 을 날리고, value 만 넣는다면 더 간단하게 문서화와 요청 생성이 가능할 거 같습니다.

런타임에 타입을 추론해, 특정 타입 -> DocsFieldType 으로 변환

```adoc
=== 멤버 조회 실패  
  
==== 없는 토큰  
부적절한 토큰을 담아 보내면 실패한다.  
  
include::{snippets}/info-fail-not-valid-token/index.adoc[]
```

RestDocs 는 `index.adoc` 문서를 직접 생성해야 합니다.
이때, `문서와 코드의 분리`라는 장점도 있지만 `관리의 어려움`과 `번거로움` 이 너무 크게 다가왔습니다.

```kotlin
tasks.register("generateSnippetIndexes") {
    val snippetsDir = file("build/generated-snippets")
    snippetsDir.listFiles { file -> file.isDirectory }?.forEach { snippetFolder ->
        val includeFiles = listOf(
            "http-request.adoc",
            "http-response.adoc",
            "request-fields.adoc",
            "response-fields.adoc"
        )
        val includesContent = includeFiles
            .filter { File(snippetFolder, it).exists() }
            .joinToString("\n") { "include::${it}[]" }
        val indexFile = File(snippetFolder, "index.adoc")
        indexFile.writeText(includesContent)
        println("Generated index.adoc in ${snippetFolder.name}:")
        println(includesContent)
    }
}
```

( 자동으로 묶어주는 task 는 추가했지만, 핵심 불편 해소는 아니였습니다. )

Custom Annotaiton 을 기반으로

- `@Title` 은 문서의 제목`(Depth2)`
- `@SubTitle` 은 문서의 중제목`(Depth3)` 
- `@Detail` 은 문서의 소제목(`Depth4`)
- `@Content(...)` 는 문서 본문

과 같은 식으로 동적 생성도 가능할 거 같습니다.
하지만, 테스트에 문서가 깊게 침범되는거 같아서 장단점을 조금 더 고려해봐야 할 거 같습니다.

위 내용을 작업한 [PR](https://github.com/youngsu5582/lotto/pull/16) 이며, [저장소](https://github.com/youngsu5582/lotto) 입니다.

```