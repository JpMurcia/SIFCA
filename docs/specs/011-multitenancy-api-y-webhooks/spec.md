# Feature Specification: Aislamiento por tenant, API Keys, idempotencia y webhooks

**Feature Branch**: `011-multitenancy-api-y-webhooks`

**Created**: 2026-10-14

**Status**: Draft

**Input**: User description: "SaaS multiempresa con aislamiento por tenant_id en PostgreSQL (esquema compartido con discriminador y RLS), contratos OpenAPI limpios, API Keys con alcances, idempotencia y webhooks estándar firmados para que cualquier motor externo consuma datos."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Cada empresa ve solo sus datos (Priority: P1)

Un usuario o integración de una empresa solo puede leer y escribir los datos de su empresa, aunque comparta la
base de datos con otras; el aislamiento no depende únicamente del código de la aplicación.

**Why this priority**: una fuga entre empresas es un incidente de seguridad y de confidencialidad fiscal.

**Independent Test**: con dos empresas se intenta leer y escribir cruzado en cada tabla de negocio.

**Acceptance Scenarios**:

1. **Dado** dos empresas, **Cuando** la empresa A consulta, **Entonces** no ve ningún dato de la empresa B.
2. **Dado** una tabla nueva de negocio sin aislamiento, **Entonces** la verificación del CI falla.

---

### User Story 2 - Integrar sistemas con API Keys y alcances mínimos (Priority: P1)

El administrador crea API Keys con alcances mínimos para sistemas externos; cada llave pertenece a una sola
empresa, se muestra una vez, puede rotarse y registra su último uso.

**Why this priority**: es la puerta de entrada de cualquier motor externo.

**Independent Test**: una llave de solo lectura de catálogo no puede emitir facturas.

**Acceptance Scenarios**:

1. **Dado** una llave con el alcance de lectura de catálogo, **Cuando** intenta emitir una factura, **Entonces** se rechaza.

---

### User Story 3 - Webhooks firmados e idempotencia (Priority: P2)

Los sistemas externos se suscriben a eventos firmados, con entrega al menos una vez, reintentos y registro; las
operaciones que crean dinero o documentos aceptan clave de idempotencia.

**Why this priority**: permite integrar sin acoplar y sin duplicar operaciones.

**Independent Test**: se entrega un evento, se simula una falla y se verifica reintento, firma y deduplicación.

**Acceptance Scenarios**:

1. **Dado** una suscripción, **Cuando** ocurre un evento, **Entonces** se entrega firmado y, si falla, se reintenta.

---

### Edge Cases

- Llave revocada o vencida.
- Webhook hacia una dirección privada o de *loopback* (SSRF).
- Cuerpo con campos desconocidos, importes negativos o con demasiados decimales.
- Reutilizar la misma clave de idempotencia con otro cuerpo.
- Rotación de secreto de webhook con dos secretos válidos.
- Un motor externo caído durante la facturación.
- Cambio incompatible del contrato de la API.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Toda tabla de negocio MUST tener `tenant_id`, RLS habilitada y forzada, y cada transacción MUST fijar el tenant antes de consultar. *(P-IV, ADR-0002)*
- **FR-002**: El rol de base de datos de la aplicación MUST NOT ser propietario de las tablas ni tener `BYPASSRLS`. *(P-IV, INV-11)*
- **FR-003**: Toda tabla nueva de negocio MUST venir con una prueba de aislamiento entre tenants; el CI MUST fallar si falta `tenant_id` o RLS. *(P-IV)*
- **FR-004**: Las API Keys MUST pertenecer a un solo tenant, tener alcances mínimos, mostrarse una sola vez, guardarse solo como *hash*, poder rotarse y registrar su último uso. *(P-IX)*
- **FR-005**: Una API Key MUST NOT acceder a recursos de otro tenant ni a operaciones fuera de sus alcances. *(P-IV, P-IX)*
- **FR-006**: Las operaciones que crean dinero, stock o documentos fiscales MUST aceptar `Idempotency-Key`; misma clave y otro cuerpo MUST rechazarse. *(P-III)*
- **FR-007**: Los webhooks MUST ser firmados, con entrega al menos una vez, reintentos exponenciales, registro y reenvío, y bloquear destinos privados. *(P-IX)*
- **FR-008**: Todo cuerpo de entrada MUST validarse con esquemas estrictos: campos desconocidos, negativos y decimales de más se rechazan. *(P-V)*
- **FR-009**: Los importes y cantidades de la API MUST viajar como cadenas decimales. *(P-VI)*
- **FR-010**: El OpenAPI MUST derivarse de los esquemas de `packages/contracts` y el CI MUST detectar cambios incompatibles. *(P-V, P-IX)*
- **FR-011**: El núcleo MUST seguir operando (facturación, inventario, contabilidad) aunque cualquier motor externo integrado esté caído. *(P-IX, ADR-0008)*

### Key Entities *(include if feature involves data)*

- **Tenant (empresa)**: unidad de aislamiento con sus datos fiscales.
- **API Key**: credencial de integración con prefijo, *hash*, alcances, vencimiento y último uso.
- **Suscripción de webhook**: URL, eventos, secreto y estado.
- **Entrega de webhook**: intento con respuesta, reintentos y siguiente intento.
- **Clave de idempotencia**: clave, huella del cuerpo y respuesta guardada.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: En 100 % de las tablas de negocio, una consulta con el tenant A devuelve 0 filas del tenant B.
- **SC-002**: Ninguna API Key puede ejecutar una operación fuera de sus alcances ni acceder a otro tenant.
- **SC-003**: Los eventos se entregan al menos una vez y un receptor que deduplique por identificador no procesa duplicados.
- **SC-004**: Con el motor externo caído, la emisión de facturas mantiene su desempeño normal.

## Assumptions

- Un tenant equivale a una empresa (un NIT) en el MVP.
- El *pooler* de conexiones elegido conserva la variable de sesión dentro de la transacción (se verifica en el spike S-PRISMA).
- Los alcances disponibles son los definidos en el contrato de la API.

## Trazabilidad de reglas

Esta especificación se rige por los principios de la [constitución](../../constitution.md) (IV, V, VI, IX) y por
los ADR-0002, ADR-0003 y ADR-0008, más el invariante INV-11 del [modelo de datos](../../01-arquitectura/02-modelo-de-datos-preliminar.md).
La relación se genera en [`../traceability-matrix.md`](../traceability-matrix.md). Escenarios ejecutables:
[`acceptance/tenancy-api-webhooks.feature`](acceptance/tenancy-api-webhooks.feature). Contrato:
[`04-contrato-api-y-swagger.md`](../../01-arquitectura/04-contrato-api-y-swagger.md).

## Verificación de constitución

| Gate | Cumplimiento en esta spec |
|---|---|
| G-07 | Es la spec que define y prueba el aislamiento por tenant |
| G-08 | Esquemas estrictos de `packages/contracts` en cada borde |
| G-12 | Los motores externos solo consumen la API y los webhooks |
