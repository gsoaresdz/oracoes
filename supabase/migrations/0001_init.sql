-- Orações: cada texto existe uma vez e é reaproveitado entre a base e os dias.
create table public.prayers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  body text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, title)
);

-- Uma rotina é um dia da semana ou a base, que aparece em todos os dias.
create table public.routines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  weekday smallint check (weekday between 0 and 6),
  is_base boolean not null default false,
  position integer not null default 0,
  check ((is_base and weekday is null) or (not is_base and weekday is not null))
);
create unique index routines_one_base_per_user on public.routines (user_id) where is_base;

-- is_base_slot marca o lugar em que a base aparece dentro do dia.
create table public.routine_sections (
  id uuid primary key default gen_random_uuid(),
  routine_id uuid not null references public.routines (id) on delete cascade,
  title text not null default '',
  is_base_slot boolean not null default false,
  position integer not null default 0
);
create unique index routine_sections_one_slot on public.routine_sections (routine_id) where is_base_slot;
create index routine_sections_routine on public.routine_sections (routine_id, position);

create table public.routine_items (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.routine_sections (id) on delete cascade,
  -- Oração em uso não pode ser apagada.
  prayer_id uuid not null references public.prayers (id) on delete restrict,
  position integer not null default 0
);
create index routine_items_section on public.routine_items (section_id, position);
create index routine_items_prayer on public.routine_items (prayer_id);

create function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger prayers_touch before update on public.prayers
  for each row execute function public.touch_updated_at();

-- Acesso: cada pessoa só enxerga e altera o que é dela.
alter table public.prayers enable row level security;
alter table public.routines enable row level security;
alter table public.routine_sections enable row level security;
alter table public.routine_items enable row level security;

create policy prayers_own on public.prayers for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy routines_own on public.routines for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy sections_own on public.routine_sections for all to authenticated
  using (exists (select 1 from public.routines r where r.id = routine_id and r.user_id = auth.uid()))
  with check (exists (select 1 from public.routines r where r.id = routine_id and r.user_id = auth.uid()));

create policy items_own on public.routine_items for all to authenticated
  using (exists (
    select 1 from public.routine_sections s
    join public.routines r on r.id = s.routine_id
    where s.id = section_id and r.user_id = auth.uid()
  ))
  with check (
    exists (
      select 1 from public.routine_sections s
      join public.routines r on r.id = s.routine_id
      where s.id = section_id and r.user_id = auth.uid()
    )
    and exists (select 1 from public.prayers p where p.id = prayer_id and p.user_id = auth.uid())
  );
