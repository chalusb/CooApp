import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import * as Notifications from 'expo-notifications';
import HeroHeader from '@/components/HeroHeader';

export const options = {
  headerShown: false,
};

import { apiRoutes } from '@/constants/api';

type CalendarEvent = {
  id: string;
  title: string;
  description?: string | null;
  date: string; // YYYY-MM-DD
  startTime?: string | null; // HH:mm
  notifyBeforeMinutes?: number | null;
  createdAt?: string;
  updatedAt?: string;
};

type CreateEventPayload = {
  title: string;
  description?: string;
  date: string;
  startTime?: string;
  notifyBeforeMinutes?: number | null;
};

type EventNotificationDetails = {
  triggerDate: Date;
  body: string;
};

const CALENDAR_NOTIFICATION_SOURCE = 'calendar-event';
const CALENDAR_NOTIFICATION_SOUND = 'notifications.wav';
const ANDROID_NOTIFICATION_CHANNEL = 'reminders';
const MIN_TRIGGER_WINDOW_MS = 5_000;
const MIN_SECONDS_WINDOW = Math.ceil(MIN_TRIGGER_WINDOW_MS / 1000);


function parseStartTime(value?: string | null): { hours: number; minutes: number } | null {
  if (!value) return null;
  const trimmed = value.trim();
  const match = /^(\d{1,2}):(\d{2})$/.exec(trimmed);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return { hours, minutes };
}

function buildEventStartDate(date: string, startTime?: string | null): Date | null {
  if (!date) return null;
  const parsedTime = parseStartTime(startTime);
  if (!parsedTime) return null;
  const iso = `${date}T${String(parsedTime.hours).padStart(2, '0')}:${String(parsedTime.minutes).padStart(2, '0')}:00`;
  const parsedDate = new Date(iso);
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
}

function buildEventNotificationDetails(event: CalendarEvent): EventNotificationDetails | null {
  const minutesRaw =
    typeof event.notifyBeforeMinutes === 'number' && Number.isFinite(event.notifyBeforeMinutes)
      ? Math.max(0, event.notifyBeforeMinutes)
      : null;
  if (minutesRaw === null) {
    return null;
  }
  const eventStart = buildEventStartDate(event.date, event.startTime);
  if (!eventStart) {
    return null;
  }
  const initialTriggerMs = eventStart.getTime() - minutesRaw * 60_000;
  const now = Date.now();
  let triggerMs = initialTriggerMs;
  if (initialTriggerMs <= now) {
    if (eventStart.getTime() <= now) {
      return null;
    }
    triggerMs = eventStart.getTime();
  }
  if (!Number.isFinite(triggerMs)) {
    return null;
  }
  const triggerDate = new Date(triggerMs);
  if (Number.isNaN(triggerDate.getTime())) {
    return null;
  }
  const body = event.description?.trim()?.length
    ? event.description.trim()
    : minutesRaw > 0 && event.startTime
    ? `Tu evento comienza a las ${event.startTime} hrs.`
    : 'Es hora de tu evento programado.';
  return { triggerDate, body };
}
const MONTH_NAMES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

const WEEKDAY_LABELS = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

const today = new Date();
const HEADER_IMAGE = require('../assets/images/calendar.jpg');

