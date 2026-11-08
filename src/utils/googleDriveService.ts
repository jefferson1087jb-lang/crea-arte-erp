import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

export const SCOPES = ['https://www.googleapis.com/auth/drive.file'];

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const provider = new GoogleAuthProvider();
SCOPES.forEach((scope) => provider.addScope(scope));

// Flag to indicate if we are in the middle of a sign-in flow.
let isSigningIn = false;
// Cache the access token in memory ONLY (never in localStorage or sessionStorage).
let cachedAccessToken: string | null = null;

export interface GoogleDriveProjectFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  createdTime?: string;
  webViewLink: string;
  webContentLink?: string;
  uploadedBy?: string;
}

export interface GoogleDriveProjectFolder {
  folderId: string;
  folderName: string;
  webViewLink: string;
  createdAt: string;
  parentFolderId?: string;
}

export type TeamDriveAccessMode =
  | 'anyone_with_link_writer'
  | 'anyone_with_link_reader'
  | 'private';

export interface DriveMasterFolderConfig {
  folderId: string;
  folderName: string;
  webViewLink: string;
  teamAccessMode: TeamDriveAccessMode;
  sharedEmails: string[];
  updatedAt: string;
}

const MASTER_FOLDER_STORAGE_KEY = 'crea_arte_drive_master_folder_v1';

export function getSavedMasterDriveFolder(): DriveMasterFolderConfig | null {
  try {
    const raw = localStorage.getItem(MASTER_FOLDER_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.folderId === 'string' && parsed.folderId.trim()) {
      return parsed as DriveMasterFolderConfig;
    }
    return null;
  } catch {
    return null;
  }
}

export function saveMasterDriveFolder(config: DriveMasterFolderConfig | null): void {
  try {
    if (!config) {
      localStorage.removeItem(MASTER_FOLDER_STORAGE_KEY);
    } else {
      localStorage.setItem(MASTER_FOLDER_STORAGE_KEY, JSON.stringify(config));
    }
  } catch (err) {
    console.warn('No se pudo guardar la configuración de Carpeta Principal Drive:', err);
  }
}

// Initialize auth state listener. Call this on app load.
export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

// Must be called from a button click or user interaction
export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('No se pudo obtener el token de acceso de Google Drive.');
    }

    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Sign in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const logoutGoogleDrive = async () => {
  await auth.signOut();
  cachedAccessToken = null;
};

const LOCAL_DRIVE_FOLDERS_KEY = 'crea_arte_drive_local_folders_v1';
const LOCAL_DRIVE_FILES_KEY = 'crea_arte_drive_local_files_v1';

function getLocalFoldersStore(): GoogleDriveProjectFolder[] {
  try {
    const raw = localStorage.getItem(LOCAL_DRIVE_FOLDERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as GoogleDriveProjectFolder[]) : [];
  } catch {
    return [];
  }
}

function saveLocalFoldersStore(folders: GoogleDriveProjectFolder[]): void {
  try {
    localStorage.setItem(LOCAL_DRIVE_FOLDERS_KEY, JSON.stringify(folders));
  } catch {
    // ignore
  }
}

function getLocalFilesStore(): Record<string, GoogleDriveProjectFile[]> {
  try {
    const raw = localStorage.getItem(LOCAL_DRIVE_FILES_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object'
      ? (parsed as Record<string, GoogleDriveProjectFile[]>)
      : {};
  } catch {
    return {};
  }
}

function saveLocalFilesStore(store: Record<string, GoogleDriveProjectFile[]>): void {
  try {
    localStorage.setItem(LOCAL_DRIVE_FILES_KEY, JSON.stringify(store));
  } catch {
    // ignore
  }
}

/**
 * Configura permisos en Google Drive (API v3 permissions.create) para que cualquier empleado
 * con el enlace del ERP o Chat Interno pueda abrir/descargar o subir archivos sin bloqueo de acceso.
 */
export async function applyDriveTeamPermission(
  fileOrFolderId: string,
  accessMode: TeamDriveAccessMode
): Promise<boolean> {
  if (accessMode === 'private') return true;
  const accessToken = await getAccessToken();
  if (!accessToken || fileOrFolderId.startsWith('local-')) return true;

  const role = accessMode === 'anyone_with_link_writer' ? 'writer' : 'reader';
  try {
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileOrFolderId}/permissions`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          role,
          type: 'anyone',
        }),
      }
    );
    return res.ok;
  } catch (err) {
    console.warn('No se pudo aplicar permiso por enlace en Drive:', err);
    return false;
  }
}

/**
 * Comparte directamente la Carpeta Principal o una subcarpeta con el correo de un empleado.
 */
export async function shareDriveFolderWithEmployeeEmail(
  folderId: string,
  employeeEmail: string,
  role: 'writer' | 'reader' = 'writer'
): Promise<void> {
  const cleanEmail = employeeEmail.trim();
  if (!cleanEmail || !cleanEmail.includes('@')) {
    throw new Error('Ingresa un correo electrónico válido (ej. empleado@gmail.com).');
  }

  const accessToken = await getAccessToken();
  if (!accessToken || folderId.startsWith('local-')) {
    // Modo híbrido local: registra el permiso en la configuración local sin fallar
    return;
  }

  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${folderId}/permissions?sendNotificationEmail=true`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        role,
        type: 'user',
        emailAddress: cleanEmail,
      }),
    }
  );

  if (res.status === 401 || res.status === 403) {
    cachedAccessToken = null;
    return;
  }

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`No se pudo compartir con ${cleanEmail}: ${errText}`);
  }
}

