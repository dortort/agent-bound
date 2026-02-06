/**
 * Runtime permission checker — evaluates whether a specific action is
 * allowed under the current effective permissions.
 *
 * This module is used by the enforcement proxy to gate every resource
 * access attempt before it reaches the host system.
 */

import { resolve, relative } from "node:path";
import type { EffectivePermissions } from "../manifest/schema.js";
import { type AuditDecision, AuditLog } from "./audit.js";

// ---------------------------------------------------------------------------
// Checker
// ---------------------------------------------------------------------------

export class PermissionChecker {
  private readonly perms: EffectivePermissions;
  readonly audit: AuditLog;

  constructor(permissions: EffectivePermissions, audit?: AuditLog) {
    this.perms = permissions;
    this.audit = audit ?? new AuditLog();
  }

  // -- Filesystem ---------------------------------------------------------

  /** Check if reading `filePath` is allowed. */
  checkFileRead(filePath: string): boolean {
    return this.checkFilesystem("read", filePath, "mcp.ac.filesystem.read");
  }

  /** Check if writing to `filePath` is allowed. */
  checkFileWrite(filePath: string): boolean {
    return this.checkFilesystem("write", filePath, "mcp.ac.filesystem.write");
  }

  /** Check if deleting `filePath` is allowed. */
  checkFileDelete(filePath: string): boolean {
    return this.checkFilesystem("delete", filePath, "mcp.ac.filesystem.delete");
  }

  // -- Network ------------------------------------------------------------

  /** Check if an outbound connection to `host` is allowed. */
  checkNetworkClient(host: string): boolean {
    const allowed = this.perms.network?.allowedHosts;
    if (!allowed) {
      this.audit.record("mcp.ac.network.client", host, "deny", "No network.client permission");
      return false;
    }
    const ok = allowed.includes("*") || allowed.includes(host);
    const decision: AuditDecision = ok ? "allow" : "deny";
    this.audit.record("mcp.ac.network.client", host, decision);
    return ok;
  }

  /** Check if listening on `port` is allowed. */
  checkNetworkServer(port: number): boolean {
    const allowed = this.perms.network?.listenPorts;
    if (!allowed) {
      this.audit.record("mcp.ac.network.server", String(port), "deny", "No network.server permission");
      return false;
    }
    const ok = allowed.includes(port);
    const decision: AuditDecision = ok ? "allow" : "deny";
    this.audit.record("mcp.ac.network.server", String(port), decision);
    return ok;
  }

  // -- System -------------------------------------------------------------

  /** Check if reading environment variable `name` is allowed. */
  checkEnvRead(name: string): boolean {
    const allowed = this.perms.system?.envVars;
    if (!allowed) {
      this.audit.record("mcp.ac.system.env.read", name, "deny", "No system.env.read permission");
      return false;
    }
    const ok = allowed.includes(name);
    const decision: AuditDecision = ok ? "allow" : "deny";
    this.audit.record("mcp.ac.system.env.read", name, decision);
    return ok;
  }

  /** Check if executing `command` is allowed. */
  checkExec(command: string): boolean {
    const allowed = this.perms.system?.allowedCommands;
    if (!allowed) {
      this.audit.record("mcp.ac.system.exec", command, "deny", "No system.exec permission");
      return false;
    }
    const ok = allowed.length === 0 || allowed.includes(command);
    const decision: AuditDecision = ok ? "allow" : "deny";
    this.audit.record("mcp.ac.system.exec", command, decision);
    return ok;
  }

  // -- Helpers ------------------------------------------------------------

  private checkFilesystem(
    action: "read" | "write" | "delete",
    filePath: string,
    permName: string,
  ): boolean {
    const paths = this.perms.filesystem?.[action];
    if (!paths) {
      this.audit.record(permName, filePath, "deny", `No filesystem.${action} permission`);
      return false;
    }

    const abs = resolve(filePath);
    const ok = paths.some((allowed) => {
      const allowedAbs = resolve(allowed);
      const rel = relative(allowedAbs, abs);
      return !rel.startsWith("..") && !rel.startsWith("/");
    });

    const decision: AuditDecision = ok ? "allow" : "deny";
    this.audit.record(permName, filePath, decision);
    return ok;
  }
}
