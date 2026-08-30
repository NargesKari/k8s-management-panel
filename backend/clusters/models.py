from django.db import models


class Cluster(models.Model):
    """
    A Cluster only stores connection information.

    Note: `token` is sensitive data. It must never be returned in an API
    response and must never be logged anywhere. For this exercise it is
    stored as plain text, but in a real system it should be protected with
    encryption at rest or a secret manager (e.g. Vault or a Kubernetes
    Secret).
    """

    name = models.CharField(max_length=255)
    address = models.CharField(max_length=255)
    token = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name
