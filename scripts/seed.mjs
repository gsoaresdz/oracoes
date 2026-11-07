// Grava data/seed.json no Supabase para o usuário SEED_USER_EMAIL.
// Reexecutar não duplica nada, mas sobrescreve textos e a estrutura da base e dos dias importados.
// Por isso, se já houver dados, é preciso confirmar com --force.
// Uso: npm run seed [-- --force]
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const { VITE_SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: key, SEED_USER_EMAIL: email } = process.env;
if (!url || !key || !email) {
  console.error('Defina VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY e SEED_USER_EMAIL em .env.local.');
  process.exit(1);
}

const db = createClient(url, key, { auth: { persistSession: false } });
const seed = JSON.parse(readFileSync(new URL('../data/seed.json', import.meta.url), 'utf8'));

const must = ({ data, error }, what) => {
  if (error) throw new Error(`${what}: ${error.message}`);
  return data;
};

const { users } = must(await db.auth.admin.listUsers({ perPage: 1000 }), 'listar usuários');
const user = users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
if (!user) {
  console.error(`Usuário ${email} não existe. Crie a conta no Supabase (Authentication > Users) antes.`);
  process.exit(1);
}
const user_id = user.id;

const existingCount = must(await db.from('routines').select('id').eq('user_id', user_id), 'verificar dados').length;
if (existingCount && !process.argv.includes('--force')) {
  console.error('Já existem dados nesta conta. Reexecutar sobrescreve edições feitas no app. Use --force para confirmar.');
  process.exit(1);
}

const prayers = must(
  await db
    .from('prayers')
    .upsert(seed.prayers.map((p) => ({ user_id, title: p.title, body: p.body })), { onConflict: 'user_id,title' })
    .select('id, title'),
  'gravar orações',
);
const prayerId = new Map(prayers.map((p) => [p.title, p.id]));

async function writeRoutine({ name, weekday, isBase, position }, sections) {
  let query = db.from('routines').select('id').eq('user_id', user_id);
  query = isBase ? query.eq('is_base', true) : query.eq('weekday', weekday).eq('name', name);
  const existing = must(await query, 'buscar rotina');
  // Apagar a rotina remove seções e itens em cascata. As orações são preservadas.
  if (existing.length) must(await db.from('routines').delete().in('id', existing.map((r) => r.id)), 'limpar rotina');

  const [routine] = must(
    await db.from('routines').insert({ user_id, name, weekday, is_base: isBase, position }).select('id'),
    'criar rotina',
  );
  for (const [index, section] of sections.entries()) {
    const [row] = must(
      await db
        .from('routine_sections')
        .insert({ routine_id: routine.id, title: section.title, is_base_slot: section.isBaseSlot, position: index })
        .select('id'),
      'criar seção',
    );
    if (section.prayers.length) {
      must(
        await db.from('routine_items').insert(
          section.prayers.map((title, position) => ({ section_id: row.id, prayer_id: prayerId.get(title), position })),
        ),
        'criar itens',
      );
    }
  }
}

await writeRoutine(
  { name: seed.base.name, weekday: null, isBase: true, position: 0 },
  [{ title: seed.base.sectionTitle, isBaseSlot: false, prayers: seed.base.prayers }],
);
for (const [index, routine] of seed.routines.entries()) {
  await writeRoutine({ name: routine.name, weekday: routine.weekday, isBase: false, position: index + 1 }, routine.sections);
}
console.log(`Pronto: ${prayers.length} orações, base e ${seed.routines.length} dias gravados para ${email}.`);
