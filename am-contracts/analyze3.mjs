// Reestri data story #3: the shape of the procurement year in Armenia (PPCM).
// Month by month signing, how different December is from the rest of the year, which buyers
// concentrate their year into December, and how the "urgent" procedure forms move over time.
// Same streaming pattern as analyze.mjs and analyze2.mjs: one shard at a time via the Apify API,
// aggregate, discard. analyze.mjs and analyze2.mjs are untouched; this file is additive.
// Usage: node analyze3.mjs           (reads APIFY_TOKEN from ../../../.env, never prints it)
// Optional env: SHARD_CACHE=<dir> caches raw shards outside the repo; AM_CONTRACTS_STORE=<name>.
// Output: 10-monthly-distribution.csv, 11-december-vs-rest.csv, 12-buyer-december-concentration.csv,
//         13-urgent-procedures-by-year.csv, 14-top-urgent-buyers.csv, summary3.json.
// Aggregate only; individual entrepreneurs are counted but never listed.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..");
const STORE_NAME = process.env.AM_CONTRACTS_STORE || "am-contracts";
const CACHE = process.env.SHARD_CACHE || "";
const YEAR_MIN = 2018, YEAR_MAX = 2026;
const YEARS = Array.from({ length: YEAR_MAX - YEAR_MIN + 1 }, (_, i) => String(YEAR_MIN + i));
// 2026 has no December in this snapshot; every December comparison uses complete years only.
const FULL_YEARS = YEARS.filter((y) => y !== "2026");
const MONTHS = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"];
// Table 12 floor: a buyer must clear both of these over the complete years, so that a body with
// three contracts cannot reach 100 percent in December.
const MIN_CONTRACTS = 50;
const MIN_VALUE = 500e6;
const LATE_DECEMBER_DAY = 22; // "signed from 22 December onward"

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

// ---- mapping, identical to analyze.mjs where it overlaps (documented in README.md) ----
const SINGLE_SOURCE = new Set(["ՄԱ", "ՀՄԱ"]); // single source, urgent single source
const isSS = (c) => SINGLE_SOURCE.has(c.procedureAbbr) || /^(urgent )?single source$/i.test(c.procedure ?? "");
// PPCM has exactly two procedure forms whose English label starts with "urgent": urgent single
// source and urgent open tender. Both are accelerated forms under the Law on Procurement.
const URGENT_SINGLE = "ՀՄԱ";
const URGENT_TENDER = "ՀԲՄ";
const URGENT = new Set([URGENT_SINGLE, URGENT_TENDER]);
const isUrgent = (c) => URGENT.has(c.procedureAbbr) || /^urgent /i.test(c.procedure ?? "");
const isUrgentSingle = (c) => c.procedureAbbr === URGENT_SINGLE || /^urgent single source$/i.test(c.procedure ?? "");
const VALUE_CAP = 50e9; // keyed-in totals above this are excluded from value sums, kept in counts
const isIndividual = (name) => /(^|\s)(ֆ\/ա|ա\/ձ|աձ|ֆիզ\.?\s*անձ|ип)(\s|$)/i.test(name ?? "");
// date guard: only ISO dates whose month is 01 to 12 and whose year is in range are used.
const goodDate = (d) => typeof d === "string" && /^\d{4}-\d{2}-\d{2}/.test(d) && MONTHS.includes(d.slice(5, 7));

