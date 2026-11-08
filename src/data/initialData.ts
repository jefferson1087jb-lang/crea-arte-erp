export type RoleId = 'admin' | 'sales' | 'designer' | 'operator';

export function getNowTimestamp(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

export function getTodayDateStr(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export interface UserProfile {
  id: string;
  name: string;
  role: RoleId;
  roleLabel: string;
  department: 'Diseño' | 'Impresión/Corte' | 'Taller/Armado' | 'Instalación' | 'Comercial' | 'Dirección';
  specialty: string;
  hourlyCost: number;
  phone: string;
  active: boolean;
}

export type OrderStage =
  | 'Cotizado / Anticipo Pendiente'
  | 'En Diseño y Arte'
  | 'Aprobación del Cliente'
  | 'En Cola de Impresión/Corte'
  | 'Acabados y Armado 3D'
  | 'Instalación / Listo para Retiro'
  | 'Finalizado y Liquidado';

export const ORDER_STAGES: OrderStage[] = [
  'Cotizado / Anticipo Pendiente',
  'En Diseño y Arte',
  'Aprobación del Cliente',
  'En Cola de Impresión/Corte',
  'Acabados y Armado 3D',
  'Instalación / Listo para Retiro',
  'Finalizado y Liquidado',
];

export type CrmLeadStage =
  | 'Lead Entrante (Meta Ads)'
  | 'Nuevo Lead (Sin Responder)'
  | 'En Calificación / Consultando'
  | 'En Calificación / Medidas'
  | 'Cotización Enviada'
  | 'Esperando Anticipo / Cierre'
  | 'Cliente en Producción Activa'
  | 'Cerrado / En Producción'
  | 'Post-Venta / Recurrente'
  | 'Perdido / Sin Presupuesto';

export const CRM_LEAD_STAGES: CrmLeadStage[] = [
  'Lead Entrante (Meta Ads)',
  'En Calificación / Consultando',
  'Cotización Enviada',
  'Esperando Anticipo / Cierre',
  'Cliente en Producción Activa',
  'Post-Venta / Recurrente',
];

export interface MetaAdReferralInfo {
  sourceUrl?: string;      // referral.source_url
  sourceId?: string;       // referral.source_id (ID del anuncio/post)
  sourceType?: string;     // 'ad' | 'post' | 'leadgen_form'
  headline?: string;       // referral.headline (Título del anuncio)
  body?: string;           // referral.body
  ctwaClid?: string;       // referral.ctwa_clid (Click ID de Meta Ads)
  campaignName?: string;
  receivedAt?: string;
}

export type ServiceCategory =
  | 'Gran Formato / Gigantografía'
  | 'Viniles'
  | 'Rótulos 3D y Estructurados'
  | 'Corte y Grabado Láser / CNC'
  | 'Sublimación y Merchandising'
  | 'Señalética y Merchandising'
  | 'Diseño Gráfico y Branding';

export function isDesignOnlyOrder(
  order: Pick<WorkOrder, 'category' | 'materialId'>
): boolean {
  return (
    order.category === 'Diseño Gráfico y Branding' ||
    order.materialId.startsWith('mat-diseno-')
  );
}

export interface CatalogMaterial {
  id: string;
  name: string;
  category: ServiceCategory;
  unit: 'm2' | 'ml' | 'metro_lineal' | 'plancha' | 'unidad' | 'minuto';
  pricingMode?: 'area' | 'time_minutes' | 'volume_scale';
  defaultLaserRatePerMin?: number;
  baseCostPerUnit: number;
  suggestedPricePerUnit: number;
  inventoryItemId: string;
  description: string;
}

export interface TimeLogEntry {
  id: string;
  orderId: string;
  employeeId: string;
  phase: 'design' | 'machine' | 'installation';
  minutes: number;
  date: string;
  note: string;
}

export type ProjectTaskRole =
  | 'Diseño y Pre-prensa'
  | 'Impresión / Corte'
  | 'Taller / Soldadura / Armado'
  | 'Instalación y Montaje'
  | 'Supervisión / Comercial';

export const PROJECT_TASK_ROLES: ProjectTaskRole[] = [
  'Diseño y Pre-prensa',
  'Impresión / Corte',
  'Taller / Soldadura / Armado',
  'Instalación y Montaje',
  'Supervisión / Comercial',
];

export interface ProjectAssignment {
  userId: string;
  taskRole: ProjectTaskRole;
  status: 'active' | 'completed'; // 'active' = En curso; 'completed' = Finalizó su trabajo / Dado de baja del proyecto
  assignedAt: string;
  assignedBy?: string;
  completedAt?: string;
  completedBy?: string;
  closingNote?: string;
  isShiftPaused?: boolean;
  pausedAt?: string;
  accumulatedPausedSeconds?: number;
}

export interface InstallationChecklistState {
  electricalPointVerified: boolean;
  ladderOrScaffoldingReady: boolean;
  locationConfirmed: boolean;
  updatedAt?: string;
  updatedBy?: string;
  powerVerified?: boolean;
  ladderReady?: boolean;
}

export interface QuoteLineItem {
  id: string;
  title: string;
  category: ServiceCategory;
  materialId?: string;
  materialName: string;
  dimensionsText: string;
  finishingsText: string;
  finishings?: string[];
  quantity: number;
  widthM?: number;
  heightM?: number;
  totalAreaM2?: number;
  laserMinutes?: number;
  sizesAndColors?: string;
  unitPrice: number;
  lineTotal: number;
}

export interface WorkOrder {
  id: string; // #CA-001
  clientName: string;
  clientRuc: string;
  clientPhone: string;
  title: string;
  category: ServiceCategory;
  materialId: string;
  materialName: string;
  widthM: number;
  heightM: number;
  quantity: number;
  totalAreaM2: number;
  laserMinutes?: number;
  laserRatePerMin?: number;
  sizesAndColors?: string;
  volumeDiscountPct?: number;
  installationChecklist?: InstallationChecklistState;
  lineItems?: QuoteLineItem[];
  finishings: string[];
  stage: OrderStage;
  createdAt: string;
  deadline: string;
  designerId: string;
  operatorId: string;
  installerId: string;
  additionalAssignees?: string[];
  teamAssignments?: ProjectAssignment[];
  estimatedDesignHours: number;
  estimatedMachineHours: number;
  estimatedInstallHours: number;
  rawMaterialCost: number;
  wastePercent: number;
  installationFee: number;
  subtotal: number;
  discount: number;
  includeIva: boolean;
  totalPrice: number;
  paidAmount: number;
  artworkUrl: string;
  artworkApproved: boolean;
  stockDeducted: boolean;
  notes: string;
  // CRM Multiusuario: Agente responsable actual de la conversación y alertas de respuesta
  assignedCrmAgentId?: string;
  unreadClientReplies?: number;
  // Integración Google Drive por Proyecto
  driveFolderId?: string;
  driveFolderName?: string;
  driveFolderUrl?: string;
  driveFiles?: ProjectDriveFileRecord[];
  // Despiece Técnico del Optimizador 2D
  cutOptimizationSummary?: CutOptimizationSummary;
  // CRM Meta Ads y Embudo Comercial de Mensajes
  crmLeadStage?: CrmLeadStage;
  adReferral?: MetaAdReferralInfo;
  isMetaAdLead?: boolean;
}

export interface CutOptimizationSummary {
  mode: 'roll' | 'sheet';
  pieceWidthCm: number;
  pieceHeightCm: number;
  quantity: number;
  orientation: 'normal' | 'rotated';
  rollWidthM?: number;
  linearMeters?: number;
  sheetsNeeded?: number;
  piecesPerSheet?: number;
  utilizationPct: number;
  wastePct: number;
  offcutRightCm?: number;
  offcutBottomCm?: number;
  sideScrapCm?: number;
  savedAt: string;
  savedBy: string;
}

export interface ReusableOffcut {
  id: string;
  materialId: string;
  materialName: string;
  widthCm: number;
  heightCm: number;
  thicknessMm: number;
  sourceOrderId?: string;
  createdAt: string;
  createdBy: string;
  status: 'Disponible' | 'Utilizado';
  usedInOrderId?: string;
  usedAt?: string;
  notes?: string;
}

export interface QuoterTransferPayload {
  mode: 'roll' | 'sheet';
  orderId?: string;
  widthM: number;
  heightM: number;
  quantity: number;
  wastePct: number;
  summaryNote: string;
}

export interface ProjectDriveFileRecord {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes?: number;
  webViewLink: string;
  uploadedBy: string;
  uploadedAt?: string;
  createdTime?: string;
}

/**
 * Normaliza y devuelve siempre la lista de responsables asignados a una orden,
 * incluyendo su estado (activo en el proyecto vs dado de baja tras finalizar su trabajo).
 */
export function getOrderTeamAssignments(order: WorkOrder): ProjectAssignment[] {
  if (order.teamAssignments && order.teamAssignments.length > 0) {
    const seen = new Set<string>();
    return order.teamAssignments.filter((a) => {
      if (seen.has(a.userId)) return false;
      seen.add(a.userId);
      return true;
    });
  }

  const fallback: ProjectAssignment[] = [];
  const addedUserIds = new Set<string>();
  const baseDate = (order.createdAt || '2026-10-16T09:00:00').slice(0, 16).replace('T', ' ');
  const isFinished = order.stage === 'Finalizado y Liquidado';
  const isPastDesign =
    order.stage === 'En Cola de Impresión/Corte' ||
    order.stage === 'Acabados y Armado 3D' ||
    order.stage === 'Instalación / Listo para Retiro' ||
    isFinished;
  const isPastWorkshop = order.stage === 'Instalación / Listo para Retiro' || isFinished;

  if (order.designerId && !addedUserIds.has(order.designerId)) {
    addedUserIds.add(order.designerId);
    fallback.push({
      userId: order.designerId,
      taskRole: 'Diseño y Pre-prensa',
      status: isPastDesign ? 'completed' : 'active',
      assignedAt: baseDate,
      completedAt: isPastDesign ? '2026-10-15 16:30' : undefined,
      closingNote: isPastDesign ? 'Arte aprobado y enviado a cola RIP' : undefined,
    });
  }

  if (order.operatorId && !addedUserIds.has(order.operatorId)) {
    addedUserIds.add(order.operatorId);
    fallback.push({
      userId: order.operatorId,
      taskRole:
        order.category === 'Rótulos 3D y Estructurados'
          ? 'Taller / Soldadura / Armado'
          : 'Impresión / Corte',
      status: isPastWorkshop ? 'completed' : 'active',
      assignedAt: baseDate,
      completedAt: isPastWorkshop ? '2026-10-16 12:15' : undefined,
      closingNote: isPastWorkshop ? 'Producción en máquina completada' : undefined,
    });
  }

  if (order.installerId && !addedUserIds.has(order.installerId)) {
    addedUserIds.add(order.installerId);
    fallback.push({
      userId: order.installerId,
      taskRole: 'Instalación y Montaje',
      status: isFinished ? 'completed' : 'active',
      assignedAt: baseDate,
      completedAt: isFinished ? '2026-10-14 17:45' : undefined,
      closingNote: isFinished ? 'Acta de entrega e instalación firmada' : undefined,
    });
  }

  return fallback;
}

const APP_BOOT_REAL_MS = Date.now();
const SYSTEM_BASE_SIM_MS = new Date('2026-10-16T20:15:00').getTime();

/**
 * Devuelve el timestamp actual sincronizado con las órdenes del sistema,
 * avanzando segundo a segundo en tiempo real mientras la aplicación está abierta.
 */
export function getLiveSimulationNowMs(): number {
  return SYSTEM_BASE_SIM_MS + (Date.now() - APP_BOOT_REAL_MS);
}

/**
 * Formatea el instante actual en formato 'YYYY-MM-DD HH:mm:ss' para registrar altas y bajas exactas.
 */
export function getLiveSimulationDateTimeStr(): string {
  const d = new Date(getLiveSimulationNowMs());
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
}

export function parseAssignmentDateMs(dateStr?: string): number {
  if (!dateStr) return SYSTEM_BASE_SIM_MS;
  const normalized = dateStr.trim().replace(' ', 'T');
  const parsed = new Date(normalized).getTime();
  return Number.isNaN(parsed) ? SYSTEM_BASE_SIM_MS : parsed;
}

/**
 * Calcula cuánto tiempo lleva un empleado dentro de un proyecto:
 * - Si status === 'active' (NO se ha dado de baja): el reloj sigue corriendo segundo a segundo en vivo.
 * - Si status === 'completed' (YA se dio de baja): el tiempo queda congelado entre assignedAt y completedAt.
 */
export function getAssignmentElapsedDuration(
  assignment: ProjectAssignment,
  nowSimMs: number = getLiveSimulationNowMs()
): {
  totalSeconds: number;
  totalHoursDecimal: number;
  formattedShort: string;
  formattedClock: string;
  effectiveSeconds: number;
  effectiveHoursDecimal: number;
  formattedEffective: string;
  pausedSeconds: number;
  isPaused: boolean;
  isRunning: boolean;
} {
  const startMs = parseAssignmentDateMs(assignment.assignedAt);
  const endMs =
    assignment.status === 'completed' && assignment.completedAt
      ? parseAssignmentDateMs(assignment.completedAt)
      : nowSimMs;

  const totalSeconds = Math.max(0, Math.floor((endMs - startMs) / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const totalHoursInt = Math.floor(totalSeconds / 3600);
  const formattedClock = `${String(totalHoursInt).padStart(2, '0')}h ${String(minutes).padStart(
    2,
    '0'
  )}m ${String(seconds).padStart(2, '0')}s`;

  const formattedShort =
    days > 0
      ? `${days}d ${hours}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`
      : `${hours}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;

  // Cálculo de Horas Laborales Efectivas descontando pausas de turno
  const basePausedSec = assignment.accumulatedPausedSeconds || 0;
  let currentPauseDeltaSec = 0;
  if (assignment.status === 'active' && assignment.isShiftPaused && assignment.pausedAt) {
    const pausedStartMs = parseAssignmentDateMs(assignment.pausedAt);
    currentPauseDeltaSec = Math.max(0, Math.floor((endMs - pausedStartMs) / 1000));
  }
  const pausedSeconds = Math.min(totalSeconds, basePausedSec + currentPauseDeltaSec);
  const effectiveSeconds = Math.max(0, totalSeconds - pausedSeconds);

  const effDays = Math.floor(effectiveSeconds / 86400);
  const effHours = Math.floor((effectiveSeconds % 86400) / 3600);
  const effMinutes = Math.floor((effectiveSeconds % 3600) / 60);
  const effSecs = effectiveSeconds % 60;
  const formattedEffective =
    effDays > 0
      ? `${effDays}d ${effHours}h ${String(effMinutes).padStart(2, '0')}m ${String(effSecs).padStart(2, '0')}s`
      : `${effHours}h ${String(effMinutes).padStart(2, '0')}m ${String(effSecs).padStart(2, '0')}s`;

  return {
    totalSeconds,
    totalHoursDecimal: Number((totalSeconds / 3600).toFixed(2)),
    formattedShort,
    formattedClock,
    effectiveSeconds,
    effectiveHoursDecimal: Number((effectiveSeconds / 3600).toFixed(2)),
    formattedEffective,
    pausedSeconds,
    isPaused: Boolean(assignment.status === 'active' && assignment.isShiftPaused),
    isRunning: assignment.status === 'active' && !assignment.isShiftPaused,
  };
}

export type InventoryCategory =
  | 'Bobinas y Rollos'
  | 'Planchas Rígidas'
  | 'Tintas y Consumibles'
  | 'Blancos y Merchandising (Unidades)';

export interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  category: InventoryCategory;
  unit: 'm2' | 'ml' | 'plancha' | 'litro' | 'unidad';
  rollWidthM?: number;
  rollLengthM?: number;
  sheetDimensions?: string;
  currentStock: number;
  minStock: number;
  unitCost: number;
  supplier: string;
  lastUpdated: string;
}

export interface InventoryMovement {
  id: string;
  itemId: string;
  itemName: string;
  type: 'entrada' | 'salida_orden' | 'merma_taller';
  quantity: number;
  unit: string;
  orderId?: string;
  userId: string;
  date: string;
  reason: string;
  costImpact: number;
}

export interface RestockRequest {
  id: string;
  itemId: string;
  itemName: string;
  requestedQty: number;
  unit: string;
  requestedBy: string;
  date: string;
  urgency: 'Normal' | 'Alta' | 'Crítica';
  status: 'Pendiente' | 'Aprobada / Comprada';
}

export interface PaymentAuditDetails {
  bankEntity?: string;
  referenceNumber?: string;
  invoiceOrDocNumber?: string;
  accountHolderOrNotes?: string;
}

export const BANK_ACCOUNTS_CATALOG: string[] = [
  'Banco Pichincha — Cta. Cte. #2100492811',
  'Banco Guayaquil — Cta. Cte. #0019283746',
  'Produbanco — Cta. Cte. #0200591823',
  'Banco del Pacífico — Cta. Ahorros #10492817',
  'Datafast / POS Tarjeta (Lote Comercio)',
  'Caja Fuerte / Efectivo Ventanilla',
  'Cheque Certificado / Endosado',
];

export interface CashTransaction {
  id: string;
  date: string;
  type: 'ingreso_anticipo' | 'ingreso_liquidacion' | 'gasto_chica';
  orderId?: string;
  concept: string;
  clientOrProvider: string;
  method: 'Efectivo' | 'Transferencia Bancaria' | 'Tarjeta';
  amount: number;
  registeredBy: string;
  bankEntity?: string;
  referenceNumber?: string;
  invoiceOrDocNumber?: string;
  accountHolderOrNotes?: string;
}

export interface MachineMaintenanceLog {
  id: string;
  machineId: string;
  date: string;
  taskType:
    | 'Limpieza de cabezal'
    | 'Cambio de dampers'
    | 'Cambio de cuchillas'
    | 'Calibración óptica/avance'
    | 'Engrase de rieles'
    | 'Mantenimiento preventivo general';
  technician: string;
  cost: number;
  notes: string;
}

export interface WorkshopMachine {
  id: string;
  code: string;
  name: string;
  type: 'Plotter de Impresión' | 'Plotter de Corte' | 'Laminadora' | 'Router CNC / Láser';
  brandModel: string;
  lastMaintenanceDate: string;
  recommendedIntervalDays: number;
  status: 'Operativo' | 'Atención Preventiva' | 'En Mantenimiento';
  totalHoursLogged: number;
}

export interface ChatMediaAttachment {
  type: 'image' | 'video' | 'audio' | 'document' | 'location' | 'contact' | 'interactive_poll';
  url: string;
  name: string;
  mimeType?: string;
  sizeBytes?: number;
  durationSec?: number;
  caption?: string;
  locationLat?: number;
  locationLng?: number;
  locationAddress?: string;
  pollOptions?: string[];
}

export interface ChatMessage {
  id: string;
  orderId: string;
  sender: 'client' | 'agent';
  senderName: string;
  text: string;
  timestamp: string;
  status: 'sent' | 'delivered' | 'read';
  channel: 'wa_direct' | 'meta_cloud_api';
  // Nota interna de equipo o mención (@usuario / múltiples usuarios / @todos) dentro de la conversación del CRM
  isInternalNote?: boolean;
  mentionedUserId?: string;
  mentionedUserIds?: string[];
  mentionAllTeam?: boolean;
  driveFileAttachment?: ProjectDriveFileRecord;
  mediaAttachment?: ChatMediaAttachment;
  adReferral?: MetaAdReferralInfo;
}

export interface WhatsAppApiConfig {
  mode: 'direct_wa_me' | 'meta_cloud_api';
  phoneNumberId: string;
  wabaId: string;
  accessToken: string;
  webhookUrl: string;
  verifyToken: string;
  autoSendStageNotifications: boolean;
  autoWelcomeOnOrderCreated?: boolean;
  autoSendArtApproval?: boolean;
  autoProcessClientKeywords?: boolean;
  autoNotifyProductionStart?: boolean;
  autoReceiptOnPayment?: boolean;
}

export const INITIAL_WA_CONFIG: WhatsAppApiConfig = {
  mode: 'direct_wa_me',
  phoneNumberId: '109482716509182',
  wabaId: '982736451092837',
  accessToken: 'EAAGm0PX4ZCpsBO7xK9qL2mZvP8xR4nS1wY6tH3jF0kL...',
  webhookUrl: 'https://api.crea-arte.ec/webhooks/meta-whatsapp-v21',
  verifyToken: 'CREA_ARTE_WEBHOOK_SECRET_2026',
  autoSendStageNotifications: true,
  autoWelcomeOnOrderCreated: true,
  autoSendArtApproval: true,
  autoProcessClientKeywords: true,
  autoNotifyProductionStart: true,
  autoReceiptOnPayment: true,
};

export const INITIAL_USERS: UserProfile[] = [
  {
    id: 'usr-admin',
    name: 'Ing. Carlos Mendoza',
    role: 'admin',
    roleLabel: 'Administrador / Gerente',
    department: 'Dirección',
    specialty: 'Dirección General, Finanzas, Costos & Meta Cloud API',
    hourlyCost: 18,
    phone: '+593 99 102 4400',
    active: true,
  },
  {
    id: 'usr-sales',
    name: 'Valeria Rojas',
    role: 'sales',
    roleLabel: 'Ventas / Atención',
    department: 'Comercial',
    specialty: 'Cotizaciones Comerciales, Cobros & CRM WhatsApp',
    hourlyCost: 10,
    phone: '+593 98 411 2901',
    active: true,
  },
  {
    id: 'usr-designer',
    name: 'Diego Vargas',
    role: 'designer',
    roleLabel: 'Diseñador / Pre-prensa',
    department: 'Diseño',
    specialty: 'Diseño Estructural 3D, Vectorizado & RIP Caldera',
    hourlyCost: 12,
    phone: '+593 99 882 3104',
    active: true,
  },
  {
    id: 'usr-operator',
    name: 'Mateo Silva',
    role: 'operator',
    roleLabel: 'Operador de Taller / Instalador',
    department: 'Impresión/Corte',
    specialty: 'Impresión Ecosolvente, Corte Plotter & Montaje en Sitio',
    hourlyCost: 11,
    phone: '+593 97 654 1190',
    active: true,
  },
  {
    id: 'usr-operator-2',
    name: 'Andrés Paredes',
    role: 'operator',
    roleLabel: 'Operador de Taller / Instalador',
    department: 'Taller/Armado',
    specialty: 'Armado Acrílico 3D, Router CNC, Soldadura & LED',
    hourlyCost: 11,
    phone: '+593 96 310 8821',
    active: true,
  },
  {
    id: 'usr-installer-3',
    name: 'Marco Cevallos',
    role: 'operator',
    roleLabel: 'Operador de Taller / Instalador',
    department: 'Instalación',
    specialty: 'Montaje en Altura, Andamiaje, Estructuras & Acometidas Eléctricas',
    hourlyCost: 11.5,
    phone: '+593 98 119 4020',
    active: true,
  },
];

export const INITIAL_INVENTORY: InventoryItem[] = [
  {
    id: 'inv-lona-front',
    sku: 'BOB-LF13-320',
    name: 'Bobina Lona Frontlight 13oz Brillante (3.20m x 50m)',
    category: 'Bobinas y Rollos',
    unit: 'm2',
    rollWidthM: 3.2,
    rollLengthM: 50,
    currentStock: 118.5,
    minStock: 40,
    unitCost: 2.15,
    supplier: 'Importadora Gráfica Andina',
    lastUpdated: '2026-10-15',
  },
  {
    id: 'inv-lona-back',
    sku: 'BOB-LB18-250',
    name: 'Bobina Lona Backlight 18oz Traslúcida UV (2.50m x 50m)',
    category: 'Bobinas y Rollos',
    unit: 'm2',
    rollWidthM: 2.5,
    rollLengthM: 50,
    currentStock: 26.0,
    minStock: 30,
    unitCost: 3.85,
    supplier: 'Importadora Gráfica Andina',
    lastUpdated: '2026-10-14',
  },
  {
    id: 'inv-lona-blackout',
    sku: 'BOB-BLK15-320',
    name: 'Bobina Lona Blackout Doble Cara (3.20m x 50m)',
    category: 'Bobinas y Rollos',
    unit: 'm2',
    rollWidthM: 3.2,
    rollLengthM: 50,
    currentStock: 84.0,
    minStock: 25,
    unitCost: 3.4,
    supplier: 'Suministros VisualPro',
    lastUpdated: '2026-10-12',
  },
  {
    id: 'inv-vinil-brillo',
    sku: 'VIN-ARC-152',
    name: 'Rollo Vinil Adhesivo Brillante Arclad (1.52m x 50m)',
    category: 'Bobinas y Rollos',
    unit: 'm2',
    rollWidthM: 1.52,
    rollLengthM: 50,
    currentStock: 62.4,
    minStock: 25,
    unitCost: 2.45,
    supplier: 'Arclad Distribuidor Oficial',
    lastUpdated: '2026-10-15',
  },
  {
    id: 'inv-vinil-micro',
    sku: 'VIN-MIC-152',
    name: 'Rollo Vinil Microperforado Homologado (1.52m x 50m)',
    category: 'Bobinas y Rollos',
    unit: 'm2',
    rollWidthM: 1.52,
    rollLengthM: 50,
    currentStock: 19.2,
    minStock: 20,
    unitCost: 4.1,
    supplier: 'Arclad Distribuidor Oficial',
    lastUpdated: '2026-10-13',
  },
  {
    id: 'inv-vinil-corte',
    sku: 'VIN-ORA651-127',
    name: 'Rollo Vinil de Corte Plotter Oracal 651 (1.27m x 50m)',
    category: 'Bobinas y Rollos',
    unit: 'm2',
    rollWidthM: 1.27,
    rollLengthM: 50,
    currentStock: 45.0,
    minStock: 15,
    unitCost: 3.9,
    supplier: 'Suministros VisualPro',
    lastUpdated: '2026-10-11',
  },
  {
    id: 'inv-laminado-uv',
    sku: 'LAM-UV-152',
    name: 'Rollo Laminado Protector UV Frío (1.52m x 50m)',
    category: 'Bobinas y Rollos',
    unit: 'm2',
    rollWidthM: 1.52,
    rollLengthM: 50,
    currentStock: 54.0,
    minStock: 20,
    unitCost: 1.95,
    supplier: 'Importadora Gráfica Andina',
    lastUpdated: '2026-10-14',
  },
  {
    id: 'inv-acrilico-3mm',
    sku: 'PLA-ACR3-122',
    name: 'Plancha Acrílico Cristal / Blanco Opal 3mm (1.22m x 2.44m)',
    category: 'Planchas Rígidas',
    unit: 'plancha',
    sheetDimensions: '1.22m x 2.44m',
    currentStock: 14,
    minStock: 6,
    unitCost: 42.0,
    supplier: 'Plásticos Industriales S.A.',
    lastUpdated: '2026-10-15',
  },
  {
    id: 'inv-acrilico-5mm',
    sku: 'PLA-ACR5-122',
    name: 'Plancha Acrílico Cristal 5mm Alta Densidad (1.22m x 2.44m)',
    category: 'Planchas Rígidas',
    unit: 'plancha',
    sheetDimensions: '1.22m x 2.44m',
    currentStock: 5,
    minStock: 5,
    unitCost: 68.0,
    supplier: 'Plásticos Industriales S.A.',
    lastUpdated: '2026-10-10',
  },
  {
    id: 'inv-alucobond-4mm',
    sku: 'PLA-ACM4-122',
    name: 'Plancha Alucobond / ACM 4mm Negro Mate / Plata (1.22m x 2.44m)',
    category: 'Planchas Rígidas',
    unit: 'plancha',
    sheetDimensions: '1.22m x 2.44m',
    currentStock: 9,
    minStock: 4,
    unitCost: 54.0,
    supplier: 'Alucomex Ecuador',
    lastUpdated: '2026-10-14',
  },
  {
    id: 'inv-pvc-sintra',
    sku: 'PLA-PVC3-122',
    name: 'Plancha PVC Espumado Sintra 3mm Blanco (1.22m x 2.44m)',
    category: 'Planchas Rígidas',
    unit: 'plancha',
    sheetDimensions: '1.22m x 2.44m',
    currentStock: 18,
    minStock: 8,
    unitCost: 19.5,
    supplier: 'Plásticos Industriales S.A.',
    lastUpdated: '2026-10-15',
  },
  {
    id: 'inv-tinta-eco',
    sku: 'TIN-ECO-DX5',
    name: 'Tinta Ecosolvente Roland / Epson DX5 (Set CMYK Litros)',
    category: 'Tintas y Consumibles',
    unit: 'litro',
    currentStock: 3.2,
    minStock: 2.0,
    unitCost: 65.0,
    supplier: 'TechPrint Insumos',
    lastUpdated: '2026-10-14',
  },
  {
    id: 'inv-modulos-led',
    sku: 'ELE-LED-IP68',
    name: 'Pack 100 Módulos LED 3-SMD Samsung IP68 + Fuente 12V 20A',
    category: 'Tintas y Consumibles',
    unit: 'unidad',
    currentStock: 4,
    minStock: 5,
    unitCost: 38.0,
    supplier: 'ElectroLED Mayorista',
    lastUpdated: '2026-10-13',
  },
  {
    id: 'inv-cinta-vhb',
    sku: 'CON-VHB-3M',
    name: 'Rollo Cinta Bifaz Estructural 3M VHB 19mm x 33m',
    category: 'Tintas y Consumibles',
    unit: 'unidad',
    currentStock: 11,
    minStock: 6,
    unitCost: 16.5,
    supplier: 'Ferretería Industrial Titan',
    lastUpdated: '2026-10-12',
  },
  {
    id: 'inv-tazas-sub',
    sku: 'SUB-TAZ-11OZ',
    name: 'Taza Cerámica AAA 11oz Blanca para Sublimación (Caja x36)',
    category: 'Blancos y Merchandising (Unidades)',
    unit: 'unidad',
    currentStock: 144,
    minStock: 36,
    unitCost: 1.15,
    supplier: 'Importadora SubliPrint Ecuador',
    lastUpdated: '2026-10-15',
  },
  {
    id: 'inv-gorras-sub',
    sku: 'SUB-GOR-TRK',
    name: 'Gorra Trucker / Acrílica Frente Blanco para Sublimación y DTF',
    category: 'Blancos y Merchandising (Unidades)',
    unit: 'unidad',
    currentStock: 85,
    minStock: 24,
    unitCost: 1.6,
    supplier: 'Importadora SubliPrint Ecuador',
    lastUpdated: '2026-10-15',
  },
  {
    id: 'inv-camisetas-sub',
    sku: 'SUB-CAM-DRY',
    name: 'Camiseta Polialgodón / DryFit Sublimable Blanca (Tallas S/M/L/XL)',
    category: 'Blancos y Merchandising (Unidades)',
    unit: 'unidad',
    currentStock: 110,
    minStock: 30,
    unitCost: 2.8,
    supplier: 'Textiles Publicitarios Andinos',
    lastUpdated: '2026-10-16',
  },
  {
    id: 'inv-termos-llaveros',
    sku: 'SUB-TER-500',
    name: 'Termo Aluminio / Acero Inox 600ml + Caja Individual Sublimable',
    category: 'Blancos y Merchandising (Unidades)',
    unit: 'unidad',
    currentStock: 48,
    minStock: 12,
    unitCost: 3.4,
    supplier: 'Importadora SubliPrint Ecuador',
    lastUpdated: '2026-10-14',
  },
];

export const CATALOG_MATERIALS: CatalogMaterial[] = [
  {
    id: 'mat-lona-front',
    name: 'Lona Frontlight 13oz Impresión Alta Resolución',
    category: 'Gran Formato / Gigantografía',
    unit: 'm2',
    baseCostPerUnit: 3.1,
    suggestedPricePerUnit: 8.5,
    inventoryItemId: 'inv-lona-front',
    description: 'Ideal para vallas exteriores, pancartas promocionales y rótulos tensados.',
  },
  {
    id: 'mat-lona-estructura',
    name: 'Rótulo Lona 13oz Tensada + Bastidor Metálico Tubo Galv. 1"',
    category: 'Gran Formato / Gigantografía',
    unit: 'm2',
    baseCostPerUnit: 14.0,
    suggestedPricePerUnit: 32.0,
    inventoryItemId: 'inv-lona-front',
    description: 'Estructura metálica soldada anticorrosiva con lona impresa tensada lista para instalar.',
  },
  {
    id: 'mat-lona-back',
    name: 'Lona Backlight 18oz Traslúcida Doble Pasada UV',
    category: 'Gran Formato / Gigantografía',
    unit: 'm2',
    baseCostPerUnit: 5.2,
    suggestedPricePerUnit: 14.5,
    inventoryItemId: 'inv-lona-back',
    description: 'Especial para cajas de luz retroiluminadas con colores vibrantes de noche.',
  },
  {
    id: 'mat-caja-luz-led',
    name: 'Caja de Luz Luminosa Completa (Estructura + Lona Backlight + LED)',
    category: 'Gran Formato / Gigantografía',
    unit: 'm2',
    baseCostPerUnit: 36.0,
    suggestedPricePerUnit: 85.0,
    inventoryItemId: 'inv-lona-back',
    description: 'Caja de luz en aluminio/tol con iluminación interna LED IP68, fuente 12V y lona UV.',
  },
  {
    id: 'mat-lona-blackout',
    name: 'Lona Blackout Bloqueo Solar / Pendones Doble Faz',
    category: 'Gran Formato / Gigantografía',
    unit: 'm2',
    baseCostPerUnit: 4.5,
    suggestedPricePerUnit: 12.0,
    inventoryItemId: 'inv-lona-blackout',
    description: 'Núcleo negro opaco que impide el paso de luz, apta para impresión frontal o doble cara.',
  },
  {
    id: 'mat-rollup-display',
    name: 'Roll-Up Publicitario Aluminio 0.85m × 2.00m + Lona / Pet + Bolso',
    category: 'Gran Formato / Gigantografía',
    unit: 'unidad',
    baseCostPerUnit: 18.0,
    suggestedPricePerUnit: 45.0,
    inventoryItemId: 'inv-lona-front',
    description: 'Display enrollable portátil en estructura de aluminio con impresión de alta resolución.',
  },
  {
    id: 'mat-vinil-adhesivo',
    name: 'Vinil Adhesivo Brillante / Mate Alta Adherencia',
    category: 'Viniles',
    unit: 'm2',
    baseCostPerUnit: 3.4,
    suggestedPricePerUnit: 10.0,
    inventoryItemId: 'inv-vinil-brillo',
    description: 'Vinil polimérico para vidrieras, murales corporativos, vehículos y etiquetas.',
  },
  {
    id: 'mat-vinil-laminado',
    name: 'Vinil Impreso + Laminado Protector UV (Brillo o Mate)',
    category: 'Viniles',
    unit: 'm2',
    baseCostPerUnit: 5.2,
    suggestedPricePerUnit: 13.5,
    inventoryItemId: 'inv-vinil-brillo',
    description: 'Mayor durabilidad frente al sol, rayones y limpieza frecuente en vitrinas o vehículos.',
  },
  {
    id: 'mat-vinil-micro',
    name: 'Vinil Microperforado Homologado Ventanas / Flotas',
    category: 'Viniles',
    unit: 'm2',
    baseCostPerUnit: 5.1,
    suggestedPricePerUnit: 14.0,
    inventoryItemId: 'inv-vinil-micro',
    description: 'Visibilidad unidireccional para fachadas de vidrio y transporte público.',
  },
  {
    id: 'mat-vinil-corte',
    name: 'Vinil de Corte Plotter Oracal 651 + Transfer',
    category: 'Viniles',
    unit: 'm2',
    baseCostPerUnit: 4.8,
    suggestedPricePerUnit: 15.0,
    inventoryItemId: 'inv-vinil-corte',
    description: 'Rotulación vectorial troquelada a precisión con papel o film de transferencia.',
  },
  {
    id: 'mat-rotulo-acrilico3d',
    name: 'Letras Corpóreas 3D en Acrílico 2mm/3mm/5mm + Iluminación LED',
    category: 'Rótulos 3D y Estructurados',
    unit: 'm2',
    baseCostPerUnit: 48.0,
    suggestedPricePerUnit: 135.0,
    inventoryItemId: 'inv-acrilico-3mm',
    description: 'Letras en bloque cortadas en láser con canto de acrílico, módulos LED IP68 y fuente.',
  },
  {
    id: 'mat-rotulo-alucobond',
    name: 'Fachada / Bandeja en Alucobond ACM 4mm Calado + Acrílico LED',
    category: 'Rótulos 3D y Estructurados',
    unit: 'm2',
    baseCostPerUnit: 56.0,
    suggestedPricePerUnit: 155.0,
    inventoryItemId: 'inv-alucobond-4mm',
    description: 'Estructura en panel de aluminio compuesto ruteado en CNC con respaldo luminoso.',
  },
  {
    id: 'mat-rotulo-pvc3d',
    name: 'Letras Corpóreas 3D en PVC Sintra 15mm/18mm Pintura Automotriz',
    category: 'Rótulos 3D y Estructurados',
    unit: 'm2',
    baseCostPerUnit: 28.0,
    suggestedPricePerUnit: 75.0,
    inventoryItemId: 'inv-pvc-sintra',
    description: 'Letras volumétricas macizas sin iluminación para interiores y recepciones.',
  },
  {
    id: 'mat-senaletica-pvc',
    name: 'Señalética Comercial / Industrial en PVC Sintra 3mm + Vinil Laminado',
    category: 'Señalética y Merchandising',
    unit: 'm2',
    baseCostPerUnit: 14.5,
    suggestedPricePerUnit: 38.0,
    inventoryItemId: 'inv-pvc-sintra',
    description: 'Placas rígidas impermeables con impresión digital y laminado protector UV.',
  },
  {
    id: 'mat-senaletica-acrilico',
    name: 'Placa Corporativa Acrílico Cristal 3mm/5mm + Vinil + Distanciadores',
    category: 'Señalética y Merchandising',
    unit: 'm2',
    baseCostPerUnit: 24.0,
    suggestedPricePerUnit: 65.0,
    inventoryItemId: 'inv-acrilico-3mm',
    description: 'Señalética ejecutiva en acrílico cortado en láser con 4 embellecedores de acero inox.',
  },
  {
    id: 'mat-diseno-logo',
    name: 'Creación de Logo Profesional + Manual de Identidad Corporativa',
    category: 'Diseño Gráfico y Branding',
    unit: 'unidad',
    baseCostPerUnit: 0,
    suggestedPricePerUnit: 120.0,
    inventoryItemId: '',
    description:
      'Servicio 100% digital: 3 propuestas conceptuales, vectorizado final (AI, EPS, PDF, SVG, PNG) y guía de color/tipografía. No consume stock físico.',
  },
  {
    id: 'mat-diseno-vector',
    name: 'Rediseño / Vectorizado de Logotipo y Pre-prensa Digital',
    category: 'Diseño Gráfico y Branding',
    unit: 'unidad',
    baseCostPerUnit: 0,
    suggestedPricePerUnit: 45.0,
    inventoryItemId: '',
    description:
      'Reconstrucción vectorial de alta precisión y entrega de archivos editables listos para imprenta o corte.',
  },
  {
    id: 'mat-diseno-pack',
    name: 'Pack Diseño Publicitario / Flyer / Menú / Kit Redes Sociales',
    category: 'Diseño Gráfico y Branding',
    unit: 'unidad',
    baseCostPerUnit: 0,
    suggestedPricePerUnit: 65.0,
    inventoryItemId: '',
    description:
      'Diseño gráfico publicitario listo para imprenta o publicación digital en formatos adaptados.',
  },
  {
    id: 'mat-laser-acrilico',
    name: 'Servicio Corte y Grabado Láser CO2 en Acrílico / MDF (Por Minuto + Material)',
    category: 'Corte y Grabado Láser / CNC',
    unit: 'minuto',
    pricingMode: 'time_minutes',
    defaultLaserRatePerMin: 0.6,
    baseCostPerUnit: 0.22,
    suggestedPricePerUnit: 0.6,
    inventoryItemId: 'inv-acrilico-3mm',
    description:
      'Cobro por tiempo de máquina ($0.60/minuto de corte/grabado láser) más el material o plancha utilizada.',
  },
  {
    id: 'mat-cnc-router',
    name: 'Servicio Ruteado y Calado CNC en Alucobond / PVC / MDF (Por Minuto + Material)',
    category: 'Corte y Grabado Láser / CNC',
    unit: 'minuto',
    pricingMode: 'time_minutes',
    defaultLaserRatePerMin: 0.75,
    baseCostPerUnit: 0.3,
    suggestedPricePerUnit: 0.75,
    inventoryItemId: 'inv-pvc-sintra',
    description:
      'Mecanizado y corte CNC en paneles rígidos tarificado por minuto efectivo de máquina más sustrato.',
  },
  {
    id: 'mat-sub-tazas',
    name: 'Tazas Cerámica 11oz Personalizadas Full Color (Sublimación)',
    category: 'Sublimación y Merchandising',
    unit: 'unidad',
    pricingMode: 'volume_scale',
    baseCostPerUnit: 1.45,
    suggestedPricePerUnit: 3.5,
    inventoryItemId: 'inv-tazas-sub',
    description:
      'Taza blanca AAA sublimada full color con caja individual. Descuento automático: Docena 12+ (-12%), Ciento 100+ (-25%).',
  },
  {
    id: 'mat-sub-camisetas',
    name: 'Camisetas Personalizadas Sublimación / DTF Textil (Por Tallas y Colores)',
    category: 'Sublimación y Merchandising',
    unit: 'unidad',
    pricingMode: 'volume_scale',
    baseCostPerUnit: 3.5,
    suggestedPricePerUnit: 8.5,
    inventoryItemId: 'inv-camisetas-sub',
    description:
      'Camiseta corporativa o promocional estampada. Descuento automático: Docena 12+ (-12%), Ciento 100+ (-25%).',
  },
  {
    id: 'mat-sub-gorras',
    name: 'Gorras Publicitarias Trucker / Acrílicas Personalizadas',
    category: 'Sublimación y Merchandising',
    unit: 'unidad',
    pricingMode: 'volume_scale',
    baseCostPerUnit: 1.9,
    suggestedPricePerUnit: 4.5,
    inventoryItemId: 'inv-gorras-sub',
    description:
      'Gorras promocionales con logo frontal en sublimación o DTF. Descuento automático: Docena 12+ (-12%), Ciento 100+ (-25%).',
  },
  {
    id: 'mat-sub-termos',
    name: 'Termos Metálicos 600ml / Jarros Térmicos Personalizados',
    category: 'Sublimación y Merchandising',
    unit: 'unidad',
    pricingMode: 'volume_scale',
    baseCostPerUnit: 3.8,
    suggestedPricePerUnit: 9.0,
    inventoryItemId: 'inv-termos-llaveros',
    description:
      'Termos corporativos grabados o sublimados. Descuento automático: Docena 12+ (-12%), Ciento 100+ (-25%).',
  },
];

export const INITIAL_ORDERS: WorkOrder[] = [
  {
    id: '#CA-008',
    clientName: 'Cafetería & Tostaduría Origen Andino',
    clientRuc: '1793004192001',
    clientPhone: '+593 98 310 4491',
    title: 'Creación de Logo Corporativo + Manual de Identidad y Vectorizado Editables',
    category: 'Diseño Gráfico y Branding',
    materialId: 'mat-diseno-logo',
    materialName: 'Creación de Logo Profesional + Manual de Identidad Corporativa',
    widthM: 1,
    heightM: 1,
    quantity: 1,
    totalAreaM2: 1,
    finishings: [
      'Manual de Marca Corporativo PDF',
      'Pack Editables Vectoriales (AI / EPS / SVG / PDF)',
      'Mockups 3D Presentación',
    ],
    stage: 'Aprobación del Cliente',
    createdAt: '2026-10-15T10:30:00',
    deadline: '2026-10-18T17:00:00',
    designerId: 'usr-designer',
    operatorId: 'usr-designer',
    installerId: 'usr-designer',
    teamAssignments: [
      {
        userId: 'usr-designer',
        taskRole: 'Diseño y Pre-prensa',
        status: 'active',
        assignedAt: '2026-10-15 10:30',
      },
    ],
    estimatedDesignHours: 5.0,
    estimatedMachineHours: 0,
    estimatedInstallHours: 0,
    rawMaterialCost: 0,
    wastePercent: 0,
    installationFee: 0,
    subtotal: 140.0,
    discount: 0,
    includeIva: true,
    totalPrice: 161.0,
    paidAmount: 80.5,
    artworkUrl: 'https://crea-arte.internal/artes/CA-008_Propuestas_Logo_OrigenAndino_v2.pdf',
    artworkApproved: false,
    stockDeducted: true,
    notes:
      'Servicio 100% digital (Solo Diseño). Al aprobar el cliente la propuesta #2, salta directo de Aprobación a Entrega Digital de Editables (sin pasar por Impresión ni Taller).',
  },
  {
    id: '#CA-001',
    clientName: 'Grupo Automotriz Vallejo S.A.',
    clientRuc: '1792345011001',
    clientPhone: '+593 99 312 8840',
    title: 'Rótulo Corpóreo 3D Alucobond + Letras Acrílico LED ShowRoom',
    category: 'Rótulos 3D y Estructurados',
    materialId: 'mat-rotulo-alucobond',
    materialName: 'Fachada / Bandeja en Alucobond ACM 4mm Calado + Acrílico',
    widthM: 4.8,
    heightM: 1.2,
    quantity: 1,
    totalAreaM2: 5.76,
    finishings: [
      'Letras corpóreas acrílico 3mm',
      'Módulos LED Samsung IP68',
      'Fuente hermética 12V',
      'Estructura metálica anticorrosiva',
    ],
    stage: 'Acabados y Armado 3D',
    createdAt: '2026-10-12T09:30:00',
    deadline: '2026-10-17T11:00:00',
    designerId: 'usr-designer',
    operatorId: 'usr-operator-2',
    installerId: 'usr-installer-3',
    teamAssignments: [
      {
        userId: 'usr-designer',
        taskRole: 'Diseño y Pre-prensa',
        status: 'completed',
        assignedAt: '2026-10-12 09:30',
        completedAt: '2026-10-13 17:20',
        closingNote: 'Planos 3D y vectores CNC aprobados; dado de baja de diseño.',
      },
      {
        userId: 'usr-operator',
        taskRole: 'Impresión / Corte',
        status: 'completed',
        assignedAt: '2026-10-12 09:30',
        completedAt: '2026-10-15 11:45',
        closingNote: 'Corte de viniles translúcidos terminado.',
      },
      {
        userId: 'usr-operator-2',
        taskRole: 'Taller / Soldadura / Armado',
        status: 'active',
        assignedAt: '2026-10-12 09:30',
      },
      {
        userId: 'usr-installer-3',
        taskRole: 'Instalación y Montaje',
        status: 'active',
        assignedAt: '2026-10-12 09:30',
      },
    ],
    estimatedDesignHours: 4.0,
    estimatedMachineHours: 8.5,
    estimatedInstallHours: 5.0,
    rawMaterialCost: 348.5,
    wastePercent: 10,
    installationFee: 140.0,
    subtotal: 1032.8,
    discount: 32.8,
    includeIva: true,
    totalPrice: 1150.0,
    paidAmount: 600.0,
    artworkUrl: 'https://crea-arte.internal/artes/CA-001_Plano_ShowRoom_v3_APROBADO.pdf',
    artworkApproved: true,
    stockDeducted: true,
    notes: 'Instalación a 4.5m de altura en Av. 10 de Agosto. Requiere andamio de 2 cuerpos y punto eléctrico 110V.',
  },
  {
    id: '#CA-002',
    clientName: 'Clínica Dental Sonrisa Integral',
    clientRuc: '1718902234001',
    clientPhone: '+593 98 765 4321',
    title: 'Vinil Microperforado Fachada Frontal + Letras Acrílico Recepción',
    category: 'Viniles',
    materialId: 'mat-vinil-micro',
    materialName: 'Vinil Microperforado Homologado Ventanas / Flotas',
    widthM: 3.0,
    heightM: 2.2,
    quantity: 2,
    totalAreaM2: 13.2,
    finishings: ['Corte a medida de ventanales', 'Desmontaje de vinil antiguo', 'Instalación en sitio'],
    stage: 'Instalación / Listo para Retiro',
    createdAt: '2026-10-11T14:15:00',
    deadline: '2026-10-16T15:00:00',
    designerId: 'usr-designer',
    operatorId: 'usr-operator',
    installerId: 'usr-installer-3',
    teamAssignments: [
      {
        userId: 'usr-designer',
        taskRole: 'Diseño y Pre-prensa',
        status: 'completed',
        assignedAt: '2026-10-11 14:15',
        completedAt: '2026-10-12 16:00',
        closingNote: 'Arte microperforado listo y entregado a impresión.',
      },
      {
        userId: 'usr-operator',
        taskRole: 'Impresión / Corte',
        status: 'completed',
        assignedAt: '2026-10-11 14:15',
        completedAt: '2026-10-15 18:10',
        closingNote: '13.2 m² impresos y refilados listos para montaje.',
      },
      {
        userId: 'usr-installer-3',
        taskRole: 'Instalación y Montaje',
        status: 'active',
        assignedAt: '2026-10-11 14:15',
      },
    ],
    estimatedDesignHours: 2.0,
    estimatedMachineHours: 3.0,
    estimatedInstallHours: 3.5,
    rawMaterialCost: 72.6,
    wastePercent: 8,
    installationFee: 65.0,
    subtotal: 250.0,
    discount: 0,
    includeIva: true,
    totalPrice: 287.5,
    paidAmount: 140.0,
    artworkUrl: 'https://crea-arte.internal/artes/CA-002_Vidriera_Clinica_FINAL.pdf',
    artworkApproved: true,
    stockDeducted: true,
    notes: 'Material ya impreso y cortado. Pendiente cancelar saldo de $147.50 antes de despachar equipo de instalación.',
  },
  {
    id: '#CA-003',
    clientName: 'Supermercados El Ahorro',
    clientRuc: '1790019283001',
    clientPhone: '+593 99 554 1029',
    title: 'Lonas Frontlight Campaña Aniversario (12 Sucursales)',
    category: 'Gran Formato / Gigantografía',
    materialId: 'mat-lona-front',
    materialName: 'Lona Frontlight 13oz Impresión Alta Resolución',
    widthM: 3.0,
    heightM: 1.5,
    quantity: 12,
    totalAreaM2: 54.0,
    finishings: ['Ojalillos metálicos cada 50cm', 'Refuerzo perimetral termosellado'],
    stage: 'En Cola de Impresión/Corte',
    createdAt: '2026-10-14T10:00:00',
    deadline: '2026-10-19T17:00:00',
    designerId: 'usr-designer',
    operatorId: 'usr-operator',
    installerId: 'usr-operator',
    estimatedDesignHours: 1.5,
    estimatedMachineHours: 6.0,
    estimatedInstallHours: 0,
    rawMaterialCost: 179.8,
    wastePercent: 7,
    installationFee: 0,
    subtotal: 459.0,
    discount: 19.0,
    includeIva: true,
    totalPrice: 506.0,
    paidAmount: 253.0,
    artworkUrl: 'https://crea-arte.internal/artes/CA-003_Lonas_Aniversario_RIP.tiff',
    artworkApproved: true,
    stockDeducted: true,
    notes: 'Cliente retira en taller. Empacar individualmente con etiqueta de sucursal.',
  },
  {
    id: '#CA-004',
    clientName: 'Restaurante Brasas & Leña',
    clientRuc: '1723094812001',
    clientPhone: '+593 97 901 2345',
    title: 'Caja de Luz Backlight Doble Cara + Menú Boards Sintra',
    category: 'Gran Formato / Gigantografía',
    materialId: 'mat-lona-back',
    materialName: 'Lona Backlight 18oz Traslúcida Doble Pasada UV',
    widthM: 2.4,
    heightM: 1.1,
    quantity: 2,
    totalAreaM2: 5.28,
    finishings: [
      'Impresión doble pasada densidad 200%',
      'Tensado en estructura existente',
      'Laminado UV Mate en menús',
    ],
    stage: 'Aprobación del Cliente',
    createdAt: '2026-10-15T11:20:00',
    deadline: '2026-10-18T18:00:00',
    designerId: 'usr-designer',
    operatorId: 'usr-operator-2',
    installerId: 'usr-installer-3',
    estimatedDesignHours: 3.5,
    estimatedMachineHours: 2.5,
    estimatedInstallHours: 2.0,
    rawMaterialCost: 42.1,
    wastePercent: 10,
    installationFee: 45.0,
    subtotal: 195.0,
    discount: 0,
    includeIva: true,
    totalPrice: 224.25,
    paidAmount: 115.0,
    artworkUrl: 'https://crea-arte.internal/artes/CA-004_Propuesta_Menu_v2.pdf',
    artworkApproved: false,
    stockDeducted: false,
    notes: 'Se envió arte por WhatsApp. Esperando confirmación de precios del menú antes de pasar a RIP.',
  },
  {
    id: '#CA-005',
    clientName: 'Constructora Horizonte Urbano',
    clientRuc: '1798827165001',
    clientPhone: '+593 99 441 7782',
    title: 'Kit 24 Señaléticas de Seguridad Industrial ISO en PVC Sintra 3mm',
    category: 'Señalética y Merchandising',
    materialId: 'mat-senaletica-pvc',
    materialName: 'Señalética Comercial / Industrial en PVC Sintra 3mm + Vinil Laminado',
    widthM: 0.6,
    heightM: 0.4,
    quantity: 24,
    totalAreaM2: 5.76,
    finishings: [
      'Laminado Protector UV Brillo',
      'Cinta estructural 3M VHB al dorso',
      'Perforaciones en esquinas',
    ],
    stage: 'En Diseño y Arte',
    createdAt: '2026-10-16T08:45:00',
    deadline: '2026-10-17T16:00:00',
    designerId: 'usr-designer',
    operatorId: 'usr-operator',
    installerId: 'usr-operator',
    estimatedDesignHours: 2.5,
    estimatedMachineHours: 3.0,
    estimatedInstallHours: 0,
    rawMaterialCost: 92.4,
    wastePercent: 8,
    installationFee: 0,
    subtotal: 240.0,
    discount: 10.0,
    includeIva: true,
    totalPrice: 264.5,
    paidAmount: 150.0,
    artworkUrl: '',
    artworkApproved: false,
    stockDeducted: false,
    notes: 'Incluir logo de Constructora Horizonte en franja inferior de cada señalética según norma INEN.',
  },
  {
    id: '#CA-006',
    clientName: 'Gimnasio CrossFit Titan',
    clientRuc: '1715543987001',
    clientPhone: '+593 98 220 9183',
    title: 'Murales Motivacionales en Vinil Mate Laminado + Vinil de Corte Vidrios',
    category: 'Viniles',
    materialId: 'mat-vinil-adhesivo',
    materialName: 'Vinil Adhesivo Brillante / Mate Alta Adherencia',
    widthM: 4.5,
    heightM: 2.4,
    quantity: 2,
    totalAreaM2: 21.6,
    finishings: [
      'Laminado Protector UV Mate antirreflejo',
      'Instalación sobre pared empastada sellada',
    ],
    stage: 'Cotizado / Anticipo Pendiente',
    createdAt: '2026-10-16T12:10:00',
    deadline: '2026-10-21T15:00:00',
    designerId: 'usr-designer',
    operatorId: 'usr-operator',
    installerId: 'usr-installer-3',
    estimatedDesignHours: 3.0,
    estimatedMachineHours: 4.0,
    estimatedInstallHours: 4.0,
    rawMaterialCost: 118.5,
    wastePercent: 10,
    installationFee: 85.0,
    subtotal: 340.0,
    discount: 0,
    includeIva: true,
    totalPrice: 391.0,
    paidAmount: 0,
    artworkUrl: '',
    artworkApproved: false,
    stockDeducted: false,
    notes: 'Cotización aprobada verbalmente. En espera de transferencia del 50% de anticipo para iniciar diseño.',
    crmLeadStage: 'Esperando Anticipo / Cierre',
    isMetaAdLead: true,
    adReferral: {
      sourceUrl: 'https://fb.me/ctwa-crea-arte-viniles-2026',
      sourceId: '1202149876543201',
      sourceType: 'ad',
      headline: 'Campaña Viniles Corporativos & Murales HD - Instalación Incluida',
      body: 'Cotiza la renovación visual de tu local comercial o gimnasio hoy.',
      ctwaClid: 'ARZ9x8K2mLpQ7vW1_CTWA_2026',
      campaignName: 'Meta Ads — Remodelación Locales Q4',
      receivedAt: '2026-10-16 12:05',
    },
  },
  {
    id: '#CA-007',
    clientName: 'Farmacias Medicity Express',
    clientRuc: '1791122334001',
    clientPhone: '+593 99 876 1122',
    title: 'Letrero Acrílico Iluminado 3D + Señalética Turnero',
    category: 'Rótulos 3D y Estructurados',
    materialId: 'mat-rotulo-acrilico3d',
    materialName: 'Letras Corpóreas 3D en Acrílico 2mm/3mm/5mm + Iluminación LED',
    widthM: 2.5,
    heightM: 0.8,
    quantity: 1,
    totalAreaM2: 2.0,
    finishings: [
      'Acrílico termoformado',
      'LED Samsung Blanco Frío 6500K',
      'Instalación nocturna centro comercial',
    ],
    stage: 'Finalizado y Liquidado',
    createdAt: '2026-10-08T09:00:00',
    deadline: '2026-10-14T18:00:00',
    designerId: 'usr-designer',
    operatorId: 'usr-operator-2',
    installerId: 'usr-installer-3',
    estimatedDesignHours: 2.5,
    estimatedMachineHours: 5.0,
    estimatedInstallHours: 3.0,
    rawMaterialCost: 112.0,
    wastePercent: 8,
    installationFee: 70.0,
    subtotal: 340.0,
    discount: 0,
    includeIva: true,
    totalPrice: 391.0,
    paidAmount: 391.0,
    artworkUrl: 'https://crea-arte.internal/artes/CA-007_Medicity_Entregado.pdf',
    artworkApproved: true,
    stockDeducted: true,
    notes: 'Entregado e instalado con acta de conformidad firmada.',
  },
];

export const INITIAL_CHAT_MESSAGES: ChatMessage[] = [
  {
    id: 'msg-101',
    orderId: '#CA-002',
    sender: 'agent',
    senderName: 'Valeria Rojas (Ventas)',
    text: '¡Buenas tardes Dra. Morales! Le informamos desde Crea Arte que los 2 paños de Vinil Microperforado (3.0m x 2.2m) y las letras de recepción de su orden #CA-002 ya están listos en taller.',
    timestamp: '2026-10-16 14:10',
    status: 'read',
    channel: 'wa_direct',
  },
  {
    id: 'msg-102',
    orderId: '#CA-002',
    sender: 'client',
    senderName: 'Clínica Dental Sonrisa Integral',
    text: '¡Excelente noticia Valeria! ¿A qué hora puede venir el equipo de instalación hoy y cuánto nos queda pendiente de saldo?',
    timestamp: '2026-10-16 14:22',
    status: 'read',
    channel: 'wa_direct',
  },
  {
    id: 'msg-103',
    orderId: '#CA-002',
    sender: 'agent',
    senderName: 'Valeria Rojas (Ventas)',
    text: 'El saldo pendiente de liquidación es de $147.50 (Total $287.50 - Anticipo $140.00). Apenas nos envíe el comprobante de transferencia liberamos el despacho con nuestro instalador Marco Cevallos.',
    timestamp: '2026-10-16 14:25',
    status: 'read',
    channel: 'wa_direct',
  },
  {
    id: 'msg-201',
    orderId: '#CA-004',
    sender: 'agent',
    senderName: 'Diego Vargas (Pre-prensa)',
    text: 'Hola estimado cliente de Restaurante Brasas & Leña, adjuntamos la propuesta digital v2 de la Caja de Luz Backlight y los Menú Boards (#CA-004). Por favor revise precios y ortografía para enviarlo a impresión.',
    timestamp: '2026-10-16 11:30',
    status: 'delivered',
    channel: 'meta_cloud_api',
  },
  {
    id: 'msg-202',
    orderId: '#CA-004',
    sender: 'client',
    senderName: 'Restaurante Brasas & Leña',
    text: 'Hola Diego, estamos revisando los precios de los cortes premium con gerencia, en 30 minutos te damos el APROBADO definitivo.',
    timestamp: '2026-10-16 12:05',
    status: 'read',
    channel: 'meta_cloud_api',
  },
  {
    id: 'msg-301',
    orderId: '#CA-001',
    sender: 'client',
    senderName: 'Grupo Automotriz Vallejo S.A.',
    text: 'Estimados Crea Arte, ¿cómo avanza el armado del rótulo corpóreo de Alucobond #CA-001 para el ShowRoom? Ya tenemos autorizado el permiso de trabajo en altura para mañana.',
    timestamp: '2026-10-16 16:40',
    status: 'read',
    channel: 'meta_cloud_api',
  },
  {
    id: 'msg-302',
    orderId: '#CA-001',
    sender: 'agent',
    senderName: 'Ing. Carlos Mendoza',
    text: 'Buenas tardes Ing. Vallejo. La bandeja de Alucobond 4mm ya está ruteada y estamos terminando el cableado de los módulos LED Samsung IP68. Mañana 09:30 AM estará la cuadrilla en sitio.',
    timestamp: '2026-10-16 16:50',
    status: 'read',
    channel: 'meta_cloud_api',
  },
  {
    id: 'msg-401',
    orderId: '#CA-006',
    sender: 'agent',
    senderName: 'Valeria Rojas (Ventas)',
    text: 'Hola CrossFit Titan, le enviamos la cotización formal #CA-006 por los murales en vinil mate laminado ($391.00 IVA incluido). Con el 50% de anticipo ($195.50) iniciamos el diseño hoy mismo.',
    timestamp: '2026-10-16 12:30',
    status: 'delivered',
    channel: 'wa_direct',
  },
];

export const INITIAL_TIME_LOGS: TimeLogEntry[] = [
  {
    id: 'tl-1',
    orderId: '#CA-001',
    employeeId: 'usr-designer',
    phase: 'design',
    minutes: 225,
    date: '2026-10-13',
    note: 'Vectorizado de planos para ruteado CNC de Alucobond y despiece de letras 3D.',
  },
  {
    id: 'tl-2',
    orderId: '#CA-001',
    employeeId: 'usr-operator-2',
    phase: 'machine',
    minutes: 450,
    date: '2026-10-15',
    note: 'Corte láser de acrílico 3mm, doblado térmico de cantos y soldadura de bastidor.',
  },
  {
    id: 'tl-3',
    orderId: '#CA-002',
    employeeId: 'usr-designer',
    phase: 'design',
    minutes: 135,
    date: '2026-10-12',
    note: 'Ajuste de paneles y sangrado de 2cm para vidriera de 3 paños.',
  },
  {
    id: 'tl-4',
    orderId: '#CA-002',
    employeeId: 'usr-operator',
    phase: 'machine',
    minutes: 195,
    date: '2026-10-14',
    note: 'Impresión en vinil microperforado y secado forzado.',
  },
  {
    id: 'tl-5',
    orderId: '#CA-003',
    employeeId: 'usr-designer',
    phase: 'design',
    minutes: 80,
    date: '2026-10-14',
    note: 'Montaje en RIP Caldera con marcas de ojalillos.',
  },
  {
    id: 'tl-6',
    orderId: '#CA-003',
    employeeId: 'usr-operator',
    phase: 'machine',
    minutes: 210,
    date: '2026-10-16',
    note: 'Impresión de primeras 7 lonas y termosellado de bordes.',
  },
  {
    id: 'tl-7',
    orderId: '#CA-004',
    employeeId: 'usr-designer',
    phase: 'design',
    minutes: 190,
    date: '2026-10-15',
    note: 'Retoque fotográfico de platos y diagramación de menús.',
  },
  {
    id: 'tl-8',
    orderId: '#CA-007',
    employeeId: 'usr-designer',
    phase: 'design',
    minutes: 140,
    date: '2026-10-09',
    note: 'Arte final aprobado y trazado láser.',
  },
  {
    id: 'tl-9',
    orderId: '#CA-007',
    employeeId: 'usr-operator-2',
    phase: 'machine',
    minutes: 290,
    date: '2026-10-11',
    note: 'Armado de letras acrílicas y cableado serie-paralelo LED.',
  },
  {
    id: 'tl-10',
    orderId: '#CA-007',
    employeeId: 'usr-installer-3',
    phase: 'installation',
    minutes: 175,
    date: '2026-10-13',
    note: 'Montaje nocturno en local comercial sin novedades.',
  },
];

export const INITIAL_INVENTORY_MOVEMENTS: InventoryMovement[] = [
  {
    id: 'mov-1',
    itemId: 'inv-alucobond-4mm',
    itemName: 'Plancha Alucobond / ACM 4mm Negro Mate / Plata (1.22m x 2.44m)',
    type: 'salida_orden',
    quantity: 2,
    unit: 'plancha',
    orderId: '#CA-001',
    userId: 'usr-designer',
    date: '2026-10-14 10:15',
    reason: 'Descuento automático al pasar #CA-001 a producción (5.76 m²)',
    costImpact: 108.0,
  },
  {
    id: 'mov-2',
    itemId: 'inv-vinil-micro',
    itemName: 'Rollo Vinil Microperforado Homologado (1.52m x 50m)',
    type: 'salida_orden',
    quantity: 14.26,
    unit: 'm2',
    orderId: '#CA-002',
    userId: 'usr-designer',
    date: '2026-10-13 16:40',
    reason: 'Descuento automático al pasar #CA-002 a producción (incluye 8% merma)',
    costImpact: 58.47,
  },
  {
    id: 'mov-3',
    itemId: 'inv-lona-front',
    itemName: 'Bobina Lona Frontlight 13oz Brillante (3.20m x 50m)',
    type: 'salida_orden',
    quantity: 57.78,
    unit: 'm2',
    orderId: '#CA-003',
    userId: 'usr-designer',
    date: '2026-10-15 09:20',
    reason: 'Descuento automático al pasar #CA-003 a producción (54 m² + 7% merma)',
    costImpact: 124.23,
  },
  {
    id: 'mov-4',
    itemId: 'inv-lona-back',
    itemName: 'Bobina Lona Backlight 18oz Traslúcida UV (2.50m x 50m)',
    type: 'merma_taller',
    quantity: 1.8,
    unit: 'm2',
    orderId: '#CA-004',
    userId: 'usr-operator',
    date: '2026-10-15 15:10',
    reason: 'Prueba de perfil de color ICC doble pasada y calibración de avance',
    costImpact: 6.93,
  },
  {
    id: 'mov-5',
    itemId: 'inv-lona-front',
    itemName: 'Bobina Lona Frontlight 13oz Brillante (3.20m x 50m)',
    type: 'entrada',
    quantity: 160,
    unit: 'm2',
    userId: 'usr-admin',
    date: '2026-10-10 11:00',
    reason: 'Compra Factura #001-09422 - Importadora Gráfica Andina (1 Bobina 3.20x50m)',
    costImpact: 344.0,
  },
];

export const INITIAL_RESTOCK_REQUESTS: RestockRequest[] = [
  {
    id: 'req-1',
    itemId: 'inv-vinil-micro',
    itemName: 'Rollo Vinil Microperforado Homologado (1.52m x 50m)',
    requestedQty: 76,
    unit: 'm2',
    requestedBy: 'Mateo Silva (Operador)',
    date: '2026-10-16 09:15',
    urgency: 'Alta',
    status: 'Pendiente',
  },
  {
    id: 'req-2',
    itemId: 'inv-modulos-led',
    itemName: 'Pack 100 Módulos LED 3-SMD Samsung IP68 + Fuente 12V 20A',
    requestedQty: 6,
    unit: 'unidad',
    requestedBy: 'Andrés Paredes (Operador)',
    date: '2026-10-15 17:30',
    urgency: 'Crítica',
    status: 'Pendiente',
  },
];

export const INITIAL_CASH_TRANSACTIONS: CashTransaction[] = [
  {
    id: 'tx-1',
    date: '2026-10-16 09:30',
    type: 'ingreso_anticipo',
    orderId: '#CA-005',
    concept: 'Anticipo 57% Orden #CA-005 (24 Señaléticas PVC Sintra)',
    clientOrProvider: 'Constructora Horizonte Cía. Ltda.',
    method: 'Transferencia Bancaria',
    amount: 150.0,
    registeredBy: 'Valeria Rojas',
    bankEntity: 'Banco Pichincha — Cta. Cte. #2100492811',
    referenceNumber: 'SPI-99482716',
    invoiceOrDocNumber: 'FAC-001-002-0004819',
    accountHolderOrNotes: 'Cta. Origen: Constructora Horizonte Cía. Ltda. (Verificado en Banca Empresas)',
  },
  {
    id: 'tx-2',
    date: '2026-10-16 11:15',
    type: 'gasto_chica',
    orderId: '#CA-001',
    concept: 'Compra de pernos expansivos 3/8", discos de corte y electrodos 6011',
    clientOrProvider: 'Ferretería Industrial Titan',
    method: 'Efectivo',
    amount: 28.5,
    registeredBy: 'Ing. Carlos Mendoza',
    bankEntity: 'Caja Fuerte / Efectivo Ventanilla',
    referenceNumber: 'VALE-CAJA-089',
    invoiceOrDocNumber: 'FAC-002-001-0091823',
    accountHolderOrNotes: 'Entregado a Diego Vargas para instalación en concesionario',
  },
  {
    id: 'tx-3',
    date: '2026-10-16 14:20',
    type: 'ingreso_anticipo',
    orderId: '#CA-004',
    concept: 'Anticipo 50% Orden #CA-004 (Caja de Luz Backlight)',
    clientOrProvider: 'Restaurante Brasas del Norte',
    method: 'Efectivo',
    amount: 115.0,
    registeredBy: 'Valeria Rojas',
    bankEntity: 'Caja Fuerte / Efectivo Ventanilla',
    referenceNumber: 'REC-ING-0412',
    invoiceOrDocNumber: 'NV-001-001-0001204',
    accountHolderOrNotes: 'Pago en efectivo en mostrador por Sr. Jorge Andrade',
  },
  {
    id: 'tx-4',
    date: '2026-10-16 16:05',
    type: 'gasto_chica',
    concept: 'Solvente limpiador de cabezales DX5 (1 Litro) + Paños sin pelusa',
    clientOrProvider: 'TechPrint Insumos',
    method: 'Efectivo',
    amount: 34.0,
    registeredBy: 'Ing. Carlos Mendoza',
    bankEntity: 'Caja Fuerte / Efectivo Ventanilla',
    referenceNumber: 'VALE-CAJA-090',
    invoiceOrDocNumber: 'FAC-001-003-0044102',
    accountHolderOrNotes: 'Autorizado para mantenimiento preventivo Plotter DX5',
  },
  {
    id: 'tx-5',
    date: '2026-10-14 17:40',
    type: 'ingreso_liquidacion',
    orderId: '#CA-007',
    concept: 'Liquidación Saldo Final Orden #CA-007 (Letrero Acrílico 3D)',
    clientOrProvider: 'Farmacias Medicity Express',
    method: 'Tarjeta',
    amount: 191.0,
    registeredBy: 'Valeria Rojas',
    bankEntity: 'Datafast / POS Tarjeta (Lote Comercio)',
    referenceNumber: 'VOUCHER-481092 / AUT-8821',
    invoiceOrDocNumber: 'FAC-001-002-0004810 + RET-00192',
    accountHolderOrNotes: 'Tarjeta Corporativa Visa Produbanco · Retención 1.75% adjunta',
  },
  {
    id: 'tx-6',
    date: '2026-10-14 10:30',
    type: 'ingreso_anticipo',
    orderId: '#CA-003',
    concept: 'Anticipo 50% Orden #CA-003 (12 Lonas Campaña Aniversario)',
    clientOrProvider: 'Supermercados El Ahorro',
    method: 'Transferencia Bancaria',
    amount: 253.0,
    registeredBy: 'Valeria Rojas',
    bankEntity: 'Banco Guayaquil — Cta. Cte. #0019283746',
    referenceNumber: 'TRF-BG-77381920',
    invoiceOrDocNumber: 'FAC-001-002-0004805',
    accountHolderOrNotes: 'Transferencia interbancaria acreditada y conciliada',
  },
  {
    id: 'tx-7',
    date: '2026-10-12 11:00',
    type: 'ingreso_anticipo',
    orderId: '#CA-001',
    concept: 'Anticipo Inicial Orden #CA-001 (ShowRoom Alucobond 3D)',
    clientOrProvider: 'Grupo Automotriz Vallejo S.A.',
    method: 'Transferencia Bancaria',
    amount: 600.0,
    registeredBy: 'Valeria Rojas',
    bankEntity: 'Banco Pichincha — Cta. Cte. #2100492811',
    referenceNumber: 'SPI-88371044',
    invoiceOrDocNumber: 'FAC-001-002-0004798',
    accountHolderOrNotes: 'Anticipo 40% acreditado por Tesorería Grupo Vallejo',
  },
];

export const INITIAL_MACHINES: WorkshopMachine[] = [
  {
    id: 'mac-1',
    code: 'PLT-IMP-01',
    name: 'Plotter Gran Formato Ecosolvente 3.20m Dual DX5',
    type: 'Plotter de Impresión',
    brandModel: 'Roland VersaEXPRESS / Wit-Color Ultra 3200',
    lastMaintenanceDate: '2026-10-13',
    recommendedIntervalDays: 7,
    status: 'Operativo',
    totalHoursLogged: 1420,
  },
  {
    id: 'mac-2',
    code: 'PLT-COR-02',
    name: 'Plotter de Corte Óptico Servo 1.35m',
    type: 'Plotter de Corte',
    brandModel: 'Graphtec CE7000-130',
    lastMaintenanceDate: '2026-09-25',
    recommendedIntervalDays: 15,
    status: 'Atención Preventiva',
    totalHoursLogged: 890,
  },
  {
    id: 'mac-3',
    code: 'LAM-BF-03',
    name: 'Laminadora Neumática Frío/Calor 1.60m',
    type: 'Laminadora',
    brandModel: 'Fayon FY-1600SE',
    lastMaintenanceDate: '2026-10-05',
    recommendedIntervalDays: 30,
    status: 'Operativo',
    totalHoursLogged: 615,
  },
  {
    id: 'mac-4',
    code: 'CNC-LAS-04',
    name: 'Router CNC 1325 + Láser CO2 130W Acrílico/ACM',
    type: 'Router CNC / Láser',
    brandModel: 'Bodor BCL-1325',
    lastMaintenanceDate: '2026-09-28',
    recommendedIntervalDays: 14,
    status: 'Atención Preventiva',
    totalHoursLogged: 1150,
  },
];

export const INITIAL_MAINTENANCE_LOGS: MachineMaintenanceLog[] = [
  {
    id: 'mlog-1',
    machineId: 'mac-1',
    date: '2026-10-13',
    taskType: 'Limpieza de cabezal',
    technician: 'Mateo Silva',
    cost: 12.0,
    notes: 'Test de inyectores 100% limpio en ambos cabezales DX5. Limpieza de wipers y capping station.',
  },
  {
    id: 'mlog-2',
    machineId: 'mac-1',
    date: '2026-09-29',
    taskType: 'Cambio de dampers',
    technician: 'Mateo Silva',
    cost: 48.0,
    notes: 'Reemplazo preventivo de 8 dampers de presión en líneas CMYK y purga de aire.',
  },
  {
    id: 'mlog-3',
    machineId: 'mac-2',
    date: '2026-09-25',
    taskType: 'Cambio de cuchillas',
    technician: 'Diego Vargas',
    cost: 22.0,
    notes: 'Instalación de cuchilla CB09U 45° nueva y tira teflón de corte.',
  },
  {
    id: 'mlog-4',
    machineId: 'mac-3',
    date: '2026-10-05',
    taskType: 'Calibración óptica/avance',
    technician: 'Mateo Silva',
    cost: 0,
    notes: 'Nivelación de presión neumática en rodillos de silicona y limpieza con alcohol isopropílico.',
  },
  {
    id: 'mlog-5',
    machineId: 'mac-4',
    date: '2026-09-28',
    taskType: 'Engrase de rieles',
    technician: 'Andrés Paredes',
    cost: 15.0,
    notes: 'Lubricación de guías lineales Hiwin X/Y/Z, alineación de espejos láser y limpieza de lente focal.',
  },
];

export interface ClientContact {
  id: string;
  name: string;
  ruc: string;
  phone: string;
  email: string;
  cityAddress: string;
  tags: string[];
  notes: string;
  createdAt: string;
  // Ejecutivo / Usuario responsable de la cuenta en el CRM
  assignedExecutiveId?: string;
  // CRM Meta Ads y Etapa de Embudo
  crmLeadStage?: CrmLeadStage;
  adReferral?: MetaAdReferralInfo;
  originChannel?:
    | 'Meta Ads CTWA'
    | 'Meta Lead Form'
    | 'WhatsApp Orgánico'
    | 'Mostrador / Referido'
    | 'meta_ads_wa'
    | 'meta_lead_form'
    | 'organic_wa'
    | 'manual';
}

export const AVAILABLE_CLIENT_TAGS: string[] = [
  'VIP / Recurrente',
  'Corporativo',
  'Rótulos 3D',
  'Gran Formato',
  'Vinil & Flotas',
  'Crédito Autorizado',
  'Exige Retención',
  'Nuevo Prospecto',
  'Lead Meta Ads',
  'Campaña Click-to-WhatsApp',
  'Lead Formulario Meta',
  'Cliente Inactivo / Reactivar',
];

export const INITIAL_CLIENTS: ClientContact[] = [
  {
    id: 'cli-1',
    name: 'Grupo Automotriz Vallejo S.A.',
    ruc: '1792348901001',
    phone: '+593 99 312 8840',
    email: 'compras@automotrizvallejo.ec',
    cityAddress: 'Av. 10 de Agosto y Mariana de Jesús, Quito',
    tags: ['VIP / Recurrente', 'Corporativo', 'Rótulos 3D'],
    notes: 'Concesionario matriz y 3 sucursales. Solicita siempre estructura anticorrosiva y LED Samsung con garantía de 2 años.',
    createdAt: '2025-11-10',
  },
  {
    id: 'cli-2',
    name: 'Clínica Dental Sonrisa',
    ruc: '0991827364001',
    phone: '+593 98 765 4321',
    email: 'gerencia@clinicasonrisa.ec',
    cityAddress: 'Av. Francisco de Orellana, Edif. World Trade Center, Guayaquil',
    tags: ['Rótulos 3D', 'Vinil & Flotas'],
    notes: 'Atención con Dra. Camila Pino. Prefiere entregas e instalaciones en horario de sábado por la mañana.',
    createdAt: '2026-02-14',
  },
  {
    id: 'cli-3',
    name: 'Supermercados El Ahorro',
    ruc: '1790011223001',
    phone: '+593 99 887 6655',
    email: 'marketing@superelahorro.com',
    cityAddress: 'Parque Industrial Norte Km 5.5, Quito',
    tags: ['VIP / Recurrente', 'Corporativo', 'Gran Formato', 'Crédito Autorizado'],
    notes: 'Campaña mensual de lonas promocionales para 12 locales. Emite retención a la fuente del 1.75%.',
    createdAt: '2025-08-20',
  },
  {
    id: 'cli-4',
    name: 'Constructora Horizonte Cía. Ltda.',
    ruc: '1798877665001',
    phone: '+593 97 441 0092',
    email: 'obras@constructorahorizonte.ec',
    cityAddress: 'Vía Cumbayá - Tumbaco Km 11',
    tags: ['Corporativo', 'Gran Formato'],
    notes: 'Compra frecuente de vallas de obra, señalética ISO en PVC Sintra y lonas tensadas en bastidor.',
    createdAt: '2026-01-08',
  },
  {
    id: 'cli-5',
    name: 'Restaurante Brasas del Norte',
    ruc: '1714509922001',
    phone: '+593 96 209 3318',
    email: 'admin@brasasdelnorte.ec',
    cityAddress: 'Av. República del Salvador y Moscú',
    tags: ['Rótulos 3D', 'Nuevo Prospecto', 'Lead Meta Ads', 'Campaña Click-to-WhatsApp'],
    notes: 'Proyecto de remodelación de fachada principal y cajas de luz para menús interiores.',
    createdAt: '2026-09-29',
    crmLeadStage: 'Cotización Enviada',
    originChannel: 'Meta Ads CTWA',
    adReferral: {
      sourceUrl: 'https://fb.me/ctwa-crea-arte-rotulos3d',
      sourceId: '1202145591029384',
      sourceType: 'ad',
      headline: 'Campaña Rótulos 3D & Cajas de Luz LED Gastronomía',
      ctwaClid: 'ARX4m9P1kLzT8nQ2_CTWA_2026',
      campaignName: 'Meta Ads — Rótulos Luminosos Gastronomía',
      receivedAt: '2026-10-15 11:15',
    },
  },
  {
    id: 'cli-6',
    name: 'Logística Andina Express',
    ruc: '0993019283001',
    phone: '+593 99 112 3344',
    email: 'flotas@logisticaandina.ec',
    cityAddress: 'Av. Simón Bolívar, Panamericana Sur Km 8',
    tags: ['VIP / Recurrente', 'Vinil & Flotas'],
    notes: 'Rotulación integral de furgones con vinil fundido + laminado UV brillante.',
    createdAt: '2026-04-12',
  },
  {
    id: 'cli-7',
    name: 'Farmacias Medicity Express',
    ruc: '1790827361001',
    phone: '+593 98 334 5566',
    email: 'expansion@medicityexpress.ec',
    cityAddress: 'Av. Amazonas y Naciones Unidas',
    tags: ['VIP / Recurrente', 'Corporativo', 'Rótulos 3D', 'Exige Retención'],
    notes: 'Cliente corporativo AAA. Paga puntualmente con tarjeta corporativa o transferencia a contra-entrega.',
    createdAt: '2025-06-05',
  },
];

export interface ParsedInvoiceLineItem {
  id: string;
  rawDescription: string;
  matchedInventoryId: string; // ID en INITIAL_INVENTORY o 'NEW_ITEM'
  suggestedSku: string;
  suggestedName: string;
  suggestedCategory: InventoryCategory;
  purchaseQty: number;
  purchaseUnit: string;
  purchaseUnitPrice: number;
  conversionFactor: number; // ej. 160 m2 por rollo 3.20x50m, 76 m2 por rollo 1.52x50m, 1 para plancha
  warehouseQty: number; // purchaseQty * conversionFactor
  warehouseUnit: 'm2' | 'ml' | 'm_lineal' | 'plancha' | 'litro' | 'unidad';
  warehouseUnitCost: number; // lineSubtotal / warehouseQty
  lineSubtotal: number;
  selected: boolean;
}

export interface ParsedSupplierInvoice {
  id: string;
  fileName: string;
  supplierName: string;
  supplierRuc: string;
  invoiceNumber: string;
  issueDate: string;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  paymentMethod: 'Transferencia Bancaria' | 'Efectivo' | 'Tarjeta';
  bankEntity: string;
  referenceNumber: string;
  extractionSource: 'gemini-ai' | 'pdf-motor-local';
  warningMessage?: string;
  processedAt?: string;
  uploadedFileDataUrl?: string;
  uploadedFileMimeType?: string;
  rawExtractedText?: string;
  items: ParsedInvoiceLineItem[];
}

export const SAMPLE_PDF_INVOICES: ParsedSupplierInvoice[] = [
  {
    id: 'samp-inv-1',
    fileName: 'Factura_FAC-001-009482_Importadora_Grafica_Andina.pdf',
    supplierName: 'Importadora Gráfica Andina S.A.',
    supplierRuc: '1791408821001',
    invoiceNumber: 'FAC-001-002-000094821',
    issueDate: '2026-10-17',
    subtotal: 1091.0,
    taxAmount: 163.65,
    totalAmount: 1254.65,
    paymentMethod: 'Transferencia Bancaria',
    bankEntity: 'Banco Pichincha — Cta. Cte. #2100489210',
    referenceNumber: 'SPI-99402184',
    extractionSource: 'pdf-motor-local',
    items: [
      {
        id: 'line-1',
        rawDescription: 'BOBINA LONA FRONTLIGHT 13OZ BRILLANTE 3.20M X 50M (160 M2/ROLLO)',
        matchedInventoryId: 'inv-lona-front',
        suggestedSku: 'BOB-LF13-320',
        suggestedName: 'Bobina Lona Frontlight 13oz Brillante (3.20m x 50m)',
        suggestedCategory: 'Bobinas y Rollos',
        purchaseQty: 2,
        purchaseUnit: 'Rollo 3.20x50m (160m²)',
        purchaseUnitPrice: 336.0,
        conversionFactor: 160,
        warehouseQty: 320,
        warehouseUnit: 'm2',
        warehouseUnitCost: 2.1,
        lineSubtotal: 672.0,
        selected: true,
      },
      {
        id: 'line-2',
        rawDescription: 'ROLLO VINIL MICROPERFORADO HOMOLOGADO 1.52M X 50M (76 M2/ROLLO)',
        matchedInventoryId: 'inv-vinil-micro',
        suggestedSku: 'VIN-MIC-152',
        suggestedName: 'Rollo Vinil Microperforado Homologado (1.52m x 50m)',
        suggestedCategory: 'Bobinas y Rollos',
        purchaseQty: 1,
        purchaseUnit: 'Rollo 1.52x50m (76m²)',
        purchaseUnitPrice: 304.0,
        conversionFactor: 76,
        warehouseQty: 76,
        warehouseUnit: 'm2',
        warehouseUnitCost: 4.0,
        lineSubtotal: 304.0,
        selected: true,
      },
      {
        id: 'line-3',
        rawDescription: 'ROLLO LAMINADO PROTECTOR UV FRIO BRILLANTE 1.52M X 50M (76 M2)',
        matchedInventoryId: 'inv-laminado-uv',
        suggestedSku: 'LAM-UV-152',
        suggestedName: 'Rollo Laminado Protector UV Frío (1.52m x 50m)',
        suggestedCategory: 'Bobinas y Rollos',
        purchaseQty: 1,
        purchaseUnit: 'Rollo 1.52x50m (76m²)',
        purchaseUnitPrice: 115.0,
        conversionFactor: 76,
        warehouseQty: 76,
        warehouseUnit: 'm2',
        warehouseUnitCost: 1.51,
        lineSubtotal: 115.0,
        selected: true,
      },
    ],
  },
  {
    id: 'samp-inv-2',
    fileName: 'Factura_FAC-004-018290_Plasticos_Industriales_Rigidos.pdf',
    supplierName: 'Plásticos Industriales & Alucomex S.A.',
    supplierRuc: '0992817263001',
    invoiceNumber: 'FAC-004-001-000182904',
    issueDate: '2026-10-17',
    subtotal: 896.0,
    taxAmount: 134.4,
    totalAmount: 1030.4,
    paymentMethod: 'Transferencia Bancaria',
    bankEntity: 'Banco Guayaquil — Cta. Cte. #0019283746',
    referenceNumber: 'TRF-78120934',
    extractionSource: 'pdf-motor-local',
    items: [
      {
        id: 'line-201',
        rawDescription: 'PLANCHA ACRILICO CRISTAL / OPAL 3MM FORMATO 1.22M X 2.44M',
        matchedInventoryId: 'inv-acrilico-3mm',
        suggestedSku: 'PLA-ACR3-122',
        suggestedName: 'Plancha Acrílico Cristal / Blanco Opal 3mm (1.22m x 2.44m)',
        suggestedCategory: 'Planchas Rígidas',
        purchaseQty: 8,
        purchaseUnit: 'Plancha 1.22x2.44m',
        purchaseUnitPrice: 41.0,
        conversionFactor: 1,
        warehouseQty: 8,
        warehouseUnit: 'plancha',
        warehouseUnitCost: 41.0,
        lineSubtotal: 328.0,
        selected: true,
      },
      {
        id: 'line-202',
        rawDescription: 'PLANCHA ALUCOBOND ACM 4MM NEGRO MATE / PLATA 1.22M X 2.44M',
        matchedInventoryId: 'inv-alucobond-4mm',
        suggestedSku: 'PLA-ACM4-122',
        suggestedName: 'Plancha Alucobond / ACM 4mm Negro Mate / Plata (1.22m x 2.44m)',
        suggestedCategory: 'Planchas Rígidas',
        purchaseQty: 6,
        purchaseUnit: 'Plancha 1.22x2.44m',
        purchaseUnitPrice: 53.0,
        conversionFactor: 1,
        warehouseQty: 6,
        warehouseUnit: 'plancha',
        warehouseUnitCost: 53.0,
        lineSubtotal: 318.0,
        selected: true,
      },
      {
        id: 'line-203',
        rawDescription: 'PLANCHA ACRILICO CRISTAL 5MM ALTA DENSIDAD 1.22M X 2.44M',
        matchedInventoryId: 'inv-acrilico-5mm',
        suggestedSku: 'PLA-ACR5-122',
        suggestedName: 'Plancha Acrílico Cristal 5mm Alta Densidad (1.22m x 2.44m)',
        suggestedCategory: 'Planchas Rígidas',
        purchaseQty: 4,
        purchaseUnit: 'Plancha 1.22x2.44m',
        purchaseUnitPrice: 62.5,
        conversionFactor: 1,
        warehouseQty: 4,
        warehouseUnit: 'plancha',
        warehouseUnitCost: 62.5,
        lineSubtotal: 250.0,
        selected: true,
      },
    ],
  },
  {
    id: 'samp-inv-3',
    fileName: 'Factura_FAC-002-005519_TechPrint_Tintas_Y_LED.pdf',
    supplierName: 'TechPrint & ElectroLED Mayorista Cía. Ltda.',
    supplierRuc: '1792003948001',
    invoiceNumber: 'FAC-002-003-000055190',
    issueDate: '2026-10-17',
    subtotal: 676.0,
    taxAmount: 101.4,
    totalAmount: 777.4,
    paymentMethod: 'Tarjeta',
    bankEntity: 'Produbanco — Cta. Pyme #0200591823',
    referenceNumber: 'VOUCHER-449102',
    extractionSource: 'pdf-motor-local',
    items: [
      {
        id: 'line-301',
        rawDescription: 'TINTA ECOSOLVENTE ROLAND / EPSON DX5 SET CMYK (4 BOTELLAS DE 1 LITRO)',
        matchedInventoryId: 'inv-tinta-eco',
        suggestedSku: 'TIN-ECO-DX5',
        suggestedName: 'Tinta Ecosolvente Roland / Epson DX5 (Set CMYK Litros)',
        suggestedCategory: 'Tintas y Consumibles',
        purchaseQty: 4,
        purchaseUnit: 'Botella 1 Litro',
        purchaseUnitPrice: 63.0,
        conversionFactor: 1,
        warehouseQty: 4,
        warehouseUnit: 'litro',
        warehouseUnitCost: 63.0,
        lineSubtotal: 252.0,
        selected: true,
      },
      {
        id: 'line-302',
        rawDescription: 'PACK 100 MODULOS LED 3-SMD SAMSUNG IP68 + FUENTE 12V 20A',
        matchedInventoryId: 'inv-modulos-led',
        suggestedSku: 'ELE-LED-IP68',
        suggestedName: 'Pack 100 Módulos LED 3-SMD Samsung IP68 + Fuente 12V 20A',
        suggestedCategory: 'Tintas y Consumibles',
        purchaseQty: 6,
        purchaseUnit: 'Kit / Pack 100u',
        purchaseUnitPrice: 36.5,
        conversionFactor: 1,
        warehouseQty: 6,
        warehouseUnit: 'unidad',
        warehouseUnitCost: 36.5,
        lineSubtotal: 219.0,
        selected: true,
      },
      {
        id: 'line-303',
        rawDescription: 'ROLLO VINIL REFLECTIVO GRADO INGENIERIA 3M (1.22M X 45.7M = 55.75 M2)',
        matchedInventoryId: 'NEW_ITEM',
        suggestedSku: 'VIN-REF3M-122',
        suggestedName: 'Rollo Vinil Reflectivo Grado Ingeniería 3M (1.22m x 45.7m)',
        suggestedCategory: 'Bobinas y Rollos',
        purchaseQty: 1,
        purchaseUnit: 'Rollo 1.22x45.7m (55.75m²)',
        purchaseUnitPrice: 205.0,
        conversionFactor: 55.75,
        warehouseQty: 55.75,
        warehouseUnit: 'm2',
        warehouseUnitCost: 3.68,
        lineSubtotal: 205.0,
        selected: true,
      },
    ],
  },
];

export const INITIAL_PROCESSED_INVOICES: ParsedSupplierInvoice[] = [
  {
    ...SAMPLE_PDF_INVOICES[0],
    id: 'proc-inv-101',
    invoiceNumber: 'FAC-001-002-000091204',
    issueDate: '2026-10-10',
    processedAt: '2026-10-10 16:40',
  },
];

export type AuditActionCategory =
  | 'alta_baja_proyecto'
  | 'etapa_produccion'
  | 'cotizacion_orden'
  | 'cobros_finanzas'
  | 'inventario_bodega'
  | 'usuarios_roles'
  | 'crm_tareas';

export interface SystemAuditLogEntry {
  id: string;
  timestamp: string;
  actorUserId: string;
  actorName: string;
  actorRoleLabel: string;
  category: AuditActionCategory;
  orderId?: string;
  targetEmployeeName?: string;
  actionTitle: string;
  details: string;
}

export const INITIAL_AUDIT_LOGS: SystemAuditLogEntry[] = [
  {
    id: 'aud-1001',
    timestamp: '2026-10-16 19:50:12',
    actorUserId: 'usr-operator',
    actorName: 'Mateo Silva',
    actorRoleLabel: 'Operador de Taller / Instalador',
    category: 'alta_baja_proyecto',
    orderId: '#CA-001',
    targetEmployeeName: 'Mateo Silva',
    actionTitle: 'Baja de Proyecto (Finalizó Impresión / Corte)',
    details:
      'Mateo Silva se dio de baja del proyecto #CA-001 (Grupo Automotriz Vallejo S.A.) tras completar "Impresión / Corte". Nota: Corte de viniles translúcidos terminado.',
  },
  {
    id: 'aud-1002',
    timestamp: '2026-10-16 18:10:05',
    actorUserId: 'usr-admin',
    actorName: 'Ing. Carlos Mendoza',
    actorRoleLabel: 'Administrador / Gerente',
    category: 'alta_baja_proyecto',
    orderId: '#CA-002',
    targetEmployeeName: 'Mateo Silva',
    actionTitle: 'Baja de Proyecto autorizada por Administrador',
    details:
      'Ing. Carlos Mendoza (Administrador) dio de baja a Mateo Silva del proyecto #CA-002 (Clínica Dental Sonrisa Integral). Nota: 13.2 m² impresos y refilados listos para montaje.',
  },
  {
    id: 'aud-1003',
    timestamp: '2026-10-16 16:30:40',
    actorUserId: 'usr-designer',
    actorName: 'Diego Vargas',
    actorRoleLabel: 'Diseñador / Pre-prensa',
    category: 'alta_baja_proyecto',
    orderId: '#CA-001',
    targetEmployeeName: 'Diego Vargas',
    actionTitle: 'Baja de Proyecto (Finalizó Diseño y Pre-prensa)',
    details:
      'Diego Vargas finalizó su etapa y se dio de baja del proyecto #CA-001 tras aprobar planos 3D y vectores CNC.',
  },
  {
    id: 'aud-1004',
    timestamp: '2026-10-16 15:20:00',
    actorUserId: 'usr-sales',
    actorName: 'Valeria Rojas',
    actorRoleLabel: 'Ventas / Atención',
    category: 'cotizacion_orden',
    orderId: '#CA-008',
    actionTitle: 'Creación de Orden y Envío de Proforma PDF',
    details:
      'Valeria Rojas (Ventas) registró la orden #CA-008 para Cafetería & Tostaduría Origen Andino ($161.00) y asignó a Diego Vargas en Diseño.',
  },
  {
    id: 'aud-1005',
    timestamp: '2026-10-16 14:05:18',
    actorUserId: 'usr-sales',
    actorName: 'Valeria Rojas',
    actorRoleLabel: 'Ventas / Atención',
    category: 'cobros_finanzas',
    orderId: '#CA-001',
    actionTitle: 'Registro de Cobro / Anticipo ($600.00)',
    details:
      'Valeria Rojas registró ingreso de $600.00 en #CA-001 vía Transferencia Bancaria (Banco Pichincha · Ref: SPI-884920).',
  },
  {
    id: 'aud-1006',
    timestamp: '2026-10-16 11:40:00',
    actorUserId: 'usr-operator-2',
    actorName: 'Andrés Paredes',
    actorRoleLabel: 'Operador de Taller / Instalador',
    category: 'etapa_produccion',
    orderId: '#CA-001',
    actionTitle: 'Cambio de Etapa en Tablero Kanban',
    details:
      'Andrés Paredes movió el proyecto #CA-001 a la etapa "Acabados y Armado 3D" e inició el armado de estructura y módulos LED.',
  },
];

// ============================================================================
// MÓDULO CRM AVANZADO: TAREAS COMERCIALES/OPERATIVAS Y NOTIFICACIONES INTERNAS
// ============================================================================

export type CrmTaskPriority = 'Normal' | 'Alta' | 'Urgente';

export interface CrmTask {
  id: string;
  clientId?: string;
  clientName: string;
  orderId?: string;
  title: string;
  description?: string;
  assignedToUserId: string;
  createdByUserId: string;
  dueDate: string;
  priority: CrmTaskPriority;
  status: 'pending' | 'completed';
  completedAt?: string;
  completedBy?: string;
  createdAt: string;
}

export type CrmNotificationType =
  | 'client_reply'
  | 'chat_assigned'
  | 'task_assigned'
  | 'task_completed'
  | 'internal_mention';

export interface CrmNotification {
  id: string;
  timestamp: string;
  type: CrmNotificationType;
  targetUserId?: string; // ID del usuario destinatario o 'all'
  recipientUserId?: string; // Alias sincronizado para compatibilidad con Bandeja CRM
  actorName?: string;
  senderName?: string;
  orderId?: string;
  clientName?: string;
  title: string;
  message: string;
  read: boolean;
}

export const INITIAL_CRM_TASKS: CrmTask[] = [
  {
    id: 'task-crm-1',
    clientId: 'cli-2',
    clientName: 'Clínica Dental Sonrisa Integral',
    orderId: '#CA-002',
    title: 'Confirmar transferencia de saldo ($147.50) y autorizar salida de instalador',
    description: 'Dra. Morales indicó que enviará el comprobante antes de las 15:00 para instalar hoy.',
    assignedToUserId: 'usr-sales',
    createdByUserId: 'usr-admin',
    dueDate: '2026-10-16 17:00',
    priority: 'Urgente',
    status: 'pending',
    createdAt: '2026-10-16 14:30',
  },
  {
    id: 'task-crm-2',
    clientId: 'cli-5',
    clientName: 'Restaurante Brasas & Leña',
    orderId: '#CA-004',
    title: 'Verificar aprobación de precios en Menú Boards v2 y mandar a RIP',
    description: 'Revisar respuesta del cliente en WhatsApp y preparar archivo TIFF doble pasada.',
    assignedToUserId: 'usr-designer',
    createdByUserId: 'usr-sales',
    dueDate: '2026-10-16 18:00',
    priority: 'Alta',
    status: 'pending',
    createdAt: '2026-10-16 12:10',
  },
  {
    id: 'task-crm-3',
    clientId: 'cli-1',
    clientName: 'Grupo Automotriz Vallejo S.A.',
    orderId: '#CA-001',
    title: 'Coordinar ingreso de escalera y camión grúa en ShowRoom Norte (09:30 AM)',
    description: 'Permiso de trabajo en altura ya autorizado por el Ing. Vallejo.',
    assignedToUserId: 'usr-installer-3',
    createdByUserId: 'usr-admin',
    dueDate: '2026-10-17 09:30',
    priority: 'Alta',
    status: 'pending',
    createdAt: '2026-10-16 16:55',
  },
  {
    id: 'task-crm-4',
    clientId: 'cli-6',
    clientName: 'Gimnasio CrossFit Titan',
    orderId: '#CA-006',
    title: 'Seguimiento comercial de anticipo 50% ($195.50) para iniciar diseño',
    description: 'Cotización #CA-006 enviada por WhatsApp.',
    assignedToUserId: 'usr-sales',
    createdByUserId: 'usr-sales',
    dueDate: '2026-10-17 11:00',
    priority: 'Normal',
    status: 'pending',
    createdAt: '2026-10-16 12:35',
  },
];

export const INITIAL_CRM_NOTIFICATIONS: CrmNotification[] = [
  {
    id: 'notif-crm-1',
    timestamp: '2026-10-16 16:40',
    type: 'client_reply',
    targetUserId: 'usr-admin',
    recipientUserId: 'usr-admin',
    actorName: 'Grupo Automotriz Vallejo S.A.',
    senderName: 'Grupo Automotriz Vallejo S.A.',
    orderId: '#CA-001',
    clientName: 'Grupo Automotriz Vallejo S.A.',
    title: '💬 Nueva respuesta de cliente en #CA-001',
    message: 'Confirmó permiso de trabajo en altura y consulta avance del rótulo corpóreo.',
    read: false,
  },
  {
    id: 'notif-crm-2',
    timestamp: '2026-10-16 14:22',
    type: 'client_reply',
    targetUserId: 'usr-sales',
    recipientUserId: 'usr-sales',
    actorName: 'Clínica Dental Sonrisa Integral',
    senderName: 'Clínica Dental Sonrisa Integral',
    orderId: '#CA-002',
    clientName: 'Clínica Dental Sonrisa Integral',
    title: '💬 Cliente respondió en conversación #CA-002',
    message: 'Consulta hora de llegada de instaladores y monto exacto del saldo pendiente.',
    read: false,
  },
  {
    id: 'notif-crm-3',
    timestamp: '2026-10-16 12:12',
    type: 'chat_assigned',
    targetUserId: 'usr-designer',
    recipientUserId: 'usr-designer',
    actorName: 'Valeria Rojas (Ventas)',
    senderName: 'Valeria Rojas (Ventas)',
    orderId: '#CA-004',
    clientName: 'Restaurante Brasas & Leña',
    title: '📲 Conversación #CA-004 asignada a ti',
    message: 'Valeria Rojas te asignó el seguimiento de aprobación de arte de Restaurante Brasas & Leña.',
    read: false,
  },
  {
    id: 'notif-crm-4',
    timestamp: '2026-10-16 14:30',
    type: 'task_assigned',
    targetUserId: 'usr-sales',
    recipientUserId: 'usr-sales',
    actorName: 'Ing. Carlos Mendoza',
    senderName: 'Ing. Carlos Mendoza',
    orderId: '#CA-002',
    clientName: 'Clínica Dental Sonrisa Integral',
    title: '📌 Nueva Tarea CRM Urgente (#CA-002)',
    message: 'Confirmar transferencia de saldo ($147.50) y autorizar salida de instalador.',
    read: false,
  },
];

export const INITIAL_REUSABLE_OFFCUTS: ReusableOffcut[] = [
  {
    id: 'offcut-1',
    materialId: 'inv-acrilico-3mm',
    materialName: 'Plancha Acrílico Blanco Opal 3mm (1.22m x 2.44m)',
    widthCm: 84,
    heightCm: 122,
    thicknessMm: 3,
    sourceOrderId: '#CA-001',
    createdAt: '2026-10-15 17:20',
    createdBy: 'Andrés Paredes',
    status: 'Disponible',
    notes: 'Sobrante derecho limpio de corte CNC letras corpóreas Grupo Vallejo',
  },
  {
    id: 'offcut-2',
    materialId: 'inv-alucobond-4mm',
    materialName: 'Plancha Alucobond Compuesto Aluminio 4mm (1.22m x 2.44m)',
    widthCm: 64,
    heightCm: 122,
    thicknessMm: 4,
    sourceOrderId: '#CA-001',
    createdAt: '2026-10-15 18:05',
    createdBy: 'Andrés Paredes',
    status: 'Disponible',
    notes: 'Bandeja lateral sobrante en buen estado con film protector intacto',
  },
  {
    id: 'offcut-3',
    materialId: 'inv-sintra-3mm',
    materialName: 'Plancha PVC Espumado Sintra 3mm Blanco (1.22m x 2.44m)',
    widthCm: 120,
    heightCm: 62,
    thicknessMm: 3,
    sourceOrderId: '#CA-002',
    createdAt: '2026-10-16 11:30',
    createdBy: 'Mateo Silva',
    status: 'Disponible',
    notes: 'Franja inferior ideal para señalética interna A3/A4',
  },
];




