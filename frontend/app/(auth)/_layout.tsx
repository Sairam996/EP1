import { Stack } from "expo-router";

export default function AuthLayout() {
  // Fade keeps the launch letter sequence feeling continuous into login.
  return <Stack screenOptions={{ headerShown: false, animation: "fade" }} />;
}
