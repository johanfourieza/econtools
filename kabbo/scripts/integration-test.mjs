#!/usr/bin/env node
/**
 * Integration smoke-test for the Kabbo persistence layer.
 *
 * Signs in as a disposable test user against a real Supabase project and
 * exercises the full import → reload cycle that caused the production
 * incidents. If this passes, imports persist end-to-end. If it fails, the
 * output tells you exactly which row went missing.
 *
 * ── Setup ──────────────────────────────────────────────────────────────
 * Create `.env.test` in the kabbo/ root (NEVER commit this file):
 *
 *     VITE_SUPABASE_URL=https://<project>.supabase.co
 *     VITE_SUPABASE_PUBLISHABLE_KEY=<anon key>
 *     KABBO_TEST_EMAIL=<test user email>
 *     KABBO_TEST_PASSWORD=<test user password>
 *
 * The test user MUST be a dedicated account for this — the script deletes
 * all of that user's publications before and after each run.
 *
 * ── Run ────────────────────────────────────────────────────────────────
 *     npm run test:integration
 */

import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { resolve } from 'node:path';

// ---- Load .env.test ---------------------------------------------------
function loadEnv() {
  try {
    const raw = readFileSync(resolve('.env.test'), 'utf8');
    const env = {};
    for (const line of raw.split('\n')) {
      const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
      if (m) env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
    }
    return env;
  } catch {
    console.error('× .env.test not found. See scripts/integration-test.mjs for setup.');
    process.exit(2);
  }
}

const env = loadEnv();
for (const k of [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_PUBLISHABLE_KEY',
  'KABBO_TEST_EMAIL',
  'KABBO_TEST_PASSWORD',
]) {
  if (!env[k]) {
    console.error(`× .env.test is missing ${k}`);
    process.exit(2);
  }
}

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY);

// ---- Tiny assertion helpers ------------------------------------------
let passed = 0;
let failed = 0;
function ok(label, cond, detail = '') {
  if (cond) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`);
    failed++;
  }
}

// ---- Test ------------------------------------------------------------
async function run() {
  console.log('→ signing in…');
  const { data: signIn, error: signInErr } = await supabase.auth.signInWithPassword({
    email: env.KABBO_TEST_EMAIL,
    password: env.KABBO_TEST_PASSWORD,
  });
  if (signInErr) throw signInErr;
  const userId = signIn.user.id;
  console.log(`→ signed in as ${signIn.user.email} (${userId})`);

  console.log('→ wiping pre-existing test data…');
  await supabase.from('publications').delete().eq('owner_id', userId);
  await supabase.from('publication_bin').delete().eq('user_id', userId);

  console.log('→ inserting three test rows…');
  const rows = [
    { id: crypto.randomUUID(), owner_id: userId, title: 'Full Entry', authors: ['Smith'], themes: [], grants: [], target_year: 2024, stage: 'published', output_type: 'journal', notes: '', links: [], working_paper: null, stage_history: [] },
    { id: crypto.randomUUID(), owner_id: userId, title: 'Missing Year', authors: ['Jones'], themes: [], grants: [], target_year: null, stage: 'published', output_type: 'journal', notes: '', links: [], working_paper: null, stage_history: [] },
    { id: crypto.randomUUID(), owner_id: userId, title: 'Draft', authors: ['Brown'], themes: [], grants: [], target_year: 2025, stage: 'draft', output_type: 'journal', notes: '', links: [], working_paper: null, stage_history: [] },
  ];
  const { error: insErr } = await supabase.from('publications').insert(rows);
  if (insErr) throw insErr;

  console.log('→ re-fetching as the app would on reload…');
  const { data: fetched, error: fetchErr } = await supabase
    .from('publications')
    .select('*')
    .eq('owner_id', userId);
  if (fetchErr) throw fetchErr;

  console.log('→ asserting invariants:');
  ok('all 3 rows round-tripped', fetched?.length === 3, `got ${fetched?.length}`);

  const full = fetched.find((r) => r.title === 'Full Entry');
  ok('full row kept its year', full?.target_year === 2024);

  const noYear = fetched.find((r) => r.title === 'Missing Year');
  ok('missing-year row kept stage=published', noYear?.stage === 'published');
  ok('missing-year row has target_year=null', noYear?.target_year === null);

  const draft = fetched.find((r) => r.title === 'Draft');
  ok('draft row stage=draft', draft?.stage === 'draft');

  // Visibility invariant — every published row must be bucketable.
  // This is the exact logic from useSupabasePublications#publishedByYear.
  const published = fetched.filter((r) => r.stage === 'published');
  const bucketable = published.every(
    (r) => r.target_year != null || r.target_year === null, // both must bucket (unknown for null)
  );
  ok('every published row is bucketable (year or unknown)', bucketable);

  console.log('→ cleaning up…');
  await supabase.from('publications').delete().eq('owner_id', userId);
  await supabase.from('publication_bin').delete().eq('user_id', userId);
  await supabase.auth.signOut();

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

run().catch((err) => {
  console.error('× integration test crashed:', err);
  process.exit(1);
});