const csvEsc = (v) => { const s = v == null ? "" : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const csv = (rows, cols) => [cols.join(","), ...rows.map((r) => cols.map((c) => csvEsc(r[c])).join(","))].join("\n") + "\n";
const pct = (a, b) => (b ? +(100 * a / b).toFixed(2) : 0);
const bump = (m, k, init) => { if (!m.has(k)) m.set(k, init()); return m.get(k); };
const median = (arr) => { if (!arr.length) return 0; const s = arr.slice().sort((a, b) => a - b); const p = (s.length - 1) / 2, lo = Math.floor(p), hi = Math.ceil(p); return lo === hi ? s[lo] : (s[lo] + s[hi]) / 2; };

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
const cell = () => ({ contracts: 0, value: 0, ss: 0, ssValue: 0, urgent: 0, urgentValue: 0, uss: 0, ussValue: 0, uot: 0, uotValue: 0 });
const bucket = () => ({ ...cell(), buyers: new Set(), suppliers: new Set(), values: [], lateContracts: 0, lateValue: 0 });
const monthly = new Map();        // year -> Map(month -> cell)
const split = new Map();          // year -> { dec: bucket, rest: bucket }
const pool = { dec: bucket(), rest: bucket() }; // the same split pooled over the complete years
const monthBuyers = new Map();    // "year-month" -> Map(bKey -> { name, value }), for the top buyer of each month
const procVocab = new Map();      // procedure label -> { abbr, contracts, value }, used to check the urgent mapping
const buyerDec = new Map();       // bKey -> December concentration record (complete years only)
const urgentBuyer = new Map();    // bKey -> urgent-procedure record
const urgentSupplier = new Map(); // supKey -> urgent-procedure record
const seen = new Set();
const failed = [];
let total = 0, capped = 0, badDate = 0, outOfRange = 0, noValue = 0;
const cappedRows = [];
const outOfRangeYears = new Map(); // year -> count, so every dropped record is accounted for

for (const key of shards) {
  let shard;
  try { shard = await record(store.id, key); } catch (e) { failed.push(`${key}: ${e.message}`); process.stdout.write(`${key} FAILED: ${e.message}\n`); continue; }
  if (!shard) { failed.push(`${key}: missing`); process.stdout.write(`${key} MISSING\n`); continue; }
  for (const [supKey, contracts] of Object.entries(shard)) {
    const supName = contracts[0]?.supplierName ?? "";
    for (const c of contracts) {
      if (!c.contractId || seen.has(c.contractId)) continue;
      seen.add(c.contractId);
      total++;
      let v = Number(c.contractValueTotal) || 0;
      if (!c.contractValueTotal) noValue++;
      if (v > VALUE_CAP) { capped++; cappedRows.push({ date: (c.dateSigned ?? "").slice(0, 10), procedure: c.procedure, contractValueTotal: v, latestValue: c.latestValue }); v = 0; }
      if (!goodDate(c.dateSigned)) { badDate++; continue; }
      const y = c.dateSigned.slice(0, 4), mo = c.dateSigned.slice(5, 7), day = +c.dateSigned.slice(8, 10);
      if (y < String(YEAR_MIN) || y > String(YEAR_MAX)) { outOfRange++; outOfRangeYears.set(y, (outOfRangeYears.get(y) ?? 0) + 1); continue; }
      const ss = isSS(c), ur = isUrgent(c), uss = isUrgentSingle(c), uot = ur && !uss;
      const bKey = c.buyerTaxId || `NAME:${c.buyerName}`;

      const V = bump(procVocab, `${c.procedureAbbr ?? ""}|${c.procedure ?? ""}`, () => ({ abbr: c.procedureAbbr ?? "", procedure: c.procedure ?? "", contracts: 0, value: 0, classified_as: ur ? (uss ? "urgent_single_source" : "urgent_open_tender") : (ss ? "single_source" : "other") }));
      V.contracts++; V.value += v;

      const M = bump(bump(monthly, y, () => new Map()), mo, cell);
      const S = bump(split, y, () => ({ dec: bucket(), rest: bucket() }));
      const isDec = mo === "12";
      const B = isDec ? S.dec : S.rest;
      const targets = [M, B];
      if (y !== "2026") targets.push(isDec ? pool.dec : pool.rest);
      for (const t of targets) {
        t.contracts++; t.value += v;
        if (ss) { t.ss++; t.ssValue += v; }
        if (ur) { t.urgent++; t.urgentValue += v; }
        if (uss) { t.uss++; t.ussValue += v; }
        if (uot) { t.uot++; t.uotValue += v; }
      }
      for (const b of targets.slice(1)) {
        b.buyers.add(bKey); b.suppliers.add(supKey); if (v > 0) b.values.push(v);
        if (isDec && day >= LATE_DECEMBER_DAY) { b.lateContracts++; b.lateValue += v; }
      }
      const MB = bump(monthBuyers, `${y}-${mo}`, () => new Map());
      const mb = bump(MB, bKey, () => ({ name: c.buyerNameEn || c.buyerName || "", value: 0 }));
      mb.value += v; if (!mb.name && c.buyerNameEn) mb.name = c.buyerNameEn;

      // table 12: buyer December concentration, complete years only
      if (y !== "2026") {
        const BD = bump(buyerDec, bKey, () => ({ key: bKey, taxId: c.buyerTaxId ?? "", name: c.buyerName ?? "", nameEn: c.buyerNameEn ?? "", type: c.buyerType ?? "", contracts: 0, value: 0, decContracts: 0, decValue: 0, decSS: 0, decSSValue: 0, decUrgent: 0, decUrgentValue: 0, years: new Set(), decYears: new Set() }));
        if (!BD.nameEn && c.buyerNameEn) BD.nameEn = c.buyerNameEn;
        BD.contracts++; BD.value += v; BD.years.add(y);
        if (mo === "12") { BD.decContracts++; BD.decValue += v; BD.decYears.add(y); if (ss) { BD.decSS++; BD.decSSValue += v; } if (ur) { BD.decUrgent++; BD.decUrgentValue += v; } }
      }

      // tables 13 and 14: urgent procedures
      const UB = bump(urgentBuyer, bKey, () => ({ key: bKey, taxId: c.buyerTaxId ?? "", name: c.buyerName ?? "", nameEn: c.buyerNameEn ?? "", contracts: 0, value: 0, uContracts: 0, uValue: 0, uss: 0, ussValue: 0, uot: 0, uotValue: 0, firstUrgent: null, lastUrgent: null }));
      if (!UB.nameEn && c.buyerNameEn) UB.nameEn = c.buyerNameEn;
      UB.contracts++; UB.value += v;
      if (ur) {
        UB.uContracts++; UB.uValue += v;
        if (uss) { UB.uss++; UB.ussValue += v; } else { UB.uot++; UB.uotValue += v; }
        if (!UB.firstUrgent || c.dateSigned < UB.firstUrgent) UB.firstUrgent = c.dateSigned.slice(0, 10);
        if (!UB.lastUrgent || c.dateSigned > UB.lastUrgent) UB.lastUrgent = c.dateSigned.slice(0, 10);
        const US = bump(urgentSupplier, supKey, () => ({ key: supKey, name: supName, individual: isIndividual(supName), uContracts: 0, uValue: 0, buyers: new Set() }));
        US.uContracts++; US.uValue += v; US.buyers.add(bKey);
      }
    }
  }
  process.stdout.write(`${key} ok; contracts so far ${total}\n`);
}
console.log(`unique contracts ${total}; capped ${capped}; unusable dates ${badDate}; outside ${YEAR_MIN}-${YEAR_MAX} ${outOfRange}; no value ${noValue}; failed shards ${failed.length}`);

// ---- 10. monthly distribution of signings and value ----
const t10 = [];
for (const y of YEARS) {
  const m = monthly.get(y); if (!m) continue;
  const yc = [...m.values()].reduce((a, t) => a + t.contracts, 0);
  const yv = [...m.values()].reduce((a, t) => a + t.value, 0);
  for (const mo of MONTHS) {
    const t = m.get(mo); if (!t) continue;
    const mb = [...(monthBuyers.get(`${y}-${mo}`) ?? new Map()).values()].sort((a, b) => b.value - a.value)[0];
    t10.push({ year: y, month: mo, contracts: t.contracts, value_amd: Math.round(t.value), share_of_year_count_pct: pct(t.contracts, yc), share_of_year_value_pct: pct(t.value, yv), index_vs_even_month_count: +(t.contracts / (yc / 12)).toFixed(2), index_vs_even_month_value: +(t.value / (yv / 12)).toFixed(2), single_source_contracts: t.ss, single_source_share_of_count_pct: pct(t.ss, t.contracts), single_source_value_amd: Math.round(t.ssValue), single_source_share_of_month_value_pct: pct(t.ssValue, t.value), urgent_contracts: t.urgent, urgent_share_of_count_pct: pct(t.urgent, t.contracts), urgent_value_amd: Math.round(t.urgentValue), urgent_share_of_month_value_pct: pct(t.urgentValue, t.value), urgent_open_tender_value_amd: Math.round(t.uotValue), top_buyer_of_month: mb ? mb.name : "", top_buyer_share_of_month_value_pct: mb ? pct(mb.value, t.value) : 0, year_contracts: yc, year_value_amd: Math.round(yv) });
  }
}
// pooled month profile over the complete years (2026 has no autumn, so it is left out)
const POOL_LABEL = `${FULL_YEARS[0]}-${FULL_YEARS[FULL_YEARS.length - 1]} pooled`;
const pooled = MONTHS.map((mo) => {
  const a = cell();
  for (const y of FULL_YEARS) { const t = monthly.get(y)?.get(mo); if (t) for (const k of Object.keys(a)) a[k] += t[k]; }
  return { month: mo, ...a };
});
const pooledC = pooled.reduce((a, r) => a + r.contracts, 0);
const pooledV = pooled.reduce((a, r) => a + r.value, 0);
const monthProfile = pooled.map((r) => ({ month: r.month, contracts: r.contracts, value_amd: Math.round(r.value), share_of_count_pct: pct(r.contracts, pooledC), share_of_value_pct: pct(r.value, pooledV), index_vs_even_month_count: +(r.contracts / (pooledC / 12)).toFixed(2), index_vs_even_month_value: +(r.value / (pooledV / 12)).toFixed(2) }));
for (const r of pooled) t10.push({ year: POOL_LABEL, month: r.month, contracts: r.contracts, value_amd: Math.round(r.value), share_of_year_count_pct: pct(r.contracts, pooledC), share_of_year_value_pct: pct(r.value, pooledV), index_vs_even_month_count: +(r.contracts / (pooledC / 12)).toFixed(2), index_vs_even_month_value: +(r.value / (pooledV / 12)).toFixed(2), single_source_contracts: r.ss, single_source_share_of_count_pct: pct(r.ss, r.contracts), single_source_value_amd: Math.round(r.ssValue), single_source_share_of_month_value_pct: pct(r.ssValue, r.value), urgent_contracts: r.urgent, urgent_share_of_count_pct: pct(r.urgent, r.contracts), urgent_value_amd: Math.round(r.urgentValue), urgent_share_of_month_value_pct: pct(r.urgentValue, r.value), urgent_open_tender_value_amd: Math.round(r.uotValue), top_buyer_of_month: "", top_buyer_share_of_month_value_pct: 0, year_contracts: pooledC, year_value_amd: Math.round(pooledV) });
writeFileSync(join(HERE, "10-monthly-distribution.csv"), csv(t10, Object.keys(t10[0])));

// ---- 11. December versus the rest of the year ----
const decRow = (label, d, r) => {
  const tot = d.contracts + r.contracts, totV = d.value + r.value;
  const mean = (b) => Math.round(b.values.length ? b.values.reduce((a, x) => a + x, 0) / b.values.length : 0);
  return {
    year: label,
    december_contracts: d.contracts, december_value_amd: Math.round(d.value),
    rest_contracts: r.contracts, rest_value_amd: Math.round(r.value),
    december_share_of_year_count_pct: pct(d.contracts, tot), december_share_of_year_value_pct: pct(d.value, totV),
    december_single_source_share_of_count_pct: pct(d.ss, d.contracts), rest_single_source_share_of_count_pct: pct(r.ss, r.contracts),
    december_single_source_share_of_value_pct: pct(d.ssValue, d.value), rest_single_source_share_of_value_pct: pct(r.ssValue, r.value),
    december_urgent_share_of_count_pct: pct(d.urgent, d.contracts), rest_urgent_share_of_count_pct: pct(r.urgent, r.contracts),
    december_urgent_share_of_value_pct: pct(d.urgentValue, d.value), rest_urgent_share_of_value_pct: pct(r.urgentValue, r.value),
    december_mean_amd: mean(d), rest_mean_amd: mean(r),
    december_median_amd: Math.round(median(d.values)), rest_median_amd: Math.round(median(r.values)),
    december_distinct_buyers: d.buyers.size, rest_distinct_buyers: r.buyers.size,
    december_distinct_suppliers: d.suppliers.size, rest_distinct_suppliers: r.suppliers.size,
    december_from_day_22_contracts: d.lateContracts, december_from_day_22_value_amd: Math.round(d.lateValue),
    december_from_day_22_share_of_december_value_pct: pct(d.lateValue, d.value),
    december_from_day_22_share_of_year_value_pct: pct(d.lateValue, totV),
  };
};
const t11 = FULL_YEARS.filter((y) => split.has(y)).map((y) => decRow(y, split.get(y).dec, split.get(y).rest));
t11.push(decRow(POOL_LABEL, pool.dec, pool.rest));
writeFileSync(join(HERE, "11-december-vs-rest.csv"), csv(t11, Object.keys(t11[0])));

// ---- 12. buyers with the most extreme December concentration (complete years) ----
const t12all = [...buyerDec.values()].filter((b) => b.contracts >= MIN_CONTRACTS && b.value >= MIN_VALUE)
  .map((b) => ({ b, share: b.value ? b.decValue / b.value : 0 }))
  .sort((a, b) => b.share - a.share);
const t12 = t12all.slice(0, 30).map(({ b, share }, i) => ({
  rank: i + 1, buyer_tax_id: b.taxId, buyer_name: b.name, buyer_name_en: b.nameEn, buyer_type: b.type,
  contracts_2018_2025: b.contracts, value_2018_2025_amd: Math.round(b.value),
  december_contracts: b.decContracts, december_value_amd: Math.round(b.decValue),
  december_share_of_value_pct: +(100 * share).toFixed(2), december_share_of_count_pct: pct(b.decContracts, b.contracts),
  december_single_source_share_of_value_pct: pct(b.decSSValue, b.decValue),
  december_urgent_share_of_value_pct: pct(b.decUrgentValue, b.decValue),
  active_years: b.years.size, years_with_a_december_contract: b.decYears.size,
}));
writeFileSync(join(HERE, "12-buyer-december-concentration.csv"), csv(t12, Object.keys(t12[0])));

// ---- 13. urgent procedures by year ----
const t13 = YEARS.map((y) => {
  const m = monthly.get(y); if (!m) return null;
  const fields = ["contracts", "value", "urgent", "urgentValue", "uss", "ussValue", "uot", "uotValue", "ss", "ssValue"];
  const agg = [...m.values()].reduce((a, t) => { for (const k of fields) a[k] += t[k]; return a; }, Object.fromEntries(fields.map((k) => [k, 0])));
  const dec = split.get(y)?.dec;
  return { year: y, contracts: agg.contracts, value_amd: Math.round(agg.value), urgent_contracts: agg.urgent, urgent_value_amd: Math.round(agg.urgentValue), urgent_share_of_count_pct: pct(agg.urgent, agg.contracts), urgent_share_of_value_pct: pct(agg.urgentValue, agg.value), urgent_single_source_contracts: agg.uss, urgent_single_source_value_amd: Math.round(agg.ussValue), urgent_open_tender_contracts: agg.uot, urgent_open_tender_value_amd: Math.round(agg.uotValue), urgent_contracts_signed_in_december: dec ? dec.urgent : 0, urgent_value_signed_in_december_amd: dec ? Math.round(dec.urgentValue) : 0, december_share_of_urgent_value_pct: dec ? pct(dec.urgentValue, agg.urgentValue) : 0 };
}).filter(Boolean);
writeFileSync(join(HERE, "13-urgent-procedures-by-year.csv"), csv(t13, Object.keys(t13[0])));

// ---- 14. who uses urgent procedures most ----
const totUrgentValue = t13.reduce((a, r) => a + r.urgent_value_amd, 0);
const t14 = [...urgentBuyer.values()].filter((b) => b.uContracts > 0).sort((a, b) => b.uValue - a.uValue).slice(0, 30).map((b, i) => ({
  rank: i + 1, buyer_tax_id: b.taxId, buyer_name: b.name, buyer_name_en: b.nameEn,
  urgent_contracts: b.uContracts, urgent_value_amd: Math.round(b.uValue),
  urgent_share_of_own_count_pct: pct(b.uContracts, b.contracts), urgent_share_of_own_value_pct: pct(b.uValue, b.value),
  urgent_single_source_contracts: b.uss, urgent_single_source_value_amd: Math.round(b.ussValue),
  urgent_open_tender_contracts: b.uot, urgent_open_tender_value_amd: Math.round(b.uotValue),
  share_of_all_urgent_value_pct: pct(b.uValue, totUrgentValue),
  all_contracts: b.contracts, all_value_amd: Math.round(b.value),
  first_urgent_contract: b.firstUrgent, last_urgent_contract: b.lastUrgent,
}));
writeFileSync(join(HERE, "14-top-urgent-buyers.csv"), csv(t14, Object.keys(t14[0])));

// ---- summary ----
const t11Years = t11.filter((r) => /^\d{4}$/.test(r.year));
const decTot = t11Years.reduce((a, r) => ({ c: a.c + r.december_contracts, v: a.v + r.december_value_amd, lc: a.lc + r.december_from_day_22_contracts, lv: a.lv + r.december_from_day_22_value_amd }), { c: 0, v: 0, lc: 0, lv: 0 });
const fullTot = FULL_YEARS.reduce((a, y) => { const s = split.get(y); return { c: a.c + s.dec.contracts + s.rest.contracts, v: a.v + s.dec.value + s.rest.value }; }, { c: 0, v: 0 });
const rangeTot = YEARS.reduce((a, y) => { const s = split.get(y); return s ? { c: a.c + s.dec.contracts + s.rest.contracts, v: a.v + s.dec.value + s.rest.value } : a; }, { c: 0, v: 0 });
const topUrgentSuppliers = [...urgentSupplier.values()].filter((s) => !s.individual).sort((a, b) => b.uValue - a.uValue).slice(0, 10)
  .map((s, i) => ({ rank: i + 1, supplier_tax_id: s.key.startsWith("NOTIN") ? "" : s.key, supplier_name: s.name, urgent_contracts: s.uContracts, urgent_value_amd: Math.round(s.uValue), distinct_buyers: s.buyers.size }));
const individualUrgentValue = [...urgentSupplier.values()].filter((s) => s.individual).reduce((a, s) => a + s.uValue, 0);
const summary = {
  storeId: store.id, indexGeneratedAt: meta.generatedAt, ppcmReported: meta.totalReported, indexedContracts: meta.contracts,
  uniqueContracts: total, cappedRecords: capped, cappedRows, unusableDates: badDate, outsideRange: outOfRange, noValue, failedShards: failed,
  outsideRangeByYear: Object.fromEntries([...outOfRangeYears.entries()].sort()),
  outsideRange2000to2017: [...outOfRangeYears.entries()].filter(([y]) => y >= "2000" && y <= "2017").reduce((a, [, n]) => a + n, 0),
  outsideRangeImpossibleYears: [...outOfRangeYears.entries()].filter(([y]) => y < "2000" || y > String(YEAR_MAX)).reduce((a, [, n]) => a + n, 0),
  valueCapAmd: VALUE_CAP, lateDecemberFromDay: LATE_DECEMBER_DAY, minContractsForTable12: MIN_CONTRACTS, minValueForTable12: MIN_VALUE,
  range: { from: YEAR_MIN, to: YEAR_MAX, contracts: rangeTot.c, value: Math.round(rangeTot.v) },
  fullYears: FULL_YEARS, completeYearContracts: fullTot.c, completeYearValueAmd: Math.round(fullTot.v),
  decemberContracts: decTot.c, decemberValueAmd: decTot.v,
  decemberShareOfCompleteYearCountPct: pct(decTot.c, fullTot.c), decemberShareOfCompleteYearValuePct: pct(decTot.v, fullTot.v),
  decemberFromDay22Contracts: decTot.lc, decemberFromDay22ValueAmd: decTot.lv,
  decemberFromDay22ShareOfCompleteYearValuePct: pct(decTot.lv, fullTot.v),
  evenMonthSharePct: +(100 / 12).toFixed(2),
  pooledMonthProfile: monthProfile,
  // guard: every PPCM procedure label seen in this window, so a new "urgent" form cannot slip past the mapping
  procedureVocabulary: [...procVocab.values()].sort((a, b) => b.contracts - a.contracts).map((p) => ({ ...p, value: Math.round(p.value) })),
  unmappedUrgentLabels: [...procVocab.values()].filter((p) => /urgent|հրատապ/i.test(p.procedure) && p.classified_as.indexOf("urgent") !== 0).map((p) => p.procedure),
  decemberVsRest: t11, urgentByYear: t13,
  buyersPassingTable12Floor: t12all.length, buyersConsideredForTable12: buyerDec.size,
  // how the 129 buyers that clear the floor are spread: if December were a spending cliff, many of
  // them would sit above 50 percent. Reported so the null result is a number, not an impression.
  table12DecemberShareDistribution: {
    buyers: t12all.length,
    above_50_pct: t12all.filter((x) => x.share > 0.5).length,
    above_33_pct: t12all.filter((x) => x.share > 1 / 3).length,
    above_25_pct: t12all.filter((x) => x.share > 0.25).length,
    above_16_67_pct_twice_an_even_month: t12all.filter((x) => x.share > 2 / 12).length,
    above_8_33_pct_an_even_month: t12all.filter((x) => x.share > 1 / 12).length,
    median_share_pct: +(100 * median(t12all.map((x) => x.share))).toFixed(2),
    max_share_pct: t12all.length ? +(100 * t12all[0].share).toFixed(2) : 0,
  },
  topUrgentSuppliers, individualEntrepreneurUrgentValueAmd: Math.round(individualUrgentValue),
};
writeFileSync(join(HERE, "summary3.json"), JSON.stringify(summary, null, 2));
console.table(monthProfile);
console.table(t11.map(({ year, december_share_of_year_count_pct, december_share_of_year_value_pct, december_single_source_share_of_count_pct, rest_single_source_share_of_count_pct, december_urgent_share_of_value_pct, rest_urgent_share_of_value_pct, december_median_amd, rest_median_amd, december_from_day_22_share_of_year_value_pct }) => ({ year, dec_cnt_pct: december_share_of_year_count_pct, dec_val_pct: december_share_of_year_value_pct, dec_ss_cnt: december_single_source_share_of_count_pct, rest_ss_cnt: rest_single_source_share_of_count_pct, dec_urg_val: december_urgent_share_of_value_pct, rest_urg_val: rest_urgent_share_of_value_pct, dec_med: december_median_amd, rest_med: rest_median_amd, late_dec_val_pct: december_from_day_22_share_of_year_value_pct })));
console.table(t13);
console.table(t12.slice(0, 15).map(({ rank, buyer_name_en, buyer_name, contracts_2018_2025, value_2018_2025_amd, december_share_of_value_pct, december_share_of_count_pct }) => ({ rank, buyer: buyer_name_en || buyer_name, contracts: contracts_2018_2025, value: value_2018_2025_amd, dec_val_pct: december_share_of_value_pct, dec_cnt_pct: december_share_of_count_pct })));
console.table(t14.slice(0, 15).map(({ rank, buyer_name_en, buyer_name, urgent_contracts, urgent_value_amd, urgent_share_of_own_value_pct, share_of_all_urgent_value_pct }) => ({ rank, buyer: buyer_name_en || buyer_name, urgent_contracts, urgent_value_amd, own_value_pct: urgent_share_of_own_value_pct, all_urgent_pct: share_of_all_urgent_value_pct })));
if (failed.length) console.log(`FAILED SHARDS (${failed.length}):\n` + failed.join("\n"));
