import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Image, Text, TextInput, TouchableOpacity, useColorScheme, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { formatAddress, getCurrentLocation, haversineMeters, requestForegroundLocation, reverseGeocode } from '../src/lib/location';
import {
  appendLocalPunch,
  changeEmployerPassword,
  clearShiftStart,
  createProject,
  listEmployerWorkers,
  listProjects,
  loadLocalPunches,
  loadShiftStart,
  Project,
  saveShiftStart,
  Worker
} from '../src/lib/storage';

const SITE_LAT = 32.1105;
const SITE_LNG = 34.9845;
const RADIUS_M = 4000;
const ACCURACY_MAX = 75;

function pad2(n: number) { return n.toString().padStart(2, '0'); }
function formatDurationHMS(ms: number) { const s = Math.max(0, Math.floor(ms/1000)); const h = Math.floor(s/3600); const m = Math.floor((s%3600)/60); const sec = s%60; return `${pad2(h)}:${pad2(m)}:${pad2(sec)}`; }
async function getValidLoc() { await requestForegroundLocation(); const loc = await getCurrentLocation(); if (loc.accuracy!==null && loc.accuracy>ACCURACY_MAX) throw new Error('GPS דיוק נמוך'); const dist = haversineMeters(loc.lat, loc.lng, SITE_LAT, SITE_LNG); if (dist>RADIUS_M) throw new Error(`לא באתר (מרחק ~${dist.toFixed(0)} מ')`); const addr = await reverseGeocode(loc.lat, loc.lng); return { ...loc, addr, addrLabel: formatAddress(addr) ?? 'מיקום לא ידוע' }; }

type Section = 'clock' | 'me' | 'workers' | 'projects';

