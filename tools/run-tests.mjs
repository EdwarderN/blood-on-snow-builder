/* Run the browser tests from Node: npm test */
import { readFile } from 'node:fs/promises';
import { setData } from '../js/data.js';
import { runTests } from '../js/tests.js';

const path = (name) => new URL(`../data/${name}.json`, import.meta.url);
const read = async (name) => JSON.parse(await readFile(path(name), 'utf8'));

setData({
  rules: await read('rules'),
  factions: await read('factions'),
  units: await read('units'),
  equipment: await read('equipment')
});

const report = await runTests();
for (const result of report.results) {
  console.log(`${result.ok ? 'PASS' : 'FAIL'}  ${result.name}`);
  if (!result.ok) console.log(`      ${result.message}`);
}
console.log(`\n${report.passed}/${report.total} passed, ${report.failed} failed.`);
process.exitCode = report.failed ? 1 : 0;
