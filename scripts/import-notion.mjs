// Lê as páginas publicadas do Notion e gera data/seed.json. Não altera nada no Notion.
// Uso: node scripts/import-notion.mjs [--refresh]
// Os blocos brutos ficam em data/notion-raw.json, para reprocessar depois de despublicar as páginas.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { buildSeed, parsePage, validateSeed } from './lib/notion-extract.mjs';

const PAGES = [
  { id: '30ad975d-5ec5-80ce-9859-f2526f74acfb', weekday: 0 },
  { id: '30ad975d-5ec5-8043-b5f2-c35b18af7007', weekday: 1 },
];
const RAW = new URL('../data/notion-raw.json', import.meta.url);
const SEED = new URL('../data/seed.json', import.meta.url);
const API = 'https://www.notion.so/api/v3/';

async function post(endpoint, body) {
  const res = await fetch(API + endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'user-agent': 'oracoes-import/0.1' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${endpoint}: HTTP ${res.status}`);
  return res.json();
}

const unwrap = (record) => {
  const value = record?.value ?? {};
  return value.value && typeof value.value === 'object' ? value.value : value;
};

async function fetchPage(pageId) {
  const blocks = {};
  let cursor = { stack: [] };
  for (let chunk = 0; chunk < 40; chunk++) {
    const data = await post('loadPageChunk', { pageId, limit: 300, cursor, chunkNumber: chunk, verticalColumns: false });
    for (const [id, record] of Object.entries(data.recordMap?.block ?? {})) blocks[id] = unwrap(record);
    cursor = data.cursor ?? { stack: [] };
    if (!cursor.stack?.length) break;
  }
  for (let round = 0; round < 6; round++) {
    const missing = [];
    const visit = (id) => {
      if (!blocks[id]) return missing.push(id);
      (blocks[id].content ?? []).forEach(visit);
    };
    visit(pageId);
    if (!missing.length) return blocks;
    for (let i = 0; i < missing.length; i += 80) {
      const requests = missing.slice(i, i + 80).map((id) => ({ pointer: { table: 'block', id }, version: -1 }));
      const data = await post('syncRecordValues', { requests });
      for (const [id, record] of Object.entries(data.recordMap?.block ?? {})) blocks[id] = unwrap(record);
    }
  }
  throw new Error(`Não foi possível carregar todos os blocos de ${pageId}. A página continua publicada?`);
}

const refresh = process.argv.includes('--refresh');
let raw;
if (!refresh && existsSync(RAW)) {
  raw = JSON.parse(readFileSync(RAW, 'utf8'));
  console.log('Usando data/notion-raw.json (use --refresh para baixar de novo).');
} else {
  raw = {};
  for (const { id } of PAGES) raw[id] = await fetchPage(id);
  writeFileSync(RAW, JSON.stringify(raw));
}

const days = PAGES.map(({ id, weekday }) => ({ ...parsePage(id, raw[id]), weekday }));
const seed = buildSeed(days);
for (const routine of seed.routines) routine.name = routine.name.replace(/^\d+\.\d+\s*/, '');

const problems = validateSeed(seed);
if (problems.length) {
  console.error('Importação reprovada:\n- ' + problems.join('\n- '));
  process.exit(1);
}
writeFileSync(SEED, JSON.stringify(seed, null, 2) + '\n');
console.log(`OK: ${seed.prayers.length} orações, base com ${seed.base.prayers.length}, dias: ${seed.routines.map((r) => r.name).join(', ')}.`);