export default function EmployerHome() {
  const router = useRouter();
  const { employerNo = '—', company = '' } = useLocalSearchParams<{ employerNo?: string; company?: string }>();

  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const text = { color: isDark ? '#fff' : '#000' } as const;
  const bg = { backgroundColor: isDark ? '#000' : '#fff' } as const;
  const panel = { backgroundColor: isDark ? '#0b0b0b' : '#f2f2f2', borderColor: isDark ? '#222' : '#ddd' } as const;

  const [menuOpen, setMenuOpen] = useState(true);
  const [section, setSection] = useState<Section>('clock');

  // שינוי סיסמה (מיני-טופס)
  const [showChangePass, setShowChangePass] = useState(false);
  const [oldPass, setOldPass] = useState('');
  const [newPass, setNewPass] = useState('');

  // ==== CLOCK ====
  const [busy, setBusy] = useState(false);
  const [shiftStartIso, setShiftStartIso] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const isOnShift = !!shiftStartIso;

  useEffect(() => { (async () => { const s = await loadShiftStart(String(employerNo)); if (s) setShiftStartIso(s); })(); }, [employerNo]);
  useEffect(() => { if (!isOnShift) return; const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, [isOnShift]);
  const elapsedMs = useMemo(() => shiftStartIso ? Date.now() - new Date(shiftStartIso).getTime() : 0, [shiftStartIso, now]);

  async function punch(type: 'in' | 'out') {
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
  
      // אימות מיקום + כתובת קריאה
      const loc = await getValidLoc();
      const ts = new Date().toISOString();
  
      if (type === 'in') {
        // שומר התחלה
        await saveShiftStart(String(employerNo), ts);
        setShiftStartIso(ts);
  
        // לוג כניסה
        await appendLocalPunch(String(employerNo), {
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
        // יציאה — חישוב משך מההתחלה השמורה
        const dur = new Date(ts).getTime() - new Date(shiftStartIso!).getTime();
  
        await appendLocalPunch(String(employerNo), {
          kind: 'out',
          ts,
          lat: loc.lat,
          lng: loc.lng,
          acc: loc.accuracy,
          address: loc.addr,
          address_label: loc.addrLabel,
          started_at: shiftStartIso ?? undefined, // ✅ המרה מ-null ל-undefined
          duration_ms: dur,
        });
  
        await clearShiftStart(String(employerNo));
        setShiftStartIso(null);
  
        Alert.alert('יציאה', `משך: ${formatDurationHMS(dur)}\n${loc.addrLabel}`);
      }
    } catch (e: any) {
      Alert.alert('שגיאה', e?.message ?? 'כשל בפעולת נוכחות');
    } finally {
      setBusy(false);
    }
  }

  // PERSONAL (employer)
  const nowD = new Date();
  const [mMe, setMMe] = useState(nowD.getMonth());
  const [yMe, setYMe] = useState(nowD.getFullYear());
  const [meRows, setMeRows] = useState<any[]>([]);
  useEffect(()=>{(async()=>{ const pins = await loadLocalPunches(String(employerNo));
    const outs = pins.filter((p:any)=>p.kind==='out' && p.duration_ms && p.started_at)
      .map((p:any)=>({ key:p.ts, date:new Date(p.started_at), durationMs:p.duration_ms, address_label:p.address_label ?? formatAddress(p.address) ?? '—' }))
      .sort((a:any,b:any)=>b.date.getTime()-a.date.getTime()); setMeRows(outs); })();},[employerNo]);
  const meFiltered = useMemo(()=>meRows.filter(r=>r.date.getFullYear()===yMe && r.date.getMonth()===mMe),[meRows,yMe,mMe]);
  const meTotalMs = useMemo(()=>meFiltered.reduce((s,r)=>s+(r.durationMs||0),0),[meFiltered]);
  function shiftMonth(setM:(n:number)=>void,setY:(n:number)=>void,m:number,y:number,d:number){ let mm=m+d,yy=y; if(mm<0){mm=11;yy--;} if(mm>11){mm=0;yy++;} setM(mm); setY(yy); }

  // WORKERS (all-time totals)
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [workerHours, setWorkerHours] = useState<Record<number,number>>({});
  useEffect(()=>{(async()=>{ setWorkers(await listEmployerWorkers(String(employerNo))); })();},[employerNo]);
  useEffect(()=>{(async()=>{ const map:Record<number,number>={}; for(const w of workers){ const pins=await loadLocalPunches(String(w.empNo)); const tot=pins.filter((p:any)=>p.kind==='out' && p.duration_ms && p.started_at).reduce((s:number,p:any)=>s+(p.duration_ms as number),0); map[w.empNo]=tot; } setWorkerHours(map); })();},[workers]);

  // PROJECTS
  const [projName, setProjName] = useState(''); const [projLocation, setProjLocation] = useState('');
  const [projects, setProjects] = useState<Project[]>([]); const refreshProjects=async()=>setProjects(await listProjects(String(employerNo)));
  useEffect(()=>{ refreshProjects(); },[employerNo]);
  async function onCreateProject(){ try{ if(!projName.trim()){Alert.alert('שגיאה','אנא הזן שם פרויקט'); return;} if(!projLocation.trim()){Alert.alert('שגיאה','אנא הזן מיקום'); return;}
    const p=await createProject(String(employerNo), projName.trim(), projLocation.trim()); setProjName(''); setProjLocation(''); await refreshProjects(); Alert.alert('נוצר פרויקט', `${p.name} (${p.location})`);
  }catch(e:any){ Alert.alert('שגיאה', e?.message ?? 'כשל ביצירת פרויקט'); } }
  function openProject(p:Project){ router.push({ pathname:'/employer-project', params:{ employerNo:String(employerNo), projectId:String(p.id) } }); }

  async function submitChangePassword(){
    try{
      if(!oldPass || !newPass || newPass.length<4){ Alert.alert('שגיאה','מלא סיסמה נוכחית וסיסמה חדשה (לפחות 4 תווים).'); return; }
      await changeEmployerPassword(String(employerNo), oldPass, newPass);
      setOldPass(''); setNewPass(''); setShowChangePass(false);
      Alert.alert('בוצע','הסיסמה עודכנה בהצלחה');
    }catch(e:any){ Alert.alert('שגיאה', e?.message ?? 'כשל בעדכון סיסמה'); }
  }

  function MenuButton({label, active, onPress}:{label:string;active:boolean;onPress:()=>void}){
    return(<TouchableOpacity onPress={onPress} style={{paddingVertical:10}}><Text style={{color:active?'#3b82f6':text.color,fontWeight:active?'800':'600'}}>{label}</Text></TouchableOpacity>);
  }

  return (
    <SafeAreaView style={[{ flex: 1, flexDirection: 'row' }, bg]}>
      {/* Sidebar */}
      {menuOpen && (
        <View style={{ width: 240, padding: 14, borderRightWidth: 1, ...panel }}>
          <TouchableOpacity onPress={()=>setMenuOpen(false)} style={{ alignSelf:'flex-end', marginBottom: 8 }}>
            <Text style={[{ fontWeight:'800' }, text]}>✕</Text>
          </TouchableOpacity>

          <Text style={[{ fontSize: 18, fontWeight: '800', marginBottom: 8 }, text]}>{company || 'המעסיק שלי'}</Text>
          <Text style={[{ opacity: 0.7, marginBottom: 10 }, text]}>מס׳ מעסיק: {employerNo}</Text>
          <MenuButton label="שעון נוכחות" active={section==='clock'} onPress={()=>setSection('clock')} />
          <MenuButton label="מידע אישי" active={section==='me'} onPress={()=>setSection('me')} />
          <MenuButton label="העובדים שלי" active={section==='workers'} onPress={()=>setSection('workers')} />
          <MenuButton label="הפרויקטים שלי" active={section==='projects'} onPress={()=>setSection('projects')} />
        </View>
      )}

      {/* Content + SafeArea */}
      <View style={{ flex: 1, paddingHorizontal: 16 }}>
        {/* Header */}
        <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginTop: 8, marginBottom: 12 }}>
          <TouchableOpacity onPress={()=>setMenuOpen(true)} style={{ paddingVertical:4, paddingHorizontal:8 }}>
            <Text style={[{ fontSize: 18 }, text]}>☰</Text>
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Image source={require('../assets/logo.png')} style={{ width: 120, height: 40, resizeMode: 'contain' }} />
          </View>
          <TouchableOpacity onPress={() => router.replace('/auth')} style={{ paddingVertical: 4, paddingHorizontal: 8 }}>
            <Text style={[{ textDecorationLine: 'underline', fontWeight: '700' }, text]}>יציאה</Text>
          </TouchableOpacity>
        </View>

        {/* כפתור שינוי סיסמה קטן מתחת להדר */}
        <View style={{ alignItems: 'flex-end', marginBottom: 6 }}>
          {!showChangePass ? (
            <TouchableOpacity onPress={()=>setShowChangePass(true)}><Text style={[{ textDecorationLine:'underline' }, text]}>שינוי סיסמה</Text></TouchableOpacity>
          ) : (
            <View style={{ borderWidth:1, borderRadius:10, padding:10, ...panel, width:'100%' }}>
              <Text style={[{ fontWeight:'700', marginBottom:6 }, text]}>שינוי סיסמה</Text>
              <TextInput value={oldPass} onChangeText={setOldPass} placeholder="סיסמה נוכחית" secureTextEntry
                placeholderTextColor={isDark?'#aaa':'#888'}
                style={{ borderWidth:1, borderColor:isDark?'#333':'#ccc', borderRadius:8, padding:10, color:text.color, marginBottom:6 }} />
              <TextInput value={newPass} onChangeText={setNewPass} placeholder="סיסמה חדשה" secureTextEntry
                placeholderTextColor={isDark?'#aaa':'#888'}
                style={{ borderWidth:1, borderColor:isDark?'#333':'#ccc', borderRadius:8, padding:10, color:text.color, marginBottom:8 }} />
              <View style={{ flexDirection:'row', justifyContent:'flex-end', gap:12 }}>
                <TouchableOpacity onPress={()=>{setShowChangePass(false); setOldPass(''); setNewPass('');}}>
                  <Text style={[{ textDecorationLine:'underline' }, text]}>ביטול</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={submitChangePassword} style={{ backgroundColor:'#2563eb', paddingVertical:8, paddingHorizontal:12, borderRadius:8 }}>
                  <Text style={{ color:'#fff', fontWeight:'800' }}>עדכן</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {section === 'clock' && (
          <View>
            <Text style={[{ fontSize: 20, fontWeight: '800', marginBottom: 10 }, text]}>שעון נוכחות (מעסיק)</Text>
            {!isOnShift ? (
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
            {isOnShift && (<Text style={[{ marginTop: 8, fontSize: 16 }, text]}>זמן במשמרת: {formatDurationHMS(elapsedMs)}</Text>)}
          </View>
        )}

        {section === 'me' && (
          <FlatList
            data={meFiltered}
            keyExtractor={(i)=>i.key}
            ListHeaderComponent={
              <View>
                <Text style={[{ fontSize: 20, fontWeight: '800' }, text]}>מידע אישי (מעסיק)</Text>
                <View style={{ flexDirection:'row', justifyContent:'space-between', marginTop:8 }}>
                  <TouchableOpacity onPress={()=>shiftMonth(setMMe,setYMe,mMe,yMe,-1)}><Text style={[{ textDecorationLine:'underline' }, text]}>‹ חודש קודם</Text></TouchableOpacity>
                  <Text style={[{ fontWeight:'800' }, text]}>{yMe}-{pad2(mMe+1)}</Text>
                  <TouchableOpacity onPress={()=>shiftMonth(setMMe,setYMe,mMe,yMe,1)}><Text style={[{ textDecorationLine:'underline' }, text]}>חודש הבא ›</Text></TouchableOpacity>
                </View>
                <View style={{ marginTop:10, padding:12, borderWidth:1, borderRadius:10, ...panel }}>
                  <Text style={[{ fontWeight:'700' }, text]}>סך שעות: {formatDurationHMS(meTotalMs)}</Text>
                </View>
              </View>
            }
            renderItem={({item})=>(
              <View style={{ padding:10, borderWidth:1, borderRadius:10, marginTop:8, ...panel }}>
                <Text style={text}>תאריך: {item.date.toLocaleDateString()}</Text>
                <Text style={text}>אורך: {formatDurationHMS(item.durationMs)}</Text>
                <Text style={text}>מיקום: {item.address_label}</Text>
              </View>
            )}
            ListEmptyComponent={<Text style={[{ opacity:0.7, textAlign:'center', marginTop:16 }, text]}>אין נתונים לחודש הנבחר.</Text>}
          />
        )}

        {section === 'workers' && (
          <FlatList
            data={workers}
            keyExtractor={(w)=>String(w.empNo)}
            ListHeaderComponent={
              <View>
                <Text style={[{ fontSize: 20, fontWeight: '800' }, text]}>העובדים שלי</Text>
                <Text style={[{ opacity: 0.7, marginTop: 6 }, text]}>מסודר מהוותיק לחדש · סך שעות בכל הזמנים</Text>
              </View>
            }
            renderItem={({item:w})=>{
              const ms = workerHours[w.empNo] ?? 0;
              return (
                <View style={{ padding:10, borderWidth:1, borderRadius:10, marginTop:8, ...panel }}>
                  <Text style={[{ fontWeight:'700' }, text]}>{w.fullName} · מס׳ {w.empNo}</Text>
                  <Text style={text}>סך שעות: {formatDurationHMS(ms)}</Text>
                </View>
              );
            }}
            ListEmptyComponent={<Text style={[{ opacity:0.7, textAlign:'center', marginTop:16 }, text]}>אין עובדים משויכים.</Text>}
          />
        )}

        {section === 'projects' && (
          <FlatList
            data={projects}
            keyExtractor={(p)=>String(p.id)}
            ListHeaderComponent={
              <View>
                <Text style={[{ fontSize:20, fontWeight:'800' }, text]}>הפרויקטים שלי</Text>
                <View style={{ marginTop:10, padding:12, borderWidth:1, borderRadius:10, gap:8, ...panel }}>
                  <Text style={text}>שם פרויקט</Text>
                  <TextInput value={projName} onChangeText={setProjName}
                    placeholder="למשל: שיפוץ רח' הרצל 12" placeholderTextColor={isDark?'#aaa':'#888'}
                    style={{ borderWidth:1, borderColor:isDark?'#333':'#ccc', borderRadius:8, padding:10, color:text.color }} />
                  <Text style={text}>מיקום</Text>
                  <TextInput value={projLocation} onChangeText={setProjLocation}
                    placeholder="Tel Aviv / Jerusalem / London" placeholderTextColor={isDark?'#aaa':'#888'}
                    style={{ borderWidth:1, borderColor:isDark?'#333':'#ccc', borderRadius:8, padding:10, color:text.color }} />
                  <TouchableOpacity onPress={onCreateProject}
                    style={{ backgroundColor:'#2563eb', padding:12, borderRadius:8, alignItems:'center' }}>
                    <Text style={{ color:'#fff', fontWeight:'800' }}>הוסף פרויקט</Text>
                  </TouchableOpacity>
                </View>
              </View>
            }
            renderItem={({item:p})=>(
              <TouchableOpacity onPress={()=>openProject(p)} activeOpacity={0.8}
                style={{ padding:12, borderWidth:1, borderRadius:10, marginTop:8, ...panel }}>
                <Text style={[{ fontWeight:'800' }, text]}>{p.name}</Text>
                <Text style={text}>מיקום: {p.location}</Text>
                <Text style={text}>נוצר: {new Date(p.createdAt).toLocaleString()}</Text>
              </TouchableOpacity>
            )}
            ListEmptyComponent={<Text style={[{ opacity:0.7, textAlign:'center', marginTop:16 }, text]}>אין פרויקטים עדיין.</Text>}
          />
        )}
      </View>
    </SafeAreaView>
  );
}