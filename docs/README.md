# SIFCA — Documentación

**SIFCA** (Sistema Integral Fiscal y Contable Ágil) es una plataforma SaaS multiempresa, modular y construida
desde cero, para gestión contable, fiscal y administrativa de empresas colombianas, con una vitrina comercial
pública y un back-office ERP.

> **Estado (14-oct-2026):** la documentación es la fuente de verdad para implementar con desarrollo guiado por
> especificaciones (Spec Kit) y asistencia de IA. Ya existe código del **backend de contabilidad** (spec 001, en
> `apps/api/`); las demás especificaciones y la interfaz de usuario están por construir. Visión general de todo lo
> hecho y lo investigado: [`informe-del-proyecto.md`](informe-del-proyecto.md).

## Gobernanza

| Documento | Para qué |
|---|---|
| [`constitution.md`](constitution.md) | **La constitución innegociable:** inmutabilidad contable, Clean Architecture estricta, transacciones ACID, aislamiento por tenant, contratos con Zod, dinero exacto, reglas como datos, desarrollo guiado por specs y API desacoplada. Incluye los **gates** G-01…G-12 |
| [`specs/`](specs/README.md) | Una especificación por caso de uso, con criterios de aceptación **ejecutables** (Gherkin) y la **matriz de trazabilidad** generada |
| [`01-arquitectura/06-decisiones-adr.md`](01-arquitectura/06-decisiones-adr.md) | Los ADR: **cómo** se cumplen los principios |

Si un ADR, una spec o un plan contradice la constitución, **prevalece la constitución**.

## Decisiones vigentes (resumen)

| Tema | Decisión |
|---|---|
| Despliegue | SaaS multiempresa: `tenant_id` + RLS en PostgreSQL (esquema compartido) |
| Backend | NestJS en capas **Domain → Application → Infrastructure → Presentation** (Clean Architecture) |
| ORM | **Prisma** (reemplaza a TypeORM), solo en `infrastructure` |
| Contratos y validación | **Zod** como única fuente de verdad (`packages/contracts`); el OpenAPI se deriva de los esquemas |
| Emisión DIAN | **Proveedor Tecnológico Autorizado**, desacoplado por el puerto `EInvoiceProvider` |
| Alcance | **Sin préstamos** (no somos entidad crediticia). **Ventas a crédito y cartera**: cupo, plazos, edades, recibos, mora y bloqueo de despacho |
| Inventario | Costeo **PEPS** (obligatorio en perecederos) o **promedio ponderado**; **UEPS solo como despacho físico**; ABC, punto de reorden y devoluciones (RMA) |
| Integraciones | Contratos OpenAPI y webhooks estándar. **Asia-POP: fase futura / experimental**, fuera del núcleo |

## Mapa de la documentación

| Carpeta / archivo | Contenido |
|---|---|
| [`00-alcance-supuestos-y-roadmap.md`](00-alcance-supuestos-y-roadmap.md) | Alcance, decisiones (Q-01, Q-02, Q-03, Q-11), fuera de alcance, supuestos, preguntas abiertas, riesgos y fases |
| [`informe-del-proyecto.md`](informe-del-proyecto.md) | **Informe consolidado:** qué se hizo, qué se investigó (con su grado de certeza), resultados, pendientes |
| [`constitution.md`](constitution.md) | Constitución y gates de calidad |
| [`specs/`](specs/README.md) | 11 especificaciones con escenarios Gherkin y `traceability-matrix.md` |
| [`01-arquitectura/`](01-arquitectura/) | Módulos y capas del backend, modelo de datos PostgreSQL, evaluación de librerías, contrato OpenAPI, integración con motores externos, ADRs |
| [`02-normativa-y-reglas/`](02-normativa-y-reglas/) | Catálogo de reglas: contabilidad, impuestos y retenciones, factura electrónica DIAN, **inventarios (costeo, ABC, ROP, RMA)**, **cartera y ventas a crédito**, referencia API Alegra |
| [`04-diseno-ux/`](04-diseno-ux/README.md) | **Insumos para la maqueta** (Claude Design): brief, navegación, catálogo de pantallas, sistema de diseño, benchmark, **integraciones, migración y configuración** |
| [`03-procesos-y-flujos/`](03-procesos-y-flujos/) | Secuencias y estados: flujo de venta, **devoluciones con nota crédito y reingreso a kardex**, control de cupo, reposición y ABC |

### Orden de lectura sugerido

1. `informe-del-proyecto.md` y `constitution.md`
2. `00-alcance-supuestos-y-roadmap.md` (y las preguntas abiertas)
3. `01-arquitectura/01-vision-general-y-modulos.md` y `06-decisiones-adr.md`
4. `02-normativa-y-reglas/README.md` y cada catálogo de reglas
5. `03-procesos-y-flujos/` y luego `specs/`
6. El resto de `01-arquitectura/` según el módulo que se vaya a construir
7. `04-diseno-ux/` si vas a maquetar o diseñar la interfaz

