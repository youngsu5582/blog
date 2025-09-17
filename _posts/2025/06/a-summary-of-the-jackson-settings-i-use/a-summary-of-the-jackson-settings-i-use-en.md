---
title: "A Summary of Jackson Settings and Features I Use"
author: "이영수"
date: 2025-06-16T15:42:27.466Z
tags: [ "Jackson", "Java", "Serialization", "Deserialization" ]
description: "This post summarizes how to serialize and deserialize Java objects using the Jackson library and how to use its annotations."
image:
  path: assets/img/thumbnail/2025-06-16-사용하는-Jackson-설정들-정리.png
permalink: /posts/a-summary-of-the-jackson-settings-i-use/
---

> This is a summary of the Jackson annotations and features I use in my projects.

No Java-Spring developer can be unaware of Jackson.
This is because, no matter how times change, the foundation of web requests is JSON.<br>
And serialization/deserialization in Java is more difficult than you might think. (implements Serializable,
byte-level conversion)

However, because Spring handles it so well, you may not have paid much attention to serialization and deserialization.

Nevertheless, Jackson is a very attractive library that is a shame to use only for `writeValueAsString` to send APIs or for testing.

```java
var objectmapper = new ObjectMapper();
objectMapper.writeValueAsString(value);
```

Below, I have briefly covered annotations and ways to use Jackson more deeply.

### readValue, convertValue

> Serialization: Java object -> JSON string (When sending JSON values to the DB, when responding to HTTP with a Java object)
> Deserialization: JSON string -> Java object (When retrieving JSON values from the DB, when converting an HTTP request to a Java object)

```java
String json = "{\"name\": \"Alice\", \"age\": 30}";
User user = objectMapper.readValue(json, User.class);

Map<String, Object> map = Map.of("name", "Alice", "age", 30);
User user = objectMapper.convertValue(map, User.class);
```

I mainly used these two for testing.

`readValue` serializes the actual request itself. (URL, InputStream, Byte, String, etc.)

Through `readValue`, you can test things like how a value that does not exist in an ENUM value is deserialized.
(In other words, it is useful for testing elements that do not exist in our general Java structure.)

`convertValue` serializes a Java object.
So, you can test whether it comes out as we intended according to the annotations.

### JsonInclude

This is a setting that controls which fields to include when serializing.

There are various settings as ENUMs.
(Used like `@JsonInclude(JsonInclude.Include.NON_NULL)`)

- `NON_NULL`: Serialize when not NULL
- `NON_EMPTY`: Serialize when not empty (null, `""`, empty arrays and collections, absent values)
- `ALWAYS`: Always include

```java
// Legacy data that is no longer used
@JsonInclude(JsonInclude.Include.NON_EMPTY)
private List<Map<String, Long>> deprecatedData;

// Data currently in use
private SortedSet<Data> currentData;
```

In this way, you can retrieve existing values from the DB but prevent them from being saved when storing.
(Since the value is not included in the DB, it is not saved.)

```java

@JsonInclude(JsonInclude.Include.NON_NULL)
public class CreditDeductionDto {
    ...
}
```

This prevents NULL values from being automatically serialized.

### JsonView

This is used to determine whether a View declared in a field is included in the standard based on the View of the controller method.
(It is processed internally using `ObjectMapper.writerWithView(View.class)`.)

```java
public class DtoView {

  public static class Client {

  }

  public static class Admin {

  }
}

public class RequestDto {

  @JsonView(DtoView.Client.class)
  private String imageUrl;

  @JsonView(DtoView.Admin.class)
  private Client client;
}

@JsonView(DtoView.Admin.class) // ← This becomes the standard
@PostMapping(...)
public ResponseEntity<RequestDto> request(...) {
  return ResponseEntity.ok(dto);
}
```

This can be used when certain columns should only be shown to the admin.
If you declare `@JsonView(DtoView.Client.class)`, the Client will not be deserialized.

### JsonIgnoreProperties

Specifies to ignore certain properties at the class or field level during JSON serialization/deserialization.

```java

@JsonIgnoreProperties(ignoreUnknown = true)
public class User { ...
}
```

It ignores unknown values.

-> Used very often. ⭐️ (It can be difficult to react strictly to changes in DTOs - modified, deleted, or data that is not essential.)

```java
@JsonIgnoreProperties(allowGetters = true)
@JsonIgnoreProperties(allowSetters = true)
```

- `allowGetters`: Read-only, allows output (serialization) but not input (deserialization).

- `allowSetters`: Write-only, allows input (deserialization) but not output (serialization).

This part is somewhat difficult to use. What if you want to retrieve a value from the DB but not save it to the DB?

1. Create an object through deserialization.
2. Serialize the object to JSON and return it via HTTP.

