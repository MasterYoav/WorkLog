/**
 * WorkLog — storage layer tests (AsyncStorage-backed)
 * Covers: employers, workers, passwords, punches, shift state,
 * projects, and media metadata.
 */

jest.mock('@react-native-async-storage/async-storage', () =>
    require('@react-native-async-storage/async-storage/jest/async-storage-mock')
  );
  
  import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    addProjectMedia,
    appendLocalPunch,
    changeEmployerPassword,
    clearShiftStart,
    // Projects & media
    createProject,
    listEmployerWorkers,
    listProjectMedia,
    listProjects,
    loadLocalPunches,
    loadShiftStart,
    loginEmployee,
    loginEmployer,
    // Workers
    registerEmployee,
    // Employers
    registerEmployer,
    removeProjectMedia,
    resetEmployerPassword,
    resetPasswordToTz,
    // Punches & shift
    saveShiftStart
} from '../src/lib/storage';
  
  describe('storage.ts (AsyncStorage helpers)', () => {
    beforeEach(async () => {
      (AsyncStorage as any).clear();
    });
  
    test('employer register/login/reset/change password', async () => {
      const emp = await registerEmployer('Acme', 'secret', 'boss@acme.com');
      expect(emp.employerNo).toBeGreaterThan(0);
      expect(emp.name).toBe('Acme');
  
      // login ok
      const ok = await loginEmployer(String(emp.employerNo), 'secret');
      expect(ok.name).toBe('Acme');
  
      // wrong pass
      await expect(loginEmployer(String(emp.employerNo), 'bad')).rejects.toThrow('סיסמה שגויה');
  
      // reset by email -> returns newPassword
      const { newPassword, employer } = await resetEmployerPassword('boss@acme.com');
      expect(employer.employerNo).toBe(emp.employerNo);
      expect(newPassword.length).toBeGreaterThanOrEqual(8);
  
      // login works with new pass
      const ok2 = await loginEmployer(String(emp.employerNo), newPassword);
      expect(ok2.name).toBe('Acme');
  
      // change password back
      await changeEmployerPassword(String(emp.employerNo), newPassword, 'again');
      const ok3 = await loginEmployer(String(emp.employerNo), 'again');
      expect(ok3.name).toBe('Acme');
    });
  
    test('worker register/login/reset to TZ + listEmployerWorkers sort', async () => {
      const boss = await registerEmployer('BuilderLtd', 'p@ss', 'ceo@builder.com');
  
      const w1 = await registerEmployee('Alice Alpha', '123456789', '1111', String(boss.employerNo));
      const w2 = await registerEmployee('Bob Beta', '222222222', '2222', String(boss.employerNo));
      expect(w1.empNo).not.toBe(w2.empNo);
  
      // login ok & bad
      const ok = await loginEmployee(String(w1.empNo), '1111');
      expect(ok.fullName).toBe('Alice Alpha');
      await expect(loginEmployee(String(w1.empNo), 'WRONG')).rejects.toThrow('סיסמה שגויה');
  
      // reset to TZ
      await resetPasswordToTz(String(w1.empNo));
      const ok2 = await loginEmployee(String(w1.empNo), '123456789');
      expect(ok2.fullName).toBe('Alice Alpha');
  
      // list by employer (sorted by createdAt ascending → w1 then w2)
      const list = await listEmployerWorkers(String(boss.employerNo));
      expect(list.map(w => w.fullName)).toEqual(['Alice Alpha', 'Bob Beta']);
    });
  
    test('shift start/load/clear + punches in/out persisted per subject id', async () => {
      const id = '7777';
      // no shift initially
      expect(await loadShiftStart(id)).toBeNull();
  
      const t0 = new Date().toISOString();
      await saveShiftStart(id, t0);
      expect(await loadShiftStart(id)).toBe(t0);
  
      // append punches
      await appendLocalPunch(id, { kind: 'in', ts: t0, lat: 1, lng: 2, acc: 3, address_label: 'Somewhere' });
      const t1 = new Date().toISOString();
      await appendLocalPunch(id, { kind: 'out', ts: t1, lat: 1, lng: 2, acc: 2, address_label: 'Somewhere', started_at: t0, duration_ms: 5000 });
  
      const arr = await loadLocalPunches(id);
      expect(arr).toHaveLength(2);
      expect(arr[0].kind).toBe('in');
      expect(arr[1].kind).toBe('out');
      expect(arr[1].duration_ms).toBe(5000);
  
      await clearShiftStart(id);
      expect(await loadShiftStart(id)).toBeNull();
    });
  
    test('projects create/list order newest-first', async () => {
      const boss = await registerEmployer('RoadWorks', 'road', 'boss@road.com');
      const p1 = await createProject(String(boss.employerNo), 'Bridge A', 'Jerusalem');
      const p2 = await createProject(String(boss.employerNo), 'Bridge B', 'Haifa');
      expect(p1.id).not.toBe(p2.id);
  
      const list = await listProjects(String(boss.employerNo));
      expect(list[0].id).toBe(p2.id); // newest first
      expect(list[1].id).toBe(p1.id);
    });
  
    test('project media metadata: add/list/remove', async () => {
      const projectId = 123;
      // initially empty
      const empty = await listProjectMedia(projectId);
      expect(empty).toEqual([]);
  
      // add 2 records (metadata only — file I/O is handled in repo.ts tests)
      await addProjectMedia(projectId, {
        id: 'media-1',
        uri: 'file:///docdir/projects/123/photo.jpg',
        type: 'image',
        name: 'photo.jpg',
        createdAt: new Date().toISOString(),
      });
      await addProjectMedia(projectId, {
        id: 'media-2',
        uri: 'file:///docdir/projects/123/spec.pdf',
        type: 'file',
        name: 'spec.pdf',
        createdAt: new Date().toISOString(),
      });
  
      let media = await listProjectMedia(projectId);
      expect(media.map(m => m.id)).toEqual(['media-1', 'media-2']);
  
      // remove first
      await removeProjectMedia(projectId, ['media-1']);
      media = await listProjectMedia(projectId);
      expect(media.map(m => m.id)).toEqual(['media-2']);
    });
  });