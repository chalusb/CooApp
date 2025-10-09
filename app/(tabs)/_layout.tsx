import { Tabs } from 'expo-router';
import React, { useCallback, useEffect, useRef } from 'react';
import { Alert, Platform } from 'react-native';

import { HapticTab } from '@/components/HapticTab';
import { IconSymbol } from '@/components/ui/IconSymbol';
import TabBarBackground from '@/components/ui/TabBarBackground';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';

import { apiRoutes } from '@/constants/api';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const resolveProjectId = () =>
  Constants.easConfig?.projectId || Constants.expoConfig?.extra?.eas?.projectId || null;

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const expoPushTokenRef = useRef<string | null>(null);
  const registeringTokenRef = useRef(false);

  useEffect(() => {
    if (Platform.OS === 'android') {
      void Notifications.setNotificationChannelAsync('reminders', {
        name: 'Recordatorios',
        importance: Notifications.AndroidImportance.HIGH,
        sound: 'notifications.wav',
      });
    }
  }, []);

  const ensurePermissionsAsync = useCallback(async () => {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) {
      return true;
    }

    const request = await Notifications.requestPermissionsAsync();
    return request.granted;
  }, []);

  const registerPushTokenAsync = useCallback(async (): Promise<string | null> => {
    if (expoPushTokenRef.current && !registeringTokenRef.current) {
      return expoPushTokenRef.current;
    }

    if (registeringTokenRef.current) {
      return expoPushTokenRef.current;
    }

    registeringTokenRef.current = true;
    try {
      const hasPermission = await ensurePermissionsAsync();
      if (!hasPermission) {
        Alert.alert('Permiso requerido', 'Activa las notificaciones para poder enviar recordatorios.');
        return null;
      }

      if (!Device.isDevice) {
        Alert.alert('Equipo no soportado', 'Las notificaciones push solo funcionan en dispositivos fisicos.');
        return null;
      }

      const projectId = resolveProjectId();
      if (!projectId) {
        console.warn('[NOTIFICATIONS] missing EAS project id for Expo push tokens');
        return null;
      }

      const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId });
      const token = tokenResponse.data;
      expoPushTokenRef.current = token;

      const registerUrl = apiRoutes.notificationsRegister();
      console.log('[NOTIFICATIONS] register ->', registerUrl);
      const response = await fetch(registerUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          platform: Platform.OS,
          deviceId: `${Device.brand ?? 'unknown'}-${Device.modelName ?? 'device'}`,
          appVersion: Constants.expoConfig?.version ?? null,
        }),
      });
      console.log('[NOTIFICATIONS] register <-', response.status);

      if (!response.ok) {
        const errorBody = await response
          .json()
          .catch(() => ({ message: 'No se pudo registrar el dispositivo para notificaciones.' }));
        throw new Error(errorBody?.message ?? 'No se pudo registrar el dispositivo para notificaciones.');
      }

      return token;
    } catch (error) {
      console.error('[NOTIFICATIONS] register token error', error);
      const message =
        error instanceof Error && error.message
          ? error.message
          : 'No se pudo registrar el dispositivo para notificaciones.';
      Alert.alert('Ups', message);
      return null;
    } finally {
      registeringTokenRef.current = false;
    }
  }, [ensurePermissionsAsync]);

  useEffect(() => {
    void registerPushTokenAsync();
  }, [registerPushTokenAsync]);

  const handleNotificationPress = useCallback(async () => {
    try {
      const token = await registerPushTokenAsync();
      if (!token) {
        return;
      }

      const response = await fetch(apiRoutes.notificationsBroadcast(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: 'Notificacion de prueba',
          body: 'Hola! Esta es una alerta para verificar las notificaciones.',
          data: {
            screen: 'pendientes',
            sentAt: new Date().toISOString(),
          },
          sound: 'notifications.wav',
          senderToken: token,
        }),
      });

      if (!response.ok) {
        const errorBody = await response
          .json()
          .catch(() => ({ message: 'No se pudo enviar la notificacion' }));
        throw new Error(errorBody.message);
      }

      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Notificacion enviada',
          body: 'Aviso enviado al resto de dispositivos registrados.',
          sound: 'notifications.wav',
        },
        trigger: Platform.OS === 'android' ? { channelId: 'reminders', seconds: 1 } : null,
      });
    } catch (error) {
      console.error('[NOTIFICATIONS] broadcast error', error);
      Alert.alert('Ups', error instanceof Error ? error.message : 'Ocurrio un error enviando la notificacion.');
    }
  }, [registerPushTokenAsync]);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarBackground: TabBarBackground,
        tabBarStyle: Platform.select({
          ios: {
            position: 'absolute',
          },
          default: {},
        }),
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Notificar',
          tabBarIcon: ({ color }) => <Ionicons name="notifications-outline" size={28} color={color} />,
        }}
        listeners={{
          tabPress: event => {
            event.preventDefault();
            void handleNotificationPress();
          },
        }}
      />
      <Tabs.Screen
        name="logout"
        options={{
          title: 'Logout',
          tabBarIcon: ({ color }) => <Ionicons name="log-out-outline" size={28} color={color} />,
        }}
      />
    </Tabs>
  );
}












