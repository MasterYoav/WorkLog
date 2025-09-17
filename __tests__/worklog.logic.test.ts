/**
 * WorkLog — logic E2E-lite tests (no UI)
 * Verifies repo.ts behaviors end-to-end with safe mocks:
 *  - Supabase insert success/failure + offline queue
 *  - Local mirror via AsyncStorage
 *  - Local media save/delete using in-memory FileSystem mock
 */


// ---- AsyncStorage mock (official) ----
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// ---- FileSystem mock (in-memory) ----
type FileRec = { data: string; uri: string; };
const fsStore: Record<string, FileRec> = {};

jest.mock('expo-file-system', () => {
  const pathJoin = (...parts: string[]) => parts.join('/').replace(/\/+/g, '/');

  return {
    __esModule: true,
    documentDirectory: 'file:///docdir/',
    cacheDirectory: 'file:///cachedir/',
    makeDirectoryAsync: async (dir: string, _opts?: any) => {
      // noop in-memory (folders are virtual)
      return;
    },
    copyAsync: async ({ from, to }: { from: string; to: string }) => {
      if (!fsStore[from]) throw new Error(`Source not found: ${from}`);
      fsStore[to] = { ...fsStore[from], uri: to };
    },
    deleteAsync: async (uri: string, _opts?: any) => {
      delete fsStore[uri];
    },
    readAsStringAsync: async (uri: string, opts?: { encoding?: string }) => {
      if (!fsStore[uri]) throw new Error(`Not found: ${uri}`);
      if (opts?.encoding === 'base64') return fsStore[uri].data; // already base64
      return fsStore[uri].data;
    },
    writeAsStringAsync: async (uri: string, data: string, _opts?: any) => {
      fsStore[uri] = { data, uri };
    },
  };
});

// ---- Supabase mock ----
// We mock the exported client from ../src/lib/supabase
// so repo.ts can call supabase.from(...).insert(...)
let supabaseShouldFail = false;
const inserted: Array<{ table: string; payload: any }> = [];

jest.mock('../src/lib/supabase', () => {
  return {
    __esModule: true,
    supabase: {
      from: (table: string) => ({
        insert: async (payload: any) => {
          if (supabaseShouldFail) {
            return { error: new Error('offline / supabase failure') };
          }
          inserted.push({ table, payload });
          return { error: null };
        },
        select: (_: string) => ({
          eq: (_col: string, _val: any) => ({
            maybeSingle: async () => ({ data: null, error: null }), // not used in these tests
            single: async () => ({ data: null, error: null }),
          }),
          order: () => ({ data: [], error: null }),
        }),
      }),
      storage: {
        from: (_bucket: string) => ({
          upload: async () => ({ error: null }), // media is local-only in our repo version
        }),
      },
    },
  };
});

// ---- Import after mocks ----
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    createProjectCloud,
    deleteProjectMediaLocal,
    flushPending,
    listProjectMediaLocal,
    listProjectsCloudFirst,
    recordPunchEmployer,
    recordPunchWorker,
    saveProjectMediaFromUri,
} from '../src/data/repo';

// Helpers
const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));

describe('WorkLog logic (repo layer)', () => {
  beforeEach(async () => {
    // reset mocks
    supabaseShouldFail = false;
    inserted.splice(0, inserted.length);
    (AsyncStorage as any).clear();
    // seed a dummy source file in our FS mock to “copy” from
    fsStore['file:///dummy/image1.jpg'] = { data: 'base64-IMG1', uri: 'file:///dummy/image1.jpg' };
    fsStore['file:///dummy/doc1.pdf'] = { data: 'base64-PDF1', uri: 'file:///dummy/doc1.pdf' };
  });

  test('worker punch in/out writes cloud (when online) + mirrors local', async () => {
    const empNo = 1010;
    const tIn = new Date().toISOString();

    await recordPunchWorker(empNo, {
      kind: 'in',
      ts: tIn,
      lat: 32.1,
      lng: 34.8,
      accuracy: 10,
      address_label: 'רח׳ דן, אורנית',
    });

    // out after 3 seconds
    await wait(10); // don’t actually wait 3s in tests
    const tOut = new Date().toISOString();
    await recordPunchWorker(empNo, {
      kind: 'out',
      ts: tOut,
      started_at: tIn,
      duration_ms: 3000,
      lat: 32.1,
      lng: 34.8,
      accuracy: 8,
      address_label: 'רח׳ דן, אורנית',
    });

    // cloud received both
    expect(inserted.filter(i => i.table === 'punches').length).toBe(2);

    // local mirror exists
    const local = await AsyncStorage.getItem(`punches:${empNo}`);
    expect(local).toBeTruthy();
    const arr = JSON.parse(local!);
    expect(arr).toHaveLength(2);
    expect(arr[0].kind).toBe('in');
    expect(arr[1].kind).toBe('out');
    expect(arr[1].started_at).toBe(tIn);
    expect(arr[1].duration_ms).toBe(3000);
  });

  test('employer punch online/offline queue + flush', async () => {
    const employerNo = 5000;
    const t0 = new Date().toISOString();

    // offline
    supabaseShouldFail = true;
    await recordPunchEmployer(employerNo, {
      kind: 'in',
      ts: t0,
      address_label: 'Test',
    });

    // nothing hit cloud, but pending exists and local mirror written
    expect(inserted.filter(i => i.table === 'punches').length).toBe(0);
    const pendingRaw = await AsyncStorage.getItem('repo:pending_ops');
    expect(pendingRaw && JSON.parse(pendingRaw!).length).toBe(1);

    // back online
    supabaseShouldFail = false;
    const { ok, failed } = await flushPending();
    expect(ok).toBe(1);
    expect(failed).toBe(0);
    expect(inserted.filter(i => i.table === 'punches').length).toBe(1);
  });

  test('create project: cloud success → listed, cloud failure → queued + local fallback', async () => {
    const employerNo = 5000;

    // online
    supabaseShouldFail = false;
    const p1 = await createProjectCloud(employerNo, 'Panorama', 'Oranit');
    expect(p1.name).toBe('Panorama');

    // offline
    supabaseShouldFail = true;
    const p2 = await createProjectCloud(employerNo, 'Nova', 'Tel Aviv');
    expect(p2.name).toBe('Nova');

    // list cloud-first (cloud will fail => fallback local still returns 2)
    const list = await listProjectsCloudFirst(employerNo);
    expect(list.length).toBeGreaterThanOrEqual(2);
  });

  test('project media: save two files locally and delete one', async () => {
    const projectId = 42;

    // Save image from “camera/gallery”
    const m1 = await saveProjectMediaFromUri(projectId, 'file:///dummy/image1.jpg', 'image/jpeg', 'photo.jpg');
    expect(m1.file_path.includes(`/projects/${projectId}/`)).toBe(true);

    // Save PDF from “files”
    const m2 = await saveProjectMediaFromUri(projectId, 'file:///dummy/doc1.pdf', 'application/pdf', 'spec.pdf');

    // List
    let media = await listProjectMediaLocal(projectId);
    expect(media.length).toBe(2);

    // Delete one
    await deleteProjectMediaLocal(projectId, [m1.file_path]);
    media = await listProjectMediaLocal(projectId);
    expect(media.length).toBe(1);
    expect(media[0].uri.endsWith('spec.pdf')).toBe(true);
  });
});