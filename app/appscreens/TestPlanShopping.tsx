import { deleteicon, iconback, iconedit } from "@/assets/images";
import { CheckBox, FilledCheckBox, KrogerIcon } from "@/assets/svg";
import ConfirmationModal from "@/components/ConfirmationModal";
import CreateNewListBottomSheet, {
  CreateNewListBottomSheetRef,
} from "@/components/CreateNewListBottomSheet";
import { hideLoader, showLoader } from "@/components/Loader";
import ProgressBar from "@/components/ProgressBar";
import {
  horizontalScale,
  moderateScale,
  verticalScale,
} from "@/constants/Constants";
import { Strings } from "@/constants/Strings";
import { Colors, FontFamilies } from "@/constants/Theme";
import { useTourStep } from "@/context/TourStepContext";
import { useAppSelector } from "@/reduxStore/hooks";
import { addItemsToKrogerCart } from "@/services/krogerApi";
import { krogerCartQuantity } from "@/utils/krogerQuantity";
import { backNavigation } from "@/utils/Navigation";
import { useShoppingListViewModel } from "@/viewmodels/ShoppingListViewModel";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { TourGuideZone } from "rn-tourguide";

enum KrogerModality {
  DELIVERY = "DELIVERY",
  PICKUP = "PICKUP",
}

