from typing import Annotated

from fastapi import Depends

from app.api.deps import require_roles
from app.models.user import User, UserRole

# Day-to-day operations (quotations, subscriptions, invoices, payments): staff, and
# admins, who have full system access.
StaffOrAdmin = Annotated[User, Depends(require_roles(UserRole.STAFF, UserRole.ADMIN))]
CustomerOnly = Annotated[User, Depends(require_roles(UserRole.CUSTOMER))]
