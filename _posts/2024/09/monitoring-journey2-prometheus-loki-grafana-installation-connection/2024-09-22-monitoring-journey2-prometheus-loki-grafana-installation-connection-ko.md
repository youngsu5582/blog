---
title: "모니터링 이동기(2) - 프로메테우스,로키,그라파나 설치 & 연결"
author: 이영수
date: 2024-09-22T14:18:59.588Z
tags: ['그라파나', '로키', '모니터링', '우테코', '프로메테우스']
description: 프로메테우스 로키 그라파나 직접 설치부터 연결&시각화 A To Z 까지
categories: ['인프라', '모니터링']
image:
  path: https://velog.velcdn.com/images/dragonsu/post/d92cfb4a-aeac-45b4-8ccc-a3c4be3b8b5e/image.jpeg
lang: ko
permalink: /posts/monitoring-journey2-prometheus-loki-grafana-installation-connection
---
해당 내용은 프로젝트 중 로키-프로메테우스-그라파나를 통해 모니터링을 내부 인스턴스에 직접 설치하는 방법들로 구성이 되어 있습니다.
혹시, 잘못된 내용이나 더 편한 방법이 있다면 댓글로 또는 `joyson5582@gmail.com`로 남겨주세요!

이 내용은[앞 내용](https://velog.io/@dragonsu/%EB%AA%A8%EB%8B%88%ED%84%B0%EB%A0%81-%EC%9D%B4%EB%8F%99%EA%B8%B01-%ED%94%84%EB%A1%9C%EB%A9%94%ED%85%8C%EC%9A%B0%EC%8A%A4%EB%A1%9C%ED%82%A4%EA%B7%B8%EB%9D%BC%ED%8C%8C%EB%82%98%EB%93%A4%EC%9D%B4-%EB%AD%90%EC%A7%80)에서부터 이어진다.
## 사전 지식
해당 내용들은 EC2 Ubuntu(아키텍처 - 64비트 Arm) 로 진행했다.
각 서비스들은 EC2 를 전부 따로 파서 설치했다. - 변경 용이
- 그라파나를 제외한 인스턴스는 전부 퍼블릭 IP가 존재하지 않는 내부 인스턴스들이다.
- 내부 각 인스턴스로 들어가는 법은 자세히 설명하지 않을것이다. ( Public EC2에 Key.pem 넣어서 내부 이동 가능 )

```bash
# `systemd` 에게 서비스 생성 파일이 변경되었음을 알리고, 새롭게 로드하게 함
sudo systemctl daemon-reload

# 서비스를 시작
sudo systemctl start prometheus.service

# 서비스를 자동 시작으로 설정
sudo systemctl enable prometheus.service

# 서비스를 재시작
sudo systemctl restart prometheus.service

# 서비스를 상태 확인
sudo systemctl status prometheus.service
```

이떄, 이런 명령어들을 바로 치면 `status` 가 구동중일때 RUNNING 을 띄우는 경우가 있다.
이를 모르고 넘어가면, 한참 헤맬수 있으니 ( 🥲🥲 ) status 는 기다렸다가 한 번 더 쳐보자.

즉, 서비스가 바뀌면?

```
sudo systemctl daemon-reload
sudo systemctl restart prometheus.service
```

서비스 파일 다시 로그 -> 재시작

설정 파일이 바뀌면?

```
sudo systemctl reload prometheus.service
```

reload 만 해도 되나, 왠만하면 `restart` 를 하자.
## Prometheus

시작으로, 프로메테우스를 설치할 인스턴스로 들어가자.

```bash
wget https://github.com/prometheus/prometheus/releases/download/v2.54.1/prometheus-2.54.1.linux-arm64.tar.gz

tar -xvzf prometheus-2.54.1.linux-arm64.tar.gz
```

realses 를 들어가서, 자신에게 맞는 파일을 설치하고, 압축을 푼다.
압축을 풀고 들어간후 `vi prometheus.yml` 을 통해 설정을 수정하자.

```yml
global:
  scrape_interval: 15s # Set the scrape interval to every 15 seconds. Default is every 1 minute.
  evaluation_interval: 15s # Evaluate rules every 15 seconds. The default is every 1 minute.
  # scrape_timeout is set to the global default (10s).

scrape_configs:
  - job_name: "prometheus"
    static_configs:
      - targets: ['localhost:9100']

 - job_name: "develop-database"
    static_configs:
      - targets: ['내부서버<IP:포트>']
        labels:
          alias: 'Dev DB'
          
  - job_name: 'develop-server'
    metrics_path: '/actuator/prometheus'
    static_configs:
      - targets: ['내부서버<IP:포트>']
        labels:
          alias: 'Dev Server'
```

- scrape_configs 는 모니터링할 다양할 작업들을 정의하는 부분이다.
( 사실, prometheus 를 웹으로 보여줄게 아니라면 `job_name:"prometheus"` 부분은 필요없긴 하나, 내부 요청을 통해 확인하기 위해 삭제하지 않았다. )

- static_configs 는 수집할 메트릭 타겟을 고정적으로 정의하는 부분이다.
	- metrics_path : 매트릭 요청을 보낼 경로
	- 우리가 요청에, 추가적으로 라벨을 붙힐 수 있다.
( AWS EC2 는 내부 IP 가 바뀔 우려가 있으므로, 라벨을 통해 식별한다. - 서비스 디스커버리를 통해 동적으로 찾을 수 있으나 이는 아주 나중에 구현 해볼 예정 )

폴더에 보면 `promtool` 이 있는데

```
./promtool check config prometheus.yml

Checking prometheus.yml
 SUCCESS: prometheus.yml is valid prometheus config file syntax
```

이를 통해 config 파일의 문법을 검사 가능하다.

내부 설정은 완료햇으니
이제 서비스 파일 설정을 해보자.

`sudo vi /etc/systemd/system/prometheus.service`
를 통해 서비스를 생성해보자.

```
[Unit]
Description=Prometheus Server
Wants=network-online.target
After=network-online.target

[Service]
User=root
Group=root
Type=simple
ExecStart=/home/ubuntu/prometheus-2.54.1.linux-arm64/prometheus \
        --config.file=/home/ubuntu/prometheus-2.54.1.linux-arm64/prometheus.yml \
        --web.listen-address=":80"
[Install]
WantedBy=multi-user.target
```

- `Wants`, `After` 는 서비스가 실행되기 전 네트워크(network-online)가 켜져있길 원하고 완전히 설정된 후 실행되게 한다.
- `User`,`Group` 은 사용자를 따로 만들어서 해도 되나, 오버 엔지니어링 같아서(어차피 내부 서버 + key 필요) root로 지정했다.
- `Type` 을 simple 로 지정시, 단일 프로세스로 `ExecStart` 의 명령어를 실행한다.
- `ExecStart` 에서 실행 파일을 지정 + 옵션을 설정했다.
- `WantedBy` 는 서비스가 자동으로 시작되게 해준다.

```
sudo systemctl daemon-reload
sudo systemctl start prometheus.service
sudo systemctl enable prometheus.service
sudo systemctl restart prometheus.service
sudo systemctl status prometheus.service
```

해당 명령어를 친 후

![](https://i.imgur.com/CAkFNBm.png)

이렇게 나온다면 성공적이다.
### MySQL Exporter 설치
> 왜 설치하는가?
> 
> DB 에서 직접적으로 필요한 정보들을 추출하는건 매우 어렵다.
> 해당 Exporter 를 통해 필요한 정보를 추출 및 전송을 간편하게 해준다.

MySQL 이 설치되어 있는 내부 Instance 로 이동하자.

```
```bash
wget https://github.com/prometheus/mysqld_exporter/releases/download/v0.14.0/mysqld_exporter-0.14.0.linux-arm64.tar.gz
tar xzvf mysqld_exporter-0.14.0.linux-arm64.tar.gz
```

폴더로 이동해서 `vi mysqld_exporter.cnf` 설정을 만들자.

```
[client]
user=exporter
password=exporter_password
```

그 후, MySQL 내에 접속해서

```sql
CREATE USER 'exporter'@'localhost' IDENTIFIED BY 'exporter_password' WITH MAX_USER_CONNECTIONS 2; 
GRANT PROCESS, REPLICATION CLIENT, SELECT ON *.* TO 'exporter'@'localhost'; 
FLUSH PRIVILEGES; 
EXIT; 
```

메트릭을 수집할 USER 를 생성하고 권한을 주자.

`sudo vi /etc/systemd/system/mysqld_exporter.service` 를 통해 서비스 파일을 생성하자.

```
[Unit]
Description=MySQL Exporter
Wants=network-online.target
After=network-online.target

[Service]
User=root
Group=root
Type=simple
Restart=always
ExecStart=/home/ubuntu/mysqld_exporter-0.14.0.linux-arm64/mysqld_exporter \
--config.my-cnf /home/ubuntu/mysqld_exporter-0.14.0.linux-arm64/mysqld_exporter.cnf \
--collect.global_status \
--collect.info_schema.innodb_metrics \
--collect.auto_increment.columns \
--collect.info_schema.processlist \
--collect.binlog_size \
--collect.info_schema.tablestats \
--collect.global_variables \
--collect.info_schema.query_response_time \
--collect.info_schema.userstats \
--collect.info_schema.tables \
--collect.perf_schema.tablelocks \
--collect.perf_schema.file_events \
--collect.perf_schema.eventswaits \
--collect.perf_schema.indexiowaits \
--collect.perf_schema.tableiowaits \
--collect.slave_status

[Install]
WantedBy=multi-user.target
```

- collect 할 내용들을 추가하자.

```
sudo systemctl daemon-reload
sudo systemctl start mysqld_exporter
sudo systemctl enable mysqld_exporter
sudo systemctl restart mysqld_exporter
systemctl status mysqld_exporter
```

서비스를 재시작 및 설정하면 Mysql_Exporter 도 끝!

> DB가 데이터를 제대로 수집하고 있는지 확인하고 싶다면?
> curl `http://<DB 서버 내부 주소:포트>/metrics` 을 통해 확인할 수 있다.
> 
> 프로메테우스가 DB의 데이터를 받는지 확인하고 싶다면?
> `curl http://<프로메테우스 서버 내부 주소:포트>/api/v1/targets | jq .`

```json
{
	"discoveredLabels": {
	  "__address__": "XXX",
	  "__metrics_path__": "/metrics",
	  "__scheme__": "http",
	  "__scrape_interval__": "15s",
	  "__scrape_timeout__": "10s",
	  "alias": "Dev DB",
	  "job": "dev-database"
	},
	"labels": {
	  "alias": "Dev DB",
	  "instance": "10.0.100.36:9104",
	  "job": "dev-database"
	},
	"scrapePool": "dev-database",
	"scrapeUrl": "XXX/metrics",
	"globalUrl": "XXX/metrics",
	"lastError": "",
	"lastScrape": "2024-09-08T07:48:50.058573713Z",
	"lastScrapeDuration": 0.086236764,
	"health": "up",
	"scrapeInterval": "15s",
	"scrapeTimeout": "10s"
}
```

이와 깉이, health 과 `up` 이라면 성공적으로 가져오는 것이다.
## Grafana

https://grafana.com/grafana/grafana/download
해당 사이트를 들어가서 맞는 그라파나를 다운 받자.

```
wget https://dl.grafana.com/enterprise/release/grafana-enterprise_11.2.0_amd64.deb
sudo apt install ./grafana-enterprise_11.2.0_arm64.deb
```

의존성을 설치하고 

```bash
sudo systemctl start grafana-server.service 
sudo systemctl enable grafana-server.service 
sudo systemctl stop grafana-server.service 
sudo systemctl restart grafana-server.service
sudo netstat -ntap | grep LISTEN | grep 3000
```

이렇게, 자동으로 서비스가 설치되고 열리는데

만약 포트를 바꾸고 싶다면?
`sudo vi /etc/systemd/system/grafana-server.service` 서비스 파일을 만들어서 추가하고
```
[Service]
User=root
Group=grafana
ExecStart=/usr/sbin/grafana-server --config=/etc/grafana/grafana.ini --homepath=/usr/share/grafana
```

`sudo vi /etc/grafana/grafana.ini` 파일에서 
```
# The http port to use
http_port = 80
```

포트를 바꾸자. ( 위에도 `User=root` 를 해줘야 80 에 접근할 수 있음 )

## Loki

```
sudo apt-get update
sudo apt-get install -y wget unzip
```

설치 프로그램이 `.zip` 이므로 unzip 을 설치해야 한다.

```

wget https://github.com/grafana/loki/releases/download/v2.9.0/loki-linux-arm64.zip
unzip loki-linux-arm64.zip
chmod +x loki-linux-arm64
sudo mv loki-linux-arm64 /usr/local/bin/loki
```

설치하고 옮기고

```
sudo mkdir /etc/loki
sudo vi /etc/loki/loki-config.yaml
```

설정 파일을 작성하자.

```yaml
auth_enabled: false

server:
  http_listen_port: 80

ingester:
  lifecycler:
    ring:
      kvstore:
        store: inmemory
      replication_factor: 1
    final_sleep: 0s
  chunk_idle_period: 5m
  chunk_retain_period: 30s
  max_transfer_retries: 0

schema_config:
  configs:
    - from: 2024-09-05
      store: boltdb-shipper
      object_store: filesystem
      schema: v11
      index:
        prefix: index_
        period: 24h

storage_config:
  boltdb_shipper:
    active_index_directory: /tmp/loki/index
    cache_location: /tmp/loki/boltdb-cache
    shared_store: filesystem
  filesystem:
    directory: /tmp/loki/chunks

limits_config:
  enforce_metric_name: false
  reject_old_samples: true
  reject_old_samples_max_age: 480h

chunk_store_config:
  max_look_back_period: 480h

table_manager:
  retention_deletes_enabled: false
  retention_period: 0s

```

#### Ingestor

로키는 로그 데이터를 수신하고, `chunk` 로 저장한다.
그리고 일정 시간 후, 장기 저장소에 저장된다.
해당 부분은 아직, 우리가 로그를 (로키에) 영구적으로 저장할 필요가 없다고 판단했다.
그렇기에 
- replication_factor : 복제본을 한개만 유지
- kvstore : key-value store 를 inmemory 로 유지
- max_transfer_retires : 실패시 재시도 하는 횟수
- chunk_retain_period : 비활성화 된 청크 메모리에 유지하는 식나
으로 설정했다.필요하다면, 더 찾아보고 설정해보자.
#### schema_configs
Loki 가 데이터를 저장 & 인덱싱 할때 사용하는 스키마이다.
- from : 해당 날짜부터 스키마가 적용
- store : 로그의 인덱스 저장 방식 ( 지정이 되어 있다. `boltdb-shipper` : 인덱스 로컬 파일 시스템에 저장 + 중앙 공유 저장소에 동기화 )
- object_store : 로그 데이터 저장소
- schema : 스키마 버전 지정 ( 버전마다 인덱싱 및 저장 방식에 차이 존재 )
- index.prefix : 인덱스 파일의 이름 앞에 붙이는 접두사
- index.period : 주기마다 생성 ( 새로운 인덱스를 만든다는 의미 )
#### storage_config
저장소에 대한 설정이다.
- active_index_directory : 로컬 디스크에 인덱스를 저장하는 디렉토리
- cache_location : 인덱스를 캐싱하는 디렉토리
- shared_store : 중앙 저장소로 파일 시스템 사용
#### limit_config
저장하는 데이터의 제한에 대한 설정이다.
- reject_old_samples : 오래된 샘플을 수집하지 않도록 설정 ( true 일시, 설정 기간 보다 오래된 로그 데이터는 거부 )
- reject_old_samples_max_age : 지정 시간보다 오래된 로그 샘플은 거부 ( 날짜보다 오래된 로그는 수집되지 않게 제한 )
#### chunk_store_config
데이터(청크) 저장소에 대한 설정이다.
- max_look_back_period : 조회할 수 있는 최대 기간 ( 0s 일시, 과거 데이터 조회 비활성화 )

설정 파일에 대해선 끝났고, 위와 똑같이 서비스를 생성하자.

```
sudo vi /etc/systemd/system/loki.service
```

```yaml
[Unit]
Description=Loki Log Aggregation System
After=network.target

[Service]
User=root
ExecStart=/usr/local/bin/loki --config.file /etc/loki/loki-config.yaml
Restart=on-failure

[Install]
WantedBy=multi-user.target

```

```bash
sudo systemctl daemon-reload
sudo systemctl restart loki
sudo systemctl status loki
```

`curl -G -s "http://10.0.100.87/loki/api/v1/query" --data-urlencode 'query={app="corea"}' | jq .`

이와 같이 로키에 요청을 날릴 시, 값들이 존재하면 성공이다.
```json
{
                    "level":"WARN",
                    "class":"c.exception.ExceptionResponseHandler",
                    "requestId":"c79d9efd-12cb-4c6a-9c17-8c01a30f53b0,
                    "message": "No Resource exception [errorMessage = No static resource .env., cause = null,error ={}]"
                    }
org.springframework.web.servlet.resource.NoResourceFoundException: No static resource .env.
	at org.springframework.web.servlet.resource.ResourceHttpRequestHandler.handleRequest(ResourceHttpRequestHandler.java:585)
	at org.springframework.web.servlet.mvc.HttpRequestHandlerAdapter.handle(HttpRequestHandlerAdapter.java:52)
...

```

---

그라파나,로키,프로메테우스(`+`Mysql Exporter) 에 대한 설치가 끝났고 이제 어떻게 데이터를 넣고 사용하는지에 대해 알아보자.

### 스프링 - 프로메테우스

스프링 부트에선 프로메테우스를 정말 사용하기 쉽게 해준다.
단순히, 의존성 설치 & 액츄에이터 노출을 하면 끝이다.

```gradle
implementation 'org.springframework.boot:spring-boot-starter-actuator'
implementation 'io.micrometer:micrometer-registry-prometheus'
```

의존성 설치를 하고

```yaml
management:  
  endpoints:  
    web:  
      exposure:  
        include: health,prometheus  
        exclude: threaddump, heapdump
```

이와 같이 `application.yml` 에서 노출을 명시하면 된다.
( 이때, 보안을 생각한다면 프로메테우스는 내부 통신만 가능하게 구성하자 - 스레드 풀 상태, 리소스 사용량, 실행 환경 경로 등 어떻게 보면 민감할수도 있기 때문 )

```yaml
management:
  server:
    port: 9091
  endpoints:
    web:
      exposure:
        include: prometheus
  metrics:
    export:
      prometheus:
        enabled: true
```

이와 같이, 프로메테우스만 9091 도 가능하다.

### 스프링 - 로키
로키는 로그 데이터를 수신한다고 했다.
그 말은 스프링 서버가 로키에 데이터를 보내줘야 한다.

```xml
<included>
    <appender name="LOKI" class="com.github.loki4j.logback.Loki4jAppender">
        <http>
            <url>${LOKI_URL}</url>
        </http>
        <format>
            <label>
                <pattern>app=Corea,host=${HOSTNAME},level=%level</pattern>
                <readMarkers>true</readMarkers>
            </label>
            <message>
                <pattern>
                    {
						"level":"%level",  
						"class":"%logger{36}",  
						"requestId":"%X{requestId}",  
						"time":"%date{yyyy-MM-dd'T'HH:mm:ss.SSSZ}",  
						"thread":"%thread",  
						"message": "%message"
                    }
                </pattern>
            </message>
        </format>
    </appender>
</included>

```

나는 이와 같이 `appender` 를 지정했다.
패턴(인덱스)는 application 명(차차 Corea-Prod/Corea-Dev 와 같이 분리 가능), host(IP주소), level(로그 레벨) 과 같이 작성했다.

메시지는 
로그 레벨, 발생 클래스, 요청 ID, 시간, 실행한 스레드, 본문으로 구성했다.

현재는 이정도면 충분하다고 판단해서 이렇게 구성했고 각자가 필요한 걸 구성해나가면 될 듯 하다.

```json
{
	"level":"DEBUG",
	"class":"c.room.controller.RoomController",
	"requestId":"29243afd-87c5-4059-9e55-af4c8b6236f7",
	"time":"2024-09-22T01:05:50.733+0900",
	"thread":"http-nio-8080-exec-11",
	"message": "return [time=2024-09-22T01:05:50.733171980, ip=58.143.138.249,url=http://api.code-review-area.com/rooms/opened, httpMethod=GET, class=corea.room.controller.RoomController, method=openedRooms, elapsedMillis=7
result=class corea.room.dto.RoomResponses]"
}
```

이와 같이 온다.
그러면, 이런 로그들을 시각적으로 사용해보자.
## 그라파나
### 데이터 소스 연결

이제, 우리가 위에서 구성해놓은 프로메테우스,로키를 연결할 때다.

Connection - Add new connection - 연결할 데이터 소스 선택을 한다.

![500](https://i.imgur.com/yEhpRUv.png)

server URL 을 지정해서 연결하자. ( 그 밑에는 복잡한 전문가들의 영역이지 않을까.. )
맨 하단에, `save & test` 를 통해 저장 및 테스트가 가능하다.
### 그라파나 대시보드 구성
이제 데이터소스에서 우리가 받은 데이터들을 기반으로 대시보드를 커스터마이징 할 수 있다.
하지만

![](https://i.imgur.com/MwxrDVQ.png)

이렇게 아무것도 모르는 상태에서 처음 하기는 매우 어렵다.
그렇기에, 이미 다른 사람들이 만들어 놓은 대시보드들이 매우 많고, Import 를 할 수 있다.

나는
- 스프링 로그 **Spring Boot Observability** [https://grafana.com/grafana/dashboards/17175-spring-boot-observability/](https://grafana.com/grafana/dashboards/17175-spring-boot-observability/)
- 스프링 매트릭 **JVM (Micrometer)** [https://grafana.com/grafana/dashboards/4701-jvm-micrometer/](https://grafana.com/grafana/dashboards/4701-jvm-micrometer/)
- 하드웨어 매트릭 **Node Exporter Full** [https://grafana.com/grafana/dashboards/1860-node-exporter-full/](https://grafana.com/grafana/dashboards/1860-node-exporter-full/)
해당 대시보드들을 우선적으로 사용했다.
( Thanks for 새양🙇‍♂️ )

New -> Import -> ID 를 입력 -> Load 시 기존에 사람들이 구성해놓은 대시보드를 가져온다.

![](https://i.imgur.com/1zspRbG.png)

![](https://i.imgur.com/BwqSDJg.png)

이와 같이, 단순히도 유의미한 데이터들을 보여준다! 🙂
### DB 연결

이거는 기존 모니터링 작업 보다 좀 지나서 알게 된 사실인데 매우 유용해서 작성한다.
Connections - Add new Connections 를 보다 보면 `MySQL` 과 같이 DB 들이 존재한다.

![](https://i.imgur.com/fKZMMWy.png)

밑에
Connection - Host URL,Database name
Authentication - Username,Password
에 넣고 `Save & Test` 를 하면 DB 와도 연결된다!

![](https://i.imgur.com/R2EEe23.png)

이렇게 Builder 를 통해 간편하게 지정이 가능하고, 시각적으로 편하게 조회 & 다운로드를 할 수 있다.
외부에서 DB 에 접근 및 직접적인 작업이 어려운데 이를 가능하게 해준다!!!!

그러면 장점만 있을까?

```
The database user should only be granted SELECT permissions on the specified database & tables you want to query. Grafana does not validate that queries are safe so queries can contain any SQL statement. For example, statements like USE otherdb; and DROP TABLE user; would be executed. To protect against this we Highly recommend you create a specific MySQL user with restricted permissions. Check out the docs for more information.
```

위 User Permission 을 보면 이런 문단이 있다.
해석하면
DB 사용자에게 `SELECT` 권한만 부여해야 한다.
쿼리 안전성을 검증하지 않으므로, 쿼리에는 어떤 SQL 문도 포함될 수 있다.
그렇기에, 권한이 제한된 특정 MYSQL 사용자를 생성해서 사용할 것은 권장한다. 
라고 되어 있다.

![](https://i.imgur.com/sMK9yny.png)

이렇게 삭제도 가능하다 🚨🚨
근데, 뭐 어떤가 ( 외부에서 조회만 하는게 아니라, 생성&삭제&수정 까지 되잖아? 럭키비키🍀 )
보안에 주의하고, 특정 사용자를 생성해서 조회 권한만 주는게 BEST 일 거 같다. ( 털리면, 모든 DB 소멸이 가능하므로 )

![](https://velog.velcdn.com/images/dragonsu/post/fb5747bc-8aa9-4101-a2e2-9dca7ceae191/image.png)

이와같이 프론트엔드 개발자도 보기 쉽고 사용하기 쉬운 데이터 대시보드 역시도 만들어줄 수 있다.
### 마무리

이렇게, 모든 설정들이 끝났다.
다시 간단하게 설명하면

- 프로메테우스 내 설정에서 Server Instance,DB Instance 등록
	- 스프링 서버는 프로메테우스 설치 & 노출
	- DB 서버는 MySQL Exporter 설치
- 스프링 서버는 로키에 HTTP API 로 로그 전송
- 그라파나는 프로메테우스 & 로키 데이터 소스 연결해서 시각화로 이루어진다.

프로메테우스에서 사용하는 PromQL, 로키에서 사용하는 LogQL 을 사용하면  더욱 데이터를 원하는 대로 대시보드에 표시가 가능하나
해당 부분에 대해서는 공부하지 않을거 같다. ( 러닝 커브가 너무 높으고, 기본으로 제공해주는 걸로도 충분히 유의믜 )

언제가 될지 모르겠으나 ( 미션이 너무 바쁘다... )
다음 내용은 모니터링을 통해 경보를 설정하는 부분에 대해서 다룰 거 같다. ( 슬로우 쿼리, 서버 과부하 & 에러 비율 등등 )

#### 참고

[[우테코 6기 레벨3] Grafana, Loki, Prometheus - 로그와 메트릭 모니터링](https://velog.io/@chch1213/wooteco-6-lv3-monitoring)
[[과제] prometheus와 grafana를 이용한 MySQL 모니터링 구축](https://velog.io/@inhwa1025/%EA%B3%BC%EC%A0%9C-prometheus%EC%99%80-grafana%EB%A5%BC-%EC%9D%B4%EC%9A%A9%ED%95%9C-DB-%EB%AA%A8%EB%8B%88%ED%84%B0%EB%A0%81-%EA%B5%AC%EC%B6%95#mysqld-exporter-%EB%B0%94%EC%9D%B4%EB%84%88%EB%A6%AC-%EC%84%A4%EC%B9%98
