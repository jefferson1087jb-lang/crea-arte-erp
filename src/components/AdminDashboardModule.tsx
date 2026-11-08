import React, { useMemo, useState } from 'react';
import {
  TrendingUp,
  Wallet,
  AlertTriangle,
  Package,
  Clock,
  Wrench,
  Lock,
  CheckCircle2,
  ArrowUpRight,
  DollarSign,
  Users,
  ShieldCheck,
  Flame,
  Award,
  Scissors,
} from 'lucide-react';
import {
  WorkOrder,
  InventoryItem,
  InventoryMovement,
  RestockRequest,
  TimeLogEntry,
  CashTransaction,
  WorkshopMachine,
  UserProfile,
  ORDER_STAGES,
  getTodayDateStr,
} from '../data/initialData';
import { getTrafficLightStatus } from './KanbanModule';
import { getDaysSince } from './MaintenanceModule';

interface AdminDashboardModuleProps {
  orders: WorkOrder[];
  inventory: InventoryItem[];
  movements?: InventoryMovement[];
  restockRequests: RestockRequest[];
  timeLogs: TimeLogEntry[];
  transactions: CashTransaction[];
  machines: WorkshopMachine[];
  users: UserProfile[];
  onNavigateModule: (
    mod:
      | 'quoter'
      | 'kanban'
      | 'timetracking'
      | 'inventory'
      | 'optimizer'
      | 'finance'
      | 'maintenance'
      | 'whatsapp'
      | 'users'
  ) => void;
  onApproveRestockRequest: (requestId: string) => void;
  onRegisterOrderPayment: (
    orderId: string,
    amount: number,
    method: 'Efectivo' | 'Transferencia Bancaria' | 'Tarjeta'
  ) => void;
}

