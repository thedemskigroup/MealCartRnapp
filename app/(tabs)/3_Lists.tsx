import { gradientclose, whitecorrect } from "@/assets/images";
import CreateNewListBottomSheet, {
  CreateNewListBottomSheetRef,
} from "@/components/CreateNewListBottomSheet";
import { hideLoader, showLoader } from "@/components/Loader";
import SpaceBetweenButtons from "@/components/SpaceBetweenButtons";
import ThemeNormalButton from "@/components/ThemeNormalButton";
import { APP_ROUTES } from "@/constants/AppRoutes";
import {
  horizontalScale,
  moderateScale,
  verticalScale,
} from "@/constants/Constants";
import { Strings } from "@/constants/Strings";
import { Colors, FontFamilies } from "@/constants/Theme";
import { useTourStep } from "@/context/TourStepContext";
import { useAppSelector } from "@/reduxStore/hooks";
import { pushNavigation } from "@/utils/Navigation";
import { useShoppingListViewModel } from "@/viewmodels/ShoppingListViewModel";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Dimensions,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { TourGuideZone } from "rn-tourguide";

const { height } = Dimensions.get("window");
const { width } = Dimensions.get("window");

const ListsScreen: React.FC = () => {
  const router = useRouter();
  const user = useAppSelector((state) => state.auth.user);
  const createNewListRef = useRef<CreateNewListBottomSheetRef>(null);
  const [markedItems, setMarkedItems] = useState<Set<string>>(new Set());
  const { shouldStartTour, setTriggerOpenCreateList } = useTourStep();

  const { shoppingLists, loading, fetchShoppingLists, deleteShoppingListData } =
    useShoppingListViewModel();

  // Distinguishes "you have no lists" from "the fetch failed". Both used to
  // render the same empty FlatList -- a blank screen with no explanation and
  // no way to retry, because the error callback only hid the loader.
  const [loadFailed, setLoadFailed] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  const loadLists = () => {
    if (!user?.id) return;
    setLoadFailed(false);
    showLoader();
    fetchShoppingLists(
      user.id,
      () => {
        hideLoader();
        setHasLoaded(true);
      },
      () => {
        hideLoader();
        setHasLoaded(true);
        setLoadFailed(true);
      },
      10,
      null,
    );
  };

  useEffect(() => {
    if (user?.id && !shouldStartTour) {
      loadLists();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Register callback to open CreateNewListBottomSheet during tour
  useEffect(() => {
    const openCreateList = () => {
      createNewListRef.current?.expand();
    };
    setTriggerOpenCreateList(() => openCreateList);

    return () => {
      setTriggerOpenCreateList(null);
    };
  }, [setTriggerOpenCreateList]);

  const formatDate = (date: any) => {
    if (!date) return "N/A";

    // Handle Firestore Timestamp
    if (date.toDate) {
      return date.toDate().toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    }

    // Handle Date object
    if (date instanceof Date) {
      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    }

    return "N/A";
  };

  const handleDeleteList = (listId: string) => {
    // Mark the item as pressed to change its appearance
    setMarkedItems((prev) => new Set(prev).add(listId));

    // Delete after a short delay to show the visual change
    setTimeout(() => {
      deleteShoppingListData(
        listId,
        () => {
          setMarkedItems((prev) => {
            const newSet = new Set(prev);
            newSet.delete(listId);
            return newSet;
          });
        },
        (error) => {
          alert("Error deleting shopping list: " + error);
          setMarkedItems((prev) => {
            const newSet = new Set(prev);
            newSet.delete(listId);
            return newSet;
          });
        },
      );
    }, 300);
  };

  const renderShoppingList = ({ item }: { item: any }) => {
    const ingredientCount = item.ingredients?.length || 0;
    const isMarked = markedItems.has(item.id);

    return (
      <View style={styles.listCard}>
        <Text style={styles.listTitle}>{item.listName || "Untitled List"}</Text>

        <View style={styles.listItem}>
          <View>
            <Text style={styles.listDate}>
              {Strings.lists_created} {formatDate(item.createdAt)}
            </Text>
          </View>

          <Text style={styles.listDate}>
            {ingredientCount}{" "}
            {ingredientCount === 1 ? Strings.lists_item : Strings.lists_items}
          </Text>
        </View>
        <View style={styles.dividerRow} />
        <SpaceBetweenButtons
          containerStyle={styles.parentOfMarkDone}
          left={
            <ThemeNormalButton
              title={Strings.lists_markDone}
              textColor={isMarked ? Colors.white : Colors.primary}
              containerStyle={isMarked ? styles.markedButton : styles.addButton}
              textStyle={
                isMarked ? styles.markedButtonText : styles.addButtonText
              }
              showElevation={false}
              onPress={() => handleDeleteList(item.id)}
              rightChild={
                isMarked ? (
                  <Image
                    source={whitecorrect}
                    style={{
                      width: moderateScale(20),
                      height: moderateScale(20),
                    }}
                  />
                ) : null
              }
            />
          }
          right={
            <ThemeNormalButton
              title={Strings.lists_viewList}
              textColor="#fff"
              containerStyle={styles.addButton}
              showElevation={false}
              textStyle={styles.addButtonText}
              onPress={() =>
                pushNavigation(APP_ROUTES.TestPlanShopping, { listId: item.id })
              }
            />
          }
        />
      </View>
    );
  };

  const renderEmptyState = () => {
    // The global loader is already covering the screen on the first fetch, so
    // don't flash an empty state underneath it.
    if (!hasLoaded) return null;

    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>
          {loadFailed ? Strings.lists_loadErrorTitle : Strings.lists_empty}
        </Text>
        <Text style={styles.emptyText}>
          {loadFailed ? Strings.lists_loadError : Strings.lists_emptySubtitle}
        </Text>
        {loadFailed ? (
          <ThemeNormalButton
            title={Strings.lists_retry}
            onPress={loadLists}
            containerStyle={styles.retryButton}
          />
        ) : null}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <View style={styles.parentMymeal}>
        <Text style={styles.title}>{Strings.lists_shoppingLists}</Text>
        <TourGuideZone zone={13} shape="circle" borderRadius={50}>
          <TouchableOpacity
            style={styles.addNewListButton}
            onPress={() => createNewListRef.current?.expand()}
          >
            <Image
              source={gradientclose}
              resizeMode="contain"
              style={styles.gradientCloseImage}
            />
          </TouchableOpacity>
        </TourGuideZone>
      </View>

      <FlatList
        data={shoppingLists}
        keyExtractor={(item) => item.id}
        renderItem={renderShoppingList}
        contentContainerStyle={
          shoppingLists?.length
            ? { paddingBottom: verticalScale(100) }
            : styles.emptyListContent
        }
        ListEmptyComponent={renderEmptyState}
      />
      <CreateNewListBottomSheet ref={createNewListRef} />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingHorizontal: horizontalScale(20),
  },
  text: {
    fontSize: moderateScale(18),
    fontWeight: "bold",
    color: Colors.primary,
  },
  parentMymeal: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: verticalScale(20),
  },
  title: {
    fontFamily: FontFamilies.ROBOTO_SEMI_BOLD,
    fontSize: moderateScale(21),
    color: Colors.primary,
  },
  emptyListContent: {
    flexGrow: 1,
    justifyContent: "center",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: horizontalScale(24),
    paddingBottom: verticalScale(80),
  },
  emptyTitle: {
    fontFamily: FontFamilies.ROBOTO_SEMI_BOLD,
    fontSize: moderateScale(18),
    color: Colors.primary,
    textAlign: "center",
    marginBottom: verticalScale(8),
  },
  emptyText: {
    fontFamily: FontFamilies.ROBOTO_REGULAR,
    fontSize: moderateScale(14),
    color: Colors.tertiary,
    textAlign: "center",
    lineHeight: moderateScale(20),
  },
  retryButton: {
    marginTop: verticalScale(20),
    paddingHorizontal: horizontalScale(28),
  },
  listItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: verticalScale(3),
  },
  listTitle: {
    fontFamily: FontFamilies.ROBOTO_MEDIUM,
    fontSize: moderateScale(14),
    color: Colors.primary,
  },
  listDate: {
    fontFamily: FontFamilies.ROBOTO_REGULAR,
    fontSize: moderateScale(10),
    color: Colors.tertiary,
    marginTop: verticalScale(4),
  },
  addButton: {
    backgroundColor: Colors.white,
    borderColor: Colors.borderColor,
    borderWidth: moderateScale(1),
    borderRadius: moderateScale(8),
    paddingVertical: verticalScale(3),
    paddingHorizontal: horizontalScale(4),
  },
  markedButton: {
    backgroundColor: Colors._3A4D25,
    borderColor: Colors._3A4D25,
    borderWidth: moderateScale(1),
    borderRadius: moderateScale(8),
    paddingVertical: verticalScale(3),
    paddingHorizontal: horizontalScale(4),
  },
  addButtonText: {
    fontFamily: FontFamilies.ROBOTO_MEDIUM,
    color: Colors.primary,
    fontSize: moderateScale(14),
  },
  markedButtonText: {
    fontFamily: FontFamilies.ROBOTO_MEDIUM,
    color: Colors.white,
    fontSize: moderateScale(14),
  },
  dividerRow: {
    height: moderateScale(1),
    backgroundColor: Colors.divider,
    flex: 1,
    marginVertical: verticalScale(18),
  },
  listCard: {
    backgroundColor: Colors.white,
    borderRadius: moderateScale(8),
    marginVertical: verticalScale(6),
    paddingHorizontal: moderateScale(9),
    marginHorizontal: horizontalScale(2),
    paddingVertical: verticalScale(11),

    elevation: 4,

    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  parentOfMarkDone: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  addNewListButton: {
    marginLeft: horizontalScale(6),
  },
  gradientCloseImage: {
    width: moderateScale(56),
    height: moderateScale(56),
    alignSelf: "flex-end",
    marginRight: horizontalScale(-17),
  },
});

export default ListsScreen;
