// app/employer-workers.tsx
import WLLogo from '@/components/WLLogo';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as React from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Text,
  TouchableOpacity,
  useColorScheme,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  listEmployerWorkers,
  loadLocalPunches,
  Worker,
} from '../src/lib/storage';

function pad2(n: number) {
  return n.toString().padStart(2, '0');
}
function fmtHMS(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${pad2(h)}:${pad2(m)}:${pad2(sec)}`;
}

type Row = {
  empNo: number;
  fullName: string;
  totalMs: number;
};

export default function EmployerWorkersScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ employerNo?: string }>();

  // ✅ No globalThis – just use the param and coerce safely
  const employerNo = Number(params.employerNo ?? 0);

  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const text = { color: isDark ? '#fff' : '#000' } as const;
  const bg = { backgroundColor: isDark ? '#000' : '#fff' } as const;
  const panel = {
    backgroundColor: isDark ? '#0b0b0b' : '#f2f2f2',
    borderColor: isDark ? '#222' : '#ddd',
  } as const;

  // Month picker state (defaults to current)
  const now = new Date();
  const [year, setYear] = React.useState(now.getFullYear());
  const [month, setMonth] = React.useState(now.getMonth()); // 0..11

  const [loading, setLoading] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);
  const [rows, setRows] = React.useState<Row[]>([]);

  // Compute totals from local punches for the given month
  const load = async () => {
    setLoading(true);
    try {
      const workers: Worker[] = await listEmployerWorkers(String(employerNo));

      const start = new Date(year, month, 1).getTime();
      const end = new Date(year, month + 1, 1).getTime();

      const totals: Row[] = [];
      for (const w of workers) {
        const punches = await loadLocalPunches(String(w.empNo));
        const ms = punches
          .filter(
            (p: any) =>
              p.kind === 'out' &&
              p.duration_ms &&
              p.started_at &&
              // month filter by started_at
              (() => {
                const t = new Date(p.started_at as string).getTime();
                return t >= start && t < end;
              })()
          )
          .reduce((sum: number, p: any) => sum + (p.duration_ms as number), 0);

        totals.push({ empNo: w.empNo, fullName: w.fullName, totalMs: ms });
      }

      // Sort by hours desc, then empNo asc
      totals.sort((a, b) => b.totalMs - a.totalMs || a.empNo - b.empNo);
      setRows(totals);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    load();
  }, [employerNo, year, month]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await load();
      await Haptics.selectionAsync();
    } finally {
      setRefreshing(false);
    }
  };

  const decMonth = () => {
    const d = new Date(year, month, 1);
    d.setMonth(d.getMonth() - 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  };
  const incMonth = () => {
    const d = new Date(year, month, 1);
    d.setMonth(d.getMonth() + 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  };

  return (
    <SafeAreaView style={[{ flex: 1 }, bg]}>
      {/* Header with logo + back */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 12,
          paddingTop: 4,
          paddingBottom: 8,
        }}
      >
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 8 }}>
          <Text style={[{ fontSize: 18 }, text]}>‹ חזרה</Text>
        </TouchableOpacity>
        <WLLogo /> 
        {/* spacer to balance */}
        <View style={{ width: 48 }} />
      </View>

      {/* Month picker + total */}
      <View style={{ paddingHorizontal: 16 }}>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 8,
          }}
        >
          <TouchableOpacity onPress={decMonth}>
            <Text style={[{ textDecorationLine: 'underline' }, text]}>
              ‹ חודש קודם
            </Text>
          </TouchableOpacity>
          <Text style={[{ fontWeight: '800', fontSize: 16 }, text]}>
            {year}-{pad2(month + 1)}
          </Text>
          <TouchableOpacity onPress={incMonth}>
            <Text style={[{ textDecorationLine: 'underline' }, text]}>
              חודש הבא ›
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* List */}
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator />
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r) => String(r.empNo)}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={isDark ? '#fff' : undefined} />
          }
          ListHeaderComponent={
            <View style={{ paddingHorizontal: 16, paddingBottom: 6 }}>
              <Text style={[{ fontSize: 20, fontWeight: '800' }, text]}>סיכום חודשי לעובדים</Text>
              <Text style={[{ opacity: 0.7, marginTop: 4 }, text]}>
                סך שעות לכל עובד בחודש הנבחר
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <View
              style={{
                marginHorizontal: 16,
                marginTop: 8,
                padding: 12,
                borderWidth: 1,
                borderRadius: 10,
                ...panel,
              }}
            >
              <Text style={[{ fontWeight: '700', marginBottom: 4 }, text]}>
                {item.fullName} · מס׳ {item.empNo}
              </Text>
              <Text style={text}>שעות בחודש: {fmtHMS(item.totalMs)}</Text>
            </View>
          )}
          ListEmptyComponent={
            <Text
              style={[
                { opacity: 0.7, textAlign: 'center', marginTop: 16 },
                text,
              ]}
            >
              אין נתונים לחודש הנבחר.
            </Text>
          }
        />
      )}
    </SafeAreaView>
  );
}