If you prevent serialization because you don't want to save an empty value to the DB, it will also not be included when serializing to HTTP.

### JsonCreator

Explicitly tells which method to use when deserializing JSON data into a Java object.

(Jackson basically creates an object using the `default constructor` + setter method.)

```java

@JsonCreator
public static ExternalApi fromValueOrUnknown(String value) {
  for (ExternalApi externalApi : ExternalApi.values()) {
    if (externalApi.getAlias().equals(value)) {
      return externalApi;
    }
  }
  return UNKNOWN;
}
```

ENUMs basically work with `EnumSerializer / EnumDeserializer`.
(Prints the name value as is / finds it with `Enum.valueOf`)

This can be used when you want to use a static factory method.

### JsonValue

```java

@JsonValue
public String getAlias() {
  return alias;
}
```

Explicitly tells which value to use when serializing.
This can be used when you want to return a different value for an ENUM.

### JsonIgnore

```java

@JsonIgnore
private long privateId;
```

Specifies a value to be ignored during serialization and deserialization.
This can be used to specify a value that is used only internally and should never be exposed.

### JsonFormat

```java

@DateTimeFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
@JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd'T'HH:mm:ss", timezone = "Asia/Seoul")
private LocalDateTime createdAt;
```

If it is stored in the DB as `2025-04-29 00:23:47.930`,

- `DateTimeFormat`: A format annotation provided by Spring, used for MVC binding.
- `JsonFormat`: An annotation provided by Jackson, converts according to the pattern, and can convert to a specific time zone by specifying the time zone (e.g., converts to `"2025-06-16T14:36:36"`).

By specifying both, you can handle it consistently whether it comes as a Spring request or a JSON request/response.

### JsonTypeInfo / JsonSubTypes

These are annotations that serialize/deserialize a polymorphic structure with Jackson.
Isn't it often said that the flower of Java is the Interface? 
However, Jackson cannot know how to serialize/deserialize if it only has the interface information.

```java
@JsonTypeInfo(
  use = JsonTypeInfo.Id.NAME,
  include = JsonTypeInfo.As.EXISTING_PROPERTY,
  property = "type",
  visible = true,
  defaultImpl = DefaultOption.class
)
```

- `use = JsonTypeInfo.Id.NAME`: Distinguishes subclasses by name.
- `include = JsonTypeInfo.As.EXISTING_PROPERTY`: Infers through an existing property.
- `property = "type"`: Infers by the `type` property.
- `visible = true`: Sets to show the value of the inferred type.
- `defaultImpl`: The default class to specify if there is no matching type.

```java
@JsonSubTypes({
  @JsonSubTypes.Type(value = AOption.class, name = "a"),
    ...
    })
```

-> If the type is `a`, it means to deserialize to `AOption`.

### AnnotationIntrospector

Jackson reads the numerous annotations above to decide how to serialize/deserialize.
`AnnotationIntrospector` is what defines how to interpret these annotations.

```java
public class CustomAnnotationIntrospector extends NopAnnotationIntrospector {

  @Override
  public Object findSerializer(Annotated annotated) {
    if (annotated.hasAnnotation(CustomAnnotation.class)) {
      return CustomFieldSerializer.class;
    }
    return null;
  }

  @Override
  public Object findDeserializer(Annotated annotated) {
    if (annotated.hasAnnotation(CustomAnnotation.class)) {
      return CustomFieldDeSerializer.class;
    }
    return null;
  }
}
```

You can create your own custom annotation and decide on serialization/deserialization.

```java
ObjectMapper mapper = new ObjectMapper();

AnnotationIntrospector pair = AnnotationIntrospector.pair(
  new JacksonAnnotationIntrospector(),
  new CustomAnnotationIntrospector());

mapper.setAnnotationIntrospector(pair);
```

Then, you can choose one as an annotation pair.

```java
public class CustomAnnotationIntrospector extends NopAnnotationIntrospector {

  private static final JacksonAnnotationIntrospector DELEGATOR = new JacksonAnnotationIntrospector();

    ...

  @Override
  public List<NamedType> findSubtypes(Annotated a) {
    return INTROSPECTOR.findSubtypes(a);
  }
```

In this way, you can create a delegate, override only what you need, and leave the rest unspecified.

To ignore `JsonValue` during serialization and deserialization.
(`NopAnnotationIntrospector` is literally a class that does nothing.)

---

Actually, I feel like I'm becoming a serialization/deserialization master while working on projects lol.

- Storing/reading JSON in the DB
- Storing/reading JSON in Redis
- Publishing messages to a messaging queue
- Web requests/responses

If you don't know the annotations well, the code for handling responses and data can be cluttered in the business code, or there can be problems with the data design.
It would be good to know them lightly 🙂

I'll add more elements that I use later if there are any.

```