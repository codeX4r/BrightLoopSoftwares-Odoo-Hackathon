from logging.config import fileConfig

from sqlalchemy import create_engine, pool

# Importing the models package registers every ORM model on Base.metadata.
import app.models  # noqa: F401
from alembic import context
from app.core.config import get_settings
from app.db.base import Base

config = context.config

# Interpret the logging section of alembic.ini.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Autogenerate compares the ORM models against the live database schema.
target_metadata = Base.metadata

# Tables that exist on Neon but whose migration file is not in Git yet. They are skipped by
# autogenerate and `alembic check` so the history here doesn't try to create them twice.
#   customer_profiles: created by revision da1c3bc4ec7c (not pushed). Remove this entry
#   once that migration file is added to alembic/versions.
EXTERNALLY_MANAGED_TABLES = {"customer_profiles"}


def include_object(obj, name, type_, reflected, compare_to):
    table = obj if type_ == "table" else getattr(obj, "table", None)
    table_name = name if type_ == "table" else getattr(table, "name", None)
    return table_name not in EXTERNALLY_MANAGED_TABLES


# The database URL comes from the app settings (.env / environment), not alembic.ini.
database_url = get_settings().database_url


def run_migrations_offline() -> None:
    """Emit SQL to stdout without connecting to the database."""
    context.configure(
        url=database_url,
        target_metadata=target_metadata,
        include_object=include_object,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Apply migrations against the database."""
    connectable = create_engine(database_url, poolclass=pool.NullPool)

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            include_object=include_object,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
