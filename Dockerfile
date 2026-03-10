# --- Stage 1: Build ---
FROM python:3.12-slim AS builder

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# --- Stage 2: Runtime ---
FROM python:3.12-slim

WORKDIR /app

# Copy installed packages from builder
COPY --from=builder /install /usr/local

# Copy application source
COPY fastapi_entry_backend.py .
COPY api/ api/
COPY debugging/ debugging/
COPY services/ services/
COPY .env* ./

# Cloud Run injects PORT env var (default 8080)
ENV PORT=8080

EXPOSE ${PORT}

CMD uvicorn fastapi_entry_backend:app --host 0.0.0.0 --port ${PORT}
