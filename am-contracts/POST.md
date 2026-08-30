# Draft post (r/datasets or LinkedIn), about 250 words

**Armenia cut single-source public contracts from 52 percent of spend to 7 percent. The count barely moved.**

I indexed 236,159 signed contracts from PPCM, Armenia's public procurement portal, and looked at every
award labelled "single source" (Armenian ՄԱ) between 2018 and August 2026.

By value, non-competitive awards fell from 52.04 percent of contract money in 2018 to 6.83 percent in
2024 and 12.54 percent so far in 2026. By count they stayed at roughly four in ten procurement procedures:
42.75 percent in 2018, 40.56 percent in 2026. The big money moved to tenders; the habit did not.

Where the single-source money sits:

- The Ministry of Health signed 486.7 billion AMD without competition, 70.04 percent of its spend and
  47.12 percent of all single-source value in the registry. The top 30 buyers hold 95.02 percent.
- The largest single-source suppliers are the state's own companies: Public Television (52.9 billion),
  Electric Networks of Armenia (45.4 billion, 1,724 contracts, 78 buyers), HayPost (29.3 billion), Gazprom
  Armenia (24.2 billion). 11 of the top 30 are hospitals.
- 1,080 companies with 10 or more contracts get over 90 percent of their public revenue from one buyer;
  618 have exactly one. Together: 1.68 trillion AMD.
- Appeals are vanishing from the record: 142 contracts carried one in 2018, 18 so far in 2026, 0.08 percent.

Method, procedure mapping, caveats (six keyed-in values above 100 billion AMD were dropped; the appeal field
is free text) and five CSVs are in the repo. Everything is aggregate; no individuals are named.

The underlying index is queryable per supplier by tax ID or name, refreshed weekly:
https://apify.com/reestri/am-supplier-contracts
