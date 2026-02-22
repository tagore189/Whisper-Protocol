import { PermissionsAndroid, Platform } from "react-native";

export async function requestBlePermissions(): Promise<boolean> {
  if (Platform.OS !== "android") return true;

  const permissions = [
    PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
    PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
  ];

  const results = await PermissionsAndroid.requestMultiple(permissions);

  return permissions.every(
    (p) => results[p] === PermissionsAndroid.RESULTS.GRANTED
  );
}
