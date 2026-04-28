FROM nvidia/cuda:11.8.0-cudnn8-runtime-ubuntu22.04

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
        python3.10 python3.10-dev python3-pip \
        build-essential g++ gcc \
        libgl1 libglib2.0-0 libgomp1 \
        ca-certificates tini \
        tzdata \
    && ln -sf /usr/share/zoneinfo/Asia/Manila /etc/localtime \
    && echo "Asia/Manila" > /etc/timezone \
    && ln -sf /usr/bin/python3.10 /usr/local/bin/python \
    && ln -sf /usr/bin/python3.10 /usr/local/bin/python3 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .

RUN pip install --no-cache-dir --upgrade pip setuptools wheel \
    && pip install --no-cache-dir cython numpy==1.26.4 \
    && pip install --no-cache-dir -r requirements.txt \
    && pip install --no-cache-dir tzdata

COPY main.py .

RUN mkdir -p /data /root/.insightface
VOLUME ["/data", "/root/.insightface"]

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    HOST=0.0.0.0 \
    PORT=8001 \
    FACE_DB_PATH=/data/faces.db \
    TZ=Asia/Manila \
    TIMEZONE=Asia/Manila

EXPOSE 8001

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001", "--workers", "1"]
