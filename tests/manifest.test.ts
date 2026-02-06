import { describe, it, expect } from "vitest";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import {
  validateManifest,
  createManifest,
  loadManifest,
  saveManifest,
} from "../src/manifest/index.js";
import { FILESYSTEM_READ, NETWORK_CLIENT } from "../src/permissions.js";

describe("validateManifest", () => {
  it("accepts a valid manifest", () => {
    const result = validateManifest({
      description: "A test server",
      permissions: ["mcp.ac.filesystem.read"],
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects non-object input", () => {
    expect(validateManifest(null).valid).toBe(false);
    expect(validateManifest("string").valid).toBe(false);
    expect(validateManifest([]).valid).toBe(false);
  });

  it("rejects missing description", () => {
    const result = validateManifest({ permissions: ["mcp.ac.filesystem.read"] });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path === "$.description")).toBe(true);
  });

  it("rejects empty description", () => {
    const result = validateManifest({
      description: "   ",
      permissions: ["mcp.ac.filesystem.read"],
    });
    expect(result.valid).toBe(false);
  });

  it("rejects invalid permissions", () => {
    const result = validateManifest({
      description: "test",
      permissions: ["mcp.ac.filesystem.execute"],
    });
    expect(result.valid).toBe(false);
    expect(result.errors[0].message).toContain("Unknown permission");
  });

  it("rejects duplicate permissions", () => {
    const result = validateManifest({
      description: "test",
      permissions: ["mcp.ac.filesystem.read", "mcp.ac.filesystem.read"],
    });
    expect(result.valid).toBe(false);
    expect(result.errors[0].message).toContain("Duplicate");
  });

  it("rejects non-array permissions", () => {
    const result = validateManifest({
      description: "test",
      permissions: "mcp.ac.filesystem.read",
    });
    expect(result.valid).toBe(false);
  });
});

describe("createManifest", () => {
  it("creates a valid manifest", () => {
    const m = createManifest("Test server", [FILESYSTEM_READ, NETWORK_CLIENT]);
    expect(m.description).toBe("Test server");
    expect(m.permissions).toContain(FILESYSTEM_READ);
    expect(m.permissions).toContain(NETWORK_CLIENT);
  });

  it("deduplicates permissions", () => {
    const m = createManifest("Test", [FILESYSTEM_READ, FILESYSTEM_READ]);
    expect(m.permissions).toHaveLength(1);
  });

  it("throws on invalid input", () => {
    expect(() => createManifest("", [FILESYSTEM_READ])).toThrow();
  });
});

describe("loadManifest / saveManifest", () => {
  let dir: string;

  it("round-trips a manifest through JSON", async () => {
    dir = await mkdtemp(join(tmpdir(), "agentbound-test-"));
    const filePath = join(dir, "manifest.json");

    const original = createManifest("Round-trip test", [FILESYSTEM_READ, NETWORK_CLIENT]);
    await saveManifest(original, filePath);
    const loaded = await loadManifest(filePath);

    expect(loaded).toEqual(original);
    await rm(dir, { recursive: true });
  });
});
