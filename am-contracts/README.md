# Single-source awards in Armenia's public contracts, 2018 to 2026

Reestri data story #1. Source: the `am-contracts` index (Apify KV store `tb2jS3TGvqYDEkf5Q`) that
`am-contracts-sync` builds weekly from PPCM, the public contracts module of armeps.am. Index used here was
generated **2026-08-29T22:07:28Z**. PPCM reported 237,994 contracts; the index holds 236,159 unique
contracts from 21,764 supplier keys (15,204 companies, 6,560 individual entrepreneurs) and 318 buyers.

Everything in this directory is aggregate. Supplier names and tax IDs appear only for legal entities.
Individual entrepreneurs (names prefixed ֆ/ա, Ա/Ձ, ԱՁ) are counted in the totals but never listed.

## Headline findings

1. **Single-source awards fell from 52.04 percent of contract value in 2018 to 6.83 percent in 2024**, while
   they stayed at roughly 4 in 10 procurement procedures by count (42.75 percent of procurement contracts
   in 2018, 38.83 percent in 2024, 40.56 percent in 2026 to date). Armenia moved the money, not the habit.
2. **One buyer signs almost half of all single-source money.** The Ministry of Health awarded
   486,685,298,874 AMD without competition across 6,788 contracts, 70.04 percent of everything it spent
   through PPCM and 47.12 percent of all single-source value in the registry. The top 5 buyers hold
   72.11 percent, the top 30 hold 95.02 percent.
3. **The biggest single-source suppliers are the state's own companies and hospitals.** Public Television
   (52,880,444,997 AMD, 31 single-source contracts), Electric Networks of Armenia (45,357,101,423 AMD, 1,724
   contracts, 78 buyers), HayPost (29,289,653,502 AMD, 1,088 contracts, 80 buyers) and Gazprom Armenia
   (24,215,228,500 AMD) lead the list; 11 of the top 30 are hospitals or medical institutions paid by the
   Ministry of Health. The top 30 together account for 44.74 percent of all single-source value.
4. **1,080 companies with at least 10 contracts get more than 90 percent of their public revenue from a
   single buyer**, 1,675,307,582,513 AMD in total. 618 of them have exactly one buyer. 430 depend on the
   Ministry of Health (560,907,422,606 AMD); 19 road and construction contractors depend on the Ministry of
   Territorial Administration and Infrastructure (294,647,301,552 AMD). 268 of the 1,080 won all of it
   competitively (0 percent single-source), 224 got at least 90 percent of it single-source.
5. **Appeals are almost extinct in the record.** 651 of 214,244 contracts signed 2018 to 2026 (0.30 percent)
   carry an appeal narrative: 142 in 2018 (0.95 percent), 24 in 2023 (0.08 percent), 18 in the first eight
   months of 2026 (0.08 percent).

Totals for 2018 to 2026: 214,244 contracts, 4,547,341,742,554 AMD; single-source 70,606 contracts
(32.96 percent) worth 980,736,051,708 AMD (21.57 percent). Restricted to procurement procedures (excluding
non-procurement expenses and grant competitions): 168,785 contracts, 3,996,040,571,367 AMD; single-source
41.83 percent by count and 24.54 percent by value.

## Files

| File | What it is |
|---|---|
| `analyze.mjs` | The whole pipeline. `node analyze.mjs` reads `APIFY_TOKEN` from the repo `.env`, finds the store by name, streams the 116 `tin-*` shards one at a time, aggregates, discards. Optional `SHARD_CACHE=<dir>` caches raw shards outside the repo. |
| `1-single-source-by-year.csv` | Table 1. Every year in the data (typos included); use 2018 to 2026. Also NPNA columns and the procurement-only denominator. |
| `2-top30-suppliers-single-source.csv` | Table 2. Companies only. |
| `3-top30-buyers-single-source.csv` | Table 3. |
| `4-supplier-dependence.csv` | Table 4. 1,080 rows, companies only. |
| `5-appeals-by-year.csv` | Table 5. |
| `procedure-vocabulary.csv` | Every procedure label in the index with counts and how it was classified. |
| `summary.json` | Run metadata: index date, counts, excluded value outliers, appeal classes, coverage. |

