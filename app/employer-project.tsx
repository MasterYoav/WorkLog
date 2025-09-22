import WLLogo from '@/components/WLLogo';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Text,
  TouchableOpacity,
  useColorScheme,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  deleteProjectMediaLocal,
  listProjectMediaLocal,
  saveProjectMediaFromUri,
} from '../src/data/repo';

type MediaItem = {
  id: string;
  uri: string;
  type: 'image' | 'video' | 'file';
  name?: string;
  createdAt: string;
};

export default function EmployerProjectScreen() {
  const { projectId, employerNo } = useLocalSearchParams<{ projectId?: string; employerNo?: string }>();
  const pid = Number(projectId);
  const router = useRouter();
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const text = { color: isDark ? '#fff' : '#000' } as const;
  const bg = { backgroundColor: isDark ? '#000' : '#fff' } as const;
  const panel = { backgroundColor: isDark ? '#0b0b0b' : '#f2f2f2', borderColor: isDark ? '#222' : '#ddd' } as const;

  const [media, setMedia] = useState<MediaItem[]>([]);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  async function refresh() {
    const list = await listProjectMediaLocal(pid);
    setMedia(list as any);
  }

  useEffect(() => {
    refresh();
  }, [pid]);

  function toggleSelect(id: string) {
    setSelected((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  async function pickFromCamera() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('שגיאה', 'אין הרשאת מצלמה');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      quality: 0.8,
    });
    if (result.canceled) return;

    const asset = result.assets[0];
    await saveProjectMediaFromUri(
      pid,
      asset.uri,
      asset.mimeType ?? 'image/jpeg',
      asset.fileName ?? `asset-${Date.now()}.jpg`
    );
    await refresh();
  }

  async function pickFromLibrary() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('שגיאה', 'אין הרשאת גלריה');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: false,
      quality: 0.9,
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      selectionLimit: 1,
    });
    if (result.canceled) return;

    const asset = result.assets[0];
    await saveProjectMediaFromUri(
      pid,
      asset.uri,
      asset.mimeType,
      asset.fileName ?? `file-${Date.now()}`
    );
    await refresh();
  }

  async function pickFromFiles() {
    const res = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
    if (res.canceled) return;
    const file = res.assets[0];
    await saveProjectMediaFromUri(pid, file.uri, file.mimeType, file.name);
    await refresh();
  }

  async function removeSelected() {
    const ids = Object.keys(selected).filter((k) => selected[k]);
    if (ids.length === 0) {
      setSelectMode(false);
      return;
    }
    await deleteProjectMediaLocal(pid, ids);
    setSelected({});
    setSelectMode(false);
    await refresh();
  }

  function Item({ item }: { item: MediaItem }) {
    return (
      <TouchableOpacity
        onPress={() => (selectMode ? toggleSelect(item.id) : null)}
        onLongPress={() => setSelectMode(true)}
        style={{
          width: '48%',
          borderWidth: 1,
          borderRadius: 10,
          padding: 8,
          marginBottom: 10,
          ...panel,
          borderColor: panel.borderColor,
          opacity: selectMode && selected[item.id] ? 0.5 : 1,
        }}
      >
        {item.type === 'image' ? (
          <WLLogo /> 
        ) : (
          <View style={{ alignItems: 'center', justifyContent: 'center', height: 120 }}>
            <Text style={[{ fontSize: 40 }, text]}>{item.type === 'video' ? '🎬' : '📄'}</Text>
          </View>
        )}
        <Text numberOfLines={1} style={[{ marginTop: 6, fontWeight: '600' }, text]}>
          {item.name || item.type}
        </Text>
        <Text style={[{ opacity: 0.6, fontSize: 12 }, text]}>{new Date(item.createdAt).toLocaleString()}</Text>
      </TouchableOpacity>
    );
  }

  return (
    <SafeAreaView style={[{ flex: 1 }, bg]}>
      <View style={{ paddingHorizontal: 16 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, marginBottom: 12 }}>
          <TouchableOpacity onPress={() => router.replace({ pathname: '/employer-home', params: { employerNo } })}>
            <Text style={[{ textDecorationLine: 'underline', fontWeight: '700' }, text]}>חזרה</Text>
          </TouchableOpacity>
            <WLLogo /> 
          {selectMode ? (
            <TouchableOpacity onPress={removeSelected}>
              <Text style={[{ textDecorationLine: 'underline', fontWeight: '700' }, text]}>מחק נבחרים</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={() => setSelectMode(true)}>
              <Text style={[{ textDecorationLine: 'underline' }, text]}>בחר למחיקה</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Add media bar */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
          <TouchableOpacity
            onPress={pickFromCamera}
            style={{ backgroundColor: '#2563eb', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10 }}
          >
            <Text style={{ color: '#fff', fontWeight: '800' }}>מצלמה</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={pickFromLibrary}
            style={{ backgroundColor: '#2563eb', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10 }}
          >
            <Text style={{ color: '#fff', fontWeight: '800' }}>גלריה</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={pickFromFiles}
            style={{ backgroundColor: '#2563eb', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10 }}
          >
            <Text style={{ color: '#fff', fontWeight: '800' }}>קובץ</Text>
          </TouchableOpacity>
        </View>

        {/* Media grid */}
        <FlatList
          data={media}
          keyExtractor={(m) => m.id}
          numColumns={2}
          columnWrapperStyle={{ justifyContent: 'space-between' }}
          renderItem={({ item }) => <Item item={item} />}
          ListEmptyComponent={
            <Text style={[{ opacity: 0.7, textAlign: 'center', marginTop: 20 }, text]}>
              אין מדיה עדיין. הוסף תמונות/וידאו/קבצים לפרויקט.
            </Text>
          }
        />
      </View>
    </SafeAreaView>
  );
}