import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Image, ImageSourcePropType, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type HeroHeaderProps = {
  title: string;
  image: ImageSourcePropType;
  onBack?: () => void;
  height?: number;
};

export default function HeroHeader({ title, image, onBack, height = 140 }: HeroHeaderProps) {
  return (
    <View style={styles.wrapper}>
      <View style={[styles.card, { height }]}>
        <Image source={image} resizeMode="cover" style={styles.image} />
        <LinearGradient
          colors={['rgba(15,23,42,0.05)', 'rgba(15,23,42,0.7)']}
          style={styles.gradient}
        />
        <View style={styles.content}>
          {onBack ? (
            <TouchableOpacity onPress={onBack} style={styles.backButton}>
              <Ionicons name="chevron-back" size={22} color="#F8FAFC" />
            </TouchableOpacity>
          ) : null}
          <Text numberOfLines={2} style={styles.title}>{title}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: 0,
    paddingTop: 8,
  },
  card: {
    borderRadius: 0,
    overflow: 'hidden',
    backgroundColor: '#111827',
  },
  image: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  gradient: {
    ...StyleSheet.absoluteFillObject,
  },
  content: {
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
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15,23,42,0.6)',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#F8FAFC',
  },
});
