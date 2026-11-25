import {
  FirstSlideshot,
  SecondSlideshot,
  ThirdSlideshot,
  firstslide,
  secondslide,
  thirdslide,
} from "@/assets/images";
import ThemeGradientButton from "@/components/ThemeGradientButton";
import { APP_ROUTES } from "@/constants/AppRoutes";
import { horizontalScale, layoutWidth, moderateScale, verticalScale } from "@/constants/Constants";
import { Strings } from "@/constants/Strings";
import { Colors } from "@/constants/Theme";
import { FontFamily, fontSize } from "@/utils/Fonts";
import { pushNavigation } from "@/utils/Navigation";
import React, { useRef, useState } from "react";
import {
  Dimensions,
  FlatList,
  ImageBackground,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const { height } = Dimensions.get("window");
const { width } = Dimensions.get("window");
const slides = [
  {
    heading: "Welcome to MealCart  ",
    subheading: "All your meal planning, simplified in one place.",
    image: FirstSlideshot,
    background: thirdslide,
  },
  {
    heading: "Build Your Perfect week",
    subheading:
      "Create custom meal plans from your favorite receipes with just a few taps",
    image: SecondSlideshot,
    background: secondslide,
  },
  {
    heading: "Shop Smarter,  Not Harder",
    subheading:
      "Automatically generate an organized shopping list from your plan. Never forget an ingredient again.",
    image: ThirdSlideshot,
    background: firstslide,
  },
];

const WelcomeMealCart: React.FC = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  const goNext = () => {
    if (currentIndex < slides.length - 1) {
      const nextIndex = currentIndex + 1;
      setCurrentIndex(nextIndex);
      flatListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
    } else {
      pushNavigation(APP_ROUTES.KROGER_SIGNUP);
    }
  };

  const goBack = () => {
    if (currentIndex > 0) {
      const prevIndex = currentIndex - 1;
      setCurrentIndex(prevIndex);
      flatListRef.current?.scrollToIndex({ index: prevIndex, animated: true });
    }
  };

  const renderItem = ({ item }: { item: (typeof slides)[0] }) => (
    <View style={[styles.slide]}>
      <Text style={styles.heading}>{item.heading}</Text>
      <Text style={styles.subheading}>{item.subheading}</Text>
    </View>
  );

  return (
    <ImageBackground
      source={slides[currentIndex].background}
      style={{ flex: 1 }}
    >
      <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
        <FlatList
          data={slides}
          horizontal
          ref={flatListRef}
          renderItem={renderItem}
          keyExtractor={(_, index) => index.toString()}
          scrollEnabled={false}
          showsHorizontalScrollIndicator={false}
          pagingEnabled
        />

        <View style={styles.dotsContainer}>
          {slides.map((_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                {
                  backgroundColor:
                    index === currentIndex ? Colors._3A4D25 : Colors.divider,
                },
              ]}
            />
          ))}
        </View>

        <View style={styles.buttonsContainer}>
          {currentIndex > 0 && (
            <TouchableOpacity onPress={goBack} style={styles.backButton}>
              <Text style={styles.buttonText}>
                {Strings.welcomeMealCart_back}
              </Text>
            </TouchableOpacity>
          )}

          <ThemeGradientButton
            title={
              currentIndex === 2
                ? Strings.welcomeMealCart_getStarted
                : Strings.welcomeMealCart_next
            }
            width={currentIndex > 0 ? layoutWidth * 0.7 : layoutWidth * 0.9}
            gradientStartColor={Colors._667D4C}
            gradientEndColor={Colors._9DAF89}
            gradientStart={{ x: 0, y: 0 }}
            gradientEnd={{ x: 1, y: 0 }}
            textStyle={{ color: Colors.background }}
            onPress={goNext}
          />
        </View>
      </SafeAreaView>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    paddingBottom: verticalScale(20),
    paddingTop: verticalScale(10),
    width: "100%",
  },

  slide: {
    alignItems: "center",
    width: width,
  },

  heading: {
    fontWeight: "900",
    marginBottom: verticalScale(10),
    color: Colors.primary,
    fontSize: moderateScale(34),

    flexWrap: "wrap",
    textAlign: "center",

    maxWidth: layoutWidth * 0.9,
  },

  subheading: {
    fontSize: moderateScale(14),
    color: Colors.tertiary,
    fontWeight: "400",
    flexWrap: "wrap",
    textAlign: "center",

    maxWidth: layoutWidth * 0.9,
  },
  parentImage: {
    maxWidth: layoutWidth * 0.9,

    justifyContent: "center",
    alignItems: "center",
    height: verticalScale(500),
  },
  image: {
    width: width * 1,
    height: height * 0.5,
    marginTop: verticalScale(28),
  },
  dotsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: verticalScale(20),
  },
  dot: {
    width: verticalScale(7),
    height: verticalScale(7),
    borderRadius: verticalScale(3.5),
    marginHorizontal: horizontalScale(5),
  },

  backButton: {
    backgroundColor: Colors.buttonBackground,
    paddingHorizontal: verticalScale(25),
    paddingVertical: verticalScale(15),
    borderRadius: verticalScale(12),
  },

  gradientButton: {
    paddingVertical: 15,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    maxWidth: 5000,
  },
  buttonText: {
    color: Colors.textBlack,
    fontFamily: FontFamily.ROBOTO_MEDIUM,
    fontSize: fontSize(14),
  },
  buttonTextGradient: {
    color: Colors.white,
    fontWeight: "bold",
    fontSize: 16,
  },
  nextButtonWrapper: {
    borderRadius: 12,
  },
  buttonsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    margin: moderateScale(10),
    gap: horizontalScale(5),
    marginBottom: verticalScale(10),
  },
});

export default WelcomeMealCart;
