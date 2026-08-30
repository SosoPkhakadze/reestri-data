// Reestri data story #1: single-source awards in Armenia's public contracts (PPCM).
// Reads the `am-contracts` KV store shard by shard via the Apify API, aggregates, discards.
// Usage: node analyze.mjs            (reads APIFY_TOKEN from ../../../.env, never prints it)
// Optional env: SHARD_CACHE=<dir> caches raw shards locally (keep it out of the repo),
//               DIAG_DIR=<dir> where the appeals free-text vocabulary goes (default: here).
// Output: CSVs + summary.json in this directory. No raw contract dump; no personal data.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..");
const STORE_NAME = process.env.AM_CONTRACTS_STORE || "am-contracts";
const CACHE = process.env.SHARD_CACHE || "";
const YEAR_MIN = 2018, YEAR_MAX = 2026;

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

// ---- mapping: how PPCM labels non-competitive procedures (documented in README) ----
const SINGLE_SOURCE = new Set(["ՄԱ", "ՀՄԱ"]);        // "single source", "urgent single source"
const NEGOTIATED_NO_NOTICE = new Set(["ԲԸԱՀ"]);       // "NPNA (Negotiated Procedure with No Preliminary Announcement)"
const isSS = (c) => SINGLE_SOURCE.has(c.procedureAbbr) || /^(urgent )?single source$/i.test(c.procedure ?? "");
const isNPNA = (c) => NEGOTIATED_NO_NOTICE.has(c.procedureAbbr);
// appeals: PPCM stores a free-text narrative. Rule: empty or punctuation-only = none; any Armenian negation
// (word starting with չ such as չեն/չի/չկա/չկան, or բացակայ-, or standalone ոչ/no/none) = none; otherwise it counts
// as an appeal only if it mentions an appeal (բողոք / appeal / complaint / жалоб). Everything else is junk (legal
// citations, grant labels, URLs) and is reported separately as "other".
const normAppeal = (v) => (v ?? "").toString().trim().toLowerCase();
const NEG = /(^|[^ա-ֆ])չ[ա-ֆ]+|չ(են|ի|կա|կան|է)|բացակայ|(^|[^ա-ֆ])ոչ($|[^ա-ֆ])|^(no|none|n\/a|0)$/;
const POS = /բողոք|appeal|complain|жалоб/;
const appealClass = (v) => { const s = normAppeal(v); if (!s || /^[-–—_.*\s]*$/.test(s) || NEG.test(s)) return "none"; return POS.test(s) ? "appeal" : "other"; };
// value: contractValueTotal in AMD. Six records carry keyed-in totals of 100 billion AMD and above (up to
// 1.66 quadrillion) while their latestValue is under 1.5 billion; values above VALUE_CAP are excluded from
// value sums (the contracts stay in the counts).
const VALUE_CAP = 50e9;
// sole proprietors (physical persons) are excluded from named supplier tables
const isIndividual = (name) => /(^|\s)(ֆ\/ա|ա\/ձ|աձ|ֆիզ\.?\s*անձ|ип)(\s|$)/i.test(name ?? "");

