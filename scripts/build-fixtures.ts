/**
 * Local-only deterministic CFDI anonymizer (LEDG-07).
 *
 * This is the ONLY code that reads the real, git-ignored sample folder
 * (`Facturas/`, repo root, override with `--input <dir>`). It writes 143
 * anonymized copies to `tests/fixtures/cfdi/001.xml`.. plus `PROFILE.json`.
 *
 * Method: string-level, attribute-scoped replacement (never parse-and-rebuild,
 * which would lose the BOM, the XML declaration, prefixes and schemaLocation).
 * Maps are built from SORTED real values, so two runs over the same sample are
 * byte-identical. Output is written to a temp directory and swapped in at the
 * end, so an interrupted run leaves either the previous or the new complete set.
 *
 * Privacy: stdout and error messages contain aggregate counts only. No real
 * RFC, UUID, name, seal, account or file name is ever printed.
 */
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { Decimal } from "decimal.js";
import { XMLValidator } from "fast-xml-parser";

type Mode = "collect" | "apply" | "blank";
type Check = "substring" | "exact" | "none";

type AttrRule =
  | { attr: string; check: Check; kind: "fixed"; value: string }
  | { attr: string; check: Check; kind: "folio" }
  | { attr: string; check: Check; kind: "emisorRfc" }
  | { attr: string; check: Check; kind: "emisorNombre" }
  | { attr: string; check: Check; kind: "uuid" }
  | { attr: string; check: Check; kind: "desc" };

const fixed = (attr: string, value: string, check: Check = "substring"): AttrRule => ({
  attr,
  check,
  kind: "fixed",
  value,
});

/** Element local name -> attributes to rewrite. Everything else is untouched. */
const RULES: Record<string, AttrRule[]> = {
  Comprobante: [
    fixed("Sello", "SELLO"),
    fixed("Certificado", "CERTIFICADO"),
    fixed("NoCertificado", "00001000000000000000"),
    fixed("Serie", "A", "none"),
    { attr: "Folio", check: "none", kind: "folio" },
    fixed("LugarExpedicion", "00000", "exact"),
  ],
  Emisor: [
    { attr: "Rfc", check: "substring", kind: "emisorRfc" },
    { attr: "Nombre", check: "substring", kind: "emisorNombre" },
  ],
  Receptor: [
    fixed("Rfc", "RCP010101AA1"),
    fixed("Nombre", "RECEPTOR DE PRUEBA SA DE CV"),
    fixed("DomicilioFiscalReceptor", "00000", "exact"),
  ],
  Concepto: [
    { attr: "Descripcion", check: "exact", kind: "desc" },
    fixed("NoIdentificacion", "SKU", "exact"),
    fixed("Unidad", "Pieza", "exact"),
  ],
  TimbreFiscalDigital: [
    { attr: "UUID", check: "substring", kind: "uuid" },
    fixed("SelloCFD", "SELLO"),
    fixed("SelloSAT", "SELLO"),
    fixed("NoCertificadoSAT", "00001000000000000000"),
    fixed("RfcProvCertif", "PAC010101AA1"),
  ],
  CfdiRelacionado: [{ attr: "UUID", check: "substring", kind: "uuid" }],
  DoctoRelacionado: [
    { attr: "IdDocumento", check: "substring", kind: "uuid" },
    fixed("Serie", "A", "none"),
    { attr: "Folio", check: "none", kind: "folio" },
  ],
  Pago: [
    fixed("RfcEmisorCtaOrd", "BAN010101AA1"),
    fixed("RfcEmisorCtaBen", "BAN010101AA1"),
    fixed("CtaOrdenante", "0000000000", "exact"),
    fixed("CtaBeneficiario", "0000000000", "exact"),
    fixed("NomBancoOrdExt", "BANCO", "exact"),
  ],
  ACuentaTerceros: [
    fixed("RfcACuentaTerceros", "TER010101AA1"),
    fixed("NombreACuentaTerceros", "TERCERO DE PRUEBA"),
    fixed("DomicilioFiscalACuentaTerceros", "00000", "exact"),
  ],
  // Customs numbers identify a shipment; not in the plan's list, scrubbed anyway.
  InformacionAduanera: [fixed("NumeroPedimento", "000000000000000", "exact")],
};

