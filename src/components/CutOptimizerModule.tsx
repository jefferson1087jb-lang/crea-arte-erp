import React, { useState, useMemo } from 'react';
import {
  Scissors,
  Layers,
  FileDown,
  Save,
  Send,
  Recycle,
  CheckCircle2,
  PackagePlus,
  Sparkles,
} from 'lucide-react';
import {
  CutOptimizationSummary,
  getNowTimestamp,
  InventoryItem,
  QuoterTransferPayload,
  ReusableOffcut,
  UserProfile,
  WorkOrder,
} from '../data/initialData';
import {
  evaluateRollNesting,
  evaluateSheetNesting,
  findCompatibleReusableOffcuts,
} from '../domain/nestingEngine';
import { downloadCutPlan2DPdf } from '../utils/cutPlanPdfGenerator';

export interface CutOptimizerModuleProps {
  orders?: WorkOrder[];
  inventory?: InventoryItem[];
  reusableOffcuts?: ReusableOffcut[];
  currentUser?: UserProfile;
  onUpdateOrder?: (updatedOrder: WorkOrder) => void;
  onSendToQuoter?: (payload: QuoterTransferPayload) => void;
  onAddOffcut?: (offcut: ReusableOffcut) => void;
  onUseOffcut?: (offcutId: string, usedInOrderId?: string) => void;
  onNotify?: (message: string) => void;
}

type RotationStrategy = 'auto' | 'normal' | 'rotated';