## Method

- Unit of analysis: one PPCM contract record (`contractId`). Year = year of `dateSigned`. Value =
  `contractValueTotal` in AMD (PPCM's stated total; `latestValue` is the current amount after amendments
  and is not used, except to detect outliers).
- A supplier is a tax ID (`supplierTaxId`); records without a tax ID are keyed by a hash of the name and
  never listed. A buyer is `buyerTaxId`.
- Table 2 and 4 rank legal entities only. Individual entrepreneurs hold 10,063,348,595 AMD of single-source
  value in total; they stay in the yearly and buyer tables.
- Table 4 rule: at least 10 contracts, and the top buyer's share of the supplier's total contract value
  above 90 percent.
- Value outliers: six records carry totals from 138,515,676,294 to 1,660,030,208,638,300 AMD while their
  `latestValue` is below 1.5 billion (keying errors: one 2026 electronic auction alone would exceed
  Armenia's cumulative state budget). Records above 50,000,000,000 AMD are dropped from value sums and kept
  in counts; they are listed in `summary.json`. Below the cap, 401 records still have a total at least 99
  times their latest value; they are left as published and inflate value figures slightly.
- Dates: 62 contracts have impossible years (0200 to 0226, 1901 to 1992, 2027, 2029, 2108) and 3 have no
  date; they appear in the raw yearly file but not in any 2018 to 2026 figure. 21,850 contracts are dated
  2000 to 2017 and are excluded from the headline range because PPCM coverage before 2018 is thin (3,992
  contracts in 2016, 13,689 in 2017 versus 15,022 in 2018).

## Mapping: what counts as single-source

PPCM labels each contract with a procedure form (`formNameEn`, stored as `procedure`) and its Armenian
abbreviation (`formAbbrHy`, stored as `procedureAbbr`). The full vocabulary with counts is in
`procedure-vocabulary.csv`. Classification used:

| Abbreviation | PPCM English label | Classified as | Contracts | Value AMD |
|---|---|---|---|---|
| ՄԱ | single source | single-source | 72,157 | 873,697,151,468 |
| ՀՄԱ | urgent single source | single-source | 4,101 | 159,199,176,604 |
| ԲԸԱՀ | NPNA (Negotiated Procedure with No Preliminary Announcement) | negotiated without notice, reported separately, not in the single-source figures; label disappears after 2017 | 8,333 | 87,781,267,586 |
| ԳՉԾ | NPE (Non-Procurement expense) | not a procurement procedure; excluded from the procurement-only denominator | 26,390 | 147,702,789,658 |
| ԴՄ | Grant competition | not a procurement procedure; excluded from the procurement-only denominator | 19,375 | 406,331,767,167 |
| ԳՀ, ԷԱՃ, ԲՄ, ՀԲՄ, ՇՀ, ԲԸ, ՊԸ, ԲԸՀ, ԵՄ, ՄԵ | request for quotation, electronic auction, open tender, urgent open tender, framework agreement, open procedure, simplified procedure, NPA, bipartite contest, competitive dialog | competitive or other | 105,803 | 3,160,240,916,478 |

"Single-source" here is PPCM's own classification of the award procedure (Armenian ՄԱ = մեկ անձից,
"from one person"). It is a legal procedure type under the Law on Procurement, not a judgement about
whether competition was possible.

## Mapping: what counts as an appeal

PPCM's `tenderAppealsInfo` is a free-text narrative typed by the buyer, most often some spelling of "no
complaints were submitted regarding the procurement process". Rule used (`appealClass` in `analyze.mjs`):

