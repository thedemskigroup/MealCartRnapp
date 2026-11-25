import { horizontalScale, layoutWidth, moderateScale, verticalScale } from "@/constants/Constants";
import { Colors, FontFamilies } from "@/constants/Theme";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useRef, useState } from "react";

import { foodimage, mealcartLogo, mealfoodH, userDummy } from "@/assets/images";
import { IconPlus, MealsLogo } from "@/assets/svg";
import AppImage from "@/components/AppImage";
import MealDetail from "@/components/MealDetail";
import { APP_ROUTES } from "@/constants/AppRoutes";
import { Strings } from "@/constants/Strings";
import { Meal } from "@/reduxStore/slices/mealsSlice";
import { FontFamily } from "@/utils/Fonts";

import { hideLoader, showLoader } from "@/components/Loader";
import SpaceBetweenButtons from "@/components/SpaceBetweenButtons";
import ThemeGradientButton from "@/components/ThemeGradientButton";
import ThemeNormalButton from "@/components/ThemeNormalButton";
import { useTourStep } from "@/context/TourStepContext";
import { useAppSelector } from "@/reduxStore/hooks";
import { pushNavigation } from "@/utils/Navigation";
import { useMealsViewModel } from "@/viewmodels/MealsViewModel";
import { usePlanViewModel } from "@/viewmodels/PlanViewModel";
import { useFocusEffect, useRouter } from "expo-router";
import React from "react";
import {
  Animated,
  Dimensions,
  FlatList,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import {
  GestureHandlerRootView,
  PanGestureHandler,
  ScrollView,
  State,
} from "react-native-gesture-handler";
import { SafeAreaView } from "react-native-safe-area-context";
import { TourGuideZone, useTourGuideController } from "rn-tourguide";

const { height } = Dimensions.get("window");

const SWIPE_THRESHOLD = 30; // Minimum swipe distance to trigger hide
const GREETING_SECTION_HEIGHT = verticalScale(100);

const SHOW_ADD_GLOBAL_MEAL = false;

const HomeScreen: React.FC = () => {
  const scrollViewRef = useRef<any>(null);
  const panRef = useRef<any>(null);
  const router = useRouter();
  const user = useAppSelector((state) => state.auth.user);
  const isGuest = useAppSelector((state) => state.auth.isGuest);
  const { enrichedActivePlan, fetchActivePlan } = usePlanViewModel();
  const { recentMeals, fetchTheRecentMeals } = useMealsViewModel();
  const [activePlan, setActivePlan] = useState(enrichedActivePlan);

  // Recent Meals grid, matching the rule the Meals tab uses: keep the CARD a
  // constant size and fit as many columns as the row actually measures,
  // instead of always two. Two columns of a 1280dp tablet were 616dp cards.
  //
  // `gridWidth` is the measured row; `windowWidth` is only the first-render
  // fallback. Card width is identical to the old formula at every phone size
  // (430dp: (430-40-8)/2 = 191 either way) because the constants are the
  // same -- 20dp of screen padding each side and an 8dp gutter.
  const { width: windowWidth } = useWindowDimensions();
  const [gridWidth, setGridWidth] = useState(0);
  const MIN_CARD_WIDTH = horizontalScale(190);
  const GRID_GUTTER = horizontalScale(8);
  const availableGridWidth = gridWidth || windowWidth - horizontalScale(40);
  const numColumns = Math.max(
    2,
    Math.floor(
      (availableGridWidth + GRID_GUTTER) / (MIN_CARD_WIDTH + GRID_GUTTER),
    ),
  );
  const itemWidth =
    (availableGridWidth - GRID_GUTTER * (numColumns - 1)) / numColumns;
  const [refreshing, setRefreshing] = useState(false);
  const [selectedMeal, setSelectedMeal] = useState<Meal | null>(null);
  const [isLayoutReady, setIsLayoutReady] = useState(false);

  const scrollY = useRef(0);
  const greetingHeight = useRef(
    new Animated.Value(GREETING_SECTION_HEIGHT),
  ).current;
  const greetingOpacity = useRef(new Animated.Value(1)).current;
  const [isGreetingVisible, setIsGreetingVisible] = useState(true);

  // Meal card image animation states
  const mealCardImageHeight = useRef(
    new Animated.Value(verticalScale(120)),
  ).current;
  const mealCardImageOpacity = useRef(new Animated.Value(1)).current;
  const [isMealCardImageVisible, setIsMealCardImageVisible] = useState(true);

  const {
    shouldStartTour,
    isLoading: tourLoading,
    isNavigating,
  } = useTourStep();
  const { canStart, start, eventEmitter } = useTourGuideController();

  const fetchMealsAndPlan = async () => {
    await Promise.all([
      new Promise<void>((resolve) => {
        fetchActivePlan(
          () => resolve(),
          () => resolve(),
        );
      }),
      new Promise<void>((resolve) => {
        fetchTheRecentMeals(
          () => resolve(),
          () => resolve(),
        );
      }),
    ]);
  };

  useEffect(() => {
    const loadData = async () => {
      showLoader();
      await fetchMealsAndPlan();
      hideLoader();
    };
    if (!shouldStartTour) {
      loadData();
    }
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);

    // Reset greeting section visibility on refresh
    if (!isGreetingVisible) {
      Animated.parallel([
        Animated.timing(greetingHeight, {
          toValue: GREETING_SECTION_HEIGHT,
          duration: 300,
          useNativeDriver: false,
        }),
        Animated.timing(greetingOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: false,
        }),
      ]).start();
      setIsGreetingVisible(true);
    }

    // Reset meal card image visibility on refresh
    if (!isMealCardImageVisible) {
      Animated.parallel([
        Animated.timing(mealCardImageHeight, {
          toValue: verticalScale(120),
          duration: 300,
          useNativeDriver: false,
        }),
        Animated.timing(mealCardImageOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: false,
        }),
      ]).start();
      setIsMealCardImageVisible(true);
    }

    // Pull-to-refresh shows its own RefreshControl spinner; don't also fire
    // the global blocking loader modal (it would mask the pull spinner).
    await fetchMealsAndPlan();

    setRefreshing(false);
  };

  useEffect(() => {
    setActivePlan(enrichedActivePlan);
  }, [enrichedActivePlan]);

  // Start tour guide on first time
  useFocusEffect(
    React.useCallback(() => {
      if (tourLoading) return;

      if (shouldStartTour && canStart && isLayoutReady) {
        const timer = setTimeout(() => {
          start();
        }, 500);

        return () => clearTimeout(timer);
      }
    }, [shouldStartTour, canStart, tourLoading, isLayoutReady]),
  );

  React.useEffect(() => {
    const onStop = () => {};

    const onStart = () => {};

    eventEmitter?.on("stop", onStop);
    eventEmitter?.on("start", onStart);

    return () => {
      eventEmitter?.off("stop", onStop);
      eventEmitter?.off("start", onStart);
    };
  }, [eventEmitter, isNavigating]);

  // Handle scroll to track position
  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const currentScrollY = event.nativeEvent.contentOffset.y;
    scrollY.current = currentScrollY;
  };

  // Handle pan gesture for swipe up and swipe down detection
  const onHandlerStateChange = (event: any) => {
    if (event.nativeEvent.state === State.END) {
      const { translationY: swipeDistance } = event.nativeEvent;

      // Swipe up detected (negative translationY means swipe up)
      // Only hide if greeting is visible and user swiped up
      if (
        swipeDistance < -SWIPE_THRESHOLD &&
        isGreetingVisible &&
        scrollY.current <= 10 // Only allow swipe gesture when near the top
      ) {
        // Hide greeting section
        Animated.parallel([
          Animated.timing(greetingHeight, {
            toValue: 0,
            duration: 250,
            useNativeDriver: false,
          }),
          Animated.timing(greetingOpacity, {
            toValue: 0,
            duration: 150,
            useNativeDriver: false,
          }),
        ]).start();
        setIsGreetingVisible(false);

        // Hide meal card images
        Animated.parallel([
          Animated.timing(mealCardImageHeight, {
            toValue: 0,
            duration: 250,
            useNativeDriver: false,
          }),
          Animated.timing(mealCardImageOpacity, {
            toValue: 0,
            duration: 150,
            useNativeDriver: false,
          }),
        ]).start();
        setIsMealCardImageVisible(false);
      }
      // Swipe down detected (positive translationY means swipe down)
      // Only show if greeting is hidden, user swiped down, and at the top
      else if (
        swipeDistance > SWIPE_THRESHOLD &&
        !isGreetingVisible &&
        scrollY.current <= 10 // Only allow swipe gesture when at the top
      ) {
        // Show greeting section
        Animated.parallel([
          Animated.timing(greetingHeight, {
            toValue: GREETING_SECTION_HEIGHT,
            duration: 300,
            useNativeDriver: false,
          }),
          Animated.timing(greetingOpacity, {
            toValue: 1,
            duration: 300,
            useNativeDriver: false,
          }),
        ]).start();
        setIsGreetingVisible(true);

        // Show meal card images
        Animated.parallel([
          Animated.timing(mealCardImageHeight, {
            toValue: verticalScale(120),
            duration: 300,
            useNativeDriver: false,
          }),
          Animated.timing(mealCardImageOpacity, {
            toValue: 1,
            duration: 300,
            useNativeDriver: false,
          }),
        ]).start();
        setIsMealCardImageVisible(true);
      }
    }
  };

  const parsePlanDate = (d: any): Date | null => {
    if (!d) return null;
    if (typeof d === "string") return new Date(d);
    if (d.toDate) return d.toDate();
    if (d.seconds) return new Date(d.seconds * 1000);
    return new Date(d);
  };

  const isSameCalendarDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  const getTodayMeals = (): Meal[] => {
    if (!activePlan || !activePlan.days) return [];

    const now = new Date();

    // Only the day from the active plan that matches today's calendar date.
    const todayDay = activePlan.days.find((day) => {
      const date = parsePlanDate(day.date);
      return date ? isSameCalendarDay(date, now) : false;
    });

    if (!todayDay || !todayDay.mealSlots) return [];

    // Order the day's meals by their slot time (e.g. breakfast → lunch →
    // dinner), which is captured by each meal plan's createdAt order.
    return [...todayDay.mealSlots]
      .filter((slot) => slot.meal)
      .sort(
        (a, b) =>
          (a.mealPlan?.createdAt?.seconds ?? 0) -
          (b.mealPlan?.createdAt?.seconds ?? 0),
      )
      .map((slot) => slot.meal as Meal);
  };

  const todayMeals = getTodayMeals();
  const mealData = recentMeals;

  const renderMealItem = ({ item }: { item: Meal }) => (
    <View style={styles.mealCard}>
      <Animated.View
        style={{
          height: mealCardImageHeight,
          opacity: mealCardImageOpacity,
          overflow: "hidden",
        }}
      >
        <AppImage
          source={
            item.imageUrl && item.imageUrl !== "string"
              ? { uri: item.imageUrl }
              : mealfoodH
          }
          resizeMode="cover"
          style={styles.mealCardImage}
        />
      </Animated.View>

      <View style={styles.mealCardContent}>
        <View style={styles.mealCardTitleRow}>
          <Text style={styles.mealNametext} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.timeText}>
            {item.prepTime} • {item.difficulty}
          </Text>
        </View>
        <Text style={styles.mealCardDescription} numberOfLines={2}>
          {item.description}
        </Text>

        <ThemeNormalButton
          title={Strings.home_view}
          containerStyle={styles.mealCardButton}
          showElevation={false}
          onPress={() => navigateToMealDetail(item)}
        />
      </View>
    </View>
  );

  const goNext = () => {
    pushNavigation(APP_ROUTES.CREATE_MEAL, { mode: "create" });
  };

  const goToAddGlobalMeal = () => {
    pushNavigation(APP_ROUTES.CREATE_MEAL, { mode: "global" });
  };

  const navigateToMealDetail = (meal: Meal) => {
    router.push({
      pathname: "/appscreens/MealDetailScreen",
      params: { mealId: meal.id },
    });
  };

  const renderMealCard = ({ item, index }: { item: Meal; index: number }) => (
    <Pressable
      style={[styles.mealCardContainer, { width: itemWidth }]}
      onPress={() => navigateToMealDetail(item)}
    >
      <AppImage
        source={item.imageUrl ? { uri: item.imageUrl } : foodimage}
        resizeMode="cover"
        style={styles.mealCardMiniImage}
      />

      <View style={styles.tagContainer}>
        <Text style={styles.tagText}>{item.category}</Text>
      </View>

      <View style={styles.mealCardMiniContent}>
        <Text style={styles.mealNametext} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.timeText}>
          {item.prepTime} • {item.difficulty}
        </Text>
      </View>
    </Pressable>
  );

  return (
    <SafeAreaView style={styles.container} edges={["left", "right"]}>
      {selectedMeal ? (
        <MealDetail meal={selectedMeal} onBack={() => setSelectedMeal(null)} />
      ) : (
        <GestureHandlerRootView style={{ flex: 1 }}>
          <PanGestureHandler
            ref={panRef}
            simultaneousHandlers={scrollViewRef}
            onHandlerStateChange={onHandlerStateChange}
            activeOffsetY={[-10, 10]}
          >
            <View style={{ flex: 1 }}>
              <LinearGradient
                colors={[Colors._667D4C, Colors._9DAF89]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.gradientContainer}
              >
                <View style={styles.mainMealCartContainer}>
                  <View style={styles.emptyView} />

                  {/* Zone 1: Welcome - Logo */}
                  <TourGuideZone zone={1} shape="rectangle" borderRadius={16}>
                    <View
                      style={styles.mealcartLogoParent}
                      onLayout={() => {
                        if (!isLayoutReady) {
                          setIsLayoutReady(true);
                        }
                      }}
                    >
                      <Image
                        source={mealcartLogo}
                        style={styles.mealcartLogoImage}
                        resizeMode="contain"
                      />
                      <Text style={styles.text}>{Strings.home_mealCart}</Text>
                    </View>
                  </TourGuideZone>

                  {/* Animated collapsible greeting section */}
                  <Animated.View
                    style={[
                      {
                        height: greetingHeight,
                        opacity: greetingOpacity,
                        overflow: "hidden",
                      },
                    ]}
                  >
                    <View style={styles.parentGreetingAvatar}>
                      <View>
                        <Text style={styles.greetingText}>
                          {Strings.home_greeting}
                        </Text>
                        <Text style={styles.subgreetingText}>
                          {Strings.home_subgreeting}
                        </Text>
                      </View>

                      {/* Zone 5: Profile */}
                      <TourGuideZone zone={4} shape="circle" borderRadius={30}>
                        <View style={styles.avatarContainer}>
                          <TouchableOpacity
                            onPress={() =>
                              router.push(APP_ROUTES.ProfileScreen as any)
                            }
                          >
                            <Image
                              source={
                                user?.imageUrl
                                  ? { uri: user.imageUrl }
                                  : userDummy
                              }
                              style={styles.image}
                              resizeMode="cover"
                            />
                          </TouchableOpacity>
                        </View>
                      </TourGuideZone>
                    </View>
                  </Animated.View>

                  {todayMeals && todayMeals.length > 0 && (
                    <View style={styles.upcomingSection}>
                      <View style={styles.upcomingHeader}>
                        {/* Zone 4: Today's Meals */}
                        <Text style={styles.upcomingText}>
                          {Strings.home_nextMeal}
                        </Text>

                        {/* Zone 2: View All */}
                        <TouchableOpacity
                          onPress={() =>
                            pushNavigation(APP_ROUTES.TestMealPlan, {
                              planId: activePlan?.id,
                            })
                          }
                        >
                          <Text style={styles.viewAllText}>
                            {Strings.home_viewAll}
                          </Text>
                        </TouchableOpacity>
                      </View>
                      <FlatList
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        data={todayMeals}
                        renderItem={renderMealItem}
                        keyExtractor={(item, index) => `${item.id}-${index}`}
                        contentContainerStyle={styles.upcomingListContent}
                      />
                    </View>
                  )}
                </View>
              </LinearGradient>
              <ScrollView
                ref={scrollViewRef}
                simultaneousHandlers={panRef}
                showsVerticalScrollIndicator={false}
                onScroll={handleScroll}
                scrollEventThrottle={16}
                bounces={true}
                refreshControl={
                  <RefreshControl
                    refreshing={refreshing}
                    onRefresh={onRefresh}
                    colors={[Colors.primary]}
                    tintColor={Colors.primary}
                  />
                }
              >
                <SpaceBetweenButtons
                  containerStyle={styles.parentCreateMeal}
                  left={
                    <TourGuideZone zone={2} shape="rectangle" borderRadius={10}>
                      <ThemeGradientButton
                        title={Strings.home_addNewMeal}
                        textStyle={styles.createMeal}
                        onPress={goNext}
                        containerStyle={styles.createMealButton}
                        rightChild={
                          <IconPlus
                            width={verticalScale(21)}
                            height={verticalScale(21)}
                          />
                        }
                      />
                    </TourGuideZone>
                  }
                  right={
                    <ThemeNormalButton
                      onPress={() => pushNavigation(APP_ROUTES.MEALS)}
                      title={Strings.home_myMeals}
                      containerStyle={styles.createMealButton}
                      rightChild={
                        <MealsLogo
                          width={verticalScale(21)}
                          height={verticalScale(21)}
                        />
                      }
                    />
                  }
                />

                {SHOW_ADD_GLOBAL_MEAL && !isGuest && (
                  <View style={styles.addGlobalMealWrapper}>
                    <ThemeGradientButton
                      title={Strings.home_addMealToFirebase}
                      textStyle={styles.createMeal}
                      onPress={goToAddGlobalMeal}
                      containerStyle={styles.createMealButton}
                      rightChild={
                        <IconPlus
                          width={verticalScale(21)}
                          height={verticalScale(21)}
                        />
                      }
                    />
                  </View>
                )}

                {mealData && mealData.length > 0 ? (
                  <View style={styles.recentMealsContent}>
                    <View style={styles.parentOfRecentMeal}>
                      <Text style={styles.recentText}>
                        {Strings.home_recentMeals}
                      </Text>
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => pushNavigation(APP_ROUTES.MEALS)}
                      >
                        <Text style={styles.viewText}>
                          {Strings.home_viewAllRecent}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    <View
                      onLayout={(event) =>
                        setGridWidth(event.nativeEvent.layout.width)
                      }
                      style={{
                        flexDirection: "row",
                        flexWrap: "wrap",
                        // flex-start + gap, not space-between: with a partial
                        // row (2 meals in a 4-column grid) space-between flung
                        // the cards to opposite edges.
                        justifyContent: "flex-start",
                        gap: GRID_GUTTER,
                        marginVertical: verticalScale(8),
                      }}
                    >
                      {mealData
                        .slice(0, Math.max(4, numColumns))
                        .map((item, index) => (
                          <View
                            key={item.id}
                            style={{
                              width: itemWidth,
                              marginBottom: verticalScale(8),
                            }}
                          >
                            {renderMealCard({ item, index })}
                          </View>
                        ))}
                    </View>
                  </View>
                ) : (
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>
                      {Strings.meals_noMealsFound}
                    </Text>
                  </View>
                )}
              </ScrollView>
            </View>
          </PanGestureHandler>
        </GestureHandlerRootView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  mealCard: {
    backgroundColor: Colors.white,
    borderRadius: moderateScale(16),
    marginRight: moderateScale(16),
    width: layoutWidth * 0.75,
    elevation: 3,
    shadowColor: Colors.black,
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    overflow: "visible",
    marginBottom: moderateScale(8),
  },
  createMealButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 0,
  },
  mealCardImage: {
    width: "100%",
    height: verticalScale(120),
    borderTopLeftRadius: moderateScale(16),
    borderTopRightRadius: moderateScale(16),
    backgroundColor: Colors.white,
  },
  mealCardContent: {
    padding: moderateScale(12),
  },
  mealCardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  mealCardDescription: {
    fontSize: moderateScale(10),
    color: Colors.tertiary,
    fontFamily: FontFamily.ROBOTO_REGULAR,
    marginTop: moderateScale(8),
  },
  mealCardButton: {
    borderWidth: moderateScale(1),
    borderColor: Colors.borderColor,
    borderRadius: moderateScale(8),
    marginTop: moderateScale(16),
    paddingVertical: moderateScale(10),
    alignItems: "center",
    backgroundColor: Colors.white,
  },
  mealCardButtonText: {
    fontSize: moderateScale(14),
    fontFamily: FontFamily.ROBOTO_MEDIUM,
    color: Colors.primary,
  },
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  text: {
    fontSize: moderateScale(25),
    fontWeight: "bold",
    color: Colors.white,
    marginLeft: horizontalScale(5),
    fontFamily: FontFamily.ROBOTO_BLACK,
  },
  mainMealCartContainer: {
    paddingHorizontal: horizontalScale(20),
    paddingTop: verticalScale(25),
    paddingBottom: verticalScale(20),
  },
  gradientContainer: {
    borderBottomLeftRadius: moderateScale(35),
    borderBottomRightRadius: moderateScale(35),
  },
  greetingText: {
    color: Colors.white,
    fontSize: moderateScale(28),
    fontWeight: "600",
    fontFamily: FontFamily.ROBOTO_SEMI_BOLD,
  },
  subgreetingText: {
    color: Colors.buttonBackground,
    fontSize: moderateScale(14),
    fontWeight: "400",
    fontFamily: FontFamily.ROBOTO_REGULAR,
  },
  image: {
    width: horizontalScale(52),
    height: horizontalScale(52),
    borderWidth: moderateScale(1),
    borderColor: Colors.white,
    borderRadius: horizontalScale(26),
  },
  parentGreetingAvatar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: verticalScale(20),
    marginBottom: verticalScale(24),
  },
  upcomingSection: {
    marginTop: verticalScale(6),
  },
  upcomingHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: verticalScale(9),
  },
  upcomingText: {
    fontSize: moderateScale(19),
    fontWeight: "600",
    color: Colors.white,
    fontFamily: FontFamily.ROBOTO_SEMI_BOLD,
  },
  viewAllText: {
    fontSize: moderateScale(14),
    color: Colors.background,
    fontWeight: "500",
    fontFamily: FontFamily.ROBOTO_MEDIUM,
  },
  emptyText: {
    color: Colors.text,
    fontSize: moderateScale(14),
    fontWeight: "500",
    fontFamily: FontFamily.ROBOTO_MEDIUM,
  },
  emptyContainer: {
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
    height: height * 0.2,
    borderRadius: verticalScale(16),
    backgroundColor: Colors.white,
    overflow: "hidden",
  },
  emptyView: {
    height: verticalScale(45),
  },
  createMeal: {
    paddingHorizontal: horizontalScale(10),
    borderRadius: moderateScale(8),
    color: Colors.white,
  },
  myMeals: {
    backgroundColor: Colors._F5F9FB,
    borderRadius: moderateScale(8),
    width: layoutWidth * 0.41,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: moderateScale(12),
    fontFamily: FontFamily.ROBOTO_MEDIUM,
  },
  myMealText: {
    color: Colors.textBlack,
    fontSize: moderateScale(14),
    paddingHorizontal: horizontalScale(12),
    fontWeight: "500",
  },
  parentCreateMeal: {
    alignItems: "center",
    paddingHorizontal: horizontalScale(18),
    marginVertical: verticalScale(25),
  },
  addGlobalMealWrapper: {
    paddingHorizontal: horizontalScale(18),
    marginTop: verticalScale(-10),
    marginBottom: verticalScale(15),
  },
  mealcartLogoParent: {
    flexDirection: "row",
    alignItems: "center",
  },
  parentOfRecentMeal: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  recentText: {
    fontSize: moderateScale(21),
    fontFamily: FontFamily.ROBOTO_SEMI_BOLD,
    color: Colors.primary,
  },
  viewText: {
    fontFamily: FontFamily.ROBOTO_MEDIUM,
    fontSize: moderateScale(14),
    color: Colors.olive,
  },
  mealNametext: {
    fontSize: moderateScale(14),
    fontFamily: FontFamily.ROBOTO_MEDIUM,
    color: Colors.primary,
  },
  timeText: {
    fontFamily: FontFamilies.ROBOTO_REGULAR,
    fontSize: moderateScale(10),
    color: Colors.tertiary,
  },
  mealCardContainer: {
    backgroundColor: Colors.white,
    borderRadius: moderateScale(8),
    marginTop: moderateScale(8),
    elevation: 3,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    overflow: "visible",
    marginBottom: verticalScale(8),
  },
  mealCardMiniImage: {
    width: "99%",
    height: verticalScale(105),
    backgroundColor: Colors.white,
    alignSelf: "center",
    borderTopLeftRadius: moderateScale(8),
    borderTopRightRadius: moderateScale(8),
  },
  mealCardMiniContent: {
    padding: moderateScale(12),
  },
  mealcartLogoImage: {
    width: verticalScale(21),
    height: verticalScale(28),
  },
  avatarContainer: {
    minHeight: moderateScale(70),
    minWidth: moderateScale(70),
    justifyContent: "center",
    alignItems: "center",
  },
  upcomingListContent: {
    paddingVertical: 0,
    marginTop: verticalScale(9),
    paddingLeft: moderateScale(8),
    paddingRight: moderateScale(8),
  },
  recentMealsContent: {
    paddingBottom: 16,
    marginHorizontal: horizontalScale(20),
  },
  tagContainer: {
    backgroundColor: Colors._FFFFFF97,
    borderRadius: moderateScale(16),
    paddingHorizontal: horizontalScale(12),
    position: "absolute",
    end: 0,
    marginTop: verticalScale(10),
    paddingVertical: verticalScale(8),
    marginRight: horizontalScale(10),
  },
  tagText: {
    fontSize: moderateScale(13),
    fontFamily: FontFamily.ROBOTO_REGULAR,
    color: Colors.primary,
  },
});

export default HomeScreen;
