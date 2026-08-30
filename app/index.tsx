import React, { useState, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
  Animated, Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuthContext } from '@/contexts/AuthContext';
import { useAlert } from '@/template';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

type AuthMode = 'login' | 'otp-email' | 'otp-verify';

// ─── Egypt Skyline SVG-like Drawing using Views ────────────────────────────
function EgyptSkyline() {
  return (
    <View style={skyline.wrap} pointerEvents="none">
      {/* Decorative cityscape using geometric shapes */}
      <View style={skyline.row}>
        {/* Pyramid left */}
        <View style={skyline.pyramid} />
        {/* Minaret 1 */}
        <View style={skyline.minaret} />
        <View style={skyline.building1} />
        <View style={skyline.building2} />
        {/* Mosque dome */}
        <View style={skyline.minaretTall} />
        <View style={skyline.building3} />
        {/* Pyramid right */}
        <View style={skyline.pyramidSm} />
        <View style={skyline.building4} />
        <View style={skyline.minaretSm} />
      </View>
      <Text style={skyline.text}>♡ مصر... دايماً معاك</Text>
    </View>
  );
}

const skyline = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    paddingTop: 4,
    paddingBottom: 8,
    opacity: 0.65,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 32,
    gap: 3,
    marginBottom: 4,
  },
  pyramid: {
    width: 0, height: 0,
    borderLeftWidth: 16, borderRightWidth: 16, borderBottomWidth: 26,
    borderLeftColor: 'transparent', borderRightColor: 'transparent',
    borderBottomColor: '#F4C542',
  },
  pyramidSm: {
    width: 0, height: 0,
    borderLeftWidth: 10, borderRightWidth: 10, borderBottomWidth: 18,
    borderLeftColor: 'transparent', borderRightColor: 'transparent',
    borderBottomColor: '#F4C542',
  },
  minaret: {
    width: 6, height: 24,
    backgroundColor: '#F4C542',
    borderTopLeftRadius: 3, borderTopRightRadius: 3,
    marginBottom: 0,
  },
  minaretTall: {
    width: 7, height: 30,
    backgroundColor: '#F4C542',
    borderTopLeftRadius: 4, borderTopRightRadius: 4,
  },
  minaretSm: {
    width: 5, height: 18,
    backgroundColor: '#F4C542',
    borderTopLeftRadius: 3, borderTopRightRadius: 3,
  },
  building1: { width: 14, height: 20, backgroundColor: '#F4C542', borderTopLeftRadius: 2, borderTopRightRadius: 2 },
  building2: { width: 18, height: 16, backgroundColor: '#F4C542', borderTopLeftRadius: 2, borderTopRightRadius: 2 },
  building3: { width: 22, height: 22, backgroundColor: '#F4C542', borderTopLeftRadius: 2, borderTopRightRadius: 2 },
  building4: { width: 12, height: 14, backgroundColor: '#F4C542', borderTopLeftRadius: 2, borderTopRightRadius: 2 },
  text: {
    color: '#F4C542',
    fontSize: 11,
    fontFamily: 'Tajawal_700Bold',
    letterSpacing: 0.5,
  },
});

