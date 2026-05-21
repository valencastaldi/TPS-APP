import os
from sqlmodel import SQLModel, Session, create_engine
from dotenv import load_dotenv
from urllib.parse import quote_plus
import logging
from sqlalchemy.engine.url import make_url
from sqlalchemy import text

load_dotenv()

raw_url = os.getenv("DATABASE_URL")
if not raw_url or "usuario:password" in raw_url:
    user = os.getenv("MYSQL_USER", "root")
    password = quote_plus(os.getenv("MYSQL_PASSWORD", ""))
    host = os.getenv("MYSQL_HOST", "127.0.0.1")
    port = os.getenv("MYSQL_PORT", "3306")
    database = os.getenv("MYSQL_DATABASE", "poolpay")
    raw_url = f"mysql+pymysql://{user}:{password}@{host}:{port}/{database}?charset=utf8mb4"

if not raw_url:
    raw_url = "sqlite:///./poolpay.db"

# Si es MySQL, crear la base de datos si no existe
try:
    url = make_url(raw_url)
    if url.get_backend_name().startswith("mysql") and url.database:
        db_name = url.database
        # engine temporal sin database para crearla si no existe
        no_db_url = url.set(database=None)
        tmp_engine = create_engine(no_db_url.render_as_string(hide_password=False), pool_pre_ping=True)
        with tmp_engine.connect() as conn:
            conn.execute(text(f"CREATE DATABASE IF NOT EXISTS `{db_name}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"))
            conn.commit()
except Exception as e:
    logging.getLogger(__name__).warning(f"No se pudo asegurar la creacion de la DB (puede que ya exista): {e}")

# Crear engine con pre_ping para evitar conexiones muertas
engine = create_engine(raw_url, echo=False, pool_pre_ping=True)

# Log seguro (sin password)
try:
    safe_url = raw_url
    if "@" in safe_url and ":" in safe_url.split("@")[0]:
        creds, rest = safe_url.split("@", 1)
        if "//" in creds:
            prefix, auth = creds.split("//", 1)
            if ":" in auth:
                user_only = auth.split(":", 1)[0]
                safe_url = f"{prefix}//{user_only}:****@{rest}"
    logging.getLogger(__name__).info(f"DB URL usada: {safe_url}")
except Exception:
    pass

# Fuerza la importación de modelos para que las tablas estén registradas
from app import models as _models  # noqa: F401


def _mysql_add_missing_columns(engine):
    """Agrega columnas nuevas a tablas existentes si no existen.
    Usa una conexión con autocommit para evitar conflictos con el context manager."""
    try:
        url = make_url(raw_url)
        if not url.get_backend_name().startswith("mysql"):
            return
        db_name = url.database

        # Lista de (tabla, columna, DDL completo)
        migrations = [
            ("clients", "neighborhood", "ALTER TABLE `clients` ADD COLUMN `neighborhood` VARCHAR(80) NULL AFTER `city`"),
            ("clients", "lat",          "ALTER TABLE `clients` ADD COLUMN `lat` DOUBLE NULL"),
            ("clients", "lng",          "ALTER TABLE `clients` ADD COLUMN `lng` DOUBLE NULL"),
            ("clients", "assigned_days","ALTER TABLE `clients` ADD COLUMN `assigned_days` VARCHAR(80) NULL"),
        ]

        with engine.connect() as conn:
            for table, col, ddl in migrations:
                res = conn.execute(
                    text(
                        "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS "
                        "WHERE TABLE_SCHEMA=:db AND TABLE_NAME=:tbl AND COLUMN_NAME=:col"
                    ),
                    {"db": db_name, "tbl": table, "col": col},
                ).scalar()
                if not res:
                    conn.execute(text(ddl))
                    conn.commit()
                    logging.getLogger(__name__).info(f"Migracion: columna '{col}' agregada a '{table}'.")

    except Exception as e:
        logging.getLogger(__name__).warning(f"Migracion automatica omitida: {e}")


def init_db():
    # Ensure new tables exist
    SQLModel.metadata.create_all(engine)
    # Run lightweight migrations (agrega columnas nuevas a tablas existentes)
    _mysql_add_missing_columns(engine)


def get_session():
    with Session(engine) as session:
        yield session
