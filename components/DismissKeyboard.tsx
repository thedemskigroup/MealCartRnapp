import React from "react";
import { Keyboard, TouchableWithoutFeedback } from "react-native";

/**
 * DismissKeyboard
 *
 * Wraps a screen (or modal) so that tapping anything which is not itself
 * interactive closes the keyboard.
 *
 * This completes the convention `InputTapArea` describes. Scroll views in this
 * app use `keyboardShouldPersistTaps="handled"`, so an unhandled tap *inside*
 * a scroll view already dismisses the keyboard — but a scroll view only covers
 * the area it occupies. Taps on a screen's header, its footer, the padding
 * around a form, or anywhere on a screen that has no scroll view at all, land
 * on plain `View`s, which are not touch responders, so nothing happens and the
 * keyboard stays up covering the content.
 *
 * `TouchableWithoutFeedback` clones its child and injects the handlers rather
 * than rendering a wrapper, so this adds no node to the tree and cannot change
 * layout. Pass the existing root element as the single child:
 *
 *   <DismissKeyboard>
 *     <SafeAreaView style={styles.container}>...</SafeAreaView>
 *   </DismissKeyboard>
 *
 * Nested touchables keep working — the deepest responder wins — and fields
 * wrapped in `InputTapArea` keep focus, because that Pressable handles the tap
 * before it reaches here.
 *
 * Note this does NOT cover the inside of a scroll view: a ScrollView claims the
 * touch, so it never reaches this handler. Those need
 * `keyboardShouldPersistTaps="handled"` on the scroll view itself.
 */
interface DismissKeyboardProps {
  children: React.ReactElement;
}

const DismissKeyboard: React.FC<DismissKeyboardProps> = ({ children }) => (
  <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
    {children}
  </TouchableWithoutFeedback>
);

export default DismissKeyboard;
