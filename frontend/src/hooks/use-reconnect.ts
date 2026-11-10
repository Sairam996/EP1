import { useEffect, useRef } from "react";
import { onReconnect } from "../connectivity";

/** Run `fn` whenever the app comes back online / the server recovers. */
export function useOnReconnect(fn: () => void) {
  const ref = useRef(fn);
  useEffect(() => { ref.current = fn; }, [fn]);
  useEffect(() => onReconnect(() => ref.current()), []);
}
