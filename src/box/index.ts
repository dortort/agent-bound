/**
 * AgentBox — policy enforcement engine for MCP servers.
 *
 * Transforms the declarative intent of an AgentManifest into enforceable
 * execution boundaries. Each MCP server is launched inside a sandbox that
 * restricts access to only the resources declared in its manifest and
 * approved by the operator.
 *
 * @module
 */

export { resolvePolicy, type PolicyOverrides } from "./policy.js";
export { launchSandbox, type SandboxOptions, type SandboxedProcess } from "./sandbox.js";
export { PermissionChecker } from "./checker.js";
export { AuditLog, type AuditEntry, type AuditDecision } from "./audit.js";

import type { AgentManifest, EffectivePermissions } from "../manifest/schema.js";
import { resolvePolicy, type PolicyOverrides } from "./policy.js";
import { launchSandbox, type SandboxedProcess } from "./sandbox.js";
import { PermissionChecker } from "./checker.js";
import { AuditLog } from "./audit.js";

// ---------------------------------------------------------------------------
// High-level API
// ---------------------------------------------------------------------------

export interface AgentBoxOptions {
  /** The AgentManifest to enforce. */
  manifest: AgentManifest;
  /** Operator overrides to refine generic permissions. */
  overrides?: PolicyOverrides;
  /** Command to launch the MCP server process. */
  command: string[];
  /** Working directory. */
  cwd?: string;
}

export interface AgentBoxInstance {
  /** The sandboxed MCP server process. */
  sandbox: SandboxedProcess;
  /** Runtime permission checker for dynamic checks. */
  checker: PermissionChecker;
  /** The resolved effective permissions. */
  effectivePermissions: EffectivePermissions;
  /** Audit log for this instance. */
  audit: AuditLog;
  /** Stop the sandboxed server. */
  stop(): void;
}

/**
 * Create and launch a sandboxed MCP server with manifest-driven access control.
 *
 * This is the primary entry point for the AgentBox enforcement engine.
 *
 * @example
 * ```ts
 * import { loadManifest } from "agent-bound/manifest";
 * import { createAgentBox } from "agent-bound/box";
 *
 * const manifest = await loadManifest("./agent-manifest.json");
 * const box = createAgentBox({
 *   manifest,
 *   command: ["node", "server.js"],
 *   overrides: {
 *     readPaths: ["/data/shared"],
 *     allowedHosts: ["api.example.com"],
 *   },
 * });
 *
 * // Later: check a permission at runtime
 * box.checker.checkFileRead("/data/shared/file.txt"); // true
 * box.checker.checkFileRead("/etc/passwd");           // false
 *
 * // Shut down
 * box.stop();
 * ```
 */
export function createAgentBox(options: AgentBoxOptions): AgentBoxInstance {
  const { manifest, overrides, command, cwd } = options;

  const effectivePermissions = resolvePolicy(manifest, overrides);
  const audit = new AuditLog();
  const checker = new PermissionChecker(effectivePermissions, audit);

  const sandbox = launchSandbox({
    command,
    cwd,
    permissions: effectivePermissions,
  });

  return {
    sandbox,
    checker,
    effectivePermissions,
    audit,
    stop() {
      sandbox.stop();
    },
  };
}
