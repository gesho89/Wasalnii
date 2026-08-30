import { MaterialIcons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Platform, View, StyleSheet } from 'react-native';
import { Colors, Typography } from '@/constants/theme';
import { LinearGradient } from 'expo-linear-gradient';

function HomeTabIcon({ focused }: { focused: boolean }) {
  return (
    <View style={[
      homeIconStyles.wrap,
      focused ? homeIconStyles.wrapActive : homeIconStyles.wrapInactive,
    ]}>
      {focused ? (
        <LinearGradient
          colors={['#FFD050', '#E8A020', '#C47D0A']}
          style={homeIconStyles.grad}
        >
          <MaterialIcons name="home" size={26} color={Colors.bgDark} />
        </LinearGradient>
      ) : (
        <MaterialIcons name="home-outlined" size={24} color="rgba(255,255,255,0.45)" />
      )}
    </View>
  );
}

const homeIconStyles = StyleSheet.create({
  wrap: {
    width: 52, height: 52, borderRadius: 26,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 2,
  },
  wrapActive: {
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
  },
  wrapInactive: {},
  grad: {
    width: 52, height: 52, borderRadius: 26,
    alignItems: 'center', justifyContent: 'center',
  },
});

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  const tabBarStyle = {
    height: Platform.select({ ios: insets.bottom + 68, android: insets.bottom + 68, default: 74 }),
    paddingTop: 6,
    paddingBottom: Platform.select({ ios: insets.bottom + 8, android: insets.bottom + 8, default: 8 }),
    // Dark TukTuki identity
    backgroundColor: Colors.bgDark,
    borderTopWidth: 1,
    borderTopColor: 'rgba(232,160,32,0.2)',
    elevation: 24,
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
  };

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle,
        tabBarActiveTintColor: Colors.accent,
        tabBarInactiveTintColor: 'rgba(255,255,255,0.38)',
        tabBarLabelStyle: {
          fontSize: Typography.xs,
          fontFamily: 'Tajawal_700Bold',
          marginTop: 1,
        },
      }}
    >
      <Tabs.Screen
        name="profile"
        options={{
          title: 'حسابي',
          tabBarIcon: ({ color, focused }) => (
            <MaterialIcons
              name={focused ? 'person' : 'person-outline'}
              size={24}
              color={focused ? Colors.accent : 'rgba(255,255,255,0.38)'}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="trips"
        options={{
          title: 'رحلاتي',
          tabBarIcon: ({ focused }) => (
            <MaterialIcons
              name={focused ? 'history' : 'history'}
              size={24}
              color={focused ? Colors.accent : 'rgba(255,255,255,0.38)'}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          title: 'الرئيسية',
          tabBarIcon: ({ focused }) => <HomeTabIcon focused={focused} />,
          tabBarItemStyle: {
            paddingTop: 0,
            marginTop: -8,
          },
          tabBarLabelStyle: {
            fontSize: Typography.xs,
            fontFamily: 'Tajawal_800ExtraBold',
            color: Colors.accent,
            marginTop: 2,
          },
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: 'الطلبات',
          tabBarIcon: ({ focused }) => (
            <MaterialIcons
              name={focused ? 'list-alt' : 'list-alt'}
              size={24}
              color={focused ? Colors.accent : 'rgba(255,255,255,0.38)'}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="wallet"
        options={{
          title: 'المحفظة',
          tabBarIcon: ({ focused }) => (
            <MaterialIcons
              name={focused ? 'account-balance-wallet' : 'account-balance-wallet'}
              size={24}
              color={focused ? Colors.accent : 'rgba(255,255,255,0.38)'}
            />
          ),
        }}
      />
    </Tabs>
  );
}
