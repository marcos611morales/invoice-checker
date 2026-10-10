/**
 * Leak guard for committed fixtures (LEDG-07).
 *
 * Fails the build if any fixture under tests/fixtures/cfdi (anonymized copies of
 * the real sample) or tests/fixtures/synthetic (hand-written, Plan 01-04) holds
 * a value outside the explicit placeholder patterns. It never reads the real,
 * git-ignored sample folder (CI does not have it) and never prints a value:
 * assertion messages name only the fixture file and the attribute.
 *
 * Placeholder conventions (binding for all fixtures):
 *   cfdi:      EMI010101xxx / EMIX010101xxx, RCP010101AA1, PAC010101AA1,
 *              BAN010101AA1, TER010101AA1, AAAAAAAA-0000-4000-8000-NNNNNNNNNNNN,
 *              PROVEEDOR NNN SA DE CV
 *   synthetic: SIN010101xxx, BBBBBBBB-0000-4000-8000-NNNNNNNNNNNN, SINTETICO ...
 */
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = fileURLToPath(new URL("../../", import.meta.url));
const TESTS_DIR = join(REPO_ROOT, "tests");
const CFDI_DIR = join(TESTS_DIR, "fixtures", "cfdi");
const SYNTHETIC_DIR = join(TESTS_DIR, "fixtures", "synthetic");

// --- Matchers: strict allowlists, anything else is a leak -------------------

const RFC_PLACEHOLDER =
  /^(?:EMIX?010101[0-9A-Z]{3}|RCP010101AA1|PAC010101AA1|BAN010101AA1|TER010101AA1|SIN010101[0-9A-Z]{3}|XAXX010101000|XEXX010101000)$/;
const UUID_PLACEHOLDER = /^(?:AAAAAAAA|BBBBBBBB)-0000-4000-8000-[0-9]{12}$/i;
const NOMBRE_PLACEHOLDER =
  /^(?:PROVEEDOR [0-9]{3} SA DE CV|RECEPTOR DE PRUEBA SA DE CV|TERCERO DE PRUEBA|SINTETICO.*)$/;

const isAllowedRfc = (value: string): boolean => RFC_PLACEHOLDER.test(value);
const isAllowedUuid = (value: string): boolean => UUID_PLACEHOLDER.test(value);
const isAllowedNombre = (value: string): boolean => NOMBRE_PLACEHOLDER.test(value);
const isAllowedSello = (value: string): boolean => value === "SELLO";
const isAllowedCertificado = (value: string): boolean => value === "CERTIFICADO";
const isAllowedAccount = (value: string): boolean => /^0+$/.test(value);

// --- Helpers ----------------------------------------------------------------

interface Fixture {
  /** Path relative to tests/fixtures, safe to print. */
  name: string;
  text: string;
}

function readFixtures(dir: string, label: string): Fixture[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".xml"))
    .sort()
    .map((f) => ({ name: `${label}/${f}`, text: readFileSync(join(dir, f), "utf8") }));
}

/** [attributeName, value] pairs whose attribute name passes `wanted`. */
function attributes(text: string, wanted: (name: string) => boolean): [string, string][] {
  const out: [string, string][] = [];
  for (const m of text.matchAll(/\s([A-Za-z_][\w.:-]*)\s*=\s*"([^"]*)"/g)) {
    const name = m[1];
    if (name !== undefined && wanted(name)) out.push([name, m[2] ?? ""]);
  }
  return out;
}

/** "file :: attribute" for every attribute value that fails `allowed`. Never the value. */
function violations(
  fixtures: Fixture[],
  wanted: (name: string) => boolean,
  allowed: (value: string) => boolean,
): string[] {
  return fixtures.flatMap((f) =>
    attributes(f.text, wanted)
      .filter(([, value]) => !allowed(value))
      .map(([name]) => `${f.name} :: ${name}`),
  );
}

function uuidViolations(fixtures: Fixture[]): string[] {
  return fixtures.flatMap((f) =>
    (f.text.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi) ?? [])
      .filter((token) => !isAllowedUuid(token))
      .map(() => `${f.name} :: UUID-shaped token`),
  );
}

