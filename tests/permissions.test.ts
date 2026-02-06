import { describe, it, expect } from "vitest";
import {
  ALL_PERMISSIONS,
  PERMISSION_DESCRIPTIONS,
  PERMISSION_CATEGORIES,
  isValidPermission,
  categoryOf,
  FILESYSTEM_READ,
  FILESYSTEM_WRITE,
  FILESYSTEM_DELETE,
  NETWORK_CLIENT,
  NETWORK_SERVER,
  SYSTEM_ENV_READ,
  SYSTEM_EXEC,
} from "../src/permissions.js";

describe("permissions", () => {
  it("defines 7 permissions", () => {
    expect(ALL_PERMISSIONS).toHaveLength(7);
  });

  it("all permissions follow mcp.ac.* naming", () => {
    for (const perm of ALL_PERMISSIONS) {
      expect(perm).toMatch(/^mcp\.ac\.\w+(\.\w+)+$/);
    }
  });

  it("every permission has a description", () => {
    for (const perm of ALL_PERMISSIONS) {
      expect(PERMISSION_DESCRIPTIONS[perm]).toBeDefined();
      expect(PERMISSION_DESCRIPTIONS[perm].length).toBeGreaterThan(0);
    }
  });

  it("categories cover all permissions", () => {
    const fromCategories = Object.values(PERMISSION_CATEGORIES).flat();
    expect(new Set(fromCategories)).toEqual(new Set(ALL_PERMISSIONS));
  });

  describe("isValidPermission", () => {
    it("accepts valid permissions", () => {
      expect(isValidPermission("mcp.ac.filesystem.read")).toBe(true);
      expect(isValidPermission("mcp.ac.network.client")).toBe(true);
      expect(isValidPermission("mcp.ac.system.exec")).toBe(true);
    });

    it("rejects invalid permissions", () => {
      expect(isValidPermission("mcp.ac.filesystem.execute")).toBe(false);
      expect(isValidPermission("invalid")).toBe(false);
      expect(isValidPermission("")).toBe(false);
    });
  });

  describe("categoryOf", () => {
    it("extracts the category", () => {
      expect(categoryOf(FILESYSTEM_READ)).toBe("filesystem");
      expect(categoryOf(NETWORK_CLIENT)).toBe("network");
      expect(categoryOf(SYSTEM_ENV_READ)).toBe("system");
    });
  });
});
