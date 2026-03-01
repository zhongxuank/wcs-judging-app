"""
Django Admin configuration for WCS Competition models.
"""

from django.contrib import admin

from .models import Competition, Judge, Competitor, Round, Heat, PreliminaryScore, FinalScore


class JudgeInline(admin.TabularInline):
    model = Judge
    extra = 0
    fields = ['name', 'is_chief_judge', 'assigned_role']


class CompetitorInline(admin.TabularInline):
    model = Competitor
    extra = 0
    fields = ['bib_number', 'name', 'role']


class RoundInline(admin.TabularInline):
    model = Round
    extra = 0
    fields = ['number', 'round_type', 'heat_size', 'is_active', 'is_complete']


@admin.register(Competition)
class CompetitionAdmin(admin.ModelAdmin):
    list_display = ['name', 'date', 'status', 'current_round', 'competitor_count', 'judge_count', 'created_at']
    list_filter = ['status', 'date']
    search_fields = ['name', 'chief_judge_name']
    inlines = [JudgeInline, CompetitorInline, RoundInline]
    date_hierarchy = 'date'
    
    def competitor_count(self, obj):
        return obj.competitors.count()
    competitor_count.short_description = 'Competitors'
    
    def judge_count(self, obj):
        return obj.judges.count()
    judge_count.short_description = 'Judges'


@admin.register(Judge)
class JudgeAdmin(admin.ModelAdmin):
    list_display = ['name', 'competition', 'is_chief_judge', 'assigned_role', 'created_at']
    list_filter = ['is_chief_judge', 'assigned_role', 'competition']
    search_fields = ['name', 'competition__name']
    autocomplete_fields = ['competition']


@admin.register(Competitor)
class CompetitorAdmin(admin.ModelAdmin):
    list_display = ['bib_number', 'name', 'role', 'competition', 'created_at']
    list_filter = ['role', 'competition']
    search_fields = ['name', 'bib_number', 'competition__name']
    autocomplete_fields = ['competition']


class HeatInline(admin.TabularInline):
    model = Heat
    extra = 0
    fields = ['number', 'display_leaders', 'display_followers', 'is_complete']
    readonly_fields = ['display_leaders', 'display_followers']
    
    def display_leaders(self, obj):
        return ", ".join([str(c) for c in obj.leaders.all()[:5]])
    display_leaders.short_description = 'Leaders'
    
    def display_followers(self, obj):
        return ", ".join([str(c) for c in obj.followers.all()[:5]])
    display_followers.short_description = 'Followers'


@admin.register(Round)
class RoundAdmin(admin.ModelAdmin):
    list_display = ['competition', 'number', 'round_type', 'heat_size', 'heat_count', 'is_active', 'is_complete']
    list_filter = ['round_type', 'is_active', 'is_complete', 'competition']
    search_fields = ['competition__name']
    inlines = [HeatInline]
    autocomplete_fields = ['competition']
    
    def heat_count(self, obj):
        return obj.heats.count()
    heat_count.short_description = 'Heats'


@admin.register(Heat)
class HeatAdmin(admin.ModelAdmin):
    list_display = ['round', 'number', 'leader_count', 'follower_count', 'is_complete']
    list_filter = ['is_complete', 'round__competition']
    search_fields = ['round__competition__name']
    filter_horizontal = ['leaders', 'followers']
    autocomplete_fields = ['round', 'leaders', 'followers']
    
    def leader_count(self, obj):
        return obj.leaders.count()
    leader_count.short_description = 'Leaders'
    
    def follower_count(self, obj):
        return obj.followers.count()
    follower_count.short_description = 'Followers'


@admin.register(PreliminaryScore)
class PreliminaryScoreAdmin(admin.ModelAdmin):
    list_display = ['judge', 'competitor', 'round', 'heat', 'raw_score', 'calculated_result', 'points', 'created_at']
    list_filter = ['calculated_result', 'round__competition', 'round']
    search_fields = ['judge__name', 'competitor__name', 'competitor__bib_number']
    autocomplete_fields = ['judge', 'competitor', 'round', 'heat']
    date_hierarchy = 'created_at'


@admin.register(FinalScore)
class FinalScoreAdmin(admin.ModelAdmin):
    list_display = ['judge', 'competitor', 'round', 'raw_score', 'technique_score', 'timing_score', 'presentation_score', 'created_at']
    list_filter = ['round__competition', 'round']
    search_fields = ['judge__name', 'competitor__name', 'competitor__bib_number']
    autocomplete_fields = ['judge', 'competitor', 'round']
    date_hierarchy = 'created_at'
