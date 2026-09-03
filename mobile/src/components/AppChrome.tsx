import { Image } from 'expo-image';
import { router, usePathname } from 'expo-router';
import { Library, Music, Search, Sparkles, UserRound } from 'lucide-react-native';
import { Keyboard, Pressable, StyleSheet, Text, View } from 'react-native';
import { useEffect, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const avatar = require('../../assets/figma/onboarding-hero.png');
const GREEN = '#53E076';
const MUTED = '#BCCBB9';

export function AppHeader() {
  return (
    <View style={styles.header}>
      <Music color={MUTED} size={22} strokeWidth={2} />
      <Text style={styles.logo}>Spot.AI</Text>
      <Pressable onPress={() => router.push('/settings')} accessibilityLabel="Abrir configurações">
        <Image source={avatar} style={styles.avatar} contentFit="cover" />
      </Pressable>
    </View>
  );
}

export function BottomNav() {
  const path = usePathname();
  const insets = useSafeAreaInsets();
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => { show.remove(); hide.remove(); };
  }, []);
  const items = [
    { label: 'Inicio', route: '/home' as const, Icon: Sparkles },
    { label: 'Buscar', route: '/browse' as const, Icon: Search },
    { label: 'Biblioteca', route: '/library' as const, Icon: Library },
    { label: 'Perfil', route: '/settings' as const, Icon: UserRound },
  ];
  if (keyboardVisible) return null;
  return (
    <View style={[styles.nav, { height: 68 + insets.bottom, paddingBottom: Math.max(insets.bottom, 8) }]}>
      {items.map(({ label, route, Icon }) => {
        const active = path === route;
        return (
          <Pressable key={route} onPress={() => router.replace(route)} style={styles.navItem} accessibilityLabel={label}>
            <Icon color={active ? GREEN : MUTED} size={22} strokeWidth={active ? 2.4 : 1.8} />
            <Text style={[styles.navLabel, active && styles.navLabelActive]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { height: 64, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)', backgroundColor: 'rgba(19,19,19,0.96)' },
  logo: { color: GREEN, fontSize: 24, fontWeight: '800' },
  avatar: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  nav: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)', backgroundColor: '#171717' },
  navItem: { minWidth: 62, height: 56, alignItems: 'center', justifyContent: 'center', gap: 4 },
  navLabel: { color: MUTED, fontSize: 10 },
  navLabelActive: { color: GREEN },
});
