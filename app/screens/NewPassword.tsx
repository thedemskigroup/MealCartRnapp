import AuthFooter from "@/components/AuthFooter";
import BackButton from "@/components/BackButton";
import BaseButton from "@/components/BaseButton";
import BaseTextInput from "@/components/BaseTextInput";
import Header from "@/components/Header";
import { APP_ROUTES } from "@/constants/AppRoutes";
import {
  CONTENT_MAX_WIDTH,
  horizontalScale,
  verticalScale,
} from "@/constants/Constants";
import { Strings } from "@/constants/Strings";
import { Colors } from "@/constants/Theme";
import { backNavigation, resetAndNavigate } from "@/utils/Navigation";
import { showErrorToast, showSuccessToast } from "@/utils/Toast";
import { NewPasswordFormValues, NewPasswordViewModel } from "@/viewmodels/NewPasswordViewModel";
import { Formik } from "formik";
import { useLocalSearchParams } from "expo-router";
import React from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import DismissKeyboard from "@/components/DismissKeyboard";

const NewPasswordScreen = () => {
  const handleBack = () => {
    backNavigation(APP_ROUTES.SIGNIN);
  };
  const newPasswordViewModel = new NewPasswordViewModel();
  const [isLoading, setIsLoading] = React.useState(false);

  // Firebase's one-time reset code, carried in the emailed link as
  // `?mode=resetPassword&oobCode=...`. Only present when the reset email points
  // at a custom action URL that deep-links here; with Firebase's hosted reset
  // page this screen isn't reached at all.
  const { oobCode } = useLocalSearchParams<{ oobCode?: string }>();

  const handleNewPassword = async (values: NewPasswordFormValues) => {
    setIsLoading(true);
    try {
      const result = await newPasswordViewModel.handleNewPassword(
        values,
        oobCode ?? "",
      );
      if (result.success) {
        showSuccessToast(Strings.newPassword_success);
        resetAndNavigate(APP_ROUTES.SIGNIN);
      } else {
        showErrorToast(Strings.newPassword_updateFailed, result.message);
      }
    } catch (error) {
      showErrorToast(Strings.newPassword_error, Strings.newPassword_unexpectedError);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <DismissKeyboard>
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <BackButton onPress={handleBack} />

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
          <View style={styles.contentView}>
            <Header
              title={Strings.setNewPassword}
              description={Strings.newPassword_description}
            />

            <Formik
              initialValues={{
                password: "",
                confirmPassword: "",
              }}
              validationSchema={newPasswordViewModel.validationSchema}
              onSubmit={handleNewPassword}
              validateOnChange={true}
              validateOnBlur={true}
            >
              {({ handleChange, handleBlur, values, errors, touched, validateForm, setTouched }) => (
                <View style={styles.form}>
                  <BaseTextInput
                    value={values.password}
                    onChangeText={handleChange("password")}
                    onBlur={() => {
                      handleBlur("password");
                      setTouched({ ...touched, password: true });
                    }}
                    placeholder={Strings.password}
                    secureTextEntry={true}
                    error={touched.password && errors.password ? errors.password : undefined}
                  />
                  <BaseTextInput
                    value={values.confirmPassword}
                    onChangeText={handleChange("confirmPassword")}
                    onBlur={() => {
                      handleBlur("confirmPassword");
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

                  <BaseButton
                    title={Strings.saveAndLogin}
                    gradientButton={true}
                    textColor={Colors.white}
                    onPress={async () => {
                      const formErrors = await validateForm();
                      if (Object.keys(formErrors).length > 0) {
                        setTouched({
                          password: true,
                          confirmPassword: true,
                        });
                        return;
                      }
                      handleNewPassword(values);
                    }}
                    disabled={isLoading}
                    loading={isLoading}
                  />
                </View>
              )}
            </Formik>
          </View>
        </ScrollView>

        <AuthFooter
          title={Strings.rememberPassword}
          buttonText={Strings.logIn}
          onPressButton={() => resetAndNavigate(APP_ROUTES.SIGNIN)}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
    </DismissKeyboard>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingHorizontal: horizontalScale(20),
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    // Centre the capped column below.
    alignItems: "center",
  },
  contentView: {
    gap: verticalScale(34),
    // Fill the phone, cap on a tablet (see CONTENT_MAX_WIDTH).
    width: "100%",
    maxWidth: CONTENT_MAX_WIDTH,
  },
  form: {
    gap: verticalScale(12),
  },
});

export default NewPasswordScreen;