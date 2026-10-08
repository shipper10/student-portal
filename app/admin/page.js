"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import PageHeader from "../components/PageHeader";
import { PERMISSIONS } from "../../lib/permissions";
import { PAGES, ACCESS_ROLES } from "../../lib/constants";

const PAGE_LABELS = { [PAGES.BOARD]: "Results board", [PAGES.ANALYTICS]: "Analytics" };
const ROLE_LABELS = { student: "Students", visitor: "Visitors" };
const card = "rounded-xl border border-gray-200 dark:border-gray-700 p-4";
const nav = "hidden sm:inline-block px-3 py-2 rounded-lg text-sm border border-gray-300 dark:border-gray-700 whitespace-nowrap";
const input = "rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1 text-sm";
const btn = "px-2 py-1 rounded border border-gray-300 dark:border-gray-700 text-xs hover:bg-gray-100 dark:hover:bg-gray-800";
const fmt = (d) => new Date(d).toLocaleString();
const short = (id) => (id ? id.slice(0, 12) : "—");
const COURSE_OPTIONS = [["none", "No course grades"], ["sem1", "First semester only"], ["sem2", "Second semester only"], ["both", "Both semesters"]];
const overrideValue = (v) => (v === true ? "allow" : v === false ? "deny" : "default");

async function call(url, method, body) {
  const res = await fetch(url, {
    method,
    cache: "no-store",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const d = await res.json();
  if (!res.ok || d.error) throw new Error(d.error || "Failed");
  return d;
}

// A collapsed section with an arrow (closed by default, like the audit log).
function Section({ title, count, children }) {
  return (
    <details className={`group ${card}`}>
      <summary className="cursor-pointer select-none flex items-center gap-2 font-semibold list-none [&::-webkit-details-marker]:hidden">
        <span className="text-gray-400 text-xs transition-transform group-open:rotate-90">▶</span>
        {title}
        {count != null && <span className="font-normal text-gray-500 dark:text-gray-400">({count})</span>}
      </summary>
      <div className="mt-3">{children}</div>
    </details>
  );
}

// A table that scrolls inside its own box (sideways on a phone, up/down when long).
function DataTable({ head, children, minWidth = 560 }) {
  return (
    <div className="max-h-[60vh] overflow-auto rounded-lg border border-gray-200 dark:border-gray-700">
      <table className="w-full text-sm" style={{ minWidth }}>
        <thead className="sticky top-0 bg-gray-100 dark:bg-gray-800 text-left text-xs text-gray-600 dark:text-gray-300">
          <tr>{head.map((h) => <th key={h} className="px-2 py-2 font-medium whitespace-nowrap">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">{children}</tbody>
      </table>
    </div>
  );
}
const td = "px-2 py-1.5";

// Each section is shown only if the account has its permission; the API routes
// enforce the same permissions on the server.
export default function AdminPage() {
  const [perms, setPerms] = useState(null);
  const [links, setLinks] = useState(null);
  const [access, setAccess] = useState({});
  const [years, setYears] = useState([]);
  const [audit, setAudit] = useState([]);
  const [detail, setDetail] = useState([]);
  const [detailMissing, setDetailMissing] = useState(false);
  const [users, setUsers] = useState(null);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("");
  const [userFilter, setUserFilter] = useState("");
  const has = (p) => perms?.includes(p);

  async function load(p = perms) {
    try {
      if (p.includes(PERMISSIONS.LINKS_MANAGE)) setLinks(await call("/api/admin/links"));
      if (p.includes(PERMISSIONS.ACCESS_MANAGE)) {
        const d = await call("/api/admin/access");
        setAccess(Object.fromEntries(d.access.map((x) => [x.page + ":" + x.role, x.allowed])));
        setAudit(d.audit);
        setYears((await call("/api/admin/years")).years);
        const dd = await call("/api/admin/detail");
        setDetail(dd.rows);
        setDetailMissing(!!dd.missing);
      }
      if (p.includes(PERMISSIONS.USERS_MANAGE)) setUsers(await call("/api/admin/users"));
      setError(null);
    } catch (e) {
      setError(String(e.message || e));
    }
  }

  useEffect(() => {
    call("/api/me")
      .then((d) => {
        if (!d.permissions.includes(PERMISSIONS.ADMIN_PANEL)) throw new Error("This page is for administrators only.");
        setPerms(d.permissions);
        return load(d.permissions);
      })
      .catch((e) => setError(String(e.message || e)));
  }, []);

  // run an action, then refresh; show the server's message if it refuses
  async function act(fn) {
    try {
      await fn();
      setError(null);
    } catch (e) {
      setError(String(e.message || e));
    }
    load();
  }
  const toggleRole = (page, role) => act(() => call("/api/admin/access", "PUT", { page, role, allowed: !access[page + ":" + role] }));
  const setDetailField = (subject, field, value) => act(() => call("/api/admin/detail", "PUT", { subject, field, value }));
  const roleDetail = (role, field) => detail.find((r) => r.subject === `role:${role}`)?.[field];
  const toggleYear = (year, field, value) => act(() => call("/api/admin/years", "PUT", { year, field, value }));
  const decide = (l, decision) => act(() => call("/api/admin/requests", "POST", { clerkUserId: l.clerk_user_id, decision }));
  const unlink = (l) =>
    window.confirm(`Unlink ${l.email || "this account"} from ID ${l.student_id}?`) &&
    act(() => call("/api/admin/links", "DELETE", { clerkUserId: l.clerk_user_id }));
  const userAction = (u, action, extra = {}) => act(() => call("/api/admin/users", "POST", { userId: u.id, action, ...extra }));

  const pending = (links?.links || []).filter((l) => l.status === "pending");
  const q = filter.trim().toLowerCase();
  const approved = (links?.links || []).filter(
    (l) => l.status === "approved" && (!q || [l.email, l.student_id, l.name_en, l.name_ar].some((v) => v && String(v).toLowerCase().includes(q)))
  );
  const uq = userFilter.trim().toLowerCase();
  const people = (users?.users || []).filter((u) => !uq || [u.email, u.name].some((v) => v && v.toLowerCase().includes(uq)));
  const roleOf = (u) => (u.isAdmin ? "Admin" : u.studentId ? `Student ${u.studentId}` : u.visitor ? "Visitor" : u.pendingStudentId ? `Pending ${u.pendingStudentId}` : "Not approved");

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-gray-100 transition-colors">
      <div className="max-w-4xl mx-auto p-3 sm:p-4 space-y-3">
        <PageHeader title="Admin">
          <Link href="/profile" className={nav}>👤 Profile</Link>
          <Link href="/" className={nav}>🏆 Board</Link>
        </PageHeader>
        {error && <p className="text-red-600">{error}</p>}
        {!perms && !error && <p className="text-gray-500">Loading…</p>}

        {has(PERMISSIONS.LINKS_MANAGE) && pending.length > 0 && (
          <section className={`${card} border-amber-400`}>
            <h2 className="font-semibold mb-2">Waiting for approval ({pending.length})</h2>
            <ul className="text-sm space-y-2">
              {pending.map((l) => (
                <li key={l.clerk_user_id} className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    {l.email || short(l.clerk_user_id)} asks for ID <b>{l.student_id}</b> ({l.name_en || "unknown"}) · {fmt(l.requested_at)}
                  </span>
                  <span className="flex gap-2">
                    <button onClick={() => decide(l, "approve")} className={`${btn} text-green-700 dark:text-green-400`}>Approve</button>
                    <button onClick={() => decide(l, "reject")} className={`${btn} text-red-600`}>Reject</button>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {has(PERMISSIONS.USERS_MANAGE) && users && (
          <Section title="People" count={users.users.length}>
            <input value={userFilter} onChange={(e) => setUserFilter(e.target.value)} placeholder="Search name or email" className={`${input} mb-2 w-full sm:w-72`} />
            <DataTable head={["Account", "Status", "Board", "Analytics", "Card", "Courses", "Actions"]} minWidth={900}>
              {people.map((u) => {
                const editable = !u.isAdmin && (u.studentId || u.visitor);
                return (
                  <tr key={u.id}>
                    <td className={td}>
                      <div className="font-medium">{u.name || u.email || short(u.id)}</div>
                      {u.name && u.email && <div className="text-xs text-gray-500">{u.email}</div>}
                    </td>
                    <td className={`${td} whitespace-nowrap`}>
                      {roleOf(u)}
                      {u.banned && <span className="ml-1 text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">banned</span>}
                    </td>
                    {Object.values(PAGES).map((p) => (
                      <td key={p} className={td}>
                        {editable ? (
                          <select className={input} value={overrideValue(u.access[p])} onChange={(e) => userAction(u, "access", { page: p, allowed: e.target.value === "default" ? null : e.target.value === "allow" })}>
                            <option value="default">default</option>
                            <option value="allow">allow</option>
                            <option value="deny">deny</option>
                          </select>
                        ) : <span className="text-gray-400">—</span>}
                      </td>
                    ))}
                    <td className={td}>
                      {editable ? (
                        <select className={input} value={u.detail.card === null ? "default" : u.detail.card ? "on" : "off"} onChange={(e) => setDetailField(`user:${u.id}`, "card", e.target.value === "default" ? null : e.target.value === "on")}>
                          <option value="default">default</option>
                          <option value="on">card on</option>
                          <option value="off">card off</option>
                        </select>
                      ) : <span className="text-gray-400">—</span>}
                    </td>
                    <td className={td}>
                      {editable ? (
                        <select className={input} value={u.detail.courses ?? "default"} onChange={(e) => setDetailField(`user:${u.id}`, "courses", e.target.value === "default" ? null : e.target.value)}>
                          <option value="default">default</option>
                          {COURSE_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                        </select>
                      ) : <span className="text-gray-400">—</span>}
                    </td>
                    <td className={`${td} whitespace-nowrap`}>
                      {!u.isAdmin && (
                        <span className="flex gap-2">
                          {!u.studentId && (u.visitor
                            ? <button onClick={() => userAction(u, "revoke_visitor")} className={btn}>Remove visitor</button>
                            : <button onClick={() => userAction(u, "approve_visitor")} className={btn}>Approve visitor</button>)}
                          <button onClick={() => userAction(u, u.banned ? "unban" : "ban")} className={`${btn} ${u.banned ? "" : "text-red-600"}`}>{u.banned ? "Unban" : "Ban"}</button>
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {people.length === 0 && <tr><td colSpan={7} className={`${td} text-gray-500`}>No accounts.</td></tr>}
            </DataTable>
          </Section>
        )}

        {has(PERMISSIONS.LINKS_MANAGE) && links && (
          <Section title="Linked students" count={`${approved.length} of ${links.total_students}`}>
            <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Search email, ID or name" className={`${input} mb-2 w-full sm:w-72`} />
            <DataTable head={["Student", "ID", "Email", "Linked", ""]} minWidth={640}>
              {approved.map((l) => (
                <tr key={l.clerk_user_id}>
                  <td className={td}>{l.name_en || "—"}</td>
                  <td className={td}>{l.student_id}</td>
                  <td className={td}>{l.email || "—"}</td>
                  <td className={`${td} whitespace-nowrap`}>{fmt(l.linked_at)}</td>
                  <td className={td}><button onClick={() => unlink(l)} className="text-red-600 hover:underline">Unlink</button></td>
                </tr>
              ))}
              {approved.length === 0 && <tr><td colSpan={5} className={`${td} text-gray-500`}>No linked accounts.</td></tr>}
            </DataTable>
          </Section>
        )}

        {has(PERMISSIONS.ACCESS_MANAGE) && (
          <>
            <Section title="Student card on the board">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                The card that opens when a row is tapped, and the course columns. Hidden courses are removed from the card and from the
                board&apos;s columns, so they cannot be shown another way. Names, GPAs and ranks always stay. Per-person settings are in People.
              </p>
              {detailMissing && <p className="text-sm text-amber-600 mb-3">Run supabase/migrations/002_detail_policy.sql once in Supabase to enable this.</p>}
              <table className="text-sm">
                <thead><tr><th className="text-left pr-6 pb-2"></th>{ACCESS_ROLES.map((r) => <th key={r} className="px-4 pb-2">{ROLE_LABELS[r]}</th>)}</tr></thead>
                <tbody>
                  <tr>
                    <td className="pr-6 py-1">Details card</td>
                    {ACCESS_ROLES.map((r) => (
                      <td key={r} className="text-center px-4">
                        <input type="checkbox" className="h-4 w-4" checked={roleDetail(r, "card") !== false} onChange={() => setDetailField(`role:${r}`, "card", roleDetail(r, "card") === false)} />
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="pr-6 py-1">Course grades</td>
                    {ACCESS_ROLES.map((r) => (
                      <td key={r} className="px-2 py-1">
                        <select className={input} value={roleDetail(r, "courses") ?? "both"} onChange={(e) => setDetailField(`role:${r}`, "courses", e.target.value)}>
                          {COURSE_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                        </select>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </Section>

            <Section title="Years visible to non-admins">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                Board = everyone&apos;s results on the board and analytics. Profile = a student&apos;s own results. Hidden years also stay out of the GPA and ranking people see.
              </p>
              <table className="text-sm">
                <thead><tr><th className="text-left pr-6 pb-2">Year</th><th className="px-4 pb-2">Board</th><th className="px-4 pb-2">Profile</th></tr></thead>
                <tbody>
                  {years.map((y) => (
                    <tr key={y.year}>
                      <td className="pr-6 py-1">Year {y.year}</td>
                      {["board", "profile"].map((f) => (
                        <td key={f} className="text-center px-4">
                          <input type="checkbox" className="h-4 w-4" checked={y[f]} onChange={() => toggleYear(y.year, f, !y[f])} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>

            <Section title="Default access by role">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">Administrators always have access. Per-person overrides are in the People section.</p>
              <table className="text-sm">
                <thead>
                  <tr><th className="text-left pr-6 pb-2"></th>{ACCESS_ROLES.map((r) => <th key={r} className="px-4 pb-2">{ROLE_LABELS[r]}</th>)}</tr>
                </thead>
                <tbody>
                  {Object.values(PAGES).map((p) => (
                    <tr key={p}>
                      <td className="pr-6 py-1">{PAGE_LABELS[p]}</td>
                      {ACCESS_ROLES.map((r) => (
                        <td key={r} className="text-center px-4">
                          <input type="checkbox" className="h-4 w-4" checked={!!access[p + ":" + r]} onChange={() => toggleRole(p, r)} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>
          </>
        )}

        {has(PERMISSIONS.AUDIT_VIEW) && (
          <>
            {links && (
              <Section title="Recent failed link attempts" count={links.failed.length}>
                <ul className="text-sm space-y-1">
                  {links.failed.map((f, i) => <li key={i}>{fmt(f.at)} · {f.email || short(f.clerk_user_id)} tried ID {f.student_id}</li>)}
                  {links.failed.length === 0 && <li className="text-gray-500">None.</li>}
                </ul>
              </Section>
            )}
            <Section title="Audit log" count={audit.length}>
              <ul className="text-sm space-y-1">
                {audit.map((a, i) => (
                  <li key={i}>
                    {fmt(a.at)} · {short(a.actor_id)} · {a.action} · {a.entity_id}
                    {a.details?.from !== undefined ? ` (${String(a.details.from)} → ${String(a.details.to)})` : a.details?.to !== undefined ? ` (${a.details.page}: ${String(a.details.to)})` : a.details?.email ? ` (${a.details.email})` : ""}
                  </li>
                ))}
                {audit.length === 0 && <li className="text-gray-500">Nothing yet.</li>}
              </ul>
            </Section>
          </>
        )}
      </div>
    </main>
  );
}
