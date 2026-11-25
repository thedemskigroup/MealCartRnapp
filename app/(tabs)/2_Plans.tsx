import { activeImage, createlist, gradientclose } from "@/assets/images";
import BaseButton from "@/components/BaseButton";
import ConfirmationModal from "@/components/ConfirmationModal";
import CreateNewListBottomSheet, {
  CreateNewListBottomSheetRef,
} from "@/components/CreateNewListBottomSheet";
import { hideLoader, showLoader } from "@/components/Loader";
import SpaceBetweenButtons from "@/components/SpaceBetweenButtons";
import ThemeNormalButton from "@/components/ThemeNormalButton";
import { APP_ROUTES } from "@/constants/AppRoutes";
import { horizontalScale, layoutWidth, moderateScale, verticalScale } from "@/constants/Constants";
import { Strings } from "@/constants/Strings";
import { Colors, FontFamilies } from "@/constants/Theme";
import { useTourStep } from "@/context/TourStepContext";
import { MealStatus } from "@/reduxStore/appKeys";
import { useAppDispatch } from "@/reduxStore/hooks";
import { enrichMealsWithIngredients } from "@/reduxStore/slices/mealsSlice";
import { updatePlanLocally } from "@/reduxStore/slices/planSlice";
import { pushNavigation } from "@/utils/Navigation";
import { showErrorToast, showSuccessToast } from "@/utils/Toast";
import { usePlanViewModel } from "@/viewmodels/PlanViewModel";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { TourGuideZone, useTourGuideController } from "rn-tourguide";
const { height } = Dimensions.get("window");
const { width } = Dimensions.get("window");

