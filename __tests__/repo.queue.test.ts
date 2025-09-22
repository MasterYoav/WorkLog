/**
 * Repo queue tests: many ops queued, partial failures, then success.
 */
jest.mock('@react-native-async-storage/async-storage', () =>
    require('@react-native-async-storage/async-storage/jest/async-storage-mock')
  );
  
  import AsyncStorage from '@react-native-async-storage/async-storage';
  
  // supabase mock with controllable failure per call
  let failNext = 0;
  const inserted: Array<{ table: string; payload: any }> = [];
  
  jest.mock('../src/lib/supabase', () => ({
    __esModule: true,
    supabase: {
      from: (table: string) => ({
        insert: async (payload: any) => {
          if (failNext > 0) {
            failNext--;
            return { error: new Error('simulated failure') };
          }
          inserted.push({ table, payload });
          return { error: null };
        },
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
      }),
      storage: { from: () => ({ upload: async () => ({ error: null }) }) },
    },
  }));
  
  import {
    createProjectCloud,
    flushPending,
    recordPunchEmployer,
} from '../src/data/repo';
  
  describe('repo queue flush logic', () => {
    beforeEach(async () => {
      (AsyncStorage as any).clear();
      inserted.splice(0, inserted.length);
      failNext = 0;
    });
  
    test('queues many, flushes some, keeps failed, then completes', async () => {
      // Make 5 ops while "offline"
      failNext = 5;
      await recordPunchEmployer(9000, { kind: 'in', ts: new Date().toISOString() });
      await recordPunchEmployer(9000, { kind: 'out', ts: new Date().toISOString(), started_at: new Date().toISOString(), duration_ms: 1000 });
      await createProjectCloud(9000, 'Alpha', 'TLV');
      await createProjectCloud(9000, 'Beta', 'JLM');
      await recordPunchEmployer(9000, { kind: 'in', ts: new Date().toISOString() });
  
      // First flush: simulate 2 failures remain
      failNext = 2;
      let r1 = await flushPending();
      expect(r1.failed).toBe(2);
      const pending1 = JSON.parse((await AsyncStorage.getItem('repo:pending_ops')) || '[]');
      expect(pending1.length).toBe(2);
  
      // Second flush: all good
      failNext = 0;
      let r2 = await flushPending();
      expect(r2.failed).toBe(0);
      const pending2 = JSON.parse((await AsyncStorage.getItem('repo:pending_ops')) || '[]');
      expect(pending2.length).toBe(0);
  
      // Cloud saw 5 total inserts (punches/projects)
      expect(inserted.length).toBe(5);
    });
  });