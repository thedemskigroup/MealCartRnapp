import { layoutWidth, moderateScale, verticalScale } from "@/constants/Constants";
import { Colors } from "@/constants/Theme";
import { FontFamily } from "@/utils/Fonts";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import {
  Dimensions,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const { height } = Dimensions.get("window");

export interface MealCartPopUpProps {
  visible: boolean;
  title?: string;
  subTitle?: string;
  onClose?: () => void;

  primaryText?: string;
  onPrimaryPress?: () => void;

  secondaryText?: string;
  onSecondaryPress?: () => void;

  tertiaryText?: string;
  onTertiaryPress?: () => void;

  tertiaryGradientColors?: string[];

  style?: object;
}

const { width } = Dimensions.get("window");

const MealCartPopUp: React.FC<MealCartPopUpProps> = ({
  visible,
  title,
  subTitle,
  onClose,

  primaryText,
  onPrimaryPress,

  secondaryText,
  onSecondaryPress,

  tertiaryText,
  onTertiaryPress,
  tertiaryGradientColors = [],
  style = {},
}) => {
  const showPrimary = !!primaryText;
  const showSecondary = !!secondaryText;
  const showTertiary = !!tertiaryText;

  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={onClose}
    >
      <View
        style={[
          styles.overlay,
          // Remove centering if custom positioning is provided
          style && { justifyContent: "flex-start", alignItems: "flex-start" },
        ]}
      >
        <View style={[styles.container, style]}>
          <View style={styles.content}>
            {title && <Text style={styles.title}>{title}</Text>}
            {subTitle && (
              <Text style={styles.subTitle} numberOfLines={2}>
                {subTitle}
              </Text>
            )}
          </View>
          {(showPrimary || showSecondary || tertiaryText) && (
            <View style={styles.buttonRow}>
              <View style={styles.buttonWrapper}>
                {primaryText && (
                  <TouchableOpacity
                    style={[styles.buttonPrimary, styles.primaryButton]}
                    onPress={onPrimaryPress}
                  >
                    <Text style={styles.primaryText}>{primaryText}</Text>
                  </TouchableOpacity>
                )}
              </View>
              <View style={styles.parentNext}>
                <View style={styles.buttonWrapper}>
                  {secondaryText && (
                    <TouchableOpacity
                      style={[styles.buttonSecondary, styles.secondaryButton]}
                      onPress={onSecondaryPress}
                    >
                      <Text style={styles.secondaryText}>{secondaryText}</Text>
                    </TouchableOpacity>
                  )}
                </View>

                <View style={styles.buttonWrapper}>
                  {tertiaryText && (
                    <TouchableOpacity
                      style={styles.tertiaryWrapper}
                      onPress={onTertiaryPress}
                    >
                      <LinearGradient
                        colors={[
                          tertiaryGradientColors?.[0] || Colors._667D4C,
                          tertiaryGradientColors?.[1] || Colors._9DAF89,
                        ]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.tertiaryButton}
                      >
                        <Text style={styles.tertiaryText}>{tertiaryText}</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

export default MealCartPopUp;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  container: {
    width: layoutWidth * 0.85,
    padding: verticalScale(15),
    backgroundColor: Colors.white,
    borderRadius: verticalScale(16),
    height: height * 0.17,
    justifyContent: "space-between",
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

  buttonPrimary: {
    borderRadius: 10,
    alignItems: "center",
    backgroundColor: Colors.white,
    justifyContent: "center",
  },

  primaryButton: {},
  secondaryButton: {},
  buttonSecondary: {
    borderWidth: moderateScale(1),
    borderRadius: moderateScale(8),
    backgroundColor: Colors.white,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: moderateScale(14),
    paddingVertical: moderateScale(8),
  },

  primaryText: {
    color: Colors.tertiary,
    fontWeight: "500",
    fontSize: moderateScale(14),
    fontFamily: FontFamily.ROBOTO_MEDIUM,
  },
  secondaryText: {
    color: Colors.primary,
    fontWeight: "500",
    fontFamily: FontFamily.ROBOTO_MEDIUM,
  },

  tertiaryWrapper: {},
  tertiaryButton: {
    paddingVertical: moderateScale(10),
    borderRadius: moderateScale(8),
    alignItems: "center",
    paddingHorizontal: moderateScale(16),
  },
  tertiaryText: {
    color: Colors.white,

    fontWeight: "500",
    fontSize: moderateScale(16),
    fontFamily: FontFamily.ROBOTO_MEDIUM,
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
  },

  buttonWrapper: {},
  buttonWrapperPrimary: { flex: 1, alignItems: "flex-start" },
  buttonWrapperSecondary: { flex: 1, alignItems: "center" },
  buttonWrapperTertiary: { flex: 1, alignItems: "flex-end" },
  parentNext: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",

    width: layoutWidth * 0.34,
  },
  content: {
    minHeight: verticalScale(60),
    justifyContent: "center",
  },
});
