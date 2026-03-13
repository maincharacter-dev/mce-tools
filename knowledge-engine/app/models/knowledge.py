"""
SQLAlchemy models for the Knowledge Engine.
Based on the MCE Knowledge Engine Masterplan data model.
"""

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


def generate_uuid() -> uuid.UUID:
    """Generate a new UUID."""
    return uuid.uuid4()


class KnowledgeProject(Base):
    """
    Project metadata for de-identified project records.
    All client/project names are anonymized.
    """

    __tablename__ = "knowledge_projects"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=generate_uuid
    )
    project_code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    project_type: Mapped[str] = mapped_column(String(50), nullable=False)  # solar, wind, battery, hybrid
    capacity_mw: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    location_region: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    location_state: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    client_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)  # de-identified
    
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    
    # Flexible metadata
    extra_metadata: Mapped[Optional[dict]] = mapped_column("metadata", JSONB, nullable=True)
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)

    # Relationships
    risks: Mapped[list["KnowledgeRisk"]] = relationship(back_populates="project")
    site_conditions: Mapped[list["KnowledgeSiteCondition"]] = relationship(back_populates="project")
    outcomes: Mapped[list["KnowledgeProjectOutcome"]] = relationship(back_populates="project")
    design_standards: Mapped[list["KnowledgeDesignStandard"]] = relationship(back_populates="project")
    equipment_performance: Mapped[list["KnowledgeEquipmentPerformance"]] = relationship(back_populates="project")


