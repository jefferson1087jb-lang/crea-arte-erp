import React, { useState, useEffect, useRef } from 'react';
import {
  FolderPlus,
  Upload,
  Trash2,
  Share2,
  RefreshCw,
  ExternalLink,
  X,
  FileText,
  MessageSquare,
  CheckCircle2,
  Users,
  ShieldCheck,
  FolderOpen,
  UserPlus,
} from 'lucide-react';
import {
  WorkOrder,
  UserProfile,
  ProjectDriveFileRecord,
} from '../data/initialData';
import {
  initAuth,
  googleSignIn,
  ensureProjectDriveFolder,
  listProjectDriveFiles,
  uploadFileToProjectDriveFolder,
  deleteProjectDriveFile,
  getSavedMasterDriveFolder,
  saveMasterDriveFolder,
  createMasterDriveFolder,
  listAvailableDriveFolders,
  applyDriveTeamPermission,
  shareDriveFolderWithEmployeeEmail,
  DriveMasterFolderConfig,
  TeamDriveAccessMode,
  GoogleDriveProjectFolder,
} from '../utils/googleDriveService';

interface ProjectDriveModalProps {
  isOpen: boolean;
  onClose: () => void;
  orders: WorkOrder[];
  initialOrderId?: string;
  users: UserProfile[];
  currentUser: UserProfile;
  onUpdateOrder: (updated: WorkOrder) => void;
  onSendInternalNote: (
    orderId: string,
    text: string,
    mentionedUserId?: string,
    driveFileAttachment?: ProjectDriveFileRecord
  ) => void;
  onOpenInternalChat?: (orderId: string) => void;
  onNotify: (msg: string) => void;
}

