/**
 * agent-bound — Access control framework for MCP servers.
 *
 * Experimental implementation inspired by the AgentBound research paper:
 * "Securing AI Agent Execution" (Bühler et al., 2025).
 *
 * @see https://arxiv.org/abs/2510.21236
 * @module
 */

// Permissions vocabulary
export {
  FILESYSTEM_READ,
  FILESYSTEM_WRITE,
  FILESYSTEM_DELETE,
  NETWORK_CLIENT,
  NETWORK_SERVER,
  SYSTEM_ENV_READ,
  SYSTEM_EXEC,
  ALL_PERMISSIONS,
  PERMISSION_CATEGORIES,
  PERMISSION_DESCRIPTIONS,
  isValidPermission,
  categoryOf,
  type Permission,
} from "./permissions.js";

// AgentManifest
export {
  type AgentManifest,
  type EffectivePermissions,
  type ValidationResult,
  type ValidationError,
  validateManifest,
  createManifest,
  loadManifest,
  saveManifest,
} from "./manifest/index.js";

// AgentBox
export {
  createAgentBox,
  resolvePolicy,
  launchSandbox,
  PermissionChecker,
  AuditLog,
  type AgentBoxOptions,
  type AgentBoxInstance,
  type PolicyOverrides,
  type SandboxOptions,
  type SandboxedProcess,
  type AuditEntry,
  type AuditDecision,
} from "./box/index.js";

// AgentManifestGen
export {
  generateManifest,
  detectPermissions,
  type GenerationResult,
  type DetectionResult,
} from "./gen/index.js";
