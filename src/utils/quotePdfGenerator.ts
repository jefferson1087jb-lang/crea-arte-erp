import { jsPDF } from 'jspdf';
import { ServiceCategory, WorkOrder, QuoteLineItem } from '../data/initialData';

export type { QuoteLineItem };

export interface ProformaTemplateConfig {
  companyName: string;
  companySubtitle: string;
  companyRucAndAddress: string;
  companyContactLine: string;
  documentTitle: string;
  defaultValidDays: number;
  defaultDeliveryDays: number;
  paymentTermsLabel: string;
  bankHeaderTitle: string;
  bankLine1: string;
  bankLine2: string;
  bankHolderLine: string;
  defaultWarrantyNote: string;
  footerPreparedByTitle: string;
  footerClientTitle: string;
}

export const PROFORMA_TEMPLATE_STORAGE_KEY = 'crea_arte_proforma_template_v1';

export const DEFAULT_PROFORMA_TEMPLATE_CONFIG: ProformaTemplateConfig = {
  companyName: 'CREA ARTE S.A.',
  companySubtitle: 'Imprenta Digital · Gigantografía · Rótulos 3D · Diseño Gráfico',
  companyRucAndAddress: 'RUC: 1790088123001  |  Av. Principal Industrial N45-12, Sector Norte',
  companyContactLine: 'WhatsApp CRM: +593 99 800 1234  |  ventas@creaarte.ec',
  documentTitle: 'COTIZACIÓN / PROFORMA',
  defaultValidDays: 15,
  defaultDeliveryDays: 3,
  paymentTermsLabel: '50% Anticipo / 50% Contra Entrega',
  bankHeaderTitle: 'CUENTAS BANCARIAS OFICIALES (CREA ARTE S.A.)',
  bankLine1: '• Banco Pichincha — Cuenta Corriente #2100492811',
  bankLine2: '• Banco Guayaquil — Cuenta Corriente #0019283746',
  bankHolderLine: 'Titular: Crea Arte S.A.  |  RUC: 1790088123001  |  pagos@creaarte.ec',
  defaultWarrantyNote:
    'Todo trabajo inicia tras el abono del 50% y la aprobación formal del diseño/arte por WhatsApp.',
  footerPreparedByTitle: 'ELABORADO POR CREA ARTE S.A.',
  footerClientTitle: 'ACEPTACIÓN DEL CLIENTE',
};

export function getProformaTemplateConfig(): ProformaTemplateConfig {
  if (typeof window === 'undefined') return DEFAULT_PROFORMA_TEMPLATE_CONFIG;
  try {
    const raw = window.localStorage.getItem(PROFORMA_TEMPLATE_STORAGE_KEY);
    if (!raw) return DEFAULT_PROFORMA_TEMPLATE_CONFIG;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_PROFORMA_TEMPLATE_CONFIG,
      ...parsed,
    };
  } catch {
    return DEFAULT_PROFORMA_TEMPLATE_CONFIG;
  }
}

export function saveProformaTemplateConfig(config: ProformaTemplateConfig): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PROFORMA_TEMPLATE_STORAGE_KEY, JSON.stringify(config));
  } catch {
    // ignore storage errors
  }
}

export interface QuoteProformaData {
  quoteNumber: string;
  orderId?: string;
  issueDate: string;
  validDays: number;
  deliveryDays: number;
  clientName: string;
  clientRuc: string;
  clientPhone: string;
  items: QuoteLineItem[];
  installationFee: number;
  subtotal: number;
  discount: number;
  includeIva: boolean;
  ivaAmount: number;
  totalPrice: number;
  paidAmount?: number;
  requiredAdvance50: number;
  preparedBy: string;
  notes?: string;
  paymentTermsOverride?: string;
}

export function sanitizeFileName(text: string): string {
  return (
    text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 40) || 'Cliente'
  );
}

