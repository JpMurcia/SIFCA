# Modelo de datos preliminar (PostgreSQL)

Estado: **borrador de Fase 1**. Es un diseño para discutir, no un DDL final. Las migraciones se escribirán en
SQL revisable (ver ADR-0004) en la Fase 2.

Relacionado: [`01-vision-general-y-modulos.md`](01-vision-general-y-modulos.md) ·
reglas: [`../02-normativa-y-reglas/`](../02-normativa-y-reglas/)

## 1. Convenciones

| Tema | Convención |
|---|---|
| Esquemas | Un **esquema PostgreSQL por módulo** (`iam`, `core`, `parties`, `catalog`, `tax`, `inventory`, `sales`, `purchases`, `acc`, `arap`, `lending`, `einv`, `doc`, `integ`, `audit`, `jobs`). Refuerza la regla D-4 (ningún módulo toca tablas ajenas) con permisos de base de datos |
| Nombres | `snake_case`, tablas en singular (`journal_entry`) |
| Clave primaria | `id uuid` (UUID v7: ordenable por tiempo, buena localidad de índice) |
| Multiempresa | `company_id uuid NOT NULL` en toda tabla de negocio; RLS activa (ADR-0002); unicidad siempre `(company_id, …)` |
| Auditoría de fila | `created_at timestamptz`, `created_by uuid`, `updated_at`, `updated_by`; `version int` para bloqueo optimista en agregados editables |
| Dinero | `numeric(18,2)` (COP, 2 decimales). **Nunca** `float`/`money` |
| Costo unitario | `numeric(18,6)` |
| Cantidades | `numeric(18,4)` |
| Porcentajes | `numeric(9,6)` expresados en **porcentaje** (19% = `19.000000`) |
| Fechas | Contables: `date`. Instantes: `timestamptz` (UTC) |
| Enumeraciones | `text` + `CHECK` (o tabla de catálogo), no `ENUM` nativo: más fácil de evolucionar |
| Borrado | Datos maestros: *soft delete* (`archived_at`). Datos contables, fiscales y de stock: **nunca se borran** |
| Montos en comprobantes | Cada línea con **un solo lado** positivo: `debit` o `credit` (R-CON-002); sin importes negativos |

## 2. Diagramas entidad-relación

Los diagramas muestran las columnas más relevantes, no todas.

### 2.1 Plataforma, terceros y maestros

