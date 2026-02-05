"""
Ingestion API router.
Handles data ingestion from MCE tools (TA/TDD, OE Design Review, Solar Analyzer, etc.)
"""

from datetime import datetime
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, HTTPException, BackgroundTasks
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import DbSession, ApiKey
from app.models import (
    KnowledgeProject,
    KnowledgeRisk,
    KnowledgeSiteCondition,
    KnowledgeProjectOutcome,
    KnowledgeDesignStandard,
    KnowledgeEquipmentPerformance,
)
from app.models.schemas import IngestionPayload, IngestionResponse
from app.services.deidentification import deidentification_service

router = APIRouter(prefix="/ingestion", tags=["Ingestion"])


# =============================================================================
# Helper Functions
# =============================================================================


async def get_or_create_project(
    db: AsyncSession,
    project_code: Optional[str],
    project_type: str,
    capacity_mw: Optional[float] = None,
    location_region: Optional[str] = None,
    location_state: Optional[str] = None,
) -> KnowledgeProject:
    """Get existing project or create a new one."""
    if project_code:
        stmt = select(KnowledgeProject).where(
            KnowledgeProject.project_code == project_code
        )
        result = await db.execute(stmt)
        project = result.scalar_one_or_none()
        if project:
            return project

    # Generate new project code
    stmt = select(KnowledgeProject.project_code)
    result = await db.execute(stmt)
    existing_codes = [row[0] for row in result]

    new_code = deidentification_service.generate_project_code(
        project_type, existing_codes
    )

    project = KnowledgeProject(
        project_code=new_code,
        project_type=project_type,
        capacity_mw=capacity_mw,
        location_region=location_region,
        location_state=location_state,
    )
    db.add(project)
    await db.flush()
    return project


# =============================================================================
# Generic Ingestion Endpoint
# =============================================================================


