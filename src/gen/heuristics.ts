/**
 * Heuristic source-code analysis for permission detection.
 *
 * Scans source files for patterns that indicate specific resource access
 * requirements. This mirrors the first stage of the AgentManifestGen
 * pipeline described in the paper, which examines an MCP server's codebase
 * to enumerate the minimal set of required permissions.
 *
 * @see https://arxiv.org/abs/2510.21236
 */

import {
  FILESYSTEM_READ,
  FILESYSTEM_WRITE,
  FILESYSTEM_DELETE,
  NETWORK_CLIENT,
  NETWORK_SERVER,
  SYSTEM_ENV_READ,
  SYSTEM_EXEC,
  type Permission,
} from "../permissions.js";

// ---------------------------------------------------------------------------
// Pattern definitions
// ---------------------------------------------------------------------------

interface DetectionPattern {
  permission: Permission;
  /** Regex patterns applied to source code. */
  patterns: RegExp[];
  /** Human-readable rationale for why this pattern indicates the permission. */
  rationale: string;
}

const DETECTION_PATTERNS: DetectionPattern[] = [
  // -- Filesystem read ----------------------------------------------------
  {
    permission: FILESYSTEM_READ,
    patterns: [
      /\breadFile\b/,
      /\breadFileSync\b/,
      /\breaddir\b/,
      /\breaddirSync\b/,
      /\bcreateReadStream\b/,
      /\bfs\.read/,
      /\bfs\/promises\b/,
      /\bfsPromises\b/,
      /\bstatSync\b/,
      /\baccessSync\b/,
      /\bexistsSync\b/,
      /open\(.+['"]r['"]/,
    ],
    rationale: "Source code reads files or directories from the filesystem",
  },
  // -- Filesystem write ---------------------------------------------------
  {
    permission: FILESYSTEM_WRITE,
    patterns: [
      /\bwriteFile\b/,
      /\bwriteFileSync\b/,
      /\bcreateWriteStream\b/,
      /\bmkdir\b/,
      /\bmkdirSync\b/,
      /\bfs\.write/,
      /\bappendFile\b/,
      /\bcopyFile\b/,
      /\brename\b/,
      /open\(.+['"]w['"]/,
    ],
    rationale: "Source code creates or modifies files on the filesystem",
  },
  // -- Filesystem delete --------------------------------------------------
  {
    permission: FILESYSTEM_DELETE,
    patterns: [
      /\bunlink\b/,
      /\bunlinkSync\b/,
      /\brmSync\b/,
      /\brm\b.*recursive/,
      /\brmdir\b/,
      /\brmdirSync\b/,
    ],
    rationale: "Source code deletes files or directories",
  },
  // -- Network client -----------------------------------------------------
  {
    permission: NETWORK_CLIENT,
    patterns: [
      /\bfetch\(/,
      /\baxios\b/,
      /\bgot\(/,
      /\bhttp\.request\b/,
      /\bhttps\.request\b/,
      /\bhttp\.get\b/,
      /\bhttps\.get\b/,
      /\bnew\s+URL\b/,
      /\bXMLHttpRequest\b/,
      /\bWebSocket\b/,
      /\bnet\.connect\b/,
      /\bnet\.createConnection\b/,
      /\bundici\b/,
    ],
    rationale: "Source code makes outbound network requests",
  },
  // -- Network server -----------------------------------------------------
  {
    permission: NETWORK_SERVER,
    patterns: [
      /\b\.listen\(/,
      /\bcreateServer\b/,
      /\bexpress\(\)/,
      /\bfastify\b/,
      /\bhono\b/,
      /\bkoa\b/,
      /\bSSEServer\b/,
      /\bStreamableHTTPServer\b/,
    ],
    rationale: "Source code listens for inbound connections",
  },
  // -- Env read -----------------------------------------------------------
  {
    permission: SYSTEM_ENV_READ,
    patterns: [
      /process\.env\b/,
      /\bDeno\.env\b/,
      /\bdotenv\b/,
      /\bconfig\(\)/,
      /\benv\[/,
    ],
    rationale: "Source code reads environment variables or configuration",
  },
  // -- Exec ---------------------------------------------------------------
  {
    permission: SYSTEM_EXEC,
    patterns: [
      /\bexec\(/,
      /\bexecSync\b/,
      /\bexecFile\b/,
      /\bspawn\(/,
      /\bspawnSync\b/,
      /\bchild_process\b/,
      /\bshelljs\b/,
      /\bexeca\b/,
    ],
    rationale: "Source code executes child processes or shell commands",
  },
];

// ---------------------------------------------------------------------------
// Analyser
// ---------------------------------------------------------------------------

export interface DetectionResult {
  permission: Permission;
  rationale: string;
  matchCount: number;
}

/**
 * Scan source code content and return the detected permissions with
 * rationales and match counts.
 */
export function detectPermissions(sourceCode: string): DetectionResult[] {
  const results: DetectionResult[] = [];

  for (const pattern of DETECTION_PATTERNS) {
    let matchCount = 0;
    for (const re of pattern.patterns) {
      const global = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
      const matches = sourceCode.match(global);
      if (matches) {
        matchCount += matches.length;
      }
    }
    if (matchCount > 0) {
      results.push({
        permission: pattern.permission,
        rationale: pattern.rationale,
        matchCount,
      });
    }
  }

  return results;
}