function toDateId(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getMonthMatrix(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const firstWeekDay = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const matrix: Array<Array<{ key: string; label: string; date: string | null }>> = [];
  let current = 1 - firstWeekDay;

  for (let week = 0; week < 6; week++) {
    const row: Array<{ key: string; label: string; date: string | null }> = [];
    for (let day = 0; day < 7; day++) {
      const date = new Date(year, month, current);
      const inMonth = current >= 1 && current <= daysInMonth;
      row.push({
        key: `${year}-${month}-${current}-${week}-${day}`,
        label: inMonth ? `${date.getDate()}` : '',
        date: inMonth ? toDateId(date) : null,
      });
      current += 1;
    }
    matrix.push(row);
  }

  return matrix;
}

function formatDate(date: Date | string) {
  if (typeof date === 'string') return date;
  return toDateId(date);
}

const DATE_PARAM_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function parseDateParam(value?: string | string[] | null): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== 'string') {
    return null;
  }
  if (!DATE_PARAM_REGEX.test(raw)) {
    return null;
  }
  const date = new Date(`${raw}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return toDateId(date) === raw ? raw : null;
}

const DEFAULT_FORM_STATE = {
  title: '',
  description: '',
  startTime: '',
  notifyBefore: '15',
};

type FormState = typeof DEFAULT_FORM_STATE;

export default function CalendarScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ date?: string }>();
  const paramDateId = useMemo(() => parseDateParam(params.date), [params.date]);
  const initialDateId = paramDateId ?? formatDate(today);
  const initialDate = useMemo(() => new Date(`${initialDateId}T00:00:00`), [initialDateId]);

  const [currentYear, setCurrentYear] = useState(initialDate.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(initialDate.getMonth());
  const [selectedDate, setSelectedDate] = useState(initialDateId);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>(DEFAULT_FORM_STATE);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!paramDateId) return;
    const target = new Date(`${paramDateId}T00:00:00`);
    setCurrentYear(target.getFullYear());
    setCurrentMonth(target.getMonth());
    setSelectedDate(paramDateId);
  }, [paramDateId]);

  const monthMatrix = useMemo(() => getMonthMatrix(currentYear, currentMonth), [currentYear, currentMonth]);
  const eventsByDate = useMemo(() => {
    return events.reduce<Record<string, CalendarEvent[]>>((acc, event) => {
      if (!acc[event.date]) acc[event.date] = [];
      acc[event.date].push(event);
      return acc;
    }, {});
  }, [events]);

  const selectedEvents = eventsByDate[selectedDate] || [];

  const ensureNotificationPermissions = useCallback(async () => {
    try {
      const current = await Notifications.getPermissionsAsync();
      if (current.granted) {
        return true;
      }
      const request = await Notifications.requestPermissionsAsync();
      return request.granted;
    } catch (error) {
      console.error('[CALENDAR] permissions error', error);
      return false;
    }
  }, []);

  const scheduleEventNotification = useCallback(
    async (
      event: CalendarEvent,
      detailsOverride?: EventNotificationDetails,
      options: { skipPermissionCheck?: boolean } = {}
    ) => {
      const details = detailsOverride ?? buildEventNotificationDetails(event);
      if (!details) {
        return null;
      }

      if (!options.skipPermissionCheck) {
        const hasPermission = await ensureNotificationPermissions();
        if (!hasPermission) {
          return null;
        }
      }

      const msUntilTrigger = details.triggerDate.getTime() - Date.now();
      if (!Number.isFinite(msUntilTrigger)) {
        return null;
      }
      const secondsUntilTrigger = Math.ceil(msUntilTrigger / 1000);
      if (
        msUntilTrigger <= MIN_TRIGGER_WINDOW_MS ||
        !Number.isFinite(secondsUntilTrigger) ||
        secondsUntilTrigger <= MIN_SECONDS_WINDOW
      ) {
        return null;
      }

      const trigger: Notifications.NotificationTriggerInput =
        Platform.OS === 'android'
          ? { seconds: secondsUntilTrigger, channelId: ANDROID_NOTIFICATION_CHANNEL }
          : details.triggerDate;

      try {
        const identifier = await Notifications.scheduleNotificationAsync({
          content: {
            title: event.title,
            body: details.body,
            sound: CALENDAR_NOTIFICATION_SOUND,
            data: {
              source: CALENDAR_NOTIFICATION_SOURCE,
              eventId: event.id,
              triggerAt: details.triggerDate.toISOString(),
            },
          },
          trigger,
        });
        console.log('[CALENDAR] notification scheduled', {
          eventId: event.id,
          identifier,
          triggerAt: details.triggerDate.toISOString(),
        });
        return identifier;
      } catch (error) {
        console.error('[CALENDAR] schedule notification error', error);
        return null;
      }
    },
    [ensureNotificationPermissions],
  );

  const syncEventNotifications = useCallback(
    async (eventsList: CalendarEvent[]) => {
      try {
        await Notifications.cancelAllScheduledNotificationsAsync();

        if (!eventsList || eventsList.length === 0) {
          return;
        }

        const hasPermission = await ensureNotificationPermissions();
        if (!hasPermission) {
          return;
        }

        const upcoming: Array<{ event: CalendarEvent; details: EventNotificationDetails }> = [];
        const now = Date.now();
        for (const event of eventsList) {
          const details = buildEventNotificationDetails(event);
          if (!details) continue;
          const diff = details.triggerDate.getTime() - now;
          if (!Number.isFinite(diff)) continue;
          if (diff <= MIN_TRIGGER_WINDOW_MS) continue;
          upcoming.push({ event, details });
        }

        if (!upcoming.length) {
          return;
        }

        await Promise.all(
          upcoming.map(({ event, details }) =>
            scheduleEventNotification(event, details, { skipPermissionCheck: true }),
          ),
        );
      } catch (error) {
        console.error('[CALENDAR] sync notifications error', error);
      }
    },
    [ensureNotificationPermissions, scheduleEventNotification],
  );


  const fetchEvents = useCallback(async () => {
    try {
      setError(null);
      const url = apiRoutes.calendar();
      console.log('[CALENDAR] fetch ->', url);
      const response = await fetch(url);
      const json = await response.json().catch(() => null);
      console.log('[CALENDAR] create <-', response.status, json);
      console.log('[CALENDAR] fetch <-', response.status, json);
      if (!response.ok) {
        throw new Error(json?.message || 'No se pudo obtener el calendario');
      }
      const items: CalendarEvent[] = json?.data || [];
      setEvents(items);
      void syncEventNotifications(items);
    } catch (err) {
      console.error('[CALENDAR] fetch error', err);
      setError(err instanceof Error ? err.message : 'Error inesperado');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [syncEventNotifications]);

  useFocusEffect(
    useCallback(() => {
      fetchEvents();
    }, [fetchEvents])
  );

  const handleChangeMonth = (offset: number) => {
    setCurrentMonth(prev => {
      const next = prev + offset;
      if (next < 0) {
        setCurrentYear(year => year - 1);
        return 11;
      }
      if (next > 11) {
        setCurrentYear(year => year + 1);
        return 0;
      }
      return next;
    });
  };

  const openCreateModal = () => {
    setForm({ ...DEFAULT_FORM_STATE, startTime: '09:00' });
    setModalVisible(true);
  };
  const openEditModal = (event: CalendarEvent) => {
    setEditingEvent(event);
    if (event.date) {
      setSelectedDate(event.date);
    }
    setForm({
      title: event.title,
      description: event.description || '',
      startTime: event.startTime || '',
      notifyBefore: typeof event.notifyBeforeMinutes === 'number' ? String(event.notifyBeforeMinutes) : '',
    });
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setForm(DEFAULT_FORM_STATE);
  };

  const handleSubmit = async () => {
    const trimmedTitle = form.title.trim();
    if (!trimmedTitle) {
      Alert.alert('Titulo requerido', 'Escribe un titulo para el evento.');
      return;
    }
    const payload: CreateEventPayload = {
      title: trimmedTitle,
      description: form.description?.trim() || undefined,
      date: selectedDate,
      startTime: form.startTime?.trim() || undefined,
      notifyBeforeMinutes: form.notifyBefore ? Number(form.notifyBefore) || null : null,
    };

    const isEditing = !!editingEvent;
    const url = isEditing ? apiRoutes.calendarEvent(editingEvent!.id) : apiRoutes.calendar();
    const method = isEditing ? 'PATCH' : 'POST';
    const errorMessage = isEditing ? 'No se pudo actualizar el evento' : 'No se pudo crear el evento';

    const shouldScheduleReminder = payload.notifyBeforeMinutes !== null && !!payload.startTime;
    if (shouldScheduleReminder) {
      const hasPermission = await ensureNotificationPermissions();
      if (!hasPermission) {
        Alert.alert('Permiso requerido', 'Activa las notificaciones para programar recordatorios.');
      }
    }

    try {
      setSaving(true);
      console.log('[CALENDAR] submit ->', { isEditing, url, payload });
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await response.json().catch(() => null);
      console.log('[CALENDAR] submit <-', response.status, json);
      if (!response.ok) {
        throw new Error(json?.message || errorMessage);
      }
      const saved: CalendarEvent = json?.data;
      setEvents(prev => {
        const next = isEditing ? prev.map(event => (event.id === saved.id ? saved : event)) : [...prev, saved];
        void syncEventNotifications(next);
        return next;
      });
      closeModal();
      fetchEvents();
    } catch (err) {
      console.error('[CALENDAR] submit error', err);
      Alert.alert('Error', err instanceof Error ? err.message : errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    Alert.alert('Eliminar evento', 'Seguro que deseas eliminar este evento?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            const url = apiRoutes.calendarEvent(eventId);
            console.log('[CALENDAR] delete ->', { url, eventId });
            const response = await fetch(url, { method: 'DELETE' });
            const json = await response.json().catch(() => null);
            console.log('[CALENDAR] delete <-', response.status, json);
            if (!response.ok) {
              throw new Error(json?.message || 'No se pudo eliminar el evento');
            }
            setEvents(prev => {
              const next = prev.filter(event => event.id !== eventId);
              void syncEventNotifications(next);
              return next;
            });
            fetchEvents();
          } catch (err) {
            console.error('[CALENDAR] delete error', err);
            Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo eliminar el evento');
          }
        },
      },
    ]);
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchEvents();
  };

  const handleDayPress = (date: string | null) => {
    if (!date) return;
    setSelectedDate(date);
  };

  const handleBackToHome = () => {
    router.back();
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <HeroHeader title="Calendario" image={HEADER_IMAGE} onBack={handleBackToHome} />
      {loading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#6366F1" />
          <Text style={styles.loaderText}>Cargando eventos...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366F1" />}
        >
          <View style={styles.calendarCard}>
            <View style={styles.monthHeader}>
              <TouchableOpacity style={styles.monthButton} onPress={() => handleChangeMonth(-1)}>
                <Ionicons name="chevron-back" size={18} color="#6366F1" />
              </TouchableOpacity>
              <Text style={styles.monthTitle}>
                {MONTH_NAMES[currentMonth]} {currentYear}
              </Text>
              <TouchableOpacity style={styles.monthButton} onPress={() => handleChangeMonth(1)}>
                <Ionicons name="chevron-forward" size={18} color="#6366F1" />
              </TouchableOpacity>
            </View>
            <View style={styles.weekDaysRow}>
              {WEEKDAY_LABELS.map((label, index) => (
                <Text key={`weekday-${index}`} style={styles.weekDayLabel}>
                  {label}
                </Text>
              ))}
            </View>
            {monthMatrix.map((week, index) => (
              <View key={`week-${index}`} style={styles.weekRow}>
                {week.map(day => {
                  const isSelected = day.date === selectedDate;
                  const hasEvents = !!(day.date && (eventsByDate[day.date]?.length ?? 0) > 0);
                  return (
                    <TouchableOpacity
                      key={day.key}
                      style={[styles.dayCell, isSelected && styles.dayCellSelected]}
                      onPress={() => handleDayPress(day.date)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.dayLabel, isSelected && styles.dayLabelSelected]}>
                        {day.label}
                      </Text>
                      {hasEvents ? <View style={styles.dayDot} /> : null}
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Eventos para {selectedDate}</Text>
            <TouchableOpacity style={styles.addButtonInline} onPress={openCreateModal}>
              <Ionicons name="add-circle-outline" size={20} color="#6366F1" />
              <Text style={styles.addButtonInlineText}>Nuevo evento</Text>
            </TouchableOpacity>
          </View>

          {error ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity onPress={fetchEvents}>
                <Text style={styles.errorRetry}>Reintentar</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {selectedEvents.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="calendar-outline" size={36} color="#9CA3AF" />
              <Text style={styles.emptyTitle}>Sin eventos</Text>
              <Text style={styles.emptySubtitle}>Crea tu primer evento para esta fecha.</Text>
            </View>
          ) : (
            <View style={styles.eventsList}>
              {selectedEvents.map(event => (
                <Pressable key={event.id} style={styles.eventCard} onPress={() => openEditModal(event)}>
                  <View style={styles.eventHeader}>
                    <Text style={styles.eventTitle}>{event.title}</Text>
                    <Pressable hitSlop={10} onPress={(e) => { e.stopPropagation(); handleDeleteEvent(event.id); }}>
                      <Ionicons name="trash-outline" size={18} color="#DC2626" />
                    </Pressable>
                  </View>
                  {event.startTime ? (
                    <View style={styles.eventMeta}>
                      <Ionicons name="time-outline" size={16} color="#6B7280" />
                      <Text style={styles.eventMetaText}>{event.startTime} hrs</Text>
                    </View>
                  ) : null}
                  {event.notifyBeforeMinutes ? (
                    <View style={styles.eventMeta}>
                      <Ionicons name="notifications-outline" size={16} color="#6B7280" />
                      <Text style={styles.eventMetaText}>
                        Avisar {event.notifyBeforeMinutes} min antes
                      </Text>
                    </View>
                  ) : null}
                  {event.description ? <Text style={styles.eventDescription}>{event.description}</Text> : null}
                </Pressable>
              ))}
            </View>
          )}
        </ScrollView>
      )}

      <TouchableOpacity style={styles.fab} onPress={openCreateModal}>
        <Ionicons name="add" size={26} color="#FFFFFF" />
      </TouchableOpacity>

      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={closeModal}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingEvent ? 'Editar evento' : 'Nuevo evento'}</Text>
              <TouchableOpacity onPress={closeModal}>
                <Ionicons name="close" size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalContent}>
              <Text style={styles.fieldLabel}>Titulo</Text>
              <TextInput
                value={form.title}
                onChangeText={value => setForm(prev => ({ ...prev, title: value }))}
                placeholder="Reunion, recordatorio, etc"
                style={styles.textInput}
              />

              <Text style={styles.fieldLabel}>Descripcion</Text>
              <TextInput
                value={form.description}
                onChangeText={value => setForm(prev => ({ ...prev, description: value }))}
                placeholder="Detalles opcionales"
                multiline
                style={[styles.textInput, styles.textArea]}
              />

              <View style={styles.rowFields}>
                <View style={styles.rowFieldItem}>
                  <Text style={styles.fieldLabel}>Hora (24h)</Text>
                  <TextInput
                    value={form.startTime}
                    onChangeText={value => setForm(prev => ({ ...prev, startTime: value }))}
                    placeholder="09:00"
                    style={styles.textInput}
                  />
                </View>
                <View style={styles.rowFieldItem}>
                  <Text style={styles.fieldLabel}>Avisar (min)</Text>
                  <TextInput
                    value={form.notifyBefore}
                    onChangeText={value => setForm(prev => ({ ...prev, notifyBefore: value }))}
                    placeholder="15"
                    keyboardType="numeric"
                    style={styles.textInput}
                  />
                </View>
              </View>
            </ScrollView>

            <TouchableOpacity
              style={[styles.modalSubmit, saving && styles.modalSubmitDisabled]}
              onPress={handleSubmit}
              disabled={saving}
            >
              {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.modalSubmitText}>{editingEvent ? 'Actualizar evento' : 'Guardar evento'}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  loaderContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loaderText: {
    marginTop: 12,
    color: '#6B7280',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 120,
  },
  calendarCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 24,
  },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  monthTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    textTransform: 'capitalize',
  },
  monthButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  weekDaysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  weekDayLabel: {
    width: 36,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  dayCell: {
    width: 36,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayCellSelected: {
    backgroundColor: '#EEF2FF',
  },
  dayLabel: {
    fontSize: 15,
    color: '#111827',
  },
  dayLabelSelected: {
    fontWeight: '700',
    color: '#4F46E5',
  },
  dayDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#4F46E5',
    marginTop: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  addButtonInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  addButtonInlineText: {
    fontSize: 14,
    color: '#6366F1',
    fontWeight: '600',
  },
  errorBanner: {
    backgroundColor: '#FEE2E2',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: '#B91C1C',
    marginBottom: 6,
  },
  errorRetry: {
    color: '#B91C1C',
    fontWeight: '600',
  },
  emptyState: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  emptyTitle: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  emptySubtitle: {
    marginTop: 4,
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
  },
  eventsList: {
    gap: 12,
    marginBottom: 32,
  },
  eventCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  eventMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  eventMetaText: {
    fontSize: 13,
    color: '#6B7280',
  },
  eventDescription: {
    marginTop: 8,
    fontSize: 13,
    color: '#4B5563',
    lineHeight: 18,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 32,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#6366F1',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 32,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  modalContent: {
    gap: 14,
  },
  fieldLabel: {
    fontSize: 14,
    color: '#4B5563',
    fontWeight: '500',
    marginBottom: 6,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: '#111827',
    backgroundColor: '#FFFFFF',
  },
  textArea: {
    height: 90,
    textAlignVertical: 'top',
  },
  rowFields: {
    flexDirection: 'row',
    gap: 12,
  },
  rowFieldItem: {
    flex: 1,
  },
  modalSubmit: {
    marginTop: 20,
    backgroundColor: '#4F46E5',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalSubmitDisabled: {
    opacity: 0.6,
  },
  modalSubmitText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
});






















