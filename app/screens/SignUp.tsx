import AuthFooter from "@/components/AuthFooter";
import BaseTextInput from "@/components/BaseTextInput";
import Divider from "@/components/Divider";
import Header from "@/components/Header";
import {
  CONTENT_MAX_WIDTH,
  moderateScale,
  verticalScale,
} from "@/constants/Constants";
import { Strings } from "@/constants/Strings";
import { Colors, FontFamilies } from "@/constants/Theme";
import * as appKeys from "@/reduxStore/appKeys";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppleIcon, GoogleIcon } from "@/assets/svg";
import { hideLoader, showLoader } from "@/components/Loader";
import ThemeGradientButton from "@/components/ThemeGradientButton";
import ThemeNormalButton from "@/components/ThemeNormalButton";
import { APP_ROUTES } from "@/constants/AppRoutes";
import { signInWithApple } from "@/services/appleSignin";
import { signInWithGoogle } from "@/services/googleSignIn";
import { fontSize } from "@/utils/Fonts";
import {
  pushNavigation,
  replaceNavigation,
  resetAndNavigate,
} from "@/utils/Navigation";
import { showErrorToast, showSuccessToast } from "@/utils/Toast";
import { SigninViewModel } from "@/viewmodels/SigninViewModel";
import {
  SignupFormValues,
  SignupViewModel,
} from "@/viewmodels/SignupViewModel";
import { Formik } from "formik";
import { useRef, useState } from "react";

