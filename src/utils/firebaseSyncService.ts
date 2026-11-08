import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  setDoc,
  onSnapshot,
  Firestore,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import {
  WorkOrder,
  InventoryItem,
  InventoryMovement,
  RestockRequest,
  TimeLogEntry,
  CashTransaction,
  WorkshopMachine,
  MachineMaintenanceLog,
  ChatMessage,
  WhatsAppApiConfig,
  ClientContact,
  ParsedSupplierInvoice,
  CrmTask,
  CrmNotification,
  UserProfile,
  CatalogMaterial,
  getTodayDateStr,
} from '../data/initialData';

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const firebaseAuth = getAuth(app);

let firestoreInstance: Firestore | null = null;
try {
  const dbId = (firebaseConfig as Record<string, string>).firestoreDatabaseId;
  firestoreInstance = dbId ? getFirestore(app, dbId) : getFirestore(app);
} catch {
  firestoreInstance = null;
}

export interface ErpFullDatabaseBackup {
  schemaVersion: string;
  exportedAt: string;
  orders: WorkOrder[];
  inventory: InventoryItem[];
  movements: InventoryMovement[];
  restockRequests: RestockRequest[];
  timeLogs: TimeLogEntry[];
  transactions: CashTransaction[];
  machines: WorkshopMachine[];
  maintenanceLogs: MachineMaintenanceLog[];
  chatMessages: ChatMessage[];
  waConfig: WhatsAppApiConfig[];
  clients: ClientContact[];
  processedInvoices: ParsedSupplierInvoice[];
  crmTasks: CrmTask[];
  crmNotifications: CrmNotification[];
  users: UserProfile[];
  customCatalog?: CatalogMaterial[];
}

export function subscribeToFirebaseAuth(
  onUserChanged: (user: User | null) => void
): () => void {
  return onAuthStateChanged(firebaseAuth, (user) => {
    onUserChanged(user);
  });
}

export async function signInWithFirebaseGoogle(): Promise<User | null> {
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(firebaseAuth, provider);
  return result.user;
}

export async function signOutFromFirebase(): Promise<void> {
  await signOut(firebaseAuth);
}

/**
 * Escucha cambios en tiempo real desde Cloud Firestore (colección `crea_arte_erp_state/main_workspace`)
 * manteniendo `localStorage` como caché principal Offline-First a prueba de fallos.
 */
export function subscribeToErpCloudWorkspace(
  onRemoteData: (remoteData: Partial<ErpFullDatabaseBackup>) => void,
  onSyncStatusChange?: (status: 'online' | 'offline_cache') => void
): () => void {
  if (!firestoreInstance) {
    onSyncStatusChange?.('offline_cache');
    return () => {};
  }

  try {
    const workspaceDocRef = doc(
      firestoreInstance,
      'crea_arte_erp_state',
      'main_workspace'
    );
    const unsubscribe = onSnapshot(
      workspaceDocRef,
      (snapshot) => {
        onSyncStatusChange?.('online');
        if (snapshot.exists()) {
          const data = snapshot.data() as Partial<ErpFullDatabaseBackup>;
          onRemoteData(data);
        }
      },
      () => {
        // Si Firestore no está habilitado o sin permisos, opera 100% en modo LocalStorage Offline-First
        onSyncStatusChange?.('offline_cache');
      }
    );
    return unsubscribe;
  } catch {
    onSyncStatusChange?.('offline_cache');
    return () => {};
  }
}

/**
 * Sincroniza un respaldo en segundo plano hacia Cloud Firestore si el usuario tiene sesión activa.
 */
