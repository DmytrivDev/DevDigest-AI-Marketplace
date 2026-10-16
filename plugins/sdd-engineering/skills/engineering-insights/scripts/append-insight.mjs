#!/usr/bin/env node
// Appends ONE insight to a project knowledge file — append-only.
//
// It splices a single line into one section and rewrites nothing else. Every pre-existing
// line is verified to still be present before the write is committed; on any doubt it
// refuses and leaves the file untouched. The write itself goes through a temp file + rename.
//
// Usage:
//   node "${CLAUDE_SKILL_DIR}/scripts/append-insight.mjs" --file <knowledge-file.md> \
//     --section "Codebase Patterns" --text "..." [--date YYYY-MM-DD] [--create] [--add-section]
//
//   --file         the knowledge file (one of the project config's `knowledgeFiles`)
//   --section      one of the seven fixed sections (see SECTIONS)
//   --text         the entry, one line; newlines are collapsed to spaces
//   --date         default: today (UTC)
//   --create       create the file with the standard header and sections if it is missing
//                  (only after the user agreed to that path)
//   --add-section  if the file lacks the section heading, append it at the end of the file
//                  (only after the user agreed to extend a file that predates this format)
//
// Output: `APPENDED …` (written), `SKIPPED (duplicate) …` (already there, exit 0),
// `ERROR: …` (nothing written, exit 1). Zero dependencies.

import { readFileSync, writeFileSync, renameSync, existsSync, unlinkSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const SECTIONS = [
  'What Works',
  "What Doesn't Work",
  'Codebase Patterns',
  'Tool & Library Notes',
  'Recurring Errors & Fixes',
  'Session Notes',
  'Open Questions',
];
// Two entries count as "the same insight" at >= 0.8 content-token overlap. Below that,
// near-misses are usually genuinely different facts about the same file.
const DUPLICATE_THRESHOLD = 0.8;
// Overlap ratios are meaningless on very short entries ("did a thing" vs "did another
// thing" scores 1.0), so below this many tokens only an exact token match counts.
const MIN_TOKENS_FOR_FUZZY = 5;

function die(msg) {
  console.error(`ERROR: ${msg}`);
  process.exit(1);
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) die(`expected a --flag, got "${argv[i]}"`);
    const key = argv[i].slice(2);
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith('--')) {
      out[key] = next;
      i++;
    } else {
      out[key] = true;
    }
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const file = typeof args.file === 'string' ? args.file : '';
const section = args.section;
const text = (typeof args.text === 'string' ? args.text : '').replace(/\s*\r?\n\s*/g, ' ').trim();
const date = typeof args.date === 'string' ? args.date : new Date().toISOString().slice(0, 10);

if (!file) die('--file <path> is required (a knowledge file from the project config `knowledgeFiles`)');
if (!/\.md$/i.test(file)) die('--file must be a Markdown file (.md)');
if (!SECTIONS.includes(section)) die(`--section must be one of: ${SECTIONS.join(' | ')}`);
if (!text) die('--text is required and must be non-empty');
if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) die('--date must be YYYY-MM-DD');

const TEMPLATE = [
  '# Engineering knowledge',
  '',
  'Durable, non-obvious insights for the code this file covers: what works, what does not,',
  'conventions, tool quirks, recurring errors and open questions. Append-only: entries are added',
  'only through the `engineering-insights` skill of the `sdd-engineering` plugin and are never',
  'edited or reordered. A newer dated entry supersedes an older one on the same subject.',
  '',
  ...SECTIONS.flatMap((s) => [`## ${s}`, '']),
].join('\n');

let original;
if (existsSync(file)) {
  original = readFileSync(file, 'utf8');
} else if (args.create === true) {
  original = TEMPLATE;
} else {
  die(`${file} does not exist — confirm the path with the user, then re-run with --create`);
}
const isNew = !existsSync(file);
const eol = original.includes('\r\n') ? '\r\n' : '\n';
const lines = original.split(/\r?\n/);

/** Reduce an entry to comparable content tokens: drop the date, markdown, punctuation. */
function tokens(s) {
  return new Set(
    s
      .replace(/\*\*\d{4}-\d{2}-\d{2}\*\*/g, ' ')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}./:_-]+/gu, ' ')
      .split(' ')
      .filter((t) => [...t].length > 2),
  );
}

