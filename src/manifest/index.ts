/**
 * AgentManifest — declarative access-control policy for MCP servers.
 *
 * Provides utilities to load, create, validate, and persist manifest files.
 *
 * @module
 */

export { type AgentManifest, type EffectivePermissions, type ValidationResult, type ValidationError, validateManifest } from "./schema.js";

import { readFile, writeFile } from "node:fs/promises";
import { type AgentManifest, validateManifest } from "./schema.js";
import type { Permission } from "../permissions.js";

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create a new AgentManifest object.
 *
 * @throws if the resulting manifest fails validation.
 */
export function createManifest(
  description: string,
  permissions: Permission[],
): AgentManifest {
  const manifest: AgentManifest = { description, permissions: [...new Set(permissions)] };
  const result = validateManifest(manifest);
  if (!result.valid) {
    throw new Error(
      `Invalid manifest: ${result.errors.map((e) => e.message).join("; ")}`,
    );
  }
  return manifest;
}

// ---------------------------------------------------------------------------
// I/O
// ---------------------------------------------------------------------------

/**
 * Load and validate an AgentManifest from a JSON file.
 *
 * @throws on invalid JSON or schema violations.
 */
export async function loadManifest(filePath: string): Promise<AgentManifest> {
  const raw = await readFile(filePath, "utf-8");
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error(`Failed to parse JSON from ${filePath}`);
  }

  const result = validateManifest(data);
  if (!result.valid) {
    const msgs = result.errors.map((e) => `  ${e.path}: ${e.message}`).join("\n");
    throw new Error(`Invalid manifest at ${filePath}:\n${msgs}`);
  }

  return data as AgentManifest;
}

/**
 * Persist an AgentManifest to a JSON file.
 */
export async function saveManifest(
  manifest: AgentManifest,
  filePath: string,
): Promise<void> {
  const result = validateManifest(manifest);
  if (!result.valid) {
    throw new Error(
      `Refusing to save invalid manifest: ${result.errors.map((e) => e.message).join("; ")}`,
    );
  }
  await writeFile(filePath, JSON.stringify(manifest, null, 2) + "\n", "utf-8");
}
