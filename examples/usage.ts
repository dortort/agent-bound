/**
 * Example: Using agent-bound programmatically
 *
 * This example demonstrates the three main workflows:
 *   1. Loading and validating a manifest
 *   2. Checking permissions at runtime
 *   3. Generating a manifest from source code
 */

import {
  // Manifest
  loadManifest,
  createManifest,
  saveManifest,
  validateManifest,

  // Permissions
  FILESYSTEM_READ,
  FILESYSTEM_WRITE,
  NETWORK_CLIENT,
  SYSTEM_ENV_READ,
  PERMISSION_DESCRIPTIONS,

  // Enforcement
  resolvePolicy,
  PermissionChecker,
  AuditLog,
  createAgentBox,

  // Generation
  generateManifest,
} from "agent-bound";

// ---------------------------------------------------------------------------
// 1. Create and validate a manifest
// ---------------------------------------------------------------------------

async function manifestExample(): Promise<void> {
  // Create programmatically
  const manifest = createManifest(
    "Example MCP server with filesystem and network access",
    [FILESYSTEM_READ, FILESYSTEM_WRITE, NETWORK_CLIENT, SYSTEM_ENV_READ],
  );

  console.log("Created manifest:", JSON.stringify(manifest, null, 2));

  // Validate
  const result = validateManifest(manifest);
  console.log("Valid:", result.valid);

  // Save to file
  await saveManifest(manifest, "./my-server-manifest.json");

  // Load from file
  const loaded = await loadManifest("./my-server-manifest.json");
  console.log("Loaded permissions:", loaded.permissions);
}

// ---------------------------------------------------------------------------
// 2. Policy resolution and permission checking
// ---------------------------------------------------------------------------

function enforcementExample(): void {
  const manifest = createManifest(
    "A server that reads files and calls APIs",
    [FILESYSTEM_READ, NETWORK_CLIENT, SYSTEM_ENV_READ],
  );

  // Resolve generic permissions → effective permissions with operator scoping
  const effective = resolvePolicy(manifest, {
    readPaths: ["/data/project", "/tmp"],
    allowedHosts: ["api.example.com", "cdn.example.com"],
    envVars: ["API_KEY", "NODE_ENV"],
  });

  console.log("Effective permissions:", JSON.stringify(effective, null, 2));

  // Create a permission checker for runtime enforcement
  const audit = new AuditLog();
  const checker = new PermissionChecker(effective, audit);

  // Check specific operations
  console.log("Read /data/project/file.txt:", checker.checkFileRead("/data/project/file.txt")); // true
  console.log("Read /etc/passwd:", checker.checkFileRead("/etc/passwd"));                       // false
  console.log("Connect api.example.com:", checker.checkNetworkClient("api.example.com"));       // true
  console.log("Connect evil.com:", checker.checkNetworkClient("evil.com"));                     // false
  console.log("Read API_KEY env:", checker.checkEnvRead("API_KEY"));                            // true
  console.log("Read SECRET env:", checker.checkEnvRead("SECRET"));                              // false

  // Review the audit log
  console.log("\nAudit log (denied only):");
  for (const entry of audit.denied()) {
    console.log(`  ${entry.permission} → ${entry.resource}: ${entry.detail}`);
  }
}

// ---------------------------------------------------------------------------
// 3. Auto-generate a manifest from source code
// ---------------------------------------------------------------------------

async function generationExample(): Promise<void> {
  const result = await generateManifest("./src", "My MCP server");

  console.log(`Scanned ${result.filesScanned} files`);
  console.log("Detected permissions:");
  for (const d of result.detections) {
    console.log(`  ${d.permission} (${d.matchCount} matches) — ${d.rationale}`);
  }
  console.log("\nGenerated manifest:", JSON.stringify(result.manifest, null, 2));
}

// ---------------------------------------------------------------------------
// Run examples
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log("=== Manifest Example ===\n");
  await manifestExample();

  console.log("\n=== Enforcement Example ===\n");
  enforcementExample();

  console.log("\n=== Generation Example ===\n");
  await generationExample();
}

main().catch(console.error);
