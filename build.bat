@echo off
setlocal
set ANDROID_HOME=C:\Users\susha\AppData\Local\Android\Sdk
set JAVA_HOME=C:\Program Files\Microsoft\jdk-21.0.10.7-hotspot
set PATH=%JAVA_HOME%\bin;%PATH%

if not exist " %ANDROID_HOME%\ mkdir \%ANDROID_HOME%\

cd /d C:\Whisper-Protocol
npm run android
