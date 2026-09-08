from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from kari_backend.metrics import track_kubernetes_operation

from .models import Cluster
from .serializers import ClusterCreateSerializer, ClusterListSerializer


class ClusterListCreateView(APIView):
    """
    POST /cluster  -> stores the cluster in the database only. No connection
                       to Kubernetes is made here.
    GET  /cluster  -> returns the list of clusters without the token field.
    """

    def post(self, request):
        serializer = ClusterCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        # Cluster create/list are DB-only by design (the exercise forbids
        # touching Kubernetes here), but they are still user-facing
        # operations on the "cluster" resource, so they are recorded with
        # the same metric for a complete picture.
        with track_kubernetes_operation("cluster", "create"):
            cluster = serializer.save()
        # Deliberately re-serialize with ClusterListSerializer so the token
        # is never included in the response.
        return Response(
            ClusterListSerializer(cluster).data, status=status.HTTP_201_CREATED
        )

    def get(self, request):
        with track_kubernetes_operation("cluster", "list"):
            clusters = list(Cluster.objects.all())
        return Response(ClusterListSerializer(clusters, many=True).data)
