import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { apiRoutes } from '@/constants/api';

type PriorityValue = 1 | 2 | 3;
type RecurringValue = 'none' | 'weekly' | 'biweekly' | 'monthly';

type SupermarketItem = {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  category: string | null;
  store: string | null;
  price: number | null;
  priority: PriorityValue;
  notes: string | null;
  checked: boolean;
  recurring: RecurringValue;
  tags: string[];
  createdAt?: string | null;
  updatedAt?: string | null;
};

type SupermarketStats = {
  total: number;
  pending: number;
  checked: number;
  estimatedTotal: number;
};

type SupermarketFormState = {
  name: string;
  quantity: string;
  unit: string;
  category: string;
  store: string;
  price: string;
  priority: PriorityValue;
  notes: string;
  recurring: RecurringValue;
  tags: string;
  checked: boolean;
};

const HEADER_IMAGE = require('../assets/images/lista-super.png');

const PRIORITY_META: Record<PriorityValue, { label: string; color: string }> = {
  1: { label: 'Alta', color: '#DC2626' },
  2: { label: 'Media', color: '#F97316' },
  3: { label: 'Baja', color: '#10B981' },
};

const PRIORITY_VALUES: PriorityValue[] = [1, 2, 3];


const RECURRING_OPTIONS: { value: RecurringValue; label: string }[] = [
  { value: 'none', label: 'No recurrente' },
  { value: 'weekly', label: 'Semanal' },
  { value: 'biweekly', label: 'Cada 2 semanas' },
  { value: 'monthly', label: 'Mensual' },
];

const UNIT_OPTIONS = ['pz', 'kg', 'g', 'L', 'ml'];

const FILTER_OPTIONS = [
  { id: 'all', label: 'Todos' },
  { id: 'pending', label: 'Pendientes' },
  { id: 'checked', label: 'Comprados' },
] as const;

const INITIAL_FORM: SupermarketFormState = {
  name: '',
  quantity: '1',
  unit: 'pz',
  category: '',
  store: '',
  price: '',
  priority: 2,
  notes: '',
  recurring: 'none',
  tags: '',
  checked: false,
};

const currencyFormatter = typeof Intl !== 'undefined' ? new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  maximumFractionDigits: 2,
}) : null;

const formatCurrency = (value: number) => {
  if (!Number.isFinite(value)) {
    return '$0.00';
  }
  if (currencyFormatter) {
    return currencyFormatter.format(value);
  }
  return `$${value.toFixed(2)}`;
};

const sortItems = (list: SupermarketItem[]) => {
  return [...list].sort((a, b) => {
    if (a.checked !== b.checked) {
      return a.checked ? 1 : -1;
    }
    const priorityA = a.priority ?? 3;
    const priorityB = b.priority ?? 3;
    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }
    const nameA = (a.name || '').toLowerCase();
    const nameB = (b.name || '').toLowerCase();
    if (nameA !== nameB) {
      return nameA.localeCompare(nameB);
    }
    const createdA = a.createdAt || '';
    const createdB = b.createdAt || '';
    return createdA.localeCompare(createdB);
  });
};

const computeStats = (list: SupermarketItem[]): SupermarketStats => {
  let checked = 0;
  let estimated = 0;
  list.forEach(item => {
    if (item.checked) checked += 1;
    if (typeof item.price === 'number' && Number.isFinite(item.price)) {
      const qty = Number.isFinite(item.quantity) ? item.quantity : 1;
      estimated += item.price * qty;
    }
  });
  return {
    total: list.length,
    checked,
    pending: list.length - checked,
    estimatedTotal: Number(estimated.toFixed(2)),
  };
};
const formatQuantity = (value: string) => {
  return value.replace(/,/g, '.');
};

const buildPayload = (form: SupermarketFormState) => {
  const quantityValue = Number(formatQuantity(form.quantity));
  const priceValue = Number(formatQuantity(form.price));
  return {
    name: form.name.trim(),
    quantity: Number.isFinite(quantityValue) && quantityValue >= 0 ? quantityValue : 1,
    unit: form.unit.trim() || 'pz',
    category: form.category.trim() ? form.category.trim() : null,
    store: form.store.trim() ? form.store.trim() : null,
    price: form.price.trim() ? (Number.isFinite(priceValue) && priceValue >= 0 ? Number(priceValue.toFixed(2)) : null) : null,
    priority: form.priority,
    notes: form.notes.trim() ? form.notes.trim() : null,
    checked: form.checked,
    recurring: form.recurring,
    tags: form.tags
      .split(',')
      .map(tag => tag.trim())
      .filter(Boolean),
  };
};

