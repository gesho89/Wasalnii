import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, Switch, KeyboardAvoidingView, Platform, ActivityIndicator,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '@/constants/theme';
import { useAuthContext } from '@/contexts/AuthContext';
import { useAlert } from '@/template';
import { getSupabaseClient } from '@/template';
import { FunctionsHttpError } from '@supabase/supabase-js';

type Section = 'main' | 'profile' | 'password' | 'appearance';

const LANGUAGES = [
  { id: 'ar', label: 'العربية', flag: '🇪🇬', sub: 'اللغة الافتراضية' },
  { id: 'en', label: 'English', flag: '🇺🇸', sub: 'Switch to English' },
];

// ─── Skeleton Component ───────────────────────────────────────────────────────
function SkeletonBox({ width, height, style }: { width?: number | string; height: number; style?: any }) {
  return (
    <View
      style={[
        {
          width: width ?? '100%',
          height,
          backgroundColor: 'rgba(255,255,255,0.08)',
          borderRadius: 8,
        },
        style,
      ]}
    />
  );
}

function ProfileSkeleton() {
  return (
    <View style={skeletonStyles.profileCard}>
      <LinearGradient colors={['#1A2235', '#121826']} style={skeletonStyles.profileCardGrad}>
        <SkeletonBox width={62} height={62} style={{ borderRadius: 31 }} />
        <View style={{ flex: 1, gap: 8 }}>
          <SkeletonBox width="60%" height={16} />
          <SkeletonBox width="80%" height={12} />
          <SkeletonBox width="40%" height={12} />
        </View>
      </LinearGradient>
    </View>
  );
}

function SectionSkeleton() {
  return (
    <View style={skeletonStyles.card}>
      {[1, 2, 3].map((_, i) => (
        <View key={i}>
          <View style={skeletonStyles.row}>
            <SkeletonBox width={38} height={38} style={{ borderRadius: 10 }} />
            <View style={{ flex: 1, gap: 6 }}>
              <SkeletonBox width="50%" height={14} />
              <SkeletonBox width="70%" height={10} />
            </View>
          </View>
          {i < 2 && <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginHorizontal: 16 }} />}
        </View>
      ))}
    </View>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function SectionCard({ children, style }: { children: React.ReactNode; style?: any }) {
  return <View style={[cardStyles.card, style]}>{children}</View>;
}

