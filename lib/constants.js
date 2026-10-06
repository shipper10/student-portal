// Application-wide names and rules. Change them here, not in each file.
// guest = signed in but not approved yet (sees nothing but the profile page).
export const ROLES = { ADMIN: "admin", STUDENT: "student", VISITOR: "visitor", GUEST: "guest" };
// Pages whose visibility the admin controls per role (table role_access).
export const PAGES = { BOARD: "board", ANALYTICS: "analytics" };
export const ACCESS_ROLES = [ROLES.STUDENT, ROLES.VISITOR];
export const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" };
export const MAX_FAILED_LINKS_PER_HOUR = 5;
export const MAX_REJECTED_LINKS_PER_DAY = 3;
// Sub-groups of the batch, in the order the filter buttons show them.
export const COHORTS = ["24", "23"];
export const emptyCohortCounts = () => Object.fromEntries(COHORTS.map((c) => [c, 0]));
export const GPA_MAX = 4;
