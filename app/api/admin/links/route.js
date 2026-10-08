import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { route, json } from "../../../../lib/http";
import { PERMISSIONS, can } from "../../../../lib/permissions";
import { logAudit } from "../../../../lib/audit";

export const dynamic = "force-dynamic";

export const GET = route({ permission: PERMISSIONS.LINKS_MANAGE }, async (_request, session) => {
  const db = supabaseAdmin();
  const canAudit = can(session, PERMISSIONS.AUDIT_VIEW);
  const [links, failed, total] = await Promise.all([
    db.from("account_links").select("clerk_user_id, student_id, email, linked_at, status, requested_at").order("requested_at", { ascending: false }),
    canAudit ? db.from("link_events").select("clerk_user_id, student_id, email, at").eq("action", "failed").order("at", { ascending: false }).limit(20) : { data: [] },
    db.from("students").select("student_id", { count: "exact", head: true }),
  ]);
  for (const r of [links, failed]) if (r.error) throw r.error;
  const names = {};
  const ids = links.data.map((l) => l.student_id);
  if (ids.length) {
    const { data, error } = await db.from("students").select("student_id, name_en, name_ar").in("student_id", ids);
    if (error) throw error;
    for (const s of data) names[s.student_id] = s;
  }
  return json({
    total_students: total.count || 0,
    links: links.data.map((l) => ({ ...l, name_en: names[l.student_id]?.name_en ?? null, name_ar: names[l.student_id]?.name_ar ?? null })),
    failed: failed.data,
  });
});

// Unlink: frees the university ID; the person can link again themselves.
export const DELETE = route({ permission: PERMISSIONS.LINKS_MANAGE }, async (request, session) => {
  const body = await request.json().catch(() => ({}));
  const clerkUserId = String(body.clerkUserId || "");
  if (!clerkUserId) return json({ error: "Missing user" }, 400);
  const db = supabaseAdmin();
  const { data: row } = await db.from("account_links").select("student_id, email").eq("clerk_user_id", clerkUserId).maybeSingle();
  if (!row) return json({ error: "Link not found" }, 404);
  const { error } = await db.from("account_links").delete().eq("clerk_user_id", clerkUserId);
  if (error) throw error;
  await logAudit(db, session, "link.unlink", "account_link", row.student_id, { email: row.email, clerk_user_id: clerkUserId });
  return json({ ok: true });
});
