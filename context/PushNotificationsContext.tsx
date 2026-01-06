import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';

import { apiRoutes } from '@/constants/api';

type PushNotificationsContextValue = {
  token: string | null;
  displayName: string | null;
  ensurePermissionsAsync: () => Promise<boolean>;
  registerPushTokenAsync: () => Promise<string | null>;
  isRegistering: boolean;
  setCurrentDisplayName: (value: string | null) => void;
};

const PushNotificationsContext = createContext<PushNotificationsContextValue>({
  token: null,
  displayName: null,
  ensurePermissionsAsync: async () => false,
  registerPushTokenAsync: async () => null,
  isRegistering: false,
  setCurrentDisplayName: () => {},
});

const resolveProjectId = () =>
  Constants.easConfig?.projectId || Constants.expoConfig?.extra?.eas?.projectId || null;

export const PushNotificationsProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [token, setToken] = useState<string | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const registeringRef = useRef(false);
  const tokenRef = useRef<string | null>(null);
  const displayNameRef = useRef<string | null>(null);
  const defaultDisplayNameRef = useRef(
    [Device.brand, Device.modelName].filter(Boolean).join(' ') || 'Mi dispositivo'
  );

  const assignDisplayName = useCallback((value: string | null) => {
    const normalized =
      typeof value === 'string' && value.trim().length ? value.trim().slice(0, 80) : null;
    displayNameRef.current = normalized;
    setDisplayName(normalized);
  }, []);

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
    if (registeringRef.current) {
      return tokenRef.current;
    }

    if (tokenRef.current) {
      return tokenRef.current;
    }

    setIsRegistering(true);
    registeringRef.current = true;
    try {
      const hasPermission = await ensurePermissionsAsync();
      if (!hasPermission) {
        Alert.alert('Permiso requerido', 'Activa las notificaciones para poder enviar mensajes.');
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
      const expoToken = tokenResponse.data;
      if (!expoToken) {
        throw new Error('No se pudo obtener el token de notificaciones');
      }

      tokenRef.current = expoToken;
      setToken(expoToken);

      const registerUrl = apiRoutes.notificationsRegister();
      const desiredDisplayName = displayNameRef.current ?? defaultDisplayNameRef.current;
      const response = await fetch(registerUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: expoToken,
          platform: Platform.OS,
          deviceId: `${Device.brand ?? 'unknown'}-${Device.modelName ?? 'device'}`,
          appVersion: Constants.expoConfig?.version ?? null,
          displayName: desiredDisplayName,
        }),
      });

      const responseBody = await response
        .json()
        .catch(() => ({ message: 'No se pudo registrar el dispositivo para notificaciones.' }));
      if (!response.ok || !responseBody?.ok) {
        throw new Error(
          responseBody?.message ?? 'No se pudo registrar el dispositivo para notificaciones.'
        );
      }

      const serverDisplayName =
        typeof responseBody?.displayName === 'string' && responseBody.displayName.trim().length
          ? responseBody.displayName.trim()
          : desiredDisplayName;
      assignDisplayName(serverDisplayName ?? null);

      return expoToken;
    } catch (error) {
      console.error('[NOTIFICATIONS] register token error', error);
      const message =
        error instanceof Error && error.message
          ? error.message
          : 'No se pudo registrar el dispositivo para notificaciones.';
      Alert.alert('Ups', message);
      return null;
    } finally {
      registeringRef.current = false;
      setIsRegistering(false);
    }
  }, [ensurePermissionsAsync, assignDisplayName]);

  const value = useMemo<PushNotificationsContextValue>(
    () => ({
      token,
      displayName,
      ensurePermissionsAsync,
      registerPushTokenAsync,
      isRegistering,
      setCurrentDisplayName: assignDisplayName,
    }),
    [token, displayName, ensurePermissionsAsync, registerPushTokenAsync, isRegistering, assignDisplayName]
  );

  return <PushNotificationsContext.Provider value={value}>{children}</PushNotificationsContext.Provider>;
};

export const usePushNotifications = () => useContext(PushNotificationsContext);
