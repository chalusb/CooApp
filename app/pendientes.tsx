import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  ListRenderItemInfo,
  Modal,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import DraggableFlatList, { RenderItemParams } from 'react-native-draggable-flatlist';

import HeroHeader from '@/components/HeroHeader';

export const options = {
  headerShown: false,
};

import { API_CONFIG, apiRoutes } from '@/constants/api';
import { getCategoriesCache, isCategoriesCacheFresh, setCategoriesCache } from '@/core/cache/categoriesCache';
import { cloneTasks, normalizeCategory, normalizeTask, parseOrderValue } from '@/core/categories/normalizers';
import type { Category, Task } from '@/types/categories';

const { width } = Dimensions.get('window');
const HEADER_IMAGE = require('../assets/images/partial-react-logo.png');

const DEFAULT_TASK_STATUS = 'pendiente';

const TASK_STATUS_OPTIONS = [
  { value: 'pendiente', label: 'Pendiente', color: '#F97316' },
  { value: 'en_progreso', label: 'En progreso', color: '#3B82F6' },
  { value: 'detenida', label: 'Detenida', color: '#EF4444' },
  { value: 'completada', label: 'Completada', color: '#10B981' },
];

const getTaskStatusMeta = (status?: string) => {
  const fallback = TASK_STATUS_OPTIONS[0];
  return TASK_STATUS_OPTIONS.find(option => option.value === status) || fallback;
};
type CategoryColorOption = {
  id: string;
  label: string;
  value: string | null;
  gradient: [string, string];
};

const CATEGORY_COLOR_OPTIONS: CategoryColorOption[] = [
  { id: 'auto', label: 'Automatico', value: null, gradient: ['#6B7280', '#374151'] },
  { id: 'blue', label: 'Azul', value: '#3B82F6', gradient: ['#3B82F6', '#2563EB'] },
  { id: 'green', label: 'Verde', value: '#10B981', gradient: ['#10B981', '#059669'] },
  { id: 'purple', label: 'Morado', value: '#8B5CF6', gradient: ['#8B5CF6', '#7C3AED'] },
  { id: 'amber', label: 'Ambar', value: '#F59E0B', gradient: ['#F59E0B', '#D97706'] },
  { id: 'red', label: 'Rojo', value: '#EF4444', gradient: ['#EF4444', '#DC2626'] },
  { id: 'cyan', label: 'Cian', value: '#06B6D4', gradient: ['#06B6D4', '#0891B2'] },
  { id: 'pink', label: 'Rosa', value: '#F472B6', gradient: ['#F472B6', '#EC4899'] },
  { id: 'teal', label: 'Turquesa', value: '#14B8A6', gradient: ['#14B8A6', '#0D9488'] },
  { id: 'indigo', label: 'Indigo', value: '#6366F1', gradient: ['#6366F1', '#4338CA'] },
  { id: 'slate', label: 'Gris oscuro', value: '#475569', gradient: ['#475569', '#1F2937'] },
  { id: 'rose', label: 'Magenta', value: '#FB7185', gradient: ['#FB7185', '#F43F5E'] },
  { id: 'lime', label: 'Lima', value: '#84CC16', gradient: ['#A3E635', '#65A30D'] },
  { id: 'emerald', label: 'Esmeralda', value: '#059669', gradient: ['#10B981', '#047857'] },
  { id: 'orange', label: 'Naranja', value: '#F97316', gradient: ['#FB923C', '#EA580C'] },
  { id: 'brown', label: 'Cobre', value: '#B45309', gradient: ['#B45309', '#92400E'] },
];

const DEFAULT_CATEGORY_COLOR_ID = CATEGORY_COLOR_OPTIONS[0].id;
const COLOR_OPTIONS_WITH_VALUE = CATEGORY_COLOR_OPTIONS.filter(option => option.value !== null);

const findColorOptionById = (id: string): CategoryColorOption | undefined =>
  CATEGORY_COLOR_OPTIONS.find(option => option.id === id);

const findColorOptionByValue = (value?: string | null): CategoryColorOption | undefined => {
  if (!value) return undefined;
  return CATEGORY_COLOR_OPTIONS.find(option => option.value && option.value.toLowerCase() === value.toLowerCase());
};

const getCategoryGradient = (category: Category, index: number): [string, string] => {
  const option = findColorOptionByValue(category.color);
  if (option) return option.gradient;
  if (category.color) {
    return [category.color, category.color];
  }
  if (!COLOR_OPTIONS_WITH_VALUE.length) {
    return ['#3B82F6', '#2563EB'];
  }
  const fallbackIndex = index % COLOR_OPTIONS_WITH_VALUE.length;
  return COLOR_OPTIONS_WITH_VALUE[fallbackIndex].gradient;
};

const FALLBACK_CATEGORIES: Category[] = [
  {
    id: 'sample-boda',
    title: 'Boda MarAa',
    description: '',
    color: null,
    createdAt: undefined,
    updatedAt: undefined,
    tasks: [
      { id: 'sample-boda-1', title: 'Zapatos de charol', status: DEFAULT_TASK_STATUS },
      { id: 'sample-boda-2', title: 'Traje recoger', status: DEFAULT_TASK_STATUS },
      { id: 'sample-boda-3', title: 'Ir por Gabo', status: DEFAULT_TASK_STATUS },
    ],
    tasksCount: 3,
  },
  {
    id: 'sample-casa',
    title: 'Casa',
    description: '',
    color: null,
    createdAt: undefined,
    updatedAt: undefined,
    tasks: [
      { id: 'sample-casa-1', title: 'Rotoplas', status: DEFAULT_TASK_STATUS },
      { id: 'sample-casa-2', title: 'Lavavajillas', status: DEFAULT_TASK_STATUS },
    ],
    tasksCount: 2,
  },
  {
    id: 'sample-silverado',
    title: 'Silverado',
    description: '',
    color: null,
    createdAt: undefined,
    updatedAt: undefined,
    tasks: [
      { id: 'sample-silverado-1', title: 'Soportes motor', status: DEFAULT_TASK_STATUS },
      { id: 'sample-silverado-2', title: 'Aceite transmision', status: DEFAULT_TASK_STATUS },
    ],
    tasksCount: 2,
  },
  {
    id: 'sample-gatos',
    title: 'Gatos',
    description: '',
    color: null,
    createdAt: undefined,
    updatedAt: undefined,
    tasks: [
      { id: 'sample-gatos-1', title: 'Camita', status: DEFAULT_TASK_STATUS },
    ],
    tasksCount: 1,
  },
];

const cloneFallbackCategories = (): Category[] =>
  FALLBACK_CATEGORIES.map((category: Category) => ({
    ...category,
    tasks: category.tasks.map((task: Task) => ({ ...task })),
    tasksCount: category.tasks.length,
  }));

interface ApiResponse<T> {
  status: string;
  data: T;
  message?: string;
}

