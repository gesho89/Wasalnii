import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '@/constants/theme';
import { useAlert } from '@/template';

const STEPS = [
  { id: 0, label: 'المعلومات', icon: 'person' },
  { id: 1, label: 'المركبة', icon: 'directions-car' },
  { id: 2, label: 'المستندات', icon: 'description' },
  { id: 3, label: 'التحقق', icon: 'face' },
  { id: 4, label: 'التفعيل', icon: 'verified' },
];

const DOCUMENTS = [
  { id: 'national_id', label: 'الهوية الشخصية', icon: 'credit-card', required: true, hint: 'صورة واضحة لوجهي البطاقة' },
  { id: 'license', label: 'رخصة القيادة', icon: 'drive-eta', required: true, hint: 'رخصة سارية المفعول' },
  { id: 'vehicle_license', label: 'رخصة المركبة', icon: 'article', required: true, hint: 'رخصة المركبة الحالية' },
  { id: 'vehicle_photo', label: 'صورة المركبة', icon: 'directions-car', required: false, hint: 'صورة واضحة من الأمام' },
  { id: 'face_photo', label: 'صورة شخصية', icon: 'account-circle', required: false, hint: 'صورة حديثة واضحة' },
];

export default function DriverRegisterScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { showAlert } = useAlert();
  const [currentStep, setCurrentStep] = useState(0);
  const [uploadedDocs, setUploadedDocs] = useState<Record<string, boolean>>({});
  const [faceVerified, setFaceVerified] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const startPulse = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.08, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    ).start();
  };

  const handleUploadDoc = (docId: string) => {
    setUploadedDocs(prev => ({ ...prev, [docId]: true }));
    showAlert('تم الرفع', 'تم رفع المستند بنجاح ✓');
  };

  const handleNextStep = () => {
    if (currentStep === 2) {
      const required = DOCUMENTS.filter(d => d.required);
      const allUploaded = required.every(d => uploadedDocs[d.id]);
      if (!allUploaded) {
        showAlert('تنبيه', 'من فضلك ارفع جميع المستندات المطلوبة');
        return;
      }
    }
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handleFaceVerify = async () => {
    setVerifying(true);
    startPulse();
    await new Promise(r => setTimeout(r, 2200));
    setVerifying(false);
    setFaceVerified(true);
    pulseAnim.stopAnimation();
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    await new Promise(r => setTimeout(r, 1500));
    setSubmitting(false);
    setCurrentStep(4);
  };

  const uploadedCount = Object.values(uploadedDocs).filter(Boolean).length;
  const totalDocs = DOCUMENTS.length;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="light" />

      {/* ── DARK HEADER ── */}
      <LinearGradient
        colors={['#0D0D0D', '#1A1400', '#0D0D0D']}
        style={styles.header}
      >
        {/* Top Row */}
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <MaterialIcons name="arrow-forward" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Image
              source={require('@/assets/images/logo.png')}
              style={styles.headerLogo}
              contentFit="contain"
              transition={200}
            />
            <View>
              <Text style={styles.headerAppName}>تـك توكي</Text>
              <Text style={styles.headerTitle}>سجل كسائق</Text>
            </View>
          </View>
          <View style={styles.stepCountBadge}>
            <Text style={styles.stepCountText}>{currentStep + 1}/{STEPS.length}</Text>
          </View>
        </View>

        {/* ── Progress Stepper ── */}
        <View style={styles.stepper}>
          {STEPS.map((step, i) => {
            const isActive = i === currentStep;
            const isDone = i < currentStep;
            return (
              <View key={step.id} style={styles.stepItem}>
                <View style={[
                  styles.stepCircle,
                  isActive && styles.stepCircleActive,
                  isDone && styles.stepCircleDone,
                ]}>
                  {isDone ? (
                    <MaterialIcons name="check" size={14} color="#fff" />
                  ) : (
                    <MaterialIcons
                      name={step.icon as any}
                      size={15}
                      color={isActive ? Colors.bgDark : 'rgba(255,255,255,0.45)'}
                    />
                  )}
                </View>
                {i < STEPS.length - 1 && (
                  <View style={[styles.stepLine, isDone && styles.stepLineDone]} />
                )}
              </View>
            );
          })}
        </View>

        {/* Step labels */}
        <View style={styles.stepLabelsRow}>
          {STEPS.map((step, i) => (
            <Text
              key={step.id}
              style={[styles.stepLabel, i === currentStep && styles.stepLabelActive]}
              numberOfLines={1}
            >
              {step.label}
            </Text>
          ))}
        </View>

        {/* Progress Bar */}
        <View style={styles.progressBarTrack}>
          <View
            style={[styles.progressBarFill, { width: `${((currentStep) / (STEPS.length - 1)) * 100}%` }]}
          />
        </View>
      </LinearGradient>

      {/* ── CONTENT ── */}
      <ScrollView
        style={styles.body}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.bodyContent, { paddingBottom: insets.bottom + 40 }]}
      >

        {/* ─── STEP 0: Personal Info (placeholder) ─── */}
        {currentStep === 0 && (
          <View>
            <View style={styles.sectionHeader}>
              <MaterialIcons name="person" size={22} color={Colors.accent} />
              <Text style={styles.sectionTitle}>المعلومات الشخصية</Text>
            </View>
            <Text style={styles.sectionSubtitle}>قم بإدخال بياناتك الشخصية بدقة</Text>

            {[
              { label: 'الاسم الكامل', icon: 'person', placeholder: 'محمد أحمد إبراهيم' },
              { label: 'رقم الهاتف', icon: 'phone', placeholder: '01X XXXX XXXX' },
              { label: 'البريد الإلكتروني', icon: 'email', placeholder: 'example@email.com' },
              { label: 'المدينة', icon: 'location-city', placeholder: 'القاهرة' },
            ].map((field, i) => (
              <View key={i} style={styles.fieldCard}>
                <View style={styles.fieldIconWrap}>
                  <MaterialIcons name={field.icon as any} size={18} color={Colors.accent} />
                </View>
                <View style={styles.fieldBody}>
                  <Text style={styles.fieldLabel}>{field.label}</Text>
                  <Text style={styles.fieldPlaceholder}>{field.placeholder}</Text>
                </View>
                <MaterialIcons name="edit" size={16} color={Colors.textLight} />
              </View>
            ))}

            <TouchableOpacity style={styles.primaryBtn} onPress={handleNextStep} activeOpacity={0.88}>
              <LinearGradient colors={['#FFD050', '#E8A020', '#C47D0A']} style={styles.primaryBtnGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                <MaterialIcons name="arrow-back" size={20} color={Colors.bgDark} />
                <Text style={styles.primaryBtnText}>التالي: بيانات المركبة</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}

        {/* ─── STEP 1: Vehicle Info ─── */}
        {currentStep === 1 && (
          <View>
            <View style={styles.sectionHeader}>
              <MaterialIcons name="directions-car" size={22} color={Colors.accent} />
              <Text style={styles.sectionTitle}>بيانات المركبة</Text>
            </View>
            <Text style={styles.sectionSubtitle}>أدخل معلومات مركبتك بدقة</Text>

            {[
              { label: 'نوع المركبة', icon: 'electric-rickshaw', placeholder: 'توك توك / موتوسيكل' },
              { label: 'موديل المركبة', icon: 'two-wheeler', placeholder: 'بجاج / پيا' },
              { label: 'سنة الصنع', icon: 'calendar-today', placeholder: '2022' },
              { label: 'رقم اللوحة', icon: 'confirmation-number', placeholder: 'ط ط ط 1234' },
            ].map((field, i) => (
              <View key={i} style={styles.fieldCard}>
                <View style={styles.fieldIconWrap}>
                  <MaterialIcons name={field.icon as any} size={18} color={Colors.accent} />
                </View>
                <View style={styles.fieldBody}>
                  <Text style={styles.fieldLabel}>{field.label}</Text>
                  <Text style={styles.fieldPlaceholder}>{field.placeholder}</Text>
                </View>
                <MaterialIcons name="edit" size={16} color={Colors.textLight} />
              </View>
            ))}

            {/* Vehicle Type Chips */}
            <Text style={styles.chipSectionLabel}>اختر نوع المركبة</Text>
            <View style={styles.chipsRow}>
              {['توك توك', 'موتوسيكل', 'ميكروباص', 'سيارة'].map((type, i) => (
                <TouchableOpacity
                  key={i}
                  style={[styles.chip, i === 0 && styles.chipActive]}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.chipText, i === 0 && styles.chipTextActive]}>{type}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.primaryBtn} onPress={handleNextStep} activeOpacity={0.88}>
              <LinearGradient colors={['#FFD050', '#E8A020', '#C47D0A']} style={styles.primaryBtnGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                <MaterialIcons name="arrow-back" size={20} color={Colors.bgDark} />
                <Text style={styles.primaryBtnText}>التالي: المستندات</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}

        {/* ─── STEP 2: Documents ─── */}
        {currentStep === 2 && (
          <View>
            <View style={styles.sectionHeader}>
              <MaterialIcons name="description" size={22} color={Colors.accent} />
              <Text style={styles.sectionTitle}>رفع المستندات</Text>
            </View>
            <Text style={styles.sectionSubtitle}>ارفع المستندات المطلوبة بصور واضحة</Text>

            {/* Upload Progress */}
            <View style={styles.uploadProgressCard}>
              <View style={styles.uploadProgressHeader}>
                <Text style={styles.uploadProgressCount}>{uploadedCount}/{totalDocs} مستندات</Text>
                <Text style={styles.uploadProgressLabel}>تقدم الرفع</Text>
              </View>
              <View style={styles.uploadProgressTrack}>
                <View style={[styles.uploadProgressFill, { width: `${(uploadedCount / totalDocs) * 100}%` }]} />
              </View>
            </View>

            {DOCUMENTS.map(doc => (
              <TouchableOpacity
                key={doc.id}
                style={[styles.docCard, uploadedDocs[doc.id] && styles.docCardDone]}
                onPress={() => handleUploadDoc(doc.id)}
                activeOpacity={0.88}
              >
                {/* Status indicator */}
                <View style={[styles.docStatusDot, { backgroundColor: uploadedDocs[doc.id] ? Colors.success : 'transparent', borderColor: uploadedDocs[doc.id] ? Colors.success : Colors.border }]}>
                  {uploadedDocs[doc.id] && <MaterialIcons name="check" size={11} color="#fff" />}
                </View>

                <View style={styles.docBody}>
                  <View style={styles.docTitleRow}>
                    {doc.required && !uploadedDocs[doc.id] && (
                      <View style={styles.requiredBadge}>
                        <Text style={styles.requiredBadgeText}>مطلوب</Text>
                      </View>
                    )}
                    {uploadedDocs[doc.id] && (
                      <View style={styles.doneBadge}>
                        <Text style={styles.doneBadgeText}>تم الرفع</Text>
                      </View>
                    )}
                    <Text style={[styles.docLabel, uploadedDocs[doc.id] && styles.docLabelDone]}>{doc.label}</Text>
                  </View>
                  <Text style={styles.docHint}>{doc.hint}</Text>
                </View>

                <View style={[styles.docIconBox, { backgroundColor: uploadedDocs[doc.id] ? Colors.success + '18' : Colors.bgLight }]}>
                  <MaterialIcons
                    name={uploadedDocs[doc.id] ? 'check-circle' : (doc.icon as any)}
                    size={26}
                    color={uploadedDocs[doc.id] ? Colors.success : Colors.primary}
                  />
                </View>
              </TouchableOpacity>
            ))}

            <TouchableOpacity style={styles.primaryBtn} onPress={handleNextStep} activeOpacity={0.88}>
              <LinearGradient colors={['#FFD050', '#E8A020', '#C47D0A']} style={styles.primaryBtnGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                <MaterialIcons name="arrow-back" size={20} color={Colors.bgDark} />
                <Text style={styles.primaryBtnText}>التالي: التحقق من الوجه</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}

        {/* ─── STEP 3: Face Verify ─── */}
        {currentStep === 3 && (
          <View style={styles.faceVerifySection}>
            <View style={styles.sectionHeader}>
              <MaterialIcons name="face" size={22} color={Colors.accent} />
              <Text style={styles.sectionTitle}>التحقق من الهوية</Text>
            </View>
            <Text style={styles.sectionSubtitle}>نحتاج التحقق من وجهك لتأمين حسابك</Text>

            {/* Face Frame */}
            <View style={styles.faceFrameOuter}>
              <LinearGradient
                colors={faceVerified ? [Colors.success + '30', Colors.success + '10'] : ['rgba(232,160,32,0.15)', 'rgba(232,160,32,0.05)']}
                style={styles.faceFrameGrad}
              >
                {faceVerified ? (
                  <View style={styles.faceSuccessContent}>
                    <View style={styles.faceSuccessCircle}>
                      <MaterialIcons name="check-circle" size={60} color={Colors.success} />
                    </View>
                    <Text style={styles.faceSuccessTitle}>تم التحقق بنجاح!</Text>
                    <Text style={styles.faceSuccessSubtitle}>تم التعرف على هويتك بنجاح</Text>
                  </View>
                ) : (
                  <View style={styles.faceScanContent}>
                    <Animated.View style={[styles.faceScanCircle, { transform: [{ scale: verifying ? pulseAnim : 1 }] }]}>
                      <View style={styles.faceScanInner}>
                        <MaterialIcons name="face" size={64} color={verifying ? Colors.accent : Colors.primary} />
                      </View>
                      {/* Corner markers */}
                      {[0, 1, 2, 3].map(i => (
                        <View
                          key={i}
                          style={[
                            styles.cornerMark,
                            i === 0 && { top: 0, right: 0 },
                            i === 1 && { top: 0, left: 0 },
                            i === 2 && { bottom: 0, right: 0 },
                            i === 3 && { bottom: 0, left: 0 },
                          ]}
                        />
                      ))}
                    </Animated.View>
                    <Text style={styles.faceScanHint}>
                      {verifying ? 'جاري المسح...' : 'ضع وجهك داخل الإطار'}
                    </Text>
                    {verifying && (
                      <View style={styles.scanningBar}>
                        <View style={styles.scanningBarFill} />
                      </View>
                    )}
                  </View>
                )}
              </LinearGradient>
            </View>

            {/* Tips */}
            {!faceVerified && !verifying && (
              <View style={styles.tipsCard}>
                {[
                  'تأكد من الإضاءة الجيدة',
                  'انظر مباشرة للكاميرا',
                  'أزل النظارة إن أمكن',
                ].map((tip, i) => (
                  <View key={i} style={styles.tipRow}>
                    <MaterialIcons name="check-circle" size={14} color={Colors.accent} />
                    <Text style={styles.tipText}>{tip}</Text>
                  </View>
                ))}
              </View>
            )}

            {!faceVerified && (
              <TouchableOpacity
                style={[styles.primaryBtn, verifying && { opacity: 0.7 }]}
                onPress={handleFaceVerify}
                disabled={verifying}
                activeOpacity={0.88}
              >
                <LinearGradient colors={['#FFD050', '#E8A020', '#C47D0A']} style={styles.primaryBtnGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                  {verifying ? (
                    <ActivityIndicator color={Colors.bgDark} size="small" />
                  ) : (
                    <MaterialIcons name="camera" size={20} color={Colors.bgDark} />
                  )}
                  <Text style={styles.primaryBtnText}>
                    {verifying ? 'جاري التحقق...' : 'بدء التحقق من الوجه'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            )}

            {faceVerified && (
              <TouchableOpacity
                style={[styles.primaryBtn, submitting && { opacity: 0.7 }]}
                onPress={handleSubmit}
                disabled={submitting}
                activeOpacity={0.88}
              >
                <LinearGradient colors={['#FFD050', '#E8A020', '#C47D0A']} style={styles.primaryBtnGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                  {submitting ? (
                    <ActivityIndicator color={Colors.bgDark} size="small" />
                  ) : (
                    <MaterialIcons name="send" size={20} color={Colors.bgDark} />
                  )}
                  <Text style={styles.primaryBtnText}>
                    {submitting ? 'جاري الإرسال...' : 'إرسال طلب التسجيل'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* ─── STEP 4: Success ─── */}
        {currentStep === 4 && (
          <View style={styles.successSection}>
            <View style={styles.successIconWrap}>
              <LinearGradient colors={[Colors.success + '25', Colors.success + '08']} style={styles.successIconGrad}>
                <View style={styles.successIconInner}>
                  <MaterialIcons name="verified" size={52} color={Colors.success} />
                </View>
              </LinearGradient>
            </View>

            <Text style={styles.successTitle}>تم إرسال الطلب!</Text>
            <Text style={styles.successSubtitle}>سيتم مراجعة بياناتك خلال 24-48 ساعة</Text>

            {/* Timeline */}
            <View style={styles.timelineCard}>
              {[
                { label: 'استلام الطلب', done: true, icon: 'inbox' },
                { label: 'التحقق من المستندات', done: true, icon: 'description' },
                { label: 'مراجعة البيانات الشخصية', done: true, icon: 'manage-accounts' },
                { label: 'الموافقة النهائية', done: false, icon: 'verified' },
                { label: 'تفعيل الحساب', done: false, icon: 'check-circle' },
              ].map((item, i, arr) => (
                <View key={i} style={styles.timelineItem}>
                  {i < arr.length - 1 && (
                    <View style={[styles.timelineConnector, item.done && styles.timelineConnectorDone]} />
                  )}
                  <View style={[styles.timelineCircle, item.done && styles.timelineCircleDone]}>
                    <MaterialIcons
                      name={item.icon as any}
                      size={16}
                      color={item.done ? '#fff' : Colors.textLight}
                    />
                  </View>
                  <Text style={[styles.timelineLabel, item.done && styles.timelineLabelDone]}>
                    {item.label}
                  </Text>
                </View>
              ))}
            </View>

            {/* Info Card */}
            <View style={styles.infoCard}>
              <MaterialIcons name="info" size={18} color={Colors.info} />
              <Text style={styles.infoText}>ستصلك رسالة على بريدك الإلكتروني عند قبول طلبك أو رفضه</Text>
            </View>

            <TouchableOpacity style={styles.primaryBtn} onPress={() => router.replace('/(tabs)')} activeOpacity={0.88}>
              <LinearGradient colors={['#FFD050', '#E8A020', '#C47D0A']} style={styles.primaryBtnGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                <MaterialIcons name="home" size={20} color={Colors.bgDark} />
                <Text style={styles.primaryBtnText}>العودة للرئيسية</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F1218' },

  // ── Header ──
  header: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.md },
  headerRow: {
    flexDirection: 'row-reverse', alignItems: 'center',
    justifyContent: 'space-between', paddingVertical: Spacing.sm,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerLogo: { width: 40, height: 40, borderRadius: 10, borderWidth: 1, borderColor: Colors.accent + '40' },
  headerAppName: { color: Colors.accent, fontSize: Typography.xs, fontFamily: 'Tajawal_500Medium', textAlign: 'right' },
  headerTitle: { color: '#fff', fontSize: Typography.xl, fontFamily: 'Tajawal_800ExtraBold', textAlign: 'right' },
  stepCountBadge: {
    backgroundColor: 'rgba(255,208,80,0.15)',
    borderRadius: BorderRadius.full, paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: Colors.accent + '30',
  },
  stepCountText: { color: Colors.accent, fontSize: Typography.xs, fontFamily: 'Tajawal_700Bold' },

  // ── Stepper ──
  stepper: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', marginTop: Spacing.md, paddingHorizontal: Spacing.sm },
  stepItem: { flexDirection: 'row-reverse', alignItems: 'center', flex: 1, justifyContent: 'center' },
  stepCircle: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.2)',
  },
  stepCircleActive: {
    backgroundColor: Colors.accent, borderColor: Colors.accent,
    shadowColor: Colors.accent, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5, shadowRadius: 8, elevation: 6,
  },
  stepCircleDone: { backgroundColor: Colors.success + 'CC', borderColor: Colors.success },
  stepLine: { flex: 1, height: 2, backgroundColor: 'rgba(255,255,255,0.1)', marginHorizontal: 2 },
  stepLineDone: { backgroundColor: Colors.success + '80' },
  stepLabelsRow: { flexDirection: 'row-reverse', justifyContent: 'space-around', marginTop: Spacing.xs },
  stepLabel: { fontSize: 10, color: 'rgba(255,255,255,0.4)', textAlign: 'center', flex: 1, fontFamily: 'Tajawal_400Regular' },
  stepLabelActive: { color: Colors.accent, fontFamily: 'Tajawal_700Bold' },
  progressBarTrack: { height: 3, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 2, marginTop: Spacing.sm },
  progressBarFill: { height: '100%', backgroundColor: Colors.accent, borderRadius: 2 },

  // ── Body ──
  body: { flex: 1, backgroundColor: '#0F1218' },
  bodyContent: { padding: Spacing.md },

  // ── Section Header ──
  sectionHeader: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8, marginBottom: 6 },
  sectionTitle: { color: '#fff', fontSize: Typography.xl, fontFamily: 'Tajawal_800ExtraBold' },
  sectionSubtitle: { color: 'rgba(255,255,255,0.5)', fontSize: Typography.sm, fontFamily: 'Tajawal_400Regular', textAlign: 'right', marginBottom: Spacing.lg },

  // ── Field Cards ──
  fieldCard: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: '#1A2235', borderRadius: BorderRadius.lg,
    padding: Spacing.md, marginBottom: Spacing.sm,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  fieldIconWrap: {
    width: 38, height: 38, borderRadius: 10,
    backgroundColor: 'rgba(232,160,32,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  fieldBody: { flex: 1 },
  fieldLabel: { color: 'rgba(255,255,255,0.55)', fontSize: Typography.xs, fontFamily: 'Tajawal_500Medium', textAlign: 'right' },
  fieldPlaceholder: { color: 'rgba(255,255,255,0.85)', fontSize: Typography.base, fontFamily: 'Tajawal_500Medium', textAlign: 'right', marginTop: 2 },

  // ── Chip row ──
  chipSectionLabel: { color: 'rgba(255,255,255,0.55)', fontSize: Typography.xs, fontFamily: 'Tajawal_500Medium', textAlign: 'right', marginBottom: Spacing.sm, marginTop: Spacing.sm },
  chipsRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.lg },
  chip: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  chipActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  chipText: { color: 'rgba(255,255,255,0.7)', fontSize: Typography.sm, fontFamily: 'Tajawal_500Medium' },
  chipTextActive: { color: Colors.bgDark, fontFamily: 'Tajawal_700Bold' },

  // ── Upload Progress ──
  uploadProgressCard: {
    backgroundColor: '#1A2235', borderRadius: BorderRadius.lg,
    padding: Spacing.md, marginBottom: Spacing.md,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  uploadProgressHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: Spacing.sm },
  uploadProgressLabel: { color: 'rgba(255,255,255,0.55)', fontSize: Typography.sm, fontFamily: 'Tajawal_500Medium' },
  uploadProgressCount: { color: Colors.accent, fontSize: Typography.sm, fontFamily: 'Tajawal_700Bold' },
  uploadProgressTrack: { height: 6, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' },
  uploadProgressFill: { height: '100%', backgroundColor: Colors.accent, borderRadius: 3 },

  // ── Doc Cards ──
  docCard: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: '#1A2235', borderRadius: BorderRadius.lg,
    padding: Spacing.md, marginBottom: Spacing.sm,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.07)',
  },
  docCardDone: { borderColor: Colors.success + '35', backgroundColor: Colors.success + '06' },
  docStatusDot: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 1.5, alignItems: 'center', justifyContent: 'center',
  },
  docBody: { flex: 1 },
  docTitleRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6, marginBottom: 3 },
  docLabel: { color: '#fff', fontSize: Typography.base, fontFamily: 'Tajawal_700Bold' },
  docLabelDone: { color: Colors.success },
  docHint: { color: 'rgba(255,255,255,0.4)', fontSize: Typography.xs, fontFamily: 'Tajawal_400Regular', textAlign: 'right' },
  docIconBox: {
    width: 50, height: 50, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  requiredBadge: {
    backgroundColor: Colors.error + '25', borderRadius: 6,
    paddingHorizontal: 6, paddingVertical: 2,
    borderWidth: 1, borderColor: Colors.error + '40',
  },
  requiredBadgeText: { color: Colors.error, fontSize: 9, fontFamily: 'Tajawal_700Bold' },
  doneBadge: {
    backgroundColor: Colors.success + '18', borderRadius: 6,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  doneBadgeText: { color: Colors.success, fontSize: 9, fontFamily: 'Tajawal_700Bold' },

  // ── Face Verify ──
  faceVerifySection: {},
  faceFrameOuter: {
    borderRadius: BorderRadius.xl, overflow: 'hidden',
    marginBottom: Spacing.md, borderWidth: 1.5,
    borderColor: 'rgba(232,160,32,0.25)',
  },
  faceFrameGrad: { padding: Spacing.xl, alignItems: 'center' },
  faceScanContent: { alignItems: 'center' },
  faceScanCircle: {
    width: 170, height: 170, borderRadius: 85,
    borderWidth: 2.5, borderColor: Colors.accent + '40',
    borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center',
    position: 'relative', marginBottom: Spacing.md,
  },
  faceScanInner: {
    width: 130, height: 130, borderRadius: 65,
    backgroundColor: 'rgba(232,160,32,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  cornerMark: {
    position: 'absolute', width: 18, height: 18,
    borderColor: Colors.accent, borderWidth: 2.5,
  },
  faceScanHint: { color: 'rgba(255,255,255,0.6)', fontSize: Typography.sm, fontFamily: 'Tajawal_500Medium', textAlign: 'center' },
  scanningBar: { width: '80%', height: 4, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 2, marginTop: Spacing.sm, overflow: 'hidden' },
  scanningBarFill: { width: '60%', height: '100%', backgroundColor: Colors.accent, borderRadius: 2 },
  faceSuccessContent: { alignItems: 'center' },
  faceSuccessCircle: {
    width: 110, height: 110, borderRadius: 55,
    backgroundColor: Colors.success + '18',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: Spacing.md,
    shadowColor: Colors.success, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
  },
  faceSuccessTitle: { color: '#fff', fontSize: Typography.xl, fontFamily: 'Tajawal_800ExtraBold', marginBottom: 4 },
  faceSuccessSubtitle: { color: Colors.success, fontSize: Typography.sm, fontFamily: 'Tajawal_500Medium' },

  tipsCard: {
    backgroundColor: 'rgba(255,208,80,0.06)', borderRadius: BorderRadius.md,
    padding: Spacing.md, marginBottom: Spacing.md,
    borderWidth: 1, borderColor: 'rgba(255,208,80,0.15)',
    gap: 8,
  },
  tipRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8 },
  tipText: { color: 'rgba(255,255,255,0.65)', fontSize: Typography.sm, fontFamily: 'Tajawal_400Regular', flex: 1, textAlign: 'right' },

  // ── Success ──
  successSection: { alignItems: 'center' },
  successIconWrap: { marginBottom: Spacing.lg },
  successIconGrad: { borderRadius: 50, padding: 20 },
  successIconInner: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: Colors.success + '20',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: Colors.success, shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35, shadowRadius: 16, elevation: 10,
  },
  successTitle: { color: '#fff', fontSize: Typography.xxl, fontFamily: 'Tajawal_800ExtraBold', marginBottom: 6, textAlign: 'center' },
  successSubtitle: { color: 'rgba(255,255,255,0.55)', fontSize: Typography.base, fontFamily: 'Tajawal_400Regular', textAlign: 'center', marginBottom: Spacing.lg },

  timelineCard: {
    backgroundColor: '#1A2235', borderRadius: BorderRadius.lg,
    padding: Spacing.md, width: '100%', marginBottom: Spacing.md,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  timelineItem: { flexDirection: 'row-reverse', alignItems: 'center', gap: Spacing.sm, paddingVertical: 8, position: 'relative' },
  timelineConnector: {
    position: 'absolute', right: 17, top: '100%',
    width: 2, height: 20, backgroundColor: 'rgba(255,255,255,0.1)', zIndex: 0,
  },
  timelineConnectorDone: { backgroundColor: Colors.success + '60' },
  timelineCircle: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.15)',
  },
  timelineCircleDone: { backgroundColor: Colors.success, borderColor: Colors.success },
  timelineLabel: { color: 'rgba(255,255,255,0.5)', fontSize: Typography.sm, fontFamily: 'Tajawal_500Medium', flex: 1, textAlign: 'right' },
  timelineLabelDone: { color: '#fff', fontFamily: 'Tajawal_700Bold' },

  infoCard: {
    flexDirection: 'row-reverse', alignItems: 'flex-start', gap: 8,
    backgroundColor: 'rgba(59,130,246,0.1)', borderRadius: BorderRadius.md,
    padding: Spacing.md, width: '100%', marginBottom: Spacing.lg,
    borderWidth: 1, borderColor: 'rgba(59,130,246,0.2)',
  },
  infoText: { color: 'rgba(255,255,255,0.65)', fontSize: Typography.sm, fontFamily: 'Tajawal_400Regular', flex: 1, textAlign: 'right', lineHeight: 22 },

  // ── Primary Button ──
  primaryBtn: { borderRadius: BorderRadius.lg, overflow: 'hidden', marginTop: Spacing.lg, ...Shadows.lg },
  primaryBtnGrad: {
    flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center',
    gap: 10, paddingVertical: 16,
  },
  primaryBtnText: { color: Colors.bgDark, fontSize: Typography.md, fontFamily: 'Tajawal_800ExtraBold' },
});
