-- Student Results Portal - complete CURRENT schema.
-- For a NEW project: run this whole file once in the Supabase SQL Editor.
-- For the EXISTING project: do NOT run this; run supabase/cleanup.sql instead.
-- Structure only: no student data lives in any code or SQL file here.
-- The browser never talks to Supabase; only the Next.js server does (service-role
-- key), so every table has Row Level Security ON and NO policies.

-- ---------- people and curriculum ----------
create table if not exists public.students (
  id bigint generated always as identity primary key,
  student_id text not null unique,           -- real university ID; masked before it reaches the browser
  name_en text not null,
  name_ar text,
  cohort text not null default '23'          -- sub-group of the batch: '23' | '24'
);
create index if not exists students_cohort_idx on public.students (cohort);

-- Semesters run 1..12 (1-2 = year 1, 3-4 = year 2 ... 11-12 = year 6).
-- Add future courses in Table Editor -> courses, then run: select public.refresh_wide_views();
create table if not exists public.courses (
  id bigint generated always as identity primary key,
  code text not null unique,
  name text not null,
  short_name text,                           -- compact label for table headers and cards
  credit_hours numeric not null,
  semester int not null check (semester between 1 and 12),
  sort_order int not null default 0,
  active boolean not null default true
);

-- ---------- results (entered by the administrator; the site never recalculates them) ----------
create table if not exists public.grades (
  student_id text not null references public.students(student_id) on delete cascade,
  course_id bigint not null references public.courses(id) on delete cascade,
  grade text,                                -- the grade shown: A, B+, B, C, F, Sub
  attempt_type text not null default 'regular' check (attempt_type in ('regular','supplementary','substitute')),
  original_grade text,                       -- e.g. F before a supplementary pass
  primary key (student_id, course_id)
);
create index if not exists grades_course_idx on public.grades (course_id);

create table if not exists public.semester_results (
  student_id text not null references public.students(student_id) on delete cascade,
  semester int not null check (semester between 1 and 12),
  gpa numeric,
  primary key (student_id, semester)
);
create table if not exists public.year_results (
  student_id text not null references public.students(student_id) on delete cascade,
  year int not null check (year between 1 and 6),
  gpa numeric,
  remark text,
  primary key (student_id, year)
);
create table if not exists public.year_weights (
  year int primary key check (year between 1 and 6),
  weight numeric not null                    -- percent of the final GPA
);

-- ---------- accounts, access and audit ----------
create table if not exists public.account_links (
  clerk_user_id text primary key,
  student_id text not null references public.students(student_id) on delete cascade,
  email text,
  status text not null default 'pending' check (status in ('pending','approved')),
  linked_at timestamptz not null default now(),
  requested_at timestamptz not null default now(),
  reviewed_by text,
  reviewed_at timestamptz
);
-- many pending requests per ID are fine, but only ONE approved account per ID
create unique index if not exists account_links_one_approved on public.account_links (student_id) where status = 'approved';

create table if not exists public.link_events (
  id bigint generated always as identity primary key,
  clerk_user_id text not null,
  student_id text,
  email text,
  action text not null,                      -- request | failed
  at timestamptz not null default now()
);
create index if not exists link_events_user_idx on public.link_events (clerk_user_id, action, at desc);

create table if not exists public.approved_visitors (
  clerk_user_id text primary key,
  approved_by text not null,
  approved_at timestamptz not null default now()
);
create table if not exists public.role_access (
  page text not null,                        -- board | analytics
  role text not null,                        -- student | visitor
  allowed boolean not null default false,
  primary key (page, role)
);
create table if not exists public.user_access (
  clerk_user_id text not null,
  page text not null,
  allowed boolean not null,                  -- overrides the role default for this person
  primary key (clerk_user_id, page)
);
create table if not exists public.year_visibility (
  year int primary key check (year between 1 and 6),
  board boolean not null default false,      -- everyone's results (board, analytics)
  profile boolean not null default false     -- a student's own results
);
-- Student card on the board: the administrator can turn the details card off, or limit which
-- course grades (first / second semester of each year) non-admins can see. subject is
-- 'role:student', 'role:visitor' or 'user:<clerk user id>'; a NULL column means "use the role default".
create table if not exists public.detail_policy (
  subject text primary key,
  card boolean,
  courses text check (courses in ('none','sem1','sem2','both'))
);
alter table public.detail_policy enable row level security;
insert into public.detail_policy (subject, card, courses) values
  ('role:student', true, 'both'), ('role:visitor', true, 'both')
