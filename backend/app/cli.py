"""Management commands.

Create the initial admin (prompts for the password, which is never echoed or logged):
    uv run python -m app.cli create-admin --email admin@brightloop.com

Create an account with any role (e.g. test staff or customers until the
customer-management workflow exists):
    uv run python -m app.cli create-user --role CUSTOMER --email customer@brightloop.com

Non-interactive (e.g. in a deploy script), reading the password from stdin:
    printf '%s' "$ADMIN_PASSWORD" | uv run python -m app.cli create-admin \
        --email admin@brightloop.com --password-stdin
"""

import argparse
import getpass
import sys

from pydantic import ValidationError

from app.db.session import SessionLocal
from app.models.user import UserRole
from app.schemas.user import UserCreate
from app.services import user_service


def _read_password(from_stdin: bool) -> str:
    if from_stdin:
        return sys.stdin.read().rstrip("\r\n")
    password = getpass.getpass("Password: ")
    if getpass.getpass("Confirm password: ") != password:
        raise SystemExit("Error: passwords do not match.")
    return password


def create_account(email: str, role: UserRole, password_stdin: bool) -> int:
    password = _read_password(password_stdin)
    try:
        data = UserCreate(email=email, password=password)
    except ValidationError as exc:
        for error in exc.errors():
            field = ".".join(str(part) for part in error["loc"])
            print(f"Error: {field}: {error['msg']}", file=sys.stderr)
        return 1

    with SessionLocal() as db:
        try:
            user = user_service.create_user(
                db, email=data.email, password=data.password, role=role
            )
        except user_service.EmailAlreadyExistsError:
            print(
                f"Error: an account with email {data.email} already exists.",
                file=sys.stderr,
            )
            return 1

    print(f"Created {role.value} {user.email} (id {user.id}).")
    return 0


def _add_common_args(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--email", required=True)
    parser.add_argument(
        "--password-stdin",
        action="store_true",
        help="Read the password from stdin instead of prompting",
    )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m app.cli")
    commands = parser.add_subparsers(dest="command", required=True)

    admin = commands.add_parser("create-admin", help="Create an ADMIN account")
    _add_common_args(admin)

    user = commands.add_parser(
        "create-user", help="Create an account with a given role"
    )
    user.add_argument("--role", required=True, choices=[r.value for r in UserRole])
    _add_common_args(user)

    args = parser.parse_args(argv)
    if args.command == "create-admin":
        return create_account(args.email, UserRole.ADMIN, args.password_stdin)
    if args.command == "create-user":
        return create_account(args.email, UserRole(args.role), args.password_stdin)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
