// __tests__/main.test.ts
// טסטים מותאמים לגרסה הנוכחית של src/data/repo.ts

jest.setTimeout(10000);

// --- Mocks ---

jest.mock('expo-file-system', () => {
  return {
    documentDirectory: '/mock-docs/',
    cacheDirectory: '/mock-cache/',
    makeDirectoryAsync: jest.fn(() => Promise.resolve()),
    copyAsync: jest.fn(() => Promise.resolve()),
    deleteAsync: jest.fn(() => Promise.resolve()),
  };
});

jest.mock('@react-native-async-storage/async-storage', () => {
  let store: Record<string, string> = {};
  return {
    setItem: jest.fn(async (k: string, v: string) => {
      store[k] = v;
    }),
    getItem: jest.fn(async (k: string) => store[k] ?? null),
    removeItem: jest.fn(async (k: string) => {
      delete store[k];
    }),
    clear: jest.fn(async () => {
      store = {};
    }),
  };
});

// זה הנתיב שיש לך בקוד
jest.mock('../src/lib/supabase', () => {
  const from = jest.fn();
  const rpc = jest.fn();
  return {
    supabase: {
      from,
      rpc,
    },
  };
});

import {
    changeEmployerPasswordCloud,
    cloudLoginEmployer,
    cloudLoginWorker,
    cloudRegisterEmployer,
    cloudRegisterWorker,
    createProjectCloud,
    deleteProjectMediaLocal,
    formatHm,
    listProjectMediaLocal,
    listProjectsCloud,
    listWorkerPunchTotalsCloud,
    monthStartEnd,
    recordPunchEmployer,
    recordPunchWorker,
    saveProjectMediaFromUri,
    updateEmployerPunchMode,
    updateWorkerPunchMode
} from '../src/data/repo';

import * as FileSystem from 'expo-file-system';
import { supabase } from '../src/lib/supabase';

