# ---- Build/Runtime stage -----------------------------------------------
FROM python:3.12-slim
WORKDIR /app

# Install OS-level dependencies for OpenCV (headless)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
  && rm -rf /var/lib/apt/lists/*

# Install Python dependencies first (cached layer)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Non-root user
RUN useradd -m -u 1001 agroai
USER agroai

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
