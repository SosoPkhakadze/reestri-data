# Who buys without competition, who wins, who is new: Armenia's public contracts 2018 to 2026

Reestri data story #2, built on the same `am-contracts` index as story #1 (Apify KV store `tb2jS3TGvqYDEkf5Q`,
generated **2026-08-29T22:07:28Z**, 236,159 unique contracts, 21,764 supplier keys, 318 buyers). The 2018 to 2026
window used here holds 214,244 contracts worth 4,547,341,742,554 AMD, of which 980,736,051,708 AMD (21.57 percent)
was awarded single-source. Both totals reconcile exactly with story #1.

Everything here is aggregate. Supplier names and tax IDs appear only for legal entities. Individual entrepreneurs
are counted in totals and cohort sizes but never listed.

## Headline findings

1. **The single-source money changed hands.** In 2018 the Ministry of Health awarded 62,907,744,766 AMD without
   competition, 95.70 percent of its spend. In 2026 to date it awarded 818,220,530 AMD, 5.98 percent. The largest
   single-source buyer of 2024 to 2026 is now the Administration of the Council of Public Broadcaster with
   22,908,930,783 AMD, still 93.27 percent of its 2026 spend; then Yerevan Municipality (16,595,935,837 AMD),
   the Ministry of High-Tech Industry (13,102,736,176 AMD, single-source share 2.93 percent in 2024, 68.16 percent
   in 2026), the Ministry of Health (12,468,608,603 AMD) and the Probation Service (11,741,474,959 AMD; 99.64
   percent of its 2026 spend, and 93.86 percent of everything it has ever spent through PPCM). The top 25 buyers
   hold 90.09 percent of the 192,287,837,302 AMD awarded single-source in 2024 to 2026; the top 5 hold 39.95 percent.
2. **Buyers still run mostly on single-source in 2026: 34 of 185.** The number of active buyers with more than half
   their yearly spend awarded single-source was 42 in 2018, 24 in 2024, 34 in 2026. Among buyers spending at least
   1 billion AMD in the year it went 10 of 24 in 2018, 4 of 54 in 2024, 7 of 50 in 2026. Buyers that jumped in
   2026: Ministry of Environment (13.97 percent in 2024, 65.32 percent in 2026), State Property Management Committee
   (0.36 to 76.54 percent), Armaeronavigatsia CJSC (6.15 to 65.50 percent), Ministry of High-Tech Industry (2.93 to
   68.16 percent).
3. **The supplier base grew 2.54 times and the top of it thinned.** 3,072 suppliers won at least one contract in
   2018; 7,795 in 2024 (5,778 companies, 2,017 individual entrepreneurs); 5,286 in the first eight months of 2026.
   The top 10 suppliers held 30.12 percent of contract value in 2018 and 17.24 percent in 2026; the top 100 held
   65.75 percent in 2018 and 61.90 percent in 2026. Half of each year's contract value went to 39 suppliers in 2018,
   25 in 2021, 65 in 2023, 40 in 2024, 59 in 2026.
4. **Every year, more than a third of winning suppliers are new to the registry.** 2,573 suppliers signed their
   first PPCM contract in 2022 (1,831 companies), 2,568 in 2023 (1,754), 2,917 in 2024 (1,630), 2,550 in 2025
   (1,465): 40.30, 34.56, 37.42 and 36.60 percent of that year's active suppliers. The 2022 cohort has since
   won 474,920,895,885 AMD across 14,576 contracts; the 2023 cohort 221,745,133,507 AMD; 2024 243,782,938,630 AMD;
   2025 84,715,341,222 AMD. The 15 largest companies that entered since 2022 took 357,996,775,859 AMD, 34.92 percent
   of the four cohorts' lifetime value, and 12 of the 15 have a single-source share of exactly 0. Eco Building LLC,
   first seen 2022-05-08 with Yerevan Municipality, has 51 contracts worth 75,836,974,744 AMD from 5 buyers.
   Three of the 15 had the Armenian Territorial Development Fund as first buyer (Armat Construction CJSC
   21,483,293,500 AMD, Shinvektor LLC 16,947,032,483 AMD, Grand Alliance LLC 11,036,400,000 AMD). One new
   entrant, Enigma Systemy Ochrony Informacji (Poland), won 13,009,874,272 AMD of which 90.28 percent single-source.
