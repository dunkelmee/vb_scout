"""Pydantic models for the analysis service."""
from typing import Optional, Any
from pydantic import BaseModel


class InsightCard(BaseModel):
    id: str
    category: str  # strength | weakness | action_item
    priority: int
    title: str
    detail: str
    metric: str
    current_value: float
    target_value: Optional[float] = None
    direction: str  # up | down | maintain
    impact: Optional[str] = None
    source: str
    data: dict = {}


class SimulationSummary(BaseModel):
    baseline_win_pct: float
    score_distribution: dict
    avg_sets_played: float
    set_win_rates: list
    top_intervention: Optional[dict] = None
    sensitivity: Optional[list] = None


class AnalysisResult(BaseModel):
    match_id: str
    n_rallies: int
    baseline_win_pct: Optional[float] = None
    profiles: Optional[dict] = None
    rotation_profiles: Optional[dict] = None
    set_profiles: Optional[dict] = None
    score_context: Optional[dict] = None
    simulation: Optional[dict] = None
    substitution_impact: Optional[dict] = None
    timeout_impact: Optional[dict] = None
    tus_retrospective: Optional[dict] = None


class InsightsResponse(BaseModel):
    status: str
    match_id: str
    n_rallies: Optional[int] = None
    baseline_win_pct: Optional[float] = None
    insights: Optional[dict] = None
    simulation_summary: Optional[dict] = None
    updated_at: Optional[str] = None


class TrainingPriorityModel(BaseModel):
    id: str
    team_id: str
    source_match_id: Optional[str] = None
    insight_type: str
    priority_class: str
    metric: str
    baseline_value: float
    target_value: float
    direction: str
    label: str
    note: Optional[str] = None
    status: str
