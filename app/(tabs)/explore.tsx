import { useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { apiRoutes } from '@/constants/api';
import { usePushNotifications } from '@/context/PushNotificationsContext';

type RegisteredDevice = {
  id: string;
  token: string;
  displayName: string | null;
  tokenType: string | null;
  platform: string | null;
  deviceId: string | null;
  userId: string | null;
  appVersion: string | null;
  active: boolean;
  createdAt: string | null;
  updatedAt: string | null;
  lastUsedAt: string | null;
  deactivatedAt: string | null;
};

type ChatMessage = {
  id: string;
  title: string | null;
  message: string;
  senderToken: string | null;
  senderDeviceId: string | null;
  senderDisplayName: string | null;
  senderPlatform: string | null;
  appVersion: string | null;
  recipientTokens: string[];
  data: unknown;
  deliveredCount: number;
  invalidCount: number;
  createdAt: string | null;
  updatedAt: string | null;
  deliveredAt: string | null;
};

const formatDateTime = (value?: string | null) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
};

const getDeviceLabel = (device: RegisteredDevice, selfToken: string | null) => {
  if (device.displayName) {
    return device.displayName;
  }
  if (device.token === selfToken) {
    return 'Este dispositivo';
  }
  if (device.deviceId) return device.deviceId;
  if (device.platform) return `Dispositivo ${device.platform}`;
  return 'Dispositivo';
};

