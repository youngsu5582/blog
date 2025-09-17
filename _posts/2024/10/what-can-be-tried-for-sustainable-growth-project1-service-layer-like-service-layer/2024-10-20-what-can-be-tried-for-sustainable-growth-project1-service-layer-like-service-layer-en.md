---
title: "What Can Be Tried for a Sustainably Growing Project (1) - Making the Service Layer Service-like"
author: 이영수
date: 2024-10-20T15:47:58.282Z
tags: ['Implementation Layer', 'Refactoring', 'Wooteco', 'Clean Code']
categories: ['Programming', 'Clean Code']
description: "If your service layer exceeds 100 lines and has more than 10 private methods"
image:
  path: https://velog.velcdn.com/images/dragonsu/post/c287c4ed-5ecf-456d-8826-4483b22268fe/image.png
lang: en
permalink: /posts/what-can-be-tried-for-sustainable-growth-project1-service-layer-like-service-layer
---

> This post has been translated from Korean to English by Gemini CLI.

This content covers:
(Current) Toss developer Gemini's

[How to create sustainably growing software - Article](https://geminikims.medium.com/%EC%A7%80%EC%86%8D-%EC%84%B1%EC%9E%A5-%EA%B0%80%EB%8A%A5%ED%95%9C-%EC%86%8C%ED%94%84%ED%8A%B8%EC%9B%A8%EC%96%B4%EB%A5%BC-%EB%A7%8C%EB%93%A4%EC%96%B4%EA%B0%80%EB%8A%94-%EB%B0%A9%EB%B2%95-97844c5dab63)
[How to create sustainably growing software - Video Article](https://www.youtube.com/watch?v=pimYIfXCUe8)

It covers my thoughts after reading the content and applying it to the project + my thoughts after refactoring the code.
(If you have any incorrect content or questions, please leave a comment or contact me at `joyson5582@gmail.com`!)
## Why does code get dirty?

In fact, it's a very natural progression for code to get dirty.
This is because our project needs to refine & add features to reflect user requirements (or acceptable designs).

![600](https://i.imgur.com/lbZTEqn.png)

Even `RoomService`, which performs the most important logic (matching code reviews) in our project,
hhad 8 modifications from the 13th to the 19th.

![600](https://i.imgur.com/HzDEz9Y.png)

As features are added, code accumulates steadily, whether large or small.

And, such code occupies service space, no matter how cleanly it is written in units.
(Just like the `stream` statement above seems to have no elements to cause problems.)

## What's wrong with the existing MVC?

Commonly, the most famous design pattern known to web developers is probably the MVC pattern.
- Controller: Handles user requests and connects `Model` - `View`.
- View: Responsible for the user's UI.
- Model: Responsible for the application's core data & business logic.

Most web server frameworks, such as Spring in Java, Nest.js in JavaScript, and Django in Python, adopt this.

In such an MVC pattern, the service layer is virtually inevitable.
It creates one more intermediate layer between the Controller and Model to perform business logic, thereby allowing business logic to be reused.

Additionally, through `TO (Transfer Object)`,
- Consistent & easy web requests
- Reusable responses that users want from the domain
Web frameworks are generally built.

Then, why does code continue to get dirty even with design patterns and formalized layers?

### The service layer has too much to do.

This service often has too many roles.
(In fact, if the service layer can be perfectly established and reused, it would be the best.)

```java
@Transactional
public RoomResponse update(long memberId, RoomUpdateRequest request) {
	Room room = getRoom(request.roomId());
	
	Member member = memberRepository.findById(memberId)
			.orElseThrow(() -> new CoreaException(ExceptionType.MEMBER_NOT_FOUND));
	
	if (room.isNotMatchingManager(memberId)) {
		throw new CoreaException(ExceptionType.MEMBER_IS_NOT_MANAGER);
	}

	if (room.isNotOpened()) {  
	    throw new CoreaException(ExceptionType.ROOM_STATUS_INVALID);  
	}

	Room updatedRoom = roomRepository.save(request.toEntity(room,member));
	Participation participation = participationRepository.findByRoomIdAndMemberId(updatedRoom.getId(), memberId)
			.orElseThrow(() -> new CoreaException(ExceptionType.NOT_ALREADY_APPLY));


	automaticMatchingRepository.save(new AutomaticMatching(room.getId(), request.recruitmentDeadline()));
	automaticMatchingService.matchOnRecruitmentDeadline(response);
	
	automaticUpdateRepository.save(new AutomaticUpdate(room.getId(), request.reviewDeadline()));
	automaticUpdateService.updateAtReviewDeadline(response);
	
	
	log.info("Room updated. Room id={}, user id={}", room.getId(), member.getId());
	
	return RoomResponse.of(updatedRoom, participation.getMemberRole(), ParticipationStatus.MANAGER);
}
```

Let's look at an example with the logic to modify a room.

1. Query by roomId and memberId.
2. Check if the room is open.
3. Check if it's the correct room manager.
4. Modify the room through DTO.
5. Find the role participated by the Manager.
7. Modify the matching & end time registered in the scheduler.
8. Write a log that the room has been modified.
9. Convert to a response using the above values.

Listing them one by one, it's quite reasonable and clear.
In this way, the service layer continues to grow fat.

### Ambiguous Service Names

There are often cases where domain and service names are matched 1:1.
(Or, 1:1 matching with the controller `RoomController - RoomService`)

It's not bad when you first create a new domain.
Because it's a service that handles the room's business logic, and there are only a few functions, it will seem reasonable.

However, as features increase, the service code becomes fat.

> Since it's RoomService..?
> - It should have functions to create / modify / delete rooms 🙂
> - It should also add functions to query based on room status (open / in progress / closed) 🥲🥲
> - I want to show participants in the room, is that a RoomService function...?
> - I want to see the rooms a user has participated in, is that also RoomService? 😢😢

The reason this happened is probably due to the desire to group all similar paths together, as with `@RequestMapping("/rooms")`.

![500](https://i.imgur.com/zuea6pI.png)

It results in imports from various domains and long lines of code (`175 lines`).
Such files will be difficult for anyone who needs to use the code. 😢

Then, let's refactor this slowly.

## Specifying Business Logic through Reader, Writer

Let's re-examine the logic for modifying a room.

1. Query by roomId and memberId.
2. Check if the room is open.
3. Check if it's the correct room manager.
4. Modify the room through DTO.
5. Write a log that the room has been modified.
6. Find the role participated by the Manager.
7. Modify the matching & end time registered in the scheduler.
8. Convert to a response using the above values.

However, if it's the room modification logic we expect,

- Query for the room and manager.
- Modify as requested through the room and manager.
- Modify the scheduler according to the modified room information.

That's about it.
Then, to meet the above expectations, let's create a Reader and a Writer.

```java
@Component  
@RequiredArgsConstructor  
@Transactional(readOnly = true)
public class RoomReader {  
  
    private final RoomRepository roomRepository;  
  
    public Room find(long roomId) {  
        return roomRepository.findById(roomId)  
                .orElseThrow(() ->  
                        new CoreaException(
	                        ExceptionType.ROOM_NOT_FOUND, String.format("Room with Id=%d does not exist. Input Id=%d", roomId, roomId)));  
    }  
}
```

This is a `Reader` that is responsible for querying Room.

> If you want to make this Reader/Writer clearer?

```java
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
@Component  
@RequiredArgsConstructor  
@Transactional(readOnly = true)
public @interface Reader {
}
```

(You can also create annotations like the above to explicitly specify them.)

---

It's not just using `RoomRepository` to query, but a class that is responsible for querying elements related to the room.
This prevents each service layer from having `getXXX` whenever it queries.
(Additionally, it allows consistent writing of exceptions.)

```java
public Room update(Room room, Member member, RoomUpdateRequest request) {  
    validate(room, member);  
    return roomRepository.save(request.toEntity(room, member));  
}
```

```java
private void validate(Room room, Member member) {  
    if (room.isNotMatchingManager(member.getId())) {  
        log.warn("Unauthorized room modification attempt. Room creator id={}, requested user id={}", room.getId(), member.getId());  
        throw new CoreaException(ExceptionType.ROOM_MODIFY_AUTHORIZATION_ERROR);  
    }  
    if (room.isNotOpened()) {  
        throw new CoreaException(ExceptionType.ROOM_STATUS_INVALID);  
    }  
}
```

Before modifying a room,
check if the person trying to modify is the one who created the room and if the room is open.

```java
public Room toEntity(Room room, Member member) {  
    return new Room(  
            roomId,  
            title, content,  
            matchingSize, repositoryLink,  
            thumbnailLink, keywords, currentParticipatsSize, limitedParticipants,  
            member, recruitmentDeadline,  
            reviewDeadline, classification,  
            room.getStatus()  
    );  
}
```

Then, create and save the entity through DTO.
(Our team decided to actively use DTO -> entity, domain conversion.
This is because we judged that creating something like RequestMapper for simple web request/response conversion was unnecessary.)

```java
@Transactional  
public RoomResponse update(long memberId, RoomUpdateRequest request) {  
    Room room = roomReader.find(request.roomId());  
    Member member = memberReader.findOne(memberId);  
  
    Room updatedRoom = roomWriter.update(room, member, request);
    ...
```

It can be converted in this way.
Then, I will leave my opinion on why this should be done.
([Discussion on the introduction of Reader/Writer in the project](https://github.com/woowacourse-teams/2024-corea/pull/610#discussion_r1801315976))

To refine it further and organize it here:

### Policy and code & entity changes do not affect the service.

Let's start by explaining the policy.

Currently, when creating a room, it includes the logic for the room manager to participate in the room.
(Because of the policy that the room manager must participate as a reviewer)

Later, if it changes to `Does the room manager really need to participate as a reviewer?`

```java
// RoomWriter
public Room create(Member member, RoomCreateRequest request) {  
	Room room = roomRepository.save(request.toEntity(member));  
	participationWriter.create(room, member, MemberRole.REVIEWER, ParticipationStatus.MANAGER);  
	log.info("Room created. Room creator id={}, requested user id={}", room.getId(), room.getManagerId());  
	return room;  
}
```

In this logic, you only need to remove the `participationWriter` part.
That is, the service does not need to modify the code.

Secondly, the code & entity change part.
The room currently has participating members.

```java
public class Room extends BaseTimeEntity {

	...
	private int currentParticipantsSize;
	
	...
	
	public void participate() {  
	    validateOpened();  
	    if (currentParticipantsSize >= limitedParticipantsSize) {  
	        throw new CoreaException(ExceptionType.ROOM_PARTICIPANT_EXCEED);  
	    }  
	    currentParticipantsSize += 1;  
	}  
	  
	private void validateOpened() {  
	    if (status.isNotOpened()) {  
	        throw new CoreaException(ExceptionType.ROOM_STATUS_INVALID);  
	    }  
	}
}
```

Later, if you remove this and get it with `count(*)`?

```java
public RoomInfo readRoomInfo(long roomId) {  
    Room room = find(roomId);  
    long participationCount = participationReader.countParticipantsByRoomId(roomId);  
    return new RoomInfo(...);  
}
```

As such, the number of participants is retrieved through the reader.
The service still doesn't know about the change.

This is also mentioned in [The Pragmatic Programmer](https://product.kyobobook.co.kr/detail/S000001033128):

![600](https://i.imgur.com/ZpOXJES.png)

(Thanks to Aru for the good insight 🙏🙏)

### Reusability

This is the easiest and most difficult explanation.
Let me explain with an example.

When participating in a room:
- What role you want to participate as (both reviewer/reviewee, reviewer, reviewee)
- How many people you want to do
- Whether you are the room manager / just participating
Decide and participate.

```java
//RoomService
public RoomResponse create(long memberId, RoomCreateRequest request) {
	...
	Participation participation = new Participation(room, manager);
	participationRepository.save(participation);
}

// Participation
public Participation(Room room, Member member) {  
    this(null, room, member, MemberRole.REVIEWER, ParticipationStatus.MANAGER, room.getMatchingSize());  
}
```

This is the part where the room manager participates while creating the room.

```java
// ParticipationService
private Participation saveParticipation(ParticipationRequest request) {
	    ...

        Participation participation = new Participation(getRoom(request.roomId()), member, memberRole, request.matchingSize());
        participation.participate();
        return participationRepository.save(participation);
    }
}

// Participation
public void participate() {  
    room.participate();  
}

public Participation(Room room, Member member, MemberRole role, int matchingSize) {
        this(null, room, member, role, ParticipationStatus.PARTICIPATED, matchingSize);
        debug(room.getId(), member.getId());
}
```

This is the part where participants participate.
(This is old code that intentionally does not use `Reader/Writer`.)

> Additionally, I really, really don't recommend constructor overloading..
> You can do it for test convenience or code conciseness,
> but it will eventually come back when features or entities change.
> (It's convenient at first, but it means you can't handle branching and everything.
>  - Currently, we have a constructor that is only used in fixtures, and it's used in about 30 places, so we can't even remove it..😢)

Currently, it's not a code problem, and the length is not long, so you might not notice it.

However, the problem is that the logic for participation is managed separately in two places.

- Whenever more logic is added, it must be reflected in both places.
- Consistency in test code can be broken. (Some places handle it using this, others handle it differently.)

I will also try to handle this using `Writer`.

```java
public Participation create(Room room, Member member, MemberRole memberRole, ParticipationStatus participationStatus) {  
    return create(room, member, memberRole, participationStatus, room.getMatchingSize());  
}  
  
public Participation create(Room room, Member member, MemberRole memberRole, int matchingSize) {  
    return create(room, member, memberRole, ParticipationStatus.PARTICIPATED, matchingSize);  
}  
  
private Participation create(Room room, Member member, MemberRole memberRole, ParticipationStatus participationStatus, int matchingSize) {  
    Participation participation = participationRepository.save(new Participation(room, member, memberRole, participationStatus, matchingSize));  
    room.participate();  
    logCreateParticipation(participation);  
    return participation;  
}
```

It seems possible to use the logic bundled like this.
I'll write more of my thoughts because you might think, `Isn't it just putting it inside?`

The values that go into the logic for participating in a room are:
```
- What role you want to participate as (both reviewer/reviewee, reviewer, reviewee)
- How many people you want to do
- Whether you are the room manager / just participating
```

I said.
`Room, Member` are inevitable. (If there are no two members participating in the room...?)

`What role` and `room manager / just participating` are subtly intertwined.
At this time, when participating in the room by default, we decided to receive both role and permission.

Currently, the room manager is a reviewer, but it's unknown what will happen,
and matching size also has the extensibility to participate in the room without setting it.

Second is the function for comprehensive cases.

```java
// RoomService
participationWriter.create(room, manager, MemberRole.REVIEWER, ParticipationStatus.MANAGER);

// ParticipationService
participationWriter.create(room, member, memberRole, request.matchingSize());
```

It can be used in the service like this.

> Why didn't you bundle it with DTO?
> 
> Currently, other places are partially introducing DTOs only for Service.
> (With Input, Output naming)
> 
> Service단에서 살아있는 DTO 이므로
> 도메인도 가져도 되므로, 더 효율적이라 판단은 하고 있습니다.
> 
> 하지만, 당장 매개변수가 늘어날 경우는 없다고 판단 + 명확하게 여러 곳에서 사용될 기능이 아니라고 판단해 만들지 않았습니다.

## Is it okay for the service layer to call the service?

(This content also implies a similar meaning to `### Ambiguous Service Names`.)

```
7. Modify the matching & end time registered in the scheduler.
```

Now, let's refactor this #7.

When modifying/deleting a room, changes to this scheduler are also inevitable.
If it's saved in the DB but not properly saved in the scheduler, a problem occurs.

Therefore, transactions must also be bundled in the same unit.

```java
...
automaticMatchingRepository.save(new AutomaticMatching(room.getId(), request.recruitmentDeadline()));
automaticMatchingService.matchOnRecruitmentDeadline(response);

automaticUpdateRepository.save(new AutomaticUpdate(room.getId(), request.reviewDeadline()));
automaticUpdateService.updateAtReviewDeadline(response);
...
```

Can I only include code like this...?
To solve this,

```java
roomAutomaticService.updateMatchingTime(updatedRoom.getId(),updatedRoom.getRecruitmentDeadline());
roomAutomaticService.updateReviewDeadlineTime(updatedRoom.getId(),updatedRoom.getReviewDeadline());
```

You can separate and call it as another service.

```java
//RoomAutomaticService
@Transactional  
public void updateMatchingTime(long roomId, LocalDateTime recruitmentDeadline) {  
    Room room = roomReader.find(roomId);  
    AutomaticMatching automaticMatching = automaticMatchingReader.findWithRoom(room);  
  
    automaticMatchingWriter.updateTime(automaticMatching, recruitmentDeadline);  
    automaticMatchingScheduler.modifyTask(room);  
}
```

> The reason for passing the ID and re-querying instead of passing the existing Room is
> to make it reusable in other controllers or logic.

Is it solved now? My perspective is a little different. 🙂

Services calling other service layers can be a hot topic of debate.
(Regarding this, [# BE | Should Service depend on Service or Repository (Dao)?](https://github.com/woowacourse/retrospective/discussions/15) is a topic that previous senior cohorts have also covered.)

In my opinion, if it becomes a truly complete service layer, there will be no need to call other service layers. (Of course, I don't know if it's a facade pattern.)

Even the code above,

```java
// AutomaticMatchingWriter
public AutomaticMatching create(Room room) {  
    AutomaticMatching entity = new AutomaticMatching(room.getId(), room.getRecruitmentDeadline());  
    automaticMatchingScheduler.matchOnRecruitmentDeadline(entity);  
    return automaticMatchingRepository.save(entity);  
}
```

If the Writer also has the Scheduler, it becomes more intentional.
(Because I think they have the same lifecycle)

Simply, if you think of it as building an `implementation layer` to perform business logic, not just CRUDing domains, you'll be able to build it much easier.

## Conclusion

Refactoring may be difficult to see immediate results.
(Rather, there's a higher chance of performance degradation or causing errors 🥲)

Even after refactoring, you might keep thinking when opening a Reader and Writer API because you're afraid of the code getting dirty.
(`Is this code supposed to be in this Reader?` `How can I reuse it?`)

These elements accumulate one by one, making the code easier and more convenient to modify.

![600](https://i.imgur.com/09II7Ro.png)

The 175-line code has been reduced to 79 lines!
(Of course, reducing lines is not always a good thing.)

As features increase, the code can become more bloated and dirty.
Each time, you'll need to pay attention to the code and consciously make changes.
(To avoid sighing when you expand features or encounter errors next time)


These contents are applied in https://github.com/woowacourse-teams/2024-corea.

Next, I'll probably cover `separating verification externally`, `managing external APIs & tests`, and `testing according to asynchronous roles`, though it will be much later. 🙂

Thank you!