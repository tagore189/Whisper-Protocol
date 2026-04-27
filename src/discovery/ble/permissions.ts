import { PermissionsAndroid, Platform } from "react-native";

export async function requestBlePermissions(): Promise<boolean> {
  if (Platform.OS !== "android") return true;

  const permissions = [
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
  ];

  if (Platform.Version >= 31) {
    permissions.push(PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN);
    permissions.push(PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT);
    permissions.push(PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE);
  }

  const results = await PermissionsAndroid.requestMultiple(permissions);

  return permissions.every(
    (p) => results[p] === PermissionsAndroid.RESULTS.GRANTED
  );
}
