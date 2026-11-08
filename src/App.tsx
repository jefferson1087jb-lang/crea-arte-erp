import React, { useState, useEffect, useMemo } from 'react';
import {
  Calculator,
  Kanban,
  Clock,
  Package,
  Scissors,
  Wallet,
  Wrench,
  MessageSquare,
  ShieldCheck,
  Sun,
  Moon,
  RotateCcw,
  Download,
  UserCheck,
  Menu,
  X,
  Plus,
  PanelLeftClose,
  PanelLeftOpen,
  LayoutDashboard,
  Users,
  BookOpen,
  Rocket,
  ChevronDown,
  ChevronUp,
  Bell,
  ClipboardCheck,
  FolderPlus,
  Upload,
  Cloud,
  LogIn,
  LogOut,
  QrCode,
  Bot,
} from 'lucide-react';
import {
  INITIAL_USERS,
  INITIAL_INVENTORY,
  INITIAL_ORDERS,
  INITIAL_TIME_LOGS,
  INITIAL_INVENTORY_MOVEMENTS,
  INITIAL_RESTOCK_REQUESTS,
  INITIAL_CASH_TRANSACTIONS,
  INITIAL_MACHINES,
  INITIAL_MAINTENANCE_LOGS,
  INITIAL_CHAT_MESSAGES,
  INITIAL_WA_CONFIG,
  INITIAL_CLIENTS,
  INITIAL_PROCESSED_INVOICES,
  INITIAL_AUDIT_LOGS,
  INITIAL_CRM_TASKS,
  INITIAL_CRM_NOTIFICATIONS,
  INITIAL_REUSABLE_OFFCUTS,
  CATALOG_MATERIALS,
  UserProfile,
  WorkOrder,
  InventoryItem,
  InventoryMovement,
  RestockRequest,
  TimeLogEntry,
  CashTransaction,
  WorkshopMachine,
  MachineMaintenanceLog,
  ChatMessage,
  ChatMediaAttachment,
  WhatsAppApiConfig,
  ClientContact,
  ProjectDriveFileRecord,
  ParsedSupplierInvoice,
  PaymentAuditDetails,
  OrderStage,
  RoleId,
  SystemAuditLogEntry,
  AuditActionCategory,
  CrmTask,
  CrmNotification,
  ReusableOffcut,
  QuoterTransferPayload,
  MetaAdReferralInfo,
  CrmLeadStage,
  isDesignOnlyOrder,
  getOrderTeamAssignments,
  getLiveSimulationDateTimeStr,
  getNowTimestamp,
  getTodayDateStr,
} from './data/initialData';
import { AdminDashboardModule } from './components/AdminDashboardModule';
import { ClientsModule } from './components/ClientsModule';
import { QuoterModule } from './components/QuoterModule';
import { KanbanModule } from './components/KanbanModule';
import { TimeTrackingModule, formatSecondsToHMS } from './components/TimeTrackingModule';
import { InventoryModule } from './components/InventoryModule';
import { CutOptimizerModule } from './components/CutOptimizerModule';
import { FinanceModule } from './components/FinanceModule';
import { MaintenanceModule } from './components/MaintenanceModule';
import { WhatsAppCenterModule } from './components/WhatsAppCenterModule';
import { QuickRoleWorkflowBanner, RoleGuideModal } from './components/RoleGuideModal';
import { GoLiveAssistantModal } from './components/GoLiveAssistantModal';
import { ProjectDriveModal } from './components/ProjectDriveModal';
import { QrOrderTrackerModal } from './components/QrOrderTrackerModal';
import { AiAgentsCenterModule } from './components/AiAgentsCenterModule';
import { ModuleErrorBoundary } from './components/ModuleErrorBoundary';
import { downloadStandaloneHtmlBundle } from './utils/standaloneHtmlGenerator';
import {
  subscribeToFirebaseAuth,
  signInWithFirebaseGoogle,
  signOutFromFirebase,
  subscribeToErpCloudWorkspace,
  pushErpSnapshotToCloud,
  downloadFullDatabaseBackupJson,
  ErpFullDatabaseBackup,
} from './utils/firebaseSyncService';

type ModuleId =
  | 'dashboard'
  | 'ai_agents'
  | 'clients'
  | 'quoter'
  | 'kanban'
  | 'timetracking'
  | 'inventory'
  | 'optimizer'
  | 'finance'
  | 'maintenance'
  | 'whatsapp'
  | 'users';

type ModuleGroup =
  | 'Gerencia y Finanzas'
  | 'Comercial y CRM'
  | 'Taller y Producción'
  | 'Bodega y Equipos';

interface ModuleDef {
  id: ModuleId;
  label: string;
  shortLabel: string;
  group: ModuleGroup;
  icon: React.ComponentType<{ className?: string }>;
  allowedRoles: RoleId[];
}

