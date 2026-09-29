import { closeIcon, deleteicon, iconMeal } from "@/assets/images";
import { IconPlus } from "@/assets/svg";
import { IconDown } from "@/assets/svg/IconUpDown";
import AddKrogerIngredient, {
  IngredientSelection,
  KrogerProductMeta,
} from "@/components/AddKrogerIngredient";
import { APP_ROUTES } from "@/constants/AppRoutes";
import {
  horizontalScale,
  moderateScale,
  verticalScale,
} from "@/constants/Constants";
import { Strings } from "@/constants/Strings";
import { Colors, FontFamilies } from "@/constants/Theme";
import {
  CATEGORY_KEY,
  DESCRIPTION_KEY,
  DIFFICULTY_KEY,
  IMAGEURL_KEY,
  INGREDIENTS_KEY,
  NAME_KEY,
  PREPTIME_KEY,
  SERVINGS_KEY,
  STEPS_KEY,
} from "@/reduxStore/appKeys";
import { GLOBAL_MEALS_UID } from "@/reduxStore/appKeys";
import { useAppSelector } from "@/reduxStore/hooks";
import { fontSize } from "@/utils/Fonts";
// import { getUnitOptions } from "@/utils/unitOptions";
import { generateFirebaseId } from "@/services/firestore";
import {
  fetchKrogerProductById,
  getKrogerConnectionStatus,
} from "@/services/krogerApi";
import { pushNavigation } from "@/utils/Navigation";
import { buildNameSearchTokens } from "@/utils/searchTokens";
import { showToast } from "@/utils/Toast";
import { createMealValidationSchema } from "@/utils/validators/MealValidators";
import { useCreateMealViewModel } from "@/viewmodels/CreateMealViewModel";
import { useProfileViewModel } from "@/viewmodels/ProfileViewModel";
import { Formik } from "formik";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Dimensions,
  FlatList,
  Image,
  Keyboard,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import CustomDropdown from "./CustomDropdown";
import CustomStepper from "./CustomStepper";
import CustomTextInput from "./CustomTextInput";
import ImagePickerModal from "./ImagePickerModal";
import { KeyboardAwareScrollView } from "./KeyboardAwareScrollView";
import { hideLoader, showLoader } from "./Loader";
import SpaceBetweenButtons from "./SpaceBetweenButtons";
import ThemeGradientButton from "./ThemeGradientButton";
import ThemeNormalButton from "./ThemeNormalButton";

// prepTime is stored as a display string ("30 Mins"); the numeric field edits
// just the number and writes the same shape back.
const parsePrepMinutes = (prepTime?: string) => {
  const minutes = parseInt(String(prepTime || "").match(/\d+/)?.[0] || "", 10);
  return Number.isNaN(minutes) ? 5 : minutes;
};

type IngredientCategory = {
  id: string;
  title: string;
  unit: string[];
};

type MealIngredientForm = {
  ingredientId?: string;
  ingredientName: string;
  count?: string;
  unit: string;
  category?: string | IngredientCategory;
  categoryId?: string;
  categoryName?: string;
  categoryUnits?: string[];
  allowCountSelection?: boolean;
  krogerMeta?: KrogerProductMeta | null;
  isKroger?: boolean;
  krogerIngredientId?: string;
  // The ingredient's original Kroger category/unit, kept so they remain
  // selectable after switching categories — including in edit mode, where
  // krogerMeta is not available.
  krogerCategoryName?: string;
  krogerUnit?: string;
};

type MealStepForm = {
  text: string;
};

type MealFormValues = {
  id?: string;
  name: string;
  description: string;
  imageUrl: string;
  prepTime: string;
  servings: string;
  difficulty: string;
  category: string;
  ingredients: MealIngredientForm[];
  steps: MealStepForm[];
};

