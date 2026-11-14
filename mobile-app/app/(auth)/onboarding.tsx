import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  useWindowDimensions,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import Colors from '../../constants/colors';
import { Shadows } from '../../constants/theme';
import Button from '../../components/ui/Button';
import {
  Sparkles,
  ShoppingBag,
  TrendingUp,
  Mic,
  Users,
  CheckCircle,
} from 'lucide-react-native';

const SLIDES = [
  {
    icon: <Sparkles size={32} color={Colors.black} />,
    title: 'Manage Your Shop Using AI',
    description: 'Ask questions in Hindi, Hinglish, Marathi, or English. Get immediate answers on sales, stock, and profits.',
    badge: 'AI-POWERED',
  },
  {
    icon: <ShoppingBag size={32} color={Colors.black} />,
    title: 'POS Billing & Real-Time Stock',
    description: 'Fast mobile counter checkout, barcode scanning, print receipts, and instant WhatsApp bill sharing.',
    badge: 'FAST CHECKOUT',
  },
  {
    icon: <Mic size={32} color={Colors.black} />,
    title: 'Voice-First Stock In / Out',
    description: 'Just say "50 packet Maggi stock aaya". Confirm on screen and your shared database updates instantly.',
    badge: 'VOICE INVENTORY',
  },
  {
    icon: <Users size={32} color={Colors.black} />,
    title: 'Customer Ledger & Udhar Tracker',
    description: 'Track customer balances, send WhatsApp payment reminders, and keep clean purchase histories.',
    badge: 'UDHAR & KHATA',
  },
  {
    icon: <TrendingUp size={32} color={Colors.black} />,
    title: 'Forecasts & Festival Alerts',
    description: 'Know what will sell before Diwali, Eid, or local festivals. Never run out of high-demand items.',
    badge: 'DEMAND INTELLIGENCE',
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [activeSlide, setActiveSlide] = useState(0);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Image
          source={require('../../assets/logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
      </View>

      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={(e) => {
          const slide = Math.round(e.nativeEvent.contentOffset.x / width);
          setActiveSlide(slide);
        }}
        scrollEventThrottle={16}
        style={styles.slider}
      >
        {SLIDES.map((slide, idx) => (
          <View key={idx} style={[styles.slide, { width }]}>
            <View style={styles.card}>
              <View style={styles.badgeRow}>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{slide.badge}</Text>
                </View>
                <View style={styles.iconCircle}>{slide.icon}</View>
              </View>

              <Text style={styles.slideTitle}>{slide.title}</Text>
              <Text style={styles.slideDesc}>{slide.description}</Text>

              <View style={styles.benefitList}>
                <View style={styles.benefitItem}>
                  <CheckCircle size={16} color={Colors.limeDark} />
                  <Text style={styles.benefitText}>Zero technical knowledge required</Text>
                </View>
                <View style={styles.benefitItem}>
                  <CheckCircle size={16} color={Colors.limeDark} />
                  <Text style={styles.benefitText}>Syncs directly with Web & Store Database</Text>
                </View>
              </View>
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Slide indicators */}
      <View style={styles.dots}>
        {SLIDES.map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              activeSlide === i && styles.dotActive,
            ]}
          />
        ))}
      </View>

      <View style={styles.footer}>
        <Button
          title="Login to Existing Store"
          variant="primary"
          size="lg"
          onPress={() => router.push('/(auth)/login')}
          style={styles.btn}
        />
        <Button
          title="Create New Store Account"
          variant="outline"
          size="lg"
          onPress={() => router.push('/(auth)/setup-store')}
          style={styles.btn}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.warmBg,
    paddingTop: 40,
    justifyContent: 'space-between',
  },
  header: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  logo: {
    width: 220,
    height: 70,
  },
  slider: {
    flexGrow: 0,
  },
  slide: {
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  card: {
    backgroundColor: Colors.white,
    borderWidth: 2,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: 24,
    ...Shadows.brutalLg,
  },
  badgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  badge: {
    backgroundColor: Colors.lime,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.black,
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: Colors.border,
    backgroundColor: Colors.warmBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slideTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: Colors.textMain,
    marginBottom: 10,
    letterSpacing: -0.5,
  },
  slideDesc: {
    fontSize: 14,
    color: Colors.textMuted,
    lineHeight: 22,
    marginBottom: 20,
  },
  benefitList: {
    gap: 10,
    paddingTop: 12,
    borderTopWidth: 1,
    borderColor: Colors.borderLight,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  benefitText: {
    fontSize: 12,
    color: Colors.textMain,
    fontWeight: '600',
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginVertical: 16,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
  },
  dotActive: {
    backgroundColor: Colors.black,
    width: 24,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    gap: 12,
  },
  btn: {
    width: '100%',
  },
});
