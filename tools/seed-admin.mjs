#!/usr/bin/env node
// seed-admin — create (or promote) an admin user in the local Supabase using the SECRET key.
// Usage:  node tools/seed-admin.mjs <email> <password> [username]
//   env:  SUPABASE_URL (default http://127.0.0.1:54321), SUPABASE_SECRET (required)
// The secret/service key bypasses RLS and email confirmation — LOCAL/DEV ONLY. Never ship it.

import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL || 'http://127.0.0.1:54321'
const secret = process.env.SUPABASE_SECRET
const [email, password, username] = process.argv.slice(2)

if (!secret) { console.error('Set SUPABASE_SECRET (the local "Secret" key from `npx supabase status`).'); process.exit(1) }
if (!email || !password) { console.error('Usage: node tools/seed-admin.mjs <email> <password> [username]'); process.exit(1) }

const admin = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } })

// Create the auth user (email pre-confirmed), then flip its profile role to 'admin'.
const { data: created, error: cErr } = await admin.auth.admin.createUser({
  email, password, email_confirm: true, user_metadata: { username: username || email },
})
let userId = created?.user?.id
if (cErr) {
  // Already exists → find it and continue to promote.
  const { data: list } = await admin.auth.admin.listUsers()
  userId = list?.users?.find((u) => u.email === email)?.id
  if (!userId) { console.error('createUser failed:', cErr.message); process.exit(1) }
  console.log('User already existed — promoting to admin.')
}

const { error: pErr } = await admin.from('profiles').update({ role: 'admin' }).eq('id', userId)
if (pErr) { console.error('Could not set role=admin:', pErr.message); process.exit(1) }

console.log(`✦ admin ready: ${email}  (id ${userId})`)
