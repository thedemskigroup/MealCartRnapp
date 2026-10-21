import { Colors } from "@/constants/Theme";
import React, { useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

let setLoaderVisible: ((visible: boolean) => void) | null = null;
let pendingState: boolean | null = null;

export const showLoader = () => {
  if (setLoaderVisible) {
    setLoaderVisible(true);
    pendingState = null;
  } else {
    pendingState = true;
  }
};

export const hideLoader = () => {
  if (setLoaderVisible) {
    setLoaderVisible(false);
    pendingState = null;
  } else {
    pendingState = false;
  }
};

export default function Loader() {
  const [visible, setVisible] = useState(false);

  React.useEffect(() => {
    setLoaderVisible = setVisible;

    // Apply any pending state
    if (pendingState !== null) {
      setVisible(pendingState);
      pendingState = null;
    }

    return () => {
      setLoaderVisible = null;
    };
  }, []);

  React.useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => setVisible(false), 15000);
    return () => clearTimeout(timer);
  }, [visible]);

  if (!visible) return null;

  // Deliberately NOT a <Modal>. On iOS a Modal is a real view-controller
  // presentation, and presenting one while another is dismissing leaves an
  // orphaned modal window that swallows every touch — a frozen screen that
  // only a force-quit clears. This loader is global and fires from mount
  // effects (e.g. 1_Meals loads on focus), so it was racing whatever modal the
  // previous screen was still dismissing: delete a meal, land on My Meals, and
  // its loader presented into the confirmation modal's dismissal.
  //
  // As a plain overlay it renders inside the root view that is already on
  // screen, so there is no presentation to collide with. It is the last child
  // in app/_layout.tsx, so it still covers the app. The trade-off is that it no
  // longer draws above a native Modal — which is correct, since callers inside
  // a modal must show progress in place anyway (see 2_Plans updateThePlan and
  // MealDetail handleDeleteMeal).
  return (
    <View style={styles.overlay} pointerEvents="auto">
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    // Above every sibling in the root tree (RootNavigator, Toast).
    zIndex: 9999,
    elevation: 9999,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  loaderContainer: {
    backgroundColor: Colors.white,
    padding: 30,
    borderRadius: 16,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
});