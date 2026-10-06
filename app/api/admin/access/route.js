import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { route, json } from "../../../../lib/http";
import { PERMISSIONS, can } from "../../../../lib/permissions";
import { PAGES, ACCESS_ROLES } from "../../../../lib/constants";
import { logAudit } from "../../../../lib/audit";

export const dynamic = "force-dynamic";

export const GET = route({ permission: PERMISSIONS.ACCESS_MANAGE }, async (_request, session) => {
  const db = supabaseAdmin();
  const [access, audit] = await Promise.all([
    db.from("role_access").select("page, role, allowed"),
    can(session, PERMISSIONS.AUDIT_VIEW)
      ? db.from("audit_log").select("actor_id, action, entity, entity_id, details, at").order("at", { ascending: false }).limit(30)
      : { data: [] },
  ]);
  for (const r of [access, audit]) if (r.error) throw r.error;
  return json({ access: access.data, audit: audit.data });
});

// Changing who can see what is a privacy decision, so it is written to the audit log.
export const PUT = route({ permission: PERMISSIONS.ACCESS_MANAGE }, async (request, session) => {
  const b = await request.json().catch(() => ({}));
  if (!Object.values(PAGES).includes(b.page) || !ACCESS_ROLES.includes(b.role) || typeof b.allowed !== "boolean") {
    return json({ error: "Invalid input" }, 400);
  }
  const db = supabaseAdmin();
  const { data: old } = await db.from("role_access").select("allowed").eq("page", b.page).eq("role", b.role).maybeSingle();
  const { error } = await db.from("role_access").upsert({ page: b.page, role: b.role, allowed: b.allowed }, { onConflict: "page,role" });
  if (error) throw error;
  await logAudit(db, session, "access.update", "role_access", `${b.page}:${b.role}`, { from: old?.allowed ?? null, to: b.allowed });
  return json({ ok: true });
});
