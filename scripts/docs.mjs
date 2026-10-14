#!/usr/bin/env node
/**
 * Herramienta de gobernanza documental de SIFCA (sin dependencias; Node 22+).
 *
 *   node scripts/docs.mjs check [--strict]   Verifica docs, specs y trazabilidad (código de salida 1 si falla)
 *   node scripts/docs.mjs sync               Copia docs/constitution.md a .specify/memory/constitution.md
 *   node scripts/docs.mjs matrix             Regenera docs/specs/traceability-matrix.md
 *
 * `--strict` además valida cada .feature con el parser oficial de Gherkin (usa `npx`, requiere red).
 * Constitución VIII: el CI ejecuta `check`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DOCS = path.join(ROOT, 'docs');
const SPECS = path.join(DOCS, 'specs');
const CONSTITUTION = path.join(DOCS, 'constitution.md');
const MIRROR = path.join(ROOT, '.specify', 'memory', 'constitution.md');
const MATRIX = path.join(SPECS, 'traceability-matrix.md');

const read = (f) => fs.readFileSync(f, 'utf8');
const rel = (f) => path.relative(ROOT, f).split(path.sep).join('/');

function walk(dir, filter) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p, filter));
    else if (!filter || filter(p)) out.push(p);
  }
  return out.sort();
}

// ---------------------------------------------------------------------------------------------------------------
// Identificadores definidos
// ---------------------------------------------------------------------------------------------------------------

const RULE_PREFIXES = 'CON|IMP|FE|INV|CAR';
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

function definedIds() {
  const rules = new Map(); // id -> { file, title }
  for (const f of walk(path.join(DOCS, '02-normativa-y-reglas'), (p) => p.endsWith('.md'))) {
    for (const m of read(f).matchAll(new RegExp(`^#{3,4}\\s+(R-(?:${RULE_PREFIXES})-\\d{3})\\s*·\\s*(.+)$`, 'gm'))) {
      rules.set(m[1], { file: rel(f), title: m[2].trim() });
    }
  }
  const adrs = new Set();
  const adrFile = path.join(DOCS, '01-arquitectura', '06-decisiones-adr.md');
  if (fs.existsSync(adrFile)) for (const m of read(adrFile).matchAll(/^##\s+(ADR-\d{4})\b/gm)) adrs.add(m[1]);
  const principles = new Set();
  if (fs.existsSync(CONSTITUTION)) {
    for (const m of read(CONSTITUTION).matchAll(/^###\s+([IVX]+)\.\s/gm)) if (ROMAN.includes(m[1])) principles.add(`P-${m[1]}`);
  }
  const invs = new Set();
  const model = path.join(DOCS, '01-arquitectura', '02-modelo-de-datos-preliminar.md');
  if (fs.existsSync(model)) for (const m of read(model).matchAll(/^\|\s*(INV-\d{2})\s*\|/gm)) invs.add(m[1]);
  return { rules, adrs, principles, invs };
}

const isKnownTag = (tag, ids) =>
  ids.rules.has(tag) || ids.adrs.has(tag) || ids.principles.has(tag) || ids.invs.has(tag);

// ---------------------------------------------------------------------------------------------------------------
// Gherkin (análisis ligero en español; --strict usa el parser oficial)
// ---------------------------------------------------------------------------------------------------------------

const KW = {
  feature: /^Característica:\s*(.*)$/,
  background: /^Antecedentes:\s*$/,
  scenario: /^Escenario:\s*(.*)$/,
  outline: /^Esquema del escenario:\s*(.*)$/,
  examples: /^Ejemplos:\s*(.*)$/,
  step: /^(Dado|Cuando|Entonces|Y|Pero|\*)\s+(.*)$/,
};

function parseFeature(file) {
  const lines = read(file).split(/\r?\n/);
  const errors = [];
  const feature = { name: '', tags: [], scenarios: [], language: null };
  let pendingTags = [];
  let current = null; // escenario en curso
  let mode = null; // 'background' | 'scenario' | 'examples'
  lines.forEach((raw, i) => {
    const n = i + 1;
    const line = raw.trim();
    if (!line) return;
    const lang = line.match(/^#\s*language:\s*(\w+)/);
    if (lang) { feature.language = lang[1]; return; }
    if (line.startsWith('#')) return;
    if (line.startsWith('@')) { pendingTags.push(...line.split(/\s+/).filter((t) => t.startsWith('@')).map((t) => t.slice(1))); return; }
    let m;
    if ((m = line.match(KW.feature))) { feature.name = m[1]; feature.tags = pendingTags; pendingTags = []; mode = 'feature'; return; }
    if (KW.background.test(line)) { feature.hasBackground = true; current = { type: 'background', steps: [], line: n, tags: [] }; mode = 'background'; return; }
    if ((m = line.match(KW.scenario)) || (m = line.match(KW.outline))) {
      current = { type: KW.outline.test(line) ? 'outline' : 'scenario', name: m[1].trim(), tags: pendingTags, steps: [], examples: [], line: n };
      pendingTags = []; feature.scenarios.push(current); mode = 'scenario'; return;
    }
    if (KW.examples.test(line)) { if (current) current.examples.push({ header: null, rows: [], line: n }); mode = 'examples'; return; }
    if (line.startsWith('|')) {
      const cells = line.split('|').slice(1, -1).map((c) => c.trim());
      if (mode === 'examples' && current) {
        const ex = current.examples[current.examples.length - 1];
        if (!ex.header) ex.header = cells; else ex.rows.push({ cells, line: n });
      }
      return;
    }
    if ((m = line.match(KW.step))) {
      if (!current) errors.push(`${rel(file)}:${n}: paso fuera de un escenario`); else current.steps.push({ kw: m[1], text: m[2], line: n });
      if (mode === 'examples') mode = 'scenario';
      return;
    }
    if (mode === 'feature') return; // descripción libre de la característica
    errors.push(`${rel(file)}:${n}: línea no reconocida: «${line.slice(0, 60)}»`);
  });
  return { feature, errors };
}

function lintFeature(file, ids) {
  const { feature, errors } = parseFeature(file);
  const f = rel(file);
  if (feature.language !== 'es') errors.push(`${f}: falta «# language: es» en la primera línea`);
  if (!feature.name) errors.push(`${f}: falta «Característica:»`);
  if (!feature.scenarios.length) errors.push(`${f}: no hay escenarios`);
  for (const sc of feature.scenarios) {
    if (sc.type === 'background') continue;
    const where = `${f}:${sc.line}`;
    if (!/^\[\d{3}-\d{2}\]\s+\S/.test(sc.name)) errors.push(`${where}: el escenario debe empezar con su id «[NNN-NN] …» (${sc.name || 'sin nombre'})`);
    const kws = sc.steps.map((s) => s.kw);
    if (!kws.includes('Dado') && !feature.hasBackground) errors.push(`${where}: el escenario no tiene «Dado» (ni la característica tiene «Antecedentes»)`);
    if (!kws.includes('Cuando')) errors.push(`${where}: el escenario no tiene «Cuando»`);
    if (!kws.includes('Entonces')) errors.push(`${where}: el escenario no tiene «Entonces»`);
    const all = [...feature.tags, ...sc.tags];
    if (!sc.tags.length) errors.push(`${where}: el escenario no tiene etiquetas de trazabilidad`);
    for (const t of sc.tags) {
      if (/^(R-|P-|ADR-|INV-)/.test(t) && !isKnownTag(t, ids)) errors.push(`${where}: etiqueta de trazabilidad desconocida @${t}`);
    }
    if (!sc.tags.some((t) => isKnownTag(t, ids))) errors.push(`${where}: debe llevar al menos una etiqueta @R-…, @P-…, @ADR-… o @INV-… válida`);
    void all;
    if (sc.type === 'outline') {
      if (!sc.examples.length) errors.push(`${where}: el esquema no tiene «Ejemplos:»`);
      const used = new Set();
      for (const s of sc.steps) for (const m of s.text.matchAll(/<([^>]+)>/g)) used.add(m[1]);
      for (const ex of sc.examples) {
        if (!ex.header) { errors.push(`${f}:${ex.line}: «Ejemplos:» sin tabla`); continue; }
        for (const u of used) if (!ex.header.includes(u)) errors.push(`${f}:${ex.line}: el paso usa <${u}> que no es una columna de Ejemplos`);
        for (const r of ex.rows) if (r.cells.length !== ex.header.length) errors.push(`${f}:${r.line}: fila de Ejemplos con ${r.cells.length} columnas (se esperaban ${ex.header.length})`);
        if (!ex.rows.length) errors.push(`${f}:${ex.line}: Ejemplos sin filas`);
      }
    }
  }
  return { feature, errors };
}

// ---------------------------------------------------------------------------------------------------------------
// Specs
// ---------------------------------------------------------------------------------------------------------------

const REQUIRED_HEADINGS = [
  '## User Scenarios & Testing',
  '### Edge Cases',
  '## Requirements',
  '### Functional Requirements',
  '## Success Criteria',
  '## Assumptions',
  '## Trazabilidad de reglas',
  '## Verificación de constitución',
];

function specDirs() {
  if (!fs.existsSync(SPECS)) return [];
  return fs.readdirSync(SPECS, { withFileTypes: true }).filter((e) => e.isDirectory() && /^\d{3}-/.test(e.name)).map((e) => path.join(SPECS, e.name)).sort();
}

function expandRuleRefs(text) {
  const out = new Set();
  const re = new RegExp(`(R-(?:${RULE_PREFIXES})-)(\\d{3})(?:\\s*(?:…|\\.\\.\\.)\\s*(\\d{3}))?`, 'g');
  for (const m of text.matchAll(re)) {
    const from = Number(m[2]);
    const to = m[3] ? Number(m[3]) : from;
    for (let k = from; k <= to; k++) out.add(`${m[1]}${String(k).padStart(3, '0')}`);
  }
  return out;
}

function loadSpecs(ids) {
  const errors = [];
  const specs = [];
  for (const dir of specDirs()) {
    const name = path.basename(dir);
    const specFile = path.join(dir, 'spec.md');
    if (!fs.existsSync(specFile)) { errors.push(`${rel(dir)}: falta spec.md`); continue; }
    const text = read(specFile);
    for (const h of REQUIRED_HEADINGS) if (!text.includes(`\n${h}`) && !text.startsWith(h)) errors.push(`${rel(specFile)}: falta el encabezado «${h}»`);
    if (/\[NEEDS CLARIFICATION/.test(text)) errors.push(`${rel(specFile)}: quedan marcadores [NEEDS CLARIFICATION]`);
    // FRs
    const frs = [];
    const seen = new Set();
    for (const m of text.matchAll(/^- \*\*(FR-\d{3})\*\*:(.*)$/gm)) {
      if (seen.has(m[1])) errors.push(`${rel(specFile)}: ${m[1]} duplicado`);
      seen.add(m[1]);
      const refs = [...expandRuleRefs(m[2])];
      frs.push({ id: m[1], text: m[2].trim(), rules: refs });
      if (!refs.length && !/\((?:P-[IVX]+|ADR-\d{4})[^)]*\)/.test(m[2])) errors.push(`${rel(specFile)}: ${m[1]} no cita ninguna regla (use *(R-XXX-nnn)*) ni principio`);
    }
    if (!frs.length) errors.push(`${rel(specFile)}: no hay requisitos funcionales «- **FR-nnn**:»`);
    // Referencias a reglas en todo el spec
    for (const r of expandRuleRefs(text)) if (!ids.rules.has(r)) errors.push(`${rel(specFile)}: referencia a regla inexistente ${r}`);
    // Acceptance
    const accDir = path.join(dir, 'acceptance');
    const features = walk(accDir, (p) => p.endsWith('.feature'));
    if (!features.length) errors.push(`${rel(dir)}: falta acceptance/*.feature`);
    const scenarios = [];
    for (const ff of features) {
      const { feature, errors: errs } = lintFeature(ff, ids);
      errors.push(...errs);
      for (const sc of feature.scenarios) {
        if (sc.type === 'background') continue;
        const id = (sc.name.match(/^\[(\d{3}-\d{2})\]/) || [])[1];
        if (id && !id.startsWith(name.slice(0, 3))) errors.push(`${rel(ff)}:${sc.line}: el id ${id} no corresponde a la spec ${name.slice(0, 3)}`);
        scenarios.push({ id, title: sc.name.replace(/^\[[^\]]+\]\s*/, ''), tags: [...feature.tags, ...sc.tags], file: rel(ff), line: sc.line });
      }
    }
    specs.push({ name, dir, specFile, title: (text.match(/^#\s+(?:Feature Specification:\s*)?(.+)$/m) || [])[1] || name, frs, scenarios });
  }
  const sid = new Map();
  for (const s of specs) for (const sc of s.scenarios) {
    if (!sc.id) continue;
    if (sid.has(sc.id)) errors.push(`${sc.file}:${sc.line}: id de escenario duplicado ${sc.id} (también en ${sid.get(sc.id)})`);
    sid.set(sc.id, sc.file);
  }
  return { specs, errors };
}

// ---------------------------------------------------------------------------------------------------------------
// Matriz de trazabilidad
// ---------------------------------------------------------------------------------------------------------------

function buildMatrix(specs, ids) {
  const byRule = new Map([...ids.rules.keys()].map((r) => [r, { frs: [], scenarios: [] }]));
  const byPrinciple = new Map([...ids.principles].map((p) => [p, []]));
  for (const s of specs) {
    const num = s.name.slice(0, 3);
    for (const fr of s.frs) for (const r of fr.rules) byRule.get(r)?.frs.push(`${num}/${fr.id}`);
    for (const sc of s.scenarios) for (const t of sc.tags) {
      if (byRule.has(t)) byRule.get(t).scenarios.push(sc.id);
      if (byPrinciple.has(t)) byPrinciple.get(t).push(sc.id);
    }
  }
  const lines = [];
  const L = (x = '') => lines.push(x);
  L('# Matriz de trazabilidad');
  L();
  L('> **Archivo generado** por `node scripts/docs.mjs matrix`. No se edita a mano: el CI (`check`) falla si está');
  L('> desactualizado. Une cada **regla normativa** con los requisitos (`FR`) de las especificaciones y los');
  L('> **escenarios ejecutables** (Gherkin) que la ejercen.');
  L();
  const covered = [...byRule.entries()].filter(([, v]) => v.frs.length || v.scenarios.length);
  const pending = [...byRule.entries()].filter(([, v]) => !v.frs.length && !v.scenarios.length);
  L('## Resumen');
  L();
  L('| Indicador | Valor |');
  L('|---|---:|');
  L(`| Especificaciones | ${specs.length} |`);
  L(`| Requisitos funcionales (FR) | ${specs.reduce((a, s) => a + s.frs.length, 0)} |`);
  L(`| Escenarios ejecutables | ${specs.reduce((a, s) => a + s.scenarios.length, 0)} |`);
  L(`| Reglas definidas en el catálogo | ${byRule.size} |`);
  L(`| Reglas con cobertura (FR o escenario) | ${covered.length} |`);
  L(`| Reglas **sin** cobertura todavía | ${pending.length} |`);
  L();
  L('## 1. Reglas → requisitos → escenarios');
  L();
  L('| Regla | Título | Requisitos (spec/FR) | Escenarios |');
  L('|---|---|---|---|');
  for (const [r, v] of covered) {
    L(`| ${r} | ${ids.rules.get(r).title} | ${[...new Set(v.frs)].join(', ') || '—'} | ${[...new Set(v.scenarios)].join(', ') || '—'} |`);
  }
  L();
  L('## 2. Cobertura por especificación');
  L();
  L('| Spec | Título | FR | Escenarios | Reglas cubiertas |');
  L('|---|---|---:|---:|---:|');
  for (const s of specs) {
    const rs = new Set();
    for (const fr of s.frs) fr.rules.forEach((r) => rs.add(r));
    for (const sc of s.scenarios) sc.tags.forEach((t) => { if (byRule.has(t)) rs.add(t); });
    L(`| [${s.name}](${s.name}/spec.md) | ${s.title} | ${s.frs.length} | ${s.scenarios.length} | ${rs.size} |`);
  }
  L();
  L('## 3. Principios de la constitución → escenarios');
  L();
  L('| Principio | Escenarios |');
  L('|---|---|');
  for (const [p, sc] of byPrinciple) L(`| ${p} | ${[...new Set(sc)].join(', ') || '—'} |`);
  L();
  L('## 4. Reglas sin cobertura (pendientes de especificar)');
  L();
  L('Reglas definidas en el catálogo que ninguna especificación o escenario cita todavía. No es un error: indica');
  L('trabajo futuro (por ejemplo, funcionalidad fuera del MVP).');
  L();
  const groups = {};
  for (const [r] of pending) (groups[r.split('-')[1]] ||= []).push(r);
  for (const g of Object.keys(groups).sort()) L(`- **${g}** (${groups[g].length}): ${groups[g].join(', ')}`);
  L();
  return lines.join('\n');
}

// ---------------------------------------------------------------------------------------------------------------
// Verificaciones generales
// ---------------------------------------------------------------------------------------------------------------

function checkLinks() {
  const errors = [];
  const files = [...walk(DOCS, (p) => p.endsWith('.md')), path.join(ROOT, 'README.md')];
  for (const f of files) {
    const text = read(f).replace(/```[\s\S]*?```/g, '');
    for (const m of text.matchAll(/\]\(([^)#\s]+)(#[^)]*)?\)/g)) {
      const t = m[1];
      if (/^(https?:|mailto:)/.test(t)) continue;
      const p = path.normalize(path.join(path.dirname(f), t));
      if (!fs.existsSync(p)) errors.push(`${rel(f)}: enlace roto → ${t}`);
    }
  }
  return errors;
}

function checkRuleRefs(ids) {
  const errors = [];
  const files = walk(DOCS, (p) => p.endsWith('.md'));
  for (const f of files) {
    const text = read(f);
    for (const r of expandRuleRefs(text)) if (!ids.rules.has(r)) errors.push(`${rel(f)}: referencia a regla inexistente ${r}`);
  }
  return errors;
}

function checkMirror() {
  if (!fs.existsSync(CONSTITUTION)) return ['falta docs/constitution.md'];
  if (!fs.existsSync(MIRROR)) return ['falta .specify/memory/constitution.md (ejecute: node scripts/docs.mjs sync)'];
  return read(CONSTITUTION) === read(MIRROR) ? [] : ['.specify/memory/constitution.md difiere de docs/constitution.md (ejecute: node scripts/docs.mjs sync)'];
}

function strictGherkin() {
  const files = walk(SPECS, (p) => p.endsWith('.feature'));
  if (!files.length) return [];
  const tmp = fs.mkdtempSync(path.join(process.env.TMPDIR || '/tmp', 'sifca-gherkin-'));
  const runner = path.join(tmp, 'run.mjs');
  fs.writeFileSync(runner, `
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(process.cwd() + '/');
const { Parser, AstBuilder, GherkinClassicTokenMatcher } = require('@cucumber/gherkin');
const { IdGenerator } = require('@cucumber/messages');
const bad = [];
for (const f of process.argv.slice(2)) {
  try {
    const parser = new Parser(new AstBuilder(IdGenerator.uuid()), new GherkinClassicTokenMatcher());
    parser.parse(fs.readFileSync(f, 'utf8'));
  } catch (e) { bad.push(f + ': ' + String(e.message).split('\\n')[0]); }
}
console.log(JSON.stringify(bad));
`);
  try {
    execFileSync('npm', ['install', '--silent', '--no-audit', '--no-fund', '--prefix', tmp, '@cucumber/gherkin', '@cucumber/messages'], { stdio: 'ignore' });
    const out = execFileSync('node', [runner, ...files], { cwd: tmp, encoding: 'utf8' });
    return JSON.parse(out.trim().split('\n').pop()).map((e) => `[gherkin oficial] ${e}`);
  } catch (e) {
    return [`[gherkin oficial] no se pudo ejecutar el parser oficial: ${String(e.message).split('\n')[0]}`];
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Comandos
// ---------------------------------------------------------------------------------------------------------------

const cmd = process.argv[2] || 'check';
const strict = process.argv.includes('--strict');

if (cmd === 'sync') {
  fs.mkdirSync(path.dirname(MIRROR), { recursive: true });
  fs.copyFileSync(CONSTITUTION, MIRROR);
  console.log(`Espejo actualizado: ${rel(MIRROR)}`);
} else if (cmd === 'matrix' || cmd === 'check') {
  const ids = definedIds();
  const { specs, errors: specErrors } = loadSpecs(ids);
  const matrix = buildMatrix(specs, ids);
  if (cmd === 'matrix') {
    fs.mkdirSync(SPECS, { recursive: true });
    fs.writeFileSync(MATRIX, matrix);
    console.log(`Matriz escrita: ${rel(MATRIX)} (${specs.length} specs)`);
    if (specErrors.length) { console.error(specErrors.join('\n')); process.exit(1); }
  } else {
    const errors = [...checkMirror(), ...checkLinks(), ...checkRuleRefs(ids), ...specErrors];
    if (!fs.existsSync(MATRIX)) errors.push('falta docs/specs/traceability-matrix.md (ejecute: node scripts/docs.mjs matrix)');
    else if (read(MATRIX) !== matrix) errors.push('docs/specs/traceability-matrix.md está desactualizada (ejecute: node scripts/docs.mjs matrix)');
    if (strict) errors.push(...strictGherkin());
    const uniq = [...new Set(errors)];
    if (uniq.length) {
      console.error(`✖ ${uniq.length} problema(s):\n` + uniq.map((e) => `  - ${e}`).join('\n'));
      process.exit(1);
    }
    const nsc = specs.reduce((a, s) => a + s.scenarios.length, 0);
    console.log(`✔ docs OK: ${ids.rules.size} reglas, ${ids.adrs.size} ADR, ${ids.principles.size} principios, ${specs.length} specs, ${nsc} escenarios${strict ? ' (Gherkin oficial verificado)' : ''}`);
  }
} else {
  console.error(`Comando desconocido: ${cmd}\nUso: node scripts/docs.mjs [check [--strict] | sync | matrix]`);
  process.exit(2);
}
