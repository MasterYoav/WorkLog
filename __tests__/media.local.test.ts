/**
 * Local media edge cases: duplicates, idempotent delete, odd filenames.
 */
jest.mock('@react-native-async-storage/async-storage', () =>
    require('@react-native-async-storage/async-storage/jest/async-storage-mock')
  );
  
  type FileRec = { data: string; uri: string };
  const fsStore: Record<string, FileRec> = {};
  
  jest.mock('expo-file-system', () => ({
    __esModule: true,
    documentDirectory: 'file:///doc/',
    cacheDirectory: 'file:///cache/',
    makeDirectoryAsync: async () => {},
    copyAsync: async ({ from, to }: { from: string; to: string }) => {
      if (!fsStore[from]) throw new Error('missing source');
      fsStore[to] = { ...fsStore[from], uri: to };
    },
    deleteAsync: async (uri: string) => { delete fsStore[uri]; },
    readAsStringAsync: async (uri: string) => {
      if (!fsStore[uri]) throw new Error('missing');
      return fsStore[uri].data;
    },
    writeAsStringAsync: async (uri: string, data: string) => {
      fsStore[uri] = { data, uri };
    },
  }));
  
  import { deleteProjectMediaLocal, listProjectMediaLocal, saveProjectMediaFromUri } from '../src/data/repo';
  
  describe('local media behavior', () => {
    const pid = 77;
  
    beforeEach(() => {
      for (const k of Object.keys(fsStore)) delete fsStore[k];
      fsStore['file:///seed/photo'] = { data: 'b64', uri: 'file:///seed/photo' };
      fsStore['file:///seed/doc'] = { data: 'b64', uri: 'file:///seed/doc' };
    });
  
    test('duplicate filenames are stored uniquely and listed twice', async () => {
      await saveProjectMediaFromUri(pid, 'file:///seed/photo', 'image/jpeg', 'same.jpg');
      await saveProjectMediaFromUri(pid, 'file:///seed/photo', 'image/jpeg', 'same.jpg');
  
      const media = await listProjectMediaLocal(pid);
      expect(media.length).toBe(2);
      expect(new Set(media.map(m => m.id)).size).toBe(2); // unique ids/paths
    });
  
    test('delete ignores missing files and removes metadata', async () => {
      const a = await saveProjectMediaFromUri(pid, 'file:///seed/doc', 'application/pdf', 'spec.pdf');
      const b = await saveProjectMediaFromUri(pid, 'file:///seed/photo', 'image/jpeg', 'x');
  
      // Manually remove the underlying file of `a` to simulate partial corruption
      delete fsStore[a.file_path];
  
      // Should not throw
      await deleteProjectMediaLocal(pid, [a.file_path, b.file_path]);
  
      const rest = await listProjectMediaLocal(pid);
      expect(rest.length).toBe(0);
    });
  
    test('odd filenames without extension get sensible default', async () => {
      const m = await saveProjectMediaFromUri(pid, 'file:///seed/photo', 'image/jpeg', 'noext');
      expect(m.file_path.includes(`/projects/${pid}/`)).toBe(true);
    });
  });