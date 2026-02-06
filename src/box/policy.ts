/**
 * Policy resolution — refine generic manifest permissions into effective
 * runtime permissions that can be enforced by the sandbox.
 *
 * The two-layer model mirrors the paper's design:
 *   1. **Generic permissions** — declared in the AgentManifest
 *   2. **Effective permissions** — scoped at launch time (e.g. specific
 *      paths, hosts, env-var names) and approved by the user/operator.
 *
 * @see https://arxiv.org/abs/2510.21236
 */

import type { AgentManifest, EffectivePermissions } from "../manifest/schema.js";
import {
  FILESYSTEM_READ,
  FILESYSTEM_WRITE,
  FILESYSTEM_DELETE,
  NETWORK_CLIENT,
  NETWORK_SERVER,
  SYSTEM_ENV_READ,
  SYSTEM_EXEC,
  type Permission,
} from "../permissions.js";

// ---------------------------------------------------------------------------
// Policy configuration supplied by the operator at launch time
// ---------------------------------------------------------------------------

export interface PolicyOverrides {
  /** Allowed read paths (defaults to cwd when filesystem.read is granted). */
  readPaths?: string[];
  /** Allowed write paths (defaults to cwd when filesystem.write is granted). */
  writePaths?: string[];
  /** Allowed delete paths (defaults to writePaths). */
  deletePaths?: string[];
  /** Outbound host allow-list (defaults to `["*"]` when network.client is granted). */
  allowedHosts?: string[];
  /** Ports the server may bind to (defaults to `[]`). */
  listenPorts?: number[];
  /** Environment variable names the server may read. */
  envVars?: string[];
  /** Commands the server may spawn. */
  allowedCommands?: string[];
}

// ---------------------------------------------------------------------------
// Resolution
// ---------------------------------------------------------------------------

/**
 * Resolve an AgentManifest and optional operator overrides into concrete
 * effective permissions that the sandbox will enforce.
 */
export function resolvePolicy(
  manifest: AgentManifest,
  overrides: PolicyOverrides = {},
): EffectivePermissions {
  const perms = new Set<Permission>(manifest.permissions);
  const effective: EffectivePermissions = {};

  // Filesystem ------------------------------------------------------------
  if (
    perms.has(FILESYSTEM_READ) ||
    perms.has(FILESYSTEM_WRITE) ||
    perms.has(FILESYSTEM_DELETE)
  ) {
    effective.filesystem = {};
    if (perms.has(FILESYSTEM_READ)) {
      effective.filesystem.read = overrides.readPaths ?? [process.cwd()];
    }
    if (perms.has(FILESYSTEM_WRITE)) {
      effective.filesystem.write = overrides.writePaths ?? [process.cwd()];
    }
    if (perms.has(FILESYSTEM_DELETE)) {
      effective.filesystem.delete =
        overrides.deletePaths ?? effective.filesystem.write ?? [process.cwd()];
    }
  }

  // Network ---------------------------------------------------------------
  if (perms.has(NETWORK_CLIENT) || perms.has(NETWORK_SERVER)) {
    effective.network = {};
    if (perms.has(NETWORK_CLIENT)) {
      effective.network.allowedHosts = overrides.allowedHosts ?? ["*"];
    }
    if (perms.has(NETWORK_SERVER)) {
      effective.network.listenPorts = overrides.listenPorts ?? [];
    }
  }

  // System ----------------------------------------------------------------
  if (perms.has(SYSTEM_ENV_READ) || perms.has(SYSTEM_EXEC)) {
    effective.system = {};
    if (perms.has(SYSTEM_ENV_READ)) {
      effective.system.envVars = overrides.envVars ?? [];
    }
    if (perms.has(SYSTEM_EXEC)) {
      effective.system.allowedCommands = overrides.allowedCommands ?? [];
    }
  }

  return effective;
}
