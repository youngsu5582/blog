---
title: "Creating Fake Data for Data Testing - Bash Script"
author: 이영수
date: 2024-10-08T13:07:32.472Z
tags: ['Sample Data', 'Shell Script', 'Wooteco', 'Index Test']
categories: ['Developer Productivity']
description: "This article was written while generating data for performance testing & meaningful data in a project."
image:
  path: https://velog.velcdn.com/images/dragonsu/post/e0298cb3-1c41-42bc-b537-d9c9f230e545/image.png
lang: en
permalink: /posts/creating-fake-data-for-data-testing-bash-script
---

> This post has been translated from Korean to English by Gemini CLI.

This article was written while generating data for performance testing & meaningful data in a project.
If there are any incorrect contents or other methods, please leave a comment or contact me at `joyson5582@gmail.com`! 

---

We need to create a lot of data.

This is because before actual operation, we need to check `whether indexes are well set according to queries` and `how long it takes`.
(Aren't you curious how fast your code responds to the web with millions of data? 🙂🙂)

Of course, when the data is small, adding indexes may not be a burden,
but when applying indexes in an environment with tens of millions of data, `load generation` + `READ/WRITE waiting during application` may occur.

So, how can we create a large amount of data?

Generative AI is becoming more convenient, and there are [Faker Libraries](https://faker.readthedocs.io/en/master/) that return arbitrary values,
but ultimately, for speed and convenience, I created it myself.

I will summarize how to create data step by step.

![350](https://i.imgur.com/GjmRFXz.png)

## Choosing a Language for Data Creation

There are three main categories of languages for creating data.

- Your programming language (`Python`, `Java`, `C`, etc.)
- Shell Script
- RDBMS Procedure

### Programming Language

Currently, most popular languages provide most functions as libraries.
From basic syntax to STL (Standard Template Library), HTTP Protocol (JSON Parse), File Writer, etc.

```python
while True:
    response = requests.get(
        f"{api_url}&per_page=10&page={page}",
        headers={
            "Authorization": token,
            "User-Agent": user_agent
        }
    )
    data = response.json()
    logins += [pull['user']['login'] for pull in data]
    ...

with open(file_name, 'w') as f:
    f.write("use corea;\n")
    f.write("SET foreign_key_checks = 0;\n")
...
```

#### Disadvantages

However, these programming languages may not be installed on instances (EC2, Azure Virtual Machines, etc.) by default.
(Python is installed on EC2 Ubuntu.)

You can write & execute files externally and
put the results internally, but it can take longer than expected or cause a load due to network IO.
-> Therefore, it is recommended to execute the data generation file internally.
### Shell Script

There is no need to worry about the disadvantages above. This is because it works universally anywhere if it is Linux-based.
Additionally, simple functions are provided.

```bash
while true; do
	# Fetch data from GitHub API
	
	response=$(curl -s \
	-H "Authorization: $token" \
	-H "User-Agent: $user_agent" \
	"$api_url&per_page=10&page=$page")

	...
done

echo "use corea;" >> $file_name
echo "SET foreign_key_checks = 0;" >> $file_name

# MEMBER
echo "INSERT INTO member (id,email,github_user_id,is_email_accepted,name,profile_id,profile_link,thumbnail_url,username) VALUES " >> $file_name

echo "($manager_id,'',1000000,0, 'MANAGER','$manager_id','','https://avatars.githubusercontent.com/u/98307410?v=4','youngsu5582')," >> $file_name

```

It can be implemented similarly to a programming language.

#### Disadvantages

You will face difficulties if you try to create complex data precisely, not just simple data.

- When making an API request, if you want to remove duplicates when extracting user IDs from the request.
- When you want to generate & save data by interacting with the other server or API.
### Procedure

Since it is created and executed directly in the DB, it can be the most intuitive method.
You don't have to worry about speed either.

```sql
DELIMITER $$

CREATE PROCEDURE create_room_procedure(
    IN p_manager_id INT, 
    IN p_create_room_size INT, 
    IN p_participant_size INT,
    IN p_repo_url VARCHAR(255),
    IN p_thumbnail_link VARCHAR(255),
    IN p_classification VARCHAR(50),
    IN p_title VARCHAR(100),
    IN p_matching_size INT
)
BEGIN
    DECLARE v_last_index INT;
    DECLARE v_member_id INT;
    DECLARE v_profile_id INT;
    DECLARE v_github_id INT;
    DECLARE v_username VARCHAR(100);
    DECLARE v_thumbnail VARCHAR(255);
    DECLARE v_room_id INT;
    DECLARE v_content VARCHAR(255);
    DECLARE v_time_offset INT DEFAULT 5;
    DECLARE v_current_datetime DATETIME;
    DECLARE v_recruitment_deadline DATETIME;
    DECLARE v_review_deadline DATETIME;

    -- Set current date and time
    SET v_current_datetime = NOW();

    -- Set recruitment and review deadlines
    SET v_recruitment_deadline = DATE_ADD(v_current_datetime, INTERVAL 3 DAY);
    SET v_review_deadline = DATE_ADD(v_current_datetime, INTERVAL 7 DAY);

    -- Insert manager into `member`
    INSERT INTO member (id, email, github_user_id, is_email_accepted, name, profile_id, profile_link, thumbnail_url, username)
    VALUES (p_manager_id, '', 1000000, 0, 'MANAGER', p_manager_id, '', 'https://avatars.githubusercontent.com/u/98307410?v=4', 'youngsu5582');

    -- Insert participants into `member` and `profile`
    SET v_last_index = p_participant_size - 1;
	...
```

#### Disadvantages
However, the disadvantage is that it is naturally difficult because I have hardly used it. (Currently, procedure-based design is rarely used.)
And, the functions it provides may also be few. (Because it is created with MySQL built-in functions)

## Exploring Data

It's not about writing code right away.
If you write it without thinking, you will get confused.

![350](https://i.imgur.com/GjmRFXz.png)

(Please look at the structure and number of columns with affection 🥲)

I will use the entity diagram provided by `IntelliJ`.
(Top `View` - `Tool Windows` - `Persistence`: A feature only available in Ultimate)

Currently, the arrows are:

- Room -> Member
- Profile <-> Member
- Participation -> Room
- Participation -> Member

(At this time, if relationships are not specified and it's by ID, it won't appear here. ⚠️ Be careful.)

The arrow means that the entity is connected to the target entity.
That is, if you put an ID when there is no target entity, an error occurs.

Thus, we can confirm that `Participation`, `Room`, `Member`, and `Profile` entities are needed.
Additionally, it is necessary to identify variable data at this time.

For example, Room has various columns.

`keyword`, `title`, `thumbnail_url`, etc. are important data when users view them directly, but they are not important when generating data.
Instead, data such as `status`, `matching_size`, `recruitment_deadline`, `review_deadline`, `member_id` are important when generating data.

> Currently, our logic changes depending on `status`, `recruitment_deadline`, and `review_deadline`.
(If `status` is OPEN and the deadline is reached, matching proceeds; if the review deadline passes, feedback and evaluations are organized.)

> The `member_id` of Room must also be entered in accordance with data integrity.
(If not, it will crash in the query logic.)

Thus, it is necessary to identify columns that need to be declared as variables and unimportant columns.
(It is difficult to make everything variable or meaningful. `+` Inefficient waste of time)


## Writing Code

First, I wrote the code as a shell script.
This is because I judged that there was no need to use complex functions + it can be used universally on Linux-based systems.

### Prior Knowledge

#### CURL & JQ

```bash
response=$(curl -s \
-H "Authorization: $token" \
-H "User-Agent: $user_agent" \
"$api_url&per_page=10&page=$page")
```

This is a command to send an HTTP request.

- `-s`: Does not output abnormal output.
- `-H`: Adds a header.
- `"$api_url&per_page=10&page=$page"`: Specifies the path to send the request (since it sends a GitHub request, it consists of API_URL + parameters).

Additionally, I used `jq`, a JSON Processor, to extract data.
(It is a command that can be used on Linux-based systems, and it is very convenient for extracting JSON data.)

```bash
logins=$(echo $response | jq -r '.[] | .user | .login')
```

If you pass data through a pipe, you can extract and use the data.

  - `-r`: Outputs as a string.
  - `'.[] | .user | .login'`: Extracts data.

#### Repetition

```bash
logins=("login1" "login2" "login3")
for login in $logins; do
    echo $login
done

for login in "${logins[@]}"; do
    echo $login
done
```

What is the difference between the two?
- `$logins` refers to the first element of the array. - Only 'login1' is output.
- `"${logins[@]}"` refers to all elements of the array. - 'login1', 'login2', 'login3' are output.

That is, you must use `"${logins[@]}"`.
`${#logins[@]}`: Tells you the length of the array.

```bash
for i in "${!ids[@]}"; do
    ...
done
```

```bash
last_index=$(( ${#ids[@]} - 1 ))
for i in $(seq 0 $last_index)
do
    ...
done
```
These two can use array indexes in the same way. - Outputs 0, 1, 2.

#### Conditional Statement

```bash
if [[ $i -eq $last_index ]]; then
    break;
else
fi
```

It consists of if-then, else, and fi.
- `-eq`: Means equal.


#### Time

```bash
current_datetime=$(date '+%Y-%m-%d %H:%M:%S')
```

This is a command to get the current time.

- `date '+%Y-%m-%d %H:%M:%S'`: Gets the current time in a defined format. (Year-Month-Day Hour:Minute:Second)

```bash
if [[ "$OSTYPE" == "darwin"* ]]; then
    recruitment_deadline=$(date -v+3d '+%Y-%m-%d %H:%M:%S')  # 3 days later
    review_deadline=$(date -v+7d '+%Y-%m-%d %H:%M:%S')       # 7 days later
else
    recruitment_deadline=$(date -d "+3 days" '+%Y-%m-%d %H:%M:%S')
    review_deadline=$(date -d "+7 days" '+%Y-%m-%d %H:%M:%S')
fi
```

This is a command to get the current time.
Darwin means Mac OS. (Linux should use the command below.)

### Code

Now that we're done with the prerequisites, shall we actually write the code?
(A tip: it's good to gather all variables and indexes that need to be changed at the top and mark them well with comments.)


```bash
matching_size=3
manager_id=100
create_room_size=3
member_id_index=1000000
profile_id_index=10000000
file_name="real.sql"

echo "use corea;" >> $file_name
echo "SET foreign_key_checks = 0;" >> $file_name

...

# MEMBER
echo "INSERT INTO member (id,email,github_user_id,is_email_accepted,name,profile_id,profile_link,thumbnail_url,username) VALUES " >> $file_name

for i in "${!ids[@]}"; do
    member_id=$(( $member_id_index + $i ))
    profile_id=$(( $profile_id_index + $i ))
    github_id="${ids[i]}"
    username="${logins[i]}"
    thumbnail="${avatar_urls[i]}"

    if [[ $i -eq $last_index ]]; then
        echo "($member_id,'','$github_id',0, '$username',$profile_id,'','$thumbnail','$username');" >> $file_name
    else
        echo "($member_id,'','$github_id',0, '$username',$profile_id,'','$thumbnail','$username')," >> $file_name
    fi
done

...

echo "SET foreign_key_checks = 1;" >> $file_name
```

If it needs to be a variable element, store it all in an array and then fetch and save each element.
At this time, the last element must have the comma removed. (If the comma is not removed, an error will occur.)

And, `member_id` and `profile_id` are each incremented by the index to prevent duplication with existing data. (This can be done according to your DB settings.)
Foreign keys are disabled at the beginning and enabled at the end. (To prevent SQL errors in case of any.)

In this way, we can create a large amount of data. Simple, right? 🥲

#### Additional Practice Code

```bash
# PARTICIPATION

echo "INSERT INTO participation (member_github_id,member_id,room_id,member_role) VALUES " >> $file_name

for i in $(seq 1 $create_room_size)
do
    room_id=$(( $room_index + $i ))
    for j in "${!ids[@]}"; do
        member_id=$(( $member_id_index + $j ))
        github_id="${ids[j]}"
        if [[ $i -eq $(( $create_room_size )) && $j -eq $participant_size ]]; then    
        # Be careful with commas and line endings
            echo "('$github_id', $member_id, $room_id,'BOTH');" >> $file_name
            break;
        else
            echo "('$github_id', $member_id, $room_id,'BOTH')," >> $file_name
        fi
    done
done

```

There will also be cases where data is created using a nested loop, as shown above.
(When specific participants are added to each room)

```bash
for i in $(seq 1 $create_room_size)
do
    # Every 10 rooms
    if (( i % 10 == 0 )); then
        time_offset=$((time_offset + 5))
    fi

    if [[ "$OSTYPE" == "darwin"* ]]; then
        # Set start time (continuously increase by 5 minutes from current time)
        initial_time=$(date -v+${time_offset}M '+%Y-%m-%d %H:%M:%S')  
    else
        initial_time=$(date -d "+$time_offset minutes" '+%Y-%m-%d %H:%M:%S')  
    fi

    room_id=$(( $room_index + $i ))
    status="PENDING"

    # Last setting
    if [[ $i -eq $(( $create_room_size )) ]]; then
        echo "(CONVERT_TZ('$initial_time', '+09:00', '+00:00'), $room_id, '$status');" >> $file_name
    else
        echo "(CONVERT_TZ('$initial_time', '+09:00', '+00:00'), $room_id, '$status')," >> $file_name
    fi
done
```

You can add data by continuously increasing the time.
(CONVERT_TZ was added to convert time to MySQL.)

### SQL, CREATE File Management

You can put these queries into a single file, but if the file becomes too large, you may not be able to put it into SQL.
(- max_allowed_packet: Maximum packet size for client-server communication, default: 16MB)

And, it can also cause memory shortage & performance degradation.

```bash
for i in "${!first_names[@]}"; do
    first_name="${first_names[i]}"
    echo "use corea;" >> "fake_member_$first_name.sql"
    echo "SET foreign_key_checks = 0;" >> "fake_member_$first_name.sql"

    echo "INSERT INTO member (id,email,github_user_id,is_email_accepted,name,profile_id,profile_link,thumbnail_url,username) VALUES " >> "fake_member_$first_name.sql"

    last_index=$(( ${#second_names[@]} - 1 ))  # Calculate last index

    for j in "${!second_names[@]}"; do
        index=$((index + 1))
        second_name="${second_names[j]}"
        name="$first_name $second_name"
        member_id=$(( 1000000 + index ))
        github_id=$(( 10000000 + index ))

        if [[ $j -eq $last_index ]]; then
            echo "($member_id,'',$github_id,0, '$name',$member_id,'','https://octodex.github.com/images/orderedlistocat.png','$name');" >> "fake_member_$first_name.sql"
        else
            echo "($member_id,'',$github_id,0, '$name',$member_id,'','https://octodex.github.com/images/orderedlistocat.png','$name')," >> "fake_member_$first_name.sql"
        fi
    done

    echo "SET foreign_key_checks = 1;" >> "fake_member_$first_name.sql"

    echo "SQL query generated in fake_member_$first_name file."
done
```

In this way, you can split and insert files.
Additionally, you can manage these generated files conveniently by starting them with a specific name.

For example,
If files that create data start with `create_xxx`, and files that insert SQL start with `fake_xxx`,

```bash
#!/bin/bash

for script in create_*.sh
do
    # Check if the file has execute permission
    if [[ ! -x "$script" ]]; then
        echo "Adding execute permission to $script..."
        chmod +x "$script"
    fi

    # Execute the script
    echo "Executing $script..."
    bash "$script"
done

echo "All create_*.sh scripts executed successfully."

```

This code grants permission and executes the creation.

```bash
#!/bin/bash

# MySQL connection information
MYSQ_USER="corea"
MYSQ_HOST="127.0.0.1"  
MYSQ_DB="corea"

# Password input prompt
echo "Enter MySQL password:"
read -s MYSQL_PASSWORD

# Execute all files starting with fake_ and ending with .sql in MySQL
for sql_file in fake_*.sql
do
    echo "Executing $sql_file..."
    mysql -u "$MYSQL_USER" -p$MYSQL_PASSWORD -h "$MYSQL_HOST" "$MYSQL_DB" < "clear.sql"
    mysql -u "$MYSQL_USER" -p$MYSQL_PASSWORD -h "$MYSQL_HOST" "$MYSQL_DB" < "$sql_file"
done

echo "All SQL files executed successfully."

```

In this way, you can easily insert all SQL files.

## Conclusion

Writing code to create data may not be that difficult.
However, it may not be easy to easily change the data size or change necessary values.

It seems that you should identify what data you need and write code by parameterizing and separating columns.

![350](https://i.imgur.com/ZJAzlzs.png)

Currently, our team is conducting such performance tests based on sample data. 👍👍
If you are curious about the code, please visit the [code-review-area repository link](https://github.com/woowacourse-teams/2024-corea) 🙂

```