/**
 * Permission vocabulary for AgentBound access control policies.
 *
 * Permissions follow the `mcp.ac.<category>.<action>` naming convention,
 * inspired by the Android permission model. Each permission maps to a
 * specific category of system resource access.
 *
 * @see https://arxiv.org/abs/2510.21236
 */

// ---------------------------------------------------------------------------
// Permission string constants
// ---------------------------------------------------------------------------

/** Read files and directories on the host filesystem. */
export const FILESYSTEM_READ = "mcp.ac.filesystem.read" as const;

/** Create or modify files and directories on the host filesystem. */
export const FILESYSTEM_WRITE = "mcp.ac.filesystem.write" as const;

/** Delete files and directories on the host filesystem. */
export const FILESYSTEM_DELETE = "mcp.ac.filesystem.delete" as const;

/** Make outbound network requests (HTTP, TCP, etc.). */
export const NETWORK_CLIENT = "mcp.ac.network.client" as const;

/** Listen for inbound network connections (HTTP server, SSE, etc.). */
export const NETWORK_SERVER = "mcp.ac.network.server" as const;

/** Read environment variables and host configuration values. */
export const SYSTEM_ENV_READ = "mcp.ac.system.env.read" as const;

/** Execute child processes and shell commands. */
export const SYSTEM_EXEC = "mcp.ac.system.exec" as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Union of all valid permission strings. */
export type Permission =
  | typeof FILESYSTEM_READ
  | typeof FILESYSTEM_WRITE
  | typeof FILESYSTEM_DELETE
  | typeof NETWORK_CLIENT
  | typeof NETWORK_SERVER
  | typeof SYSTEM_ENV_READ
  | typeof SYSTEM_EXEC;

/** Complete set of defined permissions. */
export const ALL_PERMISSIONS: readonly Permission[] = [
  FILESYSTEM_READ,
  FILESYSTEM_WRITE,
  FILESYSTEM_DELETE,
  NETWORK_CLIENT,
  NETWORK_SERVER,
  SYSTEM_ENV_READ,
  SYSTEM_EXEC,
] as const;

/** Permission category groupings. */
export const PERMISSION_CATEGORIES = {
  filesystem: [FILESYSTEM_READ, FILESYSTEM_WRITE, FILESYSTEM_DELETE],
  network: [NETWORK_CLIENT, NETWORK_SERVER],
  system: [SYSTEM_ENV_READ, SYSTEM_EXEC],
} as const satisfies Record<string, readonly Permission[]>;

/** Human-readable descriptions for each permission. */
export const PERMISSION_DESCRIPTIONS: Record<Permission, string> = {
  [FILESYSTEM_READ]: "Read files and directories on the host filesystem",
  [FILESYSTEM_WRITE]:
    "Create or modify files and directories on the host filesystem",
  [FILESYSTEM_DELETE]: "Delete files and directories on the host filesystem",
  [NETWORK_CLIENT]:
    "Make outbound network requests (HTTP, TCP, WebSocket, etc.)",
  [NETWORK_SERVER]:
    "Listen for inbound network connections (HTTP, SSE, gRPC, etc.)",
  [SYSTEM_ENV_READ]:
    "Read environment variables and host configuration values",
  [SYSTEM_EXEC]: "Execute child processes and shell commands on the host",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns `true` when `value` is a recognised permission string.
 */
export function isValidPermission(value: string): value is Permission {
  return (ALL_PERMISSIONS as readonly string[]).includes(value);
}

/**
 * Extract the category portion of a permission string.
 *
 * @example categoryOf("mcp.ac.filesystem.read") // "filesystem"
 */
export function categoryOf(permission: Permission): string {
  const parts = permission.split(".");
  return parts[2]; // mcp.ac.<category>.<action>
}
