# Feature Specification: Configuración por empresa

**Feature Branch**: `013-configuracion-empresa`

**Created**: 2026-10-17

**Status**: Draft

**Input**: User description: "SPEC-013 de la hoja de ruta (`docs/roadmap-specs.md` §2.3, Ola 1): datos de la empresa
(NIT con DV, régimen, responsabilidades, logo); parámetros tipados con vigencia, motivo e historial; numeración de
documentos por tipo y prefijo con consecutivos sin huecos; años fiscales; plantillas PDF. Maquetas: empresa y
multiempresa 3q/3r, configuración por empresa 5o/5p, plantillas PDF 7w/7x. Diseño:
`04-diseno-ux/06-integraciones-migracion-y-configuracion.md` §5 y §6."

## Contexto

Lo que cambia por empresa, por normativa o por negocio es un **dato con vigencia y bitácora**, no código (principio de
diseño IG-1 y constitución VII). Hoy esos valores están dispersos: el nombre y el NIT del back-office salen de variables
de entorno (spec 016), los tipos de comprobante y sus consecutivos los crea una semilla (spec 001) y cada spec futura
necesita parámetros (umbral de alerta de cupo, días de mora para bloquear, cortes ABC…). Esta spec entrega **un único
mecanismo de configuración** y las pantallas para administrarlo.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Registrar los datos de la empresa (Priority: P1)

La administradora completa razón social, NIT con dígito de verificación, régimen, responsabilidades fiscales,
dirección, municipio, correo de facturación y logo. Esos datos aparecen en la barra superior, en los documentos y en los
PDF.

**Why this priority**: son la identidad fiscal de todo documento; sin ellos no hay factura (spec 002) ni PDF.

**Independent Test**: editar los datos con un NIT válido y con uno inválido; ver el cambio en la barra superior.

**Acceptance Scenarios**:

1. **Dado** la empresa, **Cuando** la administradora guarda razón social «Comercializadora Andina S.A.S.» y NIT
   `900123456` con DV `8`, **Entonces** se guardan y la barra superior muestra «NIT 900.123.456-8».
2. **Dado** el NIT `900123456` con DV `7`, **Cuando** guarda, **Entonces** recibe «El dígito de verificación debe ser
   8» en el campo DV y no se guarda nada.
3. **Dado** un cambio de razón social, **Cuando** se guarda, **Entonces** el historial muestra valor anterior, nuevo,
   autor, motivo e instante, y los documentos ya emitidos conservan los datos con los que se emitieron.

---

### User Story 2 - Parámetros con vigencia, motivo e historial (Priority: P1)

El contador cambia un parámetro (p. ej. días de mora para bloquear despachos de 30 a 45) con fecha de vigencia y motivo.
El sistema aplica el valor vigente según la fecha de cada operación, nunca reescribe el pasado y muestra el historial.

**Why this priority**: todas las specs de las olas 3 a 6 leen parámetros; deben resolverse igual en todas partes.

**Independent Test**: programar un nuevo valor con vigencia futura y consultar el valor vigente antes y después.

**Acceptance Scenarios**:

1. **Dado** `credit.blockDaysOverdue = 30` vigente desde 01/01/2026, **Cuando** el contador programa `45` desde
   01/11/2026 con motivo, **Entonces** la consulta a 31/10/2026 devuelve 30 y a 01/11/2026 devuelve 45.
2. **Dado** un valor fuera de su rango (p. ej. `credit.alertThresholdPct = 120`), **Cuando** se guarda,
   **Entonces** se rechaza indicando el rango permitido (1–100).
3. **Dado** un cambio sin motivo en un parámetro sensible, **Cuando** se guarda, **Entonces** se rechaza pidiendo el
   motivo (5–500 caracteres).
4. **Dado** un valor que ya empezó a regir, **Cuando** alguien intenta modificar su fecha de inicio o su valor,
   **Entonces** se impide; solo se puede cerrar su vigencia programando uno nuevo.

---

