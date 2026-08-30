from django.db import models
from namespaces.models import Namespace


class K8sApp(models.Model):
    namespace = models.ForeignKey(Namespace, on_delete=models.CASCADE, related_name="apps")
    name = models.CharField(max_length=255)
    image = models.CharField(max_length=500)
    replicas = models.PositiveIntegerField(default=1)
    cpu = models.CharField(max_length=20, default="250m")  # e.g. "500m"
    memory = models.CharField(max_length=20, default="256Mi")  # e.g. "512Mi"
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("namespace", "name")

    def __str__(self):
        return f"{self.namespace}/{self.name}"
