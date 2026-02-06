#!/usr/bin/env node

/**
 * agent-bound CLI — command-line interface for the AgentBound framework.
 *
 * Commands:
 *   validate <manifest>       Validate an AgentManifest JSON file
 *   generate <dir>            Generate a manifest from MCP server source
 *   inspect  <manifest>       Display manifest permissions in human-readable form
 *   run      <manifest> -- <cmd...>  Launch an MCP server with enforcement
 */

import { parseArgs } from "node:util";
import { resolve } from "node:path";
import { loadManifest, saveManifest, validateManifest } from "../manifest/index.js";
import { createAgentBox } from "../box/index.js";
import { generateManifest } from "../gen/index.js";
import { resolvePolicy } from "../box/policy.js";
import { ALL_PERMISSIONS, PERMISSION_DESCRIPTIONS, type Permission } from "../permissions.js";
import { readFile } from "node:fs/promises";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function usage(): never {
  console.log(`
agent-bound — Access control framework for MCP servers

Usage:
  agent-bound validate <manifest.json>
  agent-bound generate <source-dir> [-o manifest.json] [-d "description"]
  agent-bound inspect  <manifest.json>
  agent-bound run      <manifest.json> -- <command...>
  agent-bound permissions

Commands:
  validate      Validate an AgentManifest JSON file against the schema
  generate      Analyse source code and generate a draft AgentManifest
  inspect       Display the permissions in a manifest in human-readable form
  run           Launch an MCP server inside an enforced sandbox
  permissions   List all permissions in the vocabulary

Options:
  -o, --output  Output file path (for generate)
  -d, --desc    Server description (for generate)
  -h, --help    Show this help message
`.trim());
  process.exit(0);
}

function fatal(msg: string): never {
  console.error(`error: ${msg}`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

async function cmdValidate(args: string[]): Promise<void> {
  const file = args[0];
  if (!file) fatal("missing manifest file path");

  const raw = await readFile(resolve(file), "utf-8");
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    fatal(`invalid JSON in ${file}`);
  }

  const result = validateManifest(data);
  if (result.valid) {
    console.log(`✓ ${file} is a valid AgentManifest`);
  } else {
    console.error(`✗ ${file} has validation errors:`);
    for (const err of result.errors) {
      console.error(`  ${err.path}: ${err.message}`);
    }
    process.exit(1);
  }
}

async function cmdGenerate(args: string[]): Promise<void> {
  const { values, positionals } = parseArgs({
    args,
    options: {
      output: { type: "string", short: "o" },
      desc: { type: "string", short: "d" },
    },
    allowPositionals: true,
  });

  const dir = positionals[0];
  if (!dir) fatal("missing source directory path");

  console.log(`Scanning ${resolve(dir)} ...`);
  const result = await generateManifest(resolve(dir), values.desc);

  console.log(`Scanned ${result.filesScanned} source files`);
  console.log(`Detected ${result.detections.length} permission(s):\n`);
  for (const d of result.detections) {
    console.log(`  ${d.permission}  (${d.matchCount} matches)`);
    console.log(`    → ${d.rationale}`);
  }

  if (values.output) {
    await saveManifest(result.manifest, resolve(values.output));
    console.log(`\nManifest written to ${values.output}`);
  } else {
    console.log("\nGenerated manifest:\n");
    console.log(JSON.stringify(result.manifest, null, 2));
  }
}

async function cmdInspect(args: string[]): Promise<void> {
  const file = args[0];
  if (!file) fatal("missing manifest file path");

  const manifest = await loadManifest(resolve(file));
  console.log(`Manifest: ${file}`);
  console.log(`Description: ${manifest.description}\n`);
  console.log("Permissions:");
  for (const perm of manifest.permissions) {
    const desc = PERMISSION_DESCRIPTIONS[perm] ?? "Unknown permission";
    console.log(`  ${perm}`);
    console.log(`    ${desc}`);
  }

  console.log("\nEffective policy (default overrides):");
  const effective = resolvePolicy(manifest);
  console.log(JSON.stringify(effective, null, 2));
}

async function cmdRun(args: string[]): Promise<void> {
  const dashDash = args.indexOf("--");
  if (dashDash === -1) fatal("usage: agent-bound run <manifest> -- <command...>");

  const file = args[0];
  if (!file) fatal("missing manifest file path");

  const command = args.slice(dashDash + 1);
  if (command.length === 0) fatal("missing command after --");

  const manifest = await loadManifest(resolve(file));

  console.log(`Manifest: ${file}`);
  console.log(`Command:  ${command.join(" ")}`);
  console.log(`Permissions: ${manifest.permissions.join(", ")}\n`);

  const box = createAgentBox({
    manifest,
    command,
    cwd: process.cwd(),
  });

  box.sandbox.process.on("exit", (code) => {
    const denied = box.audit.denied();
    if (denied.length > 0) {
      console.error(`\n${denied.length} denied access attempt(s):`);
      for (const entry of denied) {
        console.error(`  [${entry.timestamp}] ${entry.permission} → ${entry.resource}: ${entry.detail ?? "denied"}`);
      }
    }
    process.exit(code ?? 0);
  });

  box.sandbox.process.stdout?.pipe(process.stdout);
  box.sandbox.process.stderr?.pipe(process.stderr);
  process.stdin.pipe(box.sandbox.process.stdin!);
}

function cmdPermissions(): void {
  console.log("AgentBound permission vocabulary:\n");
  for (const perm of ALL_PERMISSIONS) {
    console.log(`  ${perm}`);
    console.log(`    ${PERMISSION_DESCRIPTIONS[perm]}`);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("-h") || args.includes("--help")) {
    usage();
  }

  const command = args[0];
  const rest = args.slice(1);

  switch (command) {
    case "validate":
      await cmdValidate(rest);
      break;
    case "generate":
      await cmdGenerate(rest);
      break;
    case "inspect":
      await cmdInspect(rest);
      break;
    case "run":
      await cmdRun(rest);
      break;
    case "permissions":
      cmdPermissions();
      break;
    default:
      fatal(`unknown command "${command}". Run agent-bound --help for usage.`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
