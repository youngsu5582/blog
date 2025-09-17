---
title: "Designing DB"
author: 이영수
date: 2024-07-04T14:55:18.573Z
tags: ['db', 'database', 'database design']
categories: ['Backend', 'Database']
description: "DB & Entity design is very difficult."
image:
  path: https://velog.velcdn.com/images/dragonsu/post/1e91ec3f-8fbe-46f7-a369-72b95a629737/image.png
lang: en
permalink: /posts/designing-db/
---

> This post has been translated from Korean to English by Gemini CLI.

The content of this article was written with reference to [How to Design DB (feat. Data Modeling)](https://yeongunheo.tistory.com/entry/DB-%EC%84%A4%EA%B3%84%ED%95%98%EB%8A%94-%EB%B2%95-feat-%EB%8D%B0%EC%9D%B4%ED%84%B0-%EB%AA%A8%EB%8D%B8%EB%A7%81). Based on that content, I designed with other examples and left my thoughts during the design.

### DB Design Process

- Top-down approach: Benchmarking by referring to third-party services
	- Fast entity derivation: Can quickly define entities & relationships by referring to existing systems
	- Verified design: Design errors are relatively few as it refers to already completed systems
	- Short development time: Can reduce the time spent on initial design and quickly create prototypes
- Bottom-up approach: Analyzing project requirements and deriving & designing necessary entities (creating something from nothing)
	- Clear basis: Entity derivation based on requirements, clear reason for existence of each entity
	- Flexibility: Clear design basis, flexible response to requirement changes
	- Customized design: Optimized design for project requirements

Ultimately, only a bottom-up design can cope with the evolution & changes of requirements.
#### Bottom-up Design

1. Extract all keywords from the proposal
2. Classify extracted keywords into actions-data
	1. Actions are mapped to action entities, data to actual entities (no need to include all actions, data - server's ENUM)
3. Map relationships to designed entities
(Relationships also need attributes, attributes to JOIN entities)

### Example - Starbucks

Blogger Youngwoon used McDonald's as an example.
I will design using Starbucks as an example while studying.

![300](https://i.imgur.com/oYcAbfr.png)

![300](https://i.imgur.com/JFzOLzZ.png)

(Reference image)
#### Feature Specification

```
- Can CRUD menus. (Menus also have beverage / food / product groups.) - Here, menus are assumed to be only beverages.
	- Each menu has a name / description / price / ICED(HOT) ONLY / product nutrition information.
	- Each menu has personal options. (Very diverse for each menu - virtually no commonality)
	- A menu is mapped to one or more menu groups. (Can be included in recommended/NEW, and can be included in basic Teavana/Fizzio, etc.)
- Can CRUD stores.
	- Stores have addresses, operating hours, directions, etc.
	- Some stores have special products.
- Can put 1 or more menus in the shopping cart and select a store.
	- Menus have selected personal options / sizes, etc.
	- Has selected store and menu pickup method.
```

Let's extract all keywords from the proposal. (Unnecessary informational columns are omitted)

Menus have beverage / food / product groups, but I don't think they will be managed in a single table.
(Commonality: only description and price, differences: ICED ONLY selection, allergies, etc. are mostly different)

- ICED and HOT are distinguished as two different things (judged as different because English name, description, image, etc. change)

- Menu
	- Name
	- Description
	- Price
	- Available sizes
	- Temperature (ICED, HOT)
	- Personal information
	- Allergens
	- Product nutrition information (calories, carbohydrates, sugars, etc.)

- Personal information
	- Syrup (group)
		- Vanilla
		- Hazelnut
		- Caramel
	- Milk
		- Regular
		- Low-fat
		- Non-fat
		- Soy milk
		- Oat
	- Ice
	- Whipped cream
	- Drizzle ...

- Store
	- Store address
	- Phone number
	- Available services
		- Delivery
		- Personal cup
		- Night
	- Operating hours
	- Directions

- Shopping cart
	- Ordered menus
	- Store information
	- Pickup method

First, I will separate the actual entities and action entities.
#### Entity Separation

- Actual entity: An entity that represents something that is actually visible (can be touched...?)
	- Must exist physically and be clearly identifiable
	- Manages actual information
- Action entity: An entity that interacts with actual entities, performs specific tasks through relationships with actual entities

Actual entities are ultimately the backbone of the model, so the foundation of the model becomes strong.

Here, I think the actual entities are
Store, Menu, Option, Menu Group.

- Menu for CRUDing coffee
- Menu group that has coffee categories
- Options included in personal information
- Store to order coffee

(I feel that it's okay to approach actual entities as static values.)

> I thought a lot at this time, but the personal information table itself is not necessary.
> Grouping is possible through options!

![350](https://i.imgur.com/VGjX8DG.png)

Now let's think about many-to-many relationships through requirements and entities.

- One menu can belong to multiple menu groups. One menu group can belong to multiple menus.
- One special menu can belong to multiple stores. One store can belong to multiple special menus.
- One option can belong to multiple menus. One menu can have multiple options.

Excluding personal options, many-to-many simply requires creating more tables.

![400](https://i.imgur.com/HEJPt9k.png)

Then, if you set the relationship?

![400](https://i.imgur.com/WRB1Gqb.png)

Basic design and entity design for displaying on the frontend have been completed.

Below, I will conclude by writing about the parts I thought about during this design.

---
### Identifying whether data needs to be stored in the DB

Additionally, you need to clearly distinguish between data that the DB should have and data that it doesn't need to have.

When selecting personal options at Starbucks, each option has various choices.

For example,
1. In syrups, there are vanilla syrup, hazelnut syrup, caramel syrup, etc., and you can select the number of times.
2. For whipped cream, you can choose small / regular / extra.
3. For drizzle, there are caramel drizzle, chocolate drizzle, and you can choose less/regular/extra.

At this time, is it really necessary to store less / regular / extra in the DB?

```java
class Enum Amount {
	LESS("less"),
	NORMAL("normal"),
	MORE("more");
}
```

If you receive information about Drizzle, you can expect it to have columns even if it doesn't, by including that value + Enum and returning it to the frontend.

```java
@Entity
class Drizzle{
	@Id
	private Long id;
	private String name;
	private BigDecimal price;
}

public DrizzleRespone toResponse(Drizzle drizzle){
	return new DrizzleResponse(
		drizzle.getId(),
		drizzle.getName(),
		drizzle.getPrice(),
		Set.of(Amount.LESS,Amount.NORMAL)
	);
}
```

Of course, if certain coffees are only available in less & regular, and some coffees are only available in extra, and this frequency is often seen, you can consider having a table.
-> You need to think about grouping and flexible expansion.

And if `Depth gets deeper`, as part of that content,

> Can you also judge whether options need to be stored?
> -> In fact, it may not even need to be queried, or it may not need to be stored.
> 
> If you decide that it doesn't need to be stored, you can move it to log data and intend for it to be used only as log data.

---
### Differences between Enum in Application and Data in DB

Information can be stored in the DB or held by the application.
This part is also well explained in [Java Enum Usage](https://techblog.woowahan.com/2527/) written by Hyangro, the current CTO of Inflearn, at Baemin.

To quote the content,

>Especially in the case of categories, it is an area where **1-2 are added every 6 months**, so I thought that managing it with a table has more disadvantages than advantages.
>The biggest hurdle in using Enum is the opinion that "**changes are difficult**".
  If **code additions or changes are frequent**, it may be much more convenient for the administrator to directly change it on the administrator page than to change the Enum code and deploy it every time.
  I think it is necessary to properly divide the parts to be managed by Enum and the parts to be managed by tables at an appropriate level.)

The advantages of Enum are that there is no need to send queries + it resides in memory + data values and logic can be attached to the same place. (The biggest advantage is that there is no need to implement CRUD API, which is a big advantage.)

If the application needs to be restarted & deployed 2-3 times a day due to Enum changes (i.e., accurately grasp data variability)
or if the data is not too much or too large, I judged that it is correct to manage it with Enum.

---

Originally, this content
was also going to include shopping cart and payment history storage for personal options,
but the content became too long, so it will be covered in the next part.