export default function SupermarketScreen() {
  const router = useRouter();
  const [items, setItems] = useState<SupermarketItem[]>([]);
  const [stats, setStats] = useState<SupermarketStats>({ total: 0, pending: 0, checked: 0, estimatedTotal: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'checked'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<SupermarketItem | null>(null);
  const [form, setForm] = useState<SupermarketFormState>(INITIAL_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ visible: boolean; message: string; type: 'success' | 'error' }>({
    visible: false,
    message: '',
    type: 'success',
  });
  const [expandedItems, setExpandedItems] = useState<Set<string>>(() => new Set());
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasLoadedRef = useRef(false);

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    setToast({ visible: true, message, type });
    toastTimeoutRef.current = setTimeout(() => {
      setToast(prev => ({ ...prev, visible: false }));
    }, 2600);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  const fetchItems = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      const response = await fetch(apiRoutes.supermarket());     
      const json: any = await response.json().catch(() => ({}));
      //console.log('[LISTA SUPER] submit response', { status: response.status, ok: response.ok, body: json });
      if (!response.ok) {
        throw new Error(json?.message || 'No se pudo obtener la lista');
      }
      const data: SupermarketItem[] = Array.isArray(json?.data) ? json.data : [];
      const sorted = sortItems(data);
      setItems(sorted);
      if (json?.meta?.stats) {
        const apiStats = json.meta.stats;
        setStats({
          total: typeof apiStats.total === 'number' ? apiStats.total : sorted.length,
          pending: typeof apiStats.pending === 'number' ? apiStats.pending : computeStats(sorted).pending,
          checked: typeof apiStats.checked === 'number' ? apiStats.checked : computeStats(sorted).checked,
          estimatedTotal: typeof apiStats.estimatedTotal === 'number' ? Number(apiStats.estimatedTotal) : computeStats(sorted).estimatedTotal,
        });
      } else {
        setStats(computeStats(sorted));
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      setError(message);
      showToast(message, 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
      hasLoadedRef.current = true;
    }
  }, [showToast]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  useFocusEffect(
    useCallback(() => {
      if (hasLoadedRef.current) {
        fetchItems({ silent: true });
      }
    }, [fetchItems])
  );

  const handleRefresh = useCallback(() => {
    fetchItems({ silent: true });
  }, [fetchItems]);
  const categoryOptions = useMemo(() => {
    const set = new Set<string>();
    items.forEach(item => {
      if (item.category) {
        set.add(item.category);
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
  }, [items]);

  const filteredItems = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();
    const categoryValue = categoryFilter ? categoryFilter.toLowerCase() : null;
    return sortItems(items).filter(item => {
      if (filter === 'pending' && item.checked) return false;
      if (filter === 'checked' && !item.checked) return false;
      if (categoryValue) {
        const currentCategory = (item.category || '').toLowerCase();
        if (currentCategory !== categoryValue) return false;
      }
      if (search) {
        const haystack = [item.name, item.notes || '', item.store || '', item.category || '', ...(item.tags || [])]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(search)) return false;
      }
      return true;
    });
  }, [items, filter, categoryFilter, searchTerm]);

  const handleOpenCreate = useCallback(() => {
    setEditingItem(null);
    setForm(INITIAL_FORM);
    setFormError(null);
    setModalVisible(true);
  }, []);

  const handleEditItem = useCallback((item: SupermarketItem) => {
    setEditingItem(item);
    setForm({
      name: item.name || '',
      quantity: Number.isFinite(item.quantity) ? String(item.quantity) : '1',
      unit: item.unit || 'pz',
      category: item.category || '',
      store: item.store || '',
      price: typeof item.price === 'number' && Number.isFinite(item.price) ? String(item.price) : '',
      priority: item.priority ?? 2,
      notes: item.notes || '',
      recurring: item.recurring || 'none',
      tags: Array.isArray(item.tags) ? item.tags.join(', ') : '',
      checked: !!item.checked,
    });
    setFormError(null);
    setModalVisible(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setModalVisible(false);
    setEditingItem(null);
    setForm(INITIAL_FORM);
    setFormError(null);
  }, []);

  const handleDeleteItem = useCallback(async (itemId: string) => {
    const previousItems = items;
    if (!previousItems.some(entry => entry.id === itemId)) {
      return;
    }
    const nextItems = previousItems.filter(entry => entry.id !== itemId);
    setItems(nextItems);
    setStats(computeStats(nextItems));
    try {
      //console.log('[LISTA SUPER] delete request', { itemId });
      const response = await fetch(apiRoutes.supermarketItem(itemId), { method: 'DELETE' });
      const json = await response.json().catch(() => ({}));
      //console.log('[LISTA SUPER] delete response', { status: response.status, ok: response.ok, body: json });
      if (!response.ok) {
        throw new Error(json?.message || 'No se pudo eliminar el producto');
      }
      showToast('Producto eliminado', 'success');
    } catch (err) {
      //console.error('[LISTA SUPER] delete error', err);
      setItems(previousItems);
      setStats(computeStats(previousItems));
      const message = err instanceof Error ? err.message : 'No se pudo eliminar el producto';
      showToast(message, 'error');
    }
  }, [items, showToast]);

  const toggleExpandedItem = useCallback((id: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const confirmDeleteItem = useCallback((item: SupermarketItem) => {
    Alert.alert(
      'Eliminar producto',
      `Deseas eliminar ${item.name}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: () => handleDeleteItem(item.id) },
      ],
    );
  }, [handleDeleteItem]);
  const handleToggleItem = useCallback(async (item: SupermarketItem) => {
    const previousItems = items;
    const toggled = previousItems.map(entry =>
      entry.id === item.id
        ? {
            ...entry,
            checked: !entry.checked,
            updatedAt: new Date().toISOString(),
          }
        : entry,
    );
    const sorted = sortItems(toggled);
    setItems(sorted);
    setStats(computeStats(sorted));
    try {
      //console.log('[LISTA SUPER] toggle request', { itemId: item.id, nextChecked: !item.checked });
      const response = await fetch(apiRoutes.supermarketItem(item.id), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checked: !item.checked }),
      });
      const json = await response.json().catch(() => ({}));
      //console.log('[LISTA SUPER] toggle response', { status: response.status, ok: response.ok, body: json });
      if (!response.ok) {
        throw new Error(json?.message || 'No se pudo actualizar el producto');
      }
      if (json?.data) {
        const merged: SupermarketItem = json.data;
        setItems(current => {
          const updated = current.map(entry => (entry.id === merged.id ? { ...entry, ...merged } : entry));
          const ordered = sortItems(updated);
          setStats(computeStats(ordered));
          return ordered;
        });
      }
    } catch (err) {
      console.error('[LISTA SUPER] toggle error', err);
      setItems(previousItems);
      setStats(computeStats(previousItems));
      const message = err instanceof Error ? err.message : 'No se pudo actualizar el producto';
      showToast(message, 'error');
    }
  }, [items, showToast]);

  
  const handleSubmit = useCallback(async () => {
    const trimmedName = form.name.trim();
    if (!trimmedName) {
      setFormError('El nombre es obligatorio');
      showToast('Agrega un nombre para el producto', 'error');
      return;
    }

    const payload = buildPayload(form);
    setSaving(true);
    try {
      const isEditing = !!editingItem;
      const url = isEditing ? apiRoutes.supermarketItem(editingItem!.id) : apiRoutes.supermarket();
      const method = isEditing ? 'PATCH' : 'POST';
      //console.log('[LISTA SUPER] submit request', { method, url, payload, editingId: editingItem?.id });
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await response.json().catch(() => ({}));
      //console.log('[LISTA SUPER] submit response', { status: response.status, ok: response.ok, body: json });
      if (!response.ok) {
        throw new Error(json?.message || 'No se pudo guardar el producto');
      }
      const saved: SupermarketItem = json?.data || {
        ...(editingItem || { id: '', tags: [] }),
        ...payload,
        id: editingItem?.id || json?.id,
      };
      setItems(prev => {
        const base = editingItem
          ? prev.map(entry => (entry.id === saved.id ? { ...entry, ...saved } : entry))
          : [saved, ...prev];
        const ordered = sortItems(base);
        setStats(computeStats(ordered));
        return ordered;
      });
      showToast(isEditing ? 'Producto actualizado' : 'Producto agregado', 'success');
      handleCloseModal();
    } catch (err) {
      console.error('[LISTA SUPER] submit error', err);
      const message = err instanceof Error ? err.message : 'No se pudo guardar el producto';
      setFormError(message);
      showToast(message, 'error');
    } finally {
      setSaving(false);
    }
  }, [form, editingItem, handleCloseModal, showToast]);

  const renderItem = useCallback(({ item }: { item: SupermarketItem }) => {
    const priority = PRIORITY_META[item.priority] || PRIORITY_META[2];
    const priceLabel = item.price === null || item.price === undefined ? 'N/D' : formatCurrency(item.price);
    const quantityLabel = item.quantity + ' ' + item.unit;
    const expanded = expandedItems.has(item.id);
    return (
      <View style={[styles.itemCard, item.checked && styles.itemCardChecked]}>
        <TouchableOpacity
          accessibilityRole="button"
          onPress={() => handleToggleItem(item)}
          style={[styles.checkButton, item.checked && styles.checkButtonChecked]}
        >
          {item.checked ? <Ionicons name="checkmark" size={18} color="#FFFFFF" /> : null}
        </TouchableOpacity>
        <View style={styles.itemContent}>
          <View style={styles.itemHeader}>
            <View style={styles.itemHeaderInfo}>
              <Text style={[styles.itemName, item.checked && styles.itemNameChecked]} numberOfLines={expanded ? 2 : 1}>
                {item.name}
              </Text>
            </View>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={expanded ? 'Ocultar detalles' : 'Mostrar detalles'}
              onPress={() => toggleExpandedItem(item.id)}
              style={styles.itemToggleButton}
            >
              <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color="#4B5563" />
            </TouchableOpacity>
          </View>
          <View style={styles.itemSummaryRow}>
            <View style={[styles.itemSummaryItem, styles.itemSummaryPriority,{ backgroundColor: priority.color }]}>
              <Text style={[styles.itemSummaryText, styles.itemSummaryTextPriority, { color: 'white' }]} numberOfLines={1}>{priority.label}</Text>
            </View>
            <View style={styles.itemSummaryItem}>
              <Ionicons name="cube-outline" size={15} color="#4B5563" style={styles.metaIcon} />
              <Text style={styles.itemSummaryText} numberOfLines={1}>{quantityLabel}</Text>
            </View>
            <View style={[styles.itemSummaryItem, styles.itemSummaryItemAccent]}>
              <Ionicons name="cash-outline" size={15} color="#047857" style={styles.metaIcon} />
              <Text style={styles.itemSummaryText} numberOfLines={1}>{priceLabel}</Text>
            </View>
          </View>
          {expanded ? (
            <View style={styles.itemExpandedSection}>
              {item.store ? (
                <View style={styles.itemMetaRow}>
                  <Ionicons name="business-outline" size={16} color="#4B5563" style={styles.metaIcon} />
                  <Text style={styles.itemMetaText}>{item.store}</Text>
                </View>
              ) : null}
              {item.category ? (
                <View style={styles.itemMetaRow}>
                  <Ionicons name="pricetag-outline" size={16} color="#4B5563" style={styles.metaIcon} />
                  <Text style={styles.itemMetaText}>{item.category}</Text>
                </View>
              ) : null}
              {item.recurring && item.recurring !== 'none' ? (
                <View style={styles.itemMetaRow}>
                  <Ionicons name="repeat-outline" size={16} color="#4B5563" style={styles.metaIcon} />
                  <Text style={styles.itemMetaText}>
                    {RECURRING_OPTIONS.find(option => option.value === item.recurring)?.label || 'Recurrente'}
                  </Text>
                </View>
              ) : null}
              {item.notes ? <Text style={styles.notesText}>{item.notes}</Text> : null}
              {item.tags && item.tags.length ? (
                <View style={styles.tagsRow}>
                  {item.tags.map(tag => (
                    <View key={tag} style={styles.tagChip}>
                      <Text style={styles.tagChipText}>{tag}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          ) : null}
        </View>
        <View style={styles.itemActions}>
          <TouchableOpacity
            accessibilityLabel="Editar"
            onPress={() => handleEditItem(item)}
            style={styles.actionButton}
          >
            <Ionicons name="create-outline" size={18} color="#4B5563" />
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityLabel="Eliminar"
            onPress={() => confirmDeleteItem(item)}
            style={styles.actionButton}
          >
            <Ionicons name="trash-outline" size={18} color="#DC2626" />
          </TouchableOpacity>
        </View>
      </View>
    );
  }, [confirmDeleteItem, expandedItems, handleEditItem, handleToggleItem, toggleExpandedItem]);
  const headerComponent = useMemo(() => (
    <View>
      <View style={styles.heroWrapper}>
        <View style={styles.heroCard}>
          <Image source={HEADER_IMAGE} resizeMode="cover" style={styles.heroImage} />
          <LinearGradient colors={['rgba(15,23,42,0.05)', 'rgba(15,23,42,0.65)']} style={styles.heroGradient} />
          <View style={styles.heroContent}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="chevron-back" size={22} color="#F8FAFC" />
            </TouchableOpacity>
            <Text style={styles.heroTitle}>Lista de Super</Text>
          </View>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={[styles.statCard, styles.statCardPrimary]}>
          <Text style={styles.statLabel}>Pendientes</Text>
          <Text style={styles.statValue}>{stats.pending}</Text>
        </View>
        <View style={[styles.statCard, styles.statCardSecondary]}>
          <Text style={styles.statLabel}>Comprados</Text>
          <Text style={styles.statValue}>{stats.checked}</Text>
        </View>
        <View style={[styles.statCard, styles.statCardAccent]}>
          <Text style={styles.statLabel}>Total estimado</Text>
          <Text style={styles.statValueSmall}>{formatCurrency(stats.estimatedTotal)}</Text>
        </View>
      </View>

      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => fetchItems()}>
            <Text style={styles.errorRetry}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={18} color="#9CA3AF" style={styles.searchIcon} />
        <TextInput
          placeholder="Buscar producto, nota, tienda..."
          placeholderTextColor="#9CA3AF"
          value={searchTerm}
          onChangeText={setSearchTerm}
          style={styles.searchInput}
        />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChipsRow}>
        {FILTER_OPTIONS.map(option => (
          <TouchableOpacity
            key={option.id}
            style={[styles.filterChip, filter === option.id && styles.filterChipActive]}
            onPress={() => setFilter(option.id)}
          >
            <Text style={[styles.filterChipText, filter === option.id && styles.filterChipTextActive]}>{option.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {categoryOptions.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
          <TouchableOpacity
            style={[styles.categoryChip, !categoryFilter && styles.categoryChipActive]}
            onPress={() => setCategoryFilter(null)}
          >
            <Text style={[styles.categoryChipText, !categoryFilter && styles.categoryChipTextActive]}>Todas</Text>
          </TouchableOpacity>
          {categoryOptions.map(category => {
            const active = categoryFilter === category;
            return (
              <TouchableOpacity
                key={category}
                style={[styles.categoryChip, active && styles.categoryChipActive]}
                onPress={() => setCategoryFilter(active ? null : category)}
              >
                <Text style={[styles.categoryChipText, active && styles.categoryChipTextActive]}>{category}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      ) : null}
    </View>
  ), [categoryFilter, categoryOptions, error, fetchItems, filter, router, searchTerm, stats]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366F1" />
          <Text style={styles.loadingText}>Cargando lista de super...</Text>
        </View>
      ) : null}
      <FlatList
        data={filteredItems}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        extraData={expandedItems}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={headerComponent}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyState}>
              <Ionicons name="basket-outline" size={48} color="#9CA3AF" />
              <Text style={styles.emptyTitle}>Sin productos</Text>
              <Text style={styles.emptySubtitle}>Agrega tu primera nota para comenzar la lista de super.</Text>
            </View>
          ) : null
        }
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#6366F1" />}
      />

      <TouchableOpacity style={styles.fab} onPress={handleOpenCreate} activeOpacity={0.9}>
        <LinearGradient colors={['#6366F1', '#8B5CF6']} style={styles.fabGradient}>
          <Ionicons name="add" size={26} color="#FFFFFF" />
        </LinearGradient>
      </TouchableOpacity>

      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={handleCloseModal}>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalKeyboardWrapper}
          >
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{editingItem ? 'Editar producto' : 'Agregar producto'}</Text>
                <TouchableOpacity onPress={handleCloseModal}>
                  <Ionicons name="close" size={22} color="#6B7280" />
                </TouchableOpacity>
              </View>
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.formGroup}>
                  <Text style={styles.fieldLabel}>Nombre</Text>
                  <TextInput
                    value={form.name}
                    onChangeText={text => setForm(current => ({ ...current, name: text }))}
                    placeholder="Ej. Leche entera"
                    placeholderTextColor="#9CA3AF"
                    style={styles.fieldInput}
                  />
                </View>

                <View style={styles.rowFields}>
                  <View style={[styles.formGroup, styles.rowFieldItem]}>
                    <Text style={styles.fieldLabel}>Cantidad</Text>
                    <TextInput
                      value={form.quantity}
                      onChangeText={text => setForm(current => ({ ...current, quantity: text }))}
                      keyboardType="decimal-pad"
                      style={styles.fieldInput}
                    />
                  </View>
                  <View style={[styles.formGroup, styles.rowFieldItem]}>
                    <Text style={styles.fieldLabel}>Unidad</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      <View style={styles.segmentGroup}>
                        {UNIT_OPTIONS.map(unit => {
                          const active = form.unit === unit;
                          return (
                            <TouchableOpacity
                              key={unit}
                              style={[styles.segmentItem, active && styles.segmentItemActive]}
                              onPress={() => setForm(current => ({ ...current, unit }))}
                            >
                              <Text style={[styles.segmentItemText, active && styles.segmentItemTextActive]}>{unit}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </ScrollView>
                  </View>
                </View>

                <View style={styles.rowFields}>
                  <View style={[styles.formGroup, styles.rowFieldItem]}>
                    <Text style={styles.fieldLabel}>Categoria</Text>
                    <TextInput
                      value={form.category}
                      onChangeText={text => setForm(current => ({ ...current, category: text }))}
                      placeholder="Ej. Lacteos"
                      placeholderTextColor="#9CA3AF"
                      style={styles.fieldInput}
                    />
                  </View>
                  <View style={[styles.formGroup, styles.rowFieldItem]}>
                    <Text style={styles.fieldLabel}>Tienda</Text>
                    <TextInput
                      value={form.store}
                      onChangeText={text => setForm(current => ({ ...current, store: text }))}
                      placeholder="Ej. Mercado"
                      placeholderTextColor="#9CA3AF"
                      style={styles.fieldInput}
                    />
                  </View>
                </View>

                <View style={styles.rowFields}>
                  <View style={[styles.formGroup, styles.rowFieldItem]}>
                    <Text style={styles.fieldLabel}>Precio</Text>
                    <TextInput
                      value={form.price}
                      onChangeText={text => setForm(current => ({ ...current, price: text }))}
                      keyboardType="decimal-pad"
                      placeholder="Ej. 45.90"
                      placeholderTextColor="#9CA3AF"
                      style={styles.fieldInput}
                    />
                  </View>
                  <View style={[styles.formGroup, styles.rowFieldItem]}>
                    <Text style={styles.fieldLabel}>Prioridad</Text>
                    <View style={styles.segmentGroup}>
                      {PRIORITY_VALUES.map(priority => {
                        const active = form.priority === priority;
                        return (
                          <TouchableOpacity
                            key={priority}
                            style={[styles.segmentItem, active && styles.segmentItemActive]}
                            onPress={() => setForm(current => ({ ...current, priority }))}
                          >
                            <Text style={[styles.segmentItemText, active && styles.segmentItemTextActive]}>
                              {PRIORITY_META[priority].label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.fieldLabel}>Frecuencia</Text>
                  <View style={styles.segmentGroup}>
                    {RECURRING_OPTIONS.map(option => {
                      const active = form.recurring === option.value;
                      return (
                        <TouchableOpacity
                          key={option.value}
                          style={[styles.segmentItem, active && styles.segmentItemActive]}
                          onPress={() => setForm(current => ({ ...current, recurring: option.value }))}
                        >
                          <Text style={[styles.segmentItemText, active && styles.segmentItemTextActive]}>
                            {option.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.fieldLabel}>Notas</Text>
                  <TextInput
                    value={form.notes}
                    onChangeText={text => setForm(current => ({ ...current, notes: text }))}
                    placeholder="Detalles adicionales"
                    placeholderTextColor="#9CA3AF"
                    style={[styles.fieldInput, styles.textArea]}
                    multiline
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.fieldLabel}>Tags (separados por coma)</Text>
                  <TextInput
                    value={form.tags}
                    onChangeText={text => setForm(current => ({ ...current, tags: text }))}
                    placeholder="Ej. keto, fiesta"
                    placeholderTextColor="#9CA3AF"
                    style={styles.fieldInput}
                  />
                </View>

                {editingItem ? (
                  <View style={styles.switchRow}>
                    <Text style={styles.switchLabel}>Marcado como comprado</Text>
                    <Switch
                      value={form.checked}
                      onValueChange={value => setForm(current => ({ ...current, checked: value }))}
                      thumbColor={form.checked ? '#6366F1' : '#E5E7EB'}
                      trackColor={{ false: '#E5E7EB', true: '#C7D2FE' }}
                    />
                  </View>
                ) : null}

                {formError ? <Text style={styles.formError}>{formError}</Text> : null}
              </ScrollView>
              <View style={styles.modalFooter}>
                <TouchableOpacity style={[styles.modalButton, styles.modalButtonSecondary]} onPress={handleCloseModal}>
                  <Text style={styles.modalButtonSecondaryText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonPrimary]}
                  onPress={handleSubmit}
                  disabled={saving}
                >
                  {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.modalButtonPrimaryText}>Guardar</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {toast.visible ? (
        <View style={[styles.toastContainer, toast.type === 'success' ? styles.toastSuccess : styles.toastError]}>
          <Text style={styles.toastText}>{toast.message}</Text>
        </View>
      ) : null}
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
    backgroundColor: 'rgba(248,250,252,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#4B5563',
    fontSize: 16,
  },
  listContent: {
    paddingBottom: 120,
  },
  heroWrapper: {
    paddingHorizontal: 0,
    paddingTop: 8,
  },
  heroCard: {
    borderRadius: 0,
    overflow: 'hidden',
    height: 140,
    backgroundColor: '#111827',
  },
  heroImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  heroGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  heroContent: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  backButton: {
    position: 'absolute',
    top: 16,
    left: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(15,23,42,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroTitle: {
    color: '#F8FAFC',
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 0,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: 20,
    marginTop: 20,
    gap: 12,
  },
  statCard: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 4,
  },
  statCardPrimary: {
    backgroundColor: '#EEF2FF',
  },
  statCardSecondary: {
    backgroundColor: '#ECFDF5',
  },
  statCardAccent: {
    backgroundColor: '#FFF7ED',
  },
  statLabel: {
    color: '#4B5563',
    fontSize: 13,
    marginBottom: 6,
  },
  statValue: {
    color: '#111827',
    fontSize: 24,
    fontWeight: '700',
  },
  statValueSmall: {
    color: '#111827',
    fontSize: 18,
    fontWeight: '600',
  },
  errorBanner: {
    marginHorizontal: 20,
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#FEE2E2',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  errorText: {
    flex: 1,
    color: '#B91C1C',
    fontSize: 14,
    marginRight: 12,
  },
  errorRetry: {
    color: '#B91C1C',
    fontWeight: '600',
  },
  searchContainer: {
    marginHorizontal: 20,
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 14,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111827',
  },
  filterChipsRow: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 4,
  },
  filterChip: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#E5E7EB',
    marginRight: 12,
  },
  filterChipActive: {
    backgroundColor: '#6366F1',
  },
  filterChipText: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  categoryRow: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  categoryChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    marginRight: 10,
  },
  categoryChipActive: {
    backgroundColor: '#6366F1',
  },
  categoryChipText: {
    color: '#4B5563',
    fontSize: 13,
  },
  categoryChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginHorizontal: 16,
    marginTop: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  itemCardChecked: {
    opacity: 0.65,
  },
  checkButton: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: '#6366F1',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    marginTop: 2,
  },
  checkButtonChecked: {
    backgroundColor: '#6366F1',
  },
  itemContent: {
    flex: 1,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  itemHeaderInfo: {
    flex: 1,
    paddingRight: 8,
  },
  itemToggleButton: {
    padding: 4,
    borderRadius: 12,
  },
  itemName: {
    flex: 1,
    color: '#111827',
    fontSize: 15,
    fontWeight: '600',
    marginRight: 8,
  },
  itemNameChecked: {
    textDecorationLine: 'line-through',
    color: '#6B7280',
  },
  priorityBadge: {
    borderRadius: 12,
    paddingVertical: 3,
    paddingHorizontal: 8,
    alignSelf: 'flex-start',
    marginTop: 6,
  },
  priorityBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  itemMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  metaIcon: {
    marginRight: 5,
  },
  itemMetaText: {
    color: '#4B5563',
    fontSize: 13,
  },
  itemSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    gap: 8,
  },
  itemSummaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  itemSummaryItemAccent: {
    backgroundColor: '#ECFDF5',
  },
  itemSummaryText: {
    marginLeft: 6,
    color: '#1F2937',
    fontSize: 13,
    fontWeight: '500',
  },
  itemSummaryPriority: {
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 12,
  },
  itemSummaryTextPriority: {
    fontWeight: '600',
  },
  itemExpandedSection: {
    marginTop: 10,
    gap: 6,
  },
  notesText: {
    marginTop: 6,
    color: '#374151',
    fontSize: 13,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 6,
    gap: 6,
  },
  tagChip: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: '#E0E7FF',
  },
  tagChipText: {
    color: '#4338CA',
    fontSize: 12,
    fontWeight: '600',
  },
  itemActions: {
    justifyContent: 'space-between',
    marginLeft: 6,
  },
  actionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    marginTop: 60,
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    marginTop: 12,
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  emptySubtitle: {
    marginTop: 6,
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  fab: {
    position: 'absolute',
    bottom: 32,
    right: 24,
    width: 60,
    height: 60,
    borderRadius: 30,
    shadowColor: '#312E81',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 10,
  },
  fabGradient: {
    flex: 1,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.4)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  modalKeyboardWrapper: {
    flex: 1,
    justifyContent: 'center',
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  formGroup: {
    marginBottom: 16,
  },
  fieldLabel: {
    color: '#4B5563',
    fontSize: 13,
    marginBottom: 6,
    fontWeight: '500',
  },
  fieldInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111827',
    backgroundColor: '#FFFFFF',
  },
  textArea: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  rowFields: {
    flexDirection: 'row',
    gap: 12,
  },
  rowFieldItem: {
    flex: 1,
  },
  segmentGroup: {
    flexDirection: 'row',
    marginTop: 6,
    gap: 8,
  },
  segmentItem: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
  },
  segmentItemActive: {
    backgroundColor: '#6366F1',
  },
  segmentItemText: {
    fontSize: 13,
    color: '#4B5563',
  },
  segmentItemTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  switchLabel: {
    fontSize: 15,
    color: '#111827',
  },
  formError: {
    color: '#B91C1C',
    fontSize: 13,
    marginTop: 4,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 12,
  },
  modalButton: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalButtonSecondary: {
    backgroundColor: '#F3F4F6',
  },
  modalButtonSecondaryText: {
    color: '#4B5563',
    fontWeight: '600',
  },
  modalButtonPrimary: {
    backgroundColor: '#6366F1',
  },
  modalButtonPrimaryText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  toastContainer: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 28,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  toastSuccess: {
    backgroundColor: '#10B981',
  },
  toastError: {
    backgroundColor: '#EF4444',
  },
  toastText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});



































