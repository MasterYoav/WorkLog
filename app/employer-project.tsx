// app/employer-project.tsx
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, FlatList, Modal, Text, TouchableOpacity, View, useColorScheme } from 'react-native';
import {
  deleteProjectMediaLocal,
  listProjectMediaLocal,
  saveProjectMediaFromUri,
} from '../src/data/repo';
import { supabase } from '../src/lib/supabase';

type MediaItem = {
  id: string;
  uri: string;
  type: 'image' | 'video' | 'file';
  name: string;
  createdAt: string;
};

export default function EmployerProjectScreen() {
  const router = useRouter();
  const { employerNo = '—', projectId = '0' } =
    useLocalSearchParams<{ employerNo?: string; projectId?: string }>();
  const projIdNum = Number(projectId);
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';

  const [projectName, setProjectName] = useState('פרויקט');
  const [projectLocation, setProjectLocation] = useState('');
  const [loading, setLoading] = useState(true);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [showDelete, setShowDelete] = useState(false);

  async function loadProject() {
    try {
      const { data, error } = await supabase.from('projects').select('*').eq('id', projIdNum).maybeSingle();
      if (error) throw error;
      if (data) {
        setProjectName(data.name);
        setProjectLocation(data.location);
      }
    } catch (e: any) {
      Alert.alert('שגיאה', e?.message ?? 'כשל בטעינת פרויקט');
    } finally {
      setLoading(false);
    }
  }

  async function loadMedia() {
    const list = await listProjectMediaLocal(projIdNum);
    setMedia(list);
  }

  useEffect(() => {
    loadProject();
    loadMedia();
  }, [projIdNum]);

  async function onPickImage() {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.All });
    if (res.canceled || !res.assets?.length) return;
    const asset = res.assets[0];
    await saveProjectMediaFromUri(
      projIdNum,
      asset.uri,
      asset.mimeType ?? undefined,
      // @ts-ignore
      asset.fileName ?? asset.uri.split('/').pop() ?? 'media'
    );
    loadMedia();
  }

  async function onPickFile() {
    const res = await DocumentPicker.getDocumentAsync({});
    if (res.canceled || !res.assets?.length) return;
    const asset = res.assets[0];
    await saveProjectMediaFromUri(projIdNum, asset.uri, asset.mimeType ?? undefined, asset.name ?? 'file');
    loadMedia();
  }

  async function onDeleteMedia(item: MediaItem) {
    await deleteProjectMediaLocal(projIdNum, [item.id]);
    loadMedia();
  }

  async function onDeleteProject() {
    try {
      const { error } = await supabase.from('projects').delete().eq('id', projIdNum);
      if (error) {
        // נראה את השגיאה האמיתית של RLS
        Alert.alert('שגיאת מחיקה', error.message);
        return;
      }
      Alert.alert('נמחק', 'הפרויקט נמחק מהדאטהבייס');
      router.back();
    } catch (e: any) {
      Alert.alert('שגיאה', e?.message ?? 'כשל במחיקה');
    } finally {
      setShowDelete(false);
    }
  }

  const text = { color: isDark ? '#fff' : '#000' } as const;
  const bg = { backgroundColor: isDark ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.15)' } as const;
  const card = { backgroundColor: isDark ? '#111' : '#fff' } as const;

  return (
    <View style={[{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16 }, bg]}>
      <View
        style={{
          width: '100%',
          maxWidth: 520,
          maxHeight: '92%',
          borderRadius: 24,
          ...card,
          padding: 16,
        }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={[{ fontSize: 20, fontWeight: '700' }, text]}>
            {loading ? 'טוען...' : projectName}
          </Text>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={[{ fontSize: 20 }, text]}>✕</Text>
          </TouchableOpacity>
        </View>

        <Text style={[{ opacity: 0.6, marginTop: 4 }, text]}>מעסיק: {employerNo}</Text>
        <Text style={[{ opacity: 0.6 }, text]}>מיקום: {projectLocation || '—'}</Text>

        {/* actions */}
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
          <TouchableOpacity
            onPress={onPickImage}
            style={{ backgroundColor: '#2563eb', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10 }}
          >
            <Text style={{ color: '#fff', fontWeight: '700' }}>הוסף תמונה/וידאו</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onPickFile}
            style={{
              backgroundColor: isDark ? '#1f2937' : '#e5e7eb',
              paddingVertical: 8,
              paddingHorizontal: 12,
              borderRadius: 10,
            }}
          >
            <Text style={{ color: text.color, fontWeight: '700' }}>הוסף קובץ</Text>
          </TouchableOpacity>
        </View>

        <Text style={[{ marginTop: 14, marginBottom: 4, fontWeight: '700' }, text]}>קבצים בפרויקט</Text>
        <FlatList
          data={media}
          keyExtractor={(i) => i.id}
          style={{ maxHeight: 250 }}
          ListEmptyComponent={<Text style={[{ opacity: 0.5, textAlign: 'center', marginTop: 10 }, text]}>אין קבצים.</Text>}
          renderItem={({ item }) => (
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottomWidth: 1,
                borderColor: isDark ? '#222' : '#eee',
                paddingVertical: 6,
              }}
            >
              <View>
                <Text style={text}>{item.name}</Text>
                <Text style={[{ opacity: 0.5, fontSize: 12 }, text]}>{item.type}</Text>
              </View>
              <TouchableOpacity onPress={() => onDeleteMedia(item)}>
                <Text style={{ color: '#ef4444' }}>מחק</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      </View>

      {/* delete FAB */}
      <TouchableOpacity
        onPress={() => setShowDelete(true)}
        style={{
          position: 'absolute',
          bottom: 26,
          right: 26,
          backgroundColor: '#ef4444',
          paddingHorizontal: 18,
          paddingVertical: 12,
          borderRadius: 999,
        }}
      >
        <Text style={{ color: '#fff', fontWeight: '700' }}>מחק פרויקט</Text>
      </TouchableOpacity>

      {/* confirm modal */}
      <Modal visible={showDelete} transparent animationType="fade">
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.4)',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 16,
          }}
        >
          <View
            style={{
              backgroundColor: isDark ? '#111' : '#fff',
              borderRadius: 16,
              padding: 16,
              width: '92%',
              maxWidth: 420,
            }}
          >
            <Text style={[{ fontSize: 18, fontWeight: '700', marginBottom: 6 }, text]}>למחוק את הפרויקט?</Text>
            <Text style={[{ marginBottom: 10 }, text]}>
              פעולה זו מוחקת את הרשומה מ־projects. אם יש RLS שלא מאפשר – תופיע שגיאה.
            </Text>
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10 }}>
              <TouchableOpacity onPress={() => setShowDelete(false)}>
                <Text style={text}>ביטול</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={onDeleteProject}
                style={{ backgroundColor: '#ef4444', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8 }}
              >
                <Text style={{ color: '#fff', fontWeight: '700' }}>מחק</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}