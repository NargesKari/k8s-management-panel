FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PROMETHEUS_MULTIPROC_DIR=/tmp/prometheus_multiproc_dir

WORKDIR /app

RUN mkdir -p /tmp/prometheus_multiproc_dir

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["gunicorn", "kari_backend.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "3"]