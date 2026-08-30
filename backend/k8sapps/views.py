from kubernetes.client.rest import ApiException
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from namespaces.models import Namespace
from kari_backend.kube_utils import core_v1, apps_v1

from .models import K8sApp
from .serializers import K8sAppCreateSerializer, K8sAppUpdateSerializer
from .k8s_helpers import build_deployment_manifest, fetch_live_status


def _serialize_with_live_status(app):
    cluster = app.namespace.cluster
    core_api = core_v1(cluster)
    apps_api = apps_v1(cluster)
    live = fetch_live_status(core_api, apps_api, app)
    return {
        "id": app.id,
        "name": app.name,
        "namespace": app.namespace.name,
        "image": app.image,
        "replicas": app.replicas,
        "cpu": app.cpu,
        "memory": app.memory,
        "status": live["status"],
        "pods": live["pods"],
    }


class K8sAppListCreateView(APIView):
    def post(self, request):
        serializer = K8sAppCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        data = serializer.validated_data

        try:
            namespace = Namespace.objects.get(id=data["namespace_id"])
        except Namespace.DoesNotExist:
            return Response(
                {"detail": "Namespace not found."}, status=status.HTTP_404_NOT_FOUND
            )

        app = K8sApp(
            namespace=namespace,
            name=data["name"],
            image=data["image"],
            replicas=data["replicas"],
            cpu=data["cpu"],
            memory=data["memory"],
        )

        apps_api = apps_v1(namespace.cluster)
        manifest = build_deployment_manifest(app)

        try:
            apps_api.create_namespaced_deployment(namespace.name, manifest)
        except ApiException as e:
            if e.status == 409:
                return Response(
                    {"detail": "An App with this name already exists."},
                    status=status.HTTP_409_CONFLICT,
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

        app.save()
        return Response(_serialize_with_live_status(app), status=status.HTTP_201_CREATED)

    def get(self, request):
        namespace_id = request.query_params.get("namespace_id")
        if not namespace_id:
            return Response(
                {"detail": "The namespace_id query parameter is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        apps = K8sApp.objects.filter(namespace_id=namespace_id)
        return Response([_serialize_with_live_status(a) for a in apps])


class K8sAppDetailView(APIView):
    def get(self, request, pk):
        try:
            app = K8sApp.objects.get(id=pk)
        except K8sApp.DoesNotExist:
            return Response({"detail": "App not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(_serialize_with_live_status(app))

    def put(self, request, pk):
        try:
            app = K8sApp.objects.get(id=pk)
        except K8sApp.DoesNotExist:
            return Response({"detail": "App not found."}, status=status.HTTP_404_NOT_FOUND)

        serializer = K8sAppUpdateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        data = serializer.validated_data

        for field in ("image", "replicas", "cpu", "memory"):
            if field in data:
                setattr(app, field, data[field])

        apps_api = apps_v1(app.namespace.cluster)
        manifest = build_deployment_manifest(app)
        try:
            apps_api.patch_namespaced_deployment(app.name, app.namespace.name, manifest)
        except ApiException:
            return Response(
                {"detail": "Failed to update the Deployment in Kubernetes."},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        app.save()
        return Response(_serialize_with_live_status(app))

    def delete(self, request, pk):
        try:
            app = K8sApp.objects.get(id=pk)
        except K8sApp.DoesNotExist:
            return Response({"detail": "App not found."}, status=status.HTTP_404_NOT_FOUND)

        apps_api = apps_v1(app.namespace.cluster)
        try:
            apps_api.delete_namespaced_deployment(app.name, app.namespace.name)
        except ApiException as e:
            if e.status != 404:
                return Response(
                    {"detail": "Failed to delete from Kubernetes."},
                    status=status.HTTP_502_BAD_GATEWAY,
                )
        except Exception:
            return Response(
                {"detail": "Kubernetes is unreachable."},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        app.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
