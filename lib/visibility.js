// Which years non-admins may see. Admins see everything.
//   board   -> everyone's results (board, analytics)
//   profile -> a student's own results
export async function loadYearVisibility(db) {
  const { data, error } = await db.from("year_visibility").select("year, board, profile");
  if (error) throw error;
  return data;
}
export const visibleYears = (rows, field) => new Set(rows.filter((r) => r[field]).map((r) => r.year));
