/**
 * AgentManifestGen — automated manifest generation for MCP servers.
 *
 * Analyses an MCP server's source code to produce an initial AgentManifest
 * that developers can review and refine. This mirrors the two-stage pipeline
 * described in the paper:
 *
 *   1. **Source analysis** — heuristic pattern matching to detect resource
 *      access (filesystem, network, env, exec).
 *   2. **Manifest assembly** — deduplicate detected permissions, attach
 *      rationales, and validate against the permission vocabulary.
 *
 * @module
 * @see https://arxiv.org/abs/2510.21236
 */

export { detectPermissions, type DetectionResult } from "./heuristics.js";

import { readFile } from "node:fs/promises";
import { readdirSync } from "node:fs";
import { join, extname } from "node:path";
import { detectPermissions, type DetectionResult } from "./heuristics.js";
import { createManifest, type AgentManifest } from "../manifest/index.js";
import type { Permission } from "../permissions.js";

// ---------------------------------------------------------------------------
// File discovery
// ---------------------------------------------------------------------------

const SOURCE_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".py",
  ".go",
  ".rs",
]);

const IGNORE_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  "out",
  ".next",
  "__pycache__",
  "vendor",
  "target",
]);

function collectSourceFiles(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!IGNORE_DIRS.has(entry.name)) {
        collectSourceFiles(join(dir, entry.name), files);
      }
    } else if (SOURCE_EXTENSIONS.has(extname(entry.name))) {
      files.push(join(dir, entry.name));
    }
  }
  return files;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface GenerationResult {
  manifest: AgentManifest;
  detections: DetectionResult[];
  filesScanned: number;
}

/**
 * Analyse a directory of source code and generate an AgentManifest.
 *
 * @param rootDir  Path to the MCP server source tree.
 * @param description  Optional server description. When omitted a generic
 *   placeholder is used — callers should replace it with a meaningful text.
 */
export async function generateManifest(
  rootDir: string,
  description?: string,
): Promise<GenerationResult> {
  const files = collectSourceFiles(rootDir);
  const allDetections: DetectionResult[] = [];
  const permissionSet = new Set<Permission>();

  for (const file of files) {
    const content = await readFile(file, "utf-8");
    const detections = detectPermissions(content);
    for (const d of detections) {
      allDetections.push(d);
      permissionSet.add(d.permission);
    }
  }

  // Deduplicate and merge rationales per permission
  const merged = new Map<Permission, DetectionResult>();
  for (const d of allDetections) {
    const existing = merged.get(d.permission);
    if (existing) {
      existing.matchCount += d.matchCount;
    } else {
      merged.set(d.permission, { ...d });
    }
  }

  const permissions = [...permissionSet];
  const desc =
    description ??
    "MCP server (auto-generated manifest — replace with a meaningful description)";

  const manifest = createManifest(desc, permissions);

  return {
    manifest,
    detections: [...merged.values()],
    filesScanned: files.length,
  };
}
