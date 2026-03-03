---
title: >-
  Removing Boilerplate Code for RabbitMQ in Spring (feat. Declares,
  RabbitListenerEndpointRegistrar)
tags:
  - Spring
  - RabbitMQ
  - Code Improvement
  - Boilerplate
description: >-
  An introduction to improving RabbitMQ boilerplate code in Spring using
  Declares and RabbitListenerEndpointRegistrar.
page_id: >-
  removing-boilerplate-code-for-rabbitmq-in-spring-feat-declares-rabbitlistenerendpointregistrar
permalink: >-
  /posts/removing-boilerplate-code-for-rabbitmq-in-spring-feat-declares-rabbitlistenerendpointregistrar/
author: Lee Youngsu
image:
  path: >-
    assets/img/thumbnail/2026-02-13-removing-boilerplate-code-for-rabbitmq-in-spring-feat-declares-rabbitlistenerendpointregistrar.png
date: '2026-02-13T13:31:31.469Z'
lang: en
---

Currently, I am interested in code improvement with Claude. I am trying to eliminate boilerplate code that occurs in numerous places. Among them, RabbitMQ configurations were quite repetitive. I found a way to solve this and have summarized it briefly.

### Why the change?

Honestly, boilerplate code is tricky to alter.
- 'Isn't it working just fine?'
- 'The code isn't complicated either?'

If these statements arise, you can't really change it. However, I believe it's right to improve it.

If something has been repeated 50 times and you need to modify all 50 at once, you might be anxious about missing something.
To address such concerns, we need to eliminate the repetitive code.

## Declares

Declares is a class provided by Spring AMQP.

### Why is it needed?

RabbitMQ requires an Exchange, Queue, and Binding.
To register a RabbitMQ Consumer through Spring AMQP, you need to register three Beans.

-> In other words, even if the configurations hardly change, a massive number of Beans and boilerplate code will be generated.

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

Even if the Exchange is used jointly, using 50 Queues results in 100 Beans and numerous duplicated codes.
Such a structure is hard to maintain. Declares helps solve this problem!!

### Declares

Available from Spring AMQP version 2.1.

```java
public interface QueueManager {

	/**  
	 * Queue name  
	 */  
	String getQueueName();  
  
	/**  
	 * Concurrency value to set for the consumer consuming the queue  
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

This allows multiple Queues and Bindings to be written in one Bean using stream code!
Therefore, you don't need to find and modify each code; adjusting the interface and Declarables logic ensures all elements are applied.

## RabbitListenerEndpointRegistrar

### Why is it needed?

```java
@RabbitListener(  
        id = "remove-background", queues = "#{rabbitmqProperties.getRemoveBackgroundQueueName()}", concurrency = "2"  
)  
public void listenRemoveBackground(MessageProperties properties, RemoveBackgroundTaskCommand command) throws EC2InstanceShuttingDownException {  
    log.info("remove-background request arrived: {}", command);  
    service.imageGenerate(properties, command);  
}
```

To receive RabbitMQ messages, you must use the `@RabbitListener` annotation.
And you must input parts like queues or concurrency as strings. (Spel is provided though)

Like the Queue and Binding, these methods must be created for each element.
Moreover, annotations for logging or MDC must be specified every time for each method.

### RabbitListenerEndpointRegistrar

This class and the above interface can be used to improve the code.

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

- RabbitListenerEndpointRegistrar: a class responsible for determining which method should detect which queue

Using `@RabbitListener`, Spring uses it internally.

- RabbitListenerContainerFactory: a class that handles the ListenerContainer, responsible for actually sending and receiving messages

You can set rules like Jackson settings, common Concurrency, Prefetch, etc.

- SimpleRabbitListenerEndpoint: a class defining the detailed info of listeners to be created dynamically

You can set the queue name, endpoint ID, individual concurrency of the listener, the method to be executed, etc.

Breaking down the code line by line:

```java
registrar.setContainerFactory(rabbitListenerContainerFactory);
```

Configure the `rabbitListenerContainerFactory`, responsible for Listener settings, and creation of the registrar.

```java
SimpleRabbitListenerEndpoint endpoint = new SimpleRabbitListenerEndpoint();  

endpoint.setId(manager.getQueueName());
endpoint.setQueueNames(manager.getQueueName());
endpoint.setConcurrency(manager.getConcurrency());
```

Create the endpoint and set the Id, queue name, and the number of concurrent processes.

> The id should be unique, but since the queue name is already unique, it is used as is.

```java
endpoint.setMessageListener(message -> processMessage(message, manager));

private void processMessage(Message message, ExternalQueueManager manager) {  
  
    TaskCommand taskCommand = objectMapper.readValue(message.getBody(), TaskCommand.class);
    service.imageGenerate(message.getMessageProperties(), taskCommand);
}
```

Make it process in the same way as existing logic.

```java
registrar.registerEndpoint(endpoint);
```

Register the endpoint to function the same as using `@RabbitListener`.

---

## Conclusion

Code quickly becomes a debt more than expected.
When something repeats once or twice, you don't think much about it, but once it accumulates five times, it quickly becomes 10, 20, and 30 times.

And such code can become troublesome to manage at some point.

- As part of refactoring
- Priority of other important issues
- Difficulty in ensuring code operation
- Fatigue of reviewers

When you are assigned an issue or writing code, it's better to improve the code immediately if it feels like it's the right time.

- [Reference Link](https://medium.com/@taesulee93/spring-for-rabbitmq-in-action-declarables-to-simplify-exchange-queue-binding-dlq-setup-a248744d6240)
