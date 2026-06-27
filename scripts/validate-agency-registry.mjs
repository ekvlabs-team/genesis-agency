#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const registrySchemaRef = "../manifests/agency-registry.schema.json";

const registry = readJson("registry/agency-assets.json");
if (registry.$schema !== registrySchemaRef) {
  fail(`registry/agency-assets.json must use $schema ${registrySchemaRef}`);
}

const registrySchema = readJson("manifests/agency-registry.schema.json");
const assetSchema = readJson("manifests/agency-asset.schema.json");
const assetProperties = new Set(Object.keys(assetSchema.properties || {}));
const requiredFields = assetSchema.required || [];
const allowedTypes = new Set(assetSchema.properties?.assetType?.enum || []);
const allowedStatuses = new Set(assetSchema.properties?.status?.enum || []);

if (registrySchema.properties?.assets?.items?.$ref !== "./agency-asset.schema.json") {
  fail("agency registry schema must reference ./agency-asset.schema.json for assets");
}

if (!Array.isArray(registry.assets)) {
  fail("registry/agency-assets.json must contain an assets array");
}

registry.assets.forEach((asset, index) => {
  if (!asset || typeof asset !== "object" || Array.isArray(asset)) {
    fail(`registry asset ${index} must be an object`);
  }

  for (const key of Object.keys(asset)) {
    if (!assetProperties.has(key)) {
      fail(`registry asset ${index} has unknown field: ${key}`);
    }
  }

  for (const field of requiredFields) {
    if (!(field in asset)) {
      fail(`registry asset ${index} is missing required field: ${field}`);
    }
  }

  if (!/^asset_[a-z0-9_-]+$/.test(asset.assetId)) {
    fail(`registry asset ${index} has invalid assetId: ${asset.assetId}`);
  }
  if (!allowedTypes.has(asset.assetType)) {
    fail(`registry asset ${index} has invalid assetType: ${asset.assetType}`);
  }
  if (!allowedStatuses.has(asset.status)) {
    fail(`registry asset ${index} has invalid status: ${asset.status}`);
  }
  if (!Array.isArray(asset.paths) || asset.paths.length === 0) {
    fail(`registry asset ${index} must include at least one path`);
  }

  for (const relativePath of asset.paths) {
    if (!existsSync(join(root, relativePath))) {
      fail(`registry asset ${index} references missing path: ${relativePath}`);
    }
  }
});

console.log("Agency registry validation passed");

function readJson(relativePath) {
  try {
    return JSON.parse(readFileSync(join(root, relativePath), "utf8"));
  } catch (error) {
    fail(`${relativePath} is not valid JSON: ${error.message}`);
  }
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