export function formatQuoteWhatsAppText(data: QuoteProformaData): string {
  const tpl = getProformaTemplateConfig();
  const itemsLines = data.items
    .map(
      (item, idx) =>
        `*${idx + 1}. ${item.title}*\n   • Sustrato/Servicio: ${item.materialName}\n   • Medida/Detalle: ${item.dimensionsText} (Cant: ${item.quantity})\n   • Acabados: ${item.finishingsText || 'Estándar'}\n   • Subtotal ítem: *$${item.lineTotal.toFixed(2)}*`
    )
    .join('\n\n');

  const installLine =
    data.installationFee > 0
      ? `\n🔧 *Instalación y Montaje en Sitio:* $${data.installationFee.toFixed(2)}`
      : '';

  const discountLine =
    data.discount > 0 ? `\n🏷️ *Descuento Comercial:* -$${data.discount.toFixed(2)}` : '';

  const ivaLine = data.includeIva
    ? `\n🧾 *IVA (15%):* $${data.ivaAmount.toFixed(2)}`
    : `\n🧾 *Impuestos:* Precios sin IVA`;

  const paid = data.paidAmount || 0;
  const pending = Math.max(0, Number((data.totalPrice - paid).toFixed(2)));

  return `📄 *PROFORMA COMERCIAL ${data.quoteNumber} — ${tpl.companyName}*
👤 *Cliente:* ${data.clientName} (RUC/CI: ${data.clientRuc || '9999999999'})
📅 *Fecha:* ${data.issueDate} | *Validez:* ${data.validDays} días

━━━━━━━━━━━━━━━━━━━━
*DETALLE DE RUBROS COTIZADOS:*
${itemsLines}${installLine}
━━━━━━━━━━━━━━━━━━━━
• *Subtotal:* $${data.subtotal.toFixed(2)}${discountLine}${ivaLine}
✅ *TOTAL COTIZADO:* *$${data.totalPrice.toFixed(2)}*
${
  paid > 0
    ? `💵 *Abono Registrado:* $${paid.toFixed(2)}\n⏳ *Saldo Pendiente:* *$${pending.toFixed(2)}*`
    : `💳 *Anticipo 50% para iniciar:* *$${data.requiredAdvance50.toFixed(2)}*\n📦 *Saldo 50% contra entrega:* $${(data.totalPrice - data.requiredAdvance50).toFixed(2)}`
}
⏱️ *Tiempo de Entrega Estimado:* ${data.deliveryDays} día(s) laborables
${data.notes ? `📌 *Notas Técnicas:* ${data.notes}\n` : ''}
🏦 *${tpl.bankHeaderTitle}:*
${tpl.bankLine1}
${tpl.bankLine2}
${tpl.bankHolderLine}

📎 *Adjuntamos su Proforma Oficial en formato PDF.* Para aprobar su pedido, responda *APROBADO* o envíenos el comprobante de anticipo por este chat.`;
}

