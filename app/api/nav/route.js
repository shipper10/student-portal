import { canView } from "../../../lib/auth";
import { route, json } from "../../../lib/http";
import { PAGES } from "../../../lib/constants";
import { permissionsOf } from "../../../lib/permissions";

export const dynamic = "force-dynamic";

// Light endpoint for the navigation bar: what this account may open.
export const GET = route({}, async (_request, session) =>
  json({
    role: session.role,
    permissions: permissionsOf(session),
    access: { board: await canView(session, PAGES.BOARD), analytics: await canView(session, PAGES.ANALYTICS) },
  })
);
