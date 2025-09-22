import WLLogo from '@/components/WLLogo';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Text, TouchableOpacity, useColorScheme, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { formatAddress, getCurrentLocation, haversineMeters, requestForegroundLocation, reverseGeocode } from '../src/lib/location';
import { appendLocalPunch, clearShiftStart, loadShiftStart, saveShiftStart } from '../src/lib/storage';

const SITE_LAT = 32.1105, SITE_LNG = 34.9845, RADIUS_M = 4000, ACCURACY_MAX = 75;
function pad2(n: number){return n.toString().padStart(2,'0');}
function formatDuration(ms:number){const s=Math.max(0,Math.floor(ms/1000));const h=Math.floor(s/3600);const m=Math.floor((s%3600)/60);const sec=s%60;return `${pad2(h)}:${pad2(m)}:${pad2(sec)}`;}
async function getValidLoc(){await requestForegroundLocation();const loc=await getCurrentLocation();if(loc.accuracy!==null && loc.accuracy>ACCURACY_MAX) throw new Error('GPS דיוק נמוך');const dist=haversineMeters(loc.lat,loc.lng,SITE_LAT,SITE_LNG);if(dist>RADIUS_M) throw new Error(`לא באתר (מרחק ~${dist.toFixed(0)} מ')`);const addr=await reverseGeocode(loc.lat,loc.lng);return {...loc,addr,addrLabel:formatAddress(addr)??'מיקום לא ידוע'};}

export default function ClockScreen(){
  const router=useRouter();
  const { empNo='—', name='' } = useLocalSearchParams<{empNo?:string; name?:string}>();
  const scheme=useColorScheme(); const isDark=scheme==='dark';
  const text={color:isDark?'#fff':'#000'} as const;
  const bg={backgroundColor:isDark?'#000':'#fff'} as const;
  const panel={backgroundColor:isDark?'#0b0b0b':'#f2f2f2', borderColor:isDark?'#222':'#ddd'} as const;

  const [busy,setBusy]=useState(false); const [shiftStartIso,setShiftStartIso]=useState<string|null>(null);
  const [tick,setTick]=useState(Date.now()); useEffect(()=>{(async()=>{const s=await loadShiftStart(String(empNo)); if(s) setShiftStartIso(s);})();},[empNo]);
  useEffect(()=>{const t=setInterval(()=>setTick(Date.now()),1000); return ()=>clearInterval(t);},[]);
  const elapsedMs=useMemo(()=>shiftStartIso?Date.now()-new Date(shiftStartIso).getTime():0,[shiftStartIso,tick]); const onShift=!!shiftStartIso;

  async function punch(type: 'in' | 'out') {
    try {
      setBusy(true);
  
      if (type === 'in' && onShift) {
        Alert.alert('שגיאה', 'כבר התחלת משמרת');
        return;
      }
      if (type === 'out' && !onShift) {
        Alert.alert('שגיאה', 'אין משמרת פתוחה');
        return;
      }
  
      const loc = await getValidLoc();
      const ts = new Date().toISOString();
  
      if (type === 'in') {
        await saveShiftStart(String(empNo), ts);
        setShiftStartIso(ts);
  
        await appendLocalPunch(String(empNo), {
          kind: 'in',
          ts,
          lat: loc.lat,
          lng: loc.lng,
          acc: loc.accuracy,
          address: loc.addr,
          address_label: loc.addrLabel,
        });
  
        Alert.alert('כניסה', loc.addrLabel);
      } else {
        const dur = new Date(ts).getTime() - new Date(shiftStartIso!).getTime();
  
        await appendLocalPunch(String(empNo), {
          kind: 'out',
          ts,
          lat: loc.lat,
          lng: loc.lng,
          acc: loc.accuracy,
          address: loc.addr,
          address_label: loc.addrLabel,
          started_at: shiftStartIso ?? undefined, // ✅ כאן התיקון
          duration_ms: dur,
        });
  
        await clearShiftStart(String(empNo));
        setShiftStartIso(null);
  
        Alert.alert('יציאה', `משך: ${formatDuration(dur)}\n${loc.addrLabel}`);
      }
    } catch (e: any) {
      Alert.alert('שגיאה', e?.message ?? 'כשל בפעולת נוכחות');
    } finally {
      setBusy(false);
    }
  }
  return (
    <SafeAreaView style={[{ flex:1 }, bg]}>
      <View style={{ paddingHorizontal:16 }}>
        {/* Header */}
        <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginTop:8, marginBottom:12 }}>
          <WLLogo /> 
          <TouchableOpacity onPress={()=>router.replace('/auth')}><Text style={[{ textDecorationLine:'underline', fontWeight:'700' }, text]}>יציאה</Text></TouchableOpacity>
        </View>

        <Text style={[{ fontSize:18, fontWeight:'800' }, text]}>שלום, {name || 'עובד'} (מס׳ {empNo})</Text>
        <View style={{ marginTop:14, padding:12, borderWidth:1, borderRadius:10, ...panel }}>
          {!onShift ? (
            <TouchableOpacity onPress={()=>punch('in')} disabled={busy}
              style={{ backgroundColor:'#1e9f3c', padding:12, borderRadius:10, alignItems:'center', opacity:busy?0.6:1 }}>
              <Text style={{ color:'#fff', fontWeight:'800' }}>{busy?'מבצע כניסה...':'כניסה'}</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={()=>punch('out')} disabled={busy}
              style={{ backgroundColor:'#cf2e2e', padding:12, borderRadius:10, alignItems:'center', opacity:busy?0.6:1 }}>
              <Text style={{ color:'#fff', fontWeight:'800' }}>{busy?'מבצע יציאה...':'יציאה'}</Text>
            </TouchableOpacity>
          )}
          {onShift && (<Text style={[{ marginTop:8, fontSize:16 }, text]}>זמן במשמרת: {formatDuration(elapsedMs)}</Text>)}
        </View>
      </View>
    </SafeAreaView>
  );
}