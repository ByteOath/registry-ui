/**
 * Tag protection matching for retention policies. Kept dependency-free so it can be
 * unit-tested with `node --test src/lib/tag-match.test.ts`.
 */

/** Parses a `latest, v*, prod-*` policy string. `latest` is always protected. */
export function protectList(raw: string): string[] {
  const list = (raw || '').split(',').map(s => s.trim()).filter(Boolean)
  return list.includes('latest') ? list : ['latest', ...list]
}

/** `*` is the only wildcard; every other character is literal. */
export function matchesPattern(tag: string, pattern: string): boolean {
  if (!pattern.includes('*')) return pattern === tag
  const source = pattern.split('*').map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*')
  return new RegExp(`^${source}$`).test(tag)
}

/** True when the tag must survive a retention sweep. */
export function isProtected(tag: string, protectRaw: string): boolean {
  return protectList(protectRaw).some(p => matchesPattern(tag, p))
}