export default function ChatScreen() {
  const {
    token: senderToken,
    registerPushTokenAsync,
    isRegistering,
    setCurrentDisplayName,
  } = usePushNotifications();

  const [devices, setDevices] = useState<RegisteredDevice[]>([]);
  const [devicesLoading, setDevicesLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [selectedTokens, setSelectedTokens] = useState<string[]>([]);
  const [messageTitle, setMessageTitle] = useState('');
  const [messageBody, setMessageBody] = useState('');
  const [sending, setSending] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [renamingDeviceId, setRenamingDeviceId] = useState<string | null>(null);
  const [renamingValue, setRenamingValue] = useState('');
  const [savingRename, setSavingRename] = useState(false);

  useEffect(() => {
    if (!senderToken) {
      return;
    }
    setSelectedTokens((prev) => prev.filter((tokenValue) => tokenValue !== senderToken));
  }, [senderToken]);

  const fetchDevices = useCallback(async () => {
    setDevicesLoading(true);
    try {
      const response = await fetch(apiRoutes.notificationsDevices());
      const json = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(json?.message || 'No se pudo obtener la lista de dispositivos');
      }
      const items: RegisteredDevice[] = Array.isArray(json?.data) ? json.data : [];
      setDevices(items);

      if (!selectedTokens.length) {
        const autoSelection = items
          .map((item) => item.token)
          .filter((tokenValue) => tokenValue && tokenValue !== senderToken);
        setSelectedTokens(autoSelection);
      } else {
        setSelectedTokens((prev) => prev.filter((tokenValue) => items.some((item) => item.token === tokenValue)));
      }
    } catch (error) {
      console.error('[CHAT] fetch devices error', error);
      Alert.alert('Ups', error instanceof Error ? error.message : 'No se pudo obtener la lista de dispositivos.');
    } finally {
      setDevicesLoading(false);
    }
  }, [selectedTokens.length, senderToken]);

  const fetchMessages = useCallback(async () => {
    setMessagesLoading(true);
    try {
      const response = await fetch(apiRoutes.notificationsMessages());
      const json = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(json?.message || 'No se pudo obtener los mensajes');
      }
      const items: ChatMessage[] = Array.isArray(json?.data) ? json.data : [];
      setMessages(items);
    } catch (error) {
      console.error('[CHAT] fetch messages error', error);
      Alert.alert('Ups', error instanceof Error ? error.message : 'No se pudo obtener los mensajes.');
    } finally {
      setMessagesLoading(false);
    }
  }, []);

  const refreshData = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchDevices(), fetchMessages()]);
    setRefreshing(false);
  }, [fetchDevices, fetchMessages]);

  useFocusEffect(
    useCallback(() => {
      void refreshData();
    }, [refreshData])
  );

  const toggleTokenSelection = useCallback(
    (tokenValue: string) => {
      if (senderToken && tokenValue === senderToken) {
        return;
      }
      setSelectedTokens((prev) => {
        if (prev.includes(tokenValue)) {
          return prev.filter((item) => item !== tokenValue);
        }
        return [...prev, tokenValue];
      });
    },
    [senderToken]
  );

  const handleSelectAll = useCallback(() => {
    setSelectedTokens(
      devices
        .map((device) => device.token)
        .filter((tokenValue) => tokenValue && tokenValue !== senderToken)
    );
  }, [devices, senderToken]);

  const handleClearSelection = useCallback(() => {
    setSelectedTokens([]);
  }, []);

  const handleSendMessage = useCallback(async () => {
    const trimmedMessage = messageBody.trim();
    const trimmedTitle = messageTitle.trim();

    if (!trimmedMessage) {
      Alert.alert('Mensaje requerido', 'Escribe un mensaje antes de enviarlo.');
      return;
    }

    setSending(true);
    try {
      const tokenValue = senderToken || (await registerPushTokenAsync());
      if (!tokenValue) {
        throw new Error('No se pudo registrar el dispositivo para enviar mensajes.');
      }

      const response = await fetch(apiRoutes.notificationsSendMessage(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: trimmedTitle || 'Mensaje nuevo',
          message: trimmedMessage,
          senderToken: tokenValue,
          recipientTokens: selectedTokens.length ? selectedTokens : undefined,
          sound: 'notifications.wav',
        }),
      });

      const json = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(json?.message || 'No se pudo enviar el mensaje');
      }

      const newMessage: ChatMessage | null = json?.data || null;
      if (newMessage) {
        setMessages((prev) => [...prev, newMessage]);
      }

      setMessageBody('');
      setMessageTitle('');
      Alert.alert('Mensaje enviado', 'Tus dispositivos recibiran la notificacion.');
    } catch (error) {
      console.error('[CHAT] send message error', error);
      Alert.alert('Ups', error instanceof Error ? error.message : 'No se pudo enviar el mensaje.');
    } finally {
      setSending(false);
    }
  }, [messageBody, messageTitle, registerPushTokenAsync, selectedTokens, senderToken]);

  const startRename = useCallback(
    (device: RegisteredDevice) => {
      setRenamingDeviceId(device.id);
      const fallback = device.displayName || device.deviceId || getDeviceLabel(device, senderToken);
      setRenamingValue(fallback);
    },
    [senderToken]
  );

  const cancelRename = useCallback(() => {
    setRenamingDeviceId(null);
    setRenamingValue('');
  }, []);

  const submitRename = useCallback(async () => {
    if (!renamingDeviceId) {
      return;
    }

    const trimmedName = renamingValue.trim();
    setSavingRename(true);
    try {
      const response = await fetch(apiRoutes.notificationsDevice(renamingDeviceId), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          displayName: trimmedName.length ? trimmedName : null,
        }),
      });

      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.ok) {
        throw new Error(json?.message || 'No se pudo actualizar el nombre del dispositivo');
      }

      const updatedName =
        typeof json?.data?.displayName === 'string' && json.data.displayName.trim().length
          ? json.data.displayName.trim()
          : trimmedName.length
          ? trimmedName
          : null;

      let updatedToken: string | null = null;
      setDevices((prev) =>
        prev.map((device) => {
          if (device.id === renamingDeviceId) {
            updatedToken = device.token;
            return { ...device, displayName: updatedName };
          }
          return device;
        })
      );

      if (updatedToken && updatedToken === senderToken) {
        setCurrentDisplayName(updatedName);
      }

      cancelRename();
      void fetchDevices();
    } catch (error) {
      console.error('[CHAT] rename device error', error);
      Alert.alert('Ups', error instanceof Error ? error.message : 'No se pudo actualizar el dispositivo.');
    } finally {
      setSavingRename(false);
    }
  }, [cancelRename, fetchDevices, renamingDeviceId, renamingValue, senderToken, setCurrentDisplayName]);

  const recipientSummary = useMemo(() => {
    if (!selectedTokens.length) {
      return 'Todos los dispositivos (excepto este)';
    }
    return `${selectedTokens.length} dispositivo(s) seleccionado(s)`;
  }, [selectedTokens.length]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshData} />}>
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Dispositivos registrados</Text>
          <View style={styles.sectionActions}>
            <TouchableOpacity onPress={handleSelectAll} style={styles.actionButton}>
              <Text style={styles.actionButtonText}>Todos</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleClearSelection} style={styles.actionButton}>
              <Text style={styles.actionButtonText}>Ninguno</Text>
            </TouchableOpacity>
          </View>
        </View>
        {devicesLoading ? (
          <ActivityIndicator size="small" color="#2563EB" />
        ) : devices.length ? (
          devices.map((device) => {
            const isSelected = selectedTokens.includes(device.token);
            const isSelf = device.token === senderToken;
            const isRenaming = renamingDeviceId === device.id;
            const displayLabel = getDeviceLabel(device, senderToken);
            return (
              <View key={device.id} style={styles.deviceContainer}>
                <Pressable
                  style={({ pressed }) => [
                    styles.deviceItem,
                    isSelected && styles.deviceItemSelected,
                    pressed && styles.deviceItemPressed,
                  ]}
                  onPress={() => toggleTokenSelection(device.token)}>
                  <View style={styles.deviceIcon}>
                    <Ionicons
                      name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                      size={22}
                      color={isSelected ? '#2563EB' : '#9CA3AF'}
                    />
                  </View>
                  <View style={styles.deviceMain}>
                    <Text style={[styles.deviceName, isSelf && styles.deviceSelf]}>{displayLabel}</Text>
                    <Text style={styles.deviceMeta}>
                      {device.platform ? device.platform : 'Plataforma desconocida'}
                      {device.appVersion ? ` - v${device.appVersion}` : ''}
                    </Text>
                    <Text style={styles.deviceMeta}>
                      {device.lastUsedAt
                        ? `Ultimo uso: ${formatDateTime(device.lastUsedAt)}`
                        : 'Ultimo uso sin registrar'}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.renameButton}
                    onPress={() => startRename(device)}>
                    <Ionicons name="create-outline" size={20} color="#2563EB" />
                  </TouchableOpacity>
                </Pressable>
                {isRenaming ? (
                  <View style={styles.renameContainer}>
                    <TextInput
                      style={styles.renameInput}
                      placeholder="Nombre del dispositivo"
                      value={renamingValue}
                      onChangeText={setRenamingValue}
                    />
                    <View style={styles.renameActions}>
                      <TouchableOpacity style={styles.renameActionButtonGhost} onPress={cancelRename}>
                        <Text style={styles.renameActionTextGhost}>Cancelar</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.renameActionButton, savingRename && styles.renameActionDisabled]}
                        onPress={submitRename}
                        disabled={savingRename}>
                        {savingRename ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <Text style={styles.renameActionText}>Guardar</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : null}
              </View>
            );
          })
        ) : (
          <Text style={styles.emptyText}>Aun no hay dispositivos registrados.</Text>
        )}
        <Text style={styles.recipientSummary}>{recipientSummary}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Nuevo mensaje</Text>
        <Text style={styles.sectionSubtitle}>
          Comparte avisos con los dispositivos seleccionados. Este mensaje se enviara como notificacion push.
        </Text>
        <TextInput
          style={styles.input}
          placeholder="Asunto (opcional)"
          value={messageTitle}
          onChangeText={setMessageTitle}
        />
        <TextInput
          style={[styles.input, styles.messageInput]}
          multiline
          placeholder="Escribe el mensaje aqui..."
          value={messageBody}
          onChangeText={setMessageBody}
          numberOfLines={4}
        />
        <TouchableOpacity
          style={[styles.sendButton, (sending || isRegistering) && styles.sendButtonDisabled]}
          onPress={handleSendMessage}
          disabled={sending || isRegistering}>
          {sending ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.sendButtonText}>Enviar mensaje</Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Historial</Text>
        {messagesLoading ? (
          <ActivityIndicator size="small" color="#2563EB" />
        ) : messages.length ? (
          messages.map((item) => {
            const isOwnMessage = item.senderToken && item.senderToken === senderToken;
            const senderLabel = isOwnMessage
              ? item.senderDisplayName || 'Tu'
              : item.senderDisplayName || item.senderDeviceId || 'Otro dispositivo';
            return (
              <View key={item.id} style={[styles.messageItem, isOwnMessage ? styles.messageOwn : styles.messageRemote]}>
                <View style={styles.messageHeader}>
                  <Text style={[styles.messageSender, isOwnMessage && styles.messageSenderOwn]}>{senderLabel}</Text>
                  <Text style={styles.messageTimestamp}>{formatDateTime(item.createdAt)}</Text>
                </View>
                {item.title ? <Text style={styles.messageTitle}>{item.title}</Text> : null}
                <Text style={styles.messageBody}>{item.message}</Text>
                <View style={styles.messageFooter}>
                  <Text style={styles.messageMeta}>
                    {item.recipientTokens?.length
                      ? `Destinatarios: ${item.recipientTokens.length}`
                      : 'Difusion general'}
                  </Text>
                  <Text style={styles.messageMeta}>
                    Entregados: {item.deliveredCount ?? 0} | Fallidos: {item.invalidCount ?? 0}
                  </Text>
                </View>
              </View>
            );
          })
        ) : (
          <Text style={styles.emptyText}>Aun no se han enviado mensajes.</Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  content: {
    padding: 20,
    paddingBottom: 100,
    gap: 24,
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 12,
  },
  sectionActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
  },
  actionButtonText: {
    color: '#2563EB',
    fontSize: 13,
    fontWeight: '500',
  },
  deviceContainer: {
    marginBottom: 12,
  },
  deviceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },
  deviceItemSelected: {
    borderColor: '#2563EB',
    backgroundColor: '#F3F4F6',
  },
  deviceItemPressed: {
    backgroundColor: '#EEF2FF',
  },
  deviceIcon: {
    width: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deviceMain: {
    flex: 1,
    marginLeft: 12,
  },
  deviceName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  deviceSelf: {
    color: '#2563EB',
  },
  deviceMeta: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  renameButton: {
    padding: 6,
  },
  renameContainer: {
    marginTop: 8,
    padding: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  renameInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    backgroundColor: '#FFFFFF',
  },
  renameActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 10,
  },
  renameActionButton: {
    backgroundColor: '#2563EB',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  renameActionDisabled: {
    opacity: 0.6,
  },
  renameActionText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  renameActionButtonGhost: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  renameActionTextGhost: {
    color: '#6B7280',
    fontWeight: '500',
  },
  recipientSummary: {
    marginTop: 8,
    fontSize: 13,
    color: '#4B5563',
    fontWeight: '500',
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    marginBottom: 12,
    backgroundColor: '#F9FAFB',
  },
  messageInput: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  sendButton: {
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  sendButtonDisabled: {
    opacity: 0.7,
  },
  sendButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 15,
  },
  messageItem: {
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  messageOwn: {
    borderColor: '#2563EB33',
    backgroundColor: '#EFF6FF',
  },
  messageRemote: {
    borderColor: '#E5E7EB',
  },
  messageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  messageSender: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  messageSenderOwn: {
    color: '#2563EB',
  },
  messageTimestamp: {
    fontSize: 11,
    color: '#6B7280',
  },
  messageTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  messageBody: {
    fontSize: 14,
    color: '#1F2937',
    marginBottom: 8,
  },
  messageFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  messageMeta: {
    fontSize: 11,
    color: '#6B7280',
  },
  emptyText: {
    fontSize: 13,
    color: '#9CA3AF',
  },
});
