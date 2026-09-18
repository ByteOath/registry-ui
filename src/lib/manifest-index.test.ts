// node --test src/lib/manifest-index.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  isDigest, manifestKind, pickChild, platformLabel, platformLabels, runnableEntries,
  type IndexEntry,
} from './manifest-index.ts'

const d = (s: string) => 'sha256:' + s.repeat(64).slice(0, 64)
const ATT = d('a'), ARM = d('b'), AMD = d('c')

const INDEX: IndexEntry[] = [
  { digest: ATT, platform: { os: 'unknown', architecture: 'unknown' } },
  { digest: ARM, platform: { os: 'linux', architecture: 'arm64', variant: 'v8' } },
  { digest: AMD, platform: { os: 'linux', architecture: 'amd64' } },
]

test('buildx attestation entries are not runnable platforms', () => {
  assert.deepEqual(
    runnableEntries(INDEX).map(m => platformLabel(m.platform)),
    ['linux/arm64/v8', 'linux/amd64'],
  )
})

test('platform labels are deduped — windows repeats one platform per OS build', () => {
  const win: IndexEntry[] = [
    { digest: AMD, platform: { os: 'windows', architecture: 'amd64' } },
    { digest: ARM, platform: { os: 'windows', architecture: 'amd64' } },
  ]
  assert.deepEqual(platformLabels(win), ['windows/amd64'])
})

test('only well-formed digests are followed — the registry reply hits a URL path', () => {
  assert.ok(isDigest(AMD))
  assert.ok(!isDigest('sha256:../../secret'))
  assert.ok(!isDigest('sha256:short'))
  assert.ok(!isDigest(undefined))
  assert.equal(pickChild([{ digest: '../evil', platform: { os: 'linux', architecture: 'amd64' } }]), undefined)
})

test('manifest kind tells an OCI index apart from a plain OCI manifest', () => {
  assert.equal(manifestKind('application/vnd.oci.image.index.v1+json'), 'oci index')
  assert.equal(manifestKind('application/vnd.oci.image.manifest.v1+json'), 'oci')
  assert.equal(manifestKind('application/vnd.docker.distribution.manifest.list.v2+json'), 'manifest list')
  assert.equal(manifestKind('application/vnd.docker.distribution.manifest.v2+json'), 'docker v2')
  assert.equal(manifestKind('application/vnd.docker.distribution.manifest.v1+json'), 'docker v1')
  assert.equal(manifestKind(null), null)
})

test('linux/amd64 wins, otherwise first runnable platform', () => {
  assert.equal(pickChild(INDEX)?.digest, AMD)
  assert.equal(pickChild(INDEX.slice(0, 2))?.digest, ARM)
})

test('an index with only attestations still resolves to something', () => {
  assert.equal(pickChild(INDEX.slice(0, 1))?.digest, ATT)
  assert.equal(pickChild([]), undefined)
})
