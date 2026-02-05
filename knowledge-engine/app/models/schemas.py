"""
Pydantic schemas for API request/response validation.
Follows the de-identification strategy from the masterplan.
"""

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


# =============================================================================
# Base Schemas
# =============================================================================


class BaseSchema(BaseModel):
    """Base schema with common configuration."""

    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
    )


class ConfidenceScore(BaseModel):
    """Confidence score with explanation."""

    score: float = Field(..., ge=0.0, le=1.0, description="Confidence score (0-1)")
    level: str = Field(..., description="Confidence level: high, medium, low")
    projects_count: int = Field(..., description="Number of projects in dataset")
    explanation: Optional[str] = Field(None, description="Explanation of confidence")


# =============================================================================
# Project Schemas
# =============================================================================


class ProjectBase(BaseModel):
    """Base project schema."""

    project_type: str = Field(..., description="Project type: solar, wind, battery, hybrid")
    capacity_mw: Optional[float] = Field(None, description="Project capacity in MW")
    location_region: Optional[str] = Field(None, description="De-identified region")
    location_state: Optional[str] = Field(None, description="State/province")


class ProjectCreate(ProjectBase):
    """Schema for creating a new project."""

    pass


class ProjectResponse(ProjectBase, BaseSchema):
    """Schema for project response."""

    id: UUID
    project_code: str
    created_at: datetime
    completed_at: Optional[datetime] = None


# =============================================================================
# Risk Schemas
# =============================================================================


class RiskBase(BaseModel):
    """Base risk schema."""

    risk_category: str = Field(..., description="Risk category")
    risk_description: str = Field(..., description="Risk description")
    identified_phase: str = Field(..., description="Phase when identified: TA, TDD, Delivery, Operations")
    probability_estimated: Optional[float] = Field(None, ge=0.0, le=1.0)
    impact_estimated: Optional[float] = Field(None, ge=0.0, le=1.0)


class RiskCreate(RiskBase):
    """Schema for creating a risk."""

    project_id: UUID
    identified_date: datetime
    mitigation_strategy: Optional[str] = None


class RiskUpdate(BaseModel):
    """Schema for updating risk materialization."""

    materialized: bool = False
    materialized_date: Optional[datetime] = None
    materialized_impact: Optional[str] = None
    mitigation_effectiveness: Optional[float] = Field(None, ge=0.0, le=1.0)
    cost_impact: Optional[float] = None
    schedule_impact_days: Optional[int] = None
    lessons_learned: Optional[str] = None


class RiskResponse(RiskBase, BaseSchema):
    """Schema for risk response."""

    id: UUID
    project_id: UUID
    identified_date: datetime
    materialized: bool
    materialized_date: Optional[datetime] = None
    mitigation_strategy: Optional[str] = None
    mitigation_effectiveness: Optional[float] = None
    cost_impact: Optional[float] = None
    schedule_impact_days: Optional[int] = None
    lessons_learned: Optional[str] = None
    confidence_score: Optional[float] = None
    created_at: datetime


# =============================================================================
# Intelligence Query Schemas
# =============================================================================


class SimilarRisksQuery(BaseModel):
    """Query for finding similar risks."""

    project_type: str
    capacity_mw: Optional[float] = None
    region: Optional[str] = None
    conditions: Optional[list[str]] = None
    limit: int = Field(default=10, le=100)


class SimilarRisksResponse(BaseModel):
    """Response for similar risks query."""

    risks: list[RiskResponse]
    confidence: ConfidenceScore
    mitigation_strategies: list[dict]
    materialization_rate: float


class RisksByCategoryQuery(BaseModel):
    """Query for risks by category."""

    risk_category: str
    project_type: Optional[str] = None
    limit: int = Field(default=20, le=100)


class RisksByCategoryResponse(BaseModel):
    """Response for risks by category."""

    category: str
    total_count: int
    materialization_rate: float
    avg_cost_impact: Optional[float] = None
    avg_schedule_impact_days: Optional[float] = None
    common_mitigations: list[dict]
    trends: list[dict]
    confidence: ConfidenceScore


class RiskValidationRequest(BaseModel):
    """Request for validating a risk matrix."""

    project_type: str
    capacity_mw: Optional[float] = None
    region: Optional[str] = None
    risks: list[RiskBase]


