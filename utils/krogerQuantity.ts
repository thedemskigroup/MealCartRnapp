/**
 * Turns a recipe amount into a Kroger cart quantity.
 *
 * These are two different things, and conflating them is how a 29-item
 * shopping list became a 39-item Kroger cart. A recipe amount measures how much
 * of an ingredient the cooking uses ("3 tablespoon olive oil", "3 piece chicken
 * breast"); a cart quantity counts *retail packages* ("1 bottle", "1 pack").
 * Sending the recipe count as the quantity ordered three bottles of oil and
 * three packs of chicken.
 *
 * We cannot convert between the two — that needs the product's package size in
 * the same dimension as the recipe unit ("16 fl oz" vs tablespoons), and the
 * shopping-list ingredient carries only one `unit` string, which is the recipe
 * unit for the premade catalog and the Kroger size for meals built in the app.
 * So the rule is deliberately conservative: **one package**, unless the unit
 * itself names a package the user is counting out ("2 can", "3 package"), in
 * which case the count is what they meant.
 *
 * Under-buying is the safe side of this trade. One bottle short of oil is a
 * mistake the user can fix with one tap in Kroger; three unwanted bottles cost
 * them money and have to be removed one at a time — and Kroger's v1 API has no
 * remove endpoint, so Meal Cart cannot undo it for them.
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
 * True when the unit counts whole packages ("can", "2 packages").
 *
 * A unit that *starts* with a number is a size, not a count — "250 ml",
 * "1 Litre" and the Kroger sizes we store verbatim ("16 fl oz", "12 ct") all
 * describe one package, however many of something it holds.
 */
export const isPackageUnit = (unit: unknown): boolean => {
  const normalized = normalizeUnit(unit);
  if (!normalized || /^[\d.]/.test(normalized)) return false;

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
 * number came from the user counting packages.
 *
 * `countsPackages` is false for every measured amount, which is what lets a
 * caller merge the same product across two meals without adding the amounts
 * together: two recipes each using some olive oil still need one bottle.
 */
export const krogerCartQuantity = (ingredient: {
  count?: unknown;
  unit?: unknown;
}): { quantity: number; countsPackages: boolean } => {
  if (!isPackageUnit(ingredient?.unit)) {
    return { quantity: 1, countsPackages: false };
  }

  // A cart holds whole packages, so a count of "0" or a fraction is not a
  // quantity it can express.
  const quantity = Math.max(1, Math.round(Number(ingredient?.count) || 1));

  return { quantity, countsPackages: true };
};
