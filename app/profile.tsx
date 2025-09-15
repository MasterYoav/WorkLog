import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Text, TouchableOpacity, useColorScheme, View } from 'react-native';
import { formatAddress } from '../src/lib/location';
import { loadLocalPunches } from '../src/lib/storage';

function pad2(n: number) { return n.toString().padStart(2, '0'); }
function formatDuration(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${pad2(h)}:${pad2(m)}`;
}

export default function ProfileScreen() {
  const { empNo = 'unknown', name = '' } = useLocalSearchParams<{ empNo?: string; name?: string }>();
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const text = { color: isDark ? '#fff' : '#000' } as const;
  const bg = { backgroundColor: isDark ? '#000' : '#fff' } as const;
  const card = { backgroundColor: isDark ? '#111' : '#f6f6f6', borderColor: isDark ? '#333' : '#ddd' } as const;

  const now = new Date();
  const [month, setMonth] = useState(now.getMonth()); // 0-11
  const [year, setYear] = useState(now.getFullYear());
  const [rows, setRows] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const punches = await loadLocalPunches(String(empNo));
      const outs = (punches || []).filter((p: any) => p.kind === 'out' && p.duration_ms && p.started_at);
      const mapped = outs.map((p: any) => ({
        key: p.ts,
        date: new Date(p.started_at),
        durationMs: p.duration_ms as number,
        address_label: p.address_label ?? formatAddress(p.address) ?? '—',
      })).sort((a: any, b: any) => b.date.getTime() - a.date.getTime());
      setRows(mapped);
    })();
  }, [empNo]);

  const filtered = useMemo(() => rows.filter(r => r.date.getFullYear() === year && r.date.getMonth() === month), [rows, month, year]);
  const monthTotalMs = useMemo(() => filtered.reduce((s, r) => s + (r.durationMs || 0), 0), [filtered]);

  function changeMonth(delta: number) {
    let m = month + delta, y = year;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    setMonth(m); setYear(y);
  }

  return (
    <View style={[{ flex: 1, padding: 16 }, bg]}>
      <Text style={[{ fontSize: 18, fontWeight: '700', marginBottom: 8 }, text]}>
        {name ? `מידע אישי – ${name} · מס׳ עובד ${empNo}` : `מידע אישי · מס׳ עובד ${empNo}`}
      </Text>

      {/* Month/Year picker */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <TouchableOpacity onPress={() => changeMonth(-1)} ><Text style={[{ fontSize: 16, textDecorationLine: 'underline' }, text]}>‹ חודש קודם</Text></TouchableOpacity>
        <Text style={[{ fontSize: 16, fontWeight: '700' }, text]}>{year}-{pad2(month + 1)}</Text>
        <TouchableOpacity onPress={() => changeMonth(1)} ><Text style={[{ fontSize: 16, textDecorationLine: 'underline' }, text]}>חודש הבא ›</Text></TouchableOpacity>
      </View>

      <View style={{ padding: 12, borderRadius: 10, borderWidth: 1, marginBottom: 12, ...card }}>
        <Text style={[{ fontSize: 16, fontWeight: '700' }, text]}>סך שעות {year}-{pad2(month + 1)}</Text>
        <Text style={[{ fontSize: 22, fontWeight: '800', marginTop: 6 }, text]}>{formatDuration(monthTotalMs)}</Text>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.key}
        renderItem={({ item }) => (
          <View style={{ padding: 12, borderRadius: 10, borderWidth: 1, marginBottom: 10, ...card }}>
            <Text style={[{ fontWeight: '700' }, text]}>תאריך: {item.date.toLocaleDateString()}</Text>
            <Text style={text}>אורך משמרת: {formatDuration(item.durationMs)}</Text>
            <Text style={text}>מיקום: {item.address_label}</Text>
          </View>
        )}
        ListEmptyComponent={<Text style={[{ opacity: 0.7, textAlign: 'center', marginTop: 40 }, text]}>אין משמרות בטווח שנבחר.</Text>}
      />
    </View>
  );
}