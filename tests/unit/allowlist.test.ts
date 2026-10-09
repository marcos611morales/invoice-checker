import { describe, expect, it } from "vitest";
import { evaluateAccess, parseAllowlist } from "@/auth/allowlist";

function session(email: string, emailVerified = true) {
  return { user: { email, emailVerified } };
}

describe("parseAllowlist", () => {
  it("trims, lowercases and drops empty entries", () => {
    const set = parseAllowlist(" A@x.com, b@Y.com ,,");
    expect([...set].sort()).toEqual(["a@x.com", "b@y.com"]);
  });

  it("splits on whitespace and newlines as well as commas", () => {
    const set = parseAllowlist("a@x.com\nb@y.com   c@z.com");
    expect([...set].sort()).toEqual(["a@x.com", "b@y.com", "c@z.com"]);
  });

  it("yields an empty set for a blank string", () => {
    expect(parseAllowlist("  , ,").size).toBe(0);
  });
});

describe("evaluateAccess", () => {
  const allowlist = parseAllowlist("a@x.com,b@y.com");

  it("is anonymous without a session", () => {
    expect(evaluateAccess(null, allowlist)).toEqual({ kind: "anonymous" });
  });

  it("allows a verified listed email regardless of case or surrounding spaces", () => {
    expect(evaluateAccess(session("  A@X.com "), allowlist)).toEqual({
      kind: "allowed",
      email: "a@x.com",
    });
  });

  it("denies a listed email that is not verified", () => {
    expect(evaluateAccess(session("a@x.com", false), allowlist)).toEqual({
      kind: "denied",
      email: "a@x.com",
    });
  });

  it("denies an unlisted email and carries its lowercase form", () => {
    expect(evaluateAccess(session("Intruso@Gmail.com"), allowlist)).toEqual({
      kind: "denied",
      email: "intruso@gmail.com",
    });
  });

  it("matches exactly: an alias a+1@x.com is not a@x.com", () => {
    expect(evaluateAccess(session("a+1@x.com"), allowlist)).toEqual({
      kind: "denied",
      email: "a+1@x.com",
    });
  });

  it("denies everyone when the allowlist is empty", () => {
    expect(evaluateAccess(session("a@x.com"), parseAllowlist(""))).toEqual({
      kind: "denied",
      email: "a@x.com",
    });
  });
});
