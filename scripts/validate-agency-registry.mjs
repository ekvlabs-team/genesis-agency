#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const modulePath = fileURLToPath(import.meta.url);
const root = dirname(dirname(modulePath));
const registrySchemaRef = "../manifests/agency-registry.schema.json";

export function validateAgencyRegistry({
  registry,
  registrySchema,
  assetSchema,
  root,
  pathExists = existsSync,
}) {
  const errors = [];
  const rootPath = resolve(root);
  const allowedRegistryFields = new Set(["$schema", "assets"]);
  const assetProperties = assetSchema.properties || {};
  const allowedAssetFields = new Set(Object.keys(assetProperties));
  const requiredFields = assetSchema.required || [];
  const seenAssetIds = new Set();

  if (registrySchema.properties?.assets?.items?.$ref !== "./agency-asset.schema.json") {
    errors.push("agency registry schema must reference ./agency-asset.schema.json for assets");
  }

  for (const key of Object.keys(registry || {})) {
    if (!allowedRegistryFields.has(key)) {
      errors.push(`registry/agency-assets.json has unknown field: ${key}`);
    }
  }

  if (registry?.$schema !== registrySchemaRef) {
    errors.push(`registry/agency-assets.json must use $schema ${registrySchemaRef}`);
  }

  if (!Array.isArray(registry?.assets)) {
    errors.push("registry/agency-assets.json must contain an assets array");
    return errors;
  }

  registry.assets.forEach((asset, index) => {
    if (!asset || typeof asset !== "object" || Array.isArray(asset)) {
      errors.push(`registry asset ${index} must be an object`);
      return;
    }

    for (const key of Object.keys(asset)) {
      if (!allowedAssetFields.has(key)) {
        errors.push(`registry asset ${index} has unknown field: ${key}`);
      }
    }

    for (const field of requiredFields) {
      if (!(field in asset)) {
        errors.push(`registry asset ${index} is missing required field: ${field}`);
      }
    }

    for (const [field, rule] of Object.entries(assetProperties)) {
      if (!(field in asset)) continue;
      validateField(errors, asset, index, field, rule);
    }

    if (typeof asset.assetId === "string") {
      if (seenAssetIds.has(asset.assetId)) {
        errors.push(`registry asset ${index} has duplicate assetId: ${asset.assetId}`);
      }
      seenAssetIds.add(asset.assetId);
    }

    if (Array.isArray(asset.paths)) {
      asset.paths.forEach((relativePath, pathIndex) => {
        if (typeof relativePath !== "string") {
          errors.push(`registry asset ${index} path ${pathIndex} must be a string`);
          return;
        }

        const absolutePath = resolve(rootPath, relativePath);
        if (!isWithinRoot(rootPath, absolutePath)) {
          errors.push(`registry asset ${index} path ${pathIndex} escapes repository root: ${relativePath}`);
          return;
        }

        if (!pathExists(absolutePath)) {
          errors.push(`registry asset ${index} references missing path: ${relativePath}`);
        }
      });
    }
  });

  return errors;
}

function validateField(errors, asset, index, field, rule) {
  const value = asset[field];

  if (rule.type === "string" && typeof value !== "string") {
    errors.push(`registry asset ${index} field ${field} must be a string`);
    return;
  }

  if (rule.type === "array" && !Array.isArray(value)) {
    errors.push(`registry asset ${index} field ${field} must be an array`);
    return;
  }

  if (typeof value === "string") {
    if (rule.minLength !== undefined && value.length < rule.minLength) {
      errors.push(`registry asset ${index} field ${field} must be at least ${rule.minLength} character`);
    }
    if (rule.maxLength !== undefined && value.length > rule.maxLength) {
      errors.push(`registry asset ${index} field ${field} must be at most ${rule.maxLength} characters`);
    }
    if (rule.pattern && !new RegExp(rule.pattern).test(value)) {
      errors.push(`registry asset ${index} field ${field} does not match ${rule.pattern}`);
    }
    if (rule.format === "uri" && !isUri(value)) {
      errors.push(`registry asset ${index} field ${field} must be a URI`);
    }
  }

  if (Array.isArray(value) && rule.minItems !== undefined && value.length < rule.minItems) {
    errors.push(`registry asset ${index} field ${field} must contain at least ${rule.minItems} item`);
  }

  if (rule.enum && !rule.enum.includes(value)) {
    errors.push(`registry asset ${index} field ${field} must be one of: ${rule.enum.join(", ")}`);
  }
}

function isUri(value) {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

function isWithinRoot(rootPath, candidatePath) {
  return candidatePath === rootPath || candidatePath.startsWith(`${rootPath}${sep}`);
}

function readJson(relativePath) {
  return JSON.parse(readFileSync(join(root, relativePath), "utf8"));
}

function runCli() {
  const errors = validateAgencyRegistry({
    registry: readJson("registry/agency-assets.json"),
    registrySchema: readJson("manifests/agency-registry.schema.json"),
    assetSchema: readJson("manifests/agency-asset.schema.json"),
    root,
  });

  if (errors.length > 0) {
    console.error(errors.join("\n"));
    process.exit(1);
  }

  console.log("Agency registry validation passed");
}

if (process.argv[1] && resolve(process.argv[1]) === modulePath) {
  runCli();
}
