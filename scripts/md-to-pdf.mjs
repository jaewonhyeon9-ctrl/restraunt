#!/usr/bin/env node
/**
 * Markdown → HTML → PDF (한글 지원)
 * 1) MD를 GitHub-스타일 HTML로 렌더 (marked + 인라인 스타일)
 * 2) Chrome headless로 PDF 인쇄
 *
 * 사용:  node scripts/md-to-pdf.mjs <input.md> [output.pdf]
 */
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')

const args = process.argv.slice(2)
if (args.length === 0) {
  console.error('Usage: node scripts/md-to-pdf.mjs <input.md> [output.pdf]')
  process.exit(1)
}

const inputMd = path.resolve(repoRoot, args[0])
if (!fs.existsSync(inputMd)) {
  console.error(`File not found: ${inputMd}`)
  process.exit(1)
}
const outputPdf = args[1]
  ? path.resolve(repoRoot, args[1])
  : inputMd.replace(/\.md$/i, '.pdf')

// 1) MD → HTML (간단한 자체 변환 — marked 의존 없이 기본 구문 처리)
function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}
function inlineMd(s) {
  return s
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
}
function mdToHtml(md) {
  const lines = md.replace(/\r\n/g, '\n').split('\n')
  const out = []
  let i = 0
  let inCode = false
  let codeLang = ''
  let codeBuf = []
  let listType = null // 'ul' | 'ol' | null
  let inTable = false
  let tableHead = null
  let tableRows = []

  function flushList() {
    if (listType) {
      out.push(`</${listType}>`)
      listType = null
    }
  }
  function flushTable() {
    if (inTable) {
      out.push('<table>')
      if (tableHead) {
        out.push('<thead><tr>')
        tableHead.forEach((c) => out.push(`<th>${inlineMd(c.trim())}</th>`))
        out.push('</tr></thead>')
      }
      out.push('<tbody>')
      tableRows.forEach((r) => {
        out.push('<tr>')
        r.forEach((c) => out.push(`<td>${inlineMd(c.trim())}</td>`))
        out.push('</tr>')
      })
      out.push('</tbody></table>')
      inTable = false
      tableHead = null
      tableRows = []
    }
  }

  while (i < lines.length) {
    const line = lines[i]

    // 코드 블록
    if (line.startsWith('```')) {
      if (inCode) {
        out.push(
          `<pre><code class="lang-${escapeHtml(codeLang)}">${codeBuf
            .map(escapeHtml)
            .join('\n')}</code></pre>`
        )
        codeBuf = []
        inCode = false
        codeLang = ''
      } else {
        flushList()
        flushTable()
        inCode = true
        codeLang = line.slice(3).trim()
      }
      i++
      continue
    }
    if (inCode) {
      codeBuf.push(line)
      i++
      continue
    }

    // 표 (간단 처리)
    if (/^\|.+\|/.test(line)) {
      const cells = line.slice(1, -1).split('|')
      const next = lines[i + 1] ?? ''
      if (!inTable && /^\|[\s:|-]+\|$/.test(next)) {
        flushList()
        inTable = true
        tableHead = cells
        i += 2
        continue
      } else if (inTable) {
        tableRows.push(cells)
        i++
        continue
      }
    } else if (inTable) {
      flushTable()
    }

    // 헤더
    const h = line.match(/^(#{1,6})\s+(.+?)\s*#*$/)
    if (h) {
      flushList()
      flushTable()
      const lvl = h[1].length
      out.push(`<h${lvl}>${inlineMd(escapeHtml(h[2]))}</h${lvl}>`)
      i++
      continue
    }

    // 수평선
    if (/^---+\s*$/.test(line)) {
      flushList()
      flushTable()
      out.push('<hr>')
      i++
      continue
    }

    // 인용
    if (line.startsWith('>')) {
      flushList()
      const buf = []
      while (i < lines.length && lines[i].startsWith('>')) {
        buf.push(lines[i].replace(/^>\s?/, ''))
        i++
      }
      out.push(
        `<blockquote>${buf
          .map((b) => inlineMd(escapeHtml(b)))
          .join('<br>')}</blockquote>`
      )
      continue
    }

    // 순서 리스트
    const ol = line.match(/^(\d+)\.\s+(.+)/)
    if (ol) {
      if (listType !== 'ol') {
        flushList()
        out.push('<ol>')
        listType = 'ol'
      }
      out.push(`<li>${inlineMd(escapeHtml(ol[2]))}</li>`)
      i++
      continue
    }

    // 비순서 리스트
    const ul = line.match(/^[-*+]\s+(.+)/)
    if (ul) {
      if (listType !== 'ul') {
        flushList()
        out.push('<ul>')
        listType = 'ul'
      }
      out.push(`<li>${inlineMd(escapeHtml(ul[1]))}</li>`)
      i++
      continue
    }

    // 빈 줄
    if (line.trim() === '') {
      flushList()
      out.push('')
      i++
      continue
    }

    // 본문 단락
    flushList()
    out.push(`<p>${inlineMd(escapeHtml(line))}</p>`)
    i++
  }
  flushList()
  flushTable()
  if (inCode) {
    out.push(
      `<pre><code class="lang-${escapeHtml(codeLang)}">${codeBuf
        .map(escapeHtml)
        .join('\n')}</code></pre>`
    )
  }
  return out.join('\n')
}

const mdContent = fs.readFileSync(inputMd, 'utf8')
const titleMatch = mdContent.match(/^#\s+(.+)/m)
const title = titleMatch ? titleMatch[1].trim() : path.basename(inputMd)

const bodyHtml = mdToHtml(mdContent)

const html = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>
  @page { size: A4; margin: 18mm 14mm 18mm 14mm; }
  * { box-sizing: border-box; }
  html, body {
    font-family: 'Malgun Gothic', '맑은 고딕', 'Apple SD Gothic Neo', '나눔고딕', sans-serif;
    line-height: 1.65;
    color: #1f2937;
    font-size: 11pt;
  }
  body { max-width: 100%; margin: 0; padding: 0; }
  h1, h2, h3, h4, h5, h6 {
    color: #0f172a;
    font-weight: 700;
    line-height: 1.3;
    page-break-after: avoid;
    margin-top: 1.4em;
    margin-bottom: 0.5em;
  }
  h1 { font-size: 22pt; border-bottom: 2px solid #4f46e5; padding-bottom: 6px; }
  h2 { font-size: 17pt; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; margin-top: 1.8em; }
  h3 { font-size: 14pt; color: #4f46e5; }
  h4 { font-size: 12pt; color: #1e293b; }
  p { margin: 0.5em 0; }
  blockquote {
    margin: 1em 0;
    padding: 0.6em 1em;
    border-left: 4px solid #4f46e5;
    background: #f8fafc;
    color: #334155;
    page-break-inside: avoid;
  }
  ul, ol { padding-left: 1.4em; margin: 0.4em 0; }
  li { margin: 0.15em 0; }
  table {
    border-collapse: collapse;
    width: 100%;
    margin: 1em 0;
    font-size: 10pt;
    page-break-inside: avoid;
  }
  th, td {
    border: 1px solid #cbd5e1;
    padding: 6px 10px;
    text-align: left;
    vertical-align: top;
  }
  th { background: #f1f5f9; font-weight: 700; color: #1e293b; }
  code {
    font-family: 'D2Coding', 'Consolas', monospace;
    background: #f1f5f9;
    padding: 1px 5px;
    border-radius: 3px;
    font-size: 0.9em;
    color: #be185d;
  }
  pre {
    background: #0f172a;
    color: #e2e8f0;
    padding: 12px 14px;
    border-radius: 6px;
    overflow-x: auto;
    font-size: 9.5pt;
    line-height: 1.5;
    page-break-inside: avoid;
  }
  pre code { background: transparent; color: inherit; padding: 0; }
  hr { border: none; border-top: 1px dashed #94a3b8; margin: 1.4em 0; }
  strong { color: #0f172a; }
  a { color: #4f46e5; text-decoration: none; }
  a:hover { text-decoration: underline; }
  /* 첫 페이지 제목 강조 */
  h1:first-of-type { margin-top: 0; }
</style>
</head>
<body>
${bodyHtml}
</body>
</html>`

const tmpHtml = path.join(
  repoRoot,
  '.cache-pdf-' + path.basename(inputMd, '.md') + '.html'
)
fs.writeFileSync(tmpHtml, html, 'utf8')
console.log(`[1/2] HTML 생성: ${tmpHtml}`)

// 2) Chrome headless로 PDF 인쇄
const chromeCandidates = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
]
const chromePath = chromeCandidates.find((p) => fs.existsSync(p))
if (!chromePath) {
  console.error('Chrome 또는 Edge 실행 파일을 찾지 못했습니다.')
  process.exit(1)
}

console.log(`[2/2] PDF 인쇄 (engine: ${path.basename(chromePath)})`)
const fileUrl = 'file:///' + tmpHtml.replace(/\\/g, '/')
const result = spawnSync(
  chromePath,
  [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--no-pdf-header-footer',
    `--print-to-pdf=${outputPdf}`,
    fileUrl,
  ],
  { stdio: 'inherit', timeout: 120000 }
)

// 임시 HTML 정리
try {
  fs.unlinkSync(tmpHtml)
} catch {}

if (result.status !== 0) {
  console.error(`Chrome PDF 인쇄 실패 (exit ${result.status})`)
  process.exit(result.status ?? 1)
}

const stat = fs.statSync(outputPdf)
const sizeKb = Math.round(stat.size / 1024)
console.log(`✅ PDF 생성 완료: ${outputPdf} (${sizeKb} KB)`)