5. **The registry is splitting into many tiny contracts and a few huge ones.** The median contract fell from
   569,600 AMD in 2018 to 330,000 AMD in 2025 (399,600 AMD in 2026); the 90th percentile went from 20,053,900 to
   18,000,000 AMD. Contracts under 1 million AMD were 59.17 percent of all contracts in 2018 and 67.58 percent in
   2025, holding 1.06 and 0.70 percent of value. At the other end, contracts above 1 billion AMD numbered 21 in
   2018 (17.78 percent of value) and 243 in 2024 (59.48 percent of value); 137 in 2026 so far (49.69 percent).

## Files

| File | What it is |
|---|---|
| `analyze2.mjs` | The pipeline for this story. `node analyze2.mjs` reads `APIFY_TOKEN` from the repo `.env`, streams the 116 `tin-*` shards, aggregates, discards. Same loader, dedup, value cap and procedure mapping as `analyze.mjs`, which is untouched. Optional `SHARD_CACHE=<dir>`. |
| `6-single-source-by-buyer-year.csv` | Table 6. One row per buyer per year 2018 to 2026 (1,808 rows, 316 buyers): contracts, value, single-source contracts and value, shares, the buyer's 2018 to 2026 totals, and its rank by 2024 to 2026 single-source value. |
| `7-supplier-concentration.csv` | Table 7. Per year: distinct suppliers (split companies and individual entrepreneurs), value held by the top 10, 50 and 100 suppliers, and how many suppliers it takes to reach half of the year's value. |
| `8-new-entrants.csv` | Table 8. Cohort rows for first-contract years 2018 to 2025 (2018 to 2021 marked `context`), then the 15 largest companies whose first contract was in 2022 or later, with first contract date, first buyer, contracts and value to date, distinct buyers, single-source share and the first buyer's share of their value. |
| `9-contract-size.csv` | Table 9. Per year: mean, median, 90th and 99th percentile, contracts above 1 billion AMD and their share of value, contracts under 1 million AMD and their share. |
| `summary2.json` | Run metadata plus the top 25 buyers by 2024 to 2026 single-source value with their 2018, 2021, 2024 and 2026 shares and values. |

## Method

- Unit, year, value, supplier and buyer keys, the 50,000,000,000 AMD cap (6 records dropped from value sums,
  kept in counts) and the ՄԱ / ՀՄԱ single-source mapping are identical to story #1; see `README.md`.
- Table 6 and the top 25: buyers ranked by the sum of their single-source value in 2024, 2025 and 2026. A buyer's
  share for a year is its single-source value divided by its total contract value that year. `null` in
  `summary2.json` means the buyer signed nothing that year (the Probation Service has no 2018 contracts).
- Table 7: a supplier counts as active in a year if it signed at least one contract dated that year. Shares use
  the sum of each supplier's contract value in that year over the year's total. Suppliers without a tax ID are
  keyed by a hash of the name and counted as separate suppliers.
- Table 8: a supplier's first contract is the earliest `dateSigned` between 2000 and 2026 across all its records.
  The first buyer is the buyer on that contract. Cohort value is the sum over all of the cohort's contracts to
  date, not only the first year; `first_year_value_amd` gives the first-year figure. The top 15 excludes
  individual entrepreneurs.
- Table 9: statistics are computed over contracts with a positive value (the 837 contracts without a value in
  2018 to 2020, and the 6 capped records, are counted in `contracts` but not in the distribution). Percentiles use
  linear interpolation.

## Caveats

