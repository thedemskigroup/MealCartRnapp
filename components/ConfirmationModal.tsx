import {
  horizontalScale,
  moderateScale,
  verticalScale,
} from "@/constants/Constants";
import { Strings } from "@/constants/Strings";
import { Colors, FontFamilies } from "@/constants/Theme";
import { Dimensions, Modal, StyleSheet, Text, View } from "react-native";
import BaseButton from "./BaseButton";
import SpaceBetweenButtons from "./SpaceBetweenButtons";
import ThemeNormalButton from "./ThemeNormalButton";
import ThemeGradientButton from "./ThemeGradientButton";

const { width } = Dimensions.get("window");

type ConfirmationModalProps = {
  visible: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  title?: string;
  description?: string;
  cancelText?: string;
  confirmText?: string;
  confirmGradientStart?: string;
  confirmGradientEnd?: string;
  isRemoving?: boolean;
};

const ConfirmationModal = ({
  visible,
  onCancel,
  onConfirm,
  title = Strings.confirmationModal_title,
  description = Strings.confirmationModal_description,
  cancelText = Strings.confirmationModal_cancel,
  confirmText = Strings.confirmationModal_confirm,
  confirmGradientStart = Colors._A62A2A,
  confirmGradientEnd = Colors._FD4B4B,
  isRemoving = false,
}: ConfirmationModalProps) => (
  <Modal
    visible={visible}
    transparent
    animationType="fade"
    onRequestClose={onCancel}
  >
    <View style={styles.overlay}>
      <View style={styles.container}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{description}</Text>
        <SpaceBetweenButtons
          containerStyle={styles.buttonRow}
          left={
            <ThemeNormalButton
              title={cancelText}
              textColor={Colors.background}
              width={width * 0.35}
              showElevation={false}
              containerStyle={styles.editButton}
              textStyle={styles.textstyle}
              onPress={onCancel}
            />
          }
          right={
            <ThemeGradientButton
              title={confirmText}
              disabled={isRemoving}
              gradientStartColor={Colors._A62A2A}
              gradientEndColor={Colors._FD4B4B}
              gradientStart={{ x: 0, y: 0 }}
              gradientEnd={{ x: 1, y: 0 }}
              textStyle={styles.deleteButton}
              onPress={onConfirm}
              containerStyle={isRemoving ? styles.disabled : styles.active}
            />
          }
        />
      </View>
    </View>
  </Modal>
);

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.25)",
    justifyContent: "center",
    alignItems: "center",
  },
  container: {
    width: width * moderateScale(0.85),
    backgroundColor: Colors.white,
    borderRadius: moderateScale(14),
    paddingHorizontal: moderateScale(22),
    paddingTop: verticalScale(18),
    paddingBottom: verticalScale(10),

    alignItems: "center",
  },
  title: {
    fontFamily: FontFamilies.ROBOTO_SEMI_BOLD,
    fontSize: moderateScale(21),
    color: Colors.primary,
    marginBottom: verticalScale(10),
    textAlign: "center",
  },
  subtitle: {
    fontFamily: FontFamilies.ROBOTO_REGULAR,
    fontSize: moderateScale(12),
    color: Colors.tertiary,
    textAlign: "center",
    marginBottom: verticalScale(15),
    lineHeight: moderateScale(20),
    paddingHorizontal: horizontalScale(30),
  },

  buttonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: verticalScale(24),
    // marginBottom: verticalScale(16),
    gap: horizontalScale(10),
  },
  cancelButton: {
    flex: 1,
    backgroundColor: Colors.white,
    borderColor: Colors.borderColor,
    borderWidth: moderateScale(1),
    borderRadius: moderateScale(8),
    paddingVertical: verticalScale(12),
    marginRight: horizontalScale(8),
    alignItems: "center",
  },
  cancelText: {
    fontFamily: FontFamilies.ROBOTO_MEDIUM,
    color: Colors.primary,
    fontSize: moderateScale(16),
  },

  deleteText: {
    fontFamily: FontFamilies.ROBOTO_MEDIUM,
    color: Colors.white,
    fontSize: moderateScale(16),
  },
  editButton: {
    borderWidth: moderateScale(1),
    borderColor: Colors.borderColor,
  },
  deleteButton: {
    fontFamily: FontFamilies.ROBOTO_MEDIUM,
    fontSize: moderateScale(16),
    color: Colors.white,
  },
  textstyle: {
    color: Colors.primary,
    fontSize: moderateScale(14),
    fontFamily: FontFamilies.ROBOTO_MEDIUM,
  },
  disabled: {
    // The confirm button is now disabled for as long as the action runs (the
    // modal stays up instead of handing over to a separate loading modal), so
    // this has to actually read as disabled rather than being a 10% dimming
    // nobody can see.
    opacity: 0.5,
  },
  active: {
    opacity: 1,
  },
});

export default ConfirmationModal;
