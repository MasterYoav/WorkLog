// src/data/repo.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import { supabase } from '../lib/supabase';
const FS = FileSystem as any;

import {
  addProjectMedia,
  appendLocalPunch,
  createProject as createProjectLocal,
  listProjectMedia,
  listProjects as listProjectsLocal,
  Project
} from '../lib/storage';

// ---------- Types ----------
type EmployerRow = {
  employer_no: number;
  name: string;
  email: string;
  password_hash: string;
  created_at: string;
};

type WorkerRow = {
  emp_no: number;
  employer_no: number;
  full_name: string;
  tz: string;
  password_hash: string;
  created_at: string;
};

type PunchRow = {
  id?: number;
  subject_type: 'worker' | 'employer';
  subject_id: number;
  kind: 'in' | 'out';
  ts: string;
  started_at?: string | null;
  duration_ms?: number | null;
  lat?: number | null;
  lng?: number | null;
  accuracy?: number | null;
  address_label?: string | null;
};

type ProjectRow = {
  id?: number;
  employer_no: number;
  name: string;
  location: string;
  created_at?: string;
};

export type ProjectMediaRow = {
  id?: string; // uuid (ענן) — לא בשימוש כרגע
  project_id: number;
  file_path: string; // נתיב קובץ מקומי (sandbox)
  mime?: string | null;
  created_at?: string;
};

// ---------- Offline queue ----------
type PendingOp =
  | { id: string; table: 'punches'; payload: PunchRow }
  | { id: string; table: 'projects'; payload: ProjectRow };

const PENDING_KEY = 'repo:pending_ops';

async function loadPending(): Promise<PendingOp[]> {
  const raw = await AsyncStorage.getItem(PENDING_KEY);
  return raw ? (JSON.parse(raw) as PendingOp[]) : [];
}
async function savePending(list: PendingOp[]) {
  await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(list));
}
function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
async function cloudInsert<T extends object>(table: string, payload: T): Promise<void> {
  const { error } = await supabase.from(table).insert(payload as any);
  if (error) throw error;
}

export async function flushPending(): Promise<{ ok: number; failed: number }> {
  let list = await loadPending();
  if (list.length === 0) return { ok: 0, failed: 0 };
  const next: PendingOp[] = [];
  let ok = 0;
  for (const op of list) {
    try {
      await cloudInsert(op.table, op.payload);
      ok++;
    } catch {
      next.push(op);
    }
  }
  await savePending(next);
  return { ok, failed: next.length };
}

// ---------- Auth (cloud) ----------
export async function cloudLoginEmployer(employerNo: number, password: string): Promise<EmployerRow> {
  const { data, error } = await supabase.from('employers').select('*').eq('employer_no', employerNo).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Employer not found');
  if (data.password_hash !== password) throw new Error('Invalid password');
  return data;
}
export async function cloudLoginWorker(empNo: number, password: string): Promise<WorkerRow> {
  const { data, error } = await supabase.from('workers').select('*').eq('emp_no', empNo).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Worker not found');
  if (data.password_hash !== password) throw new Error('Invalid password');
  return data;
}
export async function cloudRegisterEmployer(name: string, email: string, password: string): Promise<EmployerRow> {
  const payload: Partial<EmployerRow> = { name, email, password_hash: password };
  const { data, error } = await supabase.from('employers').insert(payload).select('*').single();
  if (error) throw error;
  return data;
}
export async function cloudRegisterWorker(
  employerNo: number,
  fullName: string,
  tz: string,
  password: string
): Promise<WorkerRow> {
  const payload: Partial<WorkerRow> = {
    employer_no: employerNo,
    full_name: fullName,
    tz,
    password_hash: password,
  };
  const { data, error } = await supabase.from('workers').insert(payload).select('*').single();
  if (error) throw error;
  return data;
}

// ---------- Punches ----------
type PunchInput = {
  kind: 'in' | 'out';
  ts: string;
  started_at?: string;
  duration_ms?: number;
  lat?: number;
  lng?: number;
  accuracy?: number | null;
  address_label?: string;
};

