import { burger, closeIcon, mealfoodA } from "@/assets/images";
import { CheckBox, FilledCheckBox, SearchIcon } from "@/assets/svg";
import {
  horizontalScale,
  isAndroid,
  moderateScale,
  verticalScale,
} from "@/constants/Constants";
import { Strings } from "@/constants/Strings";
import { Colors, FontFamilies } from "@/constants/Theme";
import { CREATE_MEAL_PLAN, SHOPPING_LIST } from "@/reduxStore/appKeys";
import { Meal } from "@/reduxStore/slices/mealsSlice";
import {
  getKrogerConnectionStatus,
  searchKrogerProducts,
} from "@/services/krogerApi";
import { toDate } from "@/utils/DateFormat";
import { useMealsViewModel } from "@/viewmodels/MealsViewModel";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { buildProductMeta, KrogerProduct } from "./AddKrogerIngredient";
import CustomStepper from "./CustomStepper";
import CustomTextInput from "./CustomTextInput";
import PaginationLoader from "./PaginationLoader";
import ThemeGradientButton from "./ThemeGradientButton";
import ThemeNormalButton from "./ThemeNormalButton";

const mealsData = [
  { id: "1", name: "Classic Spaghetti Bolognese", image: burger },
  { id: "2", name: "Classic Spaghetti Bolognese", image: burger },
  { id: "3", name: "Classic Spaghetti Bolognese", image: burger },
];
const { height } = Dimensions.get("window");
const { width } = Dimensions.get("window");

interface AddItemToListProps {
  visible: boolean;
  onClose: () => void;
  from?: typeof CREATE_MEAL_PLAN | typeof SHOPPING_LIST;
  onMealSelect?: (meal: any) => void;
}

