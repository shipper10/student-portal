import { currentUser } from "@clerk/nextjs/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { route, json } from "../../../lib/http";
import { MAX_FAILED_LINKS_PER_HOUR, MAX_REJECTED_LINKS_PER_DAY } from "../../../lib/constants";

export const dynamic = "force-dynamic";

// Requests to link the signed-in account to a university ID; an administrator approves it.
// A wrong ID gives one generic message so this endpoint can't be used to probe which IDs exist.
export const POST = route({}, async (request, session) => {
  if (session.studentId) return json({ error: "Your account is already linked." }, 409);
  if (session.pendingStudentId) return json({ error: "Your request is already waiting for approval." }, 409);

  const body = await request.json().catch(() => ({}));
  const studentId = String(body.studentId || "").trim();
  if (!studentId || studentId.length > 40) return json({ error: "Enter your university ID." }, 400);

  const db = supabaseAdmin();
  const since = new Date(Date.now() - 3600 * 1000).toISOString();
  const countSince = async (action, from) =>
    (await db.from("link_events").select("id", { count: "exact", head: true })
      .eq("clerk_user_id", session.userId).eq("action", action).gte("at", from)).count || 0;
  const dayAgo = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  if ((await countSince("failed", since)) >= MAX_FAILED_LINKS_PER_HOUR || (await countSince("rejected", dayAgo)) >= MAX_REJECTED_LINKS_PER_DAY) {
    return json({ error: "Too many attempts. Try again later or contact the administrator." }, 429);
  }

  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress ?? null;
  const fail = async () => {
    await db.from("link_events").insert({ clerk_user_id: session.userId, student_id: studentId, email, action: "failed" });
    return json({ error: "This ID can't be linked. Check the number, or contact the administrator." }, 400);
  };

  const { data: student } = await db.from("students").select("student_id").eq("student_id", studentId).maybeSingle();
  if (!student) return fail();
  // Not linked yet: an administrator must approve this request first.
  const { error } = await db.from("account_links").insert({ clerk_user_id: session.userId, student_id: studentId, email, status: "pending" });
  if (error) throw error;
  await db.from("link_events").insert({ clerk_user_id: session.userId, student_id: studentId, email, action: "request" });
  return json({ ok: true, pending: true });
});
