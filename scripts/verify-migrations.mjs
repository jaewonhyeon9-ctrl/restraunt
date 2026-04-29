#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Client } from 'pg'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')

function loadEnv(file) {
  const p = path.join(repoRoot, file)
  if (!fs.existsSync(p)) return
  const content = fs.readFileSync(p, 'utf8')
  for (const raw of content.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const idx = line.indexOf('=')
    if (idx === -1) continue
    const key = line.slice(0, idx).trim()
    let val = line.slice(idx + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    if (!process.env[key]) process.env[key] = val
  }
}
loadEnv('.env.local'); loadEnv('.env')

const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
await client.connect()

const checks = [
  { name: 'KakaoIntegration table', sql: `SELECT column_name FROM information_schema.columns WHERE table_name='KakaoIntegration' ORDER BY ordinal_position` },
  { name: 'OcrUsage table', sql: `SELECT column_name FROM information_schema.columns WHERE table_name='OcrUsage' ORDER BY ordinal_position` },
  { name: 'Restaurant.plan column', sql: `SELECT column_name, data_type, column_default FROM information_schema.columns WHERE table_name='Restaurant' AND column_name='plan'` },
  { name: 'Plan enum values', sql: `SELECT enumlabel FROM pg_enum WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname='Plan') ORDER BY enumsortorder` },
]

for (const c of checks) {
  const r = await client.query(c.sql)
  console.log(`\n[${c.name}]`)
  if (r.rows.length === 0) console.log('  (empty)')
  else r.rows.forEach((row) => console.log(' ', JSON.stringify(row)))
}

await client.end()