```mermaid
erDiagram
    COMPANY ||--o{ APP_USER : "tiene miembros"
    COMPANY ||--o{ API_KEY : "emite"
    COMPANY ||--o{ PARTY : "registra"
    COMPANY ||--o{ ITEM : "vende"
    COMPANY ||--o{ BRANCH : "opera en"
    APP_USER }o--o{ ROLE : "asignado"
    ROLE ||--o{ ROLE_PERMISSION : "concede"
    PARTY ||--o{ PARTY_ADDRESS : "tiene"
    PARTY ||--o{ PARTY_CONTACT : "tiene"
    ITEM_CATEGORY ||--o{ ITEM : "agrupa"
    UNIT ||--o{ ITEM : "mide"
    ITEM ||--o{ ITEM_COMPONENT : "kit compuesto por"
    ITEM ||--o{ PRICE_LIST_ITEM : "tiene precio"
    PRICE_LIST ||--o{ PRICE_LIST_ITEM : "contiene"
    TAX ||--o{ TAX_RATE : "tarifas con vigencia"
    TAX ||--o{ ITEM : "grava"
    WITHHOLDING_CONCEPT ||--o{ TAX_RATE : "aplica a"

    COMPANY {
        uuid id PK
        text legal_name
        text nit
        text nit_dv
        jsonb fiscal_responsibilities "códigos RUT, ej. O-13, O-15"
        text accounting_framework "NIIF_PYMES, MICRO"
        text timezone
        bool is_withholding_agent
        bool is_electronic_invoicer
        text retentions_recognized_at "RECEIPT o INVOICE (P-04)"
    }
    APP_USER {
        uuid id PK
        uuid company_id FK
        text email UK
        text password_hash
        bool mfa_enabled
    }
    API_KEY {
        uuid id PK
        uuid company_id FK
        text key_prefix
        text key_hash
        text_array scopes
        timestamptz expires_at
        timestamptz revoked_at
    }
    ROLE {
        uuid id PK
        uuid company_id FK
        text name
    }
    ROLE_PERMISSION {
        uuid role_id FK
        text permission "ej. sales.invoice.issue"
    }
    BRANCH {
        uuid id PK
        uuid company_id FK
        text code
        text name
    }
    PARTY {
        uuid id PK
        uuid company_id FK
        text kind "CUSTOMER, SUPPLIER, EMPLOYEE, OTHER"
        text id_type "NIT, CC, CE, PAS, ..."
        text id_number
        text id_dv
        text legal_name
        text trade_name
        jsonb fiscal_responsibilities
        text vat_regime
        bool is_income_declarant
        bool is_withholding_agent
        text ciiu_code
        text municipality_code
        numeric credit_limit "R-CAR-008"
        int payment_term_days
    }
    PARTY_ADDRESS {
        uuid id PK
        uuid party_id FK
        text line1
        text municipality_code
        text department_code
        text country_code
    }
    PARTY_CONTACT {
        uuid id PK
        uuid party_id FK
        text name
        text email
        text phone
    }
    ITEM_CATEGORY {
        uuid id PK
        uuid company_id FK
        uuid parent_id FK
        text name
    }
    UNIT {
        uuid id PK
        text code "código UN/ECE, ej. 94 unidad"
        text name
    }
    ITEM {
        uuid id PK
        uuid company_id FK
        text sku UK
        text name
        text item_type "SIMPLE, KIT, VARIANT_PARENT, VARIANT, SERVICE"
        bool tracks_inventory
        bool tracks_lots
        uuid tax_id FK
        uuid category_id FK
        uuid unit_id FK
        bool published_in_storefront
        text status
    }
    ITEM_COMPONENT {
        uuid kit_item_id FK
        uuid component_item_id FK
        numeric quantity
    }
    PRICE_LIST {
        uuid id PK
        uuid company_id FK
        text name
        bool includes_tax
    }
    PRICE_LIST_ITEM {
        uuid price_list_id FK
        uuid item_id FK
        numeric price
    }
    TAX {
        uuid id PK
        text code "IVA, INC, RETEFUENTE, RETEIVA, RETEICA"
        text kind "SALES_TAX, WITHHOLDING"
        text dian_tax_code "01, 04, 03, ..."
    }
    TAX_RATE {
        uuid id PK
        uuid tax_id FK
        uuid withholding_concept_id FK
        numeric rate_percent
        numeric min_base_uvt "base mínima en UVT"
        numeric min_base_amount "o base mínima en pesos"
        date valid_from
        date valid_to
        jsonb conditions "tipo de tercero, concepto, CIIU, municipio"
        text source_reference "norma que la sustenta"
        text verification_status "VERIFIED, SECONDARY, UNVERIFIED"
    }
    WITHHOLDING_CONCEPT {
        uuid id PK
        text code "COMPRAS, SERVICIOS, HONORARIOS, ARRIENDO_INMUEBLE ..."
        text name
        text applies_to "PURCHASE, SERVICE, FEES, RENT"
    }
    UVT_VALUE {
        int year PK
        numeric value
        text source_reference "resolución DIAN"
        text verification_status
    }
```

### 2.2 Inventario

