import { describe, it, expect, beforeEach } from "vitest";
import { PermissionChecker } from "../src/box/checker.js";
import { AuditLog } from "../src/box/audit.js";
import type { EffectivePermissions } from "../src/manifest/schema.js";

describe("PermissionChecker", () => {
  let audit: AuditLog;

  beforeEach(() => {
    audit = new AuditLog();
  });

  describe("filesystem checks", () => {
    it("allows reads within permitted paths", () => {
      const perms: EffectivePermissions = {
        filesystem: { read: ["/data/project"] },
      };
      const checker = new PermissionChecker(perms, audit);

      expect(checker.checkFileRead("/data/project/file.txt")).toBe(true);
      expect(checker.checkFileRead("/data/project/sub/dir/file.txt")).toBe(true);
    });

    it("denies reads outside permitted paths", () => {
      const perms: EffectivePermissions = {
        filesystem: { read: ["/data/project"] },
      };
      const checker = new PermissionChecker(perms, audit);

      expect(checker.checkFileRead("/etc/passwd")).toBe(false);
      expect(checker.checkFileRead("/data/other/file.txt")).toBe(false);
    });

    it("denies reads when no filesystem permission exists", () => {
      const checker = new PermissionChecker({}, audit);
      expect(checker.checkFileRead("/any/file")).toBe(false);
    });

    it("allows writes within permitted paths", () => {
      const perms: EffectivePermissions = {
        filesystem: { write: ["/tmp"] },
      };
      const checker = new PermissionChecker(perms, audit);

      expect(checker.checkFileWrite("/tmp/output.txt")).toBe(true);
    });

    it("denies writes outside permitted paths", () => {
      const perms: EffectivePermissions = {
        filesystem: { write: ["/tmp"] },
      };
      const checker = new PermissionChecker(perms, audit);

      expect(checker.checkFileWrite("/etc/shadow")).toBe(false);
    });

    it("handles delete checks", () => {
      const perms: EffectivePermissions = {
        filesystem: { delete: ["/tmp"] },
      };
      const checker = new PermissionChecker(perms, audit);

      expect(checker.checkFileDelete("/tmp/old-file.txt")).toBe(true);
      expect(checker.checkFileDelete("/important/file.txt")).toBe(false);
    });
  });

  describe("network checks", () => {
    it("allows connections to permitted hosts", () => {
      const perms: EffectivePermissions = {
        network: { allowedHosts: ["api.example.com", "cdn.example.com"] },
      };
      const checker = new PermissionChecker(perms, audit);

      expect(checker.checkNetworkClient("api.example.com")).toBe(true);
      expect(checker.checkNetworkClient("cdn.example.com")).toBe(true);
    });

    it("denies connections to unpermitted hosts", () => {
      const perms: EffectivePermissions = {
        network: { allowedHosts: ["api.example.com"] },
      };
      const checker = new PermissionChecker(perms, audit);

      expect(checker.checkNetworkClient("evil.com")).toBe(false);
    });

    it("wildcard allows all hosts", () => {
      const perms: EffectivePermissions = {
        network: { allowedHosts: ["*"] },
      };
      const checker = new PermissionChecker(perms, audit);

      expect(checker.checkNetworkClient("anything.com")).toBe(true);
    });

    it("checks server listen ports", () => {
      const perms: EffectivePermissions = {
        network: { listenPorts: [3000, 8080] },
      };
      const checker = new PermissionChecker(perms, audit);

      expect(checker.checkNetworkServer(3000)).toBe(true);
      expect(checker.checkNetworkServer(8080)).toBe(true);
      expect(checker.checkNetworkServer(22)).toBe(false);
    });

    it("denies network when no permission exists", () => {
      const checker = new PermissionChecker({}, audit);
      expect(checker.checkNetworkClient("any.host")).toBe(false);
      expect(checker.checkNetworkServer(80)).toBe(false);
    });
  });

  describe("system checks", () => {
    it("allows reading permitted env vars", () => {
      const perms: EffectivePermissions = {
        system: { envVars: ["API_KEY", "NODE_ENV"] },
      };
      const checker = new PermissionChecker(perms, audit);

      expect(checker.checkEnvRead("API_KEY")).toBe(true);
      expect(checker.checkEnvRead("NODE_ENV")).toBe(true);
      expect(checker.checkEnvRead("SECRET")).toBe(false);
    });

    it("allows executing permitted commands", () => {
      const perms: EffectivePermissions = {
        system: { allowedCommands: ["node", "npx"] },
      };
      const checker = new PermissionChecker(perms, audit);

      expect(checker.checkExec("node")).toBe(true);
      expect(checker.checkExec("npx")).toBe(true);
      expect(checker.checkExec("rm")).toBe(false);
    });

    it("denies system access when no permission exists", () => {
      const checker = new PermissionChecker({}, audit);
      expect(checker.checkEnvRead("PATH")).toBe(false);
      expect(checker.checkExec("ls")).toBe(false);
    });
  });

  describe("audit logging", () => {
    it("records all check decisions", () => {
      const perms: EffectivePermissions = {
        filesystem: { read: ["/data"] },
        network: { allowedHosts: ["api.example.com"] },
      };
      const checker = new PermissionChecker(perms, audit);

      checker.checkFileRead("/data/file.txt");   // allow
      checker.checkFileRead("/etc/passwd");       // deny
      checker.checkNetworkClient("evil.com");     // deny

      const all = audit.all();
      expect(all).toHaveLength(3);
      expect(all[0].decision).toBe("allow");
      expect(all[1].decision).toBe("deny");
      expect(all[2].decision).toBe("deny");
    });

    it("denied() filters to denials only", () => {
      const perms: EffectivePermissions = {
        filesystem: { read: ["/data"] },
      };
      const checker = new PermissionChecker(perms, audit);

      checker.checkFileRead("/data/ok.txt");
      checker.checkFileRead("/etc/shadow");

      expect(audit.denied()).toHaveLength(1);
      expect(audit.denied()[0].resource).toBe("/etc/shadow");
    });
  });
});
