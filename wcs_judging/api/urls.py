"""
Main API URL configuration.
"""

from django.urls import path, include

urlpatterns = [
    path('', include('competitions.urls')),
]