export const CutOptimizerModule: React.FC<CutOptimizerModuleProps> = ({
  orders = [],
  inventory = [],
  reusableOffcuts = [],
  currentUser,
  onUpdateOrder,
  onSendToQuoter,
  onAddOffcut,
  onUseOffcut,
  onNotify,
}) => {
  const [mode, setMode] = useState<'roll' | 'sheet'>('roll');
  const [selectedOrderId, setSelectedOrderId] = useState<string>('');

  // Parámetros para Bobinas
  const [selectedRollWidthM, setSelectedRollWidthM] = useState<number>(1.52);
  const [stickerWidthCm, setStickerWidthCm] = useState<number>(12);
  const [stickerHeightCm, setStickerHeightCm] = useState<number>(8);
  const [targetStickerQty, setTargetStickerQty] = useState<number>(250);
  const [marginOposCm, setMarginOposCm] = useState<number>(3);
  const [gapMm, setGapMm] = useState<number>(3);
  const [forceRotateRoll, setForceRotateRoll] = useState<RotationStrategy>('auto');

  // Parámetros para Planchas Rígidas (1.22m x 2.44m = 122cm x 244cm)
  const [pieceWidthCm, setPieceWidthCm] = useState<number>(40);
  const [pieceHeightCm, setPieceHeightCm] = useState<number>(30);
  const [targetPieceQty, setTargetPieceQty] = useState<number>(32);
  const [kerfMm, setKerfMm] = useState<number>(3);
  const [forceRotateSheet, setForceRotateSheet] = useState<RotationStrategy>('auto');

  // Formulario rápido para guardar retazo reutilizable en bodega
  const [selectedRigidMaterialId, setSelectedRigidMaterialId] =
    useState<string>('inv-acrilico-3mm');
  const [customOffcutWidthCm, setCustomOffcutWidthCm] = useState<number>(84);
  const [customOffcutHeightCm, setCustomOffcutHeightCm] = useState<number>(122);
  const [customOffcutThicknessMm, setCustomOffcutThicknessMm] = useState<number>(3);
  const [customOffcutNotes, setCustomOffcutNotes] = useState<string>(
    'Sobrante útil verificado en mesa CNC/Láser'
  );

  const selectedOrder = useMemo(
    () => orders.find((o) => o.id === selectedOrderId),
    [orders, selectedOrderId]
  );

  const rigidMaterials = useMemo(() => {
    const filtered = inventory.filter((i) => i.category === 'Planchas Rígidas');
    if (filtered.length > 0) return filtered;
    return [
      {
        id: 'inv-acrilico-3mm',
        sku: 'PL-ACR-3MM',
        name: 'Plancha Acrílico Blanco Opal 3mm (1.22m x 2.44m)',
        category: 'Planchas Rígidas' as const,
        unit: 'plancha' as const,
        currentStock: 8,
        minStock: 3,
        unitCost: 42,
        supplier: 'Acrílicos del Pacífico',
        lastUpdated: '2026-10-16',
      },
      {
        id: 'inv-alucobond-4mm',
        sku: 'PL-ALU-4MM',
        name: 'Plancha Alucobond Compuesto Aluminio 4mm (1.22m x 2.44m)',
        category: 'Planchas Rígidas' as const,
        unit: 'plancha' as const,
        currentStock: 6,
        minStock: 2,
        unitCost: 58,
        supplier: 'Importadora Gráfica Andina',
        lastUpdated: '2026-10-16',
      },
      {
        id: 'inv-sintra-3mm',
        sku: 'PL-SIN-3MM',
        name: 'Plancha PVC Espumado Sintra 3mm Blanco (1.22m x 2.44m)',
        category: 'Planchas Rígidas' as const,
        unit: 'plancha' as const,
        currentStock: 14,
        minStock: 5,
        unitCost: 19.5,
        supplier: 'Suministros VisualPro',
        lastUpdated: '2026-10-16',
      },
    ];
  }, [inventory]);

  // Cargar medidas automáticamente al seleccionar una orden activa #CA-XXX
  const handleSelectOrder = (orderId: string) => {
    setSelectedOrderId(orderId);
    const ord = orders.find((o) => o.id === orderId);
    if (!ord) return;

    const isRigidOrder =
      ord.category === 'Rótulos 3D y Estructurados' ||
      ord.category === 'Corte y Grabado Láser / CNC' ||
      ord.category === 'Señalética y Merchandising' ||
      ord.materialName.toLowerCase().includes('acrílico') ||
      ord.materialName.toLowerCase().includes('alucobond') ||
      ord.materialName.toLowerCase().includes('sintra') ||
      ord.materialName.toLowerCase().includes('mdf');

    const wCm = Math.max(2, Math.round((ord.widthM || 0.4) * 100));
    const hCm = Math.max(2, Math.round((ord.heightM || 0.3) * 100));
    const qty = Math.max(1, ord.quantity || 1);

    if (isRigidOrder) {
      setMode('sheet');
      setPieceWidthCm(Math.min(244, wCm));
      setPieceHeightCm(Math.min(244, hCm));
      setTargetPieceQty(qty);
    } else {
      setMode('roll');
      setStickerWidthCm(Math.min(150, wCm));
      setStickerHeightCm(Math.min(500, hCm));
      setTargetStickerQty(qty);
    }

    onNotify?.(
      `Medidas de la orden ${ord.id} (${wCm}cm × ${hCm}cm · ${qty} und) cargadas en el Optimizador 2D.`
    );
  };

  // Cálculos de Optimización en Bobinas (1.05m, 1.27m, 1.52m) usando capa de dominio puro
  const rollAnalysis = useMemo(() => {
    const rollOptions = [1.05, 1.27, 1.52];

    const normalCurrent = evaluateRollNesting({
      rollW_M: selectedRollWidthM,
      orient: 'normal',
      stickerWidthCm,
      stickerHeightCm,
      targetStickerQty,
      marginOposCm,
      gapMm,
    });
    const rotatedCurrent = evaluateRollNesting({
      rollW_M: selectedRollWidthM,
      orient: 'rotated',
      stickerWidthCm,
      stickerHeightCm,
      targetStickerQty,
      marginOposCm,
      gapMm,
    });

    let activeResult = normalCurrent;
    if (forceRotateRoll === 'rotated') {
      activeResult = rotatedCurrent;
    } else if (forceRotateRoll === 'auto') {
      activeResult =
        rotatedCurrent.cols > 0 && rotatedCurrent.wastePct < normalCurrent.wastePct
          ? rotatedCurrent
          : normalCurrent;
    }

    const comparisonTable = rollOptions.map((rw) => {
      const n = evaluateRollNesting({
        rollW_M: rw,
        orient: 'normal',
        stickerWidthCm,
        stickerHeightCm,
        targetStickerQty,
        marginOposCm,
        gapMm,
      });
      const r = evaluateRollNesting({
        rollW_M: rw,
        orient: 'rotated',
        stickerWidthCm,
        stickerHeightCm,
        targetStickerQty,
        marginOposCm,
        gapMm,
      });
      return r.cols > 0 && r.wastePct < n.wastePct ? r : n;
    });

    return {
      active: activeResult,
      comparisonTable,
    };
  }, [
    selectedRollWidthM,
    stickerWidthCm,
    stickerHeightCm,
    targetStickerQty,
    marginOposCm,
    gapMm,
    forceRotateRoll,
  ]);

  // Cálculos de Optimización en Planchas Rígidas 1.22m x 2.44m (122cm x 244cm)
  const sheetAnalysis = useMemo(() => {
    const normal = evaluateSheetNesting({
      orient: 'normal',
      pieceWidthCm,
      pieceHeightCm,
      targetPieceQty,
      kerfMm,
    });
    const rotated = evaluateSheetNesting({
      orient: 'rotated',
      pieceWidthCm,
      pieceHeightCm,
      targetPieceQty,
      kerfMm,
    });

    let active = normal;
    if (forceRotateSheet === 'rotated') active = rotated;
    else if (forceRotateSheet === 'auto') {
      active = rotated.piecesPerSheet > normal.piecesPerSheet ? rotated : normal;
    }

    return { active, normal, rotated };
  }, [pieceWidthCm, pieceHeightCm, targetPieceQty, kerfMm, forceRotateSheet]);

  // Detección inteligente de Retazos Reutilizables compatibles en bodega
  const compatibleOffcuts = useMemo(() => {
    if (mode !== 'sheet') return [];
    return findCompatibleReusableOffcuts({
      pieceWidthCm,
      pieceHeightCm,
      targetPieceQty,
      kerfMm,
      offcuts: reusableOffcuts,
    });
  }, [mode, pieceWidthCm, pieceHeightCm, targetPieceQty, kerfMm, reusableOffcuts]);

  // Guardar despiece en la orden activa seleccionada
  const handleSaveCutSummaryToOrder = () => {
    if (!selectedOrder || !onUpdateOrder) {
      onNotify?.('Selecciona primero una orden activa (#CA-XXX) en el selector superior.');
      return;
    }

    const nowTs = getNowTimestamp();
    const authorName = currentUser?.name || 'Operador Pre-Prensa';

    const summary: CutOptimizationSummary =
      mode === 'roll'
        ? {
            mode: 'roll',
            pieceWidthCm: stickerWidthCm,
            pieceHeightCm: stickerHeightCm,
            quantity: targetStickerQty,
            orientation: rollAnalysis.active.orient,
            rollWidthM: selectedRollWidthM,
            linearMeters: rollAnalysis.active.linearMeters,
            utilizationPct: rollAnalysis.active.usedPct,
            wastePct: rollAnalysis.active.wastePct,
            sideScrapCm: rollAnalysis.active.sideScrapCm,
            savedAt: nowTs,
            savedBy: authorName,
          }
        : {
            mode: 'sheet',
            pieceWidthCm,
            pieceHeightCm,
            quantity: targetPieceQty,
            orientation: sheetAnalysis.active.orient,
            sheetsNeeded: sheetAnalysis.active.sheetsNeeded,
            piecesPerSheet: sheetAnalysis.active.piecesPerSheet,
            utilizationPct: sheetAnalysis.active.utilizationPct,
            wastePct: sheetAnalysis.active.wastePct,
            offcutRightCm: sheetAnalysis.active.offcutRightCm,
            offcutBottomCm: sheetAnalysis.active.offcutBottomCm,
            savedAt: nowTs,
            savedBy: authorName,
          };

    const noteLine =
      mode === 'roll'
        ? `[DESPIECE 2D BOBINA ${selectedRollWidthM.toFixed(2)}m]: ${targetStickerQty} pzas de ${stickerWidthCm}×${stickerHeightCm}cm → ${rollAnalysis.active.linearMeters} ml (${rollAnalysis.active.cols} col × ${rollAnalysis.active.rowsNeeded} filas) · Merma: ${rollAnalysis.active.wastePct}%`
        : `[DESPIECE 2D PLANCHA 122×244cm]: ${targetPieceQty} pzas de ${pieceWidthCm}×${pieceHeightCm}cm → ${sheetAnalysis.active.sheetsNeeded} plancha(s) (${sheetAnalysis.active.piecesPerSheet} pzas/pl) · Merma: ${sheetAnalysis.active.wastePct}% · Retazo Der: ${sheetAnalysis.active.offcutRightCm}×122cm`;

    const updatedNotes = selectedOrder.notes
      ? `${selectedOrder.notes}\n${noteLine}`
      : noteLine;

    onUpdateOrder({
      ...selectedOrder,
      wastePercent: Math.round(summary.wastePct),
      cutOptimizationSummary: summary,
      notes: updatedNotes,
    });

    onNotify?.(
      `Despiece 2D guardado en la ficha técnica de la orden ${selectedOrder.id} (Merma actualizada: ${summary.wastePct}%).`
    );
  };

  // Enviar resultado al Cotizador
  const handleSendOptimizationToQuoter = () => {
    if (!onSendToQuoter) return;
    if (mode === 'roll') {
      onSendToQuoter({
        mode: 'roll',
        orderId: selectedOrder?.id,
        widthM: Number((stickerWidthCm / 100).toFixed(2)),
        heightM: Number((stickerHeightCm / 100).toFixed(2)),
        quantity: targetStickerQty,
        wastePct: rollAnalysis.active.wastePct,
        summaryNote: `Optimizado en bobina ${selectedRollWidthM.toFixed(2)}m: ${rollAnalysis.active.linearMeters} ml (${rollAnalysis.active.usedPct}% aprovechamiento)`,
      });
    } else {
      onSendToQuoter({
        mode: 'sheet',
        orderId: selectedOrder?.id,
        widthM: Number((pieceWidthCm / 100).toFixed(2)),
        heightM: Number((pieceHeightCm / 100).toFixed(2)),
        quantity: targetPieceQty,
        wastePct: sheetAnalysis.active.wastePct,
        summaryNote: `Optimizado en plancha 1.22×2.44m: ${sheetAnalysis.active.sheetsNeeded} plancha(s) (${sheetAnalysis.active.piecesPerSheet} pzas/plancha)`,
      });
    }
  };

  // Descargar Plano de Corte 2D en PDF
  const handleDownloadCutPlanPdf = () => {
    const matObj = rigidMaterials.find((m) => m.id === selectedRigidMaterialId);
    const materialLabel =
      mode === 'roll'
        ? selectedOrder?.materialName || `Bobina Vinil / Lona (${selectedRollWidthM.toFixed(2)}m ancho)`
        : selectedOrder?.materialName || matObj?.name || 'Plancha Rígida 122cm × 244cm';

    const fileName = downloadCutPlan2DPdf({
      mode,
      order: selectedOrder,
      materialLabel,
      pieceWidthCm: mode === 'roll' ? stickerWidthCm : pieceWidthCm,
      pieceHeightCm: mode === 'roll' ? stickerHeightCm : pieceHeightCm,
      quantity: mode === 'roll' ? targetStickerQty : targetPieceQty,
      operatorName: currentUser?.name || 'Operador de Planta',
      rollResult: mode === 'roll' ? rollAnalysis.active : undefined,
      marginOposCm,
      gapMm,
      sheetResult: mode === 'sheet' ? sheetAnalysis.active : undefined,
      kerfMm,
    });

    onNotify?.(`Plano de Corte 2D descargado: "${fileName}" listo para plotter/router CNC.`);
  };

  // Guardar Retazo Calculado o Personalizado en Bodega
  const handleRegisterOffcut = (widthCm: number, heightCm: number, labelOrigin: string) => {
    if (!onAddOffcut) return;
    if (widthCm < 15 || heightCm < 15) {
      onNotify?.('El retazo es menor a 15×15 cm y se considera merma no reutilizable.');
      return;
    }

    const mat = rigidMaterials.find((m) => m.id === selectedRigidMaterialId) || rigidMaterials[0];
    const newOffcut: ReusableOffcut = {
      id: `offcut-${Date.now()}`,
      materialId: mat.id,
      materialName: mat.name,
      widthCm: Math.round(widthCm),
      heightCm: Math.round(heightCm),
      thicknessMm: customOffcutThicknessMm,
      sourceOrderId: selectedOrder?.id || 'TALLER-CNC',
      createdAt: getNowTimestamp(),
      createdBy: currentUser?.name || 'Operador CNC',
      status: 'Disponible',
      notes: `${labelOrigin} — ${customOffcutNotes}`,
    };

    onAddOffcut(newOffcut);
    onNotify?.(
      `Retazo reutilizable (${newOffcut.widthCm}cm × ${newOffcut.heightCm}cm de ${mat.name}) guardado en Inventario.`
    );
  };

  return (
    <div className="space-y-6">
      {/* Encabezado y Selector de Modo */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Calculador y Optimizador de Cortes (Nesting 2D + Retazos)
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Conectado con órdenes activas (#CA-XXX), Cotizador, Bodega de Retazos Rígidos y exportación de Plano de Corte 2D en PDF.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Selector de Modo */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setMode('roll')}
              className={`px-3.5 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                mode === 'roll'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Optimizador de Bobinas (Vinil / Lona)
            </button>
            <button
              type="button"
              onClick={() => setMode('sheet')}
              className={`px-3.5 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                mode === 'sheet'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Optimizador Planchas Rígidas (1.22m × 2.44m)
            </button>
          </div>
        </div>
      </div>

      {/* BARRA DE CONEXIÓN CON ÓRDENES ACTIVAS #CA-XXX Y ACCIONES RÁPIDAS */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex-1 grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
          <div className="sm:col-span-6">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Vincular con Orden Activa (#CA-XXX) para Cargar Medidas Automáticamente
            </label>
            <select
              value={selectedOrderId}
              onChange={(e) => handleSelectOrder(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-medium"
            >
              <option value="">— Seleccionar orden activa o usar modo libre —</option>
              {orders.map((ord) => (
                <option key={ord.id} value={ord.id}>
                  {ord.id} · {ord.clientName} — {ord.title} ({(ord.widthM * 100).toFixed(0)}×
                  {(ord.heightM * 100).toFixed(0)}cm · {ord.quantity} und)
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-6 text-xs text-slate-600 dark:text-slate-400">
            {selectedOrder ? (
              <div className="p-2.5 rounded-lg bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 space-y-0.5">
                <div className="font-semibold text-slate-900 dark:text-white">
                  {selectedOrder.id} — {selectedOrder.clientName}
                </div>
                <div className="font-mono text-[11px]">
                  Material: {selectedOrder.materialName} · Etapa: {selectedOrder.stage}
                </div>
                {selectedOrder.cutOptimizationSummary && (
                  <div className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">
                    ✓ Despiece guardado ({selectedOrder.cutOptimizationSummary.savedAt}) — Merma:{' '}
                    {selectedOrder.cutOptimizationSummary.wastePct}%
                  </div>
                )}
              </div>
            ) : (
              <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                Selecciona una orden para cargar sus dimensiones de inmediato o ingresa medidas manuales para simular un trabajo nuevo.
              </div>
            )}
          </div>
        </div>

        {/* Botones de Acción Conectados */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleSaveCutSummaryToOrder}
            className="px-3.5 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
            title="Anexa el resumen de metros lineales o planchas y % de merma en la ficha técnica de la orden"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Guardar Despiece en la Orden</span>
          </button>

          {onSendToQuoter && (
            <button
              type="button"
              onClick={handleSendOptimizationToQuoter}
              className="px-3.5 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
              title="Envía las medidas y el % de merma calculado directamente al Cotizador"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Enviar al Cotizador</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleDownloadCutPlanPdf}
            className="px-3.5 py-2 text-xs font-semibold bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white rounded-lg inline-flex items-center gap-1.5 border border-slate-700 transition-colors whitespace-nowrap"
            title="Descargar el Plano de Corte 2D en PDF con diagrama a escala para el operador de plotter/router"
          >
            <FileDown className="w-3.5 h-3.5" />
            <span>Plano de Corte 2D (PDF)</span>
          </button>
        </div>
      </div>

      {/* ALERTA INTELIGENTE SI CABE EN UN RETAZO REUTILIZABLE DE BODEGA */}
      {mode === 'sheet' && compatibleOffcuts.length > 0 && (
        <div className="bg-emerald-50/90 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span className="text-xs font-bold text-emerald-950 dark:text-emerald-200">
                ¡Ahorro de Plancha Detectado! Existen {compatibleOffcuts.length} retazo(s) en bodega donde entra esta pieza ({pieceWidthCm}×{pieceHeightCm} cm):
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {compatibleOffcuts.slice(0, 3).map((match) => (
              <div
                key={match.offcut.id}
                className="bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-900/80 rounded-lg p-3 flex flex-col justify-between gap-2 text-xs"
              >
                <div>
                  <div className="font-semibold text-slate-900 dark:text-white">
                    {match.offcut.materialName}
                  </div>
                  <div className="font-mono text-emerald-700 dark:text-emerald-400 font-bold mt-0.5">
                    Medida Retazo: {match.offcut.widthCm} cm × {match.offcut.heightCm} cm ({match.offcut.thicknessMm}mm)
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    Entran hasta <strong>{match.maxPiecesInOffcut} pza(s)</strong> ({match.cols}×{match.rows},{' '}
                    {match.orientation === 'rotated' ? 'rotada 90°' : 'normal'}) · Origen:{' '}
                    {match.offcut.sourceOrderId || 'Bodega'}
                  </div>
                </div>

                {onUseOffcut && (
                  <button
                    type="button"
                    onClick={() => {
                      onUseOffcut(match.offcut.id, selectedOrder?.id || 'ORDEN-TALLER');
                      onNotify?.(
                        `Retazo ${match.offcut.widthCm}×${match.offcut.heightCm}cm asignado y descontado de la bodega de retazos.`
                      );
                    }}
                    className="w-full py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-md inline-flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>
                      Usar este Retazo {selectedOrder ? `en ${selectedOrder.id}` : 'en Taller'}
                    </span>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {mode === 'roll' ? (
        /* MODO 1: BOBINAS DE VINIL Y LONA */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Parámetros de Bobina (5 cols) */}
          <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-4">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Scissors className="w-4 h-4 text-blue-600" />
              <span>Parámetros de Sticker / Pieza en Rollo</span>
            </h3>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Ancho de Rollo Seleccionado
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[1.05, 1.27, 1.52].map((rw) => (
                  <button
                    key={rw}
                    type="button"
                    onClick={() => setSelectedRollWidthM(rw)}
                    className={`py-2 px-3 text-xs font-mono font-semibold rounded border transition-colors ${
                      selectedRollWidthM === rw
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                    }`}
                  >
                    {rw.toFixed(2)} m
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Ancho Pieza (cm)
                </label>
                <input
                  type="number"
                  min="1"
                  step="0.5"
                  value={stickerWidthCm}
                  onChange={(e) => setStickerWidthCm(Math.max(1, Number(e.target.value)))}
                  className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Alto Pieza (cm)
                </label>
                <input
                  type="number"
                  min="1"
                  step="0.5"
                  value={stickerHeightCm}
                  onChange={(e) => setStickerHeightCm(Math.max(1, Number(e.target.value)))}
                  className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Cantidad Total (Unid.)
                </label>
                <input
                  type="number"
                  min="1"
                  value={targetStickerQty}
                  onChange={(e) => setTargetStickerQty(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Calle / Sangrado (mm)
                </label>
                <input
                  type="number"
                  min="0"
                  max="20"
                  value={gapMm}
                  onChange={(e) => setGapMm(Math.max(0, Number(e.target.value)))}
                  className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Margen Pinzas/OPOS (cm)
                </label>
                <input
                  type="number"
                  min="0"
                  max="10"
                  step="0.5"
                  value={marginOposCm}
                  onChange={(e) => setMarginOposCm(Math.max(0, Number(e.target.value)))}
                  className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Rotación de Pieza
                </label>
                <select
                  value={forceRotateRoll}
                  onChange={(e) => setForceRotateRoll(e.target.value as RotationStrategy)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-white"
                >
                  <option value="auto">Automática (Menor Merma)</option>
                  <option value="normal">
                    Normal ({stickerWidthCm}×{stickerHeightCm}cm)
                  </option>
                  <option value="rotated">
                    Rotada 90° ({stickerHeightCm}×{stickerWidthCm}cm)
                  </option>
                </select>
              </div>
            </div>

            {/* Comparativa Automática de los 3 Anchos de Bobina */}
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
              <span className="text-xs font-semibold text-slate-900 dark:text-white">
                Comparativa de Eficiencia por Ancho de Bobina
              </span>
              <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs font-mono">
                {rollAnalysis.comparisonTable.map((row) => (
                  <div key={row.rollW_M} className="py-2 flex items-center justify-between">
                    <span>
                      Rollo {row.rollW_M.toFixed(2)}m ({row.cols} col)
                    </span>
                    <span>{row.linearMeters} ml</span>
                    <span
                      className={
                        row.wastePct <= 20
                          ? 'text-emerald-700 dark:text-emerald-400 font-semibold'
                          : 'text-amber-600 dark:text-amber-400'
                      }
                    >
                      Merma: {row.wastePct}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Resultados y Diagrama SVG de Bobina (7 cols) */}
          <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 border-b border-slate-200 dark:border-slate-800 pb-4 font-mono">
              <div>
                <span className="text-[11px] text-slate-500 font-sans block">Piezas por Fila</span>
                <span className="text-lg font-bold text-slate-900 dark:text-white">
                  {rollAnalysis.active.cols} unid.
                </span>
              </div>
              <div>
                <span className="text-[11px] text-slate-500 font-sans block">Filas de Avance</span>
                <span className="text-lg font-bold text-slate-900 dark:text-white">
                  {rollAnalysis.active.rowsNeeded} filas
                </span>
              </div>
              <div>
                <span className="text-[11px] text-slate-500 font-sans block">Metros Lineales</span>
                <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
                  {rollAnalysis.active.linearMeters} ml
                </span>
              </div>
              <div>
                <span className="text-[11px] text-slate-500 font-sans block">Aprovechamiento</span>
                <span className="text-lg font-bold text-emerald-700 dark:text-emerald-400">
                  {rollAnalysis.active.usedPct}%
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
                <span>
                  Vista Previa de Montaje en Rollo {selectedRollWidthM.toFixed(2)}m (Orientación:{' '}
                  {rollAnalysis.active.orient === 'rotated' ? 'Rotada 90°' : 'Normal'})
                </span>
                <span className="font-mono">
                  Sobrante lateral útil: {rollAnalysis.active.sideScrapCm} cm
                </span>
              </div>

              {/* Renderizado SVG de la Bobina */}
              <div className="bg-slate-950 rounded-lg p-4 border border-slate-800 overflow-x-auto">
                <svg viewBox="0 0 600 240" className="w-full h-56">
                  <rect
                    x="20"
                    y="20"
                    width="560"
                    height="200"
                    fill="#1e293b"
                    stroke="#475569"
                    strokeWidth="2"
                  />
                  <rect x="20" y="20" width="18" height="200" fill="#334155" />
                  <rect x="562" y="20" width="18" height="200" fill="#334155" />

                  {(() => {
                    const cols = Math.min(24, rollAnalysis.active.cols);
                    const previewRows = Math.min(6, Math.max(1, rollAnalysis.active.rowsNeeded));
                    if (cols === 0) return null;
                    const usableW = 524;
                    const scrapRatio =
                      rollAnalysis.active.sideScrapCm / (selectedRollWidthM * 100);
                    const netPiecesW = usableW * Math.max(0.2, 1 - scrapRatio);
                    const cellW = netPiecesW / cols;
                    const cellH = 180 / previewRows;

                    const rects = [];
                    for (let r = 0; r < previewRows; r++) {
                      for (let c = 0; c < cols; c++) {
                        rects.push(
                          <rect
                            key={`${r}-${c}`}
                            x={40 + c * cellW}
                            y={28 + r * cellH}
                            width={Math.max(4, cellW - 3)}
                            height={Math.max(4, cellH - 3)}
                            fill="#2563eb"
                            stroke="#93c5fd"
                            strokeWidth="1"
                            rx="1"
                          />
                        );
                      }
                    }
                    return rects;
                  })()}

                  <text
                    x="300"
                    y="14"
                    textAnchor="middle"
                    fill="#94a3b8"
                    fontSize="11"
                    fontFamily="monospace"
                  >
                    Ancho Total de Bobina: {(selectedRollWidthM * 100).toFixed(0)} cm (
                    {rollAnalysis.active.cols} piezas por fila)
                  </text>
                </svg>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* MODO 2: PLANCHAS RÍGIDAS 1.22m x 2.44m (ACRÍLICO, ALUCOBOND, SINTRA) */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Parámetros de Plancha (5 cols) */}
          <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-4">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-600" />
              <span>Despiece en Plancha Rígida (122 cm × 244 cm)</span>
            </h3>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Sustrato Rígido de Bodega
              </label>
              <select
                value={selectedRigidMaterialId}
                onChange={(e) => setSelectedRigidMaterialId(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-white"
              >
                {rigidMaterials.map((mat) => (
                  <option key={mat.id} value={mat.id}>
                    {mat.name} (Stock: {mat.currentStock} {mat.unit})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Ancho Pieza (cm)
                </label>
                <input
                  type="number"
                  min="5"
                  max="244"
                  value={pieceWidthCm}
                  onChange={(e) => setPieceWidthCm(Math.max(1, Number(e.target.value)))}
                  className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Alto Pieza (cm)
                </label>
                <input
                  type="number"
                  min="5"
                  max="244"
                  value={pieceHeightCm}
                  onChange={(e) => setPieceHeightCm(Math.max(1, Number(e.target.value)))}
                  className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Cantidad Requerida
                </label>
                <input
                  type="number"
                  min="1"
                  value={targetPieceQty}
                  onChange={(e) => setTargetPieceQty(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Fresa CNC / Láser (mm)
                </label>
                <input
                  type="number"
                  min="0"
                  max="10"
                  step="0.5"
                  value={kerfMm}
                  onChange={(e) => setKerfMm(Math.max(0, Number(e.target.value)))}
                  className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Estrategia de Orientación en Cama CNC
              </label>
              <select
                value={forceRotateSheet}
                onChange={(e) => setForceRotateSheet(e.target.value as RotationStrategy)}
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-white"
              >
                <option value="auto">Automática (Máximo aprovechamiento)</option>
                <option value="normal">
                  Horizontal ({sheetAnalysis.normal.piecesPerSheet} pzas/plancha)
                </option>
                <option value="rotated">
                  Rotada 90° ({sheetAnalysis.rotated.piecesPerSheet} pzas/plancha)
                </option>
              </select>
            </div>

            {/* Guardar Retazos Sobrantes Calculados con 1 Clic */}
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2.5 text-xs">
              <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Recycle className="w-4 h-4 text-emerald-600" />
                <span>Sobrantes Útiles de Plancha (Guardar en Bodega de Retazos)</span>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
                <div className="font-mono">
                  <span className="text-slate-500 block font-sans text-[11px]">
                    Retazo sobrante derecho:
                  </span>
                  <strong className="text-slate-900 dark:text-white">
                    {sheetAnalysis.active.offcutRightCm} cm × 122 cm
                  </strong>
                </div>
                {onAddOffcut && sheetAnalysis.active.offcutRightCm >= 15 && (
                  <button
                    type="button"
                    onClick={() =>
                      handleRegisterOffcut(
                        sheetAnalysis.active.offcutRightCm,
                        122,
                        'Sobrante derecho automático CNC'
                      )
                    }
                    className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-[11px] font-semibold inline-flex items-center gap-1 shrink-0"
                  >
                    <PackagePlus className="w-3.5 h-3.5" />
                    <span>Guardar Retazo</span>
                  </button>
                )}
              </div>

              <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
                <div className="font-mono">
                  <span className="text-slate-500 block font-sans text-[11px]">
                    Retazo sobrante inferior:
                  </span>
                  <strong className="text-slate-900 dark:text-white">
                    244 cm × {sheetAnalysis.active.offcutBottomCm} cm
                  </strong>
                </div>
                {onAddOffcut && sheetAnalysis.active.offcutBottomCm >= 15 && (
                  <button
                    type="button"
                    onClick={() =>
                      handleRegisterOffcut(
                        244,
                        sheetAnalysis.active.offcutBottomCm,
                        'Sobrante inferior automático CNC'
                      )
                    }
                    className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-[11px] font-semibold inline-flex items-center gap-1 shrink-0"
                  >
                    <PackagePlus className="w-3.5 h-3.5" />
                    <span>Guardar Retazo</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Diagrama SVG Plancha 244 x 122 cm (7 cols) */}
          <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 border-b border-slate-200 dark:border-slate-800 pb-4 font-mono">
              <div>
                <span className="text-[11px] text-slate-500 font-sans block">Piezas / Plancha</span>
                <span className="text-lg font-bold text-slate-900 dark:text-white">
                  {sheetAnalysis.active.piecesPerSheet} pzas
                </span>
              </div>
              <div>
                <span className="text-[11px] text-slate-500 font-sans block">Planchas Req.</span>
                <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
                  {sheetAnalysis.active.sheetsNeeded} pl.
                </span>
              </div>
              <div>
                <span className="text-[11px] text-slate-500 font-sans block">Aprovechamiento</span>
                <span className="text-lg font-bold text-emerald-700 dark:text-emerald-400">
                  {sheetAnalysis.active.utilizationPct}%
                </span>
              </div>
              <div>
                <span className="text-[11px] text-slate-500 font-sans block">Retazo / Merma</span>
                <span className="text-lg font-bold text-amber-600 dark:text-amber-400">
                  {sheetAnalysis.active.wastePct}%
                </span>
              </div>
            </div>

            <div className="bg-slate-950 rounded-lg p-4 border border-slate-800">
              <svg viewBox="0 0 540 290" className="w-full h-64">
                <rect
                  x="26"
                  y="26"
                  width="488"
                  height="244"
                  fill="#334155"
                  stroke="#94a3b8"
                  strokeWidth="2"
                />

                {(() => {
                  const { cols, rows, pieceW, pieceH } = sheetAnalysis.active;
                  const scale = 2;
                  const items = [];
                  for (let r = 0; r < rows; r++) {
                    for (let c = 0; c < cols; c++) {
                      items.push(
                        <g key={`${r}-${c}`}>
                          <rect
                            x={26 + c * pieceW * scale}
                            y={26 + r * pieceH * scale}
                            width={Math.max(2, pieceW * scale - 2)}
                            height={Math.max(2, pieceH * scale - 2)}
                            fill="#0284c7"
                            stroke="#bae6fd"
                            strokeWidth="1"
                          />
                        </g>
                      );
                    }
                  }
                  return items;
                })()}

                <text
                  x="270"
                  y="16"
                  textAnchor="middle"
                  fill="#cbd5e1"
                  fontSize="11"
                  fontFamily="monospace"
                >
                  Plancha Estándar 244 cm × 122 cm — Distribución: {sheetAnalysis.active.cols} ×{' '}
                  {sheetAnalysis.active.rows} ({sheetAnalysis.active.pieceW}×
                  {sheetAnalysis.active.pieceH}cm)
                </text>
              </svg>
            </div>
          </div>
        </div>
      )}

      {/* BANCO DE RETAZOS REUTILIZABLES DE PLANCHAS RÍGIDAS EN INVENTARIO */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Recycle className="w-4 h-4 text-emerald-600" />
              <span>
                Bodega de Retazos Rígidos Reutilizables (Acrílico, Alucobond, PVC Sintra)
              </span>
            </h3>
            <p className="text-xs text-slate-500">
              Registra sobrantes útiles en centímetros para reutilizarlos en futuros cortes antes de abrir una plancha nueva.
            </p>
          </div>

          <div className="text-xs font-mono text-slate-600 dark:text-slate-300">
            Disponibles:{' '}
            <strong className="text-emerald-600 dark:text-emerald-400">
              {reusableOffcuts.filter((o) => o.status === 'Disponible').length}
            </strong>{' '}
            · Reutilizados:{' '}
            <strong>{reusableOffcuts.filter((o) => o.status === 'Utilizado').length}</strong>
          </div>
        </div>

        {/* Formulario rápido para ingresar un retazo manual */}
        {onAddOffcut && (
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end bg-slate-50 dark:bg-slate-950 p-3.5 rounded-lg border border-slate-200 dark:border-slate-800">
            <div className="sm:col-span-4">
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Material Rígido
              </label>
              <select
                value={selectedRigidMaterialId}
                onChange={(e) => setSelectedRigidMaterialId(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-white"
              >
                {rigidMaterials.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Ancho (cm)
              </label>
              <input
                type="number"
                min="15"
                max="244"
                value={customOffcutWidthCm}
                onChange={(e) => setCustomOffcutWidthCm(Math.max(15, Number(e.target.value)))}
                className="w-full px-2.5 py-1.5 text-xs font-mono bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-white"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Alto (cm)
              </label>
              <input
                type="number"
                min="15"
                max="244"
                value={customOffcutHeightCm}
                onChange={(e) => setCustomOffcutHeightCm(Math.max(15, Number(e.target.value)))}
                className="w-full px-2.5 py-1.5 text-xs font-mono bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-white"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Espesor (mm)
              </label>
              <input
                type="number"
                min="1"
                max="25"
                value={customOffcutThicknessMm}
                onChange={(e) => setCustomOffcutThicknessMm(Math.max(1, Number(e.target.value)))}
                className="w-full px-2.5 py-1.5 text-xs font-mono bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-white"
              />
            </div>
            <div className="sm:col-span-2">
              <button
                type="button"
                onClick={() =>
                  handleRegisterOffcut(
                    customOffcutWidthCm,
                    customOffcutHeightCm,
                    'Registro manual en Optimizador'
                  )
                }
                className="w-full py-1.5 px-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-md inline-flex items-center justify-center gap-1.5"
              >
                <PackagePlus className="w-3.5 h-3.5" />
                <span>Guardar Retazo</span>
              </button>
            </div>
          </div>
        )}

        {/* Tabla de Retazos */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-slate-500">
              <tr>
                <th className="py-2.5 px-3">Material Rígido</th>
                <th className="py-2.5 px-3 font-mono">Medidas (cm)</th>
                <th className="py-2.5 px-3 font-mono">Área Útil</th>
                <th className="py-2.5 px-3">Orden Origen</th>
                <th className="py-2.5 px-3">Estado</th>
                <th className="py-2.5 px-3 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {reusableOffcuts.map((off) => {
                const areaM2 = Number(((off.widthCm * off.heightCm) / 10000).toFixed(2));
                return (
                  <tr key={off.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    <td className="py-2.5 px-3 font-medium text-slate-900 dark:text-white">
                      {off.materialName}
                      {off.notes && (
                        <div className="text-[11px] text-slate-500 font-normal">{off.notes}</div>
                      )}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-semibold text-blue-600 dark:text-blue-400">
                      {off.widthCm} cm × {off.heightCm} cm ({off.thicknessMm}mm)
                    </td>
                    <td className="py-2.5 px-3 font-mono">{areaM2} m²</td>
                    <td className="py-2.5 px-3 font-mono text-slate-600 dark:text-slate-400">
                      {off.sourceOrderId || 'Bodega'} · {off.createdBy}
                    </td>
                    <td className="py-2.5 px-3">
                      {off.status === 'Disponible' ? (
                        <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                          Disponible
                        </span>
                      ) : (
                        <span className="text-slate-400">
                          Utilizado ({off.usedInOrderId || 'Taller'})
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      {off.status === 'Disponible' && onUseOffcut && (
                        <button
                          type="button"
                          onClick={() => {
                            onUseOffcut(off.id, selectedOrder?.id || 'TALLER');
                            onNotify?.(
                              `Retazo ${off.widthCm}×${off.heightCm}cm marcado como utilizado.`
                            );
                          }}
                          className="px-2.5 py-1 bg-slate-900 dark:bg-slate-800 hover:bg-emerald-600 text-white rounded text-[11px] font-semibold transition-colors"
                        >
                          Usar en {selectedOrder ? selectedOrder.id : 'Trabajo'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
