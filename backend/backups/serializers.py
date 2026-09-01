from rest_framework import serializers
from .models import Backup


class BackupCreateSerializer(serializers.Serializer):
    app_id = serializers.IntegerField()
    source_path = serializers.CharField(max_length=500)
    schedule = serializers.CharField(max_length=100, required=False, allow_blank=True)


class BackupSerializer(serializers.ModelSerializer):
    class Meta:
        model = Backup
        fields = ["backup_id", "app", "status", "file_path", "created_at"]


class BackupStatusSerializer(serializers.ModelSerializer):
    class Meta:
        model = Backup
        fields = ["backup_id", "app_id", "status"]