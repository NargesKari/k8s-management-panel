import uuid
from django.db import models
from django_celery_beat.models import PeriodicTask
from k8sapps.models import K8sApp


def generate_backup_id():
    return f"bkp_{uuid.uuid4().hex[:8]}"


class Backup(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        RUNNING = "running", "Running"
        COMPLETED = "completed", "Completed"
        FAILED = "failed", "Failed"

    backup_id = models.CharField(max_length=32, unique=True, default=generate_backup_id)
    app = models.ForeignKey(K8sApp, on_delete=models.CASCADE, related_name="backups")
    source_path = models.CharField(max_length=500)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    file_path = models.CharField(max_length=1000, blank=True, default="")
    error_message = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    started_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return self.backup_id


class ScheduledBackup(models.Model):
    """Defines a recurring backup schedule; every run creates a new, independent Backup."""

    app = models.ForeignKey(K8sApp, on_delete=models.CASCADE, related_name="backup_schedules")
    source_path = models.CharField(max_length=500)
    cron_expression = models.CharField(max_length=100)
    periodic_task = models.OneToOneField(PeriodicTask, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)
