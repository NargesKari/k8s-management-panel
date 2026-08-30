from rest_framework import serializers
from .models import K8sApp


class K8sAppCreateSerializer(serializers.Serializer):
    namespace_id = serializers.IntegerField()
    name = serializers.CharField(max_length=255)
    image = serializers.CharField(max_length=500)
    replicas = serializers.IntegerField(default=1, min_value=1)
    cpu = serializers.CharField(default="250m")
    memory = serializers.CharField(default="256Mi")


class K8sAppUpdateSerializer(serializers.Serializer):
    image = serializers.CharField(max_length=500, required=False)
    replicas = serializers.IntegerField(required=False, min_value=1)
    cpu = serializers.CharField(required=False)
    memory = serializers.CharField(required=False)


class K8sAppSerializer(serializers.ModelSerializer):
    """Base output without the live pod status (for cases where a Kubernetes fetch isn't needed)."""

    class Meta:
        model = K8sApp
        fields = ["id", "name", "namespace", "image", "replicas", "cpu", "memory"]
