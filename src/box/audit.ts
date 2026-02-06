/**
 * Audit logger for AgentBox policy decisions.
 *
 * Every permission check is recorded so operators can review what an MCP
 * server attempted and whether the action was allowed or denied.
 */

import type { Permission } from "../permissions.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AuditDecision = "allow" | "deny";

export interface AuditEntry {
  timestamp: string;
  permission: Permission | string;
  resource: string;
  decision: AuditDecision;
  detail?: string;
}

// ---------------------------------------------------------------------------
// In-memory audit log
// ---------------------------------------------------------------------------

export class AuditLog {
  private entries: AuditEntry[] = [];

  record(
    permission: Permission | string,
    resource: string,
    decision: AuditDecision,
    detail?: string,
  ): void {
    this.entries.push({
      timestamp: new Date().toISOString(),
      permission,
      resource,
      decision,
      detail,
    });
  }

  /** Return a copy of all recorded entries. */
  all(): readonly AuditEntry[] {
    return [...this.entries];
  }

  /** Return only denied entries. */
  denied(): readonly AuditEntry[] {
    return this.entries.filter((e) => e.decision === "deny");
  }

  /** Clear all entries. */
  clear(): void {
    this.entries = [];
  }

  /** Serialise the log as a JSON string. */
  toJSON(): string {
    return JSON.stringify(this.entries, null, 2);
  }
}
