import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '@/constants/theme';

const DOCS = [
  {
    id: 'id_front',
    title: 'بطاقة الهوية (أمامي وخلفي)',
    description: 'صورة واضحة لوجهتي بطاقة الهوية الشخصية',
    image: require('@/assets/images/id-card.png'),
    required: true,
  },
  {
    id: 'vehicle_views',
    title: 'صور المركبة (4 اتجاهات)',
    description: 'صور المركبة من الأمام والخلف واليمين واليسار',
    image: require('@/assets/images/tuktuk-views.png'),
    required: true,
  },
  {
    id: 'face_verify',
    title: 'التحقق من الهوية',
    description: 'صورة سيلفي مع بطاقة الهوية للتحقق أنك شخص حقيقي',
    image: require('@/assets/images/face-verify.png'),
    required: true,
  },
  {
    id: 'vehicle_photo',
    title: 'صورة المركبة الرئيسية',
    description: 'صورة واضحة للمركبة من الجانب',
    image: require('@/assets/images/vehicle-photo.png'),
    required: true,
  },
  {
    id: 'chassis',
    title: 'صورة الشاسيه',
    description: 'صورة واضحة لرقم الشاسيه على هيكل المركبة',
    image: require('@/assets/images/chassis-plate.png'),
    required: true,
  },
];

