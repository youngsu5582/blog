---
title: ''
author: 이영수
date: 2025-09-07T13:45:38.434Z
tags:
  - PostgreSQL
  - 파티셔닝
  - 데이터베이스
  - 성능최적화
description: PostgreSQL에서 RANGE 파티셔닝을 통한 성능 최적화 방법을 다룹니다. 데이터 조회 효율성을 높이는 팁과 예제를 제공합니다.
image:
  path: assets/img/thumbnail/2025-09-07-partitioning-in-postgresql.png
page_id: partitioning-in-postgresql
---
## 📋 초안 제목
파티셔닝 톺아보기 in PostgreSQL

## 📝 초안 내용 (Markdown)
> 해당 내용은 RANGE 파티셔닝에 대해서만 다룹니다.

DB 에서 성능 최적화의 가장 간단한 초식은 인덱스 일 것이다.
RDBMS 의 구조상 대부분이 B-Tree 를 사용하고, B-Tree 는 O(logN) 의 시간복잡도로 데이터를 읽는게 가능하기 때문이다.

> log₂(1,000,000,000) 는 대략 30이다. 10억개의 데이터는 30번의 순회면 무조건 검색!

하지만, 인덱스 역시도 모든걸 해결해주지 않는다. 

결국 INSERT, UPDATE, DELETE 는 인덱스 트리의 수정을 요구한다 (I/O 부하, 쓰기 증폭 등 유발)

추가로, 순차적인 값 ( id, timestamp ) 은 B-Tree 구조상 가장 오른쪽 리프 페이지에만 삽입이 된다.
-> 페이지의 래치를 잠구기 위해 서로가 경쟁한다 ( Last Page Hotspot )
=> 성능 저하를 유발할 가능성이 있다.

