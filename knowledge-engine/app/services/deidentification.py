"""
De-identification service for anonymizing project data.
Implements the de-identification strategy from the masterplan.
"""

import hashlib
import re
from typing import Any, Optional
from uuid import UUID, uuid5, NAMESPACE_DNS

from app.core.config import settings


class DeidentificationService:
    """
    Service for de-identifying sensitive project data.
    
    Strategy:
    - Client names → hashed IDs
    - Project names → generic codes (SOL-001, WIND-002, etc.)
    - Specific locations → region/state only
    - Specific companies → industry/sector only
    - Personal names → removed entirely
    - Sensitive commercial info → aggregated/anonymized
    """

    # Project type prefixes for code generation
    PROJECT_TYPE_PREFIXES = {
        "solar": "SOL",
        "wind": "WIND",
        "battery": "BESS",
        "hybrid": "HYB",
    }

    # Patterns for detecting sensitive information
    PERSONAL_NAME_PATTERNS = [
        r"\b[A-Z][a-z]+\s+[A-Z][a-z]+\b",  # First Last
        r"\b[A-Z]\.\s*[A-Z][a-z]+\b",  # J. Smith
    ]

    COMPANY_NAME_PATTERNS = [
        r"\b[A-Z][a-z]+\s+(Pty|Ltd|Inc|Corp|LLC|Co)\b",
        r"\b[A-Z]+\s+(Energy|Power|Solar|Wind|Renewables)\b",
    ]

    EMAIL_PATTERN = r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b"
    PHONE_PATTERN = r"\b(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b"

    def __init__(self) -> None:
        """Initialize the de-identification service."""
        self._project_counter: dict[str, int] = {}

    def hash_client_id(self, client_name: str) -> UUID:
        """
        Generate a consistent hashed ID for a client name.
        Same client name always produces the same UUID.
        """
        # Use uuid5 for deterministic UUID generation
        return uuid5(NAMESPACE_DNS, f"mce-client-{client_name.lower().strip()}")

    def generate_project_code(
        self, project_type: str, existing_codes: Optional[list[str]] = None
    ) -> str:
        """
        Generate a generic project code.
        
        Args:
            project_type: Type of project (solar, wind, battery, hybrid)
            existing_codes: List of existing codes to avoid duplicates
        
        Returns:
            Generated project code (e.g., SOL-001, WIND-002)
        """
        prefix = self.PROJECT_TYPE_PREFIXES.get(
            project_type.lower(), project_type[:3].upper()
        )

        # Find the next available number
        if existing_codes:
            existing_numbers = []
            for code in existing_codes:
                if code.startswith(prefix):
                    try:
                        num = int(code.split("-")[1])
                        existing_numbers.append(num)
                    except (IndexError, ValueError):
                        continue
            next_num = max(existing_numbers, default=0) + 1
        else:
            # Use internal counter
            if prefix not in self._project_counter:
                self._project_counter[prefix] = 0
            self._project_counter[prefix] += 1
            next_num = self._project_counter[prefix]

        return f"{prefix}-{next_num:03d}"

    def anonymize_location(
        self, location: str
    ) -> tuple[Optional[str], Optional[str]]:
        """
        Anonymize a specific location to region/state only.
        
        Args:
            location: Full location string
        
        Returns:
            Tuple of (region, state)
        """
        # Australian state detection
        australian_states = {
            "nsw": ("Australia", "NSW"),
            "new south wales": ("Australia", "NSW"),
            "vic": ("Australia", "VIC"),
            "victoria": ("Australia", "VIC"),
            "qld": ("Australia", "QLD"),
            "queensland": ("Australia", "QLD"),
            "sa": ("Australia", "SA"),
            "south australia": ("Australia", "SA"),
            "wa": ("Australia", "WA"),
            "western australia": ("Australia", "WA"),
            "tas": ("Australia", "TAS"),
            "tasmania": ("Australia", "TAS"),
            "nt": ("Australia", "NT"),
            "northern territory": ("Australia", "NT"),
            "act": ("Australia", "ACT"),
        }

        location_lower = location.lower()
        for key, (region, state) in australian_states.items():
            if key in location_lower:
                return region, state

        # Default: extract last word as potential state/region
        parts = location.split(",")
        if len(parts) >= 2:
            return parts[-1].strip(), parts[-2].strip()

        return "Unknown", None

    def remove_personal_names(self, text: str) -> str:
        """
        Remove personal names from text.
        
        Args:
            text: Input text
        
        Returns:
            Text with personal names replaced
        """
        result = text
        for pattern in self.PERSONAL_NAME_PATTERNS:
            result = re.sub(pattern, "[NAME REMOVED]", result)
        return result

    def remove_contact_info(self, text: str) -> str:
        """
        Remove email addresses and phone numbers from text.
        
        Args:
            text: Input text
        
        Returns:
            Text with contact info removed
        """
        result = re.sub(self.EMAIL_PATTERN, "[EMAIL REMOVED]", text)
        result = re.sub(self.PHONE_PATTERN, "[PHONE REMOVED]", result)
        return result

    def anonymize_company_names(self, text: str) -> str:
        """
        Replace company names with generic sector descriptions.
        
        Args:
            text: Input text
        
        Returns:
            Text with company names anonymized
        """
        result = text
        for pattern in self.COMPANY_NAME_PATTERNS:
            result = re.sub(pattern, "[COMPANY]", result)
        return result

    def deidentify_text(self, text: str) -> str:
        """
        Apply all de-identification rules to text.
        
        Args:
            text: Input text
        
        Returns:
            De-identified text
        """
        result = self.remove_personal_names(text)
        result = self.remove_contact_info(result)
        result = self.anonymize_company_names(result)
        return result

    def deidentify_payload(self, payload: dict[str, Any]) -> dict[str, Any]:
        """
        De-identify all string fields in a payload dictionary.
        
        Args:
            payload: Input payload
        
        Returns:
            De-identified payload
        """
        result = {}
        for key, value in payload.items():
            if isinstance(value, str):
                result[key] = self.deidentify_text(value)
            elif isinstance(value, dict):
                result[key] = self.deidentify_payload(value)
            elif isinstance(value, list):
                result[key] = [
                    self.deidentify_payload(item) if isinstance(item, dict)
                    else self.deidentify_text(item) if isinstance(item, str)
                    else item
                    for item in value
                ]
            else:
                result[key] = value
        return result


# Singleton instance
deidentification_service = DeidentificationService()
