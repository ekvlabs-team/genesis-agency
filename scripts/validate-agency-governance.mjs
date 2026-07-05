#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const modulePath = fileURLToPath(import.meta.url);
const root = dirname(dirname(modulePath));

const requiredGovernanceFiles = [
  "docs/CONTRIBUTION_GOVERNANCE.md",
  "proposals/ASSET_PROPOSAL_TEMPLATE.md",
  ".github/ISSUE_TEMPLATE/asset_proposal.md",
  ".github/pull_request_template.md",
];

const selfScannerFiles = new Set([
  "scripts/validate-agency-governance.mjs",
  "scripts/test-agency-governance-validator.mjs",
]);

const textExtensions = new Set([
  ".md",
  ".json",
  ".mjs",
  ".js",
  ".yml",
  ".yaml",
  ".txt",
]);

const secretLikeRules = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/i,
  /\b[A-Za-z0-9_]*(service_role_key|private_key|secret|token|api_key|password|key)[A-Za-z0-9_]*\s*=\s*["']?[^"'\s<][^"'\s]*/i,
  /["']?[A-Za-z0-9_-]*(service[_-]?role[_-]?key|private[_-]?key|secret|token|api[_-]?key|password)["']?\s*:\s*["'][^"'\s<][^"']*["']/i,
  /\b[A-Za-z0-9_-]*(service[_-]?role[_-]?key|private[_-]?key|secret|token|api[_-]?key|password)\s*:\s*[^"'\s<][^\s]*/i,
  /\bBearer\s+[A-Za-z0-9._-]{16,}/i,
  /\bsk-[A-Za-z0-9]{16,}/i,
];

const forbiddenPromiseRules = [
  /\bguarantees?\s+(income|revenue|jobs?|work|payouts?|floor|token utility)\b/i,
  /\bguaranteed\s+(income|revenue|jobs?|work|payouts?|floor|token utility)\b/i,
  /\bwill\s+(receive|earn|get)\s+(\$|[0-9]|income|revenue|payout|job)\b/i,
  /\brevenue\s+share\s+(is|will be)\s+(guaranteed|paid|owed)\b/i,
  /\btoken\s+utility\s+(is|will be)\s+(guaranteed|provided)\b/i,
];

export function validateAgencyGovernance({
  root,
  listFiles = () => listRepositoryFiles(root),
  readText = (relativePath) => readFileSync(join(root, relativePath), "utf8"),
}) {
  const errors = [];
  const files = new Set(listFiles());

  for (const requiredFile of requiredGovernanceFiles) {
    if (!files.has(requiredFile)) {
      errors.push(`missing required governance file: ${requiredFile}`);
    }
  }

  const governanceText = files.has("docs/CONTRIBUTION_GOVERNANCE.md")
    ? readText("docs/CONTRIBUTION_GOVERNANCE.md")
    : "";
  if (governanceText && !/proposed\s*->\s*review\s*->\s*accepted\s*\/\s*rejected\s*\/\s*deprecated/i.test(governanceText)) {
    errors.push("docs/CONTRIBUTION_GOVERNANCE.md must mention proposal lifecycle: proposed -> review -> accepted / rejected / deprecated");
  }
  if (governanceText && !/Oracle may reference public accepted assets only/i.test(governanceText)) {
    errors.push("docs/CONTRIBUTION_GOVERNANCE.md must state Oracle may reference public accepted assets only");
  }

  for (const file of files) {
    if (selfScannerFiles.has(file)) continue;
    if (!isTextFile(file)) continue;
    const text = readText(file);
    for (const rule of secretLikeRules) {
      if (rule.test(text)) {
        errors.push(`${file} contains secret-like content`);
        break;
      }
    }
    if (containsForbiddenPromise(text)) {
      errors.push(`${file} contains forbidden promise-like claim`);
    }
  }

  return errors;
}

function containsForbiddenPromise(text) {
  return text.split(/\r?\n/).some((line) => {
    if (isSafeDisclaimerLine(line)) return false;
    return forbiddenPromiseRules.some((rule) => rule.test(line));
  });
}

function isSafeDisclaimerLine(line) {
  const normalized = line.trim();
  const noPrefix = /^\s*(-\s*)?(\[[ x]\]\s*)?(no|not|without)\b/i.test(line);
  const explicitNegation = /\b(do not|does not|must not|should not|not a|not an|no longer|no-promises)\b/i.test(line);
  return (noPrefix || explicitNegation) && !/[.;]\s*\S/u.test(normalized);
}

function listRepositoryFiles(rootPath, directory = ".") {
  const absoluteDirectory = resolve(rootPath, directory);
  const entries = readdirSync(absoluteDirectory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name === ".git") continue;
    const absolutePath = join(absoluteDirectory, entry.name);
    const relativePath = relative(rootPath, absolutePath);
    if (entry.isDirectory()) {
      files.push(...listRepositoryFiles(rootPath, relativePath));
      continue;
    }
    if (entry.isFile()) files.push(relativePath);
  }
  return files.sort();
}

function isTextFile(relativePath) {
  const dot = relativePath.lastIndexOf(".");
  if (dot === -1) return true;
  return textExtensions.has(relativePath.slice(dot));
}

function runCli() {
  const errors = validateAgencyGovernance({ root });
  if (errors.length > 0) {
    console.error(errors.join("\n"));
    process.exit(1);
  }
  console.log("Agency governance validation passed");
}

if (process.argv[1] && resolve(process.argv[1]) === modulePath) {
  runCli();
}