## Convenciones

### Estado de verificación de cada dato normativo

| Marcador | Significado |
|---|---|
| ✅ | Contrastado con al menos una fuente publicada (se cita la fuente) |
| ⚠️ | Reportado por fuentes secundarias (prensa, blogs contables); falta confirmar con el texto oficial |
| 🔶 | Conocimiento general del autor **sin contrastar**; debe validarlo un contador o el texto oficial antes de implementarse |

> **Regla del proyecto (constitución VII):** ninguna regla 🔶 o ⚠️ pasa a código de producción sin que un contador
> la marque ✅. Las tarifas, bases y topes se modelan como **datos con vigencia** (ADR-0005), nunca como
> constantes. Los umbrales de gestión (ABC, niveles de servicio, mora) son parámetros de negocio configurables,
> no normativa. El registro de lo verificado está en
> [`02-normativa-y-reglas/README.md`](02-normativa-y-reglas/README.md).

### Identificadores trazables

| Prefijo | Qué identifica | Dónde vive |
|---|---|---|
| `R-CON-nnn` | Regla contable | `02-normativa-y-reglas/01-…` |
| `R-IMP-nnn` | Impuestos y retenciones | `02-normativa-y-reglas/02-…` |
| `R-FE-nnn` | Facturación electrónica | `02-normativa-y-reglas/03-…` |
| `R-INV-nnn` | Inventarios, costeo, ABC, reorden, devoluciones | `02-normativa-y-reglas/04-…` |
| `R-CAR-nnn` | Cartera, ventas a crédito, cuentas por pagar | `02-normativa-y-reglas/05-…` |
| `P-I … P-IX` | Principios de la constitución | `constitution.md` |
| `ADR-nnnn` | Decisión de arquitectura | `01-arquitectura/06-decisiones-adr.md` |
| `INV-nn` | Invariante del modelo de datos | `01-arquitectura/02-modelo-de-datos-preliminar.md` |
| `S-nn` / `Q-nn` | Supuesto / Pregunta abierta | `00-alcance-supuestos-y-roadmap.md` |
| `G-nn` | Gate de la verificación de constitución | `constitution.md` |
| `FR-nnn` / `NNN-nn` | Requisito funcional / escenario de aceptación | `specs/NNN-…/` |

Cada escenario Gherkin lleva etiquetas con las reglas que ejerce (`@R-CON-001`, `@P-III`…) y la
**matriz de trazabilidad** se **genera** (`node scripts/docs.mjs matrix`).

### Formato

- Markdown con diagramas **Mermaid** (se renderizan en GitHub). Los diagramas del repositorio se validan al
  renderizarlos con la herramienta oficial antes de confirmar cambios.
- Idioma: español. Identificadores de código y de API en inglés.
- Importes de ejemplo en pesos colombianos (COP).

## Verificación automática

```bash
node scripts/docs.mjs check            # enlaces, reglas, Gherkin, specs, espejo de la constitución y matriz
node scripts/docs.mjs check --strict   # además valida los .feature con el parser oficial de Gherkin
node scripts/docs.mjs matrix           # regenera specs/traceability-matrix.md
node scripts/docs.mjs sync             # sincroniza .specify/memory/constitution.md con docs/constitution.md
```

El CI ejecuta `check --strict` (constitución VIII).

## Herramientas de desarrollo guiado por especificaciones

| Herramienta | Dónde | Para qué |
|---|---|---|
| Skill `clean-architecture` (`wondelai/skills`) | `.claude/skills/clean-architecture/` | Guía de capas, regla de dependencia y límites; se usa al planificar e implementar |
| Skills `speckit-*` (`dceoy/speckit-agent-skills`) | `.claude/skills/speckit-*/` | Flujo constitución → specify → clarify → plan → tasks → implement |
| Andamiaje de Spec Kit | `.specify/` | Plantillas y scripts (generados con el CLI oficial); el espejo de la constitución |
| `scripts/docs.mjs` | `scripts/` | Gobernanza documental (sin dependencias) |

Instalación de las skills (ya realizada; versiones fijadas en `skills-lock.json`):

```bash
npx skills add https://github.com/wondelai/skills --skill clean-architecture
npx skills add dceoy/speckit-agent-skills
```

> Las skills son contenido de terceros que se ejecuta con los permisos del agente: se revisaron antes de
> adoptarlas (solo contienen instrucciones en Markdown, sin scripts) y su contenido queda fijado por *hash*.
