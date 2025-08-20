# test_run.py
import os
import subprocess
import sys
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(dotenv_path=".env")
process_path = "utils/process_thumbnail_and_description.py"

requirements_path = Path(__file__).resolve().parent / "requirements.txt"

print("📦 requirements.txt 설치를 시도합니다... : ", requirements_path)

try:
    subprocess.run(
        [sys.executable, "-m", "pip", "install", "-r", str(requirements_path)],
        check=True
    )
except subprocess.CalledProcessError:
    print("❌ 패키지 설치 실패. requirements.txt가 올바른지 확인해주세요.")
    sys.exit(1)

print("✅ 패키지 설치 완료.")

# 3. 하위 프로세스 실행 (실제 처리 로직)
print("🚀 스크립트를 실행합니다.")
try:
    subprocess.run(
        [sys.executable,process_path],
        check=True
    )
except subprocess.CalledProcessError:
    print("❌ 처리 스크립트 실행 중 오류가 발생했습니다.")
    sys.exit(1)

print("✅ 처리 완료.")