const ATTR_RE = /(\s)([A-Za-z_][\w.:-]*)(\s*=\s*)(?:"([^"]*)"|'([^']*)')/g;
const RFC_SHAPE = /(?<![A-Za-z0-9])[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}(?![A-Za-z0-9])/g;
const UUID_SHAPE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const PLACEHOLDER_RFC =
  /^(?:EMIX?010101[0-9A-Z]{3}|RCP010101AA1|PAC010101AA1|BAN010101AA1|TER010101AA1)$/;
const PLACEHOLDER_UUID = /^AAAAAAAA-0000-4000-8000-[0-9]{12}$/i;

interface Seen {
  rfcs: Set<string>;
  uuids: Set<string>;
  descs: Set<string>;
  addenda: number;
}

interface Leak {
  substring: Set<string>;
  exact: Map<string, Set<string>>;
}

interface Ctx {
  issuerIndex: ReadonlyMap<string, number>;
  uuidMap: ReadonlyMap<string, string>;
  descMap: ReadonlyMap<string, string>;
  folio: string;
  seen: Seen;
  leak: Leak;
}

function fail(message: string): never {
  console.error(`fixtures:build FAILED: ${message}`);
  process.exit(1);
}

const pad = (n: number, width: number): string => String(n).padStart(width, "0");

// Built from the code point so the invisible character never sits in source text.
const BOM = String.fromCodePoint(0xfeff);
const stripBom = (text: string): string => (text.startsWith(BOM) ? text.slice(1) : text);

function rfcPlaceholder(real: string, index: number): string {
  const suffix = index.toString(36).toUpperCase().padStart(3, "0");
  return (real.length === 12 ? "EMI010101" : "EMIX010101") + suffix;
}

function computeReplacement(
  rule: AttrRule,
  orig: string,
  attrs: ReadonlyMap<string, string>,
  ctx: Ctx,
): string {
  switch (rule.kind) {
    case "fixed":
      return rule.value;
    case "folio":
      return ctx.folio;
    case "emisorRfc": {
      const idx = ctx.issuerIndex.get(orig);
      if (idx === undefined) throw new Error("unmapped issuer RFC");
      return rfcPlaceholder(orig, idx);
    }
    case "emisorNombre": {
      const idx = ctx.issuerIndex.get(attrs.get("Rfc") ?? "");
      if (idx === undefined) throw new Error("issuer name without mapped RFC");
      return `PROVEEDOR ${pad(idx, 3)} SA DE CV`;
    }
    case "uuid": {
      const mapped = ctx.uuidMap.get(orig.toLowerCase());
      if (mapped === undefined) throw new Error("unmapped UUID");
      return mapped;
    }
    case "desc": {
      const mapped = ctx.descMap.get(orig);
      if (mapped === undefined) throw new Error("unmapped description");
      return mapped;
    }
  }
}

function readAttrs(body: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const m of body.matchAll(ATTR_RE)) {
    const name = m[2];
    if (name !== undefined) out.set(name, m[4] ?? m[5] ?? "");
  }
  return out;
}

function collectFrom(rule: AttrRule, orig: string, seen: Seen): void {
  if (rule.kind === "emisorRfc") seen.rfcs.add(orig);
  else if (rule.kind === "uuid") seen.uuids.add(orig.toLowerCase());
  else if (rule.kind === "desc") seen.descs.add(orig);
}

function recordLeak(rule: AttrRule, orig: string, replacement: string, leak: Leak): void {
  if (rule.check === "none" || orig === "" || orig === replacement) return;
  if (rule.check === "substring" && orig.length >= 5) {
    leak.substring.add(orig.toLowerCase());
    return;
  }
  const set = leak.exact.get(rule.attr) ?? new Set<string>();
  set.add(orig);
  leak.exact.set(rule.attr, set);
}