export async function pushErpSnapshotToCloud(
  payload: Partial<ErpFullDatabaseBackup>
): Promise<boolean> {
  if (!firestoreInstance || !firebaseAuth.currentUser) {
    return false;
  }
  try {
    const workspaceDocRef = doc(
      firestoreInstance,
      'crea_arte_erp_state',
      'main_workspace'
    );
    await setDoc(
      workspaceDocRef,
      {
        ...payload,
        updatedAt: new Date().toISOString(),
        updatedByEmail: firebaseAuth.currentUser.email || 'admin',
      },
      { merge: true }
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * Descarga toda la base de datos del ERP (incluyendo llaves v2 y catálogo personalizado) en un archivo .JSON
 */
export function downloadFullDatabaseBackupJson(backup: ErpFullDatabaseBackup): void {
  const jsonString = JSON.stringify(backup, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Respaldo_Crea_Arte_ERP_${getTodayDateStr()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Escapa un valor para CSV compatible con Microsoft Excel en español/inglés (UTF-8 con BOM).
 */
function escapeCsvCell(val: unknown): string {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

function triggerCsvDownload(filename: string, rows: string[][]): void {
  const csvContent =
    '\uFEFF' + rows.map((row) => row.map(escapeCsvCell).join(',')).join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Exporta las transacciones de Caja y Bancos a archivo .CSV (compatible con Excel).
 */
export function exportTransactionsToCsv(transactions: CashTransaction[]): void {
  const headers = [
    'ID Transacción',
    'Fecha y Hora',
    'Tipo Movimiento',
    'Orden Asociada',
    'Concepto / Detalle',
    'Cliente / Proveedor',
    'Método de Pago',
    'Banco / Entidad',
    'N° Referencia / Comprobante',
    'N° Factura / Doc SRI',
    'Monto USD ($)',
    'Registrado Por',
    'Notas de Auditoría',
  ];

  const dataRows = transactions.map((t) => [
    t.id,
    t.date,
    t.type === 'ingreso_anticipo'
      ? 'Ingreso Anticipo'
      : t.type === 'ingreso_liquidacion'
      ? 'Ingreso Liquidación'
      : 'Egreso Caja Chica / Proveedor',
    t.orderId || 'General',
    t.concept,
    t.clientOrProvider,
    t.method,
    t.bankEntity || t.method,
    t.referenceNumber || 'S/N',
    t.invoiceOrDocNumber || 'S/N',
    t.type === 'gasto_chica' ? `-${t.amount.toFixed(2)}` : t.amount.toFixed(2),
    t.registeredBy,
    t.accountHolderOrNotes || '',
  ]);

  triggerCsvDownload(`Caja_Y_Bancos_Crea_Arte_${getTodayDateStr()}.csv`, [
    headers,
    ...dataRows,
  ]);
}

/**
 * Exporta el catálogo de Inventario de Bodega y su valorización a .CSV (Excel).
 */
export function exportInventoryToCsv(
  inventory: InventoryItem[],
  movements?: InventoryMovement[]
): void {
  const headers = [
    'ID Insumo',
    'Código SKU',
    'Material / Sustrato',
    'Categoría',
    'Stock Actual',
    'Stock Mínimo Alerta',
    'Estado Stock',
    'Unidad Bodega',
    'Costo Unitario USD ($)',
    'Valor Total Stock USD ($)',
    'Proveedor Habitual',
    'Última Actualización',
  ];

  const rows = inventory.map((item) => [
    item.id,
    item.sku,
    item.name,
    item.category,
    item.currentStock.toFixed(2),
    item.minStock.toFixed(2),
    item.currentStock <= item.minStock ? 'CRÍTICO / REPONER' : 'ÓPTIMO',
    item.unit,
    item.unitCost.toFixed(2),
    (item.currentStock * item.unitCost).toFixed(2),
    item.supplier,
    item.lastUpdated,
  ]);

  if (movements && movements.length > 0) {
    rows.push([]);
    rows.push(['--- HISTORIAL KARDEX DE MOVIMIENTOS ---']);
    rows.push([
      'ID Movimiento',
      'Fecha',
      'Tipo',
      'Material',
      'Cantidad',
      'Unidad',
      'Orden Asociada',
      'Impacto Costo USD ($)',
      'Motivo / Justificación',
    ]);
    movements.forEach((m) => {
      rows.push([
        m.id,
        m.date,
        m.type,
        m.itemName,
        m.quantity.toFixed(2),
        m.unit,
        m.orderId || '-',
        m.costImpact.toFixed(2),
        m.reason,
      ]);
    });
  }

  triggerCsvDownload(`Inventario_Kardex_Crea_Arte_${getTodayDateStr()}.csv`, [
    headers,
    ...rows,
  ]);
}
