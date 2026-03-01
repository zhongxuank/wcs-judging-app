"""
Models for WCS Competition Judging System
"""

import uuid

from django.db import models


class Competition(models.Model):
    """A dance competition event."""
    
    STATUS_CHOICES = [
        ('setup', 'Setup'),
        ('in_progress', 'In Progress'),
        ('completed', 'Completed'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    date = models.DateField()
    chief_judge_name = models.CharField(max_length=255)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='setup')
    current_round = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.name} ({self.date})"


class Judge(models.Model):
    """A judge assigned to a competition."""
    
    ROLE_CHOICES = [
        ('leader', 'Leader'),
        ('follower', 'Follower'),
        ('both', 'Both'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    competition = models.ForeignKey(
        Competition,
        on_delete=models.CASCADE,
        related_name='judges'
    )
    name = models.CharField(max_length=255)
    is_chief_judge = models.BooleanField(default=False)
    assigned_role = models.CharField(
        max_length=20,
        choices=ROLE_CHOICES,
        default='both'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-is_chief_judge', 'name']
    
    def __str__(self):
        role_str = " (Chief)" if self.is_chief_judge else f" ({self.assigned_role})"
        return f"{self.name}{role_str}"


class Competitor(models.Model):
    """A competitor (dancer) in the competition."""
    
    ROLE_CHOICES = [
        ('leader', 'Leader'),
        ('follower', 'Follower'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    competition = models.ForeignKey(
        Competition,
        on_delete=models.CASCADE,
        related_name='competitors'
    )
    bib_number = models.CharField(max_length=20)
    name = models.CharField(max_length=255)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['bib_number']
        unique_together = ['competition', 'bib_number']
    
    def __str__(self):
        return f"#{self.bib_number} - {self.name} ({self.role})"


class Round(models.Model):
    """A round in the competition."""
    
    TYPE_CHOICES = [
        ('preliminary', 'Preliminary'),
        ('final', 'Final'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    competition = models.ForeignKey(
        Competition,
        on_delete=models.CASCADE,
        related_name='rounds'
    )
    number = models.IntegerField()
    round_type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    heat_size = models.IntegerField(default=6)
    required_yes_count = models.IntegerField(default=3)
    advancing_count = models.IntegerField(default=0)
    alternate_count = models.IntegerField(choices=[(2, '2'), (3, '3')], default=2)
    is_active = models.BooleanField(default=False)
    is_complete = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['competition', 'number']
        unique_together = ['competition', 'number']
    
    def __str__(self):
        return f"{self.competition.name} - Round {self.number} ({self.round_type})"


class Heat(models.Model):
    """A heat within a round."""
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    round = models.ForeignKey(
        Round,
        on_delete=models.CASCADE,
        related_name='heats'
    )
    number = models.IntegerField()
    leaders = models.ManyToManyField(
        Competitor,
        related_name='leader_heats',
        limit_choices_to={'role': 'leader'}
    )
    followers = models.ManyToManyField(
        Competitor,
        related_name='follower_heats',
        limit_choices_to={'role': 'follower'}
    )
    is_complete = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['round', 'number']
        unique_together = ['round', 'number']
    
    def __str__(self):
        return f"{self.round} - Heat {self.number}"


class PreliminaryScore(models.Model):
    """A score given by a judge to a competitor in a preliminary round."""
    
    RESULT_CHOICES = [
        ('yes', 'Yes'),
        ('alt1', 'Alternate 1'),
        ('alt2', 'Alternate 2'),
        ('alt3', 'Alternate 3'),
        ('no', 'No'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    judge = models.ForeignKey(
        Judge,
        on_delete=models.CASCADE,
        related_name='preliminary_scores'
    )
    competitor = models.ForeignKey(
        Competitor,
        on_delete=models.CASCADE,
        related_name='preliminary_scores'
    )
    round = models.ForeignKey(
        Round,
        on_delete=models.CASCADE,
        related_name='preliminary_scores'
    )
    heat = models.ForeignKey(
        Heat,
        on_delete=models.CASCADE,
        related_name='preliminary_scores'
    )
    raw_score = models.IntegerField()  # 0-100
    calculated_result = models.CharField(
        max_length=10,
        choices=RESULT_CHOICES,
        blank=True,
        null=True
    )
    points = models.IntegerField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['round', 'heat', 'competitor', 'judge']
        unique_together = ['judge', 'competitor', 'round', 'heat']
    
    def __str__(self):
        return f"{self.judge} scores {self.competitor}: {self.raw_score}"


class FinalScore(models.Model):
    """A score given by a judge to a competitor in a final round."""
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    judge = models.ForeignKey(
        Judge,
        on_delete=models.CASCADE,
        related_name='final_scores'
    )
    competitor = models.ForeignKey(
        Competitor,
        on_delete=models.CASCADE,
        related_name='final_scores'
    )
    round = models.ForeignKey(
        Round,
        on_delete=models.CASCADE,
        related_name='final_scores'
    )
    # Finals-specific scoring fields (to be expanded based on requirements)
    technique_score = models.IntegerField(blank=True, null=True)
    timing_score = models.IntegerField(blank=True, null=True)
    presentation_score = models.IntegerField(blank=True, null=True)
    raw_score = models.IntegerField(blank=True, null=True)  # Overall 0-100
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['round', 'competitor', 'judge']
        unique_together = ['judge', 'competitor', 'round']
    
    def __str__(self):
        return f"{self.judge} scores {self.competitor} in finals: {self.raw_score}"
