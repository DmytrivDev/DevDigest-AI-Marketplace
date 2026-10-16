#!/usr/bin/env node
// Generates `<name>.index.md` next to each knowledge file `<name>.md`.
//
// Why: a knowledge file that grows every session soon costs thousands of tokens to read
// whole, and every agent that touches its area pays that before doing any useful work. The
// index is one line per entry — section, date, a short hook and the SOURCE LINE NUMBER — so
// a reader can decide what is relevant and read just those lines.
//
// The index is a derived file. This script never opens a knowledge file for writing, so the
// append-only rule is untouched. If an index and its source disagree, the source wins:
// delete the index and rebuild it.
//
// Usage:
//   node "${CLAUDE_SKILL_DIR}/scripts/build-index.mjs" --file <knowledge-file.md> [--file <other.md>]
//   node "${CLAUDE_SKILL_DIR}/scripts/build-index.mjs"            # every `knowledgeFiles` entry
//                                                                  # of .claude/sdd-engineering.json
//   node "${CLAUDE_SKILL_DIR}/scripts/build-index.mjs" --check    # exit 1 if an index is stale
//   [--config <path>]   default: .claude/sdd-engineering.json
//
// Zero dependencies.

import { readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';

/** Characters of each entry kept as the hook. Long enough to decide "is this mine?". */
const HOOK_CHARS = 150;

function fail(msg) {
  console.error(`ERROR: ${msg}`);
  process.exit(1);
}

function parseArgs(argv) {
  const out = { file: [] };
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue;
    const key = argv[i].slice(2);
    const next = argv[i + 1];
    const value = next !== undefined && !next.startsWith('--') ? (i++, next) : true;
    if (key === 'file') out.file.push(value);
    else out[key] = value;
  }
  return out;
}

function targetsFromConfig(configPath) {
  if (!existsSync(configPath)) {
    fail(`no --file given and ${configPath} does not exist — pass --file <knowledge-file.md>`);
  }
  let config;
  try {
    config = JSON.parse(readFileSync(configPath, 'utf8'));
  } catch (err) {
    fail(`${configPath} is not valid JSON: ${err.message}`);
  }
  const files = config.knowledgeFiles;
  if (!Array.isArray(files) || files.length === 0) {
    fail(`${configPath} has no \`knowledgeFiles\` — pass --file <knowledge-file.md>`);
  }
  return files;
}

/**
 * One entry = one top-level `- ` bullet under a `## ` heading, possibly wrapped over several
 * lines. `line` is the 1-based line the bullet STARTS on, which is what a reader needs.
 */
function parseEntries(text) {
  const lines = text.split(/\r?\n/);
  const entries = [];
  let section = null;
  let current = null;
  let subDate = null; // a `### YYYY-MM-DD` subheading dates the undated bullets under it

  const flush = () => {
    if (current) entries.push(current);
    current = null;
  };

  lines.forEach((raw, i) => {
    const heading = raw.match(/^##\s+(.*)$/);
    if (heading) {
      flush();
      section = heading[1].trim();
      subDate = null;
      return;
    }
    const sub = raw.match(/^###\s+(.*)$/);
    if (sub) {
      flush();
      subDate = /^\d{4}-\d{2}-\d{2}$/.test(sub[1].trim()) ? sub[1].trim() : null;
      return;
    }
    // A new top-level bullet ends the previous entry.
    if (/^-\s+/.test(raw)) {
      flush();
      if (!section) return;
      const body = raw.replace(/^-\s+/, '');
      const dated = body.match(/^\*\*(\d{4}-\d{2}-\d{2})\*\*\s*[—-]\s*(.*)$/);
      current = {
        section,
        line: i + 1,
        endLine: i + 1,
        date: dated ? dated[1] : subDate,
        text: dated ? dated[2] : body,
      };
      return;
    }
    // Continuation of the current entry (wrapped line, indented or not).
    if (current && raw.trim() !== '') {
      current.text += ' ' + raw.trim();
      current.endLine = i + 1;
    } else if (raw.trim() === '') {
      flush();
    }
  });
  flush();
  return entries;
}

/** Strip markdown noise so the hook reads as prose, then clip it on a word boundary. */
function hook(text) {
  const flat = text
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\*\*([^*]*)\*\*/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
  if (flat.length <= HOOK_CHARS) return flat;
  const cut = flat.slice(0, HOOK_CHARS);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > HOOK_CHARS * 0.6 ? cut.slice(0, lastSpace) : cut) + '…';
}

function render(sourceFile, entries, bytes) {
  const bySection = new Map();
  for (const e of entries) {
    if (!bySection.has(e.section)) bySection.set(e.section, []);
    bySection.get(e.section).push(e);
  }

  const out = [
    `# Index of \`${sourceFile}\``,
    '',
    'GENERATED FILE — do not edit by hand and do not add an insight here. It is rebuilt by the',
    '`engineering-insights` skill of the `sdd-engineering` plugin after every append.',
    '',
    `Source: \`${sourceFile}\` — ${entries.length} entries, ${bytes.toLocaleString('en-US')} bytes.`,
    '',
    'Scan this index to find out whether the source has anything to say about your task, then',
    'read only the entries you need: `L120-124` means lines 120 to 124 of the source (with the',
    'Read tool: offset 120, limit 5).',
    '',
    "It is a finding aid, NOT a substitute: an entry's value is in its detail, and the hook",
    'below is deliberately too short to act on. Where two entries on one subject disagree, the',
    'newer date wins.',
    '',
  ];

  for (const [section, list] of bySection) {
    out.push(`## ${section}`, '');
    for (const e of list) {
      const span = e.endLine > e.line ? `${e.line}-${e.endLine}` : `${e.line}`;
      const date = e.date ?? '—'.padEnd(10);
      out.push(`- \`L${span}\` · ${date} · ${hook(e.text)}`);
    }
    out.push('');
  }

  return out.join('\n');
}

const args = parseArgs(process.argv.slice(2));
const configPath = typeof args.config === 'string' ? args.config : '.claude/sdd-engineering.json';
const targets = args.file.length ? args.file : targetsFromConfig(configPath);
const check = args.check === true;
let stale = 0;
let built = 0;

for (const sourceFile of targets) {
  if (typeof sourceFile !== 'string' || !/\.md$/i.test(sourceFile)) {
    fail(`not a Markdown knowledge file: ${String(sourceFile)}`);
  }
  if (/\.index\.md$/i.test(sourceFile)) fail(`${sourceFile} is an index, not a knowledge file`);
  const indexFile = sourceFile.replace(/\.md$/i, '.index.md');
  if (!existsSync(sourceFile)) {
    console.log(`skip  ${sourceFile} (does not exist)`);
    continue;
  }
  const text = readFileSync(sourceFile, 'utf8');
  const bytes = statSync(sourceFile).size;
  const entries = parseEntries(text);
  const rendered = render(sourceFile, entries, bytes);

  const existing = existsSync(indexFile) ? readFileSync(indexFile, 'utf8') : null;
  if (existing === rendered) {
    console.log(`ok    ${indexFile} (${entries.length} entries, current)`);
    continue;
  }
  if (check) {
    console.error(`STALE ${indexFile} — rebuild it`);
    stale++;
    continue;
  }
  writeFileSync(indexFile, rendered, 'utf8');
  built++;
  console.log(`built ${indexFile} — ${entries.length} entries from ${bytes.toLocaleString('en-US')} bytes`);
}

if (check && stale > 0) {
  console.error(`\n${stale} index file(s) stale.`);
  process.exit(1);
}
if (!check) console.log(`\ndone: ${built} rebuilt, ${targets.length - built} unchanged/skipped`);
