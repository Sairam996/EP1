import { useEffect, useState } from "react";
import * as Location from "expo-location";
import { Platform } from "react-native";

export type Coords = { lat: number; lng: number } | null;

/** Returns user's GPS coords (granted on first use). Returns null while loading or denied. */
export function useUserLocation(): { coords: Coords; status: "loading" | "granted" | "denied" | "unsupported" } {
  const [coords, setCoords] = useState<Coords>(null);
  const [status, setStatus] = useState<"loading" | "granted" | "denied" | "unsupported">("loading");

  useEffect(() => {
    (async () => {
      try {
        if (Platform.OS === "web") {
          if (!("geolocation" in navigator)) { setStatus("unsupported"); return; }
          navigator.geolocation.getCurrentPosition(
            (p) => { setCoords({ lat: p.coords.latitude, lng: p.coords.longitude }); setStatus("granted"); },
            () => setStatus("denied"),
            { timeout: 8000 }
          );
          return;
        }
        const { status: s } = await Location.requestForegroundPermissionsAsync();
        if (s !== "granted") { setStatus("denied"); return; }
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setStatus("granted");
      } catch { setStatus("denied"); }
    })();
  }, []);

  return { coords, status };
}

export function openInMaps(lat: number, lng: number, label?: string) {
  const q = label ? encodeURIComponent(label) : `${lat},${lng}`;
  const url =
    Platform.OS === "ios"
      ? `https://maps.apple.com/?q=${q}&ll=${lat},${lng}`
      : `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&destination_place_id=${q}`;
  const { Linking } = require("react-native");
  Linking.openURL(url).catch(() => {});
}