// ─── Main Screen ─────────────────────────────────────────────────────────────
export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { login, sendOTP, verifyOTP, signInWithGoogle, operationLoading } = useAuthContext();
  const { showAlert } = useAlert();

  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [googleLoading, setGoogleLoading] = useState(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  // ── Onboarding check ──────────────────────────────────────────────────────
  useEffect(() => {
    AsyncStorage.getItem('onboarding_done').then(val => {
      if (!val) router.replace('/onboarding');
    });
  }, []);

  // ── Auth state → auto-redirect ────────────────────────────────────────────
  // This is the AUTHORITATIVE redirect: fires whenever the Supabase session
  // is established (password login, OTP verify, Google OAuth, page refresh).
  // Using auth state as the single source of truth prevents race conditions
  // between the API callback and the async onAuthStateChange update.
  const { user: authUser, loading: authLoading } = useAuthContext();
  useEffect(() => {
    if (!authLoading && authUser) {
      router.replace('/(tabs)');
    }
  }, [authUser, authLoading]);

  const switchMode = (newMode: AuthMode) => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 120, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 20, duration: 120, useNativeDriver: true }),
    ]).start(() => {
      setMode(newMode);
      setOtpCode('');
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    });
  };

  // ── Password Login ──────────────────────────────────────────────────────────
  // Navigation is handled by the authUser useEffect above — no manual redirect needed here.
  const handleLogin = async () => {
    if (!email.trim() || !password) {
      showAlert('تنبيه', 'من فضلك أدخل البريد الإلكتروني وكلمة المرور');
      return;
    }
    const { error } = await login(email.trim(), password);
    if (error) { showAlert('خطأ في تسجيل الدخول', error); }
    // On success: Supabase fires onAuthStateChange → AuthContext sets user → useEffect above redirects
  };

  // ── Google Sign-In ──────────────────────────────────────────────────────────
  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    const { error } = await signInWithGoogle();
    setGoogleLoading(false);
    if (error) showAlert('خطأ', error);
  };

  // ── OTP Flow ────────────────────────────────────────────────────────────────
  const handleSendOTP = async () => {
    if (!email.trim()) { showAlert('تنبيه', 'من فضلك أدخل البريد الإلكتروني'); return; }
    const { error } = await sendOTP(email.trim());
    if (error) { showAlert('خطأ', error); return; }
    showAlert('تم الإرسال', `تم إرسال رمز التحقق إلى ${email}`);
    switchMode('otp-verify');
  };

  const handleVerifyOTP = async () => {
    if (!otpCode || otpCode.length < 4) {
      showAlert('تنبيه', 'من فضلك أدخل رمز التحقق المكون من 4 أرقام');
      return;
    }
    const { error } = await verifyOTP(email.trim(), otpCode);
    if (error) { showAlert('رمز غير صحيح', error); return; }
    // On success: Supabase fires onAuthStateChange → AuthContext sets user → useEffect above redirects
    // Do NOT navigate here — wait for auth state to confirm the session is established
  };

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      {/* ── Full Background ── */}
      <View style={StyleSheet.absoluteFillObject} >
        <Image
          source={require('@/assets/images/login-hero.png')}
          style={styles.heroBg}
          contentFit="cover"
          transition={300}
        />
        {/* Dark gradient overlay bottom half */}
        <LinearGradient
          colors={['transparent', 'rgba(10,10,10,0.55)', '#0A0A0A', '#0A0A0A']}
          locations={[0, 0.28, 0.52, 1]}
          style={StyleSheet.absoluteFillObject}
        />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ flexGrow: 1 }}
        >
          {/* ── Hero Top Area ── */}
          <View style={[styles.heroTop, { paddingTop: insets.top + 16 }]}>
            {/* App Logo Row */}
            <View style={styles.appLogoRow}>
              {/* TukTuk Mini Icon */}
              <View style={styles.miniIconWrap}>
                <Text style={styles.miniTukIcon}>🛺</Text>
              </View>
            </View>

            {/* App Name */}
            <View style={styles.appNameRow}>
              <Text style={styles.appNameYellow}>توكي</Text>
              <Text style={styles.appNameWhite}>تك </Text>
            </View>

            {/* Tagline */}
            <Text style={styles.tagline}>
              أسرع وأسهل وسيلة علي ما قد ايه{' '}
              <Text style={styles.taglineYellow}>الغلابة</Text>
            </Text>
          </View>

          {/* ── Login Card ── */}
          <Animated.View
            style={[
              styles.card,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
                paddingBottom: insets.bottom + 8,
              },
            ]}
          >
            {/* ──────────── LOGIN MODE ──────────── */}
            {mode === 'login' && (
              <>
                {/* Card Header */}
                <Text style={styles.cardTitle}>تسجيل الدخول</Text>
                <Text style={styles.cardGreet}>مرحباً بعودتك 👋</Text>
                <Text style={styles.cardSub}>سجل دخولك للمتابعة</Text>

                {/* Email/Phone Input */}
                <View style={styles.inputRow}>
                  <TextInput
                    style={styles.inputText}
                    placeholder="البريد الإلكتروني أو رقم الهاتف"
                    placeholderTextColor="rgba(255,255,255,0.38)"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    textAlign="right"
                  />
                  <View style={styles.inputIconWrap}>
                    <MaterialIcons name="mail-outline" size={20} color="rgba(255,255,255,0.45)" />
                  </View>
                </View>

                {/* Password Input */}
                <View style={styles.inputRow}>
                  <TouchableOpacity onPress={() => setShowPass(v => !v)} style={styles.eyeBtn}>
                    <MaterialIcons
                      name={showPass ? 'visibility' : 'visibility-off'}
                      size={20}
                      color="rgba(255,255,255,0.45)"
                    />
                  </TouchableOpacity>
                  <TextInput
                    style={[styles.inputText, { flex: 1 }]}
                    placeholder="كلمة المرور"
                    placeholderTextColor="rgba(255,255,255,0.38)"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPass}
                    textAlign="right"
                  />
                  <View style={styles.inputIconWrap}>
                    <MaterialIcons name="lock-outline" size={20} color="rgba(255,255,255,0.45)" />
                  </View>
                </View>

                {/* Remember me + Forgot password row */}
                <View style={styles.rememberRow}>
                  {/* Remember Me - left */}
                  <TouchableOpacity
                    style={styles.rememberLeft}
                    onPress={() => setRememberMe(v => !v)}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.checkbox, rememberMe && styles.checkboxActive]}>
                      {rememberMe && (
                        <MaterialIcons name="check" size={13} color="#0A0A0A" />
                      )}
                    </View>
                    <Text style={styles.rememberText}>تذكرني</Text>
                  </TouchableOpacity>

                  {/* Forgot Password - right */}
                  <TouchableOpacity
                    onPress={() => showAlert('استعادة كلمة المرور', 'سيتم إرسال رابط الاستعادة إلى بريدك الإلكتروني')}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.forgotText}>نسيت كلمة المرور؟</Text>
                  </TouchableOpacity>
                </View>

                {/* Primary Login Button */}
                <TouchableOpacity
                  style={[styles.loginBtn, operationLoading && { opacity: 0.65 }]}
                  onPress={handleLogin}
                  disabled={operationLoading}
                  activeOpacity={0.88}
                >
                  <LinearGradient
                    colors={['#F4C542', '#E8A820', '#D49010']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={styles.loginBtnGrad}
                  >
                    {operationLoading ? (
                      <ActivityIndicator color="#0A0A0A" size="small" />
                    ) : (
                      <>
                        <MaterialIcons name="arrow-back" size={20} color="#0A0A0A" />
                        <Text style={styles.loginBtnText}>تسجيل الدخول</Text>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>

                {/* OTP option */}
                <TouchableOpacity
                  style={styles.otpLink}
                  onPress={() => switchMode('otp-email')}
                  activeOpacity={0.8}
                >
                  <Text style={styles.otpLinkText}>دخول برمز التحقق OTP</Text>
                </TouchableOpacity>

                {/* Divider */}
                <View style={styles.dividerRow}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerTxt}>أو</Text>
                  <View style={styles.dividerLine} />
                </View>

                {/* Social Buttons Row */}
                <View style={styles.socialRow}>
                  {/* Google */}
                  <TouchableOpacity
                    style={styles.socialBtn}
                    onPress={handleGoogleSignIn}
                    disabled={googleLoading}
                    activeOpacity={0.85}
                  >
                    {googleLoading ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <>
                        <View style={styles.googleIconBox}>
                          <Text style={styles.googleLetter}>G</Text>
                        </View>
                        <Text style={styles.socialBtnText}>متابعة بـ Google</Text>
                      </>
                    )}
                  </TouchableOpacity>

                  {/* Facebook */}
                  <TouchableOpacity
                    style={styles.socialBtn}
                    onPress={() => showAlert('قريباً', 'تسجيل الدخول بـ Facebook سيكون متاحاً قريباً')}
                    activeOpacity={0.85}
                  >
                    <View style={styles.fbIconBox}>
                      <Text style={styles.fbLetter}>f</Text>
                    </View>
                    <Text style={styles.socialBtnText}>متابعة بـ Facebook</Text>
                  </TouchableOpacity>
                </View>

                {/* Register link */}
                <View style={styles.registerRow}>
                  <TouchableOpacity onPress={() => router.push('/register')} activeOpacity={0.8}>
                    <Text style={styles.registerLink}>سجل الآن</Text>
                  </TouchableOpacity>
                  <Text style={styles.registerTxt}>ليس لديك حساب؟</Text>
                </View>

                {/* Egypt Skyline Decoration */}
                <View style={styles.skylineWrap}>
                  <View style={styles.skylineGoldLine} />
                  <EgyptSkyline />
                </View>
              </>
            )}

            {/* ──────────── OTP EMAIL MODE ──────────── */}
            {mode === 'otp-email' && (
              <>
                <TouchableOpacity style={styles.backBtn} onPress={() => switchMode('login')} activeOpacity={0.8}>
                  <MaterialIcons name="arrow-forward" size={20} color="#fff" />
                  <Text style={styles.backBtnText}>رجوع</Text>
                </TouchableOpacity>

                <Text style={styles.cardTitle}>دخول برمز التحقق</Text>
                <Text style={styles.cardSub}>سنرسل رمز مكون من 4 أرقام إلى بريدك الإلكتروني</Text>

                <View style={styles.inputRow}>
                  <TextInput
                    style={styles.inputText}
                    placeholder="البريد الإلكتروني"
                    placeholderTextColor="rgba(255,255,255,0.38)"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    textAlign="right"
                  />
                  <View style={styles.inputIconWrap}>
                    <MaterialIcons name="mail-outline" size={20} color="rgba(255,255,255,0.45)" />
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.loginBtn, operationLoading && { opacity: 0.65 }]}
                  onPress={handleSendOTP}
                  disabled={operationLoading}
                  activeOpacity={0.88}
                >
                  <LinearGradient
                    colors={['#F4C542', '#E8A820', '#D49010']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={styles.loginBtnGrad}
                  >
                    {operationLoading ? (
                      <ActivityIndicator color="#0A0A0A" size="small" />
                    ) : (
                      <Text style={styles.loginBtnText}>إرسال رمز التحقق</Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </>
            )}

            {/* ──────────── OTP VERIFY MODE ──────────── */}
            {mode === 'otp-verify' && (
              <>
                <TouchableOpacity style={styles.backBtn} onPress={() => switchMode('otp-email')} activeOpacity={0.8}>
                  <MaterialIcons name="arrow-forward" size={20} color="#fff" />
                  <Text style={styles.backBtnText}>رجوع</Text>
                </TouchableOpacity>

                <Text style={styles.cardTitle}>أدخل رمز التحقق</Text>
                <Text style={styles.cardSub}>تم إرسال رمز مكون من 4 أرقام إلى{'\n'}{email}</Text>

                <View style={[styles.inputRow, { justifyContent: 'center' }]}>
                  <TextInput
                    style={[styles.inputText, styles.otpInputText]}
                    placeholder="• • • •"
                    placeholderTextColor="rgba(255,255,255,0.25)"
                    value={otpCode}
                    onChangeText={t => setOtpCode(t.replace(/[^0-9]/g, '').slice(0, 4))}
                    keyboardType="number-pad"
                    textAlign="center"
                    maxLength={4}
                  />
                </View>

                <TouchableOpacity
                  style={[styles.loginBtn, (operationLoading || otpCode.length < 4) && { opacity: 0.55 }]}
                  onPress={handleVerifyOTP}
                  disabled={operationLoading || otpCode.length < 4}
                  activeOpacity={0.88}
                >
                  <LinearGradient
                    colors={['#F4C542', '#E8A820', '#D49010']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={styles.loginBtnGrad}
                  >
                    {operationLoading ? (
                      <ActivityIndicator color="#0A0A0A" size="small" />
                    ) : (
                      <Text style={styles.loginBtnText}>تأكيد الرمز</Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.resendBtn}
                  onPress={handleSendOTP}
                  disabled={operationLoading}
                  activeOpacity={0.8}
                >
                  <Text style={styles.resendText}>إعادة إرسال الرمز</Text>
                </TouchableOpacity>
              </>
            )}
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0A0A0A' },

  // ── Hero Background ──────────────────────────────────────────────────────────
  heroBg: {
    width: '100%',
    height: SCREEN_H * 0.52,
  },

  // ── Hero Top / App Name ──────────────────────────────────────────────────────
  heroTop: {
    alignItems: 'center',
    paddingHorizontal: 24,
    height: SCREEN_H * 0.46,
    justifyContent: 'flex-end',
    paddingBottom: 20,
  },
  appLogoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  miniIconWrap: {
    backgroundColor: 'rgba(244,197,66,0.2)',
    borderRadius: 20,
    padding: 6,
    borderWidth: 1.5,
    borderColor: 'rgba(244,197,66,0.5)',
  },
  miniTukIcon: { fontSize: 22 },

  appNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  appNameWhite: {
    fontSize: 46,
    fontFamily: 'Tajawal_800ExtraBold',
    color: '#FFFFFF',
    lineHeight: 54,
  },
  appNameYellow: {
    fontSize: 46,
    fontFamily: 'Tajawal_800ExtraBold',
    color: '#F4C542',
    lineHeight: 54,
  },

  tagline: {
    fontSize: 14,
    fontFamily: 'Tajawal_500Medium',
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    lineHeight: 22,
  },
  taglineYellow: {
    color: '#F4C542',
    fontFamily: 'Tajawal_700Bold',
  },

  // ── Login Card ───────────────────────────────────────────────────────────────
  card: {
    backgroundColor: '#141414',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 28,
    flex: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 20,
  },

  cardTitle: {
    fontSize: 22,
    fontFamily: 'Tajawal_800ExtraBold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 4,
  },
  cardGreet: {
    fontSize: 15,
    fontFamily: 'Tajawal_700Bold',
    color: 'rgba(255,255,255,0.75)',
    textAlign: 'center',
    marginBottom: 2,
  },
  cardSub: {
    fontSize: 13,
    fontFamily: 'Tajawal_400Regular',
    color: 'rgba(255,255,255,0.45)',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },

  // ── Inputs ───────────────────────────────────────────────────────────────────
  inputRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#1E1E1E',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    marginBottom: 12,
    paddingHorizontal: 14,
    minHeight: 52,
  },
  inputIconWrap: {
    marginLeft: 6,
  },
  inputText: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: 'Tajawal_400Regular',
    paddingVertical: 14,
    textAlign: 'right',
  },
  eyeBtn: {
    paddingLeft: 4,
    paddingRight: 2,
  },
  otpInputText: {
    fontSize: 32,
    fontFamily: 'Tajawal_800ExtraBold',
    color: '#F4C542',
    letterSpacing: 16,
    textAlign: 'center',
    paddingVertical: 16,
  },

  // ── Remember + Forgot ───────────────────────────────────────────────────────
  rememberRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
    paddingHorizontal: 2,
  },
  rememberLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    backgroundColor: '#F4C542',
    borderColor: '#F4C542',
  },
  rememberText: {
    fontSize: 13,
    fontFamily: 'Tajawal_500Medium',
    color: 'rgba(255,255,255,0.7)',
  },
  forgotText: {
    fontSize: 13,
    fontFamily: 'Tajawal_500Medium',
    color: 'rgba(255,255,255,0.7)',
  },

  // ── Login Button ─────────────────────────────────────────────────────────────
  loginBtn: {
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 10,
    shadowColor: '#F4C542',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  loginBtnGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  loginBtnText: {
    fontSize: 17,
    fontFamily: 'Tajawal_800ExtraBold',
    color: '#0A0A0A',
  },

  // ── OTP Link ─────────────────────────────────────────────────────────────────
  otpLink: {
    alignItems: 'center',
    paddingVertical: 8,
    marginBottom: 4,
  },
  otpLinkText: {
    color: '#F4C542',
    fontSize: 13,
    fontFamily: 'Tajawal_500Medium',
  },

  // ── Divider ──────────────────────────────────────────────────────────────────
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: 10,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  dividerTxt: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 12,
    fontFamily: 'Tajawal_400Regular',
  },

  // ── Social Buttons ───────────────────────────────────────────────────────────
  socialRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  socialBtn: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingVertical: 13,
  },
  googleIconBox: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#4285F4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleLetter: {
    color: '#fff',
    fontSize: 12,
    fontFamily: 'Tajawal_800ExtraBold',
  },
  fbIconBox: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#1877F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fbLetter: {
    color: '#fff',
    fontSize: 13,
    fontFamily: 'Tajawal_800ExtraBold',
  },
  socialBtnText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    fontFamily: 'Tajawal_700Bold',
  },

  // ── Register Link ────────────────────────────────────────────────────────────
  registerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  registerTxt: {
    fontSize: 13,
    fontFamily: 'Tajawal_400Regular',
    color: 'rgba(255,255,255,0.5)',
  },
  registerLink: {
    fontSize: 13,
    fontFamily: 'Tajawal_700Bold',
    color: '#F4C542',
    textDecorationLine: 'underline',
  },

  // ── Egypt Skyline ────────────────────────────────────────────────────────────
  skylineWrap: {
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 6,
  },
  skylineGoldLine: {
    width: '85%',
    height: 1,
    backgroundColor: 'rgba(244,197,66,0.2)',
    marginBottom: 10,
  },

  // ── Back Button ──────────────────────────────────────────────────────────────
  backBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
    alignSelf: 'flex-start',
  },
  backBtnText: {
    color: '#fff',
    fontSize: 14,
    fontFamily: 'Tajawal_700Bold',
  },

  // ── Resend Button ────────────────────────────────────────────────────────────
  resendBtn: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  resendText: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 13,
    fontFamily: 'Tajawal_400Regular',
  },
});
