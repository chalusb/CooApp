@echo off
echo Instalando dependencias para autenticacion biometrica...
npx expo install expo-local-authentication
echo Instalando AsyncStorage...
npx expo install @react-native-async-storage/async-storage
echo Todas las instalaciones completadas!
pause