export default function PendientesScreen() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [showNewCategoryModal, setShowNewCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryColorId, setNewCategoryColorId] = useState<string>(DEFAULT_CATEGORY_COLOR_ID);
  const [showNewItemModal, setShowNewItemModal] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedCategoryTitle, setSelectedCategoryTitle] = useState('');
  const [showCategoryColorModal, setShowCategoryColorModal] = useState(false);
  const [categoryColorTarget, setCategoryColorTarget] = useState<{ id: string; title: string } | null>(null);
  const [categoryColorSelectionId, setCategoryColorSelectionId] = useState<string>(DEFAULT_CATEGORY_COLOR_ID);

  const [expandedCategoryId, setExpandedCategoryId] = useState<string | null>(null);
  const [reorderModeCategoryId, setReorderModeCategoryId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ visible: boolean; message: string; type: 'success' | 'error' }>(
    { visible: false, message: '', type: 'success' }
  );
  const [usingFallbackData, setUsingFallbackData] = useState(false);
  const fallbackNoticeShown = useRef(false);
  const repairedOrderCategoriesRef = useRef<Set<string>>(new Set());
  const [statusPickerTarget, setStatusPickerTarget] = useState<{ categoryId: string; taskId: string } | null>(null);
  const reorderSnapshotsRef = useRef<Record<string, Task[]>>({});
  const expandedCategoryIdRef = useRef<string | null>(null);
  const reorderModeCategoryIdRef = useRef<string | null>(null);
  const editingCategoryIdRef = useRef<string | null>(null);
  const editingTaskIdRef = useRef<string | null>(null);

  const statusPickerCategory = statusPickerTarget
    ? categories.find(category => category.id === statusPickerTarget.categoryId)
    : undefined;
  const statusPickerTask = statusPickerTarget && statusPickerCategory
    ? statusPickerCategory.tasks.find(task => task.id === statusPickerTarget.taskId)
    : undefined;
  const statusPickerStatus = statusPickerTask?.status || DEFAULT_TASK_STATUS;
  const expandedCategory = expandedCategoryId
    ? categories.find(category => category.id === expandedCategoryId)
    : undefined;
  const headerTitle = expandedCategory && expandedCategory.title
    ? expandedCategory.title
    : 'Pendientes';

  useEffect(() => {
    expandedCategoryIdRef.current = expandedCategoryId;
  }, [expandedCategoryId]);

  useEffect(() => {
    reorderModeCategoryIdRef.current = reorderModeCategoryId;
  }, [reorderModeCategoryId]);

  useEffect(() => {
    editingCategoryIdRef.current = editingCategoryId;
  }, [editingCategoryId]);

  useEffect(() => {
    editingTaskIdRef.current = editingTaskId;
  }, [editingTaskId]);

  // Auto-ocultar el toast despuAs de un tiempo
  useEffect(() => {
    if (toast.visible) {
      const t = setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 2000);
      return () => clearTimeout(t);
    }
  }, [toast.visible]);

  useEffect(() => {
    console.log('[Pendientes] API root ->', API_CONFIG.API_ROOT);
  }, []);

  const showToastMessage = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ visible: true, message, type });
  }, []);
  const cancelEdit = useCallback(() => {
    setEditingCategoryId(null);
    setEditingTaskId(null);
    setEditText('');
  }, []);

  const repairMissingOrders = useCallback(async (payloads: Record<string, { id: string; order: number }[]>) => {
    const entries = Object.entries(payloads).filter(([categoryId, items]) => items.length && !repairedOrderCategoriesRef.current.has(categoryId));
    if (!entries.length) {
      return;
    }

    for (const [categoryId, items] of entries) {
      try {
        const response = await fetch(apiRoutes.categoryTasksReorder(categoryId), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify({ data: items }),
        });

        if (response.ok) {
          repairedOrderCategoriesRef.current.add(categoryId);
          continue;
        }

        const rawPayload = await response.text();
        let parsedPayload: any = null;
        try {
          parsedPayload = rawPayload ? JSON.parse(rawPayload) : null;
        } catch {
          // ignored: only needed for logging context
        }

        console.warn('Auto order repair failed:', categoryId, response.status, parsedPayload || rawPayload);
      } catch (error) {
        console.warn('Auto order repair error:', categoryId, error);
      }
    }
  }, []);
  type FetchOptions = { showFeedback?: boolean; silent?: boolean };

  const fetchCategories = useCallback(async (options: FetchOptions = {}) => {
    const { showFeedback = false, silent = false } = options;

    if (!API_CONFIG.BASE_URL) {
      console.warn('API base URL no configurada. Verifica EXPO_PUBLIC_API_BASE_URL_PROD.');
      const fallback = cloneFallbackCategories();
      setCategories(fallback);
      setUsingFallbackData(true);
      fallbackNoticeShown.current = true;
      Alert.alert('Configuracion faltante', 'No se pudo determinar la URL base de la API. Mostramos datos de ejemplo.');
      showToastMessage('Mostrando datos de ejemplo', 'error');
      if (!silent) {
        setLoading(false);
      }
      return;
    }

    if (!silent) {
      setLoading(true);
    }

    try {
      const response = await fetch(apiRoutes.categories('?includeTasks=true'), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data: ApiResponse<any[]> = await response.json();

      if (data.status === 'success' && Array.isArray(data.data)) {
        const repairPayloads: Record<string, { id: string; order: number }[]> = {};
        const normalized = data.data
          .map((rawCategory: any) => {
            const normalizedCategory = normalizeCategory(rawCategory);
            if (!normalizedCategory.id) {
              return normalizedCategory;
            }

            const rawTasks: unknown[] = Array.isArray(rawCategory?.tasks) ? rawCategory.tasks : [];
            const taskOrderCandidates: { id: string; hasOrder: boolean }[] = rawTasks.map((task) => {
              if (!task || typeof task !== 'object') {
                return { id: '', hasOrder: false };
              }
              const candidate = task as Record<string, unknown>;
              const id =
                typeof candidate.id === 'string'
                  ? candidate.id
                  : typeof candidate.taskId === 'string'
                    ? candidate.taskId
                    : '';
              const orderCandidate =
                'order' in candidate
                  ? (candidate as { order?: unknown }).order
                  : 'position' in candidate
                    ? (candidate as { position?: unknown }).position
                    : 'posicion' in candidate
                      ? (candidate as { posicion?: unknown }).posicion
                      : null;

              return {
                id,
                hasOrder: parseOrderValue(orderCandidate) !== null,
              };
            });
            const missingOrderIds = taskOrderCandidates
              .filter(candidate => candidate.id && !candidate.hasOrder)
              .map(candidate => candidate.id);

            if (missingOrderIds.length) {
              const payload = normalizedCategory.tasks
                .filter((task: Task) => missingOrderIds.includes(task.id))
                .map((task: Task) => ({
                  id: task.id,
                  order: typeof task.order === 'number' && Number.isFinite(task.order) ? Math.trunc(task.order) : 0,
                }));
              if (payload.length) {
                repairPayloads[normalizedCategory.id] = payload;
              }
            }

            return normalizedCategory;
          })
          .filter((category) => Boolean(category.id));

        setCategories(normalized);
        setCategoriesCache(normalized);
        if (Object.keys(repairPayloads).length) {
          repairMissingOrders(repairPayloads).catch(error => console.warn('Auto order repair unhandled error:', error));
        }
        setUsingFallbackData(false);
        fallbackNoticeShown.current = false;

        const currentExpandedId = expandedCategoryIdRef.current;
        if (currentExpandedId && !normalized.some(category => category.id === currentExpandedId)) {
          setExpandedCategoryId(null);
        }

        const currentReorderId = reorderModeCategoryIdRef.current;
        if (currentReorderId && !normalized.some(category => category.id === currentReorderId)) {
          setReorderModeCategoryId(null);
        }

        const currentEditingCategoryId = editingCategoryIdRef.current;
        const currentEditingTaskId = editingTaskIdRef.current;
        if (currentEditingCategoryId) {
          const activeCategory = normalized.find(category => category.id === currentEditingCategoryId);
          if (!activeCategory) {
            cancelEdit();
          } else if (currentEditingTaskId && !activeCategory.tasks.some(task => task.id === currentEditingTaskId)) {
            cancelEdit();
          }
        }

        if (showFeedback) {
          showToastMessage('Categorias actualizadas');
        }
      } else {
        throw new Error(data?.message || 'Respuesta inesperada del servidor');
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
      setCategories(cloneFallbackCategories());
      setUsingFallbackData(true);

      if (!fallbackNoticeShown.current) {
        Alert.alert(
          'Modo sin conexion',
          'No se pudieron cargar las Categorias desde el servidor. Mostramos datos de ejemplo.',
          [{ text: 'OK' }]
        );
        fallbackNoticeShown.current = true;
      }

      showToastMessage('Mostrando datos de ejemplo', 'error');
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [cancelEdit, repairMissingOrders, showToastMessage]);

  useEffect(() => {
    const cacheSnapshot = getCategoriesCache();
    const canHydrateFromCache = Boolean(cacheSnapshot?.data?.length) && isCategoriesCacheFresh();
    if (canHydrateFromCache && cacheSnapshot?.data) {
      const cloned = cacheSnapshot.data.map((category: Category) => ({
        ...category,
        tasks: cloneTasks(category.tasks),
      }));
      setCategories(cloned);
      setUsingFallbackData(false);
      setLoading(false);
    }
    void fetchCategories({ silent: Boolean(canHydrateFromCache) });
  }, [fetchCategories]);

  const isSampleCategory = (categoryId: string) => categoryId.startsWith('sample-');
  const isSampleTask = (taskId: string) => taskId.startsWith('sample-');

  const updateCategoryInState = useCallback((categoryId: string, updater: (category: Category) => Category) => {
    setCategories(prev => prev.map(category => (category.id === categoryId ? updater(category) : category)));
  }, []);

  const removeCategoryFromState = useCallback((categoryId: string) => {
    setCategories(prev => prev.filter(category => category.id !== categoryId));
  }, []);

  const resetNewCategoryForm = () => {
    setNewCategoryName('');
    setNewCategoryColorId(DEFAULT_CATEGORY_COLOR_ID);
  };

  const closeNewCategoryModal = () => {
    setShowNewCategoryModal(false);
    resetNewCategoryForm();
  };

  const deleteCategory = (categoryId: string) => {
    if (usingFallbackData || isSampleCategory(categoryId)) {
      Alert.alert('Solo lectura', 'No puedes modificar Categorias mientras estAs sin conexion.');
      return;
    }

    const category = categories.find(item => item.id === categoryId);
    if (!category) {
      return;
    }

    Alert.alert(
      'Confirmar eliminacion',
      `EstAs seguro de que quieres eliminar la Categoria "${category.title}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            setSaving(true);
            try {
              const response = await fetch(apiRoutes.category(categoryId), {
                method: 'DELETE',
                headers: {
                  'Accept': 'application/json',
                },
              });

              if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
              }

              removeCategoryFromState(categoryId);

              if (expandedCategoryId === categoryId) setExpandedCategoryId(null);
              if (reorderModeCategoryId === categoryId) setReorderModeCategoryId(null);
              if (editingCategoryId === categoryId) {
                cancelEdit();
              }

              showToastMessage('Categoria eliminada');
            } catch (error) {
              console.error('Error deleting category:', error);
              Alert.alert('Error', 'No se pudo eliminar la Categoria.');
              showToastMessage('No se pudo eliminar la Categoria', 'error');
            } finally {
              setSaving(false);
            }
          },
        },
      ]
    );
  };

  const deleteTask = (categoryId: string, taskId: string) => {
    if (usingFallbackData || isSampleCategory(categoryId) || isSampleTask(taskId)) {
      Alert.alert('Solo lectura', 'No puedes modificar tareas mientras estAs sin conexion.');
      return;
    }

    const category = categories.find(item => item.id === categoryId);
    const task = category?.tasks.find(item => item.id === taskId);
    if (!category || !task) {
      return;
    }

    Alert.alert(
      'Confirmar eliminacion',
      `Eliminar "${task.title}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            setSaving(true);
            try {
              const response = await fetch(apiRoutes.categoryTask(categoryId, taskId), {
                method: 'DELETE',
                headers: {
                  'Accept': 'application/json',
                },
              });

              if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
              }

              updateCategoryInState(categoryId, (current) => {
                const remainingTasks = current.tasks.filter(item => item.id !== taskId);
                return {
                  ...current,
                  tasks: remainingTasks,
                  tasksCount: remainingTasks.length,
                };
              });

              if (editingTaskId === taskId) {
                cancelEdit();
              }

              showToastMessage('Tarea eliminada');
            } catch (error) {
              console.error('Error deleting task:', error);
              Alert.alert('Error', 'No se pudo eliminar la tarea.');
              showToastMessage('No se pudo eliminar la tarea', 'error');
            } finally {
              setSaving(false);
            }
          },
        },
      ]
    );
  };

  const startEditing = (categoryId: string, taskId: string) => {
    if (usingFallbackData || isSampleCategory(categoryId) || isSampleTask(taskId)) {
      return;
    }

    const category = categories.find(item => item.id === categoryId);
    const task = category?.tasks.find(item => item.id === taskId);
    if (!task) {
      return;
    }

    setEditingCategoryId(categoryId);
    setEditingTaskId(taskId);
    setEditText(task.title);
  };

  const saveEdit = async () => {
    if (usingFallbackData || !editingCategoryId || !editingTaskId || isSampleCategory(editingCategoryId) || isSampleTask(editingTaskId)) {
      if (usingFallbackData) {
        Alert.alert('Solo lectura', 'No puedes editar tareas mientras estAs sin conexion.');
      }
      cancelEdit();
      return;
    }

    const trimmedText = editText.trim();
    if (!trimmedText) {
      Alert.alert('Validacion', 'El tAtulo no puede estar vacAo.');
      return;
    }

    setSaving(true);

    try {
      const response = await fetch(apiRoutes.categoryTask(editingCategoryId, editingTaskId), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ data: { title: trimmedText } }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      updateCategoryInState(editingCategoryId, (category) => {
        const updatedTasks = category.tasks.map((task: Task) => (
          task.id === editingTaskId
            ? { ...task, title: trimmedText }
            : task
        ));

        return {
          ...category,
          tasks: updatedTasks,
        };
      });

      showToastMessage('Tarea actualizada');
      cancelEdit();
    } catch (error) {
      console.error('Error updating task:', error);
      Alert.alert('Error', 'No se pudo actualizar la tarea.');
      showToastMessage('No se pudo actualizar la tarea', 'error');
    } finally {
      setSaving(false);
    }
  };

  const addNewCategory = async () => {
    if (usingFallbackData) {
      Alert.alert('Solo lectura', 'No puedes crear nuevas categorias mientras estas sin conexion.');
      return;
    }

    const trimmedName = newCategoryName.trim();
    if (!trimmedName) {
      Alert.alert('Validacion', 'Ingresa un nombre para la categoria.');
      return;
    }

    const selectedColorOption = findColorOptionById(newCategoryColorId) || CATEGORY_COLOR_OPTIONS[0];
    const colorValue = selectedColorOption.value ?? null;

    setSaving(true);

    try {
      const response = await fetch(apiRoutes.categories(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ data: { title: trimmedName, color: colorValue } }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result: ApiResponse<any> = await response.json();
      if (result.status !== 'success' || !result.data) {
        throw new Error(result?.message || 'Respuesta inesperada al crear la categoria');
      }

      const responseData = { ...result.data };
      if (!Object.prototype.hasOwnProperty.call(responseData, 'color')) {
        responseData.color = colorValue;
      }

      const newCategory = normalizeCategory({ ...responseData, tasks: [] });
      setCategories(prev => [...prev, newCategory]);
      closeNewCategoryModal();
      showToastMessage('Categoria creada');
    } catch (error) {
      console.error('Error creating category:', error);
      Alert.alert('Error', 'No se pudo crear la categoria.');
      showToastMessage('No se pudo crear la categoria', 'error');
    } finally {
      setSaving(false);
    }
  };
  const openCategoryColorModal = (category: Category) => {
    if (usingFallbackData || isSampleCategory(category.id)) {
      Alert.alert('Solo lectura', 'No puedes editar el color mientras estas sin conexion.');
      return;
    }

    setCategoryColorTarget({ id: category.id, title: category.title });
    const option = findColorOptionByValue(category.color);
    setCategoryColorSelectionId(option ? option.id : DEFAULT_CATEGORY_COLOR_ID);
    setShowCategoryColorModal(true);
  };

  const closeCategoryColorModal = () => {
    setShowCategoryColorModal(false);
    setCategoryColorTarget(null);
    setCategoryColorSelectionId(DEFAULT_CATEGORY_COLOR_ID);
  };

  const confirmCategoryColorSelection = async () => {
    if (!categoryColorTarget) {
      return;
    }

    const selectedOption = findColorOptionById(categoryColorSelectionId) || CATEGORY_COLOR_OPTIONS[0];
    const colorValue = selectedOption.value ?? null;

    setSaving(true);

    try {
      const response = await fetch(apiRoutes.category(categoryColorTarget.id), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ data: { color: colorValue } }),
      });

      if (!response.ok) {
        const rawPayload = await response.text();
        let parsedPayload: any = null;
        try {
          parsedPayload = rawPayload ? JSON.parse(rawPayload) : null;
        } catch {
          // Ignorar error al parsear, solo para logging
        }

        console.error('Update category color response:', response.status, parsedPayload || rawPayload);

        const message = parsedPayload?.message || `HTTP ${response.status}`;
        const error = new Error(message) as Error & { status?: number; details?: any };
        error.status = response.status;
        error.details = parsedPayload;
        throw error;
      }

      updateCategoryInState(categoryColorTarget.id, (category) => ({
        ...category,
        color: colorValue,
      }));
      showToastMessage('Color actualizado');
      closeCategoryColorModal();
    } catch (error) {
      console.error('Error updating category color:', error);
      let alertMessage = 'No se pudo actualizar el color.';

      if (error instanceof Error && error.message) {
        alertMessage = error.message;
      }

      Alert.alert('Error', alertMessage);
    } finally {
      setSaving(false);
    }
  };
  const addNewTask = async () => {
    if (usingFallbackData || !selectedCategoryId || isSampleCategory(selectedCategoryId)) {
      Alert.alert('Solo lectura', 'No puedes crear tareas nuevas mientras estAs sin conexion.');
      return;
    }

    const trimmedTitle = newTaskTitle.trim();
    const trimmedDescription = newTaskDescription.trim();
    if (!trimmedTitle) {
      Alert.alert('Validacion', 'Ingresa un titulo para la tarea.');
      return;
    }

    setSaving(true);

    try {
      const response = await fetch(apiRoutes.categoryTasks(selectedCategoryId), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          data: {
            title: trimmedTitle,
            description: trimmedDescription,
            status: DEFAULT_TASK_STATUS,
          },
        }),
      });

      if (!response.ok) {
        const rawPayload = await response.text();
        let parsedPayload: any = null;
        try {
          parsedPayload = rawPayload ? JSON.parse(rawPayload) : null;
        } catch (parseError) {
          console.warn('No se pudo parsear la respuesta de error al crear tarea:', parseError);
        }

        console.error('Create task response:', response.status, parsedPayload || rawPayload);

        const message = parsedPayload?.message || `HTTP ${response.status}`;
        const error = new Error(message) as Error & { status?: number; details?: any };
        error.status = response.status;
        error.details = parsedPayload;
        throw error;
      }

      const result: ApiResponse<any> = await response.json();
      if (result.status !== 'success' || !result.data) {
        throw new Error(result?.message || 'Respuesta inesperada al crear la tarea');
      }

      const newTask = normalizeTask(result.data);
      updateCategoryInState(selectedCategoryId, (category) => {
        const updatedTasks = [...category.tasks, newTask];
        return {
          ...category,
          tasks: updatedTasks,
          tasksCount: updatedTasks.length,
        };
      });

      closeNewTaskModal();
      showToastMessage('Tarea creada');
    } catch (error) {
      console.error('Error creating task:', error);
      let alertMessage = 'No se pudo crear la tarea.';

      if (error instanceof Error) {
        if (error.message) {
          alertMessage = error.message;
        }

        const details = (error as any).details;
        if (details?.validStatus && Array.isArray(details.validStatus)) {
          alertMessage += ` Valores permitidos: ${details.validStatus.join(', ')}.`;
        }
      }

      Alert.alert('Error', alertMessage);
      showToastMessage('No se pudo crear la tarea', 'error');
    } finally {
      setSaving(false);
    }
  };

  const showAddItemModal = (category: Category) => {
    if (usingFallbackData || isSampleCategory(category.id)) {
      Alert.alert('Solo lectura', 'No puedes crear tareas nuevas mientras estAs sin conexion.');
      return;
    }

    setSelectedCategoryId(category.id);
    setSelectedCategoryTitle(category.title);
    setNewTaskTitle('');
    setNewTaskDescription('');
    setShowNewItemModal(true);
  };

  const closeNewTaskModal = () => {
    setShowNewItemModal(false);
    setSelectedCategoryId(null);
    setSelectedCategoryTitle('');
    setNewTaskTitle('');
    setNewTaskDescription('');
  };

  const openStatusPicker = (categoryId: string, taskId: string) => {
    if (usingFallbackData || isSampleCategory(categoryId) || isSampleTask(taskId)) {
      Alert.alert('Solo lectura', 'No puedes cambiar el estatus mientras estAs sin conexion.');
      return;
    }

    setStatusPickerTarget({ categoryId, taskId });
  };

  const closeStatusPicker = () => {
    setStatusPickerTarget(null);
  };

  const updateTaskStatusLocally = (categoryId: string, taskId: string, status: string) => {
    updateCategoryInState(categoryId, (category) => {
      const tasks = category.tasks.map((task: Task) => (
        task.id === taskId ? { ...task, status } : task
      ));
      return {
        ...category,
        tasks,
      };
    });
  };

  const updateTaskStatus = async (categoryId: string, taskId: string, status: string) => {
    if (usingFallbackData || isSampleCategory(categoryId) || isSampleTask(taskId)) {
      Alert.alert('Solo lectura', 'No puedes cambiar el estatus mientras estAs sin conexion.');
      return;
    }

    setSaving(true);

    try {
      const response = await fetch(apiRoutes.categoryTask(categoryId, taskId), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ data: { status } }),
      });

      if (!response.ok) {
        const rawPayload = await response.text();
        let parsedPayload: any = null;
        try {
          parsedPayload = rawPayload ? JSON.parse(rawPayload) : null;
        } catch (parseError) {
          console.warn('No se pudo parsear la respuesta de error al actualizar estatus:', parseError);
        }

        console.error('Update task status response:', response.status, parsedPayload || rawPayload);

        const message = parsedPayload?.message || `HTTP ${response.status}`;
        const error = new Error(message) as Error & { status?: number; details?: any };
        error.status = response.status;
        error.details = parsedPayload;
        throw error;
      }

      updateTaskStatusLocally(categoryId, taskId, status);
      showToastMessage('Estatus actualizado');
    } catch (error) {
      console.error('Error updating task status:', error);

      let alertMessage = 'No se pudo actualizar el estatus.';
      if (error instanceof Error) {
        if (error.message) {
          alertMessage = error.message;
        }

        const details = (error as any).details;
        if (details?.validStatus && Array.isArray(details.validStatus)) {
          alertMessage += ` Valores permitidos: ${details.validStatus.join(', ')}.`;
        }
      }

      Alert.alert('Error', alertMessage);
    } finally {
      setSaving(false);
    }
  };

  const handleStatusSelection = async (status: string) => {
    if (!statusPickerTarget) {
      return;
    }

    const { categoryId, taskId } = statusPickerTarget;
    if (status === statusPickerStatus) {
      closeStatusPicker();
      return;
    }

    closeStatusPicker();
    await updateTaskStatus(categoryId, taskId, status);
  };

  const toggleEditMode = (categoryId: string, taskId: string) => {
    if (usingFallbackData || isSampleCategory(categoryId) || isSampleTask(taskId)) {
      Alert.alert('Solo lectura', 'No puedes editar tareas mientras estAs sin conexion.');
      return;
    }

    if (editingCategoryId === categoryId && editingTaskId === taskId) {
      cancelEdit();
    } else {
      startEditing(categoryId, taskId);
    }
  };

  const toggleCategory = (categoryId: string) => {
    if (expandedCategoryId === categoryId) {
      setExpandedCategoryId(null);
      if (editingCategoryId === categoryId) {
        cancelEdit();
      }
    } else {
      setExpandedCategoryId(categoryId);
    }
  };

  const enterReorderMode = useCallback((categoryId: string) => {
    if (usingFallbackData || isSampleCategory(categoryId)) {
      Alert.alert('Solo lectura', 'No puedes reordenar tareas mientras estAs sin conexion.');
      return;
    }
    const category = categories.find(item => item.id === categoryId);
    if (!category) {
      return;
    }
    reorderSnapshotsRef.current[categoryId] = cloneTasks(category.tasks);
    setReorderModeCategoryId(categoryId);
    if (editingCategoryId) {
      cancelEdit();
    }
  }, [cancelEdit, categories, editingCategoryId, usingFallbackData]);

  const cancelReorderChanges = useCallback((categoryId: string) => {
    const snapshot = reorderSnapshotsRef.current[categoryId];
    if (snapshot) {
      updateCategoryInState(categoryId, (category) => ({
        ...category,
        tasks: cloneTasks(snapshot),
        tasksCount: snapshot.length,
      }));
      delete reorderSnapshotsRef.current[categoryId];
    }
    setReorderModeCategoryId(null);
  }, [updateCategoryInState]);

  const persistTaskOrder = async (categoryId: string, orderedTasks: Task[]) => {
    if (usingFallbackData || isSampleCategory(categoryId)) {
      return;
    }

    try {
      const response = await fetch(apiRoutes.categoryTasksReorder(categoryId), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          data: orderedTasks.map((task: Task, index: number) => ({ id: task.id, order: index })),
        }),
      });

      if (!response.ok) {
        const rawPayload = await response.text();
        let parsedPayload: any = null;
        try {
          parsedPayload = rawPayload ? JSON.parse(rawPayload) : null;
        } catch (parseError) {
          console.warn('No se pudo parsear la respuesta de error al guardar el orden:', parseError);
        }

        console.error('Persist task order response:', response.status, parsedPayload || rawPayload);

        const message = parsedPayload?.message || `HTTP ${response.status}`;
        const error = new Error(message) as Error & { status?: number; details?: any };
        error.status = response.status;
        error.details = parsedPayload;
        throw error;
      }

    } catch (error) {
      console.error('Error saving task order:', error);
      let alertMessage = 'No se pudo guardar el nuevo orden.';

      if (error instanceof Error && error.message) {
        alertMessage = error.message;
      }

      Alert.alert('Error', alertMessage);
    }
  };

  const confirmReorderChanges = useCallback(async (categoryId: string) => {
    if (usingFallbackData || isSampleCategory(categoryId)) {
      Alert.alert('Solo lectura', 'No puedes reordenar tareas mientras estAs sin conexion.');
      return;
    }
    const targetCategory = categories.find(item => item.id === categoryId);
    if (!targetCategory) {
      return;
    }
    setSaving(true);
    try {
      await persistTaskOrder(categoryId, targetCategory.tasks);
      showToastMessage('Orden actualizado');
      delete reorderSnapshotsRef.current[categoryId];
      setReorderModeCategoryId(null);
    } catch (error) {
      Alert.alert('Error', 'No se pudo guardar el nuevo orden.');
    } finally {
      setSaving(false);
    }
  }, [categories, persistTaskOrder, showToastMessage, usingFallbackData]);

  const handleDragEnd = (categoryId: string, data: Task[]) => {
    updateCategoryInState(categoryId, (category) => ({
      ...category,
      tasks: data,
      tasksCount: data.length,
    }));
  };

  const renderDraggableItem = ({ item, drag, isActive, categoryId }: RenderItemParams<Task> & { categoryId: string }) => {
    const statusMeta = getTaskStatusMeta(item.status);

    return (
      <TouchableOpacity
        style={[
          styles.draggableItemContainer,
          isActive && styles.draggableItemActive
        ]}
        onLongPress={drag}
        disabled={isActive}
      >
        <View style={styles.dragHandle}>
          <Ionicons name="reorder-two-outline" size={22} color="#6366F1" />
        </View>

        <View style={styles.draggableItemContent}>
          <Text style={styles.draggableItemTitle} numberOfLines={2}>
            {item.title}
          </Text>
          {item.description ? (
            <Text style={styles.draggableItemDescription} numberOfLines={3}>
              {item.description}
            </Text>
          ) : null}
          <Text style={[styles.draggableItemStatus, { color: statusMeta.color }]}>
            {statusMeta.label}
          </Text>
        </View>

        <TouchableOpacity
          onPress={() => deleteTask(categoryId, item.id)}
          style={styles.actionButton}
        >
          <Ionicons name="trash-outline" size={20} color="#EF4444" />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  const renderColorOptions = (selectedId: string, onSelect: (id: string) => void) => (
    <View style={styles.colorOptionsGrid}>
      {CATEGORY_COLOR_OPTIONS.map(option => {
        const selected = option.id === selectedId;
        return (
          <TouchableOpacity
            key={option.id}
            style={[styles.colorOption, selected && styles.colorOptionSelected]}
            onPress={() => onSelect(option.id)}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={`Color ${option.label}`}
          >
            <LinearGradient
              colors={option.gradient as any}
              style={[styles.colorSwatch, selected && styles.colorSwatchSelected]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              {selected && <Ionicons name="checkmark" size={20} color="white" />}
            </LinearGradient>
            <Text style={[styles.colorOptionLabel, selected && styles.colorOptionLabelSelected]}>
              {option.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
  const renderCategory = ({ item: category, index }: { item: Category; index: number }) => {
    const isExpanded = expandedCategoryId === category.id;
    const derivedIndex = categories.findIndex(current => current.id === category.id);
    const categoryGradient = getCategoryGradient(category, derivedIndex >= 0 ? derivedIndex : index);
    const tasks = category.tasks || [];

    if (!isExpanded) {
      return (
        <TouchableOpacity
          style={[styles.dashboardCard, { marginRight: (index + 1) % 2 === 0 ? 0 : 12 }]}
          onPress={() => toggleCategory(category.id)}
          activeOpacity={0.7}
        >
          <LinearGradient
            colors={categoryGradient as any}
            style={styles.cardGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.cardContent}>
              <View style={styles.iconContainer}>
                <Ionicons name="list-outline" size={32} color="white" />
              </View>
              <Text style={styles.cardTitle}>{category.title}</Text>
              <Text style={styles.cardDescription}>{category.tasksCount ?? tasks.length} elementos</Text>
            </View>
          </LinearGradient>
        </TouchableOpacity>
      );
    }

    return (
      <View style={styles.expandedCategoryCard}>
        <LinearGradient
          colors={categoryGradient as any}
          style={styles.expandedCategoryHeader}
        >
          <Text style={styles.expandedCategoryTitle}>{category.title}</Text>
          <View style={styles.categoryActions}>
            {reorderModeCategoryId === category.id ? (
              <>
                <TouchableOpacity
                  onPress={() => confirmReorderChanges(category.id)}
                  disabled={saving}
                  style={styles.headerActionButton}
                >
                  <Ionicons name="checkmark" size={24} color="#10B981" />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => cancelReorderChanges(category.id)}
                  disabled={saving}
                  style={styles.headerActionButton}
                >
                  <Ionicons name="close" size={24} color="#EF4444" />
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity
                  onPress={() => openCategoryColorModal(category)}
                  style={styles.headerActionButton}
                >
                  <Ionicons name="color-palette-outline" size={24} color="white" />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => enterReorderMode(category.id)}
                  style={styles.headerActionButton}
                >
                  <Ionicons name="swap-vertical-outline" size={24} color="white" />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => deleteCategory(category.id)}
                  style={styles.headerActionButton}
                >
                  <Ionicons name="trash-outline" size={24} color="#EF4444" />
                </TouchableOpacity>
              </>
            )}
          </View>
        </LinearGradient>

        <View style={styles.categoryContent}>
          {reorderModeCategoryId === category.id ? (
            <DraggableFlatList
              data={tasks}
              onDragEnd={({ data }) => handleDragEnd(category.id, data)}
              keyExtractor={(task) => task.id}
              renderItem={(params) => renderDraggableItem({ ...params, categoryId: category.id })}
              containerStyle={styles.draggableContainer}
              style={styles.draggableList}
              activationDistance={8}
              dragItemOverflow
              autoscrollSpeed={200}
              autoscrollThreshold={50}
            />
          ) : (
            <TaskList
              tasks={tasks}
              categoryId={category.id}
              editingCategoryId={editingCategoryId}
              editingTaskId={editingTaskId}
              editText={editText}
              onChangeEditText={setEditText}
              onToggleEditMode={toggleEditMode}
              onDeleteTask={deleteTask}
              onOpenStatusPicker={openStatusPicker}
              onSaveEdit={saveEdit}
              onCancelEdit={cancelEdit}
            />
          )}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text>Cargando categorías...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
      <HeroHeader
        title={headerTitle}
        image={HEADER_IMAGE}
        onBack={() => {
          if (expandedCategoryId) {
            toggleCategory(expandedCategoryId);
          } else {
            router.back();
          }
        }}
      />

      {/* <View style={styles.topActions}>
        <TouchableOpacity
          onPress={() => fetchCategories(true)}
          style={[styles.refreshButton, (saving || loading) && styles.refreshButtonDisabled]}
          disabled={saving || loading}
        >
          <Ionicons name="refresh-outline" size={18} color="#0F172A" />
          <Text style={styles.refreshButtonText}>Actualizar</Text>
        </TouchableOpacity>
      </View> */}

      {/* Content */}
      {expandedCategoryId ? (
        <View style={styles.expandedView}>
          <FlatList
            key="expanded-view"
            data={categories.filter(category => category.id === expandedCategoryId)}
            renderItem={renderCategory}
            keyExtractor={(item) => item.id}
            style={styles.expandedList}
            contentContainerStyle={styles.listContent}
          />
        </View>
      ) : (
        <FlatList
          key="cards-view"
          data={categories}
          renderItem={renderCategory}
          keyExtractor={(item) => item.id}
          style={styles.list}
          contentContainerStyle={styles.cardsGrid}
          numColumns={2}
        />
      )}

      {/* Floating Action Button */}
      <Modal visible={saving} transparent animationType="fade">
        <View style={styles.savingOverlay}>
          <View style={styles.savingCard}>
            <ActivityIndicator size="large" color="#6366F1" />
            <Text style={styles.savingText}>Guardando</Text>
          </View>
        </View>
      </Modal>

      {/* Toast simple */}
      {toast.visible && (
        <View
          style={[
            styles.toastContainer,
            toast.type === 'success' ? styles.toastSuccess : styles.toastError,
          ]}
          pointerEvents="none"
        >
          <Text style={styles.toastText}>{toast.message}</Text>
        </View>
      )}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => {
          if (expandedCategoryId) {
            const category = categories.find(item => item.id === expandedCategoryId);
            if (category) {
              showAddItemModal(category);
            }
          } else {
            if (usingFallbackData) {
              Alert.alert('Solo lectura', 'No puedes crear nuevas Categorias mientras estAs sin conexion.');
            } else {
              resetNewCategoryForm();
              setShowNewCategoryModal(true);
            }
          }
        }}
      >
        <Ionicons name="add" size={28} color="white" />
      </TouchableOpacity>

      {/* New Category Modal */}
      <Modal
        visible={Boolean(statusPickerTarget)}
        transparent
        animationType="slide"
        onRequestClose={closeStatusPicker}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Cambiar estatus</Text>
            <Text style={styles.modalSubtitle}>
              {statusPickerTask ? `Tarea: ${statusPickerTask.title}` : ''}
            </Text>
            <View style={styles.statusOptionsContainer}>
              {TASK_STATUS_OPTIONS.map((option) => {
                const isActive = option.value === statusPickerStatus;
                return (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.statusOption,
                      isActive && styles.statusOptionActive,
                    ]}
                    onPress={() => handleStatusSelection(option.value)}
                  >
                    <View
                      style={[
                        styles.statusOptionIndicator,
                        { backgroundColor: option.color },
                      ]}
                    />
                    <Text
                      style={[
                        styles.statusOptionLabel,
                        isActive && styles.statusOptionLabelActive,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={closeStatusPicker}
                style={[styles.modalButton, styles.cancelButton]}
              >
                <Text style={styles.cancelButtonText}>Cerrar</Text>
              </TouchableOpacity>
              
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showNewCategoryModal}
        transparent
        animationType="slide"
        onRequestClose={closeNewCategoryModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Nueva Categoria</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Nombre de la categoria"
              value={newCategoryName}
              onChangeText={setNewCategoryName}
              autoFocus
            />
            <Text style={styles.modalSubtitle}>Color</Text>
            {renderColorOptions(newCategoryColorId, setNewCategoryColorId)}
            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={closeNewCategoryModal}
                style={[styles.modalButton, styles.cancelButton]}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={addNewCategory}
                style={[styles.modalButton, styles.confirmButton]}
              >
                <Text style={styles.confirmButtonText}>Crear</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showCategoryColorModal && !!categoryColorTarget}
        transparent
        animationType="slide"
        onRequestClose={closeCategoryColorModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Color de la categoria</Text>
            {categoryColorTarget ? (
              <Text style={styles.modalSubtitle}>{categoryColorTarget.title}</Text>
            ) : null}
            {renderColorOptions(categoryColorSelectionId, setCategoryColorSelectionId)}
            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={closeCategoryColorModal}
                style={[styles.modalButton, styles.cancelButton]}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={confirmCategoryColorSelection}
                style={[styles.modalButton, styles.confirmButton]}
              >
                <Text style={styles.confirmButtonText}>Guardar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* New Item Modal */}
      <Modal
        visible={showNewItemModal}
        transparent
        animationType="slide"
        onRequestClose={closeNewTaskModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Nuevo Elemento</Text>
            <Text style={styles.modalSubtitle}>Categoria: {selectedCategoryTitle}</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Titulo de la tarea"
              value={newTaskTitle}
              onChangeText={setNewTaskTitle}
              autoFocus
            />
            <TextInput
              style={[styles.modalInput, styles.modalTextArea]}
              placeholder="Descripcion (opcional)"
              value={newTaskDescription}
              onChangeText={setNewTaskDescription}
              multiline
              numberOfLines={4}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={closeNewTaskModal}
                style={[styles.modalButton, styles.cancelButton]}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={addNewTask}
                style={[styles.modalButton, styles.confirmButton]}
              >
                <Text style={styles.confirmButtonText}>Agregar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

type TaskListProps = {
  tasks: Task[];
  categoryId: string;
  editingCategoryId: string | null;
  editingTaskId: string | null;
  editText: string;
  onChangeEditText: (text: string) => void;
  onToggleEditMode: (categoryId: string, taskId: string) => void;
  onDeleteTask: (categoryId: string, taskId: string) => void;
  onOpenStatusPicker: (categoryId: string, taskId: string) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
};

const TaskList = memo((props: TaskListProps) => {
  const {
    tasks,
    categoryId,
    editingCategoryId,
    editingTaskId,
    editText,
    onChangeEditText,
    onToggleEditMode,
    onDeleteTask,
    onOpenStatusPicker,
    onSaveEdit,
    onCancelEdit,
  } = props;

  const renderTaskItem = useCallback(
    ({ item }: ListRenderItemInfo<Task>) => {
      const isEditing = editingCategoryId === categoryId && editingTaskId === item.id;
      return (
        <TaskRow
          task={item}
          isEditing={isEditing}
          editText={isEditing ? editText : ''}
          onChangeEditText={onChangeEditText}
          onToggleEdit={() => onToggleEditMode(categoryId, item.id)}
          onDelete={() => onDeleteTask(categoryId, item.id)}
          onOpenStatusPicker={() => onOpenStatusPicker(categoryId, item.id)}
          onSaveEdit={onSaveEdit}
          onCancelEdit={onCancelEdit}
        />
      );
    },
    [
      categoryId,
      editText,
      editingCategoryId,
      editingTaskId,
      onCancelEdit,
      onChangeEditText,
      onDeleteTask,
      onOpenStatusPicker,
      onSaveEdit,
      onToggleEditMode,
    ]
  );

  return (
    <FlatList<Task>
      data={tasks}
      keyExtractor={(task) => task.id}
      renderItem={renderTaskItem}
      style={styles.tasksList}
      contentContainerStyle={tasks.length ? undefined : styles.tasksListEmpty}
      initialNumToRender={8}
      maxToRenderPerBatch={10}
      windowSize={5}
      showsVerticalScrollIndicator={false}
      ListEmptyComponent={<Text style={styles.emptyText}>No hay elementos en esta Categoria</Text>}
    />
  );
});

type TaskRowProps = {
  task: Task;
  isEditing: boolean;
  editText: string;
  onChangeEditText: (value: string) => void;
  onToggleEdit: () => void;
  onDelete: () => void;
  onOpenStatusPicker: () => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
};

const TaskRow = memo(
  ({
    task,
    isEditing,
    editText,
    onChangeEditText,
    onToggleEdit,
    onDelete,
    onOpenStatusPicker,
    onSaveEdit,
    onCancelEdit,
  }: TaskRowProps) => {
    const statusMeta = getTaskStatusMeta(task.status);

    return (
      <View style={styles.itemContainer}>
        <View style={styles.itemContent}>
          {isEditing ? (
            <TextInput
              style={styles.editInput}
              value={editText}
              onChangeText={onChangeEditText}
              autoFocus
              onSubmitEditing={onSaveEdit}
            />
          ) : (
            <>
              <View style={styles.itemHeaderRow}>
                <Text style={styles.itemText} numberOfLines={2}>
                  {task.title}
                </Text>
                <TouchableOpacity
                  onPress={onOpenStatusPicker}
                  style={[styles.statusBadge, { backgroundColor: `${statusMeta.color}1A`, borderColor: statusMeta.color }]}
                >
                  <Text style={[styles.statusBadgeText, { color: statusMeta.color }]}>{statusMeta.label}</Text>
                </TouchableOpacity>
              </View>
              {task.description ? (
                <Text style={styles.itemDescription} numberOfLines={4}>
                  {task.description}
                </Text>
              ) : null}
            </>
          )}
        </View>

        <View style={styles.itemActions}>
          {isEditing ? (
            <>
              <TouchableOpacity onPress={onSaveEdit} style={styles.actionButton}>
                <Ionicons name="checkmark" size={20} color="#10B981" />
              </TouchableOpacity>
              <TouchableOpacity onPress={onCancelEdit} style={styles.actionButton}>
                <Ionicons name="close" size={20} color="#EF4444" />
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity onPress={onToggleEdit} style={styles.actionButton}>
              <Ionicons name="create-outline" size={20} color="#6366F1" />
            </TouchableOpacity>
          )}
          {!isEditing ? (
            <TouchableOpacity onPress={onDelete} style={styles.actionButton}>
              <Ionicons name="trash-outline" size={20} color="#EF4444" />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    );
  }
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    paddingTop: 0,
  },
  topActions: {
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 8,
    alignItems: 'flex-end',
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#E2E8F0',
  },
  refreshButtonDisabled: {
    opacity: 0.6,
  },
  refreshButtonText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    flex: 1,
  },
  listContent: {
    padding: 20,
    paddingBottom: 100,
  },
  cardsGrid: {
    padding: 20,
    paddingBottom: 100,
  },
  // Estilos para cards del dashboard
  dashboardCard: {
    width: (width - 52) / 2,
    marginBottom: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  cardGradient: {
    borderRadius: 16,
    padding: 20,
    minHeight: 140,
  },
  cardContent: {
    flex: 1,
    justifyContent: 'space-between',
  },
  iconContainer: {
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
    marginBottom: 4,
  },
  cardDescription: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    lineHeight: 16,
  },
  // Estilos para vista expandida
  expandedCategoryCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  expandedCategoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  backToCardsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  backToCardsContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backToCardsText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 6,
  },
  expandedView: {
    flex: 1,
  },
  backToAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 20,
    marginBottom: 10,
    borderRadius: 8,
    justifyContent: 'center',
  },
  backToAllText: {
    color: '#6B7280',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
  expandedList: {
    flex: 1,
  },
  expandedCategoryTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: 'white',
    flex: 1,
    textAlign: 'center',
  },
  categoryActions: {
    flexDirection: 'row',
  },
  headerActionButton: {
    marginLeft: 12,
  },
  categoryContent: {
    padding: 16,
    flex: 1,
  },
  tasksList: {
    flexGrow: 1,
  },
  tasksListEmpty: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  itemContent: {
    flex: 1,
  },
  itemHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  itemText: {
    fontSize: 16,
    color: '#1F2937',
     flexShrink: 1,
  },
  itemDescription: {
    fontSize: 13,
    color: '#4B5563',
    marginTop: 6,
  },
  statusBadge: {
    alignSelf: 'auto',
    marginTop: 0,
    marginLeft: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  draggableContainer: {
    paddingVertical: 4,
  },
  draggableList: {
    flex: 1,
  },
  draggableItemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  draggableItemActive: {
    borderColor: '#6366F1',
    backgroundColor: '#EEF2FF',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  dragHandle: {
    marginRight: 12,
  },
  draggableItemContent: {
    flex: 1,
  },
  draggableItemTitle: {
    fontSize: 15,
    color: '#111827',
    fontWeight: '500',
    flexShrink: 1,
  },
  draggableItemDescription: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 4,
    flexShrink: 1,
  },
  draggableItemStatus: {
    fontSize: 12,
    marginTop: 4,
  },
  editInput: {
    fontSize: 16,
    color: '#1F2937',
    borderBottomWidth: 1,
    borderBottomColor: '#6366F1',
    paddingVertical: 4,
  },
  itemActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    padding: 8,
    marginLeft: 4,
  },
  emptyText: {
    textAlign: 'center',
    color: '#6B7280',
    fontStyle: 'italic',
    paddingVertical: 20,
  },
  fab: {
    position: 'absolute',
    bottom: 30,
    right: 30,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#6366F1',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    width: width - 40,
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 20,
  },
  modalTextArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  colorOptionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
    marginBottom: 16,
  },
  colorOption: {
    alignItems: 'center',
    marginRight: 12,
    marginBottom: 12,
  },
  colorOptionSelected: {
    transform: [{ scale: 1.05 }],
  },
  colorSwatch: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorSwatchSelected: {
    borderColor: '#6366F1',
  },
  colorOptionLabel: {
    marginTop: 6,
    fontSize: 12,
    color: '#6B7280',
  },
  colorOptionLabelSelected: {
    color: '#1F2937',
    fontWeight: '600',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  modalButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    marginLeft: 12,
  },
  cancelButton: {
    backgroundColor: '#F3F4F6',
  },
  cancelButtonText: {
    color: '#6B7280',
    fontWeight: '500',
  },
  confirmButton: {
    backgroundColor: '#6366F1',
  },
  confirmButtonText: {
    color: 'white',
    fontWeight: '500',
  },
  statusOptionsContainer: {
    marginBottom: 12,
  },
  statusOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#F9FAFB',
  },
  statusOptionActive: {
    borderColor: '#6366F1',
    backgroundColor: '#EEF2FF',
  },
  statusOptionIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  statusOptionLabel: {
    fontSize: 14,
    color: '#374151',
  },
  statusOptionLabelActive: {
    color: '#4C1D95',
    fontWeight: '600',
  },
  // Saving overlay
  savingOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  savingCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 20,
    minWidth: 180,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  savingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#1F2937',
    fontWeight: '600',
  },
  // Toast
  toastContainer: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
  },
  toastSuccess: {
    backgroundColor: '#10B981',
  },
  toastError: {
    backgroundColor: '#EF4444',
  },
  toastText: {
    color: 'white',
    fontWeight: '600',
  },
});
























