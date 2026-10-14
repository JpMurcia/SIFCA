-- Migración 2 · Núcleo contable (spec 001). Ver docs/specs/001-contabilidad-comprobantes-inmutables/data-model.md.
-- Parte 1: tablas · Parte 2: funciones y triggers · Parte 3: RLS y privilegios.

-- ───────────────────────── Parte 1 · Tablas ─────────────────────────

CREATE TABLE acc.account (
  id                   uuid    PRIMARY KEY,
  tenant_id            uuid    NOT NULL,
  code                 text    NOT NULL,
  name                 text    NOT NULL CHECK (char_length(name) BETWEEN 1 AND 200),
  parent_id            uuid    REFERENCES acc.account (id),
  level                int     NOT NULL CHECK (level >= 1),
  nature               text    NOT NULL,
  allows_posting       boolean NOT NULL DEFAULT false,
  requires_party       boolean NOT NULL DEFAULT false,
  requires_cost_center boolean NOT NULL DEFAULT false,
  is_active            boolean NOT NULL DEFAULT true,
  version              int     NOT NULL DEFAULT 1,
  CONSTRAINT uq_account_tenant_code UNIQUE (tenant_id, code),
  CONSTRAINT ck_account_code   CHECK (code ~ '^[0-9]{1,12}$'),
  CONSTRAINT ck_account_nature CHECK (nature IN ('DEBIT', 'CREDIT'))
);

CREATE TABLE acc.cost_center (
  id         uuid    PRIMARY KEY,
  tenant_id  uuid    NOT NULL,
  code       text    NOT NULL CHECK (char_length(code) BETWEEN 1 AND 20),
  name       text    NOT NULL,
  is_active  boolean NOT NULL DEFAULT true,
  CONSTRAINT uq_cost_center_code UNIQUE (tenant_id, code)
);

CREATE TABLE acc.voucher_type (
  id              uuid PRIMARY KEY,
  tenant_id       uuid NOT NULL,
  code            text NOT NULL,
  name            text NOT NULL,
  numbering_scope text NOT NULL,
  CONSTRAINT uq_voucher_type_code UNIQUE (tenant_id, code),
  CONSTRAINT ck_voucher_code      CHECK (code ~ '^[A-Z]{1,5}$'),
  CONSTRAINT ck_voucher_scope     CHECK (numbering_scope IN ('TENANT', 'YEAR'))
);

CREATE TABLE acc.voucher_sequence (
  tenant_id       uuid   NOT NULL,
  voucher_type_id uuid   NOT NULL REFERENCES acc.voucher_type (id),
  scope_year      int    NOT NULL,
  last_number     bigint NOT NULL DEFAULT 0,
  PRIMARY KEY (tenant_id, voucher_type_id, scope_year),
  CONSTRAINT ck_sequence_non_negative CHECK (last_number >= 0)
);

CREATE TABLE acc.fiscal_period (
  id         uuid        PRIMARY KEY,
  tenant_id  uuid        NOT NULL,
  year       int         NOT NULL,
  month      int         NOT NULL,
  starts_on  date        NOT NULL,
  ends_on    date        NOT NULL,
  status     text        NOT NULL DEFAULT 'OPEN',
  closed_at  timestamptz,
  closed_by  uuid,
  version    int         NOT NULL DEFAULT 1,
  CONSTRAINT uq_period_tenant_year_month UNIQUE (tenant_id, year, month),
  CONSTRAINT ck_period_month     CHECK (month BETWEEN 1 AND 12),
  CONSTRAINT ck_period_range     CHECK (ends_on >= starts_on),
  CONSTRAINT ck_period_status    CHECK (status IN ('OPEN', 'CLOSED')),
  CONSTRAINT ck_period_closed_at CHECK ((status = 'CLOSED') = (closed_at IS NOT NULL)),
  CONSTRAINT ex_period_no_overlap EXCLUDE USING gist (tenant_id WITH =, daterange(starts_on, ends_on, '[]') WITH &&)
);
-- Sin solapes: ex_period_no_overlap. Un período no se elimina (guard_fiscal_period).