export default function TestPlanShopping() {
  const [checked, setChecked] = useState<string[]>([]);
  const router = useRouter();
  const { listId } = useLocalSearchParams();
  const user = useAppSelector((state) => state.auth.user);
  const isGuest = useAppSelector((state) => state.auth.isGuest);
  const { shouldStartTour } = useTourStep();
  const createNewListRef = useRef<CreateNewListBottomSheetRef>(null);
  const [selectedList, setSelectedList] = useState<any>(null);
  const [removeList, setRemoveList] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [krogerModality, setKrogerModality] = useState<KrogerModality | null>(
    null,
  );
  const [sendingToKroger, setSendingToKroger] = useState(false);

  const {
    fetchListById,
    loading,
    deleteShoppingListData,
    updateShoppingListData,
  } = useShoppingListViewModel();

  // Check if this is tour mode
  const isTourMode = listId === "tour-dummy-list" && shouldStartTour;

  const dummyTourList = useMemo(
    () => ({
      id: "tour-dummy-list",
      listName: "My Weekly Groceries",
      shoppingDay: new Date(
        Date.now() + 2 * 24 * 60 * 60 * 1000,
      ).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
      createdAt: new Date(),
      uid: user?.id || "tour-user",
      items: [
        {
          ingredientId: "dummy-ing-1",
          ingredientName: "Spaghetti",
          categoryId: "cat-1",
          categoryName: "Pasta",
          unit: "400 grams",
          mealId: "tour-dummy-meal",
          mealName: "Omelette",
          isChecked: false,
        },
        {
          ingredientId: "dummy-ing-2",
          ingredientName: "Ground Beef",
          categoryId: "cat-2",
          categoryName: "Meat",
          unit: "500 grams",
          mealId: "tour-dummy-meal",
          mealName: "Omelette",
          isChecked: false,
        },
        {
          ingredientId: "dummy-ing-3",
          ingredientName: "Tomato Sauce",
          categoryId: "cat-3",
          categoryName: "Sauces",
          unit: "250 ml",
          mealId: "tour-dummy-meal",
          mealName: "Omelette",
          isChecked: false,
        },
      ],
    }),
    [user?.id],
  );

  // The checkbox id is positional, but the persisted flag lives on the
  // ingredient itself — see idsOfSelected/toStoredIngredient below.
  const itemIdFor = (ing: any, index: number) =>
    `${ing.ingredientId}-${ing.mealId}-${index}`;

  // Selection defaults to ON: a list opens fully checked so the user only has to
  // *un*check what they already have at home.
  //
  // That is why the persisted flag is the negative one. A positive `selected`
  // flag can't express this — it is written as `false` for every item at list
  // creation, so "nobody has touched this list yet" and "the user unchecked
  // everything" look identical, and every existing list would open empty. With
  // `deselected`, absence means checked, so untouched lists (including every list
  // already in Firestore) and items added later both arrive selected.
  const idsOfSelected = (items: any[]) =>
    items.reduce((ids: string[], ing: any, idx: number) => {
      if (!ing.deselected) ids.push(itemIdFor(ing, idx));
      return ids;
    }, []);

  // The stored shape for a shopping-list ingredient. Enrichment adds fields
  // (categoryUnits, …) that are re-derived on read, so they are not written
  // back; `acquired` and `deselected` are the two flags that must survive.
  // Writing the whole array also drops the legacy `selected` field from lists
  // created before selection defaulted to on.
  const toStoredIngredient = (
    ing: any,
    flags: { acquired: boolean; selected: boolean },
  ) => ({
    ingredientId: ing.ingredientId,
    ingredientName: ing.ingredientName || "",
    categoryId: ing.categoryId,
    categoryName: ing.categoryName || "",
    mealId: ing.mealId || "",
    mealName: ing.mealName || "",
    unit: ing.selectedUnit || ing.unit,
    count: ing.count || 1,
    acquired: flags.acquired,
    deselected: !flags.selected,
    isKroger: ing.isKroger || false,
    krogerIngredientId: ing.krogerIngredientId || "",
    // The Kroger product's own size string. Kept because it is what tells
    // krogerCartQuantity that this row counts *that product* ("2 x 16 fl oz"
    // is two bottles) rather than measuring an amount. Dropping it here sent
    // the signal to the bottom of a well on the first selection save.
    krogerUnit: ing.krogerUnit || "",
  });

  // Refs so the blur handler writes the latest values instead of whatever was
  // captured when the focus effect was created.
  const checkedRef = useRef<string[]>([]);
  const selectedListRef = useRef<any>(null);
  const selectionDirtyRef = useRef(false);
  const listDeletedRef = useRef(false);

  useEffect(() => {
    checkedRef.current = checked;
  }, [checked]);

  useEffect(() => {
    selectedListRef.current = selectedList;
  }, [selectedList]);

  const selectItems = (next: string[] | ((prev: string[]) => string[])) => {
    selectionDirtyRef.current = true;
    setChecked(next);
  };

  const persistSelection = () => {
    if (isTourMode || !selectionDirtyRef.current || listDeletedRef.current) {
      return;
    }
    const list = selectedListRef.current;
    if (!list?.id) return;

    const items = list.ingredients || list.items || [];
    const checkedNow = checkedRef.current;
    const updated = items.map((ing: any, idx: number) =>
      toStoredIngredient(ing, {
        acquired: ing.acquired || false,
        selected: checkedNow.includes(itemIdFor(ing, idx)),
      }),
    );

    selectionDirtyRef.current = false;
    updateShoppingListData(
      { ...list, id: list.id, ingredients: updated },
      () => {},
      () => {
        // Non-fatal: the user keeps their on-screen selection either way.
        selectionDirtyRef.current = true;
      },
    );
  };

  useFocusEffect(
    React.useCallback(() => {
      if (isTourMode) {
        setSelectedList(dummyTourList);
        // Same default as a real list, so the tour demonstrates what the screen
        // actually does.
        setChecked(idsOfSelected(dummyTourList.items));
      } else if (listId) {
        showLoader();
        fetchListById(
          listId as string,
          (data) => {
            hideLoader();
            setSelectedList(data);
            // Everything is checked unless the user unchecked it last time. The
            // flag lives on each ingredient (`deselected`), not on the composite
            // id, so it survives the list being reordered or edited. It is
            // distinct from `acquired`, which records what was already sent to
            // Kroger and drives the progress bar.
            setChecked(idsOfSelected(data?.ingredients || data?.items || []));
            selectionDirtyRef.current = false;
          },
          (error) => {
            hideLoader();
            setSelectedList(null);
          },
        );
      }

      // Leaving the screen: flush the selection so it is still there on return.
      return () => {
        persistSelection();
      };
    }, [listId, isTourMode, dummyTourList]),
  );

  const allIngredients = selectedList?.ingredients || selectedList?.items || [];

  // The progress bar tracks Kroger purchasing only: how many of the list's
  // Kroger items have been sent to the cart. Non-Kroger items can never be
  // acquired, so counting them in the denominator would peg the bar below 100%
  // forever.
  const krogerIngredients = allIngredients.filter(
    (ing: any) => ing.isKroger && ing.krogerIngredientId,
  );
  const acquiredCount = krogerIngredients.filter(
    (ing: any) => ing.acquired,
  ).length;
  const krogerTotal = krogerIngredients.length;

  const allItemIds = allIngredients.map((ing: any, index: number) =>
    itemIdFor(ing, index),
  );
  const isAllSelected =
    allItemIds.length > 0 &&
    allItemIds.every((id: string) => checked.includes(id));

  const toggleSelectAll = () => {
    selectItems(isAllSelected ? [] : allItemIds);
  };

  const toggleCheck = (id: string, ingredient: any, index: number) => {
    // Any item can be toggled — including ones already sent to the Kroger cart.
    // (Previously acquired Kroger items were locked, which left the whole screen
    // unusable once items had been sent.)
    selectItems((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  };

  const handleDeleteList = () => {
    if (listId) {
      setRemoving(true);
      deleteShoppingListData(
        listId as string,
        () => {
          setRemoving(false);
          // Stops the blur flush from writing the selection back onto a list
          // that no longer exists.
          listDeletedRef.current = true;
          alert(Strings.shoppingList_deleted);
          backNavigation();
        },
        (error) => {
          setRemoving(false);
          alert(Strings.error_deleting_shoppingList);
        },
      );
    }

    return;
  };

  const hasKrogerItems = krogerTotal > 0;

  const handleSendToKrogerCart = async () => {
    // Sending to a Kroger cart needs a linked Kroger account, which needs a
    // Meal Cart account. Building the list itself stays open to guests.
    if (isGuest) {
      Alert.alert(Strings.guest_krogerSubtitle);
      return;
    }

    if (!krogerModality) {
      Alert.alert(Strings.testPlanShopping_krogerSelectModality);
      return;
    }

    // Only send the Kroger items the user actually selected (checked).
    const isSelectedKroger = (ing: any, idx: number) =>
      ing.isKroger &&
      ing.krogerIngredientId &&
      checked.includes(itemIdFor(ing, idx));

    // Which rows each UPC came from, and what each UPC is called. Kroger
    // answers per UPC, so these are what turn its answer back into "these rows
    // are now in the cart" and "Kroger refused these items, by name".
    const idsByUpc = new Map<string, string[]>();
    const nameByUpc = new Map<string, string>();
    allIngredients.forEach((ing: any, idx: number) => {
      if (!isSelectedKroger(ing, idx)) return;
      const upc = String(ing.krogerIngredientId);
      idsByUpc.set(upc, [...(idsByUpc.get(upc) || []), itemIdFor(ing, idx)]);
      if (!nameByUpc.has(upc)) {
        nameByUpc.set(upc, ing.ingredientName || upc);
      }
    });

    // Kroger's cart add takes one entry per UPC. The same product can reach a
    // list from two different meals, and sending it twice in one request is
    // rejected outright, so merge duplicates into a single line.
    //
    // What gets merged is *packages*, not recipe amounts — see
    // krogerCartQuantity. A measured amount ("3 tablespoon") is always one
    // package however large the amount, and two meals both using olive oil
    // still need one bottle, so only counted packages ("2 can") add up.
    const packagesByUpc = new Map<string, number>();
    allIngredients.forEach((ing: any, idx: number) => {
      if (!isSelectedKroger(ing, idx)) return;
      const upc = String(ing.krogerIngredientId);
      const { quantity, countsPackages } = krogerCartQuantity(ing);
      if (!packagesByUpc.has(upc)) packagesByUpc.set(upc, 0);
      if (countsPackages) {
        packagesByUpc.set(upc, (packagesByUpc.get(upc) || 0) + quantity);
      }
    });

    const krogerItems = [...packagesByUpc.entries()].map(([upc, packages]) => ({
      quantity: Math.max(1, packages),
      upc,
      modality: krogerModality,
    }));

    if (krogerItems.length === 0) {
      Alert.alert(Strings.testPlanShopping_krogerNoItems);
      return;
    }

    // Sending is additive on Kroger's side: every tap adds another copy of
    // every selected item to the cart. Re-sending items that already went
    // across is how a list of a couple of dozen items turns into hundreds, so
    // say so before doing it again.
    const resendCount = allIngredients.filter(
      (ing: any, idx: number) => isSelectedKroger(ing, idx) && ing.acquired,
    ).length;

    if (resendCount > 0) {
      Alert.alert(
        Strings.testPlanShopping_krogerResendTitle,
        `${resendCount} ${Strings.testPlanShopping_krogerResendMessage}`,
        [
          {
            text: Strings.testPlanShopping_krogerResendCancel,
            style: "cancel",
          },
          {
            text: Strings.testPlanShopping_krogerResendConfirm,
            onPress: () =>
              void sendKrogerItems(krogerItems, idsByUpc, nameByUpc),
          },
        ],
      );
      return;
    }

    await sendKrogerItems(krogerItems, idsByUpc, nameByUpc);
  };

  const sendKrogerItems = async (
    krogerItems: { quantity: number; upc: string; modality: KrogerModality }[],
    idsByUpc: Map<string, string[]>,
    nameByUpc: Map<string, string>,
  ) => {
    setSendingToKroger(true);
    try {
      const { addedUpcs, rejected } = await addItemsToKrogerCart(krogerItems);

      // Only the UPCs Kroger actually accepted count as sent. Marking a
      // rejected item acquired would tell the user it is in a cart it never
      // reached.
      const sentIds = new Set(
        addedUpcs.flatMap((upc) => idsByUpc.get(upc) || []),
      );

      // Mark only the sent (selected) items as acquired, locally and in
      // Firebase. Everything else keeps the flags it already had — an unchecked
      // item is neither sent nor marked acquired.
      const nextChecked = [...new Set([...checked, ...sentIds])];
      const updatedIngredients = allIngredients.map((ing: any, idx: number) => {
        const id = itemIdFor(ing, idx);
        return toStoredIngredient(ing, {
          acquired: sentIds.has(id) ? true : ing.acquired || false,
          selected: nextChecked.includes(id),
        });
      });

      // Update local state
      setSelectedList((prevList: any) => {
        if (!prevList) return prevList;
        return { ...prevList, ingredients: updatedIngredients };
      });

      // The sent items stay ticked; nothing else gets ticked on the user's behalf.
      setChecked(nextChecked);

      // Save to Firebase
      if (selectedList?.id) {
        selectionDirtyRef.current = false;
        updateShoppingListData(
          {
            ...selectedList,
            id: selectedList.id,
            ingredients: updatedIngredients,
          },
          () => {},
          (error: any) => {
            selectionDirtyRef.current = true;
            alert(Strings.testPlanShopping_errorUpdating + error);
          },
        );
      }

      if (rejected.length > 0) {
        const refused = rejected
          .map(
            (item) =>
              `• ${nameByUpc.get(item.upc) || item.upc}${
                item.reason ? ` — ${item.reason}` : ""
              }`,
          )
          .join("\n");

        Alert.alert(
          Strings.testPlanShopping_krogerPartialTitle,
          `${addedUpcs.length} ${Strings.testPlanShopping_krogerPartialMessage}\n\n${refused}`,
        );
      } else {
        Alert.alert(
          Strings.testPlanShopping_krogerSuccess,
          Strings.testPlanShopping_krogerSuccessMessage,
        );
      }
    } catch (error: any) {
      // Two very different failures land here: the callable that mints the
      // Kroger user token (auth/connection problems, reported as a Firebase
      // error code) and the cart request itself (an HTTP status from Kroger).
      // Telling them apart is the difference between "reconnect Kroger" and
      // "Kroger rejected these items".
      const status =
        error?.status || error?.details?.status || error?.customData?.status;
      const krogerPayload =
        error?.details || error?.details?.payload || error?.customData?.payload;
      let detail =
        error?.message || Strings.testPlanShopping_krogerErrorMessage;

      if (error?.code === "functions/unauthenticated") {
        detail += `\n\n${Strings.testPlanShopping_krogerReconnectHint}`;
      }
      // 403 from Kroger's cart endpoint means the user token carries no
      // cart-write permission — nothing about the list will fix that, only
      // re-granting the scope will.
      if (status === 403) {
        detail += `\n\n${Strings.testPlanShopping_krogerScopeHint}`;
      }
      if (Array.isArray(error?.rejected) && error.rejected.length > 0) {
        detail += `\n\n${Strings.testPlanShopping_krogerAllRejected}\n${error.rejected
          .map(
            (item: any) =>
              `• ${nameByUpc.get(item.upc) || item.upc}${
                item.reason ? ` — ${item.reason}` : ""
              }`,
          )
          .join("\n")}`;
      }
      if (status) {
        detail += `\n\nHTTP ${status}`;
      }
      if (krogerPayload) {
        detail += `\n${JSON.stringify(krogerPayload)}`;
      }
      Alert.alert(Strings.testPlanShopping_krogerError, detail);
    } finally {
      setSendingToKroger(false);
    }
  };

  const renderIngredientItem = ({
    item,
    index,
  }: {
    item: any;
    index: number;
  }) => {
    const itemId = `${item.ingredientId}-${item.mealId}-${index}`;
    const isChecked = checked.includes(itemId);

    // The row shows the recipe amount, which is not what the cart receives: a
    // measured amount buys one package of the product. Say so on the row rather
    // than letting "3 tablespoon" imply three of something arrives.
    const isKrogerItem = item.isKroger && item.krogerIngredientId;
    const cartQuantity = krogerCartQuantity(item);
    const showCartQuantity =
      isKrogerItem &&
      (!cartQuantity.countsPackages ||
        cartQuantity.quantity !== Number(item.count));

    // Check if this is the first item in its category
    const showCategoryHeader =
      index === 0 ||
      allIngredients[index - 1]?.categoryName !== item.categoryName;

    return (
      <View>
        {showCategoryHeader && (
          <>
            <Text style={styles.sectionTitle}>
              {item.categoryName || "Other"}
            </Text>
            <View style={styles.dividerRow} />
          </>
        )}
        <TouchableOpacity
          style={styles.cardCategory}
          onPress={() => toggleCheck(itemId, item, index)}
          activeOpacity={0.7}
        >
          <View style={styles.checkboxRow}>
            {isChecked ? (
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
                {item.ingredientName ||
                  Strings.testPlanShopping_unknownIngredient}
              </Text>
              <Text style={styles.amount} numberOfLines={2}>
                {Number(item.count) > 0 ? `${item.count} ` : ""}
                {item.unit || Strings.testPlanShopping_noUnit}
                {item.mealName ? ` (${item.mealName})` : ""}
              </Text>
              {showCartQuantity && (
                <Text style={styles.cartQuantity} numberOfLines={1}>
                  {`${Strings.testPlanShopping_krogerCartQuantity} ${cartQuantity.quantity}`}
                </Text>
              )}
            </View>
          </View>
        </TouchableOpacity>
      </View>
    );
  };
  return (
    <SafeAreaView style={styles.container}>
      {/* tooltipBelowZone: these zones fill the screen (the list needs flex: 1),
          so place their tooltips below the content and let the on-screen clamp
          settle them in the empty area beneath the list, as in the design. */}
      <TourGuideZone
        zone={18}
        shape="rectangle"
        borderRadius={8}
        style={{ flex: 1 }}
        tooltipBelowZone
      >
        <TourGuideZone
          zone={17}
          shape="rectangle"
          borderRadius={8}
          style={{ flex: 1 }}
          tooltipBelowZone
        >
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => router.back()}>
              <Image
                source={iconback}
                resizeMode="contain"
                style={styles.backIcon}
              />
            </TouchableOpacity>
            <Text style={styles.backText}>
              {Strings.testPlanShopping_backToLists}
            </Text>
          </View>

          <View style={styles.titleRow}>
            <Text style={styles.planTitle}>
              {selectedList?.listName || Strings.testPlanShopping_title}
            </Text>

            <View style={styles.editdelete}>
              <TouchableOpacity
                style={styles.editButton}
                onPress={() => {
                  setSelectedList({ ...selectedList });

                  createNewListRef.current?.expand();
                }}
              >
                <Image
                  source={iconedit}
                  resizeMode="contain"
                  style={styles.editIcon}
                />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setRemoveList(true)}>
                <Image
                  source={deleteicon}
                  resizeMode="contain"
                  style={styles.deleteIcon}
                />
              </TouchableOpacity>
            </View>
          </View>
          <Text style={styles.planSubTitle}>
            {
              new Set(
                allIngredients.map((ing: any) => ing.mealId).filter(Boolean),
              ).size
            }{" "}
            {new Set(
              allIngredients.map((ing: any) => ing.mealId).filter(Boolean),
            ).size === 1
              ? Strings.testPlanShopping_meal
              : Strings.testPlanShopping_meals}
          </Text>

          {/* <ProgressBar
            progress={checked.length / (allIngredients.length || 1)}
            label={Strings.testPlanShopping_progress}
            progressText={`${checked.length} / ${allIngredients.length}`}
            containerStyle={styles.progressbar}
          /> */}

          {hasKrogerItems && (
            <ProgressBar
              progress={acquiredCount / krogerTotal}
              label={Strings.testPlanShopping_progress}
              progressText={`${acquiredCount} / ${krogerTotal}`}
              containerStyle={styles.progressbar}
            />
          )}

          {allIngredients.length > 0 && (
            <TouchableOpacity
              style={styles.selectAllRow}
              onPress={toggleSelectAll}
              activeOpacity={0.7}
            >
              {isAllSelected ? (
                <FilledCheckBox
                  width={verticalScale(20)}
                  height={verticalScale(20)}
                  color={Colors.tertiary}
                  style={styles.checkboxIcon}
                />
              ) : (
                <CheckBox
                  width={verticalScale(20)}
                  height={verticalScale(20)}
                  color={Colors.tertiary}
                  style={styles.checkboxIcon}
                />
              )}
              <Text style={styles.selectAllText}>
                {isAllSelected
                  ? Strings.testPlanShopping_unselectAll
                  : Strings.testPlanShopping_selectAll}
              </Text>
            </TouchableOpacity>
          )}

          <FlatList
            style={{ flex: 1 }}
            data={allIngredients}
            keyExtractor={(item, index) =>
              `${item.ingredientId}-${item.mealId}-${index}`
            }
            renderItem={renderIngredientItem}
            scrollEnabled={true}
            contentContainerStyle={{ paddingBottom: verticalScale(20) }}
            ListFooterComponent={
              hasKrogerItems ? (
                <View style={styles.krogerCartSection}>
                  <Text style={styles.krogerCartLabel}>
                    {Strings.testPlanShopping_krogerChooseModality}
                  </Text>
                  <View style={styles.krogerModalityRow}>
                    <TouchableOpacity
                      style={styles.krogerModalityOption}
                      onPress={() =>
                        setKrogerModality((prev) =>
                          prev === KrogerModality.DELIVERY
                            ? null
                            : KrogerModality.DELIVERY,
                        )
                      }
                    >
                      {krogerModality === KrogerModality.DELIVERY ? (
                        <FilledCheckBox
                          width={verticalScale(22)}
                          height={verticalScale(22)}
                          color={Colors.tertiary}
                        />
                      ) : (
                        <CheckBox
                          width={verticalScale(22)}
                          height={verticalScale(22)}
                          color={Colors.tertiary}
                        />
                      )}
                      <Text style={styles.krogerModalityText}>
                        {Strings.testPlanShopping_krogerDelivery}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.krogerModalityOption}
                      onPress={() =>
                        setKrogerModality((prev) =>
                          prev === KrogerModality.PICKUP
                            ? null
                            : KrogerModality.PICKUP,
                        )
                      }
                    >
                      {krogerModality === KrogerModality.PICKUP ? (
                        <FilledCheckBox
                          width={verticalScale(22)}
                          height={verticalScale(22)}
                          color={Colors.tertiary}
                        />
                      ) : (
                        <CheckBox
                          width={verticalScale(22)}
                          height={verticalScale(22)}
                          color={Colors.tertiary}
                        />
                      )}
                      <Text style={styles.krogerModalityText}>
                        {Strings.testPlanShopping_krogerPickup}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity
                    style={[
                      styles.krogerCartButton,
                      !krogerModality && styles.krogerCartButtonDisabled,
                    ]}
                    // Sending needs exactly one of Delivery / Pickup, so the
                    // button stays disabled until one is picked. It must also
                    // *look* disabled: it used to carry the enabled style while
                    // disabled, so it read as a live button and silently
                    // swallowed every tap — which is indistinguishable from the
                    // transfer being broken, and was reported as exactly that.
                    disabled={!krogerModality || sendingToKroger}
                    onPress={handleSendToKrogerCart}
                  >
                    {sendingToKroger ? (
                      <ActivityIndicator color={Colors.primary} />
                    ) : (
                      <View style={styles.krogerCartButtonContent}>
                        <Text style={styles.krogerCartButtonText}>
                          {Strings.testPlanShopping_krogerSendToCart}
                        </Text>

                        <KrogerIcon
                          width={horizontalScale(51)}
                          height={verticalScale(29)}
                        />
                        <Text style={styles.krogerCartButtonText}>
                          {Strings.testPlanShopping_krogerCart}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </View>
              ) : null
            }
          />
        </TourGuideZone>
      </TourGuideZone>
      <ConfirmationModal
        visible={removeList}
        title={Strings.shoppingList_removeTitle}
        description={Strings.shoppingList_removeDescription}
        cancelText={Strings.testMealPlan_cancel}
        confirmText={
          removing ? Strings.testMealPlan_removing : Strings.testMealPlan_remove
        }
        onCancel={() => setRemoveList(false)}
        onConfirm={() => {
          handleDeleteList();
        }}
        isRemoving={removing}
      />
      <CreateNewListBottomSheet
        ref={createNewListRef}
        shoppingList={selectedList}
        onClose={() => {
          if (!isTourMode && listId) {
            showLoader();
            fetchListById(
              listId as string,
              (data) => {
                hideLoader();
                setSelectedList(data);
                // Editing the list can add, remove or reorder items, which
                // shifts every positional checkbox id. Rebuild the selection
                // from the stored flags instead of keeping stale ids that now
                // point at different ingredients.
                setChecked(
                  idsOfSelected(data?.ingredients || data?.items || []),
                );
                selectionDirtyRef.current = false;
              },
              (error) => {
                hideLoader();
                setSelectedList(null);
              },
            );
          }
        }}
        // Pass current data here
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
    paddingHorizontal: horizontalScale(20),
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    marginLeft: 8,
  },
  actions: { flexDirection: "row" },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginTop: 10,
  },
  listContainer: { flex: 1, marginTop: 10 },
  selectedTab: { alignItems: "center", justifyContent: "center" },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: verticalScale(8),
  },
  backText: {
    fontSize: moderateScale(14),
    color: Colors.tertiary,
    fontFamily: FontFamilies.ROBOTO_SEMI_BOLD,
    marginLeft: horizontalScale(30),
  },
  planTitle: {
    fontSize: moderateScale(21),
    fontFamily: FontFamilies.ROBOTO_SEMI_BOLD,
    color: Colors.primary,
  },
  planSubTitle: {
    fontSize: moderateScale(12),
    color: Colors.tertiary,
    fontFamily: FontFamilies.ROBOTO_REGULAR,
    marginTop: verticalScale(10),
  },
  editdelete: {
    flexDirection: "row",
    alignItems: "center",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: verticalScale(10),
  },
  sectionTitle: {
    fontSize: moderateScale(12),
    fontFamily: FontFamilies.ROBOTO_SEMI_BOLD,
    color: Colors.primary,
    marginBottom: verticalScale(10),
  },
  dividerRow: {
    height: moderateScale(1),
    backgroundColor: Colors.divider,
    flex: 1,

    marginBottom: verticalScale(10),
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
  cartQuantity: {
    fontFamily: FontFamilies.ROBOTO_REGULAR,
    fontSize: moderateScale(10),
    color: Colors.tertiary,
    marginTop: moderateScale(2),
  },
  progressbar: {
    marginVertical: verticalScale(20),
  },
  selectAllRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: verticalScale(12),
  },
  selectAllText: {
    fontFamily: FontFamilies.ROBOTO_SEMI_BOLD,
    fontSize: moderateScale(13),
    color: Colors.tertiary,
  },
  backIcon: {
    width: moderateScale(24),
    height: moderateScale(24),
    alignSelf: "flex-end",
    marginRight: horizontalScale(-11),
  },
  editButton: {
    marginRight: horizontalScale(20),
  },
  editIcon: {
    width: moderateScale(24),
    height: moderateScale(24),
    alignSelf: "flex-end",
  },
  deleteIcon: {
    width: moderateScale(24),
    height: moderateScale(24),
    alignSelf: "flex-end",
  },
  checkboxIcon: {
    marginRight: horizontalScale(10),
  },
  krogerCartSection: {
    marginTop: verticalScale(10),
    paddingVertical: verticalScale(12),
    paddingHorizontal: horizontalScale(10),
    alignContent: "center",
    alignItems: "center",
  },
  krogerCartLabel: {
    fontFamily: FontFamilies.ROBOTO_REGULAR,
    fontSize: moderateScale(15),
    color: Colors.tertiary,
    marginBottom: verticalScale(12),
  },
  krogerCartButtonDisabled: {
    opacity: 0.5,
  },
  krogerModalityRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: verticalScale(16),
    gap: horizontalScale(24),
  },
  krogerModalityOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: horizontalScale(8),
  },
  krogerModalityText: {
    fontFamily: FontFamilies.ROBOTO_MEDIUM,
    fontSize: moderateScale(14),
    color: Colors.primary,
  },
  krogerCartButton: {
    backgroundColor: "#9FB6D091",
    borderRadius: moderateScale(10),
    paddingVertical: verticalScale(10),
    alignItems: "center",
    justifyContent: "center",
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    width: "100%",
    overflow: "hidden",
  },
  krogerCartButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: horizontalScale(8),
  },
  krogerCartButtonText: {
    fontFamily: FontFamilies.ROBOTO_MEDIUM,
    fontSize: moderateScale(16),
    color: Colors._004A9B,
  },
  krogerLogoInline: {
    width: horizontalScale(60),
    height: verticalScale(20),
  },
});
