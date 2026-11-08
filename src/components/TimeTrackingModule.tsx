import React, { useState, useMemo, useEffect } from 'react';
import {
  Play,
  Pause,
  Square,
  PlusCircle,
  Clock,
  Users,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  UserCheck,
  UserPlus,
  RotateCcw,
  Timer,
} from 'lucide-react';
import {
  WorkOrder,
  TimeLogEntry,
  UserProfile,
  RoleId,
  ProjectTaskRole,
  PROJECT_TASK_ROLES,
  getOrderTeamAssignments,
  getLiveSimulationNowMs,
  getLiveSimulationDateTimeStr,
  getAssignmentElapsedDuration,
} from '../data/initialData';

interface TimeTrackingModuleProps {
  orders: WorkOrder[];
  timeLogs: TimeLogEntry[];
  users: UserProfile[];
  currentRole: RoleId;
  currentUser: UserProfile;
  // Estado global del cronómetro en vivo (para que no se pierda al cambiar de pestaña)
  activeTimerOrderId: string;
  setActiveTimerOrderId: (id: string) => void;
  activeTimerPhase: 'design' | 'machine' | 'installation';
  setActiveTimerPhase: (p: 'design' | 'machine' | 'installation') => void;
  activeTimerEmployeeId: string;
  setActiveTimerEmployeeId: (id: string) => void;
  timerSeconds: number;
  isTimerRunning: boolean;
  onToggleTimer: () => void;
  onStopAndSaveTimer: (note: string) => void;
  onAddManualTimeLog: (entry: Omit<TimeLogEntry, 'id'>) => void;
  onUpdateOrder?: (updated: WorkOrder) => void;
  onNotify?: (msg: string) => void;
}

const PHASE_LABELS: Record<'design' | 'machine' | 'installation', string> = {
  design: 'Diseño / Pre-prensa RIP',
  machine: 'Máquina / Impresión / Armado 3D',
  installation: 'Instalación en Sitio',
};

