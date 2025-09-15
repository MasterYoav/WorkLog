import AsyncStorage from '@react-native-async-storage/async-storage';

const k = (s: string) => `worklog:${s}`;

/** ===== Employers ===== */
export type Employer = {
  employerNo: number;
  name: string;
  password: string;
  createdAt: string;
};

const KEY_NEXT_EMPLOYER = k('next_employer_no'); // start 5000
const keyEmployerByNo = (no: string | number) => k(`employer:${no}`);
const keyEmployerWorkers = (no: string | number) => k(`employer:${no}:workers`); // empNo[]

async function getNextEmployerNumber(): Promise<number> {
  const raw = await AsyncStorage.getItem(KEY_NEXT_EMPLOYER);
  const current = raw ? parseInt(raw, 10) : 5000;
  const next = isNaN(current) ? 5001 : current + 1;
  await AsyncStorage.setItem(KEY_NEXT_EMPLOYER, String(next));
  return current;
}

export async function registerEmployer(name: string, password: string): Promise<Employer> {
  const employerNo = await getNextEmployerNumber();
  const employer: Employer = {
    employerNo,
    name,
    password,
    createdAt: new Date().toISOString(),
  };
  await AsyncStorage.setItem(keyEmployerByNo(employerNo), JSON.stringify(employer));
  await AsyncStorage.setItem(keyEmployerWorkers(employerNo), JSON.stringify([]));
  return employer;
}

export async function getEmployerByNo(no: string | number): Promise<Employer | null> {
  const raw = await AsyncStorage.getItem(keyEmployerByNo(no));
  return raw ? (JSON.parse(raw) as Employer) : null;
}

export async function loginEmployer(no: string, password: string): Promise<Employer> {
  const emp = await getEmployerByNo(no);
  if (!emp) throw new Error('מעסיק לא נמצא');
  if (emp.password !== password) throw new Error('סיסמה שגויה');
  return emp;
}

/** ===== Workers ===== */
export type Worker = {
  empNo: number;
  fullName: string;
  tz: string;
  employerNo: number;
  password: string; // MVP only
  createdAt: string;
};

const KEY_NEXT_WORKER = k('next_emp_no'); // start 1000
const keyWorkerByEmp = (empNo: string | number) => k(`worker:${empNo}`);
const keyIdxByTz = (tz: string) => k(`idx:tz:${tz}`);

async function getNextEmployeeNumber(): Promise<number> {
  const raw = await AsyncStorage.getItem(KEY_NEXT_WORKER);
  const current = raw ? parseInt(raw, 10) : 1000;
  const next = isNaN(current) ? 1001 : current + 1;
  await AsyncStorage.setItem(KEY_NEXT_WORKER, String(next));
  return current;
}

export async function getWorkerByEmp(empNo: string | number): Promise<Worker | null> {
  const raw = await AsyncStorage.getItem(keyWorkerByEmp(String(empNo)));
  return raw ? (JSON.parse(raw) as Worker) : null;
}

export async function getWorkerByTz(tz: string): Promise<Worker | null> {
  const empRaw = await AsyncStorage.getItem(keyIdxByTz(tz));
  if (!empRaw) return null;
  return getWorkerByEmp(empRaw);
}

export async function registerEmployee(
  fullName: string,
  tz: string,
  password: string,
  employerNo: string | number
): Promise<Worker> {
  const employer = await getEmployerByNo(employerNo);
  if (!employer) throw new Error('מספר מעסיק לא קיים');

  const existing = await getWorkerByTz(tz);
  if (existing) return existing;

  const empNo = await getNextEmployeeNumber();
  const worker: Worker = {
    empNo,
    fullName,
    tz,
    employerNo: Number(employerNo),
    password,
    createdAt: new Date().toISOString(),
  };
  await AsyncStorage.setItem(keyWorkerByEmp(empNo), JSON.stringify(worker));
  await AsyncStorage.setItem(keyIdxByTz(tz), String(empNo));

  const listRaw = (await AsyncStorage.getItem(keyEmployerWorkers(employerNo))) ?? '[]';
  const list = JSON.parse(listRaw);
  list.push(empNo);
  await AsyncStorage.setItem(keyEmployerWorkers(employerNo), JSON.stringify(list));

  return worker;
}

export async function loginEmployee(empNo: string, password: string): Promise<Worker> {
  const w = await getWorkerByEmp(empNo);
  if (!w) throw new Error('עובד לא נמצא');
  if (w.password !== password) throw new Error('סיסמה שגויה');
  return w;
}

export async function resetPasswordToTz(empNo: string): Promise<void> {
  const w = await getWorkerByEmp(empNo);
  if (!w) throw new Error('עובד לא נמצא');
  w.password = w.tz;
  await AsyncStorage.setItem(keyWorkerByEmp(empNo), JSON.stringify(w));
}

export async function changePassword(empNo: string, newPassword: string): Promise<void> {
  const w = await getWorkerByEmp(empNo);
  if (!w) throw new Error('עובד לא נמצא');
  w.password = newPassword;
  await AsyncStorage.setItem(keyWorkerByEmp(empNo), JSON.stringify(w));
}

