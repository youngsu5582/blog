---
author: 이영수
categories:
- 인프라
date: 2025-03-09 15:00:00 +0900
description: AWS 프리티어를 활용해 EC2, RDS, ElastiCache, S3 등으로 인프라를 구성하는 과정을 상세히 설명합니다.
  VPC 설정, 보안 그룹 구성, CodeDeploy와 Github Actions 연동 등 다양한 요소를 다루며, 비용 효율적인 방법으로 서버를
  운영하는 방법을 제시합니다.
image:
  path: assets/img/thumbnail/2025-03-15-프리티어로만-배포해보기.png
render_with_liquid: false
tags:
- amplify
- aws
- ec2
- https
title: 프리티어로만 배포해보기
permalink: /posts/deploying-with-only-free-tier/
permalink: /posts/deploying-with-only-free-tier/
---

> 해당 내용은 프리티어로 AWS 인프라를 구축한 내용을 다룹니다.
> `RDS`,`EC2`,`ElastiCache`,`CodeDeploy`,`Chatbot`,`S3`,`Amplify` 를 이용합니다.

## AWS FreeTier List

아마존은 생각보다 매우 많은 서비스를 무료로 1년동안 제공해준다.
( 2년 정도면, 얼마나 좋을까.. )

[프리 티어 리스트](https://aws.amazon.com/ko/free/?all-free-tier.sort-by=item.additionalFields.SortRank&all-free-tier.sort-order=asc&awsf.Free%20Tier%20Types=*all&awsf.Free%20Tier%20Categories=*all)

요소를 추려보면

- EC2 750시간 - t3.micro, 12개월 무료

- RDS 750시간 - MySQL, PostgreSQL, 12개월 무료
- ElastiCache 750시간 - cache.t3.micro
- DynamoDB 25GB - 월별 2억 개 요청 처리 가능한 용량
- S3 - 5GB, GET 요청 20,000건, PUT 요청 2,000건

- CloudWatch 10- API 요청 100만건, 로그 데이터 수집 5GB 및 아카이브 5GB
- CloudFront 1TB - HTTP,HTTPS 요청 100만건
- Amplify - 매월 1,000분의 빌드 시간, 매월 15GB 제공, 매월 요청 50만 건

- CodBuild 100분 -  arm1.small 구축 시간 100분
- CodePipeline 1 - 월별 활성화 파이프라인 1개

- Lambda - 매월 100만건, 최대 320만 초
- SNS - 매월 100만건, HTTP/HTTPS 전송 10만건, 이메일 전송 1000건

정도가 있다.

> 물론, 다른 요소들도 어마하게 많지만 백엔드 개발자가 간단하게 접근할 수 있는 요소들로만 적어놨습니다

> 여기서, CodeBuild & CodePipeline 은 사용하지 않고 Gihutb Action & CodeDeploy를 사용합니다.
> ( 100분은 생각보다 매우 짧기 때문 )

- 서버 : EC2
- 데이터베이스 : RDS, ElastiCache
- 빌드 저장 : S3
- 프론트 CI & CD : Amplify
- 백엔드 CI & CD : Github Action, CodeDeploy

까지가 이번 구성안이다.

아래 구성 순서는

`VPC -> Database(RDS,ElastCache) -> Amplify -> EC2 -> CodeDeploy`

순으로 구성한다.

## VPC

구성에 혼선이 안생기게 VPC 부터 생성하는게 편한거 같다.

VPC : 가상 프라이빗 네트워크, 우리의 인프라를 어느 네트워크 및 어떻게 배치할지를 결정

VPC 등 선택

- 이름 : lotto-prod-vpc
- IPv4 CIDR : 10.0.0./16
- 가용 영역 : 1
- 퍼블릭 서브넷 : 1
- 프라이빗 서브넷 : 2

> 프라이빗을 두개로 하는 이유는 RDS는 무조건 AZ2개를 보장해야 한다. - 가용성

> 그리고, `DNS 확인 활성화`, `DNS 호스트 이름 활성화` 두개를 설정해야 한다.
> -> AWS EC2는 DNS 가 없으면, 퍼블릭 IP라도 외부랑 통신을 못하기 때문이다. - 도메인 이름을 IP 주소로 변환 실패 ( 여기서 1시간,2시간 정도 헤맴 )

### 서브넷 그룹

- 이름 : lotto-prod-subnet-private-group
- vpc-id : lotto-prod-vpc

> ElasticCache 에서 사용하기 위해 생성

### Security Group

EC2 - RDS, Cache 에서 사용하기 위한 인바운드 아웃바운드를 설정한다.

- 이름 : ec2-to-cache-outbound-group
- vpic-id : lotto-prod-vpc
- 아웃바운드 : 6379, 0.0.0.0 지정
- 태그 : project-lotto

=> EC2에 지정

- 이름 : ec2-to-cache-inbound-group
- vpic-id : lotto-prod-vpc
- 인바운드 : 6379, 0.0.0.0 지정
- 태그 : project-lotto

=> ElasticCache에 지정

- 이름 : ec2-to-rds-outbound-group
- vpic-id : lotto-prod-vpc
- 아웃바운드 : 3306, 0.0.0.0 지정
- 태그 : project-lotto

=> EC2에 지정

- 이름 : ec2-to-rds-inbound-group
- vpic-id : lotto-prod-vpc
- 인바운드 : 3306, 0.0.0.0 지정
- 태그 : project-lotto

=> RDS에 지정

- 이름 : ec2-public-group
- vpic-id : lotto-prod-vpc
- 인바운드 : 443,22,80 지정

## RDS

요새는, RDS 도 프리티어 대상으로 간편하게 설정할 수 있는 템플릿이 제공되어 있다.
내리면 위와같이 선택할 수 있는 요소들이 제공되므로 설명은 생략한다.

- 표준생성
- MySQL
- 프리티어
- DB 인스턴스 식별자 : lotto-database-prod
- 마스터 사용자 이름 : lotto_user
- 자체 관리 : 암호 자동 생성
- 스토리지 자동 활성화 X
- EC2 컴퓨팅 리소스에 연결 안함
- vpc : lotto-prod-vpc
- 보안그룹 : ec2-to-rds-inbound-group
- 가용영역 : ap-northeast-2a
- 로그 내보내기 : 에러 로그, 느린 쿼리 로그
- 초기 데이터베이스 : lotto

## ElasticCache
해당 부분에서 Redis 가 아닌 Valkey 를 사용했는데 아래의 이유에서 선택했다.

1. AWS에서 30~40% 가량 저렴하다고 홍보를 강력하게 한다.
2. Reids의 고가용성 클러스터나 검증된 안정성이 필요 없다.
3. Redis 의 오픈소스를 기반으로 시작했기에, 엄청난 부분들이 유사하다.

해당 부분도 RDS와 같이 선택할 수 있는 요소들이 제공되므로 설명은 생략한다.

- ElasticValKey 사용
- 자체 캐시 설계 -> 클러스터 캐시
- 클러스터 모드 비활성화
- 위치 : AWS 클라우드, 다중 AZ 사용 X, 자동 장애 조치 사용 X
- 노드 유형 : cache.t3.micro
- 복제본 : 0
- 자동 백업 사용 X
- 보안그룹 : ec2-to-cache-inbound-group
- 로그 : 느린 로그 사용 ( JSON, CloudWatch Logs )
- 태그 : project-lotto

> 여기서, VPC - 서브넷 그룹 - 서브넷을 필요로 한다.

- 백업 사용 X

서버가 잘 구동됐는지 확인하고 싶다면
VPC 내부 ( 즉, EC2 구동해서 내부 ) 에서

```
nc -zv <DB_HOSTNAME> <DB_PORT>
```

요청을 보내면

```
Connection to <DB_HOSTNAME> (<DB_IP>) <DB_PORT> port [tcp/redis] succeeded!
```

라고 응답을 해준다.
이를 통해, `DB가 제대로 구동되어 LISTEN` 하는지, `인스턴스간 인바운드-아웃바운드 연결` 이 되었는지를 알 수 있다.

## Amplify

프론트엔드 앱을 빌드부터 배포까지 완벽하게 이어준다.
사실, 이번에 처음 제대로 알았는데 매우 좋은 기능들이 많이 있었다.

- Github 선택
- 레포지토리 선택, 브랜치 선택
- 모노 레포지토리 선택 ( 프론트만 있는게 아니라, 같이 있을 시 )
- 프론트엔드 빌드 명령어 지정
- 환경 변수 설정

Github 에 Push 를 한다면, 웹훅을 받아서 빌드 및 배포가 진행된다.

![](https://i.imgur.com/aOPJ8rn.png)

빌드와 배포까지 시간도 2분 20초? 가량으로 매우 빨리 끝난다. ( 캐싱 비활성화도 동작 확인 )

> Amplify 에는 WAF가 있는데 국가 제한, 취약점 및 악의점 공격 보호에 대한 요소들도 있다.
필수적인 기능이긴 하나, 프리티어가 아니므로 패스 ( 2025.03.08 기준 )

![](https://i.imgur.com/59z8ZFs.png)

우리 서버로 어떤 요청들이 들어오는지도 쉽게 다운받아서 조회 가능하다.

## EC2

인스턴스 설정은

- 아키텍처 : 64비트(x86) - 프리티어 제공 범주가 현재 고정
- 인스턴스 유형 : t2.micro - 1vCPU, 1GiB 메모리
- SSH 트래픽 허용 : 위치무관
- 인터넷에서 HTTP/HTTPS 트래픽 허용
- 스토리지 구성 : 10GiB, gp3 루트 볼륨

- 태그 설정 : profile - prod, project - lotto
- 보안 그룹 : ec2-public-group

### 사전 설치

서버 실행을 위해 초기 자바 및 Agent 설치를 해줘야 한다.

```bash
# JDK 설치 디렉터리 생성
sudo mkdir /usr/lib/jvm

wget https://download.java.net/java/GA/jdk21.0.2/f2283984656d49d69e91c558476027ac/13/GPL/openjdk-21.0.2_linux-x64_bin.tar.gz -O /tmp/openjdk-21.0.2_linux-x64_bin.tar.gz

# 압축 해제
sudo tar xfvz /tmp/openjdk-21.0.2_linux-x64_bin.tar.gz --directory /usr/lib/jvm
rm -f /tmp/openjdk-21.0.2_linux-x64_bin.tar.gz

# 대안 설정
sudo update-alternatives --install /usr/bin/java java /usr/lib/jvm/jdk-21.0.2/bin/java 100
sudo update-alternatives --set java /usr/lib/jvm/jdk-21.0.2/bin/java

# 환경 변수 설정
export JAVA_HOME=/usr/lib/jvm/jdk-21.0.2
export PATH=$PATH:/usr/lib/jvm/jdk-21.0.2/bin

# 확인
java -version

```

자신의 버전과 벤더사에 맞게 설치를 하고, 환경 변수 설정을 해주면 된다.

```bash
#!/usr/bin/env bash

sudo apt-get update -y
sudo apt-get install -y ruby
cd /home/ubuntu
wget https://aws-codedeploy-ap-northeast-2.s3.amazonaws.com/latest/install
chmod +x ./install
sudo ./install auto
```

그리고, CodeDeploy Agent 를 설치하고, 실행한다.

추가로, EC2 는 CodeDeploy Agent 를 실행할 권한이 있어야 한다.

IAM 정책에서 `정책명` 을 만들고

`EC2InstanceConnect`, `AWSCodeDeployFullAccess`, `AmazonS3FullAccess` 권한을 주자.

S3에 있는 파일에 접근해서 CodeDeploy 가 자동으로 배포를 진행해준다.
( InstanceConnect 는 편의용 ) ( S3 권한이 두렵다면, GET 하는 권한만 줘도 상관없다. )

작업 -> 보안 -> IAM 역할 수정 -> 우리가 만든 역할로 설정

### 스왑 메모리

t2g는 RAM이 1.0 GiB이다. 매우 절망적이므로, 스왑 메모리가 필요하다.

1. sudo fallocate -l 2G /swapfile
2. chmod 600 /swapfile
3. sudo mkswap /swapfile
4. sudo swapon /swapfile
5. echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab ( 리부팅 되어도, 자동으로 설정되게 지정 )

> `free -h` 로 스왑 메모리 활성화 됐는지 확인할 수 있다.

### 도메인 구매

자신이 고정적인 IP나 `amplify.app` 으로 사이트를 배포하기 싫다면? 도메인을 구매하자.
어차피, 1년 신규 금액은 정말 얼마 안한다.

![](https://i.imgur.com/lze5PlG.png)

멋을 위해서 2500~10000원 정도는 포기할 수 있지 않을까..

호스팅을 구매하려면, 관리자 정보를 입력해야 하는데 `whois` 나 DNS 서버에 이 사이트의 소유자가 누구인지를 올라가는 것이니까 제대로 적자.
이제, 서버의 주소를 자기가 맞게 등록하면 된다.

![](https://i.imgur.com/ETELcKD.png)

### Amplify & HTTPS

사용자 지정 도메인에 우리 도메인을 추가하면, 자동으로 SSL 생성을 해준다.


호스팅 - 사용자 지정 도메인 - 도메인 추가로 들어가서

1. 자기 루트 도메인을 입력하자.
2. 호스팅 영역 수동 구성을 누른다. ( Route53 은 사용하지 않고 직접 구성한다. - 추가 비용 )
3. 호스팅 서비스에 등록위한 `호스트 이름`,`형식`,`데이터` 를 알려주고
   하위 도메인도 가르키도록 `cloudfront` 데이터를 제공해준다.

> 이때, 주의할 점은 자신이 알아서 마지막 DNS 는 적절히 추출해야 한다.
예를 들어, 나는 `lotto.web.younsgu5582.life` 와 같이 복사를 하라고 안내해줬으나 호스팅 서버에 넣을때는 `lotto.web` 까지만 넣어야 했다.

그 후, DNS 에 대한 정보들이 퍼지고 인증이 완료되면 끝난다!

`nslookup <도메인명>`
`whois <도메인명>`

두개를 통해서도 도메인이 제대로 등록되어있는지 및 정보가 잘 등록됐는지 확인 가능하다.

### Nginx & Certbot

서버에서도, 그냥 받는게 아닌 HTTPS 를 받기 위해 적용한다.
( HTTP 는 일반적으로, HTTPS <-> HTTP 요청 시 `Mixed Contents` 에러를 발생시켜 요청이 거부된다. )

```
sudo apt-get update
sudo apt-get install certbot python3-certbot-nginx
sudo certbot --nginx -d <API 서버 주소>
```

y/n 를 입력하라고 하면 `y -> y -> n` ( 마지막은, 이메일 기반 소식 전해준다는 내용 ) 을 입력한다.

이런 과정을 통해, 인증서를 발급 받아서 `fullchain.pem`, `privkey.pem` 을 받는다.
그리곤, nginx 에서 `ssl_certificate` 와 `ssl_certificate_key` 를 맞게 설정하면 된다.

```
server {
    listen 443 ssl;
    server_name <API 서버 주소>;

    ssl_certificate <fullchain.pem>
    ssl_certificate_key <privkey.pem>

    # (옵션) SSL 설정 강화
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    location / {
        proxy_pass http://127.0.0.1:8080;
        # 혹은 root /var/www/html; 등 원하는 백엔드/정적 디렉토리
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        }
}

server {
    listen 80;
    server_name <API 서버 주소>;
    return 301 https://$host$request_uri;
}
```

```
sudo nginx -t
sudo systemctl restart nginx
```

설정을 적용하기 위해 재시작 후, API 서버 주소로 보내는데 응답하는지 확인하면 끝난다.

## Code Deploy

CodeBuild 또는 CodePipeline 을 사용하지 않았다.

우선, 한달에 100분이면 생각보다 너무 짧다고 느꼈다.
백엔드 배포가 일반적으로 2분,3분 정도가 소모되는데 ( 테스트를 제외하면 더 빠르긴 함 ) 대략 50~60 건이면 추가적인 비용이 발생한다.
-> 그러기에, CodePipeline 도 사용하지 못한다.

대신, Github Action 에서 빌드 -> S3 업로드 -> Deploy 실행을 담당하기로 했다.

애플리케이션을 생성하자.

- 애플리케이션 명 : lotto-code-deploy
- 컴퓨팅 플랫폼 : EC2/온프레미스

### 배포 그룹 생성

- 배포 그룹 명 : lotto-prod-group
- 역할 생성 : 키(profile), 값(prod)
- AWS Systems Manager 사용한 에이전트 구성
- 배포 구성 : AllAtOnce
- 로드밸런서 비활성화

> 하나의 서버를 사용하므로 배포 전략과 로드밸런서는 고려하지 않는다.

## 사용자

Github Action 에서 실행하기 위한 사용자를 만든다.

- 사용자 이름 : lotto-user
- S3FullAccess, CodeDeployFullAccess

그리고, 액세스 키를 생성해서
액세스 키와 시크릿 키를 준비하자. ( - 사용 사례 : 로컬 코드 )
### Github Action

```
- name: Create deploy package  
  run: |  
    zip -r deployment-package.zip build/libs/spring-lotto.jar appspec.yml deploy  
  
- name: Configure AWS credentials  
  uses: aws-actions/configure-aws-credentials@v4  
  with:  
    aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}  
    aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}  
    aws-region: ${{ secrets.AWS_REGION }}  
  
- name: Upload to S3  
  run: |  
    aws s3 cp deployment-package.zip s3://${{ secrets.S3_BUCKET_NAME }}/deployment-package.zip  
  
- name: Deploy to CodeDeploy  
  run: |  
    aws deploy create-deployment \  
      --application-name ${{ secrets.APPLICATION_NAME }} \  
      --deployment-group-name ${{ secrets.DEPLOYMENT_GROUP_NAME }} \  
      --s3-location bucket=${{ secrets.S3_BUCKET_NAME }},key=deployment-package.zip,bundleType=zip
```

1. 빌드 파일 및 필요한 스크립트와 appspec.yml 을 압축한다.
2. Action에서 Crendtials 를 통해 인증을 받는다.
3. 압축한 파일을 S3에 올린다.
4. S3에 저장되어 있는 파일을 기반으로 Deploy 를 실행한다.

### Github Action Secret

```
AWS_ACCESS_KEY_ID 
AWS_SECRET_ACCESS_KEY
AWS_REGION : ap-northeast-2

APPLICATION_NAME : lotto-code-deploy
DEPLOYMENT_GROUP_NAME : lotto-prod-group
S3_BUCKET_NAME : spring-lotto-build-bucket
```

이와같이 Secret 에 값들을 넣어서 동작하는지 확인하면 된다.

## AWS Chatbot

배포를 매번 들어가서 확인하면 몹시 번거롭다. 우리는, AWS Chatbot 을 활용한다.

![](https://i.imgur.com/cGyfK6m.png)

이 역시도 추가 비용 없이 무료이다.
현재는, `Q Developer in chat applications` 로 이름이 변경됐다.

새 클라이언트 구성 -> Slack 선택 -> 사용하려는 채널 권한을 요청한다.

그리고, 채널 구성을 하자.

- Slack 채널 : 받을 채널 지정
- 역할 이름 : aws-chatbot-slack-codedeploy-role
- 정책 템플릿 : 알림 권한, 읽기 전용 명령 권한
- 알림 : 선택 X ( 어차피, 슬랙으로 요청을 보내는 게 주이므로, SMS 같은 추가적 요소가 필요없다. )
- 가드 레일 정책 : CodeDeployFullAccess

그리고, 채널에 `/invite @Amazon Q` 를 통해 초대하자.
### 알람 규칙 in CodeDeploy

CodeDeploy에서도 추가적인 설정을 해줘야 한다.

애플리케이션 - 설정에 들어가서 알람 규칙을 생성하자.

- 세부 정보 유형 : 가득참
- 알람 트리거 하는 이벤트 : Succeeded, Failed
- 구성된 대상 : AWS Chatbot
- ARN : 위에서 만든 Chatbot ARN

![](https://i.imgur.com/fiYyTX6.png)

이와같이 배포 권한을 받으면 성공이다.

---

## 결론

![](https://i.imgur.com/AqsnYcf.png)

생각보다, 그럴듯하게 완성 됐다. 🙂 ( CI,CD + DB + HTTPS 등등 )

비용 예상도를 보면?

![](https://i.imgur.com/ewa2Mlz.png)

3$도 안되는걸 볼 수 있다.
앞으로, SNS 나 Lambda 부분을 추가로 도입해나갈 거 같다.

사이드 프로젝트를 배포하는걸 비용 및 귀찮음 때문에 주저했었는데
의식적인 프리티어 구성이면 매우 저렴한 금액이다. ( 오히려, 귀찮아서 방지해놓은 EC2 가 프리티어 적용 안되어서 더 비쌌다. )

한번쯤은 AWS 가 제공해주는 모든 기능들을 누려보는 것도 좋은거 같다.
아래는 시도하며 겪은 시행착오들이다.

### 팁

- 네트워크 인터페이스는 사용하는 요소들이 다 분리가 되어야 삭제 가능하다. ( RDS, CACHE 네트워크 인터페이스 등 )
- 보안그룹이 서로를 참조하면, 하나에서 해제 해줘야 삭제 가능하다.

```
scp -i <key-pem> <전송할 파일> <사용자>@<서버 주소>:<저장할 파일명 및 경로>
```

를 통해 필요한 파일을 전송하자.

```
mysql -h <RDS-endpoint> -u <db-username> -p < /home/ubuntu/big_inserts.sql
```

파일을 옮기고, DB에 전송 가능하다.

- `/opt/codedeploy-agent` 에 CodeDeploy 요소들이 위치한다.
  - 여기에 배포 ID 들에 해당하는 폴더가 위차한다. ( 5개 정도 )
  - 폴더 내 `deployment-archive` 에 빌드 시도하는 파일들이 존재한다.

- 왠만하면, 예산을 미리 세워놓자.

![](https://i.imgur.com/U1Aj7Dh.png)

임계치를 지정하고, 도달 시 이메일을 받을 수 있다.
추가적인 설정 없이 간단하게도 현재 금액이 초과안하는지 받을 수 있다.
( 50% & 80% 로 지정해놨다. )