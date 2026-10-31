"""Kept so existing imports keep working. The model lives in app.models.profiles, next to
StaffProfile; defining it twice would map the customer_profiles table twice."""

from app.models.profiles import CustomerProfile

__all__ = ["CustomerProfile"]
