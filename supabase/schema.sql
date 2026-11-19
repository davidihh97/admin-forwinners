-- For Winners · esquema de base de datos para el panel de administración.
-- Ejecuta este archivo una sola vez en Supabase → SQL Editor → Run.

create table if not exists public.content (
  key        text primary key,          -- 'operations' | 'site_draft' | 'site_published'
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.content enable row level security;

-- Cualquiera (la página pública) puede LEER solo el contenido publicado.
drop policy if exists "public read published" on public.content;
create policy "public read published" on public.content
  for select using (key = 'site_published');

-- Solo el administrador autenticado puede leer y escribir todo.
drop policy if exists "admin all" on public.content;
create policy "admin all" on public.content
  for all to authenticated using (true) with check (true);

-- Historial automático de cambios (para poder recuperar versiones anteriores).
create table if not exists public.content_history (
  id         bigserial primary key,
  key        text not null,
  value      jsonb not null,
  saved_at   timestamptz not null default now()
);
alter table public.content_history enable row level security;
drop policy if exists "admin history" on public.content_history;
create policy "admin history" on public.content_history
  for all to authenticated using (true) with check (true);

create or replace function public.content_snapshot() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- guarda como máximo una copia cada 10 minutos por clave
  if not exists (
    select 1 from public.content_history
    where key = old.key and saved_at > now() - interval '10 minutes'
  ) then
    insert into public.content_history(key, value) values (old.key, old.value);
  end if;
  return new;
end $$;

drop trigger if exists content_snapshot on public.content;
create trigger content_snapshot before update on public.content
  for each row execute function public.content_snapshot();

-- Imágenes subidas desde el diseñador (bucket público "media").
insert into storage.buckets (id, name, public) values ('media', 'media', true)
  on conflict (id) do nothing;
drop policy if exists "admin upload media" on storage.objects;
create policy "admin upload media" on storage.objects
  for insert to authenticated with check (bucket_id = 'media');
drop policy if exists "admin manage media" on storage.objects;
create policy "admin manage media" on storage.objects
  for update to authenticated using (bucket_id = 'media');
