---
title: "데이터 테스트를 위한 가짜 데이터 만들기 - Bash 스크립트"
author: 이영수
date: 2024-10-08T13:07:32.472Z
tags: ['샘플 데이터', '쉘 스크립트', '우테코', '인덱스 테스트']
categories: ['개발자 생산성']
description: 해당 내용은 프로젝트에서 성능 테스트 & 유의미한 데이터를 위한 데이터 생성을 하며 작성한 글입니다.
image:
  path: https://velog.velcdn.com/images/dragonsu/post/e0298cb3-1c41-42bc-b537-d9c9f230e545/image.png
lang: ko
permalink: /posts/creating-fake-data-for-data-testing-bash-script
---
해당 내용은 프로젝트에서 성능 테스트 & 유의미한 데이터를 위한 데이터 생성을 하며 작성한 글입니다.
혹시, 잘못된 내용이나 다른 방법등이 있다면 댓글로 또는 `joyson5582@gmail.com`로 남겨주세요!

---

우리는 많은 데이터를 만들 필요가 있습니다.

실제, 운영을 하기 전 `쿼리에 맞게 인덱스가 잘 설정되어 있는지`  `속도는 얼마나 걸리는지` 를 확인해야 하기 때문입니다.
( 자신이 작성한 코드가 100만 건 정도의 많은 데이터를 얼마나 빨리 웹에 응답하는지 궁금하지 않나요? 🙂🙂 )

물론, 데이터가 작을 때는 인덱스를 추가 적용하는게 부담이 되지 않을 수 있으나
몇천만건 데이터가 있는 환경에서 인덱스를 적용할 시, `부하 유발` + `적용 동안 READ/WRITE 대기 `가 발생할 수 있기 때문입니다.

그러면, 데이터를 어떻게 대량으로 만들 수 있을까요?

