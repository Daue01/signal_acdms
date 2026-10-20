# ACDMS geography reference import

Source name: ACDMS Geography Reference Dataset (compiled 20 October 2026)
URL: https://en.wikipedia.org/wiki/ISO_3166-2:NG; https://github.com/xosasx/nigerian-local-government-areas
Download date: 2026-10-20 (dataset compilation date recorded in the supplied README)
Version: States current as of October 2026; LGAs 2022-07-27 / commit 115524a
Licence/reuse terms: State code/name facts are drawn from the supplied ISO 3166-2:NG compilation. LGA source is MIT Licence — free to use, modify and redistribute with attribution; retain the MIT licence text when redistributing the source repository. Internal working codes are ACDMS-derived reference identifiers, not official codes.

This is a reference-only and synthetic-demo prototype import. The state source is marked
`is_official = true` in geo_sources.csv for the published ISO code facts, but this combined
dataset is not an official end-to-end government release. The LGA source is marked
`is_official = false`. The supplied ward and EA files are explicitly synthetic demo rows:
`record_type = synthetic`, `is_official = false`, `identifier_source = not_inec_or_npc`
for wards and `not_npc_id` for EAs. They must never be used as official census geography.
