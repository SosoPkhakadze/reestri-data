// Reestri data story #2: who buys without competition, who wins, who is new, how big the contracts are.
// Armenia public contracts (PPCM) via the `am-contracts` KV store. Same streaming pattern as analyze.mjs:
// one shard at a time via the Apify API, aggregate, discard. analyze.mjs is untouched; this file is additive.
// Usage: node analyze2.mjs          (reads APIFY_TOKEN from ../../../.env, never prints it)
// Optional env: SHARD_CACHE=<dir> caches raw shards outside the repo; AM_CONTRACTS_STORE=<name>.
// Output: 6-single-source-by-buyer-year.csv, 7-supplier-concentration.csv, 8-new-entrants.csv,
//         9-contract-size.csv, summary2.json. Aggregate only; individual entrepreneurs are never listed.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..");
const STORE_NAME = process.env.AM_CONTRACTS_STORE || "am-contracts";
const CACHE = process.env.SHARD_CACHE || "";
const YEAR_MIN = 2018, YEAR_MAX = 2026;
const YEARS = Array.from({ length: YEAR_MAX - YEAR_MIN + 1 }, (_, i) => String(YEAR_MIN + i));
const TRAJECTORY_YEARS = ["2018", "2021", "2024", "2026"];
const ENTRANT_COHORTS = ["2022", "2023", "2024", "2025"];
const BIG_CONTRACT = 1e9; // 1 billion AMD

function token() {
  if (process.env.APIFY_TOKEN) return process.env.APIFY_TOKEN;
  const env = readFileSync(join(ROOT, ".env"), "utf8");
  const m = env.match(/^APIFY_TOKEN=(.*)$/m);
  if (!m) throw new Error("APIFY_TOKEN not found in .env");
  return m[1].trim().replace(/^"|"$/g, "");
}
const H = { Authorization: `Bearer ${token()}` };

