"""
Confidence scoring service for intelligence outputs.
Implements the confidence scoring strategy from the masterplan.
"""

from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Optional

from app.core.config import settings
from app.models.schemas import ConfidenceScore


@dataclass
class ConfidenceFactors:
    """Factors that influence confidence scoring."""

    projects_count: int
    data_recency_days: Optional[float] = None
    pattern_consistency: Optional[float] = None  # 0-1, how consistent the patterns are
    validation_rate: Optional[float] = None  # 0-1, % of validated outcomes


class ConfidenceService:
    """
    Service for calculating confidence scores.
    
    Confidence Levels:
    - High (0.8-1.0): 20+ projects, consistent patterns, recent data
    - Medium (0.5-0.8): 5-20 projects, some variation
    - Low (0-0.5): <5 projects, high variation
    """

    def __init__(self) -> None:
        """Initialize the confidence service."""
        self.high_threshold = settings.confidence_high_threshold
        self.medium_threshold = settings.confidence_medium_threshold
        self.min_projects_high = settings.min_projects_for_high_confidence
        self.min_projects_medium = settings.min_projects_for_medium_confidence

    def calculate_confidence(
        self, factors: ConfidenceFactors
    ) -> ConfidenceScore:
        """
        Calculate confidence score based on multiple factors.
        
        Args:
            factors: Factors influencing confidence
        
        Returns:
            ConfidenceScore with score, level, and explanation
        """
        # Base score from project count
        if factors.projects_count >= self.min_projects_high:
            base_score = 0.8
        elif factors.projects_count >= self.min_projects_medium:
            base_score = 0.5 + (
                (factors.projects_count - self.min_projects_medium)
                / (self.min_projects_high - self.min_projects_medium)
                * 0.3
            )
        elif factors.projects_count > 0:
            base_score = factors.projects_count / self.min_projects_medium * 0.5
        else:
            base_score = 0.0

        # Adjust for data recency
        recency_modifier = 1.0
        if factors.data_recency_days is not None:
            if factors.data_recency_days <= 90:  # Last 3 months
                recency_modifier = 1.0
            elif factors.data_recency_days <= 365:  # Last year
                recency_modifier = 0.9
            elif factors.data_recency_days <= 730:  # Last 2 years
                recency_modifier = 0.8
            else:
                recency_modifier = 0.6

        # Adjust for pattern consistency
        consistency_modifier = 1.0
        if factors.pattern_consistency is not None:
            consistency_modifier = 0.7 + (factors.pattern_consistency * 0.3)

        # Adjust for validation rate
        validation_modifier = 1.0
        if factors.validation_rate is not None:
            validation_modifier = 0.8 + (factors.validation_rate * 0.2)

        # Calculate final score
        final_score = min(
            1.0,
            base_score * recency_modifier * consistency_modifier * validation_modifier,
        )

        # Determine level
        if final_score >= self.high_threshold:
            level = "high"
        elif final_score >= self.medium_threshold:
            level = "medium"
        else:
            level = "low"

        # Generate explanation
        explanation = self._generate_explanation(factors, final_score, level)

        return ConfidenceScore(
            score=round(final_score, 3),
            level=level,
            projects_count=factors.projects_count,
            explanation=explanation,
        )

    def _generate_explanation(
        self, factors: ConfidenceFactors, score: float, level: str
    ) -> str:
        """Generate human-readable explanation for confidence score."""
        parts = []

        # Project count explanation
        if factors.projects_count >= self.min_projects_high:
            parts.append(f"Based on {factors.projects_count} similar projects")
        elif factors.projects_count >= self.min_projects_medium:
            parts.append(
                f"Based on {factors.projects_count} projects (more data would improve confidence)"
            )
        elif factors.projects_count > 0:
            parts.append(
                f"Limited data: only {factors.projects_count} project(s) available"
            )
        else:
            parts.append("No historical data available")

        # Recency explanation
        if factors.data_recency_days is not None:
            if factors.data_recency_days <= 90:
                parts.append("recent data")
            elif factors.data_recency_days <= 365:
                parts.append("data from past year")
            else:
                parts.append("older data may not reflect current conditions")

        # Consistency explanation
        if factors.pattern_consistency is not None:
            if factors.pattern_consistency >= 0.8:
                parts.append("consistent patterns observed")
            elif factors.pattern_consistency >= 0.5:
                parts.append("some variation in patterns")
            else:
                parts.append("high variation in outcomes")

        return "; ".join(parts) + "."

    def calculate_from_query_results(
        self,
        results: list,
        date_field: str = "created_at",
    ) -> ConfidenceScore:
        """
        Calculate confidence from a list of query results.
        
        Args:
            results: List of database records
            date_field: Field name for date comparison
        
        Returns:
            ConfidenceScore
        """
        if not results:
            return ConfidenceScore(
                score=0.0,
                level="low",
                projects_count=0,
                explanation="No historical data available.",
            )

        # Calculate recency
        now = datetime.utcnow()
        dates = []
        for r in results:
            if hasattr(r, date_field):
                date_val = getattr(r, date_field)
                if date_val:
                    dates.append(date_val)

        avg_recency_days = None
        if dates:
            avg_date = sum((d - now).days for d in dates) / len(dates)
            avg_recency_days = abs(avg_date)

        factors = ConfidenceFactors(
            projects_count=len(results),
            data_recency_days=avg_recency_days,
        )

        return self.calculate_confidence(factors)


# Singleton instance
confidence_service = ConfidenceService()
