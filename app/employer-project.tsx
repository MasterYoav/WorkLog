import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, FlatList, Text, TextInput, TouchableOpacity, useColorScheme, View } from 'react-native';
import { addProjectMedia, getProject, listProjectMedia, Project, ProjectMedia, removeProjectMedia } from '../src/lib/storage';

export default function EmployerProject() {
  const { employerNo = '—', projectId = '0' } = useLocalSearchParams<{ employerNo?: string; projectId?: string }>();
  const pid = parseInt(String(projectId), 10);

  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const text = { color: isDark ? '#fff' : '#000' } as const;
  const bg = { backgroundColor: isDark ? '#000' : '#fff' } as const;
  const card = { backgroundColor: isDark ? '#0f0f0f' : '#f6f6f6', borderColor: isDark ? '#222' : '#ddd' } as const;

  const [project, setProject] = useState<Project | null>(null);
  const [media, setMedia] = useState<ProjectMedia[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({}); // id -> selected
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [manualUri, setManualUri] = useState('');

  async function refresh() {
    const p = await getProject(String(employerNo), pid);
    setProject(p);
    setMedia(await listProjectMedia(String(employerNo), pid));
  }
  useEffect(()=>{ refresh(); }, [employerNo, pid]);

  async function addItem(uri: string, typeHint: 'image'|'video'|'file') {
    const id = `${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
    await addProjectMedia(String(employerNo), pid, { id, type: typeHint, uri });
    await refresh();
  }

  async function onPickCamera() {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (perm.status !== 'granted') { Alert.alert('שגיאה', 'אין הרשאת מצלמה'); return; }
      const res = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.All, quality: 0.8 });
      if (res.canceled) return;
      const a = res.assets?.[0];
      if (!a?.uri) return;
      const type: 'image'|'video' = a.type === 'video' ? 'video' : 'image';
      await addItem(a.uri, type);
    } catch (e:any) { Alert.alert('שגיאה', e?.message ?? 'כשל בצילום'); }
  }

  async function onPickGallery() {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm.status !== 'granted') { Alert.alert('שגיאה', 'אין הרשאת גלריה'); return; }
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.All, quality: 0.9 });
      if (res.canceled) return;
      const a = res.assets?.[0];
      if (!a?.uri) return;
      const type: 'image'|'video' = a.type === 'video' ? 'video' : 'image';
      await addItem(a.uri, type);
    } catch (e:any) { Alert.alert('שגיאה', e?.message ?? 'כשל בבחירת מדיה'); }
  }

  async function onPickDocument() {
    try {
      const res = await DocumentPicker.getDocumentAsync({ multiple: false, copyToCacheDirectory: true });
      if (res.canceled) return;
      const file = res.assets?.[0];
      if (!file?.uri) return;
      await addItem(file.uri, 'file');
    } catch (e:any) { Alert.alert('שגיאה', e?.message ?? 'כשל בבחירת קובץ'); }
  }

  async function onAddManual() {
    if (!manualUri.trim()) { Alert.alert('שגיאה','הזן URI/URL'); return; }
    await addItem(manualUri.trim(), 'file');
    setManualUri('');
  }

  async function onDeleteSelected() {
    const ids = Object.keys(selected).filter(k => selected[k]);
    if(ids.length===0){ Alert.alert('שים לב', 'לא נבחרו קבצים למחיקה'); return; }
    await removeProjectMedia(String(employerNo), pid, ids);
    setSelected({});
    await refresh();
  }

  return (
    <View style={[{ flex: 1, padding: 16 }, bg]}>
      {project ? (
        <>
          <Text style={[{ fontSize: 22, fontWeight: '800' }, text]}>{project.name}</Text>
          <Text style={[{ marginBottom: 10 }, text]}>
            תאריך התחלה: {new Date(project.createdAt).toLocaleDateString()} · מיקום: {project.location}
          </Text>

          {/* Add media panel */}
          <View style={{ padding:12, borderWidth:1, borderRadius:10, marginBottom:10, ...card }}>
            <TouchableOpacity onPress={()=>setShowAddPanel(v=>!v)} style={{ alignSelf:'flex-start' }}>
              <Text style={{ color:'#2563eb', fontWeight:'800' }}>{showAddPanel ? 'סגור הוספת מדיה' : 'הוסף מדיה'}</Text>
            </TouchableOpacity>

            {showAddPanel && (
              <View style={{ marginTop:10, gap:8 }}>
                <View style={{ flexDirection:'row', gap:8, flexWrap:'wrap' }}>
                  <TouchableOpacity onPress={onPickCamera} style={{ backgroundColor:'#2563eb', padding:10, borderRadius:8 }}>
                    <Text style={{ color:'#fff', fontWeight:'800' }}>מצלמה</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={onPickGallery} style={{ backgroundColor:'#2563eb', padding:10, borderRadius:8 }}>
                    <Text style={{ color:'#fff', fontWeight:'800' }}>גלריה</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={onPickDocument} style={{ backgroundColor:'#2563eb', padding:10, borderRadius:8 }}>
                    <Text style={{ color:'#fff', fontWeight:'800' }}>קובץ</Text>
                  </TouchableOpacity>
                </View>

                {/* אופציונלי: הוספה ידנית ב-URI */}
                <View style={{ marginTop:6 }}>
                  <Text style={text}>או הזן URI/URL ידני</Text>
                  <TextInput
                    value={manualUri}
                    onChangeText={setManualUri}
                    placeholder="לדוגמה: https://example.com/file.pdf"
                    placeholderTextColor={isDark?'#aaa':'#888'}
                    style={{ borderWidth:1, borderColor:isDark?'#333':'#ccc', borderRadius:8, padding:10, color:text.color, marginTop:6 }}
                  />
                  <TouchableOpacity onPress={onAddManual} style={{ backgroundColor:'#111827', padding:10, borderRadius:8, alignItems:'center', marginTop:8 }}>
                    <Text style={{ color:'#fff', fontWeight:'800' }}>הוסף</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>

          {/* Media list */}
          <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
            <Text style={[{ fontWeight:'800' }, text]}>קבצים</Text>
            <TouchableOpacity onPress={onDeleteSelected} style={{ backgroundColor:'#cf2e2e', paddingVertical:6, paddingHorizontal:12, borderRadius:8 }}>
              <Text style={{ color:'#fff', fontWeight:'800' }}>מחק נבחרים</Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={media}
            keyExtractor={(m)=>m.id}
            renderItem={({item:m})=>{
              const sel = !!selected[m.id];
              return (
                <TouchableOpacity
                  onPress={()=>setSelected(prev=>({ ...prev, [m.id]: !sel }))}
                  style={{ padding:10, borderWidth:1, borderRadius:10, marginBottom:8, ...card, borderColor: sel ? '#2563eb' : (isDark?'#222':'#ddd') }}
                >
                  <Text style={text}>סוג: {m.type}</Text>
                  <Text style={text} numberOfLines={1}>URI: {m.uri}</Text>
                  <Text style={text}>נוסף: {new Date(m.addedAt).toLocaleString()}</Text>
                  {sel && <Text style={{ color:'#2563eb', marginTop:4 }}>✓ נבחר</Text>}
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={<Text style={[{ opacity:0.7, textAlign:'center', marginTop:16 }, text]}>אין מדיה עדיין.</Text>}
          />
        </>
      ) : (
        <Text style={text}>טוען פרויקט…</Text>
      )}
    </View>
  );
}