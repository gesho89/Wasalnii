import React, { useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Dimensions, FlatList, Animated,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '@/constants/theme';

const { width, height } = Dimensions.get('window');

const SLIDES = [
  {
    id: '1',
    image: require('@/assets/images/onboarding-1.png'),
    title: 'تنقّل بأمان',
    subtitle: 'ركّابنا في أمان تام',
    description: 'نوفّر لك رحلات آمنة وموثوقة في كل وقت، مع سائقين معتمدين ومُدرَّبين على أعلى مستوى.',
    icon: 'shield',
    color: '#10B981',
  },
  {
    id: '2',
    image: require('@/assets/images/onboarding-2.png'),
    title: 'وصول فائق السرعة',
    subtitle: 'نصلك في لحظات',
    description: 'سائقونا دائمًا قريبون منك. اطلب رحلتك واستمتع بأسرع وقت وصول في المدينة.',
    icon: 'flash-on',
    color: Colors.primary,
  },
  {
    id: '3',
    image: require('@/assets/images/onboarding-3.png'),
    title: 'خدمة بأمانة',
    subtitle: 'ثِق بخدمتنا دائماً',
    description: 'الأمانة أساس خدمتنا. نضمن لك تجربة شفافة بأسعار عادلة وسائقين صادقين في كل رحلة.',
    icon: 'verified',
    color: Colors.accent,
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const scrollX = useRef(new Animated.Value(0)).current;

  const handleNext = () => {
    if (currentIndex < SLIDES.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1, animated: true });
    } else {
      AsyncStorage.setItem('onboarding_done', 'true');
      router.replace('/');
    }
  };

  const handleSkip = () => {
    AsyncStorage.setItem('onboarding_done', 'true');
    router.replace('/');
  };

  const renderSlide = ({ item }: { item: typeof SLIDES[0] }) => (
    <View style={styles.slide}>
      {/* Full background image */}
      <Image
        source={item.image}
        style={styles.slideImage}
        contentFit="cover"
        transition={400}
      />
      {/* Dark gradient overlay */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.6)', 'rgba(0,0,0,0.95)']}
        style={styles.gradient}
      />
    </View>
  );

  const currentSlide = SLIDES[currentIndex];

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Slides */}
      <Animated.FlatList
        ref={flatListRef}
        data={SLIDES}
        renderItem={renderSlide}
        keyExtractor={item => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false }
        )}
        onMomentumScrollEnd={e => {
          const index = Math.round(e.nativeEvent.contentOffset.x / width);
          setCurrentIndex(index);
        }}
        style={styles.flatList}
      />

      {/* Content Overlay */}
      <View style={[styles.contentOverlay, { paddingBottom: insets.bottom + Spacing.lg }]}>

        {/* Skip button */}
        <View style={[styles.topBar, { paddingTop: insets.top + Spacing.sm }]}>
          {currentIndex < SLIDES.length - 1 ? (
            <TouchableOpacity onPress={handleSkip} style={styles.skipBtn}>
              <Text style={styles.skipText}>تخطي</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ width: 70 }} />
          )}
          {/* Logo + App Name */}
          <View style={styles.topBrand}>
            <Image
              source={require('@/assets/images/logo.png')}
              style={styles.topLogo}
              contentFit="contain"
              transition={200}
            />
            <View>
              <Text style={styles.topBrandAr}>تـك توكي</Text>
              <Text style={styles.topBrandEn}>Tuk Tuky</Text>
            </View>
          </View>
        </View>

        {/* Spacer */}
        <View style={{ flex: 1 }} />

        {/* Slide Content */}
        <View style={styles.textContent}>
          {/* Icon badge */}
          <View style={[styles.iconBadge, { backgroundColor: currentSlide.color + '25', borderColor: currentSlide.color + '50' }]}>
            <MaterialIcons name={currentSlide.icon as any} size={28} color={currentSlide.color} />
          </View>

          <View style={styles.slideIndexRow}>
            {SLIDES.map((_, i) => (
              <View key={i} style={[styles.slideIndexDot, i === currentIndex && styles.slideIndexDotActive]} />
            ))}
          </View>

          <Text style={styles.subtitle}>{currentSlide.subtitle}</Text>
          <Text style={styles.title}>{currentSlide.title}</Text>
          <Text style={styles.description}>{currentSlide.description}</Text>
        </View>

        {/* Dots */}
        <View style={styles.dotsRow}>
          {SLIDES.map((_, i) => {
            const dotWidth = scrollX.interpolate({
              inputRange: [(i - 1) * width, i * width, (i + 1) * width],
              outputRange: [8, 28, 8],
              extrapolate: 'clamp',
            });
            const dotOpacity = scrollX.interpolate({
              inputRange: [(i - 1) * width, i * width, (i + 1) * width],
              outputRange: [0.35, 1, 0.35],
              extrapolate: 'clamp',
            });
            return (
              <Animated.View
                key={i}
                style={[
                  styles.dot,
                  {
                    width: dotWidth,
                    opacity: dotOpacity,
                    backgroundColor: i === currentIndex ? Colors.accent : 'rgba(255,255,255,0.5)',
                  },
                ]}
              />
            );
          })}
        </View>

        {/* Next / Start Button */}
        <TouchableOpacity style={styles.nextBtn} onPress={handleNext} activeOpacity={0.88}>
          <LinearGradient
            colors={['#FFD050', '#E8A020', '#C47D0A']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.nextBtnGradient}
          >
            {currentIndex === SLIDES.length - 1 ? (
              <>
                <MaterialIcons name="login" size={22} color={Colors.bgDark} />
                <Text style={styles.nextBtnText}>ابدأ الآن</Text>
              </>
            ) : (
              <>
                <MaterialIcons name="arrow-back" size={22} color={Colors.bgDark} />
                <Text style={styles.nextBtnText}>التالي</Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgDark },
  flatList: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  slide: { width, height, position: 'relative' },
  slideImage: { width: '100%', height: '100%' },
  gradient: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    height: height * 0.65,
  },
  contentOverlay: {
    flex: 1, justifyContent: 'flex-end', alignItems: 'center',
    paddingHorizontal: Spacing.lg,
  },
  topBar: {
    position: 'absolute', top: 0, left: Spacing.lg, right: Spacing.lg,
    flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between',
  },
  topLogo: { width: 52, height: 52, borderRadius: 14, borderWidth: 1.5, borderColor: Colors.accent + '50' },
  skipBtn: {
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: BorderRadius.full, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  skipText: { color: 'rgba(255,255,255,0.8)', fontSize: Typography.sm, fontFamily: 'Tajawal_700Bold' },
  textContent: { width: '100%', alignItems: 'center', marginBottom: Spacing.xl },
  iconBadge: {
    width: 64, height: 64, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, marginBottom: Spacing.md,
  },
  topBrand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  topBrandAr: { fontFamily: 'Tajawal_800ExtraBold', fontSize: 16, color: '#fff', lineHeight: 20 },
  topBrandEn: { fontFamily: 'Tajawal_400Regular', fontSize: 11, color: Colors.accent, letterSpacing: 2, textTransform: 'uppercase' },
  slideIndexRow: { flexDirection: 'row', gap: 5, marginBottom: Spacing.sm },
  slideIndexDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.25)' },
  slideIndexDotActive: { backgroundColor: Colors.accent, width: 18, borderRadius: 3 },
  subtitle: {
    color: Colors.accent,
    fontSize: Typography.sm,
    fontFamily: 'Tajawal_700Bold',
    letterSpacing: 1.5,
    textAlign: 'center',
    marginBottom: Spacing.xs,
    textTransform: 'uppercase',
  },
  title: {
    color: '#FFFFFF',
    fontSize: Typography.xxxl,
    fontFamily: 'Tajawal_800ExtraBold',
    textAlign: 'center',
    marginBottom: Spacing.sm,
    lineHeight: 40,
  },
  description: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: Typography.base,
    fontFamily: 'Tajawal_400Regular',
    textAlign: 'center',
    lineHeight: 28,
    paddingHorizontal: Spacing.sm,
  },
  dotsRow: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: 6,
    marginBottom: Spacing.lg,
  },
  dot: { height: 8, borderRadius: 4 },
  nextBtn: { width: '100%', borderRadius: BorderRadius.lg, overflow: 'hidden', ...Shadows.lg },
  nextBtnGradient: {
    flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center',
    gap: 10, paddingVertical: 17,
  },
  nextBtnText: {
    fontSize: Typography.lg,
    fontFamily: 'Tajawal_800ExtraBold',
    color: Colors.bgDark,
  },
});
