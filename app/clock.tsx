// app/clock.tsx
import WLLogo from '@/components/WLLogo';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  getWorkerProfile,
  recordPunchWorker,
} from '../src/data/repo';
import {
  formatAddress,
  getCurrentLocation,
  haversineMeters,
  requestForegroundLocation,
  reverseGeocode,
} from '../src/lib/location';

const SITE_LAT = 32.1105;
const SITE_LNG = 34.9845;
const RADIUS_M = 4000;
const ACCURACY_MAX = 75;

function pad2(n: number) {
  return n.toString().padStart(2, '0');
}
function formatDurationHMS(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${pad2(h)}:${pad2(m)}:${pad2(sec)}`;
}

export default function ClockScreen() {
  const router = useRouter();
  const { empNo = '—', name = '' } = useLocalSearchParams<{ empNo?: string; name?: string }>();
  const empNoNum = Number(empNo);
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const text = { color: isDark ? '#fff' : '#000' } as const;
  const bg = { backgroundColor: isDark ? '#000' : '#fff' } as const;

  const [workerMode, setWorkerMode] = useState<'site' | 'anywhere'>('site');
  const [isOnShift, setIsOnShift] = useState(false);
  const [shiftStart, setShiftStart] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);

  // נטען פרופיל עובד מהענן כדי לדעת punch_mode
  useEffect(() => {
    (async () => {
      try {
        const w = await getWorkerProfile(empNoNum);
        if (w?.punch_mode === 'anywhere') setWorkerMode('anywhere');
        else setWorkerMode('site');
      } catch {
        // ברירת מחדל
        setWorkerMode('site');
      }
    })();
  }, [empNoNum]);

  useEffect(() => {
    if (!isOnShift) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [isOnShift]);

  const elapsed = useMemo(() => {
    if (!shiftStart) return 0;
    return Date.now() - new Date(shiftStart).getTime();
  }, [shiftStart, now]);

  async function getLocValidated() {
    // אם המצב הוא "site" – נדרוש לוקיישן קשוח
    await requestForegroundLocation();
    const loc = await getCurrentLocation();
    const addr = await reverseGeocode(loc.lat, loc.lng);
    const label = formatAddress(addr) ?? 'מיקום לא ידוע';

    if (workerMode === 'site') {
      if (loc.accuracy !== null && loc.accuracy > ACCURACY_MAX) {
        throw new Error('GPS דיוק נמוך');
      }
      const dist = haversineMeters(loc.lat, loc.lng, SITE_LAT, SITE_LNG);
      if (dist > RADIUS_M) {
        throw new Error(`לא באתר (מרחק ~${dist.toFixed(0)} מ')`);
      }
    }
    return { ...loc, address_label: label };
  }

  async function punch(kind: 'in' | 'out') {
    try {
      setBusy(true);

      if (kind === 'out' && !isOnShift) {
        Alert.alert('שגיאה', 'אין משמרת פתוחה');
        return;
      }
      if (kind === 'in' && isOnShift) {
        Alert.alert('שגיאה', 'כבר התחלת משמרת');
        return;
      }

      const loc = await getLocValidated();
      const ts = new Date().toISOString();

      if (kind === 'in') {
        setShiftStart(ts);
        setIsOnShift(true);
        await recordPunchWorker(empNoNum, {
          kind: 'in',
          ts,
          lat: loc.lat,
          lng: loc.lng,
          accuracy: loc.accuracy,
          address_label: loc.address_label,
        });
        Alert.alert('כניסה', loc.address_label);
      } else {
        const dur = new Date(ts).getTime() - new Date(shiftStart!).getTime();
        setShiftStart(null);
        setIsOnShift(false);
        await recordPunchWorker(empNoNum, {
          kind: 'out',
          ts,
          lat: loc.lat,
          lng: loc.lng,
          accuracy: loc.accuracy,
          address_label: loc.address_label,
          started_at: shiftStart,
          duration_ms: dur,
        });
        Alert.alert('יציאה', `משך: ${formatDurationHMS(dur)}\n${loc.address_label}`);
      }
    } catch (e: any) {
      Alert.alert('שגיאה', e?.message ?? 'כשל בפעולת נוכחות');
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={[{ flex: 1, padding: 16 }, bg]}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <TouchableOpacity onPress={() => router.replace('/auth')}>
          <Text style={[{ textDecorationLine: 'underline' }, text]}>יציאה</Text>
        </TouchableOpacity>
        <WLLogo />
        <View style={{ width: 40 }} />
      </View>

      <View style={{ marginTop: 40, alignItems: 'center' }}>
        <Text style={[{ fontSize: 20, fontWeight: '700' }, text]}>שלום {name || `עובד ${empNo}`}</Text>
        <Text style={[{ marginTop: 6, opacity: 0.7 }, text]}>
          מצב החתמה: {workerMode === 'site' ? 'מקום העבודה בלבד' : 'מכל מקום (שומר מיקום)'}
        </Text>
      </View>

      <View style={{ marginTop: 40, alignItems: 'center' }}>
        {!isOnShift ? (
          <TouchableOpacity
            onPress={() => punch('in')}
            disabled={busy}
            style={{
              backgroundColor: '#1e9f3c',
              paddingVertical: 14,
              paddingHorizontal: 38,
              borderRadius: 18,
              opacity: busy ? 0.6 : 1,
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>
              {busy ? 'מבצע כניסה...' : 'כניסה'}
            </Text>
          </TouchableOpacity>
        ) : (
          <>
            <TouchableOpacity
              onPress={() => punch('out')}
              disabled={busy}
              style={{
                backgroundColor: '#cf2e2e',
                paddingVertical: 14,
                paddingHorizontal: 38,
                borderRadius: 18,
                opacity: busy ? 0.6 : 1,
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>
                {busy ? 'מבצע יציאה...' : 'יציאה'}
              </Text>
            </TouchableOpacity>
            <Text style={[{ marginTop: 12, fontSize: 16 }, text]}>
              זמן במשמרת: {formatDurationHMS(elapsed)}
            </Text>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}