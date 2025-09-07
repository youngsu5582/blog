lang: en
---
title: ''
author: Lee Youngsoo
date: 2025-09-07T13:45:38.434Z
tags:
  - PostgreSQL
  - Partitioning
  - Database
  - Performance Optimization
description: This post discusses performance optimization techniques using RANGE partitioning in PostgreSQL. It provides tips and examples to enhance data retrieval efficiency.
image:
  path: assets/img/thumbnail/2025-09-07-partitioning-in-postgresql.png
page_id: partitioning-in-postgresql
---
## 📋 Draft Title
Exploring Partitioning in PostgreSQL

## 📝 Draft Content (Markdown)
> This content only covers RANGE partitioning.

The simplest way to optimize performance in a database is indexing. Most RDBMS use B-Tree due to its structure, allowing data to be read with a time complexity of O(logN).

> log₂(1,000,000,000) is approximately 30. Searching through a billion data entries requires only 30 iterations!

However, indexing does not solve everything.

In the end, INSERT, UPDATE, DELETE operations require modifications to the index tree (causing I/O load, write amplification, etc.).

Additionally, sequential values (id, timestamp) are only inserted into the rightmost leaf page in a B-Tree structure.
-> They compete to lock the latch of the page (Last Page Hotspot)
=> Potentially causing performance degradation.

