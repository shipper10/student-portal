import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { route, json } from "../../../../lib/http";
import { PERMISSIONS } from "../../../../lib/permissions";
import { logAudit } from "../../../../lib/audit";

export const dynamic = "force-dynamic";
const FIELDS = ["board", "profile"];

export const GET = route({ permission: PERMISSIONS.ACCESS_MANAGE }, async () => {
  const { data, error } = await supabaseAdmin().from("year_visibility").select("year, board, profile").order("year");
  if (error) throw error;
  return json({ years: data });
});

// Publish / hide one year for non-admins: board = everyone's results, profile = a student's own.
export const PUT = route({ permission: PERMISSIONS.ACCESS_MANAGE }, async (request, session) => {
  const b = await request.json().catch(() => ({}));
  if (!Number.isInteger(b.year) || b.year < 1 || b.year > 6 || !FIELDS.includes(b.field) || typeof b.value !== "boolean") {
    return json({ error: "Invalid input" }, 400);
  }
  const db = supabaseAdmin();
  const { data: old } = await db.from("year_visibility").select(b.field).eq("year", b.year).maybeSingle();
  const { error } = await db.from("year_visibility").upsert({ year: b.year, [b.field]: b.value }, { onConflict: "year" });
  if (error) throw error;
  await logAudit(db, session, "year_visibility.update", "year_visibility", `${b.year}:${b.field}`, { from: old?.[b.field] ?? null, to: b.value });
  return json({ ok: true });
});
