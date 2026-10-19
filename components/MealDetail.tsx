import {
  addtomeallist,
  addwishlisticon,
  backIcon,
  icon_edit,
  mealfoodH,
} from "@/assets/images";
import { APP_ROUTES } from "@/constants/AppRoutes";
import {
  addDotAtEnd,
  horizontalScale,
  moderateScale,
  verticalScale,
} from "@/constants/Constants";
import { Strings } from "@/constants/Strings";
import { Colors } from "@/constants/Theme";
import { Meal } from "@/reduxStore/slices/mealsSlice";
import { FontFamily, fontSize } from "@/utils/Fonts";
import { pushNavigation } from "@/utils/Navigation";
import { showErrorToast, showSuccessToast } from "@/utils/Toast";
import { useMealsViewModel } from "@/viewmodels/MealsViewModel";
import { useEffect, useRef, useState } from "react";
import {
  Dimensions,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import AppImage from "./AppImage";
import ConfirmationModal from "./ConfirmationModal";
import SendToShoppingList from "./SendShoppingList";
import SpaceBetweenButtons from "./SpaceBetweenButtons";
import ThemeGradientButton from "./ThemeGradientButton";
const { width } = Dimensions.get("window");

// Long enough for a transparent Modal's fade-out to finish before anything
// else touches the presentation. Navigating or presenting a second modal
// inside this window is what leaves an invisible touch-blocking overlay on
// iOS (see handleDeleteMeal).
const MODAL_DISMISS_MS = 350;

type MealDetailProps = {
  meal: Meal;
  onBack: () => void;
};

const MealDetail = ({ meal, onBack }: MealDetailProps) => {
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const pendingBackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showSendShoppingList, setShowSendShoppingList] = useState(false);

  const { deleteTheMeal } = useMealsViewModel();

  const handleEditPress = () => {
    pushNavigation(APP_ROUTES.CREATE_MEAL, {
      mode: "edit",
      mealId: meal.id,
    });
  };

  // Global meals are shared/official and owned by no single user. Rather than
  // editing the shared record, a user "copies" it: the bottom sheet opens
  // pre-filled with this meal's details, and saving creates a brand-new meal
  // owned by the user. The original global meal is left untouched.
  const handleCopyPress = () => {
    pushNavigation(APP_ROUTES.CREATE_MEAL, {
      mode: "copy",
      mealId: meal.id,
    });
  };

  // Deleting used to dismiss this modal and present the global Loader in the
  // same tick, then navigate away the moment the delete resolved. On iOS a
  // Modal is a real view-controller presentation, so starting one transition
  // while another is still running wedges UIKit: a transparent presented view
  // is left in the hierarchy, the screen underneath keeps rendering normally,
  // and every touch is swallowed until the app is force-quit. That is the
  // "My Meals is frozen after deleting a meal" report. The same race is
  // already documented for the FilterModal in app/(tabs)/1_Meals.tsx.
  //
  // So there is no second modal any more — progress is shown inside this one
  // via `isRemoving` — and the three steps are kept apart: finish deleting,
  // dismiss the modal, and only then navigate.
  const handleDeleteMeal = async () => {
    if (isDeleting) return;
    setIsDeleting(true);

    const finish = (onDone?: () => void) => {
      setIsDeleting(false);
      setShowDeleteModal(false);
      onDone?.();
    };

    try {
      await deleteTheMeal(
        meal.id,
        () => {
          finish(() => {
            showSuccessToast(Strings.meal_deleted);
            // Unmounting this screen while its Modal is still dismissing wedges
            // the presentation exactly as above, so let the fade finish first.
            pendingBackTimer.current = setTimeout(onBack, MODAL_DISMISS_MS);
          });
        },
        (error) => {
          finish(() => showErrorToast(error || Strings.error_deleting_meal));
        },
      );
    } catch (error: any) {
      finish(() =>
        showErrorToast(error?.message || Strings.error_occurred_deleting_meal),
      );
    }
  };

  useEffect(
    () => () => {
      if (pendingBackTimer.current) clearTimeout(pendingBackTimer.current);
    },
    [],
  );

  return (
    <View style={styles.container}>
      <View style={styles.headerImageContainer}>
        <View style={{ height: verticalScale(300), width: "100%" }}>
          {/* Background image with its own inline loader (shown while a remote
              image loads); the header content is layered on top. */}
          <AppImage
            source={meal.imageUrl ? { uri: meal.imageUrl } : mealfoodH}
            resizeMode="cover"
            loaderColor={Colors.white}
            loaderSize="large"
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.topRow}>
            <TouchableOpacity onPress={onBack} style={styles.backButton}>
              <Image
                source={backIcon}
                style={styles.backImage}
                resizeMode="contain"
              />
            </TouchableOpacity>

            {meal.category && (
              <View style={styles.tagContainer}>
                <Text style={styles.tagText}>{meal.category}</Text>
              </View>
            )}
          </View>

          <View style={styles.headerOverlayContent1}>
            <View style={styles.parentOfname}>
              <Text style={styles.title}>{meal.name}</Text>
              <Text style={styles.info}>
                {meal.prepTime && `${meal.prepTime} •`} {meal.servings || 0}{" "}
                {Strings.createMeal_servings}{" "}
                {meal.difficulty && `• ${meal.difficulty}`}
              </Text>
            </View>
            <View style={styles.parentOfAddList}>
              {/* <Image
                source={addtomeallist}
                style={styles.imageMeallist}
                resizeMode="contain"
              />
              <TouchableOpacity onPress={() => setShowSendShoppingList(true)}>
                <Image
                  source={addwishlisticon}
                  style={styles.imageaddToList}
                  resizeMode="contain"
                />
              </TouchableOpacity> */}
            </View>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.detailContent}
        contentContainerStyle={{ paddingBottom: verticalScale(32) }}
      >
        {meal.description && (
          <Text style={styles.description}>{meal.description || ""}</Text>
        )}

        {meal.isGlobal ? (
          <View style={styles.buttonRow}>
            <ThemeGradientButton
              title={Strings.mealDetail_copyToMyMeals}
              textStyle={{ color: Colors.white }}
              rightChild={
                <Image
                  source={addtomeallist}
                  style={styles.editImage}
                  resizeMode="contain"
                />
              }
              onPress={handleCopyPress}
            />
          </View>
        ) : (
          <SpaceBetweenButtons
            containerStyle={styles.buttonRow}
            left={
              <ThemeGradientButton
                title={Strings.mealDetail_edit}
                textStyle={{ color: Colors.white }}
                // textStyle={styles.editButton}
                rightChild={
                  <Image
                    source={icon_edit}
                    style={styles.editImage}
                    resizeMode="contain"
                  />
                }
                onPress={handleEditPress}
              />
            }
            right={
              <ThemeGradientButton
                title={Strings.mealDetail_delete}
                gradientStartColor={Colors._A62A2A}
                gradientEndColor={Colors._FD4B4B}
                gradientStart={{ x: 0, y: 0 }}
                gradientEnd={{ x: 1, y: 0 }}
                textStyle={{ color: Colors.white }}
                // textStyle={styles.deleteButton}
                onPress={() => setShowDeleteModal(true)}
              />
            }
          />
        )}

        {meal.ingredients && meal.ingredients.length > 0 && (
          <View>
            <Text style={styles.sectionTitle}>
              {Strings.createMeal_ingredients}
            </Text>
            <View style={styles.divider} />
            {meal.ingredients.map((ingredient: any, index: number) => (
              <View style={styles.ingredientRow} key={index}>
                <Text
                  style={styles.ingredientName}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {ingredient.ingredientName}
                </Text>
                <View style={styles.dividerRow} />
                <Text style={styles.ingredientValue}>
                  {ingredient.count &&
                    Number(ingredient.count) > 0 &&
                    `${ingredient.count} `}
                  {ingredient.unit}
                </Text>
              </View>
            ))}
          </View>
        )}

        {meal.steps && meal.steps.length > 0 && (
          <View>
            <Text style={styles.sectionTitle}>
              {Strings.mealDetail_instructions}
            </Text>
            <View style={styles.divider} />
            {meal.steps.map((step: string, index: number) => (
              <View style={styles.instructionRow} key={index}>
                <Text style={styles.instructionNumber}>{index + 1}.</Text>
                <Text style={styles.instructionText}>{addDotAtEnd(step)}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <ConfirmationModal
        visible={showDeleteModal}
        title={Strings.mealDetail_deleteMeal}
        description={Strings.mealDetail_deleteDesc}
        cancelText={Strings.mealDetail_cancel}
        confirmText={Strings.mealDetail_delete}
        onCancel={() => {
          if (isDeleting) return;
          setShowDeleteModal(false);
        }}
        onConfirm={handleDeleteMeal}
        isRemoving={isDeleting}
      />
      <SendToShoppingList
        visible={showSendShoppingList}
        onClose={() => setShowSendShoppingList(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  imageMeallist: {
    width: moderateScale(56),
    height: moderateScale(42),
  },
  imageaddToList: {
    width: moderateScale(56),
    height: moderateScale(42),
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: horizontalScale(10),
    marginTop: verticalScale(55),
  },
  backButton: {
    padding: moderateScale(8),
    borderRadius: moderateScale(20),
  },
  backButtonText: {
    fontSize: fontSize(28),
    color: Colors.white,
  },
  tagContainer: {
    backgroundColor: Colors._FFFFFF97,
    borderRadius: moderateScale(16),
    paddingHorizontal: horizontalScale(12),
    paddingVertical: verticalScale(10),
    marginRight: horizontalScale(10),
  },
  tagText: {
    fontSize: moderateScale(13),
    fontFamily: FontFamily.ROBOTO_MEDIUM,
    color: Colors.primary,
  },
  detailContent: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: moderateScale(24),
    borderTopRightRadius: moderateScale(24),
    marginTop: moderateScale(-24),
    padding: moderateScale(20),
    flex: 1,
  },
  title: {
    fontSize: moderateScale(21),
    fontFamily: FontFamily.ROBOTO_SEMI_BOLD,
    color: Colors.white,
  },
  info: {
    fontSize: moderateScale(12),
    color: Colors.white,
    marginTop: moderateScale(4),
    fontFamily: FontFamily.ROBOTO_MEDIUM,
  },
  description: {
    fontSize: moderateScale(14),
    color: Colors.tertiary,
    marginTop: moderateScale(16),
    fontFamily: FontFamily.ROBOTO_REGULAR,
  },
  buttonRow: {
    flexDirection: "row",
    marginVertical: verticalScale(25),
  },
  editButton: {
    fontFamily: FontFamily.ROBOTO_MEDIUM,
    fontSize: moderateScale(16),
    color: Colors.white,
  },
  editIcon: {
    color: Colors.white,
    fontSize: fontSize(16),
    marginLeft: horizontalScale(8),
  },
  deleteButton: {
    fontFamily: FontFamily.ROBOTO_MEDIUM,
    fontSize: moderateScale(16),
    color: Colors.white,
  },
  sectionTitle: {
    fontSize: moderateScale(21),
    fontFamily: FontFamily.ROBOTO_MEDIUM,
    color: Colors.primary,
    marginTop: moderateScale(12),
    marginBottom: moderateScale(8),
  },
  divider: {
    height: moderateScale(1),
    backgroundColor: Colors.divider,
    marginBottom: moderateScale(8),
  },
  dividerRow: {
    height: moderateScale(1),
    backgroundColor: Colors.divider,
    flex: 1,
    marginHorizontal: horizontalScale(12),
  },
  ingredientRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: verticalScale(4),
    paddingVertical: verticalScale(2),
  },
  ingredientName: {
    fontSize: moderateScale(14),
    fontFamily: FontFamily.ROBOTO_MEDIUM,
    maxWidth: width * moderateScale(0.7),
    color: Colors.primary,
  },
  ingredientValue: {
    fontSize: moderateScale(14),
    fontFamily: FontFamily.ROBOTO_REGULAR,
    color: Colors.tertiary,
  },
  instructionRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: verticalScale(8),
    marginTop: verticalScale(4),
  },
  instructionNumber: {
    fontSize: moderateScale(14),
    fontFamily: FontFamily.ROBOTO_MEDIUM,
    color: Colors.primary,
    marginRight: horizontalScale(8),
    marginTop: verticalScale(2),
  },
  instructionText: {
    fontSize: moderateScale(14),
    fontFamily: FontFamily.ROBOTO_REGULAR,
    color: Colors.tertiary,
    flex: 1,
  },
  parentOfAddList: {
    flexDirection: "row",
    alignItems: "center",
    width: width * moderateScale(0.3),
    marginEnd: horizontalScale(15),
    justifyContent: "space-between",
  },
  image: {
    width: "100%",
    height: verticalScale(300),
  },
  headerImageContainer: {},
  headerOverlayContent: {},
  headerOverlayContent1: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    position: "absolute",
    bottom: verticalScale(40),
    left: horizontalScale(16),
    width: width * moderateScale(0.96),
  },
  backImage: {
    width: moderateScale(30),
    height: moderateScale(30),
  },
  parentOfname: {
    width: width * moderateScale(0.5),
  },
  editImage: {
    width: moderateScale(20),
    height: moderateScale(20),
  },
});

export default MealDetail;
