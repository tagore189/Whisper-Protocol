import { MaterialIcons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { useWhisperAdvertising } from "../../backend/ble/useWhisperAdvertising";

export default function TabsLayout() {
  useWhisperAdvertising({ autoStart: true });
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#100f23",
          borderTopColor: "rgba(255,255,255,0.1)",
        },
        tabBarActiveTintColor: "#6961ff",
        tabBarInactiveTintColor: "#9ca3af",
      }}
    >
      <Tabs.Screen
        name="mesh"
        options={{
          title: "Mesh",
          tabBarIcon: ({ color }: { color: string }) => (
            <MaterialIcons name="hub" size={22} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="meshchat"
        options={{
          title: "Chats",
          tabBarIcon: ({ color }: { color: string }) => (
            <MaterialIcons name="chat-bubble" size={22} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color }: { color: string }) => (
            <MaterialIcons name="settings" size={22} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
