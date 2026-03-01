"""
Django REST Framework serializers for WCS Competition models.
"""

from rest_framework import serializers

from .models import Competition, Judge, Competitor, Round, Heat, PreliminaryScore, FinalScore


class JudgeSerializer(serializers.ModelSerializer):
    """Serializer for Judge model."""
    
    class Meta:
        model = Judge
        fields = ['id', 'name', 'is_chief_judge', 'assigned_role', 'created_at']
        read_only_fields = ['id', 'created_at']


class CompetitorSerializer(serializers.ModelSerializer):
    """Serializer for Competitor model."""
    
    class Meta:
        model = Competitor
        fields = ['id', 'bib_number', 'name', 'role', 'created_at']
        read_only_fields = ['id', 'created_at']


class HeatSerializer(serializers.ModelSerializer):
    """Serializer for Heat model."""
    leaders = CompetitorSerializer(many=True, read_only=True)
    followers = CompetitorSerializer(many=True, read_only=True)
    leader_ids = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=Competitor.objects.all(),
        source='leaders',
        write_only=True,
        required=False
    )
    follower_ids = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=Competitor.objects.all(),
        source='followers',
        write_only=True,
        required=False
    )
    
    class Meta:
        model = Heat
        fields = [
            'id', 'number', 'leaders', 'followers',
            'leader_ids', 'follower_ids',
            'is_complete', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']


class RoundSerializer(serializers.ModelSerializer):
    """Serializer for Round model."""
    heats = HeatSerializer(many=True, read_only=True)
    judges = JudgeSerializer(many=True, read_only=True)
    heat_count = serializers.IntegerField(source='heats.count', read_only=True)
    
    class Meta:
        model = Round
        fields = [
            'id', 'number', 'round_type', 'heat_size',
            'required_yes_count', 'advancing_count', 'alternate_count',
            'heats', 'judges', 'heat_count',
            'is_active', 'is_complete', 'created_at'
        ]
        read_only_fields = ['id', 'created_at', 'heat_count']


class CompetitionSerializer(serializers.ModelSerializer):
    """Serializer for Competition model."""
    judges = JudgeSerializer(many=True, read_only=True)
    competitors = CompetitorSerializer(many=True, read_only=True)
    rounds = RoundSerializer(many=True, read_only=True)
    
    # Write-only fields for creating/updating
    judge_count = serializers.IntegerField(write_only=True, required=False)
    competitor_count = serializers.IntegerField(source='competitors.count', read_only=True)
    round_count = serializers.IntegerField(source='rounds.count', read_only=True)
    
    class Meta:
        model = Competition
        fields = [
            'id', 'name', 'date', 'chief_judge_name', 'status',
            'current_round', 'judges', 'competitors', 'rounds',
            'judge_count', 'competitor_count', 'round_count',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'competitor_count', 'round_count']


class CompetitionListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for competition lists."""
    
    competitor_count = serializers.IntegerField(source='competitors.count', read_only=True)
    judge_count = serializers.IntegerField(source='judges.count', read_only=True)
    round_count = serializers.IntegerField(source='rounds.count', read_only=True)
    
    class Meta:
        model = Competition
        fields = [
            'id', 'name', 'date', 'chief_judge_name', 'status',
            'current_round', 'competitor_count', 'judge_count', 'round_count',
            'created_at'
        ]


class CompetitionCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating a new competition with judges."""
    
    class Meta:
        model = Competition
        fields = ['id', 'name', 'date', 'chief_judge_name', 'status']
        read_only_fields = ['id', 'status']


class PreliminaryScoreSerializer(serializers.ModelSerializer):
    """Serializer for PreliminaryScore model."""
    judge_name = serializers.CharField(source='judge.name', read_only=True)
    competitor_name = serializers.CharField(source='competitor.name', read_only=True)
    competitor_bib = serializers.CharField(source='competitor.bib_number', read_only=True)
    
    class Meta:
        model = PreliminaryScore
        fields = [
            'id', 'judge', 'judge_name', 'competitor', 'competitor_name', 'competitor_bib',
            'round', 'heat', 'raw_score', 'calculated_result', 'points',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'judge_name', 'competitor_name', 'competitor_bib']


class FinalScoreSerializer(serializers.ModelSerializer):
    """Serializer for FinalScore model."""
    judge_name = serializers.CharField(source='judge.name', read_only=True)
    competitor_name = serializers.CharField(source='competitor.name', read_only=True)
    competitor_bib = serializers.CharField(source='competitor.bib_number', read_only=True)
    
    class Meta:
        model = FinalScore
        fields = [
            'id', 'judge', 'judge_name', 'competitor', 'competitor_name', 'competitor_bib',
            'round', 'raw_score', 'technique_score', 'timing_score', 'presentation_score',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'judge_name', 'competitor_name', 'competitor_bib']


# Special serializers for bulk operations

class BulkJudgeCreateSerializer(serializers.Serializer):
    """Serializer for creating multiple judges at once."""
    competition_id = serializers.UUIDField()
    judges = JudgeSerializer(many=True)
    
    def create(self, validated_data):
        competition_id = validated_data['competition_id']
        judges_data = validated_data['judges']
        
        created_judges = []
        for judge_data in judges_data:
            judge = Judge.objects.create(competition_id=competition_id, **judge_data)
            created_judges.append(judge)
        
        return {'competition_id': competition_id, 'judges': created_judges}


class BulkCompetitorCreateSerializer(serializers.Serializer):
    """Serializer for creating multiple competitors at once."""
    competition_id = serializers.UUIDField()
    competitors = CompetitorSerializer(many=True)
    
    def create(self, validated_data):
        competition_id = validated_data['competition_id']
        competitors_data = validated_data['competitors']
        
        created_competitors = []
        for competitor_data in competitors_data:
            competitor = Competitor.objects.create(competition_id=competition_id, **competitor_data)
            created_competitors.append(competitor)
        
        return {'competition_id': competition_id, 'competitors': created_competitors}


class CSVImportSerializer(serializers.Serializer):
    """Serializer for CSV competitor import."""
    competition_id = serializers.UUIDField()
    csv_data = serializers.CharField()
    
    def validate_csv_data(self, value):
        """Validate that CSV data has the correct format."""
        lines = value.strip().split('\n')
        
        if len(lines) < 2:
            raise serializers.ValidationError("CSV must have at least a header and one data row.")
        
        header = lines[0].strip().lower()
        if 'bib' not in header or 'name' not in header or 'role' not in header:
            raise serializers.ValidationError("CSV header must contain 'bib', 'name', and 'role' columns.")
        
        return value


class HeatGenerationSerializer(serializers.Serializer):
    """Serializer for generating heats for a round."""
    round_id = serializers.UUIDField()
    heat_size = serializers.IntegerField(min_value=3, max_value=20, default=6)
    
    
class ScoreSubmissionSerializer(serializers.Serializer):
    """Serializer for submitting multiple scores at once."""
    judge_id = serializers.UUIDField()
    round_id = serializers.UUIDField()
    heat_id = serializers.UUIDField()
    scores = serializers.ListField(
        child=serializers.DictField(
            child=serializers.IntegerField(min_value=0, max_value=100)
        )
    )
    
    def validate_scores(self, value):
        """Validate that each score has competitor_id and raw_score."""
        for score in value:
            if 'competitor_id' not in score:
                raise serializers.ValidationError("Each score must have a 'competitor_id'.")
            if 'raw_score' not in score:
                raise serializers.ValidationError("Each score must have a 'raw_score'.")
        return value


class RoundResultsSerializer(serializers.Serializer):
    """Serializer for round results."""
    round_id = serializers.UUIDField()
    include_scores = serializers.BooleanField(default=False)
