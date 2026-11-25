import { CheckBox, FilledCheckBox, KrogerIcon, SearchIcon } from "@/assets/svg";
import Divider from "@/components/Divider";
import InputTapArea from "@/components/InputTapArea";
import KrogerSelectedStoreCard from "@/components/KrogerSelectedStoreCard";
import ThemeGradientButton from "@/components/ThemeGradientButton";
import ThemeNormalButton from "@/components/ThemeNormalButton";
import {
  horizontalScale,
  isAndroid,
  moderateScale,
  verticalScale,
} from "@/constants/Constants";
import { Strings } from "@/constants/Strings";
import { Colors, FontFamilies } from "@/constants/Theme";
import { searchKrogerProducts } from "@/services/krogerApi";
import { fontSize } from "@/utils/Fonts";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";

export interface KrogerProduct {
  productId: string;
  upc?: string;
  description?: string;
  brand?: string;
  categories?: string[] | string;
  images?: {
    perspective: string;
    featured?: boolean;
    sizes: { size: string; url: string }[];
  }[];
  items?: {
    itemId?: string;
    inventory?: { stockLevel?: string };
    price?: { regular?: number; promo?: number };
    size?: string;
    soldBy?: string;
    fulfillment?: {
      curbside?: boolean;
      delivery?: boolean;
      inStore?: boolean;
      shipToHome?: boolean;
    };
  }[];
}

export interface KrogerProductMeta {
  productId: string;
  upc: string;
  name: string;
  brand: string;
  imageUrl: string | null;
  size: string;
  parsedUnit: string;
  parsedQuantity: number;
  displayCategory: string;
  category: string;
  secondaryCategory: string;
  stockLevel: string;
  price: number | null;
  fulfillment: {
    curbside?: boolean;
    delivery?: boolean;
    inStore?: boolean;
    shipToHome?: boolean;
  } | null;
}

export interface IngredientSelection {
  ingredientName: string;
  meta: KrogerProductMeta | null;
}

interface AddKrogerIngredientProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (selection: IngredientSelection) => void;
  store: any;
  onChangeStore?: () => void;
}

const SEARCH_DEBOUNCE_MS = 400;
// Shortest term worth a request. "o" would match thousands of products.
const MIN_SEARCH_LENGTH = 2;

const getProductId = (product: KrogerProduct) =>
  product.productId || product.upc || "";

const getProductImage = (product: KrogerProduct): string | null => {
  if (!product.images?.length) return null;

  const frontImage =
    product.images.find(
      (image) => image.perspective === "front" && image.featured,
    ) ||
    product.images.find((image) => image.perspective === "front") ||
    product.images.find((image) => image.featured) ||
    product.images[0];

  if (!frontImage?.sizes?.length) return null;

  const preferredSize =
    frontImage.sizes.find((size) => size.size === "medium") ||
    frontImage.sizes.find((size) => size.size === "large") ||
    frontImage.sizes[0];

  return preferredSize?.url || null;
};

const getProductPrice = (product: KrogerProduct) => {
  const item = product.items?.[0];
  if (!item?.price) return null;

  return item.price.regular ?? item.price.promo ?? null;
};

const getProductSize = (product: KrogerProduct) =>
  product.items?.[0]?.size || "";

const normalizeCategories = (categories?: string[] | string): string[] => {
  if (Array.isArray(categories)) {
    return categories.filter(Boolean);
  }

  if (typeof categories === "string" && categories.trim()) {
    return [categories.trim()];
  }

  return [];
};

const parseKrogerSize = (
  sizeStr: string,
): { quantity: number; unit: string } => {
  if (!sizeStr) return { quantity: 0, unit: "" };

  const match = sizeStr.match(/^([\d.]+)\s*(.*)$/);
  if (!match) return { quantity: 0, unit: sizeStr.trim() };

  return {
    quantity: parseFloat(match[1]) || 0,
    unit: match[2].trim(),
  };
};

