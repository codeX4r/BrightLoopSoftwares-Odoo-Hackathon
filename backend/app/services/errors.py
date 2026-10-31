"""Business-rule errors raised by services and turned into HTTP responses in app.main."""


class BusinessRuleError(Exception):
    """The request is valid but conflicts with the current state (HTTP 409)."""

    status_code = 409

    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message


class NotFoundError(BusinessRuleError):
    status_code = 404


class InvalidInputError(BusinessRuleError):
    """Input that passes schema validation but breaks a business rule (HTTP 422)."""

    status_code = 422
