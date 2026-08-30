from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

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
        cluster = serializer.save()
        # Deliberately re-serialize with ClusterListSerializer so the token
        # is never included in the response.
        return Response(
            ClusterListSerializer(cluster).data, status=status.HTTP_201_CREATED
        )

    def get(self, request):
        clusters = Cluster.objects.all()
        return Response(ClusterListSerializer(clusters, many=True).data)
