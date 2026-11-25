import { closeIcon, googleicon, updateprofile } from "@/assets/images";
import { AppleIcon } from "@/assets/svg";
import {
  horizontalScale,
  moderateScale,
  verticalScale,
} from "@/constants/Constants";
import { Strings } from "@/constants/Strings";
import { Colors, FontFamilies } from "@/constants/Theme";
import { SocialLoginProvider } from "@/reduxStore/appKeys";
import { showErrorToast, showSuccessToast } from "@/utils/Toast";
import { useProfileViewModel } from "@/viewmodels/ProfileViewModel";
import { useEffect, useState } from "react";
import {
  Dimensions,
  Image,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import AppImage from "./AppImage";
import ImagePickerModal from "./ImagePickerModal";
import { hideLoader, showLoader } from "./Loader";
import SpaceBetweenButtons from "./SpaceBetweenButtons";
import ThemeGradientButton from "./ThemeGradientButton";
import ThemeNormalButton from "./ThemeNormalButton";
import DismissKeyboard from "@/components/DismissKeyboard";

type Props = {
  visible: boolean;
  onClose: () => void;
  onUnlinkSocialAccount?: () => void;
};
const { height } = Dimensions.get("window");
const { width } = Dimensions.get("window");

export default function UpdateProfileModal({
  visible,
  onClose,
  onUnlinkSocialAccount,
}: Props) {
  const { updateUserData, user } = useProfileViewModel();
  const [name, setName] = useState("");
  const [userImage, setUserImage] = useState("");
  const [showImagePickerModal, setShowImagePickerModal] = useState(false);
  const [imageUri, setImageUri] = useState<string | null>(null);

  const isGoogleUser = user?.provider === SocialLoginProvider.GOOGLE;
  const isAppleUser = user?.provider === SocialLoginProvider.APPLE;

  // Load current user name when modal opens
  useEffect(() => {
    if (visible && user?.name) {
      setName(user.name);
    }
  }, [visible, user?.name]);

  useEffect(() => {
    if (visible && user?.imageUrl) {
      setUserImage(user.imageUrl);
    }
  }, [visible, user?.imageUrl]);

  const handleUpdate = async () => {
    if (!name.trim()) {
      showErrorToast("Please enter a name");
      return;
    }

    showLoader();

    await updateUserData(
      { name: name.trim(), imageUrl: imageUri || "" },
      () => {
        hideLoader();
        showSuccessToast("Profile updated successfully!");
        onClose();
      },
      (error) => {
        hideLoader();
        showErrorToast(error || "Failed to update profile");
      },
    );
  };
  const handleUpload = () => {
    setShowImagePickerModal(true);
  };

  const handleImagePicked = (url: string) => {
    setImageUri(url);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={StyleSheet.absoluteFillObject} />
        </TouchableWithoutFeedback>
        <DismissKeyboard>
        <View style={styles.container}>
          <ImagePickerModal
            visible={showImagePickerModal}
            onClose={() => setShowImagePickerModal(false)}
            onImagePicked={handleImagePicked}
          />

          <Text style={styles.headerTitle}>
            {Strings.updateProfileModal_title}
          </Text>
          <Text style={styles.headerSubtitle}>
            {Strings.updateProfileModal_subtitle}
          </Text>

          <View style={styles.avatarRow}>
            <AppImage
              source={
                imageUri
                  ? { uri: imageUri }
                  : userImage
                    ? { uri: userImage }
                    : updateprofile
              }
              style={styles.updateProfileImage}
              resizeMode="cover"
            />
            <View style={styles.avatarBtnCol}>
              <ThemeNormalButton
                title={Strings.updateProfileModal_update}
                backgroundColor={Colors.white}
                showElevation={false}
                containerStyle={styles.updateBtn}
                textStyle={styles.updateBtnText}
                onPress={handleUpload}
              />
              <ThemeGradientButton
                title={Strings.updateProfileModal_remove}
                gradientStartColor={Colors._A62A2A}
                gradientEndColor={Colors._FD4B4B}
                textStyle={styles.gradientbtnText}
                onPress={() => {
                  setUserImage("");
                  setImageUri("");
                }}
              />
            </View>
          </View>

          <Text style={styles.label}>
            {Strings.updateProfileModal_updateName}
          </Text>
          <TextInput
            style={styles.input}
            placeholder={Strings.updateProfileModal_namePlaceholder}
            placeholderTextColor={Colors.tertiary}
            value={name}
            onChangeText={setName}
          />

          <Text style={styles.label}>{Strings.email}</Text>
          <TextInput
            style={styles.input}
            value={user?.email || ""}
            placeholder={Strings.updateProfileModal_emailPlaceholder}
            placeholderTextColor={Colors.tertiary}
            keyboardType="email-address"
            editable={false}
          />

          {isGoogleUser && (
            <>
              <View style={styles.socialDivider}>
                <View style={styles.dividerLine} />
                <Text style={styles.socialLabel}>
                  {Strings.updateProfileModal_social}
                </Text>
                <View style={styles.dividerLine} />
              </View>

              <View style={styles.socialBox}>
                <Image
                  source={googleicon}
                  style={styles.googleIconImage}
                  resizeMode="contain"
                />
                <Text style={styles.socialText}>
                  {Strings.updateProfileModal_connectedWithGoogle}
                </Text>
                <TouchableOpacity onPress={onUnlinkSocialAccount}>
                  <Image
                    source={closeIcon}
                    style={styles.closeIconImage}
                    resizeMode="contain"
                  />
                </TouchableOpacity>
              </View>
            </>
          )}

          {isAppleUser && (
            <>
              <View style={styles.socialDivider}>
                <View style={styles.dividerLine} />
                <Text style={styles.socialLabel}>
                  {Strings.updateProfileModal_social}
                </Text>
                <View style={styles.dividerLine} />
              </View>

              <View
                style={[styles.socialBox, { backgroundColor: Colors.black }]}
              >
                <AppleIcon width={20} height={20} />
                <Text style={[styles.socialText, { color: Colors.white }]}>
                  {Strings.updateProfileModal_connectedWithApple}
                </Text>
                <TouchableOpacity onPress={onUnlinkSocialAccount}>
                  <Image
                    source={closeIcon}
                    style={styles.closeIconImage}
                    resizeMode="contain"
                  />
                </TouchableOpacity>
              </View>
            </>
          )}

          <SpaceBetweenButtons
            containerStyle={styles.footer}
            left={
              <ThemeNormalButton
                title={Strings.updateProfileModal_cancel}
                textColor={Colors.background}
                containerStyle={styles.cancelButton}
                textStyle={styles.cancelButtonText}
                onPress={onClose}
              />
            }
            right={
              <ThemeGradientButton
                title={Strings.updateProfileModal_update}
                containerStyle={styles.confirmButton}
                textStyle={styles.confirmButtonText}
                onPress={handleUpdate}
              />
            }
          />
        </View>
        </DismissKeyboard>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  headerTitle: {
    fontSize: moderateScale(21),
    fontFamily: FontFamilies.ROBOTO_SEMI_BOLD,
    color: Colors.primary,
    marginBottom: verticalScale(4),
  },
  updateProfileImage: {
    width: verticalScale(85),
    height: verticalScale(85),
    borderRadius: verticalScale(50),
  },
  googleIconImage: {
    width: verticalScale(20),
    height: verticalScale(20),
  },
  closeIconImage: {
    width: verticalScale(24),
    height: verticalScale(24),
  },
  headerSubtitle: {
    fontSize: moderateScale(12),
    fontFamily: FontFamilies.ROBOTO_REGULAR,
    color: Colors.tertiary,
    marginBottom: verticalScale(18),
  },
  avatarRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: verticalScale(18),
  },
  avatar: {
    width: moderateScale(120),
    height: moderateScale(120),
    borderRadius: moderateScale(60),
    backgroundColor: Colors.greysoft,
    marginRight: horizontalScale(18),
  },
  avatarBtnCol: {
    flex: 1,
    justifyContent: "center",
    marginHorizontal: horizontalScale(12),
  },
  updateBtn: {
    backgroundColor: Colors.white,
    borderRadius: moderateScale(8),
    paddingVertical: verticalScale(12),
    marginBottom: verticalScale(10),
    alignItems: "center",
    borderColor: Colors.borderColor,
    borderWidth: moderateScale(1),
  },
  updateBtnText: {
    fontSize: moderateScale(14),
    fontFamily: FontFamilies.ROBOTO_MEDIUM,
    color: Colors.primary,
  },
  gradientbtnText: {
    fontFamily: FontFamilies.ROBOTO_MEDIUM,
    color: Colors.white,
    fontSize: moderateScale(16),
  },

  removeBtnText: {
    fontSize: moderateScale(18),
    fontFamily: FontFamilies.ROBOTO_MEDIUM,
    color: Colors.white,
  },
  label: {
    fontSize: moderateScale(12),
    fontFamily: FontFamilies.ROBOTO_REGULAR,
    color: Colors.primary,
    marginTop: verticalScale(8),
    marginBottom: verticalScale(2),
  },
  input: {
    backgroundColor: Colors.white,
    borderRadius: moderateScale(8),
    borderWidth: 1,
    borderColor: Colors.divider,
    fontSize: moderateScale(12),
    fontFamily: FontFamilies.ROBOTO_REGULAR,
    color: Colors.tertiary,
    paddingHorizontal: horizontalScale(12),
    paddingVertical: verticalScale(10),
    marginBottom: verticalScale(8),
  },
  socialDivider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: verticalScale(8),
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.divider,
  },
  socialLabel: {
    fontSize: moderateScale(13),
    fontFamily: FontFamilies.ROBOTO_REGULAR,
    color: Colors.tertiary,
    paddingHorizontal: horizontalScale(12),
  },
  socialBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.buttonBackground,
    borderRadius: moderateScale(8),
    paddingVertical: verticalScale(14),
    paddingHorizontal: horizontalScale(15),
    marginVertical: verticalScale(18),
    justifyContent: "space-between",
    elevation: 4,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  googleIcon: {
    fontSize: moderateScale(22),
    fontFamily: FontFamilies.ROBOTO_BLACK,
    color: Colors.primary,
    marginRight: horizontalScale(8),
  },
  socialText: {
    fontSize: moderateScale(16),
    fontFamily: FontFamilies.ROBOTO_MEDIUM,
    color: Colors.textBlack,
    flex: 1,
    marginLeft: horizontalScale(12),
  },
  socialRemove: {
    fontSize: moderateScale(22),
    color: Colors.error,
    marginLeft: horizontalScale(8),
  },
  actionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: verticalScale(10),
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: moderateScale(10),
    borderWidth: 1,
    borderColor: Colors.divider,
    alignItems: "center",
    paddingVertical: verticalScale(14),
    marginRight: horizontalScale(8),
    elevation: 2,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
  },
  cancelBtnText: {
    fontSize: moderateScale(18),
    fontFamily: FontFamilies.ROBOTO_MEDIUM,
    color: Colors.primary,
  },
  updateProfileBtn: {
    flex: 1,
    backgroundColor: Colors.olive,
    borderRadius: moderateScale(10),
    alignItems: "center",
    paddingVertical: verticalScale(14),
    marginLeft: horizontalScale(8),
    elevation: 2,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
  },
  updateProfileBtnText: {
    fontSize: moderateScale(18),
    fontFamily: FontFamilies.ROBOTO_MEDIUM,
    color: Colors.white,
  },

  closeBtn: {
    position: "absolute",
    top: verticalScale(12),
    right: horizontalScale(12),
    zIndex: 10,
  },
  closeText: {
    fontSize: moderateScale(22),
    color: Colors.tertiary,
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.18)",
    justifyContent: "center",
    alignItems: "center",
    padding: horizontalScale(20),
  },
  container: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: Colors.white,
    borderRadius: moderateScale(18),
    paddingHorizontal: horizontalScale(18),
    paddingTop: verticalScale(24),
    paddingBottom: verticalScale(24),

    elevation: 8,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: verticalScale(18),
  },
  cancelButton: {
    backgroundColor: Colors.white,
    borderColor: Colors.borderColor,
    borderWidth: moderateScale(1),
    borderRadius: moderateScale(8),
    paddingVertical: verticalScale(12),
    marginRight: horizontalScale(8),
    alignItems: "center",
  },
  cancelButtonText: {
    fontFamily: FontFamilies.ROBOTO_MEDIUM,
    color: Colors.primary,
    fontSize: moderateScale(14),
  },
  confirmButton: {
    borderRadius: moderateScale(8),
    alignItems: "center",
  },
  confirmButtonText: {
    fontFamily: FontFamilies.ROBOTO_MEDIUM,
    color: Colors.white,
    fontSize: moderateScale(14),
  },
});