```mermaid
erDiagram
    WAREHOUSE ||--o{ STOCK_BALANCE : "guarda"
    WAREHOUSE ||--o{ STOCK_MOVEMENT : "origen o destino"
    ITEM ||--o{ STOCK_BALANCE : "existencia de"
    ITEM ||--o{ STOCK_MOVEMENT : "mueve"
    LOT ||--o{ STOCK_MOVEMENT : "identifica"
    LOT ||--o{ STOCK_BALANCE : "existencia por lote"
    ITEM ||--o{ ITEM_COST : "costo promedio"
    STOCK_MOVEMENT ||--o| STOCK_MOVEMENT : "reversa de"
    STOCK_RESERVATION }o--|| ITEM : "reserva"
    STOCK_RESERVATION }o--|| WAREHOUSE : "en"

    WAREHOUSE {
        uuid id PK
        uuid company_id FK
        uuid branch_id FK
        text code UK
        text name
        bool allows_negative_stock
    }
    LOT {
        uuid id PK
        uuid company_id FK
        uuid item_id FK
        text lot_code
        date manufactured_on
        date expires_on
    }
    STOCK_MOVEMENT {
        uuid id PK
        uuid company_id FK
        uuid item_id FK
        uuid warehouse_id FK
        uuid lot_id FK
        date movement_date
        text movement_type "PURCHASE_IN, SALE_OUT, TRANSFER_OUT, TRANSFER_IN, ADJUST_IN, ADJUST_OUT, RETURN_IN, RETURN_OUT"
        numeric quantity "siempre positiva"
        text direction "IN, OUT"
        numeric unit_cost "costo con que entró o salió"
        numeric total_cost
        numeric running_quantity "saldo después del movimiento"
        numeric running_value
        text source_type "documento origen"
        uuid source_id
        uuid reversal_of FK
    }
    STOCK_BALANCE {
        uuid company_id FK
        uuid item_id FK
        uuid warehouse_id FK
        uuid lot_id FK
        numeric on_hand
        numeric reserved
        timestamptz updated_at
    }
    ITEM_COST {
        uuid company_id FK
        uuid item_id FK
        numeric quantity_on_hand "global de la empresa"
        numeric total_value
        numeric avg_unit_cost "derivado: total_value / quantity"
        uuid last_movement_id FK
    }
    STOCK_RESERVATION {
        uuid id PK
        uuid company_id FK
        uuid item_id FK
        uuid warehouse_id FK
        numeric quantity
        text source_type "WEB_ORDER, SALES_ORDER"
        uuid source_id
        timestamptz expires_at
    }
```

### 2.3 Ventas y compras

