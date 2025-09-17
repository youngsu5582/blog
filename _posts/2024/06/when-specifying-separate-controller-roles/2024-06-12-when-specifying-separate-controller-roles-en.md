---
title: "Separate Controller Roles When Specifying "
author: 이영수
date: 2024-06-12T05:29:47.913Z
tags: ['SpringDocs', 'openapi', 'Specification', 'Documentation', 'Wooteco']
categories: ['Programming', 'Clean Code']
description: "Reduce Controller roles through interfaces"
image:
  path: https://velog.velcdn.com/images/dragonsu/post/c4a42045-8235-4aaf-aea7-40045bd94615/image.png
lang: en
permalink: /posts/when-specifying-separate-controller-roles/
---

> This post has been translated from Korean to English by Gemini CLI.

This content came out during the 4th stage documentation mission.
Spring has RestDocs and SpringFox (SpringDocs) as popular documentation methods.

SpringFox infers request and response types to generate OpenAPI + converts by attaching additional content through specified annotations.
Therefore, some crew members had the opinion that attaching metadata to actual code + RestDocs is more reliable because it is test-based.
However, I chose SpringDocs because I thought, `What's wrong with attaching metadata to gain convenience?` and `Do I need controller slice tests?`

Then, let's implement it by attaching annotations to the Controller.

```java
public class ThemeController{
	@ApiResponse(description = "Deletion successful.")  
	@ApiErrorResponse(value = ErrorType.RESERVATION_NOT_DELETED)  
	@DeleteMapping("/{id}")  
	public ResponseEntity<Void> delete(@PathVariable("id") @Min(1) long themeId) {  
	    themeService.delete(themeId);  
	    ResponseEntity.noContent().build();
	}
}
```

I simply specified the method.

Isn't it just very common code?
-> However, from a POJO perspective, the code is heavily dependent on Spring.
-> The bigger problem is that verification-specification related code and Web-related Spring code are all combined.

To solve these problems, let's separate the roles of verification & specification - Web-related logic.

```java
import jakarta.validation.Valid;  
import jakarta.validation.constraints.Max;  
import jakarta.validation.constraints.Min;  
  
import org.springframework.http.HttpStatus;  
import org.springframework.web.bind.annotation.ResponseStatus;  
import org.springframework.web.bind.annotation.RequestMapping;
  
import roomescape.exception.ErrorType;  
import roomescape.global.annotation.ApiErrorResponse;  
import roomescape.reservation.controller.dto.ThemeRequest;  
import roomescape.reservation.controller.dto.ThemeResponse;  
  
import java.time.LocalDate;  
import java.util.List;  
  
@RequestMapping("/themes")  
public interface ThemeControllerSpecification {  
  
    List<ThemeResponse> findAll();  
  
    @ResponseStatus(HttpStatus.CREATED)
    ThemeResponse create(@Valid ThemeRequest themeRequest);  
  
    @ApiErrorResponse(value = ErrorType.RESERVATION_NOT_DELETED)  
    @ResponseStatus(HttpStatus.NO_CONTENT)  
    void delete(@Min(1) long themeId);  
  
    List<ThemeResponse> findPopular(LocalDate startDate,  
                                    LocalDate endDate,  
                                    @Min(value = 1) @Max(value = 20) int limit);  
}
```

I created an interface to specify the requirements that need to be implemented. (+verification, specification)
-> Are there too many annotations attached to the specification??

```java
import java.time.LocalDate;  
import java.util.List;  
  
import org.springframework.web.bind.annotation.*;  
  
import roomescape.reservation.controller.dto.ThemeRequest;  
import roomescape.reservation.controller.dto.ThemeResponse;  
import roomescape.reservation.service.ThemeService;  
import roomescape.reservation.service.dto.ThemeCreate;  
  
@RestController  
public class ThemeController implements ThemeControllerSpecification {  
  
    private final ThemeService themeService;  
  
    public ThemeController(ThemeService themeService) {  
        this.themeService = themeService;  
    }  
  
    @GetMapping  
    public List<ThemeResponse> findAll() {  
        return themeService.findAllThemes();  
    }  
  
    @PostMapping  
    public ThemeResponse create(@RequestBody ThemeRequest themeRequest) {  
        ThemeResponse response = themeService.create(ThemeCreate.from(themeRequest));  
        return response;  
    }  
  
    @DeleteMapping("/{id}")  
    public void delete(@PathVariable("id") long themeId) {  
        themeService.delete(themeId);  
  
    }  
  
    @GetMapping("/popular")  
    public List<ThemeResponse> findPopular(  
            @RequestParam(value = "startDate", required = false) LocalDate startDate,  
            @RequestParam(value = "endDate", required = false) LocalDate endDate,  
            @RequestParam(value = "limit", required = false, defaultValue = "3")int limit) {  
        return themeService.findPopularThemes(startDate, endDate, limit);  
    }  
}
```

