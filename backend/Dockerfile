FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev tar \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN mkdir -p /backups

EXPOSE 8000

# پیش‌فرض: اجرای وب‌سرور. برای celery worker/beat همین ایمیج با command متفاوت
# در Deployment جداگانه استفاده می‌شود (به‌جای این CMD).
CMD ["gunicorn", "kari_backend.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "3"]