- "New to the registry" means first seen in PPCM. Coverage before 2018 is thin (3,992 contracts in 2016, 13,689
  in 2017), so a supplier first seen in 2022 may have sold to the state before PPCM. That is why the 2018 to
  2021 cohorts are marked `context` and not used in the findings. A company that re-registered under a new tax
  ID also looks new.
- Concentration is measured on signed contract totals, not on payments. A framework agreement signed in one
  year and drawn down over several inflates that year.
- The 2024 spike in single-source share among buyers and in contracts above 1 billion AMD coincides with large
  road and construction contracts by the Ministry of Territorial Administration and Infrastructure
  (190,212,484,432 AMD signed in 2024) and the Armenian Territorial Development Fund (157,188,763,453 AMD).
- 2026 covers signatures up to 2026-08-29; 2026 shares are year-to-date and will move.
- PPCM records the procedure form, not the legal ground for the single-source award; a high share can be a
  state-order arrangement (hospitals, public broadcaster) rather than a discretionary choice.
- Buyer names come from PPCM as typed; the same body can appear under Armenian and English names in different
  years. Rows are keyed by buyer tax ID, so totals are correct even where the displayed name varies.
- Nothing here was reviewed by a lawyer or by PPCM. Rerun `analyze2.mjs` against the next weekly index and the
  figures update.

## Tables in brief

**Table 6, top 25 buyers by 2024 to 2026 single-source value (AMD, then single-source share of own spend in 2018,
2021, 2024, 2026):** Council of Public Broadcaster 22,908,930,783 (55.00, 99.91, 92.23, 93.27); Yerevan
Municipality 16,595,935,837 (8.54, 0.14, 9.08, 13.50); Ministry of High-Tech Industry 13,102,736,176 (1.73,
15.19, 2.93, 68.16); Ministry of Health 12,468,608,603 (95.70, 28.90, 31.22, 5.98); Probation Service
11,741,474,959 (none, 100.00, 35.18, 99.64); Ministry of Defense 10,974,779,448 (32.31, 14.26, 12.96, 27.73);
Ministry of Territorial Administration and Infrastructure 10,552,537,882 (8.50, 30.11, 3.85, 8.87); Higher
Education and Science Committee 9,808,967,852 (83.24, 50.24, 10.66, 36.96); Ministry of Environment
9,123,280,126 (64.82, 7.32, 13.97, 65.32); Urban Development Committee 9,058,488,875 (6.48, 8.51, 0.68, 2.10);
Ministry of Internal Affairs 9,027,994,873 (50.07, 14.75, 30.82, 14.80); State Property Management Committee
8,505,555,534 (85.77, 92.00, 0.36, 76.54). Ranks 13 to 25 in `summary2.json`.

**Table 7:** distinct suppliers 2018 to 2026: 3,072; 3,519; 3,775; 5,121; 6,385; 7,431; 7,795; 6,967; 5,286.
Top 10 share of value: 30.12, 21.36, 24.87, 30.78, 21.34, 19.81, 27.03, 18.23, 17.24 percent. Top 50: 54.38,
47.19, 53.71, 64.56, 48.78, 45.34, 54.68, 45.69, 46.32. Top 100: 65.75, 60.47, 67.39, 75.09, 62.32, 58.00, 68.03,
60.23, 61.90.

**Table 8:** new suppliers per cohort 2022 to 2025: 2,573; 2,568; 2,917; 2,550. New companies: 1,831; 1,754;
1,630; 1,465. New individual entrepreneurs: 742; 814; 1,287; 1,085. First-year value share of the year: 17.01,
11.26, 14.98, 7.76 percent.

**Table 9:** median contract 2018 to 2026 (AMD): 569,600; 563,599; 550,000; 319,805; 490,000; 480,677; 400,000;
330,000; 399,600. Contracts above 1 billion AMD: 21, 32, 69, 63, 130, 109, 243, 174, 137. Their share of value:
17.78, 22.87, 33.79, 45.67, 45.95, 35.66, 59.48, 44.40, 49.69 percent.
