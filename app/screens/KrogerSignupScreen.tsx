import { BackIcon, KrogerIcon } from "@/assets/svg";
import BaseTextInput from "@/components/BaseTextInput";
import Divider from "@/components/Divider";
import Header from "@/components/Header";
import { KeyboardAwareScrollView } from "@/components/KeyboardAwareScrollView";
import KrogerSelectedStoreCard from "@/components/KrogerSelectedStoreCard";
import SelectKrogerStore from "@/components/SelectKrogerStore";
import ThemeGradientButton from "@/components/ThemeGradientButton";
import { APP_ROUTES } from "@/constants/AppRoutes";
import {
  horizontalScale,
  moderateScale,
  verticalScale,
} from "@/constants/Constants";
import { Strings } from "@/constants/Strings";
import { Colors, FontFamilies } from "@/constants/Theme";
import * as appKeys from "@/reduxStore/appKeys";
import {
  connectKrogerAccount,
  getKrogerConnectionStatus,
  saveKrogerSelectedStore,
  searchKrogerStores,
} from "@/services/krogerApi";
import { fontSize } from "@/utils/Fonts";
import { resetAndNavigate } from "@/utils/Navigation";
import { showToast } from "@/utils/Toast";
import { SignupViewModel } from "@/viewmodels/SignupViewModel";
import { useNavigation } from "@react-navigation/native";
import { useLocalSearchParams } from "expo-router";
import { Formik } from "formik";
import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import DismissKeyboard from "@/components/DismissKeyboard";

type KrogerLocationsResponse = {
  data?: any[];
};

/** Persists across OAuth redirect within the same app session. */
let persistedSource: string | null = null;

