import { HankenGrotesk_400Regular, HankenGrotesk_500Medium, HankenGrotesk_600SemiBold } from '@expo-google-fonts/hanken-grotesk';
import { PlusJakartaSans_700Bold, PlusJakartaSans_800ExtraBold } from '@expo-google-fonts/plus-jakarta-sans';
import { useFonts } from 'expo-font';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const heroImage = require('../assets/figma/onboarding-hero.png');
const soundwaveIcon = require('../assets/figma/soundwave.svg');
const sparklesIcon = require('../assets/figma/sparkles.svg');
const brandIcon = require('../assets/figma/brand-wave.svg');
const spotifyIcon = require('../assets/figma/spotify.svg');

export default function WelcomeScreen() {
  const { width, height } = useWindowDimensions();
  const [fontsLoaded] = useFonts({ HankenGrotesk_400Regular, HankenGrotesk_500Medium, HankenGrotesk_600SemiBold, PlusJakartaSans_700Bold, PlusJakartaSans_800ExtraBold });
  const canvasWidth = Math.min(width, 448);
  const heroSize = Math.min(canvasWidth - 40, Math.max(260, height * 0.44), 400);
  const compact = height < 760;

  if (!fontsLoaded) return <View style={styles.loading} />;

  const openChat = () => router.push('/home');

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <StatusBar style="light" />
      <View style={[styles.canvas, { width: canvasWidth }]}>
        <View style={[styles.hero, { height: heroSize + (compact ? 4 : 16) }]}>
          <View style={[styles.glow, { width: heroSize * 0.76, height: heroSize * 0.76 }]} />
          <Image source={heroImage} style={[styles.heroImage, { width: heroSize, height: heroSize }]} contentFit="cover" />
          <View style={[styles.floatingIcon, styles.soundwave, { left: Math.max(38, (canvasWidth - heroSize) / 2 + 18) }]}>
            <Image source={soundwaveIcon} style={styles.smallIcon} contentFit="contain" />
          </View>
          <View style={[styles.floatingIcon, styles.sparkles, { right: Math.max(38, (canvasWidth - heroSize) / 2 + 18) }]}>
            <Image source={sparklesIcon} style={styles.smallIcon} contentFit="contain" />
          </View>
          <Pressable accessibilityRole="button" onPress={openChat} hitSlop={12} style={styles.signIn}>
            <Text style={styles.signInText}>Entrar</Text>
          </Pressable>
        </View>

        <View style={[styles.content, compact && styles.contentCompact]}>
          <View style={styles.brandPill}>
            <Image source={brandIcon} style={styles.brandIcon} contentFit="contain" />
            <Text style={styles.brandText}>SPOT.AI</Text>
          </View>
          <Text style={[styles.title, compact && styles.titleCompact]}>
            Sua música,{`\n`}<Text style={styles.titleAccent}>reimaginada pela{`\n`}IA</Text>
          </Text>
          <Text style={[styles.subtitle, compact && styles.subtitleCompact]}>
            Conecte seu Spotify e deixe nossa inteligência{`\n`}artificial encontrar sua próxima obsessão{`\n`}musical.
          </Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Conectar Spotify" onPress={openChat} style={({ pressed }) => [styles.spotifyButton, pressed && styles.spotifyButtonPressed]}>
            <Image source={spotifyIcon} style={styles.spotifyIcon} contentFit="contain" />
            <Text style={styles.spotifyButtonText}>Conectar Spotify</Text>
          </Pressable>
          <Text style={styles.terms}>Ao conectar, você concorda com nossos Termos e{`\n`}Privacidade.</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, backgroundColor: '#131313' },
  screen: { flex: 1, alignItems: 'center', backgroundColor: '#131313' },
  canvas: { flex: 1, justifyContent: 'space-between' },
  hero: { alignItems: 'center', justifyContent: 'center', paddingTop: 4 },
  glow: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(83,224,118,0.16)', shadowColor: '#53E076', shadowOpacity: 0.4, shadowRadius: 48 },
  heroImage: { borderRadius: 999 },
  floatingIcon: { position: 'absolute', width: 48, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', backgroundColor: 'rgba(67,67,67,0.82)' },
  soundwave: { top: '24%' },
  sparkles: { bottom: '26%' },
  smallIcon: { width: 14, height: 14 },
  signIn: { position: 'absolute', right: 21, top: 6, padding: 8 },
  signInText: { color: '#BCCBB9', fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 14 },
  content: { alignItems: 'center', paddingTop: 32, paddingHorizontal: 21, paddingBottom: 30, borderTopLeftRadius: 32, borderTopRightRadius: 32, borderWidth: 1, borderBottomWidth: 0, borderColor: 'rgba(255,255,255,0.07)', backgroundColor: 'rgba(28,28,28,0.96)' },
  contentCompact: { paddingTop: 20, paddingBottom: 18 },
  brandPill: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 13, paddingVertical: 5, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', backgroundColor: '#201F1F' },
  brandIcon: { width: 12, height: 14 },
  brandText: { color: '#BCCBB9', fontFamily: 'HankenGrotesk_500Medium', fontSize: 12, letterSpacing: 1.2 },
  title: { marginTop: 16, color: '#E5E2E1', fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 40, lineHeight: 48, textAlign: 'center' },
  titleCompact: { marginTop: 10, fontSize: 34, lineHeight: 40 },
  titleAccent: { color: '#53E076' },
  subtitle: { marginTop: 16, color: '#BCCBB9', fontFamily: 'HankenGrotesk_400Regular', fontSize: 16, lineHeight: 24, textAlign: 'center' },
  subtitleCompact: { marginTop: 10, fontSize: 14, lineHeight: 20 },
  spotifyButton: { width: '100%', height: 60, marginTop: 32, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, borderRadius: 999, backgroundColor: '#53E076' },
  spotifyButtonPressed: { opacity: 0.82, transform: [{ scale: 0.99 }] },
  spotifyIcon: { width: 24, height: 24 },
  spotifyButtonText: { color: '#003914', fontFamily: 'PlusJakartaSans_700Bold', fontSize: 22 },
  terms: { marginTop: 15, color: 'rgba(188,203,185,0.5)', fontFamily: 'HankenGrotesk_500Medium', fontSize: 12, lineHeight: 16, textAlign: 'center' },
});
