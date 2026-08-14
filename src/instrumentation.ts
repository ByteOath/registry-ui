/**
 * Background tag-retention sweep. Next calls register() once per server boot.
 * ponytail: in-process timer, correct for a single container; move to an external
 * cron hitting the per-registry endpoint if this ever runs more than one replica.
 */
export async function register() {
  // The positive check is required: it is what lets Next drop this branch — and the
  // node-only sqlite/fs imports behind it — from the edge bundle of this file.
  if (process.env.NEXT_RUNTIME === 'nodejs' && process.env.RETENTION_AUTO !== 'false') {
    await import('./retention-timer')
  }
}
