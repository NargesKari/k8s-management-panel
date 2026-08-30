from rest_framework import serializers
from .models import Namespace


class NamespaceCreateSerializer(serializers.Serializer):
    cluster_id = serializers.IntegerField()
    name = serializers.CharField(max_length=255)


class NamespaceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Namespace
        fields = ["id", "name", "status"]