class KnowledgeRisk(Base):
    """
    Risk intelligence with materialization tracking.
    Captures identified risks, their outcomes, and mitigation effectiveness.
    """

    __tablename__ = "knowledge_risks"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=generate_uuid
    )
    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("knowledge_projects.id"), nullable=False
    )
    
    # Risk identification
    risk_category: Mapped[str] = mapped_column(String(100), nullable=False)  # ground_conditions, hydrology, design, supply_chain
    risk_description: Mapped[str] = mapped_column(Text, nullable=False)
    identified_phase: Mapped[str] = mapped_column(String(50), nullable=False)  # TA, TDD, Delivery, Operations
    identified_date: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    
    # Risk assessment
    probability_estimated: Mapped[Optional[float]] = mapped_column(Float, nullable=True)  # 0-1
    impact_estimated: Mapped[Optional[float]] = mapped_column(Float, nullable=True)  # 0-1
    
    # Materialization tracking
    materialized: Mapped[bool] = mapped_column(Boolean, default=False)
    materialized_date: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    materialized_impact: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # Mitigation
    mitigation_strategy: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    mitigation_effectiveness: Mapped[Optional[float]] = mapped_column(Float, nullable=True)  # 0-1
    
    # Impact
    cost_impact: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    schedule_impact_days: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    
    # Learning
    lessons_learned: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    confidence_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)  # 0-1
    
    # Metadata
    extra_metadata: Mapped[Optional[dict]] = mapped_column("metadata", JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Relationships
    project: Mapped["KnowledgeProject"] = relationship(back_populates="risks")


class KnowledgeSiteCondition(Base):
    """
    Site condition intelligence.
    Captures ground, hydrology, climate, and access conditions with outcomes.
    """

    __tablename__ = "knowledge_site_conditions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=generate_uuid
    )
    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("knowledge_projects.id"), nullable=False
    )
    
    # Condition details
    condition_type: Mapped[str] = mapped_column(String(100), nullable=False)  # ground_conditions, hydrology, climate, access
    condition_description: Mapped[str] = mapped_column(Text, nullable=False)
    severity: Mapped[str] = mapped_column(String(50), nullable=False)  # low, medium, high
    
    # Issues and impact
    issues_encountered: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    issues_impact: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # Mitigations
    mitigations_applied: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    mitigations_effectiveness: Mapped[Optional[float]] = mapped_column(Float, nullable=True)  # 0-1
    
    # Schedule impact
    caused_delays: Mapped[bool] = mapped_column(Boolean, default=False)
    delay_days: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    
    # Defects
    caused_defects: Mapped[bool] = mapped_column(Boolean, default=False)
    defect_description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # Learning
    lessons_learned: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    confidence_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    
    # Metadata
    extra_metadata: Mapped[Optional[dict]] = mapped_column("metadata", JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Relationships
    project: Mapped["KnowledgeProject"] = relationship(back_populates="site_conditions")


class KnowledgeProjectOutcome(Base):
    """
    Cost and schedule intelligence.
    Captures budgeted vs actual outcomes with drivers.
    """

    __tablename__ = "knowledge_project_outcomes"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=generate_uuid
    )
    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("knowledge_projects.id"), nullable=False
    )
    
    # Budget
    budget_estimated: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    budget_actual: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    budget_variance: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    budget_variance_pct: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    
    # Schedule
    schedule_estimated_days: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    schedule_actual_days: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    schedule_variance_days: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    schedule_variance_pct: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    
    # Drivers (JSON arrays)
    cost_drivers: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)  # [{category, amount, description}]
    schedule_drivers: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)  # [{category, days, description}]
    
    # Performance
    performance_vs_design: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    performance_metrics: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    
    # Lessons
    key_learnings: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    what_worked_well: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    what_could_improve: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # Data quality
    confidence_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    extra_metadata: Mapped[Optional[dict]] = mapped_column("metadata", JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Relationships
    project: Mapped["KnowledgeProject"] = relationship(back_populates="outcomes")


class KnowledgeDesignStandard(Base):
    """
    Design standard intelligence.
    Captures standards used, deviations, and outcomes.
    """

    __tablename__ = "knowledge_design_standards"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=generate_uuid
    )
    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("knowledge_projects.id"), nullable=False
    )
    
    # Standard details
    standard_name: Mapped[str] = mapped_column(String(255), nullable=False)  # IEC 61936, AS/NZS 3000
    standard_version: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    design_aspect: Mapped[str] = mapped_column(String(255), nullable=False)  # cable_sizing, earthing, protection
    standard_requirement: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    design_approach: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # Deviation tracking
    deviation_from_standard: Mapped[bool] = mapped_column(Boolean, default=False)
    deviation_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    deviation_approved: Mapped[bool] = mapped_column(Boolean, default=False)
    deviation_impact: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # Learning
    lessons_learned: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    confidence_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    
    # Metadata
    extra_metadata: Mapped[Optional[dict]] = mapped_column("metadata", JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Relationships
    project: Mapped["KnowledgeProject"] = relationship(back_populates="design_standards")


class KnowledgeEquipmentPerformance(Base):
    """
    Equipment performance intelligence.
    Captures equipment reliability, failures, and recommendations.
    """

    __tablename__ = "knowledge_equipment_performance"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=generate_uuid
    )
    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("knowledge_projects.id"), nullable=False
    )
    
    # Equipment details
    equipment_type: Mapped[str] = mapped_column(String(100), nullable=False)  # inverter, transformer, cable
    equipment_model: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    equipment_quantity: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    installation_date: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    operational_period_months: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    
    # Performance
    performance_rating: Mapped[Optional[float]] = mapped_column(Float, nullable=True)  # 0-5 or 0-100
    reliability_issues: Mapped[bool] = mapped_column(Boolean, default=False)
    reliability_issues_description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    failures_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    failure_modes: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)  # JSON array
    maintenance_requirements: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # Recommendations
    would_specify_again: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    alternative_recommendations: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # Learning
    lessons_learned: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    confidence_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    
    # Metadata
    extra_metadata: Mapped[Optional[dict]] = mapped_column("metadata", JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Relationships
    project: Mapped["KnowledgeProject"] = relationship(back_populates="equipment_performance")


class KnowledgeBenchmark(Base):
    """
    Aggregated benchmarking data.
    Pre-computed statistics for quick lookups.
    """

    __tablename__ = "knowledge_benchmarks"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=generate_uuid
    )
    
    # Segmentation
    project_type: Mapped[str] = mapped_column(String(50), nullable=False)  # solar, wind, etc.
    capacity_range_min: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    capacity_range_max: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    region: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    
    # Aggregated metrics
    avg_cost_per_mw: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    avg_schedule_months: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    cost_variance_pct: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    schedule_variance_pct: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    
    # Risk profile (JSON arrays)
    common_risks: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    typical_cost_drivers: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    typical_schedule_drivers: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    
    # Site conditions (JSON arrays)
    typical_site_conditions: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    typical_mitigations: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    
    # Data quality
    projects_in_dataset: Mapped[int] = mapped_column(Integer, default=0)
    last_updated: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    confidence_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    
    # Metadata
    extra_metadata: Mapped[Optional[dict]] = mapped_column("metadata", JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
