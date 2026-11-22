# Fast CSV Reader — Same Answers, Less Time

[![make.fun bounty](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121)
[![rank](https://make.fun/badge/csv-reader-speed-01-run-20261121/tomoyasu-muse/csv-reader-speed-20261121-entry/rank.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121)
[![reward](https://make.fun/badge/csv-reader-speed-01-run-20261121/tomoyasu-muse/csv-reader-speed-20261121-entry/reward.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121)

An entry in the
[make.fun bounty "Read broken CSV files faster, 21 November 2026"](https://make.fun/bounty/csv-reader-speed-01-run-20261121).

## Idea

The reference reader, csv-reader 1.0.0, walks its input one
character at a time and builds every field character by
character. This reader returns **exactly the same answer** for
every input — the same columns, rows and errors under the same
broken-row policy (stray CRs, quote junk, unterminated quotes,
short and long rows) — but it scans with `indexOf`, jumping
straight to the next character that can change the parse
(comma, quote, LF or CR) and copying each plain run of text
with one slice.

On the kit's practice set (6 cases, ~11 MB) its answers are
byte-identical to the reference's, and it runs about 2.5×
faster in local wall-clock tests.

## Run it

```sh
mkdir -p out
MAKEFUN_INPUT_DIR=practice/input MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` reads `cases.json` from the input directory and
writes `answers.json` to the output directory; `solve.js` is
the dependency-free ES module whose `run(input)` does the
reading.

## License

MIT — see [LICENSE](LICENSE).
