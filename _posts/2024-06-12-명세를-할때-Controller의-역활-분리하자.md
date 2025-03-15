---
title: "명세를 할때 Controller의 역활 분리하자 "
author: 이영수
date: 2024-06-12T05:29:47.913Z
tags: ['SpringDocs', 'openapi', '명세', '문서화', '우테코']
categories: ['프로그래밍', '클린코드']
description: 언터페이스를 통해 Controller 역활 덜어내기
image:
  path: https://velog.velcdn.com/images/dragonsu/post/c4a42045-8235-4aaf-aea7-40045bd94615/image.png
---
해당 내용은 4단계 문서화 미션 도중 나온 내용이다.
Spring은 대중적으로 문서화 방법으로 RestDocs,SpringFox(SpringDocs)가 있다.

SpringFox 는 요청 타입,응답 타입을 추론하여 OpenAPI 를 생성 + 지정한 어노테이션들을 통해서 추가적으로 내용을 붙혀 변환한다.
그렇기에, 크루들 중에서도 실제 코드에 메타 데이터를 붙히는 점 + RestDocs는 테스트를 기반으로 해서 더욱 확실하다 라는 입장들도 있었다.
하지만, `나는 메타 데이터를 붙혀서 편의를 얻는게 뭐 어때?` `컨트롤러 슬라이스 테스트가 필요해?` 라는 입장이기에 SpringDocs 를 선택했다.

그럼 Controller에 어노테이션들을 붙혀서 구현을 해보자.

```java
public class ThemeController{
	@ApiResponse(description = "삭제를 성공했습니다.")  
	@ApiErrorResponse(value = ErrorType.RESERVATION_NOT_DELETED)  
	@DeleteMapping("/{id}")  
	public ResponseEntity<Void> delete(@PathVariable("id") @Min(1) long themeId) {  
	    themeService.delete(themeId);  
	    ResponseEntity.noContent().build();
	}
}
```

단순히 메소드 명세만 했다.

지극히 일반적인 코드가 아니야?
-> 하지만, 위 POJO 적 관점에서 보면 코드는 Spring에 덕지덕지 의존이 되어 있다.
-> 더 문제점은, 검증-명세 관련 코드-Web관련 스프링코드가 모두 결합이 되어 있다.

이들을 해결 하기 위해서 검증&명세 - Web 관련 로직의 역활 분리를 해보자.

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

인터페이스를 만들어 구현 해야하는 요구사항을 명시한다. ( +검증,명세 )
-> 명세에 어노테이션이 덕지덕지 붙어있는데??

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

대신, Controller 구현체가 매우 깔끔해졌다.

여기서, 중요한 점은
각각의 import 문을 보는게 중요하다.

![350](https://i.imgur.com/J3n5BEp.png)

validation 부분은 Spring 과 다른 라이브러리이므로 크게 신경쓰지 않는다.
( validation 은 따로 노는 관심사 )

HttpStatus 와 RequestMapping,ResponseStatus 을 쓰면 Spring 에 의존인디??

`@ResponseStatus(HttpStatus.CREATED)` 해당 코드는 Response 의 상태코드를 지정 + 편의성 HttpStatus 이므로
Spring에서 다른 프레임워크로 대체 용이하다.

빼고 싶다면 해당 부분들도 빼도 상관없다고 생각한다. ( Spring 의 의존 전파라고 생각하는 여부의 차이 )

```
추가적인 생각으로, 웹에서 상태코드를 지정하지 않는게 불가능하므로 다른 프레임워크도 가져야 하는 기능이다.
( ResponseStatus 와 같은게 싫다면 커스텀 어노테이션 + 어노테이션을 인터페이스 처럼 활용해 부착 가능 )
```

![350](https://i.imgur.com/LxbTAdS.png)
컨트롤러는 구현을 위해 수많은 annotation을 import 하는거 같지만?

![350](https://i.imgur.com/kx5YDE9.png)
결국, 한 라이브러리의 한 부분만 의존하는게 끝이다.
이렇게 컨트롤러가 가지는 역활은 명확해졌다.
( 메소드 매핑, 바디 파싱, 경로 파싱 등 웹 프레임워크라면 당연히 가지는 기능이라 기대가능 )

다시 정리해보면?

Specification 은 검증&요청 및 응답 값(상태코드,예외시 에러 타입) 에 대해서 명시하는 책임을 가진다.
Controller 는 요청을 받는 법과 ( `@RequestBody,@RequestParam...` ) 로직을 수행하여 응답을 반환하는 책임을 가진다.

이렇게 관심사를 분리해서 각각의 클래스,인터페이스가 스스로의 기능을 하게 만들수 있다.
-> Spring에서 다른 프레임워크로 교체하더라도?

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

( Quarkus 로 교체해도 컨트롤러의 코드가 크게 변화를 겪지 않고 인터페이스는 동일함을 볼 수 있다. - From GPT )

---
#### 마무리

사실, 해당 부분이 역활(관심사) 분리가 맞아? 라고 하면 아닐수도 있다.
하지만 내가 공부한 관심사의 분리(Seperation of concerns) 는 `구별된 부분으로 분리시키는 디자인 원칙`이다.

어노테이션들이 혼용되어 붙어 있어 혼란을 주고 + 변경의 용이성을 어렵게 해서
-> 어노테이션들이 알맞게 분리 + 라이브러리 의존성을 분리 했으니 OK 아닐까??

당장 코드에 큰 변화를 가져오지 않고, 오히려 관리 포인트 2배 증가로 느껴질 수는 있으나
컨벤션으로 잡힌다면 충분히 괜찮다고 생각한다.

```java
@ApiErrorResponse(value = ErrorType.RESERVATION_NOT_DELETED)  
@ResponseStatus(HttpStatus.NO_CONTENT)  
void delete(@Min(1) long themeId);  
```

> Id는 1이상이고, 204를 반환하며 에러시 예약을 삭제할 수 없다는 코드를 반환하는 메소드이구나

라고 충분히 유추 가능하다고 생각하므로
( 코드를 살펴볼 필요 없이, 인터페이스 명시만 보고 기대 가능 )
