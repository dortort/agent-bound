import { describe, it, expect } from "vitest";
import { detectPermissions } from "../src/gen/heuristics.js";

describe("detectPermissions", () => {
  it("detects filesystem read patterns", () => {
    const code = `
      import { readFile } from "node:fs/promises";
      const data = await readFile("config.json", "utf-8");
    `;
    const results = detectPermissions(code);
    const perms = results.map((r) => r.permission);
    expect(perms).toContain("mcp.ac.filesystem.read");
  });

  it("detects filesystem write patterns", () => {
    const code = `
      import { writeFile, mkdir } from "node:fs/promises";
      await mkdir("output", { recursive: true });
      await writeFile("output/result.json", data);
    `;
    const results = detectPermissions(code);
    const perms = results.map((r) => r.permission);
    expect(perms).toContain("mcp.ac.filesystem.write");
  });

  it("detects filesystem delete patterns", () => {
    const code = `
      import { unlink, rmdir } from "node:fs";
      unlink("temp.txt", (err) => {});
    `;
    const results = detectPermissions(code);
    const perms = results.map((r) => r.permission);
    expect(perms).toContain("mcp.ac.filesystem.delete");
  });

  it("detects network client patterns", () => {
    const code = `
      const response = await fetch("https://api.example.com/data");
      const result = await response.json();
    `;
    const results = detectPermissions(code);
    const perms = results.map((r) => r.permission);
    expect(perms).toContain("mcp.ac.network.client");
  });

  it("detects network server patterns", () => {
    const code = `
      import express from "express";
      const app = express();
      app.listen(3000);
    `;
    const results = detectPermissions(code);
    const perms = results.map((r) => r.permission);
    expect(perms).toContain("mcp.ac.network.server");
  });

  it("detects environment variable access", () => {
    const code = `
      const apiKey = process.env.API_KEY;
      const mode = process.env.NODE_ENV;
    `;
    const results = detectPermissions(code);
    const perms = results.map((r) => r.permission);
    expect(perms).toContain("mcp.ac.system.env.read");
  });

  it("detects child process execution", () => {
    const code = `
      import { exec } from "node:child_process";
      exec("git status", (err, stdout) => console.log(stdout));
    `;
    const results = detectPermissions(code);
    const perms = results.map((r) => r.permission);
    expect(perms).toContain("mcp.ac.system.exec");
  });

  it("detects multiple permissions in one file", () => {
    const code = `
      import { readFile, writeFile } from "node:fs/promises";
      import { exec } from "node:child_process";
      const key = process.env.API_KEY;
      const data = await fetch("https://api.example.com");
    `;
    const results = detectPermissions(code);
    const perms = results.map((r) => r.permission);

    expect(perms).toContain("mcp.ac.filesystem.read");
    expect(perms).toContain("mcp.ac.filesystem.write");
    expect(perms).toContain("mcp.ac.network.client");
    expect(perms).toContain("mcp.ac.system.env.read");
    expect(perms).toContain("mcp.ac.system.exec");
  });

  it("returns empty for code with no resource access", () => {
    const code = `
      function add(a: number, b: number): number {
        return a + b;
      }
      console.log(add(1, 2));
    `;
    const results = detectPermissions(code);
    expect(results).toHaveLength(0);
  });

  it("provides match counts", () => {
    const code = `
      readFile("a.txt");
      readFile("b.txt");
      readFile("c.txt");
    `;
    const results = detectPermissions(code);
    const fsRead = results.find((r) => r.permission === "mcp.ac.filesystem.read");
    expect(fsRead).toBeDefined();
    expect(fsRead!.matchCount).toBeGreaterThanOrEqual(3);
  });

  it("provides rationales", () => {
    const code = `const x = await fetch("http://example.com");`;
    const results = detectPermissions(code);
    expect(results[0].rationale).toBeTruthy();
    expect(typeof results[0].rationale).toBe("string");
  });
});
