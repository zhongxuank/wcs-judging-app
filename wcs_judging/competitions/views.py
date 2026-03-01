"""
Django REST Framework views for WCS Competition API.
"""

import csv
import io
import random
from collections import defaultdict

from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view
from rest_framework.response import Response

from .models import Competition, Competitor, FinalScore, Heat, Judge, PreliminaryScore, Round
from .serializers import (
    BulkCompetitorCreateSerializer,
    BulkJudgeCreateSerializer,
    CSVImportSerializer,
    CompetitionCreateSerializer,
    CompetitionListSerializer,
    CompetitionSerializer,
    CompetitorSerializer,
    FinalScoreSerializer,
    HeatGenerationSerializer,
    HeatSerializer,
    JudgeSerializer,
    PreliminaryScoreSerializer,
    RoundSerializer,
    ScoreSubmissionSerializer,
)


class CompetitionViewSet(viewsets.ModelViewSet):
    """ViewSet for Competition model."""
    queryset = Competition.objects.all()
    
    def get_serializer_class(self):
        if self.action == 'list':
            return CompetitionListSerializer
        elif self.action == 'create':
            return CompetitionCreateSerializer
        return CompetitionSerializer
    
    @action(detail=True, methods=['post'])
    def activate_round(self, request, pk=None):
        """Activate a specific round in the competition."""
        competition = self.get_object()
        round_number = request.data.get('round_number')
        
        if round_number is None:
            return Response(
                {'error': 'round_number is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            round_obj = competition.rounds.get(number=round_number)
        except Round.DoesNotExist:
            return Response(
                {'error': f'Round {round_number} not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Deactivate all other rounds
        competition.rounds.filter(is_active=True).update(is_active=False)
        
        # Activate the specified round
        round_obj.is_active = True
        round_obj.save()
        
        competition.current_round = round_number
        competition.status = 'in_progress'
        competition.save()
        
        return Response({'status': f'Round {round_number} activated'})
    
    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        """Mark the competition as completed."""
        competition = self.get_object()
        competition.status = 'completed'
        competition.save()
        return Response({'status': 'Competition marked as completed'})


class JudgeViewSet(viewsets.ModelViewSet):
    """ViewSet for Judge model."""
    queryset = Judge.objects.all()
    serializer_class = JudgeSerializer
    
    def get_queryset(self):
        queryset = Judge.objects.all()
        competition_id = self.request.query_params.get('competition')
        if competition_id:
            queryset = queryset.filter(competition_id=competition_id)
        return queryset
    
    @action(detail=False, methods=['post'])
    def bulk_create(self, request):
        """Create multiple judges at once."""
        serializer = BulkJudgeCreateSerializer(data=request.data)
        if serializer.is_valid():
            result = serializer.save()
            return Response(
                JudgeSerializer(result['judges'], many=True).data,
                status=status.HTTP_201_CREATED
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class CompetitorViewSet(viewsets.ModelViewSet):
    """ViewSet for Competitor model."""
    queryset = Competitor.objects.all()
    serializer_class = CompetitorSerializer
    
    def get_queryset(self):
        queryset = Competitor.objects.all()
        competition_id = self.request.query_params.get('competition')
        role = self.request.query_params.get('role')
        
        if competition_id:
            queryset = queryset.filter(competition_id=competition_id)
        if role:
            queryset = queryset.filter(role=role)
            
        return queryset
    
    @action(detail=False, methods=['post'])
    def bulk_create(self, request):
        """Create multiple competitors at once."""
        serializer = BulkCompetitorCreateSerializer(data=request.data)
        if serializer.is_valid():
            result = serializer.save()
            return Response(
                CompetitorSerializer(result['competitors'], many=True).data,
                status=status.HTTP_201_CREATED
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=False, methods=['post'])
    def import_csv(self, request):
        """Import competitors from CSV data."""
        serializer = CSVImportSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        competition_id = serializer.validated_data['competition_id']
        csv_data = serializer.validated_data['csv_data']
        
        # Verify competition exists
        try:
            competition = Competition.objects.get(id=competition_id)
        except Competition.DoesNotExist:
            return Response(
                {'error': 'Competition not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Parse CSV
        created_competitors = []
        errors = []
        
        try:
            csv_reader = csv.DictReader(io.StringIO(csv_data))
            
            # Check for required columns
            fieldnames = [f.lower().strip() for f in csv_reader.fieldnames]
            if 'bib' not in fieldnames and 'bib_number' not in fieldnames:
                errors.append("CSV must have a 'bib' or 'bib_number' column")
            if 'name' not in fieldnames:
                errors.append("CSV must have a 'name' column")
            if 'role' not in fieldnames:
                errors.append("CSV must have a 'role' column")
            
            if errors:
                return Response({'errors': errors}, status=status.HTTP_400_BAD_REQUEST)
            
            # Track bib numbers for duplicate detection
            bib_numbers = set()
            
            with transaction.atomic():
                for row in csv_reader:
                    # Handle different column name variations
                    bib = row.get('bib', row.get('bib_number', '')).strip()
                    name = row.get('name', '').strip()
                    role = row.get('role', '').strip().lower()
                    
                    # Validate
                    if not bib or not name or not role:
                        errors.append(f"Missing data in row: {row}")
                        continue
                    
                    if role not in ['leader', 'follower']:
                        errors.append(f"Invalid role '{role}' for competitor {name}")
                        continue
                    
                    # Check for duplicate bib in this import
                    if bib in bib_numbers:
                        errors.append(f"Duplicate bib number: {bib}")
                        continue
                    bib_numbers.add(bib)
                    
                    # Check for existing bib in competition
                    if Competitor.objects.filter(competition=competition, bib_number=bib).exists():
                        errors.append(f"Bib number {bib} already exists in this competition")
                        continue
                    
                    competitor = Competitor.objects.create(
                        competition=competition,
                        bib_number=bib,
                        name=name,
                        role=role
                    )
                    created_competitors.append(competitor)
        
        except Exception as e:
            return Response(
                {'error': f'Failed to parse CSV: {str(e)}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        return Response({
            'created': len(created_competitors),
            'competitors': CompetitorSerializer(created_competitors, many=True).data,
            'errors': errors
        }, status=status.HTTP_201_CREATED if created_competitors else status.HTTP_400_BAD_REQUEST)


class RoundViewSet(viewsets.ModelViewSet):
    """ViewSet for Round model."""
    queryset = Round.objects.all()
    serializer_class = RoundSerializer
    
    def get_queryset(self):
        queryset = Round.objects.all()
        competition_id = self.request.query_params.get('competition')
        if competition_id:
            queryset = queryset.filter(competition_id=competition_id)
        return queryset
    
    @action(detail=True, methods=['post'])
    def generate_heats(self, request, pk=None):
        """Generate heats for this round."""
        round_obj = self.get_object()
        
        # Get heat size from request or use default
        heat_size = request.data.get('heat_size', round_obj.heat_size)
        
        # Get competitors for this competition
        competition = round_obj.competition
        leaders = list(competition.competitors.filter(role='leader'))
        followers = list(competition.competitors.filter(role='follower'))
        
        if not leaders or not followers:
            return Response(
                {'error': 'Not enough competitors to generate heats'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Shuffle for randomization
        random.shuffle(leaders)
        random.shuffle(followers)
        
        # Calculate number of heats needed
        num_leaders = len(leaders)
        num_followers = len(followers)
        num_heats = max(
            (num_leaders + heat_size - 1) // heat_size,
            (num_followers + heat_size - 1) // heat_size
        )
        
        created_heats = []
        
        with transaction.atomic():
            # Delete existing heats
            round_obj.heats.all().delete()
            
            # Create heats with balanced distribution
            leader_idx = 0
            follower_idx = 0
            
            for heat_num in range(1, num_heats + 1):
                heat = Heat.objects.create(round=round_obj, number=heat_num)
                
                # Calculate how many leaders/followers for this heat
                remaining_leaders = num_leaders - leader_idx
                remaining_followers = num_followers - follower_idx
                remaining_heats = num_heats - heat_num + 1
                
                leaders_this_heat = (remaining_leaders + remaining_heats - 1) // remaining_heats
                followers_this_heat = (remaining_followers + remaining_heats - 1) // remaining_heats
                
                # Add leaders
                for _ in range(leaders_this_heat):
                    if leader_idx < num_leaders:
                        heat.leaders.add(leaders[leader_idx])
                        leader_idx += 1
                
                # Add followers
                for _ in range(followers_this_heat):
                    if follower_idx < num_followers:
                        heat.followers.add(followers[follower_idx])
                        follower_idx += 1
                
                created_heats.append(heat)
        
        return Response({
            'created': len(created_heats),
            'heats': HeatSerializer(created_heats, many=True).data
        })
    
    @action(detail=True, methods=['get'])
    def results(self, request, pk=None):
        """Get results for this round."""
        round_obj = self.get_object()
        
        if round_obj.round_type == 'preliminary':
            # Calculate preliminary results
            scores = PreliminaryScore.objects.filter(round=round_obj)
            
            # Group by competitor and calculate totals
            competitor_results = defaultdict(lambda: {
                'competitor': None,
                'total_points': 0,
                'yes_count': 0,
                'alt_count': 0,
                'score_count': 0
            })
            
            for score in scores:
                comp_id = str(score.competitor_id)
                if competitor_results[comp_id]['competitor'] is None:
                    competitor_results[comp_id]['competitor'] = CompetitorSerializer(score.competitor).data
                
                competitor_results[comp_id]['score_count'] += 1
                competitor_results[comp_id]['total_points'] += score.points or 0
                
                if score.calculated_result == 'yes':
                    competitor_results[comp_id]['yes_count'] += 1
                elif score.calculated_result in ['alt1', 'alt2', 'alt3']:
                    competitor_results[comp_id]['alt_count'] += 1
            
            # Sort by total points descending
            sorted_results = sorted(
                competitor_results.values(),
                key=lambda x: (x['total_points'], x['yes_count']),
                reverse=True
            )
            
            return Response({
                'round': RoundSerializer(round_obj).data,
                'results': sorted_results
            })
        
        else:
            # Finals results
            scores = FinalScore.objects.filter(round=round_obj)
            
            # Group by competitor
            competitor_results = defaultdict(lambda: {
                'competitor': None,
                'total_score': 0,
                'technique_total': 0,
                'timing_total': 0,
                'presentation_total': 0,
                'score_count': 0
            })
            
            for score in scores:
                comp_id = str(score.competitor_id)
                if competitor_results[comp_id]['competitor'] is None:
                    competitor_results[comp_id]['competitor'] = CompetitorSerializer(score.competitor).data
                
                competitor_results[comp_id]['score_count'] += 1
                competitor_results[comp_id]['total_score'] += score.raw_score or 0
                competitor_results[comp_id]['technique_total'] += score.technique_score or 0
                competitor_results[comp_id]['timing_total'] += score.timing_score or 0
                competitor_results[comp_id]['presentation_total'] += score.presentation_score or 0
            
            # Calculate averages
            for result in competitor_results.values():
                count = result['score_count']
                if count > 0:
                    result['average_score'] = result['total_score'] / count
                    result['technique_avg'] = result['technique_total'] / count
                    result['timing_avg'] = result['timing_total'] / count
                    result['presentation_avg'] = result['presentation_total'] / count
            
            # Sort by average score descending
            sorted_results = sorted(
                competitor_results.values(),
                key=lambda x: x.get('average_score', 0),
                reverse=True
            )
            
            return Response({
                'round': RoundSerializer(round_obj).data,
                'results': sorted_results
            })


class HeatViewSet(viewsets.ModelViewSet):
    """ViewSet for Heat model."""
    queryset = Heat.objects.all()
    serializer_class = HeatSerializer
    
    def get_queryset(self):
        queryset = Heat.objects.all()
        round_id = self.request.query_params.get('round')
        if round_id:
            queryset = queryset.filter(round_id=round_id)
        return queryset


class PreliminaryScoreViewSet(viewsets.ModelViewSet):
    """ViewSet for PreliminaryScore model."""
    queryset = PreliminaryScore.objects.all()
    serializer_class = PreliminaryScoreSerializer
    
    def get_queryset(self):
        queryset = PreliminaryScore.objects.all()
        round_id = self.request.query_params.get('round')
        judge_id = self.request.query_params.get('judge')
        heat_id = self.request.query_params.get('heat')
        
        if round_id:
            queryset = queryset.filter(round_id=round_id)
        if judge_id:
            queryset = queryset.filter(judge_id=judge_id)
        if heat_id:
            queryset = queryset.filter(heat_id=heat_id)
            
        return queryset
    
    @action(detail=False, methods=['post'])
    def bulk_submit(self, request):
        """Submit multiple preliminary scores at once."""
        serializer = ScoreSubmissionSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        judge_id = serializer.validated_data['judge_id']
        round_id = serializer.validated_data['round_id']
        heat_id = serializer.validated_data['heat_id']
        scores_data = serializer.validated_data['scores']
        
        # Verify objects exist
        judge = get_object_or_404(Judge, id=judge_id)
        round_obj = get_object_or_404(Round, id=round_id)
        heat = get_object_or_404(Heat, id=heat_id)
        
        created_scores = []
        errors = []
        
        with transaction.atomic():
            for score_data in scores_data:
                competitor_id = score_data['competitor_id']
                raw_score = score_data['raw_score']
                
                try:
                    competitor = Competitor.objects.get(id=competitor_id)
                except Competitor.DoesNotExist:
                    errors.append(f"Competitor {competitor_id} not found")
                    continue
                
                # Calculate result based on score
                calculated_result = calculate_preliminary_result(
                    raw_score, round_obj.required_yes_count
                )
                points = calculate_points(calculated_result)
                
                # Update or create score
                score, created = PreliminaryScore.objects.update_or_create(
                    judge=judge,
                    competitor=competitor,
                    round=round_obj,
                    heat=heat,
                    defaults={
                        'raw_score': raw_score,
                        'calculated_result': calculated_result,
                        'points': points
                    }
                )
                created_scores.append(score)
        
        return Response({
            'submitted': len(created_scores),
            'scores': PreliminaryScoreSerializer(created_scores, many=True).data,
            'errors': errors
        })


class FinalScoreViewSet(viewsets.ModelViewSet):
    """ViewSet for FinalScore model."""
    queryset = FinalScore.objects.all()
    serializer_class = FinalScoreSerializer
    
    def get_queryset(self):
        queryset = FinalScore.objects.all()
        round_id = self.request.query_params.get('round')
        judge_id = self.request.query_params.get('judge')
        
        if round_id:
            queryset = queryset.filter(round_id=round_id)
        if judge_id:
            queryset = queryset.filter(judge_id=judge_id)
            
        return queryset


def calculate_preliminary_result(score, required_yes_count):
    """Calculate the result category based on score and required yes count."""
    # This is a simplified algorithm - adjust based on your specific requirements
    if score >= 80:
        return 'yes'
    elif score >= 70:
        return 'alt1'
    elif score >= 60:
        return 'alt2'
    elif score >= 50:
        return 'alt3'
    else:
        return 'no'


def calculate_points(result):
    """Convert result to points."""
    points_map = {
        'yes': 5,
        'alt1': 4,
        'alt2': 3,
        'alt3': 2,
        'no': 0
    }
    return points_map.get(result, 0)