function RowItem({
  icon, iconBg, label, sub, chevron = true, onPress, rightEl, danger,
}: {
  icon: string; iconBg: string; label: string; sub?: string;
  chevron?: boolean; onPress?: () => void; rightEl?: React.ReactNode; danger?: boolean;
}) {
  return (
    <TouchableOpacity style={cardStyles.row} onPress={onPress} activeOpacity={onPress ? 0.8 : 1}>
      {chevron && <MaterialIcons name="chevron-left" size={18} color="rgba(255,255,255,0.25)" />}
      {rightEl && rightEl}
      <View style={cardStyles.rowBody}>
        <Text style={[cardStyles.rowLabel, danger && cardStyles.danger]}>{label}</Text>
        {sub ? <Text style={cardStyles.rowSub}>{sub}</Text> : null}
      </View>
      <View style={[cardStyles.iconWrap, { backgroundColor: iconBg }]}>
        <MaterialIcons name={icon as any} size={18} color={danger ? Colors.error : Colors.accent} />
      </View>
    </TouchableOpacity>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, session, logout } = useAuthContext();
  const { showAlert } = useAlert();
  const supabase = getSupabaseClient();

  const [section, setSection] = useState<Section>('main');
  const [pageLoading, setPageLoading] = useState(true);

  // Profile state
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Password state
  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [savingPass, setSavingPass] = useState(false);

  // Settings state
  const [notifRide, setNotifRide] = useState(true);
  const [notifPromo, setNotifPromo] = useState(true);
  const [notifSound, setNotifSound] = useState(true);
  const [language, setLanguage] = useState('ar');
  const [darkMode, setDarkMode] = useState(true);

  // ── Load real user data on mount ─────────────────────────────────────────
  const loadUserData = useCallback(async () => {
    if (!user?.id) { setPageLoading(false); return; }
    setPageLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('username, email, phone, avatar_url')
        .eq('id', user.id)
        .single();

      if (!error && data) {
        setName(data.username ?? user.name ?? '');
        setEmail(data.email ?? user.email ?? '');
        setPhone((data as any).phone ?? user.phone ?? '');
        setAvatarUrl((data as any).avatar_url ?? user.avatar ?? null);
      } else {
        // fallback to auth context
        setName(user.name ?? '');
        setEmail(user.email ?? '');
        setPhone(user.phone ?? '');
        setAvatarUrl(user.avatar ?? null);
      }
    } catch {
      setName(user.name ?? '');
      setEmail(user.email ?? '');
      setPhone(user.phone ?? '');
    } finally {
      setPageLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { loadUserData(); }, [loadUserData]);

  // ── Avatar Upload ─────────────────────────────────────────────────────────
  const handlePickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showAlert('تنبيه', 'يجب منح صلاحية الوصول إلى الصور');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      base64: true,
    });

    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    if (!asset.base64) { showAlert('خطأ', 'تعذر قراءة الصورة'); return; }

    setUploadingAvatar(true);
    try {
      const ext = asset.uri.split('.').pop()?.toLowerCase() ?? 'jpg';
      const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';
      const filePath = `${user!.id}/avatar.${ext}`;

      // Convert base64 to ArrayBuffer
      const binary = atob(asset.base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }

      const { error: uploadErr } = await supabase.storage
        .from('avatars')
        .upload(filePath, bytes.buffer, {
          contentType: mimeType,
          upsert: true,
        });

      if (uploadErr) { showAlert('خطأ', `فشل رفع الصورة: ${uploadErr.message}`); return; }

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // Save URL to user_profiles
      await supabase
        .from('user_profiles')
        .update({ avatar_url: publicUrl } as any)
        .eq('id', user!.id);

      setAvatarUrl(publicUrl + '?t=' + Date.now());
      showAlert('تم', 'تم تحديث الصورة الشخصية بنجاح');
    } catch (e: any) {
      showAlert('خطأ', e.message ?? 'حدث خطأ أثناء الرفع');
    } finally {
      setUploadingAvatar(false);
    }
  };

  // ── Save Profile ──────────────────────────────────────────────────────────
  const handleSaveProfile = async () => {
    if (!name.trim()) { showAlert('خطأ', 'يرجى إدخال الاسم'); return; }
    if (!email.trim() || !email.includes('@')) { showAlert('خطأ', 'يرجى إدخال بريد إلكتروني صحيح'); return; }

    setSavingProfile(true);
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ username: name.trim(), email: email.trim(), phone: phone.trim() } as any)
        .eq('id', user!.id);

      if (error) { showAlert('خطأ', error.message); return; }

      showAlert('تم الحفظ', 'تم تحديث بياناتك بنجاح', [
        { text: 'حسناً', onPress: () => setSection('main') },
      ]);
    } finally {
      setSavingProfile(false);
    }
  };

  // ── Change Password ───────────────────────────────────────────────────────
  const handleChangePassword = async () => {
    if (!currentPass) { showAlert('خطأ', 'يرجى إدخال كلمة المرور الحالية'); return; }
    if (newPass.length < 6) { showAlert('خطأ', 'كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل'); return; }
    if (newPass !== confirmPass) { showAlert('خطأ', 'كلمات المرور غير متطابقة'); return; }

    setSavingPass(true);
    try {
      // Re-authenticate first to verify current password
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: user!.email,
        password: currentPass,
      });

      if (signInErr) { showAlert('خطأ', 'كلمة المرور الحالية غير صحيحة'); return; }

      // Update to new password
      const { error: updateErr } = await supabase.auth.updateUser({ password: newPass });
      if (updateErr) { showAlert('خطأ', updateErr.message); return; }

      setCurrentPass(''); setNewPass(''); setConfirmPass('');
      showAlert('تم التغيير ✓', 'تم تغيير كلمة المرور بنجاح', [
        { text: 'حسناً', onPress: () => setSection('main') },
      ]);
    } finally {
      setSavingPass(false);
    }
  };

  // ── Delete Account ────────────────────────────────────────────────────────
  const handleDeleteAccount = () => {
    showAlert(
      'حذف الحساب نهائياً',
      'سيتم حذف جميع بياناتك ورحلاتك نهائياً ولا يمكن التراجع عن هذا الإجراء.',
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'حذف الحساب', style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase.functions.invoke('delete-account', {
                headers: { Authorization: `Bearer ${session?.access_token}` },
              });

              if (error) {
                let msg = error.message;
                if (error instanceof FunctionsHttpError) {
                  try { msg = await error.context.text(); } catch {}
                }
                showAlert('خطأ', msg);
                return;
              }

              await logout();
              router.replace('/');
            } catch (e: any) {
              showAlert('خطأ', e.message ?? 'حدث خطأ أثناء حذف الحساب');
            }
          },
        },
      ]
    );
  };

  // Password strength
  const passStrength = newPass.length >= 10 ? 'قوية' : newPass.length >= 7 ? 'جيدة' : newPass.length >= 4 ? 'متوسطة' : 'ضعيفة';
  const passStrengthColor = newPass.length >= 10 ? Colors.success : newPass.length >= 7 ? '#22C55E' : newPass.length >= 4 ? Colors.warning : Colors.error;
  const passStrengthWidth = newPass.length >= 10 ? '100%' : newPass.length >= 7 ? '75%' : newPass.length >= 4 ? '50%' : '25%';

  const sectionTitles: Record<Section, string> = {
    main: 'الإعدادات',
    profile: 'تعديل البيانات',
    password: 'تغيير كلمة المرور',
    appearance: 'المظهر',
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <StatusBar style="light" />

        {/* ── Header ── */}
        <LinearGradient colors={['#0D0D0D', '#1A1400']} style={styles.header}>
          <View style={styles.headerRow}>
            <TouchableOpacity
              onPress={() => section === 'main' ? router.back() : setSection('main')}
              style={styles.backBtn}
            >
              <MaterialIcons name="arrow-forward" size={22} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{sectionTitles[section]}</Text>
            {section === 'main' && (
              <TouchableOpacity style={styles.refreshBtn} onPress={loadUserData}>
                <MaterialIcons name="refresh" size={20} color={Colors.accent} />
              </TouchableOpacity>
            )}
            {section !== 'main' && <View style={{ width: 38 }} />}
          </View>
        </LinearGradient>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 40 }]}
          keyboardShouldPersistTaps="handled"
        >

          {/* ════════════ MAIN SETTINGS ════════════ */}
          {section === 'main' && (
            <>
              {/* Profile Card (Skeleton or Real) */}
              {pageLoading ? (
                <>
                  <ProfileSkeleton />
                  <SectionSkeleton />
                </>
              ) : (
                <>
                  {/* ── Profile Preview Card ── */}
                  <View style={styles.profileCard}>
                    <LinearGradient colors={['#1A2235', '#121826']} style={styles.profileCardGrad}>
                      <View style={styles.profileAvatarWrap}>
                        <Image
                          source={avatarUrl
                            ? { uri: avatarUrl }
                            : { uri: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face' }
                          }
                          style={styles.profileAvatar}
                          contentFit="cover"
                          transition={200}
                        />
                        <View style={styles.onlineDot} />
                      </View>
                      <View style={styles.profileInfo}>
                        <Text style={styles.profileName}>{name || user?.name || 'مستخدم'}</Text>
                        <Text style={styles.profileEmail}>{email || user?.email || ''}</Text>
                        {phone ? (
                          <Text style={styles.profilePhone}>{phone}</Text>
                        ) : null}
                        <View style={styles.profileBadge}>
                          <View style={styles.profileBadgeDot} />
                          <Text style={styles.profileBadgeText}>حساب نشط</Text>
                        </View>
                      </View>
                      <TouchableOpacity style={styles.editProfileBtn} onPress={() => setSection('profile')}>
                        <MaterialIcons name="edit" size={16} color={Colors.accent} />
                      </TouchableOpacity>
                    </LinearGradient>
                  </View>

                  {/* ── Account ── */}
                  <Text style={styles.groupTitle}>الحساب</Text>
                  <SectionCard>
                    <RowItem
                      icon="account-circle" iconBg="rgba(232,160,32,0.12)"
                      label="تعديل البيانات الشخصية" sub={`${name || '—'} · ${phone || '—'}`}
                      onPress={() => setSection('profile')}
                    />
                    <View style={cardStyles.divider} />
                    <RowItem
                      icon="lock" iconBg="rgba(245,158,11,0.12)"
                      label="تغيير كلمة المرور" sub="تأمين حسابك بكلمة مرور قوية"
                      onPress={() => setSection('password')}
                    />
                    <View style={cardStyles.divider} />
                    <RowItem
                      icon="devices" iconBg="rgba(59,130,246,0.12)"
                      label="إدارة الأجهزة" sub="جهاز واحد مسجّل حالياً"
                      onPress={() => router.push('/devices' as any)}
                    />
                    <View style={cardStyles.divider} />
                    <RowItem
                      icon="history" iconBg="rgba(139,92,246,0.12)"
                      label="سجل تسجيل الدخول" sub="آخر دخول: الآن"
                      onPress={() => showAlert('قريباً', 'سجل تسجيل الدخول سيكون متاحاً قريباً')}
                    />
                  </SectionCard>

                  {/* ── Notifications ── */}
                  <Text style={styles.groupTitle}>الإشعارات</Text>
                  <SectionCard>
                    {[
                      { label: 'إشعارات الرحلات', sub: 'قبول الرحلة، وصول السائق', value: notifRide, set: setNotifRide, color: Colors.success },
                      { label: 'العروض والكوبونات', sub: 'أحدث الخصومات والعروض', value: notifPromo, set: setNotifPromo, color: Colors.accent },
                      { label: 'الأصوات', sub: 'صوت الإشعارات والتنبيهات', value: notifSound, set: setNotifSound, color: Colors.primary },
                    ].map((item, i, arr) => (
                      <View key={i}>
                        <View style={cardStyles.switchRow}>
                          <Switch
                            value={item.value}
                            onValueChange={item.set}
                            trackColor={{ false: 'rgba(255,255,255,0.1)', true: item.color + '50' }}
                            thumbColor={item.value ? item.color : 'rgba(255,255,255,0.4)'}
                          />
                          <View style={cardStyles.rowBody}>
                            <Text style={cardStyles.rowLabel}>{item.label}</Text>
                            <Text style={cardStyles.rowSub}>{item.sub}</Text>
                          </View>
                          <View style={[cardStyles.iconWrap, { backgroundColor: item.color + '12' }]}>
                            <MaterialIcons name="notifications" size={18} color={item.color} />
                          </View>
                        </View>
                        {i < arr.length - 1 && <View style={cardStyles.divider} />}
                      </View>
                    ))}
                  </SectionCard>

                  {/* ── Appearance ── */}
                  <Text style={styles.groupTitle}>المظهر واللغة</Text>
                  <SectionCard>
                    {/* Dark Mode */}
                    <View style={cardStyles.switchRow}>
                      <Switch
                        value={darkMode}
                        onValueChange={setDarkMode}
                        trackColor={{ false: 'rgba(255,255,255,0.1)', true: Colors.accent + '50' }}
                        thumbColor={darkMode ? Colors.accent : 'rgba(255,255,255,0.4)'}
                      />
                      <View style={cardStyles.rowBody}>
                        <Text style={cardStyles.rowLabel}>الوضع الليلي</Text>
                        <Text style={cardStyles.rowSub}>{darkMode ? 'مُفعّل · خلفية داكنة' : 'مُعطّل · خلفية فاتحة'}</Text>
                      </View>
                      <View style={[cardStyles.iconWrap, { backgroundColor: 'rgba(255,208,80,0.12)' }]}>
                        <MaterialIcons name={darkMode ? 'dark-mode' : 'light-mode'} size={18} color={Colors.accent} />
                      </View>
                    </View>
                    <View style={cardStyles.divider} />
                    {/* Appearance section button */}
                    <RowItem
                      icon="palette" iconBg="rgba(139,92,246,0.12)"
                      label="إعدادات المظهر" sub="ألوان، خطوط، حجم النص"
                      onPress={() => setSection('appearance')}
                    />
                    <View style={cardStyles.divider} />
                    {/* Language */}
                    {LANGUAGES.map((lang, i) => (
                      <View key={lang.id}>
                        <TouchableOpacity style={cardStyles.row} onPress={() => setLanguage(lang.id)} activeOpacity={0.85}>
                          <View style={[cardStyles.radio, language === lang.id && cardStyles.radioActive]}>
                            {language === lang.id && <View style={cardStyles.radioInner} />}
                          </View>
                          <View style={cardStyles.rowBody}>
                            <Text style={cardStyles.rowLabel}>{lang.label}</Text>
                            <Text style={cardStyles.rowSub}>{lang.sub}</Text>
                          </View>
                          <Text style={styles.langFlag}>{lang.flag}</Text>
                        </TouchableOpacity>
                        {i < LANGUAGES.length - 1 && <View style={cardStyles.divider} />}
                      </View>
                    ))}
                  </SectionCard>

                  {/* ── Privacy & Security ── */}
                  <Text style={styles.groupTitle}>الأمان والخصوصية</Text>
                  <SectionCard>
                    <RowItem
                      icon="security" iconBg="rgba(16,185,129,0.12)"
                      label="خصوصية الحساب" sub="إعدادات رؤية ملفك الشخصي"
                      onPress={() => showAlert('قريباً', 'هذه الميزة ستكون متاحة قريباً')}
                    />
                    <View style={cardStyles.divider} />
                    <RowItem
                      icon="verified-user" iconBg="rgba(59,130,246,0.12)"
                      label="التحقق بخطوتين" sub="تأمين إضافي لحسابك"
                      onPress={() => showAlert('قريباً', 'التحقق بخطوتين سيكون متاحاً قريباً')}
                    />
                  </SectionCard>

                  {/* ── About ── */}
                  <Text style={styles.groupTitle}>حول التطبيق</Text>
                  <SectionCard>
                    <RowItem
                      icon="info" iconBg="rgba(59,130,246,0.12)"
                      label="عن تك توكي" sub="الإصدار 1.0.0"
                      onPress={() => showAlert('تك توكي - Tuk Tuky', 'الإصدار 1.0.0\nجميع الحقوق محفوظة 2025')}
                    />
                    <View style={cardStyles.divider} />
                    <RowItem
                      icon="help-outline" iconBg="rgba(232,160,32,0.12)"
                      label="المساعدة والدعم" sub="مركز المساعدة والتواصل"
                      onPress={() => showAlert('الدعم', 'تواصل معنا على: support@tuktuky.com')}
                    />
                    <View style={cardStyles.divider} />
                    <RowItem
                      icon="privacy-tip" iconBg="rgba(139,92,246,0.12)"
                      label="سياسة الخصوصية"
                      onPress={() => showAlert('قريباً', 'سياسة الخصوصية ستكون متاحة قريباً')}
                    />
                  </SectionCard>

                  {/* ── Danger Zone ── */}
                  <Text style={[styles.groupTitle, { color: Colors.error }]}>منطقة الخطر</Text>
                  <SectionCard style={styles.dangerCard}>
                    <RowItem
                      icon="delete-forever" iconBg="rgba(239,68,68,0.12)"
                      label="حذف الحساب نهائياً" sub="سيتم حذف جميع بياناتك نهائياً"
                      onPress={handleDeleteAccount}
                      danger
                    />
                  </SectionCard>

                  {/* ── Logout ── */}
                  <TouchableOpacity style={styles.logoutBtn} onPress={() => {
                    showAlert('تسجيل الخروج', 'هل تريد تسجيل الخروج؟', [
                      { text: 'إلغاء', style: 'cancel' },
                      { text: 'خروج', style: 'destructive', onPress: () => { logout(); router.replace('/'); } },
                    ]);
                  }} activeOpacity={0.85}>
                    <LinearGradient colors={['rgba(239,68,68,0.18)', 'rgba(239,68,68,0.08)']} style={styles.logoutGrad}>
                      <MaterialIcons name="logout" size={20} color={Colors.error} />
                      <Text style={styles.logoutText}>تسجيل الخروج</Text>
                    </LinearGradient>
                  </TouchableOpacity>

                  <Text style={styles.versionText}>تك توكي · الإصدار 1.0.0 · 2025</Text>
                </>
              )}
            </>
          )}

          {/* ════════════ PROFILE EDIT ════════════ */}
          {section === 'profile' && (
            <>
              {/* Avatar */}
              <View style={styles.editAvatarSection}>
                <TouchableOpacity onPress={handlePickAvatar} activeOpacity={0.85} disabled={uploadingAvatar}>
                  <View style={styles.editAvatarWrap}>
                    {uploadingAvatar ? (
                      <View style={[styles.editAvatar, styles.editAvatarLoader]}>
                        <ActivityIndicator color={Colors.accent} size="large" />
                      </View>
                    ) : (
                      <Image
                        source={avatarUrl
                          ? { uri: avatarUrl }
                          : { uri: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&h=120&fit=crop&crop=face' }
                        }
                        style={styles.editAvatar}
                        contentFit="cover"
                        transition={200}
                      />
                    )}
                    <View style={styles.editAvatarCam}>
                      <MaterialIcons name="camera-alt" size={16} color="#fff" />
                    </View>
                  </View>
                </TouchableOpacity>
                <Text style={styles.editAvatarHint}>اضغط لتغيير الصورة الشخصية</Text>
                {uploadingAvatar && (
                  <Text style={styles.editAvatarUploading}>جاري رفع الصورة...</Text>
                )}
              </View>

              <Text style={styles.groupTitle}>المعلومات الشخصية</Text>
              <SectionCard>
                {[
                  { label: 'الاسم الكامل', value: name, onChange: setName, placeholder: 'اسمك الكامل', icon: 'person', keyboard: 'default' as any },
                  { label: 'رقم الهاتف', value: phone, onChange: setPhone, placeholder: '01XXXXXXXXX', icon: 'phone', keyboard: 'phone-pad' as any },
                  { label: 'البريد الإلكتروني', value: email, onChange: setEmail, placeholder: 'example@email.com', icon: 'email', keyboard: 'email-address' as any },
                ].map((field, i, arr) => (
                  <View key={i}>
                    <View style={styles.inputField}>
                      <TextInput
                        style={styles.fieldInput}
                        value={field.value}
                        onChangeText={field.onChange}
                        placeholder={field.placeholder}
                        placeholderTextColor="rgba(255,255,255,0.25)"
                        textAlign="right"
                        keyboardType={field.keyboard}
                        autoCapitalize="none"
                      />
                      <Text style={styles.fieldLabel}>{field.label}</Text>
                      <View style={[cardStyles.iconWrap, { backgroundColor: 'rgba(232,160,32,0.1)', marginRight: 0, marginLeft: Spacing.sm }]}>
                        <MaterialIcons name={field.icon as any} size={18} color={Colors.accent} />
                      </View>
                    </View>
                    {i < arr.length - 1 && <View style={cardStyles.divider} />}
                  </View>
                ))}
              </SectionCard>

              <TouchableOpacity
                style={[styles.saveBtn, savingProfile && { opacity: 0.7 }]}
                onPress={handleSaveProfile}
                disabled={savingProfile}
                activeOpacity={0.88}
              >
                <LinearGradient colors={['#FFD050', '#E8A020', '#C47D0A']} style={styles.saveBtnGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                  {savingProfile ? (
                    <ActivityIndicator color={Colors.bgDark} size="small" />
                  ) : (
                    <MaterialIcons name="check" size={20} color={Colors.bgDark} />
                  )}
                  <Text style={styles.saveBtnText}>
                    {savingProfile ? 'جاري الحفظ...' : 'حفظ التغييرات'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </>
          )}

          {/* ════════════ CHANGE PASSWORD ════════════ */}
          {section === 'password' && (
            <>
              {/* Security Badge */}
              <View style={styles.securityBadge}>
                <LinearGradient colors={['rgba(245,158,11,0.15)', 'rgba(245,158,11,0.05)']} style={styles.securityBadgeGrad}>
                  <MaterialIcons name="lock" size={26} color={Colors.warning} />
                  <View>
                    <Text style={styles.securityBadgeTitle}>تغيير كلمة المرور</Text>
                    <Text style={styles.securityBadgeSub}>تأكد من إدخال كلمة مرورك الحالية أولاً</Text>
                  </View>
                </LinearGradient>
              </View>

              <Text style={styles.groupTitle}>كلمات المرور</Text>
              <SectionCard>
                {[
                  { label: 'كلمة المرور الحالية', value: currentPass, set: setCurrentPass, show: showCurrent, toggle: () => setShowCurrent(v => !v), placeholder: '••••••••' },
                  { label: 'كلمة المرور الجديدة', value: newPass, set: setNewPass, show: showNew, toggle: () => setShowNew(v => !v), placeholder: '6 أحرف على الأقل' },
                  { label: 'تأكيد كلمة المرور', value: confirmPass, set: setConfirmPass, show: showConfirm, toggle: () => setShowConfirm(v => !v), placeholder: 'أعد الإدخال' },
                ].map((field, i, arr) => (
                  <View key={i}>
                    <View style={styles.inputField}>
                      <TouchableOpacity onPress={field.toggle} style={styles.eyeBtn}>
                        <MaterialIcons
                          name={field.show ? 'visibility-off' : 'visibility'}
                          size={18}
                          color="rgba(255,255,255,0.35)"
                        />
                      </TouchableOpacity>
                      <TextInput
                        style={[styles.fieldInput, { flex: 1 }]}
                        value={field.value}
                        onChangeText={field.set}
                        placeholder={field.placeholder}
                        placeholderTextColor="rgba(255,255,255,0.25)"
                        secureTextEntry={!field.show}
                        textAlign="right"
                      />
                      <Text style={styles.fieldLabel}>{field.label}</Text>
                    </View>
                    {i < arr.length - 1 && <View style={cardStyles.divider} />}
                  </View>
                ))}
              </SectionCard>

              {/* Password Strength */}
              {newPass.length > 0 && (
                <View style={styles.strengthCard}>
                  <View style={styles.strengthHeader}>
                    <Text style={[styles.strengthLabel, { color: passStrengthColor }]}>{passStrength}</Text>
                    <Text style={styles.strengthTitle}>قوة كلمة المرور</Text>
                  </View>
                  <View style={styles.strengthTrack}>
                    <View style={[styles.strengthFill, { width: passStrengthWidth as any, backgroundColor: passStrengthColor }]} />
                  </View>
                  <View style={styles.strengthRules}>
                    {[
                      { rule: 'على الأقل 6 أحرف', ok: newPass.length >= 6 },
                      { rule: 'أرقام وحروف', ok: /[a-zA-Z]/.test(newPass) && /\d/.test(newPass) },
                      { rule: 'رمز خاص (!@#$)', ok: /[!@#$%^&*]/.test(newPass) },
                    ].map((r, i) => (
                      <View key={i} style={styles.ruleRow}>
                        <MaterialIcons name={r.ok ? 'check-circle' : 'radio-button-unchecked'} size={13} color={r.ok ? Colors.success : 'rgba(255,255,255,0.25)'} />
                        <Text style={[styles.ruleText, r.ok && styles.ruleTextOk]}>{r.rule}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Match indicator */}
              {confirmPass.length > 0 && (
                <View style={[styles.matchBadge, { borderColor: newPass === confirmPass ? Colors.success + '40' : Colors.error + '40' }]}>
                  <MaterialIcons
                    name={newPass === confirmPass ? 'check-circle' : 'cancel'}
                    size={15}
                    color={newPass === confirmPass ? Colors.success : Colors.error}
                  />
                  <Text style={[styles.matchText, { color: newPass === confirmPass ? Colors.success : Colors.error }]}>
                    {newPass === confirmPass ? 'كلمتا المرور متطابقتان' : 'كلمتا المرور غير متطابقتين'}
                  </Text>
                </View>
              )}

              <TouchableOpacity
                style={[styles.saveBtn, savingPass && { opacity: 0.7 }]}
                onPress={handleChangePassword}
                disabled={savingPass}
                activeOpacity={0.88}
              >
                <LinearGradient colors={['#FFD050', '#E8A020', '#C47D0A']} style={styles.saveBtnGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                  {savingPass ? (
                    <ActivityIndicator color={Colors.bgDark} size="small" />
                  ) : (
                    <MaterialIcons name="lock-reset" size={20} color={Colors.bgDark} />
                  )}
                  <Text style={styles.saveBtnText}>
                    {savingPass ? 'جاري التحقق والتغيير...' : 'تغيير كلمة المرور'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </>
          )}

          {/* ════════════ APPEARANCE ════════════ */}
          {section === 'appearance' && (
            <>
              <View style={styles.appearanceBanner}>
                <LinearGradient colors={['rgba(139,92,246,0.15)', 'rgba(139,92,246,0.05)']} style={styles.appearanceBannerGrad}>
                  <MaterialIcons name="palette" size={28} color="#8B5CF6" />
                  <View>
                    <Text style={styles.appearanceBannerTitle}>تخصيص المظهر</Text>
                    <Text style={styles.appearanceBannerSub}>اختر المظهر الذي يناسبك</Text>
                  </View>
                </LinearGradient>
              </View>

              <Text style={styles.groupTitle}>وضع العرض</Text>
              <SectionCard>
                {[
                  { id: 'dark', label: 'الوضع الليلي', sub: 'خلفية داكنة - مريح للعينين ليلاً', icon: 'dark-mode', color: '#8B5CF6' },
                  { id: 'light', label: 'الوضع النهاري', sub: 'خلفية فاتحة - مثالي في الضوء', icon: 'light-mode', color: Colors.warning },
                  { id: 'auto', label: 'تلقائي', sub: 'يتبع إعداد جهازك', icon: 'brightness-auto', color: Colors.primary },
                ].map((mode, i, arr) => (
                  <View key={mode.id}>
                    <TouchableOpacity
                      style={cardStyles.row}
                      onPress={() => setDarkMode(mode.id === 'dark')}
                      activeOpacity={0.85}
                    >
                      <View style={[cardStyles.radio, (darkMode ? mode.id === 'dark' : mode.id === 'light') && cardStyles.radioActive]}>
                        {(darkMode ? mode.id === 'dark' : mode.id === 'light') && <View style={cardStyles.radioInner} />}
                      </View>
                      <View style={cardStyles.rowBody}>
                        <Text style={cardStyles.rowLabel}>{mode.label}</Text>
                        <Text style={cardStyles.rowSub}>{mode.sub}</Text>
                      </View>
                      <View style={[cardStyles.iconWrap, { backgroundColor: mode.color + '15' }]}>
                        <MaterialIcons name={mode.icon as any} size={18} color={mode.color} />
                      </View>
                    </TouchableOpacity>
                    {i < arr.length - 1 && <View style={cardStyles.divider} />}
                  </View>
                ))}
              </SectionCard>

              <Text style={styles.groupTitle}>حجم الخط</Text>
              <SectionCard>
                {[
                  { id: 'sm', label: 'صغير', preview: '14px' },
                  { id: 'md', label: 'متوسط', preview: '16px' },
                  { id: 'lg', label: 'كبير', preview: '18px' },
                ].map((size, i, arr) => (
                  <View key={size.id}>
                    <TouchableOpacity style={cardStyles.row} activeOpacity={0.85}
                      onPress={() => showAlert('قريباً', 'تغيير حجم الخط سيكون متاحاً قريباً')}>
                      <View style={[cardStyles.radio, size.id === 'md' && cardStyles.radioActive]}>
                        {size.id === 'md' && <View style={cardStyles.radioInner} />}
                      </View>
                      <View style={cardStyles.rowBody}>
                        <Text style={cardStyles.rowLabel}>{size.label}</Text>
                        <Text style={cardStyles.rowSub}>{size.preview}</Text>
                      </View>
                    </TouchableOpacity>
                    {i < arr.length - 1 && <View style={cardStyles.divider} />}
                  </View>
                ))}
              </SectionCard>

              <TouchableOpacity
                style={styles.saveBtn}
                onPress={() => { showAlert('تم الحفظ', 'تم حفظ إعدادات المظهر'); setSection('main'); }}
                activeOpacity={0.88}
              >
                <LinearGradient colors={['#FFD050', '#E8A020', '#C47D0A']} style={styles.saveBtnGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                  <MaterialIcons name="check" size={20} color={Colors.bgDark} />
                  <Text style={styles.saveBtnText}>حفظ إعدادات المظهر</Text>
                </LinearGradient>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── Skeleton styles ──────────────────────────────────────────────────────────
const skeletonStyles = StyleSheet.create({
  profileCard: {
    borderRadius: 16, overflow: 'hidden',
    marginBottom: 16, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  profileCardGrad: {
    flexDirection: 'row-reverse', alignItems: 'center',
    padding: 16, gap: 14,
  },
  card: {
    backgroundColor: '#1A2235', borderRadius: 16,
    marginBottom: 6, padding: 4,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  row: {
    flexDirection: 'row-reverse', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 16, gap: 12,
  },
});

// ─── Shared card styles ───────────────────────────────────────────────────────
const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: '#1A2235', borderRadius: BorderRadius.xl,
    marginBottom: Spacing.xs, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  row: {
    flexDirection: 'row-reverse', alignItems: 'center',
    paddingHorizontal: Spacing.md, paddingVertical: 14, gap: Spacing.sm,
  },
  switchRow: {
    flexDirection: 'row-reverse', alignItems: 'center',
    paddingHorizontal: Spacing.md, paddingVertical: 12, gap: Spacing.sm,
  },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginHorizontal: Spacing.md },
  iconWrap: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rowBody: { flex: 1 },
  rowLabel: { fontSize: Typography.base, fontFamily: 'Tajawal_700Bold', color: '#fff', textAlign: 'right' },
  rowSub: { fontSize: Typography.xs, color: 'rgba(255,255,255,0.4)', textAlign: 'right', marginTop: 2, fontFamily: 'Tajawal_400Regular' },
  danger: { color: Colors.error },
  radio: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  radioActive: { borderColor: Colors.accent },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.accent },
});

// ─── Screen styles ────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F1218' },

  // Header
  header: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.md },
  headerRow: {
    flexDirection: 'row-reverse', alignItems: 'center',
    justifyContent: 'space-between', paddingVertical: Spacing.md,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  refreshBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,208,80,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { color: '#fff', fontSize: Typography.xl, fontFamily: 'Tajawal_800ExtraBold' },

  // Scroll
  scroll: { padding: Spacing.md },

  // Group title
  groupTitle: {
    fontSize: Typography.xs, fontFamily: 'Tajawal_700Bold',
    color: 'rgba(255,255,255,0.35)',
    textAlign: 'right', marginBottom: 6, marginTop: Spacing.md,
    paddingHorizontal: 4, letterSpacing: 0.5,
  },

  // Profile Card
  profileCard: { borderRadius: BorderRadius.xl, overflow: 'hidden', marginBottom: Spacing.md, borderWidth: 1, borderColor: 'rgba(255,208,80,0.12)' },
  profileCardGrad: { flexDirection: 'row-reverse', alignItems: 'center', padding: Spacing.md, gap: Spacing.md },
  profileAvatarWrap: { position: 'relative' },
  profileAvatar: { width: 62, height: 62, borderRadius: 31, borderWidth: 2, borderColor: Colors.accent + '50' },
  onlineDot: {
    position: 'absolute', bottom: 2, right: 2,
    width: 13, height: 13, borderRadius: 7,
    backgroundColor: Colors.success, borderWidth: 2, borderColor: '#1A2235',
  },
  profileInfo: { flex: 1 },
  profileName: { color: '#fff', fontSize: Typography.lg, fontFamily: 'Tajawal_700Bold', textAlign: 'right' },
  profileEmail: { color: 'rgba(255,255,255,0.4)', fontSize: Typography.xs, fontFamily: 'Tajawal_400Regular', textAlign: 'right', marginTop: 2 },
  profilePhone: { color: 'rgba(255,255,255,0.35)', fontSize: Typography.xs, fontFamily: 'Tajawal_400Regular', textAlign: 'right', marginTop: 1 },
  profileBadge: { flexDirection: 'row-reverse', alignItems: 'center', gap: 5, marginTop: 5 },
  profileBadgeDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.success },
  profileBadgeText: { color: Colors.success, fontSize: Typography.xs, fontFamily: 'Tajawal_500Medium' },
  editProfileBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: 'rgba(255,208,80,0.1)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,208,80,0.2)',
  },

  // Lang
  langFlag: { fontSize: 22 },

  // Danger
  dangerCard: { borderColor: Colors.error + '20', borderWidth: 1 },

  // Logout
  logoutBtn: { borderRadius: BorderRadius.lg, overflow: 'hidden', marginTop: Spacing.md, marginBottom: Spacing.xs },
  logoutGrad: {
    flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center',
    gap: 10, paddingVertical: 16, borderRadius: BorderRadius.lg,
    borderWidth: 1, borderColor: Colors.error + '30',
  },
  logoutText: { color: Colors.error, fontSize: Typography.md, fontFamily: 'Tajawal_700Bold' },

  // Version
  versionText: {
    textAlign: 'center', color: 'rgba(255,255,255,0.2)',
    fontSize: Typography.xs, fontFamily: 'Tajawal_400Regular', marginTop: Spacing.sm,
  },

  // Edit Profile
  editAvatarSection: { alignItems: 'center', marginBottom: Spacing.lg },
  editAvatarWrap: { position: 'relative' },
  editAvatar: { width: 96, height: 96, borderRadius: 48, borderWidth: 2.5, borderColor: Colors.accent + '50' },
  editAvatarLoader: { backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center' },
  editAvatarCam: {
    position: 'absolute', bottom: 0, right: 0,
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#1A2235',
  },
  editAvatarHint: { color: 'rgba(255,255,255,0.35)', fontSize: Typography.xs, fontFamily: 'Tajawal_400Regular', marginTop: 8 },
  editAvatarUploading: { color: Colors.accent, fontSize: Typography.xs, fontFamily: 'Tajawal_500Medium', marginTop: 4 },

  // Input Fields
  inputField: {
    flexDirection: 'row-reverse', alignItems: 'center',
    paddingHorizontal: Spacing.md, paddingVertical: 10, gap: 6,
  },
  fieldLabel: { color: 'rgba(255,255,255,0.4)', fontSize: Typography.xs, fontFamily: 'Tajawal_500Medium', textAlign: 'right', minWidth: 110 },
  fieldInput: { flex: 1, color: '#fff', fontSize: Typography.base, fontFamily: 'Tajawal_500Medium', paddingVertical: 6 },
  eyeBtn: { padding: 6 },

  // Save Button
  saveBtn: { borderRadius: BorderRadius.lg, overflow: 'hidden', marginTop: Spacing.md, ...Shadows.lg },
  saveBtnGrad: {
    flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center',
    gap: 10, paddingVertical: 16,
  },
  saveBtnText: { color: Colors.bgDark, fontSize: Typography.md, fontFamily: 'Tajawal_800ExtraBold' },

  // Security Badge
  securityBadge: { borderRadius: BorderRadius.lg, overflow: 'hidden', marginBottom: Spacing.md },
  securityBadgeGrad: { flexDirection: 'row-reverse', alignItems: 'center', gap: Spacing.md, padding: Spacing.md, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: 'rgba(245,158,11,0.2)' },
  securityBadgeTitle: { color: '#fff', fontSize: Typography.md, fontFamily: 'Tajawal_700Bold', textAlign: 'right' },
  securityBadgeSub: { color: 'rgba(255,255,255,0.4)', fontSize: Typography.xs, fontFamily: 'Tajawal_400Regular', textAlign: 'right' },

  // Strength
  strengthCard: {
    backgroundColor: '#1A2235', borderRadius: BorderRadius.lg,
    padding: Spacing.md, marginTop: Spacing.sm,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  strengthHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  strengthTitle: { color: 'rgba(255,255,255,0.55)', fontSize: Typography.xs, fontFamily: 'Tajawal_500Medium' },
  strengthLabel: { fontSize: Typography.sm, fontFamily: 'Tajawal_700Bold' },
  strengthTrack: { height: 6, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden', marginBottom: Spacing.sm },
  strengthFill: { height: '100%', borderRadius: 3 },
  strengthRules: { gap: 5 },
  ruleRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 7 },
  ruleText: { color: 'rgba(255,255,255,0.35)', fontSize: Typography.xs, fontFamily: 'Tajawal_400Regular' },
  ruleTextOk: { color: Colors.success },

  // Match Badge
  matchBadge: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: 7,
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: BorderRadius.md,
    padding: Spacing.sm, marginTop: Spacing.xs, borderWidth: 1,
  },
  matchText: { fontSize: Typography.xs, fontFamily: 'Tajawal_500Medium' },

  // Appearance
  appearanceBanner: { borderRadius: BorderRadius.lg, overflow: 'hidden', marginBottom: Spacing.md },
  appearanceBannerGrad: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: Spacing.md,
    padding: Spacing.md, borderRadius: BorderRadius.lg,
    borderWidth: 1, borderColor: 'rgba(139,92,246,0.2)',
  },
  appearanceBannerTitle: { color: '#fff', fontSize: Typography.md, fontFamily: 'Tajawal_700Bold', textAlign: 'right' },
  appearanceBannerSub: { color: 'rgba(255,255,255,0.4)', fontSize: Typography.xs, fontFamily: 'Tajawal_400Regular', textAlign: 'right' },
});
