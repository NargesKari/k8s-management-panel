from django.urls import path
from .views import BackupListCreateView, BackupStatusView

urlpatterns = [
    path("", BackupListCreateView.as_view(), name="backup-list-create"),
    path("/<str:backup_id>", BackupStatusView.as_view(), name="backup-status"),
]