// --------------------------------------------------
// טסטים
// --------------------------------------------------
describe('WorkLog Cloud Repo Tests (updated)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --------------------------------------------------
  // 1. Employer auth
  // --------------------------------------------------
  it('should register and login employer', async () => {
    // register
    (supabase.from as jest.Mock).mockReturnValueOnce({
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: {
          employer_no: 1,
          name: 'Topwear',
          email: 'boss@topwear.com',
          password_hash: '1234',
          created_at: '2025-10-31T00:00:00.000Z',
          punch_mode: 'site',
        },
        error: null,
      }),
    });

    const emp = await cloudRegisterEmployer('Topwear', 'boss@topwear.com', '1234');
    expect(emp.employer_no).toBe(1);

    // login
    (supabase.from as jest.Mock).mockReturnValueOnce({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({
        data: {
          employer_no: 1,
          name: 'Topwear',
          email: 'boss@topwear.com',
          password_hash: '1234',
          created_at: '2025-10-31T00:00:00.000Z',
          punch_mode: 'site',
        },
        error: null,
      }),
    });

    const logged = await cloudLoginEmployer(1, '1234');
    expect(logged.name).toBe('Topwear');
  });

  // הבעיה שלך הייתה פה – נעשה את זה הכי שטוח שאפשר
  it('should update employer password', async () => {
    // 1. שלב בדיקת הסיסמה הישנה
    (supabase.from as jest.Mock).mockReturnValueOnce({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({
        data: { password_hash: 'oldpass' },
        error: null,
      }),
    });

    // 2. שלב העדכון
    ;(supabase.from as jest.Mock).mockReturnValueOnce({
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockResolvedValue({ error: null }),
    });

    await expect(
      changeEmployerPasswordCloud(1, 'oldpass', 'newpass')
    ).resolves.not.toThrow();

    // נוודא שניגש לטבלת employers פעמיים
    expect((supabase.from as jest.Mock).mock.calls[0][0]).toBe('employers');
    expect((supabase.from as jest.Mock).mock.calls[1][0]).toBe('employers');
  });

  it('should update employer punch mode', async () => {
    (supabase.from as jest.Mock).mockReturnValueOnce({
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockResolvedValue({ error: null }),
    });

    await updateEmployerPunchMode(1, 'anywhere');
    expect((supabase.from as jest.Mock).mock.calls[0][0]).toBe('employers');
  });

  // --------------------------------------------------
  // 2. Worker auth
  // --------------------------------------------------
  it('should register and login worker', async () => {
    // register
    (supabase.from as jest.Mock).mockReturnValueOnce({
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: {
          emp_no: 101,
          employer_no: 1,
          full_name: 'Yoav Worker',
          tz: '123456789',
          password_hash: 'abcd',
          created_at: '2025-10-31T00:00:00.000Z',
          punch_mode: 'site',
        },
        error: null,
      }),
    });

    const w = await cloudRegisterWorker(1, 'Yoav Worker', '123456789', 'abcd');
    expect(w.emp_no).toBe(101);

    // login
    (supabase.from as jest.Mock).mockReturnValueOnce({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({
        data: {
          emp_no: 101,
          employer_no: 1,
          full_name: 'Yoav Worker',
          tz: '123456789',
          password_hash: 'abcd',
          created_at: '2025-10-31T00:00:00.000Z',
          punch_mode: 'site',
        },
        error: null,
      }),
    });

    const logged = await cloudLoginWorker(101, 'abcd');
    expect(logged.full_name).toBe('Yoav Worker');
  });

  it('should update worker punch mode', async () => {
    (supabase.from as jest.Mock).mockReturnValueOnce({
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockResolvedValue({ error: null }),
    });

    await updateWorkerPunchMode(101, 'anywhere');
    expect((supabase.from as jest.Mock).mock.calls[0][0]).toBe('workers');
  });

  // --------------------------------------------------
  // 3. Projects
  // --------------------------------------------------
  it('should create and list projects', async () => {
    // create
    (supabase.from as jest.Mock).mockReturnValueOnce({
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: {
          id: 10,
          employer_no: 1,
          name: 'Project Alpha',
          location: 'Tel Aviv',
          created_at: '2025-10-31T00:00:00.000Z',
        },
        error: null,
      }),
    });

    const p = await createProjectCloud(1, 'Project Alpha', 'Tel Aviv');
    expect(p.id).toBe(10);

    // list
    (supabase.from as jest.Mock).mockReturnValueOnce({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockResolvedValue({
        data: [
          {
            id: 10,
            employer_no: 1,
            name: 'Project Alpha',
            location: 'Tel Aviv',
            created_at: '2025-10-31T00:00:00.000Z',
          },
        ],
        error: null,
      }),
    });

    const list = await listProjectsCloud(1);
    expect(list.length).toBe(1);
    expect(list[0].name).toBe('Project Alpha');
  });

  // --------------------------------------------------
  // 4. Punches (RPC)
  // --------------------------------------------------
  it('should record punch for worker and employer', async () => {
    (supabase.rpc as jest.Mock).mockResolvedValue({ data: null, error: null });
    const ts = new Date().toISOString();

    await recordPunchWorker(101, { kind: 'in', ts });
    await recordPunchEmployer(1, { kind: 'out', ts });

    expect((supabase.rpc as jest.Mock)).toHaveBeenCalledTimes(2);
    expect((supabase.rpc as jest.Mock).mock.calls[0][0]).toBe('punch_worker');
    expect((supabase.rpc as jest.Mock).mock.calls[1][0]).toBe('punch_employer');
  });

  // --------------------------------------------------
  // 5. Workers list + totals
  // --------------------------------------------------
  it('should list employer workers and totals', async () => {
    // 1) נוח לנו להחזיר שני עובדים
    const workersRows = [
      {
        emp_no: 101,
        employer_no: 1,
        full_name: 'W1',
        tz: '1',
        password_hash: 'p',
        created_at: 'x',
      },
      {
        emp_no: 102,
        employer_no: 1,
        full_name: 'W2',
        tz: '2',
        password_hash: 'p',
        created_at: 'x',
      },
    ];
  
    // 2) זה ה-"query object" של punches – חייב לתמוך ב-select().eq().eq().eq() ואז await
    const punchesQuery = {
      // כל הקריאות מחזירות את אותו אובייקט כדי לא לשבור את השרשור
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      // זה מה שגורם ל-await לעבוד: await על אובייקט עם then -> מחזיר את מה שב־resolve
      then: (resolve: any) =>
        resolve({
          data: [{ duration_ms: 5000 }, { duration_ms: 7000 }],
          error: null,
        }),
    };
  
    // 3) גם ל-workers צריך אובייקט שתומך ב-select().eq().order() ואז await
    const workersQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnValue(
        Promise.resolve({
          data: workersRows,
          error: null,
        }),
      ),
    };
  
    // 4) עכשיו המוק הראשי ל-supabase.from(...)
    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'workers') {
        return workersQuery as any;
      }
      if (table === 'punches') {
        return punchesQuery as any;
      }
      // fallback – שלא ניפול אם משהו יקרא לטבלה אחרת
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnValue(
          Promise.resolve({ data: [], error: null }),
        ),
        then: (resolve: any) => resolve({ data: [], error: null }),
      } as any;
    });
  
    // 5) מפעילים את הפונקציה האמיתית שלך
    const totals = await listWorkerPunchTotalsCloud(1);
  
    // 6) בדיקות
    // לכל עובד אמור להיות 5000 + 7000 = 12000
    expect(totals[101]).toBe(12000);
    expect(totals[102]).toBe(12000);
  
    // לוודא שבאמת פנינו גם ל-workers וגם ל-punches
    expect(supabase.from).toHaveBeenCalledWith('workers');
    expect(supabase.from).toHaveBeenCalledWith('punches');
  });

  // --------------------------------------------------
  // 6. Local media
  // --------------------------------------------------
  it('should save and list local project media', async () => {
    const uri = await saveProjectMediaFromUri(
      99,
      '/tmp/source.png',
      'image/png',
      'photo.png'
    );
    expect(FileSystem.copyAsync).toHaveBeenCalled();
    const list = await listProjectMediaLocal(99);
    expect(list.length).toBe(1);
  });

  it('should delete local media files', async () => {
    const uri = await saveProjectMediaFromUri(88, '/tmp/a.png', 'image/png', 'a.png');
    const list1 = await listProjectMediaLocal(88);
    expect(list1.length).toBe(1);

    const remain = await deleteProjectMediaLocal(88, [uri]);
    expect(remain).toHaveLength(0);
    expect(FileSystem.deleteAsync).toHaveBeenCalled();
  });

  // --------------------------------------------------
  // 7. Utils
  // --------------------------------------------------
  it('should format hours correctly', () => {
    expect(formatHm(0)).toBe('00:00');
    expect(formatHm(3600000)).toBe('01:00');
    expect(formatHm(3660000)).toBe('01:01');
  });

  it('should return month range', () => {
    const { startIso, endIso } = monthStartEnd(2025, 0);
    expect(startIso.startsWith('2025-01-01')).toBe(true);
    expect(endIso.startsWith('2025-02-01')).toBe(true);
  });
});