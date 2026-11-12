/* Loads the four data files once and exposes them to every other module.
   To change a cost, a unit or a rule, edit the JSON in /data — never this file. */

const DATA_FILES = ['rules', 'factions', 'units', 'equipment'];
const DATA_BASE = new URL('../data/', import.meta.url);

export const data = {
  rules: null,
  factions: null,
  units: null,
  equipment: null,
  unitById: new Map(),
  itemById: new Map(),
  sideById: new Map(),
  subfactionById: new Map()
};

export function setData(raw) {
  if (!raw || !raw.rules || !Array.isArray(raw.factions?.sides) || !Array.isArray(raw.units) || !Array.isArray(raw.equipment)) {
    throw new Error('Data is incomplete: expected rules, factions.sides, units and equipment.');
  }
  for (const [label, rows] of [['unit', raw.units], ['item', raw.equipment]]) {
    const seen = new Set();
    for (const row of rows) {
      if (!row || typeof row.id !== 'string' || !row.id) throw new Error(`Every ${label} needs a string id.`);
      if (seen.has(row.id)) throw new Error(`Duplicate ${label} id "${row.id}".`);
      seen.add(row.id);
    }
  }

  data.rules = raw.rules;
  data.factions = raw.factions;
  data.units = raw.units;
  data.equipment = raw.equipment;
  data.unitById = new Map(raw.units.map((unit) => [unit.id, unit]));
  data.itemById = new Map(raw.equipment.map((item) => [item.id, item]));
  data.sideById = new Map(raw.factions.sides.map((side) => [side.id, side]));
  data.subfactionById = new Map();
  for (const side of raw.factions.sides) {
    for (const sub of side.subfactions || []) {
      data.subfactionById.set(sub.id, { ...sub, sideId: side.id });
    }
  }
  return data;
}

export async function loadData(base = DATA_BASE) {
  const responses = await Promise.all(DATA_FILES.map(async (name) => {
    const response = await fetch(new URL(`${name}.json`, base), { cache: 'no-cache' });
    if (!response.ok) throw new Error(`Could not load data/${name}.json (${response.status}).`);
    return response.json();
  }));
  const [rules, factions, units, equipment] = responses;
  setData({ rules, factions, units, equipment });
  console.info(`[Blood on Snow] Loaded ${units.length} units, ${equipment.length} equipment items, ${factions.sides.length} sides, ${data.subfactionById.size} subfactions.`);
  return data;
}