export async function recordPunchWorker(empNo: number, input: PunchInput) {
  const row: PunchRow = {
    subject_type: 'worker',
    subject_id: empNo,
    kind: input.kind,
    ts: input.ts,
    started_at: input.started_at ?? null,
    duration_ms: input.duration_ms ?? null,
    lat: input.lat,
    lng: input.lng,
    accuracy: input.accuracy ?? null,
    address_label: input.address_label ?? null,
  };

  try {
    await cloudInsert('punches', row);
  } catch {
    const pending = await loadPending();
    pending.push({ id: uid(), table: 'punches', payload: row });
    await savePending(pending);
  }

  await appendLocalPunch(String(empNo), {
    kind: input.kind,
    ts: input.ts,
    lat: input.lat ?? 0,
    lng: input.lng ?? 0,
    acc: input.accuracy ?? undefined,
    address_label: input.address_label,
    started_at: input.started_at ?? undefined,
    duration_ms: input.duration_ms,
  });
}

export async function recordPunchEmployer(employerNo: number, input: PunchInput) {
  const row: PunchRow = {
    subject_type: 'employer',
    subject_id: employerNo,
    kind: input.kind,
    ts: input.ts,
    started_at: input.started_at ?? null,
    duration_ms: input.duration_ms ?? null,
    lat: input.lat,
    lng: input.lng,
    accuracy: input.accuracy ?? null,
    address_label: input.address_label ?? null,
  };

  try {
    await cloudInsert('punches', row);
  } catch {
    const pending = await loadPending();
    pending.push({ id: uid(), table: 'punches', payload: row });
    await savePending(pending);
  }

  await appendLocalPunch(String(employerNo), {
    kind: input.kind,
    ts: input.ts,
    lat: input.lat ?? 0,
    lng: input.lng ?? 0,
    acc: input.accuracy ?? undefined,
    address_label: input.address_label,
    started_at: input.started_at ?? undefined,
    duration_ms: input.duration_ms,
  });
}

// ---------- Projects (cloud-first, local fallback) ----------
export async function createProjectCloud(employerNo: number, name: string, location: string): Promise<ProjectRow> {
  const payload: ProjectRow = { employer_no: employerNo, name, location };
  try {
    const { data, error } = await supabase.from('projects').insert(payload).select('*').single();
    if (error) throw error;
    await createProjectLocal(String(employerNo), data.name, data.location);
    return data;
  } catch {
    const pending = await loadPending();
    pending.push({ id: uid(), table: 'projects', payload });
    await savePending(pending);
    const local = await createProjectLocal(String(employerNo), name, location);
    return { id: local.id, employer_no: employerNo, name, location, created_at: local.createdAt };
  }
}

export async function listProjectsCloudFirst(employerNo: number): Promise<Project[]> {
  try {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('employer_no', employerNo)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map((p) => ({
      id: p.id!,
      employerNo: p.employer_no,
      name: p.name,
      location: p.location,
      createdAt: p.created_at!,
    }));
  } catch {
    return await listProjectsLocal(String(employerNo));
  }
}

// ---------- Project media — LOCAL-ONLY ----------
const MEDIA_ROOT: string = `${(FS.documentDirectory || FS.cacheDirectory || '')}projects/`;

function ensureExt(name?: string, fallbackExt?: string) {
  if (!name) return fallbackExt ? `file${fallbackExt}` : `file`;
  return /\.[a-z0-9]+$/i.test(name) ? name : fallbackExt ? `${name}${fallbackExt}` : name;
}
function guessExtByMime(mime?: string) {
  if (!mime) return '';
  if (mime.startsWith('image/')) return '.' + mime.slice(6);
  if (mime.startsWith('video/')) return '.' + mime.slice(6);
  const map: Record<string, string> = {
    'application/pdf': '.pdf',
    'text/plain': '.txt',
    'application/zip': '.zip',
  };
  return map[mime] ?? '';
}