export function formatSecondsToHMS(totalSec: number) {
  const hrs = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export const TimeTrackingModule: React.FC<TimeTrackingModuleProps> = ({
  orders,
  timeLogs,
  users,
  currentRole,
  currentUser,
  activeTimerOrderId,
  setActiveTimerOrderId,
  activeTimerPhase,
  setActiveTimerPhase,
  activeTimerEmployeeId,
  setActiveTimerEmployeeId,
  timerSeconds,
  isTimerRunning,
  onToggleTimer,
  onStopAndSaveTimer,
  onAddManualTimeLog,
  onUpdateOrder,
  onNotify,
}) => {
  const [timerNote, setTimerNote] = useState('Trabajo operativo en progreso');
  const [signOffOnManualLog, setSignOffOnManualLog] = useState<boolean>(true);

  // Reloj en vivo que avanza cada segundo para mostrar cuánto tiempo lleva cada empleado activo en un proyecto hasta que se dé de baja
  const [liveNowMs, setLiveNowMs] = useState<number>(() => getLiveSimulationNowMs());
  useEffect(() => {
    const interval = setInterval(() => {
      setLiveNowMs(getLiveSimulationNowMs());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Filtros del panel "Tiempo en Proyecto hasta Dar de Baja"
  const [tenureStatusFilter, setTenureStatusFilter] = useState<'active' | 'completed' | 'all'>(
    'active'
  );
  const [tenureEmployeeFilter, setTenureEmployeeFilter] = useState<string>('all');
  const [closingNotesMap, setClosingNotesMap] = useState<Record<string, string>>({});

  // Estado para asignar rápido un empleado a un proyecto y arrancar su reloj de permanencia
  const [assignOrderId, setAssignOrderId] = useState<string>(orders[0]?.id || '#CA-001');
  const [assignEmployeeId, setAssignEmployeeId] = useState<string>(users[2]?.id || 'usr-designer');
  const [assignTaskRole, setAssignTaskRole] = useState<ProjectTaskRole>('Diseño y Pre-prensa');

  // Formulario de registro manual
  const [manualOrderId, setManualOrderId] = useState(orders[0]?.id || '#CA-001');
  const [manualEmployeeId, setManualEmployeeId] = useState(activeTimerEmployeeId);
  const [manualPhase, setManualPhase] = useState<'design' | 'machine' | 'installation'>('machine');
  const [manualMinutes, setManualMinutes] = useState<number>(60);
  const [manualNote, setManualNote] = useState<string>('Laminado en frío y perfilado de bordes');

  const canSeeFinancialVariance = currentRole === 'admin';

  const actorSignature = `${currentUser.name} (${currentUser.roleLabel.split('/')[0].trim()})`;

  const signOffEmployeeFromOrder = (orderId: string, employeeId: string, closingNote: string) => {
    if (!onUpdateOrder) return;
    const targetOrder = orders.find((o) => o.id === orderId);
    if (!targetOrder) return;
    const team = getOrderTeamAssignments(targetOrder);
    const empName = users.find((u) => u.id === employeeId)?.name || employeeId;
    const exists = team.some((a) => a.userId === employeeId);
    const nowStamp = getLiveSimulationDateTimeStr();

    const updatedTeam = exists
      ? team.map((a) => {
          if (a.userId !== employeeId) return a;
          let extraPausedSec = a.accumulatedPausedSeconds || 0;
          if (a.isShiftPaused && a.pausedAt) {
            const pausedStartMs = new Date(a.pausedAt.replace(' ', 'T')).getTime();
            const nowMs = getLiveSimulationNowMs();
            if (!isNaN(pausedStartMs) && nowMs > pausedStartMs) {
              extraPausedSec += Math.floor((nowMs - pausedStartMs) / 1000);
            }
          }
          return {
            ...a,
            status: 'completed' as const,
            isShiftPaused: false,
            pausedAt: undefined,
            accumulatedPausedSeconds: extraPausedSec,
            completedAt: nowStamp,
            completedBy: actorSignature,
            closingNote: closingNote.trim() || `Trabajo finalizado por ${empName}`,
          };
        })
      : [
          ...team,
          {
            userId: employeeId,
            taskRole: 'Taller / Soldadura / Armado' as const,
            status: 'completed' as const,
            assignedAt: '2026-10-16 09:00',
            completedAt: nowStamp,
            completedBy: actorSignature,
            closingNote: closingNote.trim() || `Trabajo finalizado por ${empName}`,
          },
        ];

    onUpdateOrder({
      ...targetOrder,
      teamAssignments: updatedTeam,
    });
    if (onNotify) {
      onNotify(
        `✓ Baja registrada en ${orderId} por ${actorSignature}: ${empName} finalizó su participación y su reloj en el proyecto quedó detenido.`
      );
    }
  };

  // MEJORA 3: Pausar / Reanudar Turno para contabilizar Horas Laborales Efectivas (sin sumar horas de taller cerrado)
  const handleToggleShiftPause = (orderId: string, employeeId: string) => {
    if (!onUpdateOrder) return;
    const targetOrder = orders.find((o) => o.id === orderId);
    if (!targetOrder) return;
    const team = getOrderTeamAssignments(targetOrder);
    const empName = users.find((u) => u.id === employeeId)?.name || employeeId;
    const nowStamp = getLiveSimulationDateTimeStr();
    const nowMs = getLiveSimulationNowMs();

    let actionTaken: 'paused' | 'resumed' = 'paused';

    const updatedTeam = team.map((a) => {
      if (a.userId !== employeeId || a.status !== 'active') return a;
      if (a.isShiftPaused) {
        // Reanudar turno: sumar los segundos que estuvo en pausa
        actionTaken = 'resumed';
        let addedPausedSec = 0;
        if (a.pausedAt) {
          const pausedStartMs = new Date(a.pausedAt.replace(' ', 'T')).getTime();
          if (!isNaN(pausedStartMs) && nowMs > pausedStartMs) {
            addedPausedSec = Math.floor((nowMs - pausedStartMs) / 1000);
          }
        }
        return {
          ...a,
          isShiftPaused: false,
          pausedAt: undefined,
          accumulatedPausedSeconds: (a.accumulatedPausedSeconds || 0) + addedPausedSec,
        };
      } else {
        // Pausar turno (ej. cierre de taller / almuerzo / fin de jornada)
        actionTaken = 'paused';
        return {
          ...a,
          isShiftPaused: true,
          pausedAt: nowStamp,
        };
      }
    });

    onUpdateOrder({
      ...targetOrder,
      teamAssignments: updatedTeam,
    });

    if (onNotify) {
      onNotify(
        actionTaken === 'paused'
          ? `⏸️ Turno pausado para ${empName} en ${orderId} (No suma horas nocturnas/cierre a Horas Efectivas).`
          : `▶️ Turno reanudado para ${empName} en ${orderId}. Contabilizando Horas Laborales Efectivas.`
      );
    }
  };

  const handleReactivateEmployeeInOrder = (orderId: string, employeeId: string) => {
    if (!onUpdateOrder) return;
    const targetOrder = orders.find((o) => o.id === orderId);
    if (!targetOrder) return;
    const team = getOrderTeamAssignments(targetOrder);
    const empName = users.find((u) => u.id === employeeId)?.name || employeeId;

    const updatedTeam = team.map((a) =>
      a.userId === employeeId
        ? {
            ...a,
            status: 'active' as const,
            isShiftPaused: false,
            pausedAt: undefined,
            assignedBy: actorSignature,
            completedAt: undefined,
            completedBy: undefined,
            closingNote: undefined,
          }
        : a
    );

    onUpdateOrder({
      ...targetOrder,
      teamAssignments: updatedTeam,
    });
    if (onNotify) {
      onNotify(
        `⏱️ ${empName} fue reactivado en el proyecto ${orderId} por ${actorSignature}. Su tiempo sigue corriendo hasta nueva baja.`
      );
    }
  };

  const handleAssignEmployeeToProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!onUpdateOrder) return;
    const targetOrder = orders.find((o) => o.id === assignOrderId);
    if (!targetOrder) return;
    const team = getOrderTeamAssignments(targetOrder);
    const empName = users.find((u) => u.id === assignEmployeeId)?.name || assignEmployeeId;
    const nowStamp = getLiveSimulationDateTimeStr();

    const existing = team.find((a) => a.userId === assignEmployeeId);
    if (existing && existing.status === 'active') {
      if (onNotify) {
        onNotify(`${empName} ya se encuentra activo dentro del proyecto ${assignOrderId}.`);
      }
      return;
    }

    const updatedTeam = existing
      ? team.map((a) =>
          a.userId === assignEmployeeId
            ? {
                ...a,
                taskRole: assignTaskRole,
                status: 'active' as const,
                assignedAt: nowStamp,
                assignedBy: actorSignature,
                completedAt: undefined,
                completedBy: undefined,
                closingNote: undefined,
              }
            : a
        )
      : [
          ...team,
          {
            userId: assignEmployeeId,
            taskRole: assignTaskRole,
            status: 'active' as const,
            assignedAt: nowStamp,
            assignedBy: actorSignature,
          },
        ];

    onUpdateOrder({
      ...targetOrder,
      teamAssignments: updatedTeam,
    });
    setTenureStatusFilter('active');
    if (onNotify) {
      onNotify(
        `⏱️ Alta en proyecto por ${actorSignature}: ${empName} ingresó a ${assignOrderId} (${assignTaskRole}).`
      );
    }
  };

  // Lista completa de asignaciones (empleado ↔ proyecto) con cálculo en vivo del tiempo que lleva hasta dar de baja
  const projectTenureRows = useMemo(() => {
    const rows: Array<{
      key: string;
      order: WorkOrder;
      user: UserProfile;
      taskRole: ProjectTaskRole;
      status: 'active' | 'completed';
      assignedAt: string;
      assignedBy?: string;
      completedAt?: string;
      completedBy?: string;
      closingNote?: string;
      elapsed: ReturnType<typeof getAssignmentElapsedDuration>;
      loggedHoursInOrder: number;
    }> = [];

    orders.forEach((order) => {
      const team = getOrderTeamAssignments(order);
      team.forEach((assign) => {
        const usr = users.find((u) => u.id === assign.userId);
        if (!usr) return;
        const elapsed = getAssignmentElapsedDuration(assign, liveNowMs);
        const orderUserMinutes = timeLogs
          .filter((l) => l.orderId === order.id && l.employeeId === usr.id)
          .reduce((acc, l) => acc + l.minutes, 0);

        rows.push({
          key: `${order.id}-${usr.id}`,
          order,
          user: usr,
          taskRole: assign.taskRole,
          status: assign.status,
          assignedAt: assign.assignedAt,
          assignedBy: assign.assignedBy,
          completedAt: assign.completedAt,
          completedBy: assign.completedBy,
          closingNote: assign.closingNote,
          elapsed,
          loggedHoursInOrder: Number((orderUserMinutes / 60).toFixed(2)),
        });
      });
    });

    return rows.sort((a, b) => {
      if (a.status !== b.status) return a.status === 'active' ? -1 : 1;
      return b.elapsed.totalSeconds - a.elapsed.totalSeconds;
    });
  }, [orders, users, timeLogs, liveNowMs]);

  const filteredTenureRows = useMemo(() => {
    return projectTenureRows.filter((row) => {
      if (tenureStatusFilter !== 'all' && row.status !== tenureStatusFilter) return false;
      if (tenureEmployeeFilter !== 'all' && row.user.id !== tenureEmployeeFilter) return false;
      return true;
    });
  }, [projectTenureRows, tenureStatusFilter, tenureEmployeeFilter]);

  const activeTenureCount = useMemo(
    () => projectTenureRows.filter((r) => r.status === 'active').length,
    [projectTenureRows]
  );
  const completedTenureCount = useMemo(
    () => projectTenureRows.filter((r) => r.status === 'completed').length,
    [projectTenureRows]
  );

  // Carga de trabajo por colaborador considerando asignaciones múltiples y bajas
  const workloadByEmployee = useMemo(() => {
    return users.map((u) => {
      const activeOrders = orders.filter((o) => {
        if (o.stage === 'Finalizado y Liquidado') return false;
        const team = getOrderTeamAssignments(o);
        return team.some((a) => a.userId === u.id && a.status === 'active');
      });
      const completedOrders = orders.filter((o) => {
        const team = getOrderTeamAssignments(o);
        return team.some((a) => a.userId === u.id && a.status === 'completed');
      });
      const userLogs = timeLogs.filter((l) => l.employeeId === u.id);
      const totalMinutesWorked = userLogs.reduce((acc, l) => acc + l.minutes, 0);
      const totalHoursWorked = Number((totalMinutesWorked / 60).toFixed(1));

      return {
        user: u,
        activeCount: activeOrders.length,
        completedCount: completedOrders.length,
        activeOrderCodes: activeOrders.map((o) => o.id),
        totalHoursWorked,
        isOverloaded: activeOrders.length >= 4,
      };
    });
  }, [users, orders, timeLogs]);

  // Comparativa de rentabilidad de tiempos por Orden (Cotizado vs Real)
  const orderTimeAudit = useMemo(() => {
    return orders.map((o) => {
      const logs = timeLogs.filter((l) => l.orderId === o.id);
      const realDesignHrs = Number(
        (logs.filter((l) => l.phase === 'design').reduce((a, b) => a + b.minutes, 0) / 60).toFixed(2)
      );
      const realMachineHrs = Number(
        (logs.filter((l) => l.phase === 'machine').reduce((a, b) => a + b.minutes, 0) / 60).toFixed(2)
      );
      const realInstallHrs = Number(
        (
          logs.filter((l) => l.phase === 'installation').reduce((a, b) => a + b.minutes, 0) / 60
        ).toFixed(2)
      );

      const totalEstimatedHrs = Number(
        (o.estimatedDesignHours + o.estimatedMachineHours + o.estimatedInstallHours).toFixed(2)
      );
      const loggedPhaseHrs = Number((realDesignHrs + realMachineHrs + realInstallHrs).toFixed(2));

      // MEJORA 3: Calcular también Horas Laborales Efectivas (sin pausas de turno) registradas en el reloj de permanencia
      const team = getOrderTeamAssignments(o);
      const effectiveTenureHrs = Number(
        team
          .reduce((acc, a) => acc + getAssignmentElapsedDuration(a, liveNowMs).effectiveHoursDecimal, 0)
          .toFixed(2)
      );

      // Si hay bitácora por fase, usamos la mayor precisión o las horas efectivas sin pausas
      const totalRealHrs = loggedPhaseHrs > 0 ? loggedPhaseHrs : effectiveTenureHrs;
      const diffHrs = Number((totalEstimatedHrs - totalRealHrs).toFixed(2));

      // Costo estimado vs real (Diseño $12/h, Máquina/Instalación $11/h)
      const estimatedLaborCost = Number(
        (o.estimatedDesignHours * 12 + (o.estimatedMachineHours + o.estimatedInstallHours) * 11).toFixed(2)
      );
      const realLaborCost = Number(
        (
          (loggedPhaseHrs > 0
            ? realDesignHrs * 12 + (realMachineHrs + realInstallHrs) * 11
            : effectiveTenureHrs * 11.5)
        ).toFixed(2)
      );

      return {
        order: o,
        realDesignHrs,
        realMachineHrs,
        realInstallHrs,
        effectiveTenureHrs,
        totalEstimatedHrs,
        totalRealHrs,
        diffHrs,
        estimatedLaborCost,
        realLaborCost,
        isOverBudget: totalRealHrs > totalEstimatedHrs && totalEstimatedHrs > 0,
      };
    });
  }, [orders, timeLogs, liveNowMs]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualMinutes <= 0) return;
    onAddManualTimeLog({
      orderId: manualOrderId,
      employeeId: manualEmployeeId,
      phase: manualPhase,
      minutes: manualMinutes,
      date: '2026-10-16',
      note: manualNote.trim() || 'Registro manual de tiempo',
    });
    if (signOffOnManualLog) {
      signOffEmployeeFromOrder(
        manualOrderId,
        manualEmployeeId,
        manualNote.trim() || 'Trabajo completado en registro de horas'
      );
    }
    setManualNote('');
  };

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            5. Tiempos en Proyecto y Control de Rendimiento
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Visualiza en tiempo real cuánto lleva cada empleado dentro de un proyecto hasta que se dé de baja, además del cronómetro operativo por fase.
          </p>
        </div>
      </div>

      {/* PANEL PRINCIPAL: TIEMPO QUE LLEVA CADA EMPLEADO DENTRO DE UN PROYECTO HASTA DARSE DE BAJA */}
      <div className="bg-white dark:bg-[#111620] border border-slate-200 dark:border-[#1e2636] rounded-xl shadow-xs overflow-hidden">
        <div className="px-5 py-4 bg-slate-50 dark:bg-[#141a26] border-b border-slate-200 dark:border-[#1e2636] flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <div className="p-2 rounded-lg bg-slate-800 text-indigo-400 border border-slate-700 shrink-0 mt-0.5">
              <Timer className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                  Tiempo de Permanencia en Proyecto por Empleado (Hasta Dar de Baja)
                </h3>
                <span className="px-2 py-0.5 text-[11px] font-mono font-bold rounded bg-emerald-600 text-white animate-pulse">
                  ● EN VIVO
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                El reloj de cada empleado corre automáticamente desde que ingresa al proyecto y{' '}
                <strong>solo se detiene cuando se da de baja del mismo</strong>.
              </p>
            </div>
          </div>

          {/* Filtros de Estado y Empleado */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setTenureStatusFilter('active')}
                className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                  tenureStatusFilter === 'active'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Activos Corriendo ({activeTenureCount})
              </button>
              <button
                type="button"
                onClick={() => setTenureStatusFilter('completed')}
                className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                  tenureStatusFilter === 'completed'
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Dados de Baja ({completedTenureCount})
              </button>
              <button
                type="button"
                onClick={() => setTenureStatusFilter('all')}
                className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                  tenureStatusFilter === 'all'
                    ? 'bg-slate-800 text-white dark:bg-slate-700'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Todos ({projectTenureRows.length})
              </button>
            </div>

            <select
              value={tenureEmployeeFilter}
              onChange={(e) => setTenureEmployeeFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs font-medium bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
            >
              <option value="all">Todos los Empleados</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.department})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Barra Rápida para Dar de Alta / Asignar un Empleado a un Proyecto (Arranca su reloj desde 00:00:00) */}
        <form
          onSubmit={handleAssignEmployeeToProject}
          className="px-5 py-3 bg-slate-50 dark:bg-slate-950/70 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-end gap-2.5"
        >
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-0.5">
                1. Empleado que ingresa al proyecto
              </label>
              <select
                value={assignEmployeeId}
                onChange={(e) => setAssignEmployeeId(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
              >
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} — {u.department}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-0.5">
                2. Proyecto / Orden de Trabajo
              </label>
              <select
                value={assignOrderId}
                onChange={(e) => setAssignOrderId(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs font-mono bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
              >
                {orders.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.id} · {o.clientName} ({o.title.slice(0, 28)}...)
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-0.5">
                3. Tarea asignada en el proyecto
              </label>
              <select
                value={assignTaskRole}
                onChange={(e) => setAssignTaskRole(e.target.value as ProjectTaskRole)}
                className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
              >
                {PROJECT_TASK_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            type="submit"
            className="px-3.5 py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg inline-flex items-center justify-center gap-1.5 shrink-0 shadow-2xs"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Dar de Alta en Proyecto (Iniciar Reloj)</span>
          </button>
        </form>

        {/* Tabla de Empleados dentro de Proyectos y su Tiempo en Vivo hasta la Baja */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100/80 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400">
              <tr>
                <th className="py-2.5 px-4">Empleado / Área</th>
                <th className="py-2.5 px-4">Proyecto Asignado</th>
                <th className="py-2.5 px-4">Rol en el Proyecto</th>
                <th className="py-2.5 px-4">Ingreso / Baja</th>
                <th className="py-2.5 px-4 text-right">Tiempo en Proyecto (Hasta Baja)</th>
                <th className="py-2.5 px-4 text-right">Acción (Dar de Baja / Estado)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {filteredTenureRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    No hay registros para el filtro seleccionado.
                  </td>
                </tr>
              ) : (
                filteredTenureRows.map((row) => {
                  const isActive = row.status === 'active';
                  const noteVal = closingNotesMap[row.key] || '';

                  return (
                    <tr
                      key={row.key}
                      className={
                        isActive
                          ? 'bg-blue-50/30 dark:bg-blue-950/15 hover:bg-blue-50/60 dark:hover:bg-blue-950/30'
                          : 'bg-white dark:bg-slate-900 opacity-85'
                      }
                    >
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 dark:text-white">
                          {row.user.name}
                        </div>
                        <div className="text-[11px] text-slate-500">{row.user.department}</div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                            {row.order.id}
                          </span>
                          <span className="font-semibold text-slate-900 dark:text-white">
                            {row.order.clientName}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 truncate max-w-xs">
                          {row.order.title}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <span className="font-medium text-slate-800 dark:text-slate-200 block">
                          {row.taskRole}
                        </span>
                        {row.loggedHoursInOrder > 0 && (
                          <span className="text-[10px] font-mono text-slate-500">
                            Bitácora fase: {row.loggedHoursInOrder}h
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 font-mono text-[11px]">
                        <div className="text-slate-700 dark:text-slate-300">
                          <span className="text-slate-400">Alta: </span>
                          {row.assignedAt}
                          {row.assignedBy && (
                            <span className="block text-[10px] font-sans text-slate-500">
                              Por: {row.assignedBy}
                            </span>
                          )}
                        </div>
                        {isActive ? (
                          <span className="text-amber-600 dark:text-amber-400 font-semibold">
                            Sin dar de baja aún
                          </span>
                        ) : (
                          <div className="text-emerald-700 dark:text-emerald-400 mt-0.5">
                            <span>Baja: </span>
                            {row.completedAt || 'Finalizado'}
                            <span className="block text-[10px] font-sans font-semibold text-emerald-800 dark:text-emerald-300">
                              Ejecutada por: {row.completedBy || row.user.name}
                            </span>
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right font-mono">
                        {isActive ? (
                          <div className="inline-flex flex-col items-end gap-0.5">
                            <span
                              className={`px-2.5 py-1 rounded-md font-bold text-xs tracking-wide border ${
                                row.elapsed.isPaused
                                  ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                                  : 'bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-300 border-amber-300 dark:border-amber-700'
                              }`}
                            >
                              ⏱️ Total: {row.elapsed.formattedShort} ({row.elapsed.totalHoursDecimal}h)
                            </span>
                            <span className="px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[11px] font-bold">
                              ⚡ Efectivas (sin pausas): {row.elapsed.formattedEffective} (
                              {row.elapsed.effectiveHoursDecimal}h)
                            </span>
                            <span className="text-[10px] text-slate-500">
                              {row.elapsed.isPaused
                                ? '⏸️ Turno en pausa (No suma horas nocturnas)'
                                : '▶ Turno activo corriendo hasta dar de baja'}
                            </span>
                          </div>
                        ) : (
                          <div className="inline-flex flex-col items-end gap-0.5">
                            <span className="px-2.5 py-1 rounded-md bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 font-bold text-xs">
                              ✓ Total: {row.elapsed.formattedShort} ({row.elapsed.totalHoursDecimal}h)
                            </span>
                            <span className="text-[11px] font-bold text-blue-700 dark:text-blue-400">
                              ⚡ Efectivas trabajadas: {row.elapsed.formattedEffective} (
                              {row.elapsed.effectiveHoursDecimal}h)
                            </span>
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right">
                        {isActive ? (
                          <div className="flex flex-wrap items-center justify-end gap-1.5">
                            {/* MEJORA 3: Botón Pausar / Reanudar Turno */}
                            <button
                              type="button"
                              onClick={() => handleToggleShiftPause(row.order.id, row.user.id)}
                              className={`px-2.5 py-1.5 text-xs font-bold rounded-lg inline-flex items-center gap-1 whitespace-nowrap border transition-colors ${
                                row.elapsed.isPaused
                                  ? 'bg-blue-600 hover:bg-blue-700 text-white border-blue-600'
                                  : 'bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700'
                              }`}
                              title="Pausa el turno al cerrar el taller para no sumar horas de la noche a las Horas Laborales Efectivas"
                            >
                              {row.elapsed.isPaused ? (
                                <>
                                  <Play className="w-3.5 h-3.5" />
                                  <span>▶️ Reanudar Turno</span>
                                </>
                              ) : (
                                <>
                                  <Pause className="w-3.5 h-3.5" />
                                  <span>⏸️ Pausar Turno</span>
                                </>
                              )}
                            </button>

                            <input
                              type="text"
                              value={noteVal}
                              onChange={(e) =>
                                setClosingNotesMap((prev) => ({
                                  ...prev,
                                  [row.key]: e.target.value,
                                }))
                              }
                              placeholder="Nota de cierre..."
                              className="w-28 px-2 py-1 text-[11px] bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-white"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                signOffEmployeeFromOrder(row.order.id, row.user.id, noteVal)
                              }
                              className="px-2.5 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg inline-flex items-center gap-1 whitespace-nowrap shadow-2xs"
                              title="Da de baja al empleado dentro de este proyecto y detiene su contador de permanencia"
                            >
                              <UserCheck className="w-3.5 h-3.5" />
                              <span>Dar de Baja</span>
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-2">
                            {row.closingNote && (
                              <span
                                className="text-[10px] text-slate-500 italic max-w-[140px] truncate"
                                title={row.closingNote}
                              >
                                "{row.closingNote}"
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() =>
                                handleReactivateEmployeeInOrder(row.order.id, row.user.id)
                              }
                              className="px-2.5 py-1 text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded inline-flex items-center gap-1"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>Reactivar</span>
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>


      {/* Fila Superior: Cronómetro en Vivo + Registro Manual */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Panel 1: Cronómetro Industrial en Vivo (7 cols) */}
        <div className="lg:col-span-7 bg-slate-900 text-white border border-slate-800 rounded-lg p-6 flex flex-col justify-between space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div>
              <span className="text-xs font-mono text-blue-400">
                CRONÓMETRO DE PRODUCCIÓN EN TIEMPO REAL
              </span>
              <h3 className="text-base font-bold mt-0.5">
                {PHASE_LABELS[activeTimerPhase]} · Orden {activeTimerOrderId}
              </h3>
            </div>
            <div className="text-3xl sm:text-4xl font-mono font-bold tracking-wider text-emerald-400">
              {formatSecondsToHMS(timerSeconds)}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Orden de Trabajo</label>
              <select
                value={activeTimerOrderId}
                onChange={(e) => setActiveTimerOrderId(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono bg-slate-950 border border-slate-700 rounded text-white"
              >
                {orders.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.id} — {o.clientName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Fase Operativa</label>
              <select
                value={activeTimerPhase}
                onChange={(e) => setActiveTimerPhase(e.target.value as any)}
                className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded text-white"
              >
                <option value="design">Diseño / Pre-prensa</option>
                <option value="machine">Máquina / Taller 3D</option>
                <option value="installation">Instalación en Sitio</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Colaborador Activo</label>
              <select
                value={activeTimerEmployeeId}
                onChange={(e) => setActiveTimerEmployeeId(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded text-white"
              >
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-1">
            <input
              type="text"
              value={timerNote}
              onChange={(e) => setTimerNote(e.target.value)}
              placeholder="Detalle de la tarea ejecutada..."
              className="flex-1 px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded text-white"
            />
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={onToggleTimer}
                className={`px-4 py-2 text-xs font-semibold rounded inline-flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                  isTimerRunning
                    ? 'bg-amber-600 hover:bg-amber-500 text-white'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                }`}
              >
                {isTimerRunning ? (
                  <>
                    <Pause className="w-3.5 h-3.5" />
                    <span>Pausar</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5" />
                    <span>Iniciar Cronómetro</span>
                  </>
                )}
              </button>
              <button
                type="button"
                disabled={timerSeconds === 0}
                onClick={() => onStopAndSaveTimer(timerNote)}
                className="px-3.5 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
              >
                <Square className="w-3.5 h-3.5" />
                <span>Guardar Tiempo</span>
              </button>
              <button
                type="button"
                disabled={timerSeconds === 0}
                onClick={() => {
                  onStopAndSaveTimer(timerNote);
                  signOffEmployeeFromOrder(activeTimerOrderId, activeTimerEmployeeId, timerNote);
                }}
                className="px-3.5 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
                title="Detiene el cronómetro, guarda el tiempo y te da de baja del proyecto como trabajo finalizado"
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>Guardar + Darme de Baja</span>
              </button>
            </div>
          </div>
        </div>

        {/* Panel 2: Registro Manual de Horas (5 cols) */}
        <form
          onSubmit={handleManualSubmit}
          className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-3.5"
        >
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-600" />
            <span>Registro Manual de Horas y Baja de Proyecto</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Orden de Trabajo
              </label>
              <select
                value={manualOrderId}
                onChange={(e) => setManualOrderId(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-white"
              >
                {orders.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.id} — {o.clientName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Colaborador
              </label>
              <select
                value={manualEmployeeId}
                onChange={(e) => setManualEmployeeId(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-white"
              >
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Fase
              </label>
              <select
                value={manualPhase}
                onChange={(e) => setManualPhase(e.target.value as any)}
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-white"
              >
                <option value="design">Diseño / Pre-prensa</option>
                <option value="machine">Máquina / Taller</option>
                <option value="installation">Instalación en Sitio</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Tiempo Invertido (Minutos)
              </label>
              <input
                type="number"
                min="5"
                step="5"
                value={manualMinutes}
                onChange={(e) => setManualMinutes(Math.max(1, parseInt(e.target.value) || 0))}
                className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Actividad Realizada / Nota de Entrega
            </label>
            <input
              type="text"
              value={manualNote}
              onChange={(e) => setManualNote(e.target.value)}
              placeholder="Ej. Soldadura de estructura y prueba de módulos LED..."
              className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-white"
            />
          </div>

          <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer select-none pt-0.5">
            <input
              type="checkbox"
              checked={signOffOnManualLog}
              onChange={(e) => setSignOffOnManualLog(e.target.checked)}
              className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-600"
            />
            <span>
              Al registrar estas horas,{' '}
              <strong className="text-emerald-700 dark:text-emerald-400">
                darme de baja de este proyecto (trabajo finalizado)
              </strong>
            </span>
          </label>

          <button
            type="submit"
            className="w-full py-2 px-4 text-xs font-semibold text-white bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-500 rounded inline-flex items-center justify-center gap-1.5 transition-colors"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>
              Registrar {(manualMinutes / 60).toFixed(2)}h
              {signOffOnManualLog ? ' y Dar de Baja del Proyecto' : ' en Bitácora'}
            </span>
          </button>
        </form>
      </div>

      {/* Carga de Trabajo del Equipo para evitar cuellos de botella */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-600" />
              <span>Balance de Carga de Trabajo por Colaborador (Activos vs. Bajas Completadas)</span>
            </h3>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 dark:divide-slate-800">
          {workloadByEmployee.map((item) => (
            <div key={item.user.id} className="p-4 space-y-2">
              <div className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                {item.user.name}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                {item.user.department}
              </div>
              <div className="pt-1 flex items-baseline justify-between font-mono text-xs">
                <span className="text-slate-600 dark:text-slate-400">
                  Activos: <strong className="text-slate-900 dark:text-white">{item.activeCount}</strong>
                </span>
                <span className="text-emerald-700 dark:text-emerald-400">
                  Bajas: <strong>{item.completedCount}</strong>
                </span>
              </div>
              <div className="text-[11px] font-mono text-blue-600 dark:text-blue-400">
                {item.totalHoursWorked}h registradas
              </div>
              <div className="text-[11px] font-mono text-slate-500 truncate">
                {item.activeOrderCodes.length > 0
                  ? `En curso: ${item.activeOrderCodes.join(' · ')}`
                  : 'Libre de proyectos activos'}
              </div>
              <div className="text-[11px]">
                {item.isOverloaded ? (
                  <span className="text-amber-600 dark:text-amber-400 font-medium inline-flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> Alta Carga Operativa
                  </span>
                ) : (
                  <span className="text-emerald-700 dark:text-emerald-400 inline-flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Capacidad Disponible
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabla de Rentabilidad Real: Tiempo Cotizado vs Tiempo Real por Fase */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-blue-600" />
            <span>Auditoría de Rentabilidad Operativa: Tiempo Cotizado vs. Tiempo Real Trabajado</span>
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Desglose comparativo en horas por cada fase productiva (Diseño vs. Máquina vs. Instalación).
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400">
              <tr>
                <th className="py-3 px-4">Orden / Cliente</th>
                <th className="py-3 px-4 text-right">Diseño (Cot. / Real)</th>
                <th className="py-3 px-4 text-right">Máquina (Cot. / Real)</th>
                <th className="py-3 px-4 text-right">Instalación (Cot. / Real)</th>
                <th className="py-3 px-4 text-right">Total Horas</th>
                <th className="py-3 px-4 text-right">Desviación</th>
                {canSeeFinancialVariance && (
                  <th className="py-3 px-4 text-right">Costo M.O. (Cot. / Real)</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-mono">
              {orderTimeAudit.map((row) => (
                <tr key={row.order.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                  <td className="py-3 px-4 font-sans">
                    <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                      {row.order.id}
                    </span>{' '}
                    · <span className="font-medium text-slate-900 dark:text-white">{row.order.clientName}</span>
                    <div className="text-[11px] text-slate-500 truncate max-w-xs">
                      {row.order.title}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right">
                    {row.order.estimatedDesignHours}h /{' '}
                    <strong className="text-slate-900 dark:text-white">{row.realDesignHrs}h</strong>
                  </td>
                  <td className="py-3 px-4 text-right">
                    {row.order.estimatedMachineHours}h /{' '}
                    <strong className="text-slate-900 dark:text-white">{row.realMachineHrs}h</strong>
                  </td>
                  <td className="py-3 px-4 text-right">
                    {row.order.estimatedInstallHours}h /{' '}
                    <strong className="text-slate-900 dark:text-white">{row.realInstallHrs}h</strong>
                  </td>
                  <td className="py-3 px-4 text-right">
                    {row.totalEstimatedHrs}h /{' '}
                    <strong className="text-slate-900 dark:text-white">{row.totalRealHrs}h</strong>
                    <div className="text-[10px] text-emerald-700 dark:text-emerald-400">
                      ⚡ Efectivas s/pausa: {row.effectiveTenureHrs}h
                    </div>
                  </td>
                  <td
                    className={`py-3 px-4 text-right font-semibold ${
                      row.isOverBudget
                        ? 'text-red-600 dark:text-red-400'
                        : 'text-emerald-700 dark:text-emerald-400'
                    }`}
                  >
                    {row.diffHrs >= 0 ? `+${row.diffHrs}h a favor` : `${row.diffHrs}h sobrecosto`}
                  </td>
                  {canSeeFinancialVariance && (
                    <td className="py-3 px-4 text-right">
                      ${row.estimatedLaborCost.toFixed(2)} /{' '}
                      <strong className="text-slate-900 dark:text-white">
                        ${row.realLaborCost.toFixed(2)}
                      </strong>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