const SignupScreen = () => {
  const signupViewModel = new SignupViewModel();
  const signinViewModel = new SigninViewModel();

  // Prevent multiple simultaneous OAuth attempts
  const [isGoogleSigningIn, setIsGoogleSigningIn] = useState(false);
  const [isAppleSigningIn, setIsAppleSigningIn] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Track last click time to prevent rapid clicking
  const lastGoogleClickRef = useRef<number>(0);
  const lastAppleClickRef = useRef<number>(0);

  const handleSignup = async (values: SignupFormValues) => {
    if (isSubmitting) return;

    setIsSubmitting(true);
    showLoader();

    await signupViewModel.handleSignup(
      values,
      (payload) => {
        showSuccessToast(Strings.signupSuccessfully);
        hideLoader();
        setIsSubmitting(false);
        pushNavigation(APP_ROUTES.WELCOME_MEAL_CART);
      },
      (error) => {
        hideLoader();
        setIsSubmitting(false);
        showErrorToast(error);
      },
    );
  };

  const handleAppleSignIn = async () => {
    // Prevent rapid clicks (debounce)
    const now = Date.now();
    if (now - lastAppleClickRef.current < 2000) {
      return;
    }
    lastAppleClickRef.current = now;

    if (isAppleSigningIn) {
      return;
    }

    setIsAppleSigningIn(true);
    showLoader();

    try {
      const result = await signInWithApple();

      if (result.success && result.user) {
        const loadResult = await signinViewModel.loadUserData(result.user.id);

        if (loadResult.success) {
          showSuccessToast("Signed in successfully with Apple!");
          hideLoader();
          resetAndNavigate(APP_ROUTES.HOME);
        } else {
          hideLoader();
          showErrorToast(loadResult.error || "Failed to load user data");
        }
      } else {
        hideLoader();
        // Only show error if it's not a cancellation
        if (result.error && !result.error.includes("cancel")) {
          showErrorToast(result.error);
        }
      }
    } catch (error) {
      hideLoader();
      showErrorToast("An unexpected error occurred");
    } finally {
      setIsAppleSigningIn(false);
    }
  };

  const handleGoogleSignIn = async () => {
    // Prevent rapid clicks (debounce)
    const now = Date.now();
    if (now - lastGoogleClickRef.current < 2000) {
      return;
    }
    lastGoogleClickRef.current = now;

    if (isGoogleSigningIn) {
      return;
    }

    setIsGoogleSigningIn(true);
    showLoader();

    try {
      const result = await signInWithGoogle();

      if (result.success && result.user) {
        const loadResult = await signinViewModel.loadUserData(result.user.id);

        if (loadResult.success) {
          showSuccessToast("Signed in successfully with Google!");
          hideLoader();
          resetAndNavigate(APP_ROUTES.HOME);
        } else {
          hideLoader();
          showErrorToast(loadResult.error || "Failed to load user data");
        }
      } else {
        hideLoader();
        // Only show error if it's not a cancellation
        if (result.error && !result.error.includes("cancel")) {
          showErrorToast(result.error);
        }
      }
    } catch (error) {
      hideLoader();
      showErrorToast("An unexpected error occurred");
    } finally {
      setIsGoogleSigningIn(false);
    }
  };

  return (
    <SafeAreaView
      style={styles.safeArea}
      edges={["top", "left", "right", "bottom"]}
    >
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.container}>
            <Header
              title={Strings.createYourAccount}
              description={Strings.startJourney}
            />

            <Formik
              initialValues={{
                name: "",
                email: "",
                password: "",
                confirmPassword: "",
              }}
              validationSchema={signupViewModel.validationSchema}
              onSubmit={handleSignup}
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
                validateForm,
                setTouched,
              }) => (
                <View style={styles.form}>
                  <BaseTextInput
                    value={values.name}
                    onChangeText={handleChange(appKeys.NAME_KEY)}
                    onBlur={() => {
                      handleBlur(appKeys.NAME_KEY);
                      setTouched({ ...touched, name: true });
                    }}
                    placeholder={Strings.name}
                    error={
                      touched.name && errors.name ? errors.name : undefined
                    }
                  />
                  <BaseTextInput
                    value={values.email}
                    onChangeText={handleChange(appKeys.EMAIL_KEY)}
                    onBlur={() => {
                      handleBlur(appKeys.EMAIL_KEY);
                      setTouched({ ...touched, email: true });
                    }}
                    placeholder={Strings.email}
                    keyboardType="email-address"
                    error={
                      touched.email && errors.email ? errors.email : undefined
                    }
                  />
                  <BaseTextInput
                    value={values.password}
                    onChangeText={handleChange(appKeys.PASSWORD_KEY)}
                    onBlur={() => {
                      handleBlur(appKeys.PASSWORD_KEY);
                      setTouched({ ...touched, password: true });
                    }}
                    placeholder={Strings.password}
                    secureTextEntry={true}
                    error={
                      touched.password && errors.password
                        ? errors.password
                        : undefined
                    }
                  />
                  <BaseTextInput
                    value={values.confirmPassword}
                    onChangeText={handleChange(appKeys.CONFIRM_PASSWORD_KEY)}
                    onBlur={() => {
                      handleBlur(appKeys.CONFIRM_PASSWORD_KEY);
                      setTouched({ ...touched, confirmPassword: true });
                    }}
                    placeholder={Strings.confirmPassword}
                    secureTextEntry={true}
                    error={
                      touched.confirmPassword && errors.confirmPassword
                        ? errors.confirmPassword
                        : undefined
                    }
                  />

                  <View style={styles.buttonSpace}>
                    <ThemeGradientButton
                      title={Strings.signUp}
                      buttonGradient={styles.loginButton}
                      textStyle={{ color: Colors.white }}
                      disabled={isSubmitting}
                      onPress={async () => {
                        if (isSubmitting) return;

                        const formErrors = await validateForm();
                        if (Object.keys(formErrors).length > 0) {
                          setTouched({
                            name: true,
                            email: true,
                            password: true,
                            confirmPassword: true,
                          });
                          return;
                        }
                        handleSignup(values);
                      }}
                    />
                  </View>

                  <Text style={styles.secureMeals}>
                    {Strings.mealsAreSecure}
                  </Text>

                  <Divider style={styles.dividerStyle} />

                  <View style={styles.buttonContainer}>
                    <ThemeNormalButton
                      title={Strings.continueWithGoogle}
                      rightChild={<GoogleIcon />}
                      textStyle={styles.loginButton}
                      disabled={isGoogleSigningIn || isAppleSigningIn}
                      onPress={handleGoogleSignIn}
                    />
                    {Platform.OS === "ios" && (
                      <ThemeNormalButton
                        title={Strings.continueWithApple}
                        backgroundColor={Colors.black}
                        textColor={Colors.white}
                        rightChild={<AppleIcon />}
                        textStyle={styles.loginButton}
                        disabled={isAppleSigningIn || isGoogleSigningIn}
                        onPress={handleAppleSignIn}
                      />
                    )}
                  </View>
                </View>
              )}
            </Formik>
          </View>
        </ScrollView>

        <View style={styles.footerContainer}>
          <AuthFooter
            title={Strings.alreadyHaveAccount}
            buttonText={Strings.logIn}
            onPressButton={() => replaceNavigation(APP_ROUTES.SIGNIN)}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  keyboardAvoidingView: {
    flex: 1,
    justifyContent: "space-between",
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: moderateScale(20),
    justifyContent: "center",
    // Centre the capped column below.
    alignItems: "center",
  },
  form: {
    gap: moderateScale(12),
  },
  container: {
    gap: moderateScale(35),
    justifyContent: "center",
    // Fill the phone, cap on a tablet (see CONTENT_MAX_WIDTH).
    width: "100%",
    maxWidth: CONTENT_MAX_WIDTH,
  },
  buttonContainer: {
    gap: verticalScale(10),
    marginTop: verticalScale(20),
  },
  buttonSpace: {
    marginTop: verticalScale(10),
  },
  secureMeals: {
    fontSize: fontSize(10),
    color: Colors.tertiary,
    fontFamily: FontFamilies.ROBOTO_REGULAR,
    textAlign: "center",
  },
  footerContainer: {
    paddingHorizontal: moderateScale(20),
    paddingBottom: verticalScale(10),
    backgroundColor: Colors.background,
    // Outside the ScrollView, so it needs its own cap to stay aligned.
    // Fill the phone, cap on a tablet (see CONTENT_MAX_WIDTH).
    width: "100%",
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: "center",
  },
  dividerStyle: {
    marginTop: verticalScale(15),
  },
  loginButton: {
    paddingVertical: moderateScale(0),
  },
});

export default SignupScreen;
