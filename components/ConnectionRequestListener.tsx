import React, { useEffect } from "react";
import { Alert } from "react-native";
import { useRouter } from "expo-router";
import { supabase } from '../src/storage/supabase';
import { useAppSettings } from '../src/core/AppSettingsContext';

export function ConnectionRequestListener() {
  const { settings } = useAppSettings();
  const router = useRouter();

  useEffect(() => {
    if (!settings.deviceId) return;

    // Listen to connection_requests where receiver_device_id = my deviceId and status = pending
    const channel = supabase
      .channel("connection_requests_listener")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "connection_requests",
          filter: `receiver_device_id=eq.${settings.deviceId}`,
        },
        (payload) => {
          const newRequest = payload.new;
          if (newRequest.status === "pending") {
            handleIncomingRequest(newRequest);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [settings.deviceId, settings.requireConfirmation]);

  const handleIncomingRequest = async (request: any) => {
    // Optionally fetch sender device name from users table
    let senderName = "Unknown Device";
    try {
      const { data } = await supabase
        .from("users")
        .select("device_name")
        .eq("device_id", request.sender_device_id)
        .single();
      if (data?.device_name) {
        senderName = data.device_name;
      }
    } catch (e) {}

    Alert.alert(
      "Connection Request",
      `${senderName} wants to connect with you.`,
      [
        { text: "Dismiss", style: "cancel" },
        {
          text: "View Requests",
          onPress: () => router.push("/network"),
        },
      ]
    );
  };

  const updateRequestStatus = async (requestId: string, status: "accepted" | "rejected") => {
    await supabase
      .from("connection_requests")
      .update({ status })
      .eq("id", requestId);
  };

  const promptAddChat = (senderName: string, senderId: string) => {
    Alert.alert(
      "Connected!",
      `Would you like to add ${senderName} to your chats?`,
      [
        { text: "No", style: "cancel" },
        { 
          text: "Yes", 
          onPress: () => {
            router.push(`/chatroom?peerId=${encodeURIComponent(senderId)}`);
          }
        }
      ]
    );
  };

  return null; // Headless component
}
