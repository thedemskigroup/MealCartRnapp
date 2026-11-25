import AuthFooter from "@/components/AuthFooter";
import BaseTextInput from "@/components/BaseTextInput";
import Divider from "@/components/Divider";
import GradientText from "@/components/GradientText";
import Header from "@/components/Header";
import {
  CONTENT_MAX_WIDTH,
  moderateScale,
  verticalScale,
} from "@/constants/Constants";
import { Strings } from "@/constants/Strings";
import {
  pushNavigation,
  replaceNavigation,
  resetAndNavigate,
} from "@/utils/Navigation";
import { showErrorToast, showSuccessToast } from "@/utils/Toast";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppleIcon, GoogleIcon } from "@/assets/svg";
import { APP_ROUTES } from "@/constants/AppRoutes";
import { Colors } from "@/constants/Theme";

import { hideLoader, showLoader } from "@/components/Loader";

import ThemeGradientButton from "@/components/ThemeGradientButton";
import ThemeNormalButton from "@/components/ThemeNormalButton";
import { signInWithApple } from "@/services/appleSignin";
import { signInWithGoogle } from "@/services/googleSignIn";
import { fontSize } from "@/utils/Fonts";
import {
  SigninFormValues,
  SigninViewModel,
} from "@/viewmodels/SigninViewModel";
import { Formik } from "formik";
import { useRef, useState } from "react";
import DismissKeyboard from "@/components/DismissKeyboard";

const SignInScreen = () => {
  const signinViewModel = new SigninViewModel();

  // Prevent multiple simultaneous OAuth attempts
  const [isGoogleSigningIn, setIsGoogleSigningIn] = useState(false);
  const [isAppleSigningIn, setIsAppleSigningIn] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Track last click time to prevent rapid clicking
  const lastGoogleClickRef = useRef<number>(0);
  const lastAppleClickRef = useRef<number>(0);

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
        if (result.error && !result.error.toLowerCase().includes("cancel")) {
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
        if (result.error && !result.error.toLowerCase().includes("cancel")) {
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

  const handleSignin = async (values: SigninFormValues) => {
    if (isSubmitting) return;

    setIsSubmitting(true);
    showLoader();

    await signinViewModel.handleSignin(
      values,
      () => {
        showSuccessToast(Strings.signinSuccessful);
        hideLoader();
        setIsSubmitting(false);
        resetAndNavigate(APP_ROUTES.HOME);
      },
      (error) => {
        hideLoader();
        setIsSubmitting(false);
        showErrorToast(error);
      },
    );
  };

  return (
    <DismissKeyboard>
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
              title={Strings.welcomeBack}
              description={Strings.signinDescription}
            />

            <Formik
              initialValues={{
                email: "",
                password: "",
              }}
              validationSchema={signinViewModel.validationSchema}
              onSubmit={handleSignin}
              validateOnChange={true}
              validateOnBlur={true}
            >
              {({
                handleChange,
                handleBlur,
                values,
                errors,
                touched,
                validateForm,
                setTouched,
              }) => (
                <View>
                  <View style={styles.form}>
                    <BaseTextInput
                      value={values.email}
                      onChangeText={handleChange("email")}
                      onBlur={() => {
                        handleBlur("email");
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
                      onChangeText={handleChange("password")}
                      onBlur={() => {
                        handleBlur("password");
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
                  </View>

                  <View style={styles.middleContainer}>
                    <TouchableOpacity
                      style={styles.forgotPasswordContainer}
                      onPress={() => pushNavigation(APP_ROUTES.RESET_PASSWORD)}
                    >
                      <GradientText
                        text={Strings.forgotPassword}
                        startColor={Colors._586E3F}
                        endColor={Colors._5F6C51}
                        fontSize={fontSize(12)}
                        angle="diagonal"
                      />
                    </TouchableOpacity>

                    <ThemeGradientButton
                      title={Strings.logIn}
                      textStyle={{ color: Colors.white }}
                      buttonGradient={styles.loginButton}
                      disabled={isSubmitting}
                      onPress={async () => {
                        if (isSubmitting) return;

                        const formErrors = await validateForm();
                        if (Object.keys(formErrors).length > 0) {
                          setTouched({
                            email: true,
                            password: true,
                          });
                          return;
                        }
                        handleSignin(values);
                      }}
                    />
                  </View>

                  <Divider style={styles.dividerStyle} />

                  <View style={styles.buttonContainer}>
                    <ThemeNormalButton
                      title={Strings.continueWithGoogle}
                      rightChild={<GoogleIcon />}
                      onPress={handleGoogleSignIn}
                      textStyle={styles.loginButton}
                      disabled={isGoogleSigningIn || isAppleSigningIn}
                    />
                    {Platform.OS === "ios" && (
                      <ThemeNormalButton
                        title={Strings.continueWithApple}
                        backgroundColor={Colors.black}
                        textColor={Colors.white}
                        rightChild={<AppleIcon />}
                        onPress={handleAppleSignIn}
                        disabled={isAppleSigningIn || isGoogleSigningIn}
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
            title={Strings.newUser}
            buttonText={Strings.signup}
            onPressButton={() => replaceNavigation(APP_ROUTES.SIGNUP)}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
    </DismissKeyboard>
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
    paddingHorizontal: moderateScale(25),
    justifyContent: "center",
    // Centre the capped column below; without this it would hug the left edge
    // on a wide screen.
    alignItems: "center",
  },
  forgotPassword: {
    textAlign: "right",
    color: Colors.tertiary,
    fontSize: moderateScale(14),
  },
  form: {
    gap: moderateScale(12),
    marginBottom: verticalScale(12),
  },
  container: {
    gap: moderateScale(35),
    // Fill the phone, cap on a tablet (see CONTENT_MAX_WIDTH).
    width: "100%",
    maxWidth: CONTENT_MAX_WIDTH,
  },
  middleContainer: {
    gap: moderateScale(8),
  },
  text: {
    textAlign: "center",
  },
  buttonContainer: {
    gap: verticalScale(10),
  },
  footerContainer: {
    paddingHorizontal: moderateScale(20),
    paddingBottom: verticalScale(10),
    backgroundColor: Colors.background,
    // Sits outside the ScrollView, so it needs the same cap to stay aligned
    // with the form above it.
    width: "100%",
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: "center",
  },
  forgotPasswordContainer: {
    alignSelf: "flex-end",
    marginVertical: verticalScale(8),
  },
  dividerStyle: {
    marginVertical: verticalScale(50),
  },
  loginButton: {
    paddingVertical: moderateScale(0),
  },
});

export default SignInScreen;
