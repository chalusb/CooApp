import type { Category, Task } from '@/types/categories';

export const parseOrderValue = (value: any): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    if (Number.isFinite(parsed)) return Math.trunc(parsed);
  }
  return null;
};

export const normalizeTimestamp = (value: any): string => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'number') {
    const date = new Date(value);
    if (!Number.isNaN(date.valueOf())) return date.toISOString();
  }
  if (value && typeof value.toDate === 'function') {
    try {
      const date = value.toDate();
      if (date instanceof Date && !Number.isNaN(date.valueOf())) {
        return date.toISOString();
      }
    } catch {
      return '';
    }
  }
  return '';
};

export const ensureTaskOrder = (tasks: Task[]): Task[] => {
  if (!tasks.length) return [];
  const metadata = tasks.map(task => {
    const order = typeof task.order === 'number' && Number.isFinite(task.order) ? Math.trunc(task.order) : null;
    return {
      original: task,
      order,
      createdAt: normalizeTimestamp(task.createdAt),
    };
  });

  metadata.sort((a, b) => {
    if (a.order !== null && b.order !== null && a.order !== b.order) {
      return a.order - b.order;
    }
    if (a.order !== null) return -1;
    if (b.order !== null) return 1;
    if (a.createdAt && b.createdAt && a.createdAt !== b.createdAt) {
      return a.createdAt.localeCompare(b.createdAt);
    }
    return a.original.id.localeCompare(b.original.id);
  });

  let nextOrder = metadata.reduce((max, item) => (item.order !== null && item.order > max ? item.order : max), -1) + 1;

  return metadata.map(item => {
    if (item.order !== null) {
      return item.original.order === item.order ? item.original : { ...item.original, order: item.order };
    }
    const assignedOrder = nextOrder++;
    return { ...item.original, order: assignedOrder };
  });
};

export const normalizeTask = (task: any): Task => {
  const normalizedStatusSource = task?.status || task?.estatus || task?.state || 'pendiente';
  const normalizedStatus = typeof normalizedStatusSource === 'string'
    ? normalizedStatusSource.toLowerCase()
    : 'pendiente';
  const createdAt = normalizeTimestamp(task?.createdAt);
  const updatedAt = normalizeTimestamp(task?.updatedAt);
  const rawDescription = typeof task?.description === 'string'
    ? task.description
    : (typeof task?.descripcion === 'string' ? task.descripcion : '');
  const description = typeof rawDescription === 'string' ? rawDescription.trim() : '';

  return {
    id: task?.id || task?.taskId || '',
    title: task?.title || task?.name || task?.nombre || '',
    description,
    status: normalizedStatus || 'pendiente',
    dueDate: task?.dueDate || task?.fecha || null,
    createdAt: createdAt || undefined,
    updatedAt: updatedAt || undefined,
    order: parseOrderValue(task?.order ?? task?.position ?? task?.posicion ?? null),
  };
};

export const normalizeCategory = (category: any): Category => {
  const tasksArray = Array.isArray(category?.tasks)
    ? category.tasks.map(normalizeTask).filter((task: Task) => Boolean(task.id))
    : [];
  const orderedTasks = ensureTaskOrder(tasksArray);
  const tasksCount = typeof category?.tasksCount === 'number' ? category.tasksCount : orderedTasks.length;

  return {
    id: category?.id || '',
    title: category?.title || category?.name || category?.nombre || '',
    description: typeof category?.description === 'string'
      ? category.description
      : (typeof category?.descripcion === 'string' ? category.descripcion : ''),
    color: category?.color || null,
    createdAt: category?.createdAt,
    updatedAt: category?.updatedAt,
    tasks: orderedTasks,
    tasksCount,
  };
};

export const cloneTasks = (tasks: Task[]) => tasks.map(task => ({ ...task }));
