import {
  calendaricon,
  closeIcon,
  iconback,
  iconCalendar,
  plusmeal,
} from "@/assets/images";
import AddItemToList from "@/components/AddItemToList";
import BaseButton from "@/components/BaseButton";
import CustomDateTimePicker from "@/components/DateTimePicker";
import { hideLoader, showLoader } from "@/components/Loader";
import ThemeNormalButton from "@/components/ThemeNormalButton";
import { horizontalScale, layoutWidth, moderateScale, setEndOfDay, verticalScale } from "@/constants/Constants";
import { Strings } from "@/constants/Strings";
import { Colors, FontFamilies } from "@/constants/Theme";
import { useTourStep } from "@/context/TourStepContext";
import { CREATE_MEAL_PLAN, MealStatus } from "@/reduxStore/appKeys";
import { useAppDispatch, useAppSelector } from "@/reduxStore/hooks";
import {
  addPlanLocally,
  DayData,
  removeTourPlan,
} from "@/reduxStore/slices/planSlice";
import { formatSlashDate } from "@/utils/DateFormat";
import { backNavigation } from "@/utils/Navigation";
import { showErrorToast, showSuccessToast } from "@/utils/Toast";
import { EnrichedPlan, usePlanViewModel } from "@/viewmodels/PlanViewModel";
import { useProfileViewModel } from "@/viewmodels/ProfileViewModel";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  Dimensions,
  FlatList,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { TourGuideZone } from "rn-tourguide";

const days = ["Monday", "Tuesday", "Wednesday", "Thursday"];
const meals = ["Breakfast", "Lunch", "Dinner"];
const { height } = Dimensions.get("window");
const { width } = Dimensions.get("window");

interface SelectedMealSlot {
  dayTitle: string;
  mealPlanName: string;
  meal: any;
}

