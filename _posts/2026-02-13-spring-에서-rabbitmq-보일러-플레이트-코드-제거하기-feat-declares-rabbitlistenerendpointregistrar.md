---
title: >-
  Spring 에서 RabbitMQ 보일러 플레이트 코드 제거하기 (feat.Declares,
  RabbitListenerEndpointRegistrar)
tags:
  - 스프링
  - RabbitMQ
  - 코드 개선
  - 보일러 플레이트
description: >-
  Spring에서 RabbitMQ의 보일러 플레이트 코드를 Declares와 RabbitListenerEndpointRegistrar를 통해
  개선하는 방법을 소개합니다.
page_id: >-
  spring-에서-rabbitmq-보일러-플레이트-코드-제거하기-feat-declares-rabbitlistenerendpointregistrar
permalink: >-
  /posts/spring-에서-rabbitmq-보일러-플레이트-코드-제거하기-feat-declares-rabbitlistenerendpointregistrar/
author: 이영수
date: 2026-02-13T13:31:31.469Z
---
현재, Claude 와 함께 코드 개선에 관심을 가지고 있다.
현재, 수많은 곳에서 발생한 보일러 플레이트를 제거하는걸 시도하고 있다.
그 중, RabbitMQ 설정이 상당히 많이 반복되어 쌓여있어서 방법을 찾아내서 간단히 정리한다.

## Declares

Declares 는 Spring AMQP 가 제공해주는 클래스이다.

### 왜 필요한가?

RabbitMQ 는 Exchange, Queue, Binding 이 필요하다.
그리고, Spring AMQP 를 통해 RabbitMQ Consumer 를 등록하려면 세가지 Bean 을 등록해야만 한다.

-> 즉, 설정이 거의 달라지지 않는다고 해도 어마어마한 Bean 개수와 보일러 플레이트 코드가 생긴다.

```java
@Bean  
Queue TextToVideoQueue() {  
    return new Queue(getQueueName(), true, false, false, arguments);  
}  
  
@Bean  
Binding bindingTextToVideoQueue(TopicExchange exchange) {  
    return BindingBuilder  
            .bind(textToVideoQueue())  
            .to(exchange)  
            .with(getQueueName());  
}

public String getTextToVideoQueueName() {  
    return TEXT_TO_VIDEO_QUEUE_NAME;
}
```

Exchange 는 공동으로 사용한다고 해도, 50개의 Queue 를 사용하려면 100개의 Bean 과 수많은 중복 코드가 발생한다.

> 실제로, 지금 우리 코드가 이러고 있다..

이와 같은 구조는 유지보수가 어렵다. 이를 해결해주는게 Declares 이다!!

### Declares

Spring AMQP 2.1 버전 이후에 사용 가능하다.

```java
public interface QueueManager {

	/**  
	 * 큐 이름  
	 */  
	String getQueueName();  
  
	/**  
	 * 해당 큐를 소비하는 컨슈머에 설정할 concurrency 값  
	 *  
	 * @see RabbitListener#concurrency()  
	 */
	String getConcurrency();
	
	...
}
```

```java
@Bean  
public Declarables externalQueueDeclarables(List<QueueManager> managers, TopicExchange exchange) {  
    List<Declarable> declarables = managers.stream()  
            .flatMap(manager -> {  
                Queue queue = new Queue(manager.getQueueName(), true, false, false, arguments);  
                Binding binding = BindingBuilder.bind(queue).to(exchange).with(manager.getQueueName());  
                return Stream.<Declarable>of(queue, binding);  
            })  
            .toList();  
  
    return new Declarables(declarables);  
}
```

와 같이 여러개의 Queue 와 Binding 들을 하나의 Bean 과 stream 코드로 작성할 수 있다!

## RabbitListenerEndpointRegistrar

### 왜 필요한가?

```java
@RabbitListener(  
        id = "remove-background", queues = "#{rabbitmqProperties.getRemoveBackgroundQueueName()}", concurrency = "2"  
)  
public void listenRemoveBackground(MessageProperties properties, RemoveBackgroundTaskCommand command) throws EC2InstanceShuttingDownException {  
    log.info("remove-background 요청 도착: {}", command);  
    service.imageGenerate(properties, command);  
}
```

