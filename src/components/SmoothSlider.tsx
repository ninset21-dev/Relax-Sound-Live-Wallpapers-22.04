import React, { useEffect, useRef, useState } from "react";
import Slider from "@react-native-community/slider";
import type { SliderProps } from "@react-native-community/slider";

/**
 * Drop-in replacement for @react-native-community/slider that fixes the
 * "thumb fights the finger" jitter the user reported when dragging volume,
 * opacity and effect sliders.
 *
 * Root cause: @react-native-community/slider resets the thumb to the
 * prop's `value` whenever it changes — including from re-renders inside
 * onValueChange. We work around that by:
 *   1. Treating the slider as uncontrolled (pass `value` only on mount
 *      via React `key` so external programmatic updates remount the
 *      slider).
 *   2. Only forwarding the dragged value to the parent on
 *      `onSlidingComplete`, so the parent never re-renders the slider
 *      mid-drag.
 *   3. Still emitting `onValueChange` for callers that want a live
 *      label, but never re-rendering the parent's slider in response.
 */
type Props = Omit<SliderProps, "value"> & {
  value: number;
  onValueChange?: (v: number) => void;
  onSlidingComplete?: (v: number) => void;
};

export const SmoothSlider: React.FC<Props> = ({ value, onValueChange, onSlidingComplete, ...rest }) => {
  // Bump `key` whenever the external value diverges from what we last
  // knew about, but ONLY while the user isn't dragging. This remounts
  // the underlying slider so the thumb snaps to the new external value.
  const [mountKey, setMountKey] = useState(0);
  const draggingRef = useRef(false);
  const lastSeenExternal = useRef(value);

  useEffect(() => {
    if (draggingRef.current) return;
    if (Math.abs(value - lastSeenExternal.current) > 1e-6) {
      lastSeenExternal.current = value;
      setMountKey((k) => k + 1);
    }
  }, [value]);

  return (
    <Slider
      {...rest}
      key={mountKey}
      value={value}
      onSlidingStart={() => { draggingRef.current = true; }}
      onValueChange={(v) => { onValueChange?.(v); }}
      onSlidingComplete={(v) => {
        draggingRef.current = false;
        lastSeenExternal.current = v;
        onSlidingComplete?.(v);
      }}
    />
  );
};