생성형 AI 가 편해지고, 임의 값들을 반환하는 [Faker Library](https://faker.readthedocs.io/en/master/) 들이 있지만
결국 속도 및 편의성을 위해서는 직접 만들었습니다.

하나씩 단계별로 데이터를 만드는 방법을 정리해보겠습니다.

![350](https://i.imgur.com/GjmRFXz.png)

## 데이터 만드는 언어 정하기

데이터를 만드는 언어로는 크게 3가지 범주가 있습니다.

- 자신이 사용하는 프로그래밍 언어 ( `Python`, `Java`, `C` 등등)
- 쉘 스크립트 ( Shell Script )
- RDBMS 프로시저(Procedure) 

### 프로그래밍 언어

현재, 유명한 언어들은 대부분의 기능들을 라이브러리로 제공 해줍니다.
기초적인 문법부터 시작해서 STL(Standard Template Library), HTTP Protocol(JSON Parse), File Writer 등등 말이죠.

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

#### 단점

하지만, 이런 프로그래밍 언어들은 기본적으로 인스턴스(EC2,Azure Virtual Machines 등) 에 설치가 안 되어 있을 수 있습니다.
( 파이선은 EC2 Ubuntu 에 설치 되어있습니다. )

외부에서 파일을 작성 & 실행해서
결과물을 내부로 넣을 수 있지만 네트워크 IO 때문에 생각보다 오래 걸리거나 또는 부하가 올 수 있습니다.
-> 그렇기에, 데이터 생성 파일을 내부에서 실행해서 넣는걸 추천합니다.
###  쉘 스크립트

위의 단점들을 신경 쓸 필요가 없습니다. 리눅스 기반이라면 어디든 공통적으로 작동하기 떄문입니다.
추가적으로, 간단한 기능들은 제공이 되어 있습니다.

```bash
while true; do
	# GitHub API에서 데이터를 가져옴
	
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

와 같이 프로그래밍 언어와 비슷하게 구현이 가능합니다.

#### 단점

단순한 데이터가 아닌 복잡한 데이터를 정교하게 만들려고 하면 어려움을 맞이하게 됩니다.

- API 요청을 날리는데, 요청에서 사용자 ID 를 추출하는데 중복을 제거하고 싶은 경우
- 상대방 서버 or API 에 상호작용을 하며 데이터를 생성 & 저장하고 싶은 경우
### 프로시저

DB 에 직접적으로 만들고 실행하기에, 가장 직관적인 방법일 수 있습니다.
속도도 신경 쓸 필요가 없을테니까요.

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

#### 단점
하지만, 단점이라면 사용해 본적이 거의 없기에 당연히 어렵습니다. ( 현재는 프로시저를 사용하는 설계를 거의 안하기도 합니다. )
그리고, 제공해주는 기능들도 적을 수 있습니다. ( MySQL 내장 함수로 만들므로 )

## 데이터 살펴보기

코드를 바로 작성하는 것이 아닙니다.
무턱대고, 바로 작성하면 혼란이 오게 됩니다.

![](https://i.imgur.com/GjmRFXz.png)

( 구조 및 칼럼 개수 등은 애정으로 봐주세요 🥲 )

`Intellij` 에서 제공 해주는 엔티티 다이어그램을 사용해보겠습니다.
( 상단 `View` - `Tool Windows` - `Persistence` : Ultimate 에만 있는 기능 )

현재, 화살표가
- Room -> Member
- Profile <-> Member
- Participation -> Room
- Participation -> Member

과 같이 되어 있습니다. ( 이때, 연관관계를 지정하지 않고, id 로 되어 있으면 여기서 뜨지 않습니다. ⚠️ 주의 해야 합니다. )

화살표는 해당 엔티티가 대상 엔티티와 연결이 되어 있음을 의미합니다. 
즉, 대상 엔티티가 없는데 ID 를 넣으면 에러가 발생합니다.

그렇게 저희는 `Participation`,`Room`,`Member`,`Profile` 엔티티가 필요함을 확인 할 수 있습니다.
추가적으로, 이때 가변적인 데이터를 식별하는 것이 필요합니다.

예시로, Room 에는 다양한 칼럼이 있습니다.

`keyword`, `title`, `thumbnail_url` 등은 사용자가 직접 볼때는 중요한 데이터이지만, 데이터를 생성할때는 중요하지 않습니다.
대신, `status`, `matching_size`, `recruitment_deadline`, `review_deadline` `member_id` 등의 데이터는 생성할때 중요합니다.

> 현재 저희 로직은 `status`,`recruitment_deadline`,`review_deadline` 에 따라서 처리 로직이 달라집니다. 
( status 가 OPEN 이며, 마감 기한이 되면 매칭을 진행, 리뷰 기한이 지나면 피드백 및 평가를 정리합니다. )

> Room 이 가지는 member_id 역시 데이터의 정합성에 맞게 넣어야 합니다.
( 없으면, 조회 로직에서 터집니다. )

이렇게 가변적으로 선언해야 할 칼럼과 중요하지 않은 칼럼들을 식별하는 것이 필요합니다.
( 모든 걸 전부 다 가변으로 만들거나, 의미있게 만드는 것은 어렵습니다. `+` 비효율적인 시간 낭비 )


## 코드 작성

우선, 코드는 쉘 스크립트로 작성했습니다.
복잡한 기능들을 사용할 필요가 없다고 판단 + 리눅스 기반에서 범용적으로 사용할 수 있기 때문입니다.

### 사전 지식

#### CURL & JQ

```bash
response=$(curl -s \
	-H "Authorization: $token" \
	-H "User-Agent: $user_agent" \
	"$api_url&per_page=10&page=$page")
```

HTTP 요청을 보내는 명령어입니다.

- `-s` : 비정상적인 출력을 하지 않는다.
- `-H` : 헤더를 추가
- `"$api_url&per_page=10&page=$page"` : 요청을 보낸 경로 지정 ( 깃허브 요청을 보내므로 API_URL + 파라미터로 구성 되어 있습니다. )

추가로, `jq` 라는 Json Processor 를 사용해서 데이터를 추출했습니다.
( 리눅스 기반에서 사용할 수 있는 명령어로, JSON 데이터를 추출하는데 매우 편리합니다. )

```bash
logins=$(echo $response | jq -r '.[] | .user | .login')
```

파이프를 통해 데이터를 전달하면, 데이터를 추출해서 사용할 수 있습니다.

  - `-r` : 문자열로 출력
  - `'.[] | .user | .login'` : 데이터를 추출

#### 뱐뵥몬

```bash
logins=("login1" "login2" "login3")
for login in $logins; do
    echo $login
done

for login in "${logins[@]}"; do
    echo $login
done
```

두 개의 차이점이 뭘까요?
- `$logins` 는 배열의 첫 번째 요소를 가리킵니다. - 'login1' 만 출력
- `"${logins[@]}"` 는 배열의 모든 요소를 가리킵니다. - 'login1', 'login2', 'login3' 가 출력

즉, `"${logins[@]}"` 를 사용해야 합니다.
`${#logins[@]}` : 배열의 길이를 알려줍니다.

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
이 두개는 동일하게 배열의 인덱스를 사용할 수 있습니다. - 0,1,2 출력

#### 조건문

```bash
if [[ $i -eq $last_index ]]; then
    break;
else
fi
```

if-then , else , fi 로 구성되어 있습니다.
- `-eq` : 같다를 의미


#### 시간

```bash
current_datetime=$(date '+%Y-%m-%d %H:%M:%S')
```

현재 시간을 가져오는 명령어입니다.

- `date '+%Y-%m-%d %H:%M:%S'` : 현재 시간을 정해진 형식으로 가져온다. ( 년-월-일 시:분:초 )

```bash
if [[ "$OSTYPE" == "darwin"* ]]; then
    recruitment_deadline=$(date -v+3d '+%Y-%m-%d %H:%M:%S')  # 3일 후
    review_deadline=$(date -v+7d '+%Y-%m-%d %H:%M:%S')       # 7일 후
else
    recruitment_deadline=$(date -d "+3 days" '+%Y-%m-%d %H:%M:%S')
    review_deadline=$(date -d "+7 days" '+%Y-%m-%d %H:%M:%S')
fi
```

현재 시간을 가져오는 명령어입니다.
darwin 은 맥 운영체제를 의미합니다. ( 리눅스는 밑에 있는 명령어를 사용해야 합니다. )

### 코드

이제 사전 지식에 대해 끝났고, 정말 코드를 작성해볼까요?
( 추천하는 팁이라면, 가변해야 하는 변수 및 인덱스들은 최상단에 모두 모아두고, 주석으로 잘 표시해두는게 좋습니다. )


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

가변적인 요소여야 한다면, 배열에 다 저장하게 해놓고 각 요소들을 가져와서 저장해줍니다.
이때, 마지막 요소는 쉼표를 제거해줘야 합니다. ( 쉼표를 제거하지 않으면 오류가 발생합니다. )

그리고, member_id 와 profile_id 는 각각 인덱스를 더해줘서 기존 데이터에 중복되지 않게 만들어줍니다. ( 이는, 각자 DB 설정에 맞게 해주면 됩니다. )
처음 외래키를 비활성화, 마지막에 외래키를 활성화 해줍니다. ( 혹시나, SQL 오류 발생 방지 )

이렇게 하면, 저희는 데이터를 대량으로 만들 수 있습니다. 간단하죠? 🥲

#### 추가적인 실습 코드

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
        # 쉼표와 줄 끝 처리에 주의
            echo "('$github_id', $member_id, $room_id,'BOTH');" >> $file_name
            break;
        else
            echo "('$github_id', $member_id, $room_id,'BOTH')," >> $file_name
        fi
    done
done

```

와 같이 2중 반복문을 사용해서 데이터를 만드는 경우도 존재할 겁니다.
( 방마다 특정 참여자들을 참가시키는 경우 )

```bash
for i in $(seq 1 $create_room_size)
do
    # 방 10개 마다
    if (( i % 10 == 0 )); then
        time_offset=$((time_offset + 5))
    fi

    if [[ "$OSTYPE" == "darwin"* ]]; then
        # 시작 시간 설정 (현재 시간 기준으로 5분 씩 계속 증가)
        initial_time=$(date -v+${time_offset}M '+%Y-%m-%d %H:%M:%S')  
    else
        initial_time=$(date -d "+$time_offset minutes" '+%Y-%m-%d %H:%M:%S')  
    fi

    room_id=$(( $room_index + $i ))
    status="PENDING"

    # 맨 마지막 설정
    if [[ $i -eq $(( $create_room_size )) ]]; then
        echo "(CONVERT_TZ('$initial_time', '+09:00', '+00:00'), $room_id, '$status');" >> $file_name
    else
        echo "(CONVERT_TZ('$initial_time', '+09:00', '+00:00'), $room_id, '$status')," >> $file_name
    fi
done
```

시간을 계속 늘어나게 데이터를 넣을 수 있습니다.
( CONVERT_TZ 는 MYSQL 에 시간 변환을 해서 넣으려고 추가한 겁니다. )

### SQL, CREATE 파일 관리

이런 쿼리들을 하나의 파일에 넣을수는 있지만 파일이 너무 커지면 SQL 에 넣지 못할 수 있습니다.
( - max_allowed_packet : 클라이언트 - 서버 송수신 하는 최대 패킷 크기, 기본 : 16MB )

그리고, 추가로 메모리 부족 & 성능 저하를 유발할 수 있습니다.

```bash
for i in "${!first_names[@]}"; do
    first_name="${first_names[i]}"
    echo "use corea;" >> "fake_member_$first_name.sql"
    echo "SET foreign_key_checks = 0;" >> "fake_member_$first_name.sql"

    echo "INSERT INTO member (id,email,github_user_id,is_email_accepted,name,profile_id,profile_link,thumbnail_url,username) VALUES " >> "fake_member_$first_name.sql"

    last_index=$(( ${#second_names[@]} - 1 ))  # 마지막 인덱스 계산

    for j in "${!second_names[@]}"; do
        index=$((index + 1))
        second_name="${second_names[j]}"
        name="$first_name $second_name"
        member_id=$(( 1000000 + index ))
        github_id=$(( 10000000 + index ))

        if [[ $j -eq $last_index ]]; then
            echo "($member_id,'','$github_id',0, '$name',$member_id,'','https://octodex.github.com/images/orderedlistocat.png','$name');" >> "fake_member_$first_name.sql"
        else
            echo "($member_id,'','$github_id',0, '$name',$member_id,'','https://octodex.github.com/images/orderedlistocat.png','$name')," >> "fake_member_$first_name.sql"
        fi
    done

    echo "SET foreign_key_checks = 1;" >> "fake_member_$first_name.sql"

    echo "SQL 쿼리가 fake_member_$first_name 파일에 생성되었습니다."
done
```

이렇게 하면, 파일을 나눠서 넣을 수 있습니다.
추가로, 이런 생성하는 파일들도 특정 이름으로 시작되게 해서 편리하게 관리할 수 있습니다.

예를 들어
데이터를 만드는 파일들은 `create_xxx` 로 시작하고, SQL 을 넣는 파일들은 `fake_xxx`로 시작한다면

```bash
#!/bin/bash

for script in create_*.sh
do
    # 파일에 실행 권한이 있는지 확인
    if [[ ! -x "$script" ]]; then
        echo "Adding execute permission to $script..."
    chmod +x "$script"
    fi

    # 스크립트 실행
    echo "Executing $script..."
    bash "$script"
done

echo "All create_*.sh scripts executed successfully."

```

권한을 부여하고, 생성을 실행하는 코드입니다.

```bash
#!/bin/bash

# MySQL 연결 정보
MYSQL_USER="corea"
MYSQL_HOST="127.0.0.1"  
MYSQL_DB="corea"

# 패스워드 입력 프롬프트
echo "Enter MySQL password:"
read -s MYSQL_PASSWORD

# fake_ 로 시작하고 .sql 로 끝나는 모든 파일을 MySQL에 실행
for sql_file in fake_*.sql
do
    echo "Executing $sql_file..."
    mysql -u "$MYSQL_USER" -p$MYSQL_PASSWORD -h "$MYSQL_HOST" "$MYSQL_DB" < "clear.sql"
    mysql -u "$MYSQL_USER" -p$MYSQL_PASSWORD -h "$MYSQL_HOST" "$MYSQL_DB" < "$sql_file"
done

echo "All SQL files executed successfully."

```

이렇게 하면, 모든 SQL 파일들을 간편하게 넣을 수 있습니다.

## 결론

데이터를 만드는 코드를 작성하는 건 그렇게 어렵지 않을 수 있습니다.
하지만, 데이터 크기를 쉽게 변하게 하거나 필요한 값들을 변경하는 것은 쉽지 않을 수 있습니다.

자신이, 필요한 데이터가 뭔지 잘 파악하고 칼럼들을 변수화 및 분리하여 코드를 작성하면 될 것 같습니다.

![350](https://i.imgur.com/ZJAzlzs.png)

현재, 저희팀은 샘플 데이터를 기반으로 이런 성능 테스트를 진행하고 있습니다. 👍👍
코드가 궁금하다면, [code-review-area 레포지토리 링크](https://github.com/woowacourse-teams/2024-corea) 찾아와주세요 🙂

```