export function buildProformaFromWorkOrder(
  order: WorkOrder,
  preparedBy = 'Departamento Comercial'
): QuoteProformaData {
  const tpl = getProformaTemplateConfig();
  const isDesignOnly = order.category === 'Diseño Gráfico y Branding';
  const baseItemTotal = Math.max(
    0,
    Number((order.subtotal + (order.discount || 0) - (order.installationFee || 0)).toFixed(2))
  );
  const qty = Math.max(1, order.quantity || 1);
  const unitPrice = Number((baseItemTotal / qty).toFixed(2));
  const ivaAmount = order.includeIva
    ? Number((order.totalPrice - order.subtotal).toFixed(2))
    : 0;

  const createdDate = (order.createdAt || new Date().toISOString()).slice(0, 10);
  const deadlineDate = (order.deadline || '').slice(0, 10);
  let deliveryDays = tpl.defaultDeliveryDays || 3;
  if (createdDate && deadlineDate) {
    const diff =
      (new Date(deadlineDate).getTime() - new Date(createdDate).getTime()) /
      (1000 * 60 * 60 * 24);
    if (!isNaN(diff) && diff >= 1) deliveryDays = Math.round(diff);
  }

  const proformaItems: QuoteLineItem[] =
    order.lineItems && order.lineItems.length > 0
      ? order.lineItems
      : [
          {
            id: `item-${order.id}`,
            title: order.title,
            category: order.category,
            materialId: order.materialId,
            materialName: order.materialName,
            dimensionsText: isDesignOnly
              ? 'Proyecto Digital / Entrega Vectorial Editable'
              : `${order.widthM}m × ${order.heightM}m (${order.totalAreaM2} m²)`,
            finishingsText:
              order.finishings && order.finishings.length > 0
                ? order.finishings.join(', ')
                : 'Acabado estándar de taller',
            finishings: order.finishings,
            quantity: qty,
            widthM: order.widthM,
            heightM: order.heightM,
            totalAreaM2: order.totalAreaM2,
            laserMinutes: order.laserMinutes,
            sizesAndColors: order.sizesAndColors,
            unitPrice,
            lineTotal: baseItemTotal,
          },
        ];

  return {
    quoteNumber: `PRO-${order.id}`,
    orderId: order.id,
    issueDate: createdDate,
    validDays: tpl.defaultValidDays || 15,
    deliveryDays,
    clientName: order.clientName,
    clientRuc: order.clientRuc || '9999999999',
    clientPhone: order.clientPhone || '+593 99 000 0000',
    items: proformaItems,
    installationFee: order.installationFee || 0,
    subtotal: order.subtotal,
    discount: order.discount || 0,
    includeIva: order.includeIva,
    ivaAmount: Math.max(0, ivaAmount),
    totalPrice: order.totalPrice,
    paidAmount: order.paidAmount || 0,
    requiredAdvance50: Number((order.totalPrice * 0.5).toFixed(2)),
    preparedBy,
    notes: order.notes,
    paymentTermsOverride: tpl.paymentTermsLabel,
  };
}

