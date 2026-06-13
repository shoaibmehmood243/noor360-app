import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Animated,
  Easing,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Svg, { Circle, Line, Polygon, Path, G, Text as SvgText } from 'react-native-svg';
import { Magnetometer } from 'expo-sensors';
import * as Haptics from 'expo-haptics';

import { usePrayerStore } from '../../src/store/prayerStore';
import { getQiblaBearing } from '../../src/api/client';
import { COLORS } from '../../constants/theme';
import { useThemeContext } from '../../src/context/ThemeContext';
import ScreenBackground from '../../components/ui/ScreenBackground';
import ArabicGeometricBg from '../../components/ui/ArabicGeometricBg';
import Card from '../../components/ui/Card';

export default function QiblaCompassScreen() {
  const { theme } = useThemeContext();
  const isDark = theme === 'dark';

  const prayerStore = usePrayerStore();
  const { lat, lon, city } = prayerStore.location;

  // Sensor subscription and calculated values
  const [subscription, setSubscription] = useState<any>(null);
  const [magnetometerData, setMagnetometerData] = useState({ x: 0, y: 0, z: 0 });
  const [sensorAccuracy, setSensorAccuracy] = useState<number>(3); // 3 = high accuracy, 0 = needs calibration

  // Qibla bearing from backend
  const [qiblaAngle, setQiblaAngle] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Animated values for smooth rotation
  const compassAnim = useRef(new Animated.Value(0)).current;
  const arrowAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Smoothing filters for sensor jitter
  const lastX = useRef(0);
  const lastY = useRef(0);
  const lastZ = useRef(0);

  // Fetch Qibla bearing from backend using coordinates
  useEffect(() => {
    fetchQiblaAngle();
  }, [lat, lon]);

  const calculateQiblaLocal = (latitude: number, longitude: number): number => {
    const phiK = 21.4225 * Math.PI / 180; // Kaaba Latitude in radians
    const lambdaK = 39.8262 * Math.PI / 180; // Kaaba Longitude in radians
    const phi = latitude * Math.PI / 180; // Current Latitude in radians
    const lambda = longitude * Math.PI / 180; // Current Longitude in radians
    const deltaLambda = lambdaK - lambda;

    const y = Math.sin(deltaLambda);
    const x = Math.cos(phi) * Math.tan(phiK) - Math.sin(phi) * Math.cos(deltaLambda);
    let qiblaRad = Math.atan2(y, x);
    let qiblaDeg = qiblaRad * 180 / Math.PI;

    return (qiblaDeg + 360) % 360;
  };

  const fetchQiblaAngle = async () => {
    try {
      setLoading(true);
      setError('');
      // Calculate locally first for instant display
      const localAngle = calculateQiblaLocal(lat, lon);
      setQiblaAngle(localAngle);

      // Verify with backend
      const angle = await getQiblaBearing(lat, lon);
      if (angle !== undefined && angle !== null) {
        setQiblaAngle(angle);
      }
    } catch (e: any) {
      console.warn('Qibla API failed, using local calculations:', e);
    } finally {
      setLoading(false);
    }
  };

  // Magnetometer subscriptions
  useEffect(() => {
    subscribeSensor();
    return () => unsubscribeSensor();
  }, []);

  const subscribeSensor = () => {
    Magnetometer.setUpdateInterval(50); // Increase update rate to 50ms for high responsiveness
    const sub = Magnetometer.addListener((data: any) => {
      // Exponential moving average filter (alpha = 0.15) for buttery-smooth rotation
      const alpha = 0.15;
      
      // Initialize if zero
      if (lastX.current === 0 && lastY.current === 0) {
        lastX.current = data.x;
        lastY.current = data.y;
        lastZ.current = data.z;
      } else {
        lastX.current = alpha * data.x + (1 - alpha) * lastX.current;
        lastY.current = alpha * data.y + (1 - alpha) * lastY.current;
        lastZ.current = alpha * data.z + (1 - alpha) * lastZ.current;
      }

      setMagnetometerData({ x: lastX.current, y: lastY.current, z: lastZ.current });
      
      if (data.accuracy !== undefined) {
        setSensorAccuracy(data.accuracy);
      }
    });
    setSubscription(sub);
  };

  const unsubscribeSensor = () => {
    if (subscription) {
      subscription.remove();
      setSubscription(null);
    }
  };

  // Loop pulsing animation for green glow
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.3,
          duration: 1000,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  // Calculate device heading
  const getDeviceHeading = () => {
    const { x, y } = magnetometerData;
    if (x === 0 && y === 0) return 0;

    // Calculate heading in radians and convert to degrees
    let headingRad = Math.atan2(y, x);
    let headingDeg = headingRad * (180 / Math.PI);

    // Normalize to 0-360 degrees
    let heading = (headingDeg + 360) % 360;
    return heading;
  };

  const deviceHeading = getDeviceHeading();
  const qiblaAngleVal = qiblaAngle !== null ? qiblaAngle : 21.42; // default Makkah coordinate bearing

  // Compass rotates counter-clockwise with device rotation to keep North facing real North
  const targetCompassRot = -deviceHeading;

  // Qibla pointer points toward Makkah relative to the device's current heading
  const targetArrowRot = qiblaAngleVal - deviceHeading;

  // Animate values smoothly to avoid jittering
  useEffect(() => {
    Animated.timing(compassAnim, {
      toValue: targetCompassRot,
      duration: 100,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();

    Animated.timing(arrowAnim, {
      toValue: targetArrowRot,
      duration: 100,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [targetCompassRot, targetArrowRot]);

  // Interpolate for transforms
  const rotateCompassStr = compassAnim.interpolate({
    inputRange: [-360, 360],
    outputRange: ['-360deg', '360deg'],
  });

  const rotateArrowStr = arrowAnim.interpolate({
    inputRange: [-360, 360],
    outputRange: ['-360deg', '360deg'],
  });

  // Calculate absolute direction difference
  const angleDiff = Math.abs((qiblaAngleVal - deviceHeading + 360) % 360);
  const isAligned = angleDiff <= 5 || angleDiff >= 355; // aligned within ±5 degrees

  const wasAligned = useRef(false);

  // Trigger haptic feedback when device aligns with Qibla
  useEffect(() => {
    let intervalId: any = null;
    if (isAligned) {
      if (!wasAligned.current) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        wasAligned.current = true;
      }
      // Simulate continuous magnetic lock feel with minor ticks
      intervalId = setInterval(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }, 700);
    } else {
      wasAligned.current = false;
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isAligned]);

  const getDirectionLabel = (deg: number) => {
    const index = Math.round(((deg % 360) + 360) % 360 / 45);
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    return directions[index % 8];
  };

  const currentHeadingLabel = getDirectionLabel(deviceHeading);
  const makkahBearingLabel = getDirectionLabel(qiblaAngleVal);

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'top']}>
      <ScreenBackground />
      {/* Arabic Geometric Overlay Background */}
      <ArabicGeometricBg size={400} style={styles.backgroundOverlay} />

      {/* Screen Header Segment */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/(tabs)/prayer');
            }
          }}
        >
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Qibla Finder</Text>
        <View style={{ width: 40 }} /> {/* Spacer */}
      </View>

      {/* Dynamic Calibration Banner (shown when magnetometer accuracy reports low) */}
      {sensorAccuracy <= 1 && (
        <Card style={styles.calibrationBanner}>
          <Ionicons name="warning" size={18} color={COLORS.gold} />
          <Text style={styles.calibrationText}>
            Sensor Accuracy Low. Wave your device in a figure-8 shape to calibrate the compass.
          </Text>
        </Card>
      )}

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.gold} />
          <Text style={styles.loadingText}>Fetching Kaaba alignment coordinates...</Text>
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Ionicons name="alert-circle" size={48} color={COLORS.text3} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchQiblaAngle}>
            <Text style={styles.retryText}>Retry Loading</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.mainContent}>

          {/* Compass Angle Display Info */}
          <View style={styles.degreeBox}>
            <Text style={styles.degreeText}>
              {Math.round(qiblaAngleVal)}° {makkahBearingLabel}
            </Text>
            <Text style={[styles.alignmentStatusLabel, isAligned && styles.alignedTextHighlight]}>
              {isAligned ? 'FACING MAKKAH AL-MUKARRAMAH' : 'ALIGN DEVICE POINTER'}
            </Text>
          </View>

          {/* Compass Visualiser Platform */}
          <View style={styles.compassPlatform}>

            {/* Green pulsing circular halo glow */}
            {isAligned && (
              <Animated.View
                style={[
                  styles.pulseRing,
                  {
                    transform: [{ scale: pulseAnim }],
                  },
                ]}
              />
            )}

            {/* Counter-rotating Compass Scale Plate */}
            <Animated.View
              style={[
                styles.compassRoseWrapper,
                { transform: [{ rotate: rotateCompassStr }] },
              ]}
            >
              <Svg width={280} height={280} viewBox="0 0 100 100">
                <Circle cx="50" cy="50" r="48" stroke={COLORS.bg3} strokeWidth="1" fill="none" />
                <Circle cx="50" cy="50" r="45" stroke={COLORS.gold} strokeWidth="0.5" fill="none" />

                {/* 360 Degree Dial ticks */}
                {Array.from({ length: 24 }).map((_, i) => {
                  const angle = (i * 360) / 24;
                  return (
                    <Line
                      key={i}
                      x1="50"
                      y1="6"
                      x2="50"
                      y2="9"
                      stroke={i % 6 === 0 ? COLORS.gold : COLORS.text3}
                      strokeWidth={i % 6 === 0 ? '0.8' : '0.4'}
                      transform={`rotate(${angle} 50 50)`}
                    />
                  );
                })}

                {/* Cardinal Points */}
                <SvgText x="47.5" y="15" fill={COLORS.gold} fontSize="9" fontWeight="bold">N</SvgText>
                <SvgText x="48" y="92" fill={COLORS.text2} fontSize="7" fontWeight="bold">S</SvgText>
                <SvgText x="85" y="52.5" fill={COLORS.text2} fontSize="7" fontWeight="bold">E</SvgText>
                <SvgText x="9" y="52.5" fill={COLORS.text2} fontSize="7" fontWeight="bold">W</SvgText>
              </Svg>
            </Animated.View>

            {/* Rotating Qibla Kaaba Pointer Arrow */}
            <Animated.View
              style={[
                styles.pointerArrowWrapper,
                { transform: [{ rotate: rotateArrowStr }] },
              ]}
              pointerEvents="none"
            >
              <Svg width={300} height={300} viewBox="0 0 100 100">
                {/* Elegant Kaaba Shape Pointer pointer arrow */}
                <Polygon
                  points="50,14 42,28 50,24 58,28"
                  fill={isAligned ? COLORS.gold2 : COLORS.gold}
                />

                {/* Visual Connector Line */}
                <Line
                  x1="50"
                  y1="24"
                  x2="50"
                  y2="50"
                  stroke={isAligned ? COLORS.gold2 : COLORS.gold}
                  strokeWidth="1.5"
                />

                {/* Central Kaaba Icon Silhouette Box */}
                <G transform="translate(43, 43)">
                  <Path
                    d="M2 1h10v10H2zm0 3.5h10M2 7h10"
                    stroke={isAligned ? COLORS.gold2 : COLORS.gold}
                    strokeWidth="1"
                    fill="none"
                  />
                  <Path
                    d="M2 1l2 2v6l-2-2zm10 0l-2 2v6l2-2z"
                    stroke={isAligned ? COLORS.gold2 : COLORS.gold}
                    strokeWidth="0.8"
                    fill="none"
                  />
                </G>
              </Svg>
            </Animated.View>
          </View>

          {/* Location details card info */}
          <Card style={styles.locationInfoCard}>
            <View style={styles.locationTextRow}>
              <View>
                <Text style={styles.locationTitleLabel}>Current Coordinates</Text>
                <Text style={styles.locationCityValue}>
                  {city || 'Custom Location'}
                </Text>
              </View>
              <View style={styles.coordsValueBox}>
                <Text style={styles.coordLabel}>Lat: {lat.toFixed(4)}°</Text>
                <Text style={styles.coordLabel}>Lon: {lon.toFixed(4)}°</Text>
              </View>
            </View>
          </Card>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  backgroundOverlay: {
    opacity: 0.8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.bg3,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.bg2,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.bg3,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  calibrationBanner: {
    backgroundColor: 'rgba(201,168,76,0.1)',
    borderColor: 'rgba(201,168,76,0.25)',
    borderWidth: 1,
    borderRadius: 12,
    marginHorizontal: 20,
    marginTop: 10,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  calibrationText: {
    color: COLORS.gold,
    fontSize: 11,
    fontWeight: '500',
    marginLeft: 10,
    flex: 1,
    lineHeight: 16,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    color: COLORS.text3,
    fontSize: 13,
    marginTop: 14,
  },
  errorText: {
    color: COLORS.text3,
    fontSize: 14,
    textAlign: 'center',
    marginVertical: 14,
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: COLORS.bg2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.gold,
  },
  retryText: {
    color: COLORS.gold,
    fontWeight: 'bold',
  },
  mainContent: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 30,
    paddingHorizontal: 20,
  },
  degreeBox: {
    alignItems: 'center',
  },
  degreeText: {
    fontSize: 38,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  alignmentStatusLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: COLORS.text3,
    letterSpacing: 1.5,
    marginTop: 6,
    textTransform: 'uppercase',
  },
  alignedTextHighlight: {
    color: COLORS.gold2,
  },
  compassPlatform: {
    width: 290,
    height: 290,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  pulseRing: {
    position: 'absolute',
    width: 270,
    height: 270,
    borderRadius: 135,
    backgroundColor: 'rgba(201,168,76,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.22)',
  },
  compassRoseWrapper: {
    position: 'absolute',
    width: 280,
    height: 280,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.bg2,
    borderRadius: 140,
    borderWidth: 1.5,
    borderColor: COLORS.bg3,
  },
  pointerArrowWrapper: {
    position: 'absolute',
    width: 300,
    height: 300,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  locationInfoCard: {
    width: '100%',
    backgroundColor: COLORS.bg2,
    borderColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
  },
  locationTextRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  locationTitleLabel: {
    fontSize: 11,
    color: COLORS.text3,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  locationCityValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
    marginTop: 2,
  },
  coordsValueBox: {
    alignItems: 'flex-end',
  },
  coordLabel: {
    fontSize: 12,
    color: COLORS.text2,
    fontWeight: '500',
  },
});
