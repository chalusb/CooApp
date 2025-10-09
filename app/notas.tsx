import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
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
} from "react-native";

import HeroHeader from "@/components/HeroHeader";
import { apiRoutes } from "@/constants/api";

export const options = {
  headerShown: false,
};

type NoteType = "normal" | "manzana";

type Note = {
  id: string;
  title: string;
  content: string;
  type: NoteType;
  isManzana: boolean;
  createdAt: string | null;
  updatedAt: string | null;
};

type NoteFormState = {
  title: string;
  content: string;
  type: NoteType;
};

const HEADER_IMAGE = require("../assets/images/notas.png");

const INITIAL_FORM: NoteFormState = {
  title: "",
  content: "",
  type: "normal",
};

const TYPE_OPTIONS: { value: NoteType; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: "normal", label: "Nota normal", icon: "document-text-outline" },
  { value: "manzana", label: "Nota manzana", icon: "logo-apple" },
];

const sortNotes = (items: Note[]): Note[] => {
  return [...items].sort((a, b) => {
    if (a.isManzana !== b.isManzana) {
      return a.isManzana ? -1 : 1;
    }
    const updatedA = (a.updatedAt || a.createdAt || "").toString();
    const updatedB = (b.updatedAt || b.createdAt || "").toString();
    if (updatedA !== updatedB) {
      return updatedB.localeCompare(updatedA);
    }
    return a.title.localeCompare(b.title);
  });
};

const toIsoFromFirestore = (value: any): string | null => {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value === "object" && typeof value.toDate === "function") {
    try {
      return value.toDate().toISOString();
    } catch (error) {
      return null;
    }
  }
  if (value && typeof value === "object" && typeof value.seconds === "number") {
    try {
      return new Date(value.seconds * 1000).toISOString();
    } catch (error) {
      return null;
    }
  }
  return null;
};

const normalizeNote = (raw: any): Note | null => {
  if (!raw || typeof raw !== "object") return null;
  const id = typeof raw.id === "string" ? raw.id : "";
  if (!id) return null;
  const type = raw.type === "manzana" ? "manzana" : "normal";
  const isManzana = typeof raw.isManzana === "boolean" ? raw.isManzana : type === "manzana";
  return {
    id,
    title: typeof raw.title === "string" ? raw.title : "",
    content: typeof raw.content === "string" ? raw.content : "",
    type: isManzana ? "manzana" : type,
    isManzana,
    createdAt: toIsoFromFirestore(raw.createdAt),
    updatedAt: toIsoFromFirestore(raw.updatedAt),
  };
};

const formatTimestamp = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  try {
    return date.toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" });
  } catch (error) {
    return date.toISOString();
  }
};

