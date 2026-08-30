"""
A thin wrapper around the `kubernetes` library for building an API client
from a Cluster model instance (address + token). Used by both the
namespaces and k8sapps apps.
"""
from kubernetes import client as k8s_client


class KubeConnectionError(Exception):
    """Raised when Kubernetes API cannot be reached."""


def build_api_client(cluster):
    configuration = k8s_client.Configuration()
    configuration.host = f"https://{cluster.address}"
    configuration.api_key = {"authorization": f"Bearer {cluster.token}"}
    configuration.api_key_prefix = {"authorization": "Bearer"}
    # Note: verify_ssl is disabled for simplicity in this exercise.
    # In a real deployment, set the cluster's CA certificate instead.
    configuration.verify_ssl = False
    return k8s_client.ApiClient(configuration)


def core_v1(cluster):
    return k8s_client.CoreV1Api(build_api_client(cluster))


def apps_v1(cluster):
    return k8s_client.AppsV1Api(build_api_client(cluster))