function git(args: string[]): { status: number | null; stdout: string } {
  const result = spawnSync("git", args, { cwd: REPO_ROOT, encoding: "utf8" });
  return { status: result.status, stdout: result.stdout };
}

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === "node_modules") return [];
    const full = join(dir, entry.name);
    return entry.isDirectory() ? [full, ...walk(full)] : [full];
  });
}

const cfdi = readFixtures(CFDI_DIR, "cfdi");
const all = [...cfdi, ...readFixtures(SYNTHETIC_DIR, "synthetic")];

// --- Suite ------------------------------------------------------------------

describe("fixtures are anonymized (LEDG-07)", () => {
  it("only placeholder RFCs appear in any Rfc attribute", () => {
    expect(
      violations(all, (n) => n.includes("Rfc"), isAllowedRfc),
    ).toEqual([]);
  });

  it("only placeholder UUIDs appear anywhere", () => {
    expect(uuidViolations(all)).toEqual([]);
  });

  it("only placeholder names appear in any Nombre attribute", () => {
    expect(
      violations(all, (n) => n.startsWith("Nombre"), isAllowedNombre),
    ).toEqual([]);
  });

  it("seals, certificates and bank accounts are dummies in the cfdi fixtures", () => {
    expect([
      ...violations(cfdi, (n) => ["Sello", "SelloCFD", "SelloSAT"].includes(n), isAllowedSello),
      ...violations(cfdi, (n) => n === "Certificado", isAllowedCertificado),
      ...violations(cfdi, (n) => ["CtaOrdenante", "CtaBeneficiario"].includes(n), isAllowedAccount),
    ]).toEqual([]);
  });

  it("holds exactly 143 cfdi fixtures and PROFILE.json agrees", () => {
    expect(cfdi).toHaveLength(143);
    const profile = JSON.parse(readFileSync(join(CFDI_DIR, "PROFILE.json"), "utf8")) as {
      files: number;
    };
    expect(profile.files).toBe(143);
  });

  it("keeps fixtures tracked and the sample folder out of git and out of test paths", () => {
    const fixture = join("tests", "fixtures", "cfdi", "001.xml");
    expect(git(["check-ignore", "-q", fixture]).status).toBe(1);
    expect(git(["ls-files", "--", "Facturas"]).stdout.trim()).toBe("");
    const misplaced = walk(TESTS_DIR).filter((p) =>
      p
        .slice(TESTS_DIR.length)
        .split(/[\\/]/)
        .some((segment) => segment.toLowerCase() === "facturas"),
    );
    expect(misplaced).toHaveLength(0);
  });

  it("rejects real-looking identifiers (the guard discriminates)", () => {
    expect(isAllowedRfc("ABC850101AB1")).toBe(false);
    expect(isAllowedRfc("EMI010101001")).toBe(true);
    expect(isAllowedUuid("3f2b8c1e-5d4a-4e7b-9a0c-1b2d3e4f5a6b")).toBe(false);
    expect(isAllowedUuid("AAAAAAAA-0000-4000-8000-000000000001")).toBe(true);
    expect(isAllowedNombre("JUAN PEREZ SA DE CV")).toBe(false);
    expect(isAllowedNombre("PROVEEDOR 001 SA DE CV")).toBe(true);
    expect(isAllowedSello("MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA")).toBe(false);
    expect(isAllowedCertificado("MIIFuzCCA6OgAwIBAgIUMDAwMDEwMDAwMDA1")).toBe(false);
    expect(isAllowedAccount("012345678901234567")).toBe(false);
    // The same matcher the suite uses must also reject it inside a whole document.
    const leaky: Fixture = { name: "memory", text: '<Emisor Rfc="ABC850101AB1" Nombre="JUAN PEREZ"/>' };
    expect(violations([leaky], (n) => n.includes("Rfc"), isAllowedRfc)).toEqual([
      "memory :: Rfc",
    ]);
  });
});