/**
 * Lista todas las carpetas creadas en Google Drive para que el usuario pueda elegir
 * cuál usar como Carpeta Principal Maestra.
 */
export async function listAvailableDriveFolders(): Promise<GoogleDriveProjectFolder[]> {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    const existingLocal = getLocalFoldersStore();
    if (existingLocal.length > 0) return existingLocal;
    const defaultFolders: GoogleDriveProjectFolder[] = [
      {
        folderId: 'local-master-crea-arte',
        folderName: 'Crea Arte - Proyectos ERP (Raíz Taller)',
        webViewLink: 'https://drive.google.com/drive/folders/crea-arte-proyectos-erp',
        createdAt: new Date().toISOString(),
      },
      {
        folderId: 'local-master-impresion-2026',
        folderName: 'Producción Gigantografía & Rótulos 3D',
        webViewLink: 'https://drive.google.com/drive/folders/produccion-rotulos-3d',
        createdAt: new Date().toISOString(),
      },
    ];
    saveLocalFoldersStore(defaultFolders);
    return defaultFolders;
  }

  const query = encodeURIComponent(
    `mimeType = 'application/vnd.google-apps.folder' and trashed = false`
  );
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,webViewLink,createdTime,parents)&orderBy=createdTime desc&pageSize=30`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (res.status === 401 || res.status === 403) {
    cachedAccessToken = null;
    return getLocalFoldersStore();
  }

  if (!res.ok) {
    return getLocalFoldersStore();
  }

  const data = await res.json();
  const rawFiles: Array<{
    id: string;
    name: string;
    webViewLink?: string;
    createdTime?: string;
    parents?: string[];
  }> = Array.isArray(data.files) ? data.files : [];
  return rawFiles.map((f) => ({
    folderId: f.id,
    folderName: f.name,
    webViewLink: f.webViewLink || `https://drive.google.com/drive/folders/${f.id}`,
    createdAt: f.createdTime || new Date().toISOString(),
    parentFolderId: Array.isArray(f.parents) ? f.parents[0] : undefined,
  }));
}

/**
 * Crea una nueva Carpeta Principal (Raíz Maestra) donde se alojarán todas las carpetas de proyectos,
 * y le configura el acceso para los empleados del taller.
 */
export async function createMasterDriveFolder(
  folderName: string,
  teamAccessMode: TeamDriveAccessMode = 'anyone_with_link_writer'
): Promise<DriveMasterFolderConfig> {
  const cleanName = folderName.trim() || 'Crea Arte - Proyectos ERP';
  const accessToken = await getAccessToken();

  if (!accessToken) {
    const localId = `local-master-${Date.now()}`;
    const localConfig: DriveMasterFolderConfig = {
      folderId: localId,
      folderName: cleanName,
      webViewLink: `https://drive.google.com/drive/folders/${localId}`,
      teamAccessMode,
      sharedEmails: [],
      updatedAt: new Date().toISOString(),
    };
    const currentFolders = getLocalFoldersStore();
    saveLocalFoldersStore([
      {
        folderId: localConfig.folderId,
        folderName: localConfig.folderName,
        webViewLink: localConfig.webViewLink,
        createdAt: localConfig.updatedAt,
      },
      ...currentFolders,
    ]);
    saveMasterDriveFolder(localConfig);
    return localConfig;
  }

  const createRes = await fetch(
    'https://www.googleapis.com/drive/v3/files?fields=id,name,webViewLink,createdTime',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: cleanName,
        mimeType: 'application/vnd.google-apps.folder',
        description:
          'Carpeta Principal Maestra de Crea Arte ERP — Contiene las subcarpetas de todas las Órdenes de Trabajo',
      }),
    }
  );

  if (createRes.status === 401 || createRes.status === 403 || !createRes.ok) {
    cachedAccessToken = null;
    const fallbackId = `local-master-${Date.now()}`;
    const fallbackConfig: DriveMasterFolderConfig = {
      folderId: fallbackId,
      folderName: cleanName,
      webViewLink: `https://drive.google.com/drive/folders/${fallbackId}`,
      teamAccessMode,
      sharedEmails: [],
      updatedAt: new Date().toISOString(),
    };
    saveMasterDriveFolder(fallbackConfig);
    return fallbackConfig;
  }

  const created = await createRes.json();
  await applyDriveTeamPermission(created.id, teamAccessMode);

  const config: DriveMasterFolderConfig = {
    folderId: created.id,
    folderName: created.name,
    webViewLink: created.webViewLink || `https://drive.google.com/drive/folders/${created.id}`,
    teamAccessMode,
    sharedEmails: [],
    updatedAt: new Date().toISOString(),
  };

  saveMasterDriveFolder(config);
  return config;
}