> 물론, 이는 RDBMS 마다 다를 수 있다.
> PostgreSQL 은 직전 삽입한 페이지를 기억하고, '오른쪽 리프' 라면 블록을 캐시해 바로 시도한다고 한다.
> [Re: pgsql: Optimize btree insertions for common case of increasing values](https://www.postgresql.org/message-id/CAH2-WzkpJd5TP6uRCqa473mzZCNsVk5KjE3xrs-4%3DFfFiAMHog%40mail.gmail.com)
> [PostgreSQL Source Code](https://doxygen.postgresql.org/nbtinsert_8c.html#a137ae10f1b043d662b679e87d981ad10) 의 `_bt_search_insert()`  의 부분을 참조하면 된다.

![](https://i.imgur.com/Ky4vOFE.png)

- 페이지가 여전히 가장 오른쪽 리프 페이지인지 & 새로운 튜플을 삽입할 충분한 공간이 있는지 & 삽입하는 키가 이 페이지 가장 높은 키보다 큰지 확인한다.
-> 이 과정을 통과하면, 그대로 NULL 을 반환해 기존 block 을 캐싱해서 사용한다.

각설 하고, 이렇게 인덱스의 한계점을 느끼거나 아래와 같은 데이터 특성이라면 파티션을 적용한다.

데이터가 꼭 모든 데이터를 조회할 필요가 없다면?

- 사용자의 일일, 월별 서비스 사용을 위한 데이터 - 크레딧, 쿠키, 포인트 등등등
- 보관용 데이터 - 사용 기록용 데이터

테이블의 모든 데이터가 사용 되지 않으니 같이 관리 및 처리를 할 필요가 없다.

## 테이블 구조

### 단일 테이블의 그 한계점

- 하나의 논리적 테이블은 디스크 상에서 하나의 힙 파일 셋 에 매핑되어, 테이블의 모든 튜플이 여기에 저장된다.
INSERT 발생하면, 힙 파일 빈 공간에 순서대로 데이터가 들어가고 인덱스는 이런 주소를 저장한다.

이런 힙 파일이 특정 크기 ( 기본값 1 GB ) 를 초과하면 새로운 힙 파일을 만들어내서 데이터를 계속 저장한다.
( 이런 파일들의 묶음이 힙 파일 셋 )
-> 테이블이 커지면 이 파일들의 용량이 수백GB, TB 단위로 거대해진다.

- 혹시나, 만약에 인덱스를 탈 수 없다면 엄청난 디스크 I/O 를 유발해 가용 I/O 대역폭을 소진시킬 가능성이 존재한다.
인덱스를 통해 파일을 찾더라도, 실제 데이터를 가져오기 위해 힙 파일 셋 곳곳에 흩어져 있는 모든 데이터 블록들에 접근해야 한다.
-> 디스크 헤드가 끊임없이 움직여야 하는 랜덤 I/O 유발 가능

- PostgreSQL 의 특성상 죽은 튜플을 정리하는 VACUUM 작업이 발생한다.
이런 VACUUM 작업 역시도 테이블 전체를 스캔하게 된다. ( FULL VACUUM 이라면...? )

- 데이터는 수명이 존재한다.
예를 들어, 보안 정책으로 인해 예전 데이터들을 다 폐기 해야 한다고 생각해보자.
10년치의 데이터가 저장되어 있는데 최근 3년치의 데이터만 저장을 하라고 보안 지침이 내려왔다.

이런 테이블에 삭제 작업을 걸면서 무중단 배포를 해야 하는 요구사항? ☠️
( 아마도, 데이터 동기화를 시도하고, 다른 테이블에서 작업 처리하고 라우팅을 바꾸는게 더 가능성이 있지 않을까... )

### 파티셔닝 테이블

파티션된 테이블은 실제 데이터를 저장하지 않는 논리적인 컨테이너이다.
실제 데이터들은 각 파티션이 나뉘어 저장된다. 그리고, 이 나뉜 파티션들이 그 자체로 하나의 테이블로 처리된다.

내부적으로 완전히 독립된 물리적 파일 ( relfilenode ) 과 인덱스를 가진다.
추가로, 다른 파티션과 디스크 I/O 경합을 피할 수 있다. (`+` 자주 접근되는 블록만 메모리에 상주할 확률이 높아져 캐시 히트율 증가 )

> relfilenode?
> 물리적 데이터 파일을 가르키는 내부 식별자 (DB 데이터 디레토리 안에 실제 파일 이름)
> <-> 객체를 논리적으로 식별하는 건 OID(Object ID)
> OID 와 relfilenode 를 분리함으로써 물리적 파일을 통으로 교체하는 명령어를 매우 효율적으로 처리한다.
> ( TRUNCATE, VACUUM FULL, REINDEX 등등 - 수억 개를 직접 지우는게 아닌 새로운 relfilenode 를 가르키도록 업데이트 )

각 파티션이 자신만의 작고 독립적인 인덱스를 가져서 인덱스의 깊이를 조절 가능하다.
( 날짜별로 한다면, 일정량 정해진 숫자만큼 계속 유지 )

```sql
CREATE TABLE logs_partitioned (  
                                  id BIGSERIAL,  
                                  log_level VARCHAR(10),  
                                  message TEXT,  
                                  created_at TIMESTAMPTZ NOT NULL,  
                                  PRIMARY KEY (id, created_at)  
) PARTITION BY RANGE (created_at);
```

![400](https://i.imgur.com/WrTkduf.png)

적용하면, 총 테이블의 크기 - 파티션 테이블의 크기가 적절히 나눠져있는걸 볼 수 있다.

## 파티션 프루닝

파티션을 사용하는 의의 중 하나

쿼리 플래너가 WHERE 절의 조건을 분석해, 쿼리 실행과 무관한 파티션은 검색 대상에서 제외한다.

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT COUNT(*) FROM logs_single
WHERE created_at >= '2024-09-01 00:00:00 KST' AND created_at < '2024-10-01 00:00:00 KST';
```

> created_at 을 파티션 키로 사용하는 테이블

GEMINI 의 도움을 받아 2억 4천만 건 정도의 데이터를 삽입했다고 해보자.

![](https://i.imgur.com/fI4Nn5O.png)

인덱스를 적용하지 않으면 11초 정도

![](https://i.imgur.com/wzUY5DP.png)

>0.8초 실행

- parallel index only scan : 테이블 본체를 읽지 않고, 인덱스를 읽어서 작업 완료, 3개의 프로세서가 처리 (1개의 메인, 2개의 워커)
-> 즉, 거대 인덱스에서 1개월치의 범위 스캔을 하는 것

![](https://i.imgur.com/4xGAtp7.png)

> 0.9초 실행

- Parallel Seq Scan on logs_p2023_05 logs_partitioned : 파티션 프루닝이 동작
-> `logs_partitioned` 테이블이 아니라, `logs_p2023_05` 인걸 확인가능 ( 여러개의 테이블 중 1개만 선택 )

그러면 시간상 성능도 큰 차이가 없는데, 왜 파티션을 써야할까?

처리된 블록의 양을 보면 차이가 명확하다.

- Buffers shared hit=10086399 read=16043 : 메모리와 디스크를 통해 10,102,442 개의 블록 처리
- Buffers: shared read=103093 : 103,093 개의 블록만 처리

메모리에 블록들이 없다면, 결국 디스크에 읽어야 할 대상들이 늘어나게 되는 것이다.
-> 총 CPU 시간 증가, 메모리 캐시에 엄청난 공간 차지, 버퍼 오염 ( 다른 중요한 데이터들이 밀려날 수 있음 )

=> 당장의 결과가 아닌, 장기적 데이터 증가에도 성능을 일정하게 유지를 시켜주는게 파티셔닝과 프루닝 이다.

## 파티셔닝을 위한 실용적인 팁

### created_at 은 왠만하면 미리 만들어 놓을 것

가끔씩 생각할 수 있다. `created_at 이 엔티티에 필요한가?`

[Do you have "created_at" and "last_update_at" fields on all your tables/entities? Yes? No? Why? Is it good / bad practice?](https://www.reddit.com/r/webdev/comments/1cez61c/do_you_have_created_at_and_last_update_at_fields/)

해당 내용을 읽어보면 모든 테이블에 포함시키는게 거의 매우 좋은 습관이다로 결론이 나있다.

1. 나중에 반드시 후회한다 : 처음에는 필요 없을지 몰라도, 나중에 필요해질 수 있다.
2. 디버깅, 데이터 추적용 : 데이터 관련 문제가 발생했을 시, 언제 생성 또는 수정되는지 아는 것은 필수적인 단서가 된다.
3. 캐시 무효화에도 사용 가능 : 최종 수정 시간을 확인해, 데이터가 여전히 유효한지 & 새로고침해야 하는지 쉽게 판단 가능

2억 4천만 건의 데이터에 created_at 을 인덱스를 적용하면

![](https://i.imgur.com/vVl9s0V.png)

1분 8초 가량의 시간이 걸린다. 데이터가 더 어마어마하게 쌓여있다면...? 무중단 운영에 영향을 주게 될 것이다.
즉, 미리미리 만들고 필요하다면 처리해놓는게 가장 깔끔하다.

> 5000만개 정도 있고, 실제 작업이 되는 테이블에 생성 및 인덱스 처리하는 작업에는 5분도 걸리더라...

> created_at 에만 인덱스를 거는게 필요한가? 라고 생각했는데
> 정렬 작업을 해야하는 요구사항이 있다면, 단일 칼럼으로 걸어도 괜찮은거 같다.
> [Is there any benefit to indexing 'created_at' column?](https://laracasts.com/discuss/channels/eloquent/is-there-any-benefit-to-indexing-created-at-column)
> 해당 내용을 보면, 인덱스가 없는 정렬 과정에서 `Out of sort memory` 가 떴다고 한다.
> ( 인메모리 정렬 또는 파일 정렬 작업을 수행하기 때문에 )

### 점진적 파티셔닝 ( 레거시 파티셔닝 )

기존에 파티셔닝을 적용하지 않은 데이터를 파티셔닝 테이블로 교체하려면 어떻게 해야할까?
이 데이터는 특히나, created_at 이라는 칼럼도 없고, 이 칼럼에 인덱스도 적용 안되어 있다고 가정한다.

> 파티셔닝은 파티션할 칼럼에 인덱스가 걸려있어야만 가능하다.

바로, 파티셔닝을 적용하지 않고 파티셔닝을 적용한 새로운 테이블을 만들고 향하게 하는 식으로 처리 가능하다.

```sql
CREATE OR REPLACE VIEW logs AS  
SELECT id, log_level, message, created_at FROM logs_temp  
UNION ALL  
SELECT id, log_level, message, created_at FROM logs_parent;

ALTER TABLE logs_parent  
    ALTER COLUMN id SET DEFAULT nextval('logs_temp_id_seq'::regclass);
```

이전 테이블, 새로운 테이블 데이터를 가지는 VIEW 를 생성
부모의 Sequence 로 지정

```sql
DO $do$  
    DECLARE  
        cutoff CONSTANT timestamp := now();  
    BEGIN        EXECUTE format($fmt$  
        CREATE OR REPLACE FUNCTION trg_logs_union_mod() RETURNS trigger AS  
        $tg$  
        DECLARE  
            new_id BIGINT;  
            _cutoff CONSTANT timestamp := TIMESTAMP '%s';  
        BEGIN            
	        IF TG_OP = 'INSERT' THEN  
                IF NEW.created_at < _cutoff THEN  
                    INSERT INTO logs_temp (log_level, message, created_at)  
                    VALUES (NEW.log_level, NEW.message, NEW.created_at)  
                    RETURNING id INTO new_id;  
                ELSE  
                    INSERT INTO logs_parent (log_level, message, created_at)  
                    VALUES (NEW.log_level, NEW.message, NEW.created_at)  
                    RETURNING id INTO new_id;  
                END IF;  
				NEW.id := new_id;  
                RETURN NEW;  
            ELSIF TG_OP = 'UPDATE' THEN  
                IF NEW.created_at < _cutoff THEN  
                    UPDATE logs_temp  
                    SET  
                        log_level  = NEW.log_level,  
                        message    = NEW.message,  
                        created_at = NEW.created_at  
                    WHERE id = OLD.id;  
                ELSE                    
	                UPDATE logs_parent  
                    SET  
                        log_level  = NEW.log_level,  
                        message    = NEW.message,  
                        created_at = NEW.created_at  
                    WHERE id = OLD.id;  
                END IF;  
                RETURN NEW;
			END IF;
			RETURN NEW;
        END;
        $tg$ LANGUAGE plpgsql;  
    $fmt$, cutoff);  
    END;
$do$ LANGUAGE plpgsql;
```

- cutoff 를 통해 함수가 선언되는 최초에 시간 지정
	- 지정 시간보다 이전이면, 예전 ( 파티셔닝 적용 X ) 에 INSERT/UPDATE
	- 지정 시간보다 이후이면, 현재 ( 파티셔닝 적용 O ) 에 INSERT/UPDATE

```sql
-- 3) INSTEAD OF INSERT 트리거
DROP TRIGGER IF EXISTS trg_client_union_insert ON client;
CREATE TRIGGER trg_client_union_insert
    INSTEAD OF INSERT
    ON client
    FOR EACH ROW
EXECUTE FUNCTION trg_client_union_mod();

-- 4) INSTEAD OF UPDATE 트리거
DROP TRIGGER IF EXISTS trg_client_union_update ON client;
CREATE TRIGGER trg_client_union_update
    INSTEAD OF UPDATE
    ON client
    FOR EACH ROW
EXECUTE FUNCTION trg_client_union_mod();
```

그리고 트리거로 VIEW 에 INSERT / UPDATE 가 들어오면 트리거를 동작하게 처리한다.

=> 그 후, 이전 데이터가 필요없어지는 만큼 쌓이면 VIEW 를 해제하고 파티셔닝이 적용된 테이블만 사용하게 처리한다.

```
BEGIN;

DROP TRIGGER IF EXISTS trg_client_union_insert ON client;
DROP TRIGGER IF EXISTS trg_client_union_update ON client;

-- client가 view일 때만 drop
DO $$
    BEGIN
        EXECUTE 'DROP VIEW IF EXISTS client';
    EXCEPTION
        WHEN wrong_object_type THEN
            -- view가 아닌 경우 (table이면) 그냥 무시
            NULL;
    END$$;
ALTER TABLE IF EXISTS client_temp RENAME TO client;
COMMIT;
```

> 물론, 이 방법보다 더 좋은 방법이 있을수도 있다. 이렇게 수동 파티션 처리하는 것도 하나의 방법이라는 의미

### 조회 조건에 적절한 기본 범위 추가하기

대신, 파티셔닝을 사용하면 기본적인 조회도 파티션 키를 지정해줘야 한다.

그러지 않으면,

![](https://i.imgur.com/eS88Rb8.png)

전체 파티션을 스캔하게 된다.
물론, 각 파티션 내에서는 Primary key 인덱스를 타지만 불필요한 스캔을 유발시킨다.

![](https://i.imgur.com/x1c4PrT.png)

날짜만 알게 된다면 이렇게 빨리 처리 가능한데...

```java
// 파티션 키가 createdAt이므로, startDate와 endDate 을 제공해줘야만 전체 or 파티션 순회를 돌지 않는다.
public LocalDateTime getStartDate() {
	return startDate != null ? startDate : LocalDateTime.now().minusDays(90);
}

public LocalDateTime getEndDate() {
	return endDate != null ? endDate : LocalDateTime.now();
}
```

즉, 기본 검색에도 이렇게 의도적인 범위를 지정해주자.
추가로, id 를 통한 검색이 로직상 꼭 필요한지도 고민을 잘 해야한다. - 파티션을 모르고 검색하는 쿼리

---

이상으로 파티셔닝에 대해 간단하게 살펴봤다.
느낀점으론 확장이 일어나고, 데이터가 계속 삽입될 거라면 미리 파티셔닝을 적용하는 것도 좋은 방법인거 같다.

물론, 비즈니스 요구사항과 데이터는 어떻게 될 지 모르니 정답은 없겠지만.
