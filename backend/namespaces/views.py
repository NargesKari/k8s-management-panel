from django.db import transaction, IntegrityError
from kubernetes import client as k8s_lib
from kubernetes.client.rest import ApiException
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from clusters.models import Cluster
from kari_backend.kube_utils import core_v1

from .models import Namespace
from .serializers import NamespaceCreateSerializer, NamespaceSerializer


class NamespaceListCreateView(APIView):
    """
    POST /namespace              -> creates a real Namespace in Kubernetes
                                     and records it in the database.
    GET  /namespace?cluster_id=5 -> reads only from the database
                                     (Source of Truth = Database).
    """

    def post(self, request):
        serializer = NamespaceCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        cluster_id = serializer.validated_data["cluster_id"]
        name = serializer.validated_data["name"]

        try:
            cluster = Cluster.objects.get(id=cluster_id)
        except Cluster.DoesNotExist:
            return Response(
                {"detail": "Cluster not found."}, status=status.HTTP_404_NOT_FOUND
            )

        api = core_v1(cluster)
        body = k8s_lib.V1Namespace(metadata=k8s_lib.V1ObjectMeta(name=name))

        try:
            api.create_namespace(body)
        except ApiException as e:
            if e.status == 409:
                return Response(
                    {"detail": "This namespace already exists in Kubernetes."},
                    status=status.HTTP_409_CONFLICT,
                )
            if e.status in (401, 403):
                return Response(
                    {"detail": "Backend is not authorized to create a namespace."},
                    status=status.HTTP_403_FORBIDDEN,
                )
            return Response(
                {"detail": "Error communicating with Kubernetes."},
                status=status.HTTP_502_BAD_GATEWAY,
            )
        except Exception:
            return Response(
                {"detail": "Kubernetes is unreachable."},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        try:
            ns = Namespace.objects.create(cluster=cluster, name=name)
        except IntegrityError:
            # The namespace was created in Kubernetes, but a DB record
            # already existed (rare race condition) - reuse it.
            ns = Namespace.objects.get(cluster=cluster, name=name)

        return Response(NamespaceSerializer(ns).data, status=status.HTTP_201_CREATED)

    def get(self, request):
        cluster_id = request.query_params.get("cluster_id")
        if not cluster_id:
            return Response(
                {"detail": "The cluster_id query parameter is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        namespaces = Namespace.objects.filter(cluster_id=cluster_id)
        return Response(NamespaceSerializer(namespaces, many=True).data)


class NamespaceDeleteView(APIView):
    """
    DELETE /namespace/<id>

    To avoid a race condition when two delete requests arrive at the same
    time, the row is locked with select_for_update() inside a transaction.
    Whichever request arrives first deletes the row; the second request's
    select_for_update() then finds no matching row and gets a 404 (not a
    409), because from the API's point of view the resource no longer
    exists.
    """

    def delete(self, request, pk):
        with transaction.atomic():
            try:
                ns = Namespace.objects.select_for_update().get(id=pk)
            except Namespace.DoesNotExist:
                return Response(
                    {"detail": "Namespace not found."}, status=status.HTTP_404_NOT_FOUND
                )

            cluster = ns.cluster
            api = core_v1(cluster)

            try:
                api.delete_namespace(ns.name)
            except ApiException as e:
                if e.status == 404:
                    # Already gone from Kubernetes; just clean up the DB record.
                    pass
                else:
                    ns.status = Namespace.Status.DELETE_FAILED
                    ns.save(update_fields=["status"])
                    return Response(
                        {"detail": "Failed to delete from Kubernetes. Marked for retry/reconciliation."},
                        status=status.HTTP_502_BAD_GATEWAY,
                    )
            except Exception:
                ns.status = Namespace.Status.DELETE_FAILED
                ns.save(update_fields=["status"])
                return Response(
                    {"detail": "Kubernetes is unreachable."},
                    status=status.HTTP_502_BAD_GATEWAY,
                )

            ns.delete()

        return Response(status=status.HTTP_204_NO_CONTENT)