const MODULES: ModuleDef[] = [
  {
    id: 'dashboard',
    label: 'Resumen Gerencial',
    shortLabel: 'Resumen Admin',
    group: 'Gerencia y Finanzas',
    icon: LayoutDashboard,
    allowedRoles: ['admin'],
  },
  {
    id: 'ai_agents',
    label: 'Centro de Agentes Operativos IA',
    shortLabel: 'Agentes IA (Copiloto)',
    group: 'Gerencia y Finanzas',
    icon: Bot,
    allowedRoles: ['admin', 'sales', 'designer', 'operator'],
  },
  {
    id: 'quoter',
    label: '1. Panel de Ventas y Cotizador',
    shortLabel: 'Panel de Ventas',
    group: 'Comercial y CRM',
    icon: Calculator,
    allowedRoles: ['admin', 'sales', 'designer', 'operator'],
  },
  {
    id: 'clients',
    label: '2. Directorio de Clientes',
    shortLabel: 'Clientes CRM',
    group: 'Comercial y CRM',
    icon: Users,
    allowedRoles: ['admin', 'sales', 'designer'],
  },
  {
    id: 'whatsapp',
    label: '3. Chat y Bot WhatsApp',
    shortLabel: 'Chat WhatsApp',
    group: 'Comercial y CRM',
    icon: MessageSquare,
    allowedRoles: ['admin', 'sales', 'designer'],
  },
  {
    id: 'kanban',
    label: 'Tablero Kanban Taller',
    shortLabel: 'Kanban Producción',
    group: 'Taller y Producción',
    icon: Kanban,
    allowedRoles: ['admin', 'sales', 'designer', 'operator'],
  },
  {
    id: 'optimizer',
    label: 'Optimizador Cortes 2D',
    shortLabel: 'Optimizador Cortes',
    group: 'Taller y Producción',
    icon: Scissors,
    allowedRoles: ['admin', 'designer', 'operator'],
  },
  {
    id: 'timetracking',
    label: 'Cronómetro y Tiempos',
    shortLabel: 'Tiempos Equipo',
    group: 'Taller y Producción',
    icon: Clock,
    allowedRoles: ['admin', 'designer', 'operator'],
  },
  {
    id: 'inventory',
    label: 'Inventario y Facturas PDF',
    shortLabel: 'Inventario & PDF',
    group: 'Bodega y Equipos',
    icon: Package,
    allowedRoles: ['admin', 'sales', 'designer', 'operator'],
  },
  {
    id: 'maintenance',
    label: 'Mant. de Maquinaria',
    shortLabel: 'Mant. Maquinaria',
    group: 'Bodega y Equipos',
    icon: Wrench,
    allowedRoles: ['admin', 'operator', 'designer'],
  },
  {
    id: 'finance',
    label: 'Caja, Bancos y Cobros',
    shortLabel: 'Caja y Cobros',
    group: 'Gerencia y Finanzas',
    icon: Wallet,
    allowedRoles: ['admin', 'sales'],
  },
  {
    id: 'users',
    label: 'Personal y Roles (RBAC)',
    shortLabel: 'Personal RBAC',
    group: 'Gerencia y Finanzas',
    icon: ShieldCheck,
    allowedRoles: ['admin'],
  },
];

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export default function App() {
  // Tema Claro / Oscuro y Sidebar Colapsable
  const [darkMode, setDarkMode] = useState<boolean>(() =>
    loadFromStorage('crea_arte_dark_mode', false)
  );
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);

  // Estado RBAC y Módulo Activo
  const [users, setUsers] = useState<UserProfile[]>(() =>
    loadFromStorage('crea_arte_users_v2', INITIAL_USERS)
  );
  const [currentUserId, setCurrentUserId] = useState<string>(() =>
    loadFromStorage('crea_arte_current_user_v2', INITIAL_USERS[0].id)
  );
  const [activeModule, setActiveModule] = useState<ModuleId>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Datos Persistentes del ERP en localStorage
  const [orders, setOrders] = useState<WorkOrder[]>(() => {
    const saved = loadFromStorage('crea_arte_orders_v2', INITIAL_ORDERS);
    const missingDefaults = INITIAL_ORDERS.filter(
      (def) => !saved.some((s) => s.id === def.id)
    );
    return [...missingDefaults, ...saved];
  });
  const [inventory, setInventory] = useState<InventoryItem[]>(() =>
    loadFromStorage('crea_arte_inventory_v2', INITIAL_INVENTORY)
  );
  const [movements, setMovements] = useState<InventoryMovement[]>(() =>
    loadFromStorage('crea_arte_movements_v2', INITIAL_INVENTORY_MOVEMENTS)
  );
  const [restockRequests, setRestockRequests] = useState<RestockRequest[]>(() =>
    loadFromStorage('crea_arte_restock_v2', INITIAL_RESTOCK_REQUESTS)
  );
  const [timeLogs, setTimeLogs] = useState<TimeLogEntry[]>(() =>
    loadFromStorage('crea_arte_timelogs_v2', INITIAL_TIME_LOGS)
  );
  const [transactions, setTransactions] = useState<CashTransaction[]>(() =>
    loadFromStorage('crea_arte_transactions_v2', INITIAL_CASH_TRANSACTIONS)
  );
  const [machines, setMachines] = useState<WorkshopMachine[]>(() =>
    loadFromStorage('crea_arte_machines_v2', INITIAL_MACHINES)
  );
  const [maintenanceLogs, setMaintenanceLogs] = useState<MachineMaintenanceLog[]>(() =>
    loadFromStorage('crea_arte_maintlogs_v2', INITIAL_MAINTENANCE_LOGS)
  );
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() =>
    loadFromStorage('crea_arte_chatmsgs_v2', INITIAL_CHAT_MESSAGES)
  );
  const [waConfig, setWaConfig] = useState<WhatsAppApiConfig[]>(() =>
    loadFromStorage('crea_arte_waconfig_v2', [INITIAL_WA_CONFIG])
  );
  const [clients, setClients] = useState<ClientContact[]>(() =>
    loadFromStorage('crea_arte_clients_v2', INITIAL_CLIENTS)
  );
  const [processedInvoices, setProcessedInvoices] = useState<ParsedSupplierInvoice[]>(() =>
    loadFromStorage('crea_arte_pdf_invoices_v2', INITIAL_PROCESSED_INVOICES)
  );
  const [auditLogs, setAuditLogs] = useState<SystemAuditLogEntry[]>(() =>
    loadFromStorage('crea_arte_audit_logs_v2', INITIAL_AUDIT_LOGS)
  );
  const [crmTasks, setCrmTasks] = useState<CrmTask[]>(() =>
    loadFromStorage('crea_arte_crm_tasks_v1', INITIAL_CRM_TASKS)
  );
  const [crmNotifications, setCrmNotifications] = useState<CrmNotification[]>(() =>
    loadFromStorage('crea_arte_crm_notifs_v1', INITIAL_CRM_NOTIFICATIONS)
  );
  const [reusableOffcuts, setReusableOffcuts] = useState<ReusableOffcut[]>(() =>
    loadFromStorage('crea_arte_reusable_offcuts_v1', INITIAL_REUSABLE_OFFCUTS)
  );
  const [optimizerPayload, setOptimizerPayload] = useState<QuoterTransferPayload | null>(null);
  const [showCrmInboxPopover, setShowCrmInboxPopover] = useState<boolean>(false);
  const [crmInboxTab, setCrmInboxTab] = useState<'notifications' | 'tasks'>('notifications');
  const [auditCategoryFilter, setAuditCategoryFilter] = useState<AuditActionCategory | 'all'>('all');
  const [auditActorFilter, setAuditActorFilter] = useState<string>('all');
  const [preselectedClient, setPreselectedClient] = useState<ClientContact | null>(null);
  const [preselectedWaOrderId, setPreselectedWaOrderId] = useState<string | null>(null);
  const [driveModalOrderId, setDriveModalOrderId] = useState<string | null>(null);
  const [qrTrackerOrderId, setQrTrackerOrderId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const trackParam = params.get('track');
      if (trackParam) return trackParam.startsWith('#') ? trackParam : `#${trackParam}`;
    }
    return null;
  });

  const activeWaConfig = waConfig[0] || INITIAL_WA_CONFIG;

  // Estado Global del Cronómetro en Vivo
  const [activeTimerOrderId, setActiveTimerOrderId] = useState<string>('#CA-001');
  const [activeTimerPhase, setActiveTimerPhase] = useState<'design' | 'machine' | 'installation'>(
    'machine'
  );
  const [activeTimerEmployeeId, setActiveTimerEmployeeId] = useState<string>('usr-operator');
  const [timerSeconds, setTimerSeconds] = useState<number>(0);
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);

  // Nuevo colaborador en módulo de usuarios
  const [newUserName, setNewUserName] = useState('');
  const [newUserRole, setNewUserRole] = useState<RoleId>('operator');
  const [newUserDepartment, setNewUserDepartment] = useState<UserProfile['department']>('Taller/Armado');
  const [newUserSpecialty, setNewUserSpecialty] = useState('Operación de Plotter e Instalación');
  const [newUserHourly, setNewUserHourly] = useState<number>(11);

  // MEJORA 5: Escritura segura en localStorage con manejo de errores (try/catch)
  const safeSaveToStorage = (key: string, value: unknown) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
      console.warn(`Error guardando ${key} en localStorage:`, err);
    }
  };

  // Sincronización con localStorage y clase global .dark en <html>
  useEffect(() => {
    safeSaveToStorage('crea_arte_dark_mode', darkMode);
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);
  useEffect(() => {
    safeSaveToStorage('crea_arte_users_v2', users);
  }, [users]);
  useEffect(() => {
    safeSaveToStorage('crea_arte_current_user_v2', currentUserId);
  }, [currentUserId]);
  useEffect(() => {
    safeSaveToStorage('crea_arte_orders_v2', orders);
  }, [orders]);
  useEffect(() => {
    safeSaveToStorage('crea_arte_inventory_v2', inventory);
  }, [inventory]);
  useEffect(() => {
    safeSaveToStorage('crea_arte_movements_v2', movements);
  }, [movements]);
  useEffect(() => {
    safeSaveToStorage('crea_arte_restock_v2', restockRequests);
  }, [restockRequests]);
  useEffect(() => {
    safeSaveToStorage('crea_arte_timelogs_v2', timeLogs);
  }, [timeLogs]);
  useEffect(() => {
    safeSaveToStorage('crea_arte_transactions_v2', transactions);
  }, [transactions]);
  useEffect(() => {
    safeSaveToStorage('crea_arte_machines_v2', machines);
  }, [machines]);
  useEffect(() => {
    safeSaveToStorage('crea_arte_maintlogs_v2', maintenanceLogs);
  }, [maintenanceLogs]);
  useEffect(() => {
    safeSaveToStorage('crea_arte_chatmsgs_v2', chatMessages);
  }, [chatMessages]);
  useEffect(() => {
    safeSaveToStorage('crea_arte_waconfig_v2', waConfig);
  }, [waConfig]);
  useEffect(() => {
    safeSaveToStorage('crea_arte_clients_v2', clients);
  }, [clients]);
  useEffect(() => {
    safeSaveToStorage('crea_arte_pdf_invoices_v2', processedInvoices);
  }, [processedInvoices]);
  useEffect(() => {
    safeSaveToStorage('crea_arte_audit_logs_v2', auditLogs);
  }, [auditLogs]);
  useEffect(() => {
    safeSaveToStorage('crea_arte_crm_tasks_v1', crmTasks);
  }, [crmTasks]);
  useEffect(() => {
    safeSaveToStorage('crea_arte_crm_notifs_v1', crmNotifications);
  }, [crmNotifications]);
  useEffect(() => {
    safeSaveToStorage('crea_arte_reusable_offcuts_v1', reusableOffcuts);
  }, [reusableOffcuts]);

  // Efecto del Cronómetro en Vivo
  useEffect(() => {
    if (!isTimerRunning) return;
    const interval = setInterval(() => {
      setTimerSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isTimerRunning]);

  const currentUser = useMemo(
    () => users.find((u) => u.id === currentUserId) || users[0],
    [users, currentUserId]
  );

  const currentRole = currentUser.role;

  const allowedModules = useMemo(
    () => MODULES.filter((m) => m.allowedRoles.includes(currentRole)),
    [currentRole]
  );

  useEffect(() => {
    const canAccess = allowedModules.some((m) => m.id === activeModule);
    if (!canAccess) {
      setActiveModule(currentRole === 'admin' ? 'dashboard' : 'kanban');
    }
  }, [currentRole, allowedModules, activeModule]);

  useEffect(() => {
    if (orders.length > 0 && !orders.some((o) => o.id === activeTimerOrderId)) {
      setActiveTimerOrderId(orders[0].id);
    }
  }, [orders, activeTimerOrderId]);

  const notify = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 4200);
  };

  const nextOrderCode = useMemo(() => {
    const maxNum = orders.reduce((max, o) => {
      const num = parseInt(o.id.replace('#CA-', ''), 10);
      return isNaN(num) ? max : Math.max(max, num);
    }, 0);
    return `#CA-${String(maxNum + 1).padStart(3, '0')}`;
  }, [orders]);

  // Handlers de Negocio Integrados
  const handleSwitchUser = (userId: string) => {
    setCurrentUserId(userId);
    const found = users.find((u) => u.id === userId);
    if (found) {
      setActiveTimerEmployeeId(found.id);
      if (found.role === 'admin') {
        setActiveModule('dashboard');
      }
      notify(`Sesión activa cambiada a: ${found.name} (${found.roleLabel})`);
    }
  };

  // Enviar mensaje en CRM WhatsApp (y limpiar contador de respuestas sin leer)
  const handleSendCrmMessage = (
    orderId: string,
    text: string,
    channel: 'wa_direct' | 'meta_cloud_api',
    mediaAttachment?: ChatMediaAttachment
  ) => {
    const newMsg: ChatMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      orderId,
      sender: 'agent',
      senderName: `${currentUser.name} (${currentUser.roleLabel.split('/')[0].trim()})`,
      text,
      timestamp: getNowTimestamp(),
      status: 'read',
      channel,
      mediaAttachment,
    };
    setChatMessages((prev) => [...prev, newMsg]);
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, unreadClientReplies: 0 } : o))
    );
    notify(
      mediaAttachment
        ? `📎 Adjunto (${mediaAttachment.name}) enviado a ${orderId} vía ${
            channel === 'meta_cloud_api' ? 'Meta Cloud API' : 'WhatsApp Directo'
          }`
        : `Mensaje enviado a la orden ${orderId} vía ${
            channel === 'meta_cloud_api' ? 'Meta Cloud API' : 'WhatsApp Directo'
          }`
    );
  };

  // Asignar o transferir conversación de cliente a otro usuario del equipo
  const handleAssignConversationAgent = (orderId: string, targetUserId: string) => {
    const targetOrder = orders.find((o) => o.id === orderId);
    const targetUser = users.find((u) => u.id === targetUserId);
    if (!targetOrder || !targetUser) return;

    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? { ...o, assignedCrmAgentId: targetUserId, unreadClientReplies: 0 }
          : o
      )
    );

    const newNotif: CrmNotification = {
      id: `crm-notif-${Date.now()}`,
      type: 'chat_assigned',
      targetUserId,
      recipientUserId: targetUserId,
      actorName: currentUser.name,
      senderName: currentUser.name,
      orderId,
      clientName: targetOrder.clientName,
      title: `📲 Chat ${orderId} asignado a ${targetUser.name}`,
      message: `${currentUser.name} asignó la conversación de ${targetOrder.clientName} (${targetOrder.title}) a ${targetUser.name}.`,
      timestamp: getNowTimestamp(),
      read: targetUserId === currentUser.id,
    };
    setCrmNotifications((prev) => [newNotif, ...prev]);

    appendAuditLog(
      'crm_tareas',
      'Asignación de Chat CRM',
      `${currentUser.name} asignó el chat de ${targetOrder.clientName} (${orderId}) al usuario ${targetUser.name} (${targetUser.roleLabel}).`,
      orderId,
      targetUser.name
    );

    notify(`Conversación ${orderId} asignada a ${targetUser.name}`);
  };

  // Enviar Nota Interna de Equipo y notificar con @mención (soporta 1 usuario, múltiples usuarios o @TODOS + adjuntos)
  const handleSendInternalNote = (
    orderId: string,
    text: string,
    mentionedUserId?: string,
    driveFileAttachment?: ProjectDriveFileRecord,
    mentionedUserIds?: string[],
    mentionAllTeam?: boolean,
    mediaAttachment?: ChatMediaAttachment
  ) => {
    const targetOrder = orders.find((o) => o.id === orderId);
    const ts = getNowTimestamp();

    const resolvedTargetIds: string[] = mentionAllTeam
      ? users.map((u) => u.id)
      : mentionedUserIds && mentionedUserIds.length > 0
      ? Array.from(new Set(mentionedUserIds))
      : mentionedUserId
      ? [mentionedUserId]
      : [];

    const resolvedUsers = resolvedTargetIds
      .map((id) => users.find((u) => u.id === id))
      .filter((u): u is UserProfile => Boolean(u));

    const mentionPrefix = mentionAllTeam
      ? '@TODOS EL EQUIPO: '
      : resolvedUsers.length > 0
      ? `${resolvedUsers.map((u) => `@${u.name}`).join(', ')}: `
      : '';

    const noteMsg: ChatMessage = {
      id: `msg-note-${Date.now()}`,
      orderId,
      sender: 'agent',
      senderName: `${currentUser.name} (${currentUser.roleLabel.split('/')[0].trim()})`,
      text: `${mentionPrefix}${text}`,
      timestamp: ts,
      status: 'read',
      channel: 'wa_direct',
      isInternalNote: true,
      mentionedUserId: resolvedUsers[0]?.id || mentionedUserId,
      mentionedUserIds: resolvedTargetIds,
      mentionAllTeam: Boolean(mentionAllTeam),
      driveFileAttachment,
      mediaAttachment,
    };

    setChatMessages((prev) => [...prev, noteMsg]);

    if (resolvedUsers.length > 0) {
      const newNotifs: CrmNotification[] = resolvedUsers.map((targetUsr, idx) => ({
        id: `crm-notif-${Date.now()}-${idx}-mention`,
        type: 'internal_mention',
        targetUserId: targetUsr.id,
        recipientUserId: targetUsr.id,
        actorName: currentUser.name,
        senderName: currentUser.name,
        orderId,
        clientName: targetOrder?.clientName || orderId,
        title: mentionAllTeam
          ? `📢 Nota Interna para @TODOS en ${orderId} (${targetOrder?.clientName || ''})`
          : `🔒 Mención interna en ${orderId} (${targetOrder?.clientName || ''})`,
        message: `${currentUser.name} dejó una nota en el chat${
          resolvedUsers.length > 1 && !mentionAllTeam
            ? ` (para ${resolvedUsers.map((u) => u.name.split(' ')[0]).join(', ')})`
            : ''
        }: "${text}"`,
        timestamp: ts,
        read: false,
      }));
      setCrmNotifications((prev) => [...newNotifs, ...prev]);
    }

    const recipientsSummary = mentionAllTeam
      ? `TODOS (${resolvedUsers.length} colaboradores)`
      : resolvedUsers.map((u) => u.name).join(', ');

    appendAuditLog(
      'crm_tareas',
      'Nota Interna en Chat CRM',
      `${currentUser.name} registró una nota interna en ${orderId}${
        recipientsSummary ? ` notificando a ${recipientsSummary}` : ''
      }: "${text}"`,
      orderId,
      recipientsSummary || undefined
    );

    notify(
      mentionAllTeam
        ? `📢 Nota interna guardada y notificada a TODOS los colaboradores (${resolvedUsers.length})`
        : resolvedUsers.length > 1
        ? `🔒 Nota interna guardada y notificada a ${resolvedUsers.length} colaboradores (${resolvedUsers
            .map((u) => u.name.split(' ')[0])
            .join(', ')})`
        : resolvedUsers.length === 1
        ? `Nota interna guardada y notificación enviada a ${resolvedUsers[0].name}`
        : 'Nota interna guardada en el expediente de la conversación'
    );
  };

  // Crear y asignar una Tarea CRM a un usuario
  const handleAddCrmTask = (
    newTaskData: Omit<CrmTask, 'id' | 'createdAt' | 'status'>
  ) => {
    const assignee = users.find((u) => u.id === newTaskData.assignedToUserId);
    const ts = getNowTimestamp();
    const createdTask: CrmTask = {
      ...newTaskData,
      id: `crm-task-${Date.now()}`,
      status: 'pending',
      createdAt: ts,
    };

    setCrmTasks((prev) => [createdTask, ...prev]);

    const notif: CrmNotification = {
      id: `crm-notif-${Date.now()}-task`,
      type: 'task_assigned',
      targetUserId: newTaskData.assignedToUserId,
      recipientUserId: newTaskData.assignedToUserId,
      actorName: currentUser.name,
      senderName: currentUser.name,
      orderId: newTaskData.orderId,
      clientName: newTaskData.clientName,
      title: `📌 Nueva Tarea CRM (${newTaskData.priority.toUpperCase()}): ${newTaskData.clientName}`,
      message: `${currentUser.name} te asignó: "${newTaskData.title}" (Vence: ${newTaskData.dueDate})`,
      timestamp: ts,
      read: false,
    };
    setCrmNotifications((prev) => [notif, ...prev]);

    appendAuditLog(
      'crm_tareas',
      'Creación de Tarea CRM',
      `${currentUser.name} asignó la tarea CRM "${newTaskData.title}" a ${
        assignee?.name || newTaskData.assignedToUserId
      } para el cliente ${newTaskData.clientName}.`,
      newTaskData.orderId,
      assignee?.name
    );

    notify(
      `Tarea CRM asignada a ${assignee?.name || 'colaborador'} y notificada en campana CRM`
    );
  };

  // Completar / Reabrir Tarea CRM
  const handleToggleCrmTaskStatus = (taskId: string) => {
    const target = crmTasks.find((t) => t.id === taskId);
    if (!target) return;
    const nextStatus = target.status === 'pending' ? 'completed' : 'pending';
    const ts = getNowTimestamp();

    setCrmTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? {
              ...t,
              status: nextStatus,
              completedAt: nextStatus === 'completed' ? ts : undefined,
              completedByName: nextStatus === 'completed' ? currentUser.name : undefined,
            }
          : t
      )
    );

    if (nextStatus === 'completed') {
      appendAuditLog(
        'crm_tareas',
        'Tarea CRM Completada',
        `${currentUser.name} marcó como completada la tarea CRM "${target.title}" del cliente ${target.clientName}.`,
        target.orderId
      );
      notify(`✓ Tarea CRM completada por ${currentUser.name}`);
    }
  };

  const handleSimulateIncomingMessage = (orderId: string, text: string) => {
    const targetOrder = orders.find((o) => o.id === orderId);
    const channelUsed =
      activeWaConfig.mode === 'meta_cloud_api' ? 'meta_cloud_api' : 'wa_direct';
    const ts = getNowTimestamp();

    const newMsg: ChatMessage = {
      id: `msg-${Date.now()}-in`,
      orderId,
      sender: 'client',
      senderName: targetOrder ? targetOrder.clientName : 'Cliente',
      text,
      timestamp: ts,
      status: 'read',
      channel: channelUsed,
    };

    const upper = text
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
    const botReplies: ChatMessage[] = [];

    // Regla 3: Bot de Respuesta Automática por Palabras Clave y Menú Interactivo (1 al 6)
    if (targetOrder && activeWaConfig.autoProcessClientKeywords !== false) {
      const pending = Math.max(
        0,
        Number((targetOrder.totalPrice - targetOrder.paidAmount).toFixed(2))
      );
      const advance50 = Number((targetOrder.totalPrice * 0.5).toFixed(2));
      const designOnly = isDesignOnlyOrder(targetOrder);

      // Comando 3 / APROBADO: Aprueba arte y avanza etapa en Kanban + Descuenta stock si aplica
      if (
        upper === '3' ||
        upper.includes('APROBADO') ||
        upper.includes('OK ARTE') ||
        upper.includes('IMPRIMIR') ||
        upper.includes('CONFIRMO ARTE') ||
        upper.includes('AUTORIZO')
      ) {
        const nextAutoStage: OrderStage = designOnly
          ? 'Instalación / Listo para Retiro'
          : 'En Cola de Impresión/Corte';

        setOrders((prev) =>
          prev.map((o) =>
            o.id === orderId ? { ...o, artworkApproved: true } : o
          )
        );
        handleMoveOrderStage(orderId, nextAutoStage);

        botReplies.push({
          id: `msg-${Date.now() + 2}-bot`,
          orderId,
          sender: 'agent',
          senderName: 'Bot Automático Crea Arte',
          text: designOnly
            ? `🤖 *CONFIRMACIÓN AUTOMÁTICA (${orderId}):*\n¡Gracias *${targetOrder.clientName}*! Hemos registrado la aprobación de su propuesta gráfica. Al ser un servicio 100% digital, su orden pasó directo a *Listo para Entrega Digital de Editables (AI / PDF / PNG)*.`
            : `🤖 *CONFIRMACIÓN AUTOMÁTICA (${orderId}):*\n¡Gracias *${targetOrder.clientName}*! Hemos registrado su aprobación de arte final. Su orden acaba de pasar automáticamente a *En Cola de Impresión/Corte* y los materiales han sido asignados en taller.`,
          timestamp: ts,
          status: 'delivered',
          channel: channelUsed,
        });
      }
      // Comando 4 / CORRECCIÓN: Regresa la orden a En Diseño y Arte y notifica al diseñador
      else if (
        upper === '4' ||
        upper.includes('CORRECCION') ||
        upper.includes('CAMBIO') ||
        upper.includes('MODIFICAR') ||
        upper.includes('AJUSTE') ||
        upper.includes('CORREGIR')
      ) {
        setOrders((prev) =>
          prev.map((o) =>
            o.id === orderId
              ? {
                  ...o,
                  artworkApproved: false,
                  stage: 'En Diseño y Arte',
                  notes: `${o.notes ? o.notes + ' | ' : ''}[Cambio solicitado vía WhatsApp]: ${text}`,
                }
              : o
          )
        );

        botReplies.push({
          id: `msg-${Date.now() + 2}-bot`,
          orderId,
          sender: 'agent',
          senderName: 'Bot Automático Crea Arte',
          text: `🤖 *SOLICITUD DE AJUSTE DE DISEÑO (${orderId}):*\nEstimado/a *${targetOrder.clientName}*, hemos registrado sus observaciones y retornado la orden a la etapa *"En Diseño y Arte"*.\n🎨 Nuestro diseñador asignado revisará sus comentarios y le enviará una nueva versión actualizada por esta vía.`,
          timestamp: ts,
          status: 'delivered',
          channel: channelUsed,
        });
      }
      // Comando 5 / COMPROBANTE DE PAGO: Acuse de recibo de transferencia o abono
      else if (
        upper === '5' ||
        upper.includes('COMPROBANTE') ||
        upper.includes('TRANSFERENCIA') ||
        upper.includes('YA PAGUE') ||
        upper.includes('YA TRANSFERI') ||
        upper.includes('DEPOSITO') ||
        upper.includes('VOUCHER')
      ) {
        botReplies.push({
          id: `msg-${Date.now() + 2}-bot`,
          orderId,
          sender: 'agent',
          senderName: 'Bot Caja & Cobranzas',
          text: `🤖 *RECEPCIÓN DE COMPROBANTE (${orderId}):*\n¡Muchas gracias *${targetOrder.clientName}*! Hemos recibido su notificación de pago.\n🧾 *Saldo registrado previo a validación:* $${pending.toFixed(2)}\nNuestro equipo de Administración y Caja verificará la transferencia bancaria y en breves minutos recibirá su *Recibo Digital Oficial* por este mismo chat.`,
          timestamp: ts,
          status: 'delivered',
          channel: channelUsed,
        });
      }
      // Comando 2 / SALDO Y CUENTAS BANCARIAS
      else if (
        upper === '2' ||
        upper.includes('SALDO') ||
        upper.includes('CUANTO DEBO') ||
        upper.includes('CUENTA') ||
        upper.includes('BANCO') ||
        upper.includes('PRECIO')
      ) {
        botReplies.push({
          id: `msg-${Date.now() + 2}-bot`,
          orderId,
          sender: 'agent',
          senderName: 'Bot Caja & Cobranzas',
          text: `🤖 *ESTADO DE CUENTA Y BANCOS (${orderId}):*\n• *Cliente:* ${targetOrder.clientName}\n• *Proyecto:* ${targetOrder.title}\n• *Total Orden:* $${targetOrder.totalPrice.toFixed(2)}\n• *Total Abonado:* $${targetOrder.paidAmount.toFixed(2)}\n• *Saldo Pendiente:* *$${pending.toFixed(2)}* ${
            pending === 0 ? '✅ *(LIQUIDADO)*' : `(Anticipo 50% ref: $${advance50.toFixed(2)})`
          }\n\n🏦 *Cuentas Oficiales Crea Arte S.A. (RUC: 1790088123001):*\n• *Banco Pichincha* — Cta. Cte. #2100492811\n• *Banco Guayaquil* — Cta. Cte. #0019283746\n📩 Envíe su comprobante por este chat indicando el código *${orderId}*.`,
          timestamp: ts,
          status: 'delivered',
          channel: channelUsed,
        });
      }
      // Comando 1 / ESTADO DE ORDEN Y PRODUCCIÓN
      else if (
        upper === '1' ||
        upper.includes('ESTADO') ||
        upper.includes('AVANCE') ||
        upper.includes('COMO VA') ||
        upper.includes('CUANDO ESTA')
      ) {
        botReplies.push({
          id: `msg-${Date.now() + 2}-bot`,
          orderId,
          sender: 'agent',
          senderName: 'Bot Automático Crea Arte',
          text: `🤖 *CONSULTA EN TIEMPO REAL (${orderId}):*\n• *Proyecto:* ${targetOrder.title}\n• *Modalidad:* ${
            designOnly ? '🎨 100% Diseño Gráfico Digital' : `🏭 Producción Taller (${targetOrder.widthM}m × ${targetOrder.heightM}m)`
          }\n• *Etapa Actual:* *${targetOrder.stage}*\n• *Arte Aprobado:* ${
            targetOrder.artworkApproved ? '✅ Sí, aprobado' : '⏳ Pendiente de aprobación'
          }\n• *Entrega Programada:* ${targetOrder.deadline.replace('T', ' ')}\n• *Saldo Pendiente:* *$${pending.toFixed(2)}*`,
          timestamp: ts,
          status: 'delivered',
          channel: channelUsed,
        });
      }
      // Comando 6 / UBICACIÓN Y HORARIOS DE RETIRO
      else if (
        upper === '6' ||
        upper.includes('UBICACION') ||
        upper.includes('DIRECCION') ||
        upper.includes('HORARIO') ||
        upper.includes('RETIRO') ||
        upper.includes('DONDE ESTAN')
      ) {
        botReplies.push({
          id: `msg-${Date.now() + 2}-bot`,
          orderId,
          sender: 'agent',
          senderName: 'Bot Automático Crea Arte',
          text: `🤖 *PLANTA Y HORARIOS DE RETIRO — CREA ARTE:*\n📍 *Dirección Taller y Showroom:* Av. Principal Industrial N45-12 y Galo Plaza, Sector Norte.\n🕒 *Horario de Atención:* Lunes a Viernes de 08:30 a 18:00 | Sábados de 09:00 a 13:00.\n📦 *Estado de su orden ${orderId}:* ${targetOrder.stage} (${
            pending > 0
              ? `Recuerde liquidar su saldo de $${pending.toFixed(2)} previo al despacho`
              : 'Orden 100% liquidada y habilitada'
          }).`,
          timestamp: ts,
          status: 'delivered',
          channel: channelUsed,
        });
      }
      // Menú Interactivo / Saludo General
      else if (
        upper.includes('HOLA') ||
        upper.includes('BUENOS') ||
        upper.includes('BUENAS') ||
        upper.includes('MENU') ||
        upper.includes('AYUDA') ||
        upper.includes('INFO') ||
        upper === '?'
      ) {
        botReplies.push({
          id: `msg-${Date.now() + 2}-bot`,
          orderId,
          sender: 'agent',
          senderName: 'Bot Automático Crea Arte',
          text: `🤖 *ASISTENTE VIRTUAL CREA ARTE (${orderId})*\n¡Hola *${targetOrder.clientName}*! Estoy conectado en tiempo real con nuestro taller para asistirle con su proyecto *${targetOrder.title}*.\n\nEscriba el *número* o la *palabra clave* de lo que necesita:\n1️⃣ *ESTADO* — Ver etapa actual y fecha de entrega\n2️⃣ *SALDO* — Ver estado de cuenta y bancos oficiales\n3️⃣ *APROBADO* — Autorizar el diseño/arte para producción\n4️⃣ *CORRECCION* — Solicitar un ajuste en el boceto/diseño\n5️⃣ *COMPROBANTE* — Notificar envío de pago o transferencia\n6️⃣ *HORARIO* — Ver ubicación del taller y horarios de retiro`,
          timestamp: ts,
          status: 'delivered',
          channel: channelUsed,
        });
      }
    }

    setChatMessages((prev) => [...prev, newMsg, ...botReplies]);

    // Incrementar contador de respuesta pendiente de atención y generar alerta CRM al usuario asignado
    const assignedAgentId = targetOrder?.assignedCrmAgentId || 'usr-sales';
    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? { ...o, unreadClientReplies: (o.unreadClientReplies || 0) + 1 }
          : o
      )
    );

    const replyNotif: CrmNotification = {
      id: `crm-notif-${Date.now()}-reply`,
      type: 'client_reply',
      targetUserId: assignedAgentId,
      recipientUserId: assignedAgentId,
      actorName: targetOrder?.clientName || 'Cliente WhatsApp',
      senderName: targetOrder?.clientName || 'Cliente WhatsApp',
      orderId,
      clientName: targetOrder?.clientName || orderId,
      title: `💬 Respuesta de Cliente en ${orderId} (${targetOrder?.clientName || ''})`,
      message: `Cliente escribió: "${text}"`,
      timestamp: ts,
      read: false,
    };
    setCrmNotifications((prev) => [replyNotif, ...prev]);

    notify(
      botReplies.length > 0
        ? `Bot WhatsApp procesó el mensaje de ${targetOrder?.clientName || orderId} y notificó al agente asignado`
        : `🔔 Respuesta entrante de ${targetOrder?.clientName || orderId} notificada en Alertas CRM`
    );
  };

  // =========================================================================
  // CLASIFICACIÓN AUTOMÁTICA (CLIENTE NUEVO VS RECURRENTE) Y AUTO-CREACIÓN DE LEADS META ADS
  // =========================================================================
  const handleIncomingMetaWebhookOrAdLead = (incoming: {
    phone: string;
    profileName?: string;
    text: string;
    referral?: MetaAdReferralInfo;
    originType?: 'ctwa_ad' | 'leadgen_form' | 'organic_wa';
  }): string => {
    const cleanLast9 = String(incoming.phone || '')
      .replace(/\D/g, '')
      .slice(-9);
    const ts = getNowTimestamp();
    const todayStr = getTodayDateStr();
    const referral = incoming.referral;
    const isLeadForm =
      incoming.originType === 'leadgen_form' || referral?.sourceType === 'leadgen_form';

    // Buscar si el teléfono ya existe en el Directorio CRM o en órdenes previas
    const existingClient = clients.find(
      (c) =>
        (cleanLast9.length >= 7 &&
          c.phone.replace(/\D/g, '').slice(-9) === cleanLast9) ||
        (incoming.profileName &&
          c.name.toLowerCase().trim() === incoming.profileName.toLowerCase().trim())
    );

    const matchingOrders = orders.filter(
      (o) =>
        (cleanLast9.length >= 7 &&
          o.clientPhone.replace(/\D/g, '').slice(-9) === cleanLast9) ||
        (existingClient &&
          o.clientName.toLowerCase().trim() === existingClient.name.toLowerCase().trim())
    );

    const isRecurrent = Boolean(existingClient) || matchingOrders.length > 0;
    const channelUsed: 'wa_direct' | 'meta_cloud_api' =
      activeWaConfig.mode === 'meta_cloud_api' || Boolean(referral)
        ? 'meta_cloud_api'
        : 'wa_direct';

    if (isRecurrent) {
      // CASO A — CLIENTE RECURRENTE
      const clientName =
        existingClient?.name ||
        matchingOrders[0]?.clientName ||
        incoming.profileName ||
        'Cliente Recurrente';
      const clientPhone =
        existingClient?.phone || matchingOrders[0]?.clientPhone || incoming.phone;
      const clientRuc = existingClient?.ruc || matchingOrders[0]?.clientRuc || '9999999999';
      const totalClientOrders = matchingOrders.length;

      if (existingClient) {
        const updatedTags = new Set(existingClient.tags);
        if (totalClientOrders >= 2) {
          updatedTags.add('VIP / Recurrente');
        }
        if (referral) {
          updatedTags.add('Lead Meta Ads');
          updatedTags.add(
            isLeadForm ? 'Lead Formulario Meta' : 'Campaña Click-to-WhatsApp'
          );
        }
        setClients((prev) =>
          prev.map((c) =>
            c.id === existingClient.id
              ? {
                  ...c,
                  tags: Array.from(updatedTags),
                  adReferral: referral || c.adReferral,
                  crmLeadStage:
                    c.crmLeadStage ||
                    (referral ? 'En Calificación / Consultando' : 'Post-Venta / Recurrente'),
                }
              : c
          )
        );
      }

      const activeExistingOrder =
        matchingOrders.find((o) => o.stage !== 'Finalizado y Liquidado') ||
        matchingOrders[0];

      if (activeExistingOrder && activeExistingOrder.stage !== 'Finalizado y Liquidado') {
        const targetId = activeExistingOrder.id;
        setOrders((prev) =>
          prev.map((o) =>
            o.id === targetId
              ? {
                  ...o,
                  unreadClientReplies: (o.unreadClientReplies || 0) + 1,
                  adReferral: referral || o.adReferral,
                  isMetaAdLead: Boolean(referral) || o.isMetaAdLead,
                  crmLeadStage:
                    o.crmLeadStage ||
                    (referral ? 'En Calificación / Consultando' : 'Cliente en Producción Activa'),
                }
              : o
          )
        );

        const msg: ChatMessage = {
          id: `msg-${Date.now()}-meta-rec`,
          orderId: targetId,
          sender: 'client',
          senderName: clientName,
          text: incoming.text,
          timestamp: ts,
          status: 'read',
          channel: channelUsed,
          adReferral: referral,
        };
        setChatMessages((prev) => [...prev, msg]);

        const notif: CrmNotification = {
          id: `crm-notif-${Date.now()}-meta-rec`,
          type: 'client_reply',
          targetUserId: activeExistingOrder.assignedCrmAgentId || 'usr-sales',
          recipientUserId: activeExistingOrder.assignedCrmAgentId || 'usr-sales',
          actorName: clientName,
          senderName: clientName,
          orderId: targetId,
          clientName,
          title: referral
            ? `📢 Cliente Recurrente desde Meta Ads (${targetId})`
            : `💬 Respuesta de Cliente Recurrente (${targetId})`,
          message: referral
            ? `Campaña: "${referral.headline}" — ${incoming.text}`
            : incoming.text,
          timestamp: ts,
          read: false,
        };
        setCrmNotifications((prev) => [notif, ...prev]);
        setPreselectedWaOrderId(targetId);
        notify(
          `⭐ Cliente recurrente "${clientName}" contactó en ${targetId}${
            referral ? ` vía Meta Ads (${referral.headline})` : ''
          }`
        );
        return targetId;
      } else {
        // Todas sus órdenes previas estaban finalizadas: abrir nuevo expediente para este cliente recurrente
        const newOrderId = nextOrderCode;
        const newRecurrentOrder: WorkOrder = {
          id: newOrderId,
          clientName,
          clientRuc,
          clientPhone,
          title: referral?.headline
            ? `Consulta Campaña: ${referral.headline}`
            : 'Nuevo Requerimiento de Cliente Recurrente',
          category: 'Rótulos 3D y Estructurados',
          materialId: 'mat-rotulo-alucobond',
          materialName: 'Fachada / Bandeja en Alucobond ACM 4mm Calado + Acrílico',
          widthM: 3.0,
          heightM: 1.2,
          quantity: 1,
          totalAreaM2: 3.6,
          finishings: ['Asesoría técnica en curso', 'Por definir en cotizador'],
          stage: 'Cotizado / Anticipo Pendiente',
          createdAt: `${todayStr}T10:00:00`,
          deadline: `${todayStr}T18:00:00`,
          designerId: 'usr-designer',
          operatorId: 'usr-operator',
          installerId: 'usr-installer-3',
          estimatedDesignHours: 2,
          estimatedMachineHours: 4,
          estimatedInstallHours: 2,
          rawMaterialCost: 140,
          wastePercent: 10,
          installationFee: 60,
          subtotal: 320,
          discount: 0,
          includeIva: true,
          totalPrice: 368,
          paidAmount: 0,
          artworkUrl: '',
          artworkApproved: false,
          stockDeducted: false,
          notes: `Requerimiento entrante de cliente recurrente.${
            referral ? ` Campaña Meta Ads: ${referral.headline}` : ''
          }`,
          assignedCrmAgentId: 'usr-sales',
          unreadClientReplies: 1,
          crmLeadStage: referral ? 'Lead Entrante (Meta Ads)' : 'En Calificación / Consultando',
          adReferral: referral,
          isMetaAdLead: Boolean(referral),
        };

        setOrders((prev) => [newRecurrentOrder, ...prev]);
        setChatMessages((prev) => [
          ...prev,
          {
            id: `msg-${Date.now()}-meta-rec-new`,
            orderId: newOrderId,
            sender: 'client',
            senderName: clientName,
            text: incoming.text,
            timestamp: ts,
            status: 'read',
            channel: channelUsed,
            adReferral: referral,
          },
        ]);
        setPreselectedWaOrderId(newOrderId);
        return newOrderId;
      }
    }

    // CASO B — CLIENTE NUEVO (No existe en clients ni en orders)
    const newClientName =
      incoming.profileName?.trim() ||
      `Prospecto Meta Ads (${cleanLast9.slice(-4) || 'Nuevo'})`;
    const newClientTags: string[] = [
      'Nuevo Prospecto',
      ...(referral
        ? [
            'Lead Meta Ads',
            isLeadForm ? 'Lead Formulario Meta' : 'Campaña Click-to-WhatsApp',
          ]
        : []),
    ];
    const initialLeadStage: CrmLeadStage = referral
      ? 'Lead Entrante (Meta Ads)'
      : 'En Calificación / Consultando';

    const newClient: ClientContact = {
      id: `cli-meta-${Date.now()}`,
      name: newClientName,
      ruc: '9999999999001',
      phone: incoming.phone,
      email: 'prospecto@meta-ads.ec',
      cityAddress: 'Por confirmar en calificación comercial',
      tags: newClientTags,
      notes: referral
        ? `Captado automáticamente desde ${
            isLeadForm ? 'Formulario Meta Lead Ads' : 'Click-to-WhatsApp Ad'
          }: "${referral.headline}" (ID: ${referral.sourceId || 'N/A'}).`
        : 'Captado automáticamente desde WhatsApp entrante.',
      createdAt: todayStr,
      assignedExecutiveId: 'usr-sales',
      crmLeadStage: initialLeadStage,
      adReferral: referral,
      originChannel: referral
        ? isLeadForm
          ? 'Meta Lead Form'
          : 'Meta Ads CTWA'
        : 'WhatsApp Orgánico',
    };

    const newOrderId = nextOrderCode;
    const newLeadOrder: WorkOrder = {
      id: newOrderId,
      clientName: newClientName,
      clientRuc: newClient.ruc,
      clientPhone: incoming.phone,
      title: referral?.headline
        ? `Lead Meta Ads: ${referral.headline}`
        : `Solicitud Comercial WhatsApp — ${newClientName}`,
      category: 'Rótulos 3D y Estructurados',
      materialId: 'mat-rotulo-alucobond',
      materialName: 'Fachada / Bandeja en Alucobond ACM 4mm Calado + Acrílico',
      widthM: 3.8,
      heightM: 1.2,
      quantity: 1,
      totalAreaM2: 4.56,
      finishings: [
        'Letras corpóreas acrílico 3mm',
        'Iluminación LED Samsung IP68',
        'Instalación en fachada',
      ],
      stage: 'Cotizado / Anticipo Pendiente',
      createdAt: `${todayStr}T${ts.split(' ')[1] || '10:00'}:00`,
      deadline: `${todayStr}T18:00:00`,
      designerId: 'usr-designer',
      operatorId: 'usr-operator-2',
      installerId: 'usr-installer-3',
      estimatedDesignHours: 3.0,
      estimatedMachineHours: 6.0,
      estimatedInstallHours: 4.0,
      rawMaterialCost: 220.0,
      wastePercent: 10,
      installationFee: 95.0,
      subtotal: 580.0,
      discount: 0,
      includeIva: true,
      totalPrice: 667.0,
      paidAmount: 0,
      artworkUrl: '',
      artworkApproved: false,
      stockDeducted: false,
      notes: `Lead entrante automático.${
        referral
          ? ` Campaña: "${referral.headline}" · Click ID: ${referral.ctwaClid || 'CTWA'}`
          : ''
      } · Mensaje inicial: "${incoming.text}"`,
      assignedCrmAgentId: 'usr-sales',
      unreadClientReplies: 1,
      crmLeadStage: initialLeadStage,
      adReferral: referral,
      isMetaAdLead: Boolean(referral),
    };

    const incomingChatMsg: ChatMessage = {
      id: `msg-${Date.now()}-ctwa`,
      orderId: newOrderId,
      sender: 'client',
      senderName: newClientName,
      text: incoming.text,
      timestamp: ts,
      status: 'read',
      channel: channelUsed,
      adReferral: referral,
    };

    const autoWelcomeBotMsg: ChatMessage = {
      id: `msg-${Date.now() + 1}-ctwa-bot`,
      orderId: newOrderId,
      sender: 'agent',
      senderName: 'Bot Automático Crea Arte',
      text: `🤖 *BIENVENIDO A CREA ARTE PUBLICIDAD (${newOrderId})*\n¡Hola *${newClientName}*! Hemos recibido su consulta${
        referral ? ` desde nuestra campaña *"${referral.headline}"*` : ''
      }.\n👩‍💼 Nuestra ejecutiva comercial *Valeria Rojas* ya tiene asignado su requerimiento para enviarle su proforma formal en minutos.`,
      timestamp: ts,
      status: 'delivered',
      channel: channelUsed,
    };

    setClients((prev) => [newClient, ...prev]);
    setOrders((prev) => [newLeadOrder, ...prev]);
    setChatMessages((prev) => [...prev, incomingChatMsg, autoWelcomeBotMsg]);

    const leadNotif: CrmNotification = {
      id: `crm-notif-${Date.now()}-lead`,
      type: 'client_reply',
      targetUserId: 'usr-sales',
      recipientUserId: 'usr-sales',
      actorName: newClientName,
      senderName: newClientName,
      orderId: newOrderId,
      clientName: newClientName,
      title: referral
        ? `📢 Nuevo Lead Meta Ads en ${newOrderId}: ${referral.headline}`
        : `🆕 Nuevo Prospecto WhatsApp en ${newOrderId}`,
      message: `${newClientName} (${incoming.phone}): "${incoming.text}"`,
      timestamp: ts,
      read: false,
    };
    setCrmNotifications((prev) => [leadNotif, ...prev]);

    appendAuditLog(
      'crm_tareas',
      referral ? 'Captura Automática Lead Meta Ads' : 'Nuevo Prospecto WhatsApp',
      `Se registró automáticamente al cliente nuevo "${newClientName}" (${incoming.phone}) con expediente ${newOrderId}${
        referral ? ` desde el anuncio "${referral.headline}" (ID: ${referral.sourceId})` : ''
      }.`,
      newOrderId
    );

    setPreselectedWaOrderId(newOrderId);
    notify(
      referral
        ? `📢 Nuevo Lead Meta Ads "${newClientName}" creado en ${newOrderId} (${referral.headline})`
        : `🆕 Nuevo prospecto "${newClientName}" creado en ${newOrderId}`
    );

    return newOrderId;
  };

  // Disparador directo de simulación de anuncio Meta Ads (conecta con /api/whatsapp/simulate-ad-lead y procesa en vivo)
  const handleSimulateMetaAdLead = async (customOptions?: {
    headline?: string;
    profileName?: string;
    phone?: string;
    text?: string;
    sourceType?: 'ad' | 'leadgen_form';
  }) => {
    const suffix = Math.floor(1000 + Math.random() * 9000);
    const defaultHeadline =
      customOptions?.headline || 'Campaña Rótulos 3D & Corpóreos LED - 20% Off';
    const defaultName =
      customOptions?.profileName || `Importadora & Showroom Del Pacífico ${suffix}`;
    const defaultPhone =
      customOptions?.phone || `+593 99 ${Math.floor(200 + Math.random() * 799)} ${suffix}`;
    const defaultText =
      customOptions?.text ||
      'Hola Crea Arte, vi su anuncio de Rótulos 3D & Corpóreos LED (-20% Off). Deseo cotizar un letrero corpóreo retroiluminado de 3.80m x 1.20m en Alucobond con instalación en fachada.';

    try {
      const resp = await fetch('/api/whatsapp/simulate-ad-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: defaultPhone,
          profileName: defaultName,
          text: defaultText,
          headline: defaultHeadline,
          sourceId: `12021998877${suffix}`,
          ctwaClid: `ARZ_CTWA_${suffix}_2026`,
          sourceUrl: 'https://fb.me/ctwa-crea-arte-rotulos-3d',
          sourceType: customOptions?.sourceType || 'ad',
        }),
      });

      if (resp.ok) {
        const data = await resp.json();
        if (data?.eventId) {
          await fetch('/api/whatsapp/webhook/ack', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ eventIds: [data.eventId] }),
          }).catch(() => {});
        }
      }
    } catch {
      // Continúa localmente incluso si está sin conexión
    }

    handleIncomingMetaWebhookOrAdLead({
      phone: defaultPhone,
      profileName: defaultName,
      text: defaultText,
      originType: customOptions?.sourceType === 'leadgen_form' ? 'leadgen_form' : 'ctwa_ad',
      referral: {
        sourceUrl: 'https://fb.me/ctwa-crea-arte-rotulos-3d',
        sourceId: `12021998877${suffix}`,
        sourceType: customOptions?.sourceType || 'ad',
        headline: defaultHeadline,
        body: 'Fabricación e instalación de Rótulos Corpóreos 3D en Acrílico, Alucobond e Iluminación LED Samsung IP68.',
        ctwaClid: `ARZ_CTWA_${suffix}_2026`,
        campaignName: defaultHeadline,
        receivedAt: getNowTimestamp(),
      },
    });
  };

  // Polling ligero cada 6 segundos a /api/whatsapp/webhook/events cuando Meta Cloud API está activo
  useEffect(() => {
    if (activeWaConfig.mode !== 'meta_cloud_api') return;

    let cancelled = false;
    const pollWebhookEvents = async () => {
      try {
        const resp = await fetch('/api/whatsapp/webhook/events');
        if (!resp.ok || cancelled) return;
        const data = await resp.json();
        const pending = Array.isArray(data?.pendingLeads) ? data.pendingLeads : [];
        if (pending.length === 0) return;

        const processedIds: string[] = [];
        pending.forEach((lead: any) => {
          if (lead && lead.id && !lead.processed) {
            handleIncomingMetaWebhookOrAdLead({
              phone: lead.phone,
              profileName: lead.profileName,
              text: lead.text,
              originType: lead.originType,
              referral: lead.referral,
            });
            processedIds.push(String(lead.id));
          }
        });

        if (processedIds.length > 0) {
          await fetch('/api/whatsapp/webhook/ack', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ eventIds: processedIds }),
          });
        }
      } catch {
        // Silencioso en modo local
      }
    };

    const intervalId = window.setInterval(pollWebhookEvents, 6000);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [activeWaConfig.mode, clients, orders, nextOrderCode]);

  const handleConvertOrder = (
    newOrder: WorkOrder,
    initialAdvance: number,
    paymentMethod: 'Efectivo' | 'Transferencia Bancaria' | 'Tarjeta',
    auditDetails?: PaymentAuditDetails
  ) => {
    setOrders((prev) => [newOrder, ...prev]);

    if (initialAdvance > 0) {
      const tx: CashTransaction = {
        id: `tx-${Date.now()}`,
        date: getNowTimestamp(),
        type: 'ingreso_anticipo',
        orderId: newOrder.id,
        concept: `Anticipo Inicial Orden ${newOrder.id} (${newOrder.title})`,
        clientOrProvider: newOrder.clientName,
        method: paymentMethod,
        amount: initialAdvance,
        registeredBy: currentUser.name,
        bankEntity: auditDetails?.bankEntity || paymentMethod,
        referenceNumber: auditDetails?.referenceNumber || 'S/N',
        invoiceOrDocNumber: auditDetails?.invoiceOrDocNumber || 'Pendiente Facturar',
        accountHolderOrNotes:
          auditDetails?.accountHolderOrNotes || `Anticipo inicial orden ${newOrder.id}`,
      };
      setTransactions((prev) => [tx, ...prev]);
    }

    // Regla 1: Mensaje Automático de Bienvenida + Ficha + Datos Bancarios si falta anticipo
    if (activeWaConfig.autoWelcomeOnOrderCreated !== false) {
      const pending = Math.max(
        0,
        Number((newOrder.totalPrice - newOrder.paidAmount).toFixed(2))
      );
      const advance50 = Number((newOrder.totalPrice * 0.5).toFixed(2));
      const welcomeText =
        initialAdvance > 0
          ? `🤖 *ORDEN REGISTRADA ${newOrder.id} — CREA ARTE*\nHola *${newOrder.clientName}*, su orden *${newOrder.title}* ha sido ingresada a nuestro sistema.\n• *Total:* $${newOrder.totalPrice.toFixed(2)}\n• *Anticipo recibido (${auditDetails?.bankEntity || paymentMethod} · Ref: ${auditDetails?.referenceNumber || 'S/N'}):* $${initialAdvance.toFixed(2)}\n• *Saldo pendiente contra entrega:* $${pending.toFixed(2)}\n• *Etapa actual:* ${newOrder.stage}`
          : `🤖 *ORDEN REGISTRADA ${newOrder.id} — SOLICITUD DE ANTICIPO*\nHola *${newOrder.clientName}*, hemos generado su orden *${newOrder.title}* por un total de *$${newOrder.totalPrice.toFixed(2)}*.\n🏦 Para iniciar diseño/producción requerimos el anticipo del 50% (*$${advance50.toFixed(2)}*) a:\n• *Banco Pichincha Cta. Cte.:* #2100492811 (Crea Arte S.A.)\nEnvíenos su comprobante por esta vía.`;

      const welcomeMsg: ChatMessage = {
        id: `msg-${Date.now()}`,
        orderId: newOrder.id,
        sender: 'agent',
        senderName: 'Bot Automático Crea Arte',
        text: welcomeText,
        timestamp: getNowTimestamp(),
        status: 'delivered',
        channel: activeWaConfig.mode === 'meta_cloud_api' ? 'meta_cloud_api' : 'wa_direct',
      };
      setChatMessages((prev) => [...prev, welcomeMsg]);
    }

    appendAuditLog(
      'cotizacion_orden',
      `Nueva Orden de Trabajo (${newOrder.id})`,
      `${currentUser.name} convirtió cotización en la orden ${newOrder.id} para ${newOrder.clientName} por $${newOrder.totalPrice.toFixed(2)} (Anticipo: $${initialAdvance.toFixed(2)}).`,
      newOrder.id
    );

    notify(
      `Orden ${newOrder.id} creada y sincronizada con el CRM WhatsApp${
        initialAdvance > 0 ? ` (Anticipo $${initialAdvance.toFixed(2)})` : ''
      }`
    );
    setActiveModule('kanban');
  };

  const handleSendQuoteToWhatsApp = (
    newOrder: WorkOrder,
    proformaText: string,
    pdfFileName: string
  ) => {
    setOrders((prev) => {
      const exists = prev.some((o) => o.id === newOrder.id);
      return exists ? prev.map((o) => (o.id === newOrder.id ? newOrder : o)) : [newOrder, ...prev];
    });

    const quoteMsg: ChatMessage = {
      id: `msg-${Date.now()}-quote`,
      orderId: newOrder.id,
      sender: 'agent',
      senderName: `${currentUser.name} (Cotizaciones & PDF)`,
      text: `${proformaText}\n\n📄 *Archivo PDF generado y descargado:* \`${pdfFileName}\``,
      timestamp: getNowTimestamp(),
      status: 'delivered',
      channel: activeWaConfig.mode === 'meta_cloud_api' ? 'meta_cloud_api' : 'wa_direct',
    };

    setChatMessages((prev) => [...prev, quoteMsg]);
    setPreselectedWaOrderId(newOrder.id);
    setActiveModule('whatsapp');
    notify(
      `PDF "${pdfFileName}" descargado y Proforma enviada al chat de WhatsApp de ${newOrder.clientName}`
    );
  };

  const handleMoveOrderStage = (orderId: string, targetStage: OrderStage) => {
    const productionStages: OrderStage[] = [
      'En Cola de Impresión/Corte',
      'Acabados y Armado 3D',
      'Instalación / Listo para Retiro',
      'Finalizado y Liquidado',
    ];

    setOrders((prevOrders) =>
      prevOrders.map((order) => {
        if (order.id !== orderId) return order;

        const designOnly = isDesignOnlyOrder(order);
        let shouldDeduct = false;
        if (!designOnly && !order.stockDeducted && productionStages.includes(targetStage)) {
          shouldDeduct = true;
        }

        if (shouldDeduct) {
          const tsNow = getNowTimestamp();
          const todayStr = getTodayDateStr();
          const itemsToDeduct =
            order.lineItems && order.lineItems.length > 0
              ? order.lineItems
              : [
                  {
                    id: `line-${order.id}`,
                    title: order.title,
                    category: order.category,
                    materialId: order.materialId,
                    materialName: order.materialName,
                    dimensionsText: `${order.widthM}x${order.heightM}m`,
                    finishingsText: order.finishings.join(', '),
                    quantity: order.quantity,
                    widthM: order.widthM,
                    heightM: order.heightM,
                    totalAreaM2: order.totalAreaM2,
                    unitPrice: order.totalPrice,
                    lineTotal: order.totalPrice,
                  },
                ];

          const generatedMovements: InventoryMovement[] = [];
          const stockDeductionsByItemId: Record<string, number> = {};

          itemsToDeduct.forEach((lineItem, idx) => {
            if (lineItem.category === 'Diseño Gráfico y Branding') return;
            const catMat =
              CATALOG_MATERIALS.find((m) => m.id === lineItem.materialId) ||
              CATALOG_MATERIALS.find((m) => lineItem.materialName.includes(m.name)) ||
              CATALOG_MATERIALS.find((m) => m.id === order.materialId);
            const invItemId = catMat?.inventoryItemId || 'inv-lona-front';
            const invItem = inventory.find((i) => i.id === invItemId);
            if (!invItem) return;

            const baseAreaOrQty =
              lineItem.totalAreaM2 && lineItem.totalAreaM2 > 0
                ? lineItem.totalAreaM2
                : lineItem.widthM && lineItem.heightM
                ? Number((lineItem.widthM * lineItem.heightM * lineItem.quantity).toFixed(2))
                : lineItem.quantity;

            const areaWithWaste =
              invItem.unit === 'unidad'
                ? lineItem.quantity
                : Number((baseAreaOrQty * (1 + order.wastePercent / 100)).toFixed(2));

            const qtyToDeduct =
              invItem.unit === 'plancha'
                ? Math.max(1, Math.ceil(areaWithWaste / 2.9768))
                : areaWithWaste;

            stockDeductionsByItemId[invItem.id] = Number(
              ((stockDeductionsByItemId[invItem.id] || 0) + qtyToDeduct).toFixed(2)
            );

            generatedMovements.push({
              id: `mov-${Date.now()}-${idx}`,
              itemId: invItem.id,
              itemName: invItem.name,
              type: 'salida_orden',
              quantity: qtyToDeduct,
              unit: invItem.unit,
              orderId: order.id,
              userId: currentUser.id,
              date: tsNow,
              reason: `Descuento automático (${lineItem.title}) al pasar ${order.id} a "${targetStage}" (${baseAreaOrQty} ${invItem.unit === 'unidad' ? 'und' : 'm²'} + ${order.wastePercent}% merma)`,
              costImpact: Number((qtyToDeduct * invItem.unitCost).toFixed(2)),
            });
          });

          if (generatedMovements.length > 0) {
            setInventory((prevInv) =>
              prevInv.map((item) => {
                const deduct = stockDeductionsByItemId[item.id];
                if (!deduct) return item;
                return {
                  ...item,
                  currentStock: Math.max(0, Number((item.currentStock - deduct).toFixed(2))),
                  lastUpdated: todayStr,
                };
              })
            );
            setMovements((prevMov) => [...generatedMovements, ...prevMov]);
            notify(
              `Orden ${order.id} en "${targetStage}". Se descontaron insumos de ${generatedMovements.length} ítem(s) en Kardex.`
            );
          } else {
            notify(`Orden ${order.id} actualizada a etapa: ${targetStage}`);
          }
        } else {
          notify(`Orden ${order.id} actualizada a etapa: ${targetStage}`);
        }

        const channelUsed =
          activeWaConfig.mode === 'meta_cloud_api' ? 'meta_cloud_api' : 'wa_direct';
        const tsStage = getNowTimestamp();

        // Regla 2: Envío automático de aviso de inicio de diseño o solicitud de aprobación de arte
        if (targetStage === 'En Diseño y Arte') {
          const designMsg: ChatMessage = {
            id: `msg-${Date.now() + 1}-des`,
            orderId: order.id,
            sender: 'agent',
            senderName: 'Bot Automático Crea Arte',
            text: `🎨 *INICIO DE DISEÑO Y PRE-PRENSA (${order.id})*\nHola *${order.clientName}*, nuestro equipo de Diseño ya está preparando el arte y montaje de *${order.title}*. En breve le compartiremos la vista previa para su revisión.`,
            timestamp: tsStage,
            status: 'delivered',
            channel: channelUsed,
          };
          setChatMessages((prev) => [...prev, designMsg]);
        }

        if (
          activeWaConfig.autoSendArtApproval !== false &&
          targetStage === 'Aprobación del Cliente'
        ) {
          const artMsg: ChatMessage = {
            id: `msg-${Date.now() + 1}`,
            orderId: order.id,
            sender: 'agent',
            senderName: 'Bot Automático Crea Arte',
            text: `🎨 *AVISO AUTOMÁTICO — ARTE LISTO PARA REVISIÓN (${order.id})*\nEstimado/a *${order.clientName}*, el diseño de *${order.title}* (${order.widthM}m × ${order.heightM}m) está listo.\n📎 Archivo: ${order.artworkUrl || 'Adjunto en ficha técnica'}\n👉 *Responda con la palabra "APROBADO"* en este chat para que nuestro sistema autorice e inicie automáticamente la impresión/corte.`,
            timestamp: tsStage,
            status: 'delivered',
            channel: channelUsed,
          };
          setChatMessages((prev) => [...prev, artMsg]);
        }

        // Regla 4: Aviso automático de entrada a máquinas / taller 3D
        if (
          activeWaConfig.autoNotifyProductionStart !== false &&
          (targetStage === 'En Cola de Impresión/Corte' ||
            targetStage === 'Acabados y Armado 3D')
        ) {
          const prodMsg: ChatMessage = {
            id: `msg-${Date.now() + 1}`,
            orderId: order.id,
            sender: 'agent',
            senderName: 'Bot Automático Crea Arte',
            text: `⚙️ *AVISO AUTOMÁTICO DE PLANTA (${order.id}):* Su proyecto *${order.title}* ha ingresado a la etapa *"${targetStage}"*. Fecha programada de entrega: *${order.deadline.replace('T', ' ')}*.`,
            timestamp: tsStage,
            status: 'delivered',
            channel: channelUsed,
          };
          setChatMessages((prev) => [...prev, prodMsg]);
        }

        // Regla 5: Aviso automático de Pedido Listo para Retiro / Instalación
        if (
          activeWaConfig.autoSendStageNotifications &&
          targetStage === 'Instalación / Listo para Retiro'
        ) {
          const pending = Math.max(
            0,
            Number((order.totalPrice - order.paidAmount).toFixed(2))
          );
          const autoMsg: ChatMessage = {
            id: `msg-${Date.now() + 1}`,
            orderId: order.id,
            sender: 'agent',
            senderName: 'Bot Automático Crea Arte',
            text: `✅ *PEDIDO TERMINADO EN TALLER (${order.id}):* Estimado/a *${order.clientName}*, su trabajo *${order.title}* está en etapa *"Instalación / Listo para Retiro"*. Saldo pendiente a liquidar: *$${pending.toFixed(2)}*.`,
            timestamp: tsStage,
            status: 'delivered',
            channel: channelUsed,
          };
          setChatMessages((prev) => [...prev, autoMsg]);
        }

        // Regla 6: Aviso automático de Orden Finalizada y Certificado de Garantía QR
        if (targetStage === 'Finalizado y Liquidado') {
          const doneMsg: ChatMessage = {
            id: `msg-${Date.now() + 1}-done`,
            orderId: order.id,
            sender: 'agent',
            senderName: 'Bot Automático Crea Arte',
            text: `🏁 *ORDEN ENTREGADA Y CERTIFICADO DE GARANTÍA QR (${order.id}):*\n¡Muchas gracias *${order.clientName}* por confiar en *Crea Arte Publicidad*! Su proyecto *${order.title}* ha sido entregado y liquidado al 100%.\n🛡️ Su Certificado de Garantía Técnica con Código QR de verificación está activo.`,
            timestamp: tsStage,
            status: 'delivered',
            channel: channelUsed,
          };
          setChatMessages((prev) => [...prev, doneMsg]);
        }

        // Si el modo Meta Cloud API está activo, despachar de forma segura por el proxy del servidor
        if (activeWaConfig.mode === 'meta_cloud_api' && order.clientPhone) {
          fetch('/api/whatsapp/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to: order.clientPhone,
              text: `[Crea Arte ERP] Orden ${order.id} (${order.title}) avanzó a etapa: ${targetStage}`,
              orderId: order.id,
              phoneNumberId: activeWaConfig.phoneNumberId,
              accessToken: activeWaConfig.accessToken,
            }),
          }).catch(() => {
            // Silencioso en caso de modo offline
          });
        }

        appendAuditLog(
          'etapa_produccion',
          `Cambio de Etapa → ${targetStage}`,
          `${currentUser.name} (${currentUser.roleLabel}) movió la orden ${order.id} (${order.clientName}) de "${order.stage}" a "${targetStage}".`,
          order.id
        );

        return {
          ...order,
          stage: targetStage,
          stockDeducted: order.stockDeducted || shouldDeduct,
        };
      })
    );
  };

  const appendAuditLog = (
    category: AuditActionCategory,
    actionTitle: string,
    details: string,
    orderId?: string,
    targetEmployeeName?: string
  ) => {
    const newEntry: SystemAuditLogEntry = {
      id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: getLiveSimulationDateTimeStr(),
      actorUserId: currentUser.id,
      actorName: currentUser.name,
      actorRoleLabel: currentUser.roleLabel,
      category,
      orderId,
      targetEmployeeName,
      actionTitle,
      details,
    };
    setAuditLogs((prev) => [newEntry, ...prev]);
  };

  const handleUpdateOrder = (updated: WorkOrder) => {
    const prevOrder = orders.find((o) => o.id === updated.id);
    if (prevOrder) {
      const prevTeam = getOrderTeamAssignments(prevOrder);
      const nextTeam = getOrderTeamAssignments(updated);

      // Detectar bajas, reactivaciones o nuevas altas de empleados en el proyecto
      nextTeam.forEach((nextMember) => {
        const prevMember = prevTeam.find((p) => p.userId === nextMember.userId);
        const empName =
          users.find((u) => u.id === nextMember.userId)?.name || nextMember.userId;

        if (!prevMember) {
          appendAuditLog(
            'alta_baja_proyecto',
            `Alta en Proyecto (${nextMember.taskRole})`,
            `${currentUser.name} (${currentUser.roleLabel}) asignó a ${empName} al proyecto ${updated.id} (${updated.clientName}) con la función "${nextMember.taskRole}".`,
            updated.id,
            empName
          );
        } else if (prevMember.status === 'active' && nextMember.status === 'completed') {
          appendAuditLog(
            'alta_baja_proyecto',
            `Baja de Proyecto (${nextMember.taskRole})`,
            `${currentUser.name} (${currentUser.roleLabel}) dio de baja a ${empName} del proyecto ${updated.id} (${updated.clientName}). Nota: "${
              nextMember.closingNote || 'Trabajo finalizado'
            }".`,
            updated.id,
            empName
          );
        } else if (prevMember.status === 'completed' && nextMember.status === 'active') {
          appendAuditLog(
            'alta_baja_proyecto',
            `Reactivación en Proyecto (${nextMember.taskRole})`,
            `${currentUser.name} (${currentUser.roleLabel}) reactivó a ${empName} dentro del proyecto ${updated.id} (${updated.clientName}).`,
            updated.id,
            empName
          );
        }
      });
    }

    setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
  };

  const handleRegisterOrderPayment = (
    orderId: string,
    amount: number,
    method: 'Efectivo' | 'Transferencia Bancaria' | 'Tarjeta',
    auditDetails?: PaymentAuditDetails
  ) => {
    const targetOrder = orders.find((o) => o.id === orderId);
    if (!targetOrder || amount <= 0) return;

    const pending = Math.max(
      0,
      Number((targetOrder.totalPrice - targetOrder.paidAmount).toFixed(2))
    );
    const actualPaid = Math.min(pending > 0 ? pending : amount, amount);
    const newPaidTotal = Number((targetOrder.paidAmount + actualPaid).toFixed(2));
    const newRemaining = Math.max(
      0,
      Number((targetOrder.totalPrice - newPaidTotal).toFixed(2))
    );
    const isFullSettlement = newPaidTotal >= targetOrder.totalPrice;

    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, paidAmount: newPaidTotal } : o))
    );

    const bankLabel = auditDetails?.bankEntity || method;
    const refLabel = auditDetails?.referenceNumber || `REC-${Date.now().toString().slice(-5)}`;
    const docLabel = auditDetails?.invoiceOrDocNumber || 'Pendiente Facturar';
    const tsPay = getNowTimestamp();

    const newTx: CashTransaction = {
      id: `tx-${Date.now()}`,
      date: tsPay,
      type: isFullSettlement ? 'ingreso_liquidacion' : 'ingreso_anticipo',
      orderId,
      concept: `${isFullSettlement ? 'Liquidación Total' : 'Abono Parcial'} Orden ${orderId}`,
      clientOrProvider: targetOrder.clientName,
      method,
      amount: actualPaid,
      registeredBy: currentUser.name,
      bankEntity: bankLabel,
      referenceNumber: refLabel,
      invoiceOrDocNumber: docLabel,
      accountHolderOrNotes:
        auditDetails?.accountHolderOrNotes || `Cobro registrado por ${currentUser.name}`,
    };

    setTransactions((prev) => [newTx, ...prev]);

    // Regla 6: Recibo Digital Automático por WhatsApp al registrar cobro con Banco y Comprobante
    if (activeWaConfig.autoReceiptOnPayment !== false) {
      const receiptMsg: ChatMessage = {
        id: `msg-${Date.now() + 1}`,
        orderId,
        sender: 'agent',
        senderName: 'Bot Caja & Cobranzas',
        text: `🧾 *RECIBO DE PAGO AUTOMÁTICO (${orderId})*\nEstimado/a *${targetOrder.clientName}*, confirmamos el registro de su pago:\n• *Monto recibido:* $${actualPaid.toFixed(2)} (${method})\n• *Banco / Caja:* ${bankLabel}\n• *N° Comprobante / Ref:* ${refLabel} | *Doc:* ${docLabel}\n• *Total abonado a la fecha:* $${newPaidTotal.toFixed(2)} de $${targetOrder.totalPrice.toFixed(2)}\n• *Nuevo saldo pendiente:* *$${newRemaining.toFixed(2)}* ${
          isFullSettlement
            ? '✅ *(ORDEN 100% LIQUIDADA Y LIBERADA PARA ENTREGA)*'
            : ''
        }`,
        timestamp: tsPay,
        status: 'delivered',
        channel: activeWaConfig.mode === 'meta_cloud_api' ? 'meta_cloud_api' : 'wa_direct',
      };
      setChatMessages((prev) => [...prev, receiptMsg]);
    }

    appendAuditLog(
      'cobros_finanzas',
      `${isFullSettlement ? 'Liquidación Total' : 'Abono Parcial'} ($${actualPaid.toFixed(2)})`,
      `${currentUser.name} registró cobro de $${actualPaid.toFixed(2)} (${bankLabel} · Ref: ${refLabel}) en la orden ${orderId} (${targetOrder.clientName}). Saldo restante: $${newRemaining.toFixed(2)}.`,
      orderId
    );

    notify(
      `Cobro de $${actualPaid.toFixed(2)} (${bankLabel} · Ref: ${refLabel}) registrado en Orden ${orderId}.`
    );
  };

  const handleRegisterPettyCashExpense = (
    concept: string,
    provider: string,
    amount: number,
    method: 'Efectivo' | 'Transferencia Bancaria' | 'Tarjeta',
    orderId?: string,
    auditDetails?: PaymentAuditDetails
  ) => {
    if (!concept.trim() || amount <= 0) return;
    const newTx: CashTransaction = {
      id: `tx-${Date.now()}`,
      date: getNowTimestamp(),
      type: 'gasto_chica',
      orderId,
      concept: orderId ? `${concept} (${orderId})` : concept,
      clientOrProvider: provider || 'Proveedor General',
      method,
      amount,
      registeredBy: currentUser.name,
      bankEntity: auditDetails?.bankEntity || 'Caja Fuerte / Efectivo Ventanilla',
      referenceNumber: auditDetails?.referenceNumber || 'VALE-S/N',
      invoiceOrDocNumber: auditDetails?.invoiceOrDocNumber || 'Recibo Simple',
      accountHolderOrNotes: auditDetails?.accountHolderOrNotes || 'Egreso menor de taller',
    };
    setTransactions((prev) => [newTx, ...prev]);
    appendAuditLog(
      'cobros_finanzas',
      `Egreso Caja Chica (-$${amount.toFixed(2)})`,
      `${currentUser.name} registró salida por $${amount.toFixed(2)} a ${provider || 'Proveedor General'} (${concept}). Doc: ${newTx.invoiceOrDocNumber}.`,
      orderId
    );
    notify(
      `Salida de caja chica por $${amount.toFixed(2)} (${newTx.invoiceOrDocNumber}) registrada`
    );
  };

  const handleStartTimerForOrder = (
    orderId: string,
    phase: 'design' | 'machine' | 'installation'
  ) => {
    setActiveTimerOrderId(orderId);
    setActiveTimerPhase(phase);
    setActiveTimerEmployeeId(currentUser.id);
    setIsTimerRunning(true);
    setActiveModule('timetracking');
    notify(`Cronómetro iniciado para ${orderId} (${phase})`);
  };

  const handleStopAndSaveTimer = (note: string) => {
    const minutesLogged = Math.max(1, Math.round(timerSeconds / 60));
    const entry: TimeLogEntry = {
      id: `tl-${Date.now()}`,
      orderId: activeTimerOrderId,
      employeeId: activeTimerEmployeeId,
      phase: activeTimerPhase,
      minutes: minutesLogged,
      date: getTodayDateStr(),
      note: note || 'Sesión de cronómetro en vivo',
    };
    setTimeLogs((prev) => [entry, ...prev]);
    setIsTimerRunning(false);
    setTimerSeconds(0);
    notify(
      `Se registraron ${minutesLogged} min (${formatSecondsToHMS(
        timerSeconds
      )}) en la orden ${activeTimerOrderId}`
    );
  };

  const handleAddManualTimeLog = (entry: Omit<TimeLogEntry, 'id'>) => {
    setTimeLogs((prev) => [{ ...entry, id: `tl-${Date.now()}` }, ...prev]);
    notify(`Registrados ${entry.minutes} minutos en orden ${entry.orderId}`);
  };

  const handleAddStockEntry = (
    itemId: string,
    qty: number,
    newUnitCost: number,
    supplierNote: string
  ) => {
    const target = inventory.find((i) => i.id === itemId);
    if (!target || qty <= 0) return;

    setInventory((prev) =>
      prev.map((i) =>
        i.id === itemId
          ? {
              ...i,
              currentStock: Number((i.currentStock + qty).toFixed(2)),
              unitCost: newUnitCost,
              lastUpdated: getTodayDateStr(),
            }
          : i
      )
    );

    const mov: InventoryMovement = {
      id: `mov-${Date.now()}`,
      itemId,
      itemName: target.name,
      type: 'entrada',
      quantity: qty,
      unit: target.unit,
      userId: currentUser.id,
      date: getNowTimestamp(),
      reason: `Ingreso de compra (${supplierNote})`,
      costImpact: Number((qty * newUnitCost).toFixed(2)),
    };
    setMovements((prev) => [mov, ...prev]);
    notify(`Ingresados +${qty} ${target.unit} a ${target.name}`);
  };

  const handleCommitParsedInvoice = (
    invoice: ParsedSupplierInvoice,
    recordPaymentInFinance: boolean
  ) => {
    const selectedLines = invoice.items.filter((i) => i.selected && i.warehouseQty > 0);
    if (selectedLines.length === 0) return;

    const newMovements: InventoryMovement[] = [];
    const createdInventoryItems: InventoryItem[] = [];
    const tsCommit = getNowTimestamp();
    const todayCommit = getTodayDateStr();

    setInventory((prevInventory) => {
      const updated = prevInventory.map((invItem) => {
        const matchingLines = selectedLines.filter(
          (line) => line.matchedInventoryId === invItem.id
        );
        if (matchingLines.length === 0) return invItem;

        const totalAddedQty = matchingLines.reduce((acc, l) => acc + l.warehouseQty, 0);
        const latestUnitCost = matchingLines[matchingLines.length - 1].warehouseUnitCost;

        matchingLines.forEach((line, idx) => {
          newMovements.push({
            id: `mov-pdf-${Date.now()}-${idx}-${invItem.id}`,
            itemId: invItem.id,
            itemName: invItem.name,
            type: 'entrada',
            quantity: line.warehouseQty,
            unit: invItem.unit,
            userId: currentUser.id,
            date: tsCommit,
            reason: `Factura PDF ${invoice.invoiceNumber} (${invoice.supplierName}): ${line.purchaseQty} ${line.purchaseUnit} × ${line.conversionFactor} = +${line.warehouseQty} ${invItem.unit}`,
            costImpact: line.lineSubtotal,
          });
        });

        return {
          ...invItem,
          currentStock: Number((invItem.currentStock + totalAddedQty).toFixed(2)),
          unitCost: latestUnitCost > 0 ? latestUnitCost : invItem.unitCost,
          supplier: invoice.supplierName || invItem.supplier,
          lastUpdated: invoice.issueDate || todayCommit,
        };
      });

      // Procesar líneas marcadas como NEW_ITEM (Crear nuevo insumo en el catálogo)
      selectedLines
        .filter((line) => line.matchedInventoryId === 'NEW_ITEM')
        .forEach((line, idx) => {
          const newId = `inv-custom-${Date.now()}-${idx}`;
          const newItem: InventoryItem = {
            id: newId,
            sku: line.suggestedSku || `SKU-${Date.now().toString().slice(-4)}`,
            name: line.suggestedName || line.rawDescription,
            category: line.suggestedCategory,
            unit: line.warehouseUnit === 'm_lineal' ? 'ml' : line.warehouseUnit,
            rollWidthM: line.suggestedCategory === 'Bobinas y Rollos' ? 1.52 : undefined,
            rollLengthM: line.suggestedCategory === 'Bobinas y Rollos' ? 50 : undefined,
            sheetDimensions:
              line.suggestedCategory === 'Planchas Rígidas' ? '1.22m x 2.44m' : undefined,
            currentStock: line.warehouseQty,
            minStock: line.warehouseUnit === 'm2' ? 20 : 5,
            unitCost: line.warehouseUnitCost,
            supplier: invoice.supplierName || 'Proveedor Factura PDF',
            lastUpdated: invoice.issueDate || todayCommit,
          };
          createdInventoryItems.push(newItem);

          newMovements.push({
            id: `mov-pdf-new-${Date.now()}-${idx}`,
            itemId: newId,
            itemName: newItem.name,
            type: 'entrada',
            quantity: line.warehouseQty,
            unit: line.warehouseUnit,
            userId: currentUser.id,
            date: tsCommit,
            reason: `Alta de Nuevo Material por Factura PDF ${invoice.invoiceNumber} (${invoice.supplierName}): +${line.warehouseQty} ${line.warehouseUnit}`,
            costImpact: line.lineSubtotal,
          });
        });

      return [...createdInventoryItems, ...updated];
    });

    setMovements((prev) => [...newMovements, ...prev]);

    // Registrar en el historial de facturas PDF procesadas
    const finalizedInvoice: ParsedSupplierInvoice = {
      ...invoice,
      id: `proc-inv-${Date.now()}`,
      processedAt: tsCommit,
    };
    setProcessedInvoices((prev) => [finalizedInvoice, ...prev]);

    // Si el usuario marcó registrar también el pago/egreso en Caja y Bancos
    if (recordPaymentInFinance) {
      const expenseTx: CashTransaction = {
        id: `tx-pdf-${Date.now()}`,
        date: tsCommit,
        type: 'gasto_chica',
        concept: `Compra de Materiales s/Factura PDF ${invoice.invoiceNumber} (${selectedLines.length} ítems)`,
        clientOrProvider: `${invoice.supplierName} (RUC: ${invoice.supplierRuc})`,
        method: invoice.paymentMethod,
        amount: invoice.totalAmount,
        registeredBy: currentUser.name,
        bankEntity: invoice.bankEntity,
        referenceNumber: invoice.referenceNumber,
        invoiceOrDocNumber: invoice.invoiceNumber,
        accountHolderOrNotes: `Importación automática desde archivo ${invoice.fileName}`,
      };
      setTransactions((prev) => [expenseTx, ...prev]);
    }

    notify(
      `Factura PDF ${invoice.invoiceNumber} procesada: ${selectedLines.length} materiales transformados e ingresados a bodega${
        recordPaymentInFinance ? ` y pago ($${invoice.totalAmount.toFixed(2)}) registrado en Caja` : ''
      }.`
    );
  };

  const handleReportWaste = (
    itemId: string,
    qty: number,
    orderId: string,
    reason: string
  ) => {
    const target = inventory.find((i) => i.id === itemId);
    if (!target || qty <= 0) return;

    setInventory((prev) =>
      prev.map((i) =>
        i.id === itemId
          ? {
              ...i,
              currentStock: Math.max(0, Number((i.currentStock - qty).toFixed(2))),
              lastUpdated: getTodayDateStr(),
            }
          : i
      )
    );

    const mov: InventoryMovement = {
      id: `mov-${Date.now()}`,
      itemId,
      itemName: target.name,
      type: 'merma_taller',
      quantity: qty,
      unit: target.unit,
      orderId,
      userId: currentUser.id,
      date: getNowTimestamp(),
      reason: reason || 'Merma operativa reportada en taller',
      costImpact: Number((qty * target.unitCost).toFixed(2)),
    };
    setMovements((prev) => [mov, ...prev]);
    notify(`Merma de ${qty} ${target.unit} descontada de ${target.name}`);
  };

  const handleCreateRestockRequest = (
    itemId: string,
    qty: number,
    urgency: 'Normal' | 'Alta' | 'Crítica'
  ) => {
    const target = inventory.find((i) => i.id === itemId);
    if (!target || qty <= 0) return;

    const req: RestockRequest = {
      id: `req-${Date.now()}`,
      itemId,
      itemName: target.name,
      requestedQty: qty,
      unit: target.unit,
      requestedBy: `${currentUser.name} (${currentUser.roleLabel.split('/')[0].trim()})`,
      date: getNowTimestamp(),
      urgency,
      status: 'Pendiente',
    };
    setRestockRequests((prev) => [req, ...prev]);
    notify(`Solicitud de reposición enviada para ${target.name}`);
  };

  const handleApproveRestockRequest = (requestId: string) => {
    const req = restockRequests.find((r) => r.id === requestId);
    if (!req || req.status !== 'Pendiente') return;

    setRestockRequests((prev) =>
      prev.map((r) => (r.id === requestId ? { ...r, status: 'Aprobada / Comprada' } : r))
    );

    const target = inventory.find((i) => i.id === req.itemId);
    if (target) {
      handleAddStockEntry(
        target.id,
        req.requestedQty,
        target.unitCost,
        `Reposición aprobada (${req.id})`
      );
    }
  };

  const handleAddMaintenanceLog = (
    machineId: string,
    taskType: MachineMaintenanceLog['taskType'],
    cost: number,
    notes: string
  ) => {
    const todayMaint = getTodayDateStr();
    const newLog: MachineMaintenanceLog = {
      id: `mlog-${Date.now()}`,
      machineId,
      date: todayMaint,
      taskType,
      technician: currentUser.name,
      cost,
      notes: notes || `Mantenimiento ejecutado: ${taskType}`,
    };
    setMaintenanceLogs((prev) => [newLog, ...prev]);
    setMachines((prev) =>
      prev.map((m) =>
        m.id === machineId
          ? { ...m, lastMaintenanceDate: todayMaint, status: 'Operativo' }
          : m
      )
    );
    notify(`Mantenimiento "${taskType}" registrado y contador reiniciado a 0 días.`);
  };

  const handleResetDemoData = () => {
    setUsers(INITIAL_USERS);
    setCurrentUserId(INITIAL_USERS[0].id);
    setOrders(INITIAL_ORDERS);
    setInventory(INITIAL_INVENTORY);
    setMovements(INITIAL_INVENTORY_MOVEMENTS);
    setRestockRequests(INITIAL_RESTOCK_REQUESTS);
    setTimeLogs(INITIAL_TIME_LOGS);
    setTransactions(INITIAL_CASH_TRANSACTIONS);
    setMachines(INITIAL_MACHINES);
    setMaintenanceLogs(INITIAL_MAINTENANCE_LOGS);
    setChatMessages(INITIAL_CHAT_MESSAGES);
    setWaConfig([INITIAL_WA_CONFIG]);
    setClients(INITIAL_CLIENTS);
    setProcessedInvoices(INITIAL_PROCESSED_INVOICES);
    setCrmTasks(INITIAL_CRM_TASKS);
    setCrmNotifications(INITIAL_CRM_NOTIFICATIONS);
    safeSaveToStorage('crea_arte_custom_catalog_v1', CATALOG_MATERIALS);
    window.dispatchEvent(new Event('crea_arte_catalog_updated'));
    notify('Datos de demostración iniciales restaurados al 100%');
  };

  // MEJORA 5: Migración no destructiva de localStorage (agrega nuevos rubros/insumos/campos sin borrar órdenes ni clientes creados)
  const handleMigrateAndSyncData = () => {
    try {
      // 1. Fusionar materiales nuevos del catálogo (Láser/CNC y Sublimación) conservando precios editados
      let currentCatalog = CATALOG_MATERIALS;
      try {
        const rawCat = localStorage.getItem('crea_arte_custom_catalog_v1');
        if (rawCat) {
          const parsedCat = JSON.parse(rawCat);
          if (Array.isArray(parsedCat)) {
            const existingIds = new Set(parsedCat.map((c: any) => c.id));
            const missingMats = CATALOG_MATERIALS.filter((m) => !existingIds.has(m.id));
            currentCatalog = [...parsedCat, ...missingMats];
          }
        }
      } catch {
        currentCatalog = CATALOG_MATERIALS;
      }
      safeSaveToStorage('crea_arte_custom_catalog_v1', currentCatalog);
      window.dispatchEvent(new Event('crea_arte_catalog_updated'));

      // 2. Fusionar nuevos insumos de Blancos y Merchandising en inventario sin perder stock actual
      setInventory((prevInv) => {
        const existingInvIds = new Set(prevInv.map((i) => i.id));
        const missingInv = INITIAL_INVENTORY.filter((i) => !existingInvIds.has(i.id));
        return missingInv.length > 0 ? [...prevInv, ...missingInv] : prevInv;
      });

      // 3. Asegurar campos nuevos en órdenes existentes (installationChecklist, assignedCrmAgentId, etc.) sin perder ninguna orden
      setOrders((prevOrders) =>
        prevOrders.map((o) => ({
          ...o,
          assignedCrmAgentId: o.assignedCrmAgentId || 'usr-sales',
          unreadClientReplies: o.unreadClientReplies ?? 0,
          installationChecklist: o.installationChecklist || {
            electricalPointVerified: false,
            ladderOrScaffoldingReady: false,
            locationConfirmed: false,
          },
        }))
      );

      // 4. Asegurar tareas y notificaciones CRM iniciales si estaban vacías
      setCrmTasks((prev) => (prev.length > 0 ? prev : INITIAL_CRM_TASKS));
      setCrmNotifications((prev) =>
        prev.length > 0 ? prev : INITIAL_CRM_NOTIFICATIONS
      );

      notify(
        '🔄 Datos migrados y actualizados con éxito (CRM Multi-Agente, Tareas, Rubros Láser/Sublimación e Inventario sincronizados).'
      );
    } catch (err) {
      console.warn('Error en migración de datos:', err);
      notify('⚠️ Se verificó el almacenamiento local con respaldo seguro.');
    }
  };

  const handleClearDemoOrdersForProduction = () => {
    setOrders([]);
    setTransactions([]);
    setTimeLogs([]);
    setChatMessages([]);
    setRestockRequests([]);
    setActiveModule('quoter');
    notify(
      '✓ Tablero limpio y listo para Producción Real desde la orden #CA-001 (Empleados, Precios y Bodega conservados).'
    );
  };

  const [showRoleGuideModal, setShowRoleGuideModal] = useState<boolean>(false);
  const [showGoLiveModal, setShowGoLiveModal] = useState<boolean>(false);
  const [showSecondaryModules, setShowSecondaryModules] = useState<boolean>(false);
  const [showToolsMenu, setShowToolsMenu] = useState<boolean>(false);
  const [firebaseUserEmail, setFirebaseUserEmail] = useState<string | null>(null);
  const [cloudSyncStatus, setCloudSyncStatus] = useState<'online' | 'offline_cache'>('offline_cache');
  const backupInputRef = React.useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const unsubAuth = subscribeToFirebaseAuth((user) => {
      setFirebaseUserEmail(user?.email || user?.displayName || null);
    });
    const unsubCloud = subscribeToErpCloudWorkspace(
      (remote) => {
        if (remote.orders && Array.isArray(remote.orders) && remote.orders.length > 0) {
          setOrders(remote.orders);
        }
        if (remote.inventory && Array.isArray(remote.inventory) && remote.inventory.length > 0) {
          setInventory(remote.inventory);
        }
        if (remote.transactions && Array.isArray(remote.transactions)) {
          setTransactions(remote.transactions);
        }
        if (remote.clients && Array.isArray(remote.clients)) {
          setClients(remote.clients);
        }
      },
      (status) => setCloudSyncStatus(status)
    );
    return () => {
      unsubAuth();
      unsubCloud();
    };
  }, []);

  const handleFirebaseSignInToggle = async () => {
    if (firebaseUserEmail) {
      await signOutFromFirebase();
      setFirebaseUserEmail(null);
      notify('Sesión Firebase cerrada. Operando en modo LocalStorage Offline-First.');
      return;
    }
    try {
      const user = await signInWithFirebaseGoogle();
      if (user) {
        setFirebaseUserEmail(user.email || user.displayName || 'Usuario Autenticado');
        await pushErpSnapshotToCloud({
          orders,
          inventory,
          movements,
          transactions,
          clients,
        });
        notify(`Sesión iniciada con Firebase Auth: ${user.email || user.displayName}`);
      }
    } catch (err: any) {
      notify(`Aviso Auth: ${err?.message || 'Inicie sesión con Google para sincronizar'}`);
    }
  };

  const handleExportFullBackupJson = () => {
    let customCat = CATALOG_MATERIALS;
    try {
      const raw = localStorage.getItem('crea_arte_custom_catalog_v1');
      if (raw) customCat = JSON.parse(raw);
    } catch {
      customCat = CATALOG_MATERIALS;
    }
    const payload: ErpFullDatabaseBackup = {
      schemaVersion: 'crea_arte_erp_v2',
      exportedAt: new Date().toISOString(),
      orders,
      inventory,
      movements,
      restockRequests,
      timeLogs,
      transactions,
      machines,
      maintenanceLogs,
      chatMessages,
      waConfig,
      clients,
      processedInvoices,
      crmTasks,
      crmNotifications,
      users,
      customCatalog: customCat,
    };
    downloadFullDatabaseBackupJson(payload);
    notify('💾 Base de datos completa exportada en formato .JSON con éxito.');
  };

  const handleImportBackupJsonFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as Partial<ErpFullDatabaseBackup>;
      if (!parsed || typeof parsed !== 'object') {
        notify('⚠️ Archivo JSON inválido.');
        return;
      }
      if (Array.isArray(parsed.orders)) setOrders(parsed.orders);
      if (Array.isArray(parsed.inventory)) setInventory(parsed.inventory);
      if (Array.isArray(parsed.movements)) setMovements(parsed.movements);
      if (Array.isArray(parsed.restockRequests)) setRestockRequests(parsed.restockRequests);
      if (Array.isArray(parsed.timeLogs)) setTimeLogs(parsed.timeLogs);
      if (Array.isArray(parsed.transactions)) setTransactions(parsed.transactions);
      if (Array.isArray(parsed.machines)) setMachines(parsed.machines);
      if (Array.isArray(parsed.maintenanceLogs)) setMaintenanceLogs(parsed.maintenanceLogs);
      if (Array.isArray(parsed.chatMessages)) setChatMessages(parsed.chatMessages);
      if (Array.isArray(parsed.waConfig)) setWaConfig(parsed.waConfig);
      if (Array.isArray(parsed.clients)) setClients(parsed.clients);
      if (Array.isArray(parsed.processedInvoices)) setProcessedInvoices(parsed.processedInvoices);
      if (Array.isArray(parsed.crmTasks)) setCrmTasks(parsed.crmTasks);
      if (Array.isArray(parsed.crmNotifications)) setCrmNotifications(parsed.crmNotifications);
      if (Array.isArray(parsed.users) && parsed.users.length > 0) setUsers(parsed.users);
      if (Array.isArray(parsed.customCatalog)) {
        safeSaveToStorage('crea_arte_custom_catalog_v1', parsed.customCatalog);
        window.dispatchEvent(new Event('crea_arte_catalog_updated'));
      }
      notify(`📂 Respaldo "${file.name}" importado y restaurado correctamente.`);
    } catch (err: any) {
      notify(`⚠️ No se pudo importar el respaldo JSON: ${err?.message || 'Formato inválido'}`);
    }
  };

  const activeModuleDef = MODULES.find((m) => m.id === activeModule) || MODULES[0];

  // Módulos principales del día a día vs herramientas secundarias/bodega
  const primaryModuleIds: ModuleId[] = [
    'dashboard',
    'ai_agents',
    'quoter',
    'kanban',
    'clients',
    'whatsapp',
    'finance',
  ];

  const primaryModules = useMemo(
    () => allowedModules.filter((m) => primaryModuleIds.includes(m.id)),
    [allowedModules]
  );

  const secondaryModules = useMemo(
    () => allowedModules.filter((m) => !primaryModuleIds.includes(m.id)),
    [allowedModules]
  );

  const handleQuickSwitchRole = (targetRole: RoleId) => {
    const foundUser = users.find((u) => u.role === targetRole);
    if (foundUser) {
      setCurrentUserId(foundUser.id);
      setActiveTimerEmployeeId(foundUser.id);
      if (targetRole === 'admin') setActiveModule('dashboard');
      else if (targetRole === 'sales') setActiveModule('quoter');
      else setActiveModule('kanban');
      notify(`Vista activa: ${foundUser.name} (${foundUser.roleLabel.split('/')[0].trim()})`);
    }
  };

  const handleSmartNavigateModule = (targetMod: ModuleId) => {
    const modDef = MODULES.find((m) => m.id === targetMod);
    if (!modDef) return;
    if (!modDef.allowedRoles.includes(currentRole)) {
      const targetRole = modDef.allowedRoles[0];
      const fallbackUser = users.find((u) => u.role === targetRole);
      if (fallbackUser) {
        setCurrentUserId(fallbackUser.id);
        setActiveTimerEmployeeId(fallbackUser.id);
        notify(
          `Perfil cambiado a ${fallbackUser.name} (${fallbackUser.roleLabel.split('/')[0].trim()}) para acceder a ${modDef.shortLabel}`
        );
      }
    }
    setActiveModule(targetMod);
  };

  return (
    <div className={darkMode ? 'dark' : ''}>
      <div className="min-h-screen bg-[#f4f6f8] dark:bg-[#0b0e14] text-slate-900 dark:text-slate-100 flex selection:bg-indigo-500/20 selection:text-indigo-700 dark:selection:text-indigo-300">
        {/* OVERLAY BACKDROP PARA CERRAR MENÚ LATERAL EN MÓVIL Y TABLET */}
        {mobileMenuOpen && (
          <div
            className="fixed inset-0 z-30 bg-slate-950/65 backdrop-blur-xs lg:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

        {/* SIDEBAR SAAS MODERNO: Operación Diaria + Bodega y Herramientas */}
        <aside
          className={`fixed inset-y-0 left-0 z-40 bg-[#0d1117] text-slate-300 border-r border-[#1c2433] flex flex-col justify-between transition-all duration-200 shadow-xl lg:translate-x-0 lg:static lg:shrink-0 w-72 max-w-[85vw] ${
            mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
          } ${sidebarCollapsed ? 'lg:w-20' : 'lg:w-64 xl:w-72'}`}
        >
          <div className="p-4 space-y-5 overflow-y-auto flex-1 min-h-0">
            {/* Marca Corporativa y Botón de Colapsar Sidebar */}
            <div className="flex items-center justify-between border-b border-[#1a2230] pb-4">
              {!sidebarCollapsed && (
                <div className="min-w-0 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#161d2a] border border-[#263145] flex items-center justify-center text-slate-100 font-display font-extrabold text-sm shrink-0">
                    CA
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-base font-bold tracking-tight text-slate-100 truncate">
                        Crea Arte
                      </span>
                      <span className="px-1.5 py-0.5 text-[10px] font-mono font-semibold uppercase rounded bg-[#182030] text-slate-300 border border-[#28354d]">
                        ERP
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-500 block truncate">
                      Gigantografía, 3D & CRM
                    </span>
                  </div>
                </div>
              )}
              <button
                type="button"
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="hidden lg:inline-flex p-2 text-slate-400 hover:text-white hover:bg-[#161d2a] rounded-lg transition-all duration-200"
                title={sidebarCollapsed ? 'Expandir menú lateral' : 'Colapsar menú lateral'}
              >
                {sidebarCollapsed ? (
                  <PanelLeftOpen className="w-4 h-4" />
                ) : (
                  <PanelLeftClose className="w-4 h-4" />
                )}
              </button>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="lg:hidden p-1.5 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tarjeta de Usuario Activo en Sidebar */}
            {!sidebarCollapsed && (
              <div className="p-3 rounded-xl bg-[#121722] border border-[#1d2636] flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-[#1a2232] border border-[#28354d] text-slate-200 font-bold text-xs flex items-center justify-center shrink-0">
                  {currentUser.name
                    .split(' ')
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join('')}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-slate-200 truncate">{currentUser.name}</div>
                  <div className="text-[11px] text-slate-500 truncate">{currentUser.department}</div>
                </div>
                <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" title="Sesión Activa" />
              </div>
            )}

            {/* 1. Operación Diaria Principal */}
            <nav className="space-y-1">
              {!sidebarCollapsed && (
                <div className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                  Módulos Principales
                </div>
              )}
              {primaryModules.map((mod) => {
                const Icon = mod.icon;
                const active = activeModule === mod.id;
                const unreadWaReplies =
                  mod.id === 'whatsapp'
                    ? orders.reduce((acc, o) => acc + (o.unreadClientReplies || 0), 0)
                    : 0;
                return (
                  <button
                    key={mod.id}
                    type="button"
                    onClick={() => {
                      setActiveModule(mod.id);
                      setMobileMenuOpen(false);
                    }}
                    title={mod.label}
                    className={`w-full flex items-center justify-between ${
                      sidebarCollapsed ? 'justify-center px-2' : 'px-3.5'
                    } py-2.5 text-xs font-medium rounded-lg transition-all duration-150 whitespace-nowrap ${
                      active
                        ? 'bg-[#182030] text-white font-semibold border border-[#28354d] shadow-2xs'
                        : 'text-slate-400 hover:bg-[#141a26] hover:text-slate-200 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-indigo-400' : 'text-slate-500'}`} />
                      {!sidebarCollapsed && <span className="truncate">{mod.shortLabel}</span>}
                    </div>
                    {!sidebarCollapsed && unreadWaReplies > 0 && (
                      <span className="px-2 py-0.5 text-[10px] font-bold font-mono bg-rose-500 text-white rounded-full">
                        {unreadWaReplies}
                      </span>
                    )}
                  </button>
                );
              })}

              {/* 2. Herramientas de Bodega, Taller y Configuración */}
              {secondaryModules.length > 0 && (
                <div className="pt-3.5 mt-3.5 border-t border-[#1a2230] space-y-1">
                  {!sidebarCollapsed ? (
                    <button
                      type="button"
                      onClick={() => setShowSecondaryModules(!showSecondaryModules)}
                      className="w-full px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-500 hover:text-slate-300 flex items-center justify-between rounded-lg hover:bg-[#141a26] transition-colors"
                    >
                      <span>Bodega y Taller ({secondaryModules.length})</span>
                      {showSecondaryModules ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>
                  ) : null}

                  {(showSecondaryModules ||
                    sidebarCollapsed ||
                    secondaryModules.some((m) => m.id === activeModule)) &&
                    secondaryModules.map((mod) => {
                      const Icon = mod.icon;
                      const active = activeModule === mod.id;
                      return (
                        <button
                          key={mod.id}
                          type="button"
                          onClick={() => {
                            setActiveModule(mod.id);
                            setMobileMenuOpen(false);
                          }}
                          title={mod.label}
                          className={`w-full flex items-center ${
                            sidebarCollapsed ? 'justify-center px-2' : 'gap-3 px-3.5'
                          } py-2.5 text-xs font-medium rounded-lg transition-all duration-150 whitespace-nowrap ${
                            active
                              ? 'bg-[#182030] text-white font-semibold border border-[#28354d] shadow-2xs'
                              : 'text-slate-400 hover:bg-[#141a26] hover:text-slate-200 border border-transparent'
                          }`}
                        >
                          <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-indigo-400' : 'text-slate-500'}`} />
                          {!sidebarCollapsed && <span className="truncate">{mod.shortLabel}</span>}
                        </button>
                      );
                    })}
                </div>
              )}
            </nav>
          </div>

          {/* Controles Inferiores Compactos del Sidebar */}
          <div className="p-4 border-t border-[#1a2230] space-y-2.5 bg-[#0a0d13] shrink-0">
            {isTimerRunning && !sidebarCollapsed && (
              <button
                type="button"
                onClick={() => setActiveModule('timetracking')}
                className="w-full px-3 py-2 text-xs font-mono bg-emerald-950/50 border border-emerald-800/50 rounded-lg text-emerald-300 flex items-center justify-between"
              >
                <span>⏱ {activeTimerOrderId}</span>
                <span className="font-bold tabular-nums">{formatSecondsToHMS(timerSeconds)}</span>
              </button>
            )}

            <div className={sidebarCollapsed ? 'flex flex-col gap-2' : 'grid grid-cols-3 gap-2'}>
              <button
                type="button"
                onClick={() => setDarkMode(!darkMode)}
                title="Cambiar tema Claro / Oscuro"
                className="px-2.5 py-2 text-xs font-medium bg-[#121722] hover:bg-[#182030] text-slate-300 border border-[#1d2636] rounded-lg inline-flex items-center justify-center gap-1.5 transition-all duration-150"
              >
                {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-400" />}
                {!sidebarCollapsed && <span>{darkMode ? 'Claro' : 'Oscuro'}</span>}
              </button>

              <button
                type="button"
                onClick={handleResetDemoData}
                title="Restaurar datos iniciales de muestra"
                className="px-2.5 py-2 text-xs font-medium bg-[#121722] hover:bg-[#182030] text-slate-300 border border-[#1d2636] rounded-lg inline-flex items-center justify-center gap-1.5 transition-all duration-150"
              >
                <RotateCcw className="w-4 h-4 text-slate-400" />
                {!sidebarCollapsed && <span>Demo</span>}
              </button>

              <button
                type="button"
                onClick={() =>
                  downloadStandaloneHtmlBundle({
                    orders,
                    inventory,
                    movements,
                    timeLogs,
                    transactions,
                    machines,
                    maintenanceLogs,
                    users,
                    restockRequests,
                    chatMessages,
                    waConfig: activeWaConfig,
                  })
                }
                title="Descargar aplicación en archivo .HTML"
                className="px-2.5 py-2 text-xs font-medium bg-[#121722] hover:bg-[#182030] text-slate-300 border border-[#1d2636] rounded-lg inline-flex items-center justify-center gap-1.5 transition-all duration-150"
              >
                <Download className="w-4 h-4 text-slate-400" />
                {!sidebarCollapsed && <span>.HTML</span>}
              </button>
            </div>
          </div>
        </aside>

        {/* CONTENEDOR PRINCIPAL */}
        <div className="flex-1 flex flex-col min-w-0 max-w-full">
          {/* OVERLAY PARA CERRAR POPOVERS FLOTANTES AL HACER CLIC AFUERA */}
          {(showCrmInboxPopover || showToolsMenu) && (
            <div
              className="fixed inset-0 z-30"
              onClick={() => {
                setShowCrmInboxPopover(false);
                setShowToolsMenu(false);
              }}
            />
          )}

          {/* TOP BAR SAAS RESPONSIVA (COMPUTADORAS, TABLETS Y CELULARES) */}
          <header className="sticky top-0 z-40 flex flex-wrap items-center justify-between gap-2 sm:gap-3 px-3 sm:px-6 py-2.5 sm:py-3 bg-white dark:bg-[#111620] border-b border-slate-200 dark:border-[#1e2636]">
            {/* Zona 1: Módulo Actual con Icono Destacado */}
            <div className="flex items-center gap-2.5 min-w-0">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                className="lg:hidden p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#182030] rounded-lg shrink-0"
                title="Abrir menú de navegación"
              >
                <Menu className="w-5 h-5" />
              </button>
              <div className="hidden sm:flex w-9 h-9 rounded-lg bg-slate-100 dark:bg-[#171e2b] border border-slate-200 dark:border-[#242f42] items-center justify-center text-slate-700 dark:text-slate-300 shrink-0">
                {(() => {
                  const ActiveIcon = activeModuleDef.icon;
                  return <ActiveIcon className="w-4 h-4" />;
                })()}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="text-sm sm:text-base md:text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100 leading-tight truncate">
                    {activeModuleDef.shortLabel}
                  </h1>
                  <span className="hidden xl:inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold bg-slate-100 dark:bg-[#171e2b] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-[#242f42] shrink-0">
                    {orders.length} OT activas
                  </span>
                </div>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 hidden md:block truncate">
                  Operador: <strong className="text-slate-800 dark:text-slate-200">{currentUser.name}</strong> ({currentUser.department})
                </span>
              </div>
            </div>

            {/* Zona 2: Modo Simulación / Cambio Rápido de Rol + Estado Firebase Auth */}
            <div className="flex items-center gap-1.5 sm:gap-2 max-w-full overflow-x-auto scrollbar-none">
              <div
                className="flex items-center gap-1 bg-slate-100 dark:bg-[#0d1119] p-1 rounded-lg border border-slate-200 dark:border-[#1e2636] shrink-0"
                title="Modo Simulación / Cambio Rápido (Solo Admin)"
              >
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 px-1.5 hidden 2xl:inline">
                  Rol:
                </span>
                {(
                  [
                    { role: 'admin' as RoleId, label: 'Admin' },
                    { role: 'sales' as RoleId, label: 'Ventas' },
                    { role: 'designer' as RoleId, label: 'Diseño' },
                    { role: 'operator' as RoleId, label: 'Taller' },
                  ] as const
                ).map((r) => {
                  const isActiveRole = currentRole === r.role;
                  return (
                    <button
                      key={r.role}
                      type="button"
                      onClick={() => handleQuickSwitchRole(r.role)}
                      className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all duration-150 whitespace-nowrap ${
                        isActiveRole
                          ? 'bg-slate-800 dark:bg-[#1c2536] text-white dark:text-slate-100 border border-slate-700 dark:border-[#2e3b52] shadow-2xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-white/70 dark:hover:bg-[#141a26]'
                      }`}
                    >
                      {r.label}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={handleFirebaseSignInToggle}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border inline-flex items-center gap-1.5 transition-all duration-200 shrink-0 ${
                  firebaseUserEmail
                    ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200/90 dark:border-emerald-800/80'
                    : 'bg-white dark:bg-[#171e2b] text-slate-700 dark:text-slate-200 border-slate-200 dark:border-[#253042] hover:bg-slate-50 dark:hover:bg-[#1e2738]'
                }`}
                title={
                  firebaseUserEmail
                    ? `Conectado a Firebase Auth (${firebaseUserEmail})`
                    : 'Iniciar sesión real con Google / Firebase Auth'
                }
              >
                {firebaseUserEmail ? (
                  <>
                    <Cloud className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span className="hidden xl:inline max-w-[110px] truncate">
                      {firebaseUserEmail}
                    </span>
                    <LogOut className="w-3 h-3 opacity-70 shrink-0" />
                  </>
                ) : (
                  <>
                    <LogIn className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                    <span className="hidden xl:inline">Cloud</span>
                  </>
                )}
              </button>
            </div>

            {/* Zona 3: Controles de Acción y Popovers Bien Enmarcados */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 relative">
              {(() => {
                const unreadNotifsCount = crmNotifications.filter((n) => {
                  const recipientId = n.recipientUserId || n.targetUserId;
                  return (
                    !n.read &&
                    (currentRole === 'admin' ||
                      recipientId === currentUser.id ||
                      recipientId === 'all')
                  );
                }).length;
                const myPendingTasksCount = crmTasks.filter(
                  (t) =>
                    t.status === 'pending' &&
                    (currentRole === 'admin' || t.assignedToUserId === currentUser.id)
                ).length;
                const totalBadge = unreadNotifsCount + myPendingTasksCount;

                return (
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => {
                        setShowCrmInboxPopover((prev) => !prev);
                        setShowToolsMenu(false);
                      }}
                      className={`px-2.5 sm:px-3 py-2 text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 border transition-all duration-150 ${
                        totalBadge > 0
                          ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/80 hover:bg-rose-100'
                          : 'bg-white dark:bg-[#171e2b] text-slate-700 dark:text-slate-200 border-slate-200 dark:border-[#253042] hover:bg-slate-50 dark:hover:bg-[#1e2738]'
                      }`}
                      title="Centro de Notificaciones de Respuestas, Menciones y Tareas CRM"
                    >
                      <Bell className="w-4 h-4 shrink-0" />
                      <span className="hidden xl:inline">Alertas CRM</span>
                      {totalBadge > 0 && (
                        <span className="px-1.5 py-0.5 bg-rose-600 text-white rounded-full text-[10px] font-bold font-mono leading-none">
                          {totalBadge}
                        </span>
                      )}
                    </button>

                    {showCrmInboxPopover && (
                      <div className="fixed inset-x-3 top-16 sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[400px] max-h-[80vh] flex flex-col bg-white dark:bg-[#111620] border border-slate-200 dark:border-[#242f42] rounded-2xl shadow-2xl z-50 overflow-hidden">
                        <div className="px-4 py-3 bg-slate-900 dark:bg-[#0d1119] text-white flex items-center justify-between border-b border-slate-800 shrink-0">
                          <div className="min-w-0">
                            <span className="text-sm font-bold block truncate">
                              🔔 Bandeja CRM ({currentUser.name})
                            </span>
                            <span className="text-[11px] text-slate-400 block truncate">
                              Respuestas de clientes, menciones @ y tareas asignadas
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setShowCrmInboxPopover(false)}
                            className="text-slate-400 hover:text-white text-sm px-2 py-1 rounded-lg hover:bg-slate-800 shrink-0"
                          >
                            ✕
                          </button>
                        </div>

                        <div className="grid grid-cols-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0d1119] text-xs font-semibold shrink-0">
                          <button
                            type="button"
                            onClick={() => setCrmInboxTab('notifications')}
                            className={`py-2.5 text-center border-b-2 transition-colors ${
                              crmInboxTab === 'notifications'
                                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-[#111620]'
                                : 'border-transparent text-slate-500'
                            }`}
                          >
                            🔔 Notificaciones ({unreadNotifsCount})
                          </button>
                          <button
                            type="button"
                            onClick={() => setCrmInboxTab('tasks')}
                            className={`py-2.5 text-center border-b-2 transition-colors ${
                              crmInboxTab === 'tasks'
                                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-[#111620]'
                                : 'border-transparent text-slate-500'
                            }`}
                          >
                            📌 Tareas ({myPendingTasksCount})
                          </button>
                        </div>

                        {crmInboxTab === 'notifications' ? (
                          <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                            {crmNotifications.length === 0 ? (
                              <div className="p-6 text-center text-xs text-slate-400">
                                Sin notificaciones pendientes.
                              </div>
                            ) : (
                              crmNotifications.map((notif) => {
                                const recipientId = notif.recipientUserId || notif.targetUserId;
                                const senderLabel = notif.senderName || notif.actorName || 'Sistema CRM';
                                const recipientUser = users.find(
                                  (u) => u.id === recipientId
                                );
                                return (
                                  <div
                                    key={notif.id}
                                    className={`p-3.5 text-xs space-y-1.5 transition-colors ${
                                      !notif.read
                                        ? 'bg-indigo-50/50 dark:bg-indigo-950/30'
                                        : 'bg-white dark:bg-[#111620]'
                                    }`}
                                  >
                                    <div className="flex items-start justify-between gap-2">
                                      <span className="font-bold text-slate-900 dark:text-white leading-snug">
                                        {notif.title}
                                      </span>
                                      <span className="text-[11px] font-mono text-slate-400 shrink-0">
                                        {notif.timestamp.split(' ')[1] || notif.timestamp}
                                      </span>
                                    </div>
                                    <p className="text-xs text-slate-600 dark:text-slate-300 break-words">
                                      {notif.message}
                                    </p>
                                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                                      <span className="text-[11px] text-slate-500">
                                        De: <strong>{senderLabel}</strong> · Para:{' '}
                                        <strong>
                                          {recipientUser?.name || 'Todo el equipo'}
                                        </strong>
                                      </span>
                                      <div className="flex items-center gap-2">
                                        {notif.orderId && (
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setCrmNotifications((prev) =>
                                                prev.map((item) =>
                                                  item.id === notif.id
                                                    ? { ...item, read: true }
                                                    : item
                                                )
                                              );
                                              setPreselectedWaOrderId(notif.orderId!);
                                              handleSmartNavigateModule('whatsapp');
                                              setShowCrmInboxPopover(false);
                                            }}
                                            className="px-2.5 py-1 text-[11px] font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-500"
                                          >
                                            Ir al Chat {notif.orderId}
                                          </button>
                                        )}
                                        {!notif.read && (
                                          <button
                                            type="button"
                                            onClick={() =>
                                              setCrmNotifications((prev) =>
                                                prev.map((item) =>
                                                  item.id === notif.id
                                                    ? { ...item, read: true }
                                                    : item
                                                )
                                              )
                                            }
                                            className="px-2.5 py-1 text-[11px] bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg"
                                          >
                                            Leído
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })
                            )}
                            {unreadNotifsCount > 0 && (
                              <div className="p-2.5 bg-slate-50 dark:bg-[#0d1119] text-center shrink-0">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setCrmNotifications((prev) =>
                                      prev.map((n) => ({ ...n, read: true }))
                                    )
                                  }
                                  className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                                >
                                  ✓ Marcar todas las notificaciones como leídas
                                </button>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                            {crmTasks.map((task) => {
                              const assignee = users.find(
                                (u) => u.id === task.assignedToUserId
                              );
                              const isDone = task.status === 'completed';
                              const prioLow = String(task.priority).toLowerCase();
                              return (
                                <div
                                  key={task.id}
                                  className="p-3.5 text-xs flex items-start justify-between gap-2"
                                >
                                  <div className="flex items-start gap-2.5 min-w-0">
                                    <input
                                      type="checkbox"
                                      checked={isDone}
                                      onChange={() => handleToggleCrmTaskStatus(task.id)}
                                      className="mt-1 w-4 h-4 rounded border-slate-300 text-indigo-600 shrink-0"
                                    />
                                    <div className="min-w-0">
                                      <div
                                        className={`font-semibold break-words ${
                                          isDone
                                            ? 'line-through text-slate-400'
                                            : 'text-slate-900 dark:text-white'
                                        }`}
                                      >
                                        {task.title}
                                      </div>
                                      <div className="text-[11px] text-slate-500 mt-0.5">
                                        Cliente: <strong>{task.clientName}</strong> · Asignado a:{' '}
                                        <strong>{assignee?.name || task.assignedToUserId}</strong> ·
                                        Vence: {task.dueDate}
                                      </div>
                                      {task.orderId && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setPreselectedWaOrderId(task.orderId!);
                                            handleSmartNavigateModule('whatsapp');
                                            setShowCrmInboxPopover(false);
                                          }}
                                          className="mt-1 text-[11px] font-mono font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                                        >
                                          Abrir conversación {task.orderId} →
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                  <span
                                    className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-full shrink-0 ${
                                      isDone
                                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                                        : prioLow === 'urgente'
                                        ? 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300'
                                        : 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                                    }`}
                                  >
                                    {isDone ? 'Hecho' : task.priority}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Botón Directo en Barra Superior (Pantallas Amplias): Carpetas Google Drive */}
              <button
                type="button"
                onClick={() =>
                  setDriveModalOrderId(
                    preselectedWaOrderId || orders[0]?.id || '#CA-001'
                  )
                }
                className="hidden 2xl:inline-flex px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-[#171e2b] hover:bg-slate-50 dark:hover:bg-[#1e2738] border border-slate-200 dark:border-[#253042] rounded-lg transition-all duration-150 whitespace-nowrap items-center gap-1.5"
                title="Abrir Carpeta Google Drive del Proyecto, subir diseños y compartir en Chat Interno"
              >
                <FolderPlus className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                <span>📁 Drive</span>
              </button>

              {/* Botón Directo en Barra Superior (Pantallas Amplias): Portal QR */}
              <button
                type="button"
                onClick={() =>
                  setQrTrackerOrderId(
                    preselectedWaOrderId || orders[0]?.id || '#CA-001'
                  )
                }
                className="hidden 2xl:inline-flex px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-[#171e2b] hover:bg-slate-50 dark:hover:bg-[#1e2738] border border-slate-200 dark:border-[#253042] rounded-lg transition-all duration-150 whitespace-nowrap items-center gap-1.5"
                title="Abrir Portal Público QR de Seguimiento de Orden en Vivo y Garantía"
              >
                <QrCode className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                <span>📲 QR</span>
              </button>

              {/* Botón Directo en Barra Superior: Cambiar Tema Claro / Oscuro */}
              <button
                type="button"
                onClick={() => setDarkMode(!darkMode)}
                className="px-2.5 sm:px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-[#171e2b] hover:bg-slate-50 dark:hover:bg-[#1e2738] border border-slate-200 dark:border-[#253042] rounded-lg transition-all duration-150 whitespace-nowrap inline-flex items-center gap-1.5"
                title={darkMode ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro'}
              >
                {darkMode ? (
                  <>
                    <Sun className="w-4 h-4 text-amber-400 shrink-0" />
                    <span className="hidden md:inline">Claro</span>
                  </>
                ) : (
                  <>
                    <Moon className="w-4 h-4 text-indigo-600 shrink-0" />
                    <span className="hidden md:inline">Oscuro</span>
                  </>
                )}
              </button>

              {/* Botón Directo en Barra Superior: Centro de Agentes Operativos IA */}
              <button
                type="button"
                onClick={() => handleSmartNavigateModule('ai_agents')}
                className={`px-2.5 sm:px-3 py-2 text-xs font-semibold rounded-lg transition-all duration-150 whitespace-nowrap inline-flex items-center gap-1.5 border ${
                  activeModule === 'ai_agents'
                    ? 'bg-indigo-600 text-white border-indigo-500 shadow-2xs'
                    : 'text-slate-700 dark:text-slate-200 bg-white dark:bg-[#171e2b] hover:bg-slate-50 dark:hover:bg-[#1e2738] border-slate-200 dark:border-[#253042]'
                }`}
                title="Abrir Centro de Agentes Operativos IA y Bandeja de Tareas Delegadas"
              >
                <Bot className="w-4 h-4 text-indigo-500 dark:text-indigo-400 shrink-0" />
                <span className="hidden md:inline">🤖 Agentes IA</span>
              </button>

              {/* Acción Principal Directa */}
              <button
                type="button"
                onClick={() =>
                  setActiveModule(activeModule === 'quoter' ? 'kanban' : 'quoter')
                }
                className="px-3 sm:px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-all duration-150 whitespace-nowrap shadow-2xs"
              >
                {activeModule === 'quoter' ? (
                  <>
                    <span className="sm:hidden">📋 Kanban</span>
                    <span className="hidden sm:inline">📋 Ver Tablero Kanban</span>
                  </>
                ) : (
                  <>
                    <span className="sm:hidden">+ Cotizar</span>
                    <span className="hidden sm:inline">+ Nueva Orden / Cotizar</span>
                  </>
                )}
              </button>

              {/* Input oculto para importar respaldo .JSON */}
              <input
                ref={backupInputRef}
                type="file"
                accept=".json,application/json"
                className="hidden"
                onChange={handleImportBackupJsonFile}
              />

              {/* Menú Agrupado de Herramientas y Ayuda (Bien enmarcado en móvil, tablet y PC) */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setShowToolsMenu((prev) => !prev);
                    setShowCrmInboxPopover(false);
                  }}
                  className="px-2.5 sm:px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-[#171e2b] hover:bg-slate-50 dark:hover:bg-[#1e2738] border border-slate-200 dark:border-[#253042] rounded-lg inline-flex items-center gap-1 transition-all duration-150"
                  title="Puesta en Marcha, Guía del Rol, Carpetas Drive, Portal QR y Respaldos JSON"
                >
                  <span>⚙️</span>
                  <span className="hidden lg:inline">Opciones</span>
                  <ChevronDown className="w-3.5 h-3.5 shrink-0" />
                </button>

                {showToolsMenu && (
                  <div className="fixed inset-x-3 top-16 sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-80 max-h-[80vh] overflow-y-auto bg-white dark:bg-[#111620] border border-slate-200 dark:border-[#242f42] rounded-xl shadow-2xl z-50 p-2 space-y-1">
                    <button
                      type="button"
                      onClick={() => {
                        setDriveModalOrderId(
                          preselectedWaOrderId || orders[0]?.id || '#CA-001'
                        );
                        setShowToolsMenu(false);
                      }}
                      className="w-full px-3 py-2.5 text-left text-xs font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-[#182030] rounded-lg flex items-center gap-2.5"
                    >
                      <FolderPlus className="w-4 h-4 text-indigo-500 shrink-0" />
                      <div className="min-w-0">
                        <div className="font-bold truncate">📁 Carpetas Google Drive</div>
                        <div className="text-[11px] font-normal text-slate-500 truncate">
                          Subir artes y compartir archivos por proyecto
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setQrTrackerOrderId(
                          preselectedWaOrderId || orders[0]?.id || '#CA-001'
                        );
                        setShowToolsMenu(false);
                      }}
                      className="w-full px-3 py-2.5 text-left text-xs font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-[#182030] rounded-lg flex items-center gap-2.5"
                    >
                      <QrCode className="w-4 h-4 text-sky-500 shrink-0" />
                      <div className="min-w-0">
                        <div className="font-bold truncate">📲 Portal QR y Garantía en Vivo</div>
                        <div className="text-[11px] font-normal text-slate-500 truncate">
                          Código verificador de orden para el cliente
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setShowGoLiveModal(true);
                        setShowToolsMenu(false);
                      }}
                      className="w-full px-3 py-2.5 text-left text-xs font-semibold text-slate-800 dark:text-slate-100 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 rounded-lg flex items-center gap-2.5"
                    >
                      <Rocket className="w-4 h-4 text-emerald-600 shrink-0" />
                      <div className="min-w-0">
                        <div className="font-bold truncate">🚀 Puesta en Marcha</div>
                        <div className="text-[11px] font-normal text-slate-500 truncate">
                          Editar tabla de precios y empleados
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setShowRoleGuideModal(true);
                        setShowToolsMenu(false);
                      }}
                      className="w-full px-3 py-2.5 text-left text-xs font-semibold text-slate-800 dark:text-slate-100 hover:bg-blue-50 dark:hover:bg-blue-950/50 rounded-lg flex items-center gap-2.5"
                    >
                      <BookOpen className="w-4 h-4 text-blue-600 shrink-0" />
                      <div className="min-w-0">
                        <div className="font-bold truncate">📖 Guía y Manual por Rol</div>
                        <div className="text-[11px] font-normal text-slate-500 truncate">
                          Ver flujo paso a paso de cada área
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        handleExportFullBackupJson();
                        setShowToolsMenu(false);
                      }}
                      className="w-full px-3 py-2.5 text-left text-xs font-semibold text-slate-800 dark:text-slate-100 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 rounded-lg flex items-center gap-2.5"
                    >
                      <Download className="w-4 h-4 text-indigo-600 shrink-0" />
                      <div className="min-w-0">
                        <div className="font-bold truncate">Exportar Base de Datos (.JSON)</div>
                        <div className="text-[11px] font-normal text-slate-500 truncate">
                          Descargar respaldo integral de órdenes y caja
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        backupInputRef.current?.click();
                        setShowToolsMenu(false);
                      }}
                      className="w-full px-3 py-2.5 text-left text-xs font-semibold text-slate-800 dark:text-slate-100 hover:bg-purple-50 dark:hover:bg-purple-950/50 rounded-lg flex items-center gap-2.5"
                    >
                      <Upload className="w-4 h-4 text-purple-600 shrink-0" />
                      <div className="min-w-0">
                        <div className="font-bold truncate">Importar Respaldo (.JSON)</div>
                        <div className="text-[11px] font-normal text-slate-500 truncate">
                          Restaurar copia de seguridad sin perder configuración
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        handleMigrateAndSyncData();
                        setShowToolsMenu(false);
                      }}
                      className="w-full px-3 py-2.5 text-left text-xs font-semibold text-slate-800 dark:text-slate-100 hover:bg-amber-50 dark:hover:bg-amber-950/50 rounded-lg flex items-center gap-2.5"
                    >
                      <RotateCcw className="w-4 h-4 text-amber-600 shrink-0" />
                      <div className="min-w-0">
                        <div className="font-bold truncate">🔄 Restaurar / Migrar Datos</div>
                        <div className="text-[11px] font-normal text-slate-500 truncate">
                          Sincronizar nuevos campos sin perder órdenes
                        </div>
                      </div>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </header>

          {/* Notificación Toast No-Intrusiva */}
          {toastMessage && (
            <div className="bg-slate-900 dark:bg-blue-950 text-white px-6 py-2.5 text-xs font-medium flex items-center justify-between border-b border-slate-800">
              <span>{toastMessage}</span>
              <button
                type="button"
                onClick={() => setToastMessage(null)}
                className="text-slate-400 hover:text-white ml-4"
              >
                Cerrar
              </button>
            </div>
          )}

          {/* ÁREA DE TRABAJO DEL MÓDULO ACTIVO (MÁS AMPLIA Y DESPEJADA) */}
          <main className="flex-1 p-4 sm:p-6 max-w-[1680px] w-full mx-auto">
            {/* Barra Compacta de 1 línea según el Rol Activo */}
            <QuickRoleWorkflowBanner
              currentRole={currentRole}
              activeModule={activeModule}
              onNavigate={(mod) => handleSmartNavigateModule(mod)}
              onOpenFullGuide={() => setShowRoleGuideModal(true)}
            />

            {/* Modal de Puesta en Marcha Real (Precios en Tabla + Empleados + Limpiar Demo) */}
            <GoLiveAssistantModal
              isOpen={showGoLiveModal}
              onClose={() => setShowGoLiveModal(false)}
              users={users}
              onUpdateUsers={(updatedUsers) => {
                setUsers(updatedUsers);
                notify('Datos de colaboradores actualizados');
              }}
              ordersCount={orders.length}
              onClearDemoOrdersForProduction={handleClearDemoOrdersForProduction}
              onRestoreDemoData={handleResetDemoData}
              onSwitchRoleAndGo={(role, mod) => {
                handleQuickSwitchRole(role);
                setActiveModule(mod);
                setShowGoLiveModal(false);
              }}
              onNotify={notify}
            />

            {/* Modal Global de Carpeta Google Drive por Proyecto y Compartir en Chat Interno */}
            <ProjectDriveModal
              isOpen={Boolean(driveModalOrderId)}
              onClose={() => setDriveModalOrderId(null)}
              orders={orders}
              initialOrderId={driveModalOrderId || orders[0]?.id}
              users={users}
              currentUser={currentUser}
              onUpdateOrder={handleUpdateOrder}
              onSendInternalNote={handleSendInternalNote}
              onOpenInternalChat={(orderId) => {
                setPreselectedWaOrderId(orderId);
                handleSmartNavigateModule('whatsapp');
              }}
              onNotify={notify}
            />

            {/* Modal de Seguimiento de Orden con Código QR y Estado en Vivo (Fase 4/5) */}
            <QrOrderTrackerModal
              isOpen={Boolean(qrTrackerOrderId)}
              onClose={() => setQrTrackerOrderId(null)}
              orders={orders}
              initialOrderId={qrTrackerOrderId || orders[0]?.id}
              currentUserName={currentUser.name}
              onOpenWhatsAppForOrder={(orderId) => {
                setPreselectedWaOrderId(orderId);
                handleSmartNavigateModule('whatsapp');
              }}
              onNotify={notify}
            />

            {/* Modal Interactivo de Guías por Rol */}
            <RoleGuideModal
              isOpen={showRoleGuideModal}
              initialRole={currentRole}
              onClose={() => setShowRoleGuideModal(false)}
              onNavigateModule={(mod) => handleSmartNavigateModule(mod)}
            />
            {activeModule === 'dashboard' && currentRole === 'admin' && (
              <ModuleErrorBoundary moduleName="Dashboard Ejecutivo">
                <AdminDashboardModule
                  orders={orders}
                  inventory={inventory}
                  movements={movements}
                  restockRequests={restockRequests}
                  timeLogs={timeLogs}
                  transactions={transactions}
                  machines={machines}
                  users={users}
                  onNavigateModule={(mod) => handleSmartNavigateModule(mod)}
                  onApproveRestockRequest={handleApproveRestockRequest}
                  onRegisterOrderPayment={handleRegisterOrderPayment}
                />
              </ModuleErrorBoundary>
            )}

            {activeModule === 'ai_agents' && (
              <ModuleErrorBoundary moduleName="Centro de Agentes Operativos IA">
                <AiAgentsCenterModule
                  orders={orders}
                  inventory={inventory}
                  movements={movements}
                  restockRequests={restockRequests}
                  reusableOffcuts={reusableOffcuts}
                  users={users}
                  currentUser={currentUser}
                  currentRole={currentRole}
                  nextOrderCode={nextOrderCode}
                  onConvertOrder={handleConvertOrder}
                  onSendToQuoter={(payload) => {
                    setOptimizerPayload(payload);
                    handleSmartNavigateModule('quoter');
                    notify(
                      `Propuesta IA cargada en el Cotizador Técnico (${payload.widthM}m × ${payload.heightM}m · ${payload.quantity} und)`
                    );
                  }}
                  onSendToOptimizer={(payload) => {
                    setOptimizerPayload(payload);
                    handleSmartNavigateModule('optimizer');
                    notify(
                      `Propuesta IA cargada en el Optimizador 2D (${payload.widthM}m × ${payload.heightM}m · ${payload.quantity} und)`
                    );
                  }}
                  onUseOffcut={(offcutId, usedInOrderId) => {
                    setReusableOffcuts((prev) =>
                      prev.map((o) =>
                        o.id === offcutId
                          ? {
                              ...o,
                              status: 'Utilizado',
                              usedInOrderId,
                              usedAt: getNowTimestamp(),
                            }
                          : o
                      )
                    );
                    notify(`Retazo asignado por Agente IA a la orden ${usedInOrderId}.`);
                  }}
                  onCreateRestockRequest={handleCreateRestockRequest}
                  onSendWhatsAppMessage={(orderId, text) => {
                    handleSendCrmMessage(
                      orderId,
                      text,
                      activeWaConfig.mode === 'meta_cloud_api' ? 'meta_cloud_api' : 'wa_direct'
                    );
                    setPreselectedWaOrderId(orderId);
                    handleSmartNavigateModule('whatsapp');
                  }}
                  onMoveOrderStage={handleMoveOrderStage}
                  onAddCrmTask={handleAddCrmTask}
                  onLogAudit={(title, details, orderId) =>
                    appendAuditLog('crm_tareas', title, details, orderId)
                  }
                  onNotify={notify}
                />
              </ModuleErrorBoundary>
            )}

            {activeModule === 'clients' && (
              <ModuleErrorBoundary moduleName="Directorio de Clientes CRM">
                <ClientsModule
                  clients={clients}
                  orders={orders}
                  transactions={transactions}
                  currentRole={currentRole}
                  users={users}
                  currentUser={currentUser}
                  crmTasks={crmTasks}
                  onAddClient={(newClient) => {
                    setClients((prev) => [newClient, ...prev]);
                    notify(`Cliente "${newClient.name}" registrado en el Directorio CRM.`);
                  }}
                  onUpdateClient={(updated) => {
                    setClients((prev) => {
                      const exists = prev.some((c) => c.id === updated.id);
                      return exists
                        ? prev.map((c) => (c.id === updated.id ? updated : c))
                        : [updated, ...prev];
                    });
                  }}
                  onOpenWhatsAppForOrder={(orderId) => {
                    setPreselectedWaOrderId(orderId);
                    handleSmartNavigateModule('whatsapp');
                    notify(`Abriendo conversación CRM de la orden ${orderId}`);
                  }}
                  onStartQuoteForClient={(cli) => {
                    setPreselectedClient(cli);
                    handleSmartNavigateModule('quoter');
                    notify(`Cliente "${cli.name}" cargado en el Cotizador (RUC: ${cli.ruc})`);
                  }}
                  onRegisterOrderPayment={handleRegisterOrderPayment}
                  onAddCrmTask={handleAddCrmTask}
                  onToggleCrmTaskStatus={handleToggleCrmTaskStatus}
                  onAssignClientChatsToUser={(clientName, targetUserId) => {
                    setOrders((prev) =>
                      prev.map((o) =>
                        o.clientName.toLowerCase().trim() === clientName.toLowerCase().trim()
                          ? { ...o, assignedCrmAgentId: targetUserId }
                          : o
                      )
                    );
                  }}
                  onSendBatchWhatsAppMessage={(orderId, text) => {
                    handleSendCrmMessage(
                      orderId,
                      text,
                      activeWaConfig.mode === 'meta_cloud_api' ? 'meta_cloud_api' : 'wa_direct'
                    );
                  }}
                  onNotify={notify}
                />
              </ModuleErrorBoundary>
            )}

            {activeModule === 'quoter' && (
              <ModuleErrorBoundary moduleName="Cotizador Multi-Producto">
                <QuoterModule
                  currentRole={currentRole}
                  currentUser={currentUser}
                  users={users}
                  orders={orders}
                  clients={clients}
                  preselectedClient={preselectedClient}
                  optimizerPayload={optimizerPayload}
                  onConsumeOptimizerPayload={() => setOptimizerPayload(null)}
                  nextOrderCode={nextOrderCode}
                  onConvertOrder={handleConvertOrder}
                  onSendQuoteToWhatsApp={handleSendQuoteToWhatsApp}
                  onOpenWhatsAppChat={(orderId) => {
                    setPreselectedWaOrderId(orderId);
                    handleSmartNavigateModule('whatsapp');
                    notify(`Abriendo conversación de WhatsApp de la cotización/orden ${orderId}`);
                  }}
                  onOpenKanban={() => handleSmartNavigateModule('kanban')}
                  onRegisterOrderPayment={handleRegisterOrderPayment}
                  onNotify={notify}
                />
              </ModuleErrorBoundary>
            )}

            {activeModule === 'kanban' && (
              <ModuleErrorBoundary moduleName="Tablero Kanban y Órdenes de Trabajo">
                <KanbanModule
                  orders={orders}
                  users={users}
                  currentRole={currentRole}
                  currentUser={currentUser}
                  onMoveOrderStage={handleMoveOrderStage}
                  onUpdateOrder={handleUpdateOrder}
                  onRegisterPayment={handleRegisterOrderPayment}
                  onStartTimerForOrder={handleStartTimerForOrder}
                  onOpenDriveModal={(orderId) => setDriveModalOrderId(orderId)}
                  onOpenQrTracker={(orderId) => setQrTrackerOrderId(orderId)}
                  onNotify={notify}
                />
              </ModuleErrorBoundary>
            )}

            {activeModule === 'timetracking' && (
              <ModuleErrorBoundary moduleName="Control de Tiempos y Turnos">
                <TimeTrackingModule
                  orders={orders}
                  timeLogs={timeLogs}
                  users={users}
                  currentRole={currentRole}
                  currentUser={currentUser}
                  activeTimerOrderId={activeTimerOrderId}
                  setActiveTimerOrderId={setActiveTimerOrderId}
                  activeTimerPhase={activeTimerPhase}
                  setActiveTimerPhase={setActiveTimerPhase}
                  activeTimerEmployeeId={activeTimerEmployeeId}
                  setActiveTimerEmployeeId={setActiveTimerEmployeeId}
                  timerSeconds={timerSeconds}
                  isTimerRunning={isTimerRunning}
                  onToggleTimer={() => setIsTimerRunning((r) => !r)}
                  onStopAndSaveTimer={handleStopAndSaveTimer}
                  onAddManualTimeLog={handleAddManualTimeLog}
                  onUpdateOrder={handleUpdateOrder}
                  onNotify={notify}
                />
              </ModuleErrorBoundary>
            )}

            {activeModule === 'inventory' && (
              <ModuleErrorBoundary moduleName="Inventario, Facturas PDF y Kardex Valorizado">
                <InventoryModule
                  inventory={inventory}
                  movements={movements}
                  restockRequests={restockRequests}
                  orders={orders}
                  processedInvoices={processedInvoices}
                  reusableOffcuts={reusableOffcuts}
                  currentRole={currentRole}
                  currentUser={currentUser}
                  onAddStockEntry={handleAddStockEntry}
                  onCommitParsedInvoice={handleCommitParsedInvoice}
                  onReportWaste={handleReportWaste}
                  onCreateRestockRequest={handleCreateRestockRequest}
                  onApproveRestockRequest={handleApproveRestockRequest}
                  onUseOffcut={(offcutId, usedInOrderId) => {
                    setReusableOffcuts((prev) =>
                      prev.map((o) =>
                        o.id === offcutId
                          ? {
                              ...o,
                              status: 'Utilizado',
                              usedInOrderId,
                              usedAt: getNowTimestamp(),
                            }
                          : o
                      )
                    );
                    notify(`Retazo marcado como reutilizado en ${usedInOrderId || 'taller'}.`);
                  }}
                  onNavigateOptimizer={() => handleSmartNavigateModule('optimizer')}
                />
              </ModuleErrorBoundary>
            )}

            {activeModule === 'optimizer' && (
              <ModuleErrorBoundary moduleName="Optimizador de Cortes 2D y Retazos">
                <CutOptimizerModule
                  orders={orders}
                  inventory={inventory}
                  reusableOffcuts={reusableOffcuts}
                  currentUser={currentUser}
                  onUpdateOrder={handleUpdateOrder}
                  onSendToQuoter={(payload) => {
                    setOptimizerPayload(payload);
                    handleSmartNavigateModule('quoter');
                    notify(
                      `Despiece enviado al Cotizador (${payload.widthM}m × ${payload.heightM}m · ${payload.quantity} und · Merma ${payload.wastePct}%)`
                    );
                  }}
                  onAddOffcut={(newOffcut) => {
                    setReusableOffcuts((prev) => [newOffcut, ...prev]);
                  }}
                  onUseOffcut={(offcutId, usedInOrderId) => {
                    setReusableOffcuts((prev) =>
                      prev.map((o) =>
                        o.id === offcutId
                          ? {
                              ...o,
                              status: 'Utilizado',
                              usedInOrderId,
                              usedAt: getNowTimestamp(),
                            }
                          : o
                      )
                    );
                  }}
                  onNotify={notify}
                />
              </ModuleErrorBoundary>
            )}

            {activeModule === 'finance' && (
              <ModuleErrorBoundary moduleName="Caja, Bancos y Retenciones SRI">
                <FinanceModule
                  orders={orders}
                  transactions={transactions}
                  currentRole={currentRole}
                  currentUser={currentUser}
                  onRegisterOrderPayment={handleRegisterOrderPayment}
                  onRegisterPettyCashExpense={handleRegisterPettyCashExpense}
                />
              </ModuleErrorBoundary>
            )}

            {activeModule === 'maintenance' && (
              <ModuleErrorBoundary moduleName="Mantenimiento de Maquinaria">
                <MaintenanceModule
                  machines={machines}
                  logs={maintenanceLogs}
                  currentUser={currentUser}
                  onAddMaintenanceLog={handleAddMaintenanceLog}
                />
              </ModuleErrorBoundary>
            )}

            {activeModule === 'whatsapp' && (
              <ModuleErrorBoundary moduleName="Centro WhatsApp CRM Multiusuario">
                <WhatsAppCenterModule
                  orders={orders}
                  users={users}
                  messages={chatMessages}
                  waConfig={activeWaConfig}
                  currentRole={currentRole}
                  currentUser={currentUser}
                  preselectedOrderId={preselectedWaOrderId}
                  crmTasks={crmTasks}
                  clients={clients}
                  onUpdateClient={(updated) => {
                    setClients((prev) => {
                      const exists = prev.some((c) => c.id === updated.id);
                      return exists
                        ? prev.map((c) => (c.id === updated.id ? updated : c))
                        : [updated, ...prev];
                    });
                  }}
                  onAddClient={(newClient) => {
                    setClients((prev) => [newClient, ...prev]);
                  }}
                  onSimulateMetaAdLead={handleSimulateMetaAdLead}
                  onPreQuoteLeadWithAi={(order) => {
                    setOptimizerPayload({
                      mode: 'sheet',
                      orderId: order.id,
                      widthM: order.widthM || 3.8,
                      heightM: order.heightM || 1.2,
                      quantity: order.quantity || 1,
                      wastePct: order.wastePercent || 10,
                      summaryNote: `Pre-cotización IA desde Lead Meta Ads (${
                        order.adReferral?.headline || order.title
                      }) para ${order.clientName}`,
                    });
                    handleSmartNavigateModule('quoter');
                    notify(
                      `⚡ Lead Meta Ads ${order.id} (${order.clientName}) cargado en el Cotizador para cierre comercial`
                    );
                  }}
                  onSendMessage={handleSendCrmMessage}
                  onSendInternalNote={handleSendInternalNote}
                  onAssignConversationAgent={handleAssignConversationAgent}
                  onAddCrmTask={handleAddCrmTask}
                  onToggleCrmTaskStatus={handleToggleCrmTaskStatus}
                  onSimulateIncomingMessage={handleSimulateIncomingMessage}
                  onUpdateWaConfig={(newConf) => setWaConfig([newConf])}
                  onMoveOrderStage={handleMoveOrderStage}
                  onUpdateOrder={handleUpdateOrder}
                  onRegisterOrderPayment={handleRegisterOrderPayment}
                  onOpenDriveModal={(orderId) => setDriveModalOrderId(orderId)}
                  onNotify={notify}
                />
              </ModuleErrorBoundary>
            )}

            {activeModule === 'users' && currentRole === 'admin' && (
              <div className="space-y-6">
                <div className="border-b border-slate-200 dark:border-slate-800 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                      Directorio de Colaboradores y Control de Usuarios por Roles (RBAC)
                    </h2>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Edita nombres y costos hora directamente en la tabla, o cambia la sesión activa para probar cada rol.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  {/* Tabla Editable de Usuarios */}
                  <div className="lg:col-span-8 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl shadow-xs overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50/90 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400">
                        <tr>
                          <th className="py-3.5 px-4">Colaborador (Editable)</th>
                          <th className="py-3.5 px-4">Área Operativa</th>
                          <th className="py-3.5 px-4">Rol RBAC</th>
                          <th className="py-3.5 px-4">Especialidad</th>
                          <th className="py-3.5 px-4 text-right">Costo $/h</th>
                          <th className="py-3.5 px-4 text-right">Sesión</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200/80 dark:divide-slate-800">
                        {users.map((u) => {
                          const isCurrent = u.id === currentUser.id;
                          return (
                            <tr
                              key={u.id}
                              className={
                                isCurrent
                                  ? 'bg-indigo-50/40 dark:bg-indigo-950/25'
                                  : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
                              }
                            >
                              <td className="py-3 px-4">
                                <input
                                  type="text"
                                  value={u.name}
                                  onChange={(e) =>
                                    setUsers((prev) =>
                                      prev.map((item) =>
                                        item.id === u.id
                                          ? { ...item, name: e.target.value }
                                          : item
                                      )
                                    )
                                  }
                                  className="w-full min-w-[140px] px-2.5 py-1.5 text-xs font-semibold bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white"
                                />
                              </td>
                              <td className="py-3 px-4 text-slate-700 dark:text-slate-300 font-medium">
                                {u.department}
                              </td>
                              <td className="py-3 px-4 text-indigo-600 dark:text-indigo-400 font-medium">
                                {u.roleLabel}
                              </td>
                              <td className="py-3 px-4">
                                <input
                                  type="text"
                                  value={u.specialty}
                                  onChange={(e) =>
                                    setUsers((prev) =>
                                      prev.map((item) =>
                                        item.id === u.id
                                          ? { ...item, specialty: e.target.value }
                                          : item
                                      )
                                    )
                                  }
                                  className="w-full min-w-[140px] px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-600 dark:text-slate-300"
                                />
                              </td>
                              <td className="py-3 px-4 text-right font-mono">
                                <input
                                  type="number"
                                  min="1"
                                  step="0.5"
                                  value={u.hourlyCost}
                                  onChange={(e) =>
                                    setUsers((prev) =>
                                      prev.map((item) =>
                                        item.id === u.id
                                          ? {
                                              ...item,
                                              hourlyCost: Math.max(1, Number(e.target.value)),
                                            }
                                          : item
                                      )
                                    )
                                  }
                                  className="w-20 px-2.5 py-1.5 text-right font-mono text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white"
                                />
                              </td>
                              <td className="py-3 px-4 text-right">
                                <button
                                  type="button"
                                  onClick={() => handleSwitchUser(u.id)}
                                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 whitespace-nowrap ${
                                    isCurrent
                                      ? 'bg-emerald-600 text-white font-semibold shadow-2xs'
                                      : 'bg-slate-100 dark:bg-slate-800 hover:bg-indigo-600 hover:text-white text-slate-700 dark:text-slate-200'
                                  }`}
                                >
                                  {isCurrent ? '✓ Activo' : 'Activar Perfil'}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Alta de Colaborador */}
                  <div className="lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl shadow-xs p-5 space-y-4">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                      <Plus className="w-4 h-4 text-indigo-600" />
                      <span>Agregar Nuevo Colaborador</span>
                    </h3>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                          Nombre Completo
                        </label>
                        <input
                          type="text"
                          value={newUserName}
                          onChange={(e) => setNewUserName(e.target.value)}
                          placeholder="Ej. Roberto Gómez"
                          className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Rol RBAC
                          </label>
                          <select
                            value={newUserRole}
                            onChange={(e) => setNewUserRole(e.target.value as RoleId)}
                            className="w-full px-2.5 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                          >
                            <option value="admin">Administrador</option>
                            <option value="sales">Ventas / Atención</option>
                            <option value="designer">Diseñador</option>
                            <option value="operator">Operador / Instalador</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Área Taller
                          </label>
                          <select
                            value={newUserDepartment}
                            onChange={(e) =>
                              setNewUserDepartment(e.target.value as UserProfile['department'])
                            }
                            className="w-full px-2.5 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                          >
                            <option value="Diseño">Diseño</option>
                            <option value="Impresión/Corte">Impresión/Corte</option>
                            <option value="Taller/Armado">Taller/Armado</option>
                            <option value="Instalación">Instalación</option>
                            <option value="Comercial">Comercial</option>
                            <option value="Dirección">Dirección</option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                          Especialidad Técnica
                        </label>
                        <input
                          type="text"
                          value={newUserSpecialty}
                          onChange={(e) => setNewUserSpecialty(e.target.value)}
                          className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                          Costo Hora Interno ($/h)
                        </label>
                        <input
                          type="number"
                          min="5"
                          value={newUserHourly}
                          onChange={(e) => setNewUserHourly(Math.max(1, Number(e.target.value)))}
                          className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (!newUserName.trim()) return;
                          const roleLabels: Record<RoleId, string> = {
                            admin: 'Administrador / Gerente',
                            sales: 'Ventas / Atención',
                            designer: 'Diseñador / Pre-prensa',
                            operator: 'Operador de Taller / Instalador',
                          };
                          const created: UserProfile = {
                            id: `usr-${Date.now()}`,
                            name: newUserName.trim(),
                            role: newUserRole,
                            roleLabel: roleLabels[newUserRole],
                            department: newUserDepartment,
                            specialty: newUserSpecialty,
                            hourlyCost: newUserHourly,
                            phone: '+593 99 000 1111',
                            active: true,
                          };
                          setUsers((prev) => [...prev, created]);
                          setNewUserName('');
                          appendAuditLog(
                            'usuarios_roles',
                            'Registro de Nuevo Colaborador',
                            `${currentUser.name} registró al colaborador ${created.name} con rol "${created.roleLabel}" en el área ${created.department}.`,
                            undefined,
                            created.name
                          );
                          notify(`Colaborador ${created.name} registrado en el área ${created.department}`);
                        }}
                        className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-xs shadow-indigo-500/20 transition-all duration-200"
                      >
                        Registrar Colaborador
                      </button>
                    </div>
                  </div>
                </div>

                {/* BITÁCORA E HISTORIAL DE AUDITORÍA PARA EL ADMINISTRADOR: ¿QUIÉN HIZO QUÉ Y CUÁNDO? */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
                  <div className="px-5 py-4 bg-slate-50/80 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-indigo-600" />
                        <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                          Historial y Bitácora de Auditoría del Sistema (¿Quién hizo cada acción?)
                        </h3>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Registro cronológico inalterable de quién dio de baja o alta a un empleado en un proyecto, cambios de etapa, cotizaciones y cobros.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={auditCategoryFilter}
                        onChange={(e) =>
                          setAuditCategoryFilter(e.target.value as AuditActionCategory | 'all')
                        }
                        className="px-3 py-1.5 text-xs font-medium bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                      >
                        <option value="all">Todas las acciones ({auditLogs.length})</option>
                        <option value="alta_baja_proyecto">Altas y Bajas de Personal en Proyectos</option>
                        <option value="etapa_produccion">Cambios de Etapa en Taller</option>
                        <option value="cotizacion_orden">Cotizaciones y Órdenes</option>
                        <option value="cobros_finanzas">Cobros y Caja</option>
                        <option value="crm_tareas">CRM: Asignación de Chats, Menciones y Tareas</option>
                        <option value="usuarios_roles">Usuarios y Roles</option>
                      </select>

                      <select
                        value={auditActorFilter}
                        onChange={(e) => setAuditActorFilter(e.target.value)}
                        className="px-3 py-1.5 text-xs font-medium bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                      >
                        <option value="all">Todos los Usuarios / Roles</option>
                        {users.map((u) => (
                          <option key={u.id} value={u.id}>
                            Ejecutado por: {u.name} ({u.roleLabel.split('/')[0].trim()})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50/90 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400">
                        <tr>
                          <th className="py-3 px-4">Fecha y Hora</th>
                          <th className="py-3 px-4">Quién ejecutó la acción (Usuario / Rol)</th>
                          <th className="py-3 px-4">Acción Realizada</th>
                          <th className="py-3 px-4">Proyecto / Empleado Afectado</th>
                          <th className="py-3 px-4">Detalle en Historial</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200/80 dark:divide-slate-800">
                        {auditLogs
                          .filter((log) => {
                            if (auditCategoryFilter !== 'all' && log.category !== auditCategoryFilter)
                              return false;
                            if (auditActorFilter !== 'all' && log.actorUserId !== auditActorFilter)
                              return false;
                            return true;
                          })
                          .map((log) => (
                            <tr
                              key={log.id}
                              className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                            >
                              <td className="py-3 px-4 font-mono text-[11px] text-slate-600 dark:text-slate-400 whitespace-nowrap">
                                {log.timestamp}
                              </td>
                              <td className="py-3 px-4">
                                <div className="font-bold text-slate-900 dark:text-white">
                                  {log.actorName}
                                </div>
                                <div className="text-[11px] text-indigo-600 dark:text-indigo-400 font-medium">
                                  {log.actorRoleLabel}
                                </div>
                              </td>
                              <td className="py-3 px-4">
                                <span
                                  className={`inline-block px-2.5 py-0.5 text-[10px] font-bold rounded-full border ${
                                    log.category === 'alta_baja_proyecto'
                                      ? 'bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                                      : log.category === 'cobros_finanzas'
                                      ? 'bg-amber-50 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                                      : 'bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'
                                  }`}
                                >
                                  {log.actionTitle}
                                </span>
                              </td>
                              <td className="py-3 px-4 font-mono text-[11px]">
                                {log.orderId && (
                                  <span className="font-bold text-indigo-600 dark:text-indigo-400 mr-1.5">
                                    {log.orderId}
                                  </span>
                                )}
                                {log.targetEmployeeName && (
                                  <span className="font-sans font-semibold text-slate-800 dark:text-slate-200">
                                    → {log.targetEmployeeName}
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-slate-600 dark:text-slate-300 max-w-md">
                                {log.details}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
