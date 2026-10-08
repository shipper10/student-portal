-- Migration 002 (existing database): run once in the SQL Editor.
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
