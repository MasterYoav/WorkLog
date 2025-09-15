import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Text, TextInput, TouchableOpacity, useColorScheme, View } from 'react-native';
import {
    formatAddress,
    getCurrentLocation,
    haversineMeters,
    requestForegroundLocation,
    reverseGeocode,
} from '../src/lib/location';
import {
    appendLocalPunch,
    changePassword,
    clearShiftStart,
    loadShiftStart,
    saveShiftStart,
} from '../src/lib/storage';

/** נקודת בדיקה: רחוב דן, אורנית (קואורדינטות משוערות) */
const SITE_LAT = 32.1105;
const SITE_LNG = 34.9845;
const RADIUS_M = 4000; // בדיקות
const ACCURACY_MAX = 75;

type PunchType = 'in' | 'out';

function formatDuration(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(sec)}`;
}

function PrimaryButton({
  title,
  bg,
  disabled,
  onPress,
}: {
  title: string;
  bg: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      disabled={disabled}
      style={{
        opacity: disabled ? 0.6 : 1,
        backgroundColor: bg,
        paddingVertical: 14,
        paddingHorizontal: 20,
        borderRadius: 10,
        minWidth: 220,
        alignItems: 'center',
      }}
    >
      <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>{title}</Text>
    </TouchableOpacity>
  );
}

export default function ClockScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ empNo?: string; name?: string }>();
  const empNo = (params.empNo ?? 'unknown').toString();
  const name = typeof params.name === 'string' ? params.name : '';

  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const text = { color: isDark ? '#fff' : '#000' } as const;
  const bg = { backgroundColor: isDark ? '#000' : '#fff' } as const;
  const border = { borderColor: isDark ? '#555' : '#ccc' } as const;

  const [busy, setBusy] = useState(false);
  const [shiftStartIso, setShiftStartIso] = useState<string | null>(null);
  const [lastInfo, setLastInfo] = useState<string | null>(null);
  const isOnShift = !!shiftStartIso;

  // UI לשינוי סיסמה
  const [showPwdBox, setShowPwdBox] = useState(false);
  const [newPwd, setNewPwd] = useState('');

  // טיימר להצגת זמן שחלף בלייב
  const [now, setNow] = useState<number>(Date.now());
  useEffect(() => {
    if (!isOnShift) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [isOnShift]);

  // שחזור משמרת פתוחה (אם קיימת) מהאחסון המקומי
  useEffect(() => {
    (async () => {
      const saved = await loadShiftStart(empNo);
      if (saved) setShiftStartIso(saved);
    })();
  }, [empNo]);

  const elapsed = useMemo(() => {
    if (!shiftStartIso) return null;
    return Date.now() - new Date(shiftStartIso).getTime();
  }, [shiftStartIso, now]);

  async function getValidatedLocation() {
    await requestForegroundLocation();
    const loc = await getCurrentLocation();
    if (loc.accuracy !== null && loc.accuracy > ACCURACY_MAX) {
      throw new Error('GPS דיוק נמוך. נסה לצאת לשטח פתוח או להמתין כמה שניות.');
    }
    const dist = haversineMeters(loc.lat, loc.lng, SITE_LAT, SITE_LNG);
    if (dist > RADIUS_M) {
      throw new Error(`לא באתר העבודה (מרחק ~${dist.toFixed(0)} מ')`);
    }
    return loc;
  }

  async function handlePunch(type: PunchType) {
    try {
      setBusy(true);

      if (type === 'out' && !isOnShift) {
        Alert.alert('שגיאה', 'לא ניתן לבצע יציאה לפני כניסה.');
        return;
      }
      if (type === 'in' && isOnShift) {
        Alert.alert('שגיאה', 'כבר ביצעת כניסה. יש לבצע יציאה לפני כניסה חדשה.');
        return;
      }

      const loc = await getValidatedLocation();
      const addr = await reverseGeocode(loc.lat, loc.lng);
      const addrLabel = formatAddress(addr) ?? 'מיקום לא ידוע';
      const tsIso = new Date().toISOString();

      if (type === 'in') {
        await saveShiftStart(empNo, tsIso);
        setShiftStartIso(tsIso);

        await appendLocalPunch(empNo, {
          kind: 'in',
          ts: tsIso,
          lat: loc.lat,
          lng: loc.lng,
          acc: loc.accuracy,
          address: addr,
          address_label: addrLabel,
          site: { lat: SITE_LAT, lng: SITE_LNG, r: RADIUS_M },
        });

        setLastInfo(`IN ✅ | ${new Date(tsIso).toLocaleString()} | ${addrLabel}`);
        Alert.alert('נכנסת למשמרת', `Clock IN בוצע בהצלחה\n${addrLabel}`);
      } else {
        const started = new Date(shiftStartIso!);
        const durationMs = new Date(tsIso).getTime() - started.getTime();
        const pretty = formatDuration(durationMs);

        await appendLocalPunch(empNo, {
          kind: 'out',
          ts: tsIso,
          lat: loc.lat,
          lng: loc.lng,
          acc: loc.accuracy,
          address: addr,
          address_label: addrLabel,
          site: { lat: SITE_LAT, lng: SITE_LNG, r: RADIUS_M },
          started_at: shiftStartIso,
          duration_ms: durationMs,
        });

        await clearShiftStart(empNo);
        setShiftStartIso(null);

        setLastInfo(`OUT ✅ | ${new Date(tsIso).toLocaleString()} | משך: ${pretty} | ${addrLabel}`);
        Alert.alert('סיימת משמרת', `Clock OUT בוצע בהצלחה\nמשך: ${pretty}\n${addrLabel}`);
      }
    } catch (e: any) {
      Alert.alert('שגיאה', e?.message ?? 'פעולת נוכחות נכשלה');
    } finally {
      setBusy(false);
    }
  }

  async function handleSavePassword() {
    try {
      if (!newPwd.trim() || newPwd.length < 4) {
        Alert.alert('שגיאה', 'סיסמה חייבת להיות באורך 4 תווים לפחות.');
        return;
      }
      await changePassword(empNo, newPwd.trim());
      setNewPwd('');
      setShowPwdBox(false);
      Alert.alert('בוצע', 'הסיסמה עודכנה בהצלחה.');
    } catch (e: any) {
      Alert.alert('שגיאה', e?.message ?? 'כשל בעדכון סיסמה');
    }
  }

  function handleLogout() {
    router.replace('/auth');
  }
  function goProfile() {
    router.push({ pathname: '/profile', params: { empNo, name } });
  }

  return (
    <View style={[{ flex: 1, gap: 18, alignItems: 'center', justifyContent: 'center', padding: 20 }, bg]}>
      {/* שם העובד + מספר עובד */}
      <Text style={[{ fontSize: 18, fontWeight: '600', marginBottom: 4 }, text]}>
        {name ? `שלום, ${name}` : 'שלום'} · מס׳ עובד: {empNo}
      </Text>

      <Text style={[{ fontSize: 20, fontWeight: '700' }, text]}>Clock In / Out</Text>

      {!isOnShift ? (
        <PrimaryButton title={busy ? 'מבצע כניסה...' : 'כניסה'} bg="#1e9f3c" disabled={busy} onPress={() => handlePunch('in')} />
      ) : (
        <PrimaryButton title={busy ? 'מבצע יציאה...' : 'יציאה'} bg="#cf2e2e" disabled={busy} onPress={() => handlePunch('out')} />
      )}

      {isOnShift && (
        <Text style={[{ marginTop: 6, fontSize: 16, opacity: 0.8 }, text]}>
          זמן במשמרת: {formatDuration(elapsed ?? 0)}
        </Text>
      )}

      <View style={{ height: 10 }} />
      <PrimaryButton title="מידע אישי" bg="#2563eb" onPress={goProfile} />
      <PrimaryButton title={showPwdBox ? 'ביטול שינוי סיסמה' : 'שינוי סיסמה'} bg="#6b7280" onPress={() => setShowPwdBox(v => !v)} />
      <PrimaryButton title="Log out" bg="#555" onPress={handleLogout} />

      {showPwdBox && (
        <View style={{ marginTop: 10, width: '90%', gap: 8 }}>
          <Text style={[{ fontWeight: '600' }, text]}>סיסמה חדשה</Text>
          <TextInput
            value={newPwd}
            onChangeText={setNewPwd}
            placeholder="הקלד סיסמה חדשה"
            placeholderTextColor={isDark ? '#aaa' : '#888'}
            secureTextEntry
            style={[{ borderWidth: 1, borderRadius: 8, padding: 12, color: text.color }, border]}
          />
          <TouchableOpacity onPress={handleSavePassword} activeOpacity={0.8}
            style={{ backgroundColor: '#111827', paddingVertical: 12, borderRadius: 8, alignItems: 'center' }}>
            <Text style={{ color: '#fff', fontWeight: '700' }}>שמור סיסמה</Text>
          </TouchableOpacity>
        </View>
      )}

      {lastInfo && (
        <Text style={[{ marginTop: 14, opacity: 0.7, textAlign: 'center' }, text]}>{lastInfo}</Text>
      )}

      <Text style={[{ marginTop: 20, fontSize: 12, color: '#666', textAlign: 'center' }, text]}>
        נקודת בדיקה: רחוב דן, אורנית. רדיוס {RADIUS_M} מ'. דיוק נדרש ≤ {ACCURACY_MAX} מ'.
      </Text>
    </View>
  );
}