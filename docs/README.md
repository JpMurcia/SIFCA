# SIFCA — Documentación de especificaciones

**SIFCA** (Sistema Integral Fiscal y Contable Ágil) es una plataforma modular, construida desde cero, para
gestión contable, fiscal y administrativa de empresas colombianas, con una vitrina comercial pública y un
back-office ERP.

> **Estado: Fase 1 — Especificaciones.** Este repositorio todavía no contiene código de aplicación.
> Todo lo que hay aquí es documentación que servirá de fuente de verdad para implementar con
> desarrollo guiado por especificaciones (spec-driven) y asistencia de IA.

## Principio de origen

SIFCA **no** se construye a partir de ingeniería inversa de ningún software comercial. Las reglas salen de:

1. La normatividad pública colombiana (Estatuto Tributario, decretos reglamentarios, resoluciones DIAN, marco
   técnico NIIF).
2. El Anexo Técnico de Factura Electrónica de la DIAN (UBL 2.1).
3. La documentación pública de APIs de terceros (Alegra) para compatibilidad funcional.
4. Revisión de un contador público sobre cada regla antes de implementarla.

## Mapa de la documentación

| Carpeta / archivo | Contenido |
|---|---|
| [`00-alcance-supuestos-y-roadmap.md`](00-alcance-supuestos-y-roadmap.md) | Alcance, fuera de alcance, supuestos, **preguntas abiertas**, riesgos y fases |
| [`01-arquitectura/`](01-arquitectura/) | Módulos del backend NestJS, modelo de datos PostgreSQL, evaluación de librerías, contrato OpenAPI, integración con Asia-POP, ADRs |
| [`02-normativa-y-reglas/`](02-normativa-y-reglas/) | Catálogo de reglas contables, impuestos y retenciones, factura electrónica DIAN, inventarios, cartera y préstamos, referencia API Alegra |
| [`03-procesos-y-flujos/`](03-procesos-y-flujos/) | Diagramas de secuencia y estados de los procesos de negocio |

### Orden de lectura sugerido

1. `00-alcance-supuestos-y-roadmap.md` (y responder las preguntas abiertas)
2. `01-arquitectura/01-vision-general-y-modulos.md`
3. `02-normativa-y-reglas/README.md` y luego cada catálogo de reglas
4. `03-procesos-y-flujos/01-flujo-venta-catalogo-a-factura.md`
5. El resto de `01-arquitectura/` según el módulo que se vaya a construir

## Convenciones de los documentos

### Estado de verificación de cada dato normativo

Todo valor, porcentaje o cita normativa lleva uno de estos marcadores:

| Marcador | Significado |
|---|---|
| ✅ | Contrastado con al menos una fuente publicada (se cita la fuente) |
| ⚠️ | Reportado por fuentes secundarias (prensa, blogs contables); falta confirmar con el texto oficial |
| 🔶 | Conocimiento general del autor **sin contrastar**; debe validarlo un contador o el texto oficial antes de implementarse |

> **Regla del proyecto:** ninguna regla 🔶 o ⚠️ pasa a código sin que un contador la marque ✅ en el
> catálogo. Las tarifas, bases y topes se modelan como **datos con vigencia** (ver ADR-0005), nunca como
> constantes en el código.

### Identificadores trazables

| Prefijo | Qué identifica | Dónde vive |
|---|---|---|
| `R-CON-nnn` | Regla contable | `02-normativa-y-reglas/01-…` |
| `R-IMP-nnn` | Regla de impuestos y retenciones | `02-normativa-y-reglas/02-…` |
| `R-FE-nnn` | Regla de facturación electrónica | `02-normativa-y-reglas/03-…` |
| `R-INV-nnn` | Regla de inventarios | `02-normativa-y-reglas/04-…` |
| `R-CAR-nnn` / `R-PRE-nnn` | Cartera / Préstamos | `02-normativa-y-reglas/05-…` |
| `ADR-nnnn` | Decisión de arquitectura | `01-arquitectura/06-decisiones-adr.md` |
| `S-nn` / `Q-nn` | Supuesto / Pregunta abierta | `00-alcance-supuestos-y-roadmap.md` |
| `AP-CR-nn` | Cambio requerido en Asia-POP | `01-arquitectura/05-integracion-asia-pop.md` |

Cada prueba automatizada que se escriba más adelante debe nombrar la(s) regla(s) que cubre
(por ejemplo `// cubre R-CON-001, R-CON-005`), para poder auditar cobertura normativa.

### Formato

- Markdown con diagramas **Mermaid** (se renderizan en GitHub).
- Idioma: español. Identificadores de código y de API en inglés.
- Cifras monetarias de ejemplo en pesos colombianos (COP), con separador de miles `.` en el texto narrativo
  y valores sin separador en tablas y código.
