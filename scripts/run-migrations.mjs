#!/usr/bin/env node
/**
 * Run pending manual-migration SQL files against the Supabase Postgres DB.
 * Usage:  node scripts/run-migrations.mjs <file1.sql> [file2.sql ...]
 *
 * DATABASE_URL must be set (auto-loaded from .env.local or .env).
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Client } from 'pg'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')

// Manually load .env.local then .env (simple KEY=VALUE parser)
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
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    if (!process.env[key]) process.env[key] = val
  }
}

loadEnv('.env.local')
loadEnv('.env')

const url = process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL not set')
  process.exit(1)
}

const files = process.argv.slice(2)
if (files.length === 0) {
  console.error('Usage: node scripts/run-migrations.mjs <file.sql> ...')
  process.exit(1)
}

const client = new Client({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
})

try {
  await client.connect()
  console.log('[ok] connected to Postgres')

  for (const f of files) {
    const abs = path.resolve(repoRoot, f)
    if (!fs.existsSync(abs)) {
      console.error(`[skip] file not found: ${f}`)
      continue
    }
    const sql = fs.readFileSync(abs, 'utf8')
    console.log(`\n[run] ${f} (${sql.length} bytes)`)
    try {
      await client.query(sql)
      console.log(`[ok]  ${f}`)
    } catch (e) {
      console.error(`[err] ${f}:`, e.message)
      process.exitCode = 1
    }
  }
} finally {
  await client.end()
}
