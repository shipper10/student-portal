-- Migration 001: remove the old flat columns from `students` (existing database only; a new
-- project uses schema.sql). Future database changes go in new numbered files in this folder.
-- Cleanup for the EXISTING database. Run it STEP BY STEP in the Supabase SQL Editor
-- (select one step, press Run, read the result, then go on). Steps 1-2 only read.
-- Nothing here touches the new tables' data except the small fixes in step 4.

-- ===== STEP 1 (read only): what is in the database? =====
-- Tables that exist in this project. Anything not in the list in schema.sql belongs to
-- something else (for example an older results page): decide about it yourself, this file never drops it.
select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' order by 1;

-- How many students, and per cohort (compare with the number you expect)
select cohort, count(*) from public.students group by cohort order by cohort;
select count(*) as students_total from public.students;

-- Possible duplicates (same English or Arabic name appearing twice)
select name_en, count(*), array_agg(student_id) as ids from public.students group by name_en having count(*) > 1;
select name_ar, count(*), array_agg(student_id) as ids from public.students where name_ar is not null group by name_ar having count(*) > 1;

-- Students with no results at all, and results with odd values
select s.student_id, s.name_en from public.students s
 where not exists (select 1 from public.grades g where g.student_id = s.student_id)
   and not exists (select 1 from public.year_results y where y.student_id = s.student_id and y.gpa is not null);
select grade, attempt_type, count(*) from public.grades group by 1, 2 order by 3 desc;
select cohort, count(*) from public.students where cohort not in ('23','24') group by cohort;

-- ===== STEP 2 (read only): is it safe to remove the old flat columns of `students`? =====
-- Old cells that have a value vs. rows in the new `grades` table for the same 13 courses.
-- The two numbers must be equal. If they are not, STOP and do not run step 3.
select
  (select count(*) from public.students s cross join lateral (values
      (s.s1_english_1),(s.s1_english_2),(s.s1_study_skills),(s.s1_cell_biology),(s.s1_chemistry),(s.s1_mathematics),
      (s.s1_medical_physics),(s.s1_sociology_psychology),(s.s2_english_special_purposes),(s.s2_biomolecules),
      (s.s2_human_biology),(s.s2_homeostasis),(s.s2_community_health)) v(g)
    where v.g is not null and v.g <> '') as old_cells,
  (select count(*) from public.grades g join public.courses c on c.id = g.course_id
    where c.code in ('UBEL1101','UBEL1102','UBUS1103','MDCR1101','MDCR1102','MDCR1103','MDCR1104','MDCR1105',
                     'UBEL1201','MDCR1201','MDCR1202','MDCR1203','MDCR1204')) as new_rows,
  (select count(*) from public.students where gpa is not null) as old_year_gpa,
  (select count(*) from public.year_results where year = 1 and gpa is not null) as new_year_gpa;

-- ===== STEP 3: backup, then drop the old columns (only if step 2 matched) =====
-- The backup table keeps the old values; drop it later yourself when you are sure.
create table if not exists public.students_legacy_backup as select * from public.students;
alter table public.students_legacy_backup enable row level security;

do $$
declare old_cells int; new_rows int;
begin
  select count(*) into old_cells from public.students s cross join lateral (values
      (s.s1_english_1),(s.s1_english_2),(s.s1_study_skills),(s.s1_cell_biology),(s.s1_chemistry),(s.s1_mathematics),
      (s.s1_medical_physics),(s.s1_sociology_psychology),(s.s2_english_special_purposes),(s.s2_biomolecules),
      (s.s2_human_biology),(s.s2_homeostasis),(s.s2_community_health)) v(g)
    where v.g is not null and v.g <> '';
  select count(*) into new_rows from public.grades g join public.courses c on c.id = g.course_id
    where c.code in ('UBEL1101','UBEL1102','UBUS1103','MDCR1101','MDCR1102','MDCR1103','MDCR1104','MDCR1105',
                     'UBEL1201','MDCR1201','MDCR1202','MDCR1203','MDCR1204');
  if old_cells <> new_rows then
    raise exception 'Not safe: % old cells but % rows in grades. Nothing was dropped.', old_cells, new_rows;
  end if;
  alter table public.students
    drop column if exists gpa, drop column if exists remark, drop column if exists sem1_gpa, drop column if exists sem2_gpa,
    drop column if exists s1_cell_biology, drop column if exists s1_chemistry, drop column if exists s1_english_1,
    drop column if exists s1_english_2, drop column if exists s1_sociology_psychology, drop column if exists s1_mathematics,
    drop column if exists s1_medical_physics, drop column if exists s1_study_skills, drop column if exists s2_biomolecules,
    drop column if exists s2_community_health, drop column if exists s2_homeostasis, drop column if exists s2_human_biology,
    drop column if exists s2_english_special_purposes;
end $$;
drop index if exists public.students_student_id_idx;   -- duplicate of the unique constraint on student_id

-- ===== STEP 4: small fixes, rules and indexes =====
update public.grades set grade = btrim(grade) where grade <> btrim(grade);
update public.students set name_en = btrim(name_en), name_ar = nullif(btrim(name_ar), '') where name_en <> btrim(name_en) or name_ar <> btrim(name_ar);
create index if not exists grades_course_idx on public.grades (course_id);
alter table public.grades drop constraint if exists grades_attempt_type_check;
alter table public.grades add constraint grades_attempt_type_check check (attempt_type in ('regular','supplementary','substitute'));
alter table public.account_links drop constraint if exists account_links_status_check;
alter table public.account_links add constraint account_links_status_check check (status in ('pending','approved'));
do $$ begin
  if to_regproc('public.refresh_wide_views') is not null then perform public.refresh_wide_views(); end if;
end $$;

-- ===== STEP 5 (read only): final check =====
select column_name from information_schema.columns where table_schema = 'public' and table_name = 'students' order by ordinal_position;
