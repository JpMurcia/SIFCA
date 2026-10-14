#!/usr/bin/env node
/**
 * Puerta de liberación a producción (constitución VII, gate G-10).
 *
 * Una regla del catálogo (`docs/02-normativa-y-reglas/*.md`) solo se considera VALIDADA si su sección contiene la línea
 *     **Validación del contador:** ✅ AAAA-MM-DD · Nombre Apellido (T.P. nnnn)
 * Sin esa línea la regla es 🔶/⚠️ y NO puede ir a producción (aunque se desarrolle y se pruebe).
 *
 * Uso:
 *   node scripts/check-rules-verified.mjs docs/specs/001-contabilidad-comprobantes-inmutables [--allow-provisional]
 * Revisa las reglas que cita la spec (spec.md y los .feature) y sale con código 1 si alguna no está validada.
 * Con --allow-provisional solo informa (para desarrollo); el job de liberación NO lo usa.
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const RULE_ID = /\bR-[A-Z]{2,4}-\d{3}\b/g;
const VALIDATED = /\*\*Validación del contador:\*\*\s*✅\s*(\d{4}-\d{2}-\d{2})\s*·\s*(.+)/;

export function expandRanges(text) {
  // «R-CON-001…009» → R-CON-001 … R-CON-009
  const out = new Set(text.match(RULE_ID) ?? []);
  for (const m of text.matchAll(/\b(R-[A-Z]{2,4})-(\d{3})\s*(?:…|\.\.\.|–|-)\s*(\d{3})\b/g)) {
    for (let n = Number(m[2]); n <= Number(m[3]); n++) out.add(`${m[1]}-${String(n).padStart(3, '0')}`);
  }
  return out;
}

/** Devuelve { id → { heading, validated: {date, who} | null } } leyendo las secciones `### R-XXX-nnn` del catálogo. */
export function loadCatalog(catalogDir) {
  const rules = new Map();
  for (const f of readdirSync(catalogDir).filter((x) => x.endsWith('.md'))) {
    const lines = readFileSync(join(catalogDir, f), 'utf8').split('\n');
    let current = null;
    for (const line of lines) {
      const h = /^#{2,4}\s+(R-[A-Z]{2,4}-\d{3})\b(.*)$/.exec(line);
      if (h) {
        current = { id: h[1], file: f, title: h[2].replace(/^[\s·-]+/, '').trim(), validated: null };
        rules.set(current.id, current);
        continue;
      }
      if (/^#{1,3}\s/.test(line)) current = null;
      const v = current && VALIDATED.exec(line);
      if (v) current.validated = { date: v[1], who: v[2].trim() };
    }
  }
  return rules;
}

export function rulesCitedBy(specDir) {
  let text = readFileSync(join(specDir, 'spec.md'), 'utf8');
  const acc = join(specDir, 'acceptance');
  if (existsSync(acc)) for (const f of readdirSync(acc).filter((x) => x.endsWith('.feature'))) text += '\n' + readFileSync(join(acc, f), 'utf8');
  return [...expandRanges(text)].sort();
}

export function check(specDir, catalogDir) {
  const catalog = loadCatalog(catalogDir);
  return rulesCitedBy(specDir).map((id) => {
    const r = catalog.get(id);
    return { id, title: r?.title ?? '(no está en el catálogo)', file: r?.file ?? '—', validated: r?.validated ?? null, exists: !!r };
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const specDir = resolve(args.find((a) => !a.startsWith('--')) ?? '');
  const allow = args.includes('--allow-provisional');
  const catalogDir = resolve(new URL('../docs/02-normativa-y-reglas', import.meta.url).pathname);
  const rows = check(specDir, catalogDir);
  const pending = rows.filter((r) => !r.validated);
  console.log(`Reglas citadas por ${specDir.split('/').slice(-1)[0]}: ${rows.length}`);
  for (const r of rows) console.log(`  ${r.validated ? '✅' : '🔶'} ${r.id}  ${r.title}${r.validated ? `  (validada ${r.validated.date} · ${r.validated.who})` : ''}`);
  if (pending.length > 0) {
    const msg = `${pending.length} regla(s) sin validación del contador: ${pending.map((r) => r.id).join(', ')}`;
    if (allow) console.log(`\n⚠️  ${msg} — permitido solo en desarrollo (no pasa a producción).`);
    else {
      console.error(`\n✖ ${msg}. Constitución VII: ninguna regla 🔶/⚠️ pasa a producción sin ✅ del contador.`);
      process.exit(1);
    }
  } else console.log('\n✔ Todas las reglas citadas están validadas por el contador.');
}
