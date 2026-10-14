import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

export const API_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const SRC = join(API_ROOT, 'src');

export function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name === 'generated') continue;
      walk(p, out);
    } else if (p.endsWith('.ts')) out.push(p);
  }
  return out;
}

export interface Source { file: string; rel: string; text: string; imports: string[] }

export function sources(filter: (rel: string) => boolean): Source[] {
  return walk(SRC)
    .map((file) => ({ file, rel: relative(API_ROOT, file).replaceAll('\\', '/'), text: readFileSync(file, 'utf8') }))
    .filter((s) => filter(s.rel))
    .map((s) => ({ ...s, imports: [...s.text.matchAll(/(?:import|export)\s[^;]*?from\s+['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g)].map((m) => (m[1] ?? m[2])!) }));
}

/** Quita comentarios para no marcar falsos positivos en la documentación del código. */
export const stripComments = (t: string): string => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