export async function listEmployerWorkers(employerNo: string | number): Promise<Worker[]> {
  const listRaw = (await AsyncStorage.getItem(keyEmployerWorkers(employerNo))) ?? '[]';
  const ids: number[] = JSON.parse(listRaw);
  const workers: Worker[] = [];
  for (const id of ids) {
    const w = await getWorkerByEmp(id);
    if (w) workers.push(w);
  }
  workers.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  return workers;
}

/** ===== Punches ===== */
const keyShiftStart = (empNo: string | number) => k(`shift_start:${empNo}`);
const keyPunches = (empNo: string | number) => k(`punches:${empNo}`);

export async function saveShiftStart(empNo: string | number, iso: string) {
  await AsyncStorage.setItem(keyShiftStart(empNo), iso);
}
export async function loadShiftStart(empNo: string | number): Promise<string | null> {
  return AsyncStorage.getItem(keyShiftStart(empNo));
}
export async function clearShiftStart(empNo: string | number) {
  await AsyncStorage.removeItem(keyShiftStart(empNo));
}

export async function appendLocalPunch(empNo: string | number, punch: any) {
  const key = keyPunches(empNo);
  const raw = (await AsyncStorage.getItem(key)) ?? '[]';
  const arr = JSON.parse(raw);
  arr.push(punch);
  await AsyncStorage.setItem(key, JSON.stringify(arr));
}
export async function loadLocalPunches(empNo: string | number): Promise<any[]> {
  const key = keyPunches(empNo);
  const raw = (await AsyncStorage.getItem(key)) ?? '[]';
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

/** ===== Projects & Media ===== */
export type Project = {
  id: number;
  employerNo: number;
  name: string;
  location: string; // היה city
  createdAt: string;
};

export type ProjectMedia = {
  id: string;
  type: 'image' | 'video' | 'file';
  uri: string;
  addedAt: string;
};

const keyNextProjectId = (employerNo: string | number) => k(`employer:${employerNo}:next_project_id`);
const keyProjects = (employerNo: string | number) => k(`employer:${employerNo}:projects`);
const keyProjectMedia = (employerNo: string | number, projectId: number) =>
  k(`employer:${employerNo}:project:${projectId}:media`);

async function getNextProjectId(employerNo: string | number): Promise<number> {
  const raw = await AsyncStorage.getItem(keyNextProjectId(employerNo));
  const current = raw ? parseInt(raw, 10) : 1;
  const next = isNaN(current) ? 2 : current + 1;
  await AsyncStorage.setItem(keyNextProjectId(employerNo), String(next));
  return current;
}

export async function createProject(employerNo: string | number, name: string, location: string): Promise<Project> {
  const id = await getNextProjectId(employerNo);
  const p: Project = {
    id,
    employerNo: Number(employerNo),
    name,
    location,
    createdAt: new Date().toISOString(),
  };
  const raw = (await AsyncStorage.getItem(keyProjects(employerNo))) ?? '[]';
  const arr: Project[] = JSON.parse(raw);
  arr.push(p);
  await AsyncStorage.setItem(keyProjects(employerNo), JSON.stringify(arr));
  await AsyncStorage.setItem(keyProjectMedia(employerNo, id), JSON.stringify([]));
  return p;
}

export async function listProjects(employerNo: string | number): Promise<Project[]> {
  const raw = (await AsyncStorage.getItem(keyProjects(employerNo))) ?? '[]';
  const arr: any[] = JSON.parse(raw);
  // תמיכה לאחור: אם נשמר city בעבר – נמפה ל-location
  const mapped: Project[] = arr.map((p) => ({
    id: p.id,
    employerNo: Number(p.employerNo),
    name: p.name,
    location: p.location ?? p.city ?? '',
    createdAt: p.createdAt,
  }));
  return mapped.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function getProject(employerNo: string | number, projectId: number): Promise<Project | null> {
  const items = await listProjects(employerNo);
  return items.find(p => p.id === projectId) ?? null;
}

export async function listProjectMedia(employerNo: string | number, projectId: number): Promise<ProjectMedia[]> {
  const raw = (await AsyncStorage.getItem(keyProjectMedia(employerNo, projectId))) ?? '[]';
  return JSON.parse(raw);
}

export async function addProjectMedia(
  employerNo: string | number,
  projectId: number,
  item: Omit<ProjectMedia, 'addedAt'>
) {
  const arr = await listProjectMedia(employerNo, projectId);
  arr.push({ ...item, addedAt: new Date().toISOString() });
  await AsyncStorage.setItem(keyProjectMedia(employerNo, projectId), JSON.stringify(arr));
}

export async function removeProjectMedia(
  employerNo: string | number,
  projectId: number,
  ids: string[]
) {
  const arr = await listProjectMedia(employerNo, projectId);
  const filtered = arr.filter(m => !ids.includes(m.id));
  await AsyncStorage.setItem(keyProjectMedia(employerNo, projectId), JSON.stringify(filtered));
}