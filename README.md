# Blood on Snow — Detachment Builder

A static army builder for **Blood on Snow**, a Russian Civil War skirmish game. It runs entirely in the browser: no framework, no build step, no external libraries or CDNs.

Use it to:

- choose a side and subfaction;
- recruit Soldiers from the units that side may take;
- give each Soldier firearms, melee weapons and equipment, a Horse, a Voisko or a nickname;
- choose one Commander;
- see the points total against the game size;
- see list-building errors and warnings update after every change;
- save lists in the browser, share a list as a URL, and print an A4 roster.

The rules, units, points and equipment all live in `/data`. A non-programmer can change a cost, add a unit or add a weapon by editing one JSON file.

---

## Run it

The data is loaded with `fetch`, so opening `index.html` by double-clicking it will not work. Serve the folder over HTTP.

With Node.js installed:

```sh
npm run serve
```

Then open:

- builder: <http://127.0.0.1:8080/>
- tests: <http://127.0.0.1:8080/tests.html>

Any other static file server works too. To publish on GitHub Pages, upload the contents of this folder and point Pages at the branch/folder. No build step is required.

Run the logic tests without a browser:

```sh
npm test
```

`npm test` runs the same 16 checks that `tests.html` runs in the browser.

---

## Edit the data

All game data is in `/data`. Change a file, save it, and reload the builder. If you use GitHub Pages, commit and push the change.

### Change a cost

- Unit base cost: edit `points` in `data/units.json`.
- Weapon or equipment cost: edit `points` in `data/equipment.json`.
- Horse cost: edit `horseCost` in `data/rules.json`.
- Carry limits, machine-gun limit, game sizes and per-list limits: edit `data/rules.json`.

Subfaction modifiers are applied on top of those values. For example, Kolchak subtracts 1 from every equipment item.

### Add a picture

Put a JPG in:

- `assets/img/units/<unit id>.jpg` for a unit;
- `assets/img/equipment/<item id>.jpg` for an item.

The file name must match the `id` exactly. No code change is needed. If the picture is missing, the card is shown without a picture area instead of a broken image.

Currently missing pictures: **Hungarian Comrades**, **Cossack Rifle**, **Lance**, and the Mauser C96 stock variant (the C96 itself has a picture).

### Add a unit

1. Copy an existing entry in `data/units.json`.
2. Give it a new, unique `id`.
3. Set `group` to one of:
   - `both` — either side can take it;
   - `whites` — Whites only;
   - `reds` — Reds only;
   - `interventionists` — Whites only (Interventionists);
   - `internationals` — Reds only (International Brigades).