export const AdminDashboardModule: React.FC<AdminDashboardModuleProps> = ({
  orders,
  inventory,
  movements = [],
  restockRequests,
  timeLogs,
  transactions,
  machines,
  users,
  onNavigateModule,
  onApproveRestockRequest,
  onRegisterOrderPayment,
}) => {
  const [commissionRatePct, setCommissionRatePct] = useState<number>(5);
  // Cálculos consolidados de todo el negocio
  const summary = useMemo(() => {
    // 1. Ventas, Costos y Rentabilidad Real
    const totalSalesBilled = orders.reduce((acc, o) => acc + o.totalPrice, 0);
    const totalNetSubtotal = orders.reduce((acc, o) => acc + o.subtotal, 0);
    const totalPaid = orders.reduce((acc, o) => acc + o.paidAmount, 0);
    const totalReceivable = orders.reduce(
      (acc, o) => acc + Math.max(0, o.totalPrice - o.paidAmount),
      0
    );

    // 2. Caja Chica y Movimientos
    const realTodayPrefix = getTodayDateStr();
    const hasRealTodayTx = transactions.some((t) => t.date.startsWith(realTodayPrefix));
    const latestTxDatePrefix = transactions[0]?.date?.slice(0, 10) || realTodayPrefix;
    const todayPrefix = hasRealTodayTx ? realTodayPrefix : latestTxDatePrefix;
    const collectionsToday = transactions
      .filter((t) => t.date.startsWith(todayPrefix) && t.type !== 'gasto_chica')
      .reduce((acc, t) => acc + t.amount, 0);

    const totalInflows = transactions
      .filter((t) => t.type !== 'gasto_chica')
      .reduce((acc, t) => acc + t.amount, 0);

    const totalExpenses = transactions
      .filter((t) => t.type === 'gasto_chica')
      .reduce((acc, t) => acc + t.amount, 0);

    const netCashBalance = totalInflows - totalExpenses;

    // 3. Auditoría de rentabilidad orden por orden (Material + Mano de Obra Real)
    const orderProfitability = orders.map((o) => {
      const logs = timeLogs.filter((l) => l.orderId === o.id);
      const realHours = Number(
        (logs.reduce((acc, l) => acc + l.minutes, 0) / 60).toFixed(2)
      );
      const quotedHours = Number(
        (o.estimatedDesignHours + o.estimatedMachineHours + o.estimatedInstallHours).toFixed(2)
      );

      // Costo hora real según quién trabajó
      const realLaborCost = logs.reduce((acc, l) => {
        const emp = users.find((u) => u.id === l.employeeId);
        const rate = emp ? emp.hourlyCost : 11;
        return acc + (l.minutes / 60) * rate;
      }, 0);

      // Si aún no tiene horas registradas, estimar con las horas cotizadas para proyección
      const effectiveLaborCost =
        realLaborCost > 0
          ? realLaborCost
          : o.estimatedDesignHours * 12 +
            (o.estimatedMachineHours + o.estimatedInstallHours) * 11;

      const totalDirectCost = Number((o.rawMaterialCost + effectiveLaborCost).toFixed(2));
      const netProfit = Number((o.subtotal - totalDirectCost).toFixed(2));
      const marginPct =
        o.subtotal > 0 ? Number(((netProfit / o.subtotal) * 100).toFixed(1)) : 0;
      const pendingBalance = Math.max(
        0,
        Number((o.totalPrice - o.paidAmount).toFixed(2))
      );

      return {
        order: o,
        quotedHours,
        realHours,
        totalDirectCost,
        netProfit,
        marginPct,
        pendingBalance,
      };
    });

    const totalDirectCostsAll = orderProfitability.reduce(
      (acc, r) => acc + r.totalDirectCost,
      0
    );
    const totalNetProfitAll = Number(
      (totalNetSubtotal - totalDirectCostsAll - totalExpenses).toFixed(2)
    );
    const globalMarginPct =
      totalNetSubtotal > 0
        ? Number(((totalNetProfitAll / totalNetSubtotal) * 100).toFixed(1))
        : 0;

    // 4. Inventario y Solicitudes
    const inventoryValuation = inventory.reduce(
      (acc, i) => acc + i.currentStock * i.unitCost,
      0
    );
    const criticalStockItems = inventory.filter((i) => i.currentStock <= i.minStock);
    const pendingRestocks = restockRequests.filter((r) => r.status === 'Pendiente');

    // 5. Bloqueos de Entrega y Semáforo
    const blockedReadyOrders = orders.filter(
      (o) =>
        o.stage === 'Instalación / Listo para Retiro' &&
        Number((o.totalPrice - o.paidAmount).toFixed(2)) > 0
    );

    const overdueOrders = orders.filter(
      (o) => getTrafficLightStatus(o.deadline, o.stage).code === 'red'
    );
    const urgentOrders = orders.filter(
      (o) => getTrafficLightStatus(o.deadline, o.stage).code === 'yellow'
    );

    // 6. Maquinaria
    const machinesNeedingMaint = machines.filter(
      (m) => getDaysSince(m.lastMaintenanceDate) >= m.recommendedIntervalDays
    );

    // 7. Horas globales, Tiempos de Máquina/Láser, Mermas de Taller y Comisiones Comerciales
    const totalQuotedHours = orderProfitability.reduce((acc, r) => acc + r.quotedHours, 0);
    const totalWorkedHours = orderProfitability.reduce((acc, r) => acc + r.realHours, 0);

    const machineLogsMinutes = timeLogs
      .filter((l) => l.phase === 'machine')
      .reduce((acc, l) => acc + l.minutes, 0);
    const totalLaserMinutes = orders.reduce((acc, o) => {
      const lineMinutes =
        o.lineItems?.reduce((sum, li) => sum + (li.laserMinutes || 0), 0) || 0;
      return acc + Math.max(o.laserMinutes || 0, lineMinutes);
    }, 0);

    const reportedWasteMovements = movements.filter((m) => m.type === 'merma_taller');
    const reportedWasteCost = reportedWasteMovements.reduce(
      (acc, m) => acc + m.costImpact,
      0
    );
    const estimatedOrderWasteCost = orders.reduce(
      (acc, o) => acc + o.rawMaterialCost * ((o.wastePercent || 0) / 100),
      0
    );
    const totalSalesCommissionPaidBase = Number(
      ((totalPaid * commissionRatePct) / 100).toFixed(2)
    );
    const totalSalesCommissionPotential = Number(
      ((totalNetSubtotal * commissionRatePct) / 100).toFixed(2)
    );

    return {
      totalSalesBilled: Number(totalSalesBilled.toFixed(2)),
      totalNetSubtotal: Number(totalNetSubtotal.toFixed(2)),
      totalPaid: Number(totalPaid.toFixed(2)),
      totalReceivable: Number(totalReceivable.toFixed(2)),
      collectionsToday: Number(collectionsToday.toFixed(2)),
      totalExpenses: Number(totalExpenses.toFixed(2)),
      netCashBalance: Number(netCashBalance.toFixed(2)),
      totalNetProfitAll,
      globalMarginPct,
      inventoryValuation: Number(inventoryValuation.toFixed(2)),
      criticalStockItems,
      pendingRestocks,
      blockedReadyOrders,
      overdueOrders,
      urgentOrders,
      machinesNeedingMaint,
      orderProfitability,
      totalQuotedHours: Number(totalQuotedHours.toFixed(1)),
      totalWorkedHours: Number(totalWorkedHours.toFixed(1)),
      machineHoursReal: Number((machineLogsMinutes / 60).toFixed(1)),
      totalLaserMinutes,
      reportedWasteCount: reportedWasteMovements.length,
      reportedWasteCost: Number(reportedWasteCost.toFixed(2)),
      estimatedOrderWasteCost: Number(estimatedOrderWasteCost.toFixed(2)),
      totalSalesCommissionPaidBase,
      totalSalesCommissionPotential,
    };
  }, [
    orders,
    inventory,
    movements,
    restockRequests,
    timeLogs,
    transactions,
    machines,
    users,
    commissionRatePct,
  ]);

  return (
    <div className="space-y-6">
      {/* Encabezado Ejecutivo Sobrio */}
      <div className="rounded-xl bg-white dark:bg-[#111620] text-slate-900 dark:text-slate-100 p-6 border border-slate-200 dark:border-[#1e2636] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-slate-100 dark:bg-[#171e2b] border border-slate-200 dark:border-[#242f42] text-slate-600 dark:text-slate-300 text-[11px] font-mono font-semibold">
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
            <span>CENTRO DE CONTROL ADMINISTRATIVO Y GERENCIAL · TIEMPO REAL</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Resumen Ejecutivo Integral (Finanzas, Márgenes, Taller y Bodega)
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-2xl">
            Monitoreo consolidado de utilidad neta por orden, flujo de caja bancario, embudo de las 7 etapas y alertas operativas de planta.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => onNavigateModule('quoter')}
            className="px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg shadow-2xs transition-all duration-150"
          >
            + Nueva Cotización
          </button>
          <button
            type="button"
            onClick={() => onNavigateModule('finance')}
            className="px-3.5 py-2 text-xs font-semibold bg-slate-100 dark:bg-[#171e2b] hover:bg-slate-200 dark:hover:bg-[#1f293a] border border-slate-200 dark:border-[#253042] rounded-lg text-slate-700 dark:text-slate-200 transition-all duration-150"
          >
            Abrir Caja Chica
          </button>
          <button
            type="button"
            onClick={() => onNavigateModule('whatsapp')}
            className="px-3.5 py-2 text-xs font-semibold bg-slate-100 dark:bg-[#171e2b] hover:bg-slate-200 dark:hover:bg-[#1f293a] border border-slate-200 dark:border-[#253042] rounded-lg text-slate-700 dark:text-slate-200 transition-all duration-150"
          >
            Abrir CRM WhatsApp
          </button>
        </div>
      </div>

      {/* FILA 1: 6 TARJETAS KPI SOBRIAS ESTILO LINEAR / STRIPE */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {/* KPI 1 */}
        <div className="bg-white dark:bg-[#111620] border border-slate-200 dark:border-[#1e2636] rounded-xl p-4 transition-all duration-150 flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Facturación Total
            </span>
            <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-[#171e2b] border border-slate-200/70 dark:border-[#242f42] flex items-center justify-center text-slate-600 dark:text-slate-300">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
              ${summary.totalSalesBilled.toFixed(2)}
            </div>
            <div className="mt-1.5 text-[11px] font-mono font-medium text-emerald-600 dark:text-emerald-400">
              Utilidad: ${summary.totalNetProfitAll.toFixed(2)} ({summary.globalMarginPct}%)
            </div>
          </div>
        </div>

        {/* KPI 2 */}
        <div className="bg-white dark:bg-[#111620] border border-slate-200 dark:border-[#1e2636] rounded-xl p-4 transition-all duration-150 flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Caja Neta Disp.
            </span>
            <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-[#171e2b] border border-slate-200/70 dark:border-[#242f42] flex items-center justify-center text-slate-600 dark:text-slate-300">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
              ${summary.netCashBalance.toFixed(2)}
            </div>
            <div className="mt-1.5 text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
              Hoy: +${summary.collectionsToday.toFixed(2)} · Egr: -${summary.totalExpenses.toFixed(2)}
            </div>
          </div>
        </div>

        {/* KPI 3 */}
        <div className="bg-white dark:bg-[#111620] border border-slate-200 dark:border-[#1e2636] rounded-xl p-4 transition-all duration-150 flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Por Cobrar
            </span>
            <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-[#171e2b] border border-slate-200/70 dark:border-[#242f42] flex items-center justify-center text-slate-600 dark:text-slate-300">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold font-mono tabular-nums text-amber-600 dark:text-amber-400">
              ${summary.totalReceivable.toFixed(2)}
            </div>
            <div className="mt-1.5 text-[11px] font-mono text-slate-500 dark:text-slate-400">
              {summary.blockedReadyOrders.length} orden(es) bloqueada(s)
            </div>
          </div>
        </div>

        {/* KPI 4 */}
        <div className="bg-white dark:bg-[#111620] border border-slate-200 dark:border-[#1e2636] rounded-xl p-4 transition-all duration-150 flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Valor Inventario
            </span>
            <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-[#171e2b] border border-slate-200/70 dark:border-[#242f42] flex items-center justify-center text-slate-600 dark:text-slate-300">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
              ${summary.inventoryValuation.toFixed(2)}
            </div>
            <div className="mt-1.5 text-[11px] font-mono text-slate-500 dark:text-slate-400">
              {summary.criticalStockItems.length} insumo(s) crítico(s)
            </div>
          </div>
        </div>

        {/* KPI 5 */}
        <div className="bg-white dark:bg-[#111620] border border-slate-200 dark:border-[#1e2636] rounded-xl p-4 transition-all duration-150 flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Tiempos Taller
            </span>
            <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-[#171e2b] border border-slate-200/70 dark:border-[#242f42] flex items-center justify-center text-slate-600 dark:text-slate-300">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
              {summary.totalWorkedHours}h <span className="text-sm font-normal text-slate-400">/ {summary.totalQuotedHours}h</span>
            </div>
            <div className="mt-1.5 text-[11px] font-mono text-slate-500 dark:text-slate-400">
              Horas reales vs. cotizadas
            </div>
          </div>
        </div>

        {/* KPI 6 */}
        <div className="bg-white dark:bg-[#111620] border border-slate-200 dark:border-[#1e2636] rounded-xl p-4 transition-all duration-150 flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Planta y Entregas
            </span>
            <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-[#171e2b] border border-slate-200/70 dark:border-[#242f42] flex items-center justify-center text-slate-600 dark:text-slate-300">
              <Wrench className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
              {summary.overdueOrders.length} venc. · {summary.urgentOrders.length} &lt;24h
            </div>
            <div className="mt-1.5 text-[11px] font-mono text-slate-500 dark:text-slate-400">
              {summary.machinesNeedingMaint.length} equipo(s) req. mant.
            </div>
          </div>
        </div>
      </div>

      {/* FILA 2: CENTRO DE DECISIONES RÁPIDAS DEL ADMINISTRADOR + EMBUDO DE PRODUCCIÓN */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Columna Izquierda: Decisiones y Aprobaciones Inmediatas (6 cols) */}
        <div className="lg:col-span-6 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-xs divide-y divide-slate-200/80 dark:divide-slate-800 overflow-hidden">
          <div className="px-5 py-4 bg-slate-50/70 dark:bg-slate-950/50 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <span>Centro de Acción Inmediata (Cobros, Compras y Alertas)</span>
            </h3>
          </div>

          {/* 1. Entregas bloqueadas por saldo pendiente */}
          <div className="p-5 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-800 dark:text-slate-200">
                1. Órdenes Listas con Bloqueo de Entrega por Saldo ({summary.blockedReadyOrders.length})
              </span>
              <button
                type="button"
                onClick={() => onNavigateModule('finance')}
                className="text-indigo-600 dark:text-indigo-400 hover:underline text-xs font-semibold"
              >
                Ver Caja Chica →
              </button>
            </div>
            {summary.blockedReadyOrders.length === 0 ? (
              <p className="text-xs text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5 bg-emerald-50/60 dark:bg-emerald-950/30 px-3 py-2 rounded-xl border border-emerald-200/60 dark:border-emerald-800/50">
                <CheckCircle2 className="w-4 h-4" /> Ninguna entrega bloqueada por cobro.
              </p>
            ) : (
              <div className="space-y-2">
                {summary.blockedReadyOrders.map((bo) => {
                  const saldo = Number((bo.totalPrice - bo.paidAmount).toFixed(2));
                  return (
                    <div
                      key={bo.id}
                      className="p-3.5 bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200/80 dark:border-rose-900/60 rounded-xl flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="min-w-0">
                        <span className="px-2 py-0.5 rounded-md bg-rose-100 dark:bg-rose-900/60 font-mono font-bold text-rose-700 dark:text-rose-300">
                          {bo.id}
                        </span>{' '}
                        · <strong className="text-slate-900 dark:text-white">{bo.clientName}</strong>
                        <span className="block text-[11px] font-mono text-slate-500 mt-1">
                          Saldo exigible: ${saldo.toFixed(2)} (Total: ${bo.totalPrice.toFixed(2)})
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          onRegisterOrderPayment(bo.id, saldo, 'Transferencia Bancaria')
                        }
                        className="px-3.5 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white rounded-xl inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 shadow-xs"
                      >
                        <Lock className="w-3.5 h-3.5" />
                        <span>Cobrar ${saldo.toFixed(2)}</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 2. Solicitudes de Reposición del Taller Pendientes */}
          <div className="p-5 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-800 dark:text-slate-200">
                2. Solicitudes de Compra de Insumos desde Taller ({summary.pendingRestocks.length})
              </span>
              <button
                type="button"
                onClick={() => onNavigateModule('inventory')}
                className="text-indigo-600 dark:text-indigo-400 hover:underline text-xs font-semibold"
              >
                Ver Bodega →
              </button>
            </div>
            {summary.pendingRestocks.length === 0 ? (
              <p className="text-xs text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5 bg-emerald-50/60 dark:bg-emerald-950/30 px-3 py-2 rounded-xl border border-emerald-200/60 dark:border-emerald-800/50">
                <CheckCircle2 className="w-4 h-4" /> Todas las solicitudes de taller están atendidas.
              </p>
            ) : (
              <div className="space-y-2">
                {summary.pendingRestocks.map((req) => (
                  <div
                    key={req.id}
                    className="p-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 rounded-xl flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="min-w-0">
                      <strong className="text-slate-900 dark:text-white">{req.itemName}</strong>
                      <span className="block text-[11px] font-mono text-slate-500 mt-0.5">
                        Pedir: {req.requestedQty} {req.unit} · Urgencia: {req.urgency} · Por:{' '}
                        {req.requestedBy}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onApproveRestockRequest(req.id)}
                      className="px-3.5 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl whitespace-nowrap shrink-0 shadow-xs"
                    >
                      Aprobar Compra
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 3. Alertas de Stock Crítico y Maquinaria */}
          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-3.5 rounded-xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200/60 dark:border-rose-900/50 space-y-2">
              <span className="font-bold text-rose-900 dark:text-rose-200 block">
                3. Stock Crítico ({summary.criticalStockItems.length})
              </span>
              {summary.criticalStockItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between font-mono text-[11px] text-rose-700 dark:text-rose-300"
                >
                  <span className="truncate pr-2">{item.name}</span>
                  <span className="shrink-0 font-bold px-1.5 py-0.5 rounded bg-rose-100 dark:bg-rose-900/60">
                    {item.currentStock}/{item.minStock} {item.unit}
                  </span>
                </div>
              ))}
            </div>

            <div className="p-3.5 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/50 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-amber-900 dark:text-amber-200">
                  4. Preventivo Equipos ({summary.machinesNeedingMaint.length})
                </span>
                <button
                  type="button"
                  onClick={() => onNavigateModule('maintenance')}
                  className="text-indigo-600 dark:text-indigo-400 hover:underline text-[11px] font-semibold"
                >
                  Bitácora
                </button>
              </div>
              {summary.machinesNeedingMaint.map((mac) => (
                <div
                  key={mac.id}
                  className="flex items-center justify-between font-mono text-[11px] text-amber-700 dark:text-amber-300"
                >
                  <span className="truncate pr-2">{mac.name}</span>
                  <span className="shrink-0 font-bold px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/60">
                    {getDaysSince(mac.lastMaintenanceDate)}d sin mant.
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Columna Derecha: Estado del Taller por Etapa y Carga de Personal (6 cols) */}
        <div className="lg:col-span-6 space-y-6">
          {/* Embudo Financiero y Operativo de las 7 Etapas con Barras de Progreso */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-xs p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Estado del Flujo de Producción (7 Etapas Kanban)
              </h3>
              <button
                type="button"
                onClick={() => onNavigateModule('kanban')}
                className="px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 inline-flex items-center gap-1 transition-colors"
              >
                <span>Abrir Tablero Kanban</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              {ORDER_STAGES.map((stage, idx) => {
                const stOrders = orders.filter((o) => o.stage === stage);
                const stageValue = stOrders.reduce((acc, o) => acc + o.totalPrice, 0);
                const pct = orders.length > 0 ? Math.round((stOrders.length / orders.length) * 100) : 0;
                return (
                  <div
                    key={stage}
                    className="p-2.5 rounded-xl bg-slate-50/70 dark:bg-slate-950/60 border border-slate-200/60 dark:border-slate-800/80 space-y-1.5"
                  >
                    <div className="flex items-center justify-between font-mono">
                      <span className="font-sans font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                        <span className="w-5 h-5 rounded-md bg-indigo-600/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 font-mono text-[11px] font-bold inline-flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <span>{stage}</span>
                      </span>
                      <div className="flex items-center gap-3">
                        <span className="px-2 py-0.5 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                          {stOrders.length} ord.
                        </span>
                        <span className="font-bold tabular-nums text-slate-900 dark:text-white w-20 text-right">
                          ${stageValue.toFixed(2)}
                        </span>
                      </div>
                    </div>
                    <div className="w-full h-1.5 bg-slate-200/80 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-indigo-500 to-blue-500 rounded-full transition-all duration-300"
                        style={{ width: `${Math.max(stOrders.length > 0 ? 12 : 0, pct)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Resumen Rápido de Colaboradores */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-xs p-5 space-y-3.5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-600" />
                <span>Rendimiento y Carga del Equipo ({users.length} colaboradores)</span>
              </h3>
              <button
                type="button"
                onClick={() => onNavigateModule('users')}
                className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                Gestionar Personal →
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              {users.map((u) => {
                const activeCount = orders.filter(
                  (o) =>
                    o.stage !== 'Finalizado y Liquidado' &&
                    (o.designerId === u.id ||
                      o.operatorId === u.id ||
                      o.installerId === u.id)
                ).length;
                const mins = timeLogs
                  .filter((l) => l.employeeId === u.id)
                  .reduce((a, b) => a + b.minutes, 0);
                return (
                  <div
                    key={u.id}
                    className="p-3.5 bg-slate-50/90 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 rounded-xl hover:border-indigo-300 dark:hover:border-indigo-800 transition-colors"
                  >
                    <div className="font-bold text-slate-900 dark:text-white truncate">
                      {u.name}
                    </div>
                    <div className="text-[11px] text-slate-500 truncate">{u.department}</div>
                    <div className="pt-2 mt-2 border-t border-slate-200/60 dark:border-slate-800 flex justify-between font-mono text-[11px]">
                      <span className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-semibold">
                        {activeCount} act.
                      </span>
                      <span className="text-indigo-600 dark:text-indigo-400 font-bold">
                        {(mins / 60).toFixed(1)}h
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* FILA 3: AUDITORÍA FINANCIERA Y DE MÁRGENES REALES POR ORDEN DE TRABAJO */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
        <div className="px-5 py-4 bg-slate-50/60 dark:bg-slate-950/40 border-b border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Auditoría Gerencial de Rentabilidad Real por Orden (#CA-001 a {orders[0]?.id})
            </h3>
            <p className="text-xs text-slate-500">
              Comparativa financiera completa: Precio de Venta, Costo de Materiales + Merma, Mano de Obra Real, Utilidad Neta y Saldos.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/90 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400">
              <tr>
                <th className="py-3 px-4">Folio / Cliente</th>
                <th className="py-3 px-4">Etapa Actual</th>
                <th className="py-3 px-4 text-right">Horas (Cot/Real)</th>
                <th className="py-3 px-4 text-right">Costo Directo</th>
                <th className="py-3 px-4 text-right">Venta Neta</th>
                <th className="py-3 px-4 text-right">Utilidad Neta ($)</th>
                <th className="py-3 px-4 text-right">Margen Real</th>
                <th className="py-3 px-4 text-right">Saldo por Cobrar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/80 dark:divide-slate-800 font-mono">
              {summary.orderProfitability.map((row) => (
                <tr
                  key={row.order.id}
                  className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                >
                  <td className="py-3 px-4 font-sans">
                    <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                      {row.order.id}
                    </span>{' '}
                    ·{' '}
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {row.order.clientName}
                    </span>
                    <div className="text-[11px] text-slate-500 truncate max-w-xs">
                      {row.order.title}
                    </div>
                  </td>
                  <td className="py-3 px-4 font-sans">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      {row.order.stage}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right tabular-nums">
                    {row.quotedHours}h / <strong>{row.realHours}h</strong>
                  </td>
                  <td className="py-3 px-4 text-right tabular-nums text-slate-600 dark:text-slate-400">
                    ${row.totalDirectCost.toFixed(2)}
                  </td>
                  <td className="py-3 px-4 text-right tabular-nums text-slate-900 dark:text-white">
                    ${row.order.subtotal.toFixed(2)}
                  </td>
                  <td className="py-3 px-4 text-right tabular-nums font-bold text-emerald-700 dark:text-emerald-400">
                    +${row.netProfit.toFixed(2)}
                  </td>
                  <td className="py-3 px-4 text-right tabular-nums font-semibold text-emerald-700 dark:text-emerald-400">
                    {row.marginPct}%
                  </td>
                  <td className="py-3 px-4 text-right tabular-nums">
                    {row.pendingBalance > 0 ? (
                      <span className="px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 font-bold text-[11px]">
                        ${row.pendingBalance.toFixed(2)}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 font-semibold text-[11px]">
                        Liquidado
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* FILA 4 (FASE 4/5): CONTROL DE TIEMPOS DE MÁQUINAS, COSTO DE MERMAS Y COMISIONES COMERCIALES */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl shadow-xs p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80 dark:border-slate-800 pb-3.5">
          <div>
            <span className="text-[11px] font-mono uppercase tracking-wider text-indigo-600 dark:text-indigo-400 font-bold block">
              AUDITORÍA OPERATIVA DE PLANTA Y COMERCIAL
            </span>
            <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
              Control de Tiempos de Máquinas (Plotter / Láser / CNC), Costo de Mermas y Comisiones de Ventas
            </h3>
          </div>
          <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-200/80 dark:border-slate-800">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              % Comisión Ventas:
            </label>
            <input
              type="number"
              min="1"
              max="25"
              step="0.5"
              value={commissionRatePct}
              onChange={(e) => setCommissionRatePct(Math.max(0.5, Number(e.target.value)))}
              className="w-16 px-2 py-1 text-xs font-mono font-bold text-right bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
            />
            <span className="text-xs font-mono text-slate-500">%</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Card 1: Tiempos de Máquinas y Láser/CNC */}
          <div className="p-4 rounded-xl bg-slate-50/80 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
              <span className="flex items-center gap-1.5">
                <Flame className="w-4 h-4 text-amber-500" />
                Uso de Máquinas (Plotter / Láser / Router)
              </span>
              <button
                type="button"
                onClick={() => onNavigateModule('timetracking')}
                className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline font-semibold"
              >
                Cronómetro
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2.5 pt-1 font-mono">
              <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800">
                <div className="text-[10px] text-slate-500">HORAS MÁQUINA</div>
                <div className="text-base font-bold tabular-nums text-slate-900 dark:text-white">
                  {summary.machineHoursReal} h
                </div>
                <div className="text-[10px] text-slate-500">Registradas en taller</div>
              </div>
              <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800">
                <div className="text-[10px] text-slate-500">CORTE LÁSER / CNC</div>
                <div className="text-base font-bold tabular-nums text-amber-600 dark:text-amber-400">
                  {summary.totalLaserMinutes} min
                </div>
                <div className="text-[10px] text-slate-500">
                  Valor ref: ${(summary.totalLaserMinutes * 0.85).toFixed(2)}
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Control de Mermas y Desperdicio */}
          <div className="p-4 rounded-xl bg-slate-50/80 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
              <span className="flex items-center gap-1.5">
                <Scissors className="w-4 h-4 text-rose-500" />
                Costo de Mermas y Desperdicio
              </span>
              <button
                type="button"
                onClick={() => onNavigateModule('optimizer')}
                className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline font-semibold"
              >
                Optimizador 2D
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2.5 pt-1 font-mono">
              <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800">
                <div className="text-[10px] text-slate-500">MERMA REPORTADA</div>
                <div className="text-base font-bold tabular-nums text-rose-600 dark:text-rose-400">
                  ${summary.reportedWasteCost.toFixed(2)}
                </div>
                <div className="text-[10px] text-slate-500">
                  {summary.reportedWasteCount} evento(s) Kardex
                </div>
              </div>
              <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800">
                <div className="text-[10px] text-slate-500">MERMA TÉCNICA OT</div>
                <div className="text-base font-bold tabular-nums text-slate-900 dark:text-white">
                  ${summary.estimatedOrderWasteCost.toFixed(2)}
                </div>
                <div className="text-[10px] text-slate-500">Absorbida en cotización</div>
              </div>
            </div>
          </div>

          {/* Card 3: Liquidación de Comisiones Comerciales */}
          <div className="p-4 rounded-xl bg-slate-50/80 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
              <span className="flex items-center gap-1.5">
                <Award className="w-4 h-4 text-emerald-600" />
                Comisiones Comerciales ({commissionRatePct}%)
              </span>
              <span className="text-[10px] font-mono text-emerald-700 dark:text-emerald-400">
                Sobre recaudación real
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2.5 pt-1 font-mono">
              <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800">
                <div className="text-[10px] text-slate-500">DEVENGADA (COBRADO)</div>
                <div className="text-base font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
                  ${summary.totalSalesCommissionPaidBase.toFixed(2)}
                </div>
                <div className="text-[10px] text-slate-500">
                  Base cobrada: ${summary.totalPaid.toFixed(2)}
                </div>
              </div>
              <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800">
                <div className="text-[10px] text-slate-500">PROYECTADA NETA</div>
                <div className="text-base font-bold tabular-nums text-indigo-600 dark:text-indigo-400">
                  ${summary.totalSalesCommissionPotential.toFixed(2)}
                </div>
                <div className="text-[10px] text-slate-500">
                  Al liquidar 100% cartera
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