export default function CreateMealPlan({}) {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const params = useLocalSearchParams();
  const planParam = params?.plan as string;
  const { mealPlans, fetchMealPlans, profileLoading } = useProfileViewModel();
  const { addPlan, updatePlan, loading: planLoading } = usePlanViewModel();
  const {
    setTriggerMealBoxPress,
    setTriggerSavePlan,
    shouldStartTour,
    setCleanupTourData,
  } = useTourStep();

  const user = useAppSelector((state) => state.auth.user);

  const [planName, setPlanName] = useState("");
  const [startDate, setStartDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [addToListVisible, setAddToListVisible] = useState(false);
  const [selectedMealSlots, setSelectedMealSlots] = useState<
    Record<string, any>
  >({});
  const [currentSlot, setCurrentSlot] = useState<{
    dayTitle: string;
    mealPlanName: string;
  } | null>(null);

  useEffect(() => {
    fetchMealPlans();
  }, []);

  useEffect(() => {
    if (planParam && mealPlans.length > 0) {
      try {
        const existingPlan: EnrichedPlan = JSON.parse(planParam);
        setPlanName(existingPlan.planName);

        const planStartDate = existingPlan.startDate?.seconds
          ? new Date(existingPlan.startDate.seconds * 1000)
          : new Date(existingPlan.startDate);
        setStartDate(planStartDate);

        // Populate selected meal slots from existing plan
        const slots: Record<string, any> = {};
        existingPlan.days.forEach((day: any) => {
          day.mealSlots.forEach((slot: any) => {
            const slotKey = `${day.dayTitle}-${slot.mealPlan?.name}`;
            slots[slotKey] = slot.meal;
          });
        });
        setSelectedMealSlots(slots);
      } catch (error) {}
    }
  }, [planParam, mealPlans]);

  const getDayName = (dayIndex: number) => {
    const dayNames = [
      Strings.days.sunday,
      Strings.days.monday,
      Strings.days.tuesday,
      Strings.days.wednesday,
      Strings.days.thursday,
      Strings.days.friday,
      Strings.days.saturday,
    ];
    return dayNames[dayIndex];
  };

  const generateWeekDays = (selectedDate: Date) => {
    const days = [];
    const dayOfWeek = selectedDate.getDay(); // 0 = Sunday, 1 = Monday, etc.

    // Calculate days remaining in the week (until Sunday)
    // If Sunday (0), that's the end of week, so 0 days remaining
    // If Monday (1), 6 days remaining, etc.
    const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;

    const sortedMealPlans = [...mealPlans].sort((a, b) => {
      // Handle cases where createdAt might be undefined
      const aTime = a.createdAt?.seconds || 0;
      const bTime = b.createdAt?.seconds || 0;
      return aTime - bTime;
    });

    // Get meal plan names from fetched meal plans
    const mealPlanNames =
      sortedMealPlans.length > 0
        ? sortedMealPlans.map((plan) => plan.name)
        : [Strings.plans_breakfast, Strings.plans_lunch, Strings.plans_dinner];

    for (let i = 0; i <= daysUntilSunday; i++) {
      const currentDate = new Date(selectedDate);
      currentDate.setDate(selectedDate.getDate() + i);

      days.push({
        title: getDayName(currentDate.getDay()),
        date: currentDate,
        meals: mealPlanNames,
      });
    }

    return days;
  };

  const handleMealBoxPress = (dayTitle: string, mealPlanName: string) => {
    const slotKey = `${dayTitle}-${mealPlanName}`;
    const existingMeal = selectedMealSlots[slotKey];

    // Don't open modal if a meal is already selected
    if (existingMeal) {
      return;
    }

    setCurrentSlot({ dayTitle, mealPlanName });
    setAddToListVisible(true);
  };

  const handleMealSelect = (meal: any) => {
    if (currentSlot) {
      const slotKey = `${currentSlot.dayTitle}-${currentSlot.mealPlanName}`;
      setSelectedMealSlots((prev) => ({
        ...prev,
        [slotKey]: meal,
      }));
    }
  };

  const getSelectedMeal = (dayTitle: string, mealPlanName: string) => {
    const slotKey = `${dayTitle}-${mealPlanName}`;
    return selectedMealSlots[slotKey];
  };

  const days = useMemo(
    () => generateWeekDays(startDate),
    [startDate, mealPlans],
  );

  // Register callback for tour to add dummy meal to first slot
  useEffect(() => {
    const addDummyMealToFirstSlot = () => {
      if (days.length > 0 && days[0].meals.length > 0) {
        const firstDay = days[0].title;
        const firstMeal = days[0].meals[0];
        const slotKey = `${firstDay}-${firstMeal}`;

        // Create a dummy meal object
        const dummyMeal = {
          id: "tour-dummy-meal",
          name: "Omlette",
          category: "Breakfast",
          prepTime: "30 min",
          difficulty: "Easy",
          imageUrl: null,
        };

        setSelectedMealSlots((prev) => ({
          ...prev,
          [slotKey]: dummyMeal,
        }));

        // Set a default plan name for the tour
        if (!planName) {
          setPlanName("My First Meal Plan");
        }
      }
    };

    setTriggerMealBoxPress(() => addDummyMealToFirstSlot);

    return () => {
      setTriggerMealBoxPress(null);
    };
  }, [days]);

  // Register saveMealPlan callback for tour
  useEffect(() => {
    setTriggerSavePlan(() => () => saveMealPlan());

    return () => {
      setTriggerSavePlan(null);
    };
  }, []);

  // Register cleanup function to remove tour data when tour completes
  useEffect(() => {
    const cleanup = () => {
      // Remove tour plan from Redux
      dispatch(removeTourPlan());

      // Clear dummy meal from selected slots
      setSelectedMealSlots((prev) => {
        const updated = { ...prev };
        Object.keys(updated).forEach((key) => {
          if (updated[key]?.id === "tour-dummy-meal") {
            delete updated[key];
          }
        });
        return updated;
      });

      // Reset plan name if it's the default tour name
      if (planName === "My First Meal Plan") {
        setPlanName("");
      }
    };

    setCleanupTourData(() => cleanup);

    return () => {
      setCleanupTourData(null);
    };
  }, [dispatch, planName]);

  function renderDayCard({ item, index }: { item: any; index: number }) {
    const formattedDate = formatSlashDate(item.date);

    const content = (
      <View style={styles.daySection}>
        <View style={styles.dayHeader}>
          <Text style={styles.dayTitle}>{item.title}</Text>
          <Text style={styles.dayDate}>{formattedDate}</Text>
        </View>
        <ScrollView
          contentContainerStyle={styles.mealRow}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {item.meals.map((mealPlanName: string, idx: number) => {
            const selectedMeal = getSelectedMeal(item.title, mealPlanName);
            const isFirstMealSlot = index === 0 && idx === 0;
            const hasDummyMeal =
              isFirstMealSlot && selectedMeal?.id === "tour-dummy-meal";

            const mealBoxContent = (
              <View key={mealPlanName + idx} style={styles.mealCol}>
                <Text style={styles.mealLabel}>{mealPlanName}</Text>
                <TouchableOpacity
                  style={[
                    styles.mealBox,
                    selectedMeal && styles.mealBoxWithMeal,
                  ]}
                  onPress={() => handleMealBoxPress(item.title, mealPlanName)}
                >
                  {selectedMeal ? (
                    <View style={styles.selectedMealContent}>
                      <Text
                        style={styles.selectedMealName}
                        numberOfLines={2}
                        ellipsizeMode="tail"
                      >
                        {selectedMeal.name}
                      </Text>
                      <TouchableOpacity
                        style={styles.removeMealIcon}
                        onPress={(e) => {
                          const slotKey = `${item.title}-${mealPlanName}`;
                          setSelectedMealSlots((prev) => {
                            const updated = { ...prev };
                            delete updated[slotKey];
                            return updated;
                          });
                        }}
                      >
                        <Image
                          source={closeIcon}
                          style={styles.closeIcon}
                          resizeMode="contain"
                        />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <Image
                      source={plusmeal}
                      resizeMode="contain"
                      style={styles.plusMealIcon}
                    />
                  )}
                </TouchableOpacity>
              </View>
            );

            // Wrap first meal box with zone 7 only when it has the dummy meal
            if (hasDummyMeal) {
              return (
                <TourGuideZone
                  key={mealPlanName + idx}
                  zone={7}
                  shape="rectangle"
                  borderRadius={8}
                >
                  {mealBoxContent}
                </TourGuideZone>
              );
            }

            return mealBoxContent;
          })}
        </ScrollView>
      </View>
    );

    // Wrap only the first item (index 0) with TourGuideZone
    if (index === 0) {
      return (
        <TourGuideZone zone={6} shape="rectangle" borderRadius={16}>
          {content}
        </TourGuideZone>
      );
    }

    return content;
  }

  const validateMealPlan = (): boolean => {
    const anyMealSelected = Object.keys(selectedMealSlots).length > 0;

    if (planName.trim() === "") {
      alert(Strings.error_enter_plan_name);
      return false;
    }

    if (!anyMealSelected) {
      alert(Strings.error_select_meal_for_any_day);
      return false;
    }

    return true;
  };

  const getMealPlanId = (mealPlanName: string) => {
    const plan = mealPlans.find((p) => p.name === mealPlanName);
    return plan?.id;
  };

  const buildDaysData = () => {
    const daysData = days
      .map((day) => {
        const mealSlots = day.meals
          .map((mealPlanName: string) => {
            const selectedMeal = getSelectedMeal(day.title, mealPlanName);
            if (!selectedMeal) return null;
            const mealPlanId = getMealPlanId(mealPlanName);
            return {
              mealPlanId: mealPlanId!,
              mealId: selectedMeal.id,
            };
          })
          .filter(Boolean) as Array<{ mealPlanId: string; mealId: string }>;

        if (mealSlots.length === 0) return null;

        return {
          dayTitle: day.title,
          date: day.date,
          mealSlots,
        };
      })
      .filter((daySlot): daySlot is DayData => daySlot !== null);

    return daysData;
  };

  const buildDummyDaysData = () => {
    // Build dummy data for tour with the tour dummy meal
    if (days.length === 0) return [];

    const firstDay = days[0];
    const firstMealPlan = "Breakfast"; // Breakfast

    const dummyDaysData: DayData[] = [
      {
        dayTitle: firstDay.title,
        date: firstDay.date,
        mealSlots: [
          {
            mealPlanId: "dummy-meal-plan-id",
            mealId: "tour-dummy-meal",
          },
        ],
      },
    ];

    return dummyDaysData;
  };

  const calculateEndDate = (daysData: DayData[]) => {
    const lastDayWithMeals =
      daysData.length > 0 ? daysData[daysData.length - 1] : null;
    const endDate = lastDayWithMeals
      ? setEndOfDay(lastDayWithMeals.date)
      : setEndOfDay(startDate);

    return endDate;
  };

  const saveMealPlan = () => {
    // Ensure plan name is set (especially for tour)

    // If tour is active, add plan locally to Redux without API call
    if (shouldStartTour) {
      // showLoader();

      const daysData = buildDummyDaysData();
      const endDate = calculateEndDate(daysData);

      const localPlan = {
        id: `tour-plan-${Date.now()}`,
        uid: user?.id || "tour-user",
        planName: planName.trim() || "My First Meal Plan",
        startDate: startDate,
        endDate: endDate,
        status: MealStatus.CREATED,
        createdAt: new Date(),
        updatedAt: new Date(),
        days: daysData,
      };

      dispatch(addPlanLocally(localPlan));

      setTimeout(() => {
        hideLoader();
        // showSuccessToast(Strings.plan_saved_successfully);
        backNavigation();
      }, 500);
      return;
    }
    if (!validateMealPlan()) return;

    showLoader();
    const daysData = buildDaysData();
    const endDate = calculateEndDate(daysData);

    const planPayload = {
      planName: planName.trim() || Strings.unknown_plan,
      startDate: startDate,
      endDate: endDate,
      status: MealStatus.CREATED,
      days: daysData,
    };

    addPlan(
      planPayload,
      (response) => {
        hideLoader();
        showSuccessToast(Strings.plan_saved_successfully);
        backNavigation();
      },
      (error) => {
        hideLoader();
        showErrorToast(error || Strings.error_adding_plan);
      },
    );
  };

  const updateMealPlan = () => {
    if (!planParam) {
      alert(Strings.error_updating_plan || "Cannot update plan");
      return;
    }

    if (!validateMealPlan()) return;

    showLoader();

    const daysData = buildDaysData();
    const endDate = calculateEndDate(daysData);

    const existingPlan: EnrichedPlan = JSON.parse(planParam);
    const planPayload = {
      id: existingPlan.id,
      planName: planName || Strings.unknown_plan,
      startDate: startDate,
      endDate: endDate,
      status: existingPlan.status,
      days: daysData,
    };

    updatePlan(
      planPayload,
      (response) => {
        hideLoader();
        showSuccessToast(
          Strings.plan_updated_successfully || "Plan updated successfully",
        );
        backNavigation();
      },
      (error) => {
        hideLoader();
        showErrorToast(
          error || Strings.error_updating_plan || "Failed to update plan",
        );
      },
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => router.back()}>
          <Image
            source={iconback}
            resizeMode="contain"
            style={styles.backIconImage}
          />
        </TouchableOpacity>
        <Text style={styles.backText}>
          {Strings.createMealPlan_backToPlans}
        </Text>
      </View>
      <Text style={styles.label}>{Strings.createMealPlan_yourMealPlan}</Text>
      <TextInput
        style={styles.input}
        placeholder={Strings.createMealPlan_mySpecialMealPlan}
        placeholderTextColor={Colors.tertiary}
        value={planName}
        onChangeText={setPlanName}
      />

      <Text style={styles.label}>{Strings.createMealPlan_startingDate}</Text>
      <View style={styles.inputRow}>
        <TextInput
          style={styles.dateInput}
          value={formatSlashDate(startDate)}
          editable={false}
        />
        <TouchableOpacity onPress={() => setShowDatePicker(true)}>
          <Image
            source={calendaricon}
            style={styles.calendarIcon}
            resizeMode="contain"
          />
        </TouchableOpacity>
      </View>

      <CustomDateTimePicker
        mode="date"
        value={startDate}
        visible={showDatePicker}
        onChange={(date) => {
          setStartDate(date);
        }}
        onClose={() => setShowDatePicker(false)}
      />
      <FlatList
        data={days}
        keyExtractor={(item) => item.title}
        renderItem={renderDayCard}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.flatListContent}
      />
      <View style={styles.parentOfConfirmButton}>
        <ThemeNormalButton
          title={Strings.createMealPlan_discard}
          backgroundColor={Colors.white}
          containerStyle={styles.discardButton}
          showElevation={false}
          textColor={Colors.error}
          textStyle={styles.discardText}
          onPress={() => backNavigation()}
        />
        <BaseButton
          title={
            planParam
              ? Strings.createMealPlan_update
              : Strings.createMealPlan_save
          }
          gradientButton={true}
          width={layoutWidth * 0.65}
          gradientStartColor={Colors._667D4C}
          gradientEndColor={Colors._9DAF89}
          gradientStart={{ x: 0, y: 0 }}
          gradientEnd={{ x: 1, y: 0 }}
          textColor={Colors.white}
          rightChild={
            <Image
              source={iconCalendar}
              style={{
                width: verticalScale(21),
                height: verticalScale(21),
                tintColor: Colors.white,
              }}
              resizeMode="contain"
            />
          }
          textStyle={[styles.confirmButton]}
          textStyleText={styles.saveShopping}
          onPress={planParam ? updateMealPlan : saveMealPlan}
        />
      </View>

      <AddItemToList
        visible={addToListVisible}
        onClose={() => setAddToListVisible(false)}
        from={CREATE_MEAL_PLAN}
        onMealSelect={(meal) => {
          handleMealSelect(meal);
        }}
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

  backIcon: {
    width: moderateScale(24),
    height: moderateScale(24),
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  backText: {
    fontSize: moderateScale(14),
    color: Colors.tertiary,
    fontFamily: FontFamilies.ROBOTO_SEMI_BOLD,
    marginLeft: horizontalScale(30),
  },

  label: {
    fontSize: moderateScale(12),
    color: Colors.primary,
    fontFamily: FontFamilies.ROBOTO_REGULAR,
    marginBottom: verticalScale(6),
    marginTop: verticalScale(8),
  },
  input: {
    backgroundColor: Colors.greysoft,
    borderRadius: moderateScale(4),
    paddingVertical: verticalScale(14),
    paddingHorizontal: horizontalScale(12),
    fontSize: moderateScale(12),
    color: Colors.tertiary,
    fontFamily: FontFamilies.ROBOTO_REGULAR,
    height: verticalScale(50),
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: verticalScale(10),
    backgroundColor: Colors.greysoft,
    borderRadius: moderateScale(4),
    paddingVertical: verticalScale(12),
    paddingRight: horizontalScale(10),
    height: verticalScale(50),
  },
  calendarIcon: {
    width: moderateScale(24),
    height: moderateScale(24),
  },
  daySection: {
    backgroundColor: Colors.white,
    borderRadius: moderateScale(8),
    marginBottom: verticalScale(10),
    marginTop: verticalScale(5),
    marginHorizontal: horizontalScale(5),
    paddingVertical: verticalScale(14),
    paddingHorizontal: horizontalScale(12),
    elevation: 4,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  dayHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: verticalScale(8),
  },
  dayTitle: {
    fontSize: moderateScale(14),
    fontFamily: FontFamilies.ROBOTO_MEDIUM,
    color: Colors.primary,
  },
  dayDate: {
    fontSize: moderateScale(12),
    color: Colors.tertiary,
    fontFamily: FontFamilies.ROBOTO_REGULAR,
  },
  mealRow: {
    flexDirection: "row",
    gap: moderateScale(10),
    justifyContent: "space-between",
  },
  mealCol: {},
  mealLabel: {
    fontSize: moderateScale(12),
    color: Colors.tertiary,
    fontFamily: FontFamilies.ROBOTO_MEDIUM,
    marginBottom: verticalScale(6),
  },
  mealBox: {
    width: layoutWidth * 0.24,
    minHeight: moderateScale(38),
    borderRadius: moderateScale(4),
    borderWidth: moderateScale(1),
    borderColor: Colors.tertiary,
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.white,
  },
  mealBoxWithMeal: {
    borderStyle: "solid",
    borderColor: Colors.borderColor,
    padding: moderateScale(4),
  },
  plus: {
    fontSize: moderateScale(22),
    color: Colors.tertiary,
    fontFamily: FontFamilies.ROBOTO_MEDIUM,
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
    marginBottom: verticalScale(55),
    marginHorizontal: moderateScale(-5),
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
  confirmButton: {
    color: Colors.white,
    fontFamily: FontFamilies.ROBOTO_MEDIUM,
    fontSize: moderateScale(14),
  },
  plusMealIcon: {
    width: moderateScale(24),
    height: moderateScale(24),
    alignSelf: "center",
  },
  backIconImage: {
    width: moderateScale(24),
    height: moderateScale(24),
    alignSelf: "flex-end",
    marginRight: horizontalScale(-11),
  },
  dateInput: {
    backgroundColor: Colors.greysoft,
    borderRadius: moderateScale(4),
    paddingHorizontal: horizontalScale(12),
    fontSize: moderateScale(12),
    color: Colors.tertiary,
    fontFamily: FontFamilies.ROBOTO_REGULAR,
    height: verticalScale(50),
    flex: 1,
    paddingVertical: 0,
  },
  flatListContent: {
    paddingBottom: 32,
  },
  discardButton: {
    borderWidth: moderateScale(1),
    borderColor: Colors.borderColor,
    width: "27%",
  },
  selectedMealContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    paddingHorizontal: horizontalScale(4),
  },
  removeMealIcon: {
    padding: moderateScale(2),
  },
  closeIcon: {
    width: moderateScale(14),
    height: moderateScale(14),
  },
  selectedMealImage: {
    width: "100%",
    height: moderateScale(50),
    borderRadius: moderateScale(4),
    marginBottom: verticalScale(4),
  },
  selectedMealName: {
    flexShrink: 1,
    fontSize: moderateScale(10),
    fontFamily: FontFamilies.ROBOTO_REGULAR,
    color: Colors.primary,
    textAlign: "center",
    paddingHorizontal: horizontalScale(2),
  },
});
