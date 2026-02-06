/**
 * AgentManifest JSON schema types and validation.
 *
 * An AgentManifest is a declarative JSON document that an MCP server
 * bundles to declare the system resources it requires. The manifest is
 * reviewed by users (or automated tooling) before the server is launched,
 * enabling least-privilege enforcement.
 *
 * @see https://arxiv.org/abs/2510.21236
 */

import { type Permission, ALL_PERMISSIONS, isValidPermission } from "../permissions.js";

// ---------------------------------------------------------------------------
// Schema types
// ---------------------------------------------------------------------------

/**
 * The AgentManifest document structure.
 *
 * Minimal example:
 * ```json
 * {
 *   "description": "Filesystem MCP server with read-only access.",
 *   "permissions": ["mcp.ac.filesystem.read"]
 * }
 * ```
 */
export interface AgentManifest {
  /** Short English description of the MCP server's purpose. */
  description: string;

  /**
   * Set of generic permissions the server requires, drawn from the
   * predefined `mcp.ac.*` vocabulary.
   */
  permissions: Permission[];
}

/**
 * Effective runtime permissions produced after the user refines the
 * generic manifest permissions. Each generic permission is narrowed to
 * concrete resource scopes.
 */
export interface EffectivePermissions {
  filesystem?: {
    read?: string[];
    write?: string[];
    delete?: string[];
  };
  network?: {
    allowedHosts?: string[];
    listenPorts?: number[];
  };
  system?: {
    envVars?: string[];
    allowedCommands?: string[];
  };
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export interface ValidationError {
  path: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

/**
 * Validate a plain object against the AgentManifest schema.
 */
export function validateManifest(data: unknown): ValidationResult {
  const errors: ValidationError[] = [];

  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    return { valid: false, errors: [{ path: "$", message: "Manifest must be a JSON object" }] };
  }

  const obj = data as Record<string, unknown>;

  // description ----------------------------------------------------------
  if (typeof obj.description !== "string") {
    errors.push({ path: "$.description", message: "Must be a non-empty string" });
  } else if (obj.description.trim().length === 0) {
    errors.push({ path: "$.description", message: "Must be a non-empty string" });
  }

  // permissions ----------------------------------------------------------
  if (!Array.isArray(obj.permissions)) {
    errors.push({ path: "$.permissions", message: "Must be an array of permission strings" });
  } else {
    const seen = new Set<string>();
    for (let i = 0; i < obj.permissions.length; i++) {
      const perm = obj.permissions[i];
      if (typeof perm !== "string") {
        errors.push({
          path: `$.permissions[${i}]`,
          message: "Each permission must be a string",
        });
      } else if (!isValidPermission(perm)) {
        errors.push({
          path: `$.permissions[${i}]`,
          message: `Unknown permission "${perm}". Valid: ${ALL_PERMISSIONS.join(", ")}`,
        });
      } else if (seen.has(perm)) {
        errors.push({
          path: `$.permissions[${i}]`,
          message: `Duplicate permission "${perm}"`,
        });
      } else {
        seen.add(perm);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
