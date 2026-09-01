from django.urls import path
from .views import K8sAppListCreateView, K8sAppDetailView

urlpatterns = [
    path("", K8sAppListCreateView.as_view(), name="app-list-create"),
    path("/<int:pk>", K8sAppDetailView.as_view(), name="app-detail"),
]