// Grava data/seed.json na conta SEED_USER_EMAIL, entrando com a senha dela: valem as regras de acesso normais.
// Por padrão só adiciona o que falta e preserva o que foi editado no app.
// Uso: npm run seed [-- --dry-run] [-- --force]
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { planSeed } from './lib/seed-plan.mjs';

const { VITE_SUPABASE_URL: url, VITE_SUPABASE_ANON_KEY: key, SEED_USER_EMAIL: email, SEED_USER_PASSWORD: password } = process.env;
if (!url || !key || !email || !password) {
  console.error('Defina VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, SEED_USER_EMAIL e SEED_USER_PASSWORD em .env.local.');
  process.exit(1);
}
const dryRun = process.argv.includes('--dry-run');
const force = process.argv.includes('--force');

const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const seed = JSON.parse(readFileSync(new URL('../data/seed.json', import.meta.url), 'utf8'));

const must = ({ data, error }, what) => {
  if (error) throw new Error(`${what}: ${error.message}`);
  return data;
};

const { user } = must(await db.auth.signInWithPassword({ email, password }), 'entrar');
const user_id = user.id;

const existing = {
  prayers: must(await db.from('prayers').select('id, title, body'), 'ler orações'),
  routines: must(await db.from('routines').select('id, name, weekday, is_base'), 'ler rotinas'),
};
const plan = planSeed(seed, existing);

console.log(`Orações na conta: ${existing.prayers.length}. Novas a adicionar: ${plan.newPrayers.length}.`);
plan.newPrayers.forEach((p) => console.log(`  + ${p.title}`));
console.log(`Dias a criar: ${plan.newRoutines.map((r) => r.name).join(', ') || 'nenhum'}.`);
if (plan.skippedRoutines.length) console.log(`Dias que já existem${force ? ' e serão recriados' : ' e ficam como estão'}: ${plan.skippedRoutines.join(', ')}.`);
if (plan.keptPrayers.length) {
  console.log(`Orações com texto diferente do Notion (${force ? 'serão sobrescritas' : 'fica o texto da conta'}):`);
  plan.keptPrayers.forEach((title) => console.log(`  = ${title}`));
}
if (dryRun) {
  console.log('Simulação: nada foi gravado.');
  process.exit(0);
}

if (force) {
  must(
    await db.from('prayers').upsert(seed.prayers.map((p) => ({ user_id, title: p.title, body: p.body })), { onConflict: 'user_id,title' }),
    'gravar orações',
  );
} else if (plan.newPrayers.length) {
  must(await db.from('prayers').insert(plan.newPrayers.map((p) => ({ user_id, title: p.title, body: p.body }))), 'gravar orações');
}
const prayers = must(await db.from('prayers').select('id, title'), 'reler orações');
const prayerId = new Map(prayers.map((p) => [p.title, p.id]));

async function writeRoutine({ name, weekday, isBase, position }, sections) {
  const [routine] = must(
    await db.from('routines').insert({ user_id, name, weekday, is_base: isBase, position }).select('id'),
    `criar ${name}`,
  );
  try {
    for (const [index, section] of sections.entries()) {
      const [row] = must(
        await db
          .from('routine_sections')
          .insert({ routine_id: routine.id, title: section.title, is_base_slot: section.isBaseSlot, position: index })
          .select('id'),
        `criar seção ${section.title}`,
      );
      if (!section.prayers.length) continue;
      must(
        await db.from('routine_items').insert(
          section.prayers.map((title, itemPosition) => ({ section_id: row.id, prayer_id: prayerId.get(title), position: itemPosition })),
        ),
        `criar itens de ${section.title}`,
      );
    }
  } catch (error) {
    // Sem dia pela metade: como dias existentes são ignorados, ele não seria completado depois.
    await db.from('routines').delete().eq('id', routine.id);
    throw error;
  }
}

const baseSpec = { name: seed.base.name, weekday: null, isBase: true, position: 0 };
const baseSections = [{ title: seed.base.sectionTitle, isBaseSlot: false, prayers: seed.base.prayers }];
const routinesToWrite = force ? seed.routines : plan.newRoutines;

if (force) must(await db.from('routines').delete().eq('user_id', user_id), 'limpar rotinas');
if (force || plan.createBase) await writeRoutine(baseSpec, baseSections);
for (const routine of routinesToWrite) {
  await writeRoutine({ name: routine.name, weekday: routine.weekday, isBase: false, position: routine.weekday + 1 }, routine.sections);
}
console.log('Pronto. Remova SEED_USER_EMAIL e SEED_USER_PASSWORD do .env.local.');
await db.auth.signOut();
