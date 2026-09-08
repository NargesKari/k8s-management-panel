FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PROMETHEUS_MULTIPROC_DIR=/tmp/prometheus_multiproc

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN mkdir -p /tmp/prometheus_multiproc

EXPOSE 8000
# Celery worker metrics (see kari_backend/worker_metrics.py)
EXPOSE 9101

# Default: run the web server. For the celery worker/beat, the same image
# is reused with a different `command:` in the Kubernetes Deployment
# instead of this CMD.
CMD ["gunicorn", "kari_backend.wsgi:application", "--config", "/app/gunicorn.conf.py", "--bind", "0.0.0.0:8000", "--workers", "3"]
