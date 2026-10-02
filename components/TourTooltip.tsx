import { APP_ROUTES } from "@/constants/AppRoutes";
import { moderateScale, verticalScale } from "@/constants/Constants";
import { Colors } from "@/constants/Theme";
import { useTourStep } from "@/context/TourStepContext";
import { FontFamily } from "@/utils/Fonts";
import { resetAndNavigate } from "@/utils/Navigation";
import { LinearGradient } from "expo-linear-gradient";
import { usePathname, useRouter } from "expo-router";
import React from "react";
import {
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { type IStep } from "rn-tourguide";
import { hideLoader, showLoader } from "./Loader";

export interface TooltipProps {
  isFirstStep?: boolean;
  isLastStep?: boolean;
  currentStep: IStep;
  labels?: {
    skip?: string;
    previous?: string;
    next?: string;
    finish?: string;
  };
  handleNext?: () => void;
  handlePrev?: () => void;
  handleStop?: () => void;
}

const tourSteps = [
  {
    title: "Welcome To Mealcart!",
    subTitle: "Let's take a quick tour of the basics",
    primaryText: "Skip Tour",
    tertiaryText: "Next",
  },

  {
    title: "Add Your Recipes",
    subTitle:
      "Start by adding your favorite recipes here. This will be your personal cookbook.",
    primaryText: "Skip Tour",
    secondaryText: "Back",
    tertiaryText: "Next",
  },
  {
    title: "Build Weekly Plans",
    subTitle:
      "Next, use your saved meals to build weekly plans in this section.",
    primaryText: "Skip Tour",
    secondaryText: "Back",
    tertiaryText: "Next",
  },
  {
    title: "Profile and Settings",
    subTitle: "Manage your personal information and settings here.",
    secondaryText: "Back",
    tertiaryText: "Got it!",
  },
  {
    title: "Plan Your Week",
    subTitle:
      "Ready to plan your week? Tap here to create your first meal plan.",
    primaryText: "Skip Tour",
    tertiaryText: "Next",
  },
  {
    title: "Daily Planner",
    subTitle:
      "You can select at what day - at what time you like to plan your next meal.",
    secondaryText: "Back",
    primaryText: "Skip Tour",
    tertiaryText: "Next",
  },
  {
    title: "And It’s Done",
    subTitle:
      "Slot will look like this when you add your meal. You can remove or replace it anytime.",
    secondaryText: "Back",
    primaryText: "Skip Tour",
    tertiaryText: "Next",
  },
  {
    title: "Your Other Plans",
    subTitle:
      "All of your inactive or future meal plans are stored here for easy access.",
    secondaryText: "Back",
    primaryText: "Skip Tour",
    tertiaryText: "Next",
  },
  {
    title: "Start a Plan",
    subTitle:
      "Ready for a new week? Click here to make any of your other plans the active one.",
    secondaryText: "Back",
    primaryText: "Skip Tour",
    tertiaryText: "Next",
  },
  {
    title: "Your Active Plan",
    subTitle:
      "This card shows your currently active meal plan, with a quick look at today's meals.",
    secondaryText: "Back",
    primaryText: "Skip Tour",
    tertiaryText: "Next",
  },
  {
    title: "Get Shopping List",
    subTitle:
      "Instantly generate a complete, organized shopping list for all meals in your active plan.",
    secondaryText: "Back",
    primaryText: "Skip Tour",
    tertiaryText: "Next",
  },
  {
    title: "Pause Plan",
    subTitle:
      "If your plans change, you can pause the active plan here. You can always restart it later.",
    secondaryText: "Back",
    tertiaryText: "Got it",
  },
  {
    title: "Your Smart List",
    subTitle:
      "Your shopping list is ready! We automatically added all the ingredients from your meal plan.\n\nOr you can Create new list by clicking on highlighted action.",
    primaryText: "Skip Tour",
    tertiaryText: "Next",
  },
  {
    title: "Create List",
    subTitle:
      "You can create list manually, start by giving it a name and your shopping day to get notified.",
    secondaryText: "Back",
    primaryText: "Skip Tour",
    tertiaryText: "Next",
  },
  {
    title: "Add Items",
    subTitle:
      "Here you will see your items required by your meal. Clicking on “Add items” will opens up a new window.",
    secondaryText: "Back",
    primaryText: "Skip Tour",
    tertiaryText: "Next",
  },
  {
    title: "Check And Save",
    subTitle:
      "You can check off items that you dont need from auto-fetched list. Once that done you can save the list and its ready to use.",
    secondaryText: "Back",
    primaryText: "Skip Tour",
    tertiaryText: "Next",
  },
  {
    title: "Your Smart List",
    subTitle:
      "Your shopping list is ready! You open it up anytime and check as well as update it.",
    secondaryText: "Back",
    primaryText: "Skip Tour",
    tertiaryText: "Next",
  },
  {
    title: "Check Off Items",
    subTitle:
      "You can check off any items you already have at home before you shop.",
    secondaryText: "Back",
    tertiaryText: "Got It",
  },
];

const getTooltipPositionStyle = (stepIndex: number) => {
  switch (stepIndex) {
    case 0: // Welcome - Logo
      return {
        position: "absolute" as const,
        top: 180,
        left: 20,
        right: 20,
      };
    case 1: // Add New Meal button
      return {
        position: "absolute" as const,
        bottom: 200,
        left: 20,
        right: 20,
      };
    case 2: // Plans tab - bottom navigation
      return {
        position: "absolute" as const,
        bottom: 120, // Position above the tab bar
        left: 20,
        right: 20,
      };
    default:
      return {
        position: "absolute" as const,
        top: 200,
        left: 20,
        right: 20,
      };
  }
};

const TourTooltip: React.FC<TooltipProps> = ({
  currentStep,
  isFirstStep,
  isLastStep,
  handleNext,
  handlePrev,
  handleStop,
}) => {
  const {
    completeTour,
    setIsNavigating,
    triggerMealBoxPress,
    triggerSavePlan,
    cleanupTourData,
    triggerStartPlan,
    triggerOpenAddItemToList,
    setTriggerOpenAddItemToList,
    triggerOpenCreateList,
    setTriggerOpenCreateList,
    triggerAddDummyIngredients,
    setTriggerAddDummyIngredients,
    triggerCloseCreateList,
    triggerCloseAddItemToList,
  } = useTourStep();
  const router = useRouter();
  const pathname = usePathname();

  const stepIndex = (currentStep?.order ?? 1) - 1;
  const step = tourSteps[stepIndex];

  if (!step) {
    return null;
  }

  const onSkip = async () => {
    showLoader();
    await completeTour();
    handleStop?.();
    hideLoader();

    if (pathname !== APP_ROUTES.HOME) {
      resetAndNavigate(APP_ROUTES.HOME);
    }
  };

  const onFinish = async () => {
    showLoader();
    await completeTour();
    handleStop?.();
    hideLoader();
    resetAndNavigate(APP_ROUTES.HOME);
  };

  const handleBackOrNavigate = () => {
    // Handle back navigation with proper bottom sheet and screen navigation
    if (stepIndex === 13) {
      // Step 14 (index 13) "Create List" - close bottom sheet and go back
      if (triggerCloseCreateList) {
        triggerCloseCreateList();
      }
      setTimeout(() => {
        if (handlePrev) {
          handlePrev();
        }
      }, 300);
    } else if (stepIndex === 14) {
      // Step 15 (index 14) "Add Items" - just go back, stay on bottom sheet
      if (handlePrev) {
        handlePrev();
      }
    } else if (stepIndex === 15) {
      // Step 16 (index 15) "Check And Save" - just go back, stay on bottom sheet
      if (handlePrev) {
        handlePrev();
      }
    } else if (stepIndex === 16) {
      // Step 17 (index 16) "Your Smart List" - navigate back to LISTS, open bottom sheet and show zone 16
      setIsNavigating(true);
      router.push(APP_ROUTES.LISTS as any);

      setTimeout(() => {
        // Open the bottom sheet
        if (triggerOpenCreateList) {
          triggerOpenCreateList();
        }

        // Add dummy ingredients
        setTimeout(() => {
          if (triggerAddDummyIngredients) {
            triggerAddDummyIngredients();
          }

          // Wait for bottom sheet to fully open and ingredients to load, then go back
          setTimeout(() => {
            if (handlePrev) {
              handlePrev();
            }
            setTimeout(() => {
              setIsNavigating(false);
            }, 500);
          }, 500);
        }, 300);
      }, 1200);
    } else if (stepIndex === 17) {
      // Step 18 (index 17) "Check Off Items" - just go back to previous step (zone 17)
      if (handlePrev) {
        handlePrev();
      }
    } else if (stepIndex === 12) {
      // Step 13 (index 12) "Your Smart List" - navigate back to Plans
      setIsNavigating(true);
      router.push(APP_ROUTES.PLANS as any);
      setTimeout(() => {
        if (handlePrev) {
          handlePrev();
        }
        setTimeout(() => {
          setIsNavigating(false);
        }, 300);
      }, 800);
    } else if (stepIndex === 11) {
      // Step 12 (index 11) "Pause Plan" - stay on Plans screen
      if (handlePrev) {
        handlePrev();
      }
    } else if (stepIndex === 7) {
      // Step 8 (index 7) "Your Other Plans" - navigate back to CreateMealPlan and re-add dummy meal
      setIsNavigating(true);
      router.push(APP_ROUTES.CreateMealPlan as any);

      // Wait for screen to render, then add dummy meal and go back
      setTimeout(() => {
        if (triggerMealBoxPress) {
          triggerMealBoxPress();
        }

        setTimeout(() => {
          if (handlePrev) {
            handlePrev();
          }
          setTimeout(() => {
            setIsNavigating(false);
          }, 500);
        }, 500);
      }, 1200);
    } else if (stepIndex === 8 || stepIndex === 9 || stepIndex === 10) {
      // Steps 9-11 on Plans screen - just go back
      if (handlePrev) {
        handlePrev();
      }
    } else if (stepIndex === 5) {
      // Step 6 (index 5) "Daily Planner" - navigate back to Plans screen
      setIsNavigating(true);
      router.push(APP_ROUTES.PLANS as any);
      setTimeout(() => {
        if (handlePrev) {
          handlePrev();
        }
        setTimeout(() => {
          setIsNavigating(false);
        }, 500);
      }, 1200);
    } else if (stepIndex === 6) {
      // Step 7 (index 6) "And It's Done" - stay on CreateMealPlan, just go back
      if (handlePrev) {
        handlePrev();
      }
    } else if (stepIndex === 4) {
      // Step 5 (index 4) "Plan Your Week" - navigate back to Plans
      setIsNavigating(true);
      router.push(APP_ROUTES.PLANS as any);
      setTimeout(() => {
        if (handlePrev) {
          handlePrev();
        }
        setTimeout(() => {
          setIsNavigating(false);
        }, 300);
      }, 800);
    } else {
      // Default back behavior
      if (handlePrev) {
        handlePrev();
      }
    }
  };

  const handleNextOrNavigate = () => {
    // Step 4 (index 3) is Profile - navigate to Plans tab and continue tour
    if (stepIndex === 3) {
      // Set flag to prevent tour from stopping during navigation
      setIsNavigating(true);

      // Navigate first
      router.push(APP_ROUTES.PLANS as any);

      // Wait for screen to render and zone to be ready, then advance to next step
      setTimeout(() => {
        if (handleNext) {
          handleNext();
        }
        // Clear the flag after advancing
        setTimeout(() => {
          setIsNavigating(false);
        }, 300);
      }, 800);
    } else if (stepIndex === 4) {
      // Step 5 (index 4) is "Plan Your Week" - navigate to CreateMealPlan and continue tour
      setIsNavigating(true);

      // Navigate to CreateMealPlan
      router.push(APP_ROUTES.CreateMealPlan as any);

      // Wait for screen to render and zone to be ready, then advance to step 6
      setTimeout(() => {
        if (handleNext) {
          handleNext();
        }
        // Clear the flag after advancing
        setTimeout(() => {
          setIsNavigating(false);
        }, 300);
      }, 800);
    } else if (stepIndex === 5) {
      // Step 6 (index 5) is "Daily Planner" - add dummy meal and advance to step 7
      if (triggerMealBoxPress) {
        triggerMealBoxPress();
      }
      // Advance to step 7 after adding dummy meal
      setTimeout(() => {
        if (handleNext) {
          handleNext();
        }
      }, 300);
    } else if (stepIndex === 6) {
      // Step 7 (index 6) is "And It's Done" - save plan with dummy data
      if (triggerSavePlan) {
        triggerSavePlan();
      }
      // Wait for save to complete, then navigate and advance to next step
      setTimeout(() => {
        if (handleNext) {
          handleNext();
        }
      }, 1500);
    } else if (stepIndex === 8) {
      // Step 9 (index 8) is "Start a Plan" - start the first plan locally
      if (triggerStartPlan) {
        triggerStartPlan();
      }
      // Wait for update to complete, then advance to next step
      setTimeout(() => {
        if (handleNext) {
          handleNext();
        }
      }, 1500);
    } else if (stepIndex === 11) {
      // Step 12 (index 11) is "Pause Plan" - navigate to LISTS and continue tour
      setIsNavigating(true);
      router.push(APP_ROUTES.LISTS as any);
      setTimeout(() => {
        if (handleNext) {
          handleNext();
        }
        setTimeout(() => {
          setIsNavigating(false);
        }, 300);
      }, 800);
    } else if (stepIndex === 12) {
      // Step 13 (index 12) is "Your Smart List" - open CreateNewListBottomSheet
      if (triggerOpenCreateList) {
        triggerOpenCreateList();
      }
      // Wait for bottom sheet to open, then advance to next step
      setTimeout(() => {
        if (handleNext) {
          handleNext();
        }
      }, 500);
    } else if (stepIndex === 13) {
      // Step 14 (index 13) is "Create List" - advance normally
      if (handleNext) {
        handleNext();
      }
    } else if (stepIndex === 14) {
      // Step 15 (index 14) is "Add Items" - add dummy ingredients and open AddItemToList modal
      if (triggerAddDummyIngredients) {
        triggerAddDummyIngredients();
      }
      // Wait for ingredients to be added
      setTimeout(() => {
        if (triggerOpenAddItemToList) {
          triggerOpenAddItemToList();
        }
        // Advance to next step after opening modal
        setTimeout(() => {
          if (handleNext) {
            handleNext();
          }
        }, 500);
      }, 300);
    } else if (stepIndex === 15) {
      // Step 16 (index 15) is "Check And Save" - navigate to TestPlanShopping with dummy list
      // Don't close the bottom sheet during tour - it will stay in background
      setIsNavigating(true);

      // Navigate with dummy list ID
      router.push({
        pathname: APP_ROUTES.TestPlanShopping as any,
        params: { listId: "tour-dummy-list" },
      });

      setTimeout(() => {
        if (handleNext) {
          handleNext();
        }
        setTimeout(() => {
          setIsNavigating(false);
        }, 300);
      }, 800);
    } else if (isLastStep) {
      onFinish();
    } else {
      if (handleNext) {
        handleNext();
      }
    }
  };

  return (
    <View style={styles.tooltipContainer}>
      <View style={styles.content}>
        {step.title && <Text style={styles.title}>{step.title}</Text>}
        {step.subTitle && <Text style={styles.subTitle}>{step.subTitle}</Text>}
      </View>

      <View style={styles.buttonRow}>
        {step.primaryText && (
          <TouchableOpacity style={styles.skipButton} onPress={onSkip}>
            <Text style={styles.skipText}>{step.primaryText}</Text>
          </TouchableOpacity>
        )}

        <View style={styles.navigationButtons}>
          {step.secondaryText && (
            <TouchableOpacity
              style={styles.backButton}
              onPress={handleBackOrNavigate}
            >
              <Text style={styles.backText}>{step.secondaryText}</Text>
            </TouchableOpacity>
          )}

          {step.tertiaryText && (
            <TouchableOpacity
              style={styles.nextButton}
              onPress={handleNextOrNavigate}
            >
              <LinearGradient
                colors={[Colors._667D4C, Colors._9DAF89]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.nextButtonGradient}
              >
                <Text style={styles.nextText}>{step.tertiaryText}</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  tooltipContainer: {
    width: Dimensions.get("window").width * 0.85,
    padding: verticalScale(15),
    backgroundColor: Colors.white,
    borderRadius: verticalScale(16),
    minHeight: verticalScale(140),
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  content: {
    minHeight: verticalScale(60),
    justifyContent: "center",
  },
  title: {
    fontSize: moderateScale(21),
    fontWeight: "600",
    color: Colors.text,
    fontFamily: FontFamily.ROBOTO_SEMI_BOLD,
  },
  subTitle: {
    marginTop: 8,
    fontSize: moderateScale(12),
    color: Colors.tertiary,
    fontFamily: FontFamily.ROBOTO_REGULAR,
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
  },
  skipButton: {
    padding: moderateScale(8),
  },
  skipText: {
    color: Colors.tertiary,
    fontWeight: "500",
    fontSize: moderateScale(14),
    fontFamily: FontFamily.ROBOTO_MEDIUM,
  },
  navigationButtons: {
    flexDirection: "row",
    gap: moderateScale(12),
  },
  backButton: {
    borderWidth: moderateScale(1),
    borderRadius: moderateScale(8),
    backgroundColor: Colors.white,
    paddingHorizontal: moderateScale(14),
    paddingVertical: moderateScale(8),
  },
  backText: {
    color: Colors.primary,
    fontWeight: "500",
    fontFamily: FontFamily.ROBOTO_MEDIUM,
  },
  nextButton: {
    borderRadius: moderateScale(8),
  },
  nextButtonGradient: {
    paddingVertical: moderateScale(10),
    paddingHorizontal: moderateScale(16),
    borderRadius: moderateScale(8),
    alignItems: "center",
  },
  nextText: {
    color: Colors.white,
    fontWeight: "500",
    fontSize: moderateScale(16),
    fontFamily: FontFamily.ROBOTO_MEDIUM,
  },
});

export default TourTooltip;
