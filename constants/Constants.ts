import { Dimensions, Platform, StatusBar } from "react-native";
import { Strings } from "./Strings";

export const screenFullHeight = Dimensions.get("window").height;
export const screenWidth = Dimensions.get("window").width;
const sampleHeight = 932;
const sampleWidth = 430;

export const isAndroid: boolean = Platform.OS !== "ios";
const iPhoneX: boolean = screenFullHeight === 812 && Platform.OS === "ios";

// StatusBar Height
export const STATUSBAR_HEIGHT: number | undefined =
  Platform.OS === "ios" ? (iPhoneX ? 44 : 22) : StatusBar.currentHeight || 0;

// Adjust screen height for the status bar
export const screenHeight: number =
  Dimensions.get("window").height - (STATUSBAR_HEIGHT || 0);

/**
 * Scaling basis — deliberately NOT the current width/height.
 *
 * The reference frame (430x932) describes a portrait phone, so dividing the
 * live window width by `sampleWidth` only makes sense while the window *is* a
 * portrait phone. Feed it a landscape or tablet width and every helper scales
 * up as though the device were a giant phone: on a 1280x800 tablet
 * `horizontalScale` came out at 2.98x while `verticalScale` came out at 0.83x,
 * so text and horizontal padding ballooned while vertical space shrank — the
 * two axes scaling in opposite directions is what destroys the proportions.
 * Google Play's warning about android.hardware.screen.portrait is what put
 * tablets in scope (release 1.0.4 (30)).
 *
 * Two changes fix that without touching the ~54 files that consume these
 * helpers:
 *
 * 1. Measure from the SHORT edge as width and the LONG edge as height, so the
 *    basis is orientation-independent. A rotated phone scales exactly as it
 *    does in portrait — which also means the module-load snapshot below stops
 *    mattering for scaling, since it now yields the same numbers either way.
 * 2. Cap how far up we scale. The design targets a 430pt-wide phone; on a
 *    bigger screen the right answer is more content, not bigger content.
 *    MAX_UPSCALE is the knob — raise it for chunkier tablet text, set it to 1
 *    to render tablets exactly phone-sized.
 *
 * Phones in portrait are unaffected: shortEdge === width and longEdge ===
 * height there, so every ratio is identical to before.
 */
const MAX_UPSCALE = 1.3;

const shortEdge: number = Math.min(screenWidth, screenFullHeight);
const longEdge: number =
  Math.max(screenWidth, screenFullHeight) - (STATUSBAR_HEIGHT || 0);

const widthRatio: number = Math.min(shortEdge / sampleWidth, MAX_UPSCALE);
const heightRatio: number = Math.min(longEdge / sampleHeight, MAX_UPSCALE);

/**
 * Widest a single column of form content should get.
 *
 * Screens built for a 430pt phone fill the window, which is fine until the
 * window is a tablet: on a 2560px-wide landscape tablet the sign-in fields and
 * buttons stretched the full width, so an email input was ~2500px of empty box.
 * Capping the column and centring it keeps the form readable without needing a
 * separate tablet layout. On a phone this is a no-op -- the cap is wider than
 * the screen, so `width: "100%"` wins.
 */
export const CONTENT_MAX_WIDTH = 480;

/**
 * A width to size content against: the real window on a phone, capped on
 * anything wider.
 *
 * Screens and modals across the app size things as a fraction of the window --
 * `width * 0.35` for a dialog button, `width * 0.85` for a popup. That reads
 * fine on a phone and falls apart on a tablet, where the same fractions of a
 * 1280dp window give a 448dp button and an 1088dp dialog.
 *
 * Substituting this for the raw window width keeps every fraction and every
 * relative proportion exactly as designed while bounding the result. On a
 * phone it IS the window width (any phone is narrower than
 * CONTENT_MAX_WIDTH), so those layouts are untouched.
 *
 * Still a module-load snapshot, like the rest of this file -- but an
 * orientation-independent one on anything above the cap, so rotation does not
 * change it there.
 */
export const layoutWidth: number = Math.min(screenWidth, CONTENT_MAX_WIDTH);

/**
 * The same idea as CONTENT_MAX_WIDTH / layoutWidth, but for dialogs.
 *
 * A form is a single column of fields, so CONTENT_MAX_WIDTH (480) suits it.
 * A dialog is a different shape: its text wants to read across, and its
 * buttons sit side by side, so the form cap makes it look pinched -- the
 * delete-meal dialog came out at 480 * 0.85 = 408dp with its two buttons
 * crowding each other.
 *
 * 660 is chosen so the usual `dialogWidth * 0.85` container lands at ~561dp,
 * matching Material's 560dp maximum dialog width.
 *
 * As with layoutWidth, this IS the window width on a phone (every phone is
 * narrower than the cap), so phone dialogs are untouched.
 */
export const DIALOG_MAX_WIDTH = 660;
export const dialogWidth: number = Math.min(screenWidth, DIALOG_MAX_WIDTH);

// Logging flag
export const isShowLog: boolean = true;

// Get Width of Screen
export function getWidth(value: number): number {
  return value * widthRatio;
}

// Get Height of Screen
export function getHeight(value: number): number {
  return value * heightRatio;
}

// Horizontal scale (width-based)
export const horizontalScale = (value: number): number => {
  return value * widthRatio;
};

// Vertical scale (height-based)
export const verticalScale = (value: number): number => {
  return value * heightRatio;
};

// Moderate scale (smooth scaling)
export function moderateScale(size: number, factor: number = 0.5): number {
  return size + (horizontalScale(size) - size) * factor;
}

// Reel Heights based on platform
export const iosReelHeight: number = screenFullHeight - getHeight(100);
export const androidReelHeight: number = screenFullHeight - getHeight(70);

export const addDotAtEnd = (data: string): string => {
  return data.trim().endsWith(".") ? data : `${data}.`;
};

export function getPrepTimeMinutes(prepTime?: string): number {
  if (!prepTime) return 0;
  const match = prepTime.match(/\d+/);
  return match ? parseInt(match[0]) : 0;
}

export const setEndOfDay = (date: Date): Date => {
  const endDate = new Date(date);
  endDate.setHours(23, 59, 59, 999);
  return endDate;
};

export const getCurrentMealCategory = (): string => {
  const now = new Date();
  const hours = now.getHours();

  if (hours < 9) {
    return Strings.plans_breakfast; // Breakfast
  } else if (hours >= 9 && hours < 14) {
    return Strings.plans_lunch; // Lunch
  } else {
    return Strings.plans_dinner; // Dinner
  }
};

// Capitalize first letter of a word
export const capitalizeFirstLetter = (word: string): string => {
  if (!word) return word;
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
};