function isDuplicate(candidate, existing) {
  const a = tokens(candidate);
  const b = tokens(existing);
  if (a.size === 0 || b.size === 0) return false;
  let shared = 0;
  for (const t of a) if (b.has(t)) shared += 1;
  if (Math.min(a.size, b.size) < MIN_TOKENS_FOR_FUZZY) {
    return a.size === b.size && shared === a.size;
  }
  return shared / Math.min(a.size, b.size) >= DUPLICATE_THRESHOLD;
}

// The duplicate check spans the WHOLE file: the same fact filed under a different section
// is still a duplicate, and re-filing it would be a silent restatement.
const existingEntries = lines.filter((l) => l.trimStart().startsWith('- '));
const clash = existingEntries.find((l) => isDuplicate(text, l));
if (clash) {
  console.log(`SKIPPED (duplicate) — ${file} already carries this insight:`);
  console.log(`  ${clash.trim()}`);
  process.exit(0);
}

const entry = section === 'Session Notes' ? `- ${text}` : `- **${date}** — ${text}`;
let headingIdx = lines.findIndex((l) => l.trim() === `## ${section}`);
let added = []; // the non-blank lines this run is allowed to add

if (headingIdx === -1) {
  if (args['add-section'] !== true) {
    const found = lines.filter((l) => l.startsWith('## ')).map((l) => l.slice(3).trim());
    die(
      `${file} has no "## ${section}" heading (found: ${found.join(' | ') || 'none'}). ` +
        'Ask the user before extending it, then re-run with --add-section.',
    );
  }
  while (lines.length && lines[lines.length - 1].trim() === '') lines.pop();
  lines.push('', `## ${section}`);
  headingIdx = lines.length - 1;
  added.push(`## ${section}`);
}

let endIdx = lines.findIndex((l, i) => i > headingIdx && l.startsWith('## '));
if (endIdx === -1) endIdx = lines.length;

let body = lines.slice(headingIdx + 1, endIdx);
while (body.length && body[body.length - 1].trim() === '') body.pop();

if (section === 'Session Notes') {
  // Group under a dated ### subheading, creating it only if this date is new.
  const dateIdx = body.findIndex((l) => l.trim() === `### ${date}`);
  if (dateIdx === -1) {
    body = body.length ? [...body, '', `### ${date}`, entry] : ['', `### ${date}`, entry];
    added.push(`### ${date}`);
  } else {
    let sub = body.findIndex((l, i) => i > dateIdx && (l.startsWith('### ') || l.startsWith('## ')));
    if (sub === -1) sub = body.length;
    body.splice(sub, 0, entry);
  }
} else {
  body = body.length ? [...body, entry] : ['', entry];
}
added.push(entry);

const tail = lines.slice(endIdx);
const updated = [...lines.slice(0, headingIdx + 1), ...body, ...(tail.length ? ['', ...tail] : [''])];
const rendered = updated.join(eol);

// Verify BEFORE committing the write: every original line must survive, and the only
// growth may be the lines this run meant to add.
const before = original.split(/\r?\n/).filter((l) => l.trim() !== '');
const after = updated.filter((l) => l.trim() !== '');
const pool = [...after];
for (const l of before) {
  const at = pool.indexOf(l);
  if (at === -1) die(`refusing to write — this edit would drop an existing line: ${l.trim()}`);
  pool.splice(at, 1);
}
if (pool.length !== added.length || pool.some((l, i) => l !== added[i])) {
  die(`refusing to write — unexpected change of ${after.length - before.length} line(s)`);
}

const tmp = `${file}.tmp`;
try {
  if (isNew) mkdirSync(dirname(file), { recursive: true });
  writeFileSync(tmp, rendered, 'utf8');
  renameSync(tmp, file);
} catch (err) {
  if (existsSync(tmp)) unlinkSync(tmp);
  die(`write failed, ${file} left untouched: ${err.message}`);
}

console.log(`APPENDED to ${file}${isNew ? ' (created)' : ''} under "${section}":`);
console.log(`  ${entry}`);
