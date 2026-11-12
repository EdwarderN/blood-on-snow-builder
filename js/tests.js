/* The 16 checks from the build plan. Run them in tests.html, or with tools/run-tests.mjs. */

import { data } from './data.js';
import { newList, addSoldier, addItem, setHorse, setVoisko, setCommander, setName, sanitizeList } from './state.js';
import { listTotal, soldierCost, itemPoints } from './cost.js';
import { statsText } from './format.js';
import { validate } from './validate.js';
import { shareUrl, parseShareHash } from './storage.js';

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) throw new Error(`${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

function army(side, subfaction, gameSize = 500) {
  return newList({ name: 'Test Detachment', side, subfaction, gameSize });
}

function recruit(list, unitId, items = [], options = {}) {
  const soldier = addSoldier(list, unitId);
  assert(soldier, `could not recruit ${unitId}`);
  for (const itemId of items) addItem(list, soldier.uid, itemId);
  if (options.horse) setHorse(list, soldier.uid, true);
  if (options.voisko) setVoisko(list, soldier.uid, options.voisko);
  if (options.nickname) soldier.nickname = options.nickname;
  return soldier;
}

function errorsWith(list, code) {
  return validate(list).errors.filter((error) => error.code === code);
}

test('1. White Infantry with a Mosin, Denikin: 43', () => {
  const list = army('whites', 'denikin');
  const soldier = recruit(list, 'whiteinf', ['mosin']);
  assertEqual(soldierCost(soldier, list), 43, 'soldier cost');
  assertEqual(listTotal(list), 43, 'list total');
});

test('2. White Infantry with a Mosin, Kolchak: 42', () => {
  const list = army('whites', 'kolchak');
  const soldier = recruit(list, 'whiteinf', ['mosin']);
  assertEqual(soldierCost(soldier, list), 42, 'soldier cost');
});

test('3. Colour Regiment with Mosin and bayonet, Kornilov: 59', () => {
  const list = army('whites', 'kornilov');
  const soldier = recruit(list, 'colour', ['mosin', 'bayonet']);
  assertEqual(soldierCost(soldier, list), 59, 'soldier cost');
});

test('4. RKKA with a horse, Konarmiya: 36; Mosin error; Winchester 51 and valid', () => {
  const list = army('reds', 'konarmiya');
  const soldier = recruit(list, 'rkka', [], { horse: true });
  assertEqual(soldierCost(soldier, list), 36, 'base cost with horse');
  assert(statsText(data.unitById.get('rkka'), true).startsWith('MS 16 cm (8)'), 'a mounted foot Soldier moves 16 cm, not 8');
  addItem(list, soldier.uid, 'mosin');
  assert(errorsWith(list, 'mounted-infantry-only').length > 0, 'Mosin should be an error for mounted infantry');

  const valid = army('reds', 'konarmiya');
  recruit(valid, 'rkka', ['winchester'], { horse: true });
  assertEqual(listTotal(valid), 51, 'Winchester total');
  assertEqual(validate(valid).errors.length, 0, 'valid list has no errors');
});

test('5. Tachanka costs 5 under Chapaev and 10 under anyone else', () => {
  const chapaev = army('reds', 'chapaev');
  recruit(chapaev, 'rkka', ['maxim', 'tachanka']);
  assertEqual(itemPoints('tachanka', chapaev), 5, 'Chapaev tachanka');

  const denikin = army('whites', 'denikin');
  recruit(denikin, 'whiteinf', ['maxim', 'tachanka']);
  assertEqual(itemPoints('tachanka', denikin), 10, 'other tachanka');
});

test('6. Obrez: 13 for Partisans, 16 for everyone else', () => {
  const partisans = army('reds', 'partisans');
  recruit(partisans, 'rkka', ['obrez']);
  assertEqual(itemPoints('obrez', partisans), 13, 'Partisan obrez');

  const denikin = army('whites', 'denikin');
  recruit(denikin, 'whiteinf', ['obrez']);
  assertEqual(itemPoints('obrez', denikin), 16, 'other obrez');
});

test('7. Two Officers error; an Officer plus a Batiushka is fine', () => {
  const two = army('whites', 'denikin');
  recruit(two, 'officer', ['mosin']);
  recruit(two, 'officer', ['mosin']);
  assert(errorsWith(two, 'character-limit').length > 0, 'two Officers should error');

  const mixed = army('whites', 'denikin');
  recruit(mixed, 'officer', ['mosin']);
  recruit(mixed, 'batiushka', ['mosin']);
  assertEqual(errorsWith(mixed, 'character-limit').length, 0, 'Officer plus Batiushka should be fine');
});

test('8. Three Lewis guns: error at 500, fine at 750', () => {
  const small = army('whites', 'denikin', 500);
  for (let i = 0; i < 3; i += 1) recruit(small, 'whiteinf', ['lewis']);
  assert(errorsWith(small, 'mg-limit').length > 0, '500 points should cap machine guns at 2');

  const large = army('whites', 'denikin', 750);
  for (let i = 0; i < 3; i += 1) recruit(large, 'whiteinf', ['lewis']);
  assertEqual(errorsWith(large, 'mg-limit').length, 0, '750 points should allow three');
});

test('9. Three firearms error; two firearms plus two melee items is fine', () => {
  const three = army('whites', 'denikin');
  recruit(three, 'whiteinf', ['mosin', 'lee', 'mauser98']);
  assert(errorsWith(three, 'carry-firearms').length > 0, 'three firearms should error');

  const fine = army('whites', 'denikin');
  recruit(fine, 'whiteinf', ['mosin', 'lee', 'axe', 'kinzhal']);
  assertEqual(errorsWith(fine, 'carry-firearms').length, 0, 'two firearms fine');
  assertEqual(errorsWith(fine, 'carry-other').length, 0, 'two other items fine');
});

test('10. Bayonet with only a Colt errors', () => {
  const list = army('whites', 'denikin');
  recruit(list, 'whiteinf', ['colt', 'bayonet']);
  assert(errorsWith(list, 'requires').length > 0, 'bayonet should require a rifle');
});

test('11. Lance errors on infantry, fine on a Cossack', () => {
  const foot = army('whites', 'denikin');
  recruit(foot, 'whiteinf', ['mosin', 'lance']);
  assert(errorsWith(foot, 'mounted-only').length > 0, 'lance should need a mount');

  const horse = army('whites', 'denikin');
  recruit(horse, 'cossack', ['lance'], { voisko: 'Don' });
  assertEqual(errorsWith(horse, 'mounted-only').length, 0, 'Cossack can carry a lance');
});

test('12. Four Colour Regiments: error under Denikin, fine under Kornilov', () => {
  const denikin = army('whites', 'denikin');
  for (let i = 0; i < 4; i += 1) recruit(denikin, 'colour', ['mosin']);
  assert(errorsWith(denikin, 'colour-limit').length > 0, 'Denikin should cap Colour Regiments');

  const kornilov = army('whites', 'kornilov');
  for (let i = 0; i < 4; i += 1) recruit(kornilov, 'colour', ['mosin']);
  assertEqual(errorsWith(kornilov, 'colour-limit').length, 0, 'Kornilov removes the cap');
});

test('13. Hungarian Comrades in a White list errors', () => {
  const list = army('whites', 'denikin');
  list.soldiers.push({ uid: 'imported-1', unitId: 'hungarian', horse: false, voisko: '', items: ['mosin'], isCommander: true, nickname: '' });
  assert(errorsWith(list, 'side').length > 0, 'Hungarian is an International unit');
});

test('14. A Soldier with no firearm errors and is named', () => {
  const list = army('whites', 'denikin');
  recruit(list, 'whiteinf');
  const errors = errorsWith(list, 'no-firearm');
  assertEqual(errors.length, 1, 'one no-firearm error');
  assert(errors[0].message.includes('White Infantry'), 'the error names the Soldier');
});

test('15. A Cossack with no Voisko errors', () => {
  const list = army('whites', 'denikin');
  const cossack = recruit(list, 'cossack', ['mosin']);
  assert(errorsWith(list, 'voisko').length > 0, 'missing Voisko should error');
  setVoisko(list, cossack.uid, 'Kuban');
  assertEqual(errorsWith(list, 'voisko').length, 0, 'choosing a Voisko clears it');
});

test('16. A list round-trips through a share URL unchanged', () => {
  const list = army('whites', 'kolchak', 750);
  setName(list, 'Winter Column');
  const officer = recruit(list, 'officer', ['mosin', 'bayonet'], { horse: true, nickname: 'Sokol' });
  setCommander(list, officer.uid);
  recruit(list, 'whiteinf', ['lee', 'axe']);
  recruit(list, 'cossack', ['lance'], { voisko: 'Siberian' });

  const url = shareUrl(list, 'https://example.test/blood-on-snow-builder/');
  const roundTripped = parseShareHash(new URL(url).hash);
  assert(roundTripped, 'share hash should decode');
  assertEqual(
    JSON.stringify(sanitizeList(roundTripped)),
    JSON.stringify(sanitizeList(list)),
    'round-tripped list differs'
  );
  assert(url.startsWith('https://example.test/blood-on-snow-builder/#list='), 'URL uses the hash');
});

export async function runTests() {
  if (!data.rules) throw new Error('Data must be loaded before running tests.');
  const results = [];
  for (const { name, fn } of tests) {
    try {
      await fn();
      results.push({ name, ok: true, message: 'Passed' });
    } catch (error) {
      results.push({ name, ok: false, message: error.message || String(error) });
    }
  }
  const passed = results.filter((result) => result.ok).length;
  return { results, passed, failed: results.length - passed, total: results.length };
}

export { tests };
