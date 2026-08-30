"""
Helpers for building a Deployment manifest and reading the live status of
an App's pods, with a short-lived Redis cache on top of the status lookup.
"""
import json
import redis
from kubernetes import client as k8s_lib

from django.conf import settings

_redis_client = redis.Redis.from_url(settings.REDIS_URL)

STATUS_CACHE_TTL = 60  # seconds - bonus requirement from the exercise


def build_deployment_manifest(app):
    return k8s_lib.V1Deployment(
        metadata=k8s_lib.V1ObjectMeta(name=app.name, labels={"app": app.name}),
        spec=k8s_lib.V1DeploymentSpec(
            replicas=app.replicas,
            selector=k8s_lib.V1LabelSelector(match_labels={"app": app.name}),
            template=k8s_lib.V1PodTemplateSpec(
                metadata=k8s_lib.V1ObjectMeta(labels={"app": app.name}),
                spec=k8s_lib.V1PodSpec(
                    containers=[
                        k8s_lib.V1Container(
                            name=app.name,
                            image=app.image,
                            resources=k8s_lib.V1ResourceRequirements(
                                requests={"cpu": app.cpu, "memory": app.memory},
                                limits={"cpu": app.cpu, "memory": app.memory},
                            ),
                        )
                    ]
                ),
            ),
        ),
    )


def fetch_live_status(core_api, apps_api, app):
    """
    Reads the real Deployment/Pod status from Kubernetes.
    The result is cached in Redis for 60 seconds to reduce load on the
    Kubernetes API.
    """
    cache_key = f"app_status:{app.namespace.cluster_id}:{app.namespace.name}:{app.name}"
    cached = _redis_client.get(cache_key)
    if cached:
        return json.loads(cached)

    pods = core_api.list_namespaced_pod(
        namespace=app.namespace.name, label_selector=f"app={app.name}"
    )

    pod_statuses = []
    all_ready = True
    for pod in pods.items:
        container_statuses = pod.status.container_statuses or []
        ready = all(cs.ready for cs in container_statuses) and bool(container_statuses)
        if not ready:
            all_ready = False
        pod_statuses.append(
            {
                "name": pod.metadata.name,
                "phase": pod.status.phase,
                "ready": ready,
            }
        )

    overall_status = "Ready" if pod_statuses and all_ready else "Not Ready"
    if not pod_statuses:
        overall_status = "Pending"

    result = {"status": overall_status, "pods": pod_statuses}
    _redis_client.setex(cache_key, STATUS_CACHE_TTL, json.dumps(result))
    return result
