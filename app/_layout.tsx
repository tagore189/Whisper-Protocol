import { DarkTheme, ThemeProvider } from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { BleConnectionProvider } from "../contexts/BleConnectionContext";

export default function RootLayout() {
  return (
    <ThemeProvider value={DarkTheme}>
      <BleConnectionProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="onboarding" />
          <Stack.Screen name="idgen" />
          <Stack.Screen name="radar" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="chatroom" />
        </Stack>
        <StatusBar style="light" />
      </BleConnectionProvider>
    </ThemeProvider>
  );
}