4. Set the stats: `ms`, `msFoot` (optional, for a mounted unit's movement on foot), `t`, `d`, `c`, `e`.
5. Set `tags` if needed: `character`, `mounted`, `cossack`, `colourRegiment`.
6. Add a `trait` object, or `"trait": null`.

### Add a weapon or item

Copy an entry of the same kind in `data/equipment.json`.

- `category`: `firearm` (counts toward the 2-firearm limit), `other` (2-other-item limit), or `upgrade` (counts toward neither).
- `type`: `rifle`, `carbine`, `handgun`, `mg`, `melee`, `grenade`, etc. The `requires` rule checks these types and item ids.
- `hands`: 1 or 2, or 0 for a bayonet/lance.
- `infantryOnly: true`: a mounted Soldier cannot take it.
- `mountedOnly: true`: only a mounted Soldier can take it.
- `requires`: an array of item types or ids the Soldier must already carry. For example, the Bayonet requires `"rifle"`.
- Firearm profiles: `rof`, `range`, `supply`, `reliability`, and `mgClass` for machine guns.

### Add a subfaction

Copy one of the subfactions in `data/factions.json`. Each subfaction has a name, two rules, and a `modifiers` array.

Supported modifier types:

| Type | Effect |
|---|---|
| `equipmentDiscount` | Subtract from every item, minimum 0. Does not apply to a Horse. |
| `unitDiscount` | Subtract from one unit's base points (`unit` is the unit id). |
| `horseCost` | Replace the Horse cost. |
| `itemCost` | Replace one item's cost. Other discounts are applied afterwards. |
| `itemDiscount` | Subtract from one named item. |
| `noLimit` | Remove a per-list limit (`colourRegiments` is the only one currently used, by Kornilov). |

A completely new kind of modifier needs a code change in `js/cost.js` or `js/validate.js`.

### Add a faction rule

Faction rules are the `factionRules` array on a side. Subfaction rules are the `rules` array on a subfaction. Both use `{ "name": "...", "text": "..." }`.

### Check your edit

Open `tests.html` after any data edit. If a test fails because you deliberately changed a cost, update the expected number in `js/tests.js`.

The tests currently cover:

1. White Infantry + Mosin under Denikin = 43
2. the same under Kolchak = 42
3. Colour Regiment + Mosin + Bayonet under Kornilov = 59
4. mounted RKKA, Konarmiya costs, and the infantry-only Mosin error
5. Tachanka cost under Chapaev
6. Obrez cost under Partisans
7. character limits
8. machine-gun limits at 500 and 750
9. firearm and other-item carry limits
10. Bayonet requiring a rifle
11. Lance requiring a mount
12. four Colour Regiments under Denikin vs Kornilov
13. Hungarian Comrades in a White list
14. a Soldier with no firearm
15. a Cossack with no Voisko
16. a share-URL round trip

---

## How points are calculated

For each Soldier:

```
unit base points
+ horse cost (if a Horse is taken)
+ every item's cost after subfaction discounts
```

The detachment total is the sum of all Soldier costs. The header shows `total / game size` and turns red over the limit.

The five cost modifiers are applied in `js/cost.js`; the list total never adds points anywhere else.

## How validation works

`js/validate.js` returns two lists:

- **errors** — the list is illegal (over points, no Commander, no firearm, carry limits, machine-gun limit, character/Cossack/Colour limits, wrong side, mounted restrictions, missing requirement, no Voisko);
- **warnings** — advice only (a heavy machine gun with no crew, an inactive Commander trait, more than 25 points spare).

The UI re-runs validation after every change. Invalid equipment choices in the equipment picker are greyed out with the reason; points and counts are still allowed to go over so the list can be edited.

## Saving and sharing

- The current list is autosaved in `localStorage` and restored on reload.
- **Save** stores a named snapshot in the same browser. **Load** lists the snapshots and can delete them.
- **Share** puts a compact, base64-encoded copy of the list in the URL hash. Anyone with the link can open that list. Nothing is uploaded.
- **Print** renders the roster and opens the browser's print dialog. `?print=1` opens a print preview directly.

The printed roster is black and white, A4, with faction rules, one row per Soldier, weapon profiles and condition tick boxes. It is designed for at most two A4 pages.

## Files

```
index.html            the builder page
theme.css             supplied design system — do not edit
style.css             layout and responsive rules
print.css             A4 print layout
data/
  rules.json          game sizes, carry limits, list limits, Horse cost
  factions.json       sides, faction rules, subfactions, modifiers
  units.json          every Soldier
  equipment.json      every weapon and item
js/
  main.js             starts the app, top bar, save/load/share/print
  data.js             loads the JSON files and logs the counts
  state.js            the list model and list changes
  cost.js             all points arithmetic
  validate.js         all rule checks and the equipment-choice guard
  storage.js          localStorage and share URLs
  format.js           stat and weapon formatting
  ui-builder.js       detachment cards, validation and interactions
  ui-faction.js       faction picker and army summary
  ui-recruit.js       recruit panel
  ui-parts.js         shared card pieces
  ui-equipment.js     equipment picker
  ui-dialogs.js       modals, save/load/share, toasts
  ui-roster.js        printable roster
  tests.js            the 16 tests
tests.html            runs the tests in the browser
tools/
  serve.mjs           local static server
  run-tests.mjs       runs the tests in Node
assets/               supplied fonts and pictures
```

`theme.css` comes from the rulebook and should not be edited. App-specific layout lives in `style.css`.

## Notes

- No account, campaign tracking, dice roller or online sync is included.
- All fonts, pictures and data are local; the app makes no external requests.
- Pictures are sepia-toned already; no CSS filters are applied.