### User Story 3 - Numeración de documentos sin huecos (Priority: P1)

El contador define, por tipo de documento, el prefijo y el número inicial. El sistema asigna consecutivos sin saltos ni
duplicados aunque muchos usuarios emitan a la vez.

**Why this priority**: es requisito contable y fiscal (R-CON-006) para comprobantes y, luego, facturas.

**Independent Test**: configurar un tipo, emitir en paralelo y verificar la secuencia.

**Acceptance Scenarios**:

1. **Dado** el tipo «AJ» sin uso, **Cuando** el contador fija prefijo «AJ» y número inicial 1, **Entonces** el
   siguiente número orientativo es «AJ-1».
2. **Dado** 50 solicitudes simultáneas de número para «AJ» en 2026, **Entonces** se asignan los números 1 a 50 sin
   huecos ni repetidos.
3. **Dado** un tipo que ya asignó números, **Cuando** se intenta cambiar su número inicial o su prefijo, **Entonces**
   se impide con «Este tipo ya tiene documentos numerados; crea un tipo nuevo».

---

### User Story 4 - Plantillas de documentos PDF (Priority: P2)

La administradora elige el color de acento, muestra u oculta el logo, la firma y el aviso de cartera, y ve una vista
previa por tipo de documento (factura, cotización, recibo de caja, orden de compra, comprobante contable).

**Why this priority**: los PDF son lo que ve el cliente; la maqueta `7w` lo define, pero la emisión real llega con
specs posteriores.

**Independent Test**: cambiar la plantilla y ver la vista previa con datos de ejemplo.

**Acceptance Scenarios**:

1. **Dado** la plantilla de «Comprobante contable», **Cuando** se oculta el logo y se cambia el color, **Entonces** la
   vista previa refleja ambos cambios y muestra «Sumas iguales» al pie.
2. **Dado** un color de acento con contraste menor a 4,5:1 sobre blanco, **Cuando** se guarda, **Entonces** se
   rechaza indicando el contraste mínimo.
3. **Dado** un logo de más de 1 MB o en un formato no admitido, **Cuando** se sube, **Entonces** se rechaza con la
   causa (formatos PNG, JPG o SVG).

---

### User Story 5 - Ver y cambiar de empresa (Priority: P3)

Quien pertenece a varias empresas ve en Configuración › Empresa la lista de sus empresas con su NIT y el período abierto,
y cambia de una a otra (la mecánica de cambio es de la spec 012).

**Why this priority**: complementa la spec 012 con la vista de la maqueta `3q`.

**Independent Test**: usuario con dos empresas abre la lista y cambia.

**Acceptance Scenarios**:

1. **Dado** un usuario con dos empresas, **Cuando** abre la lista, **Entonces** ve ambas con razón social, NIT y
   período de trabajo, y la activa marcada.

### Edge Cases

- **Dos cambios del mismo parámetro con la misma fecha de vigencia**: el segundo se rechaza con `CONFLICT`; se debe
  anular el programado (si aún no rige) o programar otra fecha.
- **Anular un valor programado** que aún no rige: permitido con motivo; queda en el historial como anulado.
- **Fecha de vigencia en el pasado** para un valor nuevo: se rechaza; el pasado no se reescribe.
- **Parámetro desconocido** enviado por la API: `VALIDATION_FAILED`.
- **Tipo de documento con año nuevo**: la numeración reinicia o continúa según la política del tipo (anual o
  continua), elegida al crearlo e inmutable después.
- **Logo borrado** cuando hay documentos emitidos: los PDF ya generados conservan su logo; los nuevos salen sin él.
- **Cambio de NIT**: solo con permiso específico, motivo y advertencia de impacto fiscal; los documentos emitidos
  conservan el NIT anterior.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: La empresa MUST tener razón social, nombre comercial, NIT con DV validado con el algoritmo de la DIAN, tipo de persona, régimen de IVA, responsabilidades fiscales, dirección, municipio, teléfono, correo de facturación y logo *(R-FE-012)*.