@router.post("/ingest", response_model=IngestionResponse)
async def ingest_data(
    payload: IngestionPayload,
    db: DbSession,
    api_key: ApiKey,
    background_tasks: BackgroundTasks,
) -> IngestionResponse:
    """
    Generic ingestion endpoint for all data types.
    
    Accepts data from:
    - TA/TDD Engine: risk_matrix, design_standards, benchmarks, site_conditions
    - OE Design Review: design_issues, risk_updates, standard_deviations
    - Solar Analyzer: equipment_data, performance_metrics
    - Operations: failures, maintenance, performance
    - Project Completion: outcomes, lessons_learned
    """
    # De-identify the payload
    deidentified_payload = deidentification_service.deidentify_payload(payload.payload)

    records_created = 0
    records_updated = 0
    warnings = []

    try:
        # Route to appropriate handler based on data_type
        if payload.data_type == "risk_matrix":
            records_created = await _ingest_risk_matrix(
                db, payload, deidentified_payload
            )
        elif payload.data_type == "design_standards":
            records_created = await _ingest_design_standards(
                db, payload, deidentified_payload
            )
        elif payload.data_type == "site_conditions":
            records_created = await _ingest_site_conditions(
                db, payload, deidentified_payload
            )
        elif payload.data_type == "equipment_data":
            records_created = await _ingest_equipment_data(
                db, payload, deidentified_payload
            )
        elif payload.data_type == "project_outcomes":
            records_created = await _ingest_project_outcomes(
                db, payload, deidentified_payload
            )
        elif payload.data_type == "risk_update":
            records_updated = await _update_risk_materialization(
                db, payload, deidentified_payload
            )
        else:
            warnings.append(f"Unknown data_type: {payload.data_type}")

        return IngestionResponse(
            success=True,
            message=f"Successfully processed {payload.data_type} from {payload.source_system}",
            records_created=records_created,
            records_updated=records_updated,
            warnings=warnings,
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# Data Type Handlers
# =============================================================================


async def _ingest_risk_matrix(
    db: AsyncSession,
    payload: IngestionPayload,
    data: dict,
) -> int:
    """Ingest risk matrix data from TA/TDD engine."""
    records_created = 0

    # Get or create project
    project = await get_or_create_project(
        db,
        project_code=payload.project_code,
        project_type=data.get("project_type", "solar"),
        capacity_mw=data.get("capacity_mw"),
        location_region=data.get("region"),
        location_state=data.get("state"),
    )

    # Process risks
    risks = data.get("risks", [])
    for risk_data in risks:
        risk = KnowledgeRisk(
            project_id=project.id,
            risk_category=risk_data.get("category", "unknown"),
            risk_description=risk_data.get("description", ""),
            identified_phase=risk_data.get("phase", "TA"),
            identified_date=datetime.utcnow(),
            probability_estimated=risk_data.get("probability"),
            impact_estimated=risk_data.get("impact"),
            mitigation_strategy=risk_data.get("mitigation"),
            metadata=risk_data.get("metadata"),
        )
        db.add(risk)
        records_created += 1

    return records_created


async def _ingest_design_standards(
    db: AsyncSession,
    payload: IngestionPayload,
    data: dict,
) -> int:
    """Ingest design standards data."""
    records_created = 0

    project = await get_or_create_project(
        db,
        project_code=payload.project_code,
        project_type=data.get("project_type", "solar"),
    )

    standards = data.get("standards", [])
    for std_data in standards:
        standard = KnowledgeDesignStandard(
            project_id=project.id,
            standard_name=std_data.get("name", ""),
            standard_version=std_data.get("version"),
            design_aspect=std_data.get("aspect", ""),
            standard_requirement=std_data.get("requirement"),
            design_approach=std_data.get("approach"),
            deviation_from_standard=std_data.get("deviation", False),
            deviation_reason=std_data.get("deviation_reason"),
            deviation_approved=std_data.get("deviation_approved", False),
            metadata=std_data.get("metadata"),
        )
        db.add(standard)
        records_created += 1

    return records_created


async def _ingest_site_conditions(
    db: AsyncSession,
    payload: IngestionPayload,
    data: dict,
) -> int:
    """Ingest site conditions data."""
    records_created = 0

    project = await get_or_create_project(
        db,
        project_code=payload.project_code,
        project_type=data.get("project_type", "solar"),
    )

    conditions = data.get("conditions", [])
    for cond_data in conditions:
        condition = KnowledgeSiteCondition(
            project_id=project.id,
            condition_type=cond_data.get("type", ""),
            condition_description=cond_data.get("description", ""),
            severity=cond_data.get("severity", "medium"),
            issues_encountered=cond_data.get("issues"),
            mitigations_applied=cond_data.get("mitigations"),
            metadata=cond_data.get("metadata"),
        )
        db.add(condition)
        records_created += 1

    return records_created


async def _ingest_equipment_data(
    db: AsyncSession,
    payload: IngestionPayload,
    data: dict,
) -> int:
    """Ingest equipment performance data from Solar Analyzer."""
    records_created = 0

    project = await get_or_create_project(
        db,
        project_code=payload.project_code,
        project_type=data.get("project_type", "solar"),
    )

    equipment_list = data.get("equipment", [])
    for equip_data in equipment_list:
        equipment = KnowledgeEquipmentPerformance(
            project_id=project.id,
            equipment_type=equip_data.get("type", ""),
            equipment_model=equip_data.get("model"),
            equipment_quantity=equip_data.get("quantity"),
            performance_rating=equip_data.get("rating"),
            reliability_issues=equip_data.get("has_issues", False),
            reliability_issues_description=equip_data.get("issues_description"),
            failures_count=equip_data.get("failures"),
            failure_modes=equip_data.get("failure_modes"),
            metadata=equip_data.get("metadata"),
        )
        db.add(equipment)
        records_created += 1

    return records_created


async def _ingest_project_outcomes(
    db: AsyncSession,
    payload: IngestionPayload,
    data: dict,
) -> int:
    """Ingest project outcomes data."""
    project = await get_or_create_project(
        db,
        project_code=payload.project_code,
        project_type=data.get("project_type", "solar"),
    )

    outcome = KnowledgeProjectOutcome(
        project_id=project.id,
        budget_estimated=data.get("budget_estimated"),
        budget_actual=data.get("budget_actual"),
        budget_variance=data.get("budget_variance"),
        budget_variance_pct=data.get("budget_variance_pct"),
        schedule_estimated_days=data.get("schedule_estimated_days"),
        schedule_actual_days=data.get("schedule_actual_days"),
        schedule_variance_days=data.get("schedule_variance_days"),
        schedule_variance_pct=data.get("schedule_variance_pct"),
        cost_drivers=data.get("cost_drivers"),
        schedule_drivers=data.get("schedule_drivers"),
        performance_vs_design=data.get("performance_vs_design"),
        performance_metrics=data.get("performance_metrics"),
        key_learnings=data.get("key_learnings"),
        what_worked_well=data.get("what_worked_well"),
        what_could_improve=data.get("what_could_improve"),
        metadata=data.get("metadata"),
    )
    db.add(outcome)

    # Mark project as completed
    project.completed_at = datetime.utcnow()

    return 1


async def _update_risk_materialization(
    db: AsyncSession,
    payload: IngestionPayload,
    data: dict,
) -> int:
    """Update risk materialization status."""
    risk_id = data.get("risk_id")
    if not risk_id:
        return 0

    stmt = select(KnowledgeRisk).where(KnowledgeRisk.id == risk_id)
    result = await db.execute(stmt)
    risk = result.scalar_one_or_none()

    if not risk:
        return 0

    risk.materialized = data.get("materialized", False)
    risk.materialized_date = data.get("materialized_date")
    risk.materialized_impact = data.get("materialized_impact")
    risk.mitigation_effectiveness = data.get("mitigation_effectiveness")
    risk.cost_impact = data.get("cost_impact")
    risk.schedule_impact_days = data.get("schedule_impact_days")
    risk.lessons_learned = data.get("lessons_learned")

    return 1


# =============================================================================
# Source-Specific Endpoints
# =============================================================================


@router.post("/tatdd", response_model=IngestionResponse)
async def ingest_from_tatdd(
    payload: IngestionPayload,
    db: DbSession,
    api_key: ApiKey,
) -> IngestionResponse:
    """
    Ingest data from TA/TDD Engine.
    
    Accepts:
    - Risk matrices
    - Design standards
    - Benchmarking assumptions
    - Site conditions
    """
    payload.source_system = "tatdd"
    return await ingest_data(payload, db, api_key, BackgroundTasks())


@router.post("/oe-design", response_model=IngestionResponse)
async def ingest_from_oe_design(
    payload: IngestionPayload,
    db: DbSession,
    api_key: ApiKey,
) -> IngestionResponse:
    """
    Ingest data from OE Design Review Engine.
    
    Accepts:
    - Design issues
    - Risk updates
    - Standard deviations
    """
    payload.source_system = "oe_design"
    return await ingest_data(payload, db, api_key, BackgroundTasks())


@router.post("/solar-analyzer", response_model=IngestionResponse)
async def ingest_from_solar_analyzer(
    payload: IngestionPayload,
    db: DbSession,
    api_key: ApiKey,
) -> IngestionResponse:
    """
    Ingest data from Solar Analyzer.
    
    Accepts:
    - Equipment data
    - Performance metrics
    """
    payload.source_system = "solar_analyzer"
    return await ingest_data(payload, db, api_key, BackgroundTasks())


@router.post("/operations", response_model=IngestionResponse)
async def ingest_from_operations(
    payload: IngestionPayload,
    db: DbSession,
    api_key: ApiKey,
) -> IngestionResponse:
    """
    Ingest data from Operations Monitoring.
    
    Accepts:
    - Equipment failures
    - Maintenance records
    - Performance data
    """
    payload.source_system = "operations"
    return await ingest_data(payload, db, api_key, BackgroundTasks())


@router.post("/project-completion", response_model=IngestionResponse)
async def ingest_project_completion(
    payload: IngestionPayload,
    db: DbSession,
    api_key: ApiKey,
) -> IngestionResponse:
    """
    Ingest project completion data.
    
    Accepts:
    - Final outcomes
    - Lessons learned
    - Risk materialization updates
    """
    payload.source_system = "project_completion"
    return await ingest_data(payload, db, api_key, BackgroundTasks())
