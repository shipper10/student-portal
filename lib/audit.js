// Who did what to which record. Used for administrative, data-changing actions only.
export async function logAudit(db, session, action, entity, entityId, details = null) {
  const { error } = await db.from("audit_log").insert({
    actor_id: session.userId,
    action,
    entity,
    entity_id: entityId == null ? null : String(entityId),
    details,
  });
  if (error) console.error("audit log failed", error);
}
