#!/usr/bin/env node
import assert from "node:assert/strict";

import { validateAgencyGovernance } from "./validate-agency-governance.mjs";

const requiredFiles = [
  "docs/CONTRIBUTION_GOVERNANCE.md",
  "proposals/ASSET_PROPOSAL_TEMPLATE.md",
  ".github/ISSUE_TEMPLATE/asset_proposal.md",
  ".github/pull_request_template.md",
];

assert.deepEqual(validate({ files: baseFiles() }), []);

assert.match(validate({
  files: baseFiles({
    "docs/CONTRIBUTION_GOVERNANCE.md": undefined,
  }),
})[0], /missing required governance file: docs\/CONTRIBUTION_GOVERNANCE\.md/);

assert.match(validate({
  files: baseFiles({
    "skills/bad.md": `SUPABASE_SERVICE_ROLE_${"KEY"}=real-secret-value`,
  }),
})[0], /secret-like content/);

assert.match(validate({
  files: baseFiles({
    "proposals/bad.md": `This guarantees ${"income"} for every accepted agent.`,
  }),
})[0], /forbidden promise-like claim/);

assert.match(validate({
  files: baseFiles({
    "proposals/also-bad.md": `This creates guaranteed ${"income"} for accepted agents.`,
  }),
})[0], /forbidden promise-like claim/);

assert.match(validate({
  files: baseFiles({
    "proposals/no-prefix-bad.md": `No private data. This creates guaranteed ${"income"} for accepted agents.`,
  }),
})[0], /forbidden promise-like claim/);

assert.match(validate({
  files: baseFiles({
    "docs/bad-json.md": `"service_role_key": "real-secret-value"`,
  }),
})[0], /secret-like content/);

assert.match(validate({
  files: baseFiles({
    "docs/bad-dotenv": "service_role_key=real-secret-value",
  }),
})[0], /secret-like content/);

assert.match(validate({
  files: baseFiles({
    "docs/bad-yaml": "api_token: real-secret-value",
  }),
})[0], /secret-like content/);

assert.match(validate({
  files: baseFiles({
    "docs/CONTRIBUTION_GOVERNANCE.md": "No guaranteed income, work, token utility or revenue share is promised.",
  }),
})[0], /must mention proposal lifecycle/);

console.log("Agency governance validator tests passed");

function baseFiles(overrides = {}) {
  const files = new Map();
  for (const path of requiredFiles) {
    files.set(path, "Lifecycle: proposed -> review -> accepted / rejected / deprecated.\nOracle may reference public accepted assets only.\nNo secrets.");
  }
  for (const [path, value] of Object.entries(overrides)) {
    if (value === undefined) files.delete(path);
    else files.set(path, value);
  }
  return files;
}

function validate({ files }) {
  return validateAgencyGovernance({
    root: "/repo",
    listFiles: () => [...files.keys()],
    readText: (path) => files.get(path),
  });
}
