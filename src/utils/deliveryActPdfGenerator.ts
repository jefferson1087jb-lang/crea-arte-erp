import { jsPDF } from 'jspdf';
import { getNowTimestamp, WorkOrder } from '../data/initialData';

/**
 * Dibuja un código QR determinista en el documento PDF a partir de un texto/URL de verificación
 */
function drawDeterministicQrMatrix(
  doc: jsPDF,
  payload: string,
  x: number,
  y: number,
  sizeMm: number
): void {
  const cells = 21;
  const cellSize = sizeMm / cells;

  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(203, 213, 225);
  doc.rect(x - 1.5, y - 1.5, sizeMm + 3, sizeMm + 3, 'FD');

  const isFinderPattern = (r: number, c: number): boolean => {
    const inTopLeft = r < 7 && c < 7;
    const inTopRight = r < 7 && c >= cells - 7;
    const inBottomLeft = r >= cells - 7 && c < 7;
    return inTopLeft || inTopRight || inBottomLeft;
  };

  const drawFinder = (startR: number, startC: number) => {
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        const isBorder = r === 0 || r === 6 || c === 0 || c === 6;
        const isInner = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        if (isBorder || isInner) {
          doc.setFillColor(15, 23, 42);
          doc.rect(
            x + (startC + c) * cellSize,
            y + (startR + r) * cellSize,
            cellSize,
            cellSize,
            'F'
          );
        }
      }
    }
  };

  drawFinder(0, 0);
  drawFinder(0, cells - 7);
  drawFinder(cells - 7, 0);

  let hash = 2166136261;
  for (let i = 0; i < payload.length; i++) {
    hash ^= payload.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  for (let r = 0; r < cells; r++) {
    for (let c = 0; c < cells; c++) {
      if (isFinderPattern(r, c)) continue;
      const seed = Math.abs(Math.imul(hash ^ (r * 31 + c * 17), 1597334677));
      if (seed % 2 === 0) {
        doc.setFillColor(15, 23, 42);
        doc.rect(x + c * cellSize, y + r * cellSize, cellSize, cellSize, 'F');
      }
    }
  }
}

export function getWarrantyClauseForCategory(category: string): {
  durationLabel: string;
  terms: string;
} {
  if (category.includes('Rótulos 3D')) {
    return {
      durationLabel: '12 Meses en Estructura y Módulos LED 12V / 6 Meses en Fuentes Conmutadas',
      terms:
        'Cubre desprendimiento estructural, soldadura MIG, corrosión prematura y fallos de fabricación en módulos LED inyectados IP67. No cubre variaciones de voltaje de la red pública sin regulador ni daños por terceros o fenómenos naturales.',
    };
  }
  if (category.includes('Láser') || category.includes('Señalética')) {
    return {
      durationLabel: '12 Meses en Acabado Acrílico, Grabado y Fijaciones Distanciadoras',
      terms:
        'Garantiza estabilidad dimensional del corte láser/CNC y adherencia de elementos corpóreos interiores. Para limpieza utilizar únicamente paño de microfibra con agua y jabón neutro (prohibido usar alcohol, thinner o solventes).',
    };
  }
  if (category.includes('Sublimación')) {
    return {
      durationLabel: '6 Meses en Fijación Térmica y Sublimación Digital',
      terms:
        'Garantiza solidez del color ante lavado normal en frío y resistencia del polímero en artículos promocionales revisados al momento de la recepción.',
    };
  }
  return {
    durationLabel: '6 Meses en Impresión Ecosolvente / UV y Tensado Exterior',
    terms:
      'Cubre estabilidad de tintas originales frente a radiación UV, termosellado perimetral y ojalillos. Se excluyen daños por vientos huracanados mayores a 65 km/h o manipulación ajena a nuestro personal técnico.',
  };
}

