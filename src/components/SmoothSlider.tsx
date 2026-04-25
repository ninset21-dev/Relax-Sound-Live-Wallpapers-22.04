import React, { useEffect, useRef, useState } from "react";
import Slider from "@react-native-community/slider";
import type { SliderProps } from "@react-native-community/slider";

/**
 * Drop-in replacement for @react-native-community/slider that fixes the
 * "thumb fights the finger" jitter the user reported when dragging volume,
 * opacity and effect sliders.
 *
 * Root cause: setting `value` on every onValueChange re-render makes the
 * native slider reset its visual thumb position back to the prop, causing
 * the thumb to jump while the finger is still moving.
 *
 * Fix: track an internal `localValue` that the native slider never
 * "controls", and only push the external value into the slider when it
 * actually changes (e.g. someone else updated it programmatically). During
 * a drag, the parent state updates do NOT touch the slider's controlled
 * value, so the thumb stays under the finger.
 */
type Props = Omit<SliderProps, "value"> & {
  value: number;
  /** Called continuously while dragging — for live preview / label. */
  onValueChange?: (v: number) => void;
  /** Called once when the user lifts their finger — for committing state. */
  onSlidingComplete?: (v: number) => void;
};

export const SmoothSlider: React.FC<Props> = ({ value, onValueChange, onSlidingComplete, ...rest }) => {
  // The "displayed" value: starts at parent prop, updates as the user drags
  // and when the parent prop changes from outside (e.g. native broadcast).
  const [internal, setInternal] = useState(value);
  const draggingRef = useRef(false);

  // Sync external prop changes into the slider only when we're NOT
  // dragging, so the thumb never jumps mid-gesture.
  useEffect(() => {
    if (!draggingRef.current) setInternal(value);
  }, [value]);

  return (
    <Slider
      {...rest}
      value={internal}
      onSlidingStart={() => { draggingRef.current = true; }}
      onValueChange={(v) => {
        setInternal(v);
        onValueChange?.(v);
      }}
      onSlidingComplete={(v) => {
        draggingRef.current = false;
        setInternal(v);
        onSlidingComplete?.(v);
      }}
    />
  );
};
