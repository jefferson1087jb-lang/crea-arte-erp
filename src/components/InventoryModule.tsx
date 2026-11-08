import React, { useState, useMemo, useRef } from 'react';
import {
  Package,
  AlertTriangle,
  Plus,
  Scissors,
  Send,
  CheckCircle2,
  ArrowDownLeft,
  ArrowUpRight,
  Lock,
  FileText,
  Upload,
  Sparkles,
  Download,
  RefreshCw,
  Trash2,
  Building2,
  Hash,
  FileCheck2,
  ArrowRight,
  Eye,
  Printer,
  Columns3,
  X,
} from 'lucide-react';
import {
  InventoryItem,
  InventoryCategory,
  InventoryMovement,
  RestockRequest,
  WorkOrder,
  RoleId,
  UserProfile,
  ParsedSupplierInvoice,
  ParsedInvoiceLineItem,
  SAMPLE_PDF_INVOICES,
  BANK_ACCOUNTS_CATALOG,
  ReusableOffcut,
} from '../data/initialData';
import {
  parseSupplierInvoiceFile,
  downloadSamplePdfInvoice,
  createPdfBlobUrlForInvoice,
} from '../utils/pdfInvoiceParser';
import { exportInventoryToCsv } from '../utils/firebaseSyncService';
import { convertInvoiceRollToM2 } from '../domain/erpCalculations';

interface InventoryModuleProps {
  inventory: InventoryItem[];
  movements: InventoryMovement[];
  restockRequests: RestockRequest[];
  orders: WorkOrder[];
  processedInvoices: ParsedSupplierInvoice[];
  reusableOffcuts?: ReusableOffcut[];
  currentRole: RoleId;
  currentUser: UserProfile;
  onAddStockEntry: (itemId: string, qty: number, newUnitCost: number, supplierNote: string) => void;
  onCommitParsedInvoice: (
    invoice: ParsedSupplierInvoice,
    recordPaymentInFinance: boolean
  ) => void;
  onReportWaste: (itemId: string, qty: number, orderId: string, reason: string) => void;
  onCreateRestockRequest: (
    itemId: string,
    qty: number,
    urgency: 'Normal' | 'Alta' | 'Crítica'
  ) => void;
  onApproveRestockRequest: (requestId: string) => void;
  onUseOffcut?: (offcutId: string, usedInOrderId?: string) => void;
  onNavigateOptimizer?: () => void;
}

