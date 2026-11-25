import {
  browseicon,
  closeIcon,
  filtericon,
  foodimage,
  gradientclose,
} from "@/assets/images";

import { SearchIcon } from "@/assets/svg";
import AppImage from "@/components/AppImage";
import FilterModal from "@/components/FilterModal";
import InputTapArea from "@/components/InputTapArea";
import PaginationLoader from "@/components/PaginationLoader";
import { hideLoader, showLoader } from "@/components/Loader";
import { APP_ROUTES } from "@/constants/AppRoutes";
import {
  horizontalScale,
  isAndroid,
  moderateScale,
  verticalScale,
} from "@/constants/Constants";
import { Filters } from "@/constants/interfaces";
import { Strings } from "@/constants/Strings";
import { Colors, FontFamilies } from "@/constants/Theme";
import { GLOBAL_MEALS_UID } from "@/reduxStore/appKeys";
import { Meal } from "@/reduxStore/slices/mealsSlice";
import { FontFamily } from "@/utils/Fonts";
import { pushNavigation } from "@/utils/Navigation";
import { useMealsViewModel } from "@/viewmodels/MealsViewModel";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import { SafeAreaView } from "react-native-safe-area-context";
const { height } = Dimensions.get("window");
const { width } = Dimensions.get("window");
const MealsScreen: React.FC = () => {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const searchInputRef = useRef<TextInput>(null);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  // Grid sizing, derived from the live window rather than a module-load
  // snapshot, so it survives rotation and tablets.
  //
  // Columns were hardcoded to 2, which on a 1280dp tablet meant two cards over
  // 500dp wide each. Instead keep the CARD a constant size and fit as many as
  // the width allows -- the same "more content, not bigger content" rule the
  // scaling helpers follow. MIN_CARD_WIDTH goes through horizontalScale, so it
  // inherits the 1.3x cap and tablet cards grow a little rather than a lot.
  //
  // Every phone still gets 2 columns. Card width matches the old formula
  // exactly at the 430pt design width ((430 - 34 - 16) / 2 = 190) and lands
  // within a few dp elsewhere -- 172.3 vs 170 on an iPhone 12, 159.1 vs 155 at
  // 360pt -- because the old formula scaled one combined `50` while this
  // scales the outer padding and the gutter separately. Tablets get 4 columns
  // of ~293dp, a rotated phone 4 of ~212dp.
  // `gridWidth` is measured from the padded container rather than derived from
  // the window, because deriving it means hardcoding this screen's chrome and
  // getting that wrong overflows the row. A first attempt assumed 34 units of
  // horizontal chrome when the real figure is 44 (paddingHorizontal 20 a side,
  // plus the list's own marginHorizontal 2 a side). At two columns the error
  // was invisible -- 34 + one 16 gutter happens to equal the 50 the old
  // formula used -- but at four columns every row ran off the right edge and
  // clipped the last card.
  const { width: windowWidth } = useWindowDimensions();
  const [gridWidth, setGridWidth] = useState(0);

  const MIN_CARD_WIDTH = horizontalScale(190);
  const GRID_GUTTER = horizontalScale(16);
  // Until onLayout fires, fall back to the window minus the known chrome.
  const availableWidth =
    (gridWidth || windowWidth - horizontalScale(40)) - horizontalScale(4);
  // gridWidth is the content width inside the container's padding; the extra
  // horizontalScale(4) accounts for the lists' own marginHorizontal: 2 a side.
  const numColumns = Math.max(
    2,
    Math.floor(
      (availableWidth + GRID_GUTTER) / (MIN_CARD_WIDTH + GRID_GUTTER),
    ),
  );
  const itemWidth =
    (availableWidth - GRID_GUTTER * (numColumns - 1)) / numColumns;

  const [isMyMeals, setIsMyMeals] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [searchText, setSearchText] = useState("");
  const [filters, setFilters] = useState<Filters>({
    category: null,
    difficulty: null,
    prepTime: null,
  });

  const {
    fetchMeals,
    searchMealsCombined,
    fetchTheRecentMeals,
    fetchGlobalMealsData,
    searchGlobalMealsCombined,
    loading,
    error,
    meals,
    recentMeals,
  } = useMealsViewModel();

  const [normalMeals, setNormalMeals] = useState<Meal[]>([]);
  const [normalLastDoc, setNormalLastDoc] = useState<any>(null);
  const [normalIsEndReached, setNormalIsEndReached] = useState(false);
  const [normalIsLoadingMore, setNormalIsLoadingMore] = useState(false);
  const NORMAL_PAGE_SIZE = 10;

  const [filteredMeals, setFilteredMeals] = useState<Meal[]>([]);
  const [filteredLastDoc, setFilteredLastDoc] = useState<any>(null);
  const [filteredIsEndReached, setFilteredIsEndReached] = useState(false);
  const [filteredIsLoadingMore, setFilteredIsLoadingMore] = useState(false);
  const FILTERED_PAGE_SIZE = 10;

  // Browse Meals = global/official meals ONLY (never the user's own meals).
  // Paged with a single global cursor; dedupe/sort on the client.
  const [browseMeals, setBrowseMeals] = useState<Meal[]>([]);
  const [browseGlobalCursor, setBrowseGlobalCursor] = useState<any>(null);
  const [browseGlobalEnd, setBrowseGlobalEnd] = useState(false);
  const [browseIsLoadingMore, setBrowseIsLoadingMore] = useState(false);
  const BROWSE_PAGE_SIZE = 10;

  const hasActiveFilters =
    filters.category ||
    filters.difficulty ||
    filters.prepTime ||
    debouncedSearch;

  const getCreatedAtMs = (meal: any): number => {
    const c = meal?.createdAt;
    if (!c) return 0;
    if (typeof c.seconds === "number") return c.seconds * 1000;
    if (c instanceof Date) return c.getTime();
    if (typeof c.toDate === "function") return c.toDate().getTime();
    const t = new Date(c).getTime();
    return Number.isNaN(t) ? 0 : t;
  };

  const mergeDedupeSort = (base: Meal[], incoming: Meal[]): Meal[] => {
    const byId = new Map<string, Meal>();
    [...base, ...incoming].forEach((meal) => {
      if (meal && meal.id) byId.set(meal.id, meal);
    });
    return Array.from(byId.values()).sort(
      (a, b) => getCreatedAtMs(b) - getCreatedAtMs(a),
    );
  };

  const displayMeals = !isMyMeals
    ? browseMeals
    : hasActiveFilters
      ? filteredMeals
      : normalMeals;

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 400);
    return () => clearTimeout(handler);
  }, [search]);

  useEffect(() => {
    const loadData = async () => {
      showLoader();
      await Promise.all([
        new Promise<void>((resolve) => {
          fetchMeals(
            (data) => {
              if (data.length < NORMAL_PAGE_SIZE) {
                setNormalIsEndReached(true);
              }
              // Display comes from the derived effect above (Redux store);
              // here we only advance the pagination cursor.
              if (data.length > 0) {
                setNormalLastDoc(data[data.length - 1]);
              }
              resolve();
            },
            (error) => {
              resolve();
            },
            NORMAL_PAGE_SIZE,
            null,
          );
        }),
        new Promise<void>((resolve) => {
          fetchTheRecentMeals(
            () => resolve(),
            () => resolve(),
          );
        }),
      ]);
      hideLoader();
    };

    loadData();
  }, []);

  useEffect(() => {
    if (isMyMeals && hasActiveFilters) {
      setFilteredMeals([]);
      setFilteredLastDoc(null);
      setFilteredIsEndReached(false);
      loadFilteredMeals(true);
    }
  }, [filters, debouncedSearch, isMyMeals]);

  // (Re)load the Browse Meals list whenever browse is active or its
  // filters/search change.
  useEffect(() => {
    if (!isMyMeals) {
      loadBrowseMeals(true);
    }
  }, [isMyMeals, filters, debouncedSearch]);

  // "Your Meals" must show ONLY the signed-in user's own meals — never global/
  // official meals. (Global meals live in a separate list, but legacy data can
  // tag a global meal with a real uid, so we filter defensively here.) Derive
  // the list straight from the Redux store as the single source of truth: it
  // then updates consistently on fetch, create, edit and delete, instead of
  // flip-flopping between the paginated fetch result and the accumulated store
  // (the previous cause of the "2 then 3 on refresh" inconsistency).
  useEffect(() => {
    const owned = meals
      .filter((meal) => !meal.isGlobal)
      .sort((a, b) => getCreatedAtMs(b) - getCreatedAtMs(a));
    setNormalMeals(owned);
  }, [meals]);

  const loadInitialMeals = async () => {
    setNormalMeals([]);
    setNormalLastDoc(null);
    setNormalIsEndReached(false);

    fetchMeals(
      (data) => {
        if (data.length < NORMAL_PAGE_SIZE) {
          setNormalIsEndReached(true);
        }
        setNormalMeals(data);
        if (data.length > 0) {
          setNormalLastDoc(data[data.length - 1]);
        }
      },
      (error) => {},
      NORMAL_PAGE_SIZE,
      null,
    );
  };

  const loadMoreNormalMeals = async () => {
    if (
      normalIsEndReached ||
      loading ||
      normalIsLoadingMore ||
      !normalLastDoc ||
      hasActiveFilters
    ) {
      return;
    }

    setNormalIsLoadingMore(true);

    fetchMeals(
      (data) => {
        if (data.length < NORMAL_PAGE_SIZE) {
          setNormalIsEndReached(true);
        }

        // The fetched page is appended to the Redux store by the thunk; the
        // derived effect above turns that into the displayed list. Here we only
        // advance the pagination cursor.
        if (data.length > 0) {
          setNormalLastDoc(data[data.length - 1]);
        }
        setNormalIsLoadingMore(false);
      },
      (error) => {
        setNormalIsLoadingMore(false);
      },
      NORMAL_PAGE_SIZE,
      normalLastDoc,
    );
  };

  const loadFilteredMeals = async (isInitial: boolean = false) => {
    if (!isInitial && (filteredIsEndReached || filteredIsLoadingMore)) {
      return;
    }

    setFilteredIsLoadingMore(true);

    // NOTE: intentionally NOT using the global blocking Loader modal here.
    // Presenting it while the FilterModal is still dismissing wedges the screen
    // (a native modal present/dismiss race). Loading is shown inline instead.
    searchMealsCombined(
      {
        category: filters.category,
        difficulty: filters.difficulty,
        prepTime: filters.prepTime,
        searchText: debouncedSearch,
        limit: FILTERED_PAGE_SIZE,
        startAfter: isInitial ? null : filteredLastDoc,
      },
      (data) => {
        if (data.length < FILTERED_PAGE_SIZE) {
          setFilteredIsEndReached(true);
        }

        if (isInitial) {
          setFilteredMeals(data);
        } else if (data.length > 0) {
          setFilteredMeals((prev) => {
            const existingIds = new Set(prev.map((meal: Meal) => meal.id));
            const newMeals = data.filter(
              (meal: Meal) => !existingIds.has(meal.id),
            );
            // Avoid creating a new array reference when nothing was added.
            return newMeals.length > 0 ? [...prev, ...newMeals] : prev;
          });
        }
        if (data.length > 0) {
          setFilteredLastDoc(data[data.length - 1]);
        }
        setFilteredIsLoadingMore(false);
      },
      (error) => {
        setFilteredIsLoadingMore(false);
      },
    );
  };

  // Load a page of Browse meals — global/official meals ONLY. (Previously this
  // also merged in the user's own meals; the client requires this list to show
  // global meals and nothing else.)
  const loadBrowseMeals = async (isInitial: boolean = false) => {
    if (!isInitial && (browseIsLoadingMore || browseGlobalEnd)) return;

    const globalCursor = isInitial ? null : browseGlobalCursor;

    setBrowseIsLoadingMore(true);

    const commonFilters = {
      category: filters.category,
      difficulty: filters.difficulty,
      prepTime: filters.prepTime,
      searchText: debouncedSearch,
      limit: BROWSE_PAGE_SIZE,
    };

    const globalData = await new Promise<Meal[]>((resolve) => {
      if (hasActiveFilters) {
        searchGlobalMealsCombined(
          { ...commonFilters, startAfter: globalCursor },
          (data) => resolve(data as Meal[]),
          () => resolve([]),
        );
      } else {
        fetchGlobalMealsData(
          (data) => resolve(data as Meal[]),
          () => resolve([]),
          BROWSE_PAGE_SIZE,
          globalCursor,
        );
      }
    });

    // Advance the cursor / end flag on the RAW page so pagination stays correct
    // even when some rows are filtered out below.
    if (globalData.length < BROWSE_PAGE_SIZE) setBrowseGlobalEnd(true);
    if (globalData.length > 0) {
      setBrowseGlobalCursor(globalData[globalData.length - 1]);
    }

    // Belt-and-suspenders: the query already filters isGlobal == true, but a
    // canonical official meal is also uid == "global". Drop any legacy doc that
    // is tagged global yet still carries a real user's uid, so ONLY official
    // meals appear in Browse.
    const officialMeals = globalData.filter(
      (meal) => meal.uid === GLOBAL_MEALS_UID,
    );

    setBrowseMeals((prev) =>
      mergeDedupeSort(isInitial ? [] : prev, officialMeals),
    );

    setBrowseIsLoadingMore(false);
  };

  const handleBrowseEndReached = () => {
    if (browseMeals.length === 0 || browseIsLoadingMore || browseGlobalEnd) {
      return;
    }
    loadBrowseMeals(false);
  };

  const handleScrollViewScroll = (
    event: NativeSyntheticEvent<NativeScrollEvent>,
  ) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const paddingToBottom = 20;
    const isCloseToBottom =
      layoutMeasurement.height + contentOffset.y >=
      contentSize.height - paddingToBottom;

    if (
      isCloseToBottom &&
      !normalIsEndReached &&
      !loading &&
      !normalIsLoadingMore
    ) {
      loadMoreNormalMeals();
    }
  };

  const handleFilteredEndReached = () => {
    // Never paginate when there is no loaded page / cursor yet. Without this,
    // an empty result set makes FlatList fire onEndReached repeatedly (its
    // content is shorter than the viewport), which loops loadFilteredMeals and
    // freezes the screen behind the loader.
    if (
      filteredMeals.length === 0 ||
      !filteredLastDoc ||
      filteredIsEndReached ||
      loading ||
      filteredIsLoadingMore
    ) {
      return;
    }
    loadFilteredMeals(false);
  };

  const onRefresh = async () => {
    setRefreshing(true);

    if (!isMyMeals) {
      await loadBrowseMeals(true);
      setRefreshing(false);
      return;
    }

    if (hasActiveFilters) {
      setFilteredMeals([]);
      setFilteredLastDoc(null);
      setFilteredIsEndReached(false);

      searchMealsCombined(
        {
          category: filters.category,
          difficulty: filters.difficulty,
          prepTime: filters.prepTime,
          searchText: debouncedSearch,
          limit: FILTERED_PAGE_SIZE,
          startAfter: null,
        },
        (data) => {
          if (data.length < FILTERED_PAGE_SIZE) {
            setFilteredIsEndReached(true);
          }
          setFilteredMeals(data);
          if (data.length > 0) {
            setFilteredLastDoc(data[data.length - 1]);
          }
          setRefreshing(false);
        },
        (error) => {
          setRefreshing(false);
        },
      );
    } else {
      setNormalLastDoc(null);
      setNormalIsEndReached(false);

      fetchMeals(
        (data) => {
          if (data.length < NORMAL_PAGE_SIZE) {
            setNormalIsEndReached(true);
          }
          // Display is derived from the Redux store; only advance the cursor.
          if (data.length > 0) {
            setNormalLastDoc(data[data.length - 1]);
          }
          fetchTheRecentMeals();
          setRefreshing(false);
        },
        (error) => {
          setRefreshing(false);
        },
        NORMAL_PAGE_SIZE,
        null,
      );
    }
  };

  const renderMealCard = ({ item, index }: { item: Meal; index: number }) => (
    <Pressable
      style={{
        backgroundColor: Colors.white,
        borderRadius: moderateScale(8),
        marginTop: moderateScale(8),
        width: itemWidth,
        elevation: 3,
        shadowColor: "#000",
        shadowOpacity: 0.08,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
        overflow: "visible",
        marginBottom: verticalScale(8),
      }}
      onPress={() => {
        router.push({
          pathname: "/appscreens/MealDetailScreen",
          params: { mealId: item.id },
        });
      }}
    >
      <AppImage
        source={item.imageUrl ? { uri: item.imageUrl } : foodimage}
        resizeMode="cover"
        style={{
          width: "99%",
          height: verticalScale(105),
          backgroundColor: Colors.white,
          alignSelf: "center",
          borderTopLeftRadius: moderateScale(8),
          borderTopRightRadius: moderateScale(8),
        }}
      />

      <View style={styles.tagContainer}>
        <Text style={styles.tagText}>{item.category}</Text>
      </View>

      <View style={{ padding: moderateScale(12) }}>
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
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      {/* Measured here, not on the SafeAreaView: onLayout reports a view's own
          frame including its padding, so measuring the container would just
          hand back the window width again. This child sits inside
          container's paddingHorizontal, so its width IS the content width the
          grid rows get. */}
      <View
        style={{ flex: 1 }}
        onLayout={({ nativeEvent }) => {
          const w = nativeEvent.layout.width;
          if (w > 0 && Math.abs(w - gridWidth) > 1) setGridWidth(w);
        }}
      >
        <View style={styles.topTextParent}>
          <View style={styles.parentMymeal}>
            <View>
              <Text style={styles.title}>
                {isMyMeals ? Strings.meals_myMeals : Strings.meals_browseMeals}
              </Text>
              {!hasActiveFilters && (
                <Text style={styles.subtitle}>
                  {isMyMeals
                    ? Strings.meals_browseMeals
                    : Strings.meals_myMeals}
                </Text>
              )}
            </View>

            {!hasActiveFilters && (
              <TouchableOpacity
                style={{ marginLeft: horizontalScale(6) }}
                onPress={() => setIsMyMeals((prev) => !prev)}
              >
                <Image
                  source={browseicon}
                  resizeMode="contain"
                  style={{
                    width: moderateScale(24),
                    height: moderateScale(26),
                  }}
                />
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity
            onPress={() =>
              pushNavigation(APP_ROUTES.CREATE_MEAL, { mode: "create" })
            }
          >
            <Image
              source={gradientclose}
              resizeMode="contain"
              style={{
                width: moderateScale(56),
                height: moderateScale(56),
                alignSelf: "flex-end",
                marginRight: horizontalScale(-17),
              }}
            />
          </TouchableOpacity>
        </View>
        <View style={styles.parentSearchBox}>
          <InputTapArea style={styles.searchBox} inputRef={searchInputRef}>
            <SearchIcon
              width={verticalScale(22)}
              height={verticalScale(22)}
              color={Colors.tertiary}
            />
            <TextInput
              ref={searchInputRef}
              style={styles.searchInput}
              placeholder={Strings.meals_searchPlaceholder}
              placeholderTextColor={Colors.tertiary}
              value={search}
              onChangeText={setSearch}
            />
          </InputTapArea>
          <TouchableOpacity onPress={() => setFilterModalVisible(true)}>
            <Image
              source={filtericon}
              resizeMode="contain"
              style={{ width: moderateScale(24), height: moderateScale(24) }}
            />
          </TouchableOpacity>
        </View>

        {!hasActiveFilters && isMyMeals ? (
          <ScrollView
            showsVerticalScrollIndicator={false}
            style={{ marginTop: verticalScale(10) }}
            onScroll={handleScrollViewScroll}
            scrollEventThrottle={400}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={[Colors.primary]}
                tintColor={Colors.primary}
              />
            }
          >
            {!recentMeals && !normalMeals ? (
              <Text style={styles.emptyText}>{Strings.meals_noMealsFound}</Text>
            ) : (
              <View style={{ flex: 1, marginTop: verticalScale(10) }}>
                {recentMeals && recentMeals.length > 0 ? (
                  <View>
                    <Text style={styles.recentText}>
                      {Strings.home_recentMeals}
                    </Text>

                    <View
                      style={{
                        flexDirection: "row",
                        flexWrap: "wrap",
                        // flex-start + gap, matching the FlatList grids. This
                        // row is hand-rolled rather than a FlatList, and with
                        // space-between a partial row (2 recent meals in a
                        // 4-column grid) was flung to the screen edges.
                        justifyContent: "flex-start",
                        gap: GRID_GUTTER,
                        marginBottom: verticalScale(8),
                      }}
                    >
                      {recentMeals.slice(0, 4).map((item, index) => (
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
                  <Text style={styles.emptyText}>
                    {Strings.meals_noMealsFound}
                  </Text>
                )}

                {normalMeals && normalMeals.length > 0 && (
                  <View>
                    <Text style={styles.upcomingText}>
                      {Strings.meals_yourMeals}
                    </Text>

                    <FlatList
                      data={normalMeals}
                      renderItem={renderMealCard}
                      keyExtractor={(item) => item.id}
                      key={`meals-${numColumns}`}
                      numColumns={numColumns}
                      columnWrapperStyle={{
                        // flex-start + gap, not space-between: with more than
                        // two columns a partial last row would otherwise be
                        // flung to the edges.
                        justifyContent: "flex-start",
                        gap: GRID_GUTTER,
                        marginBottom: verticalScale(8),
                      }}
                      scrollEnabled={false}
                      contentContainerStyle={{
                        paddingBottom: verticalScale(100),
                        marginHorizontal: horizontalScale(2),
                      }}
                      showsVerticalScrollIndicator={false}
                    />
                  </View>
                )}

                {normalIsLoadingMore && normalMeals.length > 0 && (
                  <PaginationLoader />
                )}
              </View>
            )}
          </ScrollView>
        ) : (
          <View style={{ flex: 1, marginTop: verticalScale(10) }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginVertical: verticalScale(10),
              }}
            >
              <Text style={styles.recentText}>{Strings.meals_allMeals}</Text>

              <TouchableOpacity
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: horizontalScale(6),
                }}
                onPress={() => {
                  setFilters({
                    category: null,
                    difficulty: null,
                    prepTime: null,
                  });
                  setSearch("");
                  setDebouncedSearch("");
                }}
              >
                <Text
                  style={{
                    fontSize: moderateScale(14),
                    fontFamily: FontFamilies.ROBOTO_MEDIUM,
                    color: Colors.tertiary,
                  }}
                >
                  {Strings.clearFilters}
                </Text>
                <Image
                  source={closeIcon}
                  resizeMode="contain"
                  style={{
                    width: moderateScale(16),
                    height: moderateScale(16),
                  }}
                />
              </TouchableOpacity>
            </View>

            <FlatList
              data={displayMeals}
              renderItem={renderMealCard}
              keyExtractor={(item) => item.id}
              key={`browse-${numColumns}`}
              numColumns={numColumns}
              columnWrapperStyle={{
                justifyContent: "flex-start",
                gap: GRID_GUTTER,
                marginBottom: verticalScale(8),
              }}
              contentContainerStyle={{ paddingBottom: 160 }}
              showsVerticalScrollIndicator={false}
              onEndReached={
                !isMyMeals ? handleBrowseEndReached : handleFilteredEndReached
              }
              onEndReachedThreshold={0.5}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  colors={[Colors.primary]}
                  tintColor={Colors.primary}
                />
              }
              ListEmptyComponent={
                (!isMyMeals ? browseIsLoadingMore : filteredIsLoadingMore) ? (
                  <View style={{ paddingVertical: verticalScale(40) }}>
                    <ActivityIndicator size="large" color={Colors.primary} />
                  </View>
                ) : (
                  <Text style={styles.emptyText}>
                    {Strings.meals_recentMealsFound}
                  </Text>
                )
              }
              ListFooterComponent={
                (
                  !isMyMeals
                    ? browseIsLoadingMore && browseMeals.length > 0
                    : filteredIsLoadingMore && filteredMeals.length > 0
                ) ? (
                  <PaginationLoader />
                ) : null
              }
            />
          </View>
        )}

        <FilterModal
          visible={filterModalVisible}
          onClose={() => setFilterModalVisible(false)}
          onConfirm={(selectedFilters: Filters) => {
            setFilters(selectedFilters);
            setFilterModalVisible(false);
          }}
          onReset={() => {
            setFilters({
              category: null,
              difficulty: null,
              prepTime: null,
            });
          }}
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingHorizontal: horizontalScale(20),
  },

  title: {
    fontFamily: FontFamilies.ROBOTO_SEMI_BOLD,
    fontSize: moderateScale(21),
    color: Colors.primary,
  },
  subtitle: {
    fontFamily: FontFamilies.ROBOTO_SEMI_BOLD,
    fontSize: moderateScale(12),
    color: Colors._667D4C,
    marginTop: verticalScale(3),
  },
  parentMymeal: {
    flexDirection: "row",
    alignItems: "center",
  },
  topTextParent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.white,
    borderRadius: moderateScale(30),
    borderWidth: moderateScale(1),
    borderColor: Colors.borderColor,
    height: isAndroid ? verticalScale(50) : verticalScale(44),
    paddingHorizontal: horizontalScale(12),
    // Fill whatever the row leaves after the filter icon, rather than taking a
    // fixed 60% of a module-load width snapshot. That fraction left roughly a
    // third of a tablet row empty between the field and the filter button, and
    // never reflowed on rotation.
    flex: 1,
    marginRight: horizontalScale(12),
  },
  searchInput: {
    flex: 1,
    fontFamily: FontFamilies.ROBOTO_REGULAR,
    fontSize: moderateScale(14),
    color: Colors.primary,
    textAlignVertical: "center",
    marginLeft: horizontalScale(8),
  },
  parentSearchBox: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: verticalScale(8),
    justifyContent: "space-between",
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
    marginBottom: verticalScale(4),
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
  upcomingText: {
    fontSize: moderateScale(21),
    fontWeight: "600",
    color: Colors.primary,
    fontFamily: FontFamily.ROBOTO_SEMI_BOLD,
    marginVertical: verticalScale(14),
  },
  emptyText: {
    fontSize: moderateScale(14),
    fontFamily: FontFamilies.ROBOTO_REGULAR,
    color: Colors.tertiary,
    textAlign: "center",
  },
  mealCardContainer: {
    backgroundColor: Colors.white,
    borderRadius: moderateScale(8),
    marginTop: moderateScale(8),
    flex: 1,
    elevation: 3,
    shadowColor: Colors.black,
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    overflow: "visible",
    marginBottom: verticalScale(8),
  },
  mealCardImage: {
    width: "99%",
    height: verticalScale(105),
    backgroundColor: Colors.white,
    alignSelf: "center",
    borderTopLeftRadius: moderateScale(8),
    borderTopRightRadius: moderateScale(8),
  },
  mealCardContent: {
    padding: moderateScale(12),
  },
  browseIconContainer: {
    marginLeft: horizontalScale(6),
  },
  browseIcon: {
    width: moderateScale(24),
    height: moderateScale(26),
  },
  gradientCloseImage: {
    width: moderateScale(56),
    height: moderateScale(56),
    alignSelf: "flex-end",
    marginRight: horizontalScale(-17),
  },
  filterIcon: {
    width: moderateScale(24),
    height: moderateScale(24),
  },
  recentMealsContainer: {
    height: height * 0.35,
  },
  yourMealsContainer: {
    height: height * 0.3,
  },
  browseMealsContainer: {
    flex: 1,
  },
  allMealsText: {
    fontSize: moderateScale(21),
    fontFamily: FontFamily.ROBOTO_SEMI_BOLD,
    color: Colors.primary,
    marginBottom: verticalScale(4),
    marginVertical: verticalScale(10),
  },
  flatListColumnWrapper: {
    justifyContent: "space-between",
    marginBottom: verticalScale(8),
  },
  recentMealsContent: {
    paddingBottom: 60,
  },
  yourMealsContent: {
    paddingBottom: verticalScale(100),
  },
  browseMealsContent: {
    paddingBottom: 160,
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

export default MealsScreen;
