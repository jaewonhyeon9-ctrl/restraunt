import { readFile, writeFile } from "node:fs/promises";
import { execSync } from "node:child_process";
import path from "node:path";
import { marked } from "marked";

const ROOT = path.resolve(import.meta.dirname, "..");
const CHROME = "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe";

const FILES = [
  { md: "PATENT_DRAFT.md", title: "오토드림 — 특허 출원 설계서" },
  { md: "PATENT_PRIOR_ART.md", title: "오토드림 — 선행 기술 비교 분석" },
  { md: "PATENT_ONE_PAGER.md", title: "오토드림 — 1페이지 요약" },
  { md: "PATENT_DRAFT_EN.md", title: "AutoDream — Patent Draft (English)" },
];

const HTML_TEMPLATE = (title, body) => `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(title)}</title>
  <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
  <style>
    @page { size: A4; margin: 18mm 16mm; }
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo",
        "Pretendard Variable", "Pretendard", "Noto Sans KR", "Malgun Gothic", sans-serif;
      color: #1f2937;
      line-height: 1.7;
      max-width: 100%;
      padding: 0;
      margin: 0;
      font-size: 10.5pt;
    }
    h1 {
      font-size: 22pt;
      font-weight: 800;
      border-bottom: 3px solid #0f172a;
      padding-bottom: 10px;
      margin-top: 0;
      margin-bottom: 18px;
      color: #0f172a;
    }
    h2 {
      font-size: 15pt;
      font-weight: 700;
      margin-top: 28px;
      margin-bottom: 10px;
      color: #0f172a;
      border-left: 5px solid #0f172a;
      padding-left: 10px;
      page-break-after: avoid;
    }
    h3 {
      font-size: 12pt;
      font-weight: 700;
      margin-top: 18px;
      margin-bottom: 6px;
      color: #1f2937;
      page-break-after: avoid;
    }
    h4 { font-size: 11pt; margin-top: 12px; margin-bottom: 4px; }
    p { margin: 6px 0 10px; }
    ul, ol { margin: 6px 0 10px; padding-left: 22px; }
    li { margin: 2px 0; }
    code {
      background: #f1f5f9;
      padding: 1px 5px;
      border-radius: 3px;
      font-family: "JetBrains Mono", "Fira Code", ui-monospace, monospace;
      font-size: 9.5pt;
    }
    pre {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 10px 12px;
      overflow: auto;
      page-break-inside: avoid;
    }
    pre code { background: transparent; padding: 0; font-size: 9pt; }
    blockquote {
      border-left: 3px solid #94a3b8;
      padding: 6px 12px;
      color: #475569;
      background: #f8fafc;
      margin: 10px 0;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 10px 0;
      page-break-inside: avoid;
      font-size: 9.5pt;
    }
    th, td {
      border: 1px solid #cbd5e1;
      padding: 6px 8px;
      text-align: left;
      vertical-align: top;
    }
    th {
      background: #0f172a;
      color: white;
      font-weight: 600;
    }
    tr:nth-child(even) td { background: #f8fafc; }
    a { color: #1d4ed8; text-decoration: none; }
    hr {
      border: 0;
      border-top: 1px solid #cbd5e1;
      margin: 22px 0;
    }
    .mermaid {
      background: #fbfdff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 14px;
      margin: 12px 0;
      page-break-inside: avoid;
      text-align: center;
    }
    .doc-header {
      text-align: center;
      margin-bottom: 22px;
      padding-bottom: 14px;
      border-bottom: 2px solid #0f172a;
    }
    .doc-header .meta {
      font-size: 9pt;
      color: #64748b;
      margin-top: 4px;
    }
    .page-break { page-break-before: always; }
    @media print {
      body { font-size: 10pt; }
    }
  </style>
</head>
<body>
${body}
<script>
  // Mermaid 코드 블록을 .mermaid 컨테이너로 변환
  document.querySelectorAll('pre code.language-mermaid').forEach((el) => {
    const div = document.createElement('div');
    div.className = 'mermaid';
    div.textContent = el.textContent;
    el.closest('pre').replaceWith(div);
  });
  mermaid.initialize({ startOnLoad: true, theme: 'default', securityLevel: 'loose', flowchart: { useMaxWidth: true, htmlLabels: true } });
  // mermaid 렌더 완료 후 print 신호
  window.addEventListener('load', async () => {
    try {
      await mermaid.run();
      window.__rendered = true;
    } catch (e) {
      window.__rendered = true;
    }
  });
</script>
</body>
</html>`;

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

async function buildOne(file) {
  const mdPath = path.join(ROOT, file.md);
  let md;
  try {
    md = await readFile(mdPath, "utf8");
  } catch {
    console.log(`(skip) ${file.md} 없음`);
    return null;
  }

  const bodyHtml = marked.parse(md);
  const html = HTML_TEMPLATE(file.title, bodyHtml);
  const htmlPath = path.join(import.meta.dirname, file.md.replace(".md", ".html"));
  await writeFile(htmlPath, html, "utf8");

  const pdfPath = path.join(ROOT, file.md.replace(".md", ".pdf"));
  console.log(`→ ${file.md} → PDF 변환 중...`);

  const args = [
    `"${CHROME}"`,
    "--headless=new",
    "--disable-gpu",
    "--no-sandbox",
    "--virtual-time-budget=12000",
    "--run-all-compositor-stages-before-draw",
    "--print-to-pdf-no-header",
    `--print-to-pdf="${pdfPath}"`,
    `"file:///${htmlPath.replace(/\\/g, "/")}"`,
  ].join(" ");

  try {
    execSync(args, { stdio: "pipe" });
    console.log(`✓ ${path.basename(pdfPath)}`);
    return pdfPath;
  } catch (e) {
    console.error(`✗ 변환 실패: ${e.message}`);
    return null;
  }
}

const results = [];
for (const f of FILES) {
  const r = await buildOne(f);
  if (r) results.push(r);
}

console.log(`\n생성된 PDF: ${results.length}건`);
results.forEach((r) => console.log("  - " + r));
