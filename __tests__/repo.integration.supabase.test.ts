/**
 * Real Supabase integration test (no mocks for Supabase).
 * It creates employer/worker/projects/punches with a unique runId,
 * verifies rows exist in Supabase, and deletes them afterwards
 * (if SUPABASE_SERVICE_ROLE_KEY is provided).
 */

// Keep AsyncStorage mocked so repo.ts can mirror locally without RN
jest.mock('@react-native-async-storage/async-storage', () =>
    require('@react-native-async-storage/async-storage/jest/async-storage-mock')
  );
  
  // DO NOT mock ../src/lib/supabase — we want real network calls
  import { createClient } from '@supabase/supabase-js';
import {
    cloudRegisterEmployer,
    cloudRegisterWorker,
    createProjectCloud,
    recordPunchEmployer,
    recordPunchWorker,
} from '../src/data/repo';
import { supabase } from '../src/lib/supabase';
  
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL!;
  const anon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;
  if (!url || !anon) {
    throw new Error('Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY for integration test');
  }
  
  // Admin client (optional) for cleanup
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const admin = serviceKey ? createClient(url, serviceKey) : null;
  
  const runId = `it-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  
  describe('Supabase integration (repo.ts)', () => {
    let employerNo: number;
    let workerNo: number;
    let projectId: number | undefined;
  
    test('register employer & worker → create project → punches in/out', async () => {
      // 1) Employer register
      const employer = await cloudRegisterEmployer(`TestCo-${runId}`, `${runId}@example.com`, 'secret123');
      employerNo = employer.employer_no;
      expect(employerNo).toBeGreaterThan(0);
  
      // 2) Worker register (tie to employer)
      const worker = await cloudRegisterWorker(employerNo, `Worker ${runId}`, '123456789', 'wpass');
      workerNo = worker.emp_no;
      expect(workerNo).toBeGreaterThan(0);
  
      // 3) Create project
      const project = await createProjectCloud(employerNo, `Proj-${runId}`, `Loc-${runId}`);
      projectId = project.id;
      expect(projectId).toBeDefined();
  
      // 4) Worker punches
      const tIn = new Date().toISOString();
      await recordPunchWorker(workerNo, {
        kind: 'in',
        ts: tIn,
        lat: 32.1,
        lng: 34.9,
        accuracy: 10,
        address_label: `addr-${runId}`,
      });
  
      const tOut = new Date(Date.now() + 2000).toISOString();
      await recordPunchWorker(workerNo, {
        kind: 'out',
        ts: tOut,
        started_at: tIn,
        duration_ms: 2000,
        lat: 32.1,
        lng: 34.9,
        accuracy: 9,
        address_label: `addr-${runId}`,
      });
  
      // 5) Employer punch once
      await recordPunchEmployer(employerNo, {
        kind: 'in',
        ts: new Date().toISOString(),
        address_label: `emp-${runId}`,
      });
  
      // 6) Verify in DB (read with anon)
      // punches
      const p = await supabase
        .from('punches')
        .select('*')
        .eq('subject_type', 'worker')
        .eq('subject_id', workerNo)
        .eq('address_label', `addr-${runId}`);
      expect(p.error).toBeNull();
      expect((p.data ?? []).length).toBeGreaterThanOrEqual(2);
  
      const pEmp = await supabase
        .from('punches')
        .select('*')
        .eq('subject_type', 'employer')
        .eq('subject_id', employerNo)
        .eq('address_label', `emp-${runId}`);
      expect(pEmp.error).toBeNull();
      expect((pEmp.data ?? []).length).toBeGreaterThanOrEqual(1);
  
      // project
      const proj = await supabase
        .from('projects')
        .select('*')
        .eq('employer_no', employerNo)
        .eq('name', `Proj-${runId}`);
      expect(proj.error).toBeNull();
      expect((proj.data ?? []).length).toBe(1);
    });
  
    afterAll(async () => {
      if (!admin) {
        // No service key — keep data for inspection
        // eslint-disable-next-line no-console
        console.warn(`⚠️ No SUPABASE_SERVICE_ROLE_KEY provided, leaving test data (runId=${runId}) in DB`);
        return;
      }
  
      // Clean up in reverse dependency order
      try {
        await admin.from('punches').delete().like('address_label', `%${runId}%`);
      } catch {}
      try {
        if (projectId) await admin.from('project_media').delete().eq('project_id', projectId);
      } catch {}
      try {
        await admin.from('projects').delete().like('name', `%${runId}%`);
      } catch {}
      try {
        await admin.from('workers').delete().eq('emp_no', workerNo);
      } catch {}
      try {
        await admin.from('employers').delete().eq('employer_no', employerNo);
      } catch {}
    });
  });