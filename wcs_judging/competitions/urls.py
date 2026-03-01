"""
URL configuration for competitions app.
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter

from . import views

# Create a router and register our viewsets
router = DefaultRouter()
router.register(r'competitions', views.CompetitionViewSet, basename='competition')
router.register(r'judges', views.JudgeViewSet, basename='judge')
router.register(r'competitors', views.CompetitorViewSet, basename='competitor')
router.register(r'rounds', views.RoundViewSet, basename='round')
router.register(r'heats', views.HeatViewSet, basename='heat')
router.register(r'preliminary-scores', views.PreliminaryScoreViewSet, basename='preliminaryscore')
router.register(r'final-scores', views.FinalScoreViewSet, basename='finalscore')

urlpatterns = [
    path('', include(router.urls)),
]