```mermaid
erDiagram
    NUMBERING_RANGE ||--o{ SALES_DOCUMENT : "numera"
    PARTY ||--o{ SALES_DOCUMENT : "es adquirente"
    SALES_DOCUMENT ||--|{ SALES_DOCUMENT_LINE : "contiene"
    SALES_DOCUMENT_LINE ||--o{ LINE_TAX : "genera impuesto"
    SALES_DOCUMENT ||--o{ DOCUMENT_WITHHOLDING : "retenciones"
    SALES_DOCUMENT ||--o{ SALES_DOCUMENT : "nota referencia a original"
    SALES_DOCUMENT ||--o{ DOCUMENT_REVISION : "historial de correcciones"
    ITEM ||--o{ SALES_DOCUMENT_LINE : "se vende"
    PURCHASE_DOCUMENT ||--|{ PURCHASE_LINE : "contiene"
    PARTY ||--o{ PURCHASE_DOCUMENT : "proveedor"

    NUMBERING_RANGE {
        uuid id PK
        uuid company_id FK
        text doc_kind "INVOICE, CREDIT_NOTE, DEBIT_NOTE, SUPPORT_DOC, POS"
        text prefix
        bigint range_from
        bigint range_to
        bigint next_number
        text dian_resolution_number
        date resolution_date
        date valid_from
        date valid_to
        text technical_key "clave técnica, cifrada"
        text status "ACTIVE, EXHAUSTED, EXPIRED"
    }
    SALES_DOCUMENT {
        uuid id PK
        uuid company_id FK
        text doc_type "QUOTE, ORDER, INVOICE, CREDIT_NOTE, DEBIT_NOTE, POS_TICKET"
        text status "DRAFT, ISSUED, TRANSMITTING, ACCEPTED, REJECTED, CANCELLED"
        uuid numbering_range_id FK
        text prefix
        bigint number
        timestamptz issued_at
        date due_date
        uuid customer_id FK
        uuid references_document_id FK
        text correction_concept_code
        text payment_form "CONTADO, CREDITO"
        text payment_method_code
        numeric subtotal
        numeric tax_total
        numeric withholding_total
        numeric total
        text cufe
        text origin "BACKOFFICE, WEB_ORDER, POS, API"
        text idempotency_key
    }
    SALES_DOCUMENT_LINE {
        uuid id PK
        uuid document_id FK
        int line_no
        uuid item_id FK
        text description
        numeric quantity
        numeric unit_price
        numeric discount_amount
        numeric line_subtotal
        uuid warehouse_id FK
        uuid lot_id FK
        numeric unit_cost_at_sale "costo usado al emitir"
    }
    LINE_TAX {
        uuid line_id FK
        uuid tax_id FK
        uuid tax_rate_id FK "tarifa aplicada (snapshot)"
        numeric taxable_base
        numeric rate_percent
        numeric tax_amount
    }
    DOCUMENT_WITHHOLDING {
        uuid document_id FK
        uuid tax_id FK
        uuid tax_rate_id FK
        text direction "PRACTICED, SUFFERED"
        numeric base
        numeric rate_percent
        numeric amount
    }
    DOCUMENT_REVISION {
        uuid id PK
        uuid document_id FK
        int revision_no
        jsonb snapshot
        text reason
    }
    PURCHASE_DOCUMENT {
        uuid id PK
        uuid company_id FK
        text doc_type "PURCHASE_ORDER, SUPPLIER_INVOICE, SUPPORT_DOCUMENT, PURCHASE_RETURN"
        uuid supplier_id FK
        text supplier_document_number
        date document_date
        numeric total
        text status
    }
    PURCHASE_LINE {
        uuid id PK
        uuid document_id FK
        uuid item_id FK
        numeric quantity
        numeric unit_cost
    }
```

> Los impuestos y retenciones se **congelan** en cada documento (`tax_rate_id`, `rate_percent`, `base`).
> Si una tarifa cambia después, los documentos ya emitidos no cambian.

### 2.4 Contabilidad

