from django.urls import path
from .views import NamespaceListCreateView, NamespaceDeleteView

urlpatterns = [
    path("", NamespaceListCreateView.as_view(), name="namespace-list-create"),
    path("<int:pk>", NamespaceDeleteView.as_view(), name="namespace-delete"),
]
