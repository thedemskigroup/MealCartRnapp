import { krogerStore } from "@/assets/images";
import { CheckBox, FilledCheckBox, KrogerIcon, SearchIcon } from "@/assets/svg";
import ThemeGradientButton from "@/components/ThemeGradientButton";
import {
  horizontalScale,
  isAndroid,
  moderateScale,
  verticalScale,
} from "@/constants/Constants";
import { Strings } from "@/constants/Strings";
import { Colors, FontFamilies } from "@/constants/Theme";
import { fontSize } from "@/utils/Fonts";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Divider from "./Divider";
import InputTapArea from "./InputTapArea";
import ThemeNormalButton from "./ThemeNormalButton";

const SEARCH_DEBOUNCE_MS = 400;
const ZIP_LENGTH = 5;

interface SelectKrogerStoreProps {
  visible: boolean;
  onClose: () => void;
  stores: any[];
  onSelect: (store: any) => void;
  initialSelectedStoreId?: string | null;
  onSearch?: (zipCode: string) => Promise<void>;
  isSearching?: boolean;
  initialZipCode?: string;
}

const SelectKrogerStore = ({
  visible,
  onClose,
  stores,
  onSelect,
  initialSelectedStoreId = null,
  onSearch,
  isSearching = false,
  initialZipCode = "",
}: SelectKrogerStoreProps) => {
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const searchInputRef = useRef<TextInput>(null);
  // The zip the parent has already loaded stores for. Keeps the debounce
  // below from re-fetching `initialZipCode` the moment the sheet opens, and
  // from repeating a search the magnifier just ran.
  const lastSearchedRef = useRef<string>("");

  const handleSelectStore = () => {
    const store = stores.find(
      (s) => (s.locationId || s.id || s.storeNumber) === selectedStoreId,
    );
    if (store) onSelect(store);
  };

  const getStoreId = (item: any) =>
    item.locationId || item.id || item.storeNumber || "";

  const getStoreAddress = (item: any) =>
    [
      item.address?.addressLine1,
      item.address?.city,
      item.address?.state,
      item.address?.zipCode,
    ]
      .filter(Boolean)
      .join(", ");

  useEffect(() => {
    if (!visible) {
      setSearch("");
      setSelectedStoreId("");
      lastSearchedRef.current = "";
    } else {
      if (initialSelectedStoreId) {
        setSelectedStoreId(initialSelectedStoreId);
      }
      if (initialZipCode) {
        setSearch(initialZipCode);
        lastSearchedRef.current = initialZipCode.trim();
      }
    }
  }, [visible, initialSelectedStoreId, initialZipCode]);

  const runSearch = async (zipCode: string) => {
    if (!onSearch) return;
    lastSearchedRef.current = zipCode;
    setSelectedStoreId(null);
    await onSearch(zipCode);
  };

  // Search as soon as a complete zip is typed. The field is numeric and
  // capped at 5 characters, so a full zip is an unambiguous signal and there
  // is nothing to gain from making the user reach for the keyboard's search
  // key. Partial zips are left to the magnifier, which still works.
  useEffect(() => {
    if (!visible) return;
    const zipCode = search.trim();
    if (zipCode.length !== ZIP_LENGTH) return;
    if (zipCode === lastSearchedRef.current) return;

    const handler = setTimeout(() => {
      void runSearch(zipCode);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, visible]);

  const handleSearchSubmit = async () => {
    const trimmed = search.trim();
    if (!trimmed || !onSearch) return;
    await runSearch(trimmed);
  };

  const renderStoreItem = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.storeCard}
      onPress={() => setSelectedStoreId(getStoreId(item))}
      activeOpacity={0.8}
    >
      <Image
        source={krogerStore}
        style={styles.storeImage}
        resizeMode="cover"
      />
      <View style={styles.storeInfo}>
        <Text style={styles.storeName} numberOfLines={2} ellipsizeMode="tail">
          {Strings.store} {item.storeNumber || ""} -{" "}
          {getStoreAddress(item) || ""}
        </Text>
      </View>
      <View style={styles.checkboxContainer}>
        {selectedStoreId === getStoreId(item) ? (
          <FilledCheckBox
            width={22}
            height={22}
            color={Colors.tertiary}
            style={styles.checkboxIcon}
          />
        ) : (
          <CheckBox
            width={22}
            height={22}
            color={Colors.tertiary}
            style={styles.checkboxIcon}
          />
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.container}>
          <KrogerIcon
            width={horizontalScale(76)}
            height={verticalScale(43)}
            style={{ alignSelf: "flex-end" }}
          />
          <View style={styles.headerRow}>
            <Text style={styles.headerTitle}>
              {Strings.selectKrogerStore_searchingLocations}
            </Text>
          </View>
          <Text style={styles.headerSubtitle}>
            {Strings.selectKrogerStore_subtitle}
          </Text>
          <InputTapArea style={styles.searchBox} inputRef={searchInputRef}>
            <TextInput
              ref={searchInputRef}
              style={styles.searchInput}
              placeholder={Strings.search_store}
              placeholderTextColor={Colors.tertiary}
              value={search}
              onChangeText={setSearch}
              keyboardType="numeric"
              returnKeyType="search"
              onSubmitEditing={handleSearchSubmit}
              maxLength={5}
            />
            <TouchableOpacity
              onPress={handleSearchSubmit}
              disabled={isSearching || !search.trim()}
              style={styles.searchButton}
            >
              {isSearching ? (
                <ActivityIndicator size="small" color={Colors.tertiary} />
              ) : (
                <SearchIcon
                  width={verticalScale(22)}
                  height={verticalScale(22)}
                  color={search.trim() ? Colors.primary : Colors.tertiary}
                />
              )}
            </TouchableOpacity>
          </InputTapArea>
          <Divider showText={false} style={styles.divider} />
          {isSearching ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={Colors.tertiary} />
              <Text style={styles.loadingText}>Searching stores...</Text>
            </View>
          ) : stores.length === 0 ? (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>
                Enter a ZIP code to search for stores
              </Text>
            </View>
          ) : (
            <FlatList
              data={stores}
              renderItem={renderStoreItem}
              keyExtractor={(item) => getStoreId(item)}
              style={styles.listStyle}
              contentContainerStyle={styles.listContent}
            />
          )}
          <View style={styles.buttonRow}>
            <ThemeNormalButton
              title={Strings.selectKrogerStore_cancel}
              onPress={onClose}
              containerStyle={styles.cancelButton}
              backgroundColor={Colors.white}
            />
            <ThemeGradientButton
              title={Strings.selectKrogerStore_selectStore}
              onPress={handleSelectStore}
              buttonGradient={styles.selectButton}
              textStyle={{ color: Colors.white, fontSize: fontSize(16) }}
              disabled={!selectedStoreId}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.18)",
    justifyContent: "center",
    alignItems: "center",
  },
  container: {
    backgroundColor: Colors.white,
    borderRadius: moderateScale(18),
    paddingHorizontal: horizontalScale(18),
    paddingTop: verticalScale(18),
    paddingBottom: verticalScale(15),
    width: "92%",
    alignSelf: "center",
  },
  divider: {
    marginTop: verticalScale(10),
    marginBottom: verticalScale(20),
    gap: 0,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: verticalScale(8),
  },
  headerTitle: {
    fontFamily: FontFamilies.ROBOTO_SEMI_BOLD,
    fontSize: fontSize(21),
    color: Colors.primary,
  },
  krogerLogo: {
    width: 70,
    height: 36,
  },
  checkboxIcon: {
    marginRight: horizontalScale(10),
  },
  headerSubtitle: {
    fontFamily: FontFamilies.ROBOTO_REGULAR,
    fontSize: fontSize(12),
    color: Colors.tertiary,
    marginBottom: verticalScale(12),
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.white,
    borderRadius: moderateScale(30),
    borderWidth: moderateScale(1),
    borderColor: Colors.borderColor,
    paddingHorizontal: horizontalScale(12),
    height: isAndroid ? verticalScale(50) : verticalScale(44),
    marginTop: verticalScale(5),
    marginBottom: verticalScale(8),
  },
  searchInput: {
    flex: 1,
    fontFamily: FontFamilies.ROBOTO_REGULAR,
    fontSize: moderateScale(15),
    color: Colors.primary,
    marginLeft: horizontalScale(8),
  },
  searchButton: {
    padding: moderateScale(6),
  },
  loadingContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: verticalScale(40),
    gap: verticalScale(10),
  },
  loadingText: {
    fontFamily: FontFamilies.ROBOTO_REGULAR,
    fontSize: moderateScale(13),
    color: Colors.tertiary,
  },
  searchIcon: {
    fontSize: fontSize(20),
    marginRight: horizontalScale(10),
  },
  searchText: {
    fontFamily: FontFamilies.ROBOTO_REGULAR,
    fontSize: fontSize(16),
    color: Colors.primary,
  },
  listStyle: {
    marginBottom: verticalScale(10),
    maxHeight: verticalScale(260),
  },
  listContent: {
    gap: verticalScale(10),
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
  checkboxContainer: {
    marginLeft: horizontalScale(10),
  },
  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 2,
    borderColor: Colors.borderColor,
    borderRadius: 4,
    backgroundColor: Colors.white,
  },
  checkboxSelected: {
    backgroundColor: Colors._7B8756,
    borderColor: Colors._7B8756,
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: verticalScale(18),
    gap: moderateScale(10),
  },
  cancelButton: {
    backgroundColor: Colors.white,
    borderRadius: moderateScale(8),
    borderWidth: 1,
    borderColor: Colors.borderColor,
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    height: verticalScale(44),
  },
  cancelButtonText: {
    fontFamily: FontFamilies.ROBOTO_MEDIUM,
    fontSize: fontSize(16),
    color: Colors.primary,
  },
  selectButton: {
    flex: 1,
    borderRadius: moderateScale(8),
    justifyContent: "center",
    alignItems: "center",
  },
});

export default SelectKrogerStore;