RabbitMQ 의 메시지를 받기 위해선 `@RabbitListener` 어노테이션을 사용해야 한다.
그리고, queues 나 concurrency 같은 부분을 문자열로 넣어야만 한다. (Spel 을 제공해주긴 함)

위 Queue, Binding 과 동일하게 매 요소마다 해당 메소드들이 생성 되어야 한다.
그리고, 각 메소드마다 로깅이나 MDC 등을 위해 어노테이션도 매번 일일히 지정해야 한다.

### RabbitListenerEndpointRegistrar

해당 클래스와 위 인터페이스를 사용해서 코드를 개선할 수 있다.

```java
@Override  
public void configureRabbitListeners(RabbitListenerEndpointRegistrar registrar) {  
    registrar.setContainerFactory(rabbitListenerContainerFactory);  
    for (var manager : queueManagerList) {  
    
        SimpleRabbitListenerEndpoint endpoint = new SimpleRabbitListenerEndpoint();  
        endpoint.setId(manager.getQueueName());  
  
        endpoint.setQueueNames(manager.getQueueName());  
        endpoint.setConcurrency(manager.getConcurrency());  
  
        endpoint.setMessageListener(message -> processMessage(message, manager));  
  
        registrar.registerEndpoint(endpoint);  
    }  
}
```

- RabbitListenerEndpointRegistrar : 어떤 큐를 어떤 메소드가 감지하게 할 지 담당하는 클래스

`@RabbitListener` 를 사용하면, Spring 이 내부적으로 사용한다.

- RabbitListenerContainerFactory : 실제 메세지를 주고받는 ListenerContainer 를 담당하는 클래스

Jackson 설정, 공통 Concurrency, Prefetch 등 규칙들을 설정할 수 있다.

- SimpleRabbitListenerEndpoint : 동적으로 생성될 Listener 의 상세 정보를 정의하는 클래스

큐 이름, 엔드포인트 ID, 해당 리스너의 개별 동시성, 실행할 메소드등을 설정할 수 있다.

코드를 한줄씩 풀어보면


```java
registrar.setContainerFactory(rabbitListenerContainerFactory);
```

registrar 의 Listener 설정 및 생성을 담당하는 `rabbitListenerContainerFactory` 설정

```java
SimpleRabbitListenerEndpoint endpoint = new SimpleRabbitListenerEndpoint();  

endpoint.setId(manager.getQueueName());
endpoint.setQueueNames(manager.getQueueName());
endpoint.setConcurrency(manager.getConcurrency());
```

엔드포인트를 생성하고, Id & 큐 이름 & 동시 처리할 개수를 설정한다.

> id 는 동일하지 않은 값을 해야하는데, 큐 이름은 어차피 유니크한 값이니 그대로 사용

```java
endpoint.setMessageListener(message -> processMessage(message, manager));

private void processMessage(Message message, ExternalQueueManager manager) {  
  
    TaskCommand taskCommand = objectMapper.readValue(message.getBody(), TaskCommand.class);
    service.imageGenerate(message.getMessageProperties(), taskCommand);
}
```

기존 로직과 동일하게 처리하게 한다.

```java
registrar.registerEndpoint(endpoint);
```

엔드포인트를 등록해서 `@RabbitListener` 와 동일하게 동작하게 한다.

---

## 마무리


코드는 생각보다 빨리 부채가 된다.
한 번, 두 번 정도 반복 될때는 아무 생각이 없겠지만 다섯 번 정도 쌓이면, 그게 10, 20, 30번이 되는건 금방이다.

그리고, 이런 코드는 어느순간 처리하기 까다로울 수도 있다.

- 리팩토링의 일환
- 다른 중요 이슈의 우선순위
- 코드 동작 보장의 어려움
- 리뷰어의 피로

자기가 맡거나 확장해나갈 때, 때가 된거 같으면 바로 코드를 개선하는게 좋은거 같다.

- [참고 링크](https://medium.com/@taesulee93/spring-for-rabbitmq-in-action-declarables%EC%9D%84-%ED%99%9C%EC%9A%A9%ED%95%9C-exchange-queue-binding-dlq-%EA%B0%84%ED%8E%B8-%EC%84%A4%EC%A0%95-a248744d6240)
