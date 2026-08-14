import { runRetentionAll } from '@/lib/retention'

const hours = Number(process.env.RETENTION_INTERVAL_HOURS) || 24

// No sweep at boot on purpose — a container restart loop must not delete tags.
const timer = setInterval(() => {
  runRetentionAll().catch(e => console.error('[retention]', e))
}, hours * 3_600_000)
timer.unref?.()

console.log(`[retention] auto-sweep every ${hours}h`)
