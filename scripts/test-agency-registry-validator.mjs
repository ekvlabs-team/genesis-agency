#!/usr/bin/env node
import assert from "node:assert/strict";

import { validateAgencyRegistry } from "./validate-agency-registry.mjs";

const baseAsset = {
  assetId: "asset_alpha",
  assetType: "skill",
  title: "Alpha skill",
  summary: "Reusable public skill.",
  ownerAgent: "agent-alpha",
  genesisGridTrialUrl: "https://genesisgrid.xyz/trial/app_alpha",
  proposalUrl: "https://github.com/ekvlabs-team/genesis-agency/issues/2",
  paths: ["skills"],
  proofArtifactPaths: ["proof-artifacts/asset_alpha"],
  verification: "Reviewed by repository checks.",
  status: "accepted",
};

const validRegistry = {
  $schema: "../manifests/agency-registry.schema.json",
  assets: [baseAsset],
};

const existingPaths = new Set(["skills", "proof-artifacts/asset_alpha"]);

assert.deepEqual(validate(validRegistry), []);
assert.match(validate({ ...validRegistry, notes: "extra" })[0], /unknown field: notes/);
assert.match(validate({
  ...validRegistry,
  assets: [
    baseAsset,
    { ...baseAsset, title: "Duplicate" },
  ],
})[0], /duplicate assetId: asset_alpha/);
assert.match(validate({
  ...validRegistry,
  assets: [{ ...baseAsset, paths: ["../../etc/hostname"] }],
})[0], /escapes repository root/);
assert.match(validate({
  ...validRegistry,
  assets: [{ ...baseAsset, paths: [42] }],
})[0], /field paths item 0 must be a string/);
assert.match(validate({
  ...validRegistry,
  assets: [{ ...baseAsset, title: "" }],
})[0], /title must be at least 1 character/);
assert.match(validate({
  ...validRegistry,
  assets: [{ ...baseAsset, genesisGridTrialUrl: "not a url" }],
})[0], /genesisGridTrialUrl must be a URI/);
assert.match(validate({
  ...validRegistry,
  assets: [{ ...baseAsset, status: "proposed" }],
})[0], /status must be one of: accepted, deprecated/);
const assetWithoutProposalUrl = { ...baseAsset };
delete assetWithoutProposalUrl.proposalUrl;
assert.match(validate({
  ...validRegistry,
  assets: [assetWithoutProposalUrl],
})[0], /missing required field: proposalUrl/);
assert.match(validate({
  ...validRegistry,
  assets: [{ ...baseAsset, proofArtifactPaths: [] }],
})[0], /field proofArtifactPaths must contain at least 1 item/);
assert.match(validate({
  ...validRegistry,
  assets: [{ ...baseAsset, proofArtifactPaths: ["../../tmp/secret"] }],
})[0], /proofArtifactPaths 0 escapes repository root/);
assert.match(validate({
  ...validRegistry,
  assets: [{ ...baseAsset, proofArtifactPaths: ["proof-artifacts/../skills"] }],
})[0], /proofArtifactPaths 0 must be under proof-artifacts\//);
assert.match(validate({
  ...validRegistry,
  assets: [{ ...baseAsset, assetType: "tool" }],
})[0], /assetType tool must reference at least one path under tools/);
assert.match(validate({
  ...validRegistry,
  assets: [{ ...baseAsset, assetType: "tool", paths: ["tools/../skills"] }],
})[0], /assetType tool must reference at least one path under tools/);
const deprecatedAssetWithoutProof = { ...baseAsset, status: "deprecated" };
delete deprecatedAssetWithoutProof.proofArtifactPaths;
assert.match(validate({
  ...validRegistry,
  assets: [deprecatedAssetWithoutProof],
})[0], /missing required field: proofArtifactPaths/);

console.log("Agency registry validator tests passed");

function validate(registry) {
  return validateAgencyRegistry({
    registry,
    registrySchema: {
      properties: {
        assets: {
          items: {
            $ref: "./agency-asset.schema.json",
          },
        },
      },
    },
    assetSchema: {
      additionalProperties: false,
      required: [
        "assetId",
        "assetType",
        "title",
        "summary",
        "ownerAgent",
        "genesisGridTrialUrl",
        "proposalUrl",
        "paths",
        "proofArtifactPaths",
        "verification",
        "status",
      ],
      properties: {
        assetId: { type: "string", pattern: "^asset_[a-z0-9_-]+$" },
        assetType: { type: "string", enum: ["skill", "agent", "playbook", "eval", "tool", "proof-artifact", "proposal", "doc"] },
        title: { type: "string", minLength: 1, maxLength: 120 },
        summary: { type: "string", minLength: 1, maxLength: 800 },
        ownerAgent: { type: "string", minLength: 1 },
        genesisGridTrialUrl: { type: "string", format: "uri" },
        paths: { type: "array", items: { type: "string" }, minItems: 1 },
        verification: { type: "string", minLength: 1, maxLength: 2000 },
        externalValueHypothesis: { type: "string", maxLength: 2000 },
        proposalUrl: { type: "string", format: "uri" },
        proofArtifactPaths: { type: "array", items: { type: "string" }, minItems: 1 },
        status: { type: "string", enum: ["accepted", "deprecated"] },
      },
    },
    root: "/repo",
    pathExists: (absolutePath) => existingPaths.has(absolutePath.replace("/repo/", "")),
  });
}
