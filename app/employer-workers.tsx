// app/employer-workers.tsx
import WLLogo from '@/components/WLLogo';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, FlatList, Text, TouchableOpacity, useColorScheme, View } from 'react-native';
import {
  formatHm,
  listEmployerWorkersCloud,
  listWorkerPunchTotalsCloud,
} from '../src/data/repo';

type Row = {
  emp_no: number;
  full_name: string;
  totalMs: number;
};

export default function EmployerWorkersScreen() {
  const router = useRouter();
  const { employerNo = '—' } = useLocalSearchParams<{ employerNo?: string }>();
  const employerNoNum = Number(employerNo);
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  async function loadData() {
    try {
      setLoading(true);
      const workers = await listEmployerWorkersCloud(employerNoNum);
      const totals = await listWorkerPunchTotalsCloud(employerNoNum);
      const mapped: Row[] = workers.map((w) => ({
        emp_no: w.emp_no,
        full_name: w.full_name,
        totalMs: totals[w.emp_no] ?? 0,
      }));
      setRows(mapped);
    } catch (e: any) {
      Alert.alert('שגיאה', e?.message ?? 'כשל בטעינה');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [employerNoNum]);

  const text = { color: isDark ? '#fff' : '#000' } as const;
  const card = {
    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)',
    borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.05)',
  } as const;

  return (
    <View style={{ flex: 1, backgroundColor: isDark ? '#000' : '#fff', paddingTop: 52 }}>
      {/* header */}
      <View
        style={{
          paddingHorizontal: 16,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 10,
        }}
      >
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={[{ fontSize: 16 }, text]}>‹ חזרה</Text>
        </TouchableOpacity>
        <WLLogo />
        <View style={{ width: 50 }} />
      </View>

      <Text style={[{ fontSize: 22, fontWeight: '800', marginBottom: 12, paddingHorizontal: 16 }, text]}>
        סיכום חודשי / כללי
      </Text>

      <FlatList
        data={rows}
        keyExtractor={(r) => String(r.emp_no)}
        refreshing={loading}
        onRefresh={loadData}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 30 }}
        renderItem={({ item }) => (
          <View
            style={{
              padding: 12,
              borderRadius: 16,
              borderWidth: 1,
              marginBottom: 10,
              ...card,
            }}
          >
            <Text style={[{ fontWeight: '700', fontSize: 16 }, text]}>
              {item.full_name} · {item.emp_no}
            </Text>
            <Text style={[{ marginTop: 3 }, text]}>סך שעות: {formatHm(item.totalMs)}</Text>
          </View>
        )}
        ListEmptyComponent={
          <Text style={[{ textAlign: 'center', opacity: 0.6, marginTop: 30 }, text]}>
            אין עובדים להצגה.
          </Text>
        }
      />
    </View>
  );
}