import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Ajv2020 } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { parse } from 'yaml';

const here = dirname(fileURLToPath(import.meta.url));
export const CONTRACT_PATH = join(here, '..', '..', '..', '..', '..', 'docs', 'specs', '001-contabilidad-comprobantes-inmutables', 'contracts', 'accounting.v1.openapi.yaml');

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const doc = parse(readFileSync(CONTRACT_PATH, 'utf8')) as Json;
const ajv = new Ajv2020({ strict: false, allErrors: true });
addFormats.default(ajv);
ajv.addSchema(doc, 'https://sifca.example/contract.json');

const enc = (s: string) => s.replaceAll('~', '~0').replaceAll('/', '~1');

function follow(ref: string): { pointer: string; node: Json } {
  const pointer = ref.replace(/^#/, '');
  let node: Json = doc;
  for (const part of pointer.split('/').slice(1)) node = node[part.replaceAll('~1', '/').replaceAll('~0', '~')];
  return { pointer, node };
}

/** Valida un cuerpo contra el esquema de la respuesta (`method` + ruta tal como está en el contrato + código + tipo de contenido). */
export function validateResponse(method: string, path: string, status: number, contentType: string, body: unknown): { ok: boolean; errors: string } {
  const op = doc.paths?.[path]?.[method.toLowerCase()];
  if (!op) return { ok: false, errors: `El contrato no define ${method} ${path}` };
  let resp: Json | undefined = op.responses?.[String(status)];
  let pointer = `/paths/${enc(path)}/${method.toLowerCase()}/responses/${status}`;
  if (!resp) return { ok: false, errors: `El contrato no define la respuesta ${status} de ${method} ${path} (define: ${Object.keys(op.responses ?? {}).join(', ')})` };
  if (resp.$ref) ({ pointer, node: resp } = follow(resp.$ref));
  const ct = contentType.split(';')[0]!.trim();
  const media = resp.content?.[ct];
  if (!media?.schema) return { ok: false, errors: `El contrato no define contenido ${ct} para ${status} de ${method} ${path}` };
  const validate = ajv.getSchema(`https://sifca.example/contract.json#${pointer}/content/${enc(ct)}/schema`);
  if (!validate) return { ok: false, errors: 'No se pudo compilar el esquema' };
  const ok = validate(body) as boolean;
  return { ok, errors: ok ? '' : ajv.errorsText(validate.errors, { separator: '\n' }) };
}

/** Valida un cuerpo de solicitud contra el esquema del contrato. */
export function validateRequest(method: string, path: string, body: unknown): { ok: boolean; errors: string } {
  const op = doc.paths?.[path]?.[method.toLowerCase()];
  const validate = ajv.getSchema(`https://sifca.example/contract.json#/paths/${enc(path)}/${method.toLowerCase()}/requestBody/content/application~1json/schema`);
  if (!op || !validate) return { ok: false, errors: 'Solicitud no definida en el contrato' };
  const ok = validate(body) as boolean;
  return { ok, errors: ok ? '' : ajv.errorsText(validate.errors) };
}

export const contract = doc;
