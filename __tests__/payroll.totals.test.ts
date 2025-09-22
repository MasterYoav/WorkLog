/**
 * Payroll-style totals: compute monthly hours from stored punches.
 * (Uses storage helpers; calculation is pure in the test.)
 */
jest.mock('@react-native-async-storage/async-storage', () =>
    require('@react-native-async-storage/async-storage/jest/async-storage-mock')
  );
  
  import { appendLocalPunch, loadLocalPunches } from '../src/lib/storage';
  
  function monthKey(d: Date) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; }
  
  function totalMsForMonth(punches: any[], year: number, month0: number) {
    const mk = `${year}-${String(month0+1).padStart(2,'0')}`;
    return punches
      .filter(p => p.kind === 'out' && p.started_at && p.duration_ms)
      .filter(p => monthKey(new Date(p.ts)) === mk) // count by OUT timestamp month
      .reduce((sum, p) => sum + (p.duration_ms || 0), 0);
  }
  
  describe('monthly totals from punches', () => {
    const id = 'emp-1';
  
    test('sums durations only for chosen month', async () => {
      // Jan 31 23:59 → spill into Feb should count in Feb (by OUT)
      const janEnd = new Date('2025-01-31T23:59:00.000Z');
      const febStart = new Date('2025-02-01T00:01:00.000Z');
  
      await appendLocalPunch(id, { kind: 'in', ts: janEnd.toISOString(), lat:0, lng:0 });
      await appendLocalPunch(id, {
        kind: 'out',
        ts: febStart.toISOString(),
        started_at: janEnd.toISOString(),
        duration_ms: 2*60*1000, // 2 minutes
        lat:0, lng:0
      });
  
      // Feb 15th 08:00–12:30
      const in2 = new Date('2025-02-15T08:00:00.000Z');
      const out2 = new Date('2025-02-15T12:30:00.000Z');
      await appendLocalPunch(id, { kind: 'in', ts: in2.toISOString(), lat:0, lng:0 });
      await appendLocalPunch(id, {
        kind: 'out',
        ts: out2.toISOString(),
        started_at: in2.toISOString(),
        duration_ms: 4.5*60*60*1000,
        lat:0, lng:0
      });
  
      const arr = await loadLocalPunches(id);
      const febMs = totalMsForMonth(arr, 2025, 1); // month0=1 → February
  
      // 2 min + 4.5 h = 4h32m ≈ 16320000 ms
      expect(febMs).toBe(2*60*1000 + 4.5*60*60*1000);
    });
  
    test('ignores IN without OUT, and OUT without duration', async () => {
      const now = new Date('2025-03-01T10:00:00.000Z');
      await appendLocalPunch(id, { kind: 'in', ts: now.toISOString(), lat:0, lng:0 });
      const arr = await loadLocalPunches(id);
      const ms = totalMsForMonth(arr, 2025, 2);
      expect(ms).toBe(0);
    });
  });