# Normativa y catálogo de reglas

Esta carpeta convierte la normatividad colombiana pública en **reglas atómicas, numeradas y comprobables**.
Es la fuente que alimenta (1) los motores de dominio (`accounting`, `tax`, `inventory`, `einvoicing`),
(2) las pruebas automatizadas y (3) la revisión del contador.

## Contenido

| Archivo | Tema | Prefijo de reglas |
|---|---|---|
| [`01-contabilidad-partida-doble-y-puc.md`](01-contabilidad-partida-doble-y-puc.md) | Partida doble, PUC, comprobantes, períodos, plantillas de contabilización | `R-CON` |
| [`02-impuestos-y-retenciones.md`](02-impuestos-y-retenciones.md) | IVA, INC, ReteFuente, ReteIVA, ReteICA, UVT, vigencias | `R-IMP` |
| [`03-facturacion-electronica-dian.md`](03-facturacion-electronica-dian.md) | Anexo Técnico UBL 2.1, CUFE, QR, numeración, notas, POS | `R-FE` |
| [`04-inventarios-y-valoracion.md`](04-inventarios-y-valoracion.md) | Kardex, promedio ponderado, lotes, traslados | `R-INV` |
| [`05-cartera-y-prestamos.md`](05-cartera-y-prestamos.md) | Cartera, CxP, recibos, mora, amortización | `R-CAR`, `R-PRE` |
| [`06-referencia-api-alegra.md`](06-referencia-api-alegra.md) | Cómo modela Alegra sus recursos y cómo se mapea a SIFCA | `R-API` |

## Cómo se escribe una regla

```text
R-XXX-nnn · Enunciado en una frase comprobable
  Fuente:   norma y artículo (o «convención de la industria»)
  Estado:   ✅ / ⚠️ / 🔶   (ver README principal)
  Ejemplo:  caso numérico mínimo
  Prueba:   cómo se verifica (invariante, vector, propiedad)
```

## Principios para trabajar con la norma

1. **Una regla, una afirmación.** Si una regla tiene un «y», probablemente son dos.
2. **Las cifras no van en el código.** UVT, tarifas, bases mínimas y topes son filas con vigencia
   (`valid_from`/`valid_to`) en `tax.tax_rate` y `tax.uvt_value` (ADR-0005).
3. **Se documentan las excepciones, no solo la regla general.** Ejemplo: la base mínima de retención se
   evalúa por operación, y existen tratamientos distintos para declarantes y no declarantes.
4. **Lo desconocido se declara.** Si una regla no pudo contrastarse con el texto oficial queda marcada 🔶 y
   en la lista de pendientes de verificación (§ siguiente).
5. **Todo cambio normativo es un cambio de datos + una prueba nueva**, con la fecha desde la que rige.

## Registro de verificación (13-oct-2026)

Al redactar esta documentación se intentó contrastar los datos críticos. Resultado:

| Dato | Resultado | Estado | Fuente consultada |
|---|---|---|---|
| UVT 2026 = **$52.374** | Coinciden varias fuentes; fijada por la Resolución DIAN 000238 de 15-dic-2025 | ✅ | [Normograma DIAN – Res. 0238/2025](https://normograma.dian.gov.co/dian//compilacion/docs/resolucion_dian_0238_2025.htm) (referenciada en resultados de búsqueda; el sitio no fue accesible desde el entorno de redacción), [Bloomberg Línea](https://www.bloomberglinea.com/latinoamerica/colombia/valor-de-la-uvt-2026-y-lo-que-subio-con-el-nuevo-monto/) |
| UVT 2025 = $49.799 y UVT 2024 = $47.065 | De memoria; el valor 2025 aparece citado por una fuente secundaria | 🔶 | — |
| Decreto 572 de 2025 modificó bases/tarifas de retención; **artículos 2 a 8 suspendidos provisionalmente** por el Consejo de Estado (auto del 7-may-2026) | Reportado por varias fuentes concordantes (editor jurídico, boletines de firmas, prensa) | ⚠️ | [Tirant Prime](https://prime.tirant.com/co/actualidad-prime/consejo-de-estado-suspende-provisionalmente-decreto-que-modifico-tarifas-y-bases-de-retencion-en-la-fuente/), [Rioconsultores](https://rioconsultores.com/2026/05/08/suspension-del-decreto-572-de-2025-que-cambia-en-la-retencion-en-la-fuente-boletin-039), [Actualícese](https://actualicese.com/suspension-del-decreto-572-de-2025-es-obligatorio-modificar-nuevamente-las-bases-de-retencion-en-la-fuente/) |
| Tras la suspensión vuelven las bases del DUR 1625/2016 (compras 27 UVT, servicios 4 UVT) | Las cifras coinciden con lo que regía antes de 2025, pero **no se encontró texto oficial** que las confirme tras la suspensión; fuentes dan cifras distintas según si consideran la suspensión | ⚠️ | [Alegra – tabla 2026](https://blog.alegra.com/colombia/tabla-de-retencion-en-la-fuente-2026/) (muestra la tabla del Decreto 572: 10 UVT/2 UVT), [Siemprealdia](https://siemprealdia.co/colombia/impuestos/tabla-de-retencion-en-la-fuente-2026/) |
| Resolución DIAN 000165 de 1-nov-2023 desarrolla el sistema de facturación y adopta el **Anexo Técnico v1.9** de factura electrónica; crea el anexo 1.0 del documento equivalente electrónico | Confirmado por dos fuentes secundarias | ⚠️ | [INCP](https://incp.org.co/publicaciones/infoincp-publicaciones/impuestos/nacionales/2023/11/nuevas-disposiciones-sobre-el-sistema-de-facturacion-electronica/), [CIJUF](https://cijuf.org.co/node/25671) |
| ¿Existen versiones del Anexo Técnico posteriores a la 1.9? | **No verificado** | 🔶 | — |
| Fórmula del CUFE (SHA-384) y contenido del QR | No se pudo acceder al Anexo oficial; solo se encontró una guía de terceros. La fórmula de §4 de `03-…` es de memoria | 🔶 | — |
| Endpoints y campos de la API de Alegra | `developer.alegra.com` no fue accesible desde el entorno; se usó lo verificado por el proyecto Asia-POP (ver `06-…`) y documentación de terceros | 🔶 / ⚠️ | — |
| Códigos de plan de cuentas (PUC) a nivel de 4 dígitos | De memoria del PUC clásico | 🔶 | — |

> **Acción previa a la Fase 2:** (1) descargar a este repositorio, como referencia local versionada, el
> Anexo Técnico vigente, la resolución de numeración y la tabla de retención oficial; (2) el contador marca
> ✅ lo que corresponda; (3) se cargan los vectores de prueba oficiales del Anexo como fixtures.
