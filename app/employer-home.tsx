// app/employer-home.tsx
import WLLogo from '@/components/WLLogo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BlurView } from 'expo-blur';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  FlatList,
  PanResponder,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native';
import {
  changeEmployerPasswordCloud,
  createProjectCloud,
  listEmployerWorkersCloud,
  listProjectsCloud,
  listWorkerPunchTotalsCloud,
  recordPunchEmployer,
  updateWorkerPunchMode,
} from '../src/data/repo';
import {
  formatAddress,
  getCurrentLocation,
  requestForegroundLocation,
  reverseGeocode
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

async function getEmployerPunchLoc() {
  await requestForegroundLocation();
  const loc = await getCurrentLocation();
  const addr = await reverseGeocode(loc.lat, loc.lng);
  return {
    ...loc,
    addr,
    addrLabel: formatAddress(addr) ?? 'מיקום לא ידוע',
  };
}

type Section = 'clock' | 'workers' | 'projects' | 'me';

export default function EmployerHome() {
  const router = useRouter();
  const { employerNo = '—', company = '' } =
    useLocalSearchParams<{ employerNo?: string; company?: string }>();
  const employerNoNum = Number(employerNo);
  const employerNoStr = String(employerNo);

  const systemScheme = useColorScheme();
  const [forceScheme, setForceScheme] = useState<'light' | 'dark' | 'system'>('system');

  // load ui theme
  useEffect(() => {
    (async () => {
      const saved = await AsyncStorage.getItem('ui:theme');
      if (saved === 'light' || saved === 'dark' || saved === 'system') {
        setForceScheme(saved);
      }
    })();
  }, []);

  const isDark = forceScheme === 'dark' ? true : forceScheme === 'light' ? false : systemScheme === 'dark';

  const SCREEN_W = Dimensions.get('window').width;
  const SIDEBAR_W = 240;

  const [menuOpen, setMenuOpen] = useState(false);
  const slideX = useRef(new Animated.Value(-SIDEBAR_W)).current;

  const openMenu = useCallback(() => {
    setMenuOpen(true);
    Animated.timing(slideX, {
      toValue: 0,
      duration: 180,
      useNativeDriver: false,
    }).start();
  }, [slideX]);

  const closeMenu = useCallback(() => {
    Animated.timing(slideX, {
      toValue: -SIDEBAR_W,
      duration: 180,
      useNativeDriver: false,
    }).start(() => setMenuOpen(false));
  }, [slideX]);

  // swipe from left to open menu (לא לחזור אחורה!)
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dx > 10 && g.moveX < 30,
      onPanResponderMove: (_, g) => {
        const next = Math.min(0, -SIDEBAR_W + g.dx);
        slideX.setValue(next);
        if (!menuOpen) setMenuOpen(true);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dx > SIDEBAR_W / 2) openMenu();
        else closeMenu();
      },
    })
  ).current;

  const [section, setSection] = useState<Section>('clock');

  // ===== מעסיק – שעון =====
  const [busy, setBusy] = useState(false);
  const [shiftStartIso, setShiftStartIso] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [employerPunches, setEmployerPunches] = useState<
    Array<{ ts: string; kind: 'in' | 'out'; address_label: string | null }>
  >([]);

  const isOnShift = !!shiftStartIso;
  useEffect(() => {
    if (!isOnShift) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [isOnShift]);

  const elapsedMs = useMemo(
    () => (shiftStartIso ? Date.now() - new Date(shiftStartIso).getTime() : 0),
    [shiftStartIso, now]
  );

  async function loadEmployerPunches() {
    try {
      const { supabase } = await import('../src/lib/supabase');
      const { data, error } = await supabase
        .from('punches')
        .select('ts, kind, address_label')
        .eq('subject_type', 'employer')
        .eq('subject_id', employerNoNum)
        .order('ts', { ascending: false })
        .limit(50);
      if (!error) {
        setEmployerPunches(
          (data ?? []).map((r: any) => ({
            ts: r.ts,
            kind: r.kind,
            address_label: r.address_label,
          }))
        );
      }
    } catch {}
  }

  useEffect(() => {
    loadEmployerPunches();
  }, [employerNoNum]);

  async function onEmployerPunch(type: 'in' | 'out') {
    try {
      setBusy(true);
      if (type === 'out' && !isOnShift) {
        Alert.alert('שגיאה', 'אין משמרת פתוחה');
        return;
      }
      if (type === 'in' && isOnShift) {
        Alert.alert('שגיאה', 'כבר התחלת משמרת');
        return;
      }
      const loc = await getEmployerPunchLoc();
      const ts = new Date().toISOString();

      if (type === 'in') {
        setShiftStartIso(ts);
        await recordPunchEmployer(employerNoNum, {
          kind: 'in',
          ts,
          lat: loc.lat,
          lng: loc.lng,
          accuracy: loc.accuracy ?? null,
          address_label: loc.addrLabel,
        });
        Alert.alert('כניסה', loc.addrLabel ?? 'נרשמה כניסה');
      } else {
        const dur = shiftStartIso ? new Date(ts).getTime() - new Date(shiftStartIso).getTime() : 0;
        setShiftStartIso(null);
        await recordPunchEmployer(employerNoNum, {
          kind: 'out',
          ts,
          lat: loc.lat,
          lng: loc.lng,
          accuracy: loc.accuracy ?? null,
          address_label: loc.addrLabel,
          started_at: shiftStartIso,
          duration_ms: dur,
        });
        Alert.alert('יציאה', `משך: ${formatDurationHMS(dur)}\n${loc.addrLabel ?? ''}`);
      }
      loadEmployerPunches();
    } catch (e: any) {
      Alert.alert('שגיאה', e?.message ?? 'כשל בהחתמה');
    } finally {
      setBusy(false);
    }
  }

  // ===== עובדים =====
  const [workers, setWorkers] = useState<any[]>([]);
  const [workerTotals, setWorkerTotals] = useState<Record<number, number>>({});

  async function loadWorkers() {
    const list = await listEmployerWorkersCloud(employerNoNum);
    const totals = await listWorkerPunchTotalsCloud(employerNoNum);
    setWorkers(list);
    setWorkerTotals(totals);
  }

  useEffect(() => {
    loadWorkers().catch(() => {});
  }, [employerNoNum]);

  async function onUpdateWorkerMode(empNo: number, mode: 'site' | 'anywhere') {
    try {
      await updateWorkerPunchMode(empNo, mode);
      await loadWorkers();
    } catch (e: any) {
      Alert.alert('שגיאה', e?.message ?? 'כשל בעדכון מצב החתמה');
      loadWorkers().catch(() => {});
    }
  }

  // ===== פרויקטים =====
  const [projName, setProjName] = useState('');
  const [projLocation, setProjLocation] = useState('');
  const [projects, setProjects] = useState<any[]>([]);

  async function loadProjects() {
    const list = await listProjectsCloud(employerNoNum);
    setProjects(list);
  }
  useEffect(() => {
    loadProjects().catch(() => {});
  }, [employerNoNum]);

  async function onCreateProject() {
    try {
      if (!projName.trim()) {
        Alert.alert('שגיאה', 'הכנס שם פרויקט');
        return;
      }
      if (!projLocation.trim()) {
        Alert.alert('שגיאה', 'הכנס מיקום');
        return;
      }
      await createProjectCloud(employerNoNum, projName.trim(), projLocation.trim());
      setProjName('');
      setProjLocation('');
      loadProjects();
    } catch (e: any) {
      Alert.alert('שגיאה', e?.message ?? 'כשל ביצירת פרויקט');
    }
  }

  // ===== שינוי סיסמה =====
  const [oldPass, setOldPass] = useState('');
  const [newPass, setNewPass] = useState('');
  async function onChangePassword() {
    try {
      if (!oldPass || !newPass) {
        Alert.alert('שגיאה', 'אנא מלא סיסמה נוכחית וחדשה');
        return;
      }
      await changeEmployerPasswordCloud(employerNoNum, oldPass, newPass);
      Alert.alert('בוצע', 'הסיסמה עודכנה');
      setOldPass('');
      setNewPass('');
    } catch (e: any) {
      Alert.alert('שגיאה', e?.message ?? 'כשל בעדכון סיסמה');
    }
  }

  const text = { color: isDark ? '#fff' : '#000' } as const;
  const bg = { backgroundColor: isDark ? '#000' : '#fff' } as const;
  const card = {
    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)',
    borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.05)',
  } as const;

  return (
    <View style={[{ flex: 1 }, bg]} {...pan.panHandlers}>
      {/* overlay blur */}
      {menuOpen && (
        <TouchableOpacity
          onPress={closeMenu}
          activeOpacity={1}
          style={{ position: 'absolute', inset: 0, zIndex: 8 }}
        >
          <BlurView tint={isDark ? 'dark' : 'light'} intensity={40} style={{ flex: 1 }} />
        </TouchableOpacity>
      )}

      {/* sidebar */}
      <Animated.View
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: 0,
          width: SIDEBAR_W,
          backgroundColor: isDark ? 'rgba(15,15,15,0.85)' : 'rgba(255,255,255,0.9)',
          zIndex: 9,
          paddingTop: 40,
          paddingHorizontal: 14,
          transform: [{ translateX: slideX }],
        }}
      >
        <TouchableOpacity onPress={closeMenu} style={{ alignSelf: 'flex-end', marginBottom: 16 }}>
          <Text style={[{ fontSize: 20 }, text]}>✕</Text>
        </TouchableOpacity>

        <View
          style={{
            backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.9)',
            borderRadius: 20,
            padding: 12,
            marginBottom: 16,
          }}
        >
          <Text style={{ fontWeight: '700', fontSize: 17, color: isDark ? '#fff' : '#000' }}>
            {company || 'המעסיק שלי'}
          </Text>
          <Text style={{ opacity: 0.6, marginTop: 4, color: isDark ? '#fff' : '#000' }}>
            מס׳ מעסיק: {employerNoStr}
          </Text>
        </View>

        {[
          { key: 'clock', label: 'שעון נוכחות' },
          { key: 'workers', label: 'העובדים שלי' },
          { key: 'projects', label: 'הפרויקטים שלי' },
          { key: 'me', label: 'מידע אישי' },
        ].map((item) => (
          <TouchableOpacity
            key={item.key}
            onPress={() => {
              setSection(item.key as Section);
              closeMenu();
            }}
            style={{
              paddingVertical: 10,
              borderRadius: 12,
              marginBottom: 6,
              backgroundColor:
                section === item.key ? (isDark ? '#1f2937' : '#e5e7eb') : 'transparent',
            }}
          >
            <Text style={{ color: isDark ? '#fff' : '#000', fontSize: 16 }}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </Animated.View>

      {/* header */}
      <View
        style={{
          paddingTop: 52,
          paddingHorizontal: 16,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <TouchableOpacity onPress={openMenu} style={{ padding: 4 }}>
          <Text style={[{ fontSize: 22 }, text]}>☰</Text>
        </TouchableOpacity>
        <WLLogo />
        <TouchableOpacity onPress={() => router.replace('/auth')}>
          <Text style={[{ textDecorationLine: 'underline', fontWeight: '600' }, text]}>יציאה</Text>
        </TouchableOpacity>
      </View>

      {/* content */}
      <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 12 }}>
        {section === 'clock' && (
          <ScrollView>
            <Text style={[{ fontSize: 22, fontWeight: '800', marginBottom: 12 }, text]}>
              שעון נוכחות (מעסיק)
            </Text>
            {!isOnShift ? (
              <TouchableOpacity
                onPress={() => onEmployerPunch('in')}
                disabled={busy}
                style={{
                  backgroundColor: '#22c55e',
                  padding: 14,
                  borderRadius: 20,
                  alignItems: 'center',
                  marginBottom: 10,
                  opacity: busy ? 0.6 : 1,
                }}
              >
                <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700' }}>
                  {busy ? 'מבצע כניסה...' : 'כניסה'}
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={() => onEmployerPunch('out')}
                disabled={busy}
                style={{
                  backgroundColor: '#ef4444',
                  padding: 14,
                  borderRadius: 20,
                  alignItems: 'center',
                  marginBottom: 10,
                  opacity: busy ? 0.6 : 1,
                }}
              >
                <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700' }}>
                  {busy ? 'מבצע יציאה...' : 'יציאה'}
                </Text>
              </TouchableOpacity>
            )}

            {isOnShift && (
              <Text style={[{ marginBottom: 12, fontSize: 16 }, text]}>
                זמן במשמרת: {formatDurationHMS(elapsedMs)}
              </Text>
            )}

            <View style={{ padding: 12, borderRadius: 16, borderWidth: 1, ...card }}>
              <Text style={[{ fontWeight: '700', marginBottom: 6 }, text]}>החתמות אחרונות</Text>
              {employerPunches.length === 0 ? (
                <Text style={[{ opacity: 0.6 }, text]}>אין החתמות להצגה.</Text>
              ) : (
                employerPunches.map((p) => (
                  <View
                    key={p.ts}
                    style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}
                  >
                    <Text style={text}>
                      {p.kind === 'in' ? 'כניסה' : 'יציאה'} · {new Date(p.ts).toLocaleString()}
                    </Text>
                    <Text style={[{ opacity: 0.6 }, text]}>{p.address_label ?? '—'}</Text>
                  </View>
                ))
              )}
            </View>
          </ScrollView>
        )}

        {section === 'workers' && (
          <View style={{ flex: 1 }}>
            <Text style={[{ fontSize: 22, fontWeight: '800', marginBottom: 12 }, text]}>
              העובדים שלי
            </Text>
            <FlatList
              data={workers}
              keyExtractor={(w) => String(w.emp_no)}
              renderItem={({ item: w }) => {
                const total = workerTotals[w.emp_no] ?? 0;
                return (
                  <View
                    style={{
                      padding: 12,
                      borderRadius: 20,
                      borderWidth: 1,
                      marginBottom: 10,
                      ...card,
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <View style={{ flex: 1, marginRight: 12 }}>
                      <Text style={[{ fontWeight: '700', fontSize: 16 }, text]}>
                        {w.full_name} · מס׳ {w.emp_no}
                      </Text>
                      <Text style={[{ opacity: 0.6, marginTop: 3 }, text]}>
                        סך שעות: {formatDurationHMS(total)}
                      </Text>
                      <Text style={[{ opacity: 0.6, marginTop: 3 }, text]}>
                        מצב החתמה: {w.punch_mode === 'anywhere' ? 'מכל מקום' : 'רק באתר'}
                      </Text>
                    </View>
                    <View style={{ gap: 6 }}>
                      <TouchableOpacity
                        onPress={() => onUpdateWorkerMode(w.emp_no, 'anywhere')}
                        style={{
                          backgroundColor: w.punch_mode === 'anywhere' ? '#2563eb' : isDark ? '#1f2937' : '#e5e7eb',
                          paddingVertical: 6,
                          paddingHorizontal: 10,
                          borderRadius: 10,
                        }}
                      >
                        <Text style={{ color: w.punch_mode === 'anywhere' ? '#fff' : text.color }}>
                          אפשר החתמה מכל מקום
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => onUpdateWorkerMode(w.emp_no, 'site')}
                        style={{
                          backgroundColor: w.punch_mode === 'site' ? '#2563eb' : isDark ? '#1f2937' : '#e5e7eb',
                          paddingVertical: 6,
                          paddingHorizontal: 10,
                          borderRadius: 10,
                        }}
                      >
                        <Text style={{ color: w.punch_mode === 'site' ? '#fff' : text.color }}>
                          החתמה ממקום העבודה
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              }}
              ListEmptyComponent={
                <Text style={[{ opacity: 0.6, marginTop: 16, textAlign: 'center' }, text]}>
                  אין עובדים משויכים.
                </Text>
              }
            />
            <TouchableOpacity
              onPress={() =>
                router.push({
                  pathname: '/employer-workers',
                  params: { employerNo: employerNoStr },
                })
              }
              style={{
                position: 'absolute',
                bottom: 26,
                right: 20,
                backgroundColor: '#2563eb',
                paddingHorizontal: 26,
                paddingVertical: 14,
                borderRadius: 999,
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '700' }}>סיכום חודשי</Text>
            </TouchableOpacity>
          </View>
        )}

        {section === 'projects' && (
          <ScrollView>
            <Text style={[{ fontSize: 22, fontWeight: '800', marginBottom: 12 }, text]}>
              הפרויקטים שלי
            </Text>
            <View style={{ marginBottom: 16, gap: 8 }}>
              <Text style={text}>שם פרויקט</Text>
              <TextInput
                value={projName}
                onChangeText={setProjName}
                placeholder="לדוגמה: בנייה 1"
                placeholderTextColor={isDark ? '#aaa' : '#888'}
                style={{
                  borderWidth: 1,
                  borderColor: isDark ? '#333' : '#ccc',
                  borderRadius: 12,
                  padding: 10,
                  color: text.color,
                }}
              />
              <Text style={text}>מיקום</Text>
              <TextInput
                value={projLocation}
                onChangeText={setProjLocation}
                placeholder="Tel Aviv / Jerusalem"
                placeholderTextColor={isDark ? '#aaa' : '#888'}
                style={{
                  borderWidth: 1,
                  borderColor: isDark ? '#333' : '#ccc',
                  borderRadius: 12,
                  padding: 10,
                  color: text.color,
                }}
              />
              <TouchableOpacity
                onPress={onCreateProject}
                style={{ backgroundColor: '#2563eb', padding: 12, borderRadius: 12, alignItems: 'center' }}
              >
                <Text style={{ color: '#fff', fontWeight: '700' }}>הוסף פרויקט</Text>
              </TouchableOpacity>
            </View>
            {projects.map((p) => (
              <TouchableOpacity
                key={p.id}
                onPress={() =>
                  router.push({
                    pathname: '/employer-project',
                    params: {
                      employerNo: employerNoStr,
                      projectId: String(p.id),
                    },
                  })
                }
                activeOpacity={0.65}
                style={{ padding: 12, borderRadius: 16, borderWidth: 1, marginBottom: 10, ...card }}
              >
                <Text style={[{ fontWeight: '700' }, text]}>{p.name}</Text>
                <Text style={text}>מיקום: {p.location}</Text>
                <Text style={text}>נוצר: {new Date(p.created_at).toLocaleString()}</Text>
              </TouchableOpacity>
            ))}
            {projects.length === 0 && (
              <Text style={[{ opacity: 0.6, textAlign: 'center', marginTop: 20 }, text]}>
                אין פרויקטים.
              </Text>
            )}
          </ScrollView>
        )}

        {section === 'me' && (
          <ScrollView>
            <Text style={[{ fontSize: 22, fontWeight: '800', marginBottom: 12 }, text]}>מידע אישי</Text>
            <View style={{ gap: 10 }}>
              <TextInput
                value={oldPass}
                onChangeText={setOldPass}
                placeholder="סיסמה נוכחית"
                secureTextEntry
                placeholderTextColor={isDark ? '#aaa' : '#888'}
                style={{
                  borderWidth: 1,
                  borderColor: isDark ? '#333' : '#ccc',
                  borderRadius: 12,
                  padding: 10,
                  color: text.color,
                }}
              />
              <TextInput
                value={newPass}
                onChangeText={setNewPass}
                placeholder="סיסמה חדשה"
                secureTextEntry
                placeholderTextColor={isDark ? '#aaa' : '#888'}
                style={{
                  borderWidth: 1,
                  borderColor: isDark ? '#333' : '#ccc',
                  borderRadius: 12,
                  padding: 10,
                  color: text.color,
                }}
              />
              <TouchableOpacity
                onPress={onChangePassword}
                style={{ backgroundColor: '#2563eb', padding: 12, borderRadius: 12, alignItems: 'center' }}
              >
                <Text style={{ color: '#fff', fontWeight: '700' }}>שינוי סיסמה</Text>
              </TouchableOpacity>
            </View>

            <View style={{ marginTop: 20 }}>
              <Text style={[{ marginBottom: 6, fontWeight: '700' }, text]}>מצב תצוגה</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity
                  onPress={async () => {
                    setForceScheme('system');
                    await AsyncStorage.setItem('ui:theme', 'system');
                  }}
                  style={{
                    backgroundColor: forceScheme === 'system' ? '#2563eb' : isDark ? '#1f2937' : '#e5e7eb',
                    paddingVertical: 8,
                    paddingHorizontal: 12,
                    borderRadius: 10,
                  }}
                >
                  <Text style={{ color: forceScheme === 'system' ? '#fff' : text.color }}>מערכת</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={async () => {
                    setForceScheme('light');
                    await AsyncStorage.setItem('ui:theme', 'light');
                  }}
                  style={{
                    backgroundColor: forceScheme === 'light' ? '#2563eb' : isDark ? '#1f2937' : '#e5e7eb',
                    paddingVertical: 8,
                    paddingHorizontal: 12,
                    borderRadius: 10,
                  }}
                >
                  <Text style={{ color: forceScheme === 'light' ? '#fff' : text.color }}>בהיר</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={async () => {
                    setForceScheme('dark');
                    await AsyncStorage.setItem('ui:theme', 'dark');
                  }}
                  style={{
                    backgroundColor: forceScheme === 'dark' ? '#2563eb' : isDark ? '#1f2937' : '#e5e7eb',
                    paddingVertical: 8,
                    paddingHorizontal: 12,
                    borderRadius: 10,
                  }}
                >
                  <Text style={{ color: forceScheme === 'dark' ? '#fff' : text.color }}>כהה</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        )}
      </View>
    </View>
  );
}