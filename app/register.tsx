import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuthContext } from '@/contexts/AuthContext';
import { useAlert } from '@/template';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '@/constants/theme';

type RegisterStep = 'details' | 'otp';

export default function RegisterScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { register, sendOTP, verifyOTP, operationLoading } = useAuthContext();
  const { showAlert } = useAlert();

  const [step, setStep] = useState<RegisterStep>('details');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [pendingEmail, setPendingEmail] = useState('');

  // ── Auth state → auto-redirect (single source of truth) ──────────────────
  // Fires when Supabase onAuthStateChange propagates after OTP verify or signup.
  // Using auth state as the redirect trigger prevents the race condition where
  // router.replace fires before the session is fully established in AuthContext.
  const { user: authUser, loading: authLoading } = useAuthContext();
  useEffect(() => {
    if (!authLoading && authUser) {
      router.replace('/(tabs)');
    }
  }, [authUser, authLoading]);

  // ── Step 1: Register ────────────────────────────────────────────
  const handleRegister = async () => {
    if (!name.trim() || !email.trim() || !password || !confirmPass) {
      showAlert('تنبيه', 'من فضلك أكمل جميع البيانات');
      return;
    }
    if (password !== confirmPass) {
      showAlert('خطأ', 'كلمتا المرور غير متطابقتين');
      return;
    }
    if (password.length < 6) {
      showAlert('تنبيه', 'كلمة المرور يجب أن تكون 6 أحرف على الأقل');
      return;
    }
    if (!email.includes('@')) {
      showAlert('تنبيه', 'البريد الإلكتروني غير صحيح');
      return;
    }

    const { error, needsConfirmation } = await register(name.trim(), email.trim(), password);

    if (error) {
      showAlert('خطأ في التسجيل', error);
      return;
    }

    if (needsConfirmation) {
      const { error: otpErr } = await sendOTP(email.trim());
      if (otpErr) {
        showAlert('تم إنشاء الحساب', 'تم إنشاء حسابك. يرجى تأكيد البريد الإلكتروني.');
        router.replace('/');
        return;
      }
      setPendingEmail(email.trim());
      setStep('otp');
      return;
    }
    // Direct signup succeeded — auth state watcher (useEffect above) handles redirect
  };

  // ── Step 2: OTP Verification ────────────────────────────────────
  // Navigation handled by the authUser useEffect above — no manual redirect here.
  const handleVerifyOTP = async () => {
    if (!otpCode || otpCode.length < 4) {
      showAlert('تنبيه', 'أدخل رمز التحقق المكون من 4 أرقام');
      return;
    }
    const { error } = await verifyOTP(pendingEmail, otpCode);
    if (error) {
      showAlert('خطأ', error);
      return;
    }
    // On success: Supabase fires onAuthStateChange → AuthContext sets user → useEffect redirects
    showAlert('مرحباً!', `أهلاً بك في تك توكي يا ${name}`);
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <LinearGradient
        colors={[Colors.bgDark, Colors.bgNavy, '#1E3A8A']}
        style={StyleSheet.absoluteFillObject}
      />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >

          {/* ── HERO SECTION ── */}
          <View style={styles.heroSection}>
            {/* Back button */}
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => (step === 'otp' ? setStep('details') : router.back())}
            >
              <MaterialIcons name="arrow-forward" size={22} color={Colors.textWhite} />
            </TouchableOpacity>

            {/* Logo */}
            <View style={styles.logoRing}>
              <Image
                source={require('@/assets/images/logo.png')}
                style={styles.logoImage}
                contentFit="contain"
                transition={200}
              />
            </View>

            <Text style={styles.appNameAr}>تـك توكي</Text>
            <Text style={styles.appNameEn}>Tuk Tuky</Text>

            {/* Step badge */}
            <View style={styles.stepBadge}>
              <MaterialIcons
                name={step === 'details' ? 'person-add' : 'mark-email-read'}
                size={15}
                color={Colors.accent}
              />
              <Text style={styles.stepBadgeText}>
                {step === 'details' ? 'إنشاء حساب جديد' : 'تأكيد البريد الإلكتروني'}
              </Text>
            </View>
          </View>

          {/* ── FORM CARD ── */}
          <View style={styles.formCard}>

            {/* ── DETAILS STEP ── */}
            {step === 'details' && (
              <>
                <Text style={styles.formTitle}>إنشاء حساب جديد</Text>
                <Text style={styles.formSubtitle}>انضم إلى عائلة تك توكي وابدأ رحلتك الآن</Text>

                {/* Name */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>الاسم الكامل</Text>
                  <View style={styles.inputWrapper}>
                    <MaterialIcons name="person" size={20} color={Colors.primary} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="أدخل اسمك الكامل"
                      placeholderTextColor={Colors.textLight}
                      value={name}
                      onChangeText={setName}
                      textAlign="right"
                    />
                  </View>
                </View>

                {/* Email */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>البريد الإلكتروني</Text>
                  <View style={styles.inputWrapper}>
                    <MaterialIcons name="email" size={20} color={Colors.primary} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="example@email.com"
                      placeholderTextColor={Colors.textLight}
                      value={email}
                      onChangeText={setEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      textAlign="right"
                    />
                  </View>
                </View>

                {/* Password */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>كلمة المرور</Text>
                  <View style={styles.inputWrapper}>
                    <TouchableOpacity onPress={() => setShowPass(!showPass)} style={styles.inputIcon}>
                      <MaterialIcons
                        name={showPass ? 'visibility' : 'visibility-off'}
                        size={20}
                        color={Colors.primary}
                      />
                    </TouchableOpacity>
                    <TextInput
                      style={styles.input}
                      placeholder="6 أحرف على الأقل"
                      placeholderTextColor={Colors.textLight}
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!showPass}
                      textAlign="right"
                    />
                  </View>
                </View>

                {/* Confirm Password */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>تأكيد كلمة المرور</Text>
                  <View style={styles.inputWrapper}>
                    <TouchableOpacity onPress={() => setShowConfirmPass(!showConfirmPass)} style={styles.inputIcon}>
                      <MaterialIcons
                        name={showConfirmPass ? 'visibility' : 'visibility-off'}
                        size={20}
                        color={Colors.primary}
                      />
                    </TouchableOpacity>
                    <TextInput
                      style={styles.input}
                      placeholder="أعد إدخال كلمة المرور"
                      placeholderTextColor={Colors.textLight}
                      value={confirmPass}
                      onChangeText={setConfirmPass}
                      secureTextEntry={!showConfirmPass}
                      textAlign="right"
                    />
                  </View>
                </View>

                {/* Password strength hint */}
                {password.length > 0 && (
                  <View style={styles.strengthRow}>
                    {[1, 2, 3, 4].map(i => (
                      <View
                        key={i}
                        style={[
                          styles.strengthBar,
                          {
                            backgroundColor:
                              password.length >= i * 3
                                ? password.length >= 10 ? Colors.success : Colors.primary
                                : 'rgba(255,255,255,0.15)',
                          },
                        ]}
                      />
                    ))}
                    <Text style={styles.strengthLabel}>
                      {password.length < 4 ? 'ضعيفة' : password.length < 7 ? 'متوسطة' : password.length < 10 ? 'جيدة' : 'قوية'}
                    </Text>
                  </View>
                )}

                <TouchableOpacity
                  style={[styles.btnPrimary, operationLoading && styles.btnDisabled]}
                  onPress={handleRegister}
                  disabled={operationLoading}
                  activeOpacity={0.85}
                >
                  {operationLoading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.btnPrimaryText}>إنشاء الحساب</Text>
                  )}
                </TouchableOpacity>

                <View style={styles.divider}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>لديك حساب؟</Text>
                  <View style={styles.dividerLine} />
                </View>

                <TouchableOpacity
                  style={styles.btnOutline}
                  onPress={() => router.back()}
                  activeOpacity={0.85}
                >
                  <Text style={styles.btnOutlineText}>تسجيل الدخول</Text>
                </TouchableOpacity>
              </>
            )}

            {/* ── OTP STEP ── */}
            {step === 'otp' && (
              <>
                <View style={styles.otpIconWrap}>
                  <MaterialIcons name="mark-email-read" size={36} color={Colors.accent} />
                </View>

                <Text style={styles.formTitle}>تأكيد البريد الإلكتروني</Text>
                <Text style={styles.formSubtitle}>
                  {'تم إرسال رمز مكون من 4 أرقام إلى\n'}{pendingEmail}
                </Text>

                <View style={[styles.inputWrapper, styles.otpInputWrapper]}>
                  <TextInput
                    style={[styles.input, styles.otpText]}
                    placeholder="0000"
                    placeholderTextColor={Colors.textLight}
                    value={otpCode}
                    onChangeText={t => setOtpCode(t.replace(/[^0-9]/g, '').slice(0, 4))}
                    keyboardType="number-pad"
                    textAlign="center"
                    maxLength={4}
                    autoFocus
                  />
                </View>

                {/* OTP digit indicators */}
                <View style={styles.otpDotsRow}>
                  {[0, 1, 2, 3].map(i => (
                    <View
                      key={i}
                      style={[
                        styles.otpDot,
                        otpCode.length > i && styles.otpDotFilled,
                      ]}
                    />
                  ))}
                </View>

                <TouchableOpacity
                  style={[
                    styles.btnPrimary,
                    (operationLoading || otpCode.length < 4) && styles.btnDisabled,
                  ]}
                  onPress={handleVerifyOTP}
                  disabled={operationLoading || otpCode.length < 4}
                  activeOpacity={0.85}
                >
                  {operationLoading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.btnPrimaryText}>تأكيد وإنهاء التسجيل</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.resendBtn}
                  onPress={() => sendOTP(pendingEmail)}
                  disabled={operationLoading}
                >
                  <MaterialIcons name="refresh" size={16} color={Colors.accent} />
                  <Text style={styles.resendText}>إعادة إرسال الرمز</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgDark },
  scroll: { flexGrow: 1, paddingHorizontal: Spacing.md },

  // ── Hero ──
  heroSection: { alignItems: 'center', marginBottom: Spacing.lg, position: 'relative' },
  backBtn: {
    position: 'absolute', left: 0, top: 0,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  logoRing: {
    width: 100, height: 100, borderRadius: 28,
    borderWidth: 2, borderColor: Colors.accent + '55',
    padding: 6, marginBottom: Spacing.sm, marginTop: 4,
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 14,
    elevation: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  logoImage: { width: '100%', height: '100%', borderRadius: 22 },
  appNameAr: {
    fontSize: 34,
    fontFamily: 'Tajawal_800ExtraBold',
    color: Colors.textWhite,
    textAlign: 'center',
    lineHeight: 42,
  },
  appNameEn: {
    fontSize: 15,
    fontFamily: 'Tajawal_500Medium',
    color: Colors.accent,
    textAlign: 'center',
    letterSpacing: 3,
    textTransform: 'uppercase',
    marginBottom: Spacing.sm,
  },
  stepBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,208,80,0.12)',
    borderRadius: BorderRadius.full,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: Colors.accent + '30',
    marginTop: 4,
  },
  stepBadgeText: {
    color: Colors.accent,
    fontSize: Typography.sm,
    fontFamily: 'Tajawal_700Bold',
  },

  // ── Form Card ──
  formCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  formTitle: {
    color: Colors.textWhite,
    fontSize: Typography.xxl,
    fontFamily: 'Tajawal_800ExtraBold',
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  formSubtitle: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: Typography.sm,
    fontFamily: 'Tajawal_400Regular',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing.lg,
  },
  fieldGroup: { marginBottom: Spacing.xs },
  label: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: Typography.sm,
    fontFamily: 'Tajawal_500Medium',
    textAlign: 'right',
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  inputIcon: { marginLeft: Spacing.sm },
  input: {
    flex: 1,
    color: Colors.textWhite,
    fontSize: Typography.md,
    paddingVertical: 13,
    textAlign: 'right',
  },

  // ── Password Strength ──
  strengthRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    marginBottom: Spacing.md,
    marginTop: -Spacing.xs,
  },
  strengthBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  strengthLabel: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: Typography.xs,
    fontFamily: 'Tajawal_400Regular',
    minWidth: 32,
    textAlign: 'right',
  },

  // ── Buttons ──
  btnPrimary: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: Spacing.sm,
    marginBottom: Spacing.sm,
    ...Shadows.md,
  },
  btnDisabled: { opacity: 0.5 },
  btnPrimaryText: {
    color: '#fff',
    fontSize: Typography.md,
    fontFamily: 'Tajawal_700Bold',
  },
  divider: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: Spacing.sm,
    marginVertical: Spacing.sm,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.12)' },
  dividerText: { color: 'rgba(255,255,255,0.35)', fontSize: Typography.xs },
  btnOutline: {
    borderWidth: 1.5,
    borderColor: Colors.accent,
    borderRadius: BorderRadius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnOutlineText: {
    color: Colors.accent,
    fontSize: Typography.md,
    fontFamily: 'Tajawal_700Bold',
  },

  // ── OTP ──
  otpIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: 'rgba(255,208,80,0.12)',
    borderWidth: 1.5,
    borderColor: Colors.accent + '40',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: Spacing.md,
  },
  otpInputWrapper: { justifyContent: 'center', marginBottom: Spacing.xs },
  otpText: {
    fontSize: 30,
    fontFamily: 'Tajawal_800ExtraBold',
    letterSpacing: 14,
    textAlign: 'center',
    color: Colors.accent,
  },
  otpDotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginBottom: Spacing.lg,
  },
  otpDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  otpDotFilled: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  resendBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: Spacing.sm,
    marginTop: Spacing.xs,
  },
  resendText: {
    color: Colors.accent,
    fontSize: Typography.sm,
    fontFamily: 'Tajawal_500Medium',
  },
});