export function generateQuotePdf(
  data: QuoteProformaData,
  options: { download?: boolean; customTemplate?: ProformaTemplateConfig } = { download: true }
): { blob: Blob; fileName: string; file: File } {
  const tpl = options.customTemplate || getProformaTemplateConfig();
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  let y = 14;

  // =========================================================================
  // 1. ENCABEZADO CORPORATIVO (MEMBRETE PERSONALIZABLE CREA ARTE)
  // =========================================================================
  doc.setFillColor(15, 23, 42); // slate-900
  doc.roundedRect(margin, y, contentWidth, 28, 2.5, 2.5, 'F');

  // Franja decorativa azul izquierda
  doc.setFillColor(37, 99, 235); // blue-600
  doc.roundedRect(margin, y, 4, 28, 1.5, 1.5, 'F');

  // Marca y subtítulo
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text((tpl.companyName || 'CREA ARTE S.A.').slice(0, 38), margin + 9, y + 9);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text(
    (tpl.companySubtitle || 'Imprenta Digital · Gigantografía · Rótulos 3D · Diseño Gráfico').slice(
      0,
      72
    ),
    margin + 9,
    y + 14.5
  );
  doc.text(
    (tpl.companyRucAndAddress || 'RUC: 1790088123001  |  Av. Principal Industrial N45-12').slice(
      0,
      75
    ),
    margin + 9,
    y + 19.5
  );
  doc.text(
    (tpl.companyContactLine || 'WhatsApp CRM: +593 99 800 1234  |  ventas@creaarte.ec').slice(
      0,
      75
    ),
    margin + 9,
    y + 24.2
  );

  // Recuadro derecho: Número de Proforma y Fechas
  doc.setFillColor(30, 41, 59); // slate-800
  doc.roundedRect(pageWidth - margin - 62, y + 3, 59, 22, 2, 2, 'F');

  doc.setTextColor(96, 165, 250); // blue-400
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text(
    (tpl.documentTitle || 'COTIZACIÓN / PROFORMA').slice(0, 28),
    pageWidth - margin - 32.5,
    y + 8.5,
    {
      align: 'center',
    }
  );

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.text(data.quoteNumber, pageWidth - margin - 32.5, y + 14.5, {
    align: 'center',
  });

  doc.setTextColor(203, 213, 225);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(
    `Emisión: ${data.issueDate}  ·  Validez: ${data.validDays} días`,
    pageWidth - margin - 32.5,
    y + 20.5,
    { align: 'center' }
  );

  y += 33;

  // =========================================================================
  // 2. FICHA DEL CLIENTE Y CONDICIONES DE ENTREGA
  // =========================================================================
  doc.setFillColor(248, 250, 252); // slate-50
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.roundedRect(margin, y, contentWidth, 24, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(37, 99, 235);
  doc.text('DATOS DEL CLIENTE', margin + 4, y + 5.5);
  doc.text('CONDICIONES OPERATIVAS', margin + 108, y + 5.5);

  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text('Cliente / Empresa:', margin + 4, y + 11);
  doc.setFont('helvetica', 'normal');
  doc.text(data.clientName.slice(0, 44), margin + 33, y + 11);

  doc.setFont('helvetica', 'bold');
  doc.text('RUC / Cédula:', margin + 4, y + 16);
  doc.setFont('helvetica', 'normal');
  doc.text(data.clientRuc || '9999999999', margin + 33, y + 16);

  doc.setFont('helvetica', 'bold');
  doc.text('WhatsApp:', margin + 4, y + 21);
  doc.setFont('helvetica', 'normal');
  doc.text(data.clientPhone || 'S/N', margin + 33, y + 21);

  // Columna derecha de condiciones con margen amplio para evitar solapamiento
  doc.setFont('helvetica', 'bold');
  doc.text('Tiempo Entrega:', margin + 108, y + 11);
  doc.setFont('helvetica', 'normal');
  doc.text(`${data.deliveryDays} día(s) laborables tras aprobar arte`, margin + 137, y + 11);

  doc.setFont('helvetica', 'bold');
  doc.text('Forma de Pago:', margin + 108, y + 16);
  doc.setFont('helvetica', 'normal');
  doc.text(
    (data.paymentTermsOverride || tpl.paymentTermsLabel || '50% Anticipo / 50% Contra Entrega').slice(
      0,
      34
    ),
    margin + 137,
    y + 16
  );

  doc.setFont('helvetica', 'bold');
  doc.text('Asesor Comercial:', margin + 108, y + 21);
  doc.setFont('helvetica', 'normal');
  doc.text(data.preparedBy.slice(0, 28), margin + 137, y + 21);

  y += 29;

  // =========================================================================
  // 3. TABLA DE RUBROS Y ESPECIFICACIONES TÉCNICAS
  // =========================================================================
  doc.setFillColor(15, 23, 42);
  doc.rect(margin, y, contentWidth, 8, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('#', margin + 3, y + 5.3);
  doc.text('DESCRIPCIÓN TÉCNICA Y ESPECIFICACIONES', margin + 10, y + 5.3);
  doc.text('MEDIDAS / DETALLE', margin + 104, y + 5.3);
  doc.text('CANT.', margin + 142, y + 5.3, { align: 'center' });
  doc.text('P. UNIT.', margin + 161, y + 5.3, { align: 'right' });
  doc.text('TOTAL', margin + contentWidth - 3, y + 5.3, { align: 'right' });

  y += 8;

  data.items.forEach((item, index) => {
    const titleLines = doc.splitTextToSize(item.title, 90);
    const subSpec = `Sustrato/Base: ${item.materialName} | Acabados: ${item.finishingsText || 'Estándar'}`;
    const specLines = doc.splitTextToSize(subSpec, 90);
    const dimLines = doc.splitTextToSize(item.dimensionsText, 33);

    const rowLinesCount = Math.max(
      titleLines.length + specLines.length,
      dimLines.length,
      2
    );
    const rowHeight = Math.max(14, rowLinesCount * 4.2 + 4);

    if (y + rowHeight > 225) {
      doc.addPage();
      y = 16;
    }

    if (index % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, y, contentWidth, rowHeight, 'F');
    }

    doc.setDrawColor(226, 232, 240);
    doc.line(margin, y + rowHeight, margin + contentWidth, y + rowHeight);

    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text(String(index + 1), margin + 3, y + 5.5);

    doc.text(titleLines, margin + 10, y + 5.5);

    const specStartY = y + 5.5 + titleLines.length * 4;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text(specLines, margin + 10, specStartY);

    doc.setTextColor(30, 41, 59);
    doc.setFontSize(8);
    doc.text(dimLines, margin + 104, y + 5.5);

    doc.setFont('helvetica', 'bold');
    doc.text(String(item.quantity), margin + 142, y + 6, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.text(`$${item.unitPrice.toFixed(2)}`, margin + 161, y + 6, { align: 'right' });
    doc.setFont('helvetica', 'bold');
    doc.text(`$${item.lineTotal.toFixed(2)}`, margin + contentWidth - 3, y + 6, {
      align: 'right',
    });

    y += rowHeight;
  });

  // Si incluye tarifa de instalación en sitio
  if (data.installationFee > 0) {
    const rowHeight = 11;
    doc.setFillColor(241, 245, 249);
    doc.rect(margin, y, contentWidth, rowHeight, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, y + rowHeight, margin + contentWidth, y + rowHeight);

    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('+', margin + 3, y + 6.5);
    doc.text(
      'Servicio de Instalación, Montaje en Sitio y Acometida Operativa',
      margin + 10,
      y + 6.5
    );
    doc.setFont('helvetica', 'normal');
    doc.text('Cuadrilla Técnica', margin + 104, y + 6.5);
    doc.text('1', margin + 142, y + 6.5, { align: 'center' });
    doc.text(`$${data.installationFee.toFixed(2)}`, margin + 161, y + 6.5, {
      align: 'right',
    });
    doc.setFont('helvetica', 'bold');
    doc.text(
      `$${data.installationFee.toFixed(2)}`,
      margin + contentWidth - 3,
      y + 6.5,
      { align: 'right' }
    );
    y += rowHeight;
  }

  y += 5;

  // =========================================================================
  // 4. BLOQUE INFERIOR: CUENTAS BANCARIAS (IZQUIERDA) + LIQUIDACIÓN (DERECHA)
  // =========================================================================
  if (y > 215) {
    doc.addPage();
    y = 16;
  }

  const leftColWidth = 104;
  const rightColX = margin + leftColWidth + 6;
  const rightColWidth = contentWidth - leftColWidth - 6;

  // Caja izquierda: Cuentas Bancarias Oficiales y Notas
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(margin, y, leftColWidth, 48, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(37, 99, 235);
  doc.text(
    (tpl.bankHeaderTitle || 'CUENTAS BANCARIAS OFICIALES (CREA ARTE S.A.)').slice(0, 62),
    margin + 4,
    y + 6
  );

  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text(
    (tpl.bankLine1 || '• Banco Pichincha — Cuenta Corriente #2100492811').slice(0, 64),
    margin + 4,
    y + 11.5
  );
  doc.text(
    (tpl.bankLine2 || '• Banco Guayaquil — Cuenta Corriente #0019283746').slice(0, 64),
    margin + 4,
    y + 16.5
  );
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text(
    (tpl.bankHolderLine || 'Titular: Crea Arte S.A.  |  RUC: 1790088123001  |  pagos@creaarte.ec').slice(
      0,
      68
    ),
    margin + 4,
    y + 21.5
  );

  doc.setDrawColor(226, 232, 240);
  doc.line(margin + 4, y + 24.5, margin + leftColWidth - 4, y + 24.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(15, 23, 42);
  doc.text('OBSERVACIONES Y GARANTÍA TÉCNICA:', margin + 4, y + 29.5);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  const noteStr =
    data.notes && data.notes.trim()
      ? data.notes.trim()
      : tpl.defaultWarrantyNote ||
        'Todo trabajo inicia tras el abono del 50% y la aprobación formal del diseño/arte por WhatsApp.';
  const wrappedNotes = doc.splitTextToSize(noteStr, leftColWidth - 8);
  doc.text(wrappedNotes.slice(0, 3), margin + 4, y + 34.5);

  // Caja derecha: Liquidación Financiera
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(rightColX, y, rightColWidth, 48, 2, 2, 'FD');

  let ry = y + 6.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);

  const grossSubtotal = Number((data.subtotal + (data.discount || 0)).toFixed(2));
  doc.text('Subtotal:', rightColX + 4, ry);
  doc.setFont('helvetica', 'bold');
  doc.text(`$${grossSubtotal.toFixed(2)}`, rightColX + rightColWidth - 4, ry, {
    align: 'right',
  });

  if (data.discount > 0) {
    ry += 5.5;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(180, 83, 9);
    doc.text('Descuento Comercial:', rightColX + 4, ry);
    doc.setFont('helvetica', 'bold');
    doc.text(`-$${data.discount.toFixed(2)}`, rightColX + rightColWidth - 4, ry, {
      align: 'right',
    });
  }

  ry += 5.5;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);
  doc.text(data.includeIva ? 'IVA (15%):' : 'IVA (0%):', rightColX + 4, ry);
  doc.setFont('helvetica', 'bold');
  doc.text(`$${data.ivaAmount.toFixed(2)}`, rightColX + rightColWidth - 4, ry, {
    align: 'right',
  });

  // Banda azul de Total Final
  ry += 4.5;
  doc.setFillColor(37, 99, 235);
  doc.roundedRect(rightColX + 3, ry, rightColWidth - 6, 10, 1.5, 1.5, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text('TOTAL USD:', rightColX + 6, ry + 6.5);
  doc.setFontSize(11);
  doc.text(`$${data.totalPrice.toFixed(2)}`, rightColX + rightColWidth - 6, ry + 6.5, {
    align: 'right',
  });

  // Anticipo 50% y Saldo
  ry += 15;
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  const paidVal = data.paidAmount || 0;
  if (paidVal > 0) {
    const pendingVal = Math.max(0, Number((data.totalPrice - paidVal).toFixed(2)));
    doc.text(`Abono Recibido: $${paidVal.toFixed(2)}`, rightColX + 4, ry);
    doc.text(
      `Saldo: $${pendingVal.toFixed(2)}`,
      rightColX + rightColWidth - 4,
      ry,
      { align: 'right' }
    );
  } else {
    doc.text(
      `Anticipo 50% requerido: $${data.requiredAdvance50.toFixed(2)}`,
      rightColX + 4,
      ry
    );
  }

  y += 58;

  // =========================================================================
  // 5. FIRMAS DE CONFORMIDAD Y PIE DE PÁGINA
  // =========================================================================
  if (y + 24 < 285) {
    doc.setDrawColor(148, 163, 184);
    doc.line(margin + 12, y + 12, margin + 76, y + 12);
    doc.line(pageWidth - margin - 76, y + 12, pageWidth - margin - 12, y + 12);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(51, 65, 85);
    doc.text(
      (tpl.footerPreparedByTitle || 'ELABORADO POR CREA ARTE S.A.').slice(0, 42),
      margin + 44,
      y + 16.5,
      {
        align: 'center',
      }
    );
    doc.text(
      (tpl.footerClientTitle || 'ACEPTACIÓN DEL CLIENTE').slice(0, 42),
      pageWidth - margin - 44,
      y + 16.5,
      {
        align: 'center',
      }
    );

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(data.preparedBy, margin + 44, y + 20.5, { align: 'center' });
    doc.text(data.clientName.slice(0, 35), pageWidth - margin - 44, y + 20.5, {
      align: 'center',
    });
  }

  const fileName = `Cotizacion_${sanitizeFileName(data.quoteNumber)}_${sanitizeFileName(
    data.clientName
  )}.pdf`;

  const arrayBuffer = doc.output('arraybuffer');
  const blob = new Blob([arrayBuffer], { type: 'application/pdf' });
  const file = new File([blob], fileName, { type: 'application/pdf' });

  if (options.download !== false) {
    doc.save(fileName);
  }

  return { blob, fileName, file };
}