const getStockLabel = (product: KrogerProduct) => {
  const stockLevel = product.items?.[0]?.inventory?.stockLevel;

  if (stockLevel === "LOW") return Strings.addKrogerIngredient_lowStock;
  if (stockLevel === "TEMPORARILY_OUT_OF_STOCK") {
    return Strings.addKrogerIngredient_outOfStock;
  }

  return "";
};

const getFulfillmentLabel = (product: KrogerProduct) => {
  const fulfillment = product.items?.[0]?.fulfillment;

  if (fulfillment?.inStore) return Strings.addKrogerIngredient_inStore;
  if (fulfillment?.curbside) return Strings.addKrogerIngredient_curbside;
  if (fulfillment?.delivery) return Strings.addKrogerIngredient_delivery;
  if (fulfillment?.shipToHome) return Strings.addKrogerIngredient_shipToHome;

  return "";
};

export const buildProductMeta = (product: KrogerProduct): KrogerProductMeta => {
  const size = getProductSize(product);
  const parsedSize = parseKrogerSize(size);
  const categories = normalizeCategories(product.categories);
  const displayCategory = categories[categories.length - 1] || "";
  const fallbackCategory = categories[0] || displayCategory;

  return {
    productId: product.productId,
    upc: product.upc || "",
    name: product.description || "",
    brand: product.brand || "",
    imageUrl: getProductImage(product),
    size,
    parsedUnit: parsedSize.unit,
    parsedQuantity: parsedSize.quantity,
    displayCategory,
    category: displayCategory,
    secondaryCategory: fallbackCategory,
    stockLevel: product.items?.[0]?.inventory?.stockLevel || "",
    price: getProductPrice(product),
    fulfillment: product.items?.[0]?.fulfillment || null,
  };
};

