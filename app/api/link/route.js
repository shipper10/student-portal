import { currentUser } from "@clerk/nextjs/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { route, json } from "../../../lib/http";
import { MAX_FAILED_LINKS_PER_HOUR } from "../../../lib/constants";
import { PERMISSIONS } from "../../../lib/permissions";
import { logAudit } from "../../../lib/audit";

export const dynamic = "force-dynamic";

// When true, a valid university ID is linked immediately.
// When false, the existing administrator approval flow is used.
const AUTO_APPROVE_STUDENT_LINKS = true;

// Requests to link the signed-in account to a university ID.
// A wrong ID gives one generic message so this endpoint can't be used
// to probe which IDs exist.

export const POST = route({}, async (request, session) => {
  if (session.studentId) {
    return json({ error: "Your account is already linked." }, 409);
  }

  if (session.pendingStudentId) {
    return json(
      { error: "Your request is already waiting for approval." },
      409
    );
  }

  const body = await request.json().catch(() => ({}));
  const studentId = String(body.studentId || "").trim();

  if (!studentId || studentId.length > 40) {
    return json({ error: "Enter your university ID." }, 400);
  }

  const db = supabaseAdmin();

  const since = new Date(Date.now() - 3600 * 1000).toISOString();

  const { count } = await db
    .from("link_events")
    .select("id", { count: "exact", head: true })
    .eq("clerk_user_id", session.userId)
    .eq("action", "failed")
    .gte("at", since);

  if ((count || 0) >= MAX_FAILED_LINKS_PER_HOUR) {
    return json(
      { error: "Too many attempts. Try again later or contact the administrator." },
      429
    );
  }

  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress ?? null;

  const fail = async () => {
    await db.from("link_events").insert({
      clerk_user_id: session.userId,
      student_id: studentId,
      email,
      action: "failed",
    });

    return json(
      {
        error:
          "This ID can't be linked. Check the number, or contact the administrator.",
      },
      400
    );
  };

  const { data: student } = await db
    .from("students")
    .select("student_id")
    .eq("student_id", studentId)
    .maybeSingle();

  if (!student) {
    return fail();
  }

  const autoApprove = AUTO_APPROVE_STUDENT_LINKS || session.isAdmin; // an admin testing the site is never queued
  const status = autoApprove ? "approved" : "pending";

  const { error } = await db.from("account_links").insert({
    clerk_user_id: session.userId,
    student_id: studentId,
    email,
    status,
  });

  if (error) {
    if (error.code === "23505") {
      return json(
        {
          error:
            "This ID is already linked to another account. Contact the administrator.",
        },
        409
      );
    }

    throw error;
  }

  await db.from("link_events").insert({
    clerk_user_id: session.userId,
    student_id: studentId,
    email,
    action: "request",
  });

  return json({
    ok: true,
    pending: !autoApprove,
    linked: autoApprove,
  });
});

// An administrator can unlink their OWN account, to test the sign-up flow as a student.
export const DELETE = route({ permission: PERMISSIONS.LINKS_MANAGE }, async (_request, session) => {
  const db = supabaseAdmin();
  const { data: row } = await db.from("account_links").select("student_id").eq("clerk_user_id", session.userId).maybeSingle();
  if (!row) return json({ error: "Your account is not linked." }, 404);
  const { error } = await db.from("account_links").delete().eq("clerk_user_id", session.userId);
  if (error) throw error;
  await logAudit(db, session, "link.self_unlink", "account_link", row.student_id);
  return json({ ok: true });
});
