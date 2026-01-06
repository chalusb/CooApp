import { Tabs } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Alert, Platform } from 'react-native';

import { HapticTab } from '@/components/HapticTab';
import { IconSymbol } from '@/components/ui/IconSymbol';
import TabBarBackground from '@/components/ui/TabBarBackground';
import { Colors } from '@/constants/Colors';
import { apiRoutes } from '@/constants/api';
import { PushNotificationsProvider, usePushNotifications } from '@/context/PushNotificationsContext';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export default function TabLayout() {
  return (
    <PushNotificationsProvider>
      <TabNavigator />
    </PushNotificationsProvider>
  );
}

const TabNavigator = () => {
  const colorScheme = useColorScheme();
  const { token: senderToken, registerPushTokenAsync } = usePushNotifications();
  const [sendingLove, setSendingLove] = useState(false);

  const handleSendKiss = useCallback(async () => {
    if (sendingLove) {
      return;
    }

    setSendingLove(true);
    try {
      const activeToken = senderToken || (await registerPushTokenAsync());
      if (!activeToken) {
        Alert.alert('Ups', 'No se pudo preparar este dispositivo para enviar besos.');
        return;
      }

      let recipientTokens: string[] | undefined;
      try {
        const response = await fetch(apiRoutes.notificationsDevices());
        const json = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(json?.message || 'No se pudo obtener la lista de dispositivos.');
        }

        const items: Array<{ token?: string | null }> = Array.isArray(json?.data) ? json.data : [];
        const tokens = items
          .map(item => (typeof item?.token === 'string' ? item.token : null))
          .filter((token): token is string => Boolean(token) && token !== activeToken);
        recipientTokens = tokens.length ? tokens : undefined;
      } catch (error) {
        console.error('[TABS] fetch devices error', error);
        recipientTokens = undefined;
      }

      if (recipientTokens && recipientTokens.length === 0) {
        Alert.alert('Sin destinatarios', 'No hay otros dispositivos registrados para recibir el beso.');
        return;
      }

      const response = await fetch(apiRoutes.notificationsSendMessage(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: 'Eit!',
          message: 'Tu pareja te manda un becerro 🐄',
          senderToken: activeToken,
          recipientTokens,
          sound: 'notifications.wav',
        }),
      });

      const json = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(json?.message || 'No se pudo enviar el beso.');
      }

      Alert.alert('Listo', 'El beso ya va en camino hacia tus otros dispositivos. 💌');
    } catch (error) {
      console.error('[TABS] send kiss error', error);
      Alert.alert('Ups', error instanceof Error ? error.message : 'No se pudo enviar el beso.');
    } finally {
      setSendingLove(false);
    }
  }, [registerPushTokenAsync, senderToken, sendingLove]);

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
        listeners={{
          tabPress: event => {
            event.preventDefault();
            void handleSendKiss();
          },
        }}
        options={{
          title: 'Muack',
          tabBarIcon: ({ color }) => (
            <Ionicons name="chatbubble-ellipses-outline" size={28} color={color} />
          ),
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
};