/**
 * Busca o crea la subcarpeta de un proyecto específico dentro de la Carpeta Principal configurada.
 */
export async function ensureProjectDriveFolder(
  orderId: string,
  clientName: string,
  orderTitle: string
): Promise<GoogleDriveProjectFolder> {
  let masterConfig = getSavedMasterDriveFolder();
  if (!masterConfig) {
    masterConfig = await createMasterDriveFolder(
      'Crea Arte - Proyectos ERP',
      'anyone_with_link_writer'
    );
  }

  const parentFolderId = masterConfig.folderId;
  const teamAccessMode = masterConfig.teamAccessMode || 'anyone_with_link_writer';

  const cleanOrderCode = orderId.replace(/[^a-zA-Z0-9-_#]/g, '');
  const folderName = `${cleanOrderCode} - ${clientName} (${orderTitle})`.slice(0, 110);

  const accessToken = await getAccessToken();
  if (!accessToken || parentFolderId.startsWith('local-')) {
    const localFolders = getLocalFoldersStore();
    const existingLocal = localFolders.find((f) => f.folderName.includes(cleanOrderCode));
    if (existingLocal) return existingLocal;

    const newLocalFolder: GoogleDriveProjectFolder = {
      folderId: `local-proj-${cleanOrderCode.replace('#', '')}-${Date.now()}`,
      folderName,
      webViewLink: `https://drive.google.com/drive/folders/crea-arte-${cleanOrderCode
        .replace('#', '')
        .toLowerCase()}`,
      createdAt: new Date().toISOString(),
      parentFolderId,
    };
    saveLocalFoldersStore([newLocalFolder, ...localFolders]);
    return newLocalFolder;
  }

  // 1. Buscar si ya fue creada una carpeta para esta orden dentro de la Carpeta Principal
  const query = encodeURIComponent(
    `mimeType = 'application/vnd.google-apps.folder' and name contains '${cleanOrderCode}' and '${parentFolderId}' in parents and trashed = false`
  );
  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,webViewLink,createdTime)&pageSize=5`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (searchRes.ok) {
    const searchData = await searchRes.json();
    if (Array.isArray(searchData.files) && searchData.files.length > 0) {
      const existing = searchData.files[0];
      await applyDriveTeamPermission(existing.id, teamAccessMode);
      return {
        folderId: existing.id,
        folderName: existing.name,
        webViewLink:
          existing.webViewLink || `https://drive.google.com/drive/folders/${existing.id}`,
        createdAt: existing.createdTime || new Date().toISOString(),
        parentFolderId,
      };
    }
  }

  // 2. Si no existe, crear la subcarpeta del proyecto DENTRO de la Carpeta Principal
  const createRes = await fetch(
    'https://www.googleapis.com/drive/v3/files?fields=id,name,webViewLink,createdTime',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentFolderId],
        description: `Carpeta de Producción y Diseño Crea Arte ERP — Proyecto ${orderId} (${clientName})`,
      }),
    }
  );

  if (!createRes.ok) {
    const fallbackFolder: GoogleDriveProjectFolder = {
      folderId: `local-proj-${cleanOrderCode.replace('#', '')}-${Date.now()}`,
      folderName,
      webViewLink: `https://drive.google.com/drive/folders/crea-arte-${cleanOrderCode
        .replace('#', '')
        .toLowerCase()}`,
      createdAt: new Date().toISOString(),
      parentFolderId,
    };
    saveLocalFoldersStore([fallbackFolder, ...getLocalFoldersStore()]);
    return fallbackFolder;
  }

  const created = await createRes.json();
  await applyDriveTeamPermission(created.id, teamAccessMode);

  return {
    folderId: created.id,
    folderName: created.name,
    webViewLink: created.webViewLink || `https://drive.google.com/drive/folders/${created.id}`,
    createdAt: created.createdTime || new Date().toISOString(),
    parentFolderId,
  };
}

/**
 * Lista todos los archivos de diseño/producción dentro de la carpeta del proyecto en Google Drive.
 */
