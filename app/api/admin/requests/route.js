import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { route, json } from "../../../../lib/http";
import { PERMISSIONS } from "../../../../lib/permissions";
import { logAudit } from "../../../../lib/audit";

export const dynamic = "force-dynamic";

// Approve or reject a student's request to link a university ID.
export const POST = route({ permission: PERMISSIONS.LINKS_MANAGE }, async (request, session) => {
  const b = await request.json().catch(() => ({}));
  const clerkUserId = String(b.clerkUserId || "");
  if (!clerkUserId || !["approve", "reject"].includes(b.decision)) return json({ error: "Invalid input" }, 400);
  const db = supabaseAdmin();
  const { data: row } = await db.from("account_links").select("student_id, email, status").eq("clerk_user_id", clerkUserId).maybeSingle();
  if (!row || row.status !== "pending") return json({ error: "No pending request for this account." }, 404);

  if (b.decision === "reject") {
    const { error } = await db.from("account_links").delete().eq("clerk_user_id", clerkUserId);
    if (error) throw error;
    await db.from("link_events").insert({ clerk_user_id: clerkUserId, student_id: row.student_id, email: row.email, action: "rejected" });
    await logAudit(db, session, "link.reject", "account_link", row.student_id, { email: row.email, clerk_user_id: clerkUserId });
    return json({ ok: true });
  }
  const { error } = await db
    .from("account_links")
    .update({ status: "approved", reviewed_by: session.userId, reviewed_at: new Date().toISOString() })
    .eq("clerk_user_id", clerkUserId);
  if (error) {
    if (error.code === "23505") return json({ error: "This ID is already linked to another approved account. Unlink that account first." }, 409);
    throw error;
  }
  await logAudit(db, session, "link.approve", "account_link", row.student_id, { email: row.email, clerk_user_id: clerkUserId });
  return json({ ok: true });
});
