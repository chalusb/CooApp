import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { ColorValue } from 'react-native';

import { apiRoutes } from '@/constants/api';

import {
  Dimensions,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const { width } = Dimensions.get('window');

interface DashboardOption {
  id: string;
  title: string;
  icon: string;
  color: readonly [ColorValue, ColorValue];
  description: string;
}

const dashboardOptions: DashboardOption[] = [
  {
    id: 'pendientes',
    title: 'Pendientes',
    icon: 'checkmark-circle-outline',
    color: ['#3B82F6', '#2563EB'],
    description: 'Tareas y recordatorios'
  },
  {
    id: 'lista-super',
    title: 'Lista de Super',
    icon: 'basket-outline',
    color: ['#10B981', '#059669'],
    description: 'Gestiona tu lista de compras'
  },
  {
    id: 'calendario',
    title: 'Calendario',
    icon: 'calendar-outline',
    color: ['#8B5CF6', '#7C3AED'],
    description: 'Agenda y eventos'
  },
  {
    id: 'notas',
    title: 'Notas',
    icon: 'document-text-outline',
    color: ['#F59E0B', '#D97706'],
    description: 'Ideas y apuntes r�pidos'
  },
];

export default function HomeScreen() {
  const router = useRouter();
  
  const [todayEventsCount, setTodayEventsCount] = useState<number | null>(null);
  const [eventsLoading, setEventsLoading] = useState(false);

  const todayId = useMemo(() => {
    const now = new Date();
    return now.toISOString().slice(0, 10);
  }, []);

  const fetchTodayEvents = useCallback(async () => {
    const url = apiRoutes.calendar(`?startDate=${todayId}&endDate=${todayId}`);
    const response = await fetch(url);
    const json = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(json?.message || 'No se pudo obtener los eventos de hoy');
    }
    const items = Array.isArray(json?.data) ? json.data : [];
    return items.length;
  }, [todayId]);

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;
      setEventsLoading(true);

      fetchTodayEvents()
        .then(count => {
          if (isMounted) {
            setTodayEventsCount(count);
          }
        })
        .catch(error => {
          console.error('[HOME] fetch today events error', error);
          if (isMounted) {
            setTodayEventsCount(0);
          }
        })
        .finally(() => {
          if (isMounted) {
            setEventsLoading(false);
          }
        });

      return () => {
        isMounted = false;
      };
    }, [fetchTodayEvents])
  );

  const handleTodayEventsPress = useCallback(() => {
    router.push({ pathname: '/calendario', params: { date: todayId } });
  }, [router, todayId]);

  const handleOptionPress = (optionId: string) => {
    console.log(`Pressed: ${optionId}`);
    if (optionId === 'pendientes') {
      router.push('/pendientes');
      return;
    }
    if (optionId === 'lista-super') {
      router.push('/lista-super');
      return;
    }
    if (optionId === 'calendario') {
      router.push('/calendario');
      return;
    }
    if (optionId === 'notas') {
      router.push('/notas');
      return;
    }
    // Aquí después agregarás navegación a cada pantalla
  };

  const renderDashboardCard = (option: DashboardOption, index: number) => (
    <TouchableOpacity
      key={option.id}
      style={[
        styles.dashboardCard,
        { marginRight: (index + 1) % 2 === 0 ? 0 : 12 }
      ]}
      onPress={() => handleOptionPress(option.id)}
      activeOpacity={0.7}
    >
      <LinearGradient
        colors={option.color}
        style={styles.cardGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.cardContent}>
          <View style={styles.iconContainer}>
            <Ionicons 
              name={option.icon as any} 
              size={32} 
              color="white" 
            />
          </View>
          <Text style={styles.cardTitle}>{option.title}</Text>
          <Text style={styles.cardDescription}>{option.description}</Text>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>¡Hola! V-1.1</Text>
            <Text style={styles.welcomeText}>Bienvenido a tu Dashboard Dina</Text>
          </View>
          <View style={styles.profileContainer}>
            <LinearGradient
              colors={['#6366F1', '#8B5CF6']}
              style={styles.profileAvatar}
            >
              <Ionicons name="person" size={24} color="white" />
            </LinearGradient>
          </View>
        </View>

        {/* Dashboard Cards */}
        <View style={styles.cardsSection}>
          <Text style={styles.sectionTitle}>¿Que quieres hacer hoy?</Text>
          
          <View style={styles.cardsGrid}>
            {dashboardOptions.map((option, index) => 
              renderDashboardCard(option, index)
            )}
          </View>
        </View>

        {/* Quick Stats */}
        <View style={styles.statsSection}>
          <Text style={styles.sectionTitle}>Resumen de hoy</Text>
          <View style={styles.statsContainer}>
            <View style={styles.statCard}>
              <Ionicons name="checkmark-done" size={20} color="#10B981" />
              <Text style={styles.statNumber}>5</Text>
              <Text style={styles.statLabel}>Completadas</Text>
            </View>
            <View style={styles.statCard}>
              <Ionicons name="time-outline" size={20} color="#F59E0B" />
              <Text style={styles.statNumber}>3</Text>
              <Text style={styles.statLabel}>Pendientes</Text>
            </View>
            <TouchableOpacity
              style={styles.statCard}
              onPress={handleTodayEventsPress}
              activeOpacity={0.8}
            >
              <Ionicons name="calendar" size={20} color="#8B5CF6" />
              <Text style={styles.statNumber}>{eventsLoading ? '...' : (todayEventsCount ?? 0)}</Text>
              <Text style={styles.statLabel}>Eventos</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100, // Espacio para las tabs
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 32,
    paddingTop: 10,
  },
  greeting: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  welcomeText: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 4,
  },
  profileContainer: {
    alignItems: 'center',
  },
  profileAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  cardsSection: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 16,
  },
  cardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  dashboardCard: {
    width: (width - 52) / 2, // 52 = padding lateral + gap
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
  statsSection: {
    marginBottom: 20,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
});











