# Hoja de validación del contador — spec 001 (comprobantes inmutables)

**Para quién:** el contador que valida las reglas R-CON antes de que el feature se despliegue a producción.
**Por qué:** la constitución (VII, gate G-10) prohíbe que una regla 🔶/⚠️ llegue a producción sin ✅ de un contador.
El código está construido y probado, pero **ninguna de estas reglas está validada todavía**: el *job* `release-gate`
de CI falla al etiquetar una versión mientras falte alguna (`node scripts/check-rules-verified.mjs docs/specs/001-…`).

## Cómo validar

1. Revisa cada regla del catálogo ([`01-contabilidad-partida-doble-y-puc.md`](../../02-normativa-y-reglas/01-contabilidad-partida-doble-y-puc.md))
   contra la tabla de abajo (qué hace el sistema y con qué prueba se demuestra).
2. Responde las preguntas de la última sección.
3. Para cada regla que apruebes, añade **dentro de su sección** del catálogo:
   `**Validación del contador:** ✅ AAAA-MM-DD · Nombre Apellido (T.P. nnnn)`
4. Si no apruebas una regla, deja la observación en la pregunta correspondiente: se corrige antes de liberar.

## Qué implementa el sistema, por regla

| Regla | Qué hace el sistema | Dónde se demuestra |
|---|---|---|
| R-CON-001 Todo comprobante cuadra | Rechaza Σ débitos ≠ Σ créditos con 2 decimales exactos; además la base lo valida al confirmar la transacción | Escenarios [001-02], [001-11]; propiedad con generación aleatoria de comprobantes; pruebas de la base |
| R-CON-002 Un solo lado, positivo | Rechaza líneas con ambos lados, en cero o negativas | [001-03]; restricciones `ck_line_*` |
| R-CON-003 Mínimo dos líneas y solo auxiliares activas | Rechaza menos de 2 líneas y cuentas acumuladoras o inactivas | [001-01], [001-04]; prueba de la base |
| R-CON-004 Solo en períodos abiertos | Rechaza fechas en períodos cerrados o sin período; reabrir exige permiso, motivo y bitácora | [001-05], [001-14]; prueba de carrera cierre vs. contabilización |
| R-CON-005 Inmutabilidad y reversión | No existe edición ni borrado (API 405, privilegios y triggers); se corrige con un contraasiento que referencia al original | [001-06], [001-07] |
| R-CON-006 Consecutivo sin saltos ni duplicados | Un contador por tipo (y por año si así se configura), dentro de la misma transacción: si falla, no se consume | [001-08]; 1.000 contabilizaciones simultáneas → 1…1000 |
| R-CON-007 Documento fuente | Todo comprobante no manual exige tipo e id del documento fuente | Pruebas del caso de uso y de la base |
| R-CON-008 Tercero / centro de costo | Rechaza líneas sin tercero o sin centro de costo si la cuenta lo exige | [001-09] |
| R-CON-009 Decimales y redondeo | Aritmética decimal exacta; mitad hacia arriba **por línea**; el total es la suma de líneas ya redondeadas | [001-10] (3 × 333,33 con IVA 19 % ⇒ 63,33 por línea y 189,99 en total) |
| R-CON-010 Libros oficiales | Diario, mayor y balance de prueba reproducibles (mismos datos y rango ⇒ mismo resultado) | [001-16] |
| R-CON-011 Cierre mensual | Exige balance cuadrado y ausencia de borradores; deja bitácora | [001-12] |
| R-CON-012 Cierre anual | Genera **un** comprobante que cancela las clases 4–7 contra «Ganancias y pérdidas» y traslada el resultado a la cuenta de utilidad/pérdida del ejercicio; es reversible | [001-15] |
| R-CON-013 Naturaleza de las cuentas | El saldo se presenta en el lado donde queda positivo; si es contrario a la naturaleza se marca (`contraNature`), no se oculta | [001-11] |
| R-CON-014 Fecha, hora y zona | La fecha contable no depende de la zona; los instantes van en UTC y se convierten a `America/Bogota` | [001-13] |

## Preguntas para el contador

| # | Regla | Pregunta | Qué hace hoy el sistema |
|---|---|---|---|
| 1 | R-CON-005 | ¿Con qué fecha debe quedar el comprobante de reversión? El texto del catálogo dice «en el período abierto actual salvo que el original sea del mismo período abierto» y es ambiguo | Si no se indica fecha: **la de hoy** (hora de Colombia). Se puede indicar otra fecha; debe caer en un período abierto |
| 2 | R-CON-005 | ¿Se admite reversar un comprobante generado automáticamente por otro módulo (venta, recibo), o solo anular el documento fuente? | Se admite con el permiso `accounting.entry.reverse`; las specs de ventas/cartera definirán las anulaciones por documento |
| 3 | R-CON-003 | Si una cuenta se desactiva después de usarse, ¿se puede reversar un comprobante antiguo que la use? | **No**: el contraasiento exige cuentas activas; habría que reactivar la cuenta |
| 4 | R-CON-009 | ¿Qué tolerancia de redondeo acepta la DIAN entre los totales del documento y la suma de líneas? | Ninguna: el total es exactamente la suma de líneas redondeadas por línea |
| 5 | R-CON-012 | ¿Qué cuentas son «Ganancias y pérdidas» y «Utilidad o pérdida del ejercicio» (grupos 59 y 36)? | Se parametrizan por empresa en la solicitud de cierre; el sistema no las supone |
| 6 | R-CON-012 | ¿El cierre debe ser **uno** o **dos** comprobantes (cancelación a G y P, y traslado)? | Uno solo, con ambos pasos; la cuenta de G y P queda en cero |
| 7 | R-CON-003 | Los escenarios usan cuentas de **4 dígitos** como cuentas de movimiento; el PUC clásico las considera acumuladoras. ¿Qué nivel de movimiento exige su política? | El plan de cuentas lo define cada empresa (`allows_posting`); el sistema solo exige que la cuenta sea de movimiento |
| 8 | R-CON-011 | Además de balance cuadrado y sin borradores, el cierre debe pasar las conciliaciones internas (INV-10, INV-13, INV-14) | El punto de extensión existe (`PeriodCloseCheck`); esas comprobaciones llegan con las specs de inventario y cartera |
| 9 | R-CON-006 | ¿La numeración reinicia cada año para algún tipo de comprobante? | Es configurable por tipo (`numbering_scope = YEAR`) |
