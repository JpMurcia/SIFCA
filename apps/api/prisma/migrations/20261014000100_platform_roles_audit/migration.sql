-- Migración 1 · Plataforma: esquemas, bitácora de auditoría y función de inmutabilidad.
-- Escrita a mano (ADR-0004): Prisma no expresa privilegios, RLS ni triggers.
-- Requiere los roles sifca_owner / sifca_app / sifca_readonly (infra/postgres/init/00-roles.sql).

CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE SCHEMA IF NOT EXISTS acc;
CREATE SCHEMA IF NOT EXISTS audit;

GRANT USAGE ON SCHEMA acc, audit TO sifca_app, sifca_readonly;

-- Rechaza cualquier mutación (UPDATE, DELETE y TRUNCATE) de las tablas de registro inmutable (principio I).
CREATE FUNCTION audit.reject_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'IMMUTABLE_RECORD: % on %.% is not allowed', TG_OP, TG_TABLE_SCHEMA, TG_TABLE_NAME
    USING ERRCODE = 'P0001';
END
$$;

CREATE TABLE audit.audit_log (
  id           uuid        PRIMARY KEY,
  tenant_id    uuid        NOT NULL,
  actor_id     uuid        NOT NULL,
  action       text        NOT NULL CHECK (char_length(action) BETWEEN 1 AND 100),
  entity_type  text        NOT NULL,
  entity_id    uuid        NOT NULL,
  reason       text,
  before       jsonb,
  after        jsonb,
  request_id   text,
  occurred_at  timestamptz NOT NULL
);
CREATE INDEX ix_audit_entity ON audit.audit_log (tenant_id, entity_type, entity_id, occurred_at);

CREATE TRIGGER trg_audit_immutable BEFORE UPDATE OR DELETE ON audit.audit_log
  FOR EACH ROW EXECUTE FUNCTION audit.reject_mutation();
CREATE TRIGGER trg_audit_no_truncate BEFORE TRUNCATE ON audit.audit_log
  FOR EACH STATEMENT EXECUTE FUNCTION audit.reject_mutation();

ALTER TABLE audit.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit.audit_log FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON audit.audit_log
  USING      (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

REVOKE ALL ON audit.audit_log FROM PUBLIC;
GRANT SELECT, INSERT ON audit.audit_log TO sifca_app;
GRANT SELECT ON audit.audit_log TO sifca_readonly;
