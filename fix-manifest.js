const fs = require('fs');

const xml = `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <uses-permission android:name="android.permission.INTERNET"/>
    <uses-permission android:name="android.permission.BLUETOOTH"/>
    <uses-permission android:name="android.permission.BLUETOOTH_ADMIN"/>
    <uses-permission android:name="android.permission.BLUETOOTH_SCAN"/>
    <uses-permission android:name="android.permission.BLUETOOTH_CONNECT"/>
    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
    <application android:name=".MainApplication" android:label="@string/app_name" android:icon="@mipmap/ic_launcher" android:roundIcon="@mipmap/ic_launcher_round"
        android:allowBackup="true" android:theme="@style/AppTheme" android:supportsRtl="true">
        <activity android:name=".MainActivity" android:configChanges="keyboard|keyboardHidden|orientation|screenSize" android:launchMode="singleTask" android:theme="@style/Theme.App.SplashScreen" android:exported="true" android:screenOrientation="portrait">
            <intent-filter>
                <action android:name="android.intent.action.MAIN"/>
                <category android:name="android.intent.category.LAUNCHER"/>
            </intent-filter>
        </activity>
    </application>
</manifest>`;

fs.writeFileSync('android/app/src/main/AndroidManifest.xml', xml);
console.log('AndroidManifest.xml created successfully');
