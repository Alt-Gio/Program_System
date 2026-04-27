# CUDA 11.8 + cuDNN 8 runtime — compatible with onnxruntime-gpu 1.19
FROM nvidia/cuda:11.8.0-cudnn8-runtime-ubuntu22.04

# ── System packages ─────────────────────────────────────────────
RUN apt-get update && apt-get install -y --no-install-recommends \
        python3.11 python3-pip python3.11-dev \
        libgl1 libglib2.0-0 libgomp1 \
        ca-certificates tini \
    && ln -sf /usr/bin/python3.11 /usr/local/bin/python \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ── Python deps (cache-friendly layering) ───────────────────────
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

# ── App source ──────────────────────────────────────────────────
COPY main.py .

# Data volume — SQLite + model cache live here so restarts don't
# lose the registered faces.
RUN mkdir -p /data /root/.insightface
VOLUME ["/data", "/root/.insightface"]

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    HOST=0.0.0.0 \
    PORT=8001 \
    FACE_DB_PATH=/data/faces.db

EXPOSE 8001

# tini as PID 1 → proper SIGTERM propagation during container restarts.
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001", "--workers", "1"]