- **FR-002**: Cambiar el NIT MUST exigir el permiso `company.nit.change`, motivo y confirmación; los documentos ya emitidos MUST conservar los datos con los que se emitieron *(R-FE-012, P-I)*.
- **FR-003**: El sistema MUST ofrecer un **registro único de parámetros** tipados (entero, decimal, porcentaje, booleano, lista, referencia) con rango o valores permitidos, unidad, valor por defecto y si exigen motivo *(R-CON-009, ADR-0005)*.
- **FR-004**: Cada valor de parámetro MUST tener fecha de inicio de vigencia; el valor aplicable a una operación MUST ser el vigente en la fecha de esa operación, de forma determinista *(ADR-0005, R-CON-014)*.
- **FR-005**: Un valor que ya empezó a regir MUST ser inmutable; los cambios se hacen programando un valor nuevo con vigencia desde hoy o una fecha futura; las fechas pasadas MUST rechazarse *(P-I, ADR-0005)*.
- **FR-006**: Cada cambio de datos de la empresa, parámetro, numeración o plantilla MUST registrar autor, valor anterior, valor nuevo, motivo (obligatorio en los marcados como sensibles, 5–500 caracteres) e instante, en un historial de solo lectura *(P-I)*.
- **FR-007**: Las specs MUST registrar sus parámetros en el registro único; esta spec siembra el catálogo inicial de la tabla de Assumptions *(ADR-0005, P-VII)*.
- **FR-008**: Cada tipo de documento MUST tener código, nombre, prefijo, número inicial, política de reinicio (anual o continua) y estado; prefijo, número inicial y política MUST quedar bloqueados tras asignar el primer número *(R-CON-006)*.
- **FR-009**: La asignación de consecutivos MUST ser sin saltos ni duplicados bajo concurrencia, dentro de la misma transacción del documento, de modo que si la transacción falla el número no se consume *(R-CON-006, P-III)*.
- **FR-010**: Las plantillas PDF MUST permitir por tipo de documento: mostrar logo, firma y aviso de cartera; color de acento con contraste ≥ 4,5:1 sobre blanco; y vista previa con datos de ejemplo *(ADR-0008)*.
- **FR-011**: El logo MUST aceptar PNG, JPG o SVG de hasta 1 MB; un SVG MUST sanearse antes de guardarse (sin *scripts* ni referencias externas) *(ADR-0008)*.
- **FR-012**: La barra superior del back-office y `/me` MUST tomar nombre y NIT de la configuración de la empresa, reemplazando las variables de entorno de desarrollo de la spec 016 *(P-V)*.
- **FR-013**: Toda la configuración MUST estar aislada por empresa y cada operación MUST exigir su permiso (`company.read`, `company.manage`, `config.parameter.manage`, `config.numbering.manage`, `config.template.manage`) *(P-IV, ADR-0002)*.
- **FR-014**: Las pantallas MUST seguir el patrón único de configuración: lista a la izquierda, formulario a la derecha, «vigencia desde», motivo en cambios sensibles, pestaña Historial y aviso «Este cambio no afecta documentos ya contabilizados» *(ADR-0001)*.

### Key Entities *(include if feature involves data)*

- **Empresa**: datos fiscales y de contacto, logo; un registro por *tenant*.
- **Definición de parámetro**: clave (`modulo.nombre`), tipo, rango o valores, unidad, valor por defecto, sensible.
- **Valor de parámetro**: clave, valor, vigente desde, estado (programado, vigente, histórico, anulado), autor, motivo.
- **Tipo de documento**: código, nombre, prefijo, número inicial, política de reinicio, módulo dueño, estado.
- **Secuencia**: tipo, año (si es anual), último número asignado.
- **Plantilla**: tipo de documento, opciones de visualización, color de acento.
- **Cambio de configuración**: entidad, clave, anterior, nuevo, motivo, autor, instante.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 1.000 asignaciones simultáneas de consecutivo para un mismo tipo y año producen 1.000 números distintos y
  contiguos.