async function api(path) {
  for (let a = 0; a < 4; a++) {
    try {
      const res = await fetch(`https://api.apify.com/v2${path}`, { headers: H });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${path}`);
      return await res.json();
    } catch (e) { if (a === 3) throw e; await new Promise((r) => setTimeout(r, 2000 * (a + 1))); }
  }
}
async function record(storeId, key) {
  const f = CACHE ? join(CACHE, `${key}.json`) : null;
  if (f && existsSync(f)) return JSON.parse(readFileSync(f, "utf8"));
  const v = await api(`/key-value-stores/${storeId}/records/${key}`);
  if (f && v) { mkdirSync(CACHE, { recursive: true }); writeFileSync(f, JSON.stringify(v)); }
  return v;
}

// ---- mapping, identical to analyze.mjs (documented in README.md) ----
const SINGLE_SOURCE = new Set(["ՄԱ", "ՀՄԱ"]);        // "single source", "urgent single source"
const isSS = (c) => SINGLE_SOURCE.has(c.procedureAbbr) || /^(urgent )?single source$/i.test(c.procedure ?? "");
const VALUE_CAP = 50e9;                              // keyed-in totals above this are excluded from value sums, kept in counts
const isIndividual = (name) => /(^|\s)(ֆ\/ա|ա\/ձ|աձ|ֆիզ\.?\s*անձ|ип)(\s|$)/i.test(name ?? "");

const csvEsc = (v) => { const s = v == null ? "" : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const csv = (rows, cols) => [cols.join(","), ...rows.map((r) => cols.map((c) => csvEsc(r[c])).join(","))].join("\n") + "\n";
const pct = (a, b) => (b ? +(100 * a / b).toFixed(2) : 0);
const bump = (m, k, init) => { if (!m.has(k)) m.set(k, init()); return m.get(k); };
const inRange = (y) => y >= String(YEAR_MIN) && y <= String(YEAR_MAX) && y.length === 4;
const quantile = (sorted, q) => { if (!sorted.length) return 0; const pos = (sorted.length - 1) * q, lo = Math.floor(pos), hi = Math.ceil(pos); return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo); };

const list = await api(`/key-value-stores?name=${STORE_NAME}&unnamed=false&limit=10`);
const store = list?.data?.items?.find((s) => s.name === STORE_NAME);
if (!store) throw new Error(`store ${STORE_NAME} not found`);
const meta = await record(store.id, "meta");
console.log(`store ${store.id}; index generated ${meta.generatedAt}; contracts ${meta.contracts} (PPCM reported ${meta.totalReported})`);

const keys = [];
let exclusiveStartKey;
do {
  const r = await api(`/key-value-stores/${store.id}/keys?limit=1000${exclusiveStartKey ? `&exclusiveStartKey=${exclusiveStartKey}` : ""}`);
  keys.push(...r.data.items.map((i) => i.key));
  exclusiveStartKey = r.data.isTruncated ? r.data.nextExclusiveStartKey : null;
} while (exclusiveStartKey);
const shards = keys.filter((k) => k.startsWith("tin-")).sort();
console.log(`${shards.length} shards`);

// ---- aggregates ----
const buyers = new Map();        // bKey -> { taxId, name, nameEn, type, total: {contracts, value, ss, ssValue}, years: Map(year -> same) }
const supYear = new Map();       // year -> Map(supKey -> value)
const supFirst = new Map();      // supKey -> { name, individual, first, firstBuyerKey, firstBuyerName, firstBuyerNameEn, contracts, value, buyers: Set }
const yearValues = new Map();    // year -> { values: number[], contracts, noValue, capped }
const seen = new Set();
const failed = [];
let total = 0, totalValue = 0, capped = 0;
const cell = () => ({ contracts: 0, value: 0, ss: 0, ssValue: 0 });

for (const key of shards) {
  let shard;
  try { shard = await record(store.id, key); } catch (e) { failed.push(`${key}: ${e.message}`); process.stdout.write(`${key} FAILED: ${e.message}\n`); continue; }
  if (!shard) { failed.push(`${key}: missing`); process.stdout.write(`${key} MISSING\n`); continue; }
  for (const [supKey, contracts] of Object.entries(shard)) {
    const name = contracts[0]?.supplierName ?? "";
    const sup = bump(supFirst, supKey, () => ({ key: supKey, name, individual: isIndividual(name), first: null, firstBuyerKey: "", firstBuyerName: "", firstBuyerNameEn: "", contracts: 0, value: 0, ssValue: 0, buyers: new Map() }));
    for (const c of contracts) {
      if (!c.contractId || seen.has(c.contractId)) continue;
      seen.add(c.contractId);
      total++;
      let v = Number(c.contractValueTotal) || 0;
      const isCapped = v > VALUE_CAP;
      if (isCapped) { capped++; v = 0; }
      totalValue += v;
      const y = (c.dateSigned ?? "").slice(0, 4);
      const ss = isSS(c);
      const bKey = c.buyerTaxId || `NAME:${c.buyerName}`;
      // supplier lifetime record (any plausible date, like analyze.mjs)
      sup.contracts++; sup.value += v; if (ss) sup.ssValue += v; sup.buyers.set(bKey, (sup.buyers.get(bKey) ?? 0) + v);
      if (c.dateSigned && c.dateSigned >= "2000" && c.dateSigned <= "2026-12-31" && (!sup.first || c.dateSigned < sup.first)) {
        sup.first = c.dateSigned; sup.firstBuyerKey = bKey; sup.firstBuyerName = c.buyerName ?? ""; sup.firstBuyerNameEn = c.buyerNameEn ?? "";
      }
      if (!inRange(y)) continue;
      // buyer x year
      const B = bump(buyers, bKey, () => ({ key: bKey, taxId: c.buyerTaxId ?? "", name: c.buyerName ?? "", nameEn: c.buyerNameEn ?? "", type: c.buyerType ?? "", total: cell(), years: new Map() }));
      if (!B.nameEn && c.buyerNameEn) B.nameEn = c.buyerNameEn;
      for (const t of [B.total, bump(B.years, y, cell)]) { t.contracts++; t.value += v; if (ss) { t.ss++; t.ssValue += v; } }
      // supplier x year value
      const SY = bump(supYear, y, () => new Map());
      SY.set(supKey, (SY.get(supKey) ?? 0) + v);
      // contract size
      const YV = bump(yearValues, y, () => ({ values: [], contracts: 0, noValue: 0, capped: 0 }));
      YV.contracts++; if (isCapped) YV.capped++; else if (v > 0) YV.values.push(v); else YV.noValue++;
    }
  }
  process.stdout.write(`${key} ok; contracts so far ${total}\n`);
}
console.log(`unique contracts ${total}; value ${Math.round(totalValue)} AMD; capped ${capped}; suppliers ${supFirst.size}; buyers in range ${buyers.size}; failed shards ${failed.length}`);

// ---- 6. single-source by buyer and year, 2018 to 2026 ----
const buyerRows = [...buyers.values()].map((b) => {
  const recent = ["2024", "2025", "2026"].reduce((a, y) => { const t = b.years.get(y); return a + (t ? t.ssValue : 0); }, 0);
  return { b, recent };
}).sort((a, b) => b.recent - a.recent);
const buyerRank = new Map(buyerRows.map((x, i) => [x.b.key, i + 1]));
const t6 = [];
for (const { b } of buyerRows) {
  for (const y of YEARS) {
    const t = b.years.get(y); if (!t) continue;
    t6.push({ buyer_tax_id: b.taxId, buyer_name: b.name, buyer_name_en: b.nameEn, buyer_type: b.type, year: y, contracts: t.contracts, value_amd: Math.round(t.value), single_source_contracts: t.ss, single_source_value_amd: Math.round(t.ssValue), single_source_share_of_count_pct: pct(t.ss, t.contracts), single_source_share_of_value_pct: pct(t.ssValue, t.value), buyer_total_value_2018_2026_amd: Math.round(b.total.value), buyer_single_source_value_2018_2026_amd: Math.round(b.total.ssValue), buyer_single_source_share_2018_2026_pct: pct(b.total.ssValue, b.total.value), rank_by_single_source_value_2024_2026: buyerRank.get(b.key) });
  }
}
writeFileSync(join(HERE, "6-single-source-by-buyer-year.csv"), csv(t6, Object.keys(t6[0])));
const top25 = buyerRows.slice(0, 25).map(({ b, recent }, i) => {
  const traj = {}; for (const y of TRAJECTORY_YEARS) { const t = b.years.get(y); traj[`share_${y}_pct`] = t ? pct(t.ssValue, t.value) : null; traj[`ss_value_${y}_amd`] = t ? Math.round(t.ssValue) : null; traj[`total_value_${y}_amd`] = t ? Math.round(t.value) : null; }
  return { rank: i + 1, buyer_tax_id: b.taxId, buyer_name: b.name, buyer_name_en: b.nameEn, single_source_value_2024_2026_amd: Math.round(recent), total_value_2018_2026_amd: Math.round(b.total.value), single_source_share_2018_2026_pct: pct(b.total.ssValue, b.total.value), ...traj };
});

// ---- 7. supplier concentration by year ----
const t7 = YEARS.map((y) => {
  const m = supYear.get(y) ?? new Map();
  const vals = [...m.values()].sort((a, b) => b - a);
  const tot = vals.reduce((a, v) => a + v, 0);
  const top = (n) => vals.slice(0, n).reduce((a, v) => a + v, 0);
  const cnt = (m2, pred) => { let n = 0; for (const [k] of m2) if (pred(supFirst.get(k))) n++; return n; };
  return { year: y, distinct_suppliers: m.size, distinct_companies: cnt(m, (s) => s && !s.individual), distinct_individual_entrepreneurs: cnt(m, (s) => s && s.individual), total_value_amd: Math.round(tot), top10_value_amd: Math.round(top(10)), top10_share_pct: pct(top(10), tot), top50_value_amd: Math.round(top(50)), top50_share_pct: pct(top(50), tot), top100_value_amd: Math.round(top(100)), top100_share_pct: pct(top(100), tot), suppliers_for_half_of_value: (() => { let a = 0, n = 0; for (const v of vals) { a += v; n++; if (a >= tot / 2) break; } return n; })() };
});
writeFileSync(join(HERE, "7-supplier-concentration.csv"), csv(t7, Object.keys(t7[0])));

// ---- 8. new entrants ----
const firstYear = (s) => (s.first ?? "").slice(0, 4);
const cohortRows = ENTRANT_COHORTS.map((y) => {
  const all = [...supFirst.values()].filter((s) => firstYear(s) === y);
  const cos = all.filter((s) => !s.individual);
  const firstYearValue = all.reduce((a, s) => a + ((supYear.get(y)?.get(s.key)) ?? 0), 0);
  const cosFirstYearValue = cos.reduce((a, s) => a + ((supYear.get(y)?.get(s.key)) ?? 0), 0);
  const yearTot = t7.find((r) => r.year === y);
  return { cohort_first_contract_year: y, new_suppliers: all.length, new_companies: cos.length, new_individual_entrepreneurs: all.length - cos.length, new_suppliers_share_of_active_suppliers_pct: pct(all.length, yearTot.distinct_suppliers), first_year_value_amd: Math.round(firstYearValue), first_year_value_share_of_year_pct: pct(firstYearValue, yearTot.total_value_amd), companies_first_year_value_amd: Math.round(cosFirstYearValue), lifetime_value_to_date_amd: Math.round(all.reduce((a, s) => a + s.value, 0)), companies_lifetime_value_to_date_amd: Math.round(cos.reduce((a, s) => a + s.value, 0)), lifetime_contracts_to_date: all.reduce((a, s) => a + s.contracts, 0), row_type: "cohort" };
});
// earlier cohorts for context (2018 to 2021), same columns
const contextCohorts = ["2018", "2019", "2020", "2021"].map((y) => {
  const all = [...supFirst.values()].filter((s) => firstYear(s) === y);
  const cos = all.filter((s) => !s.individual);
  const firstYearValue = all.reduce((a, s) => a + ((supYear.get(y)?.get(s.key)) ?? 0), 0);
  const yearTot = t7.find((r) => r.year === y);
  return { cohort_first_contract_year: y, new_suppliers: all.length, new_companies: cos.length, new_individual_entrepreneurs: all.length - cos.length, new_suppliers_share_of_active_suppliers_pct: pct(all.length, yearTot.distinct_suppliers), first_year_value_amd: Math.round(firstYearValue), first_year_value_share_of_year_pct: pct(firstYearValue, yearTot.total_value_amd), companies_first_year_value_amd: Math.round(cos.reduce((a, s) => a + ((supYear.get(y)?.get(s.key)) ?? 0), 0)), lifetime_value_to_date_amd: Math.round(all.reduce((a, s) => a + s.value, 0)), companies_lifetime_value_to_date_amd: Math.round(cos.reduce((a, s) => a + s.value, 0)), lifetime_contracts_to_date: all.reduce((a, s) => a + s.contracts, 0), row_type: "context" };
});
const top15 = [...supFirst.values()].filter((s) => !s.individual && firstYear(s) >= "2022" && firstYear(s) <= "2026").sort((a, b) => b.value - a.value).slice(0, 15).map((s, i) => ({ rank: i + 1, supplier_tax_id: s.key.startsWith("NOTIN") ? "" : s.key, supplier_name: s.name, first_contract: s.first, first_contract_year: firstYear(s), first_buyer_tax_id: s.firstBuyerKey.startsWith("NAME:") ? "" : s.firstBuyerKey, first_buyer_name: s.firstBuyerName, first_buyer_name_en: s.firstBuyerNameEn, contracts_to_date: s.contracts, value_to_date_amd: Math.round(s.value), distinct_buyers: s.buyers.size, single_source_share_of_value_pct: pct(s.ssValue, s.value), first_buyer_share_of_value_pct: pct(s.buyers.get(s.firstBuyerKey) ?? 0, s.value) }));
const t8cols = ["row_type", "cohort_first_contract_year", "new_suppliers", "new_companies", "new_individual_entrepreneurs", "new_suppliers_share_of_active_suppliers_pct", "first_year_value_amd", "first_year_value_share_of_year_pct", "companies_first_year_value_amd", "lifetime_value_to_date_amd", "companies_lifetime_value_to_date_amd", "lifetime_contracts_to_date", "rank", "supplier_tax_id", "supplier_name", "first_contract", "first_contract_year", "first_buyer_tax_id", "first_buyer_name", "first_buyer_name_en", "contracts_to_date", "value_to_date_amd", "distinct_buyers", "single_source_share_of_value_pct", "first_buyer_share_of_value_pct"];

// ---- 9. contract size by year ----
const t9 = YEARS.map((y) => {
  const r = yearValues.get(y) ?? { values: [], contracts: 0, noValue: 0, capped: 0 };
  const sorted = r.values.slice().sort((a, b) => a - b);
  const tot = sorted.reduce((a, v) => a + v, 0);
  const big = sorted.filter((v) => v > BIG_CONTRACT);
  const bigVal = big.reduce((a, v) => a + v, 0);
  return { year: y, contracts: r.contracts, contracts_with_value: sorted.length, contracts_without_value: r.noValue, contracts_over_cap_excluded: r.capped, total_value_amd: Math.round(tot), mean_amd: Math.round(sorted.length ? tot / sorted.length : 0), median_amd: Math.round(quantile(sorted, 0.5)), p90_amd: Math.round(quantile(sorted, 0.9)), p99_amd: Math.round(quantile(sorted, 0.99)), contracts_over_1bn: big.length, contracts_over_1bn_share_of_count_pct: pct(big.length, sorted.length), value_over_1bn_amd: Math.round(bigVal), value_over_1bn_share_pct: pct(bigVal, tot), contracts_under_1m: sorted.filter((v) => v < 1e6).length, contracts_under_1m_share_of_count_pct: pct(sorted.filter((v) => v < 1e6).length, sorted.length), value_under_1m_share_pct: pct(sorted.filter((v) => v < 1e6).reduce((a, v) => a + v, 0), tot) };
});
writeFileSync(join(HERE, "9-contract-size.csv"), csv(t9, Object.keys(t9[0])));

const t8 = [...contextCohorts, ...cohortRows, ...top15.map((r) => ({ row_type: "top15_new_entrant_since_2022", ...r }))];
writeFileSync(join(HERE, "8-new-entrants.csv"), csv(t8, t8cols));

// ---- summary ----
const sumYears = (rows, f) => rows.reduce((a, r) => a + (r[f] ?? 0), 0);
const totalSS = [...buyers.values()].reduce((a, b) => a + b.total.ssValue, 0);
const totalAll = [...buyers.values()].reduce((a, b) => a + b.total.value, 0);
const summary = {
  storeId: store.id, indexGeneratedAt: meta.generatedAt, ppcmReported: meta.totalReported, indexedContracts: meta.contracts, uniqueContracts: total, cappedRecords: capped, failedShards: failed,
  range: { from: YEAR_MIN, to: YEAR_MAX, contracts: sumYears(t9, "contracts"), value: Math.round(totalAll), singleSourceValue: Math.round(totalSS), buyers: buyers.size },
  top25BuyersBySingleSourceValue2024to2026: top25,
  top25ShareOfSingleSourceValue2024to2026Pct: pct(top25.reduce((a, r) => a + r.single_source_value_2024_2026_amd, 0), buyerRows.reduce((a, x) => a + x.recent, 0)),
  supplierConcentration: t7, newEntrantCohorts: cohortRows, contractSize: t9,
};
writeFileSync(join(HERE, "summary2.json"), JSON.stringify(summary, null, 2));
console.table(t7.map(({ year, distinct_suppliers, top10_share_pct, top50_share_pct, top100_share_pct, suppliers_for_half_of_value }) => ({ year, distinct_suppliers, top10_share_pct, top50_share_pct, top100_share_pct, suppliers_for_half_of_value })));
console.table(t9.map(({ year, contracts_with_value, median_amd, p90_amd, contracts_over_1bn, value_over_1bn_share_pct }) => ({ year, contracts_with_value, median_amd, p90_amd, contracts_over_1bn, value_over_1bn_share_pct })));
console.table(cohortRows.map(({ cohort_first_contract_year, new_suppliers, new_companies, first_year_value_amd, lifetime_value_to_date_amd }) => ({ cohort_first_contract_year, new_suppliers, new_companies, first_year_value_amd, lifetime_value_to_date_amd })));
console.table(top25.map(({ rank, buyer_name_en, buyer_name, single_source_value_2024_2026_amd, share_2018_pct, share_2021_pct, share_2024_pct, share_2026_pct }) => ({ rank, buyer: buyer_name_en || buyer_name, ss_2024_2026: single_source_value_2024_2026_amd, share_2018_pct, share_2021_pct, share_2024_pct, share_2026_pct })));
console.table(top15.map(({ rank, supplier_name, first_contract, first_buyer_name_en, first_buyer_name, value_to_date_amd, single_source_share_of_value_pct, first_buyer_share_of_value_pct }) => ({ rank, supplier_name, first_contract, first_buyer: first_buyer_name_en || first_buyer_name, value_to_date_amd, single_source_share_of_value_pct, first_buyer_share_of_value_pct })));
if (failed.length) console.log(`FAILED SHARDS (${failed.length}):\n` + failed.join("\n"));