```mermaid
erDiagram
    ACCOUNT ||--o{ ACCOUNT : "es hija de"
    ACCOUNT ||--o{ JOURNAL_LINE : "se mueve en"
    FISCAL_PERIOD ||--o{ JOURNAL_ENTRY : "contiene"
    JOURNAL_ENTRY ||--|{ JOURNAL_LINE : "se compone de"
    JOURNAL_ENTRY ||--o| JOURNAL_ENTRY : "reversa de"
    VOUCHER_TYPE ||--o{ JOURNAL_ENTRY : "clasifica"
    VOUCHER_TYPE ||--o{ VOUCHER_SEQUENCE : "consecutivo"
    PARTY ||--o{ JOURNAL_LINE : "tercero"
    COST_CENTER ||--o{ JOURNAL_LINE : "analítica"
    POSTING_RULE ||--o{ POSTING_RULE_LINE : "define"
    ACCOUNT ||--o{ POSTING_RULE_LINE : "usa"

    ACCOUNT {
        uuid id PK
        uuid company_id FK
        text code UK "ej. 130505"
        text name
        uuid parent_id FK
        int level "1 clase, 2 grupo, 4 cuenta, 6 subcuenta, 8+ auxiliar"
        text nature "DEBIT, CREDIT"
        bool allows_posting "solo auxiliares"
        bool requires_party
        bool requires_cost_center
        text dian_concept_code
        bool is_active
    }
    FISCAL_PERIOD {
        uuid id PK
        uuid company_id FK
        int year
        int month
        date starts_on
        date ends_on
        text status "OPEN, CLOSED"
        timestamptz closed_at
        uuid closed_by
    }
    VOUCHER_TYPE {
        uuid id PK
        uuid company_id FK
        text code "FV, NC, RC, CE, NOT, AJ ..."
        text name
        text numbering_scope "COMPANY, YEAR"
    }
    VOUCHER_SEQUENCE {
        uuid voucher_type_id FK
        int scope_year
        bigint last_number
    }
    JOURNAL_ENTRY {
        uuid id PK
        uuid company_id FK
        uuid voucher_type_id FK
        bigint number
        date accounting_date
        uuid fiscal_period_id FK
        text description
        text source_type "SALES_DOCUMENT, RECEIPT, LOAN, MANUAL ..."
        uuid source_id
        text status "POSTED"
        uuid reversal_of FK
        uuid reversed_by FK
        numeric total_debit
        numeric total_credit
        timestamptz posted_at
        uuid posted_by
    }
    JOURNAL_LINE {
        uuid id PK
        uuid entry_id FK
        int line_no
        uuid account_id FK
        uuid party_id FK
        uuid cost_center_id FK
        numeric debit
        numeric credit
        text description
        text document_ref "factura/recibo de referencia"
        date due_date "para cartera"
    }
    COST_CENTER {
        uuid id PK
        uuid company_id FK
        text code
        text name
    }
    POSTING_RULE {
        uuid id PK
        uuid company_id FK
        text event_type "InvoiceIssued, CreditNoteIssued, ReceiptRegistered ..."
        text concept "REVENUE, VAT_OUTPUT, RECEIVABLE, COGS, INVENTORY ..."
    }
    POSTING_RULE_LINE {
        uuid rule_id FK
        text concept
        text side "DEBIT, CREDIT"
        uuid account_id FK
        jsonb conditions "por categoría de ítem, tarifa de IVA, etc."
    }
```

### 2.5 Cartera, préstamos, factura electrónica e integración

