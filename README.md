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

### O que `npm run seed` faz

Entra com o seu e-mail e senha (`SEED_USER_EMAIL` e `SEED_USER_PASSWORD`), sem precisar da `service_role`, e
**só adiciona o que falta**: orações com título novo e dias da semana ainda sem cadastro. O que você editou no
app é preservado. Depois de rodar, remova as duas variáveis do `.env.local`.

- `npm run seed -- --dry-run` mostra o que seria feito, sem gravar nada.
- `npm run seed -- --force` sobrescreve os textos e recria a base e os dias, **perdendo edições feitas no app**.

## Publicar na Vercel

Importe o repositório ou use `npx vercel`, e defina `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.

## Testes

```bash
npm test            # unidade, importação e regras de acesso (RLS) em Postgres real via PGlite
npm run test:e2e    # navegador, no modo demonstração (desktop e celular)
```

## Importação do Notion

`npm run import:notion` gera `data/seed.json` a partir de `data/notion-raw.json`. Só baixa as páginas que faltam
no arquivo, e com `-- --refresh` baixa todas de novo; elas precisam estar publicadas. A lista fica em `PAGES`, em
`scripts/lib/notion-extract.mjs`, e as contagens esperadas em `validateSeed`. Só leitura: nada é alterado no Notion.