function rewriteAttrs(body: string, rules: AttrRule[], ctx: Ctx, mode: Mode): string {
  const attrs = mode === "blank" ? new Map<string, string>() : readAttrs(body);
  return body.replace(
    ATTR_RE,
    (
      m: string,
      ws: string,
      name: string,
      eq: string,
      dq: string | undefined,
      sq: string | undefined,
    ) => {
      const rule = rules.find((r) => r.attr === name);
      if (!rule) return m;
      const quote = dq !== undefined ? '"' : "'";
      const orig = dq ?? sq ?? "";
      if (mode === "blank") return `${ws}${name}${eq}${quote}${quote}`;
      if (mode === "collect") {
        collectFrom(rule, orig, ctx.seen);
        return m;
      }
      const replacement = computeReplacement(rule, orig, attrs, ctx);
      recordLeak(rule, orig, replacement, ctx.leak);
      return `${ws}${name}${eq}${quote}${replacement}${quote}`;
    },
  );
}

const TAG_RES = Object.entries(RULES).map(([local, rules]) => ({
  rules,
  re: new RegExp(
    `<((?:[A-Za-z_][\\w.-]*:)?${local})(?=[\\s/>])((?:"[^"]*"|'[^']*'|[^>"'])*)>`,
    "g",
  ),
}));
const ADDENDA_RE = /<((?:[A-Za-z_][\w.-]*:)?Addenda)(?=[\s/>])((?:"[^"]*"|'[^']*'|[^>"'])*)>([\s\S]*?)<\/\1>/g;

function rewriteText(text: string, ctx: Ctx, mode: Mode): string {
  let out = text;
  for (const { rules, re } of TAG_RES) {
    out = out.replace(
      re,
      (_m: string, name: string, body: string) => `<${name}${rewriteAttrs(body, rules, ctx, mode)}>`,
    );
  }
  out = out.replace(ADDENDA_RE, (m: string, name: string, body: string, inner: string) => {
    if (mode === "collect") {
      ctx.seen.addenda += 1;
      return m;
    }
    if (mode === "apply" && inner.length > 0) ctx.seen.addenda += 1;
    return `<${name}${body}></${name}>`;
  });
  return out;
}

function findTagBody(text: string, local: string): Map<string, string> {
  const re = new RegExp(
    `<(?:[A-Za-z_][\\w.-]*:)?${local}(?=[\\s/>])((?:"[^"]*"|'[^']*'|[^>"'])*)>`,
  );
  const m = re.exec(text);
  return readAttrs(m?.[1] ?? "");
}

interface Facts {
  tipo: string;
  total: Decimal;
  rfc: string;
  fecha: string;
  conceptos: number;
  hasBom: boolean;
  hasDeclaration: boolean;
}

function factsOf(text: string): Facts {
  const comp = findTagBody(text, "Comprobante");
  const emisor = findTagBody(text, "Emisor");
  const total = comp.get("Total");
  if (total === undefined) throw new Error("Comprobante without Total");
  return {
    tipo: comp.get("TipoDeComprobante") ?? "",
    total: new Decimal(total),
    rfc: emisor.get("Rfc") ?? "",
    fecha: comp.get("Fecha") ?? "",
    conceptos: [...text.matchAll(/<(?:[A-Za-z_][\w.-]*:)?Concepto(?=[\s/>])/g)].length,
    hasBom: text.startsWith(BOM),
    hasDeclaration: stripBom(text).trimStart().startsWith("<?xml"),
  };
}

function netByIssuer(facts: Facts[], rfcOf: (f: Facts, i: number) => string): Decimal[] {
  const net = new Map<string, Decimal>();
  facts.forEach((f, i) => {
    const key = rfcOf(f, i);
    const delta = f.tipo === "I" ? f.total : f.tipo === "E" ? f.total.neg() : new Decimal(0);
    net.set(key, (net.get(key) ?? new Decimal(0)).plus(delta));
  });
  return [...net.values()].sort((a, b) => a.cmp(b));
}

const cmpStr = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

function parseArgs(argv: string[]): string {
  const i = argv.indexOf("--input");
  const given = i >= 0 ? argv[i + 1] : undefined;
  if (i >= 0 && given === undefined) fail("--input needs a directory");
  return resolve(given ?? "Facturas");
}

function main(): void {
  const inputRoot = parseArgs(process.argv.slice(2));
  if (!existsSync(inputRoot)) fail("sample folder not found (expected repo-root sample folder)");
  const relPaths = readdirSync(inputRoot, { recursive: true, encoding: "utf8" })
    .filter((p) => p.toLowerCase().endsWith(".xml"))
    .sort(cmpStr);
  if (relPaths.length === 0) fail("no XML files found in the sample folder");

  // 1. Read raw text; the UTF-8 round trip must be lossless (BOM kept in the string).
  const originals = relPaths.map((p) => {
    const buf = readFileSync(join(inputRoot, p));
    const text = buf.toString("utf8");
    if (!Buffer.from(text, "utf8").equals(buf)) fail("a source file is not lossless UTF-8");
    return text;
  });

  // 2. Collect real values and build the deterministic, injective maps.
  const seen: Seen = { rfcs: new Set(), uuids: new Set(), descs: new Set(), addenda: 0 };
  const emptyLeak = (): Leak => ({ substring: new Set(), exact: new Map() });
  const collectCtx: Ctx = {
    issuerIndex: new Map(),
    uuidMap: new Map(),
    descMap: new Map(),
    folio: "",
    seen,
    leak: emptyLeak(),
  };
  for (const text of originals) rewriteText(text, collectCtx, "collect");

  const sortedRfcs = [...seen.rfcs].sort(cmpStr);
  if (sortedRfcs.some((r) => r.length !== 12 && r.length !== 13)) {
    fail("an issuer RFC has an unexpected length");
  }
  const issuerIndex = new Map(sortedRfcs.map((r, i) => [r, i + 1] as const));
  const uuidMap = new Map(
    [...seen.uuids].sort(cmpStr).map((u, i) => [u, `AAAAAAAA-0000-4000-8000-${pad(i + 1, 12)}`] as const),
  );
  const descMap = new Map(
    [...seen.descs].sort(cmpStr).map((d, i) => [d, `CONCEPTO ${pad(i + 1, 4)}`] as const),
  );
  const mappedRfcs = new Set(sortedRfcs.map((r) => rfcPlaceholder(r, issuerIndex.get(r) ?? 0)));
  if (mappedRfcs.size !== sortedRfcs.length) fail("issuer RFC mapping is not injective");

  // 3. Rewrite.
  const leak = emptyLeak();
  const applySeen: Seen = { rfcs: new Set(), uuids: new Set(), descs: new Set(), addenda: 0 };
  const outputs = originals.map((text, i) =>
    rewriteText(
      text,
      { issuerIndex, uuidMap, descMap, folio: String(i + 1), seen: applySeen, leak },
      "apply",
    ),
  );

  // 4. Assertions (aggregate-only messages).
  if (outputs.length !== originals.length) fail("file count changed");
  const blankCtx: Ctx = { ...collectCtx, seen: applySeen };
  let structureDiffs = 0;
  let invalidXml = 0;
  outputs.forEach((out, i) => {
    if (rewriteText(originals[i] ?? "", blankCtx, "blank") !== rewriteText(out, blankCtx, "blank")) {
      structureDiffs += 1;
    }
    // fast-xml-parser's XMLValidator is flagged deprecated; the replacement package is not a pinned
    // dependency of this project, so the pinned parser's validator is used on purpose (plan 01-03).
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    if (XMLValidator.validate(stripBom(out)) !== true) invalidXml += 1;
  });
  if (structureDiffs > 0) fail(`${String(structureDiffs)} file(s) changed outside the anonymized attributes`);
  if (invalidXml > 0) fail(`${String(invalidXml)} output file(s) are not well-formed XML`);

  const before = originals.map(factsOf);
  const after = outputs.map(factsOf);
  const countBy = (fs: Facts[], pick: (f: Facts) => boolean): number => fs.filter(pick).length;
  for (const t of ["I", "E", "P"]) {
    if (countBy(before, (f) => f.tipo === t) !== countBy(after, (f) => f.tipo === t)) {
      fail("per-type counts changed");
    }
  }
  if (countBy(before, (f) => f.hasBom) !== countBy(after, (f) => f.hasBom)) fail("BOM count changed");
  if (countBy(before, (f) => !f.hasDeclaration) !== countBy(after, (f) => !f.hasDeclaration)) {
    fail("no-declaration count changed");
  }
  if (before.some((f, i) => !f.total.eq(after[i]?.total ?? NaN) || f.fecha !== after[i]?.fecha)) {
    fail("a Total or Fecha changed");
  }
  const issuersBefore = new Set(before.map((f) => f.rfc));
  const issuersAfter = new Set(after.map((f) => f.rfc));
  if (issuersBefore.size !== issuersAfter.size) fail("distinct issuer count changed");
  const netBefore = netByIssuer(before, (f) => f.rfc);
  const netAfter = netByIssuer(after, (f) => f.rfc);
  if (
    netBefore.length !== netAfter.length ||
    netBefore.some((d, i) => !d.eq(netAfter[i] ?? NaN))
  ) {
    fail("per-issuer net Total multiset changed");
  }

  // Leak scan: real values held in memory must not appear in any output.
  const allText = outputs.join("\n");
  const allLower = allText.toLowerCase();
  let leaks = 0;
  for (const v of leak.substring) if (allLower.includes(v)) leaks += 1;
  const outputValues = new Map<string, Set<string>>();
  for (const m of allText.matchAll(ATTR_RE)) {
    const name = m[2];
    if (name === undefined) continue;
    const set = outputValues.get(name) ?? new Set<string>();
    set.add(m[4] ?? m[5] ?? "");
    outputValues.set(name, set);
  }
  for (const [attr, reals] of leak.exact) {
    const present = outputValues.get(attr);
    if (!present) continue;
    for (const v of reals) if (present.has(v)) leaks += 1;
  }
  // Shape scan: every RFC-/UUID-shaped token must be a placeholder.
  for (const t of allText.match(RFC_SHAPE) ?? []) if (!PLACEHOLDER_RFC.test(t)) leaks += 1;
  for (const t of allText.match(UUID_SHAPE) ?? []) if (!PLACEHOLDER_UUID.test(t)) leaks += 1;
  if (leaks > 0) fail(`leak scan found ${String(leaks)} real-looking value(s) in the output`);

  // 5. Profile (aggregate only).
  const months: Record<string, number> = {};
  for (const f of after) {
    const key = f.fecha.slice(0, 7);
    months[key] = (months[key] ?? 0) + 1;
  }
  const sortedMonths = Object.fromEntries(Object.entries(months).sort(([a], [b]) => cmpStr(a, b)));
  const profile = {
    files: outputs.length,
    tipos: {
      I: countBy(after, (f) => f.tipo === "I"),
      E: countBy(after, (f) => f.tipo === "E"),
      P: countBy(after, (f) => f.tipo === "P"),
    },
    issuers: issuersAfter.size,
    withBom: countBy(after, (f) => f.hasBom),
    withoutDeclaration: countBy(after, (f) => !f.hasDeclaration),
    singleConcept: countBy(after, (f) => f.conceptos === 1),
    netTotal: netAfter.reduce((a, b) => a.plus(b), new Decimal(0)).toFixed(2),
    months: sortedMonths,
  };

  // 6. Write to a temp dir, then swap into place.
  const fixturesDir = resolve("tests", "fixtures");
  mkdirSync(fixturesDir, { recursive: true });
  const finalDir = join(fixturesDir, "cfdi");
  const tmpDir = join(fixturesDir, ".cfdi-tmp");
  const oldDir = join(fixturesDir, ".cfdi-old");
  if (!existsSync(finalDir) && existsSync(oldDir)) renameSync(oldDir, finalDir); // recover an interrupted swap
  rmSync(tmpDir, { recursive: true, force: true });
  rmSync(oldDir, { recursive: true, force: true });
  mkdirSync(tmpDir);
  const width = Math.max(3, String(outputs.length).length);
  outputs.forEach((out, i) => {
    writeFileSync(join(tmpDir, `${pad(i + 1, width)}.xml`), out, "utf8");
  });
  writeFileSync(join(tmpDir, "PROFILE.json"), `${JSON.stringify(profile, null, 2)}\n`, "utf8");
  if (existsSync(finalDir)) renameSync(finalDir, oldDir);
  renameSync(tmpDir, finalDir);
  rmSync(oldDir, { recursive: true, force: true });

  console.log(
    `fixtures:build OK - ${String(outputs.length)} files, ${String(seen.addenda)} Addenda emptied, ${String(seen.uuids.size)} UUIDs, ${String(seen.descs.size)} descriptions mapped`,
  );
  console.log(JSON.stringify(profile, null, 2));
}

try {
  main();
} catch (error) {
  fail(error instanceof Error ? error.message : "unexpected error");
}
