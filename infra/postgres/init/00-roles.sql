-- Roles de SIFCA (docs/specs/001-…/data-model.md §4). Idempotente.
-- En producción los provee la infraestructura (IaC); en desarrollo y pruebas se ejecuta este archivo.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sifca_owner') THEN
    CREATE ROLE sifca_owner LOGIN PASSWORD 'sifca_owner_dev' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sifca_app') THEN
    CREATE ROLE sifca_app LOGIN PASSWORD 'sifca_app_dev' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sifca_readonly') THEN
    CREATE ROLE sifca_readonly LOGIN PASSWORD 'sifca_readonly_dev' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
  END IF;
END $$;