const csvEsc = (v) => { const s = v == null ? "" : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const csv = (rows, cols) => [cols.join(","), ...rows.map((r) => cols.map((c) => csvEsc(r[c])).join(","))].join("\n") + "\n";
const pct = (a, b) => (b ? +(100 * a / b).toFixed(2) : 0);
const bump = (m, k, init) => { if (!m.has(k)) m.set(k, init()); return m.get(k); };

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
const years = new Map();
const suppliers = new Map();
const buyers = new Map();
const procedures = new Map();
const appealsVocab = new Map();
const seen = new Set();
const failed = [];
let total = 0, totalValue = 0, noDate = 0, noValue = 0;
const valueOutliers = [];
const appealClasses = { none: 0, appeal: 0, other: 0 };
const NON_PROCUREMENT = new Set(["ԳՉԾ", "ԴՄ"]); // NPE (Non-Procurement expense), Grant competition: not procurement procedures
const yr = () => ({ contracts: 0, value: 0, ss: 0, ssValue: 0, npna: 0, npnaValue: 0, appeals: 0, proc: 0, procValue: 0 });

for (const key of shards) {
  let shard;
  try { shard = await record(store.id, key); } catch (e) { failed.push(`${key}: ${e.message}`); continue; }
  if (!shard) { failed.push(`${key}: missing`); continue; }
  for (const [supKey, contracts] of Object.entries(shard)) {
    const sup = bump(suppliers, supKey, () => ({ key: supKey, name: contracts[0]?.supplierName ?? "", country: contracts[0]?.supplierCountry ?? "", contracts: 0, value: 0, ss: 0, ssValue: 0, buyers: new Map(), first: null, last: null }));
    for (const c of contracts) {
      if (!c.contractId || seen.has(c.contractId)) continue;
      seen.add(c.contractId);
      total++;
      let v = Number(c.contractValueTotal) || 0; if (!c.contractValueTotal) noValue++;
      if (v > VALUE_CAP) { valueOutliers.push({ year: (c.dateSigned ?? "").slice(0, 4), procedure: c.procedure, contractValueTotal: v, latestValue: c.latestValue }); v = 0; }
      totalValue += v;
      const y = (c.dateSigned ?? "").slice(0, 4); if (!y) noDate++;
      const ss = isSS(c), np = isNPNA(c), ac = appealClass(c.appeals), ap = ac === "appeal"; appealClasses[ac]++;
      const Y = bump(years, y || "unknown", yr);
      Y.contracts++; Y.value += v; if (ss) { Y.ss++; Y.ssValue += v; } if (np) { Y.npna++; Y.npnaValue += v; } if (ap) Y.appeals++; if (!NON_PROCUREMENT.has(c.procedureAbbr)) { Y.proc++; Y.procValue += v; }
      const P = bump(procedures, `${c.procedureAbbr ?? ""}|${c.procedure ?? ""}`, () => ({ abbr: c.procedureAbbr ?? "", procedure: c.procedure ?? "", contracts: 0, value: 0 }));
      P.contracts++; P.value += v;
      if (ac !== "none") { const at = `${ac}|${normAppeal(c.appeals).slice(0, 60)}`; appealsVocab.set(at, (appealsVocab.get(at) ?? 0) + 1); }
      sup.contracts++; sup.value += v; if (ss) { sup.ss++; sup.ssValue += v; }
      if (c.dateSigned && c.dateSigned >= "2000" && c.dateSigned <= "2026-12-31") { if (!sup.first || c.dateSigned < sup.first) sup.first = c.dateSigned; if (!sup.last || c.dateSigned > sup.last) sup.last = c.dateSigned; }
      const bKey = c.buyerTaxId || `NAME:${c.buyerName}`;
      const sb = bump(sup.buyers, bKey, () => ({ name: c.buyerName, contracts: 0, value: 0 })); sb.contracts++; sb.value += v;
      const B = bump(buyers, bKey, () => ({ key: bKey, taxId: c.buyerTaxId ?? "", name: c.buyerName ?? "", nameEn: c.buyerNameEn ?? "", type: c.buyerType ?? "", contracts: 0, value: 0, ss: 0, ssValue: 0, suppliers: new Set(), ssSuppliers: new Set() }));
      B.contracts++; B.value += v; B.suppliers.add(supKey); if (ss) { B.ss++; B.ssValue += v; B.ssSuppliers.add(supKey); }
      if (!B.nameEn && c.buyerNameEn) B.nameEn = c.buyerNameEn;
    }
  }
  process.stdout.write(`${key} ok; contracts so far ${total}\n`);
}
console.log(`unique contracts ${total}; value ${totalValue} AMD; no date ${noDate}; no value ${noValue}; suppliers ${suppliers.size}; buyers ${buyers.size}; failed shards ${failed.length}`);

// ---- 1. single-source by year ----
const t1 = [...years.entries()].filter(([y]) => y !== "unknown").sort().map(([year, r]) => ({ year, contracts: r.contracts, value_amd: Math.round(r.value), single_source_contracts: r.ss, single_source_value_amd: Math.round(r.ssValue), single_source_share_of_count_pct: pct(r.ss, r.contracts), single_source_share_of_value_pct: pct(r.ssValue, r.value), npna_contracts: r.npna, npna_value_amd: Math.round(r.npnaValue), noncompetitive_incl_npna_share_of_value_pct: pct(r.ssValue + r.npnaValue, r.value), procurement_contracts_excl_npe_grants: r.proc, procurement_value_excl_npe_grants_amd: Math.round(r.procValue), single_source_share_of_procurement_count_pct: pct(r.ss, r.proc), single_source_share_of_procurement_value_pct: pct(r.ssValue, r.procValue), contracts_with_appeals: r.appeals }));
writeFileSync(join(HERE, "1-single-source-by-year.csv"), csv(t1, Object.keys(t1[0])));

// ---- 2. top 30 suppliers by single-source value (companies only) ----
const supRows = [...suppliers.values()].filter((s) => !isIndividual(s.name));
const individualsSS = [...suppliers.values()].filter((s) => isIndividual(s.name)).reduce((a, s) => a + s.ssValue, 0);
const t2 = supRows.sort((a, b) => b.ssValue - a.ssValue).slice(0, 30).map((s, i) => ({ rank: i + 1, supplier_tax_id: s.key.startsWith("NOTIN") ? "" : s.key, supplier_name: s.name, country: s.country, single_source_value_amd: Math.round(s.ssValue), single_source_contracts: s.ss, all_contracts: s.contracts, all_value_amd: Math.round(s.value), single_source_share_of_own_contracts_pct: pct(s.ss, s.contracts), single_source_share_of_own_value_pct: pct(s.ssValue, s.value), distinct_buyers: s.buyers.size, first_contract: s.first, last_contract: s.last }));
writeFileSync(join(HERE, "2-top30-suppliers-single-source.csv"), csv(t2, Object.keys(t2[0])));

// ---- 3. top 30 buyers by single-source value ----
const t3 = [...buyers.values()].sort((a, b) => b.ssValue - a.ssValue).slice(0, 30).map((b, i) => ({ rank: i + 1, buyer_tax_id: b.taxId, buyer_name: b.name, buyer_name_en: b.nameEn, buyer_type: b.type, single_source_value_amd: Math.round(b.ssValue), single_source_contracts: b.ss, all_value_amd: Math.round(b.value), all_contracts: b.contracts, single_source_share_of_spend_pct: pct(b.ssValue, b.value), single_source_share_of_count_pct: pct(b.ss, b.contracts), distinct_suppliers: b.suppliers.size, distinct_single_source_suppliers: b.ssSuppliers.size }));
writeFileSync(join(HERE, "3-top30-buyers-single-source.csv"), csv(t3, Object.keys(t3[0])));

// ---- 4. supplier dependence: >90% of value from one buyer, >=10 contracts (companies only) ----
const t4cols = ["supplier_tax_id", "supplier_name", "contracts", "value_amd", "single_source_share_of_value_pct", "distinct_buyers", "top_buyer_tax_id", "top_buyer_name", "top_buyer_contracts", "top_buyer_value_amd", "top_buyer_share_of_value_pct", "first_contract", "last_contract"];
const t4 = supRows.filter((s) => s.contracts >= 10 && s.value > 0).map((s) => {
  const [topKey, top] = [...s.buyers.entries()].sort((a, b) => b[1].value - a[1].value)[0];
  return { s, topKey, top, share: top.value / s.value };
}).filter((x) => x.share > 0.9).sort((a, b) => b.s.value - a.s.value).map(({ s, topKey, top, share }) => ({ supplier_tax_id: s.key.startsWith("NOTIN") ? "" : s.key, supplier_name: s.name, contracts: s.contracts, value_amd: Math.round(s.value), single_source_share_of_value_pct: pct(s.ssValue, s.value), distinct_buyers: s.buyers.size, top_buyer_tax_id: topKey.startsWith("NAME:") ? "" : topKey, top_buyer_name: top.name, top_buyer_contracts: top.contracts, top_buyer_value_amd: Math.round(top.value), top_buyer_share_of_value_pct: +(100 * share).toFixed(2), first_contract: s.first, last_contract: s.last }));
writeFileSync(join(HERE, "4-supplier-dependence.csv"), csv(t4, t4cols));

// ---- 5. appeals by year ----
const t5 = [...years.entries()].filter(([y]) => y !== "unknown").sort().map(([year, r]) => ({ year, contracts: r.contracts, contracts_with_appeals: r.appeals, appeals_share_pct: pct(r.appeals, r.contracts) }));
writeFileSync(join(HERE, "5-appeals-by-year.csv"), csv(t5, Object.keys(t5[0])));

// ---- diagnostics ----
const procs = [...procedures.values()].sort((a, b) => b.contracts - a.contracts).map((p) => ({ ...p, value: Math.round(p.value), classified_as: SINGLE_SOURCE.has(p.abbr) ? "single_source" : NEGOTIATED_NO_NOTICE.has(p.abbr) ? "negotiated_no_notice" : "competitive_or_other" }));
writeFileSync(join(HERE, "procedure-vocabulary.csv"), csv(procs, ["abbr", "procedure", "contracts", "value", "classified_as"]));
const apRows = [...appealsVocab.entries()].sort((a, b) => b[1] - a[1]).slice(0, 80).map(([text, count]) => ({ text, count }));
writeFileSync(join(process.env.DIAG_DIR || HERE, "appeals-vocabulary-top80.csv"), csv(apRows, ["text", "count"]));

// ---- summary ----
const inRange = t1.filter((r) => +r.year >= YEAR_MIN && +r.year <= YEAR_MAX);
const sum = (rows, f) => rows.reduce((a, r) => a + r[f], 0);
const allSS = sum(t1, "single_source_value_amd");
const summary = {
  storeId: store.id, indexGeneratedAt: meta.generatedAt, ppcmReported: meta.totalReported, indexedContracts: meta.contracts, uniqueContracts: total, totalValueAmd: Math.round(totalValue),
  noDate, noValue, valueCapAmd: VALUE_CAP, valueOutliersExcluded: valueOutliers, appealClasses, suppliers: suppliers.size, companies: supRows.length, individuals: suppliers.size - supRows.length, buyers: buyers.size, failedShards: failed,
  range: { from: YEAR_MIN, to: YEAR_MAX, contracts: sum(inRange, "contracts"), value: sum(inRange, "value_amd"), ss: sum(inRange, "single_source_contracts"), ssValue: sum(inRange, "single_source_value_amd"), npna: sum(inRange, "npna_contracts"), npnaValue: sum(inRange, "npna_value_amd"), appeals: sum(inRange, "contracts_with_appeals") },
  individualsSingleSourceValueAmd: Math.round(individualsSS),
  top30SuppliersShareOfAllSingleSourceValuePct: pct(t2.reduce((a, r) => a + r.single_source_value_amd, 0), allSS),
  top30BuyersShareOfAllSingleSourceValuePct: pct(t3.reduce((a, r) => a + r.single_source_value_amd, 0), allSS),
  dependentSuppliers: t4.length, dependentSuppliersValueAmd: t4.reduce((a, r) => a + r.value_amd, 0),
  yearsOutsideRange: t1.filter((r) => +r.year < YEAR_MIN || +r.year > YEAR_MAX).map((r) => `${r.year}:${r.contracts}`),
};
writeFileSync(join(HERE, "summary.json"), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
console.table(t1);
