---
title: "Don't Leave Room for Mistakes"
author: 이영수
date: 2024-04-13T09:25:00.526Z
description: Basic rules for preventing mistakes
categories: ['Programming', 'Clean Code']
image:
  path: https://velog.velcdn.com/images/dragonsu/post/95758d6d-64c6-40d8-8438-3014732b5216/image.jpeg
lang: en
permalink: /posts/dont-leave-room-for-mistakes/
---

> This post has been translated from Korean to English by Gemini CLI.

https://devs0n.tistory.com/128

This is a post written while reorganizing the above article and rethinking the programming requirements of Wooteco.

![350](https://i.imgur.com/6btHni6.png)
- Wooteco's Programming Requirements

---

>**You have reached the stage of creating a coding standard where code that smells bad automatically reveals itself and asks to be fixed.**
>- Joel Spolsky (More Joel on Software)

This is a great quote from the article.
### Using Braces in if Statements

One of the mandatory requirements to follow in Wooteco.
- When I was first doing the pre-course, I thought, why do I need unnecessary braces for a single-line if statement?
- Can't it provide more advantages in terms of code and readability?
```java
if(flag)
	doFlagTrue()
...
```
I thought.
But what if a line of code needs to be added?
=> Can't I just add braces then??

That's not wrong.
However, adding braces from the beginning and adding them when needed are quite different.
What if someone makes the mistake of not creating braces?
Who would make such a mistake?
![350](https://i.imgur.com/GS6TpAc.png)

[Apple’s gotofail SSL Security Bug was Easily Preventable](https://embeddedgurus.com/barr-code/2014/03/apples-gotofail-ssl-security-bug-was-easily-preventable/)
Someone at Apple did it too ㅇ.ㅇ

>Braces shall always surround the blocks of code (a.k.a., compound statements), following if, else, switch, while, do, and for statements; single statements and empty statements following these keywords shall also always be surrounded by braces.
>- [Barr Group](http://www.barrgroup.com/ "The Embedded Systems Experts")‘s Embedded C Coding Standard book.

Simply put, it means that `if,else,switch,while,do` statements should always be surrounded by braces.


### Not Using else

If the current situation is clear, is there a need to separate it without using if-else?
-> That's not wrong.

Are there any other cases besides "checkmate in chess <-> not checkmate"?
-> Factos 👀

But what if the code needs to be changed?

- Since else covers all cases that are not caught by the conditional statement,
  the existing conditional statement cannot catch new changes, which can cause errors in the business logic.

  EX) If the payment amount is 15000 or more, give the VIP grade, otherwise give the NORMAL grade.
  
```java
if(calculateMoney >= 15000){
	return VIP;
}
else{
	return NORMAL;
}
```

What if a new grade called SPECIAL is added for amounts of 10000 or more?

```java
if(calculateMoney >= 10000) {
	if(calculateMoney >= 15000){
		return VIP;
	}else{
		return SPECIAL;
	}
} else {
	return NORMAL;
}
```

1. When you forget to implement the logic, it flows in an unintended direction.
2. This is an exaggerated code, but it can cause more inconvenience to maintain the else statement.

```java
if(calculateMoney >= 15000){
	return VIP;
}
if(calculateMoney >= 10000){
	return SPECIAL;
}
if(calculateMoney >= 0){
	return NORMAL;
}
throw UnsupportedException("The corresponding payment amount cannot receive a grade.");
```
In this way, you can show the code more readably through Early Return.

Why do you verify it one more time at the end and pass it on?
```java
if(calculateMoney >= 15000){
	return VIP;
}
if(calculateMoney >= 10000){
	return SPECIAL;
}
return NORMAL;
```
This is because it is virtually the same as using else (since the last one is not verified).
(However, I wrote all the code in the same way as below. - If you are not using Enum or if the code is not sensitive to changes, is it necessary to process all the logic + throw statement?)

### Using Enum

This goes a little deeper than the above.
Hyangro, the current CTO of Inflearn, has already written a detailed article on how to use Enum.
[How to Use Java Enum](https://techblog.woowahan.com/2527/)
I will explain it in a more basic way and to prevent mistakes.

I think Enum is ultimately a category.
Is there a need to separate grades like SPECIAL and NORMAL differently above?
Wouldn't `CustomerRate.SPECIAL` and `CustomerRate.NORMAL` be more natural?

What if we use the above code with Enum?
```java
public static CustomerRate findRate(final int amount) {  
    for (CustomerRate customerRate : CustomerRate.values()) {  
        if (amount >= customerRate.amount) {  
            return customerRate;  
        }  
    }  
    throw new UnsupportedOperationException("");  
}
```

In this way, you don't have to repeat unnecessary if statements in the business logic layer, and you can execute the logic in the order defined in the Enum.

```java
return switch(customerRate){
	case VIP: ...;
	case SPECIAL: ...;
	case NORMAL: ...;
}
```
If a grade is added in this part, the compile error will catch it.

But here's a question that comes to mind.
```java
VIP(15000,(purchaseMoney) -> purchaseMoney * 0.07),
public double getBonus(final int amount) {  
    return this.calculateBonusFunction.apply(amount);  
}
```
What about putting a functional type in the Enum like this? You might think.

I thought it was very good too.
But the coach's opinion was that if you are not going to put functional types in all Enums and all logic, you should just have constants and execute the logic from the outside.
(Unify conventions)

```java
double bonusMoney = customerRate.getBonus(5000);
===
double bonusMoney = customerRate.bonusRate * purchaseMoney; 
```
=> This part seems to be a trade-off.
(It's OK for Enum to have mathematical calculations - because it's a clear logic that Enum should do)

### Not Using the Ternary Operator

To be honest, I still don't know exactly why I shouldn't use it.
Of course, I think nested places should be avoided, but wouldn't it be okay to use simple code like `if xx ? true : false`?

I think the ternary operator is in a similar context to adding parentheses to if statements and not using else.
-> Because there are more parts where you can make mistakes or get nested.

As a proponent,
[You who don't know the coolness of the ternary operator are pitiful](https://tpgns.github.io/2018/04/24/nested-ternaries-are-great/#%EB%B6%80%EC%88%98%ED%9A%A8%EA%B3%BC-%EB%B0%8F-%EB%B0%94%EB%80%94-%EC%88%98-%EC%9E%88%EB%8A%94-%EA%B3%B5%EC%9C%A0%EB%B3%80%EC%88%98)
There was this article.
(Although it's from a JavaScript perspective, the context is the same)

- There is no difference in performance - when changing, both if statements and ternary operators are changed in the same way.
- if statements cause unnecessary side effects and leave room for changing variables.

Just as I became conscious of final while using functional programming (in Java, only final values can be accessed inside a stream)
-> You can prevent the side-effect of changing the value of a variable by using the ternary operator.

=> In the end, it seems that you can choose according to the convention.

### Conclusion

If you think about it simply, you might think, can't I just not use parentheses in if statements? Can't I use else statements? etc.

However, I think it's important to reduce other people's mistakes when collaborating, not on a personal project.
Let's not say, "Of course, I use it this way," but let's match our conventions with each other.

In addition, let's think from the perspective of dynamic code, not static code.
When we think about the case where the business logic changes -> the code is changed & added,
let's write code that can reduce or prevent mistakes!

As I said at the beginning,
`You have reached the stage of creating a coding standard where code that smells bad automatically reveals itself and asks to be fixed.`
Let's write code with this in mind!
