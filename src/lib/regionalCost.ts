/**
 * PROTOTYPE (branch feat/require-city-region, not live): a regional cost index by US state, so a cost
 * range can be checked against, or fall back to, how prices and wages in that state compare with the
 * US average. ESTIMATE ONLY, never a quote. Pure data + math, no network, no model calls.
 *
 * Sources (public, no license fee; both retrieved 2026-10-30):
 * - Materials: BEA Regional Price Parities by State, 2023, "Goods" column (Table 2 of the BEA release
 *   "Real Personal Consumption Expenditures by State and Real Personal Income by State and Metropolitan
 *   Area, 2023", Dec 12, 2024): https://www.bea.gov/sites/default/files/2024-12/rpp1224.pdf
 *   US goods RPP is 99.5 (all items = 100), so the factor is state goods RPP / 99.5.
 *   Goods RPPs cover all consumer goods, not building materials alone: a proxy, and a narrow one
 *   (92.0 to 107.5 across states).
 * - Labor: BLS Occupational Employment and Wage Statistics (OEWS), May 2025, SOC 47-0000 "Construction
 *   and Extraction Occupations", hourly mean wage, state vs national (US $31.42/h). Pulled from the BLS
 *   public API, series OEUS<fips>00000000000470000 03 / OEUN000000000000047000003:
 *   https://api.bls.gov/publicAPI/v1/timeseries/data/ (docs: https://www.bls.gov/oes/)
 *   Mean wage, not a billed rate: contractor rates add overhead and profit, which the factor leaves as-is.
 * RSMeans City Cost Indexes are the usual industry location factors, but they are licensed (Gordian),
 * so they are not copied here; a licensed table could replace this one with the same shape.
 */

export interface StateCostRow {
  name: string;
  /** BEA RPP 2023, goods (US all items = 100). */
  goodsRpp: number;
  /** BLS OEWS May 2025, SOC 47-0000 hourly mean wage, USD. */
  constructionWage: number;
}

/** US reference values for the two columns above. */
export const US_GOODS_RPP = 99.5;
export const US_CONSTRUCTION_WAGE = 31.42;

export const COST_INDEX_LABEL = "Estimate from state averages, not a quote" as const;
export const COST_INDEX_SOURCE = "BEA Regional Price Parities 2023 (goods) and BLS OEWS May 2025 construction wages";

export const STATE_COST_TABLE: Record<string, StateCostRow> = {
  AL: { name: "Alabama", goodsRpp: 95.1, constructionWage: 24.82 },
  AK: { name: "Alaska", goodsRpp: 100.4, constructionWage: 39.06 },
  AZ: { name: "Arizona", goodsRpp: 97.5, constructionWage: 28.86 },
  AR: { name: "Arkansas", goodsRpp: 92.1, constructionWage: 23.39 },
  CA: { name: "California", goodsRpp: 107.5, constructionWage: 37.64 },
  CO: { name: "Colorado", goodsRpp: 98.1, constructionWage: 31.67 },
  CT: { name: "Connecticut", goodsRpp: 97.4, constructionWage: 35.12 },
  DE: { name: "Delaware", goodsRpp: 98.4, constructionWage: 30.12 },
  DC: { name: "District of Columbia", goodsRpp: 105.9, constructionWage: 35.66 },
  FL: { name: "Florida", goodsRpp: 98.4, constructionWage: 26.71 },
  GA: { name: "Georgia", goodsRpp: 98.3, constructionWage: 27.12 },
  HI: { name: "Hawaii", goodsRpp: 106.9, constructionWage: 40.48 },
  ID: { name: "Idaho", goodsRpp: 94.0, constructionWage: 28.31 },
  IL: { name: "Illinois", goodsRpp: 100.9, constructionWage: 39.27 },
  IN: { name: "Indiana", goodsRpp: 94.8, constructionWage: 31.80 },
  IA: { name: "Iowa", goodsRpp: 95.1, constructionWage: 29.84 },
  KS: { name: "Kansas", goodsRpp: 94.8, constructionWage: 28.89 },
  KY: { name: "Kentucky", goodsRpp: 95.1, constructionWage: 27.81 },
  LA: { name: "Louisiana", goodsRpp: 92.0, constructionWage: 26.41 },
  ME: { name: "Maine", goodsRpp: 96.6, constructionWage: 30.12 },
  MD: { name: "Maryland", goodsRpp: 102.9, constructionWage: 31.34 },
  MA: { name: "Massachusetts", goodsRpp: 102.4, constructionWage: 39.10 },
  MI: { name: "Michigan", goodsRpp: 95.4, constructionWage: 31.31 },
  MN: { name: "Minnesota", goodsRpp: 101.8, constructionWage: 36.13 },
  MS: { name: "Mississippi", goodsRpp: 94.9, constructionWage: 24.62 },
  MO: { name: "Missouri", goodsRpp: 97.7, constructionWage: 32.49 },
  MT: { name: "Montana", goodsRpp: 94.3, constructionWage: 30.61 },
  NE: { name: "Nebraska", goodsRpp: 95.3, constructionWage: 28.10 },
  NV: { name: "Nevada", goodsRpp: 94.6, constructionWage: 32.97 },
  NH: { name: "New Hampshire", goodsRpp: 100.1, constructionWage: 30.88 },
  NJ: { name: "New Jersey", goodsRpp: 107.1, constructionWage: 38.69 },
  NM: { name: "New Mexico", goodsRpp: 95.4, constructionWage: 27.04 },
  NY: { name: "New York", goodsRpp: 106.2, constructionWage: 36.85 },
  NC: { name: "North Carolina", goodsRpp: 96.5, constructionWage: 26.42 },
  ND: { name: "North Dakota", goodsRpp: 95.9, constructionWage: 32.12 },
  OH: { name: "Ohio", goodsRpp: 93.4, constructionWage: 31.68 },
  OK: { name: "Oklahoma", goodsRpp: 92.2, constructionWage: 26.50 },
  OR: { name: "Oregon", goodsRpp: 104.6, constructionWage: 36.54 },
  PA: { name: "Pennsylvania", goodsRpp: 99.2, constructionWage: 31.93 },
  RI: { name: "Rhode Island", goodsRpp: 96.8, constructionWage: 33.67 },
  SC: { name: "South Carolina", goodsRpp: 95.6, constructionWage: 26.64 },
  SD: { name: "South Dakota", goodsRpp: 96.1, constructionWage: 26.41 },
  TN: { name: "Tennessee", goodsRpp: 94.8, constructionWage: 27.17 },
  TX: { name: "Texas", goodsRpp: 98.4, constructionWage: 26.54 },
  UT: { name: "Utah", goodsRpp: 93.0, constructionWage: 28.47 },
  VT: { name: "Vermont", goodsRpp: 96.3, constructionWage: 29.82 },
  VA: { name: "Virginia", goodsRpp: 100.3, constructionWage: 28.67 },
  WA: { name: "Washington", goodsRpp: 106.7, constructionWage: 39.60 },
  WV: { name: "West Virginia", goodsRpp: 95.7, constructionWage: 28.68 },
  WI: { name: "Wisconsin", goodsRpp: 93.6, constructionWage: 33.56 },
  WY: { name: "Wyoming", goodsRpp: 94.8, constructionWage: 30.86 },
};