```mermaid
erDiagram
    PARTY ||--o{ RECEIPT : "paga"
    RECEIPT ||--|{ RECEIPT_ALLOCATION : "se aplica a"
    SALES_DOCUMENT ||--o{ RECEIPT_ALLOCATION : "recibe abono"
    PARTY ||--o{ COLLECTION_ACTION : "gestión de cobro"
    PARTY ||--o{ LOAN : "deudor o acreedor"
    LOAN ||--|{ LOAN_SCHEDULE_ITEM : "cronograma"
    LOAN ||--o{ LOAN_PAYMENT : "pagos"
    SALES_DOCUMENT ||--o{ EINVOICE_SUBMISSION : "transmisiones"
    EINVOICE_SUBMISSION ||--o{ EINVOICE_EVENT : "respuestas DIAN"
    WEBHOOK_ENDPOINT ||--o{ WEBHOOK_DELIVERY : "entregas"
    OUTBOX_EVENT ||--o{ WEBHOOK_DELIVERY : "origina"

    RECEIPT {
        uuid id PK
        uuid company_id FK
        text kind "CASH_RECEIPT, DISBURSEMENT"
        uuid party_id FK
        date receipt_date
        numeric amount
        text payment_method
        uuid bank_account_account_id FK
        numeric withholdings_suffered
        uuid journal_entry_id FK
    }
    RECEIPT_ALLOCATION {
        uuid receipt_id FK
        uuid document_id FK
        numeric amount_applied
    }
    COLLECTION_ACTION {
        uuid id PK
        uuid party_id FK
        timestamptz at
        text channel "CALL, EMAIL, WHATSAPP, VISIT"
        text outcome
        date promise_date
        numeric promise_amount
    }
    LOAN {
        uuid id PK
        uuid company_id FK
        text direction "GRANTED, RECEIVED"
        uuid party_id FK
        numeric principal
        numeric periodic_rate_percent
        text rate_basis "NOMINAL_PERIOD, EFFECTIVE_ANNUAL"
        text amortization "FIXED_PAYMENT, FIXED_PRINCIPAL, BULLET"
        int term_periods
        text frequency "MONTHLY, ..."
        date disbursement_date
        text status
    }
    LOAN_SCHEDULE_ITEM {
        uuid id PK
        uuid loan_id FK
        int installment_no
        date due_date
        numeric principal_due
        numeric interest_due
        numeric total_due
        numeric balance_after
        numeric paid_amount
    }
    LOAN_PAYMENT {
        uuid id PK
        uuid loan_id FK
        date paid_on
        numeric principal_paid
        numeric interest_paid
        numeric late_interest_paid
        uuid journal_entry_id FK
    }
    EINVOICE_SUBMISSION {
        uuid id PK
        uuid document_id FK
        int attempt
        text provider "adaptador usado"
        text status "PENDING, SENT, ACCEPTED, ACCEPTED_WITH_NOTES, REJECTED, ERROR"
        text cufe
        uuid xml_file_id FK
        uuid signed_xml_file_id FK
        uuid dian_response_file_id FK
        uuid pdf_file_id FK
        jsonb validation_messages
        timestamptz sent_at
        timestamptz answered_at
    }
    EINVOICE_EVENT {
        uuid id PK
        uuid submission_id FK
        text event_code
        timestamptz at
    }
    OUTBOX_EVENT {
        uuid id PK
        uuid company_id FK
        text event_type "invoice.issued, invoice.accepted, stock.changed ..."
        jsonb payload
        text status "PENDING, DONE, FAILED"
        timestamptz available_at
        int attempts
    }
    REFERENCE_RATE {
        uuid id PK
        text modality "CONSUMO_ORDINARIO, MICROCREDITO ..."
        numeric ibc_percent_ea "interés bancario corriente"
        numeric usury_percent_ea "límite de usura"
        date valid_from
        date valid_to
        text source_reference
    }
    WEBHOOK_ENDPOINT {
        uuid id PK
        uuid company_id FK
        text url
        text secret_hash
        text_array event_types
        bool is_active
    }
    WEBHOOK_DELIVERY {
        uuid id PK
        uuid endpoint_id FK
        uuid event_id FK
        int attempt
        int response_status
        timestamptz next_attempt_at
    }
```

Tablas transversales sin diagrama: `audit.audit_log`, `jobs.idempotency_key` (clave, hash del cuerpo,
respuesta, expiración), `doc.template_ref` (qué plantilla de Asia-POP usa cada tipo de documento por
empresa), `files.stored_file` (objeto en almacenamiento, hash SHA-256, tipo, tamaño).

## 3. Invariantes y cómo se imponen

| ID | Invariante | Regla | Se impone en |
|---|---|---|---|
| INV-01 | Todo comprobante cuadra: Σ `debit` = Σ `credit` | R-CON-001 | Dominio **y** *constraint trigger* diferido en `acc.journal_line` |
| INV-02 | Una línea tiene débito **o** crédito, positivo | R-CON-002 | `CHECK ((debit > 0) <> (credit > 0))` y `CHECK (debit >= 0 AND credit >= 0)` |
| INV-03 | Solo se contabiliza en cuentas auxiliares activas | R-CON-003 | FK + *trigger* que verifica `allows_posting` |
| INV-04 | No se contabiliza en períodos cerrados | R-CON-004 | *Trigger* en `journal_entry` contra `fiscal_period.status` |
| INV-05 | Los comprobantes son inmutables | R-CON-005 | *Trigger* que rechaza `UPDATE`/`DELETE` en `journal_entry` y `journal_line` (salvo el campo `reversed_by`, solo hacia adelante) |
| INV-06 | Consecutivos sin saltos ni duplicados | R-CON-006, R-FE-004 | `UNIQUE (company_id, voucher_type_id, number)` + asignación con `SELECT … FOR UPDATE` en la misma transacción |
| INV-07 | El movimiento de stock es inmutable; la corrección es un movimiento inverso | R-INV-004 | *Trigger* análogo a INV-05 en `stock_movement` |
| INV-08 | No hay stock negativo salvo bodega que lo permita | R-INV-007 | `CHECK (on_hand >= 0)` condicional vía *trigger* sobre `stock_balance` |
| INV-09 | Un documento aceptado por la DIAN no se modifica; se corrige con nota crédito/débito | R-FE-009 | Máquina de estados en dominio + *trigger* sobre `sales_document` |
| INV-10 | `Σ journal_line` por documento fuente coincide con los totales del documento | R-CON-007 | Prueba de integridad periódica (job de conciliación interna) |
| INV-11 | Aislamiento por empresa | S-01 | RLS en todas las tablas de negocio |

