/** Shared helpers for cooking class child participant rows. */

export type ChildParticipantRow = Record<string, unknown>;

export function getChildDisplayName(child: ChildParticipantRow): string {
  return String(child.fullName || child.full_name || child.name || '').trim();
}

/** Remove blank participant slots (empty name) from a children array. */
export function filterFilledChildren(children: unknown): ChildParticipantRow[] {
  if (!Array.isArray(children)) return [];
  return children.filter((row) => {
    if (!row || typeof row !== 'object') return false;
    return getChildDisplayName(row as ChildParticipantRow).length > 0;
  }) as ChildParticipantRow[];
}
