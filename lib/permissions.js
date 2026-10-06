import { ROLES } from "./constants";

// Single place that answers "who may do what".
// Add a permission: 1) define it here, 2) list it under the role(s) below,
// 3) protect the API route with route({ permission }), 4) check it in the UI.
// Page visibility for students/visitors is separate (admin-controlled, role_access).
export const PERMISSIONS = {
  ADMIN_PANEL: "admin.panel",
  LINKS_MANAGE: "links.manage",
  ACCESS_MANAGE: "access.manage",
  USERS_MANAGE: "users.manage",
  AUDIT_VIEW: "audit.view",
};

const ROLE_PERMISSIONS = {
  [ROLES.ADMIN]: Object.values(PERMISSIONS),
  [ROLES.STUDENT]: [],
  [ROLES.VISITOR]: [],
  [ROLES.GUEST]: [],
};

export const permissionsOf = (session) => (session ? ROLE_PERMISSIONS[session.role] ?? [] : []);
export const can = (session, permission) => permissionsOf(session).includes(permission);
