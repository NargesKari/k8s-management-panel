from rest_framework import serializers
from .models import Cluster


class ClusterCreateSerializer(serializers.ModelSerializer):
    """Used for creating a Cluster - accepts the token from the request body."""

    class Meta:
        model = Cluster
        fields = ["id", "name", "address", "token"]
        extra_kwargs = {"token": {"write_only": True}}


class ClusterListSerializer(serializers.ModelSerializer):
    """Used for listing/detail responses - the token is never included."""

    class Meta:
        model = Cluster
        fields = ["id", "name", "address"]
