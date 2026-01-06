import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  RefreshControl,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import HeroHeader from '@/components/HeroHeader';
import { apiRoutes } from '@/constants/api';
import { computeDebtBalance, normalizeDebtEntry, sortDebtEntries } from '@/core/debts/normalizers';
import type { DebtEntry, DebtEntryType } from '@/types/debts';

export const options = {
  headerShown: false,
};

type DebtFormState = {
  title: string;
  amount: string;
  date: string;
  type: DebtEntryType;
};

const HEADER_IMAGE = require('../assets/images/deuda.jpeg');

const INITIAL_FORM: DebtFormState = {
  title: '',
  amount: '',
  date: new Date().toISOString().slice(0, 10),
  type: 'deuda',
};

const QUICK_CONCEPTS = ['Domino', 'Agua', 'Iglesia'];

const formatCurrency = (value: number) => {
  try {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(value);
  } catch {
    return `$${value.toFixed(2)}`;
  }
};

const formatDate = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) {
    return value;
  }
  try {
    return parsed.toLocaleDateString('es-MX', { dateStyle: 'medium' });
  } catch {
    return parsed.toISOString().slice(0, 10);
  }
};

const normalizeFormDate = (value: string) => {
  if (!value) return new Date().toISOString().slice(0, 10);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) {
    return new Date().toISOString().slice(0, 10);
  }
  return parsed.toISOString().slice(0, 10);
};

const formatFormDateLabel = (value: string) => {
  try {
    const parsed = new Date(value);
    return parsed.toLocaleDateString('es-MX', { dateStyle: 'medium' });
  } catch {
    return value;
  }
};