/** Two-letter codes and names, sorted by name, for the state picker (50 states + DC). */
export const US_STATES: { code: string; name: string }[] = Object.entries(STATE_COST_TABLE)
  .map(([code, r]) => ({ code, name: r.name }))
  .sort((a, b) => a.name.localeCompare(b.name));

export function isUsStateCode(code: string): boolean {
  return Object.prototype.hasOwnProperty.call(STATE_COST_TABLE, code);
}

export interface RegionalFactors {
  state: string;
  stateName: string;
  /** Multiply a US-average materials price by this. */
  materials: number;
  /** Multiply a US-average labor rate by this. */
  labor: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Factors for a state code, or null for anything that isn't one of the 50 states + DC. */
export function regionalFactors(state: string): RegionalFactors | null {
  const code = state.trim().toUpperCase();
  if (!isUsStateCode(code)) return null;
  const row = STATE_COST_TABLE[code];
  return {
    state: code,
    stateName: row.name,
    materials: round2(row.goodsRpp / US_GOODS_RPP),
    labor: round2(row.constructionWage / US_CONSTRUCTION_WAGE),
  };
}

/** The state code at the end of a "City, ST" region (the shape the upload screen sends), or null. */
export function stateFromRegion(region: string | null | undefined): string | null {
  const m = /,\s*([A-Za-z]{2})\s*$/.exec(region ?? "");
  const code = m ? m[1].toUpperCase() : "";
  return isUsStateCode(code) ? code : null;
}

export interface CostParts {
  materials: [number, number];
  labor: [number, number];
}

/**
 * Applies a state's factors to US-average materials and labor ranges (USD). For an ungrounded price
 * (the cost step's "grounded": false) or a national fallback when web search is unavailable. Rounded
 * to whole dollars; a low above a high is swapped.
 */
export function applyRegionalFactors(parts: CostParts, state: string): CostParts | null {
  const f = regionalFactors(state);
  if (!f) return null;
  const scale = ([lo, hi]: [number, number], k: number): [number, number] => {
    const a = Math.round(Math.min(lo, hi) * k);
    const b = Math.round(Math.max(lo, hi) * k);
    return [a, b];
  };
  return { materials: scale(parts.materials, f.materials), labor: scale(parts.labor, f.labor) };
}

/** One short plain line for the plan, e.g. "Florida: materials about 1.0x, labor about 0.85x the US average." */
export function describeFactors(f: RegionalFactors): string {
  const x = (n: number) => `${n.toFixed(2).replace(/0$/, "")}x`;
  return `${f.stateName}: materials about ${x(f.materials)}, labor about ${x(f.labor)} the US average.`;
}
