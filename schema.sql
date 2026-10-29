-- رِواق: مخطط قاعدة بيانات Supabase
-- بعد إنشاء حساب المسؤول، استبدل YOUR_ADMIN_EMAIL في أمر التعيين الموجود في نهاية الملف.
-- شغّل هذا الملف في Supabase Dashboard > SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  description text not null default '',
  semester smallint not null check (semester in (1,2)),
  icon text not null default '▤',
  accent text not null default '#8b7cff',
  sort_order integer not null default 0,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects(id) on delete restrict,
  title text not null check (char_length(title) between 1 and 180),
  description text not null default '',
  drive_url text not null check (drive_url ~ '^https://(drive\.google\.com|docs\.google\.com)/'),
  file_type text not null default 'PDF',
  sort_order integer not null default 0,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  note_title text not null default '',
  message text not null default 'الرابط لا يعمل',
  created_at timestamptz not null default now()
);

alter table public.subjects enable row level security;
alter table public.notes enable row level security;
alter table public.reports enable row level security;

-- المحتوى الظاهر للطلاب قابل للقراءة العامة فقط.
drop policy if exists "Public can read visible subjects" on public.subjects;
create policy "Public can read visible subjects" on public.subjects
  for select to anon, authenticated using (is_visible = true);

drop policy if exists "Public can read visible notes" on public.notes;
create policy "Public can read visible notes" on public.notes
  for select to anon, authenticated using (is_visible = true);




-- بيانات بداية اختيارية للمواد؛ احذفها إذا أردت البدء من لوحة الإدارة.
insert into public.subjects (name,description,semester,icon,accent,sort_order)
values
 ('أساسيات الإلكترونيات نظري','المحاضرات والملخصات النظرية',1,'ϟ','#8b7cff',1),
 ('الرياضيات الهندسية','القوانين والمسائل الهندسية',1,'∑','#4ed6c7',2),
 ('جرائم حزب البعث','المحاضرات والمصادر الدراسية',1,'▤','#f1a86a',3),
 ('لينكس عملي','الأوامر والتطبيقات العملية',1,'⌘','#61a7ff',4),
 ('لينكس نظري','مفاهيم أنظمة التشغيل',1,'⌁','#ed80b5',5)
on conflict do nothing;


-- حسابات الطلاب والمسؤول. كلمة المرور تُدار بأمان بواسطة Supabase Auth ولا تُخزّن في جدول profiles.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'طالب رِواق',
  email text not null default '',
  last_seen_at timestamptz,
  role text not null default 'student' check (role in ('student','admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles add column if not exists email text not null default '';
alter table public.profiles add column if not exists last_seen_at timestamptz;
update public.profiles p set email = u.email from auth.users u where u.id = p.id and p.email = '';
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;
alter table public.profiles enable row level security;
drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile" on public.profiles for select to authenticated using (id = auth.uid());
drop policy if exists "Admins can read all profiles" on public.profiles;
create policy "Admins can read all profiles" on public.profiles for select to authenticated
  using (public.is_admin());

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name, email, role)
  values (new.id, coalesce(nullif(new.raw_user_meta_data ->> 'display_name',''), split_part(coalesce(new.email,'student'), '@', 1)), coalesce(new.email,''), 'student')
  on conflict (id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

-- مفضلة المستخدم تحفظ على حسابه وتظهر له عند تسجيل الدخول من جهاز آخر.
create table if not exists public.favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  note_id uuid not null references public.notes(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, note_id)
);
alter table public.favorites enable row level security;
drop policy if exists "Users manage own favorites" on public.favorites;
create policy "Users manage own favorites" on public.favorites for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- بعد إنشاء حسابك من Supabase Authentication > Users، عيّن حسابك مسؤولاً يدوياً:
insert into public.profiles (id, display_name, role)
select id, coalesce(nullif(raw_user_meta_data ->> 'display_name',''), split_part(email, '@', 1)), 'admin'
from auth.users where lower(email) = lower('YOUR_ADMIN_EMAIL')
on conflict (id) do update set role = 'admin';
-- لا تمنح دور admin من واجهة الموقع ولا تضع كلمة المرور في ملفات GitHub.

-- سياسات الإدارة تُنشأ بعد جدول profiles حتى تعمل من أول تنفيذ للملف.
drop policy if exists "Admin full access subjects" on public.subjects;
create policy "Admin full access subjects" on public.subjects for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());
drop policy if exists "Admin full access notes" on public.notes;
create policy "Admin full access notes" on public.notes for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());
drop policy if exists "Admin full access reports" on public.reports;
create policy "Admin full access reports" on public.reports for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());


-- سجل نشاط بسيط (لا يسجل كلمات المرور أو بيانات حساسة).
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
create policy "Admins read all activity" on public.user_activity for select to authenticated
 using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- جدول اختياري للمحاضرات والامتحانات.
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
create policy "Admins manage schedule" on public.schedule_events for all to authenticated
 using (public.is_admin())
 with check (public.is_admin());

-- إعدادات الموقع والكورسات الديناميكية (v5). ملف الترقية upgrade_v5.sql متاح للمشاريع الحالية.
create table if not exists public.site_settings (
  id integer primary key check (id = 1), settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.site_settings enable row level security;
drop policy if exists "Public can read site settings" on public.site_settings;
create policy "Public can read site settings" on public.site_settings for select to anon, authenticated using (true);
drop policy if exists "Admins manage site settings" on public.site_settings;
create policy "Admins manage site settings" on public.site_settings for all to authenticated using (public.is_admin()) with check (public.is_admin());
insert into public.site_settings (id, settings) values (1, '{"site_title":"رِواق الجامعي","site_tagline":"مرجعك الدراسي، مرتب وبسيط.","telegram_url":"","contact_email":"","contact_message":"تواصل معي للاستفسارات والاقتراحات."}'::jsonb) on conflict (id) do nothing;
create table if not exists public.courses (
  id smallint generated by default as identity primary key, name text not null check (char_length(name) between 1 and 100),
  subtitle text not null default '', sort_order integer not null default 0, is_visible boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
insert into public.courses (id,name,subtitle,sort_order,is_visible) values (1,'الكورس الأول','الفصل الدراسي الأول',1,true),(2,'الكورس الثاني','الفصل الدراسي الثاني',2,true) on conflict (id) do nothing;
select setval(pg_get_serial_sequence('public.courses','id'), greatest((select coalesce(max(id),2) from public.courses),2), true);
alter table public.subjects drop constraint if exists subjects_semester_check;
alter table public.subjects drop constraint if exists subjects_semester_fkey;
alter table public.subjects add constraint subjects_semester_fkey foreign key (semester) references public.courses(id) on delete restrict;
alter table public.courses enable row level security;
drop policy if exists "Public can read visible courses" on public.courses;
create policy "Public can read visible courses" on public.courses for select to anon, authenticated using (is_visible = true);
drop policy if exists "Admins manage courses" on public.courses;
create policy "Admins manage courses" on public.courses for all to authenticated using (public.is_admin()) with check (public.is_admin());
