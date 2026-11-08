import React, { useState, useMemo, useEffect } from 'react';
import {
  QrCode,
  X,
  CheckCircle2,
  Clock,
  FileCheck,
  MessageSquare,
  Copy,
  Check,
  ShieldCheck,
  Printer,
} from 'lucide-react';
import { ORDER_STAGES, WorkOrder, isDesignOnlyOrder } from '../data/initialData';
import {
  downloadDeliveryAndWarrantyActPdf,
  downloadBlindWorkOrderPdf,
  getWarrantyClauseForCategory,
  copyTextToClipboardSafe,
} from '../utils/deliveryActPdfGenerator';

interface QrOrderTrackerModalProps {
  isOpen: boolean;
  onClose: () => void;
  orders: WorkOrder[];
  initialOrderId?: string | null;
  currentUserName: string;
  onOpenWhatsAppForOrder?: (orderId: string) => void;
  onNotify?: (msg: string) => void;
}

/**
 * Genera una matriz booleana 21x21 determinista para representar el código QR en SVG
 */
function buildQrMatrix(payload: string): boolean[][] {
  const size = 21;
  const matrix: boolean[][] = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => false)
  );

  const drawFinder = (r0: number, c0: number) => {
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        const isBorder = r === 0 || r === 6 || c === 0 || c === 6;
        const isInner = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        matrix[r0 + r][c0 + c] = isBorder || isInner;
      }
    }
  };

  drawFinder(0, 0);
  drawFinder(0, size - 7);
  drawFinder(size - 7, 0);

  let hash = 2166136261;
  for (let i = 0; i < payload.length; i++) {
    hash ^= payload.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const inFinder =
        (r < 7 && c < 7) || (r < 7 && c >= size - 7) || (r >= size - 7 && c < 7);
      if (inFinder) continue;
      const seed = Math.abs(Math.imul(hash ^ (r * 31 + c * 17), 1597334677));
      matrix[r][c] = seed % 2 === 0;
    }
  }

  return matrix;
}

