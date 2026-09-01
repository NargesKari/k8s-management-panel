import json

from django_celery_beat.models import CrontabSchedule, PeriodicTask
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from k8sapps.models import K8sApp

from .models import Backup, ScheduledBackup
from .serializers import BackupCreateSerializer, BackupStatusSerializer
from .tasks import run_backup_task


def _parse_cron(expr):
    """'0 20 * * *' -> dict of CrontabSchedule fields (minute, hour, day of month, month, day of week)."""
    parts = expr.strip().split()
    if len(parts) != 5:
        raise ValueError("Invalid cron format. It must have exactly 5 fields.")
    minute, hour, dom, month, dow = parts
    return {
        "minute": minute,
        "hour": hour,
        "day_of_month": dom,
        "month_of_year": month,
        "day_of_week": dow,
    }


class BackupListCreateView(APIView):
    def post(self, request):
        serializer = BackupCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        data = serializer.validated_data

        try:
            app = K8sApp.objects.get(id=data["app_id"])
        except K8sApp.DoesNotExist:
            return Response({"detail": "App not found."}, status=status.HTTP_404_NOT_FOUND)

        schedule = data.get("schedule")

        if schedule:
            try:
                cron_fields = _parse_cron(schedule)
            except ValueError as e:
                return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

            crontab, _ = CrontabSchedule.objects.get_or_create(**cron_fields)
            task_name = f"scheduled-backup-app-{app.id}-{schedule}"
            periodic_task, _ = PeriodicTask.objects.update_or_create(
                name=task_name,
                defaults={
                    "crontab": crontab,
                    "task": "backups.tasks.run_scheduled_backup",
                    "args": json.dumps([app.id, data["source_path"]]),
                    "enabled": True,
                },
            )
            ScheduledBackup.objects.update_or_create(
                app=app,
                source_path=data["source_path"],
                defaults={"cron_expression": schedule, "periodic_task": periodic_task},
            )
            return Response(
                {
                    "app_id": app.id,
                    "schedule": schedule,
                    "status": "scheduled",
                },
                status=status.HTTP_201_CREATED,
            )

        # Immediate backup: only create a pending record and respond right
        # away; the actual work is handed off to the Celery worker.
        backup = Backup.objects.create(app=app, source_path=data["source_path"])
        run_backup_task.delay(backup.pk)

        return Response(
            {"backup_id": backup.backup_id, "status": backup.status},
            status=status.HTTP_202_ACCEPTED,
        )

    def get(self, request):
        app_id = request.query_params.get("app_id")
        if not app_id:
            return Response(
                {"detail": "The app_id query parameter is required."}, status=status.HTTP_400_BAD_REQUEST
            )
        backups = Backup.objects.filter(app_id=app_id).order_by("-created_at")
        return Response(
            [{"backup_id": b.backup_id, "status": b.status} for b in backups]
        )


class BackupStatusView(APIView):
    def get(self, request, backup_id):
        try:
            backup = Backup.objects.get(backup_id=backup_id)
        except Backup.DoesNotExist:
            return Response({"detail": "Backup not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(BackupStatusSerializer(backup).data)
