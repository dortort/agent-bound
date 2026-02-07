# agent-bound

> **Experimental** — Access control framework for MCP servers, inspired by the [AgentBound](https://arxiv.org/abs/2510.21236) research paper.

`agent-bound` brings Android-style declarative permissions to [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) servers. Each MCP server ships a manifest declaring the system resources it needs. At runtime a policy enforcement engine restricts the server to only those resources, shifting the ecosystem from *trust-by-default* toward *least-privilege*.

## Status

This is an **experimental reference implementation** for research and prototyping. It is not production-hardened. The permission vocabulary and manifest format may change.

## Overview

The framework has three components, mirroring the paper's architecture:

| Component | Description |
|---|---|
| **AgentManifest** | Declarative JSON policy declaring which resources an MCP server requires |
| **AgentBox** | Policy enforcement engine — resolves generic permissions into scoped runtime permissions and enforces them |
| **AgentManifestGen** | Automated manifest generator — analyses source code to produce a draft manifest |

### How it works

```
┌──────────────────────────────────────────────────────────────┐
│  MCP Server Codebase                                         │
│                                                              │
│  ┌───────────────────┐     ┌──────────────────────────────┐  │
│  │ AgentManifestGen  │────▶│ agent-manifest.json          │  │
│  │ (source analysis) │     │ {                            │  │
│  └───────────────────┘     │   "description": "...",      │  │
│                            │   "permissions": [           │  │
│                            │     "mcp.ac.filesystem.read",│  │
│                            │     "mcp.ac.network.client"  │  │
│                            │   ]                          │  │
│                            │ }                            │  │
│                            └──────────────┬───────────────┘  │
└───────────────────────────────────────────┼──────────────────┘
                                            │
                                            ▼
┌──────────────────────────────────────────────────────────────┐
│  AgentBox (Policy Enforcement Engine)                        │
│                                                              │
│  1. Load manifest                                            │
│  2. Resolve generic → effective permissions (with overrides) │
│  3. Request user consent                                     │
│  4. Launch MCP server in sandboxed environment               │
│  5. Enforce: filtered env, scoped fs, network allow-list     │
│  6. Audit all access attempts                                │
└──────────────────────────────────────────────────────────────┘
```

## Installation

```bash
npm install agent-bound
```

Or clone and build from source:

```bash
git clone <repo-url>
cd agent-bound
npm install
npm run build
```

## Permission Vocabulary

Permissions use the `mcp.ac.<category>.<action>` naming convention:

| Permission | Category | Description |
|---|---|---|
| `mcp.ac.filesystem.read` | Filesystem | Read files and directories |
| `mcp.ac.filesystem.write` | Filesystem | Create or modify files and directories |
| `mcp.ac.filesystem.delete` | Filesystem | Delete files and directories |
| `mcp.ac.network.client` | Network | Make outbound network requests (HTTP, TCP, WebSocket) |
| `mcp.ac.network.server` | Network | Listen for inbound connections (HTTP, SSE, gRPC) |
| `mcp.ac.system.env.read` | System | Read environment variables and configuration |
| `mcp.ac.system.exec` | System | Execute child processes and shell commands |

The vocabulary was validated against 296 real-world MCP servers (see [paper evaluation](#academic-reference)).

## Usage

### CLI

```bash
# List all permissions in the vocabulary
agent-bound permissions

# Validate a manifest file
agent-bound validate ./agent-manifest.json

# Inspect a manifest (human-readable output with effective policy)
agent-bound inspect ./agent-manifest.json

# Auto-generate a manifest from source code
agent-bound generate ./my-mcp-server/ -o agent-manifest.json -d "My server description"

# Launch an MCP server with enforcement
agent-bound run ./agent-manifest.json -- node server.js
```

### Programmatic API

#### Creating and validating manifests

```typescript
import {
  createManifest,
  validateManifest,
  saveManifest,
  loadManifest,
  FILESYSTEM_READ,
  NETWORK_CLIENT,
  SYSTEM_ENV_READ,
} from "agent-bound";

// Create a manifest
const manifest = createManifest(
  "My MCP server that reads config files and calls external APIs",
  [FILESYSTEM_READ, NETWORK_CLIENT, SYSTEM_ENV_READ],
);

// Validate arbitrary JSON
const result = validateManifest(someJsonData);
if (!result.valid) {
  console.error(result.errors);
}

// Persist and load
await saveManifest(manifest, "./agent-manifest.json");
const loaded = await loadManifest("./agent-manifest.json");
```

#### Policy resolution and enforcement

```typescript
import {
  loadManifest,
  resolvePolicy,
  PermissionChecker,
  AuditLog,
} from "agent-bound";

const manifest = await loadManifest("./agent-manifest.json");

// Resolve generic permissions into scoped effective permissions
const effective = resolvePolicy(manifest, {
  readPaths: ["/data/project"],
  allowedHosts: ["api.example.com"],
  envVars: ["API_KEY", "NODE_ENV"],
});

// Create a checker for runtime enforcement
const audit = new AuditLog();
const checker = new PermissionChecker(effective, audit);

checker.checkFileRead("/data/project/config.json"); // true
checker.checkFileRead("/etc/passwd");                // false
checker.checkNetworkClient("api.example.com");       // true
checker.checkNetworkClient("evil.com");              // false
checker.checkEnvRead("API_KEY");                     // true
checker.checkEnvRead("DATABASE_URL");                // false

// Review denied attempts
for (const entry of audit.denied()) {
  console.log(`DENIED: ${entry.permission} → ${entry.resource}`);
}
```

#### Launching a sandboxed MCP server

```typescript
import { loadManifest, createAgentBox } from "agent-bound";

const manifest = await loadManifest("./agent-manifest.json");

const box = createAgentBox({
  manifest,
  command: ["node", "my-mcp-server.js"],
  overrides: {
    readPaths: ["/data/shared"],
    allowedHosts: ["api.example.com"],
    envVars: ["API_KEY"],
  },
});

// The server process runs with a filtered environment
// Only declared env vars are visible; PATH is restricted

// Dynamic checks during operation
box.checker.checkFileRead("/data/shared/doc.txt"); // true

// Shut down
box.stop();

// Review audit log
console.log(box.audit.toJSON());
```

#### Auto-generating manifests from source code

```typescript
import { generateManifest } from "agent-bound";

const result = await generateManifest("./path/to/mcp-server", "My MCP server");

console.log(`Scanned ${result.filesScanned} files`);
for (const detection of result.detections) {
  console.log(`${detection.permission} (${detection.matchCount} matches)`);
  console.log(`  Rationale: ${detection.rationale}`);
}

console.log(JSON.stringify(result.manifest, null, 2));
```

## Manifest Format

An `agent-manifest.json` file:

```json
{
  "description": "Filesystem MCP server with read-only access to project files.",
  "permissions": [
    "mcp.ac.filesystem.read"
  ]
}
```

A more complete example (browser automation server):

```json
{
  "description": "Playwright MCP server providing browser automation. Launches browsers, navigates pages, takes screenshots, and writes artifacts to disk.",
  "permissions": [
    "mcp.ac.filesystem.read",
    "mcp.ac.filesystem.write",
    "mcp.ac.system.env.read",
    "mcp.ac.network.client",
    "mcp.ac.system.exec"
  ]
}
```

See [`examples/`](./examples/) for more manifest examples.

## Generic vs. Effective Permissions

The framework uses a two-layer permission model:

1. **Generic permissions** are declared in the manifest (`mcp.ac.filesystem.read`). They state *what kind* of access is needed.

2. **Effective permissions** are resolved at launch time by the operator. They scope each generic permission to concrete resources:

```typescript
// Generic: "this server needs filesystem read access"
// Effective: "it can read /data/project and /tmp, nothing else"

const effective = resolvePolicy(manifest, {
  readPaths: ["/data/project", "/tmp"],
  allowedHosts: ["api.example.com"],
  envVars: ["API_KEY"],
  listenPorts: [3000],
  allowedCommands: ["node", "npx"],
});
```

This separation allows manifest authors to declare intent while operators maintain control over the actual scope.

## Project Structure

```
agent-bound/
├── src/
│   ├── permissions.ts          # Permission vocabulary (mcp.ac.* constants)
│   ├── index.ts                # Public API re-exports
│   ├── manifest/
│   │   ├── schema.ts           # AgentManifest types and validation
│   │   └── index.ts            # Manifest I/O (load, save, create)
│   ├── box/
│   │   ├── policy.ts           # Generic → effective permission resolution
│   │   ├── sandbox.ts          # Process sandbox launcher
│   │   ├── checker.ts          # Runtime permission checker
│   │   ├── audit.ts            # Audit logging
│   │   └── index.ts            # AgentBox high-level API
│   ├── gen/
│   │   ├── heuristics.ts       # Source-code pattern detection
│   │   └── index.ts            # Manifest generation pipeline
│   └── cli/
│       └── index.ts            # CLI entry point
├── tests/                      # Vitest test suite
├── examples/                   # Example manifests and usage code
├── package.json
└── tsconfig.json
```

## Development

```bash
npm install          # Install dependencies
npm run build        # Compile TypeScript
npm test             # Run tests
npm run dev          # Watch mode compilation
```

## Limitations

- **Process-level enforcement only.** The current sandbox filters the environment and restricts PATH but does not use OS-level isolation (namespaces, seccomp, cgroups). For stronger guarantees, run within a container runtime.
- **Static heuristic analysis.** `AgentManifestGen` uses pattern matching, not full program analysis. It may produce false positives or miss permissions accessed through dynamic patterns.
- **No runtime interception.** The `PermissionChecker` is advisory — it evaluates whether an action *should* be allowed, but does not intercept syscalls. Pair with a real sandbox for enforcement.

## Academic Reference

This project is inspired by:

> Christoph Bühler, Matteo Biagiola, Luca Di Grazia, and Guido Salvaneschi.
> **"Securing AI Agent Execution."**
> arXiv preprint arXiv:2510.21236, 2025.
> [https://arxiv.org/abs/2510.21236](https://arxiv.org/abs/2510.21236)

The paper introduces AgentBound, the first access control framework for MCP servers, combining a declarative policy mechanism (inspired by the Android permission model) with a policy enforcement engine. Their evaluation on 296 popular MCP servers showed that manifests can be auto-generated with 80.9% accuracy, the permission vocabulary covers 100% of real-world requirements, and enforcement overhead is negligible (0.6 ms average).

## License

MIT