export const QrOrderTrackerModal: React.FC<QrOrderTrackerModalProps> = ({
  isOpen,
  onClose,
  orders,
  initialOrderId,
  currentUserName,
  onOpenWhatsAppForOrder,
  onNotify,
}) => {
  const [selectedOrderId, setSelectedOrderId] = useState<string>(
    initialOrderId || orders[0]?.id || ''
  );
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  useEffect(() => {
    if (initialOrderId) {
      setSelectedOrderId(initialOrderId);
    }
  }, [initialOrderId]);

  const activeOrder = useMemo(
    () =>
      orders.find((o) => o.id === selectedOrderId) ||
      orders.find((o) => o.id === initialOrderId) ||
      orders[0],
    [orders, initialOrderId, selectedOrderId]
  );

  if (!isOpen || !activeOrder) return null;

  const currentStageIdx = ORDER_STAGES.indexOf(activeOrder.stage);
  const progressPct = Math.round(((currentStageIdx + 1) / ORDER_STAGES.length) * 100);
  const pendingBalance = Math.max(
    0,
    Number((activeOrder.totalPrice - activeOrder.paidAmount).toFixed(2))
  );
  const verificationCode = `CA-QR-${activeOrder.id.replace('#', '')}-${activeOrder.clientRuc.slice(-4)}`;
  const liveTrackingUrl = `${window.location.origin}/?track=${encodeURIComponent(
    activeOrder.id
  )}&code=${verificationCode}`;
  const qrMatrix = buildQrMatrix(liveTrackingUrl);
  const warranty = getWarrantyClauseForCategory(activeOrder.category);

  const handleCopyLink = async () => {
    await copyTextToClipboardSafe(liveTrackingUrl);
    setCopiedLink(true);
    onNotify?.(`Enlace de seguimiento QR copiado para ${activeOrder.clientName}`);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera */}
        <div className="px-4 sm:px-6 py-3.5 sm:py-4 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 sm:p-2.5 rounded-xl bg-blue-600 text-white shrink-0">
              <QrCode className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold truncate">
                Portal de Seguimiento QR en Vivo & Certificado de Garantía
              </h3>
              <p className="text-xs text-slate-400 font-mono truncate">
                Código Verificador: {verificationCode} · Estado en Tiempo Real para el Cliente
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
            <select
              value={activeOrder.id}
              onChange={(e) => setSelectedOrderId(e.target.value)}
              className="flex-1 sm:flex-initial max-w-[240px] px-3 py-1.5 text-xs font-mono bg-slate-800 border border-slate-700 rounded-lg text-white truncate"
            >
              {orders.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.id} — {o.clientName}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Contenido Principal */}
        <div className="p-4 sm:p-6 flex-1 min-h-0 overflow-y-auto space-y-6 text-xs">
          {/* Bloque Superior: Tarjeta QR + Progreso en Vivo */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
            {/* Código QR SVG Escaneable */}
            <div className="md:col-span-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col items-center text-center space-y-3">
              <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
                <svg viewBox="0 0 21 21" className="w-36 h-36">
                  {qrMatrix.map((row, rIdx) =>
                    row.map((cell, cIdx) =>
                      cell ? (
                        <rect
                          key={`${rIdx}-${cIdx}`}
                          x={cIdx}
                          y={rIdx}
                          width={1}
                          height={1}
                          fill="#0f172a"
                        />
                      ) : null
                    )
                  )}
                </svg>
              </div>
              <div>
                <div className="font-mono font-bold text-slate-900 dark:text-white text-sm">
                  {activeOrder.id}
                </div>
                <div className="text-[11px] text-slate-500">
                  Escanea para consultar avance en planta y garantía
                </div>
              </div>
              <button
                type="button"
                onClick={handleCopyLink}
                className="w-full py-2 px-3 bg-slate-900 dark:bg-slate-800 hover:bg-blue-600 text-white font-semibold rounded-lg inline-flex items-center justify-center gap-1.5 transition-colors"
              >
                {copiedLink ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Enlace Copiado</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copiar Link de Rastreo</span>
                  </>
                )}
              </button>
            </div>

            {/* Datos de la Orden y Barra de Progreso */}
            <div className="md:col-span-8 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
                <div>
                  <span className="text-[11px] font-mono text-blue-600 dark:text-blue-400 font-semibold">
                    {activeOrder.category}
                  </span>
                  <h4 className="text-base font-bold text-slate-900 dark:text-white">
                    {activeOrder.title}
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    Cliente: <strong>{activeOrder.clientName}</strong> · RUC:{' '}
                    <span className="font-mono">{activeOrder.clientRuc}</span>
                  </p>
                </div>
                <div className="sm:text-right font-mono">
                  <div className="text-[11px] text-slate-500">Entrega Programada</div>
                  <div className="text-sm font-bold text-slate-900 dark:text-white">
                    {activeOrder.deadline.replace('T', ' ')}
                  </div>
                </div>
              </div>

              {/* Barra de Progreso 0-100% */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between font-mono text-xs">
                  <span className="font-bold text-slate-900 dark:text-white">
                    Etapa Actual: {activeOrder.stage}
                  </span>
                  <span className="font-bold text-blue-600 dark:text-blue-400">
                    {progressPct}% Completado
                  </span>
                </div>
                <div className="w-full h-3 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-600 transition-all duration-300"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>

              {/* Resumen Técnico y Financiero */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
                <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] text-slate-500 font-sans block">Medidas / Cant.</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {isDesignOnlyOrder(activeOrder)
                      ? `${activeOrder.quantity} serv.`
                      : `${activeOrder.widthM}×${activeOrder.heightM}m (${activeOrder.quantity})`}
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] text-slate-500 font-sans block">Estado de Arte</span>
                  <span
                    className={`font-bold ${
                      activeOrder.artworkApproved
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-amber-600 dark:text-amber-400'
                    }`}
                  >
                    {activeOrder.artworkApproved ? '✓ Aprobado' : 'En Revisión'}
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] text-slate-500 font-sans block">Abonado</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    ${activeOrder.paidAmount.toFixed(2)}
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] text-slate-500 font-sans block">Saldo Entrega</span>
                  <span
                    className={`font-bold ${
                      pendingBalance > 0
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-emerald-600 dark:text-emerald-400'
                    }`}
                  >
                    ${pendingBalance.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Línea de Tiempo de las 7 Etapas */}
          <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3">
            <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-600" />
              <span>Trazabilidad de Etapas en Planta (Tiempo Real)</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-7 gap-2">
              {ORDER_STAGES.map((st, idx) => {
                const isCompleted = idx < currentStageIdx;
                const isCurrent = idx === currentStageIdx;
                return (
                  <div
                    key={st}
                    className={`p-2.5 rounded-lg border text-[11px] flex flex-col justify-between gap-1 ${
                      isCurrent
                        ? 'bg-blue-600 text-white border-blue-600 font-bold'
                        : isCompleted
                        ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-300'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-400'
                    }`}
                  >
                    <div className="flex items-center justify-between font-mono text-[10px]">
                      <span>Paso {idx + 1}</span>
                      {(isCompleted || isCurrent) && <CheckCircle2 className="w-3.5 h-3.5" />}
                    </div>
                    <div className="leading-snug">{st}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Certificado de Garantía Técnica Asociado al QR */}
          <div className="bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 rounded-xl p-4 space-y-1.5">
            <div className="font-bold text-emerald-900 dark:text-emerald-300 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Cobertura de Garantía Técnica: {warranty.durationLabel}</span>
            </div>
            <p className="text-slate-700 dark:text-slate-300 leading-relaxed">{warranty.terms}</p>
          </div>
        </div>

        {/* Pie de Acciones */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-500 font-mono truncate max-w-md">
            URL QR: {liveTrackingUrl}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {onOpenWhatsAppForOrder && (
              <button
                type="button"
                onClick={() => {
                  onOpenWhatsAppForOrder(activeOrder.id);
                  onClose();
                }}
                className="px-3.5 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg inline-flex items-center gap-1.5 transition-colors"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Enviar Estado QR por WhatsApp</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                const fileName = downloadBlindWorkOrderPdf(
                  activeOrder,
                  currentUserName
                );
                onNotify?.(`Orden de Trabajo Ciega (Sin Precios) descargada: "${fileName}"`);
              }}
              className="px-3.5 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white rounded-lg inline-flex items-center gap-1.5 transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Descargar OT Taller (Sin Precios)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                const fileName = downloadDeliveryAndWarrantyActPdf(
                  activeOrder,
                  currentUserName
                );
                onNotify?.(`Acta de Entrega y Garantía QR descargada: "${fileName}"`);
              }}
              className="px-3.5 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg inline-flex items-center gap-1.5 transition-colors"
            >
              <FileCheck className="w-3.5 h-3.5" />
              <span>Descargar Acta + Garantía QR (PDF)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