export const InventoryModule: React.FC<InventoryModuleProps> = ({
  inventory,
  movements,
  restockRequests,
  orders,
  processedInvoices,
  reusableOffcuts = [],
  currentRole,
  onAddStockEntry,
  onCommitParsedInvoice,
  onReportWaste,
  onCreateRestockRequest,
  onApproveRestockRequest,
  onUseOffcut,
  onNavigateOptimizer,
}) => {
  const [activeTab, setActiveTab] = useState<'catalog' | 'pdf_importer' | 'operations' | 'kardex'>(
    'catalog'
  );
  const [categoryFilter, setCategoryFilter] = useState<'all' | InventoryCategory>('all');
  const [onlyCritical, setOnlyCritical] = useState(false);

  // Estado formulario Entrada de Compra Manual (Solo Admin)
  const [entryItemId, setEntryItemId] = useState(inventory[0]?.id || '');
  const [entryQty, setEntryQty] = useState<number>(50);
  const [entryCost, setEntryCost] = useState<number>(2.15);
  const [entryInvoice, setEntryInvoice] = useState<string>('Factura #001-10294');

  // MEJORA 4: Calculadora Rápida de Conversión para compras de Rollos (m²) o Cajas de Blancos (Unidades)
  const [convMode, setConvMode] = useState<'rolls_m2' | 'boxes_units'>('rolls_m2');
  const [convCount, setConvCount] = useState<number>(2); // N° de Rollos o N° de Cajas
  const [convRollWidth, setConvRollWidth] = useState<number>(3.2);
  const [convRollLength, setConvRollLength] = useState<number>(50);
  const [convUnitsPerBox, setConvUnitsPerBox] = useState<number>(36); // Ej. 36 tazas por caja
  const [convPackagePrice, setConvPackagePrice] = useState<number>(288); // Precio por rollo o por caja

  const calculatedConversion = useMemo(() => {
    if (convMode === 'rolls_m2') {
      const conv = convertInvoiceRollToM2(
        convRollWidth,
        convRollLength,
        convCount,
        convCount * convPackagePrice
      );
      return {
        factorPerPack: conv.singleRollAreaM2,
        totalWarehouseQty: conv.totalConvertedStockM2,
        unitWarehouseCost: conv.unitCostPerM2Usd,
        unitLabel: 'm²',
      };
    } else {
      const factorPerPack = Math.max(1, Math.round(convUnitsPerBox));
      const totalWarehouseQty = Number((convCount * factorPerPack).toFixed(2));
      const unitWarehouseCost =
        factorPerPack > 0 ? Number((convPackagePrice / factorPerPack).toFixed(2)) : 0;
      return {
        factorPerPack,
        totalWarehouseQty,
        unitWarehouseCost,
        unitLabel: 'unidad(es)',
      };
    }
  }, [convMode, convCount, convRollWidth, convRollLength, convUnitsPerBox, convPackagePrice]);

  // Estado formulario Reporte de Merma / Desperdicio Real
  const [wasteItemId, setWasteItemId] = useState(inventory[1]?.id || '');
  const [wasteQty, setWasteQty] = useState<number>(1.5);
  const [wasteOrderId, setWasteOrderId] = useState<string>(orders[0]?.id || '#CA-001');
  const [wasteReason, setWasteReason] = useState<string>(
    'Atasco de lona en plotter / reimpresión de franja'
  );

  // Estado formulario Solicitud de Reposición
  const [reqItemId, setReqItemId] = useState(inventory[4]?.id || '');
  const [reqQty, setReqQty] = useState<number>(50);
  const [reqUrgency, setReqUrgency] = useState<'Normal' | 'Alta' | 'Crítica'>('Alta');

  // Estado del Lector / Intérprete de Facturas PDF
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDraggingPdf, setIsDraggingPdf] = useState(false);
  const [isParsingPdf, setIsParsingPdf] = useState(false);
  const [parsedInvoice, setParsedInvoice] = useState<ParsedSupplierInvoice | null>(
    () => SAMPLE_PDF_INVOICES[0]
  );
  const [recordInvoiceInFinance, setRecordInvoiceInFinance] = useState<boolean>(true);

  // Visor de Factura Completa (Modal + Vista Dividida en Vivo)
  const [fullInvoiceModalTarget, setFullInvoiceModalTarget] =
    useState<ParsedSupplierInvoice | null>(null);
  const [invoiceViewerTab, setInvoiceViewerTab] = useState<
    'formatted_invoice' | 'original_pdf' | 'side_by_side'
  >('formatted_invoice');
  const [showInlineSplitPreview, setShowInlineSplitPreview] = useState<boolean>(false);

  const generatedPdfUrlCache = useRef<Record<string, string>>({});
  const getInvoicePreviewUrl = (inv: ParsedSupplierInvoice): string => {
    if (inv.uploadedFileDataUrl) {
      return inv.uploadedFileDataUrl;
    }
    const cacheKey = `${inv.id}-${inv.invoiceNumber}-${inv.totalAmount}`;
    if (!generatedPdfUrlCache.current[cacheKey]) {
      generatedPdfUrlCache.current[cacheKey] = createPdfBlobUrlForInvoice(inv);
    }
    return generatedPdfUrlCache.current[cacheKey];
  };

  const canSeeCosts = currentRole === 'admin';
  const canEditStockDirectly = currentRole === 'admin';
  const canReportWasteOrRequest =
    currentRole === 'operator' || currentRole === 'admin' || currentRole === 'designer';

  const criticalItems = useMemo(
    () => inventory.filter((i) => i.currentStock <= i.minStock),
    [inventory]
  );

  const filteredInventory = useMemo(() => {
    return inventory.filter((item) => {
      if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;
      if (onlyCritical && item.currentStock > item.minStock) return false;
      return true;
    });
  }, [inventory, categoryFilter, onlyCritical]);

  const totalInventoryValue = useMemo(
    () => inventory.reduce((acc, item) => acc + item.currentStock * item.unitCost, 0),
    [inventory]
  );

  // Manejo de subida de archivo PDF o Imagen de Factura
  const handleProcessUploadedFile = async (file: File) => {
    setIsParsingPdf(true);
    try {
      const result = await parseSupplierInvoiceFile(file, inventory);
      setParsedInvoice(result);
    } finally {
      setIsParsingPdf(false);
    }
  };

  const handleLoadSampleInvoice = (sample: ParsedSupplierInvoice) => {
    setIsParsingPdf(true);
    setTimeout(() => {
      setParsedInvoice({
        ...sample,
        id: `parsed-${Date.now()}`,
        items: sample.items.map((it) => ({ ...it, selected: true })),
      });
      setIsParsingPdf(false);
    }, 280);
  };

  // Actualizar una línea de la factura interpretada y recalcular su transformación de unidades
  const handleUpdateParsedLine = (
    lineId: string,
    patch: Partial<ParsedInvoiceLineItem>
  ) => {
    if (!parsedInvoice) return;
    const updatedItems = parsedInvoice.items.map((item) => {
      if (item.id !== lineId) return item;
      const merged = { ...item, ...patch };

      // Si cambió el insumo vinculado del catálogo, auto-ajustar unidad y factor de conversión sugerido
      if (patch.matchedInventoryId && patch.matchedInventoryId !== 'NEW_ITEM') {
        const matchedCatItem = inventory.find((i) => i.id === patch.matchedInventoryId);
        if (matchedCatItem) {
          merged.suggestedSku = matchedCatItem.sku;
          merged.suggestedName = matchedCatItem.name;
          merged.suggestedCategory = matchedCatItem.category;
          merged.warehouseUnit = matchedCatItem.unit;
          if (
            matchedCatItem.category === 'Bobinas y Rollos' &&
            matchedCatItem.rollWidthM &&
            matchedCatItem.rollLengthM &&
            patch.conversionFactor === undefined
          ) {
            merged.conversionFactor = Number(
              (matchedCatItem.rollWidthM * matchedCatItem.rollLengthM).toFixed(2)
            );
          } else if (matchedCatItem.category !== 'Bobinas y Rollos') {
            merged.conversionFactor = 1;
          }
        }
      }

      const pQty = Math.max(0.01, Number(merged.purchaseQty) || 0);
      const pPrice = Math.max(0, Number(merged.purchaseUnitPrice) || 0);
      const conv = Math.max(0.01, Number(merged.conversionFactor) || 1);

      const warehouseQty = Number((pQty * conv).toFixed(2));
      const lineSubtotal = Number((pQty * pPrice).toFixed(2));
      const warehouseUnitCost =
        warehouseQty > 0 ? Number((lineSubtotal / warehouseQty).toFixed(2)) : 0;

      return {
        ...merged,
        purchaseQty: pQty,
        purchaseUnitPrice: pPrice,
        conversionFactor: conv,
        warehouseQty,
        lineSubtotal,
        warehouseUnitCost,
      };
    });

    const newSubtotal = Number(
      updatedItems
        .filter((i) => i.selected)
        .reduce((acc, i) => acc + i.lineSubtotal, 0)
        .toFixed(2)
    );
    const newTax = Number((newSubtotal * 0.15).toFixed(2));
    const newTotal = Number((newSubtotal + newTax).toFixed(2));

    setParsedInvoice({
      ...parsedInvoice,
      subtotal: newSubtotal,
      taxAmount: newTax,
      totalAmount: newTotal,
      items: updatedItems,
    });
  };

  const handleAddEmptyLineToInvoice = () => {
    if (!parsedInvoice) return;
    const defaultInv = inventory[0];
    const newLine: ParsedInvoiceLineItem = {
      id: `line-manual-${Date.now()}`,
      rawDescription: 'NUEVO ÍTEM EN FACTURA PROVEEDOR',
      matchedInventoryId: defaultInv?.id || 'NEW_ITEM',
      suggestedSku: defaultInv?.sku || 'INS-NUEVO-01',
      suggestedName: defaultInv?.name || 'Nuevo Material de Taller',
      suggestedCategory: defaultInv?.category || 'Bobinas y Rollos',
      purchaseQty: 1,
      purchaseUnit: 'Rollo / Unidad',
      purchaseUnitPrice: 100,
      conversionFactor:
        defaultInv?.rollWidthM && defaultInv?.rollLengthM
          ? Number((defaultInv.rollWidthM * defaultInv.rollLengthM).toFixed(2))
          : 1,
      warehouseQty:
        defaultInv?.rollWidthM && defaultInv?.rollLengthM
          ? Number((defaultInv.rollWidthM * defaultInv.rollLengthM).toFixed(2))
          : 1,
      warehouseUnit: defaultInv?.unit || 'm2',
      warehouseUnitCost:
        defaultInv?.rollWidthM && defaultInv?.rollLengthM
          ? Number((100 / (defaultInv.rollWidthM * defaultInv.rollLengthM)).toFixed(2))
          : 100,
      lineSubtotal: 100,
      selected: true,
    };
    setParsedInvoice({
      ...parsedInvoice,
      items: [...parsedInvoice.items, newLine],
    });
  };

  const handleRemoveParsedLine = (lineId: string) => {
    if (!parsedInvoice) return;
    const remaining = parsedInvoice.items.filter((i) => i.id !== lineId);
    const newSubtotal = Number(
      remaining
        .filter((i) => i.selected)
        .reduce((acc, i) => acc + i.lineSubtotal, 0)
        .toFixed(2)
    );
    const newTax = Number((newSubtotal * 0.15).toFixed(2));
    setParsedInvoice({
      ...parsedInvoice,
      subtotal: newSubtotal,
      taxAmount: newTax,
      totalAmount: Number((newSubtotal + newTax).toFixed(2)),
      items: remaining,
    });
  };

  const selectedParsedItemsCount = useMemo(
    () => (parsedInvoice ? parsedInvoice.items.filter((i) => i.selected).length : 0),
    [parsedInvoice]
  );

  return (
    <div className="space-y-6">
      {/* Encabezado Compacto y Organizado en 4 Vistas */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-200/80 dark:border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Inventario Inteligente & Lector de Facturas PDF
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Descuento automático al producir · Conversión de rollos PDF a m² · Alertas de stock mínimo
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex flex-wrap p-1 bg-slate-100 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl gap-1">
            <button
              type="button"
              onClick={() => setActiveTab('catalog')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                activeTab === 'catalog'
                  ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Package className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>1. Stock Bodega ({inventory.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('pdf_importer')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                activeTab === 'pdf_importer'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'text-indigo-700 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>2. Subir Factura PDF (IA)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('operations')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                activeTab === 'operations'
                  ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Scissors className="w-3.5 h-3.5 text-amber-600" />
              <span>3. Mermas y Pedidos</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('kardex')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                activeTab === 'kardex'
                  ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-600" />
              <span>4. Kardex ({movements.length})</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => exportInventoryToCsv(inventory, movements)}
            className="px-3.5 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg shadow-2xs inline-flex items-center gap-1.5 transition-all duration-200"
            title="Exportar Catálogo de Stock y Kardex de Bodega a archivo .CSV compatible con Excel"
          >
            <Download className="w-3.5 h-3.5" />
            <span>📥 Exportar a Excel (.CSV)</span>
          </button>
        </div>
      </div>

      {/* =====================================================================
          VISTA A: LECTOR E INTÉRPRETE DE FACTURAS EN PDF (TRANSFORMADOR A BODEGA)
         ===================================================================== */}
      {activeTab === 'pdf_importer' && (
        <div className="space-y-6">
          {!canEditStockDirectly && (
            <div className="p-3.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/70 rounded-lg flex items-center justify-between text-xs text-amber-800 dark:text-amber-300">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 shrink-0" />
                <span>
                  Estás en modo consulta ({currentRole}). Para confirmar el ingreso de facturas PDF al inventario y caja, cambia al perfil <strong>Administrador / Gerente</strong> en el encabezado superior.
                </span>
              </div>
            </div>
          )}

          {/* Bloque Superior: Zona Drag & Drop de PDF + 3 Facturas PDF Reales de Prueba */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Zona de Subida de PDF */}
            <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Upload className="w-4 h-4 text-blue-600" />
                    <span>1. Subir Factura en PDF o Imagen</span>
                  </h3>
                  <span className="text-[11px] font-mono text-blue-600 dark:text-blue-400 flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> Intérprete IA + OCR
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Sube el archivo <code className="font-mono">.pdf</code>, <code className="font-mono">.png</code> o <code className="font-mono">.jpg</code> de tu proveedor. El sistema extrae RUC, N° de factura, interpreta cada material y transforma rollos o cajas a <code className="font-mono">m²</code>, <code className="font-mono">planchas</code> o <code className="font-mono">litros</code>.
                </p>
              </div>

              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDraggingPdf(true);
                }}
                onDragLeave={() => setIsDraggingPdf(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDraggingPdf(false);
                  const file = e.dataTransfer.files?.[0];
                  if (file) handleProcessUploadedFile(file);
                }}
                onClick={() => fileInputRef.current?.click()}
                className={`cursor-pointer border-2 border-dashed rounded-xl p-6 text-center transition-all ${
                  isDraggingPdf
                    ? 'border-blue-600 bg-blue-50/60 dark:bg-blue-950/30'
                    : 'border-slate-300 dark:border-slate-700 hover:border-blue-500 bg-slate-50/70 dark:bg-slate-950/50'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,application/pdf,image/png,image/jpeg,.xml"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleProcessUploadedFile(file);
                    e.target.value = '';
                  }}
                />
                {isParsingPdf ? (
                  <div className="py-4 flex flex-col items-center gap-2 text-blue-600 dark:text-blue-400">
                    <RefreshCw className="w-7 h-7 animate-spin" />
                    <span className="text-xs font-semibold">
                      Interpretando Factura PDF y calculando conversión a m² / planchas...
                    </span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="text-xs font-semibold text-slate-900 dark:text-white">
                      Haz clic para seleccionar un PDF o arrástralo aquí
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono">
                      Soporta Facturas PDF de Bobinas, Planchas Rígidas, Tintas y LED
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Simulador y Descargador de 3 Facturas PDF de Proveedores Gráficos */}
            <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <FileCheck2 className="w-4 h-4 text-emerald-600" />
                    <span>Plantillas de Facturas PDF de Proveedores (Probar o Descargar PDF)</span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Puedes cargar cualquiera de estas 3 facturas en 1 clic o descargar el archivo <code className="font-mono">.pdf</code> real a tu PC y subirlo en el cuadro izquierdo.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {SAMPLE_PDF_INVOICES.map((samp, idx) => {
                  const isCurrent = parsedInvoice?.invoiceNumber === samp.invoiceNumber;
                  return (
                    <div
                      key={samp.id}
                      className={`p-3.5 rounded-lg border flex flex-col justify-between gap-3 transition-colors ${
                        isCurrent
                          ? 'border-blue-600 bg-blue-50/40 dark:bg-blue-950/20'
                          : 'border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/60'
                      }`}
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[10px] font-mono font-bold uppercase px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                            Factura PDF #{idx + 1}
                          </span>
                          <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            ${samp.totalAmount.toFixed(2)}
                          </span>
                        </div>
                        <div className="text-xs font-bold text-slate-900 dark:text-white leading-snug">
                          {samp.supplierName}
                        </div>
                        <div className="text-[11px] font-mono text-slate-500">
                          {samp.invoiceNumber}
                        </div>
                        <div className="text-[11px] text-slate-600 dark:text-slate-400 pt-1 border-t border-slate-200/70 dark:border-slate-800">
                          {samp.items.length} ítems:{' '}
                          {samp.items.map((i) => i.suggestedName.split('(')[0].trim()).join(', ')}
                        </div>
                      </div>

                      <div className="flex flex-col gap-1.5 pt-1">
                        <button
                          type="button"
                          onClick={() => handleLoadSampleInvoice(samp)}
                          className="w-full py-1.5 px-2.5 text-[11px] font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                        >
                          Interpretar en Pantalla
                        </button>
                        <div className="grid grid-cols-2 gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setInvoiceViewerTab('formatted_invoice');
                              setFullInvoiceModalTarget(samp);
                            }}
                            className="py-1 px-2 text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded inline-flex items-center justify-center gap-1 transition-colors"
                          >
                            <Eye className="w-3 h-3" />
                            <span>Ver Completa</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => downloadSamplePdfInvoice(samp)}
                            className="py-1 px-2 text-[11px] font-medium bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 rounded inline-flex items-center justify-center gap-1 transition-colors"
                          >
                            <Download className="w-3 h-3" />
                            <span>Bajar PDF</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Bloque Central: Mesa de Transformación e Interpretación de la Factura PDF */}
          {parsedInvoice && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
              {/* Cabecera de la Factura Interpretada */}
              <div className="p-5 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 space-y-4">
                <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-blue-600 text-white">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                          2. Revisión y Transformación de Unidades antes de Ingresar a Bodega
                        </h3>
                        <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-semibold">
                          Archivo: {parsedInvoice.fileName}
                        </span>
                        <span
                          className={`text-[11px] font-mono px-2 py-0.5 rounded font-semibold ${
                            parsedInvoice.extractionSource === 'gemini-ai'
                              ? 'bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300'
                              : 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                          }`}
                        >
                          {parsedInvoice.extractionSource === 'gemini-ai'
                            ? '✨ Extraído con Gemini 2.5 Flash IA'
                            : '⚙️ Procesado con Motor OCR Local'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Verifica los datos extraídos del PDF. Puedes abrir la <strong>Factura Completa</strong> o activar el <strong>Comparador Lado a Lado</strong> mientras editas.
                      </p>
                      {parsedInvoice.warningMessage && (
                        <div className="mt-1.5 px-2.5 py-1.5 rounded-md bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-[11px] text-amber-800 dark:text-amber-300 font-medium">
                          ⚠️ {parsedInvoice.warningMessage}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Botones de Visualización Completa y Edición */}
                  <div className="flex flex-wrap items-center gap-2 self-start">
                    <button
                      type="button"
                      onClick={() => {
                        setInvoiceViewerTab('formatted_invoice');
                        setFullInvoiceModalTarget(parsedInvoice);
                      }}
                      className="px-3.5 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-2xs inline-flex items-center gap-1.5 transition-colors"
                    >
                      <Eye className="w-4 h-4" />
                      <span>👁️ Ver Factura Completa (Documento + PDF)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowInlineSplitPreview(!showInlineSplitPreview)}
                      className={`px-3 py-2 text-xs font-bold rounded-lg border inline-flex items-center gap-1.5 transition-colors ${
                        showInlineSplitPreview
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <Columns3 className="w-4 h-4" />
                      <span>
                        {showInlineSplitPreview
                          ? 'Ocultar Vista Dividida PDF'
                          : '⚖️ Comparar Lado a Lado con PDF'}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={handleAddEmptyLineToInvoice}
                      className="px-3 py-2 text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 hover:bg-slate-100 inline-flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5 text-blue-600" />
                      <span>Añadir Ítem Manual</span>
                    </button>
                  </div>
                </div>

                {/* Campos Editables de Cabecera Fiscal y Bancaria */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 pt-1">
                  <div className="lg:col-span-2">
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Proveedor (Razón Social extraída del PDF)
                    </label>
                    <div className="relative">
                      <Building2 className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                      <input
                        type="text"
                        value={parsedInvoice.supplierName}
                        onChange={(e) =>
                          setParsedInvoice({ ...parsedInvoice, supplierName: e.target.value })
                        }
                        className="w-full pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-white font-medium"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      RUC / NIT Proveedor
                    </label>
                    <input
                      type="text"
                      value={parsedInvoice.supplierRuc}
                      onChange={(e) =>
                        setParsedInvoice({ ...parsedInvoice, supplierRuc: e.target.value })
                      }
                      className="w-full px-2.5 py-1.5 text-xs font-mono bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      N° Factura / Serie PDF
                    </label>
                    <div className="relative">
                      <Hash className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                      <input
                        type="text"
                        value={parsedInvoice.invoiceNumber}
                        onChange={(e) =>
                          setParsedInvoice({ ...parsedInvoice, invoiceNumber: e.target.value })
                        }
                        className="w-full pl-7 pr-2.5 py-1.5 text-xs font-mono font-semibold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Fecha Emisión
                    </label>
                    <input
                      type="date"
                      value={parsedInvoice.issueDate}
                      onChange={(e) =>
                        setParsedInvoice({ ...parsedInvoice, issueDate: e.target.value })
                      }
                      className="w-full px-2.5 py-1.5 text-xs font-mono bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Total Factura c/IVA
                    </label>
                    <div className="px-3 py-1.5 text-xs font-mono font-bold bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded text-emerald-800 dark:text-emerald-300">
                      ${parsedInvoice.totalAmount.toFixed(2)} (Sub: ${parsedInvoice.subtotal.toFixed(2)})
                    </div>
                  </div>
                </div>
              </div>

              {/* PANEL DESPLEGABLE DE COMPARACIÓN LADO A LADO (PDF ORIGINAL + COMPROBANTE FISCAL COMPLETO) */}
              {showInlineSplitPreview && (
                <div className="p-5 bg-slate-100/70 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800 grid grid-cols-1 lg:grid-cols-2 gap-5">
                  {/* Columna Izquierda: Visor del PDF / Imagen Original */}
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden flex flex-col">
                    <div className="px-4 py-2.5 bg-slate-900 text-white flex items-center justify-between text-xs font-bold">
                      <span>📄 Archivo PDF / Imagen Original ({parsedInvoice.fileName})</span>
                      <button
                        type="button"
                        onClick={() => downloadSamplePdfInvoice(parsedInvoice)}
                        className="px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 text-white inline-flex items-center gap-1 text-[11px]"
                      >
                        <Download className="w-3 h-3" /> Descargar PDF
                      </button>
                    </div>
                    <div className="h-[420px] bg-slate-800">
                      {parsedInvoice.uploadedFileMimeType?.startsWith('image/') &&
                      parsedInvoice.uploadedFileDataUrl ? (
                        <div className="w-full h-full flex items-center justify-center p-4 overflow-auto">
                          <img
                            src={parsedInvoice.uploadedFileDataUrl}
                            alt={parsedInvoice.fileName}
                            className="max-w-full max-h-full object-contain rounded shadow"
                          />
                        </div>
                      ) : (
                        <iframe
                          title={`PDF-${parsedInvoice.invoiceNumber}`}
                          src={getInvoicePreviewUrl(parsedInvoice)}
                          className="w-full h-full border-0 bg-white"
                        />
                      )}
                    </div>
                  </div>

                  {/* Columna Derecha: Comprobante Fiscal Interpretado Completo */}
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col justify-between space-y-4">
                    <div className="space-y-3">
                      <div className="flex items-start justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                        <div>
                          <div className="text-[10px] font-mono uppercase tracking-wider text-blue-600 dark:text-blue-400 font-bold">
                            FACTURA ELECTRÓNICA INTERPRETADA · {parsedInvoice.extractionSource === 'gemini-ai' ? 'MOTOR IA GEMINI' : 'MOTOR OCR PDF'}
                          </div>
                          <h4 className="text-base font-bold text-slate-900 dark:text-white">
                            {parsedInvoice.supplierName}
                          </h4>
                          <p className="text-xs font-mono text-slate-500">
                            RUC / NIT: {parsedInvoice.supplierRuc} · Emisión: {parsedInvoice.issueDate}
                          </p>
                        </div>
                        <div className="text-right font-mono">
                          <span className="px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white">
                            {parsedInvoice.invoiceNumber}
                          </span>
                          <div className="text-[11px] text-slate-500 mt-1">
                            Cliente: Taller Crea Arte ERP
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1">
                        {parsedInvoice.items.map((it, idx) => (
                          <div
                            key={it.id}
                            className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-3 text-xs"
                          >
                            <div className="min-w-0">
                              <div className="font-bold text-slate-900 dark:text-white truncate">
                                {idx + 1}. {it.rawDescription}
                              </div>
                              <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                                Facturado: {it.purchaseQty} × {it.purchaseUnit} (${it.purchaseUnitPrice.toFixed(2)} c/u) →{' '}
                                <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                                  Bodega: +{it.warehouseQty} {it.warehouseUnit} (${it.warehouseUnitCost.toFixed(2)}/{it.warehouseUnit})
                                </span>
                              </div>
                            </div>
                            <div className="font-mono font-bold text-slate-900 dark:text-white shrink-0">
                              ${it.lineSubtotal.toFixed(2)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs font-mono">
                      <div className="text-slate-500">
                        Pago: {parsedInvoice.paymentMethod} · {parsedInvoice.bankEntity}
                      </div>
                      <div className="text-right">
                        <span className="text-slate-500 mr-3">
                          Sub: ${parsedInvoice.subtotal.toFixed(2)} | IVA: ${parsedInvoice.taxAmount.toFixed(2)}
                        </span>
                        <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                          TOTAL: ${parsedInvoice.totalAmount.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tabla de Transformación de Unidades (De Factura PDF -> A Stock de Taller) */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100/80 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400">
                    <tr>
                      <th className="py-2.5 px-3 w-8 text-center">Inc.</th>
                      <th className="py-2.5 px-3">Descripción Detectada en PDF</th>
                      <th className="py-2.5 px-3">Vincular a Insumo de Bodega</th>
                      <th className="py-2.5 px-3 text-right">Cant. Factura</th>
                      <th className="py-2.5 px-3">Unidad PDF</th>
                      <th className="py-2.5 px-3 text-right">Precio Unit. PDF</th>
                      <th className="py-2.5 px-3 text-center bg-blue-50/60 dark:bg-blue-950/30 text-blue-800 dark:text-blue-300">
                        Factor Conversión
                      </th>
                      <th className="py-2.5 px-3 text-right bg-emerald-50/60 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300">
                        Ingreso Real a Stock
                      </th>
                      <th className="py-2.5 px-3 text-right">Costo Real/Unidad</th>
                      <th className="py-2.5 px-3 text-right">Subtotal</th>
                      <th className="py-2.5 px-2 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {parsedInvoice.items.map((line) => {
                      const isNewItem = line.matchedInventoryId === 'NEW_ITEM';
                      return (
                        <tr
                          key={line.id}
                          className={`transition-colors ${
                            line.selected
                              ? 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
                              : 'opacity-45 bg-slate-50 dark:bg-slate-950'
                          }`}
                        >
                          <td className="py-3 px-3 text-center">
                            <input
                              type="checkbox"
                              checked={line.selected}
                              onChange={(e) =>
                                handleUpdateParsedLine(line.id, { selected: e.target.checked })
                              }
                              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            />
                          </td>

                          {/* Descripción en PDF + Campos si es Nuevo Insumo */}
                          <td className="py-3 px-3 min-w-[210px]">
                            <input
                              type="text"
                              value={line.rawDescription}
                              onChange={(e) =>
                                handleUpdateParsedLine(line.id, {
                                  rawDescription: e.target.value,
                                })
                              }
                              className="w-full px-2 py-1 text-xs font-semibold bg-transparent border border-transparent hover:border-slate-300 dark:hover:border-slate-700 focus:border-blue-500 rounded text-slate-900 dark:text-white"
                            />
                            {isNewItem && (
                              <div className="mt-1.5 p-2 rounded bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/70 space-y-1.5">
                                <div className="text-[10px] font-bold text-amber-800 dark:text-amber-300 uppercase">
                                  Crear Nuevo Insumo en Catálogo:
                                </div>
                                <div className="grid grid-cols-2 gap-1.5">
                                  <input
                                    type="text"
                                    placeholder="SKU (ej. VIN-3M)"
                                    value={line.suggestedSku}
                                    onChange={(e) =>
                                      handleUpdateParsedLine(line.id, {
                                        suggestedSku: e.target.value,
                                      })
                                    }
                                    className="px-2 py-1 text-[11px] font-mono bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 rounded"
                                  />
                                  <select
                                    value={line.suggestedCategory}
                                    onChange={(e) =>
                                      handleUpdateParsedLine(line.id, {
                                        suggestedCategory: e.target.value as InventoryCategory,
                                      })
                                    }
                                    className="px-2 py-1 text-[11px] bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 rounded"
                                  >
                                    <option value="Bobinas y Rollos">Bobinas y Rollos</option>
                                    <option value="Planchas Rígidas">Planchas Rígidas</option>
                                    <option value="Tintas y Consumibles">Tintas y Consumibles</option>
                                    <option value="Blancos y Merchandising (Unidades)">
                                      Blancos y Merchandising (Unidades)
                                    </option>
                                  </select>
                                </div>
                                <input
                                  type="text"
                                  placeholder="Nombre en bodega"
                                  value={line.suggestedName}
                                  onChange={(e) =>
                                    handleUpdateParsedLine(line.id, {
                                      suggestedName: e.target.value,
                                    })
                                  }
                                  className="w-full px-2 py-1 text-[11px] bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 rounded"
                                />
                              </div>
                            )}
                          </td>

                          {/* Selector de Insumo Destino en Bodega */}
                          <td className="py-3 px-3 min-w-[220px]">
                            <select
                              value={line.matchedInventoryId}
                              onChange={(e) =>
                                handleUpdateParsedLine(line.id, {
                                  matchedInventoryId: e.target.value,
                                })
                              }
                              className={`w-full px-2.5 py-1.5 text-xs rounded border font-medium ${
                                isNewItem
                                  ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-400 text-amber-900 dark:text-amber-300'
                                  : 'bg-slate-50 dark:bg-slate-950 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white'
                              }`}
                            >
                              <option value="NEW_ITEM">
                                + Crear como Nuevo Insumo ({line.suggestedSku})
                              </option>
                              {inventory.map((inv) => (
                                <option key={inv.id} value={inv.id}>
                                  [{inv.sku}] {inv.name} (Actual: {inv.currentStock} {inv.unit})
                                </option>
                              ))}
                            </select>
                          </td>

                          {/* Cantidad Facturada */}
                          <td className="py-3 px-3 text-right">
                            <input
                              type="number"
                              min="0.1"
                              step="0.5"
                              value={line.purchaseQty}
                              onChange={(e) =>
                                handleUpdateParsedLine(line.id, {
                                  purchaseQty: Number(e.target.value),
                                })
                              }
                              className="w-16 px-2 py-1 text-right font-mono text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-white"
                            />
                          </td>

                          {/* Unidad según PDF */}
                          <td className="py-3 px-3">
                            <input
                              type="text"
                              value={line.purchaseUnit}
                              onChange={(e) =>
                                handleUpdateParsedLine(line.id, {
                                  purchaseUnit: e.target.value,
                                })
                              }
                              className="w-32 px-2 py-1 text-[11px] font-mono bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-slate-700 dark:text-slate-300"
                            />
                          </td>

                          {/* Precio Unitario Factura */}
                          <td className="py-3 px-3 text-right">
                            <input
                              type="number"
                              min="0.01"
                              step="0.5"
                              value={line.purchaseUnitPrice}
                              onChange={(e) =>
                                handleUpdateParsedLine(line.id, {
                                  purchaseUnitPrice: Number(e.target.value),
                                })
                              }
                              className="w-20 px-2 py-1 text-right font-mono text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-white"
                            />
                          </td>

                          {/* Factor de Conversión (ej. 160 m2 por rollo) */}
                          <td className="py-3 px-3 text-center bg-blue-50/40 dark:bg-blue-950/20">
                            <div className="flex items-center justify-center gap-1">
                              <span className="text-[11px] text-slate-400 font-mono">×</span>
                              <input
                                type="number"
                                min="0.01"
                                step="0.25"
                                value={line.conversionFactor}
                                onChange={(e) =>
                                  handleUpdateParsedLine(line.id, {
                                    conversionFactor: Number(e.target.value),
                                  })
                                }
                                className="w-16 px-1.5 py-1 text-center font-mono font-bold text-xs bg-white dark:bg-slate-900 border border-blue-300 dark:border-blue-800 rounded text-blue-700 dark:text-blue-300"
                              />
                            </div>
                            <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                              {line.conversionFactor > 1
                                ? `${line.conversionFactor} ${line.warehouseUnit}/rollo`
                                : `Directo (1:1)`}
                            </div>
                          </td>

                          {/* Cantidad Transformada Real a Ingresar a Bodega */}
                          <td className="py-3 px-3 text-right bg-emerald-50/40 dark:bg-emerald-950/20">
                            <div className="flex items-center justify-end gap-1 font-mono font-bold text-emerald-700 dark:text-emerald-400 text-xs">
                              <span>+{line.warehouseQty}</span>
                              {isNewItem ? (
                                  <select
                                    value={line.warehouseUnit}
                                    onChange={(e) =>
                                      handleUpdateParsedLine(line.id, {
                                        warehouseUnit: e.target.value as
                                          | 'm2'
                                          | 'plancha'
                                          | 'litro'
                                          | 'unidad',
                                      })
                                    }
                                    className="px-1 py-0.5 text-[11px] bg-white dark:bg-slate-900 border border-emerald-400 rounded"
                                  >
                                  <option value="m2">m2</option>
                                  <option value="plancha">plancha</option>
                                  <option value="litro">litro</option>
                                  <option value="unidad">unidad</option>
                                </select>
                              ) : (
                                <span>{line.warehouseUnit}</span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-500 font-mono">
                              {line.purchaseQty} × {line.conversionFactor}
                            </div>
                          </td>

                          {/* Nuevo Costo Unitario Real Calculado */}
                          <td className="py-3 px-3 text-right font-mono text-slate-800 dark:text-slate-200">
                            <div className="font-semibold">
                              ${line.warehouseUnitCost.toFixed(2)}/{line.warehouseUnit}
                            </div>
                          </td>

                          {/* Subtotal de Línea */}
                          <td className="py-3 px-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                            ${line.lineSubtotal.toFixed(2)}
                          </td>

                          {/* Eliminar fila */}
                          <td className="py-3 px-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveParsedLine(line.id)}
                              className="p-1 text-slate-400 hover:text-red-600 rounded"
                              title="Quitar línea"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pie de Confirmación: Conciliación Bancaria + Botón de Ingreso Masivo */}
              <div className="p-5 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="space-y-2 flex-1">
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={recordInvoiceInFinance}
                      onChange={(e) => setRecordInvoiceInFinance(e.target.checked)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                      Registrar también el pago/egreso de esta factura (${parsedInvoice.totalAmount.toFixed(2)}) en Caja y Bancos
                    </span>
                  </label>

                  {recordInvoiceInFinance && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 max-w-2xl">
                      <div>
                        <label className="block text-[10px] font-mono uppercase text-slate-500 mb-0.5">
                          Método de Pago
                        </label>
                        <select
                          value={parsedInvoice.paymentMethod}
                          onChange={(e) =>
                            setParsedInvoice({
                              ...parsedInvoice,
                              paymentMethod: e.target.value as
                                | 'Efectivo'
                                | 'Transferencia Bancaria'
                                | 'Tarjeta',
                            })
                          }
                          className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-white"
                        >
                          <option value="Transferencia Bancaria">Transferencia Bancaria</option>
                          <option value="Tarjeta">Tarjeta Corporativa</option>
                          <option value="Efectivo">Efectivo / Caja</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-mono uppercase text-slate-500 mb-0.5">
                          Banco / Cuenta Origen
                        </label>
                        <select
                          value={parsedInvoice.bankEntity}
                          onChange={(e) =>
                            setParsedInvoice({ ...parsedInvoice, bankEntity: e.target.value })
                          }
                          className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-white"
                        >
                          {BANK_ACCOUNTS_CATALOG.map((b) => (
                            <option key={b} value={b}>
                              {b}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-mono uppercase text-slate-500 mb-0.5">
                          N° Comprobante / Transferencia
                        </label>
                        <input
                          type="text"
                          value={parsedInvoice.referenceNumber}
                          onChange={(e) =>
                            setParsedInvoice({
                              ...parsedInvoice,
                              referenceNumber: e.target.value,
                            })
                          }
                          placeholder="Ej. SPI-99402184"
                          className="w-full px-2.5 py-1.5 text-xs font-mono bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-white"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
                  <div className="text-right font-mono pr-2">
                    <div className="text-[11px] text-slate-500">
                      Ítems seleccionados: {selectedParsedItemsCount}
                    </div>
                    <div className="text-sm font-bold text-slate-900 dark:text-white">
                      Total Factura: ${parsedInvoice.totalAmount.toFixed(2)}
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={!canEditStockDirectly || selectedParsedItemsCount === 0}
                    onClick={() => {
                      onCommitParsedInvoice(parsedInvoice, recordInvoiceInFinance);
                      setActiveTab('catalog');
                    }}
                    className="px-5 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 rounded-lg shadow-xs inline-flex items-center justify-center gap-2 transition-colors"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>
                      Confirmar e Ingresar {selectedParsedItemsCount} Materiales a Bodega
                    </span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Historial de Facturas PDF Procesadas e Ingresadas */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <FileCheck2 className="w-4 h-4 text-blue-600" />
                <span>Historial de Facturas PDF Interpretadas e Ingresadas ({processedInvoices.length})</span>
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-slate-500">
                  <tr>
                    <th className="py-2.5 px-4">Fecha Ingreso</th>
                    <th className="py-2.5 px-4">N° Factura PDF</th>
                    <th className="py-2.5 px-4">Proveedor / RUC</th>
                    <th className="py-2.5 px-4">Materiales Transformados e Ingresados</th>
                    <th className="py-2.5 px-4">Banco / Referencia</th>
                    <th className="py-2.5 px-4 text-right">Total c/IVA</th>
                    <th className="py-2.5 px-4 text-right">Factura Completa</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {processedInvoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                      <td className="py-2.5 px-4 font-mono text-slate-500 whitespace-nowrap">
                        {inv.processedAt || inv.issueDate}
                      </td>
                      <td className="py-2.5 px-4 font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => {
                            setInvoiceViewerTab('formatted_invoice');
                            setFullInvoiceModalTarget(inv);
                          }}
                          className="text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>{inv.invoiceNumber}</span>
                        </button>
                      </td>
                      <td className="py-2.5 px-4">
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {inv.supplierName}
                        </div>
                        <div className="text-[11px] font-mono text-slate-500">
                          RUC: {inv.supplierRuc}
                        </div>
                      </td>
                      <td className="py-2.5 px-4">
                        <div className="space-y-0.5">
                          {inv.items
                            .filter((i) => i.selected)
                            .map((it) => (
                              <div key={it.id} className="text-[11px] text-slate-700 dark:text-slate-300">
                                <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
                                  +{it.warehouseQty} {it.warehouseUnit}
                                </span>{' '}
                                de {it.suggestedName}{' '}
                                <span className="text-slate-400 font-mono">
                                  ({it.purchaseQty} × {it.conversionFactor})
                                </span>
                              </div>
                            ))}
                        </div>
                      </td>
                      <td className="py-2.5 px-4 text-[11px] font-mono text-slate-600 dark:text-slate-400">
                        <div>{inv.bankEntity}</div>
                        <div className="text-slate-400">Ref: {inv.referenceNumber}</div>
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap">
                        ${inv.totalAmount.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setInvoiceViewerTab('formatted_invoice');
                              setFullInvoiceModalTarget(inv);
                            }}
                            className="px-2.5 py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg inline-flex items-center gap-1 transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Ver Factura Completa</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => downloadSamplePdfInvoice(inv)}
                            className="p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700"
                            title="Descargar PDF de esta factura"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          VISTA B: CATÁLOGO DE INVENTARIO, OPERACIONES Y KARDEX
         ===================================================================== */}
      {activeTab === 'catalog' && (
        <>
          {/* Alerta Visual de Stock Crítico */}
          {criticalItems.length > 0 && (
            <div className="p-4 bg-amber-50/90 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="text-xs text-slate-800 dark:text-slate-200">
                  <strong className="font-semibold">
                    Alerta de Stock Crítico ({criticalItems.length} insumos bajo el mínimo):
                  </strong>{' '}
                  {criticalItems.map((c) => `${c.name} (${c.currentStock} ${c.unit})`).join(' · ')}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setActiveTab('pdf_importer')}
                  className="px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded inline-flex items-center gap-1.5"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Cargar Factura PDF de Compra</span>
                </button>
                <button
                  type="button"
                  onClick={() => setOnlyCritical(!onlyCritical)}
                  className="px-3 py-1.5 text-xs font-medium bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-800 rounded text-slate-900 dark:text-white whitespace-nowrap"
                >
                  {onlyCritical ? 'Ver Todo el Catálogo' : 'Filtrar Críticos'}
                </button>
              </div>
            </div>
          )}

          {/* Filtros de Categoría */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
              {(
                [
                  'all',
                  'Bobinas y Rollos',
                  'Planchas Rígidas',
                  'Tintas y Consumibles',
                  'Blancos y Merchandising (Unidades)',
                ] as const
              ).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    categoryFilter === cat
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  {cat === 'all' ? 'Todos los Insumos' : cat}
                </button>
              ))}
            </div>

            {currentRole === 'sales' && (
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <Lock className="w-3.5 h-3.5" />
                <span>Rol Ventas: Solo consulta de disponibilidad (Edición y costos ocultos)</span>
              </div>
            )}
          </div>

          {/* Tabla Principal de Inventario */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400">
                  <tr>
                    <th className="py-3 px-4">SKU</th>
                    <th className="py-3 px-4">Insumo / Formato</th>
                    <th className="py-3 px-4">Categoría</th>
                    <th className="py-3 px-4">Proveedor</th>
                    <th className="py-3 px-4 text-right">Stock Actual</th>
                    <th className="py-3 px-4 text-right">Mínimo</th>
                    <th className="py-3 px-4">Estado</th>
                    {canSeeCosts && <th className="py-3 px-4 text-right">Costo Unitario</th>}
                    {canSeeCosts && <th className="py-3 px-4 text-right">Kardex Valorizado</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {filteredInventory.map((item) => {
                    const isLow = item.currentStock <= item.minStock;
                    const valuedTotalUsd = Number((item.currentStock * item.unitCost).toFixed(2));
                    return (
                      <tr
                        key={item.id}
                        className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="py-3 px-4 font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap">
                          {item.sku}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900 dark:text-white">
                            {item.name}
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono">
                            {item.rollWidthM
                              ? `Ancho bobina: ${item.rollWidthM}m × ${item.rollLengthM}m`
                              : item.sheetDimensions
                              ? `Formato plancha: ${item.sheetDimensions}`
                              : `Unidad de control: ${item.unit}`}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                          {item.category}
                        </td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                          {item.supplier}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 dark:text-white">
                          {item.currentStock.toFixed(1)} {item.unit}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-slate-500">
                          {item.minStock.toFixed(1)} {item.unit}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          {isLow ? (
                            <span className="text-red-600 dark:text-red-400 font-semibold inline-flex items-center gap-1">
                              <AlertTriangle className="w-3.5 h-3.5" /> Crítico / Reponer
                            </span>
                          ) : (
                            <span className="text-emerald-700 dark:text-emerald-400 inline-flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Óptimo
                            </span>
                          )}
                        </td>
                        {canSeeCosts && (
                          <td className="py-3 px-4 text-right font-mono text-slate-700 dark:text-slate-300">
                            ${item.unitCost.toFixed(2)}/{item.unit}
                          </td>
                        )}
                        {canSeeCosts && (
                          <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700 dark:text-emerald-400">
                            ${valuedTotalUsd.toFixed(2)}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* PANEL DE RETAZOS RÍGIDOS REUTILIZABLES VINCULADO CON EL OPTIMIZADOR 2D */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wide text-slate-900 dark:text-white flex items-center gap-2">
                  <Scissors className="w-3.5 h-3.5 text-emerald-600" />
                  <span>
                    Retazos Rígidos Reutilizables en Bodega ({reusableOffcuts.filter((o) => o.status === 'Disponible').length} disponibles)
                  </span>
                </h3>
                <p className="text-[11px] text-slate-500">
                  Sobrantes de Acrílico, Alucobond y PVC Sintra registrados en centímetros para ahorrar planchas nuevas.
                </p>
              </div>
              {onNavigateOptimizer && (
                <button
                  type="button"
                  onClick={onNavigateOptimizer}
                  className="px-3 py-1.5 text-xs font-semibold bg-slate-900 dark:bg-slate-800 hover:bg-blue-600 text-white rounded-md transition-colors whitespace-nowrap"
                >
                  Abrir Optimizador de Cortes 2D →
                </button>
              )}
            </div>

            {reusableOffcuts.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {reusableOffcuts.map((off) => (
                  <div
                    key={off.id}
                    className={`p-3 rounded-lg border text-xs flex flex-col justify-between gap-2 ${
                      off.status === 'Disponible'
                        ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/70'
                        : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 opacity-60'
                    }`}
                  >
                    <div>
                      <div className="font-semibold text-slate-900 dark:text-white">
                        {off.materialName}
                      </div>
                      <div className="font-mono font-bold text-blue-600 dark:text-blue-400 mt-0.5">
                        {off.widthCm} cm × {off.heightCm} cm ({off.thicknessMm}mm)
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Origen: {off.sourceOrderId || 'Taller'} · Estado: {off.status}
                      </div>
                    </div>
                    {off.status === 'Disponible' && onUseOffcut && (
                      <button
                        type="button"
                        onClick={() => onUseOffcut(off.id, orders[0]?.id || 'TALLER')}
                        className="w-full py-1 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded text-[11px]"
                      >
                        Marcar como Reutilizado
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Resumen inferior rápido con accesos directos */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 rounded-lg text-xs">
            <div className="flex items-center gap-4 font-mono">
              <span className="text-red-600 dark:text-red-400 font-semibold">
                Insumos Críticos: {criticalItems.length}
              </span>
              {canSeeCosts && (
                <span className="text-slate-800 dark:text-slate-200 font-semibold">
                  Valor Total en Bodega: ${totalInventoryValue.toFixed(2)}
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('pdf_importer')}
                className="px-3 py-1.5 font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-md inline-flex items-center gap-1.5"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Ingresar Factura PDF</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('operations')}
                className="px-3 py-1.5 font-semibold bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-md"
              >
                Registrar Merma o Pedido Manual
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('kardex')}
                className="px-3 py-1.5 font-medium text-slate-600 dark:text-slate-400 hover:underline"
              >
                Ver Kardex ({movements.length})
              </button>
            </div>
          </div>
        </>
      )}

      {/* =====================================================================
          VISTA C: OPERACIONES RÁPIDAS (COMPRA MANUAL, MERMA DE TALLER, PEDIDOS)
         ===================================================================== */}
      {activeTab === 'operations' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 1. Ingreso de Compra / Stock (Solo Admin) */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-emerald-600" />
                <span>Ingreso Manual de Compra</span>
              </h3>
              <button
                type="button"
                onClick={() => setActiveTab('pdf_importer')}
                className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
              >
                <FileText className="w-3 h-3" />
                <span>Usar Factura PDF</span>
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Insumo a Ingresar
                </label>
                <select
                  value={entryItemId}
                  disabled={!canEditStockDirectly}
                  onChange={(e) => {
                    setEntryItemId(e.target.value);
                    const found = inventory.find((i) => i.id === e.target.value);
                    if (found) setEntryCost(found.unitCost);
                  }}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-white disabled:opacity-50"
                >
                  {inventory.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} ({i.currentStock} {i.unit})
                    </option>
                  ))}
                </select>
              </div>
              {/* MEJORA 4: Calculadora Rápida de Conversión para Facturas de Compra (Rollos a m² / Cajas a Unidades) */}
              <div className="p-3 rounded-lg bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/80 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold text-blue-900 dark:text-blue-200">
                    🧮 Calculadora Rápida de Conversión a Kardex
                  </span>
                  <div className="inline-flex rounded bg-white dark:bg-slate-900 p-0.5 border border-blue-200 dark:border-blue-800 text-[10px]">
                    <button
                      type="button"
                      onClick={() => setConvMode('rolls_m2')}
                      className={`px-2 py-0.5 rounded font-semibold ${
                        convMode === 'rolls_m2'
                          ? 'bg-blue-600 text-white'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      Rollos → m²
                    </button>
                    <button
                      type="button"
                      onClick={() => setConvMode('boxes_units')}
                      className={`px-2 py-0.5 rounded font-semibold ${
                        convMode === 'boxes_units'
                          ? 'bg-blue-600 text-white'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      Cajas → Unidades
                    </button>
                  </div>
                </div>

                {convMode === 'rolls_m2' ? (
                  <div className="grid grid-cols-4 gap-1.5 text-[11px]">
                    <div>
                      <label className="block text-[10px] text-slate-500">N° Rollos</label>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={convCount}
                        onChange={(e) => setConvCount(Math.max(1, Number(e.target.value)))}
                        className="w-full px-2 py-1 font-mono bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-500">Ancho (m)</label>
                      <input
                        type="number"
                        min="0.1"
                        step="0.05"
                        value={convRollWidth}
                        onChange={(e) => setConvRollWidth(Math.max(0.1, Number(e.target.value)))}
                        className="w-full px-2 py-1 font-mono bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-500">Largo (m)</label>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={convRollLength}
                        onChange={(e) => setConvRollLength(Math.max(1, Number(e.target.value)))}
                        className="w-full px-2 py-1 font-mono bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-500">$/Rollo</label>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={convPackagePrice}
                        onChange={(e) => setConvPackagePrice(Math.max(0, Number(e.target.value)))}
                        className="w-full px-2 py-1 font-mono bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-1.5 text-[11px]">
                    <div>
                      <label className="block text-[10px] text-slate-500">N° Cajas/Paq.</label>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={convCount}
                        onChange={(e) => setConvCount(Math.max(1, Number(e.target.value)))}
                        className="w-full px-2 py-1 font-mono bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-500">Unid. × Caja</label>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={convUnitsPerBox}
                        onChange={(e) => setConvUnitsPerBox(Math.max(1, Number(e.target.value)))}
                        className="w-full px-2 py-1 font-mono bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-500">$/Caja</label>
                      <input
                        type="number"
                        min="1"
                        step="0.5"
                        value={convPackagePrice}
                        onChange={(e) => setConvPackagePrice(Math.max(0, Number(e.target.value)))}
                        className="w-full px-2 py-1 font-mono bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded"
                      />
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between pt-1 border-t border-blue-200/70 dark:border-blue-800/60 text-[11px]">
                  <span className="font-mono font-bold text-blue-950 dark:text-blue-200">
                    = +{calculatedConversion.totalWarehouseQty} {calculatedConversion.unitLabel} ($
                    {calculatedConversion.unitWarehouseCost.toFixed(2)} c/u)
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setEntryQty(calculatedConversion.totalWarehouseQty);
                      if (calculatedConversion.unitWarehouseCost > 0) {
                        setEntryCost(calculatedConversion.unitWarehouseCost);
                      }
                    }}
                    className="px-2 py-1 text-[10px] font-bold bg-blue-600 hover:bg-blue-700 text-white rounded"
                  >
                    Aplicar al Ingreso ↓
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Cantidad Entrada
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="0.5"
                    disabled={!canEditStockDirectly}
                    value={entryQty}
                    onChange={(e) => setEntryQty(Math.max(0.1, Number(e.target.value)))}
                    className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-white disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Costo Unitario ($)
                  </label>
                  <input
                    type="number"
                    min="0.1"
                    step="0.05"
                    disabled={!canEditStockDirectly}
                    value={entryCost}
                    onChange={(e) => setEntryCost(Math.max(0.01, Number(e.target.value)))}
                    className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-white disabled:opacity-50"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Factura / Referencia Proveedor
                </label>
                <input
                  type="text"
                  disabled={!canEditStockDirectly}
                  value={entryInvoice}
                  onChange={(e) => setEntryInvoice(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-white disabled:opacity-50"
                />
              </div>
              <button
                type="button"
                disabled={!canEditStockDirectly}
                onClick={() => {
                  onAddStockEntry(entryItemId, entryQty, entryCost, entryInvoice);
                  setActiveTab('catalog');
                }}
                className="w-full py-2 px-4 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 rounded transition-colors"
              >
                Registrar Entrada Manual
              </button>
            </div>
          </div>

          {/* 2. Reporte de Desperdicio / Merma Real de Taller */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-4">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Scissors className="w-4 h-4 text-red-600" />
              <span>Reporte de Desperdicio / Merma Real</span>
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Insumo Afectado
                </label>
                <select
                  value={wasteItemId}
                  disabled={!canReportWasteOrRequest}
                  onChange={(e) => setWasteItemId(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-white disabled:opacity-50"
                >
                  {inventory.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Cant. Merma
                  </label>
                  <input
                    type="number"
                    min="0.1"
                    step="0.1"
                    disabled={!canReportWasteOrRequest}
                    value={wasteQty}
                    onChange={(e) => setWasteQty(Math.max(0.1, Number(e.target.value)))}
                    className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-white disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Orden Asociada
                  </label>
                  <select
                    value={wasteOrderId}
                    disabled={!canReportWasteOrRequest}
                    onChange={(e) => setWasteOrderId(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-white disabled:opacity-50"
                  >
                    {orders.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.id}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Causa Técnica de la Merma
                </label>
                <input
                  type="text"
                  disabled={!canReportWasteOrRequest}
                  value={wasteReason}
                  onChange={(e) => setWasteReason(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-white disabled:opacity-50"
                />
              </div>
              <button
                type="button"
                disabled={!canReportWasteOrRequest}
                onClick={() => {
                  onReportWaste(wasteItemId, wasteQty, wasteOrderId, wasteReason);
                  setActiveTab('kardex');
                }}
                className="w-full py-2 px-4 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-40 rounded transition-colors"
              >
                Descontar Merma de Inventario
              </button>
            </div>
          </div>

          {/* 3. Solicitud de Reposición de Insumos (Operador -> Admin) */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-4">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Send className="w-4 h-4 text-blue-600" />
              <span>Solicitud de Reposición de Insumos</span>
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Material Requerido en Taller
                </label>
                <select
                  value={reqItemId}
                  onChange={(e) => setReqItemId(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-white"
                >
                  {inventory.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} (Disp: {i.currentStock} {i.unit})
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Cantidad a Pedir
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={reqQty}
                    onChange={(e) => setReqQty(Math.max(1, Number(e.target.value)))}
                    className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Nivel de Urgencia
                  </label>
                  <select
                    value={reqUrgency}
                    onChange={(e) =>
                      setReqUrgency(e.target.value as 'Normal' | 'Alta' | 'Crítica')
                    }
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-white"
                  >
                    <option value="Normal">Normal</option>
                    <option value="Alta">Alta</option>
                    <option value="Crítica">Crítica (Paro de Máquina)</option>
                  </select>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onCreateRestockRequest(reqItemId, reqQty, reqUrgency)}
                className="w-full py-2 px-4 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors"
              >
                Enviar Solicitud a Gerencia
              </button>

              {/* Lista rápida de solicitudes activas */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2 max-h-36 overflow-y-auto">
                {restockRequests.map((req) => (
                  <div
                    key={req.id}
                    className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-400"
                  >
                    <div className="truncate pr-2">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {req.requestedQty} {req.unit}
                      </span>{' '}
                      · {req.itemName} ({req.urgency})
                    </div>
                    {req.status === 'Pendiente' && currentRole === 'admin' ? (
                      <button
                        type="button"
                        onClick={() => onApproveRestockRequest(req.id)}
                        className="text-blue-600 hover:underline font-medium shrink-0"
                      >
                        Aprobar e Ingresar
                      </button>
                    ) : (
                      <span className="font-mono shrink-0">{req.status}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          VISTA D: KARDEX / HISTORIAL DE MOVIMIENTOS
         ===================================================================== */}
      {activeTab === 'kardex' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Package className="w-4 h-4 text-blue-600" />
              <span>Kardex / Historial de Entradas (Manuales y por PDF), Salidas por Orden y Mermas</span>
            </h3>
            <button
              type="button"
              onClick={() => setActiveTab('catalog')}
              className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
            >
              ← Volver a Stock Bodega
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400">
                <tr>
                  <th className="py-2.5 px-4">Fecha</th>
                  <th className="py-2.5 px-4">Tipo de Movimiento</th>
                  <th className="py-2.5 px-4">Insumo</th>
                  <th className="py-2.5 px-4 text-right">Cantidad</th>
                  <th className="py-2.5 px-4">Orden / Factura PDF / Motivo</th>
                  {canSeeCosts && <th className="py-2.5 px-4 text-right">Impacto Costo</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {movements.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    <td className="py-2.5 px-4 font-mono text-slate-500 whitespace-nowrap">
                      {m.date}
                    </td>
                    <td className="py-2.5 px-4 whitespace-nowrap">
                      {m.type === 'entrada' && (
                        <span className="text-emerald-700 dark:text-emerald-400 font-medium inline-flex items-center gap-1">
                          <ArrowDownLeft className="w-3.5 h-3.5" /> Entrada Compra
                        </span>
                      )}
                      {m.type === 'salida_orden' && (
                        <span className="text-blue-600 dark:text-blue-400 font-medium inline-flex items-center gap-1">
                          <ArrowUpRight className="w-3.5 h-3.5" /> Salida Automática ({m.orderId})
                        </span>
                      )}
                      {m.type === 'merma_taller' && (
                        <span className="text-red-600 dark:text-red-400 font-medium inline-flex items-center gap-1">
                          <Scissors className="w-3.5 h-3.5" /> Merma / Desperdicio ({m.orderId || 'Taller'})
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 font-medium text-slate-900 dark:text-white">
                      {m.itemName}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono font-semibold text-slate-900 dark:text-white">
                      {m.type === 'entrada' ? '+' : '-'}
                      {m.quantity} {m.unit}
                    </td>
                    <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400">{m.reason}</td>
                    {canSeeCosts && (
                      <td className="py-2.5 px-4 text-right font-mono text-slate-800 dark:text-slate-200">
                        ${m.costImpact.toFixed(2)}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL VISOR DE FACTURA COMPLETA (DOCUMENTO FISCAL + PDF ORIGINAL + LADO A LADO)
         ===================================================================== */}
      {fullInvoiceModalTarget && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto"
          onClick={() => setFullInvoiceModalTarget(null)}
        >
          <div
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-6xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Cabecera del Modal con Pestañas de Visualización */}
            <div className="px-4 sm:px-6 py-3.5 sm:py-4 bg-slate-900 text-white flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 sm:p-2.5 rounded-xl bg-blue-600 text-white shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm sm:text-base font-bold truncate">
                      Factura Completa de Proveedor: {fullInvoiceModalTarget.invoiceNumber}
                    </h3>
                    <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-mono shrink-0">
                      ${fullInvoiceModalTarget.totalAmount.toFixed(2)} c/IVA
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 font-mono truncate">
                    {fullInvoiceModalTarget.supplierName} · RUC: {fullInvoiceModalTarget.supplierRuc} · Archivo: {fullInvoiceModalTarget.fileName}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Selector de 3 modos de vista */}
                <div className="inline-flex p-1 bg-slate-800 rounded-xl border border-slate-700 gap-1 overflow-x-auto max-w-full">
                  <button
                    type="button"
                    onClick={() => setInvoiceViewerTab('formatted_invoice')}
                    className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                      invoiceViewerTab === 'formatted_invoice'
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    📄 1. Factura + Conversión
                  </button>
                  <button
                    type="button"
                    onClick={() => setInvoiceViewerTab('original_pdf')}
                    className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                      invoiceViewerTab === 'original_pdf'
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    🔍 2. PDF / Imagen Original
                  </button>
                  <button
                    type="button"
                    onClick={() => setInvoiceViewerTab('side_by_side')}
                    className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                      invoiceViewerTab === 'side_by_side'
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    ⚖️ 3. Lado a Lado
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => downloadSamplePdfInvoice(fullInvoiceModalTarget)}
                  className="px-3 py-2 text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white rounded-xl border border-slate-700 inline-flex items-center gap-1.5"
                >
                  <Download className="w-4 h-4" />
                  <span>Descargar .PDF</span>
                </button>

                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl inline-flex items-center gap-1.5"
                >
                  <Printer className="w-4 h-4" />
                  <span>Imprimir</span>
                </button>

                <button
                  type="button"
                  onClick={() => setFullInvoiceModalTarget(null)}
                  className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl"
                  title="Cerrar visor"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Cuerpo del Modal */}
            <div className="p-6 overflow-y-auto flex-1 bg-slate-100 dark:bg-slate-950">
              {/* MODO 1: DOCUMENTO DE FACTURA FISCAL COMPLETA + TABLA DE CONVERSIÓN A BODEGA */}
              {invoiceViewerTab === 'formatted_invoice' && (
                <div className="max-w-4xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
                  {/* Encabezado Fiscal del Proveedor y Número de Factura */}
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b-2 border-slate-900 dark:border-slate-700 pb-5">
                    <div className="space-y-1">
                      <span className="inline-block px-2.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-xs font-mono font-bold uppercase">
                        Comprobante Electrónico de Compra · {fullInvoiceModalTarget.extractionSource === 'gemini-ai' ? 'Interpretado por IA Multimodal' : 'Interpretado por Motor OCR PDF'}
                      </span>
                      <h2 className="text-xl font-black text-slate-900 dark:text-white">
                        {fullInvoiceModalTarget.supplierName}
                      </h2>
                      <p className="text-xs font-mono text-slate-600 dark:text-slate-400">
                        RUC / NIT Emisor: <strong>{fullInvoiceModalTarget.supplierRuc}</strong>
                      </p>
                      <p className="text-xs text-slate-500">
                        Archivo cargado: <span className="font-mono">{fullInvoiceModalTarget.fileName}</span>
                      </p>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-right font-mono space-y-1">
                      <div className="text-xs uppercase font-bold text-slate-500">
                        FACTURA COMERCIAL N°
                      </div>
                      <div className="text-base font-black text-blue-600 dark:text-blue-400">
                        {fullInvoiceModalTarget.invoiceNumber}
                      </div>
                      <div className="text-xs text-slate-600 dark:text-slate-400">
                        Fecha Emisión: <strong>{fullInvoiceModalTarget.issueDate}</strong>
                      </div>
                      {fullInvoiceModalTarget.processedAt && (
                        <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">
                          ✓ Ingresada al Kardex: {fullInvoiceModalTarget.processedAt}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Datos del Adquirente y Condición de Pago */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs">
                    <div className="space-y-1">
                      <div className="text-slate-400 font-mono uppercase text-[11px]">
                        Datos del Comprador / Bodega Destino
                      </div>
                      <div className="font-bold text-slate-900 dark:text-white">
                        TALLER CREA ARTE ERP S.A.S. — BODEGA CENTRAL
                      </div>
                      <div className="text-slate-600 dark:text-slate-400 font-mono">
                        RUC: 1792998811001 · Recepción de Insumos Gráficos
                      </div>
                    </div>
                    <div className="space-y-1 sm:text-right">
                      <div className="text-slate-400 font-mono uppercase text-[11px]">
                        Información de Pago y Conciliación Bancaria
                      </div>
                      <div className="font-bold text-slate-900 dark:text-white">
                        {fullInvoiceModalTarget.paymentMethod}
                      </div>
                      <div className="text-slate-600 dark:text-slate-400 font-mono">
                        {fullInvoiceModalTarget.bankEntity} · Ref: {fullInvoiceModalTarget.referenceNumber}
                      </div>
                    </div>
                  </div>

                  {/* SECCIÓN A: Detalle Original según el PDF del Proveedor */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                      A. Detalle de Ítems Facturados por el Proveedor (Tal como consta en el PDF)
                    </h4>
                    <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                          <tr>
                            <th className="py-2.5 px-3">#</th>
                            <th className="py-2.5 px-3 text-right">Cant. Compra</th>
                            <th className="py-2.5 px-3">Presentación / Unidad PDF</th>
                            <th className="py-2.5 px-3">Descripción Original en Factura PDF</th>
                            <th className="py-2.5 px-3 text-right">Precio Unit.</th>
                            <th className="py-2.5 px-3 text-right">Subtotal</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                          {fullInvoiceModalTarget.items.map((item, idx) => (
                            <tr key={item.id}>
                              <td className="py-2.5 px-3 font-mono text-slate-400">{idx + 1}</td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                                {item.purchaseQty}
                              </td>
                              <td className="py-2.5 px-3 font-mono text-slate-600 dark:text-slate-300">
                                {item.purchaseUnit}
                              </td>
                              <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-white">
                                {item.rawDescription}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono text-slate-700 dark:text-slate-300">
                                ${item.purchaseUnitPrice.toFixed(2)}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                                ${item.lineSubtotal.toFixed(2)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* SECCIÓN B: Interpretación y Conversión Automática a Unidades de Taller */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                      B. Interpretación y Transformación de Unidades para Kardex de Bodega
                    </h4>
                    <div className="overflow-x-auto border border-emerald-200 dark:border-emerald-900/60 rounded-xl bg-emerald-50/30 dark:bg-emerald-950/15">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-emerald-100/70 dark:bg-emerald-950/50 text-emerald-900 dark:text-emerald-300 border-b border-emerald-200 dark:border-emerald-900/60">
                          <tr>
                            <th className="py-2.5 px-3">SKU Destino</th>
                            <th className="py-2.5 px-3">Insumo Vinculado en Bodega</th>
                            <th className="py-2.5 px-3 text-center">Fórmula de Conversión</th>
                            <th className="py-2.5 px-3 text-right">Stock Real a Sumar</th>
                            <th className="py-2.5 px-3 text-right">Nuevo Costo Real / Unidad</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-emerald-200/60 dark:divide-emerald-900/40">
                          {fullInvoiceModalTarget.items.map((item) => (
                            <tr key={`conv-${item.id}`}>
                              <td className="py-2.5 px-3 font-mono font-bold text-slate-800 dark:text-slate-200">
                                {item.suggestedSku}
                              </td>
                              <td className="py-2.5 px-3 font-medium text-slate-900 dark:text-white">
                                {item.suggestedName}
                              </td>
                              <td className="py-2.5 px-3 text-center font-mono text-slate-600 dark:text-slate-400">
                                {item.purchaseQty} ({item.purchaseUnit}) × {item.conversionFactor}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700 dark:text-emerald-400">
                                +{item.warehouseQty} {item.warehouseUnit}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-900 dark:text-white">
                                ${item.warehouseUnitCost.toFixed(2)} / {item.warehouseUnit}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Totales de la Factura */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 pt-4 border-t border-slate-200 dark:border-slate-800">
                    <div className="text-xs text-slate-500 space-y-1">
                      <div>
                        <strong>Total Ítems Interpretados:</strong> {fullInvoiceModalTarget.items.length} líneas de material
                      </div>
                      <div>
                        <strong>Estado de Verificación:</strong> Documento cuadrado con conversión a inventario de taller
                      </div>
                    </div>

                    <div className="w-full sm:w-72 space-y-1.5 font-mono text-xs bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                      <div className="flex justify-between text-slate-600 dark:text-slate-400">
                        <span>Subtotal Imponible:</span>
                        <span>${fullInvoiceModalTarget.subtotal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-slate-600 dark:text-slate-400">
                        <span>IVA (15%):</span>
                        <span>${fullInvoiceModalTarget.taxAmount.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm font-black text-slate-900 dark:text-white pt-2 border-t border-slate-200 dark:border-slate-800">
                        <span>TOTAL FACTURA:</span>
                        <span className="text-emerald-600 dark:text-emerald-400">
                          ${fullInvoiceModalTarget.totalAmount.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* MODO 2: VISOR DEL ARCHIVO PDF / IMAGEN ORIGINAL + TEXTO EXTRAÍDO */}
              {invoiceViewerTab === 'original_pdf' && (
                <div className="space-y-4 max-w-5xl mx-auto">
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                    <div className="px-4 py-3 bg-slate-800 text-white flex items-center justify-between text-xs font-bold">
                      <span>📄 Visor Integrado del Archivo Original ({fullInvoiceModalTarget.fileName})</span>
                      <button
                        type="button"
                        onClick={() => downloadSamplePdfInvoice(fullInvoiceModalTarget)}
                        className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white inline-flex items-center gap-1"
                      >
                        <Download className="w-3.5 h-3.5" /> Descargar Copia .PDF
                      </button>
                    </div>
                    <div className="h-[540px] bg-slate-900">
                      {fullInvoiceModalTarget.uploadedFileMimeType?.startsWith('image/') &&
                      fullInvoiceModalTarget.uploadedFileDataUrl ? (
                        <div className="w-full h-full flex items-center justify-center p-4 overflow-auto">
                          <img
                            src={fullInvoiceModalTarget.uploadedFileDataUrl}
                            alt={fullInvoiceModalTarget.fileName}
                            className="max-w-full max-h-full object-contain rounded shadow"
                          />
                        </div>
                      ) : (
                        <iframe
                          title={`FullPDF-${fullInvoiceModalTarget.invoiceNumber}`}
                          src={getInvoicePreviewUrl(fullInvoiceModalTarget)}
                          className="w-full h-full border-0 bg-white"
                        />
                      )}
                    </div>
                  </div>

                  {fullInvoiceModalTarget.rawExtractedText && (
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-2">
                      <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        Texto Crudo Extraído del Archivo PDF:
                      </div>
                      <pre className="p-3 rounded-lg bg-slate-950 text-emerald-400 font-mono text-xs overflow-x-auto max-h-48 whitespace-pre-wrap">
                        {fullInvoiceModalTarget.rawExtractedText}
                      </pre>
                    </div>
                  )}
                </div>
              )}

              {/* MODO 3: COMPARADOR LADO A LADO (PDF ORIGINAL VS FACTURA INTERPRETADA) */}
              {invoiceViewerTab === 'side_by_side' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden flex flex-col">
                    <div className="px-4 py-2.5 bg-slate-800 text-white text-xs font-bold flex items-center justify-between">
                      <span>📄 Documento PDF / Imagen Cargado</span>
                      <span className="font-mono text-[11px] text-slate-300">
                        {fullInvoiceModalTarget.fileName}
                      </span>
                    </div>
                    <div className="h-[560px] bg-slate-900">
                      {fullInvoiceModalTarget.uploadedFileMimeType?.startsWith('image/') &&
                      fullInvoiceModalTarget.uploadedFileDataUrl ? (
                        <div className="w-full h-full flex items-center justify-center p-4 overflow-auto">
                          <img
                            src={fullInvoiceModalTarget.uploadedFileDataUrl}
                            alt={fullInvoiceModalTarget.fileName}
                            className="max-w-full max-h-full object-contain rounded shadow"
                          />
                        </div>
                      ) : (
                        <iframe
                          title={`SidePDF-${fullInvoiceModalTarget.invoiceNumber}`}
                          src={getInvoicePreviewUrl(fullInvoiceModalTarget)}
                          className="w-full h-full border-0 bg-white"
                        />
                      )}
                    </div>
                  </div>

                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4 overflow-y-auto max-h-[600px]">
                    <div className="border-b border-slate-200 dark:border-slate-800 pb-3 flex items-start justify-between">
                      <div>
                        <span className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400">
                          DATOS INTERPRETADOS Y CONVERTIDOS A BODEGA
                        </span>
                        <h4 className="text-base font-bold text-slate-900 dark:text-white">
                          {fullInvoiceModalTarget.supplierName}
                        </h4>
                        <p className="text-xs font-mono text-slate-500">
                          RUC: {fullInvoiceModalTarget.supplierRuc} · N° {fullInvoiceModalTarget.invoiceNumber}
                        </p>
                      </div>
                      <div className="text-right font-mono">
                        <div className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                          ${fullInvoiceModalTarget.totalAmount.toFixed(2)}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Emisión: {fullInvoiceModalTarget.issueDate}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2.5">
                      {fullInvoiceModalTarget.items.map((it, idx) => (
                        <div
                          key={`side-${it.id}`}
                          className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1 text-xs"
                        >
                          <div className="flex items-center justify-between font-bold text-slate-900 dark:text-white">
                            <span>
                              {idx + 1}. {it.rawDescription}
                            </span>
                            <span className="font-mono">${it.lineSubtotal.toFixed(2)}</span>
                          </div>
                          <div className="text-slate-500 font-mono text-[11px]">
                            En Factura PDF: {it.purchaseQty} × {it.purchaseUnit} a ${it.purchaseUnitPrice.toFixed(2)} c/u
                          </div>
                          <div className="text-emerald-700 dark:text-emerald-400 font-mono font-bold text-[11px]">
                            → Conversión Bodega (×{it.conversionFactor}): +{it.warehouseQty} {it.warehouseUnit} [{it.suggestedSku}] a ${it.warehouseUnitCost.toFixed(2)}/{it.warehouseUnit}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-100 dark:bg-slate-950 font-mono text-xs space-y-1">
                      <div className="flex justify-between">
                        <span>Subtotal:</span>
                        <span>${fullInvoiceModalTarget.subtotal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>IVA (15%):</span>
                        <span>${fullInvoiceModalTarget.taxAmount.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between font-bold text-slate-900 dark:text-white pt-1 border-t border-slate-300 dark:border-slate-800">
                        <span>Total c/IVA:</span>
                        <span>${fullInvoiceModalTarget.totalAmount.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Pie del Modal */}
            <div className="px-6 py-3.5 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="text-xs text-slate-500">
                Puedes cargar esta factura en la mesa de edición si deseas ajustar cantidades o factores de conversión.
              </div>
              <div className="flex items-center gap-2">
                {parsedInvoice?.id !== fullInvoiceModalTarget.id && (
                  <button
                    type="button"
                    onClick={() => {
                      setParsedInvoice({
                        ...fullInvoiceModalTarget,
                        items: fullInvoiceModalTarget.items.map((i) => ({ ...i, selected: true })),
                      });
                      setFullInvoiceModalTarget(null);
                    }}
                    className="px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl"
                  >
                    Cargar en Mesa de Revisión
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setFullInvoiceModalTarget(null)}
                  className="px-4 py-2 text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 rounded-xl"
                >
                  Cerrar Visor
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
