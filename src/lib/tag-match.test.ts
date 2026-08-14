// node --test src/lib/tag-match.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isProtected, matchesPattern, protectList } from './tag-match.ts'

test('latest is protected even when the policy omits it', () => {
  assert.ok(isProtected('latest', ''))
  assert.ok(isProtected('latest', 'v*'))
  assert.deepEqual(protectList('v*'), ['latest', 'v*'])
})

test('exact patterns match only themselves', () => {
  assert.ok(isProtected('stable', 'stable'))
  assert.ok(!isProtected('stable-1', 'stable'))
})

test('* is a wildcard, other regex characters are literal', () => {
  assert.ok(matchesPattern('v1.2.3', 'v*'))
  assert.ok(matchesPattern('prod-abc', 'prod-*'))
  assert.ok(matchesPattern('a-b-c', 'a-*-c'))
  assert.ok(!matchesPattern('v1.2.3', 'v1.2'))
  // '.' must not behave as "any character"
  assert.ok(!matchesPattern('v1x2x3', 'v1.2.3'))
})

test('unprotected tags are not protected', () => {
  assert.ok(!isProtected('build-42', 'latest, v*, prod-*'))
  assert.ok(isProtected('v2', 'latest, v*, prod-*'))
})
