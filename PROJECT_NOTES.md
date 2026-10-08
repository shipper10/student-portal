# BahriMed B13 portal: project notes

Put this file in the repository root next to README.md. README says how things work;
this file says why, what was decided, and what is next. When starting a new conversation
with an AI assistant, upload the repository zip and this file first.

## What it is
Results portal for one batch (Batch 13, about 221 students, 6-year program, cohorts 23 and 24
are sub-groups of the same batch). Students sign in, see the results board and their own
profile; the owner (admin) controls who gets in and what each person or year shows.
Stack: Next.js 15 (App Router), Clerk 7 (sign-in; UI theme comes from `@clerk/ui/themes`, not the old `@clerk/themes`), Supabase (database, server-side only),
hosted on Vercel at bahrimedb13.vercel.app. Baseline version: "phase H".

## Rules decided by the owner (do not change without asking)
- No data in code: marks, GPAs, year weights, courses live in the database.
- The site does **not** calculate semester or year GPAs; the owner enters them with the letter
  grades. The only computed value is the weighted overall GPA (year weights 5/10/10/15/20/40
  from table `year_weights`); years without a year GPA are left out and the result shows
  "Provisional" until all 6 years exist, then "Final".
- Supplementary (ملحق): counts within the first GPA, a pass gives only C. Substitute (بديل):
  does not count until the exam is sat, then graded by the grade achieved. Stored as
  `grades.attempt_type` + `original_grade`; one row per student and course.
- Ranking: a year view ranks on that year's GPA; a cumulative view ranks only students who
  completed every year up to it (see `lib/academics.js`, tests in `tests/`).
- Email + password sign-in (not one-time codes). Sign-in required for every page.
- Roles: admin, student, visitor (people outside the batch), guest (signed in, nothing approved).
- Board layout (sort, columns, pins, filter, view) is remembered per device in localStorage.
- Courses are added by the owner in Supabase (`courses` table), not in code.
- The admin controls the board's details card per role and per person (`detail_policy`): card on/off and
  which semester's course grades are visible; hidden items must disappear from every other place too.
- Profile shows two rows: latest year (GPA + ranks) and CGPA over the years completed in a row (+ ranks).
  Ranks only compare students who completed the same years.
- The admin may link and unlink their own account to a student record to test the site.

## Current state and settings to remember
- Students link their own ID immediately (`AUTO_APPROVE_STUDENT_LINKS = true` in
  `app/api/link/route.js`). Set it to `false` to require admin approval again.
- Admin accounts are the Clerk user IDs in the Vercel variable `ADMIN_CLERK_USER_IDS`.
  The Clerk **production** instance has its own users, separate from development.
- Clerk on vercel.app: no DNS; the app serves `/__clerk` (see `middleware.js`).
  A custom domain later gives branded emails and email links.
- Database changes: `supabase/schema.sql` is for a new project only; changes for the existing
  database go in numbered files in `supabase/migrations/`.
- Migrations to run once in Supabase on the existing database: 001 (remove old columns), 002 (detail policy).
- Checks: `npm test` and `npm run build` run on every push (`.github/workflows/ci.yml`).

## Known limits and risks (review these when feedback arrives)
- Anyone who knows a valid university ID can link it (no proof of ownership). The ID is masked on
  the board, but IDs may be guessable.
- All students can see each other's results; confirm this is allowed by the university.
- Results are entered with scripts (`scripts/import.mjs`, `scripts/export.mjs`) run from the
  owner's computer; there is no editing screen in the site yet.
- Check the Supabase plan limits (inactivity pause, backups) before relying on it long term.
- The admin "People" list reads every Clerk account; fine for hundreds, review if it grows a lot.

## Ideas for later (not decided)
1. Import a results file from the admin page (preview and validation before saving, same CSV
   format as `scripts/import.mjs`).
2. Edit grades in the admin page (spreadsheet-like grid per year), with the audit log.
3. Helpers for the admin (for example a class representative who can only approve link
   requests): database-backed permissions on top of `lib/permissions.js`.
4. Notify students when a new year is published.
5. Student card: compare with the batch average; Arabic/English interface.
6. Scheduled database backup/export.

## Where things live
See the table "Where things live" in README.md.