export default function NotesScreen() {
  const router = useRouter();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [form, setForm] = useState<NoteFormState>(INITIAL_FORM);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const stats = useMemo(() => {
    const total = notes.length;
    const manzana = notes.filter(note => note.isManzana).length;
    return {
      total,
      manzana,
      normal: total - manzana,
    };
  }, [notes]);

  const fetchNotes = useCallback(async (options: { silent?: boolean } = {}) => {
    if (!options.silent) {
      setLoading(true);
    }
    setError(null);
    try {
      const response = await fetch(apiRoutes.notes());
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = payload && typeof payload.message === "string" ? payload.message : "No se pudieron obtener las notas";
        throw new Error(message);
      }
      const rawList: unknown[] = Array.isArray(payload?.data) ? payload.data : [];
      const normalized = rawList
        .map(normalizeNote)
        .filter((note): note is Note => !!note);
      setNotes(sortNotes(normalized));
    } catch (err) {
      console.error("[NOTES] fetch error", err);
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchNotes();
    }, [fetchNotes])
  );

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchNotes({ silent: true });
  }, [fetchNotes]);

  const openModal = useCallback((note?: Note) => {
    if (note) {
      setEditingNote(note);
      setForm({ title: note.title, content: note.content, type: note.type });
    } else {
      setEditingNote(null);
      setForm(INITIAL_FORM);
    }
    setModalVisible(true);
  }, []);

  const closeModal = useCallback(() => {
    setModalVisible(false);
    setSubmitting(false);
    setEditingNote(null);
    setForm(INITIAL_FORM);
  }, []);

  const handleSubmit = useCallback(async () => {
    const trimmedTitle = form.title.trim();
    if (!trimmedTitle) {
      Alert.alert("Completa el tÃ­tulo", "Necesitas darle un nombre a la nota.");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        title: trimmedTitle,
        content: form.content,
        type: form.type,
      };
      const isEditing = !!editingNote;
      const url = isEditing ? apiRoutes.note(editingNote!.id) : apiRoutes.notes();
      const method = isEditing ? "PUT" : "POST";
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = result && typeof result.message === "string" ? result.message : "No se pudo guardar la nota";
        throw new Error(message);
      }
      const normalized = normalizeNote(result?.data);
      if (normalized) {
        setNotes(prev => {
          if (isEditing) {
            return sortNotes(prev.map(note => (note.id === normalized.id ? normalized : note)));
          }
          return sortNotes([...prev, normalized]);
        });
      } else {
        fetchNotes({ silent: true });
      }
      closeModal();
    } catch (err) {
      console.error("[NOTES] save error", err);
      Alert.alert("Ups", err instanceof Error ? err.message : "No se pudo guardar la nota");
    } finally {
      setSubmitting(false);
    }
  }, [form, editingNote, closeModal, fetchNotes]);

  const confirmDelete = useCallback((note: Note) => {
    Alert.alert(
      "Eliminar nota",
      "¿Seguro que quieres eliminar \"" + note.title + "\"?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            try {
              const response = await fetch(apiRoutes.note(note.id), { method: "DELETE" });
              const payload = await response.json().catch(() => ({}));
              if (!response.ok) {
                const message = payload && typeof payload.message === "string" ? payload.message : "No se pudo eliminar la nota";
                throw new Error(message);
              }
              setNotes(prev => prev.filter(item => item.id !== note.id));
            } catch (err) {
              console.error("[NOTES] delete error", err);
              Alert.alert("Ups", err instanceof Error ? err.message : "No se pudo eliminar la nota");
            }
          },
        },
      ]
    );
  }, []);

  const renderNote = useCallback(
    ({ item }: { item: Note }) => (
      <TouchableOpacity
        style={[styles.noteCard, item.isManzana ? styles.noteCardManzana : null]}
        onPress={() => openModal(item)}
        activeOpacity={0.9}
      >
        <View style={styles.noteCardHeader}>
          <View style={styles.noteTitleRow}>
            {item.isManzana ? (
              <View style={styles.badgeManzana}>
                <Text style={styles.badgeManzanaText}>ðŸŽ Nota manzana</Text>
              </View>
            ) : null}
            <Text style={styles.noteTitle} numberOfLines={1} ellipsizeMode="tail">{item.title}</Text>
          </View>
          <TouchableOpacity style={styles.deleteButton} onPress={() => confirmDelete(item)}>
            <Ionicons name="trash-outline" size={18} color="#DC2626" />
          </TouchableOpacity>
        </View>
        {item.content ? (
          <Text style={styles.noteContent} numberOfLines={2} ellipsizeMode="tail">{item.content}</Text>
        ) : (
          <Text style={styles.noteContentEmpty}>Sin contenido</Text>
        )}
        <View style={styles.noteFooter}>
          <Ionicons name="time-outline" size={14} color="#6B7280" style={styles.timeIcon} />
          <Text style={styles.noteTimestamp}>{formatTimestamp(item.updatedAt || item.createdAt)}</Text>
        </View>
      </TouchableOpacity>
    ),
    [confirmDelete, openModal]
  );

  const headerComponent = useMemo(() => (
    <View>
      <HeroHeader title="Notas" image={HEADER_IMAGE} onBack={() => router.back()} />

      <View style={styles.statsRow}>
        <View style={[styles.statCard, styles.statCardPrimary]}>
          <Text style={styles.statLabel}>Totales</Text>
          <Text style={styles.statValue}>{stats.total}</Text>
        </View>
        <View style={[styles.statCard, styles.statCardSecondary]}>
          <Text style={styles.statLabel}>Manzana</Text>
          <Text style={styles.statValue}>{stats.manzana}</Text>
        </View>
        <View style={[styles.statCard, styles.statCardAccent]}>
          <Text style={styles.statLabel}>Normales</Text>
          <Text style={styles.statValue}>{stats.normal}</Text>
        </View>
      </View>

      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => fetchNotes({ silent: true })}>
            <Text style={styles.retryText}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <TouchableOpacity style={styles.newNoteButton} onPress={() => openModal()}>
        <Ionicons name="add" size={20} color="#FFFFFF" />
        <Text style={styles.newNoteButtonText}>Nueva nota</Text>
      </TouchableOpacity>
    </View>
  ), [router, stats, error, fetchNotes, openModal]);

  const emptyComponent = useMemo(() => (
    <View style={styles.emptyState}>
      <Ionicons name="document-text-outline" size={48} color="#CBD5F5" />
      <Text style={styles.emptyTitle}>Sin notas todavÃ­a</Text>
      <Text style={styles.emptySubtitle}>Crea tu primera nota para comenzar a organizar tus ideas.</Text>
    </View>
  ), []);

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <StatusBar barStyle="dark-content" />
        <ActivityIndicator size="large" color="#6366F1" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <FlatList
        data={notes}
        keyExtractor={item => item.id}
        renderItem={renderNote}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={headerComponent}
        ListEmptyComponent={!loading ? emptyComponent : null}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      />

      <TouchableOpacity style={styles.fab} onPress={() => openModal()}>
        <Ionicons name="add" size={28} color="#FFFFFF" />
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={closeModal}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{editingNote ? "Editar nota" : "Nueva nota"}</Text>

            <TextInput
              value={form.title}
              onChangeText={text => setForm(current => ({ ...current, title: text }))}
              style={[styles.input, styles.titleInput]}
              placeholder="Escribe el titulo"
              placeholderTextColor="#94A3B8"
            />

            <TextInput
              value={form.content}
              onChangeText={text => setForm(current => ({ ...current, content: text }))}
              style={[styles.input, styles.textArea, styles.contentInput]}
              placeholder="Escribe tu nota"
              placeholderTextColor="#94A3B8"
              multiline
            />

            <View style={styles.typeOptions}>
              {TYPE_OPTIONS.map(option => {
                const selected = form.type === option.value;
                return (
                  <TouchableOpacity
                    key={option.value}
                    style={[styles.typeOptionIcon, selected ? styles.typeOptionIconSelected : null]}
                    onPress={() => setForm(current => ({ ...current, type: option.value }))}
                    accessibilityRole="button"
                    accessibilityLabel={option.label}
                  >
                    <Ionicons
                      name={option.icon}
                      size={selected ? 22 : 20}
                      color={selected ? "#3730A3" : "#64748B"}
                    />
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelButton} onPress={closeModal} disabled={submitting}>
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveButton, submitting ? styles.saveButtonDisabled : null]}
                onPress={handleSubmit}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveButtonText}>{editingNote ? "Guardar cambios" : "Crear nota"}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8FAFC",
  },
  listContent: {
    paddingBottom: 120,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginHorizontal: 20,
    marginTop: 20,
    gap: 12,
  },
  statCard: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 12,
  },
  statCardPrimary: {
    backgroundColor: "#EEF2FF",
  },
  statCardSecondary: {
    backgroundColor: "#FEE2E2",
  },
  statCardAccent: {
    backgroundColor: "#DCFCE7",
  },
  statLabel: {
    fontSize: 12,
    color: "#475569",
    marginBottom: 4,
  },
  statValue: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#0F172A",
  },
  errorBanner: {
    marginHorizontal: 20,
    marginTop: 20,
    padding: 16,
    borderRadius: 16,
    backgroundColor: "#FEE2E2",
    borderWidth: 1,
    borderColor: "#FCA5A5",
  },
  errorText: {
    color: "#B91C1C",
    fontWeight: "600",
    marginBottom: 8,
  },
  retryText: {
    color: "#B91C1C",
    fontWeight: "600",
  },
  newNoteButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 16,
    paddingVertical: 14,
    backgroundColor: "#6366F1",
    gap: 8,
  },
  newNoteButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  noteCard: {
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    paddingVertical: 18,
    paddingHorizontal: 20,
    shadowColor: "#0F172A",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  noteCardManzana: {
    backgroundColor: "#FEF3C7",
    borderWidth: 1,
    borderColor: "#F59E0B",
  },
  noteCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  noteTitleRow: {
    flex: 1,
    paddingRight: 12,
  },
  badgeManzana: {
    alignSelf: "flex-start",
    backgroundColor: "#FBBF24",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 6,
  },
  badgeManzanaText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#78350F",
  },
  noteTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0F172A",
  },
  deleteButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  noteContent: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 22,
    color: "#1F2937",
  },
  noteContentEmpty: {
    marginTop: 8,
    fontSize: 14,
    color: "#94A3B8",
    fontStyle: "italic",
  },
  noteFooter: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  timeIcon: {
    marginRight: 6,
  },
  noteTimestamp: {
    fontSize: 12,
    color: "#64748B",
  },
  emptyState: {
    alignItems: "center",
    marginTop: 80,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1E293B",
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: "center",
    color: "#64748B",
    marginTop: 6,
  },
  fab: {
    position: "absolute",
    right: 24,
    bottom: 40,
    backgroundColor: "#6366F1",
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#4C1D95",
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.6)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 28,
    maxHeight: "95%",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: "#CBD5F5",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: "#1E293B",
    backgroundColor: "#F8FAFC",
  },
  titleInput: {
    marginTop: 8,
    marginBottom: 16,
  },
  textArea: {
    textAlignVertical: "top",
  },
  contentInput: {
    minHeight: 320,
    maxHeight: 480,
    paddingVertical: 18,
    flexGrow: 1,
    flexShrink: 1,
    marginBottom: 24,
  },
  typeOptions: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  typeOptionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#CBD5F5",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  typeOptionIconSelected: {
    borderColor: "#6366F1",
    backgroundColor: "#EEF2FF",
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 24,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#CBD5F5",
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1E293B",
  },
  saveButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#6366F1",
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});