const AddKrogerIngredient = ({
  visible,
  onClose,
  onSelect,
  store,
  onChangeStore,
}: AddKrogerIngredientProps) => {
  const [selectedProductId, setSelectedProductId] = useState<string | null>(
    null,
  );
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const searchInputRef = useRef<TextInput>(null);
  const [products, setProducts] = useState<KrogerProduct[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  // Guards against out-of-order responses. Typing fires overlapping requests
  // and a slow early one must not overwrite a newer result, so only the
  // latest request id is allowed to write state.
  const requestIdRef = useRef(0);

  const locationId = store?.locationId || "";

  const loadProducts = async (term?: string) => {
    if (!locationId) return;

    const requestId = ++requestIdRef.current;
    setIsSearching(true);

    try {
      const response = (await searchKrogerProducts(term, locationId, 12)) as {
        data?: KrogerProduct[];
      };
      if (requestId !== requestIdRef.current) return;
      setProducts(response.data || []);
      setHasSearched(Boolean(term?.trim()));
    } catch {
      if (requestId !== requestIdRef.current) return;
      setProducts([]);
      setHasSearched(Boolean(term?.trim()));
    } finally {
      if (requestId === requestIdRef.current) setIsSearching(false);
    }
  };

  useEffect(() => {
    if (!visible) {
      setSearch("");
      setDebouncedSearch("");
      setSelectedProductId(null);
      setProducts([]);
      setHasSearched(false);
      setIsSearching(false);
      // Abandon anything still in flight from the previous open.
      requestIdRef.current += 1;
    }
  }, [visible]);

  // Search as the user types. This used to run only from the keyboard's
  // search key, so typing a term and waiting sat on "no results" forever --
  // the request was never made. Mirrors the 400ms debounce in 1_Meals.tsx.
  useEffect(() => {
    if (!visible) return;
    const handler = setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handler);
  }, [search, visible]);

  useEffect(() => {
    if (!visible) return;
    setSelectedProductId(null);

    // A single character matches most of the catalog, so wait for a real
    // term rather than spending a request on it.
    if (debouncedSearch.length < MIN_SEARCH_LENGTH) {
      requestIdRef.current += 1;
      setProducts([]);
      setHasSearched(false);
      setIsSearching(false);
      return;
    }

    void loadProducts(debouncedSearch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, visible, locationId]);

  // The keyboard's search key now just flushes the debounce rather than
  // being the only way to search.
  const handleSearchSubmit = () => {
    const term = search.trim();
    if (term === debouncedSearch) {
      // Same term, so the effect above will not re-run. Retry directly --
      // this is the only way back from a failed request without editing the
      // text.
      if (term.length >= MIN_SEARCH_LENGTH) void loadProducts(term);
      return;
    }
    setDebouncedSearch(term);
  };

  const handleAddIngredient = () => {
    const selectedProduct = products.find(
      (product) => getProductId(product) === selectedProductId,
    );

    if (!selectedProduct) {
      const trimmedSearch = search.trim();

      if (!trimmedSearch) {
        return;
      }

      onSelect({
        ingredientName: trimmedSearch,
        meta: null,
      });
      return;
    }

    const meta = buildProductMeta(selectedProduct);
    onSelect({
      ingredientName: meta.name,
      meta,
    });
  };

  const renderProductItem = ({ item }: { item: KrogerProduct }) => {
    const imageUrl = getProductImage(item);
    const price = getProductPrice(item);
    const size = getProductSize(item);
    const stockLabel = getStockLabel(item);
    const fulfillmentLabel = getFulfillmentLabel(item);
    const isSelected = selectedProductId === getProductId(item);
    const soldByUnit = item.items?.[0]?.soldBy === "UNIT";

    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => setSelectedProductId(getProductId(item))}
        style={[styles.productCard, isSelected && styles.productCardSelected]}
      >
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            style={styles.productImage}
            resizeMode="contain"
          />
        ) : (
          <View style={[styles.productImage, styles.productImagePlaceholder]} />
        )}

        <View style={styles.productInfo}>
          <Text style={styles.productTitle} numberOfLines={2}>
            <Text style={styles.productTitleBold}>
              {item.description || ""}
            </Text>
            {size ? ` ${size}` : ""}
          </Text>

          {price !== null && (
            <Text style={styles.productPrice}>
              ${price.toFixed(2)}
              {soldByUnit ? ` ${Strings.addKrogerIngredient_each}` : ""}
            </Text>
          )}
        </View>

        <View style={styles.productStatusBlock}>
          {!!stockLabel && (
            <Text style={styles.productStatusText}>{stockLabel}</Text>
          )}
          {!!fulfillmentLabel && (
            <Text style={styles.productFulfillmentText}>
              {fulfillmentLabel}
            </Text>
          )}
        </View>

        <View style={styles.checkboxContainer}>
          {isSelected ? (
            <FilledCheckBox
              width={22}
              height={22}
              color={Colors.tertiary}
              style={styles.checkboxIcon}
            />
          ) : (
            <CheckBox
              width={22}
              height={22}
              color={Colors.tertiary}
              style={styles.checkboxIcon}
            />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      transparent
      visible={visible}
    >
      {/*
        The keyboard used to cover the results list and both buttons outright:
        an RN Modal is its own window, so the screen behind it resizing does
        nothing for the sheet. Shrinking the overlay by the keyboard height
        re-centres the sheet in what is left, and `maxHeight: 85%` then
        resolves against that smaller box.
      */}
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={isAndroid ? "height" : "padding"}
      >
        {/* Tapping the dimmed area behind the sheet drops the keyboard.
            Does not close the sheet -- only the Cancel button does that. */}
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={Keyboard.dismiss}
          accessible={false}
        />
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <View style={styles.container}>
          <View style={styles.headerRow}>
            <Text style={styles.headerTitle}>
              {Strings.addKrogerIngredient_title}
            </Text>
            <KrogerIcon
              width={horizontalScale(76)}
              height={verticalScale(43)}
            />
          </View>

          <Text style={styles.headerSubtitle}>
            {Strings.addKrogerIngredient_subtitle}
          </Text>

          {store ? (
            <KrogerSelectedStoreCard
              store={store}
              actionLabel={
                onChangeStore ? Strings.addKrogerIngredient_change : undefined
              }
              onActionPress={onChangeStore}
              style={styles.storeCard}
            />
          ) : null}

          <InputTapArea style={styles.searchBox} inputRef={searchInputRef}>
            <SearchIcon
              width={verticalScale(22)}
              height={verticalScale(22)}
              color={Colors.tertiary}
            />
            <TextInput
              ref={searchInputRef}
              style={styles.searchInput}
              placeholder={Strings.addKrogerIngredient_searchPlaceholder}
              placeholderTextColor={Colors.tertiary}
              returnKeyType="search"
              value={search}
              onChangeText={setSearch}
              onSubmitEditing={handleSearchSubmit}
            />
          </InputTapArea>

          <Divider showText={false} style={styles.divider} />

          {/*
            The results area is the only part allowed to shrink. The sheet caps
            at `maxHeight: 85%`, and once the keyboard shrinks the overlay that
            cap got smaller than the content -- so the buttons below overflowed
            past the sheet's own background and ended up under the keyboard.
            Letting this region absorb the loss keeps them on screen.
          */}
          <View style={styles.resultsArea}>
          {isSearching ? (
            <View style={styles.emptyContainer}>
              <ActivityIndicator size="large" color={Colors.tertiary} />
              <Text style={styles.emptyText}>
                {Strings.addKrogerIngredient_searching}
              </Text>
            </View>
          ) : products.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                {!locationId
                  ? Strings.addKrogerIngredient_noStore
                  : hasSearched
                    ? Strings.addKrogerIngredient_noResults
                    : Strings.addKrogerIngredient_searchPrompt}
              </Text>
            </View>
          ) : (
            <FlatList
              contentContainerStyle={styles.listContent}
              data={products}
              keyExtractor={(item) => getProductId(item)}
              renderItem={renderProductItem}
              showsVerticalScrollIndicator={false}
              style={styles.listStyle}
              // Without this the first tap on a product only dismisses the
              // keyboard, so selecting one takes two taps.
              keyboardShouldPersistTaps="handled"
            />
          )}
          </View>

          <View style={styles.buttonRow}>
            <ThemeNormalButton
              title={Strings.addKrogerIngredient_cancel}
              onPress={onClose}
              containerStyle={styles.cancelButton}
              backgroundColor={Colors.white}
            />
            <ThemeGradientButton
              title={Strings.addKrogerIngredient_addIngredient}
              onPress={handleAddIngredient}
              buttonGradient={styles.addButton}
              textStyle={styles.addButtonText}
              disabled={!selectedProductId && !search.trim()}
            />
            </View>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.18)",
    justifyContent: "center",
    alignItems: "center",
  },
  container: {
    width: "92%",
    maxHeight: "85%",
    alignSelf: "center",
    backgroundColor: Colors.white,
    borderRadius: moderateScale(22),
    paddingHorizontal: horizontalScale(18),
    paddingTop: verticalScale(18),
    paddingBottom: verticalScale(15),
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: verticalScale(4),
  },
  headerTitle: {
    fontFamily: FontFamilies.ROBOTO_SEMI_BOLD,
    fontSize: fontSize(21),
    color: Colors.primary,
  },
  headerSubtitle: {
    fontFamily: FontFamilies.ROBOTO_REGULAR,
    fontSize: fontSize(13),
    color: Colors.tertiary,
    marginBottom: verticalScale(14),
  },
  storeCard: {
    margin: verticalScale(8),
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.white,
    borderRadius: moderateScale(30),
    borderWidth: moderateScale(1),
    borderColor: Colors.borderColor,
    paddingHorizontal: horizontalScale(12),
    height: isAndroid ? verticalScale(50) : verticalScale(44),
    marginTop: verticalScale(5),
    marginBottom: verticalScale(8),
    gap: horizontalScale(8),
  },
  searchInput: {
    flex: 1,
    fontFamily: FontFamilies.ROBOTO_REGULAR,
    fontSize: moderateScale(15),
    color: Colors.primary,
    // Android's EditText adds its own asymmetric font padding, which left the
    // text sitting above the middle of the pill. 1_Meals.tsx's search field
    // already carries these and reads correctly.
    textAlignVertical: "center",
    paddingVertical: 0,
  },
  divider: {
    marginTop: verticalScale(6),
    marginBottom: verticalScale(10),
    gap: 0,
  },
  listStyle: {
    maxHeight: verticalScale(295),
  },
  listContent: {
    gap: verticalScale(10),
    // The last card sat flush against the buttons below, with its elevation
    // shadow clipped by the list's edge.
    paddingTop: verticalScale(2),
    paddingBottom: verticalScale(12),
  },
  productCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.white,
    borderRadius: moderateScale(12),
    marginHorizontal: horizontalScale(5),
    elevation: 4,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.16,
    shadowRadius: 4,
  },
  productCardSelected: {
    borderWidth: 1.5,
    borderColor: Colors.secondaryButtonBackground,
  },
  productImage: {
    width: horizontalScale(70),
    height: verticalScale(65),
    borderTopLeftRadius: moderateScale(12),
    borderBottomLeftRadius: moderateScale(12),
  },
  productImagePlaceholder: {
    backgroundColor: Colors._F0F0F0,
  },
  productInfo: {
    flex: 1,
    paddingHorizontal: horizontalScale(10),
    paddingVertical: verticalScale(8),
  },
  productTitle: {
    fontFamily: FontFamilies.ROBOTO_REGULAR,
    fontSize: moderateScale(13),
    color: Colors.primary,
    lineHeight: moderateScale(18),
  },
  productTitleBold: {
    fontFamily: FontFamilies.ROBOTO_SEMI_BOLD,
    fontSize: moderateScale(13),
    color: Colors.primary,
  },
  productPrice: {
    fontFamily: FontFamilies.ROBOTO_MEDIUM,
    fontSize: moderateScale(13),
    color: Colors.primary,
    marginTop: verticalScale(2),
  },
  productStatusBlock: {
    width: horizontalScale(78),
    paddingHorizontal: horizontalScale(4),
    justifyContent: "center",
    gap: verticalScale(4),
  },
  productStatusText: {
    fontFamily: FontFamilies.ROBOTO_REGULAR,
    fontSize: moderateScale(12),
    color: Colors.tertiary,
  },
  productFulfillmentText: {
    fontFamily: FontFamilies.ROBOTO_REGULAR,
    fontSize: moderateScale(12),
    color: Colors.primary,
  },
  checkboxContainer: {
    marginLeft: horizontalScale(4),
  },
  checkboxIcon: {
    marginRight: horizontalScale(6),
  },
  resultsArea: {
    flexShrink: 1,
    minHeight: 0,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    // Modest padding so this message survives being squeezed when the
    // keyboard is up -- at 40 it was the first thing clipped away.
    paddingVertical: verticalScale(18),
    gap: verticalScale(10),
  },
  emptyText: {
    fontFamily: FontFamilies.ROBOTO_REGULAR,
    fontSize: moderateScale(13),
    color: Colors.tertiary,
    textAlign: "center",
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: moderateScale(10),
    marginTop: verticalScale(10),
  },
  cancelButton: {
    backgroundColor: Colors.white,
    borderRadius: moderateScale(8),
    borderWidth: 1,
    borderColor: Colors.borderColor,
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    height: verticalScale(44),
  },
  addButton: {
    flex: 1,
    borderRadius: moderateScale(8),
    justifyContent: "center",
    alignItems: "center",
  },
  addButtonText: {
    color: Colors.white,
    fontSize: fontSize(16),
  },
});

export default AddKrogerIngredient;
