import { calendaricon, closeIcon } from "@/assets/images";
import { CheckBox, FilledCheckBox, IconCartWhite } from "@/assets/svg";
import {
  horizontalScale,
  moderateScale,
  verticalScale,
} from "@/constants/Constants";
import { Strings } from "@/constants/Strings";
import { Colors, FontFamilies } from "@/constants/Theme";
import { useTourStep } from "@/context/TourStepContext";
import { useAppSelector } from "@/reduxStore/hooks";
import { formatSlashDate } from "@/utils/DateFormat";
import { useShoppingListViewModel } from "@/viewmodels/ShoppingListViewModel";
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetScrollView,
} from "@gorhom/bottom-sheet";
import { Timestamp } from "firebase/firestore";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Dimensions,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { TourGuideZone } from "rn-tourguide";
import AddItemToList from "./AddItemToList";
import BaseButton from "./BaseButton";
import CustomTextInput from "./CustomTextInput";
import CustomDateTimePicker from "./DateTimePicker";
import { hideLoader, showLoader } from "./Loader";
import ThemeNormalButton from "./ThemeNormalButton";

export interface CreateNewListBottomSheetRef {
  expand: () => void;
  close: () => void;
}
interface CreateNewListBottomSheetProps {
  shoppingList?: any;
  onClose?: () => void;
  from?: string;
}
// const CreateNewListBottomSheet = forwardRef<BottomSheet, CreateNewListBottomSheetProps>(
//   ({ isEdit = false, mealData }, ref) => {
const CreateNewListBottomSheet = forwardRef<
  CreateNewListBottomSheetRef,
  CreateNewListBottomSheetProps
