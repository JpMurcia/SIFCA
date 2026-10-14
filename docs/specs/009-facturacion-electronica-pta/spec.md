# Feature Specification: Facturación electrónica mediante Proveedor Tecnológico Autorizado

**Feature Branch**: `009-facturacion-electronica-pta`

**Created**: 2026-10-14

**Status**: Draft

**Input**: User description: "Emitir facturas electrónicas con validación previa de la DIAN mediante un Proveedor Tecnológico Autorizado (PTA), desacoplado por una interfaz de servicio que permita en el futuro la facturación directa."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Transmitir y entregar una factura aceptada (Priority: P1)

Una vez emitida la factura, el sistema la envía en segundo plano al PTA, recibe la validación de la DIAN y, si
es aceptada, genera la representación gráfica con CUFE y QR, la guarda con el XML firmado y la envía al cliente.

**Why this priority**: sin factura aceptada no hay documento válido que entregar.

**Independent Test**: con un PTA simulado que acepta, se verifica el estado, los archivos guardados y el envío.

**Acceptance Scenarios**:

1. **Dado** una factura emitida, **Cuando** el PTA responde aceptada, **Entonces** queda aceptada, con CUFE y PDF, y el cliente recibe XML y PDF.
2. **Dado** una factura sin aceptar, **Entonces** no se envía nada al cliente.

---

### User Story 2 - Rechazos, errores y contingencia (Priority: P1)

Si la DIAN rechaza, el usuario ve los motivos y corrige conservando el número; si el PTA falla de forma
transitoria, el sistema reintenta sin duplicar; si hay una indisponibilidad prolongada, opera en contingencia.

**Why this priority**: la operación fiscal debe ser robusta ante fallas externas.

**Independent Test**: se simulan rechazo, error transitorio y caída prolongada del PTA.

**Acceptance Scenarios**:

1. **Dado** un rechazo, **Entonces** el estado es rechazada con motivos y se retransmite con el mismo número.
2. **Dado** un error transitorio, **Entonces** se consulta el estado antes de reenviar para no duplicar.

---

### User Story 3 - Desacople del proveedor (Priority: P2)

El dominio no conoce al proveedor: cambiar de PTA (o pasar a facturación directa) es escribir otro adaptador del
mismo puerto, sin tocar ventas ni contabilidad.

**Why this priority**: evita la dependencia de un único proveedor.

**Independent Test**: dos adaptadores simulados producen los mismos resultados de dominio.

**Acceptance Scenarios**:

1. **Dado** dos adaptadores distintos, **Entonces** los estados y eventos de dominio resultantes son idénticos.

---

### Edge Cases

- Respuesta del PTA que no cumple el esquema esperado.
- CUFE calculado por SIFCA distinto del devuelto por el PTA.
- Adquirente con NIT cuyo dígito de verificación es inválido; consumidor final.
- Rango de numeración casi agotado o vencido.
- Falla del renderizador de PDF o del correo tras la aceptación.
- Doble entrega del mismo evento de salida al worker.
- Documento aceptado que necesita corrección (nota crédito o débito).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: La emisión MUST usar el puerto `EInvoiceProvider` con operaciones de envío, consulta de estado, obtención de artefactos y resultado de validación; el primer adaptador es el de un PTA. *(R-FE-001, ADR-0003)*
- **FR-002**: Solo un documento aceptado MUST considerarse expedido y entregarse al cliente. *(R-FE-002)*
- **FR-003**: La numeración MUST provenir de un rango autorizado y vigente, consecutivo y sin saltos; el sistema MUST alertar cuando se agote o venza. *(R-FE-003, R-FE-004)*
- **FR-004**: El sistema MUST calcular el CUFE localmente y compararlo con el del PTA, alertando ante diferencias; los vectores oficiales del Anexo Técnico son prueba obligatoria. *(R-FE-005)*
- **FR-005**: La representación gráfica MUST incluir el contenido obligatorio (CUFE, QR, resolución de numeración, importes) y generarse después de la aceptación. *(R-FE-006, R-FE-007)*
- **FR-006**: Los estados MUST ser aceptada, aceptada con notificaciones, rechazada y error transitorio, con los motivos completos guardados. *(R-FE-008)*
- **FR-007**: Un documento aceptado MUST NOT modificarse; se corrige con nota crédito o débito. *(R-FE-009)*
- **FR-008**: El sistema MUST validar la identificación del adquirente, incluido el dígito de verificación del NIT y el tratamiento de consumidor final. *(R-FE-012)*
- **FR-009**: Debe existir un modo de contingencia con cola visible de documentos pendientes. *(R-FE-011)*
- **FR-010**: El XML firmado, la respuesta de la DIAN y el PDF MUST conservarse con su hash SHA-256. *(R-FE-013)*
- **FR-011**: Toda respuesta del proveedor MUST validarse con su esquema antes de usarse; una respuesta inválida no cambia el estado. *(P-V)*
- **FR-012**: Los reintentos MUST ser idempotentes: antes de reenviar se consulta el estado por referencia. *(R-FE-008)*
- **FR-013**: La transmisión, el PDF y el correo MUST ocurrir fuera de la transacción comercial, mediante *outbox*. *(P-III, ADR-0006)*

### Key Entities *(include if feature involves data)*

- **Rango de numeración**: resolución, prefijo, desde, hasta, vigencia y clave técnica.
- **Transmisión**: intento de envío con proveedor, estado, CUFE y mensajes.
- **Evento de transmisión**: respuesta recibida con fecha y código.
- **Archivo fiscal**: XML firmado, respuesta de la DIAN y PDF con hash.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 100 % de las facturas aceptadas tiene su XML, respuesta y PDF guardados con hash verificable.
- **SC-002**: Ninguna factura se entrega al cliente antes de ser aceptada.
- **SC-003**: Ante un reintento, nunca se transmiten dos documentos distintos con el mismo número.
- **SC-004**: Cambiar el adaptador del proveedor no requiere modificar ninguna prueba de dominio.

## Assumptions

- El PTA elegido ofrece ambiente de pruebas y entrega XML firmado y respuesta de la DIAN (Q-13).
- La fórmula exacta del CUFE y los códigos de las tablas se toman del Anexo Técnico vigente (🔶 hasta verificarlos).
- Si el PTA no entrega PDF, el renderizador mínimo del núcleo lo genera.

## Trazabilidad de reglas

Fuente: [`03-facturacion-electronica-dian.md`](../../02-normativa-y-reglas/03-facturacion-electronica-dian.md). La
relación regla → requisito → escenario se genera en [`../traceability-matrix.md`](../traceability-matrix.md).
Escenarios ejecutables: [`acceptance/facturacion-pta.feature`](acceptance/facturacion-pta.feature). Flujo:
[`03-procesos-y-flujos/01-…`](../../03-procesos-y-flujos/01-flujo-venta-catalogo-a-factura.md) (fase C).

## Verificación de constitución

| Gate | Cumplimiento en esta spec |
|---|---|
| G-01, G-02 | `EInvoiceProvider` es un puerto de Application; el adaptador del PTA vive en infraestructura |
| G-05 | Ninguna llamada de red al PTA ocurre dentro de la transacción comercial |
| G-08 | Las respuestas del PTA se validan con esquemas Zod en el adaptador |
| G-10 | R-FE: ⚠️/🔶 hasta contrastar con el Anexo Técnico vigente; los vectores oficiales son prueba obligatoria |
| G-12 | El PTA es reemplazable; el núcleo no conoce a ningún proveedor concreto |
