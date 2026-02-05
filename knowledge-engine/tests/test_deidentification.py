"""
Tests for the de-identification service.
"""

import pytest
from uuid import UUID

from app.services.deidentification import DeidentificationService


class TestDeidentificationService:
    """Tests for DeidentificationService."""

    def setup_method(self) -> None:
        """Set up test fixtures."""
        self.service = DeidentificationService()

    def test_hash_client_id_consistency(self) -> None:
        """Test that same client name produces same UUID."""
        client_name = "Test Client Pty Ltd"
        id1 = self.service.hash_client_id(client_name)
        id2 = self.service.hash_client_id(client_name)
        
        assert id1 == id2
        assert isinstance(id1, UUID)

    def test_hash_client_id_case_insensitive(self) -> None:
        """Test that hashing is case-insensitive."""
        id1 = self.service.hash_client_id("Test Client")
        id2 = self.service.hash_client_id("test client")
        id3 = self.service.hash_client_id("TEST CLIENT")
        
        assert id1 == id2 == id3

    def test_generate_project_code_solar(self) -> None:
        """Test project code generation for solar projects."""
        code = self.service.generate_project_code("solar")
        
        assert code.startswith("SOL-")
        assert len(code) == 7  # SOL-001

    def test_generate_project_code_wind(self) -> None:
        """Test project code generation for wind projects."""
        code = self.service.generate_project_code("wind")
        
        assert code.startswith("WIND-")

    def test_generate_project_code_avoids_duplicates(self) -> None:
        """Test that generated codes avoid existing codes."""
        existing = ["SOL-001", "SOL-002", "SOL-003"]
        code = self.service.generate_project_code("solar", existing)
        
        assert code == "SOL-004"

    def test_anonymize_location_nsw(self) -> None:
        """Test location anonymization for NSW."""
        region, state = self.service.anonymize_location("Sydney, New South Wales")
        
        assert region == "Australia"
        assert state == "NSW"

    def test_anonymize_location_qld(self) -> None:
        """Test location anonymization for QLD."""
        region, state = self.service.anonymize_location("Brisbane, QLD, Australia")
        
        assert region == "Australia"
        assert state == "QLD"

    def test_remove_personal_names(self) -> None:
        """Test removal of personal names."""
        text = "Contact John Smith for more information."
        result = self.service.remove_personal_names(text)
        
        assert "John Smith" not in result
        assert "[NAME REMOVED]" in result

    def test_remove_contact_info_email(self) -> None:
        """Test removal of email addresses."""
        text = "Email us at contact@example.com for details."
        result = self.service.remove_contact_info(text)
        
        assert "contact@example.com" not in result
        assert "[EMAIL REMOVED]" in result

    def test_remove_contact_info_phone(self) -> None:
        """Test removal of phone numbers."""
        text = "Call us at +61 2 1234 5678 for support."
        result = self.service.remove_contact_info(text)
        
        assert "1234 5678" not in result
        assert "[PHONE REMOVED]" in result

    def test_deidentify_text_comprehensive(self) -> None:
        """Test comprehensive text de-identification."""
        text = """
        Project manager John Smith from ABC Energy Pty Ltd
        can be reached at john.smith@abcenergy.com or +61 2 9876 5432.
        """
        result = self.service.deidentify_text(text)
        
        assert "John Smith" not in result
        assert "john.smith@abcenergy.com" not in result
        assert "9876 5432" not in result

    def test_deidentify_payload(self) -> None:
        """Test payload de-identification."""
        payload = {
            "project_name": "ABC Solar Farm",
            "contact": "John Smith",
            "email": "john@example.com",
            "nested": {
                "manager": "Jane Doe",
            },
            "list_field": ["Contact Bob Jones", "Other info"],
            "numeric_field": 12345,
        }
        
        result = self.service.deidentify_payload(payload)
        
        assert "John Smith" not in result["contact"]
        assert "john@example.com" not in result["email"]
        assert "Jane Doe" not in result["nested"]["manager"]
        assert "Bob Jones" not in result["list_field"][0]
        assert result["numeric_field"] == 12345  # Unchanged