on conflict (subject) do nothing;

create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  actor_id text not null,
  action text not null,
  entity text not null,
  entity_id text,
  details jsonb,
  at timestamptz not null default now()
);
create index if not exists audit_log_at_idx on public.audit_log (at desc);

do $$
declare t text;
begin
  foreach t in array array['students','courses','grades','semester_results','year_results','year_weights','account_links',
                           'link_events','approved_visitors','role_access','user_access','year_visibility','detail_policy','audit_log']
  loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- ---------- default settings ----------
insert into public.year_weights (year, weight) values (1,5),(2,10),(3,10),(4,15),(5,20),(6,40) on conflict (year) do nothing;
insert into public.role_access (page, role, allowed) values
  ('board','student',true), ('analytics','student',true), ('board','visitor',false), ('analytics','visitor',false)
on conflict (page, role) do nothing;
insert into public.year_visibility (year, board, profile) values (1,true,true),(2,false,false),(3,false,false),(4,false,false),(5,false,false),(6,false,false)
on conflict (year) do nothing;

insert into public.courses (code, name, short_name, credit_hours, semester, sort_order) values
 ('UBEL1101','English Language Skills I','Eng I',4,1,1),
 ('UBEL1102','English Language Skills II','Eng II',4,1,2),
 ('UBUS1103','University Study Skills','Study Skills',2,1,3),
 ('MDCR1101','Cell Biology','Cell Bio',2,1,4),
 ('MDCR1102','Chemistry','Chem',4,1,5),
 ('MDCR1103','Mathematics','Math',2,1,6),
 ('MDCR1104','Physics','Physics',2,1,7),
 ('MDCR1105','Introduction to Sociology and Psychology','Socio/Psych',2,1,8),
 ('UBEL1201','English Language for Special Purposes','ESP',3,2,1),
 ('MDCR1201','Biomolecules','Biomol',3,2,2),
 ('MDCR1202','Human Biology','Human Bio',4,2,3),
 ('MDCR1203','Homeostasis','Homeostasis',3,2,4),
 ('MDCR1204','Community Health and Health Delivery','Comm Health',2,2,5)
on conflict (code) do nothing;

-- ---------- wide, human-readable views (one row per student, one column per course) ----------
create or replace function public.refresh_wide_views() returns void
language plpgsql as $fn$
declare
  y int;
  cols text;
begin
  for y in select distinct (semester + 1) / 2 from public.courses where active order by 1 loop
    select string_agg(format('max(case when c.code = %L then g.grade end) as %I', c.code, c.code), ', ' order by c.semester, c.sort_order, c.code)
      into cols
      from public.courses c
     where c.active and (c.semester + 1) / 2 = y;
    execute format('drop view if exists public.wide_year_%s', y);
    execute format($v$
      create view public.wide_year_%1$s with (security_invoker = true) as
      select s.student_id, s.name_en, yr.gpa as year_gpa, yr.remark,
             (select sr.gpa from public.semester_results sr where sr.student_id = s.student_id and sr.semester = %2$s) as sem_%2$s_gpa,
             (select sr.gpa from public.semester_results sr where sr.student_id = s.student_id and sr.semester = %3$s) as sem_%3$s_gpa,
             %4$s
        from public.students s
        left join public.year_results yr on yr.student_id = s.student_id and yr.year = %1$s
        left join public.grades g on g.student_id = s.student_id
        left join public.courses c on c.id = g.course_id and (c.semester + 1) / 2 = %1$s
       group by s.student_id, s.name_en, yr.gpa, yr.remark
       order by s.name_en
    $v$, y, y * 2 - 1, y * 2, cols);
    execute format('revoke all on public.wide_year_%s from anon, authenticated', y);
  end loop;
end
$fn$;

select public.refresh_wide_views();
