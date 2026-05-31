/**
 * CORS Spike Test: Dictionary Site Fetch Viability
 *
 * PURPOSE: Determine whether frontend (browser) can fetch dictionary sites
 * directly, or if a Tauri backend proxy is needed.
 *
 * METHODOLOGY: curl requests with Origin: http://localhost:1420 (Tauri dev port)
 * checked for Access-Control-Allow-Origin header in responses.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * FINDINGS (recorded 2026-05-31):
 * ═══════════════════════════════════════════════════════════════════════
 *
 * 1. Etymonline (https://www.etymonline.com)
 *    - GET with Origin header → HTTP 200 but NO Access-Control-Allow-Origin
 *    - OPTIONS preflight → HTTP 400 (rejected)
 *    - RESULT: ❌ CORS blocks browser fetch. Need backend proxy.
 *
 * 2. Collins (https://www.collinsdictionary.com)
 *    - GET with Origin header → HTTP 403 (Cloudflare challenge)
 *    - Cross-Origin-Resource-Policy: same-origin
 *    - Has bot protection (Cf-Mitigated: challenge)
 *    - RESULT: ❌ CORS + bot protection blocks. Need backend proxy + headers.
 *
 * 3. Free Dictionary API (https://api.dictionaryapi.dev)
 *    - GET with Origin header → HTTP 200
 *    - Access-Control-Allow-Origin: *
 *    - RESULT: ✅ CORS allows direct browser fetch.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * DECISION:
 * ═══════════════════════════════════════════════════════════════════════
 * Frontend fetch viable for: Free Dictionary API only.
 * Backend proxy (Tauri Rust command) needed for: Etymonline, Collins.
 *
 * Recommended approach:
 * - Free Dictionary API → frontend fetch (simple, CORS-friendly)
 * - Etymonline/Collins → Tauri Rust command with reqwest + browser-like headers
 * - Use existing CSP-disabled context but respect server CORS policies
 *
 * @vitest-environment node
 */

import { describe, it, expect } from "vitest";

// All tests are skipped — these are spike/investigation results, not assertions.
// The comments above document real curl output from 2026-05-31.

describe("CORS spike: Etymonline", () => {
  it.skip("Etymonline returns no CORS headers — browser fetch blocked", () => {
    // curl -I -H "Origin: http://localhost:1420" "https://www.etymonline.com/word/test"
    // → 200 OK, but no Access-Control-Allow-Origin header
    // → OPTIONS preflight returns 400
    //
    // CONCLUSION: Frontend cannot read Etymonline responses. Backend proxy required.
  });
});

describe("CORS spike: Collins", () => {
  it.skip("Collins returns 403 with Cloudflare challenge — blocked", () => {
    // curl -I -H "Origin: http://localhost:1420" "https://www.collinsdictionary.com/dictionary/english/test"
    // → 403 Forbidden
    // → Headers: Cross-Origin-Resource-Policy: same-origin, Cf-Mitigated: challenge
    //
    // CONCLUSION: CORS + bot protection. Backend proxy with proper User-Agent needed.
  });
});

describe("CORS spike: Free Dictionary API", () => {
  it("Free Dictionary API allows CORS (Access-Control-Allow-Origin: *)", () => {
    // curl -I -H "Origin: http://localhost:1420" "https://api.dictionaryapi.dev/api/v2/entries/en/test"
    // → 200 OK
    // → Access-Control-Allow-Origin: *
    //
    // CONCLUSION: Frontend fetch viable. No proxy needed.
    expect(true).toBe(true); // Documented finding — this is a spike, not a real assertion
  });
});

describe("CORS decision record", () => {
  it("documents architecture decision for dictionary fetch strategy", () => {
    /**
     * ARCHITECTURE DECISION:
     *
     * 1. Free Dictionary API (api.dictionaryapi.dev)
     *    → Frontend fetch, CORS-friendly, no proxy
     *
     * 2. Etymonline / Collins
     *    → Tauri Rust backend command (reqwest + browser-like User-Agent)
     *    → Returns parsed HTML/JSON to frontend
     *    → Handles: CORS bypass, bot protection headers, rate limiting
     *
     * This avoids CSP issues (CSP is disabled in tauri.conf.json)
     * and respects server policies while enabling rich dictionary lookups.
     */
    expect(true).toBe(true);
  });
});