CREATE TABLE acc.journal_entry (
  id               uuid        PRIMARY KEY,
  tenant_id        uuid        NOT NULL,
  voucher_type_id  uuid        NOT NULL,
  numbering_year   int         NOT NULL,
  number           bigint      NOT NULL,
  accounting_date  date        NOT NULL,
  fiscal_period_id uuid        NOT NULL,
  description      text        NOT NULL CHECK (char_length(description) BETWEEN 1 AND 500),
  source_type      text        NOT NULL,
  source_id        uuid,
  status           text        NOT NULL,
  reversal_of      uuid,
  reversal_reason  text,
  total_debit      numeric     NOT NULL,
  total_credit     numeric     NOT NULL,
  idempotency_key  text,
  request_hash     char(64),
  posted_at        timestamptz NOT NULL,
  posted_by        uuid        NOT NULL,
  CONSTRAINT fk_entry_voucher_type FOREIGN KEY (voucher_type_id)  REFERENCES acc.voucher_type (id),
  CONSTRAINT fk_entry_period       FOREIGN KEY (fiscal_period_id) REFERENCES acc.fiscal_period (id),
  CONSTRAINT fk_entry_reversal_of  FOREIGN KEY (reversal_of)      REFERENCES acc.journal_entry (id),
  CONSTRAINT uq_entry_number        UNIQUE (tenant_id, voucher_type_id, numbering_year, number),
  CONSTRAINT uq_entry_id_tenant_date UNIQUE (id, tenant_id, accounting_date),
  CONSTRAINT ck_entry_number_positive CHECK (number >= 1),
  CONSTRAINT ck_entry_status          CHECK (status = 'POSTED'),
  CONSTRAINT ck_entry_source_type     CHECK (source_type IN ('MANUAL','SALES_DOCUMENT','RECEIPT','PURCHASE_DOCUMENT','STOCK_ADJUSTMENT','YEAR_CLOSING','REVERSAL')),
  CONSTRAINT ck_entry_source_id       CHECK (source_type = 'MANUAL' OR source_id IS NOT NULL),
  CONSTRAINT ck_entry_reversal_reason CHECK ((reversal_of IS NULL) = (reversal_reason IS NULL)),
  CONSTRAINT ck_entry_reversal_source CHECK ((source_type = 'REVERSAL') = (reversal_of IS NOT NULL)),
  CONSTRAINT ck_entry_reversal_self   CHECK (reversal_of IS NULL OR reversal_of <> id),
  CONSTRAINT ck_entry_total_positive  CHECK (total_debit > 0),
  CONSTRAINT ck_entry_balanced        CHECK (total_debit = total_credit),
  CONSTRAINT ck_entry_scale           CHECK (scale(total_debit) <= 2 AND scale(total_credit) <= 2),
  CONSTRAINT ck_entry_idempotency     CHECK ((idempotency_key IS NULL) = (request_hash IS NULL)
                                             AND (idempotency_key IS NULL OR char_length(idempotency_key) BETWEEN 8 AND 128))
);
CREATE UNIQUE INDEX uq_entry_reversal_of ON acc.journal_entry (reversal_of) WHERE reversal_of IS NOT NULL;
CREATE UNIQUE INDEX uq_entry_idempotency ON acc.journal_entry (tenant_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX ix_entry_journal  ON acc.journal_entry (tenant_id, accounting_date, voucher_type_id, number);
CREATE INDEX ix_entry_period   ON acc.journal_entry (tenant_id, fiscal_period_id);
CREATE INDEX ix_entry_source   ON acc.journal_entry (tenant_id, source_type, source_id);

CREATE TABLE acc.journal_line (
  id              uuid    PRIMARY KEY,
  tenant_id       uuid    NOT NULL,
  entry_id        uuid    NOT NULL,
  accounting_date date    NOT NULL,
  line_no         int     NOT NULL,
  account_id      uuid    NOT NULL,
  party_id        uuid,
  cost_center_id  uuid,
  debit           numeric NOT NULL DEFAULT 0,
  credit          numeric NOT NULL DEFAULT 0,
  description     text    CHECK (description IS NULL OR char_length(description) <= 500),
  document_ref    text    CHECK (document_ref IS NULL OR char_length(document_ref) <= 60),
  due_date        date,
  CONSTRAINT fk_line_entry       FOREIGN KEY (entry_id, tenant_id, accounting_date)
                                 REFERENCES acc.journal_entry (id, tenant_id, accounting_date),
  CONSTRAINT fk_line_account     FOREIGN KEY (account_id)     REFERENCES acc.account (id),
  CONSTRAINT fk_line_cost_center FOREIGN KEY (cost_center_id) REFERENCES acc.cost_center (id),
  CONSTRAINT uq_line_entry_lineno UNIQUE (entry_id, line_no),
  CONSTRAINT ck_line_no_positive CHECK (line_no >= 1),
  CONSTRAINT ck_line_non_negative CHECK (debit >= 0 AND credit >= 0),
  CONSTRAINT ck_line_one_side     CHECK ((debit > 0) <> (credit > 0)),
  CONSTRAINT ck_line_scale        CHECK (scale(debit) <= 2 AND scale(credit) <= 2),
  CONSTRAINT ck_line_range        CHECK (debit < 10000000000000000 AND credit < 10000000000000000)
);
CREATE INDEX ix_line_ledger ON acc.journal_line (tenant_id, account_id, accounting_date);
CREATE INDEX ix_line_party  ON acc.journal_line (tenant_id, party_id, account_id) WHERE party_id IS NOT NULL;
CREATE INDEX ix_line_entry  ON acc.journal_line (entry_id);

CREATE TABLE acc.journal_draft (
  id              uuid        PRIMARY KEY,
  tenant_id       uuid        NOT NULL,
  voucher_type_id uuid        NOT NULL REFERENCES acc.voucher_type (id),
  accounting_date date,
  description     text        CHECK (description IS NULL OR char_length(description) <= 500),
  lines           jsonb       NOT NULL,
  created_by      uuid        NOT NULL,
  created_at      timestamptz NOT NULL,
  updated_at      timestamptz NOT NULL,
  version         int         NOT NULL DEFAULT 1
);
CREATE INDEX ix_draft_date ON acc.journal_draft (tenant_id, accounting_date);

-- ───────────────────────── Parte 2 · Funciones y triggers ─────────────────────────

-- INV-05: inmutabilidad (UPDATE, DELETE y TRUNCATE) — incluso frente al propietario.
CREATE TRIGGER trg_entry_immutable BEFORE UPDATE OR DELETE ON acc.journal_entry
  FOR EACH ROW EXECUTE FUNCTION audit.reject_mutation();
CREATE TRIGGER trg_entry_no_truncate BEFORE TRUNCATE ON acc.journal_entry
  FOR EACH STATEMENT EXECUTE FUNCTION audit.reject_mutation();
CREATE TRIGGER trg_line_immutable BEFORE UPDATE OR DELETE ON acc.journal_line
  FOR EACH ROW EXECUTE FUNCTION audit.reject_mutation();
CREATE TRIGGER trg_line_no_truncate BEFORE TRUNCATE ON acc.journal_line
  FOR EACH STATEMENT EXECUTE FUNCTION audit.reject_mutation();

-- INV-01 (R-CON-001, R-CON-003): cabecera + líneas coherentes y cuadradas al confirmar la transacción.
CREATE FUNCTION acc.assert_entry_consistent() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_entry  uuid := CASE WHEN TG_TABLE_NAME = 'journal_entry' THEN NEW.id ELSE NEW.entry_id END;
  v_lines  int;
  v_debit  numeric;
  v_credit numeric;
  v_hd     numeric;
  v_hc     numeric;
BEGIN
  SELECT count(*), COALESCE(sum(debit), 0), COALESCE(sum(credit), 0)
    INTO v_lines, v_debit, v_credit FROM acc.journal_line WHERE entry_id = v_entry;
  SELECT total_debit, total_credit INTO v_hd, v_hc FROM acc.journal_entry WHERE id = v_entry;
  IF v_lines < 2 OR v_debit <> v_credit OR v_debit <> v_hd OR v_credit <> v_hc THEN
    RAISE EXCEPTION 'ENTRY_NOT_BALANCED: entry % lines=% debit=% credit=%', v_entry, v_lines, v_debit, v_credit
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NULL;
END
$$;
CREATE CONSTRAINT TRIGGER trg_entry_balanced_h AFTER INSERT ON acc.journal_entry
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION acc.assert_entry_consistent();
CREATE CONSTRAINT TRIGGER trg_entry_balanced_l AFTER INSERT ON acc.journal_line
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION acc.assert_entry_consistent();

-- INV-03 (R-CON-003) y R-CON-008: cuenta de movimiento y activa; tercero / centro de costo si la cuenta lo exige.
CREATE FUNCTION acc.validate_line() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE a acc.account%ROWTYPE;
BEGIN
  SELECT * INTO a FROM acc.account WHERE id = NEW.account_id AND tenant_id = NEW.tenant_id;
  IF NOT FOUND OR NOT a.allows_posting OR NOT a.is_active THEN
    RAISE EXCEPTION 'ACCOUNT_NOT_POSTABLE: %', NEW.account_id USING ERRCODE = 'P0001';
  END IF;
  IF a.requires_party AND NEW.party_id IS NULL THEN
    RAISE EXCEPTION 'PARTY_REQUIRED: account %', a.code USING ERRCODE = 'P0001';
  END IF;
  IF a.requires_cost_center AND NEW.cost_center_id IS NULL THEN
    RAISE EXCEPTION 'COST_CENTER_REQUIRED: account %', a.code USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END
$$;
CREATE TRIGGER trg_line_validate BEFORE INSERT ON acc.journal_line
  FOR EACH ROW EXECUTE FUNCTION acc.validate_line();

-- INV-04 (R-CON-004): período abierto y fecha contenida en él. FOR SHARE serializa contra el cierre (FOR UPDATE).
CREATE FUNCTION acc.assert_period_open() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p acc.fiscal_period%ROWTYPE;
BEGIN
  SELECT * INTO p FROM acc.fiscal_period WHERE id = NEW.fiscal_period_id AND tenant_id = NEW.tenant_id FOR SHARE;
  IF NOT FOUND OR NEW.accounting_date NOT BETWEEN p.starts_on AND p.ends_on THEN
    RAISE EXCEPTION 'PERIOD_NOT_FOUND: entry date % is outside period %', NEW.accounting_date, NEW.fiscal_period_id
      USING ERRCODE = 'P0001';
  END IF;
  IF p.status <> 'OPEN' THEN
    RAISE EXCEPTION 'PERIOD_CLOSED: %-%', p.year, p.month USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END
$$;
CREATE TRIGGER trg_entry_period BEFORE INSERT ON acc.journal_entry
  FOR EACH ROW EXECUTE FUNCTION acc.assert_period_open();

-- R-CON-006: el contador solo avanza de uno en uno y nunca se borra.
CREATE FUNCTION acc.guard_sequence() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'IMMUTABLE_RECORD: DELETE on acc.voucher_sequence is not allowed' USING ERRCODE = 'P0001';
  END IF;
  IF NEW.tenant_id <> OLD.tenant_id OR NEW.voucher_type_id <> OLD.voucher_type_id OR NEW.scope_year <> OLD.scope_year
     OR NEW.last_number <> OLD.last_number + 1 THEN
    RAISE EXCEPTION 'SEQUENCE_VIOLATION: last_number solo puede aumentar en 1 (% -> %)', OLD.last_number, NEW.last_number
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END
$$;
CREATE TRIGGER trg_sequence_guard BEFORE UPDATE OR DELETE ON acc.voucher_sequence
  FOR EACH ROW EXECUTE FUNCTION acc.guard_sequence();

-- Períodos: solo cambia el estado (OPEN <-> CLOSED); nunca se eliminan.
CREATE FUNCTION acc.guard_fiscal_period() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'IMMUTABLE_RECORD: DELETE on acc.fiscal_period is not allowed' USING ERRCODE = 'P0001';
  END IF;
  IF NEW.id <> OLD.id OR NEW.tenant_id <> OLD.tenant_id OR NEW.year <> OLD.year OR NEW.month <> OLD.month
     OR NEW.starts_on <> OLD.starts_on OR NEW.ends_on <> OLD.ends_on OR NEW.status = OLD.status THEN
    RAISE EXCEPTION 'PERIOD_VIOLATION: solo se permite cambiar el estado del período' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END
$$;
CREATE TRIGGER trg_period_guard BEFORE UPDATE OR DELETE ON acc.fiscal_period
  FOR EACH ROW EXECUTE FUNCTION acc.guard_fiscal_period();

-- Cuentas: no se eliminan; code, nature y tenant_id no cambian si ya tienen movimientos.
CREATE FUNCTION acc.guard_account() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'IMMUTABLE_RECORD: DELETE on acc.account is not allowed' USING ERRCODE = 'P0001';
  END IF;
  IF (NEW.code <> OLD.code OR NEW.nature <> OLD.nature OR NEW.tenant_id <> OLD.tenant_id)
     AND EXISTS (SELECT 1 FROM acc.journal_line WHERE account_id = OLD.id) THEN
    RAISE EXCEPTION 'ACCOUNT_IN_USE: code, nature y tenant_id no cambian en una cuenta con movimientos' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END
$$;
CREATE TRIGGER trg_account_guard BEFORE UPDATE OR DELETE ON acc.account
  FOR EACH ROW EXECUTE FUNCTION acc.guard_account();

-- ───────────────────────── Parte 3 · RLS y privilegios ─────────────────────────

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['account','cost_center','voucher_type','voucher_sequence','fiscal_period','journal_entry','journal_line','journal_draft']
  LOOP
    EXECUTE format('ALTER TABLE acc.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE acc.%I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format($p$CREATE POLICY tenant_isolation ON acc.%I
      USING      (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
      WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)$p$, t);
    EXECUTE format('REVOKE ALL ON acc.%I FROM PUBLIC', t);
    EXECUTE format('GRANT SELECT ON acc.%I TO sifca_readonly', t);
  END LOOP;
END
$$;

-- Registro inmutable: solo lectura e inserción (REVOKE UPDATE, DELETE, TRUNCATE a nivel de privilegios).
GRANT SELECT, INSERT ON acc.journal_entry, acc.journal_line TO sifca_app;
-- Contador: solo avanza last_number.
GRANT SELECT, INSERT ON acc.voucher_sequence TO sifca_app;
GRANT UPDATE (last_number) ON acc.voucher_sequence TO sifca_app;
-- Maestros: sin DELETE.
GRANT SELECT, INSERT, UPDATE ON acc.account, acc.cost_center, acc.voucher_type, acc.fiscal_period TO sifca_app;
-- Borradores: mutables.
GRANT SELECT, INSERT, UPDATE, DELETE ON acc.journal_draft TO sifca_app;
