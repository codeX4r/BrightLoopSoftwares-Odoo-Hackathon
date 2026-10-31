"""Errors raised by services. main.py maps them to HTTP status codes, so services never
need to know about HTTP."""


class ServiceError(Exception):
    """Base class for business-rule failures. The message is safe to show to the caller."""

    status_code: int = 400

    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message


class NotFoundError(ServiceError):
    status_code = 404


class ConflictError(ServiceError):
    """The request clashes with existing data, such as a duplicate name or a row in use."""

    status_code = 409


class BusinessRuleError(ServiceError):
    """The request is well formed but breaks a business rule, such as a bad date range."""

    status_code = 422
