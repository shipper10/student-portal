import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "./supabaseAdmin";
import { ROLES } from "./constants";

// Roles: admin (listed in ADMIN_CLERK_USER_IDS), student (ID link approved by an
// admin), visitor (approved by an admin), guest (signed in, nothing approved yet).
// Server-side only.
function adminIds() {
  return (process.env.ADMIN_CLERK_USER_IDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
export const isAdminId = (id) => adminIds().includes(id);

export async function getSession() {
  const { userId } = await auth();
  if (!userId) return null;
  const db = supabaseAdmin();
  const [link, visitor] = await Promise.all([
    db.from("account_links").select("student_id, status").eq("clerk_user_id", userId).maybeSingle(),
    db.from("approved_visitors").select("clerk_user_id").eq("clerk_user_id", userId).maybeSingle(),
  ]);
  if (link.error) throw link.error;
  if (visitor.error) throw visitor.error;
  const approved = link.data?.status === "approved";
  const studentId = approved ? link.data.student_id : null;
  const isAdmin = isAdminId(userId);
  return {
    userId,
    isAdmin,
    studentId,
    pendingStudentId: link.data && !approved ? link.data.student_id : null,
    role: isAdmin ? ROLES.ADMIN : studentId ? ROLES.STUDENT : visitor.data ? ROLES.VISITOR : ROLES.GUEST,
  };
}

// Page access: admin always; guests never; otherwise a per-person override (set by an
// admin) wins over the role default (table role_access).
export async function canView(session, page) {
  if (!session) return false;
  if (session.role === ROLES.ADMIN) return true;
  if (session.role === ROLES.GUEST) return false;
  const db = supabaseAdmin();
  const [own, byRole] = await Promise.all([
    db.from("user_access").select("allowed").eq("clerk_user_id", session.userId).eq("page", page).maybeSingle(),
    db.from("role_access").select("allowed").eq("page", page).eq("role", session.role).maybeSingle(),
  ]);
  if (own.error) throw own.error;
  if (byRole.error) throw byRole.error;
  if (own.data) return own.data.allowed === true;
  return byRole.data?.allowed === true;
}
