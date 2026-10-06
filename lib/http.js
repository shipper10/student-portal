import { NextResponse } from "next/server";
import { NO_STORE } from "./constants";
import { getSession, canView } from "./auth";
import { can } from "./permissions";

export const json = (body, status = 200) => NextResponse.json(body, { status, headers: NO_STORE });

// Wraps an API handler: sign-in check, optional permission or page-access
// check, and one uniform error response. Every route goes through this.
//   route({ permission }, handler)   admin operations
//   route({ page }, handler)         board / analytics data
//   route({}, handler)               any signed-in user
export function route({ permission, page } = {}, handler) {
  return async (request) => {
    try {
      const session = await getSession();
      if (!session) return json({ error: "Unauthorized" }, 401);
      if (permission && !can(session, permission)) return json({ error: "Forbidden" }, 403);
      if (page && !(await canView(session, page))) return json({ error: "Forbidden" }, 403);
      return await handler(request, session);
    } catch (err) {
      console.error(err);
      return json({ error: "Server error" }, 500);
    }
  };
}
