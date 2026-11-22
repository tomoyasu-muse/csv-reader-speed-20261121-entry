// Driver for the fast CSV reader: reads every case from
// cases.json in the input directory, answers each with run()
// from solve.js, and writes the answers, in order, to
// answers.json in the output directory. Outside the grading
// container, MAKEFUN_INPUT_DIR and MAKEFUN_OUTPUT_DIR stand in
// for /input and /output.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { setFlagsFromString } from 'node:v8';

// Match the house baseline's runtime tuning: V8's incremental
// marking off, set before solve.js loads so all parsing work
// runs under it.
setFlagsFromString('--no-incremental-marking');

const { run } = (await import(new URL('./solve.js', import.meta.url).href)) as {
  run: (input: unknown) => unknown;
};

const INPUT_DIR = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const OUTPUT_DIR = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

const cases = JSON.parse(readFileSync(join(INPUT_DIR, 'cases.json'), 'utf8')) as {
  id: string;
  input: unknown;
}[];
const answers: unknown[] = [];
for (const c of cases) answers.push(run(c.input));
writeFileSync(join(OUTPUT_DIR, 'answers.json'), JSON.stringify(answers));