interface CreateMealBottomSheetProps {
  isEdit?: boolean;
  isGlobal?: boolean;
  // Copy mode: the sheet is pre-filled from an existing (global) meal, the user
  // may edit any detail, and saving creates a brand-new meal owned by the user.
  // The source meal is left untouched.
  isCopy?: boolean;
  mealData?: any;
  onClose?: () => void;
}
const CreateMealBottomSheet = ({
  isEdit = false,
  isGlobal = false,
  isCopy = false,
  mealData,
  onClose,
}: CreateMealBottomSheetProps) => {
  // Copy prefills from mealData exactly like edit; the difference is only in
  // what happens on submit (create-new vs update) and the labels.
  const prefillFromMeal = (isEdit || isCopy) && mealData;
  const user = useAppSelector((state) => state.auth.user);
  const { ingredientCategories, loading, error, addMealData, updateMealData } =
    useCreateMealViewModel();
  const { mealPlans, fetchMealPlans } = useProfileViewModel();

  useEffect(() => {
    fetchMealPlans();
  }, []);

  const mealPlanNames = useMemo(() => {
    const sorted = [...mealPlans].sort((a, b) => {
      const aTime = a.createdAt?.seconds || 0;
      const bTime = b.createdAt?.seconds || 0;
      return aTime - bTime;
    });
    return sorted.length > 0
      ? sorted.map((plan) => plan.name)
      : [Strings.plans_breakfast, Strings.plans_lunch, Strings.plans_dinner];
  }, [mealPlans]);

  const snapPoints = useMemo(() => ["100%"], []);
  const { width } = Dimensions.get("window");

  const [showImagePickerModal, setShowImagePickerModal] = useState(false);
  const [showKrogerIngredientModal, setShowKrogerIngredientModal] =
    useState(false);
  const [krogerStatus, setKrogerStatus] = useState<any>(null);
  const [isPreparingKroger, setIsPreparingKroger] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const scrollViewRef = useRef<ScrollView | null>(null);
  const scrollOffsetRef = useRef(0);
  const resetFormRef = useRef<(() => void) | null>(null);
  const [krogerRefreshedMap, setKrogerRefreshedMap] = useState<
    Record<string, any>
  >({});

  const closeSheet = () => {
    Keyboard.dismiss();
    resetFormRef.current?.();
    onClose?.();
  };

  useEffect(() => {
    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const scrollFocusedInputIntoView = (height: number) => {
      const focusedInput = (TextInput.State as any)?.currentlyFocusedInput?.();

      if (!focusedInput || !scrollViewRef.current) {
        return;
      }

      setTimeout(() => {
        focusedInput.measureInWindow(
          (x: number, y: number, inputWidth: number, inputHeight: number) => {
            const visibleBottom =
              Dimensions.get("window").height - height - verticalScale(20);
            const focusedBottom = y + inputHeight;
            const overlap = focusedBottom - visibleBottom;

            if (overlap > 0) {
              const nextOffset = Math.max(
                0,
                scrollOffsetRef.current + overlap + verticalScale(12),
              );
              scrollViewRef.current?.scrollTo({
                y: nextOffset,
                animated: true,
              });
            }
          },
        );
      }, 60);
    };

    const showSub = Keyboard.addListener(showEvent, (event) => {
      const height = event.endCoordinates?.height || 0;
      setKeyboardHeight(height);
      scrollFocusedInputIntoView(height);
    });

    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const initialValues = useMemo<MealFormValues>(() => {
    if (prefillFromMeal) {
      return {
        id: mealData.id || "",
        name: mealData.name || "",
        description: mealData.description || "",
        imageUrl: mealData.imageUrl || "",
        prepTime: mealData.prepTime || Strings._5_mins,
        servings: String(mealData.servings || "1"),
        difficulty: mealData.difficulty || Strings.filterModal_easy,
        category: mealData.category || Strings.plans_breakfast,
        ingredients: (mealData.ingredients || []).map((ing: any) => {
          if (ing.isKroger || ing.krogerIngredientId) {
            const refreshed = ing.krogerIngredientId
              ? krogerRefreshedMap[ing.krogerIngredientId]
              : null;

            return {
              ...ing,
              ingredientName:
                refreshed?.name || ing.ingredientName || ing.name || "",
              categoryName: ing.categoryName || ing.category || "",
              categoryUnits: ing.categoryUnits || [ing.unit].filter(Boolean),
              isKroger: true,
              krogerIngredientId: ing.krogerIngredientId || "",
              krogerCategoryName:
                ing.krogerCategoryName || ing.categoryName || ing.category || "",
              // Product size or empty — never the recipe unit (see
              // krogerCartQuantity for why the two must stay distinct).
              krogerUnit: ing.krogerUnit || "",
            };
          }

          return {
            ...ing,
            ingredientName: ing.ingredientName || ing.name || "",
          };
        }) as MealIngredientForm[],
        steps: mealData.steps?.map((text: string) => ({ text })) || [
          { text: "" },
        ],
      };
    }

    return {
      name: "",
      description: "",
      imageUrl: "",
      prepTime: Strings._5_mins,
      servings: "1",
      difficulty: Strings.filterModal_easy,
      category: Strings.plans_breakfast,
      ingredients: [],
      steps: [{ text: "" }],
    };
  }, [isEdit, isCopy, mealData, krogerRefreshedMap]);

  // Fetch fresh Kroger product data for Kroger ingredients in edit/copy mode
  useEffect(() => {
    if ((!isEdit && !isCopy) || !mealData?.ingredients) return;

    const krogerIngredients = (mealData.ingredients || []).filter(
      (ing: any) => ing.isKroger && ing.krogerIngredientId,
    );
    if (krogerIngredients.length === 0) return;

    // Need kroger status to get locationId
    (async () => {
      try {
        const status = await getKrogerConnectionStatus();
        setKrogerStatus(status);

        const locationId = status?.selectedStore?.locationId;
        if (!locationId || !status?.connected) return;

        const refreshed: Record<string, any> = {};

        await Promise.all(
          krogerIngredients.map(async (ing: any) => {
            try {
              const response = (await fetchKrogerProductById(
                ing.krogerIngredientId,
                locationId,
              )) as { data?: any[] };

              const product = response?.data?.[0];
              if (product) {
                const item = product.items?.[0];
                const size = item?.size || "";
                const price =
                  item?.price?.regular ?? item?.price?.promo ?? null;
                refreshed[ing.krogerIngredientId] = {
                  name: product.description || ing.ingredientName,
                  unit: size || ing.unit,
                  stockLevel: item?.inventory?.stockLevel || "",
                  price,
                };
              }
            } catch {
              // Fallback — keep saved text values
            }
          }),
        );

        if (Object.keys(refreshed).length > 0) {
          setKrogerRefreshedMap(refreshed);
        }
      } catch {
        // Silently fail — saved text values will be used
      }
    })();
  }, [isEdit, isCopy, mealData]);

  const normalizeValue = (value = "") =>
    String(value)
      .toLowerCase()
      .replace(/[^a-z0-9]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  const findMatchingCategory = (meta: KrogerProductMeta | null) => {
    if (!meta || ingredientCategories.length === 0) {
      return ingredientCategories[0] ?? null;
    }

    const krogerCategories = [meta.category, meta.secondaryCategory].filter(
      Boolean,
    );

    for (const krogerCategory of krogerCategories) {
      const normalizedKrogerCategory = normalizeValue(krogerCategory);

      const exactMatch = ingredientCategories.find(
        (category) =>
          normalizeValue(category.title) === normalizedKrogerCategory,
      );
      if (exactMatch) return exactMatch;

      const partialMatch = ingredientCategories.find((category) => {
        const normalizedTitle = normalizeValue(category.title);
        return (
          normalizedTitle.includes(normalizedKrogerCategory) ||
          normalizedKrogerCategory.includes(normalizedTitle)
        );
      });

      if (partialMatch) return partialMatch;
    }

    return ingredientCategories[0] ?? null;
  };

  const mergeUnitOptions = (baseOptions: string[] = [], parsedUnit = "") => {
    const cleanedBaseOptions = Array.isArray(baseOptions)
      ? baseOptions.filter(Boolean)
      : [];

    if (!parsedUnit) {
      return cleanedBaseOptions;
    }

    const hasParsedUnit = cleanedBaseOptions.some(
      (option) => normalizeValue(option) === normalizeValue(parsedUnit),
    );

    if (hasParsedUnit) {
      return cleanedBaseOptions;
    }

    return [parsedUnit, ...cleanedBaseOptions];
  };

  const findPreferredUnit = (unitOptions: string[] = [], parsedUnit = "") => {
    if (!unitOptions.length) {
      return parsedUnit || "";
    }

    if (!parsedUnit) {
      return unitOptions[0];
    }

    const exactMatch = unitOptions.find(
      (option) => normalizeValue(option) === normalizeValue(parsedUnit),
    );

    if (exactMatch) {
      return exactMatch;
    }

    const partialMatch = unitOptions.find((option) => {
      const normalizedOption = normalizeValue(option);
      const normalizedParsedUnit = normalizeValue(parsedUnit);

      return (
        normalizedOption.includes(normalizedParsedUnit) ||
        normalizedParsedUnit.includes(normalizedOption)
      );
    });

    if (partialMatch) {
      return partialMatch;
    }

    return parsedUnit;
  };

  const loadKrogerStatus = async () => {
    const status = await getKrogerConnectionStatus();
    setKrogerStatus(status);
    return status;
  };

  const buildDefaultIngredient = (ingredientName = "") => {
    const firstCategory =
      ingredientCategories.length > 0 ? ingredientCategories[0] : null;
    // A manually typed ingredient is just a name, so it isn't tied to a
    // specific type. Offer the global unit + count list instead of forcing the
    // first category's units.
    const unitOptions = Strings.globalUnitOptions;

    return {
      ingredientId: generateFirebaseId(),
      ingredientName,
      count: Strings.defaultCount,
      unit: unitOptions[0] ?? "",
      categoryId: firstCategory?.id ?? "",
      categoryName: firstCategory?.title ?? "",
      categoryUnits: unitOptions,
      allowCountSelection: true,
    };
  };

  const handleOpenKrogerPicker = async () => {
    try {
      setIsPreparingKroger(true);
      const status = await loadKrogerStatus();

      // if (!status?.connected) {
      //   showToast(
      //     "info",
      //     Strings.profile_krogerConnectAccount,
      //     Strings.profile_krogerDisconnectedSubtitle,
      //   );
      //   pushNavigation(APP_ROUTES.KROGER_SIGNUP, { source: "profile" });
      //   return;
      // }

      // if (!status?.selectedStore) {
      //   showToast(
      //     "info",
      //     Strings.profile_krogerSelectStore,
      //     Strings.profile_krogerNoStore,
      //   );
      //   pushNavigation(APP_ROUTES.KROGER_SIGNUP, { source: "profile" });
      //   return;
      // }

      setShowKrogerIngredientModal(true);
    } catch (error: any) {
      showToast(
        "error",
        "Unable to open Kroger ingredients.",
        error?.message || "Please try again.",
      );
    } finally {
      setIsPreparingKroger(false);
    }
  };

  const renderIngredientItem =
    (
      ingredients: MealIngredientForm[],
      setFieldValue: (field: string, value: any) => void,
      errors: any,
      touched: any,
      setTouched: (touched: any) => void,
    ) =>
    ({ item, index }: { item: MealIngredientForm; index: number }) => {
      // The count field is always shown for every ingredient.
      const shouldShowCount = true;

      // A Kroger ingredient carries its own category/unit. Read them from the
      // stable krogerCategoryName/krogerUnit fields (populated in both add and
      // edit mode), falling back to krogerMeta for freshly-added items, so they
      // stay selectable even after switching to a different category/unit.
      const krogerCategoryName = item?.isKroger
        ? item?.krogerCategoryName ||
          item?.krogerMeta?.displayCategory ||
          item?.krogerMeta?.category ||
          ""
        : "";
      const krogerUnit = item?.isKroger
        ? item?.krogerUnit ||
          item?.krogerMeta?.size ||
          item?.krogerMeta?.parsedUnit ||
          ""
        : "";

      // Units are ALWAYS the global list — the selected category never changes
      // them. A Kroger ingredient additionally keeps its own parsed unit
      // (prepended just below) for as long as the meal exists.
      const baseUnitOptions = Strings.globalUnitOptions;

      // Always keep the ingredient's Kroger unit in the list.
      const unitOptions =
        krogerUnit &&
        !baseUnitOptions.some(
          (unit) => normalizeValue(unit) === normalizeValue(krogerUnit),
        )
          ? [krogerUnit, ...baseUnitOptions]
          : baseUnitOptions;

      // Resolve category display name for non-Kroger ingredients
      const resolvedCategoryName =
        item?.categoryName ||
        ingredientCategories.find(
          (cat) => cat.id === item?.categoryId || cat.id === item?.category,
        )?.title ||
        item?.category ||
        "";

      const categoryInList = ingredientCategories.some(
        (cat) => cat.title === resolvedCategoryName,
      );

      const extraCategoryOptions: any[] = [];

      // Keep the currently-selected category visible if it isn't a standard one.
      if (resolvedCategoryName && !categoryInList) {
        extraCategoryOptions.push({
          id: `custom:${item?.categoryId || resolvedCategoryName}`,
          title: resolvedCategoryName,
          unit: unitOptions,
        });
      }

      // Keep the ingredient's original Kroger category permanently available,
      // even after switching to a different category.
      if (
        krogerCategoryName &&
        krogerCategoryName !== resolvedCategoryName &&
        !ingredientCategories.some((cat) => cat.title === krogerCategoryName)
      ) {
        extraCategoryOptions.push({
          id: `kroger:${krogerCategoryName}`,
          title: krogerCategoryName,
          unit: [krogerUnit].filter(Boolean),
        });
      }

      const categoryOptions = [
        ...extraCategoryOptions,
        ...ingredientCategories,
      ];

      return (
        <View>
          <Text style={styles.label}>{Strings.createMeal_ingredientName}</Text>
          <CustomTextInput
            placeholder={Strings.createMeal_ingredientName_placeholder}
            value={item.ingredientName}
            onChangeText={(text) => {
              const updated = [...ingredients];
              updated[index] = { ...updated[index], ingredientName: text };
              setFieldValue(INGREDIENTS_KEY, updated);
              if (
                touched.ingredients?.[index]?.ingredientName &&
                errors.ingredients?.[index]?.ingredientName
              ) {
                const updatedTouched = { ...touched };
                if (Array.isArray(updatedTouched.ingredients)) {
                  updatedTouched.ingredients[index] = {
                    ...updatedTouched.ingredients[index],
                    ingredientName: false,
                  };
                  setTouched(updatedTouched);
                }
              }
            }}
            error={
              touched.ingredients?.[index]?.ingredientName &&
              errors.ingredients?.[index]?.ingredientName
            }
          />
          <View style={styles.row}>
            {shouldShowCount && (
              <View style={styles.rowItem}>
                <Text
                  style={[
                    styles.label,
                    !shouldShowCount && { color: Colors.tertiary },
                  ]}
                >
                  {Strings.createMeal_count}
                </Text>

                <CustomStepper
                  value={(item?.count || "0") as any}
                  editable
                  min={0}
                  max={999}
                  accessibilityLabel={Strings.createMeal_count}
                  onChangeValue={(next) => {
                    const updated = [...ingredients];
                    updated[index] = {
                      ...updated[index],
                      count: String(next),
                    };
                    setFieldValue(INGREDIENTS_KEY, updated);
                  }}
                />
              </View>
            )}

            <View style={styles.rowItem}>
              <Text style={styles.label}>{Strings.createMeal_unit}</Text>

              <CustomStepper
                value={item?.unit as any}
                onIncrement={() => {
                  const unitWeightIndex = unitOptions.indexOf(item?.unit);
                  if (unitWeightIndex < unitOptions.length - 1) {
                    const updated = [...ingredients];
                    const newUnit = unitOptions[unitWeightIndex + 1];
                    updated[index] = {
                      ...updated[index],
                      unit: newUnit,
                    };
                    setFieldValue(INGREDIENTS_KEY, updated);
                  }
                }}
                onDecrement={() => {
                  const unitWeightIndex = unitOptions.indexOf(item?.unit);
                  if (unitWeightIndex > 0) {
                    const updated = [...ingredients];
                    const newUnit = unitOptions[unitWeightIndex - 1];
                    updated[index] = {
                      ...updated[index],
                      unit: newUnit,
                    };
                    setFieldValue(INGREDIENTS_KEY, updated);
                  }
                }}
              />
            </View>

            <View style={styles.rowItem}>
              <Text style={styles.label}>{Strings.createMeal_category}</Text>

              <CustomDropdown
                value={resolvedCategoryName as any}
                options={categoryOptions as any}
                onSelect={(category: any) => {
                  const updated = [...ingredients];
                  // Category is classification only — it must not change the
                  // unit or the available (global) unit options.
                  updated[index] = {
                    ...updated[index],
                    categoryId: category.id,
                    categoryName: category.title,
                  };
                  setFieldValue(INGREDIENTS_KEY, updated);
                }}
                icon={IconDown}
              />
            </View>

            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => {
                const updated = ingredients.filter(
                  (_: any, i: number) => i !== index,
                );
                setFieldValue(INGREDIENTS_KEY, updated);
              }}
            >
              <Image
                source={deleteicon}
                style={{
                  width: verticalScale(24),
                  height: verticalScale(24),
                }}
                resizeMode="contain"
              />
            </TouchableOpacity>
          </View>
        </View>
      );
    };

  const handleUpload = (setFieldValue: (field: string, value: any) => void) => {
    setShowImagePickerModal(true);
  };

  const renderInstructionItem =
    (
      steps: MealStepForm[],
      setFieldValue: (field: string, value: any) => void,
    ) =>
    ({ item, index }: { item: MealStepForm; index: number }) => (
      <View style={{ marginBottom: verticalScale(15) }}>
        <View style={[styles.row, { alignItems: "flex-start" }]}>
          <Text
            style={[
              styles.sectionTitle,
              {
                marginTop: verticalScale(5),
                marginRight: horizontalScale(8),
              },
            ]}
          >
            {index + 1}.
          </Text>

          <View style={{ flex: 1 }}>
            <CustomTextInput
              style={{
                height: verticalScale(60),
                borderRadius: moderateScale(4),
                backgroundColor: Colors.greysoft,
                paddingHorizontal: horizontalScale(10),
                paddingTop: moderateScale(10),
                textAlignVertical: "top",
              }}
              placeholder={Strings.createMeal_mealDescription_placeholder}
              multiline
              value={item?.text}
              onChangeText={(text) => {
                const updated = [...steps];
                updated[index] = { ...updated[index], text };
                setFieldValue(STEPS_KEY, updated);
              }}
            />
          </View>

          {isEdit || isCopy ? (
            <TouchableOpacity
              onPress={() => {
                const updated = steps.filter(
                  (_: any, i: number) => i !== index,
                );
                setFieldValue(STEPS_KEY, updated);
              }}
              style={{
                marginTop: verticalScale(5),
                marginLeft: horizontalScale(8),
              }}
            >
              <Image
                source={closeIcon}
                style={{
                  width: verticalScale(22),
                  height: verticalScale(22),
                }}
                resizeMode="contain"
              />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    );

  // Add this helper function before handleCreateMeal
  const prepareMealData = (values: MealFormValues, isEditMode = false) => {
    // Map ingredients - include all data needed for subcollection
    const mappedIngredients = values.ingredients.map(
      (ing: MealIngredientForm) => {
        // Parse count - it's always a string from the stepper
        const countValue = parseInt(ing.count || "0", 10);
        if (ing.krogerMeta || ing.isKroger || ing.krogerIngredientId) {
          // Kroger ingredient: save everything as text
          const krogerCategoryName =
            ing.krogerCategoryName ||
            ing.categoryName ||
            (typeof ing.category === "string" ? ing.category : "") ||
            ing.krogerMeta?.displayCategory ||
            "";
          const ingredient: any = {
            ingredientId: ing.ingredientId || generateFirebaseId(),
            name: ing.ingredientName,
            ingredientName: ing.ingredientName,
            isKroger: true,
            krogerIngredientId:
              ing.krogerIngredientId || ing.krogerMeta?.productId || "",
            count: countValue > 0 ? countValue.toString() : "0",
            unit: ing.unit,
            category:
              ing.categoryName ||
              (typeof ing.category === "string" ? ing.category : "") ||
              ing.krogerMeta?.displayCategory ||
              "",
            // Persist the original Kroger category/unit so they remain
            // selectable when the meal is edited later.
            krogerCategoryName,
            krogerUnit: ing.krogerUnit || ing.krogerMeta?.size || "",
          };
          return ingredient;
        }

        // Non-Kroger: save category as document ID (default)
        const categoryId =
          ing.categoryId ||
          (typeof ing.category === "object" && ing.category?.id
            ? ing.category.id
            : ing.category);

        const ingredient: any = {
          ingredientId: ing.ingredientId || generateFirebaseId(),
          name: ing.ingredientName,
          ingredientName: ing.ingredientName,
          unit: ing.unit,
          category: categoryId,
          categoryId: categoryId,
        };

        if (countValue > 0) {
          ingredient.count = countValue.toString();
        }

        return ingredient;
      },
    );

    // Filter out any ingredients with undefined category before sending
    const validIngredients = mappedIngredients.filter(
      (ing: any) =>
        ing.category !== undefined &&
        ing.category !== null &&
        ing.category !== "",
    );

    // Filter and map steps - only include non-empty steps
    const mappedSteps = values.steps
      .map((step: MealStepForm) => step.text?.trim())
      .filter((text: string | undefined) => text && text.length > 0);

    // A global meal is a shared/official meal, not owned by any single user.
    // We tag it with the sentinel GLOBAL_MEALS_UID + isGlobal so it (a) never
    // appears in anyone's "My Meals" (uid == user) and (b) surfaces in Browse
    // Meals for everyone. Any user can then reference it by id from their own
    // plans / shopping lists. For a normal meal, uid is the real owner; on edit
    // we preserve whatever the meal already was (mealData is the prop here).
    const editingGlobal = isEditMode && Boolean(mealData?.isGlobal);
    const treatAsGlobal = isGlobal || editingGlobal;
    const mealUid = treatAsGlobal
      ? GLOBAL_MEALS_UID
      : isEditMode
        ? mealData?.uid || user?.id
        : user?.id;

    // Build meal data
    const mealPayload: any = {
      name: values.name.trim(),
      description: values.description,
      imageUrl: values.imageUrl,
      prepTime: values.prepTime,
      servings: values.servings,
      difficulty: values.difficulty,
      category: values.category,
      ingredients: validIngredients,
      uid: mealUid,
      isGlobal: treatAsGlobal,
    };

    // Add id for edit mode
    if (isEditMode) {
      mealPayload.id = values.id;
    }

    // The search index. Written on edit too, otherwise a renamed meal stays
    // searchable only under its old name.
    mealPayload.nameCharacters = buildNameSearchTokens(values.name);

    // Only add steps if there are valid steps
    if (mappedSteps.length > 0) {
      mealPayload.steps = mappedSteps;
    }

    return { mealData: mealPayload, validIngredients, mappedIngredients };
  };

  const handleCreateMeal = async (values: MealFormValues) => {
    try {
      const { mealData, validIngredients, mappedIngredients } = prepareMealData(
        values,
        false,
      );

      if (validIngredients.length !== mappedIngredients.length) {
        alert("Please select a category for all ingredients");
        return;
      }

      showLoader();
      addMealData(
        mealData,
        () => {
          hideLoader();
          alert(Strings.mealAdded);
          closeSheet();
        },
        (error) => {
          hideLoader();
          alert(Strings.error_creating_meal + error);
        },
      );
    } catch (error) {
      alert(Strings.error_creating_meal + error);
    }
  };

  // Copy = create a brand-new meal from the (possibly edited) prefilled values.
  // prepareMealData(values, false) runs the create path, so uid becomes the
  // current user and isGlobal is false — the source global meal is untouched.
  const handleCopyMeal = async (values: MealFormValues) => {
    try {
      const { mealData, validIngredients, mappedIngredients } = prepareMealData(
        values,
        false,
      );

      if (validIngredients.length !== mappedIngredients.length) {
        alert("Please select a category for all ingredients");
        return;
      }

      showLoader();
      addMealData(
        mealData,
        () => {
          hideLoader();
          alert(Strings.meal_copied);
          closeSheet();
        },
        (error) => {
          hideLoader();
          alert(Strings.error_copying_meal + error);
        },
      );
    } catch (error) {
      alert(Strings.error_copying_meal + error);
    }
  };

  const handleEditMeal = async (values: MealFormValues) => {
    try {
      const { mealData, validIngredients, mappedIngredients } = prepareMealData(
        values,
        true,
      );

      if (validIngredients.length !== mappedIngredients.length) {
        alert("Please select a category for all ingredients");
        return;
      }

      showLoader();
      updateMealData(
        {
          mealData: mealData,
          updateWithIngredients: true,
        },
        () => {
          hideLoader();
          alert(Strings.mealUpdated);
          closeSheet();
        },
        (error) => {
          hideLoader();
          alert(Strings.error_updating_meal + error);
        },
      );
    } catch (error) {
      alert(Strings.error_updating_meal + error);
    }
  };

  return (
    <Formik
      key={prefillFromMeal ? JSON.stringify(mealData) : "create"}
      enableReinitialize={true}
      initialValues={initialValues}
      validationSchema={createMealValidationSchema}
      onSubmit={
        isEdit ? handleEditMeal : isCopy ? handleCopyMeal : handleCreateMeal
      }
      validateOnChange={true}
      validateOnBlur={true}
    >
      {({
        values,
        setFieldValue,
        handleSubmit,
        errors,
        touched,
        setTouched,
        validateForm,
        resetForm,
      }) => {
        resetFormRef.current = resetForm;

        return (
          <>
            <View style={styles.modalContainer}>
              <View style={styles.modalContent}>
                <View style={styles.parentCreateMealText}>
                  <Text style={styles.header}>
                    {isEdit
                      ? Strings.createMeal_editMeal
                      : isCopy
                        ? Strings.createMeal_copyMealTitle
                        : isGlobal
                          ? Strings.createMeal_addGlobalMeal
                          : Strings.createMeal_createMeal}
                  </Text>
                  <TouchableOpacity onPress={closeSheet}>
                    <Image
                      source={closeIcon}
                      style={{
                        width: verticalScale(24),
                        height: verticalScale(24),
                      }}
                      resizeMode="contain"
                    />
                  </TouchableOpacity>
                </View>
                <KeyboardAwareScrollView
                  contentContainerStyle={{
                    paddingTop: moderateScale(10),
                    paddingHorizontal: moderateScale(20),
                    paddingBottom: verticalScale(30) + keyboardHeight,
                  }}
                >
                  <View style={styles.card}>
                    <Text style={styles.sectionTitle}>
                      {Strings.createMeal_basicInfo}
                    </Text>
                    <Text style={styles.label}>
                      {Strings.createMeal_mealName}
                    </Text>
                    <CustomTextInput
                      placeholder={Strings.createMeal_mealName_placeholder}
                      value={values.name}
                      onChangeText={(text) => {
                        setFieldValue(NAME_KEY, text);
                        if (touched.name && errors.name) {
                          setTouched({ ...touched, name: false });
                        }
                      }}
                      error={
                        touched.name && typeof errors.name === "string"
                          ? errors.name
                          : undefined
                      }
                    />

                    <Text style={styles.label}>
                      {Strings.createMeal_mealDescription}
                    </Text>
                    <CustomTextInput
                      style={{
                        height: verticalScale(80),
                        borderRadius: moderateScale(4),
                        backgroundColor: Colors.greysoft,
                        paddingHorizontal: horizontalScale(10),
                        marginBottom: moderateScale(8),
                      }}
                      placeholder={
                        Strings.createMeal_mealDescription_placeholder
                      }
                      multiline={true}
                      value={values.description}
                      numberOfLines={4}
                      onChangeText={(text) => {
                        setFieldValue(DESCRIPTION_KEY, text);
                        if (touched.description && errors.description) {
                          setTouched({ ...touched, description: false });
                        }
                      }}
                      error={
                        touched.description &&
                        typeof errors.description === "string"
                          ? errors.description
                          : undefined
                      }
                    />

                    <Text style={styles.label}>
                      {Strings.createMeal_imageUrl}
                    </Text>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "flex-start",
                        gap: moderateScale(8),
                      }}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: moderateScale(8),
                        }}
                      >
                        <View style={{ flex: 1 }}>
                          <CustomTextInput
                            style={{ marginBottom: 0 }}
                            placeholder={
                              Strings.createMeal_imageUrl_placeholder
                            }
                            value={values.imageUrl}
                            onChangeText={(text) =>
                              setFieldValue(IMAGEURL_KEY, text)
                            }
                          />
                        </View>
                        <TouchableOpacity
                          style={styles.uploadButton}
                          onPress={() => handleUpload(setFieldValue)}
                        >
                          <Text style={styles.uploadButtonText}>
                            {isEdit
                              ? Strings.createMeal_remove
                              : Strings.createMeal_upload}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    <View style={styles.row}>
                      <View style={styles.rowItem}>
                        <Text style={styles.label}>
                          {Strings.createMeal_prepTime}
                        </Text>

                        <CustomStepper
                          value={parsePrepMinutes(values.prepTime)}
                          editable
                          min={1}
                          max={480}
                          step={5}
                          suffix={Strings.createMeal_minsSuffix}
                          accessibilityLabel={Strings.createMeal_prepTime}
                          // Stored as the display string ("30 Mins") — the
                          // meal list and the prep-time filter both read that
                          // shape, so keep writing it.
                          onChangeValue={(minutes) =>
                            setFieldValue(
                              PREPTIME_KEY,
                              `${minutes} ${Strings.createMeal_minsSuffix}`,
                            )
                          }
                        />
                      </View>
                      <View style={styles.rowItem}>
                        <Text style={styles.label}>
                          {Strings.createMeal_servings}
                        </Text>
                        <CustomStepper
                          value={values.servings as any}
                          editable
                          min={1}
                          max={99}
                          accessibilityLabel={Strings.createMeal_servings}
                          onChangeValue={(next) =>
                            setFieldValue(SERVINGS_KEY, String(next))
                          }
                        />
                      </View>
                    </View>

                    <View style={styles.row}>
                      <View style={styles.rowItem}>
                        <Text style={styles.label}>
                          {Strings.createMeal_difficulty}
                        </Text>
                        <CustomDropdown
                          value={values.difficulty}
                          options={
                            [
                              Strings.testMealPlan_easy,
                              Strings.testMealPlan_medium,
                              Strings.filterModal_challenging,
                              Strings.testMealPlan_hard,
                            ] as any
                          }
                          onSelect={(val) => setFieldValue(DIFFICULTY_KEY, val)}
                          icon={IconDown}
                        />
                      </View>
                      <View style={styles.rowItem}>
                        <Text style={styles.label}>
                          {Strings.createMeal_category}
                        </Text>
                        <CustomDropdown
                          value={values.category}
                          options={mealPlanNames as any}
                          onSelect={(val) => setFieldValue(CATEGORY_KEY, val)}
                          icon={IconDown}
                        />
                      </View>
                    </View>
                  </View>

                  <View style={styles.card}>
                    <Text style={styles.sectionTitle}>
                      {Strings.createMeal_ingredients}
                    </Text>

                    <AddKrogerIngredient
                      visible={showKrogerIngredientModal}
                      onClose={() => setShowKrogerIngredientModal(false)}
                      store={krogerStatus?.selectedStore || null}
                      onChangeStore={() => {
                        setShowKrogerIngredientModal(false);
                        pushNavigation(APP_ROUTES.KROGER_SIGNUP, {
                          source: "profile",
                        });
                      }}
                      onSelect={(selection: IngredientSelection) => {
                        const meta = selection.meta;

                        if (!meta) {
                          setFieldValue(INGREDIENTS_KEY, [
                            ...values.ingredients,
                            buildDefaultIngredient(selection.ingredientName),
                          ]);

                          if (touched.ingredients && errors.ingredients) {
                            setTouched({
                              ...touched,
                              ingredients: false,
                            } as any);
                          }

                          setShowKrogerIngredientModal(false);
                          return;
                        }

                        const matchedCategory = findMatchingCategory(meta);
                        const baseUnitOptions = (matchedCategory?.unit ||
                          []) as string[];
                        const krogerUnit = meta?.size || meta?.parsedUnit || "";
                        const unitOptions = mergeUnitOptions(
                          baseUnitOptions,
                          krogerUnit,
                        );
                        const selectedUnit = findPreferredUnit(
                          unitOptions,
                          krogerUnit,
                        );

                        setFieldValue(INGREDIENTS_KEY, [
                          ...values.ingredients,
                          {
                            ingredientId:
                              meta?.upc ||
                              meta?.productId ||
                              generateFirebaseId(),
                            ingredientName: selection.ingredientName,
                            count: "1",
                            unit: meta?.size || selectedUnit,
                            categoryId: matchedCategory?.id ?? "",
                            categoryName:
                              meta?.displayCategory ||
                              meta?.category ||
                              matchedCategory?.title ||
                              "",
                            categoryUnits: unitOptions,
                            allowCountSelection: true,
                            isKroger: true,
                            krogerIngredientId: meta?.productId || "",
                            krogerMeta: meta,
                            krogerCategoryName:
                              meta?.displayCategory ||
                              meta?.category ||
                              matchedCategory?.title ||
                              "",
                            krogerUnit: krogerUnit || meta?.size || "",
                          },
                        ]);

                        if (touched.ingredients && errors.ingredients) {
                          setTouched({
                            ...touched,
                            ingredients: false,
                          } as any);
                        }

                        setShowKrogerIngredientModal(false);
                      }}
                    />

                    <FlatList
                      data={values.ingredients}
                      keyExtractor={(_, index) => index.toString()}
                      scrollEnabled={false}
                      renderItem={renderIngredientItem(
                        values.ingredients,
                        setFieldValue,
                        errors,
                        touched,
                        setTouched,
                      )}
                    />
                    {touched.ingredients &&
                      errors.ingredients &&
                      typeof errors.ingredients === "string" && (
                        <Text style={styles.errorText}>
                          {errors.ingredients}
                        </Text>
                      )}

                    <TouchableOpacity
                      style={styles.addIngredient}
                      onPress={handleOpenKrogerPicker}
                      disabled={isPreparingKroger}
                    >
                      <IconPlus
                        width={verticalScale(21)}
                        height={verticalScale(21)}
                        color={Colors.primary}
                      />
                      <Text style={styles.plusicon}>+</Text>
                      <Text style={styles.addIngredientText}>
                        {isPreparingKroger
                          ? "Loading Kroger..."
                          : Strings.createMeal_addIngredient}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.card}>
                    <Text style={styles.sectionTitle}>
                      {Strings.createMeal_instruction}
                    </Text>

                    <FlatList
                      data={values.steps}
                      keyExtractor={(_, index) => index.toString()}
                      scrollEnabled={false}
                      renderItem={renderInstructionItem(
                        values.steps,
                        setFieldValue,
                      )}
                    />
                    <TouchableOpacity
                      style={styles.addIngredient}
                      onPress={() =>
                        setFieldValue(STEPS_KEY, [
                          ...values.steps,
                          { text: "" },
                        ])
                      }
                    >
                      <Text style={styles.plusicon}>+</Text>
                      <Text style={styles.addIngredientText}>
                        {Strings.createMeal_addStep}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <SpaceBetweenButtons
                    containerStyle={styles.parentOfConfirmButton}
                    left={
                      <ThemeNormalButton
                        title={
                          isEdit
                            ? Strings.createMeal_discard
                            : Strings.createMeal_cancel
                        }
                        textStyle={
                          isEdit ? styles.editCancelButton : styles.cancelButton
                        }
                        onPress={closeSheet}
                      />
                    }
                    right={
                      <ThemeGradientButton
                        title={
                          isEdit
                            ? Strings.createMeal_updateMeal
                            : isCopy
                              ? Strings.createMeal_copyMeal
                              : Strings.createMeal_confirm
                        }
                        gradientStartColor={Colors._667D4C}
                        gradientEndColor={Colors._9DAF89}
                        gradientStart={{ x: 0, y: 0 }}
                        gradientEnd={{ x: 1, y: 0 }}
                        rightChild={
                          isEdit || isCopy ? (
                            <Image
                              source={iconMeal}
                              style={{
                                width: verticalScale(21),
                                height: verticalScale(21),
                                tintColor: Colors.white,
                              }}
                              resizeMode="contain"
                            />
                          ) : null
                        }
                        textStyle={styles.confirmButton}
                        onPress={async () => {
                          const formErrors = await validateForm();

                          if (Object.keys(formErrors).length > 0) {
                            // Mark all fields as touched to show validation errors
                            const ingredientsTouched = values.ingredients.map(
                              () => ({
                                name: true,
                                count: true,
                                unit: true,
                                category: true,
                              }),
                            );

                            const stepsTouched = values.steps.map(() => true);

                            setTouched(
                              {
                                name: true,
                                description: true,
                                imageUrl: true,
                                prepTime: true,
                                servings: true,
                                difficulty: true,
                                category: true,
                                ingredients: ingredientsTouched,
                                steps: stepsTouched,
                              } as any,
                              false,
                            ); // false means don't validate, just set touched

                            return;
                          }
                          handleSubmit();
                        }}
                      />
                    }
                  />
                  <View style={styles.emptybottom}></View>
                </KeyboardAwareScrollView>
              </View>
            </View>
            <ImagePickerModal
              visible={showImagePickerModal}
              onClose={() => setShowImagePickerModal(false)}
              onImagePicked={(url) => setFieldValue("imageUrl", url)}
            />
          </>
        );
      }}
    </Formik>
  );
};

