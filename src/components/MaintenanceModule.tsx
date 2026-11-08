import React, { useState } from 'react';
import {
  Wrench,
  CheckCircle2,
  AlertTriangle,
  PlusCircle,
  Calendar,
} from 'lucide-react';
import {
  WorkshopMachine,
  MachineMaintenanceLog,
  UserProfile,
} from '../data/initialData';

interface MaintenanceModuleProps {
  machines: WorkshopMachine[];
  logs: MachineMaintenanceLog[];
  currentUser: UserProfile;
  onAddMaintenanceLog: (
    machineId: string,
    taskType: MachineMaintenanceLog['taskType'],
    cost: number,
    notes: string
  ) => void;
}

export function getDaysSince(dateStr: string): number {
  const past = new Date(dateStr + 'T00:00:00').getTime();
  const nowMs = Date.now();
  const referenceMs = past > nowMs ? new Date('2026-10-16T00:00:00').getTime() : nowMs;
  return Math.max(0, Math.round((referenceMs - past) / (1000 * 60 * 60 * 24)));
}

export const MaintenanceModule: React.FC<MaintenanceModuleProps> = ({
  machines,
  logs,
  onAddMaintenanceLog,
}) => {
  const [selectedMachineId, setSelectedMachineId] = useState<string>(machines[0]?.id || 'mac-1');
  const [taskType, setTaskType] = useState<MachineMaintenanceLog['taskType']>('Limpieza de cabezal');
  const [cost, setCost] = useState<number>(15);
  const [notes, setNotes] = useState<string>(
    'Test de inyectores al 100%, limpieza de wipers, capping station y purga de dampers.'
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAddMaintenanceLog(selectedMachineId, taskType, cost, notes);
    setNotes('');
  };

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Bitácora de Mantenimiento Preventivo de Maquinaria
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Control de plotters de impresión, plotters de corte, laminadoras y routers CNC/Láser con contador automático de días transcurridos.
          </p>
        </div>
      </div>

      {/* Estado de Flota de Equipos de Taller */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {machines.map((mac) => {
          const daysElapsed = getDaysSince(mac.lastMaintenanceDate);
          const isOverdue = daysElapsed >= mac.recommendedIntervalDays;

          return (
            <div
              key={mac.id}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 flex flex-col justify-between space-y-3"
            >
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="font-bold text-blue-600 dark:text-blue-400">{mac.code}</span>
                  <span
                    className={
                      isOverdue
                        ? 'text-amber-600 dark:text-amber-400 font-semibold inline-flex items-center gap-1'
                        : 'text-emerald-700 dark:text-emerald-400 inline-flex items-center gap-1'
                    }
                  >
                    {isOverdue ? (
                      <>
                        <AlertTriangle className="w-3.5 h-3.5" /> Preventivo Requerido
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" /> Operativo
                      </>
                    )}
                  </span>
                </div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  {mac.name}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">{mac.brandModel}</p>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-1.5 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-500">Último mant.:</span>
                  <span className="text-slate-900 dark:text-white">{mac.lastMaintenanceDate}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Días transcurridos:</span>
                  <span
                    className={
                      isOverdue
                        ? 'text-red-600 dark:text-red-400 font-bold'
                        : 'text-emerald-700 dark:text-emerald-400 font-bold'
                    }
                  >
                    {daysElapsed} días (ciclo: {mac.recommendedIntervalDays}d)
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Uso acumulado:</span>
                  <span className="text-slate-800 dark:text-slate-200">{mac.totalHoursLogged} h</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedMachineId(mac.id)}
                className="w-full py-1.5 px-3 text-xs font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded transition-colors"
              >
                Registrar Mantenimiento Hoy
              </button>
            </div>
          );
        })}
      </div>

      {/* Formulario de Nuevo Mantenimiento + Historial Técnico */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <form
          onSubmit={handleSubmit}
          className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-4"
        >
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <Wrench className="w-4 h-4 text-blue-600" />
            <span>Registrar Intervención Técnica / Preventiva</span>
          </h3>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Equipo / Maquinaria
              </label>
              <select
                value={selectedMachineId}
                onChange={(e) => setSelectedMachineId(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-white"
              >
                {machines.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.code} — {m.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Tarea Realizada
                </label>
                <select
                  value={taskType}
                  onChange={(e) => setTaskType(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-white"
                >
                  <option value="Limpieza de cabezal">Limpieza de cabezal</option>
                  <option value="Cambio de dampers">Cambio de dampers</option>
                  <option value="Cambio de cuchillas">Cambio de cuchillas</option>
                  <option value="Calibración óptica/avance">Calibración óptica/avance</option>
                  <option value="Engrase de rieles">Engrase de rieles</option>
                  <option value="Mantenimiento preventivo general">Mantenimiento preventivo general</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Costo Repuestos ($)
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={cost}
                  onChange={(e) => setCost(Math.max(0, Number(e.target.value)))}
                  className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Observaciones Técnicas y Parámetros de Prueba
              </label>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-white"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2 px-4 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors inline-flex items-center justify-center gap-1.5"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Guardar en Bitácora y Reiniciar Contador a 0 Días</span>
            </button>
          </div>
        </form>

        {/* Historial de Mantenimientos (7 cols) */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-600" />
              <span>Historial de Intervenciones Técnicas de Maquinaria</span>
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400">
                <tr>
                  <th className="py-2.5 px-4">Fecha</th>
                  <th className="py-2.5 px-4">Equipo</th>
                  <th className="py-2.5 px-4">Tarea</th>
                  <th className="py-2.5 px-4">Técnico</th>
                  <th className="py-2.5 px-4">Detalle</th>
                  <th className="py-2.5 px-4 text-right">Costo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {logs.map((log) => {
                  const mac = machines.find((m) => m.id === log.machineId);
                  return (
                    <tr key={log.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                      <td className="py-2.5 px-4 font-mono text-slate-500 whitespace-nowrap">
                        {log.date}
                      </td>
                      <td className="py-2.5 px-4 font-medium text-slate-900 dark:text-white">
                        {mac ? `${mac.code} · ${mac.name}` : log.machineId}
                      </td>
                      <td className="py-2.5 px-4 font-semibold text-blue-600 dark:text-blue-400">
                        {log.taskType}
                      </td>
                      <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400">
                        {log.technician}
                      </td>
                      <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400">
                        {log.notes}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono text-slate-900 dark:text-white">
                        ${log.cost.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
