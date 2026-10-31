# Backend

FastAPI + SQLAlchemy 2 + Alembic, using a Neon Postgres database.

## Setup

Requires Python 3.13 and [uv](https://docs.astral.sh/uv/getting-started/installation/).

```powershell
cd backend
uv sync                      # creates .venv and installs dependencies
copy .env.example .env       # then set DATABASE_URL to your Neon connection string
```

## Run the API

```powershell
uv run uvicorn app.main:app --reload
```

- API: http://localhost:8000
- Docs: http://localhost:8000/docs
- Health: http://localhost:8000/health and http://localhost:8000/health/db

## Database migrations (Alembic)

```powershell
uv run alembic revision --autogenerate -m "describe change"   # after editing models
uv run alembic upgrade head                                   # apply migrations
uv run alembic downgrade -1                                   # roll back one revision
```

Every ORM model must be imported in `app/models/__init__.py` so autogenerate can detect it.

## Authentication

There is no public signup. Create the first admin from the command line (you are prompted for the password):

```powershell
uv run python -m app.cli create-admin --email admin@brightloop.com
```

Admins then create staff accounts with `POST /api/users/staff`. Customer accounts will be created by the customer-management workflow.

`JWT_SECRET_KEY` must be set in `.env` (see `.env.example`).

## Lint and test

```powershell
uv run ruff check .
uv run ruff format .
uv run pytest                                                        # in-memory SQLite
TEST_DATABASE_URL=postgresql+psycopg://localhost/brightloop_test uv run pytest   # disposable Postgres DB
```

## Layout

```
backend/
  app/
    api/          routers (health is in api/routes/health.py)
    core/         settings (config.py, reads .env)
    db/           SQLAlchemy engine, session, declarative Base
    models/       ORM models
    main.py       FastAPI app and CORS setup
  alembic/        migration environment and versions/
  alembic.ini
```
