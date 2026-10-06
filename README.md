# Student Results Portal

Sign-in only. Students see the results board and their own profile; an administrator
controls who gets in and what each person or year shows. Stack: Next.js 14, Supabase
(database only, server-side), Clerk (sign-in).

## Set up (new project)
1. **Supabase:** SQL Editor -> run `supabase/schema.sql` once. (Existing project? Run
   `supabase/migrations/001_remove_legacy_columns.sql` step by step instead; it removes the old flat columns safely.)
2. **Clerk:** create an application, enable Email + Password. Optionally set Access mode
   to invite-only / allowlist if your plan has it (the app also gates by approval, below).
3. **Environment** (`.env.local` and your host): copy `.env.example` and fill it in.
   `ADMIN_CLERK_USER_IDS` = comma-separated Clerk user IDs (`user_...`) of administrators.
4. Deploy, sign up, put your own user ID in `ADMIN_CLERK_USER_IDS`, redeploy.

## Who can do what
| Role | How someone becomes it | Sees |
|---|---|---|
| guest | creates an account | Profile page only |
| student | asks to link a university ID, admin approves | board / analytics if enabled, own profile |
| visitor | admin presses "Approve as visitor" | only what the admin enables |
| admin | listed in `ADMIN_CLERK_USER_IDS` | everything + `/admin` |

`/admin`: approve or reject ID requests, approve/ban people, per-person page overrides,
role defaults, which **years** non-admins can see (board / profile), unlink accounts,
audit log. A hidden year is also left out of the GPA and ranking people see.

## Daily work
* **Add courses:** Supabase -> Table Editor -> `courses` (code, name, short_name,
  credit_hours, semester 1-12; semesters 1-2 = year 1 ... 11-12 = year 6), then run
  `select public.refresh_wide_views();`.
* **Enter results:** import a year from a CSV (one row per student, one column per course
  code): `node scripts/import.mjs data/year2.csv --year 2 --dry-run`, then without `--dry-run`.
  Cells: `B+`; `C/F` = passed the supplementary with C after F; `B/Sub` = substitute exam
  sat; `Sub` = not sat yet. Empty cells are skipped.
* **Edit in a spreadsheet:** `node scripts/export.mjs --year 1` writes a CSV the importer reads back.
  Both scripts need `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
* **Read results as a wide table:** Table Editor -> views `wide_year_1` ... (one row per student).
* GPAs (semester and year) are typed by you; the site only shows them and computes the
  weighted overall GPA from `year_weights` (5, 10, 10, 15, 20, 40).

## Ranking rules
A year view ranks on that year's GPA. A cumulative view ("Years 1-N", "Final") ranks only
students who completed every year 1..N; the others show "Incomplete". "Final" appears only
when all years exist. Ties share a rank. Details: `lib/academics.js`.

## Where things live
| Question | File |
|---|---|
| GPA, ranking, board views | `lib/academics.js` (tests in `tests/`) |
| Who may do what | `lib/permissions.js`, table `role_access`, `user_access`, `year_visibility` |
| Session and roles | `lib/auth.js` |
| API wrapper (sign-in, permission, errors) | `lib/http.js` |
| Names and constants | `lib/constants.js` |
| Audit log | `lib/audit.js` |
| Database structure | `supabase/schema.sql` |

Add a permission: define it in `lib/permissions.js`, list it under the role, wrap the API
route with `route({ permission })`, show/hide the UI from `permissions` in `/api/me`.

## Database changes
`supabase/schema.sql` is the complete current schema for a NEW project. An existing project
never re-runs it: every later change is a new numbered file in `supabase/migrations/`
(run it once, in order), and `schema.sql` is updated in the same commit so the two always agree.
`tests/schema.test.mjs` fails if the code reads a table, or the schema calls a function, that
`schema.sql` does not define.

## Checks
`npm test` (ranking tests) and `npm run build`; `.github/workflows/ci.yml` runs both on every push.
