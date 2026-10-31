"""Outgoing email through a configurable backend (EMAIL_BACKEND).

- console: logs the message (development only; the log contains the message body).
- smtp:    sends through SMTP_HOST / SMTP_PORT with optional login and STARTTLS.

Tests replace `send_email` through the `get_email_sender` dependency.
"""

import logging
import smtplib
from collections.abc import Callable
from dataclasses import dataclass
from email.message import EmailMessage

from app.core.config import get_settings

logger = logging.getLogger("app.email")


@dataclass(frozen=True)
class OutgoingEmail:
    to: str
    subject: str
    body: str


EmailSender = Callable[[OutgoingEmail], None]


def send_email(message: OutgoingEmail) -> None:
    settings = get_settings()
    if settings.email_backend == "console":
        # The body can hold a live reset link, so it is only logged in development.
        body = (
            message.body
            if settings.environment == "development"
            else "[body hidden: set EMAIL_BACKEND=smtp outside development]"
        )
        logger.warning(
            "EMAIL (console backend) to=%s subject=%s\n%s",
            message.to,
            message.subject,
            body,
        )
        return

    if not settings.smtp_host:
        raise RuntimeError("EMAIL_BACKEND=smtp requires SMTP_HOST")
    email = EmailMessage()
    email["From"] = settings.email_from
    email["To"] = message.to
    email["Subject"] = message.subject
    email.set_content(message.body)
    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as smtp:
        if settings.smtp_use_tls:
            smtp.starttls()
        if settings.smtp_username and settings.smtp_password:
            smtp.login(
                settings.smtp_username, settings.smtp_password.get_secret_value()
            )
        smtp.send_message(email)


def get_email_sender() -> EmailSender:
    return send_email
