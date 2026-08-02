-- 山海島 cloud world — run once in Supabase SQL Editor

create table if not exists public.worlds (
  id text primary key,
  name text not null default '山海主世界',
  width int not null default 72,
  height int not null default 72,
  map_code text, -- LZ-String compressed map payload
  updated_at timestamptz not null default now()
);

alter table public.worlds enable row level security;

drop policy if exists "anon_read_worlds" on public.worlds;
drop policy if exists "anon_insert_worlds" on public.worlds;
drop policy if exists "anon_update_worlds" on public.worlds;

-- Prototype: open read/write for the editor (tighten later with auth)
create policy "anon_read_worlds" on public.worlds
  for select to anon using (true);
create policy "anon_insert_worlds" on public.worlds
  for insert to anon with check (true);
create policy "anon_update_worlds" on public.worlds
  for update to anon using (true) with check (true);

grant select, insert, update on public.worlds to anon;
grant select, insert, update on public.worlds to authenticated;

-- Seed the one 1000×1000 world (safe to re-run)
insert into public.worlds (id, name, width, height, map_code)
values ('main', '山海主世界', 72, 72, null)
on conflict (id) do update
  set width = excluded.width,
      height = excluded.height,
      name = excluded.name;