const KrogerSignupScreen = () => {
  const [startedConnecting, setStartedConnecting] = useState(false);
  const [showStoreModal, setShowStoreModal] = useState(false);
  const [selectedStore, setSelectedStore] = useState<any | null>(null);
  const [stores, setStores] = useState<any[]>([]);
  const [zip, setZip] = useState("");
  const [isCheckingConnection, setIsCheckingConnection] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  /** True while `handleConnect` owns the OAuth round-trip. */
  const isHandlingConnect = useRef(false);
  const navigation = useNavigation();
  const params = useLocalSearchParams();
  const signupViewModel = new SignupViewModel();

  if (typeof params.source === "string" && params.source) {
    persistedSource = params.source;
  }
  const openedFromProfile = persistedSource === "profile";

  useEffect(() => {
    const loadConnectionStatus = async () => {
      try {
        const status = await getKrogerConnectionStatus();
        const connected = Boolean(status.connected);

        setStartedConnecting(connected);
        setSelectedStore(connected ? status.selectedStore || null : null);
      } catch (error: any) {
      } finally {
        setIsCheckingConnection(false);
      }
    };

    loadConnectionStatus();
  }, []);

  useEffect(() => {
    const status = typeof params.status === "string" ? params.status : "";
    const message = typeof params.message === "string" ? params.message : "";

    if (!status) {
      return;
    }

    // On Android the callback deep link reaches expo-router *as well as* the
    // auth session, so this would double-toast a connect that `handleConnect` is
    // already resolving. This path is only needed when the deep link arrives
    // without a live auth session (app killed mid-OAuth and cold-started).
    if (isHandlingConnect.current) {
      return;
    }

    const handleOAuthReturn = async () => {
      setIsConnecting(false);

      if (status === "success") {
        try {
          const connected = await refreshConnectionStatus();

          if (connected) {
            showToast("success", "Kroger account connected.");
            return;
          }
        } catch (error) {}

        showToast(
          "error",
          "Kroger sign-in did not complete.",
          "Please try again.",
        );
        return;
      }

      if (status === "error") {
        showToast(
          "error",
          "Kroger sign-in failed.",
          message || "Please try again.",
        );
      }
    };

    handleOAuthReturn();
  }, [params.message, params.status]);

  const handleSkip = () => {
    persistedSource = null;
    if (openedFromProfile) {
      navigation.goBack();
      return;
    }

    resetAndNavigate(APP_ROUTES.HOME);
  };

  const refreshConnectionStatus = async () => {
    const status = await getKrogerConnectionStatus();
    const connected = Boolean(status.connected);

    setStartedConnecting(connected);
    setSelectedStore(connected ? status.selectedStore || null : null);

    return connected;
  };

  const handleConnect = async () => {
    try {
      isHandlingConnect.current = true;
      setIsConnecting(true);

      // Resolve the outcome from the auth session itself. On iOS the
      // `mealcartrnmain://` callback is swallowed by ASWebAuthenticationSession,
      // so the `params.status` effect below never fires and waiting on it would
      // leave the button stuck on "Connecting..." forever.
      const result = await connectKrogerAccount();

      if (result.outcome === "cancelled") {
        showToast("info", "Kroger sign-in was cancelled.");
        return;
      }

      if (result.outcome === "failed") {
        showToast(
          "error",
          "Kroger sign-in failed.",
          result.message || "Please try again.",
        );
        return;
      }

      // "returned" and "unknown" both need the server to confirm — the redirect
      // saying success is not proof the tokens were stored.
      const connected = await refreshConnectionStatus();

      if (connected) {
        showToast("success", "Kroger account connected.");
        return;
      }

      showToast(
        "error",
        "Kroger sign-in did not complete.",
        "Please try again.",
      );
    } catch (error: any) {
      showToast(
        "error",
        "Unable to connect Kroger.",
        error?.message || "Please try again.",
      );
    } finally {
      isHandlingConnect.current = false;
      setIsConnecting(false);
    }
  };

  const handleSearch = async (values: { zip: string }) => {
    try {
      setIsSearching(true);

      const response = (await searchKrogerStores(
        values.zip.trim(),
      )) as KrogerLocationsResponse;
      const mappedStores = response.data || [];

      if (!mappedStores.length) {
        showToast("info", "No Kroger stores found.", "Try another ZIP code.");
        return;
      }

      setStores(mappedStores);
      setShowStoreModal(true);
    } catch (error: any) {
      showToast(
        "error",
        "Unable to search stores.",
        error?.message || "Please try again.",
      );
    } finally {
      setIsSearching(false);
    }
  };

  const handleStoreSelect = async (store: any) => {
    try {
      const result = await saveKrogerSelectedStore(store);
      setSelectedStore(result?.selectedStore || store);
      setZip("");
      setShowStoreModal(false);
      showToast("success", "Default Kroger store saved.");
    } catch (error: any) {
      showToast(
        "error",
        "Unable to save Kroger store.",
        error?.message || "Please try again.",
      );
    }
  };

  const handleMainButtonPress = () => {
    if (selectedStore) {
      persistedSource = null;
      if (navigation.canGoBack() && openedFromProfile) {
        navigation.goBack();
      } else {
        resetAndNavigate(APP_ROUTES.HOME);
      }
    } else {
      handleConnect();
    }
  };

  const mainButtonTitle = isCheckingConnection
    ? "Checking..."
    : isConnecting
      ? "Connecting..."
      : isSearching
        ? "Searching..."
        : selectedStore
          ? Strings.continue
          : startedConnecting
            ? Strings.search
            : Strings.connectToKroger;

  const handleBackPress = async () => {
    if (selectedStore) {
      setSelectedStore(null);
      return;
    }

    if (startedConnecting) {
      try {
        const status = await getKrogerConnectionStatus();
        const connected = Boolean(status.connected);

        if (connected) {
          persistedSource = null;

          if (navigation.canGoBack() && openedFromProfile) {
            navigation.goBack();
          } else {
            resetAndNavigate(APP_ROUTES.HOME);
          }
          return;
        }
      } catch (error) {}

      setStartedConnecting(false);
      return;
    }

    navigation.goBack();
  };

  const desc = selectedStore
    ? Strings.selected_store_desc
    : startedConnecting
      ? Strings.find_store_desc
      : Strings.kroger_signup_desc;

  const title = selectedStore
    ? Strings.location_selected
    : startedConnecting
      ? Strings.find_your_location
      : Strings.connectTo;

  return (
    <DismissKeyboard>
    <SafeAreaView
      style={styles.safeArea}
      edges={["top", "left", "right", "bottom"]}
    >
      <KeyboardAwareScrollView
        contentContainerStyle={styles.container}
      >
        <BackIcon style={styles.backIcon} onPress={handleBackPress} />

        <Header title={title} />
        <View style={styles.logoContainer}>
          <KrogerIcon />
        </View>
        <Text style={styles.description}>{desc}</Text>

        <Formik
          initialValues={{ zip }}
          enableReinitialize
          validationSchema={signupViewModel.validateFieldZipSchema}
          onSubmit={handleSearch}
          validateOnChange={true}
          validateOnBlur={true}
        >
          {({
            handleChange,
            handleBlur,
            values,
            errors,
            touched,
            isValid,
            setTouched,
            submitForm,
          }) => (
            <>
              {startedConnecting && !selectedStore && (
                <BaseTextInput
                  value={values.zip}
                  onChangeText={(text) => {
                    setZip(text);
                    handleChange(appKeys.ZIP_KEY)(text);
                  }}
                  onBlur={() => {
                    handleBlur(appKeys.ZIP_KEY);
                    setTouched({ ...touched, zip: true });
                  }}
                  keyboardType="numeric"
                  placeholder={Strings.zipCode}
                  error={touched.zip && errors.zip ? errors.zip : undefined}
                />
              )}

              {selectedStore && (
                <KrogerSelectedStoreCard store={selectedStore} />
              )}
              <ThemeGradientButton
                title={mainButtonTitle}
                onPress={async () => {
                  if (startedConnecting && !selectedStore) {
                    submitForm();
                  } else {
                    handleMainButtonPress();
                  }
                }}
                buttonGradient={styles.connectButton}
                textStyle={{ color: Colors.white }}
                disabled={
                  isCheckingConnection ||
                  isConnecting ||
                  isSearching ||
                  (startedConnecting && !selectedStore && !isValid)
                }
              />
            </>
          )}
        </Formik>

        {!selectedStore && !openedFromProfile && (
          <>
            <Divider style={styles.dividerStyle} />

            <Pressable onPress={handleSkip}>
              <Text style={styles.skipText}>{Strings.skip_for_now}</Text>
            </Pressable>
          </>
        )}
      </KeyboardAwareScrollView>
      <SelectKrogerStore
        visible={showStoreModal}
        onClose={() => setShowStoreModal(false)}
        stores={stores}
        onSelect={handleStoreSelect}
      />
    </SafeAreaView>
    </DismissKeyboard>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    // justifyContent: "center",
    backgroundColor: Colors.background,
  },
  container: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: moderateScale(20),
    gap: verticalScale(30),
  },
  backIcon: {
    flex: 1,
    position: "absolute",
    top: verticalScale(30),
    left: moderateScale(20),
  },
  dividerStyle: {
    marginTop: verticalScale(15),
  },
  logoContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  krogerLogo: {
    fontSize: fontSize(48),
    color: "#004785", // Kroger blue
    fontWeight: "bold",
    fontFamily: FontFamilies.ROBOTO_MEDIUM,
    letterSpacing: 1,
  },
  description: {
    fontSize: fontSize(12),
    color: Colors.tertiary,
    fontFamily: FontFamilies.ROBOTO_REGULAR,
    textAlign: "center",
    marginHorizontal: moderateScale(30),
    lineHeight: moderateScale(18),
  },
  connectButton: {
    // marginTop: verticalScale(10),
    // width: "100%",'
    flex: 0,
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: verticalScale(20),
    width: "100%",
    justifyContent: "center",
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.tertiary,
    opacity: 0.2,
  },
  orText: {
    marginHorizontal: moderateScale(10),
    color: Colors.tertiary,
    fontFamily: FontFamilies.ROBOTO_MEDIUM,
    fontSize: fontSize(14),
  },
  skipText: {
    color: Colors.tertiary,
    fontFamily: FontFamilies.ROBOTO_MEDIUM,
    fontSize: fontSize(18),
    textAlign: "center",
    marginTop: verticalScale(10),
  },
  storeCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.white,
    borderRadius: moderateScale(12),
    margin: horizontalScale(5),
    elevation: 4,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    marginTop: verticalScale(3),
  },
  storeImage: {
    borderTopLeftRadius: moderateScale(8),
    borderBottomLeftRadius: moderateScale(8),
    marginRight: horizontalScale(12),
    width: horizontalScale(65),
    height: verticalScale(55),
  },
  storeInfo: {
    flex: 1,
  },
  storeName: {
    flex: 1,
    textAlignVertical: "center",
    fontFamily: FontFamilies.ROBOTO_REGULAR,
    fontSize: moderateScale(14),
    color: Colors.primary,
  },
});

export default KrogerSignupScreen;
