import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '@/constants/theme';
import { MOCK_TRIPS } from '@/services/mockData';
import { useAlert } from '@/template';

export default function ComplaintsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { showAlert } = useAlert();
  const [selectedTrip] = useState(MOCK_TRIPS[0]);
  const [rating, setRating] = useState(0);
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const [complaintText, setComplaintText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'rate' | 'complain'>('rate');

  const handleSubmitRating = async () => {
    if (rating === 0) {
      showAlert('تنبيه', 'من فضلك اختر تقييمك أولاً');
      return;
    }
    setSubmitting(true);
    await new Promise(r => setTimeout(r, 1000));
    setSubmitting(false);
    setRatingSubmitted(true);
    showAlert('شكراً', 'تم إرسال تقييمك بنجاح!');
  };

  const handleSubmitComplaint = async () => {
    if (!complaintText.trim()) {
      showAlert('تنبيه', 'من فضلك اكتب تفاصيل شكواك');
      return;
    }
    setSubmitting(true);
    await new Promise(r => setTimeout(r, 1200));
    setSubmitting(false);
    setComplaintText('');
    showAlert('تم الإرسال', 'تم إرسال شكواك بنجاح، سيتم مراجعتها خلال 24 ساعة');
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <MaterialIcons name="arrow-forward" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>الشكاوى والتقييمات</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabsRow}>
        {[{ key: 'rate', label: 'تقييم الرحلة' }, { key: 'complain', label: 'إرسال شكوى' }].map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key as any)}
          >
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={styles.body} showsVerticalScrollIndicator={false} contentContainerStyle={styles.bodyContent}>
        {/* Trip summary */}
        <View style={styles.tripSummary}>
          <Image source={{ uri: selectedTrip.driver.avatar }} style={styles.driverAvatar} contentFit="cover" transition={200} />
          <View style={styles.tripDetails}>
            <Text style={styles.driverName}>{selectedTrip.driver.name}</Text>
            <Text style={styles.tripDate}>{selectedTrip.date} · {selectedTrip.time}</Text>
            <Text style={styles.tripPrice}>{selectedTrip.price} ج.م</Text>
          </View>
        </View>

        {activeTab === 'rate' ? (
          <View style={styles.ratingSection}>
            <Text style={styles.sectionTitle}>كيف كانت رحلتك؟</Text>
            <Text style={styles.ratingSubtitle}>اختر تقييمك للسائق</Text>

            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map(star => (
                <TouchableOpacity key={star} onPress={() => !ratingSubmitted && setRating(star)} activeOpacity={0.8}>
                  <MaterialIcons
                    name={star <= rating ? 'star' : 'star-border'}
                    size={48}
                    color={star <= rating ? Colors.accent : Colors.border}
                  />
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.ratingLabel}>
              {rating === 0 ? 'لم تقيم بعد' : rating === 5 ? 'ممتاز! 🌟' : rating >= 4 ? 'جيد جداً 👍' : rating >= 3 ? 'مقبول' : rating >= 2 ? 'سيء 👎' : 'سيء جداً'}
            </Text>

            <View style={styles.feedbackCards}>
              {['سرعة في الوصول', 'سائق محترم', 'سيارة نظيفة', 'قيادة ممتازة', 'سعر مناسب'].map(tag => (
                <TouchableOpacity key={tag} style={styles.feedbackTag}>
                  <Text style={styles.feedbackTagText}>{tag}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={styles.feedbackInput}
              placeholder="اكتب تعليقك هنا..."
              placeholderTextColor={Colors.textLight}
              multiline
              numberOfLines={3}
              textAlign="right"
              textAlignVertical="top"
            />

            <TouchableOpacity
              style={[styles.submitBtn, (ratingSubmitted || submitting) && styles.submitBtnDisabled]}
              onPress={handleSubmitRating}
              disabled={ratingSubmitted || submitting}
            >
              {submitting ? <ActivityIndicator color="#fff" /> : (
                <Text style={styles.submitBtnText}>{ratingSubmitted ? 'تم الإرسال ✓' : 'إرسال التقييم'}</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.complaintSection}>
            <Text style={styles.sectionTitle}>إرسال شكوى</Text>

            <Text style={styles.complaintLabel}>نوع المشكلة</Text>
            <View style={styles.complaintTypes}>
              {['سلوك السائق', 'قيادة خطرة', 'تلاعب بالسعر', 'تأخر الوصول', 'أخرى'].map(type => (
                <TouchableOpacity key={type} style={styles.complaintTypeBtn}>
                  <Text style={styles.complaintTypeBtnText}>{type}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.complaintLabel}>تفاصيل الشكوى</Text>
            <TextInput
              style={styles.complaintInput}
              placeholder="اشرح مشكلتك بالتفصيل..."
              placeholderTextColor={Colors.textLight}
              multiline
              numberOfLines={5}
              value={complaintText}
              onChangeText={setComplaintText}
              textAlign="right"
              textAlignVertical="top"
            />

            <TouchableOpacity
              style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
              onPress={handleSubmitComplaint}
              disabled={submitting}
            >
              {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>إرسال الشكوى</Text>}
            </TouchableOpacity>

            <View style={styles.allComplaintsSection}>
              <Text style={styles.sectionTitle}>الشكاوى السابقة</Text>
              {MOCK_TRIPS.slice(0, 2).map(trip => (
                <View key={trip.id} style={styles.complaintHistoryItem}>
                  <View style={[styles.complaintStatus, { backgroundColor: Colors.warning + '18' }]}>
                    <Text style={[styles.complaintStatusText, { color: Colors.warning }]}>قيد المراجعة</Text>
                  </View>
                  <View style={styles.complaintHistoryInfo}>
                    <Text style={styles.complaintHistoryTitle}>شكوى ضد {trip.driver.name}</Text>
                    <Text style={styles.complaintHistoryDate}>{trip.date}</Text>
                  </View>
                  <Image source={{ uri: trip.driver.avatar }} style={styles.complaintAvatar} contentFit="cover" />
                </View>
              ))}
              <TouchableOpacity style={styles.showAllBtn}>
                <Text style={styles.showAllText}>عرض الكل</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgLight },
  header: {
    flexDirection: 'row-reverse', alignItems: 'center',
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.md,
    backgroundColor: Colors.bgWhite, borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  backBtn: { marginLeft: Spacing.sm },
  title: { flex: 1, fontSize: Typography.xl, fontWeight: '700', color: Colors.textPrimary, textAlign: 'right' },
  tabsRow: {
    flexDirection: 'row-reverse', backgroundColor: Colors.bgWhite,
    paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm,
    gap: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  tab: {
    flex: 1, paddingVertical: 10, borderRadius: BorderRadius.md,
    alignItems: 'center', borderWidth: 1, borderColor: Colors.border,
  },
  tabActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  tabText: { fontSize: Typography.sm, color: Colors.textSecondary, fontWeight: '500' },
  tabTextActive: { color: '#fff', fontWeight: '700' },
  body: { flex: 1 },
  bodyContent: { padding: Spacing.md, paddingBottom: 40 },
  tripSummary: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.bgWhite, borderRadius: BorderRadius.lg,
    padding: Spacing.md, marginBottom: Spacing.md, ...Shadows.sm,
    borderWidth: 1, borderColor: Colors.borderLight,
  },
  driverAvatar: { width: 56, height: 56, borderRadius: 28 },
  tripDetails: { flex: 1 },
  driverName: { fontSize: Typography.md, fontWeight: '700', color: Colors.textPrimary, textAlign: 'right' },
  tripDate: { fontSize: Typography.sm, color: Colors.textSecondary, textAlign: 'right', marginTop: 2 },
  tripPrice: { fontSize: Typography.md, fontWeight: '700', color: Colors.primary, textAlign: 'right', marginTop: 2 },
  ratingSection: { backgroundColor: Colors.bgWhite, borderRadius: BorderRadius.xl, padding: Spacing.lg, ...Shadows.sm },
  sectionTitle: { fontSize: Typography.xl, fontWeight: '700', color: Colors.textPrimary, textAlign: 'right', marginBottom: 4 },
  ratingSubtitle: { fontSize: Typography.sm, color: Colors.textSecondary, textAlign: 'right', marginBottom: Spacing.lg },
  starsRow: { flexDirection: 'row-reverse', justifyContent: 'center', gap: 8, marginBottom: Spacing.sm },
  ratingLabel: { fontSize: Typography.lg, fontWeight: '600', color: Colors.textPrimary, textAlign: 'center', marginBottom: Spacing.md },
  feedbackCards: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: Spacing.xs, marginBottom: Spacing.md },
  feedbackTag: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: BorderRadius.full,
    borderWidth: 1, borderColor: Colors.primary + '50', backgroundColor: Colors.primaryLight,
  },
  feedbackTagText: { fontSize: Typography.sm, color: Colors.primary, fontWeight: '500' },
  feedbackInput: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.md,
    padding: Spacing.md, fontSize: Typography.base, color: Colors.textPrimary,
    minHeight: 80, marginBottom: Spacing.lg, backgroundColor: Colors.bgLight,
  },
  submitBtn: {
    backgroundColor: Colors.primary, borderRadius: BorderRadius.md,
    paddingVertical: 15, alignItems: 'center',
  },
  submitBtnDisabled: { backgroundColor: Colors.success },
  submitBtnText: { color: '#fff', fontSize: Typography.md, fontWeight: '700' },
  complaintSection: { gap: Spacing.md },
  complaintLabel: { fontSize: Typography.sm, color: Colors.textSecondary, textAlign: 'right', fontWeight: '600' },
  complaintTypes: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: Spacing.xs },
  complaintTypeBtn: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: BorderRadius.full,
    borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bgWhite,
  },
  complaintTypeBtnText: { fontSize: Typography.sm, color: Colors.textSecondary },
  complaintInput: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.md,
    padding: Spacing.md, fontSize: Typography.base, color: Colors.textPrimary,
    minHeight: 120, backgroundColor: Colors.bgWhite,
  },
  allComplaintsSection: { backgroundColor: Colors.bgWhite, borderRadius: BorderRadius.xl, padding: Spacing.md, ...Shadows.sm },
  complaintHistoryItem: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: Spacing.sm,
    paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  complaintAvatar: { width: 42, height: 42, borderRadius: 21 },
  complaintHistoryInfo: { flex: 1 },
  complaintHistoryTitle: { fontSize: Typography.sm, fontWeight: '600', color: Colors.textPrimary, textAlign: 'right' },
  complaintHistoryDate: { fontSize: Typography.xs, color: Colors.textLight, textAlign: 'right' },
  complaintStatus: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  complaintStatusText: { fontSize: 10, fontWeight: '700' },
  showAllBtn: { paddingVertical: Spacing.sm, alignItems: 'center' },
  showAllText: { color: Colors.primary, fontSize: Typography.sm, fontWeight: '600' },
});
