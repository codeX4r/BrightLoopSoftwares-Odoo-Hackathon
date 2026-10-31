"""Business-rule errors raised by services and turned into HTTP responses in app.main.

Services never need to know about HTTP: each class carries its status code, and one
exception handler in app.main returns {"detail": message} with that code.

    BusinessRuleError (409)   base class; valid request that conflicts with current state
    ├── NotFoundError (404)   the record doesn't exist, or the caller may not see it
    ├── InvalidInputError (422) passes schema validation but breaks a business rule
    ├── ConflictError (409)   clashes with existing data, e.g. a duplicate name
    └── PermissionDeniedError (403) the caller's role may not do this

ServiceError is another name for the base class, used by the catalog code.
"""


class BusinessRuleError(Exception):
    """The request is valid but conflicts with the current state (HTTP 409)."""

    status_code = 409

    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message


ServiceError = BusinessRuleError


class NotFoundError(BusinessRuleError):
    status_code = 404


class InvalidInputError(BusinessRuleError):
    """Input that passes schema validation but breaks a business rule (HTTP 422)."""

    status_code = 422


class ConflictError(BusinessRuleError):
    """The request clashes with existing data, such as a duplicate name or a row in use."""

    status_code = 409


class PermissionDeniedError(BusinessRuleError):
    """The caller is signed in but their role may not perform this action (HTTP 403)."""

    status_code = 403