export default function DebtScreen() {
  const router = useRouter();
  const [entries, setEntries] = useState<DebtEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [form, setForm] = useState<DebtFormState>(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [iosDatePickerVisible, setIosDatePickerVisible] = useState(false);
  const [editingEntry, setEditingEntry] = useState<DebtEntry | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const summary = useMemo(() => computeDebtBalance(entries), [entries]);

  const fetchDebts = useCallback(
    async (options: { silent?: boolean } = {}) => {
      const { silent = false } = options;
      if (!silent) {
        setLoading(true);
      }
      setError(null);
      try {
        const response = await fetch(apiRoutes.debts('?order=-date'));
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          const message =
            payload && typeof payload.message === 'string'
              ? payload.message
              : 'No se pudieron obtener las deudas';
          throw new Error(message);
        }
        const rawList: unknown[] = Array.isArray(payload?.data) ? payload.data : [];
        const normalized = rawList
          .map(normalizeDebtEntry)
          .filter((entry): entry is DebtEntry => Boolean(entry));
        setEntries(sortDebtEntries(normalized));
      } catch (err) {
        console.error('[DEUDA] fetch error', err);
        setError(err instanceof Error ? err.message : 'Error desconocido');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    []
  );

  useFocusEffect(
    useCallback(() => {
      fetchDebts();
    }, [fetchDebts])
  );

  const openModal = useCallback((type: DebtEntryType = 'deuda') => {
    setForm({
      ...INITIAL_FORM,
      type,
    });
    setIosDatePickerVisible(false);
    setEditingEntry(null);
    setModalVisible(true);
  }, []);

  const closeModal = useCallback(() => {
    setModalVisible(false);
    setSubmitting(false);
    setIosDatePickerVisible(false);
    setForm(INITIAL_FORM);
    setEditingEntry(null);
  }, []);

  const handleSelectConcept = useCallback((value: string) => {
    setForm(prev => ({ ...prev, title: value }));
  }, []);

  const handleDatePress = useCallback(() => {
    const currentValue = new Date(form.date);
    const pickerDate = Number.isNaN(currentValue.valueOf()) ? new Date() : currentValue;

    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: pickerDate,
        mode: 'date',
        onChange: (_event, selectedDate) => {
          if (selectedDate) {
            setForm(prev => ({ ...prev, date: normalizeFormDate(selectedDate.toISOString()) }));
          }
        },
      });
    } else {
      setIosDatePickerVisible(true);
    }
  }, [form.date]);

  const handleIosDateChange = useCallback(
    (event: any, selectedDate?: Date) => {
      if (event?.type === 'set' && selectedDate) {
        setForm(prev => ({ ...prev, date: normalizeFormDate(selectedDate.toISOString()) }));
      }
      if (event?.type === 'set' || event?.type === 'dismissed') {
        setIosDatePickerVisible(false);
      }
    },
    []
  );

  const handleSubmit = useCallback(async () => {
    const trimmedTitle = form.title.trim();
    const normalizedAmount = Number(form.amount.replace(/,/g, '.'));
    if (!trimmedTitle) {
      Alert.alert('Ingresa un concepto', 'Necesitas indicar el motivo o nombre de la deuda/abono.');
      return;
    }
    if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
      Alert.alert('Cantidad inválida', 'Escribe un monto positivo, por ejemplo 150.');
      return;
    }
    const isoDate = new Date(form.date).toISOString();
    setSubmitting(true);
    try {
      const isEditing = Boolean(editingEntry);
      const endpoint = isEditing ? apiRoutes.debt(editingEntry!.id) : apiRoutes.debts();
      const response = await fetch(endpoint, {
        method: isEditing ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          data: {
            title: trimmedTitle,
            amount: normalizedAmount,
            type: form.type,
            date: isoDate,
          },
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message =
          payload && typeof payload.message === 'string'
            ? payload.message
            : 'No se pudo registrar el movimiento';
        throw new Error(message);
      }
      const normalized = normalizeDebtEntry(payload?.data);
      if (normalized) {
        setEntries(prev => {
          if (!editingEntry) {
            return sortDebtEntries([normalized, ...prev]);
          }
          return sortDebtEntries(prev.map(entry => (entry.id === editingEntry.id ? normalized : entry)));
        });
      } else {
        fetchDebts({ silent: true });
      }
      closeModal();
    } catch (err) {
      console.error('[DEUDA] save error', err);
      Alert.alert('Ups', err instanceof Error ? err.message : 'No se pudo guardar el movimiento');
    } finally {
      setSubmitting(false);
    }
  }, [closeModal, fetchDebts, form, editingEntry]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchDebts({ silent: true });
  }, [fetchDebts]);

  const handleEdit = useCallback((entry: DebtEntry) => {
    setForm({
      title: entry.title || '',
      amount: String(entry.amount),
      date: normalizeFormDate(entry.date),
      type: entry.type,
    });
    setEditingEntry(entry);
    setIosDatePickerVisible(false);
    setModalVisible(true);
  }, []);

  const handleDelete = useCallback(
    (entry: DebtEntry) => {
      Alert.alert('Eliminar movimiento', 'Esta accion no se puede deshacer.', [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            setDeletingId(entry.id);
            try {
              const response = await fetch(apiRoutes.debt(entry.id), {
                method: 'DELETE',
                headers: { Accept: 'application/json' },
              });
              if (!response.ok) {
                const payload = await response.json().catch(() => ({}));
                const message =
                  payload && typeof payload.message === 'string'
                    ? payload.message
                    : 'No se pudo eliminar el movimiento';
                throw new Error(message);
              }
              setEntries(prev => prev.filter(item => item.id !== entry.id));
              if (editingEntry?.id === entry.id) {
                closeModal();
              }
            } catch (err) {
              console.error('[DEUDA] delete error', err);
              Alert.alert('Ups', err instanceof Error ? err.message : 'No se pudo eliminar el movimiento');
            } finally {
              setDeletingId(null);
            }
          },
        },
      ]);
    },
    [closeModal, editingEntry]
  );

  const renderItem = useCallback(
    ({ item }: { item: DebtEntry }) => {
      const isDebt = item.type === 'deuda';
      const amountColor = isDebt ? styles.amountDebt : styles.amountPayment;
      const isDeleting = deletingId === item.id;
      return (
        <View style={styles.itemContainer}>
          <View style={styles.itemRow}>
            <View style={styles.itemMain}>
              <Text style={styles.itemTitleSingle} numberOfLines={1}>
                {item.title || (isDebt ? 'Deuda' : 'Abono')}
              </Text>
              <Text style={styles.itemDate}>{formatDate(item.date)}</Text>
            </View>
            <View style={styles.itemMeta}>
              <Text style={[styles.itemAmountSingle, amountColor]}>
                {isDebt ? '+' : '-'}
                {formatCurrency(item.amount)}
              </Text>
              <View style={styles.itemActions}>
                <TouchableOpacity
                  style={styles.itemActionButton}
                  onPress={() => handleEdit(item)}
                  disabled={isDeleting}
                >
                  <Ionicons name="pencil" size={16} color="#4F46E5" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.itemActionButton, styles.itemActionDelete]}
                  onPress={() => handleDelete(item)}
                  disabled={isDeleting}
                >
                  <Ionicons name="trash-outline" size={16} color="#DC2626" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      );
    },
    [deletingId, handleDelete, handleEdit]
  );

  const emptyComponent = useMemo(
    () => (
      <View style={styles.emptyState}>
        <Ionicons name="wallet-outline" size={48} color="#CBD5F5" />
        <Text style={styles.emptyTitle}>Sin movimientos todavía</Text>
        <Text style={styles.emptySubtitle}>
          Registra cada vez que pidas prestado o abones para llevar el balance al día.
        </Text>
      </View>
    ),
    []
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
      <HeroHeader title="Deuda" image={HEADER_IMAGE} onBack={() => router.back()} />
      <View style={styles.summaryCard}>
        <Text style={styles.summaryLabel}>Balance actual</Text>
        <Text style={[styles.summaryBalance, summary.balance >= 0 ? styles.summaryDebt : styles.summaryPayment]}>
          {formatCurrency(summary.balance)}
        </Text>
        <View style={styles.summaryBreakdown}>
          <View style={styles.summaryRow}>
            <View style={[styles.summaryDot, styles.dotDebt]} />
            <Text style={styles.summaryRowLabel}>Deudas acumuladas</Text>
            <Text style={[styles.summaryRowValue, styles.amountDebt]}>{formatCurrency(summary.totalDeudas)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <View style={[styles.summaryDot, styles.dotPayment]} />
            <Text style={styles.summaryRowLabel}>Abonos registrados</Text>
            <Text style={[styles.summaryRowValue, styles.amountPayment]}>{formatCurrency(summary.totalAbonos)}</Text>
          </View>
        </View>
      </View>

      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366F1" />
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={entries.length ? styles.listContent : styles.emptyContainer}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          ListEmptyComponent={emptyComponent}
        />
      )}

      {error ? (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle" size={18} color="#F59E0B" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={[styles.actionButton, styles.actionButtonAbono]}
          onPress={() => openModal('abono')}
          activeOpacity={0.85}
        >
          <Ionicons name="arrow-down-circle" size={22} color="#10B981" />
          <Text style={[styles.actionLabel, styles.actionLabelAbono]}>Agregar abono</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.actionButtonDeuda]}
          onPress={() => openModal('deuda')}
          activeOpacity={0.85}
        >
          <Ionicons name="arrow-up-circle" size={22} color="#EF4444" />
          <Text style={[styles.actionLabel, styles.actionLabelDeuda]}>Agregar deuda</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={closeModal}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {editingEntry
                ? form.type === 'deuda'
                  ? 'Editar deuda'
                  : 'Editar abono'
                : form.type === 'deuda'
                ? 'Registrar deuda'
                : 'Registrar abono'}
            </Text>
            <View
              style={[
                styles.typeBanner,
                form.type === 'deuda' ? styles.typeBannerDebt : styles.typeBannerAbono,
              ]}
            >
              <Ionicons
                name={form.type === 'deuda' ? 'arrow-up-circle' : 'arrow-down-circle'}
                size={20}
                color={form.type === 'deuda' ? '#FFFFFF' : '#FFFFFF'}
              />
              <Text style={styles.typeBannerLabel}>
                {editingEntry
                  ? form.type === 'deuda'
                    ? 'Editaras una deuda'
                    : 'Editaras un abono'
                  : form.type === 'deuda'
                  ? 'Registraras una deuda'
                  : 'Registraras un abono'}
              </Text>
            </View>
            <TextInput
              style={styles.input}
              placeholder="Concepto"
              value={form.title}
              onChangeText={text => setForm(prev => ({ ...prev, title: text }))}
              autoCapitalize="sentences"
            />
            {QUICK_CONCEPTS.length ? (
              <View style={styles.quickConcepts}>
                {QUICK_CONCEPTS.map(concept => (
                  <TouchableOpacity
                    key={concept}
                    style={styles.quickConceptChip}
                    onPress={() => handleSelectConcept(concept)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.quickConceptChipText}>{concept}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}
            <TextInput
              style={styles.input}
              placeholder="Monto"
              value={form.amount}
              onChangeText={text => setForm(prev => ({ ...prev, amount: text.replace(/[^0-9.,]/g, '') }))}
              keyboardType={Platform.OS === 'ios' ? 'number-pad' : 'numeric'}
              inputMode="numeric"
            />
            <TouchableOpacity
              style={[styles.input, styles.dateInput]}
              onPress={handleDatePress}
              activeOpacity={0.85}
            >
              <Ionicons name="calendar-outline" size={18} color="#6366F1" />
              <Text style={styles.dateInputText}>{formatFormDateLabel(form.date)}</Text>
            </TouchableOpacity>
            {Platform.OS !== 'android' && iosDatePickerVisible ? (
              <View style={styles.iosPickerContainer}>
                <DateTimePicker
                  value={new Date(form.date)}
                  mode="date"
                  display="spinner"
                  onChange={handleIosDateChange}
                  locale="es-MX"
                />
              </View>
            ) : null}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={closeModal}
                disabled={submitting}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton]}
                onPress={handleSubmit}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.confirmButtonText}>
                    {editingEntry ? 'Actualizar' : 'Guardar'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
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
    paddingTop: 12,
  },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 12,
    padding: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 4,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  summaryBalance: {
    fontSize: 32,
    fontWeight: '700',
    marginTop: 8,
  },
  summaryDebt: {
    color: '#EF4444',
  },
  summaryPayment: {
    color: '#10B981',
  },
  summaryBreakdown: {
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  dotDebt: {
    backgroundColor: '#EF4444',
  },
  dotPayment: {
    backgroundColor: '#10B981',
  },
  summaryRowLabel: {
    flex: 1,
    fontSize: 13,
    color: '#6B7280',
  },
  summaryRowValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 140,
  },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  itemContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  itemMain: {
    flex: 1,
    marginRight: 10,
  },
  itemTitleSingle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
  },
  itemTypeLabel: {
    fontSize: 13,
    fontWeight: '600',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: 'hidden',
    textTransform: 'capitalize',
  },
  itemTypeLabelDebt: {
    backgroundColor: 'rgba(239,68,68,0.12)',
    color: '#B91C1C',
  },
  itemTypeLabelAbono: {
    backgroundColor: 'rgba(16,185,129,0.15)',
    color: '#047857',
  },
  itemDate: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  itemMeta: {
    alignItems: 'flex-end',
    gap: 6,
  },
  itemAmountSingle: {
    fontSize: 16,
    fontWeight: '700',
    flexShrink: 0,
  },
  itemActions: {
    flexDirection: 'row',
    gap: 8,
  },
  itemActionButton: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemActionDelete: {
    backgroundColor: '#FEE2E2',
  },
  amountDebt: {
    color: '#EF4444',
  },
  amountPayment: {
    color: '#10B981',
  },
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 8,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorBanner: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  errorText: {
    flex: 1,
    color: '#92400E',
    fontSize: 13,
  },
  actionsRow: {
    position: 'absolute',
    bottom: 24,
    left: 20,
    right: 20,
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  actionButtonAbono: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.35)',
  },
  actionButtonDeuda: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.35)',
  },
  actionLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  actionLabelAbono: {
    color: '#047857',
  },
  actionLabelDeuda: {
    color: '#B91C1C',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.55)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 32,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 20,
  },
  typeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    marginBottom: 18,
  },
  typeBannerDebt: {
    backgroundColor: '#EF4444',
  },
  typeBannerAbono: {
    backgroundColor: '#10B981',
  },
  typeBannerLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  input: {
    borderWidth: 1,
    borderColor: '#CBD5F5',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#1E293B',
    backgroundColor: '#F8FAFC',
    marginBottom: 14,
  },
  quickConcepts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  quickConceptChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#EEF2FF',
  },
  quickConceptChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4338CA',
  },
  dateInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  dateInputText: {
    fontSize: 15,
    color: '#1E293B',
    fontWeight: '600',
  },
  iosPickerContainer: {
    marginBottom: 12,
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 8,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#EEF2FF',
  },
  cancelButtonText: {
    color: '#4F46E5',
    fontWeight: '600',
  },
  confirmButton: {
    backgroundColor: '#6366F1',
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});



