import { describe, expect, it } from "vitest";
import { scorePlayer } from "../scoring";
import type { NormalizedPlayer, RoleId } from "../types";

const basePlayer = (overrides: Partial<NormalizedPlayer> = {}): NormalizedPlayer => ({
  id: "test-player",
  raw: {},
  name: "Test Player",
  age: 24,
  position: "ST (C)",
  minutes: 2000,
  averageRating: 7,
  transferValueStatus: "fixed",
  valueM: 25,
  wageK: 80,
  ...overrides,
});

const withAttrs = (attrs: Record<string, number>, overrides: Partial<NormalizedPlayer> = {}) => basePlayer({ ...attrs, ...overrides });

describe("scorePlayer role scoring", () => {
  it("does not reward removing weak exported attributes", () => {
    const full = scorePlayer(withAttrs({
      acc: 16, pac: 16, fin: 15, otb: 15, ant: 14, cmp: 14, sta: 13, str: 13, agi: 13, bal: 13,
      jum: 12, nat: 12, wor: 12, fir: 9, pas: 11, tec: 11, dri: 11, hea: 11, dec: 12, cnt: 12, det: 12,
    }), "af-at", "ST");
    const removedWeak = scorePlayer(withAttrs({
      acc: 16, pac: 16, fin: 15, otb: 15, ant: 14, cmp: 14, sta: 13, str: 13, agi: 13, bal: 13,
      jum: 12, nat: 12, wor: 12, pas: 11, tec: 11, dri: 11, hea: 11, dec: 12, cnt: 12, det: 12,
    }), "af-at", "ST");

    expect(removedWeak.roleScore).toBeLessThanOrEqual(full.roleScore);
    expect(removedWeak.attribute.available).toBeLessThan(full.attribute.available);
  });

  it("favours spiky elite AF attributes over balanced mediocre attributes", () => {
    const elite = scorePlayer(withAttrs({
      acc: 18, pac: 18, fin: 18, otb: 18, ant: 16, cmp: 15, sta: 12, str: 12, agi: 13, bal: 12,
      jum: 11, nat: 11, wor: 10, fir: 11, pas: 9, tec: 11, dri: 12, hea: 10, dec: 12, cnt: 10, det: 10,
    }), "af-at", "ST");
    const mediocre = scorePlayer(withAttrs({
      acc: 13, pac: 13, fin: 13, otb: 13, ant: 13, cmp: 13, sta: 13, str: 13, agi: 13, bal: 13,
      jum: 13, nat: 13, wor: 13, fir: 13, pas: 13, tec: 13, dri: 13, hea: 13, dec: 13, cnt: 13, det: 13,
    }), "af-at", "ST");

    expect(elite.roleScore).toBeGreaterThan(mediocre.roleScore);
  });

  it("favours spiky elite BPD attributes over balanced mediocre attributes", () => {
    const elite = scorePlayer(withAttrs({
      pac: 17, jum: 17, pas: 17, tec: 17, tck: 16, dec: 16, ant: 16, cnt: 16, pos: 16,
      acc: 13, sta: 12, str: 13, agi: 11, bal: 12, hea: 13, mar: 13, cmp: 13, bra: 12, det: 12,
    }, { position: "D (C)" }), "bpd-de", "LCB");
    const mediocre = scorePlayer(withAttrs({
      pac: 13, jum: 13, pas: 13, tec: 13, tck: 13, dec: 13, ant: 13, cnt: 13, pos: 13,
      acc: 13, sta: 13, str: 13, agi: 13, bal: 13, hea: 13, mar: 13, cmp: 13, bra: 13, det: 13,
    }, { position: "D (C)" }), "bpd-de", "LCB");

    expect(elite.roleScore).toBeGreaterThan(mediocre.roleScore);
  });

  it("triggers floor penalties and caps", () => {
    const score = scorePlayer(withAttrs({
      acc: 16, pac: 16, fin: 9, otb: 15, ant: 14, cmp: 14, sta: 13, str: 13, agi: 13, bal: 13,
      jum: 12, nat: 12, wor: 12, fir: 12, pas: 11, tec: 11, dri: 11, hea: 11, dec: 12, cnt: 12, det: 12,
    }), "af-at", "ST");

    expect(score.roleScore).toBeLessThanOrEqual(72);
    expect(score.caps.some((cap) => cap.includes("72"))).toBe(true);
    expect(score.warnings).toContain("Finishing concern");
  });

  it("returns roleScore 0 with a warning when no role attributes are available", () => {
    const score = scorePlayer(basePlayer({ position: "D (C)" }), "bpd-de", "LCB");

    expect(score.roleScore).toBe(0);
    expect(score.attribute.score).toBeUndefined();
    expect(score.warnings).toContain("Missing role attributes: Role Score cannot be calculated");
  });

  it("keeps scorePlayer signature usable for every role", () => {
    const roles: RoleId[] = ["sk-su", "fb-at", "bpd-de", "dm-su", "if-su", "am-at", "af-at"];
    for (const role of roles) {
      const score = scorePlayer(basePlayer({ acc: 12, pac: 12, position: "ST (C)" }), role);
      expect(score.roleId).toBe(role);
      expect(Number.isFinite(score.roleScore)).toBe(true);
    }
  });

  it("parses FM multi-side position groups like AM (RLC)", () => {
    const player = withAttrs({
      acc: 16, pac: 16, dri: 16, fin: 15, otb: 15, fir: 14, tec: 14, fla: 14, ant: 14, cmp: 14,
    }, { position: "AM (RLC), ST (C)" });

    expect(scorePlayer(player, "if-su", "LW").position.score).toBeGreaterThanOrEqual(80);
    expect(scorePlayer(player, "if-su", "RW").position.score).toBeGreaterThanOrEqual(80);
    expect(scorePlayer(player, "am-at", "AMC").position.score).toBeGreaterThanOrEqual(80);
  });

  it("caps central hybrids below genuine attacking full backs for FB-At", () => {
    const hybrid = scorePlayer(withAttrs({
      acc: 16, pac: 17, sta: 19, wor: 18, cro: 12, dri: 12, otb: 14, tck: 15, mar: 15, pos: 16,
      pas: 16, tec: 16, dec: 14, ant: 17, fir: 16, nat: 16, agi: 15, bal: 15,
    }, { position: "D (L), DM, M (C)", leftFoot: "Very Strong", rightFoot: "Reasonable" }), "fb-at", "LB");
    const fullBack = scorePlayer(withAttrs({
      acc: 17, pac: 17, sta: 16, wor: 17, cro: 17, dri: 15, otb: 16, tck: 13, mar: 13, pos: 13,
      pas: 15, tec: 16, dec: 15, ant: 15, fir: 15, nat: 16, agi: 16, bal: 15,
    }, { position: "D (LC), WB/M (L)", leftFoot: "Very Strong", rightFoot: "Weak" }), "fb-at", "LB");

    expect(hybrid.roleScore).toBeLessThanOrEqual(68);
    expect(fullBack.roleScore).toBeGreaterThan(hybrid.roleScore);
  });
});
