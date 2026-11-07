# Orações

App pessoal de orações diárias: abre no dia de hoje, tem uma base comum a todos os dias (Primícias)
e guarda cada oração uma só vez, reaproveitada entre os dias.

## Rodar sem configurar nada

```bash
npm install
npm run dev:demo
```

Abra o endereço mostrado e entre com `demo@oracoes.local` / `demo`. Nesse modo os dados ficam só no navegador.

## Configurar o Supabase

1. Crie um projeto em supabase.com.
2. No SQL Editor, execute `supabase/migrations/0001_init.sql`.
3. Em Authentication > Users, crie sua conta (Add user, com e-mail e senha).
4. Em Authentication > Sign In / Providers, desative "Allow new users to sign up".
5. Copie `.env.example` para `.env.local` e preencha os valores (Project Settings > API).
6. Rode `npm run seed` para gravar as orações importadas.
7. `npm run dev` para usar o app com os dados reais.

A chave `service_role` só é usada por `npm run seed`. Ela ignora todas as regras de acesso, então nunca deve
ter o prefixo `VITE_` nem ir para a Vercel. Depois da importação, pode removê-la do `.env.local`.

`npm run seed` recusa rodar se a conta já tiver dados, porque sobrescreveria o que foi editado no app.
Para forçar: `npm run seed -- --force`.

## Publicar na Vercel

Importe o repositório ou use `npx vercel`, e defina `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.

## Testes

```bash
npm test            # unidade, importação e regras de acesso (RLS) em Postgres real via PGlite
npm run test:e2e    # navegador, no modo demonstração (desktop e celular)
```

## Importação do Notion

`npm run import:notion` gera `data/seed.json` a partir de `data/notion-raw.json`. Com `-- --refresh`, baixa de
novo as páginas, que precisam estar publicadas. Para incluir outros dias, acrescente as páginas em `PAGES`, em
`scripts/import-notion.mjs`, e ajuste as contagens em `validateSeed`. Só leitura: nada é alterado no Notion.