export default CreateMealBottomSheet;

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  modalContent: {
    flex: 1,
  },
  header: {
    fontSize: moderateScale(21),
    color: Colors.primary,
    fontFamily: FontFamilies.ROBOTO_SEMI_BOLD,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: moderateScale(8),
    padding: moderateScale(10),
    marginBottom: verticalScale(10),
    elevation: moderateScale(3),
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: moderateScale(2) },
    shadowOpacity: moderateScale(0.15),
    shadowRadius: moderateScale(4),
  },
  sectionTitle: {
    fontSize: moderateScale(12),
    fontFamily: FontFamilies.ROBOTO_SEMI_BOLD,
    color: Colors.primary,
    marginBottom: verticalScale(10),
  },
  label: {
    fontSize: moderateScale(12),
    marginTop: moderateScale(8),
    marginBottom: moderateScale(4),
    fontFamily: FontFamilies.ROBOTO_REGULAR,
    color: Colors.primary,
  },
  input: {
    backgroundColor: Colors._F6F6F6,
    borderRadius: moderateScale(8),
    padding: moderateScale(10),
    fontSize: fontSize(14),
    marginBottom: verticalScale(8),
    borderWidth: moderateScale(1),
    borderColor: Colors.borderColor,
  },
  uploadButton: {
    marginLeft: horizontalScale(8),
    paddingHorizontal: horizontalScale(16),
    paddingVertical: verticalScale(10),
    borderRadius: moderateScale(8),
    borderWidth: moderateScale(1),
    borderColor: Colors.borderColor,
    backgroundColor: Colors.white,
  },
  uploadButtonText: {
    fontFamily: FontFamilies.ROBOTO_MEDIUM,
    color: Colors.primary,
    fontSize: moderateScale(14),
  },
  row: { flexDirection: "row", justifyContent: "flex-start", gap: 8 },
  rowItem: { flex: 1, minWidth: moderateScale(80) },
  deleteButton: {
    alignSelf: "flex-end",
    marginBottom: verticalScale(18),
  },
  parentCreateMealText: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginVertical: verticalScale(20),
    marginHorizontal: moderateScale(20),
  },
  placeholderText: {
    color: Colors.tertiary,
    fontSize: moderateScale(12),
    fontFamily: FontFamilies.ROBOTO_REGULAR,
  },
  addIngredientText: {
    fontFamily: FontFamilies.ROBOTO_SEMI_BOLD,
    color: Colors.primary,
    fontSize: moderateScale(14),
  },
  addIngredient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginVertical: verticalScale(10),
  },
  confirmButton: {
    color: Colors.white,
    fontFamily: FontFamilies.ROBOTO_MEDIUM,
    fontSize: moderateScale(16),
  },
  cancelButton: {
    fontFamily: FontFamilies.ROBOTO_MEDIUM,
    color: Colors.primary,
    fontSize: fontSize(16),
  },
  editCancelButton: {
    fontFamily: FontFamilies.ROBOTO_BLACK,
    color: Colors.error,
    fontSize: fontSize(16),
  },
  parentOfConfirmButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginVertical: verticalScale(15),
  },
  plusicon: {
    color: Colors.primary,
    fontSize: moderateScale(22),
    fontFamily: FontFamilies.ROBOTO_SEMI_BOLD,
    marginRight: moderateScale(8),
  },
  emptybottom: {
    height: verticalScale(140),
  },
  errorText: {
    fontSize: fontSize(14),
    fontFamily: FontFamilies.ROBOTO_REGULAR,
    color: Colors.error,
    marginTop: verticalScale(-4),
    marginBottom: verticalScale(8),
  },
  discardText: {
    fontFamily: FontFamilies.ROBOTO_MEDIUM,
    // color: Colors.primary,
    fontSize: moderateScale(14),
  },
});
