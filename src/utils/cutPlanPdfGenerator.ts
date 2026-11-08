import { jsPDF } from 'jspdf';
import { getNowTimestamp, WorkOrder } from '../data/initialData';
import { RollNestingEvaluation, SheetNestingEvaluation } from '../domain/nestingEngine';

export interface CutPlanPdfInput {
  mode: 'roll' | 'sheet';
  order?: WorkOrder;
  materialLabel: string;
  pieceWidthCm: number;
  pieceHeightCm: number;
  quantity: number;
  operatorName: string;
  rollResult?: RollNestingEvaluation;
  marginOposCm?: number;
  gapMm?: number;
  sheetResult?: SheetNestingEvaluation;
  kerfMm?: number;
}

export function downloadCutPlan2DPdf(input: CutPlanPdfInput): string {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const nowStr = getNowTimestamp();

  // Encabezado Industrial
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageW, 24, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('CREA ARTE — PLANO TÉCNICO DE CORTE Y ANIDADO 2D (PLANTA / CNC / PLOTTER)', 12, 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(
    `Modo: ${
      input.mode === 'roll'
        ? 'BOBINA FLEXIBLE (PLOTTER IMPRESIÓN/CORTE)'
        : 'PLANCHA RÍGIDA 122x244 CM (ROUTER CNC / LÁSER CO2)'
    }   |   Emitido: ${nowStr}   |   Responsable: ${input.operatorName}`,
    12,
    18
  );

  // Bloque de datos de orden y parámetros
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.rect(12, 29, pageW - 24, 26, 'FD');

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  const orderHeader = input.order
    ? `ORDEN VINCULADA: ${input.order.id} — ${input.order.title} (${input.order.clientName})`
    : 'SIMULACIÓN TÉCNICA DE TALLER (SIN ORDEN VINCULADA)';
  doc.text(orderHeader, 16, 36);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Sustrato / Material: ${input.materialLabel}`, 16, 43);
  doc.text(
    `Medida Unitaria: ${input.pieceWidthCm} cm × ${input.pieceHeightCm} cm   |   Cantidad Total: ${input.quantity} pzas`,
    16,
    50
  );

  if (input.mode === 'roll' && input.rollResult) {
    const r = input.rollResult;
    doc.setFont('helvetica', 'bold');
    doc.text(
      `Ancho de Bobina: ${r.rollW_M.toFixed(2)} m (${(r.rollW_M * 100).toFixed(0)} cm)   |   Orientación: ${
        r.orient === 'rotated' ? 'ROTADA 90°' : 'NORMAL'
      }`,
      155,
      36
    );
    doc.text(
      `Distribución: ${r.cols} col × ${r.rowsNeeded} filas   |   Avance Requerido: ${r.linearMeters} metros lineales`,
      155,
      43
    );
    doc.text(
      `Aprovechamiento: ${r.usedPct}%   |   Merma: ${r.wastePct}%   |   Sobrante Lateral: ${r.sideScrapCm} cm`,
      155,
      50
    );

    // Dibujo a escala del rollo
    const boxX = 12;
    const boxY = 62;
    const boxW = pageW - 24;
    const boxH = 108;

    doc.setFillColor(15, 23, 42);
    doc.rect(boxX, boxY, boxW, boxH, 'F');

    // Márgenes OPOS
    doc.setFillColor(51, 65, 85);
    doc.rect(boxX, boxY, 10, boxH, 'F');
    doc.rect(boxX + boxW - 10, boxY, 10, boxH, 'F');

    const cols = Math.min(24, Math.max(1, r.cols));
    const rows = Math.min(8, Math.max(1, r.rowsNeeded));
    const usableW = boxW - 24;
    const scrapRatio = Math.min(0.7, r.sideScrapCm / (r.rollW_M * 100));
    const netW = usableW * (1 - scrapRatio);
    const cellW = netW / cols;
    const cellH = (boxH - 16) / rows;

    doc.setFillColor(37, 99, 235);
    doc.setDrawColor(147, 197, 253);

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        doc.rect(
          boxX + 12 + col * cellW,
          boxY + 8 + row * cellH,
          Math.max(2, cellW - 1.5),
          Math.max(2, cellH - 1.5),
          'FD'
        );
      }
    }

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.text(
      `ESQUEMA DE MONTAJE EN BOBINA ${(r.rollW_M * 100).toFixed(0)} CM — Pinzas/OPOS: ${
        input.marginOposCm ?? 3
      }cm por lado | Calle: ${input.gapMm ?? 3}mm`,
      boxX + 14,
      boxY + boxH - 3
    );
  } else if (input.sheetResult) {
    const s = input.sheetResult;
    doc.setFont('helvetica', 'bold');
    doc.text(
      `Plancha Estándar: 244 cm × 122 cm   |   Orientación: ${
        s.orient === 'rotated' ? 'ROTADA 90°' : 'HORIZONTAL NORMAL'
      }`,
      155,
      36
    );
    doc.text(
      `Piezas por Plancha: ${s.piecesPerSheet} (${s.cols} col × ${s.rows} filas)   |   Planchas Requeridas: ${s.sheetsNeeded} pl.`,
      155,
      43
    );
    doc.text(
      `Aprovechamiento: ${s.utilizationPct}%   |   Merma: ${s.wastePct}%   |   Retazo Der.: ${s.offcutRightCm}×122cm | Inf.: 244×${s.offcutBottomCm}cm`,
      155,
      50
    );

    // Dibujo proporcional de la plancha 244 x 122 cm
    const sheetDrawW = 216;
    const sheetDrawH = 108;
    const startX = (pageW - sheetDrawW) / 2;
    const startY = 62;

    doc.setFillColor(30, 41, 59);
    doc.setDrawColor(100, 116, 139);
    doc.rect(startX, startY, sheetDrawW, sheetDrawH, 'FD');

    const scaleX = sheetDrawW / 244;
    const scaleY = sheetDrawH / 122;

    doc.setFillColor(2, 132, 199);
    doc.setDrawColor(186, 230, 253);

    for (let r = 0; r < s.rows; r++) {
      for (let c = 0; c < s.cols; c++) {
        const px = startX + c * s.pieceW * scaleX;
        const py = startY + r * s.pieceH * scaleY;
        const pw = Math.max(1.5, s.pieceW * scaleX - 0.8);
        const ph = Math.max(1.5, s.pieceH * scaleY - 0.8);
        doc.rect(px, py, pw, ph, 'FD');
      }
    }

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.text(
      `CAMA CNC / LÁSER 244 CM × 122 CM — Fresa/Kerf: ${input.kerfMm ?? 3}mm | Pieza colocada: ${s.pieceW}cm × ${s.pieceH}cm`,
      startX + 4,
      startY + sheetDrawH - 3
    );
  }

  // Pie de firmas operativas
  doc.setTextColor(71, 85, 105);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(
    'NOTA DE TALLER: Verificar escuadra de sustrato, origen X/Y en máquina y almacenar todo retazo mayor a 30x30 cm en Bodega de Retazos.',
    12,
    pageH - 22
  );

  doc.line(12, pageH - 10, 95, pageH - 10);
  doc.text('Firma Pre-Prensa / Diseño', 12, pageH - 6);

  doc.line(115, pageH - 10, 200, pageH - 10);
  doc.text('Firma Operador Plotter / Router CNC', 115, pageH - 6);

  const codeClean = (input.order?.id || 'SIMULACION').replace('#', '');
  const fileName = `Plano_Corte_2D_${codeClean}.pdf`;
  doc.save(fileName);
  return fileName;
}
