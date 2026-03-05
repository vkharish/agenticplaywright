#!/usr/bin/env node
/**
 * run-from-md.js — cross-platform (Windows / Mac / Linux)
 *
 * Reads a test-cases .md file, takes a live DOM snapshot for each URL via
 * the bridge, calls Claude to generate a .spec.ts, and writes the file into
 * the project's tests/zephyr/ folder.
 *
 * Usage:
 *   node run-from-md.js [path/to/test-cases.md] [--snapshot-only]
 *
 * Flags:
 *   --snapshot-only   Only take snapshots, skip spec generation.
 *                     Use this to test the bridge without an API key.
 *   --skip-existing   Skip any test case whose .spec.ts already exists in tests/zephyr/.
 *                     Use this on subsequent runs — only new test cases get generated.
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

// Load .env files so credentials prefix (e.g. THE_INTERNET_USERNAME) can be resolved
try { require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") }); } catch (_) {}
try { require("dotenv").config({ path: path.resolve(__dirname, ".env") }); } catch (_) {}

const args          = process.argv.slice(2);
const SNAPSHOT_ONLY = args.includes("--snapshot-only");
const SKIP_EXISTING = args.includes("--skip-existing");
const MD_ARG        = args.find(a => !a.startsWith("--"));

const BRIDGE_URL   = process.env.BRIDGE_URL    ?? "http://localhost:3000";
const API_KEY      = process.env.BRIDGE_API_KEY ?? "dev-key";
const SCRIPT_DIR   = __dirname;
const SPECS_OUT    = path.resolve(process.env.SPECS_OUT_DIR ?? path.join(SCRIPT_DIR, "..", "tests", "zephyr"));
const SNAP_OUT     = path.join(SCRIPT_DIR, "snapshots");
const MD_FILE      = path.resolve(MD_ARG ?? path.join(SCRIPT_DIR, "test-cases", "the-internet.md"));

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
//   credentials: optional — maps to <PREFIX>_USERNAME / <PREFIX>_PASSWORD in .env
//   steps:       optional multi-line block — each '  - step' line is one step

function parseMd(filePath) {
  const lines   = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  const cases   = [];
  let cur       = null;
  let autoIdx   = 1;
  let inSteps   = false;

  const flush = () => {
    if (cur?.url) {
      if (!cur.testId) cur.testId = `QA-AUTO-${String(autoIdx++).padStart(2, "0")}`;
      cases.push(cur);
    }
  };

  for (const line of lines) {
    const heading    = line.match(/^##\s+(.+)/);
    const testIdLine = line.match(/^testId:\s+(.+)/);
    const urlLine    = line.match(/^url:\s+(.+)/);
    const descLine   = line.match(/^description:\s+(.+)/);
    const credLine   = line.match(/^credentials:\s+(.+)/);
    const stepsLine  = line.match(/^steps:\s*$/);
    const stepItem   = line.match(/^\s+-\s+(.+)/);

    if (heading) {
      flush();
      cur = { name: heading[1].trim(), testId: "", url: "", description: "", credentialsPrefix: "", steps: [] };
      inSteps = false;
    } else if (cur) {
      if (inSteps) {
        if (stepItem) cur.steps.push(stepItem[1].trim());
      } else {
        if (stepsLine)       inSteps = true;
        else if (testIdLine) cur.testId            = testIdLine[1].trim();
        else if (urlLine)    cur.url               = urlLine[1].trim();
        else if (descLine)   cur.description       = descLine[1].trim();
        else if (credLine)   cur.credentialsPrefix = credLine[1].trim();
      }
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
  if (!SNAPSHOT_ONLY) fs.mkdirSync(SPECS_OUT, { recursive: true });

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

  if (SNAPSHOT_ONLY) console.log(`\n[snapshot-only mode — spec generation skipped]`);
  if (SKIP_EXISTING) console.log(`\n[--skip-existing] Already-generated specs will be skipped.`);
  console.log(`\nFound ${cases.length} test case(s) in ${MD_FILE}\n`);

  let passed = 0, failed = 0, skipped = 0;

  for (let i = 0; i < cases.length; i++) {
    const { testId, name, url, description, credentialsPrefix, steps } = cases[i];
    console.log(`  [${i + 1}/${cases.length}] ${testId} — ${name}`);
    console.log(`         ${description}`);
    if (steps.length > 0) console.log(`         Steps: ${steps.join(" → ")}`);

    // Skip if spec already exists and --skip-existing flag is set
    if (SKIP_EXISTING && !SNAPSHOT_ONLY) {
      const specFile = path.join(SPECS_OUT, `${testId}.spec.ts`);
      if (fs.existsSync(specFile)) {
        console.log(`         → skipped (spec already exists)\n`);
        skipped++;
        continue;
      }
    }

    process.stdout.write(`         Snapshot …`);

    // Resolve form credentials from env (used by 'login' step)
    let credentials;
    if (credentialsPrefix) {
      const username = process.env[`${credentialsPrefix}_USERNAME`];
      const password = process.env[`${credentialsPrefix}_PASSWORD`];
      if (username && password) credentials = { username, password };
    }

    // 1. Snapshot (bridge executes steps before snapshotting)
    const snapBody = { url };
    if (steps.length > 0) snapBody.steps = steps;
    if (credentials)      snapBody.credentials = credentials;
    const snap = await post("/snapshot", snapBody);
    if (!snap.success) {
      console.log(` ✗  ${snap.error}`);
      failed++;
      continue;
    }
    const snapSlug = slugify(name);
    const snapFile = path.join(SNAP_OUT, `${snapSlug}.json`);
    fs.writeFileSync(snapFile, JSON.stringify({ ...snap, testCase: { testId, name, description } }, null, 2));
    console.log(` ✓`);
    console.log(`         → snapshots/${path.basename(snapFile)}`);

    // 2. Generate spec via Claude (skipped in snapshot-only mode)
    if (SNAPSHOT_ONLY) {
      passed++;
      console.log();
      continue;
    }

    process.stdout.write(`         Generate spec …`);
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
    console.log(`         → tests/zephyr/${path.basename(specFile)}`);
    passed++;
    console.log();
  }

  const summary = [`Done: ${passed} passed`, `${failed} failed`];
  if (SKIP_EXISTING) summary.push(`${skipped} skipped (already existed)`);
  console.log(summary.join(", ") + ".");
  if (SNAPSHOT_ONLY) {
    console.log(`\nSnapshots saved to: ${SNAP_OUT}`);
    console.log(`Run without --snapshot-only when Claude API key is available to generate specs.`);
  }
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
