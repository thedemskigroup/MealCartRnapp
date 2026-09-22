/**
 * Turns a shopping-list row into a Kroger cart quantity.
 *
 * A cart quantity counts **retail packages**. A row's `count` sometimes means
 * that and sometimes does not, and the only thing that tells them apart is the
 * shape of `unit`:
 *
 * - `unit` is the linked Kroger product's own size ("16 fl oz", "250 ml",
 *   "12 ct") — then the row *is* that product and `count` counts packages.
 *   "2 × 16 fl oz olive oil" is two bottles. Meals built in the app always land
 *   here: `CreateMealBottomSheet` writes `meta.size` straight into `unit`.
 * - `unit` names a package the user is counting out ("2 can", "3 package") —
 *   `count` counts packages.
 * - `unit` is a bare recipe measure ("3 tablespoon", "3 piece", "8 oz") — then
 *   `count` measures how much the cooking uses and says nothing about how many
 *   packages to buy. One package covers it. The premade catalog is full of
 *   these, and sending the count is what once ordered three bottles of olive
 *   oil and three packs of chicken breast for a single recipe.
 *
 * Note the asymmetry between a *size* and a bare *measure*: "16 fl oz" leads
 * with a number because it describes one container, while "oz" on its own is a
 * unit of measurement being counted by `count`. That is why a leading digit
 * means package and a bare measurement word does not.
 *
 * What we cannot do is convert between the two — "3 tablespoon" against a
 * 16 fl oz bottle needs the package size in the same dimension as the recipe
 * unit, and a row carries a single `unit` string that is one or the other,
 * never both. So the measured case rounds to one package, and under-buying is
 * the deliberate safe side: a bottle short is one tap to fix in Kroger, while
 * surplus bottles cost money and cannot be removed by the app at all (the v1
 * cart API has no remove endpoint).
 */

/**
 * Units that count packages rather than measuring an amount. Matched as whole
 * words, singular or plural, so "canola oil" is not read as a can.
 */
const PACKAGE_UNITS = new Set([
  "bag",
  "bottle",
  "box",
  "bunch",
  "can",
  "carton",
  "case",
  "container",
  "dozen",
  "head",
  "jar",
  "loaf",
  "loaves",
  "pack",
  "package",
  "packet",
  "tray",
  "tub",
]);

const normalizeUnit = (unit: unknown) =>
  String(unit ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

/**
 * True when the unit describes a package — either a product size the row is
 * counting ("16 fl oz") or a package noun ("bottle").
 */
export const isPackageUnit = (unit: unknown): boolean => {
  const normalized = normalizeUnit(unit);
  if (!normalized) return false;

  // A size leads with its number ("16 fl oz", "1 kg", "12 ct"): it names one
  // container, so `count` is how many of them to buy.
  if (/^[\d.]/.test(normalized)) return true;

  return normalized
    .split(/[^a-z]+/)
    .filter(Boolean)
    .some(
      (word) =>
        PACKAGE_UNITS.has(word) ||
        (word.endsWith("s") && PACKAGE_UNITS.has(word.slice(0, -1))),
    );
};

/**
 * How many packages of this ingredient to put in the cart, and whether that
 * number came from the row counting packages.
 *
 * `countsPackages` is false only for measured amounts, which is what lets a
 * caller merge the same product across two meals without adding the amounts
 * together: two recipes each using some olive oil still need one bottle.
 */
export const krogerCartQuantity = (ingredient: {
  count?: unknown;
  unit?: unknown;
  krogerUnit?: unknown;
}): { quantity: number; countsPackages: boolean } => {
  const unit = normalizeUnit(ingredient?.unit);
  const krogerUnit = normalizeUnit(ingredient?.krogerUnit);

  // The unit is verbatim the linked product's size, so the row counts that
  // product. This is the exact signal rather than the shape heuristic below,
  // and it holds even for a size we would not otherwise recognise.
  const namesTheProduct = !!krogerUnit && unit === krogerUnit;

  if (!namesTheProduct && !isPackageUnit(unit)) {
    return { quantity: 1, countsPackages: false };
  }

  // A cart holds whole packages, so a count of "0" or a fraction is not a
  // quantity it can express.
  const quantity = Math.max(1, Math.round(Number(ingredient?.count) || 1));

  return { quantity, countsPackages: true };
};