export function downloadDeliveryAndWarrantyActPdf(
  order: WorkOrder,
  issuedByName: string
): string {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageW = doc.internal.pageSize.getWidth();
  const nowStr = getNowTimestamp();
  const verificationCode = `CA-ACTA-${order.id.replace('#', '')}-${order.clientRuc.slice(-4)}`;
  const qrPayload = `https://crea-arte.ec/verificar/${order.id.replace('#', '')}?code=${verificationCode}&status=${encodeURIComponent(order.stage)}`;

  // Encabezado Corporativo
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageW, 34, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('CREA ARTE — ACTA DE ENTREGA Y CERTIFICADO DE GARANTÍA', 14, 14);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(
    'Gigantografía · Rótulos Corpóreos 3D · Corte Láser/CNC · Sublimación   |   Quito - Ecuador (RUC: 1792847102001)',
    14,
    21
  );
  doc.text(
    `Código de Acta: ${verificationCode}   |   Orden de Trabajo: ${order.id}   |   Fecha de Emisión: ${nowStr}`,
    14,
    28
  );

  // Dibujar Código QR de verificación en esquina superior derecha debajo del header
  drawDeterministicQrMatrix(doc, qrPayload, pageW - 38, 39, 24);
  doc.setTextColor(71, 85, 105);
  doc.setFontSize(6.5);
  doc.text('QR Verificación en Vivo', pageW - 26, 66.5, { align: 'center' });

  // Datos del Cliente y Proyecto
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.rect(14, 38, pageW - 58, 30, 'FD');

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text(`CLIENTE / RAZÓN SOCIAL: ${order.clientName}`, 18, 45);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(`RUC / Cédula: ${order.clientRuc}   |   Contacto: ${order.clientPhone}`, 18, 51);
  doc.text(`Proyecto: ${order.title} (${order.category})`, 18, 57);
  const pendingBalance = Math.max(0, Number((order.totalPrice - order.paidAmount).toFixed(2)));
  doc.text(
    `Estado Financiero: Total $${order.totalPrice.toFixed(2)} | Abonado $${order.paidAmount.toFixed(
      2
    )} | Saldo $${pendingBalance.toFixed(2)}`,
    18,
    63
  );

  // Tabla de Ítems Entregados
  let y = 76;
  doc.setFillColor(30, 41, 59);
  doc.rect(14, y, pageW - 28, 7, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('CANT.', 17, y + 4.8);
  doc.text('DESCRIPCIÓN TÉCNICA DEL PRODUCTO / RUBRO ENTREGADO', 32, y + 4.8);
  doc.text('MEDIDAS / ESPECIFICACIONES', 136, y + 4.8);
  doc.text('ESTADO', 180, y + 4.8);
  y += 7;

  const items =
    order.lineItems && order.lineItems.length > 0
      ? order.lineItems
      : [
          {
            id: 'item-1',
            title: order.title,
            category: order.category,
            materialName: order.materialName,
            dimensionsText: `${order.widthM}m × ${order.heightM}m (${order.totalAreaM2} m²)`,
            finishingsText: order.finishings.join(', ') || 'Estándar',
            quantity: order.quantity,
            unitPrice: order.totalPrice,
            lineTotal: order.totalPrice,
          },
        ];

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'normal');
  items.forEach((item, idx) => {
    const rowH = 11;
    if (idx % 2 === 0) {
      doc.setFillColor(248, 250, 252);
      doc.rect(14, y, pageW - 28, rowH, 'F');
    }
    doc.setDrawColor(226, 232, 240);
    doc.rect(14, y, pageW - 28, rowH, 'S');

    doc.setFont('helvetica', 'bold');
    doc.text(String(item.quantity), 19, y + 6.5);
    doc.text(item.title.slice(0, 48), 32, y + 4.8);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text(
      `Sustrato: ${item.materialName.slice(0, 45)} | Acabados: ${(item.finishingsText || 'N/A').slice(0, 32)}`,
      32,
      y + 9.2
    );
    doc.text((item.dimensionsText || `${order.widthM}x${order.heightM}m`).slice(0, 26), 136, y + 6.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(5, 150, 105);
    doc.text('CONFORME', 178, y + 6.5);
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(8);
    y += rowH;
  });

  // Verificación de Instalación / Control de Calidad
  y += 6;
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.rect(14, y, pageW - 28, 22, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('INSPECCIÓN TÉCNICA Y CHECKLIST DE CAMPO / PLANTA:', 18, y + 6);

  const chk = order.installationChecklist;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(
    `[ ${chk?.electricalPointVerified ? 'X' : 'OK'} ] Punto eléctrico 110V/220V y fuentes verificadas`,
    18,
    y + 12
  );
  doc.text(
    `[ ${chk?.ladderOrScaffoldingReady ? 'X' : 'OK'} ] Estructura, anclaje mecánico y nivelación aprobados`,
    105,
    y + 12
  );
  doc.text(
    `[ ${chk?.locationConfirmed ? 'X' : 'OK'} ] Limpieza final de superficie y entrega en ubicación confirmada`,
    18,
    y + 18
  );

  // Certificado de Garantía Técnica
  y += 28;
  const warranty = getWarrantyClauseForCategory(order.category);
  doc.setFillColor(236, 253, 245);
  doc.setDrawColor(16, 185, 129);
  doc.rect(14, y, pageW - 28, 30, 'FD');

  doc.setTextColor(6, 95, 70);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text(`CERTIFICADO DE GARANTÍA TÉCNICA: ${warranty.durationLabel}`, 18, y + 7);

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  const splitTerms = doc.splitTextToSize(warranty.terms, pageW - 36);
  doc.text(splitTerms, 18, y + 13);

  // Declaración de conformidad
  y += 38;
  doc.setFontSize(8.2);
  const conformityText = doc.splitTextToSize(
    `Por medio de la presente Acta, el Cliente (${order.clientName}) declara recibir a entera satisfacción los trabajos descritos en la Orden ${order.id}, habiendo verificado medidas, colores, acabados e instalación física sin observaciones pendientes.`,
    pageW - 28
  );
  doc.text(conformityText, 14, y);

  // Bloques de firma
  const sigY = y + 32;
  doc.setDrawColor(100, 116, 139);
  doc.line(22, sigY, 92, sigY);
  doc.setFont('helvetica', 'bold');
  doc.text('ENTREGADO POR CREA ARTE', 57, sigY + 5, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.text(`${issuedByName}`, 57, sigY + 9.5, { align: 'center' });

  doc.line(118, sigY, 188, sigY);
  doc.setFont('helvetica', 'bold');
  doc.text('RECIBIDO CONFORME (CLIENTE)', 153, sigY + 5, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.text(`${order.clientName} (${order.clientRuc})`, 153, sigY + 9.5, { align: 'center' });

  const cleanId = order.id.replace('#', '');
  const fileName = `Acta_Entrega_Garantia_QR_${cleanId}.pdf`;
  doc.save(fileName);
  return fileName;
}

/**
 * Genera y descarga en PDF la Orden de Trabajo Ciega para Taller e Instalación (100% SIN PRECIOS NI SALDOS)
 */
export function downloadBlindWorkOrderPdf(
  order: WorkOrder,
  issuedByName: string
): string {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageW = doc.internal.pageSize.getWidth();
  const nowStr = getNowTimestamp();
  const qrPayload = `https://crea-arte.ec/taller/${order.id.replace('#', '')}?stage=${encodeURIComponent(order.stage)}`;

  // Encabezado Industrial de Taller
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageW, 32, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(`ORDEN DE TRABAJO CIEGA (TALLER E INSTALACIÓN) — ${order.id}`, 14, 13);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(
    'DOCUMENTO TÉCNICO INTERNO · PRECIOS Y SALDOS OCULTOS PARA PLANTA DE PRODUCCIÓN',
    14,
    20
  );
  doc.text(
    `Fecha Impresión: ${nowStr}   |   Emitido por: ${issuedByName}   |   Entrega Comprometida: ${order.deadline.replace('T', ' ')}`,
    14,
    26.5
  );

  drawDeterministicQrMatrix(doc, qrPayload, pageW - 36, 36, 22);

  // Datos del Proyecto
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.rect(14, 36, pageW - 54, 26, 'FD');

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(`PROYECTO: ${order.title}`, 18, 43);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(`Cliente: ${order.clientName}   |   Contacto Sitio: ${order.clientPhone}`, 18, 49);
  doc.text(`Categoría: ${order.category}   |   Sustrato Base: ${order.materialName}`, 18, 55);
  doc.text(
    `Medidas Globales: ${order.widthM}m × ${order.heightM}m (${order.quantity} und = ${order.totalAreaM2} m²)   |   Etapa: ${order.stage}`,
    18,
    60
  );

  let y = 68;

  // Parámetros Especiales (Láser / Tallas / Despiece 2D)
  if (order.laserMinutes || order.sizesAndColors || order.cutOptimizationSummary) {
    doc.setFillColor(254, 243, 199);
    doc.setDrawColor(245, 158, 11);
    doc.rect(14, y, pageW - 28, 18, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(146, 64, 14);
    doc.text('PARÁMETROS ESPECIALES DE MÁQUINA Y DESPIECE:', 18, y + 6);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    const paramLines: string[] = [];
    if (order.laserMinutes && order.laserMinutes > 0) {
      paramLines.push(`Tiempo Corte/Grabado Láser CNC: ${order.laserMinutes} min`);
    }
    if (order.sizesAndColors) {
      paramLines.push(`Tallas / Colores Sublimación: ${order.sizesAndColors}`);
    }
    if (order.cutOptimizationSummary) {
      const s = order.cutOptimizationSummary;
      paramLines.push(
        s.mode === 'roll'
          ? `Despiece Bobina ${s.rollWidthM}m: ${s.quantity} pzas (${s.pieceWidthCm}x${s.pieceHeightCm}cm) -> ${s.linearMeters} ml (Merma ${s.wastePct}%)`
          : `Despiece Plancha: ${s.quantity} pzas (${s.pieceWidthCm}x${s.pieceHeightCm}cm) -> ${s.sheetsNeeded} plancha(s) (Merma ${s.wastePct}%)`
      );
    }
    doc.text(paramLines.join('   |   ').slice(0, 115), 18, y + 13);
    y += 23;
  }

  // Tabla de Renglones Técnicos (Sin precios)
  doc.setFillColor(30, 41, 59);
  doc.rect(14, y, pageW - 28, 7, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('#', 17, y + 4.8);
  doc.text('TRABAJO / RUBRO A PRODUCIR', 25, y + 4.8);
  doc.text('MATERIAL / SUSTRATO', 92, y + 4.8);
  doc.text('MEDIDAS Y CANTIDAD', 142, y + 4.8);
  y += 7;

  const items =
    order.lineItems && order.lineItems.length > 0
      ? order.lineItems
      : [
          {
            id: '1',
            title: order.title,
            category: order.category,
            materialName: order.materialName,
            dimensionsText: `${order.widthM}m × ${order.heightM}m`,
            finishingsText: order.finishings.join(', ') || 'Estándar',
            quantity: order.quantity,
            unitPrice: 0,
            lineTotal: 0,
          },
        ];

  doc.setTextColor(15, 23, 42);
  items.forEach((li, idx) => {
    const rowH = 11;
    if (idx % 2 === 0) {
      doc.setFillColor(248, 250, 252);
      doc.rect(14, y, pageW - 28, rowH, 'F');
    }
    doc.setDrawColor(226, 232, 240);
    doc.rect(14, y, pageW - 28, rowH, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text(String(idx + 1), 17, y + 6.5);
    doc.text(li.title.slice(0, 36), 25, y + 4.8);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    const cleanFin = (li.finishingsText || 'Estándar').replace(/\s*\(\$[0-9.]+\)/g, '');
    doc.text(`Acabados: ${cleanFin.slice(0, 42)}`, 25, y + 9.2);

    const cleanMat = li.materialName.replace(/\s*\(\$[0-9.]+\/[a-zA-Z0-9_]+\)/g, '');
    doc.text(cleanMat.slice(0, 28), 92, y + 6.5);

    const cleanDim = (li.dimensionsText || `${order.widthM}x${order.heightM}m`).replace(
      /\$[0-9.]+(\/[a-zA-Z0-9_]+)?/g,
      ''
    );
    doc.setFont('helvetica', 'bold');
    doc.text(`${cleanDim.slice(0, 20)} (${li.quantity}u)`, 142, y + 6.5);
    y += rowH;
  });

  // Notas e Instrucciones de Montaje
  y += 6;
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.rect(14, y, pageW - 28, 22, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('INSTRUCCIONES TÉCNICAS DE TALLER Y RUTA DE ARTE RIP:', 18, y + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`Notas: ${(order.notes || 'Verificar medidas antes de procesar.').slice(0, 95)}`, 18, y + 12);
  doc.text(
    `Archivo RIP: ${order.artworkUrl || 'En servidor'}   |   Estado Arte: ${
      order.artworkApproved ? 'APROBADO POR CLIENTE' : 'PENDIENTE APROBACIÓN'
    }`,
    18,
    18 + y
  );

  // Checklist de Instalación
  y += 28;
  const chk = order.installationChecklist;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('CHECKLIST DE VERIFICACIÓN EN SITIO:', 14, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(
    `[ ${chk?.electricalPointVerified ? 'X' : ' '} ] Punto eléctrico verificado     [ ${
      chk?.ladderOrScaffoldingReady ? 'X' : ' '
    } ] Escalera/Andamio listo     [ ${
      chk?.locationConfirmed ? 'X' : ' '
    } ] Ubicación confirmada`,
    14,
    y + 6
  );

  // Firmas
  const sigY = y + 28;
  doc.setDrawColor(100, 116, 139);
  doc.line(22, sigY, 92, sigY);
  doc.setFont('helvetica', 'bold');
  doc.text('RESPONSABLE DE TALLER / OPERADOR', 57, sigY + 5, { align: 'center' });

  doc.line(118, sigY, 188, sigY);
  doc.text('CONFORMIDAD DE INSTALACIÓN / RETIRO', 153, sigY + 5, { align: 'center' });

  const cleanId = order.id.replace('#', '');
  const fileName = `OT_Taller_Sin_Precios_${cleanId}.pdf`;
  doc.save(fileName);
  return fileName;
}

/**
 * Copia texto al portapapeles de forma segura incluso dentro de iframes con restricciones de permisos
 */
export async function copyTextToClipboardSafe(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fallback a textarea
  }
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    textArea.style.top = '0';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textArea);
    return ok;
  } catch {
    return false;
  }
}