const shoppingLists = [
  { id: "1", name: "Test Plan", created: "October 2, 2025", meals: "8 meals" },
  {
    id: "2",
    name: "Test Plan 2",
    created: "October 1, 2025",
    meals: "24 meals",
  },
];
const PlansScreen: React.FC = () => {
  const [pausePlan, setPausePlan] = useState<any>(null);
  const [pausing, setPausing] = useState(false);
  const [layoutReady, setLayoutReady] = useState(false);
  const [zoneReady, setZoneReady] = useState(false);
  const [generatedList, setGeneratedList] = useState<any>();
  const createNewListRef = useRef<CreateNewListBottomSheetRef>(null);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { start, stop } = useTourGuideController();
  const { shouldStartTour, setTriggerStartPlan } = useTourStep();
  const {
    enrichedPlans,
    fetchPlans,
    updatePlan,
    // `plans.loading || enriching` — true while a plan write is in flight and
    // while the resulting meal data is being resolved. Surfaced below so a slow
    // pause/resume never looks like nothing is happening.
    loading: isPlanDataBusy,
  } = usePlanViewModel();
  const filteredPlans = enrichedPlans;

  useEffect(() => {
    if (!shouldStartTour) {
      showLoader();
      fetchPlans(
        () => hideLoader(),
        (error) => {
          hideLoader();
        },
      );
    }
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchPlans(
      () => setRefreshing(false),
      (error) => {
        setRefreshing(false);
      },
    );
  };

  // A user can now have several plans started at once (e.g. to shop for an
  // upcoming plan early), so we render every STARTED plan as an active card.
  const activePlans = useMemo(
    () => filteredPlans.filter((plan) => plan.status === MealStatus.STARTED),
    [filteredPlans],
  );

  const otherPlans = useMemo(
    () => filteredPlans.filter((plan) => plan.status !== MealStatus.STARTED),
    [filteredPlans],
  );


  // Register callback for tour to start first plan
  useEffect(() => {
    if (otherPlans.length > 0) {
      const startFirstPlan = () => {
        const firstPlan = otherPlans[0];
        updateThePlan(firstPlan, MealStatus.STARTED);
      };
      setTriggerStartPlan(() => startFirstPlan);
    }

    return () => {
      setTriggerStartPlan(null);
    };
  }, [otherPlans, setTriggerStartPlan]);

  useFocusEffect(
    React.useCallback(() => {
      if (!zoneReady) return;

      const timeout = setTimeout(() => {
        // start(5); // 🔥 order 1, zone 1
      }, 100);

      return () => clearTimeout(timeout);
    }, [zoneReady]),
  );

  useFocusEffect(
    React.useCallback(() => {
      // Don't stop tour if it should be running
      if (!shouldStartTour) {
        stop();
      }
      let isActive = true;
      const timeout = setTimeout(() => {
        if (isActive) {
          // start();
        }
      }, 200);
      return () => {
        isActive = false;
        clearTimeout(timeout);
      };
    }, [shouldStartTour]),
  );

  // Utility to normalize Firestore/JS timestamps to JS Date
  const toDateObject = (timestamp: any): Date | null => {
    if (!timestamp) return null;
    if (typeof timestamp === "string") {
      return new Date(timestamp);
    } else if (timestamp.toDate) {
      return timestamp.toDate();
    } else if (timestamp.seconds) {
      return new Date(timestamp.seconds * 1000);
    } else {
      return new Date(timestamp);
    }
  };

  const formatDate = (timestamp: any) => {
    const date = toDateObject(timestamp);
    if (!date) return "";
    return date.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  const getTotalMeals = (plan: any) => {
    let total = 0;
    plan.days?.forEach((day: any) => {
      total += day.mealSlots?.length || 0;
    });
    return total;
  };

  /**
   * `useGlobalLoader: false` is for callers that are already inside a native
   * `Modal` (the pause confirmation). `Loader` is itself a `Modal`, and iOS
   * cannot present one modal while dismissing another — doing both in the same
   * commit leaves an orphaned modal window that swallows every touch, i.e. a
   * frozen screen. Those callers show progress inside their own modal instead.
   */
  const updateThePlan = async (
    plan: any,
    status: string,
    { useGlobalLoader = true }: { useGlobalLoader?: boolean } = {},
  ) => {
    if (shouldStartTour) {
      dispatch(
        updatePlanLocally({
          id: plan.id,
          status: status,
        }),
      );

      return;
    }

    if (useGlobalLoader) {
      showLoader();
    }

    await updatePlan(
      {
        id: plan.id,
        status: status,
      },
      () => {
        if (useGlobalLoader) {
          hideLoader();
        }
        showSuccessToast(Strings.plan_updated_successfully);
        // loadPlans()
      },
      (error) => {
        if (useGlobalLoader) {
          hideLoader();
        }
        showErrorToast(error || Strings.error_updating_plan);
      },
    );
  };

  const handleConfirmPause = async () => {
    if (!pausePlan || pausing) {
      return;
    }

    setPausing(true);
    try {
      await updateThePlan(pausePlan, MealStatus.PAUSED, {
        useGlobalLoader: false,
      });
    } finally {
      setPausing(false);
      // Close only once the work is done, so the confirmation modal is the only
      // modal transitioning at any moment.
      setPausePlan(null);
    }
  };

  const viewPlan = (planId: string) => {
    pushNavigation(APP_ROUTES.TestMealPlan, { planId });
  };

  const handleGenerateShoppingList = async (plan: any) => {
    showLoader();
    try {
      // 1. Gather all meals from all days/slots
      const allMeals = plan.days
        .flatMap((day: any) =>
          (day.mealSlots || []).map((slot: any) => slot.meal),
        )
        .filter(Boolean);

      // 2. Enrich meals
      const enrichedMeals = await enrichMealsWithIngredients(allMeals);

      // 3. Create a map for quick lookup
      const enrichedMap = new Map(enrichedMeals.map((meal) => [meal.id, meal]));

      // 4. Replace each meal in the plan with its enriched version
      const enrichedPlan = {
        ...plan,
        days: plan.days.map((day: any) => ({
          ...day,
          mealSlots: (day.mealSlots || []).map((slot: any) => ({
            ...slot,
            meal:
              slot.meal && enrichedMap.get(slot.meal.id)
                ? enrichedMap.get(slot.meal.id)
                : slot.meal,
          })),
        })),
      };

      const allIngredients = enrichedPlan.days
        .flatMap((day: any) =>
          (day.mealSlots || [])
            .map((slot: any) =>
              (slot.meal?.ingredients || []).map((ingredient: any) => ({
                ...ingredient,
                mealId: slot.meal?.id,
              })),
            )
            .flat(),
        )
        .filter(Boolean);

      // 2. Optionally, deduplicate by ingredientId+mealId if needed
      // (If you want to group by ingredientId only, you can further reduce)

      // 3. Prepare the shoppingList object for the bottom sheet
      const shoppingList = {
        listName: `${plan.planName} Shopping List` || "",
        shoppingDay: "", // or set as needed
        ingredients: allIngredients,
        // ...add other fields if needed
      };

      setGeneratedList(shoppingList);
      createNewListRef?.current?.expand();
      // pushNavigation(APP_ROUTES.TestPlanShopping, { enrichedPlan });

      // Now enrichedPlan has all meals enriched
      // You can use enrichedPlan for further logic or navigation
      // Example: pushNavigation(APP_ROUTES.TestPlanShopping, { enrichedPlan });
    } catch (error) {
      showErrorToast("Failed to generate shopping list");
    } finally {
      hideLoader();
    }
  };

  const renderActivePlan = (plan: any, index: number) => {
    // Tour zones are unique, so only wrap the first active card with them.
    const isFirst = index === 0;
    const wrapZone = (zone: number, node: React.ReactNode) =>
      isFirst ? (
        <TourGuideZone
          zone={zone}
          shape="rectangle"
          borderRadius={zone === 12 ? 5 : 16}
        >
          {node}
        </TourGuideZone>
      ) : (
        node
      );

    const card = (
      <View style={styles.activeCard}>
        <View style={styles.activeBadge}>
          <Image
            source={activeImage}
            resizeMode="contain"
            style={styles.activeImage}
          />
        </View>
        <Text style={styles.planTitle}>{plan.planName}</Text>
        <Text style={styles.planSubTitle}>
          {(() => {
            if (plan && plan.days && plan.days.length > 0) {
              const today = new Date();
              const isSameDay = (a: Date, b: Date) =>
                a.getFullYear() === b.getFullYear() &&
                a.getMonth() === b.getMonth() &&
                a.getDate() === b.getDate();

              let currentDayIndex = plan.days.findIndex((day: any) => {
                const dayDate = toDateObject(day.date);
                return dayDate && isSameDay(dayDate, today);
              });

              // If today is not found, show 0
              currentDayIndex =
                currentDayIndex === -1 ? 0 : currentDayIndex + 1;

              return `Day ${currentDayIndex} of ${plan.days.length}`;
            }
            return "";
          })()}
        </Text>
        <View style={styles.mealBox}>
          <Text style={styles.mealBoxTitle}>{Strings.plans_todaysMeal}</Text>
          {plan &&
            plan.days &&
            plan.days.length > 0 &&
            (() => {
              // Find today's date in plan.days
              const today = new Date();
              const isSameDay = (a: Date, b: Date) =>
                a.getFullYear() === b.getFullYear() &&
                a.getMonth() === b.getMonth() &&
                a.getDate() === b.getDate();

              const findDay = () => {
                for (const day of plan.days) {
                  if (day.date) {
                    const dayDate = toDateObject(day.date);
                    if (dayDate && isSameDay(dayDate, today)) {
                      return day;
                    }
                  }
                }
                return null;
              };
              const todayDay = findDay();
              if (
                !todayDay ||
                !todayDay.mealSlots ||
                todayDay.mealSlots.length === 0
              ) {
                return (
                  <Text style={styles.mealValue}>
                    {Strings.plans_notPlanned}
                  </Text>
                );
              }
              return (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.mealRow}
                >
                  {todayDay.mealSlots.map((slot: any, idx: number) => {
                    // Check if this is tour dummy data
                    const isTourDummy =
                      slot.mealPlanId === "dummy-meal-plan-id" ||
                      slot.mealId === "tour-dummy-meal";

                    const mealPlanName = isTourDummy
                      ? "Breakfast"
                      : slot.mealPlan?.name || `Meal ${idx + 1}`;

                    const mealName = isTourDummy
                      ? "Omlette"
                      : slot.meal?.name || Strings.plans_notPlanned;

                    return (
                      <View key={slot.mealPlanId} style={styles.mealColumn}>
                        <Text style={styles.mealLabelTop}>{mealPlanName}</Text>
                        <Text style={styles.mealValue}>{mealName}</Text>
                      </View>
                    );
                  })}
                </ScrollView>
              );
            })()}
        </View>
        <View style={styles.footer}>
          {wrapZone(
            11,
            <BaseButton
              title={Strings.plans_getShoppingList}
              gradientButton={true}
              textColor={Colors.background}
              width={layoutWidth * 0.53}
              textStyle={styles.createButtonText}
              rightChild={
                <Image
                  source={createlist}
                  resizeMode="contain"
                  style={styles.createListIcon}
                />
              }
              onPress={() => handleGenerateShoppingList(plan)}
            />,
          )}
          <ThemeNormalButton
            title={Strings.plans_viewPlan}
            textColor={Colors.background}
            containerStyle={styles.confirmButton}
            textStyle={styles.confirmButtonText}
            showElevation={false}
            onPress={() => viewPlan(plan.id)}
          />
        </View>
        <TouchableOpacity
          style={styles.pauseButton}
          onPress={() => setPausePlan(plan)}
        >
          {wrapZone(
            12,
            <Text style={styles.pauseText}>{Strings.plans_pausePlan}</Text>,
          )}
        </TouchableOpacity>
      </View>
    );

    return <View key={plan.id}>{wrapZone(10, card)}</View>;
  };

  const renderShoppingList = ({
    item,
    index,
  }: {
    item: any;
    index: number;
  }) => {
    const totalMeals = getTotalMeals(item);
    const startDate = formatDate(item.startDate);
    const isFirstItem = index === 0;

    const startButton = (
      <ThemeNormalButton
        title={
          item.status === MealStatus.PAUSED
            ? Strings.plans_resumePlan
            : Strings.plans_startPlan
        }
        textColor={Colors.primary}
        containerStyle={
          item.status === MealStatus.PAUSED
            ? styles.resumeButton
            : styles.addButton
        }
        textStyle={
          item.status === MealStatus.PAUSED
            ? styles.resumeButtonText
            : styles.addButtonText
        }
        onPress={() => updateThePlan(item, MealStatus.STARTED)}
      />
    );

    const cardContent = (
      <View style={styles.listCard}>
        <Text style={styles.listTitle}>{item.planName}</Text>

        <View style={styles.listItem}>
          <View>
            <Text style={styles.listDate}>
              {item.status === MealStatus.STARTED
                ? Strings.plans_started
                : Strings.plans_created}{" "}
              {startDate}
            </Text>
          </View>

          <Text style={styles.listDate}>
            {totalMeals} {Strings.meals}
          </Text>
        </View>
        <View style={styles.dividerRow} />
        <SpaceBetweenButtons
          containerStyle={styles.parentOfMarkDone}
          left={
            <ThemeNormalButton
              title={Strings.plans_viewPlan}
              textColor={Colors.primary}
              containerStyle={styles.addButton}
              textStyle={styles.addButtonText}
              onPress={() => viewPlan(item.id)}
            />
          }
          right={
            isFirstItem ? (
              <TourGuideZone zone={9} shape="rectangle" borderRadius={8}>
                {startButton}
              </TourGuideZone>
            ) : (
              startButton
            )
          }
        />
      </View>
    );

    // Wrap first item with zone 8
    if (isFirstItem) {
      return (
        <TourGuideZone zone={8} shape="rectangle" borderRadius={8}>
          {cardContent}
        </TourGuideZone>
      );
    }

    return cardContent;
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <View
        style={styles.headerRow}
        onLayout={() => setLayoutReady(true)}
      ></View>

      <ScrollView
        contentContainerStyle={styles.scrollViewContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[Colors.primary]}
            tintColor={Colors.primary}
          />
        }
      >
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>{Strings.plans_mealPlans}</Text>

          <TourGuideZone zone={5} shape="circle" maskOffset={10}>
            <View
              collapsable={false}
              style={styles.tourTarget}
              onLayout={() => setZoneReady(true)}
            >
              <TouchableOpacity
                onPress={() => pushNavigation(APP_ROUTES.CreateMealPlan)}
              >
                <Image
                  source={gradientclose}
                  style={styles.gradientCloseImage}
                />
              </TouchableOpacity>
            </View>
          </TourGuideZone>
        </View>

        {/* Pause/resume writes the plan and then re-resolves its meals; show that
            it is working rather than leaving the cards looking untouched. Not the
            global Loader — that is a blocking modal, and pausing runs from inside
            the confirmation modal. */}
        {isPlanDataBusy && !refreshing && (
          <View style={styles.busyRow}>
            <ActivityIndicator size="small" color={Colors.primary} />
            <Text style={styles.busyText}>{Strings.plans_updating}</Text>
          </View>
        )}

        {activePlans.length === 0 ? (
          <>
            <View style={styles.noActivePlan}>
              <Text style={styles.noActiveText}>
                {Strings.plans_noActivePlan}
              </Text>
            </View>
            <View style={styles.dividerRowSpaced} />
          </>
        ) : (
          activePlans.map((plan, index) => renderActivePlan(plan, index))
        )}
        {otherPlans && otherPlans.length > 0 && (
          <View>
            <Text style={styles.sectionTitle}>
              {Strings.plans_yourOtherPlans}
            </Text>

            <FlatList
              data={otherPlans}
              keyExtractor={(item) => item.id}
              renderItem={renderShoppingList}
              scrollEnabled={false}
            />
          </View>
        )}
      </ScrollView>

      <ConfirmationModal
        visible={!!pausePlan}
        title={Strings.plans_pauseMealPlan}
        description={Strings.plans_pauseDescription}
        cancelText={Strings.plans_cancel}
        confirmText={pausing ? Strings.plans_pausing : Strings.plans_pause}
        isRemoving={pausing}
        onCancel={() => {
          if (!pausing) {
            setPausePlan(null);
          }
        }}
        onConfirm={handleConfirmPause}
      />
      <CreateNewListBottomSheet
        ref={createNewListRef}
        shoppingList={generatedList}
        from="plan"
        onClose={() => createNewListRef?.current?.close()}
      />

      {/* <Loader visible={isLoading} /> */}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  text: {
    fontSize: moderateScale(18),
    fontWeight: "bold",
    color: Colors.primary,
  },
  container: {
    flex: 1,
    backgroundColor: Colors.white,
    paddingHorizontal: horizontalScale(20),
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: moderateScale(21),
    color: Colors.primary,
    fontFamily: FontFamilies.ROBOTO_SEMI_BOLD,
  },

  activeCard: {
    borderRadius: moderateScale(16),
    borderWidth: moderateScale(1),
    borderColor: Colors._667D4C,
    padding: horizontalScale(18),
    marginBottom: verticalScale(20),
  },
  activeBadge: {
    position: "absolute",
    top: moderateScale(-20),
    right: moderateScale(-6),
    borderTopRightRadius: 18,
    borderBottomLeftRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 4,
    zIndex: 2,
  },

  planTitle: {
    fontSize: moderateScale(21),
    fontFamily: FontFamilies.ROBOTO_MEDIUM,
    color: Colors.primary,
    marginBottom: 2,
  },
  planSubTitle: {
    fontSize: moderateScale(12),
    color: Colors.tertiary,
    fontFamily: FontFamilies.ROBOTO_REGULAR,
    marginTop: verticalScale(8),

    marginBottom: verticalScale(12),
  },
  mealBox: {
    backgroundColor: Colors.boxbackground,
    borderRadius: moderateScale(8),
    paddingHorizontal: horizontalScale(10),
    paddingVertical: verticalScale(18),
  },
  mealBoxTitle: {
    fontSize: moderateScale(12),
    fontFamily: FontFamilies.ROBOTO_MEDIUM,
    color: Colors.primary,
    marginBottom: 6,
  },
  mealRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingRight: horizontalScale(4),
  },
  mealLabelTop: {
    fontSize: moderateScale(12),
    fontFamily: FontFamilies.ROBOTO_REGULAR,
    color: Colors.tertiary,
    marginVertical: verticalScale(8),
  },
  mealLabel: {
    fontSize: moderateScale(12),
    fontFamily: FontFamilies.ROBOTO_REGULAR,
    color: Colors.tertiary,
  },
  mealValue: {
    fontSize: moderateScale(12),
    color: Colors.primary,
    fontFamily: FontFamilies.ROBOTO_REGULAR,
  },
  cardBtnRow: {
    flexDirection: "row",
    marginBottom: 8,
  },
  primaryBtn: {
    flex: 1,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    marginRight: 8,
  },
  primaryBtnText: {
    fontSize: 16,
  },

  secondaryBtnText: {
    fontSize: 16,
  },
  busyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: horizontalScale(8),
    paddingVertical: verticalScale(8),
  },
  busyText: {
    fontFamily: FontFamilies.ROBOTO_REGULAR,
    fontSize: moderateScale(12),
    color: Colors.tertiary,
  },
  pauseText: {
    fontSize: moderateScale(14),
    fontFamily: FontFamilies.ROBOTO_MEDIUM,
    color: Colors.error,
    textAlign: "center",
  },
  sectionTitle: {
    fontSize: moderateScale(21),
    fontFamily: FontFamilies.ROBOTO_SEMI_BOLD,
    color: Colors.primary,
    marginBottom: moderateScale(10),
  },

  otherCardRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 2,
  },
  otherPlanTitle: {
    fontSize: 16,
  },
  otherPlanMeals: {
    fontSize: 13,
  },
  otherPlanDate: {
    fontSize: 13,
    marginBottom: 10,
  },
  otherBtnRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },

  primaryBtnOutlineText: {
    fontSize: 16,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: verticalScale(18),
  },
  cancelButton: {
    flex: 1,
    backgroundColor: Colors.white,
    borderColor: Colors.borderColor,
    borderWidth: moderateScale(1),
    borderRadius: moderateScale(8),
    paddingVertical: verticalScale(12),
    marginRight: horizontalScale(8),
    alignItems: "center",
  },
  cancelButtonText: {
    fontFamily: FontFamilies.ROBOTO_MEDIUM,
    color: Colors.primary,
    fontSize: moderateScale(14),
  },
  confirmButton: {
    marginLeft: horizontalScale(8),
    width: "32%",
    borderWidth: moderateScale(1),
    borderColor: Colors.borderColor,
  },
  confirmButtonText: {
    fontFamily: FontFamilies.ROBOTO_MEDIUM,
    color: Colors.primary,
    fontSize: moderateScale(14),
  },
  createButtonText: {
    fontFamily: FontFamilies.ROBOTO_MEDIUM,
    color: Colors.white,
    fontSize: moderateScale(16),
  },
  pauseButton: {
    marginTop: verticalScale(10),
    alignSelf: "center",
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
  resumeButton: {
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
  resumeButtonText: {
    fontFamily: FontFamilies.ROBOTO_MEDIUM,
    color: Colors.white,
    fontSize: moderateScale(14),
  },
  dividerRow: {
    height: moderateScale(1),
    backgroundColor: Colors.divider,
    flex: 1,
    marginVertical: verticalScale(10),
    marginTop: verticalScale(15),
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

  noActivePlan: {
    borderRadius: moderateScale(4),
    borderWidth: moderateScale(1),
    borderColor: Colors.borderColor,
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.white,
    paddingVertical: verticalScale(35),
  },
  noActiveText: {
    fontSize: moderateScale(14),
    fontFamily: FontFamilies.ROBOTO_MEDIUM,
    color: Colors.tertiary,
  },
  addButtonWrapper: {
    width: moderateScale(56),
    height: moderateScale(56),
  },
  tourTarget: {
    width: 56,
    height: 56,
    justifyContent: "center",
    alignItems: "center",
  },

  touchable: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },

  image: {
    width: 56,
    height: 56,
  },
  scrollViewContent: {
    paddingBottom: 32,
  },
  gradientCloseImage: {
    width: moderateScale(56),
    height: moderateScale(56),
    alignSelf: "flex-end",
    marginRight: horizontalScale(-11),
  },
  dividerRowSpaced: {
    height: moderateScale(1),
    backgroundColor: Colors.divider,
    flex: 1,
    marginVertical: verticalScale(20),
  },
  activeImage: {
    width: moderateScale(56),
    height: moderateScale(56),
    alignSelf: "flex-end",
    marginRight: horizontalScale(-11),
  },
  mealColumn: {
    width: layoutWidth * 0.28,
    marginRight: horizontalScale(12),
  },
  createListIcon: {
    width: moderateScale(18),
    height: moderateScale(18),
  },
});

export default PlansScreen;