>(
  (
    { shoppingList, onClose, from },
    ref: React.Ref<CreateNewListBottomSheetRef>,
  ) => {
    const snapPoints = useMemo(() => ["100%"], []);
    const user = useAppSelector((state) => state.auth.user);
    const { addShoppingListData, loading, updateShoppingListData } =
      useShoppingListViewModel();
    const {
      shouldStartTour,
      setTriggerOpenAddItemToList,
      setTriggerAddDummyIngredients,
      setTriggerCloseCreateList,
      isCreateListBottomSheetOpen,
      setIsCreateListBottomSheetOpen,
    } = useTourStep();
    const [listName, setListName] = useState("");
    const [shoppingDay, setShoppingDay] = useState("");
    const [mealName, setMealName] = useState("");
    const [mealDescription, setMealDescription] = useState("");
    const [imageUrl, setImageUrl] = useState("");
    const [prepTime, setPrepTime] = useState("5 Mins");
    const [servings, setServings] = useState("1");
    const [difficulty, setDifficulty] = useState("Easy");
    const [category, setCategory] = useState("Dinner");
    const [ingredientName, setIngredientName] = useState("");
    const [ingredientCount, setIngredientCount] = useState("1");
    const [ingredientUnit, setIngredientUnit] = useState("100grm");
    const [ingredientCategory, setIngredientCategory] = useState("Fruit");
    const { height } = Dimensions.get("window");
    const { width } = Dimensions.get("window");
    const prepTimeOptions = ["5 Mins", "10 Mins", "15 Mins"];
    const prepTimeIndex = prepTimeOptions.indexOf(prepTime);
    const [unitWeight, setUnitweight] = useState("100 grms");
    const unitWeightOptions = ["100grm", "200grm", "1kg"];
    const unitWeightIndex = unitWeightOptions.indexOf(unitWeight);
    const [ingredients, setIngredients] = useState([
      { name: "", count: "1", unit: "100grm", category: "Fruit" },
    ]);
    const [isAddItemVisible, setIsAddItemVisible] = useState(false);
    const [receivedIngredients, setReceivedIngredients] = useState<any[]>([]);
    const [selectedItems, setSelectedItems] = useState<string[]>([]);
    const [startDate, setStartDate] = useState(new Date());
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [isTourOpen, setIsTourOpen] = useState(false);
    // Group ingredients by category
    const groupedIngredients = receivedIngredients.reduce(
      (acc: any, ingredient: any) => {
        const category = ingredient.categoryName || "Other";
        if (!acc[category]) {
          acc[category] = [];
        }
        const count = ingredient.count || "";
        const unit = ingredient.unit || "";
        const mealName = ingredient.mealName || "";
        const amountParts: string[] = [];
        if (Number(count) > 0) amountParts.push(String(count));
        if (unit) amountParts.push(unit);
        let amount = amountParts.join(" ");
        if (mealName) amount += ` (${mealName})`;
        acc[category].push({
          id: ingredient.ingredientId || ingredient.ingredientName,
          category: ingredient.categoryName,
          name: ingredient.ingredientName,
          amount: amount || unit,
        });
        return acc;
      },
      {},
    );

    const resetState = () => {
      setListName("");
      setShoppingDay("");
      setReceivedIngredients([]);
      setSelectedItems([]);
      setMealName("");
      setMealDescription("");
      setImageUrl("");
      setPrepTime("5 Mins");
      setServings("1");
      setDifficulty("Easy");
      setCategory("Dinner");
      setIngredientName("");
      setIngredientCount("1");
      setIngredientUnit("100grm");
      setIngredientCategory("Fruit");
      setUnitweight("100 grms");
      setStartDate(new Date());
      setShowDatePicker(false);
      setIsAddItemVisible(false);
      setIsTourOpen(false);
      // ...reset any other state as needed
    };

    useEffect(() => {
      if (shoppingList) {
        setListName(shoppingList.listName || "");
        setShoppingDay(shoppingList.shoppingDay || "");
        setReceivedIngredients(
          shoppingList.ingredients || shoppingList.items || [],
        );
        setSelectedItems(
          (shoppingList.ingredients || shoppingList.items || []).map(
            (ing: any) => ing.ingredientId || ing.ingredientName,
          ),
        );
        setStartDate(
          shoppingList.shoppingDate
            ? new Date(
                shoppingList.shoppingDate.seconds
                  ? shoppingList.shoppingDate.seconds * 1000
                  : shoppingList.shoppingDate,
              )
            : new Date(),
        );
      } else {
        resetState();
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [shoppingList]);

    const bottomSheetRef = useRef<BottomSheet>(null);
    useImperativeHandle(ref, () => ({
      expand: () => {
        if (shouldStartTour) {
          setIsTourOpen(true);
          setIsCreateListBottomSheetOpen(true);
        }
        bottomSheetRef.current?.expand();
      },
      close: () => {
        if (shouldStartTour) {
          setIsTourOpen(false);
          setIsCreateListBottomSheetOpen(false);
        }
        resetState();
        bottomSheetRef.current?.close();
      },
    }));

    useEffect(() => {
      const addDummyData = () => {
        const dummyIngredients = [
          {
            ingredientId: "dummy-ing-1",
            ingredientName: "Spaghetti",
            categoryId: "cat-1",
            categoryName: "Pasta",
            selectedUnit: "400 grams",
            unit: "400 grams",
            count: 1,
            mealId: "tour-dummy-meal",
          },
          {
            ingredientId: "dummy-ing-2",
            ingredientName: "Ground Beef",
            categoryId: "cat-2",
            categoryName: "Meat",
            selectedUnit: "500 grams",
            unit: "500 grams",
            count: 1,
            mealId: "tour-dummy-meal",
          },
          {
            ingredientId: "dummy-ing-3",
            ingredientName: "Tomato Sauce",
            categoryId: "cat-3",
            categoryName: "Sauces",
            selectedUnit: "250 ml",
            unit: "250 ml",
            count: 1,
            mealId: "tour-dummy-meal",
          },
        ];
        setReceivedIngredients(dummyIngredients);
        // Auto-select all dummy ingredients
        setSelectedItems(dummyIngredients.map((ing) => ing.ingredientId));
      };
      setTriggerAddDummyIngredients(() => addDummyData);

      return () => {
        setTriggerAddDummyIngredients(null);
      };
    }, [setTriggerAddDummyIngredients]);

    // Auto-reopen bottom sheet during tour if it was open before navigation
    useEffect(() => {
      if (shouldStartTour && isCreateListBottomSheetOpen && !isTourOpen) {
        // Small delay to ensure the screen is mounted
        const timer = setTimeout(() => {
          bottomSheetRef.current?.expand();
          setIsTourOpen(true);
        }, 300);
        return () => clearTimeout(timer);
      }
    }, [shouldStartTour, isCreateListBottomSheetOpen, isTourOpen]);

    const wasTourActive = useRef(shouldStartTour);
    useEffect(() => {
      if (wasTourActive.current && !shouldStartTour) {
        setIsAddItemVisible(false);
        setIsTourOpen(false);
        setIsCreateListBottomSheetOpen(false);
        resetState();
        bottomSheetRef.current?.close();
      }
      wasTourActive.current = shouldStartTour;
    }, [shouldStartTour]);

    const data = [
      { id: "1", category: "Category", name: "Spaghetti", amount: "400 grams" },
      {
        id: "2",
        category: "Category",
        name: "Ground Beef",
        amount: "500 grams",
      },
      {
        id: "3",
        category: "Category",
        name: "Ground Beef",
        amount: "500 grams",
      },
    ];

    const toggleItemSelection = (itemId: string) => {
      setSelectedItems((prev) => {
        if (prev.includes(itemId)) {
          return prev.filter((id) => id !== itemId);
        } else {
          return [...prev, itemId];
        }
      });
    };

    const renderIngredientItem = ({
      item,
    }: {
      item: { id: string; category: string; name: string; amount: string };
    }) => {
      const isSelected = selectedItems.includes(item.id);

      return (
        <TouchableOpacity
          style={styles.cardCategory}
          onPress={() => toggleItemSelection(item.id)}
          activeOpacity={0.7}
        >
          <View style={styles.checkboxRow}>
            {isSelected ? (
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
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.name} numberOfLines={2}>
                {item.name}
              </Text>
              <Text style={styles.amount} numberOfLines={2}>
                {item.amount}
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      );
    };

    const renderCategorySection = (category: string) => (
      <View key={category}>
        <Text style={styles.sectionTitle}>{category}</Text>
        <View style={styles.dividerRow} />
        <FlatList
          data={groupedIngredients[category]}
          keyExtractor={(item) => item.id}
          renderItem={renderIngredientItem}
          scrollEnabled={false}
        />
      </View>
    );

    const handleSaveShoppingList = async () => {
      try {
        if (!listName.trim()) {
          alert("Please enter a list name");
          return;
        }

        if (!startDate) {
          alert("Please enter a shopping day");
          return;
        }

        if (receivedIngredients.length === 0) {
          alert("Please add items to your shopping list");
          return;
        }

        // Filter only selected ingredients and map to required fields
        const selectedIngredients = receivedIngredients.filter((ingredient) =>
          selectedItems.includes(
            ingredient.ingredientId || ingredient.ingredientName,
          ),
        );

        if (selectedIngredients.length === 0) {
          alert("Please select at least one item to save");
          return;
        }

        if (!user?.id) {
          alert("You must be signed in to save a shopping list");
          return;
        }

        const mappedIngredients = selectedIngredients.map((ingredient) => {
          const isKroger = ingredient.isKroger || false;
          // `unit` is the recipe amount's unit as the user set it, for every
          // row. It used to be replaced by the Kroger product size on Kroger
          // rows, which turned "4 tablespoon" into "4 x 16 fl oz" — and four
          // bottles in the cart. The product size travels separately as
          // krogerUnit, for display only.
          const unit = ingredient.selectedUnit || ingredient.unit || "";

          return {
            ingredientId: ingredient.ingredientId || "",
            ingredientName: ingredient.ingredientName || "",
            categoryId: ingredient.categoryId || "",
            categoryName: ingredient.categoryName || "",
            mealId: ingredient.mealId || "",
            mealName: ingredient.mealName || "",
            unit,
            count: ingredient.count || 1,
            acquired: ingredient.acquired || false,
            // Carried through so editing a list doesn't wipe the boxes the user
            // unticked on the shopping screen. The stored flag is the negative
            // one (see `idsOfSelected` in TestPlanShopping): a new list — and any
            // ingredient added to an existing one — opens checked.
            deselected: ingredient.deselected || false,
            isKroger,
            krogerIngredientId: ingredient.krogerIngredientId || "",
            krogerCategoryName:
              ingredient.krogerCategoryName || ingredient.categoryName || "",
            // The product's own size, or empty when unknown — never the recipe
            // unit. Back-filling it from `unit` made the two indistinguishable
            // and let a recipe count be sent as a package count.
            krogerUnit: ingredient.krogerUnit || "",
          };
        });

        const shoppingListData = {
          listName: listName.trim(),
          ingredients: mappedIngredients,
          createdAt: Timestamp.fromDate(new Date()),
          shoppingDate: Timestamp.fromDate(startDate),
          uid: user?.id,
        };

        const updatingShoppingListData = {
          id: shoppingList?.id,
          listName: listName.trim(),
          ingredients: mappedIngredients,
          createdAt: Timestamp.fromDate(new Date()),
          shoppingDate: Timestamp.fromDate(startDate),
          uid: user?.id,
        };

        showLoader();
        if (shoppingList && shoppingList.id && from !== "plan") {
          // Edit mode: update existing list
          updateShoppingListData(
            updatingShoppingListData,
            () => {
              hideLoader();
              alert("Shopping list updated successfully!");
              resetState();
              bottomSheetRef.current?.close();
              if (onClose) onClose(); // for updaing the previous screen
            },
            (error) => {
              hideLoader();
              alert("Error updating shopping list: " + error);
            },
          );
        } else {
          // Create mode: add new list
          addShoppingListData(
            shoppingListData,
            () => {
              hideLoader();
              alert("Shopping list created successfully!");
              resetState();
              bottomSheetRef.current?.close();
            },
            (error) => {
              hideLoader();
              alert("Error creating shopping list: " + error);
            },
          );
        }
      } catch (error) {
        alert("Error creating shopping list: " + error);
      }
    };

    return (
      <BottomSheet
        ref={bottomSheetRef}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose={!shouldStartTour}
        onChange={(index) => {
          if (index === -1) {
            resetState();
            if (onClose) onClose();
          }
        }}
        keyboardBehavior="extend"
        keyboardBlurBehavior="restore"
        topInset={0}
        handleComponent={() => null}
        backdropComponent={(props) => (
          <BottomSheetBackdrop
            {...props}
            disappearsOnIndex={-1}
            appearsOnIndex={0}
          />
        )}
      >
        <View style={styles.emptyView}></View>
        <View style={styles.parentCreateMealText}>
          <Text style={styles.header}>{Strings.createList_createNewList}</Text>
          <TouchableOpacity
            onPress={() => {
              resetState();
              bottomSheetRef.current?.close();
            }}
          >
            <Image
              source={closeIcon}
              style={styles.closeIcon}
              resizeMode="contain"
            />
          </TouchableOpacity>
        </View>

        <BottomSheetScrollView
          contentContainerStyle={styles.scrollViewContent}
          keyboardShouldPersistTaps="handled"
        >
          <TourGuideZone zone={14} shape="rectangle" borderRadius={16}>
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>
                {Strings.createList_listDetails}
              </Text>
              <Text style={styles.label}>{Strings.createList_listName}</Text>
              <CustomTextInput
                placeholder={Strings.createList_listName_placeholder}
                value={listName}
                style={{ color: Colors.primary }}
                onChangeText={setListName}
              />

              <Text style={styles.label}>{Strings.createList_shoppingDay}</Text>
              <TouchableOpacity
                onPress={() => setShowDatePicker(true)}
                activeOpacity={0.8}
              >
                <View style={styles.inputWithIcon}>
                  <CustomTextInput
                    placeholder={formatSlashDate(startDate)}
                    value={formatSlashDate(startDate)}
                    editable={false}
                    placeholderTextColor={Colors.secondaryText}
                    pointerEvents="none"
                  />
                  <Image
                    source={calendaricon}
                    style={styles.calendarIcon}
                    resizeMode="contain"
                  />
                </View>
              </TouchableOpacity>
              <CustomDateTimePicker
                mode="date"
                value={startDate}
                visible={showDatePicker}
                onChange={(date) => {
                  setStartDate(date);
                  const formattedDate = date.toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  });
                  setShoppingDay(formattedDate);
                }}
                onClose={() => setShowDatePicker(false)}
              />
            </View>
          </TourGuideZone>
          <View style={styles.card}>
            {/* tooltipBelowZone: put the "Check And Save" tooltip directly under
                the items card, as in the design. */}
            <TourGuideZone
              zone={16}
              shape="rectangle"
              borderRadius={8}
              tooltipBelowZone
            >
              <TourGuideZone zone={15} shape="rectangle" borderRadius={8}>
                <Text style={styles.sectionTitle}>
                  {Strings.createList_items}
                </Text>
                <View style={styles.dividerRow} />
                <BaseButton
                  title={Strings.createList_addExtraItems}
                  gradientButton={false}
                  backgroundColor={Colors.white}
                  textStyle={[styles.addExtraButton]}
                  textStyleText={styles.addExtra}
                  onPress={() => setIsAddItemVisible(true)}
                />
              </TourGuideZone>

              <View>
                {Object.keys(groupedIngredients).map((category) =>
                  renderCategorySection(category),
                )}
              </View>
            </TourGuideZone>
          </View>

          <View style={styles.parentOfConfirmButton}>
            <ThemeNormalButton
              title={Strings.createList_discard}
              backgroundColor={Colors.white}
              width={width * 0.28}
              containerStyle={styles.cancelButtonError}
              textColor={Colors.error}
              showElevation={false}
              textStyle={styles.discardText}
              onPress={() => {
                resetState();
                bottomSheetRef.current?.close();
              }}
            />
            <BaseButton
              title={Strings.createList_saveShoppingList}
              gradientButton={true}
              width={width * 0.65}
              gradientStartColor={Colors._667D4C}
              gradientEndColor={Colors._9DAF89}
              gradientStart={{ x: 0, y: 0 }}
              gradientEnd={{ x: 1, y: 0 }}
              textColor={Colors.white}
              rightChild={
                <IconCartWhite
                  width={verticalScale(21)}
                  height={verticalScale(21)}
                />
              }
              textStyle={[styles.confirmButton]}
              textStyleText={styles.saveShopping}
              onPress={handleSaveShoppingList}
            />
          </View>
        </BottomSheetScrollView>
        <AddItemToList
          visible={isAddItemVisible}
          onClose={() => setIsAddItemVisible(false)}
          onMealSelect={(newIngredients: any[]) => {
            const keyOf = (ing: any) =>
              ing.ingredientId || ing.ingredientName;

            setReceivedIngredients((prev) => {
              const existingKeys = new Set(prev.map(keyOf));
              const toAdd = newIngredients.filter(
                (ing) => !existingKeys.has(keyOf(ing)),
              );
              return [...prev, ...toAdd];
            });
            setSelectedItems((prev) =>
              Array.from(new Set([...prev, ...newIngredients.map(keyOf)])),
            );
            setIsAddItemVisible(false);
          }}
        />
      </BottomSheet>
    );
  },
);

export default CreateNewListBottomSheet;

const styles = StyleSheet.create({
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
    elevation: 2,
    marginTop: verticalScale(10),
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
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

  uploadButton: {
    marginLeft: 8,
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
  rowItem: { flex: 1, minWidth: 80 },
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
  emptyView: {
    height: verticalScale(35),
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
    fontSize: moderateScale(13),
  },
  cancelButton: {
    fontFamily: FontFamilies.ROBOTO_MEDIUM,

    fontSize: moderateScale(12),
    borderWidth: moderateScale(1),
    borderColor: Colors.borderColor,
  },
  parentOfConfirmButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginVertical: verticalScale(15),
    marginHorizontal: moderateScale(-5),
  },
  plusicon: {
    color: Colors.primary,
    fontSize: moderateScale(22),
    fontFamily: FontFamilies.ROBOTO_SEMI_BOLD,
    marginRight: moderateScale(8),
  },
  addExtra: {
    fontSize: moderateScale(14),
    fontFamily: FontFamilies.ROBOTO_MEDIUM,
    color: Colors.primary,
  },
  addExtraButton: {
    borderWidth: moderateScale(1),
    borderColor: Colors.borderColor,
    marginHorizontal: moderateScale(-7),
    marginVertical: verticalScale(3),
  },
  dividerRow: {
    height: moderateScale(1),
    backgroundColor: Colors.divider,
    flex: 1,

    marginBottom: verticalScale(10),
  },

  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  checkbox: {
    width: moderateScale(19),
    height: moderateScale(19),
    borderWidth: moderateScale(1),
    borderColor: Colors.tertiary,
    borderRadius: moderateScale(1),
    marginRight: horizontalScale(10),
  },
  name: {
    fontFamily: FontFamilies.ROBOTO_SEMI_BOLD,
    fontSize: moderateScale(12),
    color: Colors.primary,
  },
  amount: {
    fontFamily: FontFamilies.ROBOTO_REGULAR,
    fontSize: moderateScale(10),
    color: Colors.primary,
    marginTop: moderateScale(2),
  },
  cardCategory: {
    backgroundColor: Colors.white,
    borderRadius: moderateScale(8),
    padding: moderateScale(10),
    marginBottom: verticalScale(10),
    elevation: 2,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    marginHorizontal: moderateScale(3),
  },
  discardText: {
    fontSize: moderateScale(14),
    fontFamily: FontFamilies.ROBOTO_MEDIUM,
    color: Colors.error,
  },
  saveShopping: {
    fontFamily: FontFamilies.ROBOTO_MEDIUM,
    fontSize: moderateScale(16),
    color: Colors.white,
  },
  closeIcon: {
    width: verticalScale(25),
    height: verticalScale(25),
  },
  scrollViewContent: {
    paddingHorizontal: moderateScale(20),
  },
  cancelButtonError: {
    fontFamily: FontFamilies.ROBOTO_MEDIUM,
    color: Colors.error,
    width: "28%",
    fontSize: moderateScale(12),
    borderWidth: moderateScale(1),
    borderColor: Colors.borderColor,
  },
  checkboxIcon: {
    marginRight: horizontalScale(10),
  },
  inputWithIcon: {
    position: "relative",
  },
  calendarIcon: {
    position: "absolute",
    right: horizontalScale(15),
    top: "43%",
    transform: [{ translateY: -moderateScale(10) }],
    width: moderateScale(20),
    height: moderateScale(20),
    tintColor: Colors.tertiary,
  },
});
