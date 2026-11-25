import { closeIcon } from '@/assets/images';
import { dialogWidth, horizontalScale, moderateScale, verticalScale } from '@/constants/Constants';
import { Strings } from '@/constants/Strings';
import { Colors, FontFamilies } from '@/constants/Theme';
import { useState } from 'react';
import { Dimensions, Image, Modal, StyleSheet, Text, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import BaseButton from './BaseButton';

const categories = ['Breakfast', 'Lunch', 'Dinner', 'Snacks'];
const difficulties = ['Easy', 'Moderate', 'Challenging', 'Expert'];
const prepTimes = ['< 5 Mins', '5 - 10 Mins', '10 - 15 Mins', '> 15 Mins'];

const FilterModal = ({ visible, onClose, onConfirm, onReset }: FilterModalProps) => {
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [selectedDifficulty, setSelectedDifficulty] = useState<string | null>(null);
    const [selectedPrepTime, setSelectedPrepTime] = useState<string | null>(null);
    const handleReset = () => {
        setSelectedCategory(null);
        setSelectedDifficulty(null);
        setSelectedPrepTime(null);
        if (onReset) onReset();
        if (onClose) onClose();
    };

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View style={styles.overlay}>
                <TouchableWithoutFeedback onPress={onClose}>
                    <View style={StyleSheet.absoluteFillObject} />
                </TouchableWithoutFeedback>
                <View style={styles.modalContainer}>
                    <View style={styles.filterWithClose}>

                        <Text style={styles.title}>{Strings.filterModal_filters}</Text>
                        <TouchableOpacity onPress={onClose} >
                            <Image
                                source={closeIcon}
                                style={styles.closeIcon}
                                resizeMode="contain"
                            />
                        </TouchableOpacity>
                    </View>
                    <Text style={styles.label}>{Strings.filterModal_category}</Text>
                    <View style={styles.chipRow}>
                        {categories.map(cat => (
                            <TouchableOpacity
                                key={cat}
                                style={[
                                    styles.chip,
                                    selectedCategory === cat && styles.chipSelected,
                                ]}
                                onPress={() => setSelectedCategory(cat)}
                            >
                                <Text
                                    style={[
                                        styles.chipText,
                                        selectedCategory === cat && styles.chipTextSelected,
                                    ]}
                                >
                                    {cat}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    <Text style={styles.label}>{Strings.filterModal_difficulty}</Text>
                    <View style={styles.chipRow}>
                        {difficulties.map(diff => (
                            <TouchableOpacity
                                key={diff}
                                style={[
                                    styles.chip,
                                    selectedDifficulty === diff && styles.chipSelected,
                                ]}
                                onPress={() => setSelectedDifficulty(diff)}
                            >
                                <Text
                                    style={[
                                        styles.chipText,
                                        selectedDifficulty === diff && styles.chipTextSelected,
                                    ]}
                                >
                                    {diff}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    <Text style={styles.label}>{Strings.filterModal_prepTime}</Text>
                    <View style={styles.chipRow}>
                        {prepTimes.map(time => (
                            <TouchableOpacity
                                key={time}
                                style={[
                                    styles.chip,
                                    selectedPrepTime === time && styles.chipSelected,
                                ]}
                                onPress={() => setSelectedPrepTime(time)}
                            >
                                <Text
                                    style={[
                                        styles.chipText,
                                        selectedPrepTime === time && styles.chipTextSelected,
                                    ]}
                                >
                                    {time}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    <View style={styles.divider} />

                    <View style={styles.footer}>


                        <BaseButton
                            title={Strings.filterModal_reset}
                            gradientButton={false}
                            textColor={Colors.background}
                            width={dialogWidth * 0.42}
                            textStyle={styles.cancelButton}
                            textStyleText={styles.cancelButtonText}
                            onPress={handleReset}
                        />
                        <BaseButton
                            title={Strings.filterModal_confirm}
                            gradientButton={true}
                            textColor={Colors.background}
                            width={dialogWidth * 0.42}
                            textStyle={styles.confirmButton}
                            textStyleText={styles.confirmButtonText}
                            onPress={() => {
                                if (onConfirm) {
                                    onConfirm({
                                        category: selectedCategory,
                                        difficulty: selectedDifficulty,
                                        prepTime: selectedPrepTime,
                                    });
                                }
                                if (onClose) onClose();
                            }}
                        />

                    </View>


                </View>
            </View>
        </Modal>
    );
};

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.10)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContainer: {
        width: dialogWidth * 0.92,
        backgroundColor: Colors.white,
        borderRadius: moderateScale(22),
        padding: horizontalScale(20),
        paddingTop: verticalScale(24),
        paddingBottom: verticalScale(18),
        position: 'relative',
    },
    closeBtn: {
        position: 'absolute',
        right: horizontalScale(16),
        top: verticalScale(14),
        zIndex: 2,
    },
    title: {
        fontFamily: FontFamilies.ROBOTO_SEMI_BOLD,
        fontSize: moderateScale(21),
        color: Colors.primary,
    },
    label: {
        fontFamily: FontFamilies.ROBOTO_SEMI_BOLD,
        fontSize: moderateScale(14),
        color: Colors.primary,
        marginTop: verticalScale(12),
        marginBottom: verticalScale(13)


    },
    chipRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginBottom: verticalScale(8),
    },
    chip: {
        borderWidth: 1,
        borderColor: Colors.borderColor,
        borderRadius: moderateScale(20),
        paddingHorizontal: horizontalScale(11),
        paddingVertical: verticalScale(7),
        marginRight: horizontalScale(10),
        marginBottom: verticalScale(8),
        backgroundColor: Colors.white,
    },
    chipSelected: {
        backgroundColor: Colors._EAF1E2,
        borderColor: Colors._7B8756,
    },
    chipText: {
        fontFamily: FontFamilies.ROBOTO_REGULAR,
        fontSize: moderateScale(14),
        color: Colors.primary,
    },
    chipTextSelected: {
        color: Colors._7B8756,
        fontFamily: FontFamilies.ROBOTO_MEDIUM,
    },
    divider: {
        height: 1,
        backgroundColor: Colors.divider,
        marginVertical: verticalScale(12),
    },
    buttonRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: verticalScale(8),
    },

    resetText: {
        fontFamily: FontFamilies.ROBOTO_MEDIUM,
        fontSize: moderateScale(17),
        color: Colors.tertiary,
    },

    confirmText: {
        fontFamily: FontFamilies.ROBOTO_MEDIUM,
        fontSize: moderateScale(17),
        color: Colors.white,
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: verticalScale(18),
    },
    cancelButton: {
        backgroundColor: Colors.white,
        borderColor: Colors.borderColor,
        borderWidth: moderateScale(1),
        borderRadius: moderateScale(8),
        paddingVertical: verticalScale(12),
        marginRight: horizontalScale(8),
        alignItems: 'center',
    },
    cancelButtonText: {
        fontFamily: FontFamilies.ROBOTO_MEDIUM,
        color: Colors.primary,
        fontSize: moderateScale(14),
    },
    confirmButton: {
        borderRadius: moderateScale(8),
        alignItems: 'center',
    },
    confirmButtonText: {
        fontFamily: FontFamilies.ROBOTO_MEDIUM,
        color: Colors.white,
        fontSize: moderateScale(14),
    },
    filterWithClose: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between'
    },
    closeIcon: {
        width: verticalScale(24),
        height: verticalScale(24),
    },
});

export default FilterModal;