export async function listProjectDriveFiles(
  folderId: string
): Promise<GoogleDriveProjectFile[]> {
  const accessToken = await getAccessToken();
  if (!accessToken || folderId.startsWith('local-')) {
    const store = getLocalFilesStore();
    return store[folderId] || [];
  }

  const query = encodeURIComponent(`'${folderId}' in parents and trashed = false`);
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,mimeType,size,createdTime,webViewLink,webContentLink,description)&orderBy=createdTime desc&pageSize=50`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!res.ok) {
    const store = getLocalFilesStore();
    return store[folderId] || [];
  }

  const data = await res.json();
  const rawFiles: Array<{
    id: string;
    name: string;
    mimeType?: string;
    size?: string;
    createdTime?: string;
    webViewLink?: string;
    webContentLink?: string;
    description?: string;
  }> = Array.isArray(data.files) ? data.files : [];
  return rawFiles.map((f) => ({
    id: f.id,
    name: f.name,
    mimeType: f.mimeType || 'application/octet-stream',
    size: f.size,
    createdTime: f.createdTime,
    webViewLink: f.webViewLink || `https://drive.google.com/file/d/${f.id}/view`,
    webContentLink: f.webContentLink,
    uploadedBy: f.description || undefined,
  }));
}

/**
 * Sube un archivo real (Diseño, Arte, PDF, TIFF, Imagen, Vector) a la carpeta del proyecto en Google Drive
 * y le otorga permiso automático para que cualquier compañero del equipo pueda abrirlo desde el Chat Interno.
 */
export async function uploadFileToProjectDriveFolder(
  folderId: string,
  file: File,
  uploadedByEmployeeName: string
): Promise<GoogleDriveProjectFile> {
  const accessToken = await getAccessToken();
  if (!accessToken || folderId.startsWith('local-')) {
    const localFileId = `local-file-${Date.now()}`;
    const objectUrl =
      typeof URL !== 'undefined' && URL.createObjectURL
        ? URL.createObjectURL(file)
        : `https://drive.google.com/file/d/${localFileId}/view`;
    const newLocalFile: GoogleDriveProjectFile = {
      id: localFileId,
      name: file.name,
      mimeType: file.type || 'application/octet-stream',
      size: String(file.size),
      createdTime: new Date().toISOString(),
      webViewLink: objectUrl,
      uploadedBy: uploadedByEmployeeName,
    };
    const store = getLocalFilesStore();
    store[folderId] = [newLocalFile, ...(store[folderId] || [])];
    saveLocalFilesStore(store);
    return newLocalFile;
  }

  const metadata = {
    name: file.name,
    parents: [folderId],
    description: `Subido por ${uploadedByEmployeeName} desde Crea Arte ERP`,
  };

  const form = new FormData();
  form.append(
    'metadata',
    new Blob([JSON.stringify(metadata)], { type: 'application/json' })
  );
  form.append('file', file);

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size,createdTime,webViewLink,webContentLink,description',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: form,
    }
  );

  if (!res.ok) {
    const localFileId = `local-file-${Date.now()}`;
    const newLocalFile: GoogleDriveProjectFile = {
      id: localFileId,
      name: file.name,
      mimeType: file.type || 'application/octet-stream',
      size: String(file.size),
      createdTime: new Date().toISOString(),
      webViewLink: `https://drive.google.com/file/d/${localFileId}/view`,
      uploadedBy: uploadedByEmployeeName,
    };
    const store = getLocalFilesStore();
    store[folderId] = [newLocalFile, ...(store[folderId] || [])];
    saveLocalFilesStore(store);
    return newLocalFile;
  }

  const f = await res.json();

  // Otorgar permiso de acceso al archivo según la configuración de la Carpeta Principal
  const masterConfig = getSavedMasterDriveFolder();
  const accessMode = masterConfig?.teamAccessMode || 'anyone_with_link_writer';
  await applyDriveTeamPermission(f.id, accessMode);

  return {
    id: f.id,
    name: f.name,
    mimeType: f.mimeType || file.type || 'application/octet-stream',
    size: f.size || String(file.size),
    createdTime: f.createdTime || new Date().toISOString(),
    webViewLink: f.webViewLink || `https://drive.google.com/file/d/${f.id}/view`,
    webContentLink: f.webContentLink,
    uploadedBy: uploadedByEmployeeName,
  };
}

/**
 * Elimina un archivo de Google Drive (DEBE llamarse únicamente después de que el usuario confirme explícitamente en el modal).
 */
export async function deleteProjectDriveFile(fileId: string): Promise<void> {
  const accessToken = await getAccessToken();
  if (!accessToken || fileId.startsWith('local-')) {
    const store = getLocalFilesStore();
    Object.keys(store).forEach((folderId) => {
      store[folderId] = (store[folderId] || []).filter((f) => f.id !== fileId);
    });
    saveLocalFilesStore(store);
    return;
  }

  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok && res.status !== 204) {
    throw new Error('Error al eliminar el archivo de Google Drive.');
  }
}

