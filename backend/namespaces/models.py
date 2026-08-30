from django.db import models
from clusters.models import Cluster


class Namespace(models.Model):
    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        DELETING = "deleting", "Deleting"
        DELETE_FAILED = "delete_failed", "Delete Failed"

    cluster = models.ForeignKey(Cluster, on_delete=models.CASCADE, related_name="namespaces")
    name = models.CharField(max_length=255)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        # Prevents two namespaces with the same name from being recorded
        # for the same cluster in the database.
        unique_together = ("cluster", "name")

    def __str__(self):
        return f"{self.cluster.name}/{self.name}"