export const ProjectDriveModal: React.FC<ProjectDriveModalProps> = ({
  isOpen,
  onClose,
  orders,
  initialOrderId,
  users,
  currentUser,
  onUpdateOrder,
  onSendInternalNote,
  onOpenInternalChat,
  onNotify,
}) => {
  const [selectedOrderId, setSelectedOrderId] = useState<string>(
    initialOrderId || orders[0]?.id || ''
  );
  const [needsDriveAuth, setNeedsDriveAuth] = useState<boolean>(true);
  const [driveUserEmail, setDriveUserEmail] = useState<string | null>(null);
  const [isLoggingInDrive, setIsLoggingInDrive] = useState(false);
  const [isWorkingDrive, setIsWorkingDrive] = useState(false);
  const [driveError, setDriveError] = useState<string | null>(null);
  const [autoShareOnUpload, setAutoShareOnUpload] = useState<boolean>(true);
  const [driveShareTargetUserId, setDriveShareTargetUserId] = useState<string>(
    users[2]?.id || users[0]?.id || 'usr-designer'
  );
  const [driveFileToDelete, setDriveFileToDelete] =
    useState<ProjectDriveFileRecord | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Estado de la Carpeta Principal Maestra y Permisos de Empleados
  const [masterFolder, setMasterFolder] = useState<DriveMasterFolderConfig | null>(
    () => getSavedMasterDriveFolder()
  );
  const [showMasterFolderSetup, setShowMasterFolderSetup] = useState<boolean>(false);
  const [newMasterFolderName, setNewMasterFolderName] = useState<string>(
    'Crea Arte - Proyectos ERP'
  );
  const [availableDriveFolders, setAvailableDriveFolders] = useState<
    GoogleDriveProjectFolder[]
  >([]);
  const [selectedExistingFolderId, setSelectedExistingFolderId] =
    useState<string>('');
  const [teamAccessMode, setTeamAccessMode] = useState<TeamDriveAccessMode>(
    () => getSavedMasterDriveFolder()?.teamAccessMode || 'anyone_with_link_writer'
  );
  const [employeeEmailToShare, setEmployeeEmailToShare] = useState<string>('');

  useEffect(() => {
    if (initialOrderId) {
      setSelectedOrderId(initialOrderId);
    }
  }, [initialOrderId]);

  useEffect(() => {
    const unsubscribe = initAuth(
      (user) => {
        setNeedsDriveAuth(false);
        setDriveUserEmail(user.email || user.displayName || 'Cuenta Conectada');
      },
      () => {
        setNeedsDriveAuth(true);
        setDriveUserEmail(null);
      }
    );
    return () => unsubscribe();
  }, []);

  if (!isOpen) return null;

  const activeOrder =
    orders.find((o) => o.id === selectedOrderId) || orders[0] || null;

  if (!activeOrder) return null;

  const getUserName = (userId: string) =>
    users.find((u) => u.id === userId)?.name || 'Colaborador';

  const handleLogin = async () => {
    setIsLoggingInDrive(true);
    setDriveError(null);
    try {
      const res = await googleSignIn();
      if (res?.user) {
        setNeedsDriveAuth(false);
        setDriveUserEmail(res.user.email || 'Cuenta autorizada');
        onNotify(
          `Conectado a Google Drive (${res.user.email || 'Cuenta autorizada'})`
        );
      }
    } catch (err: any) {
      setDriveError(err?.message || 'Error al iniciar sesión con Google Drive');
    } finally {
      setIsLoggingInDrive(false);
    }
  };

  // Cargar lista de carpetas de Drive para que el usuario pueda elegir una existente
  const handleLoadAvailableFolders = async () => {
    setIsWorkingDrive(true);
    setDriveError(null);
    try {
      const folders = await listAvailableDriveFolders();
      setAvailableDriveFolders(folders);
      if (folders.length > 0 && !selectedExistingFolderId) {
        setSelectedExistingFolderId(folders[0].folderId);
      }
    } catch (err: any) {
      if (err?.message === 'NEEDS_AUTH' || err?.message === 'TOKEN_EXPIRED') {
        setNeedsDriveAuth(true);
      }
      setDriveError(
        err?.message || 'No se pudieron cargar las carpetas de Google Drive.'
      );
    } finally {
      setIsWorkingDrive(false);
    }
  };

  // Crear una nueva Carpeta Principal Maestra en Google Drive
  const handleCreateNewMasterFolder = async () => {
    if (!newMasterFolderName.trim()) return;
    setIsWorkingDrive(true);
    setDriveError(null);
    try {
      const created = await createMasterDriveFolder(
        newMasterFolderName.trim(),
        teamAccessMode
      );
      setMasterFolder(created);
      setShowMasterFolderSetup(false);
      onNotify(
        `Carpeta Principal "${created.folderName}" creada y configurada para todo el equipo`
      );
    } catch (err: any) {
      if (err?.message === 'NEEDS_AUTH' || err?.message === 'TOKEN_EXPIRED') {
        setNeedsDriveAuth(true);
      }
      setDriveError(
        err?.message || 'No se pudo crear la Carpeta Principal en Google Drive'
      );
    } finally {
      setIsWorkingDrive(false);
    }
  };

  // Seleccionar una carpeta existente de la lista como Carpeta Principal Maestra
  const handleSelectExistingMasterFolder = async () => {
    const chosen = availableDriveFolders.find(
      (f) => f.folderId === selectedExistingFolderId
    );
    if (!chosen) return;
    setIsWorkingDrive(true);
    setDriveError(null);
    try {
      await applyDriveTeamPermission(chosen.folderId, teamAccessMode);
      const updatedConfig: DriveMasterFolderConfig = {
        folderId: chosen.folderId,
        folderName: chosen.folderName,
        webViewLink: chosen.webViewLink,
        teamAccessMode,
        sharedEmails: masterFolder?.sharedEmails || [],
        updatedAt: new Date().toISOString(),
      };
      saveMasterDriveFolder(updatedConfig);
      setMasterFolder(updatedConfig);
      setShowMasterFolderSetup(false);
      onNotify(
        `Carpeta Principal cambiada a "${chosen.folderName}" con permisos actualizados`
      );
    } catch (err: any) {
      setDriveError(
        err?.message || 'Error al configurar la carpeta seleccionada'
      );
    } finally {
      setIsWorkingDrive(false);
    }
  };

  // Cambiar el modo de acceso para todos los empleados en vivo
  const handleChangeTeamAccessMode = async (newMode: TeamDriveAccessMode) => {
    setTeamAccessMode(newMode);
    if (!masterFolder) return;
    setIsWorkingDrive(true);
    setDriveError(null);
    try {
      await applyDriveTeamPermission(masterFolder.folderId, newMode);
      if (activeOrder.driveFolderId) {
        await applyDriveTeamPermission(activeOrder.driveFolderId, newMode);
      }
      const updated: DriveMasterFolderConfig = {
        ...masterFolder,
        teamAccessMode: newMode,
        updatedAt: new Date().toISOString(),
      };
      saveMasterDriveFolder(updated);
      setMasterFolder(updated);
      onNotify('Permisos de acceso del equipo actualizados en Google Drive');
    } catch (err: any) {
      setDriveError(err?.message || 'No se pudo actualizar el permiso en Drive');
    } finally {
      setIsWorkingDrive(false);
    }
  };

  // Compartir la Carpeta Principal directamente con el correo Google de un empleado
  const handleShareMasterFolderWithEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeEmailToShare.trim()) return;
    setIsWorkingDrive(true);
    setDriveError(null);
    try {
      let currentMaster = masterFolder;
      if (!currentMaster) {
        currentMaster = await createMasterDriveFolder(
          newMasterFolderName.trim() || 'Crea Arte - Proyectos ERP',
          teamAccessMode
        );
        setMasterFolder(currentMaster);
      }

      await shareDriveFolderWithEmployeeEmail(
        currentMaster.folderId,
        employeeEmailToShare.trim(),
        'writer'
      );

      const updatedEmails = Array.from(
        new Set([...(currentMaster.sharedEmails || []), employeeEmailToShare.trim()])
      );
      const updatedConfig: DriveMasterFolderConfig = {
        ...currentMaster,
        sharedEmails: updatedEmails,
        updatedAt: new Date().toISOString(),
      };
      saveMasterDriveFolder(updatedConfig);
      setMasterFolder(updatedConfig);
      setEmployeeEmailToShare('');
      onNotify(
        `Invitación de Google Drive enviada a ${employeeEmailToShare.trim()}`
      );
    } catch (err: any) {
      if (err?.message === 'NEEDS_AUTH' || err?.message === 'TOKEN_EXPIRED') {
        setNeedsDriveAuth(true);
      }
      setDriveError(
        err?.message || 'No se pudo compartir la carpeta con ese correo'
      );
    } finally {
      setIsWorkingDrive(false);
    }
  };

  const handleCreateOrSyncFolder = async () => {
    setIsWorkingDrive(true);
    setDriveError(null);
    try {
      const folder = await ensureProjectDriveFolder(
        activeOrder.id,
        activeOrder.clientName,
        activeOrder.title
      );
      // Refrescar el estado de la carpeta maestra si se creó automáticamente
      setMasterFolder(getSavedMasterDriveFolder());

      const remoteFiles = await listProjectDriveFiles(folder.folderId);
      const mappedFiles: ProjectDriveFileRecord[] = remoteFiles.map((f) => {
        const isoTime = f.createdTime || new Date().toISOString();
        return {
          id: f.id,
          name: f.name,
          mimeType: f.mimeType,
          webViewLink:
            f.webViewLink || `https://drive.google.com/file/d/${f.id}/view`,
          createdTime: isoTime,
          uploadedAt: isoTime.slice(0, 16).replace('T', ' '),
          sizeBytes: f.size ? Number(f.size) : undefined,
          uploadedBy: f.uploadedBy || currentUser.name,
        };
      });

      onUpdateOrder({
        ...activeOrder,
        driveFolderId: folder.folderId,
        driveFolderName: folder.folderName,
        driveFolderUrl: folder.webViewLink,
        driveFiles: mappedFiles,
      });
      onNotify(
        `Subcarpeta "${folder.folderName}" creada dentro de "${
          getSavedMasterDriveFolder()?.folderName || 'Crea Arte - Proyectos ERP'
        }"`
      );
    } catch (err: any) {
      if (err?.message === 'NEEDS_AUTH' || err?.message === 'TOKEN_EXPIRED') {
        setNeedsDriveAuth(true);
        setDriveError(
          'Tu sesión de Google Drive expiró. Haz clic en "Sign in with Google" para continuar.'
        );
      } else {
        setDriveError(
          err?.message || 'No se pudo crear o sincronizar la carpeta en Drive'
        );
      }
    } finally {
      setIsWorkingDrive(false);
    }
  };

  const handleShareFileInInternalChat = (file: ProjectDriveFileRecord) => {
    const shareText = `📁 Archivo de diseño compartido desde la carpeta Google Drive del proyecto ${activeOrder.id}: "${file.name}"\n🔓 Acceso habilitado para todo el equipo — Clic en "Abrir en Drive" para ver o descargar: ${file.webViewLink}`;
    onSendInternalNote(
      activeOrder.id,
      shareText,
      driveShareTargetUserId,
      file
    );
    onNotify(
      `Diseño "${file.name}" compartido en el Chat Interno con @${getUserName(
        driveShareTargetUserId
      )}`
    );
  };

  const handleUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    setIsWorkingDrive(true);
    setDriveError(null);
    try {
      let folderId = activeOrder.driveFolderId;
      let folderName = activeOrder.driveFolderName;
      let folderUrl = activeOrder.driveFolderUrl;

      if (!folderId) {
        const createdFolder = await ensureProjectDriveFolder(
          activeOrder.id,
          activeOrder.clientName,
          activeOrder.title
        );
        setMasterFolder(getSavedMasterDriveFolder());
        folderId = createdFolder.folderId;
        folderName = createdFolder.folderName;
        folderUrl = createdFolder.webViewLink;
      }

      const uploaded = await uploadFileToProjectDriveFolder(
        folderId,
        file,
        currentUser.name
      );
      const isoTime = uploaded.createdTime || new Date().toISOString();
      const newRecord: ProjectDriveFileRecord = {
        id: uploaded.id,
        name: uploaded.name,
        mimeType: uploaded.mimeType,
        webViewLink:
          uploaded.webViewLink ||
          `https://drive.google.com/file/d/${uploaded.id}/view`,
        createdTime: isoTime,
        uploadedAt: isoTime.slice(0, 16).replace('T', ' '),
        sizeBytes: uploaded.size ? Number(uploaded.size) : file.size,
        uploadedBy: currentUser.name,
      };

      const updatedFiles = [
        newRecord,
        ...(activeOrder.driveFiles || []).filter((f) => f.id !== newRecord.id),
      ];
      onUpdateOrder({
        ...activeOrder,
        driveFolderId: folderId,
        driveFolderName: folderName,
        driveFolderUrl: folderUrl,
        driveFiles: updatedFiles,
        artworkUrl: newRecord.webViewLink,
      });

      if (autoShareOnUpload) {
        handleShareFileInInternalChat(newRecord);
      } else {
        onNotify(
          `Archivo "${newRecord.name}" subido y habilitado para el equipo en Drive (${activeOrder.id})`
        );
      }
    } catch (err: any) {
      if (err?.message === 'NEEDS_AUTH' || err?.message === 'TOKEN_EXPIRED') {
        setNeedsDriveAuth(true);
        setDriveError(
          'Necesitas autorizar Google Drive con el botón "Sign in with Google".'
        );
      } else {
        setDriveError(err?.message || 'Error al subir el archivo a Google Drive');
      }
    } finally {
      setIsWorkingDrive(false);
    }
  };

  const handleConfirmDeleteFile = async () => {
    if (!driveFileToDelete) return;
    setIsWorkingDrive(true);
    setDriveError(null);
    try {
      await deleteProjectDriveFile(driveFileToDelete.id);
      const remaining = (activeOrder.driveFiles || []).filter(
        (f) => f.id !== driveFileToDelete.id
      );
      onUpdateOrder({
        ...activeOrder,
        driveFiles: remaining,
      });
      onNotify(
        `Archivo "${driveFileToDelete.name}" eliminado de Google Drive`
      );
      setDriveFileToDelete(null);
    } catch (err: any) {
      if (err?.message === 'NEEDS_AUTH' || err?.message === 'TOKEN_EXPIRED') {
        setNeedsDriveAuth(true);
      }
      setDriveError(
        err?.message || 'No se pudo eliminar el archivo de Google Drive'
      );
    } finally {
      setIsWorkingDrive(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-xs p-2 sm:p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-3xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto">
        {/* Cabecera del Modal */}
        <div className="px-4 sm:px-5 py-3.5 sm:py-4 bg-blue-600 text-white flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-lg bg-white/15 shrink-0">
              <FolderPlus className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-bold truncate">
                📁 Centro de Carpetas Google Drive y Acceso del Equipo
              </h2>
              <p className="text-xs text-blue-100 line-clamp-1">
                Elige o crea la Carpeta Principal en Drive, gestiona el acceso de empleados y sube diseños por proyecto
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Cuerpo del Modal */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-5 flex-1 min-h-0">
          {/* SECCIÓN A: CARPETA PRINCIPAL (RAÍZ MAESTRA) Y CÓMO ACCEDEN TODOS LOS EMPLEADOS */}
          <div className="p-4 bg-indigo-50/60 dark:bg-indigo-950/25 border border-indigo-200 dark:border-indigo-800/80 rounded-xl space-y-3.5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <FolderOpen className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Carpeta Principal en Drive (Donde se guardan todos los Proyectos)
                  </h3>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  {masterFolder ? (
                    <>
                      Carpeta Raíz activa:{' '}
                      <strong className="font-mono text-indigo-700 dark:text-indigo-300">
                        📁 {masterFolder.folderName}
                      </strong>{' '}
                      (Cada orden #CA-XXX crea su subcarpeta aquí adentro)
                    </>
                  ) : (
                    'Por defecto se creará la carpeta principal "Crea Arte - Proyectos ERP" en tu Google Drive.'
                  )}
                </p>
              </div>

              {!needsDriveAuth && (
                <div className="flex items-center gap-2">
                  {masterFolder && (
                    <a
                      href={masterFolder.webViewLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg inline-flex items-center gap-1"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Abrir Carpeta Principal</span>
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      const next = !showMasterFolderSetup;
                      setShowMasterFolderSetup(next);
                      if (next) handleLoadAvailableFolders();
                    }}
                    className="px-2.5 py-1.5 text-xs font-bold bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-700 rounded-lg hover:bg-indigo-50"
                  >
                    {showMasterFolderSetup
                      ? 'Cerrar Configuración'
                      : '⚙️ Elegir o Crear Carpeta Principal / Permisos'}
                  </button>
                </div>
              )}
            </div>

            {/* Explicación clara de cómo acceden todos los empleados + Selector de Permisos */}
            <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-indigo-100 dark:border-indigo-900/60 space-y-2 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>¿Cómo acceden los demás empleados a la carpeta y a los diseños?</span>
                </span>
                <select
                  value={teamAccessMode}
                  onChange={(e) =>
                    handleChangeTeamAccessMode(e.target.value as TeamDriveAccessMode)
                  }
                  disabled={needsDriveAuth || isWorkingDrive}
                  className="px-2.5 py-1 text-xs font-bold bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 rounded-md text-emerald-900 dark:text-emerald-200"
                >
                  <option value="anyone_with_link_writer">
                    🔓 Equipo con el link puede Ver, Descargar y Subir (Recomendado)
                  </option>
                  <option value="anyone_with_link_reader">
                    👁️ Equipo con el link puede Ver y Descargar
                  </option>
                  <option value="private">
                    🔒 Privado (Solo correos invitados manualmente)
                  </option>
                </select>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                • <strong>Acceso instantáneo desde el ERP y Chat Interno:</strong> Al estar en modo{' '}
                <em>"Equipo con el link"</em>, Google Drive habilita automáticamente el permiso en la
                nube para que cuando compartas un diseño en <strong>🔒 Nota Interna</strong> o en el{' '}
                <strong>Tablero Kanban</strong>, cualquier empleado (Diseñador, Impresor, Instalador o
                Ventas) pueda abrir y descargar el archivo con 1 clic sin que Google le pida solicitar
                acceso.
              </p>
            </div>

            {/* Panel Desplegable para Crear o Elegir otra Carpeta Principal e Invitar Correos de Empleados */}
            {showMasterFolderSetup && !needsDriveAuth && (
              <div className="p-3.5 bg-white dark:bg-slate-900 rounded-xl border border-indigo-200 dark:border-indigo-800 space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Opción 1: Crear Nueva Carpeta Principal */}
                  <div className="space-y-2 p-3 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800">
                    <label className="block font-bold text-slate-800 dark:text-slate-200">
                      Opción A: Crear nueva Carpeta Principal en Drive
                    </label>
                    <input
                      type="text"
                      value={newMasterFolderName}
                      onChange={(e) => setNewMasterFolderName(e.target.value)}
                      placeholder="Ej. Crea Arte - Producción 2026"
                      className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md text-slate-900 dark:text-white"
                    />
                    <button
                      type="button"
                      onClick={handleCreateNewMasterFolder}
                      disabled={isWorkingDrive || !newMasterFolderName.trim()}
                      className="w-full py-1.5 px-3 font-bold bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-md inline-flex items-center justify-center gap-1.5"
                    >
                      <FolderPlus className="w-3.5 h-3.5" />
                      <span>Crear y Usar como Carpeta Principal</span>
                    </button>
                  </div>

                  {/* Opción 2: Elegir una Carpeta Existente */}
                  <div className="space-y-2 p-3 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800">
                    <div className="flex items-center justify-between">
                      <label className="font-bold text-slate-800 dark:text-slate-200">
                        Opción B: Elegir carpeta existente en Drive
                      </label>
                      <button
                        type="button"
                        onClick={handleLoadAvailableFolders}
                        className="text-[11px] text-indigo-600 hover:underline inline-flex items-center gap-1"
                      >
                        <RefreshCw className="w-3 h-3" /> Recargar
                      </button>
                    </div>
                    {availableDriveFolders.length === 0 ? (
                      <p className="text-[11px] text-slate-500 py-1">
                        No hay carpetas previas registradas por la app. Crea una en la Opción A.
                      </p>
                    ) : (
                      <>
                        <select
                          value={selectedExistingFolderId}
                          onChange={(e) => setSelectedExistingFolderId(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md text-slate-900 dark:text-white"
                        >
                          {availableDriveFolders.map((f) => (
                            <option key={f.folderId} value={f.folderId}>
                              📁 {f.folderName}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={handleSelectExistingMasterFolder}
                          disabled={isWorkingDrive || !selectedExistingFolderId}
                          className="w-full py-1.5 px-3 font-bold bg-slate-800 hover:bg-slate-900 dark:bg-blue-600 text-white rounded-md"
                        >
                          Usar esta Carpeta como Principal
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Compartir la Carpeta Principal directamente con correos Gmail de Empleados */}
                <form
                  onSubmit={handleShareMasterFolderWithEmail}
                  className="p-3 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 space-y-2"
                >
                  <label className="block font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <UserPlus className="w-3.5 h-3.5 text-blue-600" />
                    <span>
                      Agregar correo Google de un empleado a la Carpeta Principal (Aparecerá en su "Compartido conmigo" de Drive):
                    </span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="email"
                      value={employeeEmailToShare}
                      onChange={(e) => setEmployeeEmailToShare(e.target.value)}
                      placeholder="Ej. disenador.creaarte@gmail.com"
                      className="flex-1 px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md text-slate-900 dark:text-white"
                    />
                    <button
                      type="submit"
                      disabled={isWorkingDrive || !employeeEmailToShare.trim()}
                      className="px-3.5 py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-md shrink-0"
                    >
                      + Dar Acceso en Drive
                    </button>
                  </div>
                  {masterFolder?.sharedEmails && masterFolder.sharedEmails.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="text-[11px] text-slate-500">Correos con acceso:</span>
                      {masterFolder.sharedEmails.map((em) => (
                        <span
                          key={em}
                          className="px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-200 font-mono text-[11px]"
                        >
                          {em}
                        </span>
                      ))}
                    </div>
                  )}
                </form>
              </div>
            )}
          </div>

          {/* Selector de Proyecto Activo */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl">
            <div className="flex-1">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Proyecto / Orden de Trabajo seleccionada:
              </label>
              <select
                value={activeOrder.id}
                onChange={(e) => setSelectedOrderId(e.target.value)}
                className="w-full px-3 py-2 text-xs font-bold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
              >
                {orders.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.id} — {o.clientName} ({o.title})
                  </option>
                ))}
              </select>
            </div>

            {onOpenInternalChat && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenInternalChat(activeOrder.id);
                }}
                className="px-3.5 py-2 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white rounded-lg inline-flex items-center gap-1.5 shrink-0 self-end"
              >
                <MessageSquare className="w-4 h-4" />
                <span>Ir al Chat Interno de {activeOrder.id}</span>
              </button>
            )}
          </div>

          {/* Paso 1: Conexión con Google Drive y Subcarpeta del Proyecto */}
          <div className="p-4 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/80 rounded-xl space-y-3.5">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Subcarpeta del Proyecto {activeOrder.id} ({activeOrder.clientName})
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  {driveUserEmail
                    ? `Cuenta Google conectada: ${driveUserEmail}`
                    : 'Conecta tu cuenta de Google para crear la subcarpeta y subir diseños'}
                </p>
              </div>
              {!needsDriveAuth && (
                <span className="px-2.5 py-1 text-xs font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 rounded-md inline-flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Conectado
                </span>
              )}
            </div>

            {needsDriveAuth ? (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={handleLogin}
                  disabled={isLoggingInDrive}
                  className="w-full flex items-center justify-center gap-3 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-bold py-3 px-4 rounded-xl border-2 border-blue-400 dark:border-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800 transition-all shadow-sm text-sm disabled:opacity-50"
                >
                  <img
                    src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
                    alt="Google logo"
                    className="w-5 h-5"
                  />
                  <span>
                    {isLoggingInDrive
                      ? 'Conectando con Google Drive...'
                      : 'Sign in with Google (Conectar mi Google Drive)'}
                  </span>
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {activeOrder.driveFolderId ? (
                  <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-blue-200 dark:border-blue-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-xs font-mono font-bold text-blue-700 dark:text-blue-300 truncate">
                        📁 {masterFolder?.folderName || 'Crea Arte - Proyectos ERP'} /{' '}
                        {activeOrder.driveFolderName ||
                          `${activeOrder.id} - ${activeOrder.clientName}`}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Subcarpeta activa y compartida con el equipo para la orden {activeOrder.id}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={handleCreateOrSyncFolder}
                        disabled={isWorkingDrive}
                        className="px-2.5 py-1.5 text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 rounded-lg inline-flex items-center gap-1"
                      >
                        <RefreshCw
                          className={`w-3.5 h-3.5 ${isWorkingDrive ? 'animate-spin' : ''}`}
                        />
                        <span>Sincronizar</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const url =
                            activeOrder.driveFolderUrl ||
                            `https://drive.google.com/drive/folders/${activeOrder.driveFolderId}`;
                          onSendInternalNote(
                            activeOrder.id,
                            `📁 Carpeta de Google Drive del proyecto ${activeOrder.id} habilitada para todo el equipo: ${url}`,
                            driveShareTargetUserId
                          );
                          onNotify('Enlace de carpeta enviado al Chat Interno');
                        }}
                        className="px-2.5 py-1.5 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white rounded-lg inline-flex items-center gap-1"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                        <span>Enviar Carpeta al Chat</span>
                      </button>
                      <a
                        href={
                          activeOrder.driveFolderUrl ||
                          `https://drive.google.com/drive/folders/${activeOrder.driveFolderId}`
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg inline-flex items-center gap-1.5"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Abrir en Drive</span>
                      </a>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleCreateOrSyncFolder}
                    disabled={isWorkingDrive}
                    className="w-full py-3 px-4 text-sm font-bold bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl inline-flex items-center justify-center gap-2 shadow-sm transition-colors"
                  >
                    <FolderPlus className="w-4 h-4" />
                    <span>
                      {isWorkingDrive
                        ? 'Creando subcarpeta en Google Drive...'
                        : `➕ Crear Subcarpeta para ${activeOrder.id} dentro de "${
                            masterFolder?.folderName || 'Crea Arte - Proyectos ERP'
                          }"`}
                    </span>
                  </button>
                )}

                {/* Paso 2: Subir Archivos de Diseño y Compartir en el Chat Interno */}
                <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
                  <div className="text-xs font-bold text-slate-900 dark:text-white">
                    Subir Diseño / Boceto a la Carpeta y Compartir con Empleados
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        Notificar y etiquetar en Chat Interno a:
                      </label>
                      <select
                        value={driveShareTargetUserId}
                        onChange={(e) => setDriveShareTargetUserId(e.target.value)}
                        className="w-full px-3 py-2 text-xs font-semibold bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                      >
                        {users.map((u) => (
                          <option key={u.id} value={u.id}>
                            @{u.name} ({u.department})
                          </option>
                        ))}
                      </select>
                    </div>

                    <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer pt-4">
                      <input
                        type="checkbox"
                        checked={autoShareOnUpload}
                        onChange={(e) => setAutoShareOnUpload(e.target.checked)}
                        className="rounded border-slate-300 text-blue-600"
                      />
                      <span>
                        Compartir automáticamente en <strong>🔒 Nota Interna</strong> al subir
                      </span>
                    </label>
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    onChange={handleUploadFile}
                    className="hidden"
                  />

                  <button
                    type="button"
                    disabled={isWorkingDrive}
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-2.5 px-4 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl inline-flex items-center justify-center gap-2 shadow-sm transition-colors"
                  >
                    <Upload className="w-4 h-4" />
                    <span>
                      {isWorkingDrive
                        ? 'Subiendo archivo y habilitando acceso para empleados...'
                        : '⬆️ Seleccionar Archivo de Diseño (PDF, AI, CDR, PNG, JPG) y Subir a Drive'}
                    </span>
                  </button>
                </div>
              </div>
            )}

            {driveError && (
              <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 font-medium">
                {driveError}
              </div>
            )}
          </div>

          {/* Paso 3: Archivos en la Carpeta del Proyecto */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Archivos guardados en la Carpeta Drive de {activeOrder.id} (
                {(activeOrder.driveFiles || []).length}):
              </h4>
            </div>

            {(activeOrder.driveFiles || []).length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl">
                Aún no hay archivos en la carpeta Drive de {activeOrder.id}. Sube el primer diseño arriba.
              </div>
            ) : (
              <div className="space-y-2">
                {(activeOrder.driveFiles || []).map((file) => (
                  <div
                    key={file.id}
                    className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                      <div className="min-w-0">
                        <a
                          href={file.webViewLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-bold text-blue-600 dark:text-blue-400 hover:underline truncate block"
                        >
                          {file.name}
                        </a>
                        <span className="text-[11px] font-mono text-slate-500">
                          Subido por {file.uploadedBy} · 🔓 Acceso habilitado para el equipo
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleShareFileInInternalChat(file)}
                        className="px-3 py-1.5 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white rounded-lg inline-flex items-center gap-1.5"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                        <span>
                          Compartir con @{getUserName(driveShareTargetUserId).split(' ')[0]}
                        </span>
                      </button>
                      <a
                        href={file.webViewLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1.5 text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-lg inline-flex items-center gap-1"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Abrir</span>
                      </a>
                      <button
                        type="button"
                        onClick={() => setDriveFileToDelete(file)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg"
                        title="Eliminar archivo de Google Drive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Confirmación antes de eliminar un archivo de Drive */}
        {driveFileToDelete && (
          <div className="p-4 bg-rose-50 dark:bg-rose-950 border-t border-rose-200 dark:border-rose-800 flex items-center justify-between gap-3">
            <div className="text-xs text-rose-900 dark:text-rose-200">
              ¿Seguro que deseas eliminar permanentemente{' '}
              <strong>{driveFileToDelete.name}</strong> de Google Drive?
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setDriveFileToDelete(null)}
                className="px-3 py-1.5 text-xs font-semibold bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 rounded-lg border border-slate-300"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteFile}
                disabled={isWorkingDrive}
                className="px-3 py-1.5 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-lg"
              >
                {isWorkingDrive ? 'Eliminando...' : 'Sí, Eliminar'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
