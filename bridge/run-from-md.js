#!/usr/bin/env node
/**
 * run-from-md.js — cross-platform (Windows / Mac / Linux)
 *
 * Reads a test-cases .md file, takes a live DOM snapshot for each URL via
 * the bridge, calls Claude to generate a .spec.ts, and writes the file into
 * the project's tests/zephyr/ folder.
 *
 * Usage:
 *   node run-from-md.js [path/to/test-cases.md]
 *
 * Windows:
 *   node bridge\run-from-md.js bridge\test-cases\my-app.md
 *
 * Env vars (or set in bridge/.env):
 *   BRIDGE_URL        default: http://localhost:3000
 *   BRIDGE_API_KEY    default: dev-key
 *   SPECS_OUT_DIR     default: ../tests/zephyr  (relative to this script)
 */

const fs   = require("fs");
const path = require("path");

const BRIDGE_URL   = process.env.BRIDGE_URL    ?? "http://localhost:3000";
const API_KEY      = process.env.BRIDGE_API_KEY ?? "dev-key";
const SCRIPT_DIR   = __dirname;
const SPECS_OUT    = path.resolve(process.env.SPECS_OUT_DIR ?? path.join(SCRIPT_DIR, "..", "tests", "zephyr"));
const SNAP_OUT     = path.join(SCRIPT_DIR, "snapshots");
const MD_FILE      = path.resolve(process.argv[2] ?? path.join(SCRIPT_DIR, "test-cases", "the-internet.md"));

// ── helpers ──────────────────────────────────────────────────────────────────

async function post(endpoint, body) {
  const res = await fetch(`${BRIDGE_URL}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
    body: JSON.stringify(body),
  });
  return res.json();
}

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// ── parse .md ────────────────────────────────────────────────────────────────
// Recognised fields inside a ## section:
//   testId:      optional — auto-generated if missing
//   url:         required
//   description: optional

function parseMd(filePath) {
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  const cases = [];
  let cur = null;
  let autoIdx = 1;

  const flush = () => {
    if (cur?.url) {
      if (!cur.testId) cur.testId = `QA-AUTO-${String(autoIdx++).padStart(2, "0")}`;
      cases.push(cur);
    }
  };

  for (const line of lines) {
    const heading      = line.match(/^##\s+(.+)/);
    const testIdLine   = line.match(/^testId:\s+(.+)/);
    const urlLine      = line.match(/^url:\s+(.+)/);
    const descLine     = line.match(/^description:\s+(.+)/);
    const credLine     = line.match(/^credentials:\s+(.+)/);

    if (heading)    { flush(); cur = { name: heading[1].trim(), testId: "", url: "", description: "", credentialsPrefix: "" }; }
    else if (cur) {
      if (testIdLine) cur.testId            = testIdLine[1].trim();
      if (urlLine)    cur.url               = urlLine[1].trim();
      if (descLine)   cur.description       = descLine[1].trim();
      if (credLine)   cur.credentialsPrefix = credLine[1].trim();
    }
  }
  flush();
  return cases;
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (!fs.existsSync(MD_FILE)) {
    console.error(`File not found: ${MD_FILE}`);
    process.exit(1);
  }

  fs.mkdirSync(SNAP_OUT, { recursive: true });
  fs.mkdirSync(SPECS_OUT, { recursive: true });

  const cases = parseMd(MD_FILE);
  if (cases.length === 0) {
    console.error("No test cases (url: lines) found in", MD_FILE);
    process.exit(1);
  }

  // Verify bridge is up
  try {
    const h = await fetch(`${BRIDGE_URL}/health`);
    if (!h.ok) throw new Error(`HTTP ${h.status}`);
  } catch {
    console.error(`Bridge not reachable at ${BRIDGE_URL}. Is it running?`);
    process.exit(1);
  }

  console.log(`\nFound ${cases.length} test case(s) in ${MD_FILE}\n`);

  let passed = 0, failed = 0;

  for (let i = 0; i < cases.length; i++) {
    const { testId, name, url, description, credentialsPrefix } = cases[i];
    console.log(`  [${i + 1}/${cases.length}] ${testId} — ${name}`);
    console.log(`         ${description}`);
    process.stdout.write(`         Snapshot …`);

    // 1. Snapshot
    const snap = await post("/snapshot", { url });
    if (!snap.success) {
      console.log(` ✗  ${snap.error}`);
      failed++;
      continue;
    }
    const snapSlug = slugify(name);
    const snapFile = path.join(SNAP_OUT, `${snapSlug}.json`);
    fs.writeFileSync(snapFile, JSON.stringify({ ...snap, testCase: { testId, name, description } }, null, 2));
    process.stdout.write(` ✓   Generate spec …`);

    // 2. Generate spec via Claude
    const gen = await post("/generate-spec", {
      testId,
      suiteName: name,
      description,
      credentialsPrefix: credentialsPrefix || undefined,
      url: snap.finalUrl,
      accessibilityTree: snap.accessibilityTree,
      suggestedLocators: snap.suggestedLocators,
    });

    if (!gen.success) {
      console.log(` ✗  ${gen.error}`);
      failed++;
      continue;
    }

    // 3. Write spec file
    const specFile = path.join(SPECS_OUT, `${testId}.spec.ts`);
    fs.writeFileSync(specFile, gen.spec, "utf8");
    console.log(` ✓`);
    console.log(`         → snapshots/${path.basename(snapFile)}`);
    console.log(`         → tests/zephyr/${path.basename(specFile)}`);
    passed++;
    console.log();
  }

  console.log(`Done: ${passed} passed, ${failed} failed.`);
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