### 3.1 Intención de los *triggers* críticos (ilustrativa, no es el DDL final)

```sql
-- INV-01: el cuadre se valida al confirmar la transacción, no fila por fila
CREATE CONSTRAINT TRIGGER trg_entry_balanced
AFTER INSERT OR UPDATE ON acc.journal_line
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION acc.assert_entry_balanced();
-- la función suma debit y credit del entry_id afectado y levanta excepción si difieren

-- INV-05: inmutabilidad
CREATE TRIGGER trg_entry_immutable
BEFORE UPDATE OR DELETE ON acc.journal_entry
FOR EACH ROW EXECUTE FUNCTION acc.reject_mutation();
```

## 4. Concurrencia

| Situación | Estrategia |
|---|---|
| Asignar consecutivo (comprobante, factura) | Fila de contador bloqueada con `SELECT … FOR UPDATE` dentro de la transacción de emisión; si la transacción falla, el número **no** se consume |
| Descontar stock | Bloqueo de la fila de `stock_balance` (y de `item_cost` para el promedio) en orden determinista `(item_id, warehouse_id, lot_id)` para evitar *deadlocks* |
| Doble envío del mismo `POST` | `Idempotency-Key` (§7.4 de `01-…`) |
| Edición simultánea de maestros | Bloqueo optimista con `version` |
| Nivel de aislamiento | `READ COMMITTED` por defecto + bloqueos explícitos; `SERIALIZABLE` solo para cierre de período |

## 5. Índices y rendimiento (puntos de partida)

- `journal_line (company_id, account_id, entry_id)` y `(company_id, party_id, account_id)` para libro mayor
  y cartera por tercero.
- `journal_entry (company_id, accounting_date)` para libros y balances por rango.
- `stock_movement (company_id, item_id, warehouse_id, movement_date, id)` para kardex.
- `sales_document (company_id, doc_type, prefix, number)` único; `(company_id, customer_id, status)`.
- Búsqueda global: extensiones `pg_trgm` y `unaccent`, índices GIN sobre nombre/NIT/número.
- **Particionamiento** por rango de fecha de `journal_line` y `stock_movement` cuando superen decenas de
  millones de filas; se decide por métricas, no desde el inicio.
- Saldos del balance de prueba: calcular desde `journal_line` con vista materializada por período cerrado;
  los períodos cerrados no cambian, así que su balance se puede congelar.

## 6. Datos de referencia que se cargan como semilla (sin copiar software de terceros)

| Catálogo | Fuente |
|---|---|
| Tipos de documento de identidad, departamentos y municipios (DIVIPOLA) | DANE / tablas de la DIAN |
| Códigos de impuestos, unidades de medida, formas y medios de pago, responsabilidades fiscales | Anexo Técnico de Factura Electrónica (tablas de códigos) |
| Códigos CIIU (actividades económicas) | DIAN / DANE |
| Plan de cuentas inicial | PUC de referencia **revisado por contador** (ver `02-…/01-…`) |
| UVT por año | Resoluciones DIAN (2026 = $52.374, Resolución 000238 de 2025) |

Las tablas oficiales de la DIAN cambian con las versiones del Anexo: se versionan en `docs/` como
referencia y se cargan por migración de datos con fecha de vigencia.