Instead, the Controller implementation has become very clean.

Here, the important point is
to look at each import statement.

![350](https://i.imgur.com/J3n5BEp.png)

I don't pay much attention to the validation part because it's a different library from Spring.
(Validation is a separate concern)

If you use HttpStatus, RequestMapping, and ResponseStatus, it depends on Spring, right??

`@ResponseStatus(HttpStatus.CREATED)` This code specifies the status code of the Response + convenience HttpStatus,
so it is easy to replace with other frameworks in Spring.

If you want to remove them, I think it's fine to remove those parts as well. (The difference in whether you consider it as Spring's dependency propagation)

```
As an additional thought, it is impossible not to specify status codes in the web, so other frameworks must also have this function.
(If you don't like ResponseStatus, you can use custom annotations + attach annotations like interfaces)
```

![350](https://i.imgur.com/LxbTAdS.png)
It seems like the controller imports many annotations for implementation, but?

![350](https://i.imgur.com/kx5YDE9.png)
In the end, it's just depending on one part of one library.
Thus, the role of the controller has become clear.
(Method mapping, body parsing, path parsing, etc. are functions that a web framework would naturally have and can be expected.)

To summarize again?

Specification has the responsibility to specify verification & request and response values (status code, error type in case of error).
Controller has the responsibility to receive requests (`@RequestBody,@RequestParam...`) and return responses by executing logic.

In this way, concerns can be separated, and each class and interface can perform its own functions.
-> Even if you replace Spring with another framework?

```java
@Path("/themes")
@Consumes(MediaType.APPLICATION_JSON)
@Produces(MediaType.APPLICATION_JSON)
public class ThemeController implements ThemeControllerSpecification {

    @Inject
    ThemeService themeService;

    @Override
    public List<ThemeResponse> findAll() {
        return themeService.findAllThemes();
    }

    @Override
    @POST
    public ThemeResponse create(@RequestBody ThemeRequest themeRequest) {
        ThemeResponse response = themeService.create(ThemeCreate.from(themeRequest));
        return response;
    }

    @Override
    @DELETE
    @Path("/{id}")
    public void delete(@PathParam("id") long themeId) {
        themeService.delete(themeId);
    }

    @Override
    @GET
    @Path("/popular")
    public List<ThemeResponse> findPopular(
            @QueryParam("startDate") LocalDate startDate,
            @QueryParam("endDate") LocalDate endDate,
            @QueryParam("limit") int limit) {
        return themeService.findPopularThemes(startDate, endDate, limit);
    }
}
```

(Even if replaced with Quarkus, the controller's code does not undergo significant changes and the interface remains the same. - From GPT)

---
#### Conclusion

In fact, if you ask if this part is role (concern) separation, it might not be.
However, the separation of concerns that I studied is a `design principle that separates into distinct parts`.

Annotations are mixed and cause confusion + make it difficult to change easily.
-> So, if annotations are properly separated + library dependencies are separated, isn't it OK??

It may not bring big changes to the code right away, and it may even feel like the management points have doubled,
but I think it's perfectly fine if it's caught by convention.

```java
@ApiErrorResponse(value = ErrorType.RESERVATION_NOT_DELETED)  
@ResponseStatus(HttpStatus.NO_CONTENT)  
void delete(@Min(1) long themeId);  
```

> It's a method that returns a code that means the ID is 1 or more, returns 204, and cannot delete the reservation in case of an error.

I think it's sufficiently inferable,
(You can expect it just by looking at the interface specification, without having to look at the code.)
