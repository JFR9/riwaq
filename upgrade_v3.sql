-- تحديث رِواق v3 للمشروع الذي شغّلت له schema.sql سابقاً.
-- شغّل هذا الملف مرة واحدة في Supabase > SQL Editor.

alter table public.profiles add column if not exists email text not null default '';
alter table public.profiles add column if not exists last_seen_at timestamptz;
update public.profiles p set email = u.email from auth.users u where u.id = p.id and p.email = '';

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name, email, role)
  values (new.id, coalesce(nullif(new.raw_user_meta_data ->> 'display_name',''), split_part(coalesce(new.email,'student'), '@', 1)), coalesce(new.email,''), 'student')
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

drop policy if exists "Admins can read all profiles" on public.profiles;
create policy "Admins can read all profiles" on public.profiles for select to authenticated using (public.is_admin());

drop policy if exists "Admin full access subjects" on public.subjects;
create policy "Admin full access subjects" on public.subjects for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "Admin full access notes" on public.notes;
create policy "Admin full access notes" on public.notes for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "Admin full access reports" on public.reports;
create policy "Admin full access reports" on public.reports for all to authenticated using (public.is_admin()) with check (public.is_admin());

create table if not exists public.user_activity (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null default 'visit' check (event_type in ('login','visit','open_note')),
  details text not null default '',
  created_at timestamptz not null default now()
);
alter table public.user_activity enable row level security;
drop policy if exists "Users insert own activity" on public.user_activity;
create policy "Users insert own activity" on public.user_activity for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "Users read own activity" on public.user_activity;
create policy "Users read own activity" on public.user_activity for select to authenticated using (user_id = auth.uid());
drop policy if exists "Admins read all activity" on public.user_activity;
create policy "Admins read all activity" on public.user_activity for select to authenticated using (public.is_admin());

create table if not exists public.schedule_events (
 id uuid primary key default gen_random_uuid(),
 title text not null check (char_length(title) between 1 and 180),
 event_type text not null default 'lecture' check (event_type in ('lecture','exam','assignment','other')),
 subject_id uuid references public.subjects(id) on delete set null,
 event_at timestamptz not null,
 location text not null default '',
 description text not null default '',
 is_visible boolean not null default true,
 created_at timestamptz not null default now()
);
alter table public.schedule_events enable row level security;
drop policy if exists "Public read visible schedule" on public.schedule_events;
create policy "Public read visible schedule" on public.schedule_events for select to anon, authenticated using (is_visible = true);
drop policy if exists "Admins manage schedule" on public.schedule_events;
create policy "Admins manage schedule" on public.schedule_events for all to authenticated using (public.is_admin()) with check (public.is_admin());
