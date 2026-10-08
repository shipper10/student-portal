import { ROLES } from "./constants";
import { COURSE_LEVELS, SEMESTERS_OF, relSemester } from "./academics";

export { COURSE_LEVELS, SEMESTERS_OF, relSemester };

// How much of a student card (and of the course columns on the board) an account may see.
// Admins see everything. A per-person setting overrides the role default (table detail_policy).
// PostgREST reports a table that was not created yet with one of these codes
export const isMissingTable = (e) => ["42P01", "PGRST205"].includes(e?.code);

export async function getDetailPolicy(db, session) {
  if (session.role === ROLES.ADMIN) return { card: true, semesters: [1, 2] };
  const { data, error } = await db
    .from("detail_policy")
    .select("subject, card, courses")
    .in("subject", [`role:${session.role}`, `user:${session.userId}`]);
  if (error) {
    if (isMissingTable(error)) return { card: true, semesters: [1, 2] }; // table not created yet: no restrictions set
    throw error;
  }
  const role = data.find((r) => r.subject === `role:${session.role}`);
  const user = data.find((r) => r.subject === `user:${session.userId}`);
  const card = user?.card ?? role?.card ?? true;
  const courses = user?.courses ?? role?.courses ?? "both";
  return { card, semesters: SEMESTERS_OF[courses] ?? [] };
}