class RiskValidationResponse(BaseModel):
    """Response for risk validation."""

    validation_results: list[dict]
    missing_risks: list[dict]
    suggestions: list[str]
    confidence: ConfidenceScore


# =============================================================================
# Benchmarking Schemas
# =============================================================================


class BenchmarkEstimateQuery(BaseModel):
    """Query for benchmark estimates."""

    project_type: str
    capacity_mw: float
    region: Optional[str] = None


class BenchmarkEstimateResponse(BaseModel):
    """Response for benchmark estimates."""

    cost_estimate: dict  # {low, mid, high, unit}
    schedule_estimate: dict  # {low, mid, high, unit}
    cost_drivers: list[dict]
    schedule_drivers: list[dict]
    confidence: ConfidenceScore
    similar_projects_count: int


class BenchmarkCompareQuery(BaseModel):
    """Query for comparing project to benchmarks."""

    project_id: UUID
    metric: str = Field(..., description="Metric to compare: cost, schedule, performance")


class BenchmarkCompareResponse(BaseModel):
    """Response for benchmark comparison."""

    project_value: float
    benchmark_avg: float
    benchmark_range: dict  # {min, max}
    percentile: float
    variance_pct: float
    explanation: str
    confidence: ConfidenceScore


# =============================================================================
# Design Review Schemas
# =============================================================================


class DesignStandardsQuery(BaseModel):
    """Query for design standards."""

    project_type: str
    design_aspect: str


class DesignStandardsResponse(BaseModel):
    """Response for design standards query."""

    standards: list[dict]
    common_deviations: list[dict]
    deviation_outcomes: list[dict]
    recommendations: list[str]
    confidence: ConfidenceScore


class DesignReviewRequest(BaseModel):
    """Request for design review."""

    project_type: str
    capacity_mw: Optional[float] = None
    design_specifications: dict


class DesignReviewResponse(BaseModel):
    """Response for design review."""

    flags: list[dict]
    recommendations: list[str]
    similar_designs: list[dict]
    confidence: ConfidenceScore


class EquipmentQuery(BaseModel):
    """Query for equipment performance."""

    equipment_type: str
    project_type: Optional[str] = None
    model: Optional[str] = None


class EquipmentResponse(BaseModel):
    """Response for equipment query."""

    equipment_type: str
    models: list[dict]
    avg_performance_rating: float
    failure_rate: float
    common_failure_modes: list[str]
    recommendations: list[str]
    confidence: ConfidenceScore


# =============================================================================
# Site Condition Schemas
# =============================================================================


class SiteConditionRisksQuery(BaseModel):
    """Query for site condition risks."""

    condition_type: str
    severity: Optional[str] = None


class SiteConditionRisksResponse(BaseModel):
    """Response for site condition risks."""

    condition_type: str
    typical_risks: list[dict]
    mitigations: list[dict]
    avg_delay_days: Optional[float] = None
    defect_rate: float
    confidence: ConfidenceScore


class SimilarSitesQuery(BaseModel):
    """Query for similar sites."""

    site_conditions: list[dict]
    limit: int = Field(default=10, le=50)


class SimilarSitesResponse(BaseModel):
    """Response for similar sites."""

    similar_sites: list[dict]
    common_outcomes: list[dict]
    lessons_learned: list[str]
    confidence: ConfidenceScore


# =============================================================================
# Status Schemas
# =============================================================================


class IntelligenceStatusResponse(BaseModel):
    """Response for intelligence status."""

    total_projects: int
    total_risks: int
    total_site_conditions: int
    total_outcomes: int
    total_design_standards: int
    total_equipment_records: int
    data_quality_score: float
    coverage_by_type: dict
    last_updated: datetime


class IntelligenceGapsResponse(BaseModel):
    """Response for intelligence gaps."""

    gaps: list[dict]
    recommendations: list[str]
    priority_areas: list[str]


# =============================================================================
# Ingestion Schemas
# =============================================================================


class IngestionPayload(BaseModel):
    """Base payload for data ingestion."""

    source_system: str = Field(..., description="Source system: tatdd, oe_design, solar_analyzer, operations")
    project_id: Optional[UUID] = None
    project_code: Optional[str] = None
    data_type: str = Field(..., description="Type of data being ingested")
    payload: dict = Field(..., description="The actual data payload")
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class IngestionResponse(BaseModel):
    """Response for data ingestion."""

    success: bool
    message: str
    records_created: int
    records_updated: int
    warnings: list[str] = []