const AddItemToList = ({
  visible,
  onClose,
  from = "shoppingList",
  onMealSelect,
}: AddItemToListProps) => {
  const [search, setSearch] = useState("");

  const [searchText, setSearchText] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isInputFocused, setIsInputFocused] = useState(false);
  // `manual: true` marks a row the user added by hand from the Kroger search.
  // It is what keeps the auto-add effect below from sweeping the row away when
  // the meal-derived ingredient set changes.
  const [manualList, setManualList] = useState<
    { id: string; value: string; manual?: boolean }[]
  >([]);
  const [unitWeight, setUnitweight] = useState("100 grms");
  const unitWeightOptions = ["100grm", "200grm", "1kg"];
  const unitWeightIndex = unitWeightOptions.indexOf(unitWeight);
  const [itemWeights, setItemWeights] = useState<Record<string, number>>({});

  const {
    meals,
    globalMeals,
    loading,
    fetchMeals,
    searchMealsCombined,
    fetchGlobalMealsData,
    searchGlobalMealsCombined,
  } = useMealsViewModel();
  const [filteredMeals, setFilteredMeals] = useState<any[]>([]);
  const [mealsCursor, setMealsCursor] = useState<any>(null);
  const [mealsEndReached, setMealsEndReached] = useState(false);
  const [globalCursor, setGlobalCursor] = useState<any>(null);
  const [globalEndReached, setGlobalEndReached] = useState(false);
  const [isLoadingMoreMeals, setIsLoadingMoreMeals] = useState(false);
  const MEALS_PAGE_SIZE = 10;
  const [selectedMeals, setSelectedMeals] = useState<string[]>([]);
  const [dynamicIngredients, setDynamicIngredients] = useState<string[]>([]);
  // Names the user removed with the ✕ — kept so the auto-add effect below
  // doesn't put them straight back on the next recompute.
  const [removedNames, setRemovedNames] = useState<string[]>([]);
  const [fullIngredientsData, setFullIngredientsData] = useState<any[]>([]);
  // Ingredients the user added from the Kroger search rather than from a meal.
  // They are held separately because `fullIngredientsData` is recomputed from
  // the selected meals and would drop them on the next recompute.
  const [manualKrogerItems, setManualKrogerItems] = useState<any[]>([]);
  const [krogerStore, setKrogerStore] = useState<any>(null);
  const [krogerProducts, setKrogerProducts] = useState<KrogerProduct[]>([]);
  const [isSearchingKroger, setIsSearchingKroger] = useState(false);
  const debounceTimeout = useRef<NodeJS.Timeout | null>(null);
  const krogerDebounceTimeout = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<TextInput>(null);
  const [isLoading, setIsLoading] = useState(false);
  const krogerLocationId = krogerStore?.locationId || "";
  const KROGER_MIN_QUERY_LENGTH = 2;

  // Helper function: Fetch all ingredients data for a meal
  // Fetch from ingredient collection using ingredientId

  useEffect(() => {
    if (!visible) {
      setSearch("");
      setSearchText("");
      setSuggestions([]);
      setIsInputFocused(false);
      setManualList([]);
      setUnitweight("100 grms");
      setItemWeights({});
      setFilteredMeals([]);
      setSelectedMeals([]);
      setDynamicIngredients([]);
      setRemovedNames([]);
      setFullIngredientsData([]);
      setManualKrogerItems([]);
      setKrogerProducts([]);
      setIsSearchingKroger(false);
      setIsLoading(false);
    }
  }, [visible]);

  // The Kroger product search needs a store to price/stock against, and the
  // selected store lives on the user's Kroger connection record.
  useEffect(() => {
    if (!visible || from === CREATE_MEAL_PLAN) return;

    let cancelled = false;

    (async () => {
      try {
        const status: any = await getKrogerConnectionStatus();
        if (!cancelled) setKrogerStore(status?.selectedStore || null);
      } catch {
        // No connection / no store — the search block explains that in place.
        if (!cancelled) setKrogerStore(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [visible, from]);

  // Load the first page every time the picker opens.
  //
  // This used to fetch only `if (meals.length === 0)` and only 3 rows. Because
  // `meals` is a Redux accumulator shared with the Meals tab, whatever that tab
  // happened to have loaded became the entire set of meals offered here — so a
  // meal you had just created showed up while older ones didn't, and the list
  // never grew. Always fetching page 1 (and paginating below) makes this list
  // reflect the user's meals instead of another screen's fetch history.
  useEffect(() => {
    if (!visible) return;

    setMealsCursor(null);
    setMealsEndReached(false);
    setGlobalCursor(null);
    setGlobalEndReached(false);
    setIsLoading(true);

    // Page 1 of the user's own meals AND of the global/official catalog. Global
    // meals are a valid source of ingredients here, so they belong in this list
    // (and in the search below) just like the user's own.
    Promise.all([
      new Promise<void>((resolve) => {
        fetchMeals(
          (data) => {
            if (data.length < MEALS_PAGE_SIZE) setMealsEndReached(true);
            if (data.length > 0) setMealsCursor(data[data.length - 1]);
            resolve();
          },
          () => resolve(),
          MEALS_PAGE_SIZE,
          null,
        );
      }),
      new Promise<void>((resolve) => {
        fetchGlobalMealsData(
          (data) => {
            if (data.length < MEALS_PAGE_SIZE) setGlobalEndReached(true);
            if (data.length > 0) setGlobalCursor(data[data.length - 1]);
            resolve();
          },
          () => resolve(),
          MEALS_PAGE_SIZE,
          null,
        );
      }),
    ]).then(() => setIsLoading(false));
  }, [visible]);

  // `meals` is appended page-by-page and newly created meals are pushed onto the
  // end, so the store order is fetch order. Sort explicitly, newest first, to
  // match how the Meals tab presents the same data.
  const byNewestFirst = (a: any, b: any) =>
    (toDate(b?.createdAt)?.getTime() ?? 0) -
    (toDate(a?.createdAt)?.getTime() ?? 0);

  // The user's own meals first, then the global catalog. `meals` is the user
  // accumulator, but legacy data can tag a global meal with a real uid, so drop
  // those defensively (the same guard 1_Meals.tsx uses) — otherwise a global
  // meal could show up twice.
  const mealOptions = search.trim()
    ? filteredMeals
    : [
        ...meals.filter((meal: any) => !meal.isGlobal).sort(byNewestFirst),
        ...[...globalMeals].sort(byNewestFirst),
      ];

  const loadMoreMeals = () => {
    // `search` swaps the list over to `filteredMeals`, which is its own
    // (unpaginated) result set — don't advance the store cursor from there.
    if (search.trim() || isLoading || isLoadingMoreMeals) {
      return;
    }

    // Exhaust the user's own meals first, then keep paging into the global
    // catalog so everything in the list stays reachable by scrolling.
    if (!mealsEndReached && mealsCursor) {
      setIsLoadingMoreMeals(true);
      fetchMeals(
        (data) => {
          if (data.length < MEALS_PAGE_SIZE) setMealsEndReached(true);
          if (data.length > 0) setMealsCursor(data[data.length - 1]);
          setIsLoadingMoreMeals(false);
        },
        () => setIsLoadingMoreMeals(false),
        MEALS_PAGE_SIZE,
        mealsCursor,
      );
      return;
    }

    if (!globalEndReached && globalCursor) {
      setIsLoadingMoreMeals(true);
      fetchGlobalMealsData(
        (data) => {
          if (data.length < MEALS_PAGE_SIZE) setGlobalEndReached(true);
          if (data.length > 0) setGlobalCursor(data[data.length - 1]);
          setIsLoadingMoreMeals(false);
        },
        () => setIsLoadingMoreMeals(false),
        MEALS_PAGE_SIZE,
        globalCursor,
      );
    }
  };

  // Filter meals based on search
  useEffect(() => {
    if (!visible) return;
    if (!search.trim()) return; // Don't search if empty

    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
    }
    debounceTimeout.current = setTimeout(async () => {
      setIsLoading(true);
      const searchText = search.trim().toLowerCase();

      // Search the user's meals and the global/official catalog in parallel.
      // This used to hit searchMealsCombined only, so a global meal could never
      // be found here. Each side resolves to [] on failure so one failing
      // (e.g. the user search when there's no userId) still shows the other.
      const [userResults, globalResults] = await Promise.all([
        new Promise<any[]>((resolve) => {
          searchMealsCombined({ searchText }, resolve, () => resolve([]));
        }),
        new Promise<any[]>((resolve) => {
          searchGlobalMealsCombined({ searchText }, resolve, () => resolve([]));
        }),
      ]);

      const seenIds = new Set<string>();
      setFilteredMeals(
        [...userResults, ...globalResults].filter((meal) => {
          if (!meal?.id || seenIds.has(meal.id)) return false;
          seenIds.add(meal.id);
          return true;
        }),
      );
      setIsLoading(false);
    }, 400); // 400ms debounce

    return () => {
      if (debounceTimeout.current) {
        clearTimeout(debounceTimeout.current);
      }
    };
  }, [search, visible]);

  // Extract ingredients from selected meals with full data
  useEffect(() => {
    if (selectedMeals.length === 0) {
      setDynamicIngredients([]);
      setFullIngredientsData([]);
      return;
    }

    // A checked meal can come from the user's own meals, the global catalog or
    // the search results, so look in all three — resolving it is what gives us
    // its ingredients.
    const combinedMeals = [...meals, ...globalMeals, ...filteredMeals];
    const seenIds = new Set<string>();
    const uniqueMeals = combinedMeals.filter((meal) => {
      if (seenIds.has(meal.id)) return false;
      seenIds.add(meal.id);
      return true;
    });

    const selectedMealObjects = uniqueMeals.filter((meal) =>
      selectedMeals.includes(meal.id),
    );

    const allIngredientNames: string[] = [];
    const allFullIngredients: any[] = [];

    // Loop through each selected meal
    for (const meal of selectedMealObjects) {
      if (meal.ingredients && Array.isArray(meal.ingredients)) {
        // Extract ingredient names from the meal's ingredients array
        meal.ingredients.forEach((ingredient: any) => {
          const ingredientName = ingredient.ingredientName;

          if (ingredientName && !allIngredientNames.includes(ingredientName)) {
            allIngredientNames.push(ingredientName);
            // Add meal information to each ingredient
            allFullIngredients.push({
              ...ingredient,
              mealId: meal.id,
              mealName: meal.name,
            });
          }
        });
      }
    }

    setDynamicIngredients(allIngredientNames);
    setFullIngredientsData(allFullIngredients);
  }, [selectedMeals, meals, globalMeals, filteredMeals]);

  // Checking a meal adds every one of its ingredients to the list right away,
  // i.e. the checkbox alone now does what tapping each ingredient and then its
  // "Add" button used to do. Unchecking a meal takes its ingredients back out,
  // and anything removed with the ✕ stays out (removedNames) — this effect
  // re-runs whenever `meals` grows through pagination, which would otherwise
  // resurrect it.
  useEffect(() => {
    setManualList((prev) => {
      const kept = prev.filter(
        (item) => item.manual || dynamicIngredients.includes(item.value),
      );
      const keptNames = new Set(kept.map((item) => item.value));
      const additions = dynamicIngredients
        .filter((name) => !keptNames.has(name) && !removedNames.includes(name))
        .map((name) => ({ id: name, value: name }));
      return [...kept, ...additions];
    });
  }, [dynamicIngredients, removedNames]);

  // Removed initialization of itemWeights - let them be undefined by default
  // so that ingredient's default unit can be used

  // Helper: get names already added to the list
  const excludedNames = useMemo(() => {
    const names = new Set<string>();
    manualList.forEach((i) => names.add(i.value));
    return names;
  }, [manualList]);

  // Build filtered suggestions whenever inputs change
  useEffect(() => {
    // Show suggestions when meals are selected (dynamicIngredients populated)
    // OR when the input is focused / has search text
    const hasMealIngredients = dynamicIngredients.length > 0;

    if (!hasMealIngredients && !isInputFocused && !searchText.trim()) {
      setSuggestions([]);
      return;
    }

    let pool = dynamicIngredients.filter((name) => !excludedNames.has(name));

    if (searchText.trim()) {
      const lower = searchText.toLowerCase();
      pool = pool.filter((name) => name.toLowerCase().includes(lower));
    }

    setSuggestions(pool);
  }, [dynamicIngredients, searchText, isInputFocused, excludedNames]);

  // The "Add item Manually" box searches the Kroger catalog for the user's
  // selected store, the same source the meal builder's ingredient search uses.
  // It used to filter only the selected meals' own ingredients — and since
  // checking a meal now auto-adds every one of them, that pool was always
  // empty, so typing here could never return anything.
  useEffect(() => {
    if (!visible || from === CREATE_MEAL_PLAN) return;

    if (krogerDebounceTimeout.current) {
      clearTimeout(krogerDebounceTimeout.current);
    }

    const term = searchText.trim();

    if (term.length < KROGER_MIN_QUERY_LENGTH || !krogerLocationId) {
      setKrogerProducts([]);
      setIsSearchingKroger(false);
      return;
    }

    setIsSearchingKroger(true);
    krogerDebounceTimeout.current = setTimeout(async () => {
      try {
        const response = (await searchKrogerProducts(
          term,
          krogerLocationId,
          12,
        )) as { data?: KrogerProduct[] };
        setKrogerProducts(response?.data || []);
      } catch {
        setKrogerProducts([]);
      } finally {
        setIsSearchingKroger(false);
      }
    }, 400);

    return () => {
      if (krogerDebounceTimeout.current) {
        clearTimeout(krogerDebounceTimeout.current);
      }
    };
  }, [searchText, krogerLocationId, visible, from]);

  const handleSearch = (text: string) => {
    setSearchText(text);
  };

  // Tapping a Kroger result adds that product to the list straight away, as a
  // Kroger-linked ingredient (so it can be sent to the Kroger cart later).
  const handleSelectKrogerProduct = (product: KrogerProduct) => {
    const meta = buildProductMeta(product);
    const name = meta.name?.trim();

    if (!name || excludedNames.has(name)) {
      setSearchText("");
      setKrogerProducts([]);
      return;
    }

    const ingredient = {
      ingredientId: meta.upc || meta.productId || "",
      ingredientName: name,
      categoryName: meta.displayCategory || meta.category || "",
      categoryId: "",
      unit: meta.size || meta.parsedUnit || "",
      count: "1",
      mealId: "",
      mealName: "",
      isKroger: true,
      krogerIngredientId: meta.productId || meta.upc || "",
      krogerUnit: meta.size || "",
    };

    setManualKrogerItems((prev) => [
      ...prev.filter((item) => item.ingredientName !== name),
      ingredient,
    ]);
    setManualList((prev) => [
      ...prev,
      {
        id: `kroger-${ingredient.ingredientId}-${Date.now()}`,
        value: name,
        manual: true,
      },
    ]);
    setRemovedNames((prev) => prev.filter((removed) => removed !== name));
    setSearchText("");
    setKrogerProducts([]);
  };

  const handleInputFocus = () => {
    setIsInputFocused(true);
  };

  // Tapping one of a meal's ingredients adds it to the list immediately.
  // It used to land in a "pending" row that needed a second tap on "Add"
  // before handleGenerateList would include it, so the first tap looked like
  // it had done nothing.
  const handleSelectSuggestion = (value: string) => {
    if (excludedNames.has(value)) {
      return;
    }

    setManualList((prev) => [...prev, { id: Date.now().toString(), value }]);
    setRemovedNames((prev) => prev.filter((name) => name !== value));
    setSearchText("");
  };

  // Use dynamic ingredients from selected meals

  const handleMealPress = (meal: any) => {
    // Dismiss keyboard and blur input when selecting meals
    // Keyboard.dismiss();
    // inputRef.current?.blur();

    if (from === CREATE_MEAL_PLAN) {
      // For meal plan: single selection, call callback immediately
      onMealSelect?.(meal);
      onClose();
    } else {
      // For shopping list: multi-selection with checkboxes
      setSelectedMeals((prev) => {
        if (prev.includes(meal.id)) {
          return prev.filter((id) => id !== meal.id);
        } else {
          return [...prev, meal.id];
        }
      });
    }
  };

  const handleGenerateList = () => {
    // Only send ingredients that are actually on the added list — meal-derived
    // ones plus anything picked out of the Kroger search.
    const addedNames = manualList.map((item) => item.value);
    const byName = new Map<string, any>();
    [...fullIngredientsData, ...manualKrogerItems].forEach((ingredient) => {
      if (
        ingredient?.ingredientName &&
        !byName.has(ingredient.ingredientName)
      ) {
        byName.set(ingredient.ingredientName, ingredient);
      }
    });
    const addedIngredients = addedNames
      .map((name) => byName.get(name))
      .filter(Boolean);

    const ingredientsList = addedIngredients.map((ingredient) => {
      const ingredientName = ingredient.ingredientName || "";
      const isKroger = ingredient.isKroger || false;

      // For Kroger: always use ingredient's own unit
      // For non-Kroger: use user-selected unit from stepper
      let selectedUnit = ingredient.unit || "";
      if (!isKroger) {
        const categoryUnits = ingredient.categoryUnits || [];
        const defaultUnit = ingredient.unit || "";
        const normalizedDefault = defaultUnit.replace(/\s+/g, "").toLowerCase();
        const defaultIndex = categoryUnits.findIndex(
          (u: string) =>
            u.replace(/\s+/g, "").toLowerCase() === normalizedDefault,
        );
        const weightIndex =
          itemWeights[ingredientName] !== undefined
            ? itemWeights[ingredientName]
            : defaultIndex >= 0
              ? defaultIndex
              : 0;
        selectedUnit = categoryUnits[weightIndex] || defaultUnit;
      }

      return {
        ingredientId: ingredient.ingredientId || "",
        ingredientName: ingredientName,
        categoryName: ingredient.categoryName || "",
        categoryId: ingredient.categoryId || "",
        unit: selectedUnit,
        count: ingredient.count || "0",
        mealId: ingredient.mealId || "",
        mealName: ingredient.mealName || "",
        isKroger,
        krogerIngredientId: ingredient.krogerIngredientId || "",
        krogerUnit: ingredient.krogerUnit || "",
      };
    });

    onMealSelect?.(ingredientsList);
    onClose();
  };

  const renderMealItem = ({ item }: { item: Meal }) => (
    <TouchableOpacity
      style={styles.mealCard}
      onPress={() => handleMealPress(item)}
    >
      <Image
        source={item.imageUrl ? { uri: item.imageUrl } : mealfoodA}
        style={styles.mealImage}
        resizeMode="cover"
      />
      <Text style={styles.mealName}>{item.name}</Text>

      {from !== CREATE_MEAL_PLAN &&
        (selectedMeals.includes(item.id) ? (
          <FilledCheckBox
            width={verticalScale(22)}
            height={verticalScale(22)}
            color={Colors.tertiary}
            style={styles.checkboxIcon}
          />
        ) : (
          <CheckBox
            width={verticalScale(22)}
            height={verticalScale(22)}
            color={Colors.tertiary}
            style={styles.checkboxIcon}
          />
        ))}
    </TouchableOpacity>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={StyleSheet.absoluteFillObject} />
        </TouchableWithoutFeedback>
        <KeyboardAvoidingView
          behavior={"padding"}
          keyboardVerticalOffset={isAndroid ? 0 : 0}
          style={{ width: "100%", alignItems: "center" }}
        >
          <View style={styles.container}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View>
                <Text style={styles.title}>
                  {from === CREATE_MEAL_PLAN
                    ? Strings.createPlan_selectAMeal
                    : Strings.addItemToList_title}
                </Text>
                {from !== CREATE_MEAL_PLAN && (
                  <Text style={styles.subtitle}>
                    {Strings.addItemToList_subtitle}
                  </Text>
                )}
              </View>
            </TouchableWithoutFeedback>

            <View style={styles.searchBox}>
              <SearchIcon
                width={verticalScale(22)}
                height={verticalScale(22)}
                color={Colors.tertiary}
              />
              <TextInput
                style={styles.searchInput}
                placeholder={Strings.addItemToList_searchPlaceholder}
                placeholderTextColor={Colors.tertiary}
                value={search}
                onChangeText={setSearch}
              />
            </View>
            {meals.length > 0 && <View style={styles.dividerRow} />}

            {isLoading && (
              <ActivityIndicator size="large" style={styles.loader} />
            )}

            <TouchableWithoutFeedback>
              <View>
                <FlatList
                  data={mealOptions}
                  showsVerticalScrollIndicator={false}
                  keyExtractor={(item) => item.id}
                  renderItem={renderMealItem}
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={styles.mealsListContent}
                  ItemSeparatorComponent={() => (
                    <View style={styles.mealSeparator} />
                  )}
                  style={styles.mealsListStyle}
                  onEndReached={loadMoreMeals}
                  onEndReachedThreshold={0.5}
                  ListFooterComponent={
                    isLoadingMoreMeals ? <PaginationLoader /> : null
                  }
                />
              </View>
            </TouchableWithoutFeedback>

            {from !== CREATE_MEAL_PLAN && (
              <View>
                <View style={styles.divider} />

                <Text style={styles.addManualLabel}>
                  {Strings.addItemToList_addManualLabel}
                </Text>

                <CustomTextInput
                  ref={inputRef}
                  placeholder={Strings.addItemToList_searchIngredient}
                  style={styles.manualInput}
                  placeholderTextColor={Colors.tertiary}
                  onChangeText={handleSearch}
                  value={searchText}
                  onFocus={handleInputFocus}
                />

                {suggestions.length > 0 && (
                  <FlatList
                    data={suggestions}
                    keyExtractor={(item) => item}
                    keyboardShouldPersistTaps="handled"
                    style={styles.suggestionsListStyle}
                    extraData={[manualList, itemWeights]}
                    renderItem={({ item }) => {
                      const ingredientData = fullIngredientsData.find(
                        (ing) => ing.ingredientName === item,
                      );
                      const isKroger = ingredientData?.isKroger || false;
                      const unit = ingredientData?.unit || "";
                      const count = ingredientData?.count || "0";
                      const categoryUnits = ingredientData?.categoryUnits || [];

                      // For non-Kroger: calculate stepper index
                      const normalizedDefault = unit
                        .replace(/\s+/g, "")
                        .toLowerCase();
                      const defaultIndex = categoryUnits.findIndex(
                        (u: string) =>
                          u.replace(/\s+/g, "").toLowerCase() ===
                          normalizedDefault,
                      );
                      const currentIndex =
                        itemWeights[item] !== undefined
                          ? itemWeights[item]
                          : defaultIndex >= 0
                            ? defaultIndex
                            : 0;
                      const safeIndex = currentIndex >= 0 ? currentIndex : 0;

                      return (
                        <View>
                          <View style={styles.suggestionItemContainer}>
                            <TouchableOpacity
                              onPress={() => {
                                handleSelectSuggestion(item);
                              }}
                              style={styles.suggestionTouchable}
                            >
                              <Text style={styles.suggestionText}>{item}</Text>
                            </TouchableOpacity>

                            {isKroger ? (
                              <Text style={styles.suggestionText}>
                                {Number(count) > 0 && `${count} `}
                                {unit}
                              </Text>
                            ) : (
                              <View style={styles.rowItem}>
                                <CustomStepper
                                  value={categoryUnits[safeIndex] || unit}
                                  onIncrement={() => {
                                    setItemWeights((prev) => {
                                      const current = prev[item] ?? safeIndex;
                                      return {
                                        ...prev,
                                        [item]: Math.min(
                                          current + 1,
                                          categoryUnits.length - 1,
                                        ),
                                      };
                                    });
                                  }}
                                  onDecrement={() => {
                                    setItemWeights((prev) => {
                                      const current = prev[item] ?? safeIndex;
                                      return {
                                        ...prev,
                                        [item]: Math.max(current - 1, 0),
                                      };
                                    });
                                  }}
                                  containerStyle={styles.stepperContainer}
                                />
                              </View>
                            )}
                          </View>

                          <View style={styles.dividerRowList} />
                        </View>
                      );
                    }}
                  />
                )}

                {searchText.trim().length >= KROGER_MIN_QUERY_LENGTH && (
                  <View style={styles.krogerBlock}>
                    <Text style={styles.krogerSectionLabel}>
                      {Strings.addItemToList_krogerSectionLabel}
                    </Text>

                    {!krogerLocationId ? (
                      <Text style={styles.krogerHintText}>
                        {Strings.addItemToList_krogerNoStore}
                      </Text>
                    ) : isSearchingKroger ? (
                      <View style={styles.krogerHintRow}>
                        <ActivityIndicator size="small" />
                        <Text style={styles.krogerHintText}>
                          {Strings.addItemToList_krogerSearching}
                        </Text>
                      </View>
                    ) : krogerProducts.length === 0 ? (
                      <Text style={styles.krogerHintText}>
                        {Strings.addItemToList_krogerNoResults}
                      </Text>
                    ) : (
                      <FlatList
                        data={krogerProducts}
                        keyExtractor={(item) =>
                          item.productId || item.upc || ""
                        }
                        keyboardShouldPersistTaps="handled"
                        style={styles.krogerResultsList}
                        renderItem={({ item }) => {
                          const meta = buildProductMeta(item);
                          const alreadyAdded = excludedNames.has(meta.name);

                          return (
                            <TouchableOpacity
                              style={styles.krogerResultRow}
                              disabled={alreadyAdded}
                              onPress={() => handleSelectKrogerProduct(item)}
                            >
                              {meta.imageUrl ? (
                                <Image
                                  source={{ uri: meta.imageUrl }}
                                  style={styles.krogerResultImage}
                                  resizeMode="contain"
                                />
                              ) : (
                                <View
                                  style={[
                                    styles.krogerResultImage,
                                    styles.krogerResultImagePlaceholder,
                                  ]}
                                />
                              )}

                              <View style={styles.krogerResultInfo}>
                                <Text
                                  style={[
                                    styles.krogerResultName,
                                    alreadyAdded && styles.krogerResultDisabled,
                                  ]}
                                  numberOfLines={2}
                                >
                                  {meta.name}
                                </Text>
                                {!!(meta.size || meta.price !== null) && (
                                  <Text style={styles.krogerResultMeta}>
                                    {meta.size}
                                    {meta.size && meta.price !== null
                                      ? " · "
                                      : ""}
                                    {meta.price !== null
                                      ? `$${meta.price.toFixed(2)}`
                                      : ""}
                                  </Text>
                                )}
                              </View>
                            </TouchableOpacity>
                          );
                        }}
                        ItemSeparatorComponent={() => (
                          <View style={styles.dividerRowList} />
                        )}
                      />
                    )}
                  </View>
                )}

                <FlatList
                  data={manualList}
                  extraData={manualList}
                  keyExtractor={(item) => item.id}
                  keyboardShouldPersistTaps="handled"
                  style={styles.manualListStyle}
                  showsVerticalScrollIndicator={false}
                  renderItem={({ item }) => (
                    <View style={styles.manualAddRow}>
                      <View style={styles.manualItemContainer}>
                        <Text style={styles.manualItemText}>{item.value}</Text>
                        <TouchableOpacity
                          onPress={() => {
                            setManualList((prev) =>
                              prev.filter((i) => i.id !== item.id),
                            );
                            setManualKrogerItems((prev) =>
                              prev.filter(
                                (i) => i.ingredientName !== item.value,
                              ),
                            );
                            setRemovedNames((prev) =>
                              prev.includes(item.value)
                                ? prev
                                : [...prev, item.value],
                            );
                          }}
                          style={styles.closeIconButton}
                        >
                          <Image
                            source={closeIcon}
                            style={styles.closeIconImage}
                          />
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                />
              </View>
            )}

            {from !== CREATE_MEAL_PLAN ? (
              <View style={styles.footer}>
                <ThemeNormalButton
                  title={Strings.addItemToList_cancel}
                  textColor={Colors.background}
                  containerStyle={[styles.cancelButton, { flex: 0.6 }]}
                  textStyle={styles.cancelButtonText}
                  onPress={onClose}
                />

                <ThemeGradientButton
                  title={Strings.addItemToList_generateList}
                  containerStyle={styles.confirmButton}
                  textStyle={styles.confirmButtonText}
                  onPress={handleGenerateList}
                />
              </View>
            ) : (
              <ThemeNormalButton
                title={Strings.addItemToList_cancel}
                textColor={Colors.background}
                containerStyle={styles.cancelButton}
                textStyle={styles.cancelButtonText}
                onPress={onClose}
              />
            )}
          </View>
        </KeyboardAvoidingView>
      </View>
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
    backgroundColor: Colors.white,
    borderRadius: moderateScale(18),
    paddingHorizontal: horizontalScale(18),
    paddingTop: verticalScale(5),
    paddingBottom: verticalScale(15),
    width: "92%",
    alignSelf: "center",
  },
  title: {
    fontFamily: FontFamilies.ROBOTO_SEMI_BOLD,
    fontSize: moderateScale(18),
    color: Colors.primary,
    marginTop: verticalScale(10),
    marginBottom: verticalScale(2),
  },
  subtitle: {
    fontFamily: FontFamilies.ROBOTO_REGULAR,
    fontSize: moderateScale(12),
    color: Colors.tertiary,
    marginBottom: verticalScale(16),
    marginTop: verticalScale(8),
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
  },
  searchInput: {
    flex: 1,
    fontFamily: FontFamilies.ROBOTO_REGULAR,
    fontSize: moderateScale(15),
    color: Colors.primary,
    marginLeft: horizontalScale(8),
  },
  mealCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.white,
    borderRadius: moderateScale(12),
    marginRight: horizontalScale(2),
    marginLeft: horizontalScale(1),
    elevation: 4,

    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    marginTop: verticalScale(3),
  },
  mealImage: {
    borderTopLeftRadius: moderateScale(8),
    borderBottomLeftRadius: moderateScale(8),
    marginRight: horizontalScale(12),
    width: horizontalScale(65),
    height: verticalScale(55),
  },
  mealName: {
    flex: 1,
    fontFamily: FontFamilies.ROBOTO_REGULAR,
    fontSize: moderateScale(14),
    color: Colors.primary,
  },
  checkbox: {
    width: verticalScale(24),
    height: verticalScale(24),
    borderWidth: moderateScale(2),
    borderColor: Colors.borderColor,
    borderRadius: moderateScale(6),
    backgroundColor: Colors.white,
  },
  divider: {
    marginTop: verticalScale(9),
    marginBottom: verticalScale(18),
    height: moderateScale(1),
    backgroundColor: Colors.divider,
  },
  addManualLabel: {
    fontFamily: FontFamilies.ROBOTO_REGULAR,
    fontSize: moderateScale(14),
    color: Colors.primary,
    marginBottom: verticalScale(6),
  },
  manualInput: {
    backgroundColor: Colors.white,
    borderRadius: moderateScale(8),
    borderWidth: moderateScale(1),
    borderColor: Colors.borderColor,
    fontFamily: FontFamilies.ROBOTO_REGULAR,
    fontSize: moderateScale(12),
    color: Colors.primary,
    paddingHorizontal: horizontalScale(10),
    height: verticalScale(44),
    marginBottom: verticalScale(6),
  },
  manualItemRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.white,
    borderRadius: moderateScale(8),
    borderWidth: moderateScale(1),
    borderColor: Colors.borderColor,
    paddingHorizontal: horizontalScale(10),
    height: verticalScale(40),
    marginBottom: verticalScale(6),
  },
  manualAddRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: verticalScale(16),
    marginHorizontal: horizontalScale(2),
    marginTop: verticalScale(4),
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: verticalScale(10),
  },
  cancelButton: {
    backgroundColor: Colors.white,
    borderRadius: moderateScale(8),
    borderWidth: moderateScale(1),
    borderColor: Colors.borderColor,
    justifyContent: "center",
    alignItems: "center",
  },

  cancelButtonText: {
    fontFamily: FontFamilies.ROBOTO_MEDIUM,
    fontSize: moderateScale(14),
    color: Colors.primary,
  },
  generateButton: {
    backgroundColor: Colors._7B8756,
    borderRadius: moderateScale(8),
    flex: 1,
    marginLeft: horizontalScale(8),
    height: verticalScale(44),
    justifyContent: "center",
    alignItems: "center",
  },
  generateButtonText: {
    fontFamily: FontFamilies.ROBOTO_MEDIUM,
    fontSize: moderateScale(16),
    color: Colors.white,
  },
  checkboxIcon: {
    marginRight: horizontalScale(10),
  },
  dividerRow: {
    height: moderateScale(1),
    backgroundColor: Colors.divider,

    marginVertical: verticalScale(15),
  },
  confirmButton: {
    borderRadius: moderateScale(8),
    alignItems: "center",
    fontFamily: FontFamilies.ROBOTO_MEDIUM,
    color: Colors.white,
    flex: 1,
    fontSize: moderateScale(14),
  },
  confirmButtonText: {
    fontFamily: FontFamilies.ROBOTO_MEDIUM,
    color: Colors.white,
    fontSize: moderateScale(14),
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: verticalScale(18),
    gap: moderateScale(10),
  },
  rowItem: {
    minWidth: 100,
    alignSelf: "center",
    marginBottom: verticalScale(-8),
  },
  label: {
    fontSize: moderateScale(12),
    marginTop: moderateScale(8),
    marginBottom: moderateScale(4),
    fontFamily: FontFamilies.ROBOTO_REGULAR,
    color: Colors.primary,
  },
  suggestionButton: {
    backgroundColor: "red",
  },
  dividerRowList: {
    height: moderateScale(1),
    backgroundColor: Colors.divider,
    flex: 1,

    marginVertical: verticalScale(8),
  },
  mealsListContent: {
    paddingBottom: verticalScale(12),
  },
  mealSeparator: {
    height: verticalScale(10),
  },
  mealsListStyle: {
    marginTop: verticalScale(10),
    maxHeight: verticalScale(200),
  },
  suggestionsListStyle: {
    maxHeight: 200,
  },
  suggestionItemContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.white,
    paddingHorizontal: horizontalScale(12),
    justifyContent: "space-between",
  },
  suggestionTouchable: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flex: 1,
    // Same reason as manualItemText — let long ingredient names wrap rather
    // than clipping them to one line.
    minHeight: verticalScale(40),
    paddingVertical: verticalScale(6),
  },
  suggestionText: {
    fontFamily: FontFamilies.ROBOTO_REGULAR,
    fontSize: moderateScale(12),
    color: Colors.tertiary,
  },
  stepperContainer: {
    backgroundColor: Colors.white,
    borderRadius: moderateScale(8),
    elevation: 4,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  manualListStyle: {
    maxHeight: verticalScale(250),
  },
  krogerBlock: {
    marginTop: verticalScale(4),
    marginBottom: verticalScale(4),
  },
  krogerSectionLabel: {
    fontFamily: FontFamilies.ROBOTO_MEDIUM,
    fontSize: moderateScale(12),
    color: Colors.primary,
    marginBottom: verticalScale(4),
  },
  krogerHintRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: horizontalScale(8),
  },
  krogerHintText: {
    fontFamily: FontFamilies.ROBOTO_REGULAR,
    fontSize: moderateScale(11),
    color: Colors.tertiary,
    paddingVertical: verticalScale(6),
    flexShrink: 1,
  },
  krogerResultsList: {
    maxHeight: verticalScale(170),
  },
  krogerResultRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: verticalScale(6),
  },
  krogerResultImage: {
    width: horizontalScale(36),
    height: verticalScale(36),
    marginRight: horizontalScale(10),
  },
  krogerResultImagePlaceholder: {
    backgroundColor: Colors.greysoft,
    borderRadius: moderateScale(6),
  },
  krogerResultInfo: {
    flex: 1,
  },
  krogerResultName: {
    fontFamily: FontFamilies.ROBOTO_REGULAR,
    fontSize: moderateScale(12),
    color: Colors.primary,
  },
  krogerResultDisabled: {
    color: Colors.tertiary,
  },
  krogerResultMeta: {
    fontFamily: FontFamilies.ROBOTO_REGULAR,
    fontSize: moderateScale(11),
    color: Colors.tertiary,
    marginTop: verticalScale(2),
  },
  manualItemContainer: {
    flex: 1,
    position: "relative",
    justifyContent: "center",
  },
  manualItemText: {
    backgroundColor: Colors.white,
    borderRadius: moderateScale(8),
    fontFamily: FontFamilies.ROBOTO_REGULAR,
    fontSize: moderateScale(12),
    color: Colors.tertiary,
    paddingHorizontal: horizontalScale(10),
    paddingVertical: verticalScale(11),
    // minHeight, not height: ingredient names are user/Kroger supplied and wrap
    // onto a second line ("Laura's Lean Beef® 92% Lean All Natural Ground
    // Beef"). A fixed height clipped them instead of letting the row grow.
    minHeight: verticalScale(40),
    marginRight: 0,
    paddingRight: 36,
    elevation: 4,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  closeIconButton: {
    position: "absolute",
    right: 10,
    top: 0,
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  closeIconImage: {
    width: 22,
    height: 22,
  },
  loader: {
    marginVertical: verticalScale(20),
  },
});

export default AddItemToList;
