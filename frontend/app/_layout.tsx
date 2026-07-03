import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { LogBox, StatusBar, View, Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Linking from "expo-linking";
import { router as expoRouter } from "expo-router";
import { useIconFonts } from "@/src/hooks/use-icon-fonts";
import { AuthProvider } from "@/src/context/AuthContext";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { colors } from "@/src/theme";

LogBox.ignoreAllLogs(true);
SplashScreen.preventAutoHideAsync();

// Foreground handler — MODULE SCOPE
if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: false }),
  });
}
// Android channel — MODULE SCOPE
if (Platform.OS === "android") {
  Notifications.setNotificationChannelAsync("default", {
    name: "Default", importance: Notifications.AndroidImportance.MAX, sound: "default",
  });
}

export default function RootLayout() {
  const [loaded, error] = useIconFonts();
  useEffect(() => { if (loaded || error) SplashScreen.hideAsync(); }, [loaded, error]);

  useEffect(() => {
    if (Platform.OS === "web") return;
    const tapSub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data || {};
      const url = (data as any).deeplink || (data as any).action_url;
      if (!url) return;
      String(url).startsWith("http") ? Linking.openURL(String(url)) : expoRouter.push(String(url) as any);
    });
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (!response) return;
      const data = response.notification.request.content.data || {};
      const url = (data as any).deeplink || (data as any).action_url;
      if (url) String(url).startsWith("http") ? Linking.openURL(String(url)) : expoRouter.push(String(url) as any);
    });
    return () => { tapSub.remove(); };
  }, []);

  if (!loaded && !error) return null;
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <View style={{ flex: 1, backgroundColor: colors.surface }}>
          <StatusBar barStyle="light-content" backgroundColor={colors.surface} />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.surface }, animation: "fade" }} />
        </View>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
