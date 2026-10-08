import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { route, json } from "../../../../lib/http";
import { PERMISSIONS } from "../../../../lib/permissions";
import { COURSE_LEVELS, isMissingTable } from "../../../../lib/detail";
import { logAudit } from "../../../../lib/audit";

export const dynamic = "force-dynamic";

export const GET = route({ permission: PERMISSIONS.ACCESS_MANAGE }, async () => {
  const { data, error } = await supabaseAdmin().from("detail_policy").select("subject, card, courses");
  if (isMissingTable(error)) return json({ rows: [], missing: true }); // migration 002 not run yet
  if (error) throw error;
  return json({ rows: data });
});

// subject: "role:student" | "role:visitor" | "user:<id>"; field: "card" | "courses".
// null = use the role default (only allowed for a single person, not for a role).
export const PUT = route({ permission: PERMISSIONS.ACCESS_MANAGE }, async (request, session) => {
  const b = await request.json().catch(() => ({}));
  const isRole = b.subject === "role:student" || b.subject === "role:visitor";
  const isUser = typeof b.subject === "string" && /^user:[\w-]{3,}$/.test(b.subject);
  const valueOk = b.field === "card"
    ? typeof b.value === "boolean" || (isUser && b.value === null)
    : b.field === "courses" && (COURSE_LEVELS.includes(b.value) || (isUser && b.value === null));
  if (!(isRole || isUser) || !valueOk) return json({ error: "Invalid input" }, 400);
  const db = supabaseAdmin();
  const { data: old } = await db.from("detail_policy").select(b.field).eq("subject", b.subject).maybeSingle();
  const { error } = await db.from("detail_policy").upsert({ subject: b.subject, [b.field]: b.value }, { onConflict: "subject" });
  if (error) throw error;
  await logAudit(db, session, "detail.update", "detail_policy", `${b.subject}:${b.field}`, { from: old?.[b.field] ?? null, to: b.value });
  return json({ ok: true });
});
