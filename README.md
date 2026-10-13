# SIFCA

**Sistema Integral Fiscal y Contable Ágil** — plataforma modular (vitrina pública + back-office ERP
contable) para empresas colombianas, construida desde cero sobre normatividad pública colombiana, el Anexo
Técnico de la DIAN y buenas prácticas de usabilidad.

> **Estado: Fase 1 — Especificaciones.** Todavía no hay código de aplicación.

Empieza por [`docs/README.md`](docs/README.md).

| | |
|---|---|
| Backend | NestJS (monolito modular, arquitectura hexagonal) + PostgreSQL |
| Frontend | React (back-office con Vite; vitrina con Next.js) |
| Móvil | React Native / Expo |
| Documentos PDF | Integración con [Asia-POP](https://github.com/JpMurcia/Asia-POP) |
| Contrato | OpenAPI/Swagger generado desde NestJS |
