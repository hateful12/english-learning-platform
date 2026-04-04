/** Normalize DB optional ids (SQLite may store ""). */
export function normalizeHomeworkTargetId(value: string | null | undefined): string | null {
  if (value == null) return null;
  const t = String(value).trim();
  return t.length ? t : null;
}

/**
 * Whether this logged-in student should see a homework row.
 * Broadcast: both targets empty. Individual: row.studentId must match viewer (groupId ignored).
 * Group: row.studentId empty and row.groupId in viewer's groups.
 */
export function studentSeesHomeworkRow(args: {
  rowStudentId: string | null | undefined;
  rowGroupId: string | null | undefined;
  viewerStudentId: string;
  viewerGroupIds: string[];
}): boolean {
  const sid = normalizeHomeworkTargetId(args.rowStudentId);
  const gid = normalizeHomeworkTargetId(args.rowGroupId);
  if (!sid && !gid) return true;
  if (sid) return sid === args.viewerStudentId;
  return !!gid && args.viewerGroupIds.includes(gid);
}