export default function DriverRegistrationDocsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [uploadedDocs, setUploadedDocs] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<string | null>(null);

  const handleUpload = (id: string) => {
    setUploadedDocs(prev => new Set([...prev, id]));
    setSelected(null);
  };

  const allUploaded = DOCS.every(d => uploadedDocs.has(d.id));

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="light" />

      <LinearGradient colors={[Colors.bgDark, Colors.bgNavy]} style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <MaterialIcons name="arrow-forward" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>وثائق تسجيل السائق</Text>
          <View style={{ width: 36 }} />
        </View>
        <View style={styles.progressRow}>
          <View style={[styles.progressFill, { width: `${(uploadedDocs.size / DOCS.length) * 100}%` }]} />
          <View style={styles.progressTrack} />
        </View>
        <Text style={styles.progressText}>{uploadedDocs.size} من {DOCS.length} وثائق مرفوعة</Text>
      </LinearGradient>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {DOCS.map(doc => {
          const uploaded = uploadedDocs.has(doc.id);
          const isSelected = selected === doc.id;

          return (
            <TouchableOpacity
              key={doc.id}
              style={[styles.docCard, uploaded && styles.docCardUploaded, isSelected && styles.docCardSelected]}
              onPress={() => setSelected(isSelected ? null : doc.id)}
              activeOpacity={0.9}
            >
              <View style={styles.docPreview}>
                <Image
                  source={doc.image}
                  style={styles.docImage}
                  contentFit="cover"
                  transition={200}
                />
                {uploaded && (
                  <View style={styles.uploadedOverlay}>
                    <MaterialIcons name="check-circle" size={32} color="#fff" />
                  </View>
                )}
              </View>

              <View style={styles.docBody}>
                <View style={styles.docTitleRow}>
                  {doc.required && (
                    <View style={styles.requiredBadge}>
                      <Text style={styles.requiredText}>مطلوب</Text>
                    </View>
                  )}
                  <Text style={[styles.docTitle, uploaded && styles.docTitleUploaded]}>{doc.title}</Text>
                </View>
                <Text style={styles.docDesc}>{doc.description}</Text>

                {isSelected && !uploaded && (
                  <View style={styles.uploadOptions}>
                    <TouchableOpacity style={styles.uploadBtn} onPress={() => handleUpload(doc.id)} activeOpacity={0.85}>
                      <MaterialIcons name="camera-alt" size={18} color={Colors.primary} />
                      <Text style={styles.uploadBtnText}>التقاط صورة</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.uploadBtn} onPress={() => handleUpload(doc.id)} activeOpacity={0.85}>
                      <MaterialIcons name="photo-library" size={18} color={Colors.primary} />
                      <Text style={styles.uploadBtnText}>من المعرض</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {uploaded && (
                  <TouchableOpacity style={styles.reuploadBtn} onPress={() => setUploadedDocs(prev => { const n = new Set(prev); n.delete(doc.id); return n; })}>
                    <MaterialIcons name="refresh" size={14} color={Colors.primary} />
                    <Text style={styles.reuploadText}>إعادة الرفع</Text>
                  </TouchableOpacity>
                )}
              </View>

              <View style={[styles.statusIcon, { backgroundColor: uploaded ? Colors.success + '18' : Colors.bgLight }]}>
                <MaterialIcons
                  name={uploaded ? 'check-circle' : 'upload'}
                  size={22}
                  color={uploaded ? Colors.success : Colors.textLight}
                />
              </View>
            </TouchableOpacity>
          );
        })}

        <TouchableOpacity
          style={[styles.submitBtn, !allUploaded && styles.submitBtnDisabled]}
          disabled={!allUploaded}
          onPress={() => router.back()}
          activeOpacity={0.9}
        >
          <MaterialIcons name="send" size={20} color="#fff" />
          <Text style={styles.submitBtnText}>إرسال للمراجعة</Text>
        </TouchableOpacity>

        {!allUploaded && (
          <Text style={styles.submitNote}>يرجى رفع جميع الوثائق المطلوبة أولاً</Text>
        )}

        <View style={{ height: insets.bottom + 20 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgLight },
  header: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.lg },
  headerRow: {
    flexDirection: 'row-reverse', alignItems: 'center',
    justifyContent: 'space-between', paddingVertical: Spacing.md,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { color: '#fff', fontSize: Typography.xl, fontWeight: '700' },
  progressRow: { position: 'relative', height: 6, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 3, marginBottom: 6 },
  progressTrack: { ...StyleSheet.absoluteFillObject, borderRadius: 3 },
  progressFill: { height: 6, backgroundColor: Colors.accent, borderRadius: 3, position: 'absolute', left: 0, top: 0 },
  progressText: { color: 'rgba(255,255,255,0.7)', fontSize: Typography.xs, textAlign: 'right' },
  scroll: { padding: Spacing.md },
  docCard: {
    backgroundColor: Colors.bgWhite, borderRadius: BorderRadius.xl,
    flexDirection: 'row-reverse', marginBottom: Spacing.sm,
    borderWidth: 1.5, borderColor: Colors.borderLight,
    overflow: 'hidden', ...Shadows.sm,
  },
  docCardUploaded: { borderColor: Colors.success + '50' },
  docCardSelected: { borderColor: Colors.primary },
  docPreview: { width: 90, height: 90, position: 'relative' },
  docImage: { width: 90, height: 90 },
  uploadedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.success + 'AA',
    alignItems: 'center', justifyContent: 'center',
  },
  docBody: { flex: 1, padding: Spacing.sm },
  docTitleRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6, marginBottom: 4 },
  docTitle: { fontSize: Typography.sm, fontWeight: '700', color: Colors.textPrimary, flex: 1, textAlign: 'right' },
  docTitleUploaded: { color: Colors.success },
  docDesc: { fontSize: Typography.xs, color: Colors.textSecondary, textAlign: 'right', lineHeight: 18 },
  requiredBadge: {
    backgroundColor: Colors.error + '18', borderRadius: 6,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  requiredText: { fontSize: 10, color: Colors.error, fontWeight: '700' },
  uploadOptions: { flexDirection: 'row-reverse', gap: 8, marginTop: 8 },
  uploadBtn: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: 4,
    backgroundColor: Colors.primaryLight, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 6,
  },
  uploadBtnText: { fontSize: 11, color: Colors.primary, fontWeight: '600' },
  reuploadBtn: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4, marginTop: 6 },
  reuploadText: { fontSize: Typography.xs, color: Colors.primary, fontWeight: '500' },
  statusIcon: { width: 50, alignItems: 'center', justifyContent: 'center' },
  submitBtn: {
    backgroundColor: Colors.primary, borderRadius: BorderRadius.md,
    paddingVertical: 16, flexDirection: 'row-reverse', alignItems: 'center',
    justifyContent: 'center', gap: 8, marginTop: Spacing.sm, ...Shadows.md,
  },
  submitBtnDisabled: { backgroundColor: Colors.border, ...Shadows.none },
  submitBtnText: { color: '#fff', fontSize: Typography.base, fontWeight: '700' },
  submitNote: { textAlign: 'center', color: Colors.textLight, fontSize: Typography.xs, marginTop: 8 },
});
