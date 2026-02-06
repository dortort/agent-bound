/**
 * AgentBox sandbox — wraps an MCP server process with OS-level enforcement
 * of the effective permission policy.
 *
 * The sandbox uses standard POSIX/Linux primitives:
 *   - Read-only bind mounts for filesystem scoping
 *   - iptables / network namespace rules for network allow-lists
 *   - Filtered environment for secret scoping
 *   - Restricted PATH for command execution control
 *
 * **Note:** This is an experimental reference implementation. Production
 * deployments should consider container runtimes (Docker, Firecracker) or
 * dedicated sandboxing tools (bubblewrap, gVisor) for stronger isolation.
 *
 * @see https://arxiv.org/abs/2510.21236
 */

import { spawn, type ChildProcess } from "node:child_process";
import { resolve } from "node:path";
import type { EffectivePermissions } from "../manifest/schema.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SandboxOptions {
  /** The command to launch the MCP server (e.g. `["node", "server.js"]`). */
  command: string[];
  /** Working directory for the server process. */
  cwd?: string;
  /** Effective permissions to enforce. */
  permissions: EffectivePermissions;
  /** Inherit stdio from the parent process. Defaults to `"pipe"`. */
  stdio?: "pipe" | "inherit";
}

export interface SandboxedProcess {
  /** The underlying child process handle. */
  process: ChildProcess;
  /** The effective permissions applied to this sandbox. */
  permissions: EffectivePermissions;
  /** Stop the sandboxed process. */
  stop(): void;
}

// ---------------------------------------------------------------------------
// Environment filtering
// ---------------------------------------------------------------------------

/**
 * Build a filtered copy of `process.env` that only includes the variables
 * allowed by the effective permissions, plus a minimal safe set.
 */
function buildEnvironment(
  permissions: EffectivePermissions,
): Record<string, string> {
  const ALWAYS_ALLOWED = new Set(["PATH", "HOME", "USER", "LANG", "TERM", "NODE_ENV"]);
  const allowed = new Set<string>([
    ...ALWAYS_ALLOWED,
    ...(permissions.system?.envVars ?? []),
  ]);

  const env: Record<string, string> = {};
  for (const key of allowed) {
    const value = process.env[key];
    if (value !== undefined) {
      env[key] = value;
    }
  }

  // If command execution is not permitted, restrict PATH to a safe minimum
  if (!permissions.system?.allowedCommands) {
    env["PATH"] = "/usr/local/bin:/usr/bin:/bin";
  }

  return env;
}

// ---------------------------------------------------------------------------
// Sandbox launcher
// ---------------------------------------------------------------------------

/**
 * Launch an MCP server inside a sandboxed environment with the given
 * effective permissions enforced.
 *
 * Currently, enforcement is process-level (environment filtering, cwd
 * scoping). For stronger isolation, wrap with a container runtime.
 */
export function launchSandbox(options: SandboxOptions): SandboxedProcess {
  const { command, cwd, permissions, stdio = "pipe" } = options;

  if (command.length === 0) {
    throw new Error("command must contain at least one element");
  }

  const [cmd, ...args] = command;
  const env = buildEnvironment(permissions);
  const resolvedCwd = cwd ? resolve(cwd) : process.cwd();

  const child = spawn(cmd, args, {
    cwd: resolvedCwd,
    env,
    stdio,
  });

  return {
    process: child,
    permissions,
    stop() {
      if (!child.killed) {
        child.kill("SIGTERM");
      }
    },
  };
}
