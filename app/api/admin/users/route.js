import { clerkClient } from "@clerk/nextjs/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { route, json } from "../../../../lib/http";
import { PERMISSIONS } from "../../../../lib/permissions";
import { PAGES } from "../../../../lib/constants";
import { isAdminId } from "../../../../lib/auth";
import { logAudit } from "../../../../lib/audit";
import { isMissingTable } from "../../../../lib/detail";

export const dynamic = "force-dynamic";

// Clerk returns users in pages; read them all so nobody silently disappears from the list.
async function allClerkUsers(client) {
  const PAGE = 500;
  const users = [];
  for (let offset = 0; offset < 10000; offset += PAGE) {
    const { data, totalCount } = await client.users.getUserList({ limit: PAGE, offset, orderBy: "-created_at" });
    users.push(...data);
    if (data.length < PAGE || users.length >= totalCount) break;
  }
  return users;
}

// Everyone who created an account (from Clerk) with their status in this app.
export const GET = route({ permission: PERMISSIONS.USERS_MANAGE }, async () => {
  const db = supabaseAdmin();
  const client = await clerkClient();
  const [clerkUsers, links, visitors, overrides, details] = await Promise.all([
    allClerkUsers(client),
    db.from("account_links").select("clerk_user_id, student_id, status"),
    db.from("approved_visitors").select("clerk_user_id"),
    db.from("user_access").select("clerk_user_id, page, allowed"),
    db.from("detail_policy").select("subject, card, courses").like("subject", "user:%"),
  ]);
  for (const r of [links, visitors, overrides]) if (r.error) throw r.error;
  if (details.error && !isMissingTable(details.error)) throw details.error; // migration 002 may not be run yet
  const detailRows = details.data || [];
  const linkOf = new Map(links.data.map((x) => [x.clerk_user_id, x]));
  const visitorIds = new Set(visitors.data.map((x) => x.clerk_user_id));
  const users = clerkUsers.map((u) => {
    const link = linkOf.get(u.id);
    const access = {};
    for (const o of overrides.data) if (o.clerk_user_id === u.id) access[o.page] = o.allowed;
    const d = detailRows.find((x) => x.subject === `user:${u.id}`);
    return {
      id: u.id,
      detail: { card: d?.card ?? null, courses: d?.courses ?? null },
      email: u.emailAddresses.find((e) => e.id === u.primaryEmailAddressId)?.emailAddress ?? null,
      name: [u.firstName, u.lastName].filter(Boolean).join(" ") || null,
      createdAt: u.createdAt,
      banned: u.banned,
      isAdmin: isAdminId(u.id),
      studentId: link?.status === "approved" ? link.student_id : null,
      pendingStudentId: link?.status === "pending" ? link.student_id : null,
      visitor: visitorIds.has(u.id),
      access,
    };
  });
  return json({ users, total: users.length });
});

// One action per call: approve_visitor | revoke_visitor | ban | unban | access
export const POST = route({ permission: PERMISSIONS.USERS_MANAGE }, async (request, session) => {
  const b = await request.json().catch(() => ({}));
  const userId = String(b.userId || "");
  if (!userId || isAdminId(userId)) return json({ error: "Invalid user" }, 400);
  const db = supabaseAdmin();
  const done = async (action, details) => {
    await logAudit(db, session, action, "user", userId, details);
    return json({ ok: true });
  };
  switch (b.action) {
    case "approve_visitor": {
      const { error } = await db.from("approved_visitors").upsert({ clerk_user_id: userId, approved_by: session.userId }, { onConflict: "clerk_user_id" });
      if (error) throw error;
      return done("visitor.approve");
    }
    case "revoke_visitor": {
      const { error } = await db.from("approved_visitors").delete().eq("clerk_user_id", userId);
      if (error) throw error;
      return done("visitor.revoke");
    }
    case "ban":
    case "unban": {
      const client = await clerkClient();
      await (b.action === "ban" ? client.users.banUser(userId) : client.users.unbanUser(userId));
      return done("user." + b.action);
    }
    case "access": {
      if (!Object.values(PAGES).includes(b.page) || !(b.allowed === null || typeof b.allowed === "boolean")) return json({ error: "Invalid input" }, 400);
      const q = b.allowed === null
        ? db.from("user_access").delete().eq("clerk_user_id", userId).eq("page", b.page)
        : db.from("user_access").upsert({ clerk_user_id: userId, page: b.page, allowed: b.allowed }, { onConflict: "clerk_user_id,page" });
      const { error } = await q;
      if (error) throw error;
      return done("user_access.update", { page: b.page, to: b.allowed });
    }
    default:
      return json({ error: "Unknown action" }, 400);
  }
});