- empty or punctuation only: none;
- contains an Armenian negation (a word starting with չ such as չկա, չկան, չեն, չի, the stem բացակայ, or
  a standalone ոչ / no / none): none;
- otherwise, counted as an appeal only if it mentions an appeal (բողոք, appeal, complaint, жалоб);
- anything else (legal citations, grant labels, URLs, "առկա են") is "other" and not counted.

All years: 233,535 none, 772 appeal, 1,852 other. Texts whose negation and mention appear in the same
sentence but in an unusual form (an appeal that was filed and then rejected, written with a negation word
first) can be misclassified as none; the count is a floor.

## Coverage and caveats

- PPCM publishes **signed contracts** from state and community buyers using the e-procurement system:
  buyer, supplier, procedure form, total and latest value, key dates, bidder list, appeal narrative. It
  does **not** publish, in this feed, the legal ground for single-source awards, unit prices, amendment
  history, payments or execution, subcontractors, or supplier ownership. A rising or falling single-source
  share can therefore reflect both policy and how buyers choose to route spending through PPCM.
- The index strips supplier emails, bank details and staff names at ingest and never had them.
- 2026 covers signatures up to 2026-08-29.
- Grant competitions (ԴՄ) and non-procurement expenses (ԳՉԾ) are contracts in PPCM's sense but not
  procurement procedures; both denominators are given in table 1.
- The Ministry of Health numbers include payments to public hospitals under state-order medical services,
  which PPCM records as single-source contracts. That is the single largest driver of the 2018 to 2020
  value shares.
- Nothing here was reviewed by a lawyer or by PPCM. Corrections welcome; rerun `analyze.mjs` against the
  next weekly index and the figures update.

## Tables in brief

**Table 1** (share of contract value that was single-source): 2018 52.04, 2019 49.00, 2020 47.13,
2021 21.00, 2022 25.74, 2023 21.41, 2024 6.83, 2025 9.21, 2026 12.54 percent. Share of count: 41.81, 38.64,
43.58, 30.48, 32.39, 34.91, 26.07, 28.78, 30.27 percent.

**Table 2** (top suppliers by single-source value, AMD): Public Television of Armenia 52,880,444,997;
Electric Networks of Armenia 45,357,101,423; HayPost 29,289,653,502; Erebuni Medical Center 24,980,777,925;
Gazprom Armenia 24,215,228,500; Arabkir Medical Complex 19,848,223,700; Karavan-11 LLC 18,175,162,169;
Natali Pharm 18,165,117,283; St. Gregory the Illuminator Medical Center 16,966,790,715; A.A.B. Project LLC
15,246,606,537. Full list of 30 in the CSV with tax IDs, buyer counts and date ranges.

**Table 3** (top buyers by single-source value, AMD, share of own spend): Ministry of Health
486,685,298,874 (70.04 percent); Ministry of Territorial Administration and Infrastructure 84,279,806,235
(11.75 percent); Administration of the Council of Public Broadcaster 61,824,011,075 (97.13 percent);
Ministry of Defense 60,121,566,353 (20.47 percent); Ministry of Internal Affairs 51,906,541,081
(31.70 percent); Yerevan Municipality 21,892,054,730 (8.22 percent); Urban Development Committee
17,221,781,051 (3.66 percent); Armenian Nuclear Power Plant 17,076,141,750 (18.14 percent); State Revenue
Committee 14,838,050,009 (11.58 percent); Ministry of High-Tech Industry 14,746,677,776 (12.91 percent).

**Table 4**: 1,080 dependent companies; 618 single-buyer; 645 at 100 percent; largest are road builders
(Chanaparh LLC 57,166,213,082 AMD, 94.55 percent from MTAI; Euroasphalt CJSC 57,087,975,357 AMD, 97.40
percent from MTAI) and Public Television (96.72 percent from the Council of Public Broadcaster).

**Table 5**: contracts with appeals 2018 to 2026: 142, 114, 103, 78, 74, 24, 47, 51, 18.
