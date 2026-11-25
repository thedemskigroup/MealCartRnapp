import { iconback } from '@/assets/images';
import BaseButton from '@/components/BaseButton';
import { CONTENT_MAX_WIDTH, horizontalScale, moderateScale, verticalScale } from '@/constants/Constants';
import { Strings } from '@/constants/Strings';
import { Colors, FontFamilies } from '@/constants/Theme';
import { useProfileViewModel } from '@/viewmodels/ProfileViewModel';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Dimensions, Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';


const { width } = Dimensions.get('window');


export default function PasswordReset({  }) {
    const router = useRouter();
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const { changePassword, loading } = useProfileViewModel();


    const handleUpdatePassword = () => {
        changePassword(
            currentPassword,
            newPassword,
            confirmPassword,
            () => {
                alert("Password updated successfully");
                router.back();
            },
            (error) => {
                alert(error);
            }
        );
    };
    return (
        <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
            <View style={styles.content}>
            <View style={styles.headerRow}>
                <TouchableOpacity onPress={() => router.back()}>
                    <Image
                        source={iconback}
                        resizeMode="contain"
                        style={styles.backIcon}
                    />
                </TouchableOpacity>
                <Text style={styles.backText}>{Strings.passwordReset_title}</Text>
            </View>

            <Text style={styles.label}>{Strings.passwordReset_currentPassword}</Text>
            <TextInput
                style={styles.input}
                value={currentPassword}
                onChangeText={setCurrentPassword}
                placeholder=""
                secureTextEntry
            />
            <Text style={styles.label}>{Strings.passwordReset_newPassword}</Text>
            <TextInput
                style={styles.input}
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder=""
                secureTextEntry
            />
            <Text style={styles.label}>{Strings.passwordReset_confirmNewPassword}</Text>
            <TextInput
                style={styles.input}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder=""
                secureTextEntry
            />
            <BaseButton
                title={Strings.passwordReset_updatePassword}
                gradientButton={true}
                textStyle={styles.savePreference}
                width={Math.min(width * 0.92, CONTENT_MAX_WIDTH - horizontalScale(40))}
                onPress={handleUpdatePassword}
                loading={loading}
            />




            </View>
        </SafeAreaView>

    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.white,
        paddingHorizontal: horizontalScale(20),
    },
    // Caps the form column on tablets. A no-op on phones, where
    // CONTENT_MAX_WIDTH is wider than the window.
    content: {
        flex: 1,
        width: '100%',
        maxWidth: CONTENT_MAX_WIDTH,
        alignSelf: 'center',
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    backText: {
        fontSize: moderateScale(21),
        color: Colors.primary,
        fontFamily: FontFamilies.ROBOTO_SEMI_BOLD,
        marginLeft: horizontalScale(30),
    },
    savePreference: {
        fontFamily: FontFamilies.ROBOTO_MEDIUM,
        fontSize: moderateScale(16),
        color: Colors.white
    },
    label: {
        fontSize: moderateScale(12),
        color: Colors.tertiary,
        marginBottom: verticalScale(6),
        marginTop: verticalScale(10),
        fontFamily: FontFamilies.ROBOTO_REGULAR
    },
    input: {
        backgroundColor: Colors.greysoft,
        borderRadius: moderateScale(4),
        paddingHorizontal: horizontalScale(14),
        paddingVertical: verticalScale(2),
        fontSize: moderateScale(12),
        color: Colors.primary,
        marginBottom: verticalScale(10),
        borderWidth: moderateScale(1),
        borderColor: Colors.borderColor,
        height: verticalScale(42)
    },
    backIcon: {
        width: moderateScale(24),
        height: moderateScale(24),
        alignSelf: 'flex-end',
    },

});