> Of course, this may vary depending on the RDBMS.
> PostgreSQL remembers the previously inserted page, and if it's the 'right leaf', it caches the block and tries immediately.
> [Re: pgsql: Optimize btree insertions for common case of increasing values](https://www.postgresql.org/message-id/CAH2-WzkpJd5TP6uRCqa473mzZCNsVk5KjE3xrs-4%3DFfFiAMHog%40mail.gmail.com)
> Refer to the `_bt_search_insert()` part in the [PostgreSQL Source Code](https://doxygen.postgresql.org/nbtinsert_8c.html#a137ae10f1b043d662b679e87d981ad10).

![](https://i.imgur.com/Ky4vOFE.png)

- It checks if the page is still the rightmost leaf page, if there is enough space to insert the new tuple, and if the key being inserted is greater than the highest key on the page.
-> If it passes the process, it returns NULL, caching the existing block.

Anyway, if you feel the limitations of indexes or if your data characteristics are like the ones below, consider applying partitioning.

If data does not require querying all entries?

- Data for users' daily or monthly service usage: credits, cookies, points, etc.
- Archive data: user activity log, admin user audit log, data change history

Not all table data is used, so there's no need to manage or process them together.

## Table Structure

### Limitations of a Single Table

- A single logical table maps onto a single heap file set on the disk, storing all tuples of the table.
When INSERT occurs, data is placed sequentially in the empty spaces of the heap file, and the index stores these addresses.

If such a heap file exceeds a certain size (default 1 GB), a new heap file is created, and data continues to be stored.
(This collection of files is the heap file set)
-> As the table grows, the size of these files can reach hundreds of GB or TB.

- Without an index, there is a possibility of causing enormous disk I/O and exhausting available I/O bandwidth.
Even if using an index to find files, we must access all the scattered data blocks throughout the heap file set to retrieve actual data.
-> Causes potential random I/O due to nonstop disk head movement

- Due to the nature of PostgreSQL, VACUUM tasks occur to clean up dead tuples.
Such VACUUM tasks also scan the entire table. (What if it's a FULL VACUUM?)

- Data has a lifespan.
For instance, consider the possibility of having to dispose of old data due to security policies.
If there's a directive to only retain data for the last three years out of ten years worth of stored data.

Handling such deletion while requiring uninterrupted deployment? ☠️
(It might be more feasible to attempt data synchronization, work from another table, and change routing...)

### Partitioned Table

A partitioned table is a logical container that stores no actual data.
Actual data is stored in separate partitions, each treated as a distinct table.

Internally, they have completely independent physical files (relfilenode) and indexes.
Additionally, they can avoid disk I/O contention with other partitions. (`+` With frequently accessed blocks having a higher probability of residing in memory, increasing cache hit rates)

> relfilenode?
> An internal identifier pointing to a physical data file (actual file names within the DB data directory)
> <-> Logically identifying an object is done via OID (Object ID)
> By separating OID from relfilenode, commands that involve switching entire physical files are processed very efficiently.
> (such as TRUNCATE, VACUUM FULL, REINDEX - not deleting millions of entries directly but updating to point to a new relfilenode)

Each partition has its own small, independent index, allowing control of the index depth.
(If done by date, it can maintain a specified amount continuously)

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

Upon application, you can see that the total table size and the partitioned table size are appropriately divided.

## Partition Pruning

One of the reasons for using partitioning

The query planner analyzes the conditions in the WHERE clause, excluding partitions irrelevant to query execution from the search.

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT COUNT(*) FROM logs_single
WHERE created_at >= '2024-09-01 00:00:00 KST' AND created_at < '2024-10-01 00:00:00 KST';
```

> A table using created_at as the partition key

Assuming about 240 million entries were inserted with the help of GEMINI.

![](https://i.imgur.com/fI4Nn5O.png)

Without applying the index, it takes about 11 seconds.

![](https://i.imgur.com/wzUY5DP.png)

>0.8 seconds execution

- parallel index only scan: Reads from the index without reading the table body, completed by 3 processors (1 main, 2 workers)
-> Essentially performing a range scan of one month's worth of data from a large index

![](https://i.imgur.com/4xGAtp7.png)

> 0.9 seconds execution

- Parallel Seq Scan on logs_p2023_05 logs_partitioned: Partition pruning is functioning
-> Confirm that it's not the `logs_partitioned` table but `logs_p2023_05` (only 1 among several tables is selected)

Then why should we use partitioning if there's little difference in performance time?

The difference becomes clear when you look at the amount of processed blocks.

- Buffers shared hit=10086399 read=16043: 10,102,442 blocks processed through memory and disk
- Buffers: shared read=103093: Only 103,093 blocks processed

If blocks are not in memory, the targets to be read increase eventually.
-> Total CPU time increases, occupying a lot of space in memory cache, polluting the buffer (pushing out other important data)

=> Partitioning and pruning help maintain consistent performance even with long-term data growth.

## Practical Tips for Partitioning

### Always Create created_at in Advance If Possible

You might sometimes wonder, 'Is created_at necessary for the entity?'

[Do you have "created_at" and "last_update_at" fields on all your tables/entities? Yes? No? Why? Is it good/bad practice?](https://www.reddit.com/r/webdev/comments/1cez61c/do_you_have_created_at_and_last_update_at_fields/)

Reading the content, the conclusion is that it is almost a very good habit to include them in all tables.

1. You will regret it later: It might not seem necessary initially, but can become essential later on.
2. For debugging and data tracking: Knowing when an entry was created or modified is crucial when dealing with data-related issues.
3. Useful for cache invalidation: Verifying the last update time can easily help determine whether data is still valid or needs refreshing.

Applying an index to the created_at column for about 240 million entries results in

![](https://i.imgur.com/vVl9s0V.png)

Taking about 1 minute and 8 seconds. If more massive data accumulates...? It will affect non-stop operations.
So, creating and processing it in advance when necessary is the cleanest approach.

> When there were about 50 million entries, it only took less than 5 minutes to create and index the column on the actual operational table...

> Do you need to index only created_at? I thought it wasn't necessary, but
> For sorting requirements, it's probably okay to index a single column.
> [Is there any benefit to indexing 'created_at' column?](https://laracasts.com/discuss/channels/eloquent/is-there-any-benefit-to-indexing-created_at_column)
> According to the content, an 'Out of sort memory' error occurs when sorting without an index.
> (Performing either in-memory or file sorting work)

### Incremental Partitioning (Legacy Partitioning)

How to replace existing non-partitioned data with a partitioned table?
Assume this data doesn't have a created_at column, and the column isn't indexed.

> Partitioning requires indexing on the column to be partitioned.

It can be handled by creating a new table with partitioning applied, and redirecting to it without applying partitioning directly.

```sql
CREATE OR REPLACE VIEW logs AS  
SELECT id, log_level, message, created_at FROM logs_temp  
UNION ALL  
SELECT id, log_level, message, created_at FROM logs_parent;

ALTER TABLE logs_parent  
    ALTER COLUMN id SET DEFAULT nextval('logs_temp_id_seq'::regclass);
```

Create a VIEW with data from both the old and new tables
Assign the parent's Sequence

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

- Declare a cutoff at the initial time of function declaration
	- If before the specified time, INSERT/UPDATE in the old (non-partitioned) table
	- If after the specified time, INSERT/UPDATE in the current (partitioned) table

```sql
-- 3) INSTEAD OF INSERT trigger
DROP TRIGGER IF EXISTS trg_client_union_insert ON client;
CREATE TRIGGER trg_client_union_insert
    INSTEAD OF INSERT
    ON client
    FOR EACH ROW
EXECUTE FUNCTION trg_client_union_mod();

-- 4) INSTEAD OF UPDATE trigger
DROP TRIGGER IF EXISTS trg_client_union_update ON client;
CREATE TRIGGER trg_client_union_update
    INSTEAD OF UPDATE
    ON client
    FOR EACH ROW
EXECUTE FUNCTION trg_client_union_mod();
```

Then, set a trigger so that when INSERT/UPDATE enters the VIEW, the trigger functions.

=> Once the old data accumulates enough and is no longer necessary, remove the VIEW and use only the partitioned table.

```
BEGIN;

DROP TRIGGER IF EXISTS trg_client_union_insert ON client;
DROP TRIGGER IF EXISTS trg_client_union_update ON client;

-- drop client if it is a view only
DO $$
    BEGIN
        EXECUTE 'DROP VIEW IF EXISTS client';
    EXCEPTION
        WHEN wrong_object_type THEN
            -- Ignore if not a view (but a table)
            NULL;
    END$$;
ALTER TABLE IF EXISTS client_temp RENAME TO client;
COMMIT;
```

> Of course, there might be better methods. This manual partitioning method is just one possible approach.

### Add Suitable Default Range to Query Conditions

Instead, when using partitioning, you must specify the partition key even in basic queries.

If not,

![](https://i.imgur.com/eS88Rb8.png)

It scans the entire partition.
Of course, within each partition, it follows the Primary key index, but it causes unnecessary scans.

![](https://i.imgur.com/x1c4PrT.png)

If you only know the date, it can be processed this quickly...

```java
// Since createdAt is the partition key, startDate and endDate must be provided to avoid scanning the entire or multiple partitions.
public LocalDateTime getStartDate() {
	return startDate != null ? startDate : LocalDateTime.now().minusDays(90);
}

public LocalDateTime getEndDate() {
	return endDate != null ? endDate : LocalDateTime.now();
}
```

So, even in basic searches, specify an intentional range like this.
Additionally, consider whether searching via id is essential in your logic - query searching without knowing the partition.

---

This concludes a brief exploration of partitioning.
My impression is that if expansion is expected and data will continuously be inserted, applying partitioning in advance is a good method.

Of course, business requirements and data are unpredictable, so there are no definite answers.