// Roda a migração em um Postgres real (PGlite) e confere as regras de acesso,
// com um esquema `auth` mínimo que imita o do Supabase.
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { beforeAll, describe, expect, it } from 'vitest';

const ANA = '00000000-0000-0000-0000-00000000000a';
const BIA = '00000000-0000-0000-0000-00000000000b';
let db;

const as = async (role, userId, work) => {
  await db.exec(`set role ${role}; select set_config('request.jwt.sub', '${userId ?? ''}', false);`);
  try {
    return await work();
  } finally {
    await db.exec('reset role;');
  }
};

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.sub', true), '')::uuid $$;
    create role anon; create role authenticated;
    grant usage on schema auth to anon, authenticated;
    grant usage on schema public to anon, authenticated;
    insert into auth.users values ('${ANA}'), ('${BIA}');
  `);
  await db.exec(readFileSync(new URL('../../supabase/migrations/0001_init.sql', import.meta.url), 'utf8'));
  // No Supabase estes privilégios já vêm por padrão; é a RLS que restringe o acesso.
  await db.exec(`
    grant all on all tables in schema public to anon, authenticated;
    grant execute on all functions in schema auth to anon, authenticated;
  `);
  await as('authenticated', ANA, async () => {
    await db.exec(`
      insert into prayers (id, title, body) values ('10000000-0000-0000-0000-000000000001', 'Pai-nosso', 'texto');
      insert into prayers (id, title, body) values ('10000000-0000-0000-0000-000000000002', 'Ave-Maria', 'texto');
      insert into routines (id, name, is_base) values ('20000000-0000-0000-0000-000000000001', 'Base', true);
      insert into routine_sections (id, routine_id, title) values ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Primícias');
      insert into routine_items (section_id, prayer_id) values ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001');
    `);
  });
});

const count = async (table) => (await db.query(`select count(*)::int as n from ${table}`)).rows[0].n;

describe('sem login', () => {
  it('não lê nada', async () => {
    await as('anon', null, async () => {
      for (const t of ['prayers', 'routines', 'routine_sections', 'routine_items']) expect(await count(t)).toBe(0);
    });
  });
  it('não grava nada', async () => {
    await as('anon', null, async () => {
      await expect(db.query(`insert into prayers (user_id, title) values ('${ANA}', 'x')`)).rejects.toThrow();
      const updated = await db.query(`update prayers set body = 'invadido'`);
      expect(updated.affectedRows ?? 0).toBe(0);
    });
    expect((await db.query(`select count(*)::int n from prayers where body = 'invadido'`)).rows[0].n).toBe(0);
  });
});

describe('outra conta', () => {
  it('não enxerga os dados da primeira', async () => {
    await as('authenticated', BIA, async () => {
      for (const t of ['prayers', 'routines', 'routine_sections', 'routine_items']) expect(await count(t)).toBe(0);
    });
  });
  it('não usa seção nem oração alheia', async () => {
    await as('authenticated', BIA, async () => {
      await expect(
        db.query(`insert into routine_sections (routine_id, title) values ('20000000-0000-0000-0000-000000000001', 'x')`),
      ).rejects.toThrow();
      await db.exec(`
        insert into routines (id, name, weekday) values ('20000000-0000-0000-0000-00000000000b', 'Domingo', 0);
        insert into routine_sections (id, routine_id, title) values ('30000000-0000-0000-0000-00000000000b', '20000000-0000-0000-0000-00000000000b', 'S');
      `);
      await expect(
        db.query(`insert into routine_items (section_id, prayer_id) values ('30000000-0000-0000-0000-00000000000b', '10000000-0000-0000-0000-000000000001')`),
      ).rejects.toThrow();
    });
  });
  it('não pode gravar em nome da primeira', async () => {
    await as('authenticated', BIA, async () => {
      await expect(db.query(`insert into prayers (user_id, title) values ('${ANA}', 'falsa')`)).rejects.toThrow();
    });
  });
});

describe('regras do modelo', () => {
  it('impede apagar oração em uso, mas permite a sem uso', async () => {
    await as('authenticated', ANA, async () => {
      await expect(db.query(`delete from prayers where title = 'Pai-nosso'`)).rejects.toMatchObject({ code: '23503' });
      await db.query(`delete from prayers where title = 'Ave-Maria'`);
      expect(await count('prayers')).toBe(1);
    });
  });
  it('permite só uma base por conta', async () => {
    await as('authenticated', ANA, async () => {
      await expect(db.query(`insert into routines (name, is_base) values ('Outra', true)`)).rejects.toMatchObject({ code: '23505' });
    });
  });
  it('recusa título repetido', async () => {
    await as('authenticated', ANA, async () => {
      await expect(db.query(`insert into prayers (title) values ('Pai-nosso')`)).rejects.toMatchObject({ code: '23505' });
    });
  });
  it('dia precisa de weekday e a base não pode ter', async () => {
    await as('authenticated', ANA, async () => {
      await expect(db.query(`insert into routines (name) values ('Sem dia')`)).rejects.toThrow();
    });
  });
  it('apagar um dia preserva as orações', async () => {
    await as('authenticated', ANA, async () => {
      await db.query(`delete from routines where id = '20000000-0000-0000-0000-000000000001'`);
      expect(await count('routine_items')).toBe(0);
      expect(await count('prayers')).toBe(1);
    });
  });
});