- **SC-002**: El 100 % de las consultas de «valor vigente a la fecha D» de la batería de pruebas coincide con el valor
  esperado, incluidas fechas en el borde del cambio.
- **SC-003**: El 100 % de los cambios de configuración aparece en el historial con autor y, cuando aplica, motivo.
- **SC-004**: Un administrador configura los datos de la empresa y el logo en menos de 5 minutos.
- **SC-005**: Ningún documento ya emitido cambia al modificar datos de la empresa, plantillas o parámetros.

## Assumptions

- **Catálogo inicial de parámetros** (las specs dueñas los consumen):

  | Clave | Tipo | Defecto | Rango | Spec |
  |---|---|---|---|---|
  | `credit.alertThresholdPct` | porcentaje | 80 | 1–100 | 022 |
  | `credit.blockDaysOverdue` | entero (días) | 30 | 0–365 | 022 |
  | `credit.blockMinAmount` | importe | 0 | ≥ 0 | 022 |
  | `inventory.abc.thresholdA` | porcentaje | 80 | 1–99 | 007 |
  | `inventory.abc.thresholdB` | porcentaje | 95 | > A y ≤ 99 | 007 |
  | `inventory.countOverdueBlocksClose` | booleano | falso | — | 007 |
  | `accounting.reopen.minReasonLength` | entero | 5 | 5–500 | 001 |
  | `sales.defaultPaymentTermDays` | entero (días) | 30 | 0–365 | 020/022 |

- **Mapeo concepto → cuenta** (cuentas por defecto: ventas, IVA, costo, caja…) se hace en la spec 018, que es la que
  administra el plan de cuentas; esta spec no lo incluye.
- **Rangos de numeración de la DIAN** (resolución, vigencia, desde/hasta) son de la spec 009; aquí solo se numeran los
  documentos internos y se deja el punto de extensión.
- **Años fiscales y períodos** ya existen en la spec 001 (creación y cierre); esta spec no los duplica.
- **Alta de empresas nuevas**: operación de plataforma fuera de alcance (igual que en la spec 017).
- **Zona horaria de presentación**: fija en `America/Bogota` (S-06); no es configurable en el MVP.
- **Plantillas**: aquí se configuran y se previsualizan; el render real de cada documento lo hace la spec que emite el
  documento mediante el puerto `DocumentRenderer`.

## Trazabilidad de reglas

Esta especificación se rige por R-CON-006 (consecutivos), R-CON-009 (decimales), R-CON-014 (fechas) y R-FE-012
(identificación tributaria), por los principios I, III, IV, V y VII de la [constitución](../../constitution.md) y por
los ADR-0001, ADR-0002, ADR-0005 y ADR-0008. La relación se genera en
[`../traceability-matrix.md`](../traceability-matrix.md). Escenarios ejecutables:
[`acceptance/configuracion-empresa.feature`](acceptance/configuracion-empresa.feature). Diseño:
[`06-integraciones-migracion-y-configuracion.md`](../../04-diseno-ux/06-integraciones-migracion-y-configuracion.md)
§5–§6; maquetas `3q/3r`, `5o/5p`, `7w/7x`. Depende de la spec 017.

## Verificación de constitución

| Gate | Cumplimiento en esta spec |
|---|---|
| G-01 a G-03 | La resolución de vigencias y la política de consecutivos son dominio puro; el reloj es un puerto |
| G-04 | El consecutivo se asigna dentro de la transacción del documento que lo usa |
| G-06 | Valores vigentes e historial no se actualizan ni se borran; se programan valores nuevos |
| G-07 | Todas las tablas con `tenant_id`, RLS y prueba de aislamiento |
| G-08 | Entradas validadas con esquemas de `packages/contracts` |
| G-10 | Los valores por defecto de parámetros que vienen de reglas 🔶 se marcan provisionales |
| G-11 | Escenarios `[013-01]…[013-10]` etiquetados |
