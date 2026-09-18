// app/(tabs)/home/_layout.tsx
import { Stack } from "expo-router";

// The anchor names a *route*, so it has to be the filename: the home screen is
// index.tsx, not HomeScreen. expo-router validates this and throws while
// exporting ("invalid anchor 'HomeScreen'"), which fails `eas update` after the
// iOS and Android bundles have already built fine — the throw comes from the
// web static render. Note this is stricter than the <Stack.Screen name=...>
// entries below, which are only per-screen options and are ignored when the
// name matches nothing.
export const unstable_settings = {
  initialRouteName: "index",
};

export default function HomeStack() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="HomeScreen" options={{ headerShown: false }} />
      <Stack.Screen name="ProfileScreen" options={{ headerShown: false }} />
      <Stack.Screen
        name="DietaryPreferencesScreen"
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="AllergiesIntolerancesScreen"
        options={{ headerShown: false }}
      />
      <Stack.Screen name="MealPlanSettings" options={{ headerShown: false }} />
      <Stack.Screen name="PasswordReset" options={{ headerShown: false }} />
    </Stack>
  );
}
