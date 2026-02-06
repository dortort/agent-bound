import { describe, it, expect } from "vitest";
import { resolvePolicy } from "../src/box/policy.js";
import { createManifest } from "../src/manifest/index.js";
import {
  FILESYSTEM_READ,
  FILESYSTEM_WRITE,
  FILESYSTEM_DELETE,
  NETWORK_CLIENT,
  NETWORK_SERVER,
  SYSTEM_ENV_READ,
  SYSTEM_EXEC,
} from "../src/permissions.js";

describe("resolvePolicy", () => {
  it("produces empty effective permissions for empty manifest", () => {
    const manifest = createManifest("Empty server", []);
    const effective = resolvePolicy(manifest);
    expect(effective).toEqual({});
  });

  it("resolves filesystem permissions with defaults", () => {
    const manifest = createManifest("FS server", [FILESYSTEM_READ, FILESYSTEM_WRITE]);
    const effective = resolvePolicy(manifest);

    expect(effective.filesystem).toBeDefined();
    expect(effective.filesystem!.read).toEqual([process.cwd()]);
    expect(effective.filesystem!.write).toEqual([process.cwd()]);
    expect(effective.filesystem!.delete).toBeUndefined();
  });

  it("resolves filesystem permissions with overrides", () => {
    const manifest = createManifest("FS server", [FILESYSTEM_READ]);
    const effective = resolvePolicy(manifest, {
      readPaths: ["/custom/path", "/another"],
    });

    expect(effective.filesystem!.read).toEqual(["/custom/path", "/another"]);
  });

  it("resolves delete permissions defaulting to write paths", () => {
    const manifest = createManifest("FS server", [FILESYSTEM_WRITE, FILESYSTEM_DELETE]);
    const effective = resolvePolicy(manifest, {
      writePaths: ["/data"],
    });

    expect(effective.filesystem!.delete).toEqual(["/data"]);
  });

  it("resolves network client with wildcard default", () => {
    const manifest = createManifest("Net server", [NETWORK_CLIENT]);
    const effective = resolvePolicy(manifest);

    expect(effective.network!.allowedHosts).toEqual(["*"]);
  });

  it("resolves network with overrides", () => {
    const manifest = createManifest("Net server", [NETWORK_CLIENT, NETWORK_SERVER]);
    const effective = resolvePolicy(manifest, {
      allowedHosts: ["api.example.com"],
      listenPorts: [3000],
    });

    expect(effective.network!.allowedHosts).toEqual(["api.example.com"]);
    expect(effective.network!.listenPorts).toEqual([3000]);
  });

  it("resolves system permissions", () => {
    const manifest = createManifest("System server", [SYSTEM_ENV_READ, SYSTEM_EXEC]);
    const effective = resolvePolicy(manifest, {
      envVars: ["API_KEY"],
      allowedCommands: ["node"],
    });

    expect(effective.system!.envVars).toEqual(["API_KEY"]);
    expect(effective.system!.allowedCommands).toEqual(["node"]);
  });

  it("only includes sections for granted permissions", () => {
    const manifest = createManifest("Minimal server", [NETWORK_CLIENT]);
    const effective = resolvePolicy(manifest);

    expect(effective.filesystem).toBeUndefined();
    expect(effective.network).toBeDefined();
    expect(effective.system).toBeUndefined();
  });
});