export async function saveProjectMediaFromUri(
  projectId: number,
  sourceUri: string,
  mime?: string,
  originalName?: string
) {
  const folder = `${MEDIA_ROOT}${projectId}/`;
  await FileSystem.makeDirectoryAsync(folder, { intermediates: true }).catch(() => {});

  const ext = guessExtByMime(mime) || (originalName ? originalName.match(/\.[a-z0-9]+$/i)?.[0] || '' : '');
  const safeName = ensureExt(originalName ?? `media-${Date.now()}`, ext);
  const dest = folder + `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`;

  await FileSystem.copyAsync({ from: sourceUri, to: dest });

  await addProjectMedia(projectId, {
    id: dest, // use absolute path as unique id
    uri: dest,
    type: mime?.startsWith('video/') ? 'video' : mime?.startsWith('image/') ? 'image' : 'file',
    name: safeName,
    createdAt: new Date().toISOString(),
  });

  return { project_id: projectId, file_path: dest, mime, created_at: new Date().toISOString() } as ProjectMediaRow;
}

export async function listProjectMediaLocal(projectId: number) {
  return await listProjectMedia(projectId);
}

/**
 * Local media delete (authoritative write to the right key):
 * - Loads current media from "media:<projectId>"
 * - Filters out any record whose id/uri/file_path matches inputs
 * - Writes the filtered list back to "media:<projectId>"
 * - Best-effort deletes files from disk (ignores missing)
 * - Returns the remaining count
 */
export async function deleteProjectMediaLocal(projectId: number, filePathsOrIds: string[]) {
  const toDelete = new Set(filePathsOrIds);

  // 1) Read current
  const current = await listProjectMedia(projectId);

  // 2) Filter out anything matching id OR uri (both are the absolute path in your impl)
  const keep = (current as any[]).filter(
    (m) => !(toDelete.has(m.id) || toDelete.has(m.uri) || toDelete.has(m.file_path))
  );

  // 3) Persist to the *correct* key: "media:<projectId>"
  const key = `media:${projectId}`;
  await AsyncStorage.setItem(key, JSON.stringify(keep));

  // 4) Try to delete files (ignore errors / missing)
  for (const p of filePathsOrIds) {
    try {
      // @ts-ignore (older SDKs don't type idempotent)
      await FileSystem.deleteAsync(p, { idempotent: true });
    } catch {
      /* ignore */
    }
  }

  // 5) Return remaining count
  return keep.length;
}
// === BEGIN: Workers monthly totals helpers ===
import { listEmployerWorkers, loadLocalPunches } from '../lib/storage';

/**
 * Return [start,end) range for a given year+month (UTC-safe).
 */
export function monthStartEnd(year: number, month0: number) {
  const start = new Date(Date.UTC(year, month0, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, month0 + 1, 1, 0, 0, 0, 0));
  return { startIso: start.toISOString(), endIso: end.toISOString(), start, end };
}

/**
 * Label like "September 2025".
 */
export function monthRangeLabel(year: number, month0: number) {
  return new Date(year, month0, 1).toLocaleString(undefined, { month: 'long', year: 'numeric' });
}

/**
 * Format ms → "HH:MM"
 */
export function formatHm(ms: number) {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Sum total worked ms for a single worker (from LOCAL punches)
 * in [monthStart, monthEnd). Uses 'out' punches' duration_ms.
 */
export async function getWorkerMonthlyTotalMs(workerEmpNo: number, year: number, month0: number) {
  const { startIso, endIso } = monthStartEnd(year, month0);
  const punches = await loadLocalPunches(String(workerEmpNo));
  if (!punches || punches.length === 0) return 0;

  let total = 0;
  for (const p of punches) {
    // We count OUT punches only (they should contain duration_ms).
    if (p.kind !== 'out') continue;
    if (!p.ts) continue;
    if (p.ts >= startIso && p.ts < endIso) {
      total += Math.max(0, p.duration_ms ?? 0);
    }
  }
  return total;
}

/**
 * For an employer, list workers + their total for the given month (LOCAL).
 * Sorted by worker creation time (oldest→newest) as per your listEmployerWorkers.
 */
export async function listWorkersWithMonthlyTotals(
  employerNo: number,
  year: number,
  month0: number
): Promise<Array<{ empNo: number; fullName: string; totalMs: number }>> {
  const workers = await listEmployerWorkers(String(employerNo));
  const rows: Array<{ empNo: number; fullName: string; totalMs: number }> = [];
  for (const w of workers) {
    const totalMs = await getWorkerMonthlyTotalMs(w.empNo, year, month0);
    rows.push({ empNo: w.empNo, fullName: w.fullName, totalMs });
  }
  return rows;
}
// === END: Workers monthly totals helpers ===