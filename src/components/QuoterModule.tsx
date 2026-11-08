import React, { useState, useMemo, useEffect } from 'react';
import {
  Copy,
  Check,
  ArrowRight,
  EyeOff,
  FileCheck2,
  Sparkles,
  Plus,
  Wrench,
  Lightbulb,
  X,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  Users,
  Zap,
  Calculator,
  TableProperties,
  Trash2,
  FileDown,
  MessageSquare,
  FileText,
  Share2,
  Eye,
  Save,
  RotateCcw,
  Ruler,
  Layers,
  Search,
  Send,
  CheckCircle2,
  Clock,
  FolderKanban,
} from 'lucide-react';
import {
  CATALOG_MATERIALS,
  CatalogMaterial,
  ServiceCategory,
  RoleId,
  WorkOrder,
  UserProfile,
  PaymentAuditDetails,
  BANK_ACCOUNTS_CATALOG,
  ProjectAssignment,
  ProjectTaskRole,
  ClientContact,
  QuoterTransferPayload,
} from '../data/initialData';
import {
  QuoteLineItem,
  QuoteProformaData,
  ProformaTemplateConfig,
  getProformaTemplateConfig,
  generateQuotePdf,
  formatQuoteWhatsAppText,
} from '../utils/quotePdfGenerator';
import { ProformaTemplateEditorModal } from './ProformaTemplateEditorModal';
import { calculateMetallicStructureResources } from '../domain/erpCalculations';
import { copyTextToClipboardSafe } from '../utils/deliveryActPdfGenerator';

export interface SentQuoteRecord {
  id: string;
  quoteNumber: string;
  orderId: string;
  sentAt: string;
  channel: 'whatsapp_pdf' | 'pdf_only' | 'orden_directa';
  pdfFileName: string;
  proformaData: QuoteProformaData;
  draftOrder: WorkOrder;
  liveOrder?: WorkOrder;
}

interface QuoterModuleProps {
  currentRole: RoleId;
  currentUser: UserProfile;
  users: UserProfile[];
  orders?: WorkOrder[];
  clients?: ClientContact[];
  preselectedClient?: ClientContact | null;
  optimizerPayload?: QuoterTransferPayload | null;
  onConsumeOptimizerPayload?: () => void;
  nextOrderCode: string;
  onConvertOrder: (
    newOrder: WorkOrder,
    initialAdvance: number,
    paymentMethod: 'Efectivo' | 'Transferencia Bancaria' | 'Tarjeta',
    auditDetails?: PaymentAuditDetails
  ) => void;
  onSendQuoteToWhatsApp?: (
    newOrder: WorkOrder,
    proformaText: string,
    pdfFileName: string
  ) => void;
  onOpenWhatsAppChat?: (orderId: string) => void;
  onOpenKanban?: () => void;
  onRegisterOrderPayment?: (
    orderId: string,
    amount: number,
    method: 'Efectivo' | 'Transferencia Bancaria' | 'Tarjeta',
    auditDetails?: PaymentAuditDetails
  ) => void;
  onNotify: (msg: string) => void;
}

export interface ExpressAddonVariable {
  id: string;
  label: string;
  calcType: 'per_m2' | 'per_unit';
  defaultRate: number;
  rate: number;
}

const DEFAULT_EXPRESS_VARIABLES: ExpressAddonVariable[] = [
  {
    id: 'var-ojalillos',
    label: 'Ojalillos Metálicos / Tensado',
    calcType: 'per_m2',
    defaultRate: 1.5,
    rate: 1.5,
  },
  {
    id: 'var-bolsillos',
    label: 'Bolsillos Termosellados',
    calcType: 'per_m2',
    defaultRate: 1.2,
    rate: 1.2,
  },
  {
    id: 'var-laminado-uv',
    label: 'Laminado Protector UV (Brillo/Mate)',
    calcType: 'per_m2',
    defaultRate: 3.5,
    rate: 3.5,
  },
  {
    id: 'var-troquelado',
    label: 'Troquelado Óptico / Corte Contorno',
    calcType: 'per_m2',
    defaultRate: 3.0,
    rate: 3.0,
  },
  {
    id: 'var-estructura-tubo',
    label: 'Bastidor Metálico Tubo Galv. 1"',
    calcType: 'per_m2',
    defaultRate: 22.0,
    rate: 22.0,
  },
  {
    id: 'var-led-fuente',
    label: 'Iluminación LED IP68 + Fuente 12V',
    calcType: 'per_m2',
    defaultRate: 28.0,
    rate: 28.0,
  },
  {
    id: 'var-distanciadores',
    label: 'Distanciadores Acero Inox (Set x4)',
    calcType: 'per_unit',
    defaultRate: 12.0,
    rate: 12.0,
  },
  {
    id: 'var-cinta-3m',
    label: 'Cinta Industrial Doble Faz 3M VHB',
    calcType: 'per_m2',
    defaultRate: 2.8,
    rate: 2.8,
  },
];

const FINISHING_OPTIONS: Record<
  ServiceCategory,
  { label: string; costPerM2OrUnit: number; isFixed?: boolean }[]
> = {
  'Gran Formato / Gigantografía': [
    { label: 'Bastidor tubo galv. 1"', costPerM2OrUnit: 22.0 },
    { label: 'Caja de luz tol + aluminio', costPerM2OrUnit: 35.0 },
    { label: 'Iluminación LED IP68 + Fuente', costPerM2OrUnit: 28.0 },
    { label: 'Ojalillos c/50cm / Tensado', costPerM2OrUnit: 1.5 },
    { label: 'Bolsillos termosellados', costPerM2OrUnit: 1.1 },
    { label: 'Tubos tensores', costPerM2OrUnit: 18.0, isFixed: true },
  ],
  Viniles: [
    { label: 'Laminado UV Brillante', costPerM2OrUnit: 3.5 },
    { label: 'Laminado UV Mate', costPerM2OrUnit: 3.8 },
    { label: 'Troquelado óptico', costPerM2OrUnit: 2.5 },
    { label: 'Desmontaje previo', costPerM2OrUnit: 20.0, isFixed: true },
  ],
  'Rótulos 3D y Estructurados': [
    { label: 'Módulos LED Samsung + Fuente 12V', costPerM2OrUnit: 45.0 },
    { label: 'Estructura tubo galv. anticorrosivo', costPerM2OrUnit: 28.0 },
    { label: 'Acrílico frontal 3mm/5mm láser', costPerM2OrUnit: 22.0 },
    { label: 'Temporizador encendido auto.', costPerM2OrUnit: 25.0, isFixed: true },
  ],
  'Corte y Grabado Láser / CNC': [
    { label: 'Pulido de cantos al fuego (Acrílico)', costPerM2OrUnit: 8.0, isFixed: true },
    { label: 'Cinta doble faz 3M VHB aplicada', costPerM2OrUnit: 6.5, isFixed: true },
    { label: 'Pintura acrílica / Relleno de grabado', costPerM2OrUnit: 12.0, isFixed: true },
    { label: 'Vectorización de corte para máquina', costPerM2OrUnit: 10.0, isFixed: true },
  ],
  'Sublimación y Merchandising': [
    { label: 'Empaque individual caja regalo', costPerM2OrUnit: 0.65, isFixed: true },
    { label: 'Personalización con nombres individuales', costPerM2OrUnit: 0.5, isFixed: true },
    { label: 'Estampado DTF adicional en espalda/manga', costPerM2OrUnit: 2.25, isFixed: true },
  ],
  'Señalética y Merchandising': [
    { label: 'Laminado UV Antigrafiti', costPerM2OrUnit: 3.9 },
    { label: 'Cinta estructural 3M VHB', costPerM2OrUnit: 2.8 },
    { label: 'Vinil Reflectivo Ingeniería', costPerM2OrUnit: 8.5 },
    { label: 'Distanciadores acero inox (x4)', costPerM2OrUnit: 12.0, isFixed: true },
  ],
  'Diseño Gráfico y Branding': [
    { label: 'Manual de Marca Corporativo PDF', costPerM2OrUnit: 35.0, isFixed: true },
    {
      label: 'Pack Editables Vectoriales (AI / EPS / SVG / PDF)',
      costPerM2OrUnit: 15.0,
      isFixed: true,
    },
    { label: 'Mockups 3D Presentación', costPerM2OrUnit: 20.0, isFixed: true },
    { label: 'Kit Redes Sociales (Perfil + Plantillas)', costPerM2OrUnit: 25.0, isFixed: true },
  ],
};

export const QuoterModule: React.FC<QuoterModuleProps> = ({
  currentRole,
  currentUser,
  users,
  orders = [],
  clients = [],
  preselectedClient = null,
  optimizerPayload = null,
  onConsumeOptimizerPayload,
  nextOrderCode,
  onConvertOrder,
  onSendQuoteToWhatsApp,
  onOpenWhatsAppChat,
  onOpenKanban,
  onRegisterOrderPayment,
  onNotify,
}) => {
  const canSeeInternalCosts = currentRole === 'admin';

  // Modo del módulo: 'express' (Cotizador Rápido), 'technical' (Ingeniería Taller), 'pricelist' (Tarifario), 'history' (Cotizaciones Enviadas)
  const [quoterMode, setQuoterMode] = useState<
    'express' | 'technical' | 'pricelist' | 'history'
  >('express');

  // Historial persistente de cotizaciones emitidas / descargadas / enviadas
  const [sentQuotesHistory, setSentQuotesHistory] = useState<SentQuoteRecord[]>(() => {
    try {
      const saved = localStorage.getItem('crea_arte_sent_quotes_v1');
      if (!saved) return [];
      return JSON.parse(saved) as SentQuoteRecord[];
    } catch {
      return [];
    }
  });

  const [historySearch, setHistorySearch] = useState<string>('');
  const [historyFilter, setHistoryFilter] = useState<
    'all' | 'pending_advance' | 'approved' | 'pdf_only'
  >('all');
  const [historyViewMode, setHistoryViewMode] = useState<'stage_blocks' | 'compact_table'>(
    'stage_blocks'
  );
  const [activeStageBlockFilter, setActiveStageBlockFilter] = useState<
    'all' | 'stage_1_quote' | 'stage_2_design' | 'stage_3_workshop' | 'stage_4_delivery'
  >('all');
  const [expandedQuoteCardId, setExpandedQuoteCardId] = useState<string | null>(null);
  const [showExpressExtrasDrawer, setShowExpressExtrasDrawer] = useState<boolean>(false);
  const [showQuickTemplatesBar, setShowQuickTemplatesBar] = useState<boolean>(false);
  const [previewQuoteOverride, setPreviewQuoteOverride] = useState<QuoteProformaData | null>(
    null
  );

  const [customCatalog, setCustomCatalog] = useState<CatalogMaterial[]>(() => {
    try {
      const saved = localStorage.getItem('crea_arte_custom_catalog_v1');
      if (!saved) return CATALOG_MATERIALS;
      const parsed: CatalogMaterial[] = JSON.parse(saved);
      const missingDefaults = CATALOG_MATERIALS.filter(
        (def) => !parsed.some((p) => p.id === def.id)
      );
      return [...parsed, ...missingDefaults];
    } catch {
      return CATALOG_MATERIALS;
    }
  });

  // Variables adicionales con precios referenciales editables y persistentes
  const [expressVariablesCatalog, setExpressVariablesCatalog] = useState<ExpressAddonVariable[]>(
    () => {
      try {
        const saved = localStorage.getItem('crea_arte_express_vars_v1');
        if (!saved) return DEFAULT_EXPRESS_VARIABLES;
        const parsed: ExpressAddonVariable[] = JSON.parse(saved);
        const missing = DEFAULT_EXPRESS_VARIABLES.filter(
          (def) => !parsed.some((p) => p.id === def.id)
        );
        return [...parsed, ...missing];
      } catch {
        return DEFAULT_EXPRESS_VARIABLES;
      }
    }
  );

  // Escuchar actualizaciones desde el asistente Go-Live
  useEffect(() => {
    const syncCatalog = () => {
      try {
        const saved = localStorage.getItem('crea_arte_custom_catalog_v1');
        if (saved) {
          const parsed: CatalogMaterial[] = JSON.parse(saved);
          const missingDefaults = CATALOG_MATERIALS.filter(
            (def) => !parsed.some((p) => p.id === def.id)
          );
          setCustomCatalog([...parsed, ...missingDefaults]);
        }
      } catch {
        // ignore
      }
    };
    window.addEventListener('crea_arte_catalog_updated', syncCatalog);
    return () => window.removeEventListener('crea_arte_catalog_updated', syncCatalog);
  }, []);

  const [showNewProductModal, setShowNewProductModal] = useState<boolean>(false);
  const [showAdvancedParams, setShowAdvancedParams] = useState<boolean>(false);
  const [showAuditBankFields, setShowAuditBankFields] = useState<boolean>(false);
  const [showWhatsAppPreview, setShowWhatsAppPreview] = useState<boolean>(false);
  const [showProformaModal, setShowProformaModal] = useState<boolean>(false);
  const [showProformaTemplateEditor, setShowProformaTemplateEditor] = useState<boolean>(false);
  const [proformaTemplateConfig, setProformaTemplateConfig] = useState<ProformaTemplateConfig>(() =>
    getProformaTemplateConfig()
  );
  const [quoteValidDays, setQuoteValidDays] = useState<number>(
    () => getProformaTemplateConfig().defaultValidDays || 15
  );

  // Lista opcional de múltiples ítems en una misma cotización PDF (compartida en Express y Técnico)
  const [extraQuoteItems, setExtraQuoteItems] = useState<QuoteLineItem[]>([]);

  // =========================================================================
  // ESTADO PARA COTIZADOR RÁPIDO (MATERIALES REF + DIMENSIONES + VARIABLES)
  // =========================================================================
  const [expressClientName, setExpressClientName] = useState('');
  const [expressClientPhone, setExpressClientPhone] = useState('+593 99 ');
  const [expressClientRuc, setExpressClientRuc] = useState('9999999999');

  const [expressCategory, setExpressCategory] = useState<ServiceCategory>(
    'Gran Formato / Gigantografía'
  );
  const [expressMaterialId, setExpressMaterialId] = useState<string>('mat-lona-front');
  const [expressTitle, setExpressTitle] = useState(
    'Lona Frontlight 13oz Impresión Alta Resolución'
  );

  // Precio referencial unitario activo (se carga del material pero el vendedor puede modificarlo libremente)
  const [expressUnitPrice, setExpressUnitPrice] = useState<number>(8.5);

  // Dimensiones y Cantidad en Cotizador Rápido
  const [expressUnitMode, setExpressUnitMode] = useState<'m' | 'cm'>('m');
  const [expressWidth, setExpressWidth] = useState<number>(2.5);
  const [expressHeight, setExpressHeight] = useState<number>(1.2);
  const [expressQty, setExpressQty] = useState<number>(1);
  const [expressEnforceMin1M2, setExpressEnforceMin1M2] = useState<boolean>(true);

  // Modalidad 2: Corte y Grabado Láser / CNC (Por Tiempo en Minutos + Material)
  const [expressLaserMinutes, setExpressLaserMinutes] = useState<number>(25);
  const [expressLaserRatePerMin, setExpressLaserRatePerMin] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('crea_arte_laser_rate_v1');
      return saved ? Math.max(0.05, Number(JSON.parse(saved))) : 0.6;
    } catch {
      return 0.6;
    }
  });
  const [expressLaserMaterialCost, setExpressLaserMaterialCost] = useState<number>(12.0);
  const [expressLaserMaterialLabel, setExpressLaserMaterialLabel] = useState<string>(
    'Acrílico Cristal 3mm (Fracción de plancha)'
  );

  // Modalidad 3: Sublimación y Merchandising (Por Volumen/Escalas + Tallas y Colores)
  const [expressSizesAndColors, setExpressSizesAndColors] = useState<string>('');
  const [dozenDiscountPct, setDozenDiscountPct] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('crea_arte_sub_dozen_disc_v1');
      return saved ? Math.max(0, Number(JSON.parse(saved))) : 12;
    } catch {
      return 12;
    }
  });
  const [hundredDiscountPct, setHundredDiscountPct] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('crea_arte_sub_hundred_disc_v1');
      return saved ? Math.max(0, Number(JSON.parse(saved))) : 25;
    } catch {
      return 25;
    }
  });

  // Variables adicionales activas en el Cotizador Rápido
  const [expressSelectedVarIds, setExpressSelectedVarIds] = useState<string[]>(['var-ojalillos']);
  const [expressDesignFee, setExpressDesignFee] = useState<number>(0);
  const [expressInstallFee, setExpressInstallFee] = useState<number>(0);
  const [expressUrgencyPct, setExpressUrgencyPct] = useState<number>(0);
  const [expressDiscount, setExpressDiscount] = useState<number>(0);
  const [expressIncludeIva, setExpressIncludeIva] = useState<boolean>(true);

  // Permite al usuario sobreescribir o redondear el precio total final si desea un número cerrado
  const [expressManualTotalOverride, setExpressManualTotalOverride] = useState<number | null>(null);
  const [expressAdvance, setExpressAdvance] = useState<number>(0);
  const [expressDeadlineDays, setExpressDeadlineDays] = useState<number>(3);

  // Material seleccionado actualmente en el Cotizador Rápido
  const selectedExpressMaterial = useMemo(
    () =>
      customCatalog.find((m) => m.id === expressMaterialId) ||
      customCatalog.find((m) => m.category === expressCategory) ||
      customCatalog[0],
    [customCatalog, expressMaterialId, expressCategory]
  );

  // Seleccionar un material en el Cotizador Rápido y cargar su precio referencial
  const handleSelectExpressMaterial = (mat: CatalogMaterial, customTitle?: string) => {
    setExpressCategory(mat.category);
    setExpressMaterialId(mat.id);
    setExpressTitle(customTitle || mat.name);
    setExpressUnitPrice(mat.suggestedPricePerUnit);
    setExpressManualTotalOverride(null);

    if (mat.category === 'Corte y Grabado Láser / CNC' || mat.unit === 'minuto') {
      setExpressLaserRatePerMin(mat.defaultLaserRatePerMin || mat.suggestedPricePerUnit || 0.6);
      setExpressLaserMinutes(25);
      setExpressLaserMaterialCost(mat.id === 'mat-cnc-router' ? 22.0 : 12.0);
      setExpressLaserMaterialLabel(
        mat.id === 'mat-cnc-router'
          ? 'Plancha PVC Sintra / ACM (Fracción utilizada)'
          : 'Acrílico 3mm / MDF Corte Láser (Fracción utilizada)'
      );
      setExpressSelectedVarIds([]);
      return;
    }

    if (mat.category === 'Sublimación y Merchandising' || mat.pricingMode === 'volume_scale') {
      setExpressWidth(1);
      setExpressHeight(1);
      setExpressSelectedVarIds([]);
      if (!expressSizesAndColors) {
        setExpressSizesAndColors(
          mat.id.includes('camisetas')
            ? 'Tallas: 4 S, 6 M, 2 L — Color Blanco'
            : 'Color Blanco / Full Color Corporativo'
        );
      }
      return;
    }

    if (mat.category === 'Diseño Gráfico y Branding' || mat.unit === 'unidad') {
      if (mat.id === 'mat-rollup-display') {
        setExpressUnitMode('m');
        setExpressWidth(0.85);
        setExpressHeight(2.0);
        setExpressSelectedVarIds([]);
      } else {
        setExpressWidth(1);
        setExpressHeight(1);
        setExpressSelectedVarIds([]);
      }
      if (mat.category === 'Diseño Gráfico y Branding') {
        setExpressInstallFee(0);
        setExpressDesignFee(0);
        setTeamAssignments([
          {
            userId: 'usr-designer',
            taskRole: 'Diseño y Pre-prensa',
            status: 'active',
            assignedAt: '2026-10-16 19:43',
          },
        ]);
      }
    }
  };

  // Guardar el precio modificado en el Cotizador Rápido como nuevo precio referencial fijo en el Tarifario
  const handleSaveExpressPriceToCatalog = () => {
    if (!selectedExpressMaterial) return;
    handleInlinePriceUpdate(
      selectedExpressMaterial.id,
      'suggestedPricePerUnit',
      expressUnitPrice
    );
    onNotify(
      `Precio referencial de "${selectedExpressMaterial.name}" actualizado a $${expressUnitPrice.toFixed(
        2
      )}/${selectedExpressMaterial.unit}`
    );
  };

  // Actualizar el precio referencial de una variable adicional (Ojalillos, Laminado, Estructura, etc.)
  const handleUpdateExpressVariableRate = (varId: string, newRate: number) => {
    const cleanRate = Math.max(0, newRate);
    const updated = expressVariablesCatalog.map((v) =>
      v.id === varId ? { ...v, rate: cleanRate } : v
    );
    setExpressVariablesCatalog(updated);
    try {
      localStorage.setItem('crea_arte_express_vars_v1', JSON.stringify(updated));
    } catch {
      // ignore storage quota errors
    }
    setExpressManualTotalOverride(null);
  };

  const toggleExpressVariable = (varId: string) => {
    setExpressSelectedVarIds((prev) =>
      prev.includes(varId) ? prev.filter((id) => id !== varId) : [...prev, varId]
    );
    setExpressManualTotalOverride(null);
  };

  // Cálculo en tiempo real del Cotizador Rápido soportando las 3 Modalidades (Dimensión m², Tiempo Minutos Láser/CNC y Volumen/Escalas Sublimación)
  const expressCalc = useMemo(() => {
    const isLaserTimeMode =
      expressCategory === 'Corte y Grabado Láser / CNC' ||
      selectedExpressMaterial.unit === 'minuto' ||
      selectedExpressMaterial.pricingMode === 'time_minutes';

    const isVolumeScaleMode =
      expressCategory === 'Sublimación y Merchandising' ||
      selectedExpressMaterial.pricingMode === 'volume_scale';

    const isUnitBased =
      isVolumeScaleMode ||
      isLaserTimeMode ||
      selectedExpressMaterial.unit === 'unidad' ||
      selectedExpressMaterial.category === 'Diseño Gráfico y Branding';

    const widthM = expressUnitMode === 'cm' ? expressWidth / 100 : expressWidth;
    const heightM = expressUnitMode === 'cm' ? expressHeight / 100 : expressHeight;
    const qty = Math.max(1, expressQty);

    const rawUnitAreaM2 = Math.max(0.01, widthM * heightM);
    const billableUnitAreaM2 =
      !isUnitBased && expressEnforceMin1M2 ? Math.max(1.0, rawUnitAreaM2) : rawUnitAreaM2;

    const totalAreaM2 = isUnitBased
      ? qty
      : Number((billableUnitAreaM2 * qty).toFixed(2));
    const exactTotalAreaM2 = Number((rawUnitAreaM2 * qty).toFixed(2));

    // Escala de descuento automático por volumen para Sublimación y Merchandising
    const activeVolumeDiscountPct = isVolumeScaleMode
      ? qty >= 100
        ? hundredDiscountPct
        : qty >= 12
        ? dozenDiscountPct
        : 0
      : 0;

    const volumeScaleTierLabel = isVolumeScaleMode
      ? qty >= 100
        ? `Escala Ciento 100+ (-${hundredDiscountPct}%)`
        : qty >= 12
        ? `Escala Docena 12+ (-${dozenDiscountPct}%)`
        : 'Escala 1–11 unid. (Precio normal)'
      : '';

    const discountedUnitPrice = isVolumeScaleMode
      ? Number((expressUnitPrice * (1 - activeVolumeDiscountPct / 100)).toFixed(2))
      : expressUnitPrice;

    const volumeSavingsDollars = isVolumeScaleMode
      ? Number(((expressUnitPrice - discountedUnitPrice) * qty).toFixed(2))
      : 0;

    // Costo en modalidad Láser / CNC: (Minutos × Tarifa/min + Material) × Cantidad de lotes/piezas
    const laserTimeSubtotal = isLaserTimeMode
      ? Number((Math.max(1, expressLaserMinutes) * expressLaserRatePerMin * qty).toFixed(2))
      : 0;
    const laserMatTotal = isLaserTimeMode
      ? Number((Math.max(0, expressLaserMaterialCost) * qty).toFixed(2))
      : 0;

    // 1. Costo base del material según la modalidad activa
    const materialBaseSubtotal = isLaserTimeMode
      ? Number((laserTimeSubtotal + laserMatTotal).toFixed(2))
      : isVolumeScaleMode
      ? Number((discountedUnitPrice * qty).toFixed(2))
      : isUnitBased
      ? Number((expressUnitPrice * qty).toFixed(2))
      : Number((totalAreaM2 * expressUnitPrice).toFixed(2));

    // 2. Variables / Acabados seleccionados
    const activeVars = expressVariablesCatalog.filter((v) =>
      expressSelectedVarIds.includes(v.id)
    );
    let variablesSubtotal = 0;
    const variableBreakdown: { label: string; amount: number; detail: string }[] = [];

    activeVars.forEach((v) => {
      const amount =
        v.calcType === 'per_unit' || isUnitBased
          ? Number((v.rate * qty).toFixed(2))
          : Number((v.rate * totalAreaM2).toFixed(2));
      variablesSubtotal += amount;
      variableBreakdown.push({
        label: v.label,
        amount,
        detail:
          v.calcType === 'per_unit' || isUnitBased
            ? `${qty} unid × $${v.rate.toFixed(2)}`
            : `${totalAreaM2} m² × $${v.rate.toFixed(2)}/m²`,
      });
    });
    variablesSubtotal = Number(variablesSubtotal.toFixed(2));

    // 3. Subtotal del rubro actual (Material + Acabados + Diseño)
    const currentItemSubtotal = Number(
      (materialBaseSubtotal + variablesSubtotal + expressDesignFee).toFixed(2)
    );

    // 4. Recargo por urgencia si aplica
    const urgencySurcharge =
      expressUrgencyPct > 0
        ? Number(((currentItemSubtotal * expressUrgencyPct) / 100).toFixed(2))
        : 0;

    const currentItemWithUrgency = Number(
      (currentItemSubtotal + urgencySurcharge).toFixed(2)
    );

    // 5. Suma de otros ítems ya agregados a la proforma rápida
    const extraItemsSum = extraQuoteItems.reduce((acc, item) => acc + item.lineTotal, 0);

    // 6. Subtotal general antes de descuento + instalación
    const grossSubtotal = Number(
      (currentItemWithUrgency + extraItemsSum + expressInstallFee).toFixed(2)
    );
    const netSubtotal = Math.max(0, Number((grossSubtotal - expressDiscount).toFixed(2)));
    const ivaAmount = expressIncludeIva ? Number((netSubtotal * 0.15).toFixed(2)) : 0;
    const calculatedTotal = Number((netSubtotal + ivaAmount).toFixed(2));

    // Si el usuario ingresó un ajuste manual de cierre, lo respetamos
    const finalTotal =
      expressManualTotalOverride !== null && expressManualTotalOverride > 0
        ? Number(expressManualTotalOverride.toFixed(2))
        : calculatedTotal;

    const effectiveNetSubtotal = expressIncludeIva
      ? Number((finalTotal / 1.15).toFixed(2))
      : finalTotal;
    const effectiveIva = expressIncludeIva
      ? Number((finalTotal - effectiveNetSubtotal).toFixed(2))
      : 0;

    const dimensionsText = isLaserTimeMode
      ? `${expressLaserMinutes} min máquina ($${expressLaserRatePerMin.toFixed(2)}/min) + Sustrato ($${expressLaserMaterialCost.toFixed(2)})`
      : isVolumeScaleMode
      ? `${qty} unid. · ${volumeScaleTierLabel}${
          expressSizesAndColors.trim() ? ` · [${expressSizesAndColors.trim()}]` : ''
        }`
      : selectedExpressMaterial.category === 'Diseño Gráfico y Branding'
      ? `Servicio Digital`
      : selectedExpressMaterial.unit === 'unidad'
      ? `${widthM.toFixed(2)}m × ${heightM.toFixed(2)}m`
      : `${widthM.toFixed(2)}m × ${heightM.toFixed(2)}m (${totalAreaM2} m²)`;

    const finishingsList = [
      ...(isLaserTimeMode && expressLaserMaterialLabel.trim()
        ? [`Material: ${expressLaserMaterialLabel.trim()}`]
        : []),
      ...(isVolumeScaleMode && expressSizesAndColors.trim()
        ? [`Tallas/Colores: ${expressSizesAndColors.trim()}`]
        : []),
      ...(isVolumeScaleMode && activeVolumeDiscountPct > 0
        ? [`Descuento Volumen -${activeVolumeDiscountPct}% ($${discountedUnitPrice.toFixed(2)} c/u)`]
        : []),
      ...activeVars.map((v) => v.label),
      ...(expressDesignFee > 0 ? [`Diseño / Arte ($${expressDesignFee})`] : []),
      ...(expressUrgencyPct > 0 ? [`Entrega Express (+${expressUrgencyPct}%)`] : []),
    ];

    return {
      isUnitBased,
      isLaserTimeMode,
      isVolumeScaleMode,
      activeVolumeDiscountPct,
      volumeScaleTierLabel,
      discountedUnitPrice,
      volumeSavingsDollars,
      laserTimeSubtotal,
      laserMatTotal,
      widthM: Number(widthM.toFixed(2)),
      heightM: Number(heightM.toFixed(2)),
      qty,
      rawUnitAreaM2: Number(rawUnitAreaM2.toFixed(2)),
      totalAreaM2,
      exactTotalAreaM2,
      materialBaseSubtotal,
      variablesSubtotal,
      variableBreakdown,
      urgencySurcharge,
      currentItemWithUrgency,
      extraItemsSum,
      grossSubtotal,
      netSubtotal: effectiveNetSubtotal,
      ivaAmount: effectiveIva,
      calculatedTotal,
      finalTotal,
      advance50: Number((finalTotal * 0.5).toFixed(2)),
      dimensionsText,
      finishingsList,
    };
  }, [
    expressCategory,
    selectedExpressMaterial,
    expressUnitMode,
    expressWidth,
    expressHeight,
    expressQty,
    expressEnforceMin1M2,
    expressUnitPrice,
    expressLaserMinutes,
    expressLaserRatePerMin,
    expressLaserMaterialCost,
    expressLaserMaterialLabel,
    expressSizesAndColors,
    dozenDiscountPct,
    hundredDiscountPct,
    expressVariablesCatalog,
    expressSelectedVarIds,
    expressDesignFee,
    expressUrgencyPct,
    extraQuoteItems,
    expressInstallFee,
    expressDiscount,
    expressIncludeIva,
    expressManualTotalOverride,
  ]);

  // Nuevo producto en catálogo
  const [newProdName, setNewProdName] = useState('');
  const [newProdCategory, setNewProdCategory] = useState<ServiceCategory>(
    'Rótulos 3D y Estructurados'
  );
  const [newProdUnit, setNewProdUnit] = useState<'m2' | 'unidad' | 'metro_lineal'>('m2');
  const [newProdBaseCost, setNewProdBaseCost] = useState<number>(45);
  const [newProdSalePrice, setNewProdSalePrice] = useState<number>(125);
  const [newProdDesc, setNewProdDesc] = useState(
    'Incluye estructura metálica en tubo cuadrado, sustrato frontal e iluminación LED.'
  );

  // =========================================================================
  // ESTADO PARA COTIZADOR TÉCNICO DE TALLER (MODO 2)
  // =========================================================================
  const [clientName, setClientName] = useState('Corporación Gastronómica Del Pacífico');
  const [clientRuc, setClientRuc] = useState('1792837465001');
  const [clientPhone, setClientPhone] = useState('+593 99 412 8890');
  const [projectTitle, setProjectTitle] = useState(
    'Letrero Luminoso Caja de Luz Backlight + Estructura Metálica'
  );
  const [category, setCategory] = useState<ServiceCategory>('Rótulos 3D y Estructurados');
  const [materialId, setMaterialId] = useState<string>('mat-rotulo-alucobond');

  // Sincronizar cliente preseleccionado desde el Directorio CRM
  useEffect(() => {
    if (preselectedClient) {
      setExpressClientName(preselectedClient.name);
      setExpressClientPhone(preselectedClient.phone);
      setExpressClientRuc(preselectedClient.ruc);
      setClientName(preselectedClient.name);
      setClientPhone(preselectedClient.phone);
      setClientRuc(preselectedClient.ruc);
    }
  }, [preselectedClient]);

  // Recibir despiece optimizado desde el Optimizador de Cortes 2D
  useEffect(() => {
    if (optimizerPayload) {
      setExpressUnitMode('m');
      setExpressWidth(optimizerPayload.widthM);
      setExpressHeight(optimizerPayload.heightM);
      setExpressQty(optimizerPayload.quantity);
      setUnitMode('m');
      setWidthInput(optimizerPayload.widthM);
      setHeightInput(optimizerPayload.heightM);
      setQuantity(optimizerPayload.quantity);
      setWastePercent(Math.max(0, Math.round(optimizerPayload.wastePct)));
      setNotes((prev) =>
        prev.includes(optimizerPayload.summaryNote)
          ? prev
          : `${prev} | ${optimizerPayload.summaryNote}`
      );
      onConsumeOptimizerPayload?.();
    }
  }, [optimizerPayload, onConsumeOptimizerPayload]);

  const [unitMode, setUnitMode] = useState<'m' | 'cm'>('m');
  const [widthInput, setWidthInput] = useState<number>(3.6);
  const [heightInput, setHeightInput] = useState<number>(1.2);
  const [quantity, setQuantity] = useState<number>(1);

  const [selectedFinishings, setSelectedFinishings] = useState<string[]>([
    'Módulos LED Samsung + Fuente 12V',
    'Estructura tubo galv. anticorrosivo',
  ]);

  const [wastePercent, setWastePercent] = useState<number>(10);
  const [designHours, setDesignHours] = useState<number>(2.5);
  const [machineHours, setMachineHours] = useState<number>(6.0);
  const [installHours, setInstallHours] = useState<number>(3.5);
  const [installationFee, setInstallationFee] = useState<number>(85);
  const [profitMarginPercent, setProfitMarginPercent] = useState<number>(42);
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [includeIva, setIncludeIva] = useState<boolean>(true);

  const [deadlineDays, setDeadlineDays] = useState<number>(4);
  const [initialAdvance, setInitialAdvance] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<
    'Efectivo' | 'Transferencia Bancaria' | 'Tarjeta'
  >('Transferencia Bancaria');
  const [advanceBank, setAdvanceBank] = useState<string>(BANK_ACCOUNTS_CATALOG[0]);
  const [advanceRefNumber, setAdvanceRefNumber] = useState<string>('SPI-20261017-01');
  const [advanceInvoiceDoc, setAdvanceInvoiceDoc] = useState<string>('FAC-001-002-0004830');
  const [designerId] = useState<string>('usr-designer');
  const [operatorId] = useState<string>('usr-operator-2');
  const [installerId] = useState<string>('usr-installer-3');
  const [teamAssignments, setTeamAssignments] = useState<ProjectAssignment[]>([
    {
      userId: 'usr-designer',
      taskRole: 'Diseño y Pre-prensa',
      status: 'active',
      assignedAt: '2026-10-16 19:43',
    },
    {
      userId: 'usr-operator-2',
      taskRole: 'Taller / Soldadura / Armado',
      status: 'active',
      assignedAt: '2026-10-16 19:43',
    },
  ]);
  const [notes, setNotes] = useState<string>(
    'Bastidor en tubo galvanizado de 1", módulos LED cada 12cm y acometida 110V.'
  );
  const [copiedWhatsApp, setCopiedWhatsApp] = useState<boolean>(false);

  const defaultRoleForUser = (user: UserProfile): ProjectTaskRole => {
    if (user.role === 'designer') return 'Diseño y Pre-prensa';
    if (user.department === 'Instalación') return 'Instalación y Montaje';
    if (user.department === 'Taller/Armado') return 'Taller / Soldadura / Armado';
    if (user.role === 'operator') return 'Impresión / Corte';
    return 'Supervisión / Comercial';
  };

  const toggleTeamMember = (user: UserProfile) => {
    setTeamAssignments((prev) => {
      const exists = prev.some((a) => a.userId === user.id);
      if (exists) {
        if (prev.length <= 1) {
          onNotify('El proyecto debe tener al menos 1 responsable asignado.');
          return prev;
        }
        return prev.filter((a) => a.userId !== user.id);
      }
      return [
        ...prev,
        {
          userId: user.id,
          taskRole: defaultRoleForUser(user),
          status: 'active',
          assignedAt: '2026-10-16 19:43',
        },
      ];
    });
  };

  const filteredMaterials = useMemo(
    () => customCatalog.filter((m) => m.category === category),
    [customCatalog, category]
  );

  const selectedMaterial = useMemo(
    () =>
      customCatalog.find((m) => m.id === materialId) ||
      filteredMaterials[0] ||
      customCatalog[0],
    [customCatalog, materialId, filteredMaterials]
  );

  const handleCategoryChange = (newCat: ServiceCategory) => {
    setCategory(newCat);
    const firstMat = customCatalog.find((m) => m.category === newCat);
    if (firstMat) setMaterialId(firstMat.id);
    setSelectedFinishings([]);
    if (newCat === 'Diseño Gráfico y Branding') {
      setWidthInput(1);
      setHeightInput(1);
      setQuantity(1);
      setWastePercent(0);
      setDesignHours(5.0);
      setMachineHours(0);
      setInstallHours(0);
      setInstallationFee(0);
      setProjectTitle('Creación de Logo Corporativo + Identidad Visual');
      setSelectedFinishings([
        'Manual de Marca Corporativo PDF',
        'Pack Editables Vectoriales (AI / EPS / SVG / PDF)',
      ]);
      setTeamAssignments([
        {
          userId: 'usr-designer',
          taskRole: 'Diseño y Pre-prensa',
          status: 'active',
          assignedAt: '2026-10-16 19:43',
        },
      ]);
    }
  };

  const applySignPreset = (
    preset:
      | 'caja_luz_backlight'
      | 'rotulo_3d_alucobond'
      | 'rotulo_estructura_lona'
      | 'letras_acrilico_led'
      | 'logo_branding'
  ) => {
    if (preset === 'logo_branding') {
      setCategory('Diseño Gráfico y Branding');
      setMaterialId('mat-diseno-logo');
      setProjectTitle('Creación de Logo Profesional + Manual de Identidad Visual');
      setWidthInput(1);
      setHeightInput(1);
      setQuantity(1);
      setWastePercent(0);
      setSelectedFinishings([
        'Manual de Marca Corporativo PDF',
        'Pack Editables Vectoriales (AI / EPS / SVG / PDF)',
        'Mockups 3D Presentación',
      ]);
      setDesignHours(5.0);
      setMachineHours(0);
      setInstallHours(0);
      setInstallationFee(0);
      setTeamAssignments([
        {
          userId: 'usr-designer',
          taskRole: 'Diseño y Pre-prensa',
          status: 'active',
          assignedAt: '2026-10-16 19:43',
        },
      ]);
      onNotify('Cargado: Servicio Digital — Creación de Logo y Branding (Solo Diseño)');
    } else if (preset === 'caja_luz_backlight') {
      setCategory('Gran Formato / Gigantografía');
      setMaterialId('mat-lona-back');
      setProjectTitle('Letrero Luminoso Caja de Luz (Lona Backlight + Estructura + LED)');
      setSelectedFinishings([
        'Caja de luz tol + aluminio',
        'Iluminación LED IP68 + Fuente',
        'Ojalillos c/50cm / Tensado',
      ]);
      setDesignHours(2.0);
      setMachineHours(5.5);
      setInstallHours(3.0);
      setInstallationFee(75);
      onNotify('Cargado: Letrero Luminoso Caja de Luz');
    } else if (preset === 'rotulo_3d_alucobond') {
      setCategory('Rótulos 3D y Estructurados');
      setMaterialId('mat-rotulo-alucobond');
      setProjectTitle('Rótulo Alucobond ACM + Estructura + Letras 3D LED');
      setSelectedFinishings([
        'Módulos LED Samsung + Fuente 12V',
        'Estructura tubo galv. anticorrosivo',
        'Acrílico frontal 3mm/5mm láser',
      ]);
      setDesignHours(3.5);
      setMachineHours(8.0);
      setInstallHours(4.5);
      setInstallationFee(120);
      onNotify('Cargado: Rótulo Alucobond 3D con Estructura');
    } else if (preset === 'rotulo_estructura_lona') {
      setCategory('Gran Formato / Gigantografía');
      setMaterialId('mat-lona-front');
      setProjectTitle('Rótulo con Bastidor Metálico y Lona Tensada');
      setSelectedFinishings(['Bastidor tubo galv. 1"', 'Ojalillos c/50cm / Tensado']);
      setDesignHours(1.5);
      setMachineHours(4.0);
      setInstallHours(2.5);
      setInstallationFee(60);
      onNotify('Cargado: Rótulo Estructura + Lona');
    } else if (preset === 'letras_acrilico_led') {
      setCategory('Rótulos 3D y Estructurados');
      setMaterialId('mat-rotulo-acrilico3d');
      setProjectTitle('Letras Corpóreas 3D Acrílico + Retroiluminación LED');
      setSelectedFinishings([
        'Módulos LED Samsung + Fuente 12V',
        'Temporizador encendido auto.',
      ]);
      setDesignHours(3.0);
      setMachineHours(6.5);
      setInstallHours(3.0);
      setInstallationFee(85);
      onNotify('Cargado: Letras Corpóreas 3D Acrílico LED');
    }
  };

  const handleInlinePriceUpdate = (
    id: string,
    field: 'baseCostPerUnit' | 'suggestedPricePerUnit',
    val: number
  ) => {
    const cleanVal = Math.max(0, val);
    const updated = customCatalog.map((item) =>
      item.id === id ? { ...item, [field]: cleanVal } : item
    );
    setCustomCatalog(updated);
    localStorage.setItem('crea_arte_custom_catalog_v1', JSON.stringify(updated));
    window.dispatchEvent(new Event('crea_arte_catalog_updated'));
    if (field === 'suggestedPricePerUnit' && id === expressMaterialId) {
      setExpressUnitPrice(cleanVal);
    }
  };

  const handleDeleteCustomProduct = (id: string) => {
    if (customCatalog.length <= 1) return;
    const updated = customCatalog.filter((item) => item.id !== id);
    setCustomCatalog(updated);
    localStorage.setItem('crea_arte_custom_catalog_v1', JSON.stringify(updated));
    window.dispatchEvent(new Event('crea_arte_catalog_updated'));
    onNotify('Producto retirado del tarifario');
  };

  const handleSaveNewProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProdName.trim()) return;
    const newItem: CatalogMaterial = {
      id: `mat-custom-${Date.now()}`,
      name: newProdName.trim(),
      category: newProdCategory,
      unit: newProdUnit,
      baseCostPerUnit: newProdBaseCost,
      suggestedPricePerUnit: newProdSalePrice,
      inventoryItemId:
        newProdCategory === 'Rótulos 3D y Estructurados'
          ? 'inv-alucobond-4mm'
          : 'inv-lona-back',
      description: newProdDesc.trim(),
    };
    const updated = [newItem, ...customCatalog];
    setCustomCatalog(updated);
    localStorage.setItem('crea_arte_custom_catalog_v1', JSON.stringify(updated));
    window.dispatchEvent(new Event('crea_arte_catalog_updated'));
    setCategory(newProdCategory);
    setMaterialId(newItem.id);
    setProjectTitle(newItem.name);
    handleSelectExpressMaterial(newItem);
    setShowNewProductModal(false);
    setNewProdName('');
    onNotify(`Producto "${newItem.name}" guardado en el tarifario con precio ref. $${newProdSalePrice}/${newItem.unit}`);
  };

  const toggleFinishing = (label: string) => {
    setSelectedFinishings((prev) =>
      prev.includes(label) ? prev.filter((item) => item !== label) : [...prev, label]
    );
  };

  const calc = useMemo(() => {
    const widthM = unitMode === 'cm' ? widthInput / 100 : widthInput;
    const heightM = unitMode === 'cm' ? heightInput / 100 : heightInput;
    const unitAreaM2 = Math.max(0.01, widthM * heightM);
    const totalAreaM2 = Number((unitAreaM2 * Math.max(1, quantity)).toFixed(2));
    const linearMeters = Number((Math.max(widthM, heightM) * Math.max(1, quantity)).toFixed(2));

    const structBreakdown = calculateMetallicStructureResources(
      widthM,
      heightM,
      Math.max(1, quantity),
      true
    );
    const totalTubeMeters = structBreakdown.totalLinearMeters;
    const tubes6mNeeded = structBreakdown.tubes6mRequired;
    const estimatedLedModules = structBreakdown.ledModulesRequired;
    const estimatedPowerSupplies12V = structBreakdown.ledPowerSupplies12VRequired;

    const rawBaseCost = totalAreaM2 * selectedMaterial.baseCostPerUnit;
    const wasteCost = rawBaseCost * (wastePercent / 100);

    const availableFinishings = FINISHING_OPTIONS[category] || [];
    let finishingsCost = 0;
    selectedFinishings.forEach((fLabel) => {
      const found = availableFinishings.find((f) => f.label === fLabel);
      if (found) {
        finishingsCost += found.isFixed
          ? found.costPerM2OrUnit * quantity
          : found.costPerM2OrUnit * totalAreaM2;
      }
    });

    const internalLaborCost = designHours * 12 + machineHours * 11;
    const totalInternalCost = rawBaseCost + wasteCost + finishingsCost + internalLaborCost;

    const currentItemProductionPrice = Number(
      (totalInternalCost / Math.max(0.15, 1 - profitMarginPercent / 100)).toFixed(2)
    );

    const extraItemsSum = extraQuoteItems.reduce((acc, item) => acc + item.lineTotal, 0);

    const subtotalBeforeDiscount = Number(
      (currentItemProductionPrice + extraItemsSum + installationFee).toFixed(2)
    );
    const netSubtotal = Math.max(
      0,
      Number((subtotalBeforeDiscount - discountAmount).toFixed(2))
    );
    const ivaAmount = includeIva ? Number((netSubtotal * 0.15).toFixed(2)) : 0;
    const finalTotal = Number((netSubtotal + ivaAmount).toFixed(2));

    const internalInstallCost = installHours * 11;
    const netProfitDollars = Number(
      (netSubtotal - (totalInternalCost + internalInstallCost)).toFixed(2)
    );
    const realMarginPct =
      netSubtotal > 0 ? Number(((netProfitDollars / netSubtotal) * 100).toFixed(1)) : 0;

    return {
      widthM: Number(widthM.toFixed(2)),
      heightM: Number(heightM.toFixed(2)),
      unitAreaM2: Number(unitAreaM2.toFixed(2)),
      totalAreaM2,
      linearMeters,
      totalTubeMeters,
      tubes6mNeeded,
      estimatedLedModules,
      estimatedPowerSupplies12V,
      rawBaseCost: Number(rawBaseCost.toFixed(2)),
      wasteCost: Number(wasteCost.toFixed(2)),
      finishingsCost: Number(finishingsCost.toFixed(2)),
      internalLaborCost: Number(internalLaborCost.toFixed(2)),
      totalInternalCost: Number(totalInternalCost.toFixed(2)),
      currentItemProductionPrice,
      extraItemsSum,
      subtotalBeforeDiscount,
      netSubtotal,
      ivaAmount,
      finalTotal,
      suggestedAdvance50: Number((finalTotal * 0.5).toFixed(2)),
      netProfitDollars,
      realMarginPct,
    };
  }, [
    unitMode,
    widthInput,
    heightInput,
    quantity,
    selectedMaterial,
    wastePercent,
    category,
    selectedFinishings,
    designHours,
    machineHours,
    installHours,
    installationFee,
    profitMarginPercent,
    discountAmount,
    includeIva,
    extraQuoteItems,
  ]);

  // Construye el rubro actual del Cotizador Rápido (Modo 1)
  const currentExpressLineItem = useMemo<QuoteLineItem>(() => {
    const qty = expressCalc.qty;
    const isDesignOnly = expressCategory === 'Diseño Gráfico y Branding';
    const lineTotal =
      expressManualTotalOverride !== null &&
      expressManualTotalOverride > 0 &&
      extraQuoteItems.length === 0
        ? Math.max(1, Number((expressCalc.netSubtotal - expressInstallFee).toFixed(2)))
        : expressCalc.currentItemWithUrgency;

    return {
      id: 'item-express-current',
      title: expressTitle.trim() || selectedExpressMaterial.name,
      category: expressCategory,
      materialId: selectedExpressMaterial.id,
      materialName: `${selectedExpressMaterial.name} ($${expressUnitPrice.toFixed(2)}/${
        selectedExpressMaterial.unit
      })`,
      dimensionsText: expressCalc.dimensionsText,
      finishingsText:
        expressCalc.finishingsList.length > 0
          ? expressCalc.finishingsList.join(', ')
          : 'Acabado estándar de taller',
      finishings:
        expressCalc.finishingsList.length > 0
          ? expressCalc.finishingsList
          : ['Acabado estándar de taller'],
      quantity: qty,
      widthM: isDesignOnly || expressCalc.isUnitBased ? 1 : expressCalc.widthM,
      heightM: isDesignOnly || expressCalc.isUnitBased ? 1 : expressCalc.heightM,
      totalAreaM2:
        isDesignOnly || expressCalc.isUnitBased ? qty : expressCalc.totalAreaM2,
      laserMinutes: expressCalc.isLaserTimeMode ? expressLaserMinutes : undefined,
      sizesAndColors:
        expressCalc.isVolumeScaleMode && expressSizesAndColors.trim()
          ? expressSizesAndColors.trim()
          : undefined,
      unitPrice: Number((lineTotal / qty).toFixed(2)),
      lineTotal: Number(lineTotal.toFixed(2)),
    };
  }, [
    expressCalc,
    expressManualTotalOverride,
    extraQuoteItems.length,
    expressInstallFee,
    expressTitle,
    selectedExpressMaterial,
    expressCategory,
    expressUnitPrice,
    expressLaserMinutes,
    expressSizesAndColors,
  ]);

  // Construye el rubro actual del Cotizador Técnico (Modo 2)
  const currentTechnicalLineItem = useMemo<QuoteLineItem>(() => {
    const isDesign = category === 'Diseño Gráfico y Branding';
    const qty = Math.max(1, quantity);
    return {
      id: `item-current`,
      title: projectTitle.trim() || selectedMaterial.name,
      category,
      materialId: selectedMaterial.id,
      materialName: selectedMaterial.name,
      dimensionsText: isDesign
        ? `Servicio Digital (${designHours}h diseño)`
        : `${calc.widthM}m × ${calc.heightM}m (${calc.totalAreaM2} m²)`,
      finishingsText:
        selectedFinishings.length > 0
          ? selectedFinishings.join(', ')
          : 'Acabado estándar de taller',
      finishings:
        selectedFinishings.length > 0
          ? selectedFinishings
          : ['Acabado estándar de taller'],
      quantity: qty,
      widthM: isDesign ? 1 : calc.widthM,
      heightM: isDesign ? 1 : calc.heightM,
      totalAreaM2: isDesign ? qty : calc.totalAreaM2,
      unitPrice: Number((calc.currentItemProductionPrice / qty).toFixed(2)),
      lineTotal: calc.currentItemProductionPrice,
    };
  }, [
    category,
    quantity,
    projectTitle,
    selectedMaterial,
    designHours,
    calc,
    selectedFinishings,
  ]);

  // Agregar el ítem actual al carrito multi-rubro y dejar listo el formulario para configurar el siguiente producto
  const handleAddCurrentItemToMultiQuote = () => {
    const sourceItem =
      quoterMode === 'express' ? currentExpressLineItem : currentTechnicalLineItem;
    const newItem: QuoteLineItem = {
      ...sourceItem,
      id: `item-${Date.now()}`,
    };
    setExtraQuoteItems((prev) => [...prev, newItem]);
    setExpressManualTotalOverride(null);
    setExpressSelectedVarIds([]);
    setExpressDesignFee(0);
    setExpressQty(1);
    onNotify(
      `✓ Producto #${extraQuoteItems.length + 1} ("${newItem.title}" × ${newItem.quantity} unid.) fijado en la lista.`
    );
  };

  const handleRemoveExtraItem = (id: string) => {
    setExtraQuoteItems((prev) => prev.filter((item) => item.id !== id));
  };

  // Permite ajustar la cantidad de un producto que ya fue pasado al panel derecho
  const handleUpdateExtraItemQuantity = (id: string, newQtyRaw: number) => {
    const newQty = Math.max(1, Math.round(newQtyRaw));
    setExtraQuoteItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const newLineTotal = Number((item.unitPrice * newQty).toFixed(2));
        const unitArea =
          item.widthM && item.heightM ? Number((item.widthM * item.heightM).toFixed(2)) : 1;
        return {
          ...item,
          quantity: newQty,
          totalAreaM2: Number((unitArea * newQty).toFixed(2)),
          lineTotal: newLineTotal,
        };
      })
    );
    setExpressManualTotalOverride(null);
  };

  // Construye el objeto QuoteProformaData activo según si estamos en modo Express o Técnico
  const activeProformaData = useMemo<QuoteProformaData>(() => {
    const todayStr = new Date().toISOString().slice(0, 10);

    if (quoterMode === 'express') {
      const allExpressItems = [...extraQuoteItems, currentExpressLineItem];
      return {
        quoteNumber: `PRO-${nextOrderCode}`,
        orderId: nextOrderCode,
        issueDate: todayStr,
        validDays: quoteValidDays,
        deliveryDays: Math.max(1, expressDeadlineDays),
        clientName: expressClientName.trim() || 'Cliente Mostrador / Particular',
        clientRuc: expressClientRuc.trim() || '9999999999',
        clientPhone: expressClientPhone.trim() || '+593 99 000 0000',
        items: allExpressItems,
        installationFee: expressInstallFee,
        subtotal: expressCalc.netSubtotal,
        discount: expressDiscount,
        includeIva: expressIncludeIva,
        ivaAmount: expressCalc.ivaAmount,
        totalPrice: expressCalc.finalTotal,
        paidAmount: Math.min(expressCalc.finalTotal, Math.max(0, expressAdvance)),
        requiredAdvance50: expressCalc.advance50,
        preparedBy: currentUser.name,
        notes: `Cotización calculada por dimensiones (${expressCalc.dimensionsText}) con precio ref. $${expressUnitPrice.toFixed(
          2
        )}/${selectedExpressMaterial.unit}. Forma de pago: 50% anticipo y 50% contra entrega.`,
      };
    }

    const allItems = [...extraQuoteItems, currentTechnicalLineItem];

    return {
      quoteNumber: `PRO-${nextOrderCode}`,
      orderId: nextOrderCode,
      issueDate: todayStr,
      validDays: quoteValidDays,
      deliveryDays: Math.max(1, deadlineDays),
      clientName: clientName.trim() || 'Cliente Corporativo',
      clientRuc: clientRuc.trim() || '9999999999',
      clientPhone: clientPhone.trim() || '+593 99 000 0000',
      items: allItems,
      installationFee,
      subtotal: calc.netSubtotal,
      discount: discountAmount,
      includeIva,
      ivaAmount: calc.ivaAmount,
      totalPrice: calc.finalTotal,
      paidAmount: Math.min(calc.finalTotal, Math.max(0, initialAdvance)),
      requiredAdvance50: calc.suggestedAdvance50,
      preparedBy: currentUser.name,
      notes,
    };
  }, [
    quoterMode,
    extraQuoteItems,
    currentExpressLineItem,
    nextOrderCode,
    quoteValidDays,
    expressDeadlineDays,
    expressClientName,
    expressClientRuc,
    expressClientPhone,
    expressInstallFee,
    expressCalc,
    expressDiscount,
    expressIncludeIva,
    expressAdvance,
    currentUser.name,
    expressUnitPrice,
    selectedExpressMaterial.unit,
    currentTechnicalLineItem,
    deadlineDays,
    clientName,
    clientRuc,
    clientPhone,
    installationFee,
    calc,
    discountAmount,
    includeIva,
    initialAdvance,
    notes,
  ]);

  const displayedProformaData = previewQuoteOverride || activeProformaData;

  const whatsappMessage = useMemo(
    () => formatQuoteWhatsAppText(displayedProformaData),
    [displayedProformaData]
  );

  // Construye el objeto WorkOrder desde el modo actual (Express o Técnico)
  const buildDraftWorkOrderFromCurrentMode = (): WorkOrder => {
    const now = new Date();
    if (quoterMode === 'express') {
      const allExpressItems: QuoteLineItem[] = [
        ...extraQuoteItems,
        currentExpressLineItem,
      ];
      const finalClient = expressClientName.trim() || 'Cliente Mostrador';
      const baseTitle = expressTitle.trim() || selectedExpressMaterial.name;
      const finalTitle =
        extraQuoteItems.length > 0
          ? `${baseTitle} (+${extraQuoteItems.length} rubro(s) adicionales)`
          : baseTitle;
      const totalVal = Math.max(1, expressCalc.finalTotal);
      const paidVal = Math.min(totalVal, Math.max(0, expressAdvance));
      const deadlineDate = new Date(
        now.getTime() + Math.max(1, expressDeadlineDays) * 24 * 60 * 60 * 1000
      );
      const isDesignOnly = expressCategory === 'Diseño Gráfico y Branding';
      const primaryDesigner =
        teamAssignments.find((a) => a.taskRole === 'Diseño y Pre-prensa')?.userId ||
        'usr-designer';
      const primaryOperator =
        teamAssignments.find(
          (a) =>
            a.taskRole === 'Impresión / Corte' || a.taskRole === 'Taller / Soldadura / Armado'
        )?.userId || 'usr-operator';

      return {
        id: nextOrderCode,
        clientName: finalClient,
        clientRuc: expressClientRuc.trim() || '9999999999',
        clientPhone: expressClientPhone.trim() || '+593 99 000 0000',
        title: finalTitle,
        category: expressCategory,
        materialId: selectedExpressMaterial.id,
        materialName: selectedExpressMaterial.name,
        widthM: isDesignOnly || expressCalc.isUnitBased ? 1 : expressCalc.widthM,
        heightM: isDesignOnly || expressCalc.isUnitBased ? 1 : expressCalc.heightM,
        quantity: expressCalc.qty,
        totalAreaM2: isDesignOnly || expressCalc.isUnitBased ? expressCalc.qty : expressCalc.totalAreaM2,
        laserMinutes: expressCalc.isLaserTimeMode ? expressLaserMinutes : undefined,
        laserRatePerMin: expressCalc.isLaserTimeMode ? expressLaserRatePerMin : undefined,
        sizesAndColors:
          expressCalc.isVolumeScaleMode && expressSizesAndColors.trim()
            ? expressSizesAndColors.trim()
            : undefined,
        volumeDiscountPct:
          expressCalc.isVolumeScaleMode && expressCalc.activeVolumeDiscountPct > 0
            ? expressCalc.activeVolumeDiscountPct
            : undefined,
        lineItems: allExpressItems,
        finishings:
          expressCalc.finishingsList.length > 0
            ? expressCalc.finishingsList
            : isDesignOnly
            ? ['Pack Editables Vectoriales (AI / EPS / SVG / PDF)']
            : ['Acabado estándar de taller'],
        stage: paidVal > 0 ? 'En Diseño y Arte' : 'Cotizado / Anticipo Pendiente',
        createdAt: now.toISOString(),
        deadline: deadlineDate.toISOString(),
        designerId: primaryDesigner,
        operatorId: primaryOperator,
        installerId: primaryOperator,
        teamAssignments: teamAssignments.map((a) => ({
          ...a,
          status: 'active',
          assignedAt: now.toISOString().slice(0, 16).replace('T', ' '),
        })),
        estimatedDesignHours: isDesignOnly ? 4 : expressDesignFee > 0 ? 2.0 : 1.0,
        estimatedMachineHours: isDesignOnly
          ? 0
          : expressCalc.isLaserTimeMode
          ? Math.max(0.5, Number(((expressLaserMinutes * expressCalc.qty) / 60).toFixed(1)))
          : Math.max(1, Number((expressCalc.totalAreaM2 * 0.6).toFixed(1))),
        estimatedInstallHours: isDesignOnly || expressInstallFee === 0 ? 0 : 2.0,
        rawMaterialCost: expressCalc.isLaserTimeMode
          ? Number((expressLaserMaterialCost * 0.55 * expressCalc.qty).toFixed(2))
          : Number(
              (expressCalc.totalAreaM2 * selectedExpressMaterial.baseCostPerUnit).toFixed(2)
            ),
        wastePercent: isDesignOnly ? 0 : 8,
        installationFee: expressInstallFee,
        subtotal: expressCalc.netSubtotal,
        discount: expressDiscount,
        includeIva: expressIncludeIva,
        totalPrice: totalVal,
        paidAmount: paidVal,
        artworkUrl: '',
        artworkApproved: false,
        stockDeducted: false,
        notes: expressCalc.isLaserTimeMode
          ? `Corte/Grabado Láser CNC: ${expressLaserMinutes} min × $${expressLaserRatePerMin.toFixed(2)}/min + Sustrato ${expressLaserMaterialLabel} ($${expressLaserMaterialCost.toFixed(2)}).`
          : expressCalc.isVolumeScaleMode
          ? `Sublimación / Merchandising (${expressCalc.qty} unid., ${expressCalc.volumeScaleTierLabel}). Tallas/Colores: ${expressSizesAndColors || 'Por definir'}.`
          : `Cotización Rápida (${expressCalc.dimensionsText}, Ref: $${expressUnitPrice}/${selectedExpressMaterial.unit}).`,
      };
    }

    const allTechnicalItems: QuoteLineItem[] = [
      ...extraQuoteItems,
      currentTechnicalLineItem,
    ];
    const deadlineDate = new Date(now.getTime() + deadlineDays * 24 * 60 * 60 * 1000);
    const primaryDesigner =
      teamAssignments.find((a) => a.taskRole === 'Diseño y Pre-prensa')?.userId ||
      teamAssignments[0]?.userId ||
      designerId;
    const primaryOperator =
      teamAssignments.find(
        (a) =>
          a.taskRole === 'Impresión / Corte' || a.taskRole === 'Taller / Soldadura / Armado'
      )?.userId ||
      teamAssignments[0]?.userId ||
      operatorId;
    const primaryInstaller =
      teamAssignments.find((a) => a.taskRole === 'Instalación y Montaje')?.userId ||
      primaryOperator ||
      installerId;

    const combinedTitle =
      extraQuoteItems.length > 0
        ? `${projectTitle.trim()} (+${extraQuoteItems.length} rubro(s) adicionales)`
        : projectTitle.trim() || selectedMaterial.name;

    return {
      id: nextOrderCode,
      clientName: clientName.trim() || 'Cliente Corporativo',
      clientRuc: clientRuc.trim() || '9999999999',
      clientPhone: clientPhone.trim() || '+593 99 000 0000',
      title: combinedTitle,
      category,
      materialId: selectedMaterial.id,
      materialName: selectedMaterial.name,
      widthM: calc.widthM,
      heightM: calc.heightM,
      quantity: Math.max(1, quantity),
      totalAreaM2: calc.totalAreaM2,
      lineItems: allTechnicalItems,
      finishings: selectedFinishings,
      stage: initialAdvance > 0 ? 'En Diseño y Arte' : 'Cotizado / Anticipo Pendiente',
      createdAt: now.toISOString(),
      deadline: deadlineDate.toISOString(),
      designerId: primaryDesigner,
      operatorId: primaryOperator,
      installerId: primaryInstaller,
      teamAssignments: teamAssignments.map((a) => ({
        ...a,
        status: 'active',
        assignedAt: now.toISOString().slice(0, 16).replace('T', ' '),
      })),
      estimatedDesignHours: designHours,
      estimatedMachineHours: machineHours,
      estimatedInstallHours: installHours,
      rawMaterialCost: Number(
        (calc.rawBaseCost + calc.wasteCost + calc.finishingsCost).toFixed(2)
      ),
      wastePercent,
      installationFee,
      subtotal: calc.netSubtotal,
      discount: discountAmount,
      includeIva,
      totalPrice: calc.finalTotal,
      paidAmount: Math.min(calc.finalTotal, Math.max(0, initialAdvance)),
      artworkUrl: '',
      artworkApproved: false,
      stockDeducted: false,
      notes,
    };
  };

  // Registra cualquier cotización descargada, enviada por WhatsApp o convertida en orden en el historial
  const registerQuoteInHistory = (
    proforma: QuoteProformaData,
    draftOrder: WorkOrder,
    channel: SentQuoteRecord['channel'],
    pdfFileName: string
  ) => {
    const nowStr = new Date().toISOString().slice(0, 16).replace('T', ' ');
    const record: SentQuoteRecord = {
      id: `q-${proforma.orderId || draftOrder.id}-${Date.now()}`,
      quoteNumber: proforma.quoteNumber,
      orderId: proforma.orderId || draftOrder.id,
      sentAt: nowStr,
      channel,
      pdfFileName,
      proformaData: proforma,
      draftOrder,
    };
    setSentQuotesHistory((prev) => {
      const filtered = prev.filter((q) => q.orderId !== (proforma.orderId || draftOrder.id));
      const updated = [record, ...filtered];
      localStorage.setItem('crea_arte_sent_quotes_v1', JSON.stringify(updated));
      return updated;
    });
  };

  // Unifica el historial de cotizaciones guardadas con todas las órdenes/cotizaciones del sistema
  const allQuotesList = useMemo(() => {
    const mapByOrderId = new Map<
      string,
      SentQuoteRecord & {
        liveOrder?: WorkOrder;
        isConvertedToOrder: boolean;
      }
    >();

    // Primero cargamos las guardadas explícitamente en sentQuotesHistory
    sentQuotesHistory.forEach((rec) => {
      const liveOrder = orders.find((o) => o.id === rec.orderId);
      mapByOrderId.set(rec.orderId, {
        ...rec,
        liveOrder,
        isConvertedToOrder: Boolean(liveOrder),
      });
    });

    // Luego aseguramos que todas las órdenes existentes en el ERP también aparezcan como Proformas/Cotizaciones
    orders.forEach((ord) => {
      if (!mapByOrderId.has(ord.id)) {
        const isDesign = ord.category === 'Diseño Gráfico y Branding';
        const lineSubtotal = Math.max(
          1,
          Number((ord.subtotal + ord.discount - ord.installationFee).toFixed(2))
        );
        const unitPrice = Number((lineSubtotal / Math.max(1, ord.quantity)).toFixed(2));
        const ivaVal = ord.includeIva
          ? Number((ord.totalPrice - ord.subtotal).toFixed(2))
          : 0;
        const proforma: QuoteProformaData = {
          quoteNumber: `PRO-${ord.id}`,
          orderId: ord.id,
          issueDate: ord.createdAt.slice(0, 10),
          validDays: 15,
          deliveryDays: 4,
          clientName: ord.clientName,
          clientRuc: ord.clientRuc,
          clientPhone: ord.clientPhone,
          items: [
            {
              id: `item-${ord.id}`,
              title: ord.title,
              category: ord.category,
              materialName: ord.materialName,
              dimensionsText: isDesign
                ? `Servicio Digital (${ord.estimatedDesignHours}h)`
                : `${ord.widthM}m × ${ord.heightM}m (${ord.totalAreaM2} m²)`,
              finishingsText:
                ord.finishings.length > 0
                  ? ord.finishings.join(', ')
                  : 'Acabado estándar de taller',
              quantity: ord.quantity,
              unitPrice,
              lineTotal: lineSubtotal,
            },
          ],
          installationFee: ord.installationFee,
          subtotal: ord.subtotal,
          discount: ord.discount,
          includeIva: ord.includeIva,
          ivaAmount: Math.max(0, ivaVal),
          totalPrice: ord.totalPrice,
          paidAmount: ord.paidAmount,
          requiredAdvance50: Number((ord.totalPrice * 0.5).toFixed(2)),
          preparedBy: currentUser.name,
          notes: ord.notes || 'Forma de pago: 50% anticipo y 50% contra entrega.',
        };

        mapByOrderId.set(ord.id, {
          id: `q-ord-${ord.id}`,
          quoteNumber: `PRO-${ord.id}`,
          orderId: ord.id,
          sentAt: ord.createdAt.slice(0, 16).replace('T', ' '),
          channel: 'whatsapp_pdf',
          pdfFileName: `Cotizacion_${ord.id.replace('#', '')}.pdf`,
          proformaData: proforma,
          draftOrder: ord,
          liveOrder: ord,
          isConvertedToOrder: true,
        });
      }
    });

    return Array.from(mapByOrderId.values());
  }, [sentQuotesHistory, orders, currentUser.name]);

  const filteredQuotesList = useMemo(() => {
    return allQuotesList.filter((q) => {
      const stage = q.liveOrder?.stage;
      const paid = (q.liveOrder ? q.liveOrder.paidAmount : q.proformaData.paidAmount) || 0;

      if (historyFilter === 'pending_advance') {
        const isPending =
          !q.isConvertedToOrder ||
          stage === 'Cotizado / Anticipo Pendiente' ||
          paid === 0;
        if (!isPending) return false;
      } else if (historyFilter === 'approved') {
        const isApproved =
          q.isConvertedToOrder &&
          stage !== 'Cotizado / Anticipo Pendiente' &&
          paid > 0;
        if (!isApproved) return false;
      } else if (historyFilter === 'pdf_only') {
        if (q.isConvertedToOrder) return false;
      }

      if (!historySearch.trim()) return true;
      const term = historySearch.toLowerCase();
      return (
        q.quoteNumber.toLowerCase().includes(term) ||
        q.orderId.toLowerCase().includes(term) ||
        q.proformaData.clientName.toLowerCase().includes(term) ||
        q.proformaData.clientRuc.toLowerCase().includes(term) ||
        q.proformaData.clientPhone.toLowerCase().includes(term) ||
        q.proformaData.items.some(
          (i) =>
            i.title.toLowerCase().includes(term) ||
            i.materialName.toLowerCase().includes(term)
        )
      );
    });
  }, [allQuotesList, historyFilter, historySearch]);

  const handleCopyWhatsApp = async () => {
    await copyTextToClipboardSafe(whatsappMessage);
    setCopiedWhatsApp(true);
    onNotify('Cotización formateada copiada al portapapeles');
    setTimeout(() => setCopiedWhatsApp(false), 2500);
  };

  // Descargar solo el archivo PDF y registrarlo en Cotizaciones Enviadas
  const handleDownloadPdfQuote = () => {
    const targetProforma = displayedProformaData;
    const { fileName } = generateQuotePdf(targetProforma, { download: true });
    if (!previewQuoteOverride) {
      const draftOrder = buildDraftWorkOrderFromCurrentMode();
      registerQuoteInHistory(targetProforma, draftOrder, 'pdf_only', fileName);
    }
    onNotify(
      `PDF "${fileName}" descargado y guardado en la pestaña "4. Cotizaciones Enviadas"`
    );
  };

  // Acción en 1 Clic: Descargar PDF + Enviar al Cliente por WhatsApp CRM
  const handleDownloadPdfAndSendWhatsApp = () => {
    const targetProforma = displayedProformaData;
    const { fileName } = generateQuotePdf(targetProforma, { download: true });
    const msgText = formatQuoteWhatsAppText(targetProforma);
    void copyTextToClipboardSafe(msgText);

    const draftOrder = previewQuoteOverride
      ? allQuotesList.find((q) => q.orderId === previewQuoteOverride.orderId)?.draftOrder ||
        buildDraftWorkOrderFromCurrentMode()
      : buildDraftWorkOrderFromCurrentMode();

    registerQuoteInHistory(targetProforma, draftOrder, 'whatsapp_pdf', fileName);

    if (onSendQuoteToWhatsApp) {
      onSendQuoteToWhatsApp(draftOrder, msgText, fileName);
    } else {
      onNotify(`PDF "${fileName}" descargado y texto copiado para WhatsApp`);
    }
  };

  // Compartir archivo PDF nativamente (Web Share API en móviles/tablets/Mac) o descargar
  const handleNativeSharePdf = async () => {
    const targetProforma = displayedProformaData;
    const { file, fileName } = generateQuotePdf(targetProforma, { download: true });
    const msgText = formatQuoteWhatsAppText(targetProforma);
    await copyTextToClipboardSafe(msgText);

    if (!previewQuoteOverride) {
      const draftOrder = buildDraftWorkOrderFromCurrentMode();
      registerQuoteInHistory(targetProforma, draftOrder, 'whatsapp_pdf', fileName);
    }

    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          title: `Cotización ${targetProforma.quoteNumber} - Crea Arte`,
          text: msgText,
          files: [file],
        });
        onNotify(`Archivo PDF "${fileName}" compartido directamente`);
        return;
      } catch {
        // Fallback si el usuario cancela el diálogo nativo
      }
    }
    onNotify(`PDF "${fileName}" descargado y mensaje copiado para adjuntar en WhatsApp`);
  };

  // Crear orden desde Modo Express
  const handleCreateExpressOrder = (e: React.FormEvent) => {
    e.preventDefault();
    const newOrder = buildDraftWorkOrderFromCurrentMode();
    registerQuoteInHistory(
      activeProformaData,
      newOrder,
      'orden_directa',
      `Cotizacion_${newOrder.id.replace('#', '')}.pdf`
    );
    onConvertOrder(newOrder, newOrder.paidAmount, paymentMethod, {
      bankEntity: advanceBank,
      referenceNumber: advanceRefNumber.trim() || 'EXPRESS-S/N',
      invoiceOrDocNumber: advanceInvoiceDoc.trim() || 'Por Facturar',
      accountHolderOrNotes: `Ingreso Cotizador Rápido ${newOrder.id}`,
    });
  };

  // Crear orden desde Cotizador Técnico por m²
  const handleCreateOrder = () => {
    if (!clientName.trim() || !projectTitle.trim()) {
      onNotify('Completa cliente y título del proyecto');
      return;
    }
    const newOrder = buildDraftWorkOrderFromCurrentMode();
    registerQuoteInHistory(
      activeProformaData,
      newOrder,
      'orden_directa',
      `Cotizacion_${newOrder.id.replace('#', '')}.pdf`
    );
    onConvertOrder(newOrder, newOrder.paidAmount, paymentMethod, {
      bankEntity: advanceBank,
      referenceNumber: advanceRefNumber.trim() || 'S/N',
      invoiceOrDocNumber: advanceInvoiceDoc.trim() || 'Pendiente Facturar',
      accountHolderOrNotes: `Anticipo inicial orden ${newOrder.id} (${clientName.trim()})`,
    });
  };

  // Recargar una cotización del historial en el Cotizador Rápido para editar medidas o precios
  const handleReloadQuoteIntoExpress = (quote: SentQuoteRecord) => {
    const ord = quote.liveOrder || quote.draftOrder;
    setExpressClientName(ord.clientName);
    setExpressClientRuc(ord.clientRuc);
    setExpressClientPhone(ord.clientPhone);
    setExpressCategory(ord.category);
    setExpressMaterialId(ord.materialId);
    setExpressTitle(ord.title);
    setExpressUnitMode('m');
    setExpressWidth(ord.widthM || 1);
    setExpressHeight(ord.heightM || 1);
    setExpressQty(ord.quantity || 1);
    setExpressInstallFee(ord.installationFee || 0);
    setExpressDiscount(ord.discount || 0);
    setExpressIncludeIva(ord.includeIva);
    setExpressManualTotalOverride(ord.totalPrice);
    setQuoterMode('express');
    onNotify(
      `Cotización ${quote.quoteNumber} (${ord.clientName}) cargada en el Cotizador Rápido para editar`
    );
  };

  // Materiales destacados con precios referenciales vivos desde el catálogo
  const quickReferenceMaterials = useMemo(() => {
    const featuredIds = [
      { id: 'mat-lona-front', shortLabel: 'Lona 13oz', defaultW: 2.5, defaultH: 1.2, vars: ['var-ojalillos'] },
      { id: 'mat-lona-estructura', shortLabel: 'Lona + Estructura', defaultW: 3.0, defaultH: 1.2, vars: [] },
      { id: 'mat-vinil-adhesivo', shortLabel: 'Vinil Impreso', defaultW: 2.0, defaultH: 1.2, vars: [] },
      { id: 'mat-vinil-laminado', shortLabel: 'Vinil + Laminado UV', defaultW: 2.0, defaultH: 1.5, vars: [] },
      { id: 'mat-rotulo-alucobond', shortLabel: 'Rótulo Alucobond 3D', defaultW: 3.6, defaultH: 1.2, vars: [] },
      { id: 'mat-laser-acrilico', shortLabel: 'Láser / CNC ($/min)', defaultW: 1, defaultH: 1, vars: [] },
      { id: 'mat-sub-tazas', shortLabel: 'Tazas Sublimadas', defaultW: 1, defaultH: 1, vars: [] },
      { id: 'mat-sub-camisetas', shortLabel: 'Camisetas / Gorras', defaultW: 1, defaultH: 1, vars: [] },
      { id: 'mat-senaletica-pvc', shortLabel: 'PVC Sintra 3mm', defaultW: 1.2, defaultH: 0.8, vars: ['var-cinta-3m'] },
      { id: 'mat-diseno-logo', shortLabel: 'Logo Digital', defaultW: 1, defaultH: 1, vars: [] },
    ];
    return featuredIds
      .map((f) => {
        const found = customCatalog.find((m) => m.id === f.id);
        return found ? { ...f, material: found } : null;
      })
      .filter(Boolean) as {
      id: string;
      shortLabel: string;
      defaultW: number;
      defaultH: number;
      vars: string[];
      material: CatalogMaterial;
    }[];
  }, [customCatalog]);

  const priceDiffersFromCatalog =
    Math.abs(expressUnitPrice - selectedExpressMaterial.suggestedPricePerUnit) > 0.009;

  // Clasificación de cada cotización/orden en 4 Bloques de Etapa Comercial
  const getQuoteStageGroup = (
    quote: SentQuoteRecord & { liveOrder?: WorkOrder; isConvertedToOrder: boolean }
  ): 'stage_1_quote' | 'stage_2_design' | 'stage_3_workshop' | 'stage_4_delivery' => {
    const ord = quote.liveOrder;
    const stage = ord?.stage;
    const paid = (ord ? ord.paidAmount : quote.proformaData.paidAmount) || 0;
    if (!quote.isConvertedToOrder || stage === 'Cotizado / Anticipo Pendiente' || paid === 0) {
      return 'stage_1_quote';
    }
    if (stage === 'En Diseño y Arte' || stage === 'Aprobación del Cliente') {
      return 'stage_2_design';
    }
    if (stage === 'En Cola de Impresión/Corte' || stage === 'Acabados y Armado 3D') {
      return 'stage_3_workshop';
    }
    return 'stage_4_delivery';
  };

  const stageGroupsSummary = useMemo(() => {
    const groups = {
      stage_1_quote: [] as typeof allQuotesList,
      stage_2_design: [] as typeof allQuotesList,
      stage_3_workshop: [] as typeof allQuotesList,
      stage_4_delivery: [] as typeof allQuotesList,
    };
    allQuotesList.forEach((q) => {
      groups[getQuoteStageGroup(q)].push(q);
    });
    const sumTotal = (list: typeof allQuotesList) =>
      list.reduce((acc, q) => acc + (q.liveOrder ? q.liveOrder.totalPrice : q.proformaData.totalPrice), 0);

    return {
      groups,
      totals: {
        stage_1_quote: sumTotal(groups.stage_1_quote),
        stage_2_design: sumTotal(groups.stage_2_design),
        stage_3_workshop: sumTotal(groups.stage_3_workshop),
        stage_4_delivery: sumTotal(groups.stage_4_delivery),
      },
    };
  }, [allQuotesList]);

  return (
    <div className="space-y-5">
      {/* BARRA PRINCIPAL SIMPLIFICADA DEL PANEL DE VENTAS */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-3.5 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100/90 dark:bg-slate-950 rounded-xl border border-slate-200/70 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setQuoterMode('express')}
              className={`px-3.5 py-2 text-xs font-bold rounded-lg transition-all duration-200 inline-flex items-center gap-1.5 ${
                quoterMode === 'express'
                  ? 'bg-indigo-600 text-white shadow-xs shadow-indigo-500/20'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Calculator className="w-3.5 h-3.5" />
              <span>1. Cotizador por Bloques (3 Etapas)</span>
            </button>

            <button
              type="button"
              onClick={() => setQuoterMode('history')}
              className={`px-3.5 py-2 text-xs font-bold rounded-lg transition-all duration-200 inline-flex items-center gap-1.5 ${
                quoterMode === 'history'
                  ? 'bg-indigo-600 text-white shadow-xs shadow-indigo-500/20'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>2. Embudo de Ventas por Etapas</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                  quoterMode === 'history'
                    ? 'bg-indigo-800 text-white'
                    : 'bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300'
                }`}
              >
                {allQuotesList.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setQuoterMode('pricelist')}
              className={`px-3.5 py-2 text-xs font-bold rounded-lg transition-all duration-200 inline-flex items-center gap-1.5 ${
                quoterMode === 'pricelist'
                  ? 'bg-indigo-600 text-white shadow-xs shadow-indigo-500/20'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <TableProperties className="w-3.5 h-3.5" />
              <span>3. Tarifario Base ({customCatalog.length})</span>
            </button>

            {canSeeInternalCosts && (
              <button
                type="button"
                onClick={() => setQuoterMode('technical')}
                className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-all duration-200 inline-flex items-center gap-1.5 ${
                  quoterMode === 'technical'
                    ? 'bg-indigo-600 text-white shadow-xs shadow-indigo-500/20'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
                title="Calculadora avanzada de horas de taller, merma y márgenes"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Modo Ingeniería</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowNewProductModal(true)}
              className="px-3.5 py-2 text-xs font-semibold bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200/90 dark:border-slate-700 rounded-xl inline-flex items-center gap-1.5 whitespace-nowrap shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5 text-indigo-600" />
              <span>Crear Material</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setPreviewQuoteOverride(null);
                setShowProformaModal(true);
              }}
              className="px-3.5 py-2 text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 border border-indigo-200/90 dark:border-indigo-800 rounded-xl inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Ver Proforma A4</span>
            </button>
          </div>
        </div>

        {/* ================================================================= */}
        {/* MAPA DE 4 BLOQUES POR ETAPA COMERCIAL (CLIC PARA FILTRAR ETAPA)   */}
        {/* ================================================================= */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
          {[
            {
              id: 'stage_1_quote' as const,
              stepBadge: 'ETAPA 1',
              title: 'Cotizado / Por Aprobar',
              sub: 'Esperando anticipo 50%',
              count: stageGroupsSummary.groups.stage_1_quote.length,
              amount: stageGroupsSummary.totals.stage_1_quote,
              cardBg:
                quoterMode === 'history' && activeStageBlockFilter === 'stage_1_quote'
                  ? 'bg-amber-100/90 dark:bg-amber-950/60 border-amber-400 dark:border-amber-700 ring-1 ring-amber-400/50'
                  : 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-200/80 dark:border-amber-900/50 hover:bg-amber-50 dark:hover:bg-amber-950/35',
              badgeColor: 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-300/60 dark:border-amber-700',
              amountColor: 'text-amber-800 dark:text-amber-300',
            },
            {
              id: 'stage_2_design' as const,
              stepBadge: 'ETAPA 2',
              title: 'En Diseño y Arte',
              sub: 'Pre-prensa y boceto 3D',
              count: stageGroupsSummary.groups.stage_2_design.length,
              amount: stageGroupsSummary.totals.stage_2_design,
              cardBg:
                quoterMode === 'history' && activeStageBlockFilter === 'stage_2_design'
                  ? 'bg-indigo-100/90 dark:bg-indigo-950/60 border-indigo-400 dark:border-indigo-700 ring-1 ring-indigo-400/50'
                  : 'bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-200/80 dark:border-indigo-900/50 hover:bg-indigo-50 dark:hover:bg-indigo-950/35',
              badgeColor: 'bg-indigo-500/15 text-indigo-800 dark:text-indigo-300 border-indigo-300/60 dark:border-indigo-700',
              amountColor: 'text-indigo-800 dark:text-indigo-300',
            },
            {
              id: 'stage_3_workshop' as const,
              stepBadge: 'ETAPA 3',
              title: 'En Producción / Taller',
              sub: 'Impresión, CNC y armado',
              count: stageGroupsSummary.groups.stage_3_workshop.length,
              amount: stageGroupsSummary.totals.stage_3_workshop,
              cardBg:
                quoterMode === 'history' && activeStageBlockFilter === 'stage_3_workshop'
                  ? 'bg-purple-100/90 dark:bg-purple-950/60 border-purple-400 dark:border-purple-700 ring-1 ring-purple-400/50'
                  : 'bg-purple-50/50 dark:bg-purple-950/20 border-purple-200/80 dark:border-purple-900/50 hover:bg-purple-50 dark:hover:bg-purple-950/35',
              badgeColor: 'bg-purple-500/15 text-purple-800 dark:text-purple-300 border-purple-300/60 dark:border-purple-700',
              amountColor: 'text-purple-800 dark:text-purple-300',
            },
            {
              id: 'stage_4_delivery' as const,
              stepBadge: 'ETAPA 4',
              title: 'Listo / Entregado',
              sub: 'Despacho y liquidación',
              count: stageGroupsSummary.groups.stage_4_delivery.length,
              amount: stageGroupsSummary.totals.stage_4_delivery,
              cardBg:
                quoterMode === 'history' && activeStageBlockFilter === 'stage_4_delivery'
                  ? 'bg-emerald-100/90 dark:bg-emerald-950/60 border-emerald-400 dark:border-emerald-700 ring-1 ring-emerald-400/50'
                  : 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200/80 dark:border-emerald-900/50 hover:bg-emerald-50 dark:hover:bg-emerald-950/35',
              badgeColor: 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-300/60 dark:border-emerald-700',
              amountColor: 'text-emerald-800 dark:text-emerald-300',
            },
          ].map((stg) => (
            <button
              key={stg.id}
              type="button"
              onClick={() => {
                setQuoterMode('history');
                setHistoryViewMode('stage_blocks');
                setHistoryFilter('all');
                setActiveStageBlockFilter((prev) =>
                  quoterMode === 'history' && prev === stg.id ? 'all' : stg.id
                );
              }}
              className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between gap-1.5 ${stg.cardBg}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${stg.badgeColor}`}
                >
                  {stg.stepBadge}
                </span>
                <span className="text-xs font-mono tabular-nums font-extrabold text-slate-900 dark:text-white">
                  {stg.count} {stg.count === 1 ? 'orden' : 'órdenes'}
                </span>
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                  {stg.title}
                </div>
                <div className="flex items-baseline justify-between gap-2 mt-0.5">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                    {stg.sub}
                  </span>
                  <span className={`text-xs font-mono tabular-nums font-extrabold ${stg.amountColor}`}>
                    ${stg.amount.toFixed(2)}
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ===================================================================== */}
      {/* MODO 1: PANEL DE VENTAS DIFERENCIADO EN 3 BLOQUES DE ETAPA LIMPIOS    */}
      {/* ===================================================================== */}
      {quoterMode === 'express' && (
        <form
          onSubmit={handleCreateExpressOrder}
          className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start"
        >
          {/* ================================================================= */}
          {/* COLUMNA IZQUIERDA (7 cols): BLOQUE ETAPA 1 Y BLOQUE ETAPA 2       */}
          {/* ================================================================= */}
          <div className="lg:col-span-7 space-y-5">
            {/* BLOQUE ETAPA 1: IDENTIFICACIÓN DEL CLIENTE */}
            <div className="bg-white dark:bg-slate-900 border border-indigo-200/90 dark:border-indigo-900/60 rounded-xl overflow-hidden shadow-xs">
              <div className="px-5 py-3 bg-indigo-50/70 dark:bg-indigo-950/35 border-b border-indigo-100 dark:border-indigo-900/50 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="px-2 py-0.5 rounded-md bg-indigo-600 text-white text-[10px] font-mono font-bold uppercase tracking-wider">
                    BLOQUE ETAPA 1
                  </span>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Datos del Cliente / Contacto
                  </h3>
                </div>

                {clients.length > 0 && (
                  <select
                    onChange={(e) => {
                      const found = clients.find((c) => c.id === e.target.value);
                      if (found) {
                        setExpressClientName(found.name);
                        setExpressClientPhone(found.phone);
                        setExpressClientRuc(found.ruc);
                      }
                    }}
                    defaultValue=""
                    className="text-xs bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 rounded-lg px-2.5 py-1.5 text-indigo-700 dark:text-indigo-300 font-semibold"
                  >
                    <option value="" disabled>
                      Autocompletar cliente del CRM...
                    </option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.phone})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="p-5 grid grid-cols-1 sm:grid-cols-12 gap-3.5">
                <div className="sm:col-span-6">
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Nombre del Cliente o Empresa *
                  </label>
                  <input
                    type="text"
                    value={expressClientName}
                    onChange={(e) => setExpressClientName(e.target.value)}
                    placeholder="Ej. Farmacias San Gregorio (o Consumidor Final)"
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-semibold"
                  />
                </div>
                <div className="sm:col-span-3">
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    WhatsApp
                  </label>
                  <input
                    type="text"
                    value={expressClientPhone}
                    onChange={(e) => setExpressClientPhone(e.target.value)}
                    placeholder="+593 99..."
                    className="w-full px-2.5 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>
                <div className="sm:col-span-3">
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    RUC / Cédula
                  </label>
                  <input
                    type="text"
                    value={expressClientRuc}
                    onChange={(e) => setExpressClientRuc(e.target.value)}
                    placeholder="17900..."
                    className="w-full px-2.5 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>
              </div>
            </div>

            {/* BLOQUE ETAPA 2: CONFIGURACIÓN DE PRODUCTO Y MEDIDAS */}
            <div className="bg-white dark:bg-slate-900 border border-sky-200/90 dark:border-sky-900/60 rounded-xl overflow-hidden shadow-xs">
              <div className="px-5 py-3 bg-sky-50/70 dark:bg-sky-950/35 border-b border-sky-100 dark:border-sky-900/50 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="px-2 py-0.5 rounded-md bg-sky-600 text-white text-[10px] font-mono font-bold uppercase tracking-wider">
                    BLOQUE ETAPA 2
                  </span>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Producto, Material y Medidas
                  </h3>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowQuickTemplatesBar((prev) => !prev)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors inline-flex items-center gap-1 ${
                      showQuickTemplatesBar
                        ? 'bg-sky-600 text-white border-sky-600'
                        : 'bg-white dark:bg-slate-900 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800 hover:bg-sky-50'
                    }`}
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>{showQuickTemplatesBar ? 'Ocultar Plantillas' : '⚡ Plantillas Rápidas (10)'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setNewProdCategory(expressCategory);
                      setNewProdUnit(
                        expressCategory === 'Diseño Gráfico y Branding' ? 'unidad' : 'm2'
                      );
                      setShowNewProductModal(true);
                    }}
                    className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Nuevo Material</span>
                  </button>
                </div>
              </div>

              <div className="p-5 space-y-4">
                {/* Barra Plegable de Plantillas Rápidas (Des-saturación visual) */}
                {showQuickTemplatesBar && (
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block">
                      Elige un producto frecuente para autocompletar material y medida base:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {quickReferenceMaterials.map((item) => {
                        const isSelected = expressMaterialId === item.material.id;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                              handleSelectExpressMaterial(item.material);
                              setExpressUnitMode('m');
                              setExpressWidth(item.defaultW);
                              setExpressHeight(item.defaultH);
                              setExpressSelectedVarIds(item.vars);
                            }}
                            className={`px-2.5 py-1.5 text-xs rounded-lg border transition-colors inline-flex items-center gap-1.5 ${
                              isSelected
                                ? 'bg-sky-600 text-white border-sky-600 font-semibold shadow-2xs'
                                : 'bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-800'
                            }`}
                          >
                            <span>{item.shortLabel}</span>
                            <span
                              className={`font-mono text-[11px] px-1.5 py-0.2 rounded ${
                                isSelected
                                  ? 'bg-sky-700 text-sky-100'
                                  : 'bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300'
                              }`}
                            >
                              ${item.material.suggestedPricePerUnit.toFixed(2)}/{item.material.unit}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Selector de Categoría + Material + Precio Unitario Editable */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="sm:col-span-4">
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Categoría
                  </label>
                  <select
                    value={expressCategory}
                    onChange={(e) => {
                      const newCat = e.target.value as ServiceCategory;
                      setExpressCategory(newCat);
                      const firstMat = customCatalog.find((m) => m.category === newCat);
                      if (firstMat) handleSelectExpressMaterial(firstMat);
                    }}
                    className="w-full px-2.5 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  >
                    <option value="Gran Formato / Gigantografía">Gigantografía / Lonas (Por m²)</option>
                    <option value="Viniles">Viniles Adhesivos / Corte (Por m²)</option>
                    <option value="Rótulos 3D y Estructurados">Rótulos 3D / Alucobond (Por m²)</option>
                    <option value="Corte y Grabado Láser / CNC">Corte y Grabado Láser / CNC (Por Minuto)</option>
                    <option value="Sublimación y Merchandising">Sublimación y Merchandising (Por Escalas)</option>
                    <option value="Señalética y Merchandising">Señalética / PVC / Acrílico (Por m²)</option>
                    <option value="Diseño Gráfico y Branding">Diseño Gráfico (Digital)</option>
                  </select>
                </div>

                <div className="sm:col-span-5">
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Material / Producto del Catálogo
                  </label>
                  <select
                    value={selectedExpressMaterial.id}
                    onChange={(e) => {
                      const found = customCatalog.find((m) => m.id === e.target.value);
                      if (found) handleSelectExpressMaterial(found);
                    }}
                    className="w-full px-2.5 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-semibold"
                  >
                    {customCatalog
                      .filter((m) => m.category === expressCategory)
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} (${m.suggestedPricePerUnit.toFixed(2)}/{m.unit})
                        </option>
                      ))}
                  </select>
                </div>

                <div className="sm:col-span-3">
                  <label className="block text-[11px] font-bold text-blue-700 dark:text-blue-300 mb-1">
                    {expressCalc.isLaserTimeMode
                      ? 'Tarifa ($/minuto)'
                      : `Precio ($/${selectedExpressMaterial.unit})`}
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    min="0.05"
                    value={
                      expressCalc.isLaserTimeMode ? expressLaserRatePerMin : expressUnitPrice
                    }
                    onChange={(e) => {
                      const val = Math.max(0, Number(e.target.value));
                      if (expressCalc.isLaserTimeMode) {
                        setExpressLaserRatePerMin(val);
                        setExpressUnitPrice(val);
                        try {
                          localStorage.setItem('crea_arte_laser_rate_v1', JSON.stringify(val));
                        } catch {
                          // ignore
                        }
                      } else {
                        setExpressUnitPrice(val);
                      }
                      setExpressManualTotalOverride(null);
                    }}
                    className="w-full px-2.5 py-2 text-xs font-mono font-bold bg-blue-50/70 dark:bg-blue-950/50 border border-blue-400 dark:border-blue-700 rounded-lg text-blue-800 dark:text-blue-200"
                  />
                </div>
              </div>

              {/* Aviso interactivo si modificó el precio referencial */}
              {priceDiffersFromCatalog && (
                <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-lg bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/70 text-xs">
                  <span className="text-amber-900 dark:text-amber-200">
                    Cambiaste el precio de{' '}
                    <strong className="font-mono">
                      ${selectedExpressMaterial.suggestedPricePerUnit.toFixed(2)}
                    </strong>{' '}
                    a <strong className="font-mono">${expressUnitPrice.toFixed(2)}</strong>/
                    {selectedExpressMaterial.unit}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSaveExpressPriceToCatalog}
                      className="px-2.5 py-1 text-[11px] font-bold bg-amber-600 hover:bg-amber-700 text-white rounded inline-flex items-center gap-1"
                    >
                      <Save className="w-3 h-3" />
                      <span>Guardar como nuevo precio fijo</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setExpressUnitPrice(selectedExpressMaterial.suggestedPricePerUnit)
                      }
                      className="px-2 py-1 text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:underline"
                    >
                      Restaurar
                    </button>
                  </div>
                </div>
              )}

              {/* Dimensiones / Tiempo Láser / Volumen Sublimación + Botón Directo de Agregar Producto */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <Ruler className="w-3.5 h-3.5 text-blue-600" />
                    <span>
                      {expressCalc.isLaserTimeMode
                        ? 'Modalidad 2: Cobro por Tiempo (Minutos de Láser / CNC + Material)'
                        : expressCalc.isVolumeScaleMode
                        ? 'Modalidad 3: Cobro por Volumen / Escalas + Tallas y Colores'
                        : 'Modalidad 1: Cobro por Dimensión (Ancho × Alto × Cantidad)'}
                    </span>
                  </span>

                  {!expressCalc.isLaserTimeMode && !expressCalc.isVolumeScaleMode && (
                    <div className="flex items-center gap-1.5">
                      {[
                        { label: '1×1m', w: 1.0, h: 1.0 },
                        { label: '2×1m', w: 2.0, h: 1.0 },
                        { label: '2.5×1.2m', w: 2.5, h: 1.2 },
                        { label: '3×1.5m', w: 3.0, h: 1.5 },
                      ].map((preset) => (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => {
                            setExpressUnitMode('m');
                            setExpressWidth(preset.w);
                            setExpressHeight(preset.h);
                            setExpressManualTotalOverride(null);
                          }}
                          className="px-2 py-0.5 text-[10px] font-mono bg-white dark:bg-slate-900 hover:bg-blue-600 hover:text-white border border-slate-200 dark:border-slate-800 rounded text-slate-600 dark:text-slate-300"
                        >
                          {preset.label}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => {
                          if (expressUnitMode === 'm') {
                            setExpressUnitMode('cm');
                            setExpressWidth(Math.round(expressWidth * 100));
                            setExpressHeight(Math.round(expressHeight * 100));
                          } else {
                            setExpressUnitMode('m');
                            setExpressWidth(Number((expressWidth / 100).toFixed(2)));
                            setExpressHeight(Number((expressHeight / 100).toFixed(2)));
                          }
                        }}
                        className="px-2 py-0.5 text-[10px] font-mono font-bold bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 rounded"
                      >
                        {expressUnitMode === 'm' ? 'En Metros (m)' : 'En cm'}
                      </button>
                    </div>
                  )}
                </div>

                {expressCalc.isLaserTimeMode ? (
                  /* MODALIDAD 2: CORTE Y GRABADO LÁSER / CNC (MINUTOS × TARIFA + MATERIAL) */
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                      <div className="sm:col-span-3">
                        <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Minutos Máquina *
                        </label>
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={expressLaserMinutes}
                          onChange={(e) => {
                            setExpressLaserMinutes(Math.max(1, parseInt(e.target.value) || 1));
                            setExpressManualTotalOverride(null);
                          }}
                          className="w-full px-2.5 py-2 text-xs font-mono font-bold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                        />
                      </div>

                      <div className="sm:col-span-3">
                        <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Material / Sustrato ($)
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.5"
                          value={expressLaserMaterialCost}
                          onChange={(e) => {
                            setExpressLaserMaterialCost(Math.max(0, Number(e.target.value)));
                            setExpressManualTotalOverride(null);
                          }}
                          className="w-full px-2.5 py-2 text-xs font-mono font-bold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Lotes / Cant.
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={expressQty}
                          onChange={(e) => {
                            setExpressQty(Math.max(1, parseInt(e.target.value) || 1));
                            setExpressManualTotalOverride(null);
                          }}
                          className="w-full px-2.5 py-2 text-xs font-mono font-bold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white text-center"
                        />
                      </div>

                      <div className="sm:col-span-4 bg-white dark:bg-slate-900 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                        <div>
                          <span className="text-[10px] text-slate-500 block">
                            Tiempo (${expressCalc.laserTimeSubtotal.toFixed(2)}) + Mat.
                          </span>
                          <strong className="text-xs font-mono text-slate-900 dark:text-white">
                            {expressLaserMinutes} min × ${expressLaserRatePerMin.toFixed(2)}
                          </strong>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-slate-500 block">Subtotal Base</span>
                          <strong className="text-xs font-mono text-blue-600 dark:text-blue-400">
                            ${expressCalc.materialBaseSubtotal.toFixed(2)}
                          </strong>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex-1 min-w-[220px]">
                        <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                          Especificación del Material / Plancha (para Orden de Taller):
                        </label>
                        <input
                          type="text"
                          value={expressLaserMaterialLabel}
                          onChange={(e) => setExpressLaserMaterialLabel(e.target.value)}
                          placeholder="Ej. Acrílico Cristal 3mm / MDF 6mm / Alucobond"
                          className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                        />
                      </div>
                      <div className="flex items-center gap-1 pt-3">
                        {[10, 20, 30, 45, 60].map((mins) => (
                          <button
                            key={mins}
                            type="button"
                            onClick={() => {
                              setExpressLaserMinutes(mins);
                              setExpressManualTotalOverride(null);
                            }}
                            className={`px-2 py-1 text-[10px] font-mono rounded border ${
                              expressLaserMinutes === mins
                                ? 'bg-blue-600 text-white border-blue-600 font-bold'
                                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300'
                            }`}
                          >
                            {mins}m
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : expressCalc.isVolumeScaleMode ? (
                  /* MODALIDAD 3: SUBLIMACIÓN Y MERCHANDISING POR VOLUMEN/ESCALAS + TALLAS Y COLORES */
                  <div className="space-y-3">
                    {/* Botones Rápidos de Escalas (1-11, Docena 12+, Ciento 100+) */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {[
                        {
                          label: '1 a 11 Unidades',
                          sub: '0% desc. (Unitario)',
                          sampleQty: 6,
                          active: expressCalc.qty < 12,
                          disc: 0,
                        },
                        {
                          label: `Docena (12 a 99 u.)`,
                          sub: `-${dozenDiscountPct}% desc. automático`,
                          sampleQty: 12,
                          active: expressCalc.qty >= 12 && expressCalc.qty < 100,
                          disc: dozenDiscountPct,
                        },
                        {
                          label: `Ciento (100+ u.)`,
                          sub: `-${hundredDiscountPct}% desc. automático`,
                          sampleQty: 100,
                          active: expressCalc.qty >= 100,
                          disc: hundredDiscountPct,
                        },
                      ].map((tier) => {
                        const tierUnit = Number(
                          (expressUnitPrice * (1 - tier.disc / 100)).toFixed(2)
                        );
                        return (
                          <button
                            key={tier.label}
                            type="button"
                            onClick={() => {
                              setExpressQty(tier.sampleQty);
                              setExpressManualTotalOverride(null);
                            }}
                            className={`p-2.5 rounded-lg border text-left transition-all flex items-center justify-between ${
                              tier.active
                                ? 'bg-emerald-50/90 dark:bg-emerald-950/50 border-emerald-500 text-emerald-950 dark:text-emerald-200 shadow-2xs'
                                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-blue-400'
                            }`}
                          >
                            <div>
                              <div className="text-xs font-bold">{tier.label}</div>
                              <div className="text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold">
                                {tier.sub}
                              </div>
                            </div>
                            <span className="text-xs font-mono font-extrabold bg-white dark:bg-slate-800 px-2 py-1 rounded border border-slate-200 dark:border-slate-700">
                              ${tierUnit.toFixed(2)} c/u
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                      <div className="sm:col-span-3">
                        <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Cantidad Unidades *
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={expressQty}
                          onChange={(e) => {
                            setExpressQty(Math.max(1, parseInt(e.target.value) || 1));
                            setExpressManualTotalOverride(null);
                          }}
                          className="w-full px-2.5 py-2 text-xs font-mono font-bold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white text-center"
                        />
                      </div>

                      <div className="sm:col-span-5">
                        <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Detalle de Tallas / Colores (Pasa a OT Taller) *
                        </label>
                        <input
                          type="text"
                          value={expressSizesAndColors}
                          onChange={(e) => setExpressSizesAndColors(e.target.value)}
                          placeholder="Ej. 4 Talla S, 6 Talla M, 2 Talla L — Blancas y Negras"
                          className="w-full px-2.5 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                        />
                      </div>

                      <div className="sm:col-span-4 bg-white dark:bg-slate-900 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                        <div>
                          <span className="text-[10px] text-slate-500 block">
                            {expressCalc.activeVolumeDiscountPct > 0
                              ? `Ahorro -$${expressCalc.volumeSavingsDollars.toFixed(2)} (-${expressCalc.activeVolumeDiscountPct}%)`
                              : 'Precio Unitario'}
                          </span>
                          <strong className="text-xs font-mono text-emerald-700 dark:text-emerald-400">
                            ${expressCalc.discountedUnitPrice.toFixed(2)} c/u
                          </strong>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-slate-500 block">Subtotal Escala</span>
                          <strong className="text-xs font-mono text-blue-600 dark:text-blue-400">
                            ${expressCalc.materialBaseSubtotal.toFixed(2)}
                          </strong>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : expressCategory === 'Diseño Gráfico y Branding' ? (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-600 dark:text-slate-400">
                      Servicio digital cobrado por unidad/paquete:
                    </span>
                    <div className="flex items-center gap-2">
                      <label className="text-xs font-semibold">Cantidad:</label>
                      <input
                        type="number"
                        min="1"
                        value={expressQty}
                        onChange={(e) => {
                          setExpressQty(Math.max(1, parseInt(e.target.value) || 1));
                          setExpressManualTotalOverride(null);
                        }}
                        className="w-20 px-2.5 py-1.5 text-xs font-mono font-bold text-center bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-12 gap-3 items-end">
                    <div className="sm:col-span-3">
                      <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                        Ancho ({expressUnitMode})
                      </label>
                      <input
                        type="number"
                        step={expressUnitMode === 'm' ? '0.05' : '5'}
                        min="0.05"
                        value={expressWidth}
                        onChange={(e) => {
                          setExpressWidth(Math.max(0.01, Number(e.target.value)));
                          setExpressManualTotalOverride(null);
                        }}
                        className="w-full px-2.5 py-2 text-xs font-mono font-bold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                      />
                    </div>

                    <div className="sm:col-span-3">
                      <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                        Alto ({expressUnitMode})
                      </label>
                      <input
                        type="number"
                        step={expressUnitMode === 'm' ? '0.05' : '5'}
                        min="0.05"
                        value={expressHeight}
                        onChange={(e) => {
                          setExpressHeight(Math.max(0.01, Number(e.target.value)));
                          setExpressManualTotalOverride(null);
                        }}
                        className="w-full px-2.5 py-2 text-xs font-mono font-bold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                        Cantidad
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={expressQty}
                        onChange={(e) => {
                          setExpressQty(Math.max(1, parseInt(e.target.value) || 1));
                          setExpressManualTotalOverride(null);
                        }}
                        className="w-full px-2.5 py-2 text-xs font-mono font-bold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white text-center"
                      />
                    </div>

                    <div className="col-span-3 sm:col-span-4 bg-white dark:bg-slate-900 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-slate-500 block">Área Total</span>
                        <strong className="text-xs font-mono text-slate-900 dark:text-white">
                          {expressCalc.isUnitBased
                            ? `${expressCalc.qty} unid.`
                            : `${expressCalc.totalAreaM2} m²`}
                        </strong>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-slate-500 block">Subtotal Base</span>
                        <strong className="text-xs font-mono text-blue-600 dark:text-blue-400">
                          ${expressCalc.materialBaseSubtotal.toFixed(2)}
                        </strong>
                      </div>
                    </div>
                  </div>
                )}

                {/* Descripción del Trabajo + BOTÓN DESTACADO PARA AGREGAR VARIOS PRODUCTOS */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end pt-2 border-t border-slate-200 dark:border-slate-800">
                  <div className="sm:col-span-7">
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Descripción de este producto para el PDF *
                    </label>
                    <input
                      type="text"
                      value={expressTitle}
                      onChange={(e) => setExpressTitle(e.target.value)}
                      placeholder="Ej. Lona Frontlight impresa en alta resolución con ojalillos"
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-medium"
                    />
                  </div>

                  <div className="sm:col-span-5">
                    <button
                      type="button"
                      onClick={handleAddCurrentItemToMultiQuote}
                      className="w-full py-2 px-3 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg inline-flex items-center justify-center gap-1.5 shadow-2xs transition-colors"
                    >
                      <Plus className="w-4 h-4 shrink-0" />
                      <span>
                        Agregar Producto a la Lista (${currentExpressLineItem.lineTotal.toFixed(2)})
                      </span>
                    </button>
                  </div>
                </div>
              </div>

                {/* Bloque Plegable de Extras / Acabados Opcionales (Evita saturación visual) */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
                  <button
                    type="button"
                    onClick={() => setShowExpressExtrasDrawer((prev) => !prev)}
                    className="w-full flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-800/70 border border-slate-200/80 dark:border-slate-800 text-left transition-colors"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        🛠️ Acabados, Diseño Gráfico, Instalación y Descuento (Opcional)
                      </span>
                      {(expressSelectedVarIds.length > 0 ||
                        expressDesignFee > 0 ||
                        expressInstallFee > 0 ||
                        expressDiscount > 0) && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
                          {expressSelectedVarIds.length} acabado(s) · +$
                          {(
                            expressCalc.variablesSubtotal +
                            expressDesignFee +
                            expressInstallFee -
                            expressDiscount
                          ).toFixed(2)}
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] font-semibold text-sky-600 dark:text-sky-400 inline-flex items-center gap-1 shrink-0">
                      <span>{showExpressExtrasDrawer ? 'Ocultar extras' : 'Configurar extras'}</span>
                      {showExpressExtrasDrawer ? (
                        <ChevronUp className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                    </span>
                  </button>

                  {showExpressExtrasDrawer && (
                    <div className="p-3.5 rounded-xl bg-slate-50/70 dark:bg-slate-950/70 border border-slate-200/80 dark:border-slate-800 space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {expressVariablesCatalog.map((v) => {
                          const isChecked = expressSelectedVarIds.includes(v.id);
                          return (
                            <div
                              key={v.id}
                              className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg border text-xs transition-colors ${
                                isChecked
                                  ? 'bg-sky-50/90 dark:bg-sky-950/50 border-sky-400 dark:border-sky-700 text-slate-900 dark:text-white'
                                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                              }`}
                            >
                              <label className="flex items-center gap-2 cursor-pointer select-none truncate flex-1">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => toggleExpressVariable(v.id)}
                                  className="rounded border-slate-300 text-sky-600"
                                />
                                <span className="truncate font-medium">{v.label}</span>
                              </label>

                              <div className="flex items-center gap-1 shrink-0 font-mono text-[11px]">
                                <span className="text-slate-400">+$</span>
                                <input
                                  type="number"
                                  step="0.5"
                                  min="0"
                                  value={v.rate}
                                  onChange={(e) =>
                                    handleUpdateExpressVariableRate(v.id, Number(e.target.value))
                                  }
                                  className="w-12 px-1 py-0.5 text-right font-mono font-bold bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-white"
                                />
                                <span className="text-[10px] text-slate-400">
                                  /{v.calcType === 'per_m2' ? 'm²' : 'u'}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Fila simple de Diseño, Instalación y Descuento */}
                      <div className="grid grid-cols-3 gap-3 pt-2 border-t border-slate-200/70 dark:border-slate-800">
                        <div>
                          <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                            Diseño Gráfico ($)
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="5"
                            value={expressDesignFee}
                            onChange={(e) => {
                              setExpressDesignFee(Math.max(0, Number(e.target.value)));
                              setExpressManualTotalOverride(null);
                            }}
                            className="w-full px-2.5 py-1.5 text-xs font-mono bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                            Instalación ($)
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="5"
                            value={expressInstallFee}
                            onChange={(e) => {
                              setExpressInstallFee(Math.max(0, Number(e.target.value)));
                              setExpressManualTotalOverride(null);
                            }}
                            className="w-full px-2.5 py-1.5 text-xs font-mono bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                            Descuento ($)
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="5"
                            value={expressDiscount}
                            onChange={(e) => {
                              setExpressDiscount(Math.max(0, Number(e.target.value)));
                              setExpressManualTotalOverride(null);
                            }}
                            className="w-full px-2.5 py-1.5 text-xs font-mono bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ================================================================= */}
          {/* COLUMNA DERECHA (5 cols): BLOQUE ETAPA 3 (LIQUIDACIÓN Y CIERRE)   */}
          {/* ================================================================= */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-white dark:bg-slate-900 border border-emerald-200/90 dark:border-emerald-900/60 rounded-xl overflow-hidden shadow-xs">
              {/* Encabezado Bloque Etapa 3 */}
              <div className="px-5 py-3 bg-emerald-50/70 dark:bg-emerald-950/35 border-b border-emerald-100 dark:border-emerald-900/50 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="px-2 py-0.5 rounded-md bg-emerald-600 text-white text-[10px] font-mono font-bold uppercase tracking-wider">
                    BLOQUE ETAPA 3
                  </span>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Liquidación y Cierre por Etapa
                  </h3>
                </div>
                <span className="text-xs font-mono font-bold text-emerald-700 dark:text-emerald-400">
                  PRO-{nextOrderCode}
                </span>
              </div>

              <div className="p-5 space-y-4">
                {/* Lista de Productos incluidos en la Cotización + Botón Directo para Sumar Varios */}
                <div className="p-3.5 rounded-xl bg-slate-50/90 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      Rubros en esta Proforma ({extraQuoteItems.length + 1})
                    </span>
                    <div className="flex items-center gap-2">
                      {extraQuoteItems.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setExtraQuoteItems([])}
                          className="text-[11px] text-rose-600 hover:underline font-medium"
                        >
                          Vaciar
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={handleAddCurrentItemToMultiQuote}
                        className="px-2.5 py-1 text-[11px] font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg inline-flex items-center gap-1 shadow-2xs"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Sumar otro rubro</span>
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {extraQuoteItems.map((item, idx) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between gap-2 text-xs bg-white dark:bg-slate-900 px-3 py-2 rounded-xl border border-slate-200/80 dark:border-slate-800"
                      >
                        <div className="min-w-0 pr-2">
                          <div className="flex items-center gap-1.5">
                            <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold shrink-0">
                              {idx + 1}
                            </span>
                            <span className="font-semibold text-slate-900 dark:text-white truncate">
                              {item.title}
                            </span>
                          </div>
                          <span className="block text-[10px] text-slate-500 font-mono pl-5 mt-0.5">
                            {item.materialName} · {item.dimensionsText}
                          </span>
                        </div>

                        <div className="flex items-center justify-end gap-2 shrink-0 font-mono">
                          <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-1.5 py-0.5">
                            <span className="text-[10px] text-slate-500">Cant:</span>
                            <input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) =>
                                handleUpdateExtraItemQuantity(item.id, Number(e.target.value))
                              }
                              title="Cantidad de este producto"
                              className="w-10 text-center text-xs font-mono font-bold bg-transparent text-slate-900 dark:text-white focus:outline-none"
                            />
                          </div>

                          <div className="text-right min-w-[68px]">
                            <strong className="text-slate-900 dark:text-white block tabular-nums">
                              ${item.lineTotal.toFixed(2)}
                            </strong>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveExtraItem(item.id)}
                            title="Quitar este producto"
                            className="p-1 text-slate-400 hover:text-rose-600"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}

                    {/* Producto Actual en Edición */}
                    <div className="flex items-center justify-between gap-2 text-xs bg-indigo-50/80 dark:bg-indigo-950/50 px-3 py-2 rounded-xl border border-indigo-200 dark:border-indigo-800">
                      <div className="min-w-0 pr-2">
                        <div className="flex items-center gap-1.5">
                          <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-indigo-600 text-white text-[10px] font-bold shrink-0">
                            {extraQuoteItems.length + 1}
                          </span>
                          <span className="font-bold text-slate-900 dark:text-white truncate">
                            {currentExpressLineItem.title}
                          </span>
                        </div>
                        <span className="block text-[10px] text-indigo-700 dark:text-indigo-300 font-mono pl-5 mt-0.5">
                          {currentExpressLineItem.dimensionsText}
                        </span>
                      </div>

                      <div className="text-right shrink-0 font-mono">
                        <strong className="font-mono tabular-nums text-indigo-700 dark:text-indigo-300 block">
                          ${currentExpressLineItem.lineTotal.toFixed(2)}
                        </strong>
                        <span className="text-[10px] tabular-nums text-indigo-600/80 dark:text-indigo-400 block">
                          Cant: {expressQty}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Desglose Numérico Compacto y Total Final */}
                <div className="p-4 rounded-xl bg-slate-50/90 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 space-y-2 text-xs">
                  <div className="flex justify-between text-slate-600 dark:text-slate-400">
                    <span>Subtotal Base ({expressCalc.dimensionsText}):</span>
                    <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-white">
                      ${expressCalc.materialBaseSubtotal.toFixed(2)}
                    </span>
                  </div>

                  {(expressCalc.variablesSubtotal > 0 ||
                    expressDesignFee > 0 ||
                    expressInstallFee > 0) && (
                    <div className="flex justify-between text-slate-600 dark:text-slate-400">
                      <span>+ Acabados / Diseño / Instalación:</span>
                      <span className="font-mono tabular-nums text-slate-900 dark:text-white">
                        +$
                        {(
                          expressCalc.variablesSubtotal +
                          expressDesignFee +
                          expressInstallFee
                        ).toFixed(2)}
                      </span>
                    </div>
                  )}

                  {expressCalc.extraItemsSum > 0 && (
                    <div className="flex justify-between text-indigo-700 dark:text-indigo-300 font-medium">
                      <span>+ Rubros adicionales ({extraQuoteItems.length}):</span>
                      <span className="font-mono tabular-nums">
                        +${expressCalc.extraItemsSum.toFixed(2)}
                      </span>
                    </div>
                  )}

                  {expressDiscount > 0 && (
                    <div className="flex justify-between text-rose-600">
                      <span>- Descuento aplicado:</span>
                      <span className="font-mono tabular-nums">-${expressDiscount.toFixed(2)}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400">
                    <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={expressIncludeIva}
                        onChange={(e) => {
                          setExpressIncludeIva(e.target.checked);
                          setExpressManualTotalOverride(null);
                        }}
                        className="rounded border-slate-300 text-indigo-600"
                      />
                      <span>Incluir IVA (15%)</span>
                    </label>
                    <span className="font-mono tabular-nums text-slate-900 dark:text-white">
                      ${expressCalc.ivaAmount.toFixed(2)}
                    </span>
                  </div>

                  {/* Total Final Editable */}
                  <div className="pt-2.5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
                    <div>
                      <span className="text-xs font-extrabold uppercase tracking-wider text-slate-900 dark:text-white block">
                        TOTAL PROFORMA ($)
                      </span>
                      <span className="text-[11px] font-mono tabular-nums text-amber-700 dark:text-amber-400 font-semibold">
                        50% Anticipo req.: ${expressCalc.advance50.toFixed(2)}
                      </span>
                    </div>

                    <div className="w-36">
                      {expressManualTotalOverride !== null && (
                        <button
                          type="button"
                          onClick={() => setExpressManualTotalOverride(null)}
                          className="text-[10px] font-mono text-indigo-600 hover:underline block text-right mb-0.5"
                        >
                          Restaurar cálculo
                        </button>
                      )}
                      <input
                        type="number"
                        step="0.5"
                        min="1"
                        required
                        value={expressCalc.finalTotal}
                        onChange={(e) =>
                          setExpressManualTotalOverride(Math.max(0, Number(e.target.value)))
                        }
                        className="w-full px-3 py-2 text-right text-lg font-mono tabular-nums font-extrabold bg-white dark:bg-slate-900 border border-indigo-400 dark:border-indigo-700 rounded-xl text-indigo-700 dark:text-indigo-300"
                      />
                    </div>
                  </div>
                </div>

                {/* ============================================================= */}
                {/* BLOQUES DIFERENCIADOS SEGÚN LA ETAPA EN LA QUE ESTÁ EL CLIENTE */}
                {/* ============================================================= */}
                <div className="space-y-3 pt-1">
                  {/* BLOQUE DE ETAPA COMERCIAL A: CLIENTE EN ETAPA DE COTIZACIÓN */}
                  <div className="p-3.5 rounded-xl bg-amber-50/55 dark:bg-amber-950/20 border border-amber-200/90 dark:border-amber-900/60 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-900 dark:text-amber-300 text-[10px] font-mono font-bold uppercase tracking-wider">
                        ETAPA A · SOLO COTIZACIÓN
                      </span>
                      <span className="text-[10px] text-amber-800 dark:text-amber-300 font-medium">
                        Sin pasar a taller aún
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300">
                      El cliente está evaluando precios. Envía la Proforma A4 por WhatsApp:
                    </p>
                    <button
                      type="button"
                      onClick={handleDownloadPdfAndSendWhatsApp}
                      className="w-full py-2.5 px-4 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-xs shadow-emerald-600/20"
                    >
                      <MessageSquare className="w-4 h-4" />
                      <span>Descargar PDF y Enviar por WhatsApp</span>
                    </button>

                    <div className="grid grid-cols-3 gap-1.5">
                      <button
                        type="button"
                        onClick={handleDownloadPdfQuote}
                        className="py-1.5 px-2 text-[11px] font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 hover:bg-slate-50 border border-slate-200 dark:border-slate-800 rounded-lg inline-flex items-center justify-center gap-1"
                      >
                        <FileDown className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                        <span>Solo PDF</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setShowProformaModal(true)}
                        className="py-1.5 px-2 text-[11px] font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 hover:bg-slate-50 border border-slate-200 dark:border-slate-800 rounded-lg inline-flex items-center justify-center gap-1"
                      >
                        <Eye className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                        <span>Ver A4</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setShowProformaTemplateEditor(true)}
                        className="py-1.5 px-2 text-[11px] font-semibold text-indigo-700 dark:text-indigo-300 bg-white dark:bg-slate-900 hover:bg-indigo-50 border border-indigo-200 dark:border-indigo-800/70 rounded-lg inline-flex items-center justify-center gap-1"
                        title="Editar Encabezado, Bancos y Datos de la Proforma"
                      >
                        <SlidersHorizontal className="w-3.5 h-3.5 shrink-0" />
                        <span>Membrete</span>
                      </button>
                    </div>
                  </div>

                  {/* BLOQUE DE ETAPA COMERCIAL B: CLIENTE YA APROBÓ -> PASA A TALLER */}
                  <div className="p-3.5 rounded-xl bg-indigo-50/65 dark:bg-indigo-950/30 border border-indigo-200/90 dark:border-indigo-800/70 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="px-2 py-0.5 rounded bg-indigo-600 text-white text-[10px] font-mono font-bold uppercase tracking-wider">
                        ETAPA B · PEDIDO APROBADO
                      </span>
                      <span className="text-[10px] text-indigo-800 dark:text-indigo-300 font-semibold">
                        Pasa a Diseño / Taller
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2 bg-white dark:bg-slate-900 px-3 py-2 rounded-xl border border-indigo-200/80 dark:border-indigo-800">
                      <div>
                        <label className="text-[11px] font-bold text-slate-800 dark:text-slate-200 block">
                          Anticipo Recibido Hoy ($)
                        </label>
                        <div className="flex gap-1.5 text-[10px] font-mono mt-0.5">
                          <button
                            type="button"
                            onClick={() => setExpressAdvance(0)}
                            className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold"
                          >
                            $0
                          </button>
                          <button
                            type="button"
                            onClick={() => setExpressAdvance(expressCalc.advance50)}
                            className="px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold"
                          >
                            50% (${expressCalc.advance50.toFixed(0)})
                          </button>
                          <button
                            type="button"
                            onClick={() => setExpressAdvance(expressCalc.finalTotal)}
                            className="px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold"
                          >
                            100%
                          </button>
                        </div>
                      </div>
                      <input
                        type="number"
                        step="1"
                        min="0"
                        value={expressAdvance}
                        onChange={(e) => setExpressAdvance(Math.max(0, Number(e.target.value)))}
                        className="w-28 px-2.5 py-1.5 text-right text-sm font-mono tabular-nums font-extrabold bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-emerald-700 dark:text-emerald-400"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full py-2.5 px-4 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition-all duration-200 inline-flex items-center justify-center gap-1.5 shadow-xs shadow-indigo-500/20"
                    >
                      <FileCheck2 className="w-4 h-4" />
                      <span>Aprobar y Crear Orden ({nextOrderCode}) en Taller</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </form>
      )}


      {/* ===================================================================== */}
      {/* MODO 2: COTIZADOR TÉCNICO POR MEDIDAS (m², ESTRUCTURA Y PROFORMA PDF) */}
      {/* ===================================================================== */}
      {quoterMode === 'technical' && (
        <>
          {/* Plantillas Rápidas de Rótulos */}
          <div className="flex flex-wrap items-center justify-between gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1 mr-1">
                <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                <span>Plantillas Técnicas:</span>
              </span>
              {(
                [
                  { id: 'logo_branding', label: 'Diseño de Logo / Branding' },
                  { id: 'caja_luz_backlight', label: 'Caja de Luz LED' },
                  { id: 'rotulo_3d_alucobond', label: 'Rótulo Alucobond 3D' },
                  { id: 'rotulo_estructura_lona', label: 'Estructura + Lona' },
                  { id: 'letras_acrilico_led', label: 'Letras Acrílico LED' },
                ] as const
              ).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => applySignPreset(p.id)}
                  className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                    p.id === 'logo_branding'
                      ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-600 hover:text-white'
                      : 'bg-slate-100 dark:bg-slate-800 hover:bg-blue-600 hover:text-white text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={handleAddCurrentItemToMultiQuote}
              className="px-3 py-1 text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 border border-blue-200 dark:border-blue-800 rounded inline-flex items-center gap-1.5"
              title="Agrega este rubro a la lista para cotizar varios trabajos en un mismo PDF"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Sumar rubro a la misma Proforma ({extraQuoteItems.length + 1})</span>
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* Panel Izquierdo Compacto (7 cols) */}
            <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 space-y-4">
              {/* Categorías */}
              <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-slate-950 rounded-md border border-slate-200 dark:border-slate-800">
                {(
                  [
                    'Diseño Gráfico y Branding',
                    'Gran Formato / Gigantografía',
                    'Viniles',
                    'Rótulos 3D y Estructurados',
                    'Señalética y Merchandising',
                  ] as ServiceCategory[]
                ).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => handleCategoryChange(cat)}
                    className={`px-2.5 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                      category === cat
                        ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs font-semibold border border-slate-200/80 dark:border-slate-700'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Fila 1: Cliente, RUC, Teléfono y Proyecto */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="sm:col-span-4">
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400">
                      Cliente / Empresa
                    </label>
                    {clients.length > 0 && (
                      <select
                        onChange={(e) => {
                          const found = clients.find((c) => c.id === e.target.value);
                          if (found) {
                            setClientName(found.name);
                            setClientPhone(found.phone);
                            setClientRuc(found.ruc);
                          }
                        }}
                        value=""
                        className="text-[10px] bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-1.5 py-0.5 text-blue-600 dark:text-blue-400 font-medium"
                      >
                        <option value="" disabled>
                          Elegir CRM...
                        </option>
                        {clients.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                  <input
                    type="text"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-white"
                  />
                </div>
                <div className="sm:col-span-3">
                  <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                    WhatsApp Cliente
                  </label>
                  <input
                    type="text"
                    value={clientPhone}
                    onChange={(e) => setClientPhone(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-white"
                  />
                </div>
                <div className="sm:col-span-5">
                  <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Título del Rubro ({nextOrderCode})
                  </label>
                  <input
                    type="text"
                    value={projectTitle}
                    onChange={(e) => setProjectTitle(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Fila 2: Servicio / Sustrato + Medidas o Horas de Diseño */}
              {category === 'Diseño Gráfico y Branding' ? (
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                  <div className="sm:col-span-7">
                    <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                      Servicio Digital / Branding
                    </label>
                    <select
                      value={selectedMaterial.id}
                      onChange={(e) => setMaterialId(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-white"
                    >
                      {filteredMaterials.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} (Sugerido: ${m.suggestedPricePerUnit})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-3">
                    <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                      Horas Diseño Creativo
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min="0.5"
                      value={designHours}
                      onChange={(e) => setDesignHours(Math.max(0.5, Number(e.target.value)))}
                      className="w-full px-2.5 py-1.5 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-white"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                      Paquetes
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={quantity}
                      onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full px-2 py-1.5 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-12 gap-3 items-end">
                  <div className="col-span-2 sm:col-span-5">
                    <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                      Material / Sistema Base
                    </label>
                    <select
                      value={selectedMaterial.id}
                      onChange={(e) => setMaterialId(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-white"
                    >
                      {filteredMaterials.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} (${m.suggestedPricePerUnit}/{m.unit})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
                        Ancho
                      </span>
                      <button
                        type="button"
                        onClick={() => setUnitMode(unitMode === 'm' ? 'cm' : 'm')}
                        className="text-[10px] font-mono text-blue-600 underline"
                      >
                        ({unitMode})
                      </button>
                    </div>
                    <input
                      type="number"
                      step={unitMode === 'm' ? '0.1' : '10'}
                      min="0.05"
                      value={widthInput}
                      onChange={(e) => setWidthInput(Math.max(0.01, Number(e.target.value)))}
                      className="w-full px-2.5 py-1.5 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-white"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                      Alto ({unitMode})
                    </label>
                    <input
                      type="number"
                      step={unitMode === 'm' ? '0.1' : '10'}
                      min="0.05"
                      value={heightInput}
                      onChange={(e) => setHeightInput(Math.max(0.01, Number(e.target.value)))}
                      className="w-full px-2.5 py-1.5 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-white"
                    />
                  </div>
                  <div className="sm:col-span-1">
                    <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                      Cant.
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={quantity}
                      onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full px-2 py-1.5 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-white"
                    />
                  </div>
                  <div className="sm:col-span-2 bg-slate-100 dark:bg-slate-950 px-2.5 py-1.5 rounded border border-slate-200 dark:border-slate-800 text-right font-mono">
                    <span className="text-[10px] text-slate-500 block">Área Total</span>
                    <strong className="text-xs text-slate-900 dark:text-white">
                      {calc.totalAreaM2} m²
                    </strong>
                  </div>
                </div>
              )}

              {/* Línea Resumida de Ingeniería (Estructura + LED) o Aviso de Flujo Digital */}
              <div className="space-y-2 pt-1">
                {category === 'Diseño Gráfico y Branding' ? (
                  <div className="text-[11px] bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900/60 px-3 py-2 rounded text-indigo-800 dark:text-indigo-200 flex flex-wrap items-center justify-between gap-2">
                    <span>
                      <strong>Ruta Rápida Digital:</strong> Salta Impresión y Taller en el Kanban → directo a Entrega Digital.
                    </span>
                    <span className="font-mono text-[10px]">0% Merma · Sin consumo stock</span>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono bg-slate-50 dark:bg-slate-950 px-3 py-1.5 rounded border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400">
                    <span className="inline-flex items-center gap-1">
                      <Wrench className="w-3.5 h-3.5 text-blue-600" />
                      Estructura: <strong>{calc.totalTubeMeters}m</strong> ({calc.tubes6mNeeded}{' '}
                      tubos 6m)
                    </span>
                    <span>·</span>
                    <span className="inline-flex items-center gap-1">
                      <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
                      Iluminación: <strong>~{calc.estimatedLedModules} LED</strong> +{' '}
                      <strong>{calc.estimatedPowerSupplies12V} fuente(s)</strong>
                    </span>
                  </div>
                )}

                <div className="flex flex-wrap gap-1.5">
                  {(FINISHING_OPTIONS[category] || []).map((fin) => {
                    const active = selectedFinishings.includes(fin.label);
                    return (
                      <button
                        key={fin.label}
                        type="button"
                        onClick={() => toggleFinishing(fin.label)}
                        className={`px-2.5 py-1 text-xs rounded border transition-colors ${
                          active
                            ? 'bg-blue-600 text-white border-blue-600 font-medium'
                            : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-400'
                        }`}
                      >
                        {fin.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Lista de Rubros Adicionales si el usuario sumó más de 1 ítem al mismo PDF */}
              {extraQuoteItems.length > 0 && (
                <div className="p-3 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/60 rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-blue-900 dark:text-blue-200">
                      Rubros incluidos en esta misma Proforma PDF ({extraQuoteItems.length + 1} ítems):
                    </span>
                    <button
                      type="button"
                      onClick={() => setExtraQuoteItems([])}
                      className="text-[11px] text-rose-600 hover:underline"
                    >
                      Limpiar adicionales
                    </button>
                  </div>
                  <div className="space-y-1.5">
                    {extraQuoteItems.map((item, idx) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between text-xs bg-white dark:bg-slate-900 px-2.5 py-1.5 rounded border border-slate-200 dark:border-slate-800"
                      >
                        <div className="truncate pr-2">
                          <span className="font-bold text-slate-800 dark:text-slate-200">
                            {idx + 1}. {item.title}
                          </span>{' '}
                          <span className="text-slate-500 text-[11px]">
                            ({item.dimensionsText} · Cant: {item.quantity})
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-mono font-bold text-slate-900 dark:text-white">
                            ${item.lineTotal.toFixed(2)}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveExtraItem(item.id)}
                            className="text-slate-400 hover:text-rose-600"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                    <div className="flex items-center justify-between text-xs bg-blue-100/60 dark:bg-blue-950/60 px-2.5 py-1.5 rounded border border-blue-300 dark:border-blue-800">
                      <span className="font-semibold text-blue-950 dark:text-blue-200">
                        {extraQuoteItems.length + 1}. {currentTechnicalLineItem.title} (Editando ahora)
                      </span>
                      <span className="font-mono font-bold text-blue-700 dark:text-blue-300">
                        ${currentTechnicalLineItem.lineTotal.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Fila Rápida: Instalación, Plazo y Anticipo */}
              <div className="grid grid-cols-3 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Instalación Sitio ($)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="5"
                    value={installationFee}
                    onChange={(e) => setInstallationFee(Math.max(0, Number(e.target.value)))}
                    className="w-full px-2.5 py-1.5 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Plazo Entrega (Días)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={deadlineDays}
                    onChange={(e) => setDeadlineDays(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full px-2.5 py-1.5 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400">
                      Anticipo Recibido ($)
                    </label>
                    <button
                      type="button"
                      onClick={() => setInitialAdvance(calc.suggestedAdvance50)}
                      className="text-[10px] font-mono text-blue-600 hover:underline"
                    >
                      50% (${calc.suggestedAdvance50})
                    </button>
                  </div>
                  <input
                    type="number"
                    min="0"
                    step="5"
                    value={initialAdvance}
                    onChange={(e) => setInitialAdvance(Math.max(0, Number(e.target.value)))}
                    placeholder={`50%: $${calc.suggestedAdvance50}`}
                    className="w-full px-2.5 py-1.5 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Detalles Bancarios Compactos cuando hay Anticipo > 0 */}
              {initialAdvance > 0 && (
                <div className="p-2.5 bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/60 rounded-md space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-emerald-800 dark:text-emerald-300">
                      Anticipo: ${initialAdvance.toFixed(2)} ({paymentMethod})
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowAuditBankFields(!showAuditBankFields)}
                      className="text-[11px] text-emerald-700 dark:text-emerald-400 underline"
                    >
                      {showAuditBankFields ? 'Ocultar detalle banco/doc' : 'Detallar Banco / N° Ref'}
                    </button>
                  </div>
                  {showAuditBankFields && (
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 pt-1">
                      <select
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value as any)}
                        className="px-2 py-1 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded"
                      >
                        <option value="Transferencia Bancaria">Transferencia</option>
                        <option value="Efectivo">Efectivo</option>
                        <option value="Tarjeta">Tarjeta POS</option>
                      </select>
                      <select
                        value={advanceBank}
                        onChange={(e) => setAdvanceBank(e.target.value)}
                        className="px-2 py-1 text-xs font-mono bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded"
                      >
                        {BANK_ACCOUNTS_CATALOG.map((b) => (
                          <option key={b} value={b}>
                            {b}
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        value={advanceRefNumber}
                        onChange={(e) => setAdvanceRefNumber(e.target.value)}
                        placeholder="Ref / Comprobante"
                        className="px-2 py-1 text-xs font-mono bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded"
                      />
                      <input
                        type="text"
                        value={advanceInvoiceDoc}
                        onChange={(e) => setAdvanceInvoiceDoc(e.target.value)}
                        placeholder="Factura SRI"
                        className="px-2 py-1 text-xs font-mono bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Selector Compacto de Responsables */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1 mr-1">
                    <Users className="w-3.5 h-3.5 text-blue-600" />
                    <span>Equipo:</span>
                  </span>
                  {users.map((u) => {
                    const isAssigned = teamAssignments.some((a) => a.userId === u.id);
                    return (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => toggleTeamMember(u)}
                        className={`px-2 py-1 text-xs rounded border transition-colors inline-flex items-center gap-1 ${
                          isAssigned
                            ? 'bg-blue-600 text-white border-blue-600 font-medium'
                            : 'bg-slate-50 dark:bg-slate-950 border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        <span>{isAssigned ? '✓' : '+'}</span>
                        <span>{u.name.split(' ')[0]}</span>
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={() => setShowAdvancedParams(!showAdvancedParams)}
                  className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-white inline-flex items-center gap-1"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5 text-blue-600" />
                  <span>Margen ({profitMarginPercent}%) / Hrs</span>
                  {showAdvancedParams ? (
                    <ChevronUp className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>

              {showAdvancedParams && (
                <div className="p-3 bg-slate-50/70 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-md space-y-2.5">
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                    <div>
                      <label className="block text-[10px] text-slate-500 mb-0.5">Hrs Diseño</label>
                      <input
                        type="number"
                        step="0.5"
                        value={designHours}
                        onChange={(e) => setDesignHours(Math.max(0, Number(e.target.value)))}
                        className="w-full px-2 py-1 text-xs font-mono bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-500 mb-0.5">Hrs Taller</label>
                      <input
                        type="number"
                        step="0.5"
                        value={machineHours}
                        onChange={(e) => setMachineHours(Math.max(0, Number(e.target.value)))}
                        className="w-full px-2 py-1 text-xs font-mono bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-500 mb-0.5">Hrs Montaje</label>
                      <input
                        type="number"
                        step="0.5"
                        value={installHours}
                        onChange={(e) => setInstallHours(Math.max(0, Number(e.target.value)))}
                        className="w-full px-2 py-1 text-xs font-mono bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-500 mb-0.5">Merma (%)</label>
                      <input
                        type="number"
                        disabled={!canSeeInternalCosts}
                        value={wastePercent}
                        onChange={(e) => setWastePercent(Math.max(0, Number(e.target.value)))}
                        className="w-full px-2 py-1 text-xs font-mono bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded disabled:opacity-50"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-500 mb-0.5">Margen (%)</label>
                      <input
                        type="number"
                        disabled={!canSeeInternalCosts}
                        value={profitMarginPercent}
                        onChange={(e) =>
                          setProfitMarginPercent(Math.min(80, Math.max(15, Number(e.target.value))))
                        }
                        className="w-full px-2 py-1 text-xs font-mono bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded disabled:opacity-50"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-0.5">
                      Observaciones Técnicas para la Proforma PDF
                    </label>
                    <input
                      type="text"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="w-full px-2.5 py-1 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Panel Derecho Compacto: Liquidación, Descarga PDF y Envío WhatsApp (5 cols) */}
            <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 space-y-4">
              {canSeeInternalCosts ? (
                <div className="p-2.5 bg-slate-50 dark:bg-slate-950 rounded border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-600 dark:text-slate-400">
                    Costo Taller: <strong>${calc.totalInternalCost.toFixed(2)}</strong>
                  </span>
                  <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                    Utilidad Neta: ${calc.netProfitDollars.toFixed(2)} ({calc.realMarginPct}%)
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <EyeOff className="w-3.5 h-3.5 shrink-0" />
                  <span>Vista Comercial (Costos internos ocultos)</span>
                </div>
              )}

              <div className="space-y-2 text-xs">
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>
                    Subtotal Producción ({extraQuoteItems.length + 1} rubro
                    {extraQuoteItems.length > 0 ? 's' : ''}) + Instalación
                  </span>
                  <span className="font-mono font-semibold text-slate-900 dark:text-white">
                    ${calc.subtotalBeforeDiscount.toFixed(2)}
                  </span>
                </div>

                <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                  <span>Descuento Comercial ($)</span>
                  <input
                    type="number"
                    min="0"
                    step="5"
                    value={discountAmount}
                    onChange={(e) => setDiscountAmount(Math.max(0, Number(e.target.value)))}
                    className="w-20 px-2 py-1 text-right text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-white"
                  />
                </div>

                <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                  <label className="flex items-center gap-1.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={includeIva}
                      onChange={(e) => setIncludeIva(e.target.checked)}
                      className="rounded border-slate-300 text-blue-600"
                    />
                    <span>IVA (15%)</span>
                  </label>
                  <span className="font-mono text-slate-900 dark:text-white">
                    ${calc.ivaAmount.toFixed(2)}
                  </span>
                </div>

                <div className="pt-2.5 border-t border-slate-200 dark:border-slate-800 flex items-baseline justify-between">
                  <div>
                    <span className="text-sm font-bold text-slate-900 dark:text-white">
                      Total Proforma (PRO-{nextOrderCode})
                    </span>
                    <span className="block text-[11px] font-mono text-slate-500">
                      Anticipo 50%: ${calc.suggestedAdvance50.toFixed(2)}
                    </span>
                  </div>
                  <span className="text-2xl font-bold font-mono text-blue-600 dark:text-blue-400">
                    ${calc.finalTotal.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Bloque Principal de Acciones: PDF + WhatsApp + Kanban */}
              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  onClick={handleDownloadPdfAndSendWhatsApp}
                  className="w-full py-2.5 px-4 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-md transition-colors flex items-center justify-center gap-2 shadow-2xs"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>Descargar PDF + Enviar al Cliente por WhatsApp</span>
                </button>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleDownloadPdfQuote}
                    className="py-2 px-3 text-xs font-bold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 border border-rose-200 dark:border-rose-800 rounded-md inline-flex items-center justify-center gap-1.5"
                  >
                    <FileDown className="w-3.5 h-3.5" />
                    <span>Descargar PDF (.pdf)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowProformaModal(true)}
                    className="py-2 px-3 text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 border border-blue-200 dark:border-blue-800 rounded-md inline-flex items-center justify-center gap-1.5"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Ver Proforma A4</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setShowProformaTemplateEditor(true)}
                  className="w-full py-1.5 px-3 text-[11px] font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50/70 dark:bg-indigo-950/30 hover:bg-indigo-100 border border-indigo-200 dark:border-indigo-800/70 rounded-md inline-flex items-center justify-center gap-1.5"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span>⚙️ Editar Encabezado, Bancos y Datos de la Proforma</span>
                </button>

                <button
                  type="button"
                  onClick={handleCreateOrder}
                  className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors flex items-center justify-center gap-2"
                >
                  <FileCheck2 className="w-4 h-4" />
                  <span>Convertir en Orden de Trabajo ({nextOrderCode})</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleCopyWhatsApp}
                    className="py-1.5 px-3 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md inline-flex items-center justify-center gap-1.5"
                  >
                    {copiedWhatsApp ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Texto Copiado</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copiar Resumen WA</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowWhatsAppPreview(!showWhatsAppPreview)}
                    className="py-1.5 px-3 text-xs font-medium text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-md"
                  >
                    {showWhatsAppPreview ? 'Ocultar Texto' : 'Ver Texto WhatsApp'}
                  </button>
                </div>
              </div>

              {showWhatsAppPreview && (
                <pre className="p-3 text-[11px] leading-relaxed font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                  {whatsappMessage}
                </pre>
              )}
            </div>
          </div>
        </>
      )}

      {/* ===================================================================== */}
      {/* MODO 3: TARIFARIO RÁPIDO EDITABLE (CAMBIAR PRECIOS EN 1 TABLA)        */}
      {/* ===================================================================== */}
      {quoterMode === 'pricelist' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl shadow-xs p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3.5">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Tarifario de Precios Base por Modalidad (Dimensión m² · Minutos Láser · Escalas Sublimación)
              </h3>
              <p className="text-xs text-slate-500">
                Cualquier cambio aquí actualiza al instante los precios referenciales del Cotizador Rápido y del Cotizador Técnico.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowNewProductModal(true)}
              className="px-3.5 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-xs shadow-indigo-500/20 inline-flex items-center gap-1.5 shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Agregar Nuevo Material al Tarifario</span>
            </button>
          </div>

          {/* Parámetros Rápidos de Láser ($/min) y Escalas de Sublimación (Docena / Ciento) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 p-4 rounded-xl bg-slate-50/80 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 text-xs">
            <div className="flex items-center justify-between gap-2">
              <div>
                <span className="font-bold text-slate-800 dark:text-slate-200 block">
                  ⚡ Tarifa Láser / CNC ($/min)
                </span>
                <span className="text-[11px] text-slate-500">
                  Minutos de máquina × tarifa + material
                </span>
              </div>
              <div className="flex items-center gap-1 font-mono">
                <span>$</span>
                <input
                  type="number"
                  step="0.05"
                  min="0.1"
                  value={expressLaserRatePerMin}
                  onChange={(e) => {
                    const val = Math.max(0.05, Number(e.target.value));
                    setExpressLaserRatePerMin(val);
                    try {
                      localStorage.setItem('crea_arte_laser_rate_v1', JSON.stringify(val));
                    } catch {
                      // ignore
                    }
                  }}
                  className="w-16 px-2 py-1 text-right font-bold bg-white dark:bg-slate-900 border border-indigo-400 rounded-lg text-indigo-700 dark:text-indigo-300"
                />
                <span className="text-[10px] text-slate-400">/min</span>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2">
              <div>
                <span className="font-bold text-slate-800 dark:text-slate-200 block">
                  📦 Descuento Docena (12–99 u.)
                </span>
                <span className="text-[11px] text-slate-500">
                  Sublimación y Merchandising
                </span>
              </div>
              <div className="flex items-center gap-1 font-mono">
                <input
                  type="number"
                  step="1"
                  min="0"
                  max="60"
                  value={dozenDiscountPct}
                  onChange={(e) => {
                    const val = Math.max(0, Number(e.target.value));
                    setDozenDiscountPct(val);
                    try {
                      localStorage.setItem('crea_arte_sub_dozen_disc_v1', JSON.stringify(val));
                    } catch {
                      // ignore
                    }
                  }}
                  className="w-14 px-2 py-1 text-right font-bold bg-white dark:bg-slate-900 border border-emerald-400 rounded-lg text-emerald-700 dark:text-emerald-300"
                />
                <span className="text-[10px] text-slate-400">%</span>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2">
              <div>
                <span className="font-bold text-slate-800 dark:text-slate-200 block">
                  🏭 Descuento Ciento (100+ u.)
                </span>
                <span className="text-[11px] text-slate-500">
                  Sublimación por volumen mayorista
                </span>
              </div>
              <div className="flex items-center gap-1 font-mono">
                <input
                  type="number"
                  step="1"
                  min="0"
                  max="70"
                  value={hundredDiscountPct}
                  onChange={(e) => {
                    const val = Math.max(0, Number(e.target.value));
                    setHundredDiscountPct(val);
                    try {
                      localStorage.setItem('crea_arte_sub_hundred_disc_v1', JSON.stringify(val));
                    } catch {
                      // ignore
                    }
                  }}
                  className="w-14 px-2 py-1 text-right font-bold bg-white dark:bg-slate-900 border border-emerald-400 rounded-lg text-emerald-700 dark:text-emerald-300"
                />
                <span className="text-[10px] text-slate-400">%</span>
              </div>
            </div>
          </div>

          <div className="border border-slate-200/80 dark:border-slate-800 rounded-xl overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/90 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400">
                <tr>
                  <th className="py-3 px-3.5">Servicio / Material</th>
                  <th className="py-3 px-3.5">Categoría</th>
                  <th className="py-3 px-3.5">Modalidad / Unidad</th>
                  {canSeeInternalCosts && (
                    <th className="py-3 px-3.5 text-right w-36">Costo Base ($)</th>
                  )}
                  <th className="py-3 px-3.5 text-right w-40">Precio Ref. Venta ($)</th>
                  <th className="py-3 px-3.5 text-right w-32">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/80 dark:divide-slate-800">
                {customCatalog.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                    <td className="py-2.5 px-3.5 font-semibold text-slate-900 dark:text-white">
                      {item.name}
                    </td>
                    <td className="py-2.5 px-3.5 text-slate-500 dark:text-slate-400">
                      {item.category}
                    </td>
                    <td className="py-2.5 px-3.5 font-mono text-slate-500">
                      {item.category === 'Corte y Grabado Láser / CNC' || item.unit === 'minuto' ? (
                        <span className="px-2.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-[10px] font-bold">
                          Por Tiempo ({item.unit})
                        </span>
                      ) : item.category === 'Sublimación y Merchandising' ||
                        item.pricingMode === 'volume_scale' ? (
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold">
                          Escalas 1-11 / 12+ / 100+
                        </span>
                      ) : (
                        <span>Por Dimensión ({item.unit})</span>
                      )}
                    </td>
                    {canSeeInternalCosts && (
                      <td className="py-2.5 px-3.5 text-right">
                        <input
                          type="number"
                          step="0.05"
                          min="0"
                          value={item.baseCostPerUnit}
                          onChange={(e) =>
                            handleInlinePriceUpdate(
                              item.id,
                              'baseCostPerUnit',
                              Number(e.target.value)
                            )
                          }
                          className="w-24 px-2 py-1 text-right font-mono tabular-nums text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                        />
                      </td>
                    )}
                    <td className="py-2.5 px-3.5 text-right">
                      <input
                        type="number"
                        step="0.05"
                        min="0.05"
                        value={item.suggestedPricePerUnit}
                        onChange={(e) =>
                          handleInlinePriceUpdate(
                            item.id,
                            'suggestedPricePerUnit',
                            Number(e.target.value)
                          )
                        }
                        className="w-28 px-2 py-1 text-right font-mono tabular-nums font-bold text-xs bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-300 dark:border-indigo-800 rounded-lg text-indigo-700 dark:text-indigo-300"
                      />
                    </td>
                    <td className="py-2.5 px-3.5 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            handleSelectExpressMaterial(item);
                            setQuoterMode('express');
                          }}
                          className="px-2.5 py-1 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950 rounded-lg"
                        >
                          Usar en Rápido
                        </button>
                        {item.id.startsWith('mat-custom-') && (
                          <button
                            type="button"
                            onClick={() => handleDeleteCustomProduct(item.id)}
                            className="p-1 text-slate-400 hover:text-rose-600"
                            title="Eliminar producto personalizado"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODO 4: EMBUDO DE VENTAS Y COTIZACIONES ORGANIZADO POR BLOQUES ETAPA  */}
      {/* ===================================================================== */}
      {quoterMode === 'history' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-5 space-y-5 shadow-xs">
          {/* Encabezado y Selector de Vista (Por Bloques de Etapa vs Tabla Compacta) */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3.5">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span>
                  Embudo de Ventas y Cotizaciones Separado por Bloques de Etapa ({allQuotesList.length})
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Cada cotización y orden se agrupa visualmente según la etapa en la que se encuentra para evitar saturación.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <div className="inline-flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setHistoryViewMode('stage_blocks')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    historyViewMode === 'stage_blocks'
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  🧱 Bloques por Etapa
                </button>
                <button
                  type="button"
                  onClick={() => setHistoryViewMode('compact_table')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    historyViewMode === 'compact_table'
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  📋 Tabla Compacta
                </button>
              </div>

              {onOpenKanban && (
                <button
                  type="button"
                  onClick={onOpenKanban}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-xl inline-flex items-center gap-1.5"
                >
                  <FolderKanban className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Tablero Taller</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setQuoterMode('express')}
                className="px-3.5 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-xs shadow-indigo-500/20 inline-flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Nueva Cotización</span>
              </button>
            </div>
          </div>

          {/* Barra de Búsqueda + Filtro de Etapa Activa */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                placeholder="Buscar por código PRO-#CA, cliente, RUC, WhatsApp o producto..."
                className="w-full pl-8 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
              />
            </div>

            <div className="flex flex-wrap items-center gap-1 bg-slate-100/90 dark:bg-slate-950 p-1 rounded-xl border border-slate-200/80 dark:border-slate-800">
              {(
                [
                  { id: 'all', label: `Todas las Etapas (${allQuotesList.length})` },
                  {
                    id: 'stage_1_quote',
                    label: `1. Cotizado (${stageGroupsSummary.groups.stage_1_quote.length})`,
                  },
                  {
                    id: 'stage_2_design',
                    label: `2. Diseño (${stageGroupsSummary.groups.stage_2_design.length})`,
                  },
                  {
                    id: 'stage_3_workshop',
                    label: `3. Taller (${stageGroupsSummary.groups.stage_3_workshop.length})`,
                  },
                  {
                    id: 'stage_4_delivery',
                    label: `4. Entrega (${stageGroupsSummary.groups.stage_4_delivery.length})`,
                  },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => {
                    setActiveStageBlockFilter(f.id);
                    setHistoryFilter('all');
                  }}
                  className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-all duration-200 ${
                    activeStageBlockFilter === f.id
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* ================================================================= */}
          {/* VISTA 1 (POR DEFECTO): 4 BLOQUES DIFERENCIADOS SEGÚN LA ETAPA      */}
          {/* ================================================================= */}
          {historyViewMode === 'stage_blocks' ? (
            <div className="space-y-5">
              {(
                [
                  {
                    id: 'stage_1_quote' as const,
                    badge: 'BLOQUE ETAPA 1',
                    title: 'Cotizado / Esperando Anticipo del Cliente',
                    description:
                      'Proformas emitidas en evaluación. Registra el 50% de anticipo en 1 clic para pasarlas a Diseño y Taller.',
                    containerClass:
                      'bg-amber-50/40 dark:bg-amber-950/15 border-amber-200/90 dark:border-amber-900/60',
                    headerClass:
                      'bg-amber-100/70 dark:bg-amber-950/40 border-b border-amber-200/80 dark:border-amber-900/60',
                    badgeClass: 'bg-amber-600 text-white',
                    accentText: 'text-amber-900 dark:text-amber-200',
                    pillClass:
                      'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800',
                  },
                  {
                    id: 'stage_2_design' as const,
                    badge: 'BLOQUE ETAPA 2',
                    title: 'En Diseño Gráfico y Aprobación de Arte',
                    description:
                      'Pedidos aprobados con anticipo que están en pre-prensa, vectorizado o esperando visto bueno de arte.',
                    containerClass:
                      'bg-indigo-50/40 dark:bg-indigo-950/15 border-indigo-200/90 dark:border-indigo-900/60',
                    headerClass:
                      'bg-indigo-100/70 dark:bg-indigo-950/40 border-b border-indigo-200/80 dark:border-indigo-900/60',
                    badgeClass: 'bg-indigo-600 text-white',
                    accentText: 'text-indigo-900 dark:text-indigo-200',
                    pillClass:
                      'bg-indigo-100 dark:bg-indigo-950/80 text-indigo-800 dark:text-indigo-300 border-indigo-300 dark:border-indigo-800',
                  },
                  {
                    id: 'stage_3_workshop' as const,
                    badge: 'BLOQUE ETAPA 3',
                    title: 'En Producción / Impresión, Corte CNC y Taller',
                    description:
                      'Órdenes en fabricación activa en máquinas RIP, corte láser/CNC, soldadura o acabados.',
                    containerClass:
                      'bg-purple-50/40 dark:bg-purple-950/15 border-purple-200/90 dark:border-purple-900/60',
                    headerClass:
                      'bg-purple-100/70 dark:bg-purple-950/40 border-b border-purple-200/80 dark:border-purple-900/60',
                    badgeClass: 'bg-purple-600 text-white',
                    accentText: 'text-purple-900 dark:text-purple-200',
                    pillClass:
                      'bg-purple-100 dark:bg-purple-950/80 text-purple-800 dark:text-purple-300 border-purple-300 dark:border-purple-800',
                  },
                  {
                    id: 'stage_4_delivery' as const,
                    badge: 'BLOQUE ETAPA 4',
                    title: 'Listo para Entrega / Entregado y Cerrado',
                    description:
                      'Trabajos terminados listos para retiro o instalación en sitio y cobro de saldo contra entrega.',
                    containerClass:
                      'bg-emerald-50/40 dark:bg-emerald-950/15 border-emerald-200/90 dark:border-emerald-900/60',
                    headerClass:
                      'bg-emerald-100/70 dark:bg-emerald-950/40 border-b border-emerald-200/80 dark:border-emerald-900/60',
                    badgeClass: 'bg-emerald-600 text-white',
                    accentText: 'text-emerald-900 dark:text-emerald-200',
                    pillClass:
                      'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800',
                  },
                ] as const
              )
                .filter(
                  (block) =>
                    activeStageBlockFilter === 'all' || activeStageBlockFilter === block.id
                )
                .map((block) => {
                  const blockQuotes = filteredQuotesList.filter(
                    (q) => getQuoteStageGroup(q) === block.id
                  );
                  const blockTotalUsd = blockQuotes.reduce(
                    (acc, q) =>
                      acc + (q.liveOrder ? q.liveOrder.totalPrice : q.proformaData.totalPrice),
                    0
                  );
                  const blockPendingUsd = blockQuotes.reduce((acc, q) => {
                    const tot = q.liveOrder ? q.liveOrder.totalPrice : q.proformaData.totalPrice;
                    const pd =
                      (q.liveOrder ? q.liveOrder.paidAmount : q.proformaData.paidAmount) || 0;
                    return acc + Math.max(0, tot - pd);
                  }, 0);

                  return (
                    <div
                      key={block.id}
                      className={`rounded-2xl border overflow-hidden ${block.containerClass}`}
                    >
                      {/* Encabezado Diferenciado del Bloque de Etapa */}
                      <div
                        className={`px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${block.headerClass}`}
                      >
                        <div className="space-y-0.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider ${block.badgeClass}`}
                            >
                              {block.badge}
                            </span>
                            <h4 className={`text-sm font-bold ${block.accentText}`}>
                              {block.title}
                            </h4>
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-white/80 dark:bg-slate-900/80 text-slate-800 dark:text-slate-200 border border-slate-200/70 dark:border-slate-800">
                              {blockQuotes.length} {blockQuotes.length === 1 ? 'registro' : 'registros'}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 dark:text-slate-400">
                            {block.description}
                          </p>
                        </div>

                        <div className="flex items-center gap-4 shrink-0 font-mono tabular-nums text-right">
                          <div>
                            <span className="text-[10px] uppercase text-slate-500 block">
                              Monto en Etapa
                            </span>
                            <strong className="text-sm font-extrabold text-slate-900 dark:text-white">
                              ${blockTotalUsd.toFixed(2)}
                            </strong>
                          </div>
                          <div>
                            <span className="text-[10px] uppercase text-slate-500 block">
                              Por Cobrar
                            </span>
                            <strong className="text-sm font-bold text-amber-700 dark:text-amber-400">
                              ${blockPendingUsd.toFixed(2)}
                            </strong>
                          </div>
                        </div>
                      </div>

                      {/* Tarjetas Limpias dentro del Bloque de Etapa */}
                      {blockQuotes.length === 0 ? (
                        <div className="p-6 text-center text-xs text-slate-500 dark:text-slate-400">
                          No hay cotizaciones ni órdenes en esta etapa con el filtro actual.
                        </div>
                      ) : (
                        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3.5">
                          {blockQuotes.map((quote) => {
                            const ord = quote.liveOrder;
                            const stageLabel = ord?.stage || 'Solo Proforma PDF';
                            const total = ord ? ord.totalPrice : quote.proformaData.totalPrice;
                            const paid =
                              (ord ? ord.paidAmount : quote.proformaData.paidAmount) || 0;
                            const pending = Math.max(0, Number((total - paid).toFixed(2)));
                            const advance50 = Number((total * 0.5).toFixed(2));
                            const isPendingAdvance =
                              !quote.isConvertedToOrder ||
                              stageLabel === 'Cotizado / Anticipo Pendiente' ||
                              paid === 0;
                            const isExpanded = expandedQuoteCardId === quote.id;
                            const firstItem = quote.proformaData.items[0];
                            const extraCount = Math.max(0, quote.proformaData.items.length - 1);

                            return (
                              <div
                                key={quote.id}
                                className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl p-4 flex flex-col justify-between gap-3 shadow-2xs hover:border-slate-300 dark:hover:border-slate-700 transition-all"
                              >
                                {/* Fila 1: Cliente + Código Proforma + Estado */}
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="font-mono text-xs font-extrabold text-indigo-600 dark:text-indigo-400">
                                        {quote.quoteNumber}
                                      </span>
                                      <span
                                        className={`px-2 py-0.5 rounded text-[10px] font-bold border ${block.pillClass}`}
                                      >
                                        {stageLabel}
                                      </span>
                                    </div>
                                    <h5 className="text-sm font-bold text-slate-900 dark:text-white truncate mt-1">
                                      {quote.proformaData.clientName}
                                    </h5>
                                    <div className="text-[11px] font-mono text-slate-500 flex items-center gap-2 mt-0.5">
                                      <span>{quote.proformaData.clientPhone}</span>
                                      <span>·</span>
                                      <span>{quote.sentAt.slice(0, 10)}</span>
                                    </div>
                                  </div>

                                  <div className="text-right font-mono tabular-nums shrink-0">
                                    <span className="text-base font-extrabold text-slate-900 dark:text-white block">
                                      ${total.toFixed(2)}
                                    </span>
                                    {pending > 0 ? (
                                      <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 block">
                                        Saldo: ${pending.toFixed(2)}
                                      </span>
                                    ) : (
                                      <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 block">
                                        Pagado 100%
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Fila 2: Resumen del Trabajo Principal (Sin saturar) */}
                                {firstItem && (
                                  <div className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200/70 dark:border-slate-800 text-xs flex items-center justify-between gap-2">
                                    <div className="min-w-0">
                                      <div className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                                        {firstItem.title}
                                      </div>
                                      <div className="text-[11px] text-slate-500 font-mono truncate">
                                        {firstItem.materialName} · {firstItem.dimensionsText}
                                      </div>
                                    </div>
                                    {extraCount > 0 && (
                                      <span className="px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-mono text-[10px] font-bold shrink-0">
                                        +{extraCount} más
                                      </span>
                                    )}
                                  </div>
                                )}

                                {/* Fila 3: Acciones Principales según la Etapa + Botón Desplegable */}
                                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    {isPendingAdvance && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (!quote.isConvertedToOrder) {
                                            const ordWithAdvance: WorkOrder = {
                                              ...quote.draftOrder,
                                              paidAmount: advance50,
                                              stage: 'En Diseño y Arte',
                                            };
                                            onConvertOrder(
                                              ordWithAdvance,
                                              advance50,
                                              'Transferencia Bancaria',
                                              {
                                                bankEntity: BANK_ACCOUNTS_CATALOG[0],
                                                referenceNumber: `ANT-${quote.orderId.replace('#', '')}`,
                                                invoiceOrDocNumber: 'Por Facturar',
                                                accountHolderOrNotes: `Aprobación de cotización ${quote.quoteNumber} con 50% anticipo`,
                                              }
                                            );
                                          } else if (onRegisterOrderPayment) {
                                            onRegisterOrderPayment(
                                              quote.orderId,
                                              advance50,
                                              'Transferencia Bancaria',
                                              {
                                                bankEntity: BANK_ACCOUNTS_CATALOG[0],
                                                referenceNumber: `ANT-${quote.orderId.replace('#', '')}`,
                                                invoiceOrDocNumber: 'Por Facturar',
                                                accountHolderOrNotes: `Anticipo 50% de cotización ${quote.quoteNumber}`,
                                              }
                                            );
                                          }
                                        }}
                                        className="px-2.5 py-1.5 text-[11px] font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg inline-flex items-center gap-1 shadow-2xs"
                                      >
                                        <Check className="w-3.5 h-3.5" />
                                        <span>Aprobar 50% (${advance50.toFixed(0)})</span>
                                      </button>
                                    )}

                                    {!isPendingAdvance && pending > 0 && onRegisterOrderPayment && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          onRegisterOrderPayment(
                                            quote.orderId,
                                            pending,
                                            'Transferencia Bancaria',
                                            {
                                              bankEntity: BANK_ACCOUNTS_CATALOG[0],
                                              referenceNumber: `LIQ-${quote.orderId.replace('#', '')}`,
                                              invoiceOrDocNumber: 'Liquidación Final',
                                              accountHolderOrNotes: `Liquidación de saldo orden ${quote.orderId}`,
                                            }
                                          )
                                        }
                                        className="px-2.5 py-1.5 text-[11px] font-bold bg-amber-600 hover:bg-amber-500 text-white rounded-lg inline-flex items-center gap-1"
                                      >
                                        <Check className="w-3.5 h-3.5" />
                                        <span>Cobrar Saldo (${pending.toFixed(0)})</span>
                                      </button>
                                    )}

                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (quote.isConvertedToOrder && onOpenWhatsAppChat) {
                                          onOpenWhatsAppChat(quote.orderId);
                                        } else if (onSendQuoteToWhatsApp) {
                                          const msgText = formatQuoteWhatsAppText(
                                            quote.proformaData
                                          );
                                          onSendQuoteToWhatsApp(
                                            quote.draftOrder,
                                            msgText,
                                            quote.pdfFileName
                                          );
                                        }
                                      }}
                                      className="px-2.5 py-1.5 text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-lg inline-flex items-center gap-1"
                                    >
                                      <MessageSquare className="w-3 h-3" />
                                      <span>Chat WA</span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => {
                                        setPreviewQuoteOverride(quote.proformaData);
                                        setShowProformaModal(true);
                                      }}
                                      className="px-2.5 py-1.5 text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 rounded-lg inline-flex items-center gap-1"
                                    >
                                      <Eye className="w-3 h-3" />
                                      <span>Ver A4</span>
                                    </button>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      setExpandedQuoteCardId(isExpanded ? null : quote.id)
                                    }
                                    className="text-[11px] font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-white inline-flex items-center gap-1"
                                  >
                                    <span>{isExpanded ? 'Ocultar' : 'Más opciones'}</span>
                                    {isExpanded ? (
                                      <ChevronUp className="w-3.5 h-3.5" />
                                    ) : (
                                      <ChevronDown className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                </div>

                                {/* Desglose Secundario Expandible (Solo a petición) */}
                                {isExpanded && (
                                  <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 space-y-2 text-xs">
                                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 font-mono">
                                      <span>RUC/CI: {quote.proformaData.clientRuc}</span>
                                      <span>Orden: {quote.orderId}</span>
                                      <span>Abonado: ${paid.toFixed(2)}</span>
                                    </div>

                                    {quote.proformaData.items.length > 1 && (
                                      <div className="space-y-1">
                                        <span className="text-[10px] font-bold uppercase text-slate-400 block">
                                          Todos los rubros ({quote.proformaData.items.length}):
                                        </span>
                                        {quote.proformaData.items.map((it, i) => (
                                          <div
                                            key={it.id}
                                            className="flex items-center justify-between text-[11px] bg-slate-50 dark:bg-slate-950 px-2.5 py-1 rounded"
                                          >
                                            <span className="truncate pr-2">
                                              {i + 1}. {it.title} ({it.dimensionsText})
                                            </span>
                                            <span className="font-mono font-bold">
                                              ${it.lineTotal.toFixed(2)}
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    )}

                                    <div className="flex flex-wrap items-center justify-end gap-1.5 pt-1">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const { fileName } = generateQuotePdf(
                                            quote.proformaData,
                                            { download: true }
                                          );
                                          onNotify(`PDF "${fileName}" descargado nuevamente`);
                                        }}
                                        className="px-2.5 py-1 text-[11px] font-semibold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 rounded-lg inline-flex items-center gap-1"
                                      >
                                        <FileDown className="w-3 h-3" />
                                        <span>Descargar PDF</span>
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => handleReloadQuoteIntoExpress(quote)}
                                        className="px-2.5 py-1 text-[11px] font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-lg inline-flex items-center gap-1"
                                      >
                                        <RotateCcw className="w-3 h-3" />
                                        <span>Recotizar / Editar en Cotizador</span>
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          ) : (
            /* =============================================================== */
            /* VISTA 2 (OPCIONAL): TABLA COMPACTA TRADICIONAL                  */
            /* =============================================================== */
            <div className="border border-slate-200/80 dark:border-slate-800 rounded-xl overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/90 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400">
                  <tr>
                    <th className="py-3 px-3.5">Proforma / Fecha</th>
                    <th className="py-3 px-3.5">Cliente y WhatsApp</th>
                    <th className="py-3 px-3.5">Productos, Materiales y Medidas</th>
                    <th className="py-3 px-3.5 text-right">Total ($)</th>
                    <th className="py-3 px-3.5 text-right">Anticipo / Saldo</th>
                    <th className="py-3 px-3.5">Etapa Actual</th>
                    <th className="py-3 px-3.5 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/80 dark:divide-slate-800">
                  {filteredQuotesList
                    .filter(
                      (q) =>
                        activeStageBlockFilter === 'all' ||
                        getQuoteStageGroup(q) === activeStageBlockFilter
                    )
                    .map((quote) => {
                      const ord = quote.liveOrder;
                      const stage = ord?.stage || 'Solo PDF Emitido';
                      const total = ord ? ord.totalPrice : quote.proformaData.totalPrice;
                      const paid = (ord ? ord.paidAmount : quote.proformaData.paidAmount) || 0;
                      const pending = Math.max(0, Number((total - paid).toFixed(2)));
                      const advance50 = Number((total * 0.5).toFixed(2));
                      const isPendingAdvance =
                        !quote.isConvertedToOrder ||
                        stage === 'Cotizado / Anticipo Pendiente' ||
                        paid === 0;

                      return (
                        <tr
                          key={quote.id}
                          className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
                        >
                          <td className="py-3 px-3 align-top">
                            <div className="font-mono font-bold text-blue-600 dark:text-blue-400">
                              {quote.quoteNumber}
                            </div>
                            <div className="text-[11px] font-mono text-slate-500">
                              Orden: {quote.orderId}
                            </div>
                            <div className="text-[10px] text-slate-400 mt-0.5">{quote.sentAt}</div>
                          </td>

                          <td className="py-3 px-3 align-top">
                            <div className="font-semibold text-slate-900 dark:text-white">
                              {quote.proformaData.clientName}
                            </div>
                            <div className="text-[11px] font-mono text-emerald-700 dark:text-emerald-400">
                              {quote.proformaData.clientPhone}
                            </div>
                          </td>

                          <td className="py-3 px-3 align-top max-w-xs">
                            {quote.proformaData.items.map((it, idx) => (
                              <div
                                key={it.id}
                                className={
                                  idx > 0
                                    ? 'mt-1.5 pt-1.5 border-t border-slate-100 dark:border-slate-800'
                                    : ''
                                }
                              >
                                <div className="font-semibold text-slate-900 dark:text-white">
                                  {it.title}
                                </div>
                                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                  {it.materialName} ·{' '}
                                  <span className="font-mono">{it.dimensionsText}</span>
                                </div>
                              </div>
                            ))}
                          </td>

                          <td className="py-3 px-3 text-right align-top font-mono tabular-nums">
                            <span className="text-sm font-extrabold text-slate-900 dark:text-white">
                              ${total.toFixed(2)}
                            </span>
                          </td>

                          <td className="py-3 px-3 text-right align-top font-mono tabular-nums">
                            <div className="text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold">
                              Abonado: ${paid.toFixed(2)}
                            </div>
                            <div className="text-[11px] text-amber-700 dark:text-amber-400">
                              Saldo: ${pending.toFixed(2)}
                            </div>
                          </td>

                          <td className="py-3 px-3 align-top">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${
                                !quote.isConvertedToOrder
                                  ? 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                                  : isPendingAdvance
                                  ? 'bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300'
                                  : 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300'
                              }`}
                            >
                              {stage}
                            </span>
                          </td>

                          <td className="py-3 px-3 text-right align-top">
                            <div className="flex flex-wrap items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setPreviewQuoteOverride(quote.proformaData);
                                  setShowProformaModal(true);
                                }}
                                className="px-2 py-1 text-[11px] font-semibold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded inline-flex items-center gap-1"
                              >
                                <Eye className="w-3 h-3" />
                                <span>A4</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleReloadQuoteIntoExpress(quote)}
                                className="px-2 py-1 text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded inline-flex items-center gap-1"
                              >
                                <RotateCcw className="w-3 h-3" />
                                <span>Editar</span>
                              </button>
                              {isPendingAdvance && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (!quote.isConvertedToOrder) {
                                      const ordWithAdvance: WorkOrder = {
                                        ...quote.draftOrder,
                                        paidAmount: advance50,
                                        stage: 'En Diseño y Arte',
                                      };
                                      onConvertOrder(
                                        ordWithAdvance,
                                        advance50,
                                        'Transferencia Bancaria',
                                        {
                                          bankEntity: BANK_ACCOUNTS_CATALOG[0],
                                          referenceNumber: `ANT-${quote.orderId.replace('#', '')}`,
                                          invoiceOrDocNumber: 'Por Facturar',
                                          accountHolderOrNotes: `Aprobación de cotización ${quote.quoteNumber} con 50% anticipo`,
                                        }
                                      );
                                    } else if (onRegisterOrderPayment) {
                                      onRegisterOrderPayment(
                                        quote.orderId,
                                        advance50,
                                        'Transferencia Bancaria',
                                        {
                                          bankEntity: BANK_ACCOUNTS_CATALOG[0],
                                          referenceNumber: `ANT-${quote.orderId.replace('#', '')}`,
                                          invoiceOrDocNumber: 'Por Facturar',
                                          accountHolderOrNotes: `Anticipo 50% de cotización ${quote.quoteNumber}`,
                                        }
                                      );
                                    }
                                  }}
                                  className="px-2 py-1 text-[11px] font-bold bg-indigo-600 text-white rounded inline-flex items-center gap-1"
                                >
                                  <Check className="w-3 h-3" />
                                  <span>50%</span>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL DE VISTA PREVIA PROFORMA COMERCIAL A4 + DESCARGA PDF + WHATSAPP */}
      {/* ===================================================================== */}
      {showProformaModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto">
            {/* Barra superior de acciones del modal */}
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 sm:px-5 py-3 bg-slate-900 text-white border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="w-4 h-4 text-blue-400 shrink-0" />
                <span className="text-xs sm:text-sm font-bold truncate">
                  Vista Previa de Proforma Comercial ({displayedProformaData.quoteNumber})
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <button
                  type="button"
                  onClick={() => setShowProformaTemplateEditor(true)}
                  className="px-2.5 sm:px-3 py-1.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded-md inline-flex items-center gap-1.5"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5 shrink-0" />
                  <span>⚙️ Editar Membrete / Bancos</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadPdfQuote}
                  className="px-2.5 sm:px-3 py-1.5 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-md inline-flex items-center gap-1.5"
                >
                  <FileDown className="w-3.5 h-3.5 shrink-0" />
                  <span>Descargar PDF</span>
                </button>

                <button
                  type="button"
                  onClick={handleNativeSharePdf}
                  className="px-2.5 sm:px-3 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-md inline-flex items-center gap-1.5"
                >
                  <Share2 className="w-3.5 h-3.5 shrink-0" />
                  <span>Compartir</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowProformaModal(false);
                    handleDownloadPdfAndSendWhatsApp();
                  }}
                  className="px-3 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-md inline-flex items-center gap-1.5"
                >
                  <MessageSquare className="w-3.5 h-3.5 shrink-0" />
                  <span>PDF + WhatsApp</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowProformaModal(false);
                    setPreviewQuoteOverride(null);
                  }}
                  className="p-1.5 text-slate-400 hover:text-white rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Hoja A4 Ejecutiva Simulada */}
            <div className="p-3 sm:p-6 md:p-8 flex-1 min-h-0 overflow-y-auto bg-slate-100 dark:bg-[#0b0e14]">
              <div className="bg-white dark:bg-[#111620] text-slate-900 dark:text-slate-100 rounded-xl shadow-md border border-slate-200 dark:border-[#1e2636] p-4 sm:p-6 md:p-8 max-w-3xl mx-auto space-y-6 overflow-x-auto">
                {/* Encabezado Membrete */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 dark:bg-[#161d2a] text-white p-5 rounded-lg border-l-4 border-indigo-500">
                  <div>
                    <h2 className="text-lg font-extrabold tracking-tight">
                      {proformaTemplateConfig.companyName}
                    </h2>
                    <p className="text-xs text-slate-300">
                      {proformaTemplateConfig.companySubtitle}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1 font-mono">
                      {proformaTemplateConfig.companyRucAndAddress} · {proformaTemplateConfig.companyContactLine}
                    </p>
                  </div>
                  <div className="bg-slate-800 dark:bg-[#0d1119] px-4 py-2.5 rounded-md text-right shrink-0 border border-slate-700/60">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 block">
                      {proformaTemplateConfig.documentTitle}
                    </span>
                    <span className="text-base font-extrabold font-mono text-white">
                      {displayedProformaData.quoteNumber}
                    </span>
                    <span className="block text-[11px] text-slate-300 mt-0.5">
                      Emisión: {displayedProformaData.issueDate} · Validez: {quoteValidDays} días
                    </span>
                  </div>
                </div>

                {/* Datos del Cliente y Condiciones */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 dark:bg-[#0d1119] p-4 rounded-lg border border-slate-200 dark:border-[#1e2636] text-xs">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase text-indigo-600 dark:text-indigo-400 block">
                      Datos del Cliente
                    </span>
                    <div>
                      <strong className="text-slate-700 dark:text-slate-300">Cliente / Razón Social:</strong>{' '}
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        {displayedProformaData.clientName}
                      </span>
                    </div>
                    <div>
                      <strong className="text-slate-700 dark:text-slate-300">RUC / Cédula:</strong>{' '}
                      <span className="font-mono">{displayedProformaData.clientRuc}</span>
                    </div>
                    <div>
                      <strong className="text-slate-700 dark:text-slate-300">WhatsApp:</strong>{' '}
                      <span className="font-mono">{displayedProformaData.clientPhone}</span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase text-indigo-600 dark:text-indigo-400 block">
                      Condiciones Operativas
                    </span>
                    <div>
                      <strong className="text-slate-700 dark:text-slate-300">Tiempo de Entrega:</strong>{' '}
                      <span>{displayedProformaData.deliveryDays} día(s) laborables tras aprobar arte</span>
                    </div>
                    <div>
                      <strong className="text-slate-700 dark:text-slate-300">Forma de Pago:</strong>{' '}
                      <span>{proformaTemplateConfig.paymentTermsLabel}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <strong className="text-slate-700 dark:text-slate-300">Validez Oferta (días):</strong>
                      <input
                        type="number"
                        min="1"
                        max="90"
                        value={quoteValidDays}
                        onChange={(e) =>
                          setQuoteValidDays(Math.max(1, parseInt(e.target.value) || 15))
                        }
                        className="w-14 px-1.5 py-0.5 text-xs font-mono border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-[#111620] text-slate-900 dark:text-slate-100"
                      />
                    </div>
                  </div>
                </div>

                {/* Tabla de Rubros */}
                <div className="border border-slate-200 dark:border-[#1e2636] rounded-lg overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900 dark:bg-[#161d2a] text-white">
                      <tr>
                        <th className="py-2.5 px-3 w-8">#</th>
                        <th className="py-2.5 px-3">Descripción Técnica y Especificaciones</th>
                        <th className="py-2.5 px-3">Medida / Detalle</th>
                        <th className="py-2.5 px-3 text-center w-14">Cant.</th>
                        <th className="py-2.5 px-3 text-right w-24">P. Unit</th>
                        <th className="py-2.5 px-3 text-right w-24">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-[#1e2636]">
                      {displayedProformaData.items.map((item, idx) => (
                        <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-[#161d2a]">
                          <td className="py-3 px-3 font-bold text-slate-700 dark:text-slate-300">{idx + 1}</td>
                          <td className="py-3 px-3">
                            <div className="font-bold text-slate-900 dark:text-slate-100">{item.title}</div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                              Sustrato: {item.materialName} · Acabados: {item.finishingsText}
                            </div>
                          </td>
                          <td className="py-3 px-3 font-mono text-[11px] text-slate-700 dark:text-slate-300">
                            {item.dimensionsText}
                          </td>
                          <td className="py-3 px-3 text-center font-mono font-bold">
                            {item.quantity}
                          </td>
                          <td className="py-3 px-3 text-right font-mono">
                            ${item.unitPrice.toFixed(2)}
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                            ${item.lineTotal.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                      {displayedProformaData.installationFee > 0 && (
                        <tr className="bg-slate-50 dark:bg-[#0d1119]">
                          <td className="py-2.5 px-3 font-bold text-slate-700 dark:text-slate-300">+</td>
                          <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-slate-200">
                            Servicio de Instalación, Montaje en Sitio y Acometida Operativa
                          </td>
                          <td className="py-2.5 px-3 text-[11px] text-slate-600 dark:text-slate-400">
                            Cuadrilla Técnica
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono">1</td>
                          <td className="py-2.5 px-3 text-right font-mono">
                            ${displayedProformaData.installationFee.toFixed(2)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold">
                            ${displayedProformaData.installationFee.toFixed(2)}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Cuentas Bancarias y Liquidación */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-start">
                  <div className="sm:col-span-7 bg-slate-50 dark:bg-[#0d1119] p-4 rounded-lg border border-slate-200 dark:border-[#1e2636] text-xs space-y-2">
                    <span className="text-[10px] font-bold uppercase text-indigo-600 dark:text-indigo-400 block">
                      {proformaTemplateConfig.bankHeaderTitle}
                    </span>
                    <p className="font-semibold text-slate-800 dark:text-slate-200">
                      {proformaTemplateConfig.bankLine1}
                    </p>
                    <p className="font-semibold text-slate-800 dark:text-slate-200">
                      {proformaTemplateConfig.bankLine2}
                    </p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                      {proformaTemplateConfig.bankHolderLine}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-200 dark:border-[#1e2636]">
                      <strong>Nota:</strong> {displayedProformaData.notes}
                    </p>
                  </div>

                  <div className="sm:col-span-5 bg-slate-50 dark:bg-[#0d1119] p-4 rounded-lg border border-slate-200 dark:border-[#1e2636] text-xs space-y-2">
                    <div className="flex justify-between text-slate-600 dark:text-slate-400">
                      <span>Subtotal:</span>
                      <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                        ${(displayedProformaData.subtotal + displayedProformaData.discount).toFixed(2)}
                      </span>
                    </div>
                    {displayedProformaData.discount > 0 && (
                      <div className="flex justify-between text-amber-700 dark:text-amber-400">
                        <span>Descuento Comercial:</span>
                        <span className="font-mono font-semibold">
                          -${displayedProformaData.discount.toFixed(2)}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between text-slate-600 dark:text-slate-400">
                      <span>IVA ({displayedProformaData.includeIva ? '15%' : '0%'}):</span>
                      <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                        ${displayedProformaData.ivaAmount.toFixed(2)}
                      </span>
                    </div>
                    <div className="bg-indigo-600 text-white p-2.5 rounded-md flex items-center justify-between font-bold">
                      <span>TOTAL USD:</span>
                      <span className="text-base font-mono">
                        ${displayedProformaData.totalPrice.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between text-[11px] text-slate-600 dark:text-slate-400 pt-1">
                      <span>Anticipo 50% para iniciar:</span>
                      <strong className="font-mono text-slate-900 dark:text-slate-100">
                        ${displayedProformaData.requiredAdvance50.toFixed(2)}
                      </strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Nuevo Producto */}
      {showNewProductModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveNewProduct}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg max-w-md w-full p-5 space-y-3 shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2.5">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Nuevo Producto / Material en Tarifario
              </h3>
              <button
                type="button"
                onClick={() => setShowNewProductModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Nombre del Producto / Material *
              </label>
              <input
                type="text"
                required
                value={newProdName}
                onChange={(e) => setNewProdName(e.target.value)}
                placeholder="Ej. Letrero Luminoso Bandera Doble Cara"
                className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-white"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <div className="sm:col-span-7">
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Categoría
                </label>
                <select
                  value={newProdCategory}
                  onChange={(e) => {
                    const cat = e.target.value as ServiceCategory;
                    setNewProdCategory(cat);
                    setNewProdUnit(cat === 'Diseño Gráfico y Branding' ? 'unidad' : 'm2');
                  }}
                  className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-white"
                >
                  <option value="Rótulos 3D y Estructurados">Rótulos 3D y Estructurados</option>
                  <option value="Gran Formato / Gigantografía">Gran Formato / Gigantografía</option>
                  <option value="Viniles">Viniles</option>
                  <option value="Señalética y Merchandising">Señalética y Merchandising</option>
                  <option value="Diseño Gráfico y Branding">Diseño Gráfico y Branding</option>
                </select>
              </div>

              <div className="sm:col-span-5">
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Unidad de Cobro
                </label>
                <select
                  value={newProdUnit}
                  onChange={(e) =>
                    setNewProdUnit(e.target.value as 'm2' | 'unidad' | 'metro_lineal')
                  }
                  className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-white"
                >
                  <option value="m2">Por m² (Ancho × Alto)</option>
                  <option value="unidad">Por Unidad / Paquete</option>
                  <option value="metro_lineal">Metro Lineal (ml)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Costo Base Taller ($/{newProdUnit})
                </label>
                <input
                  type="number"
                  min="0.5"
                  step="0.5"
                  value={newProdBaseCost}
                  onChange={(e) => setNewProdBaseCost(Math.max(0.5, Number(e.target.value)))}
                  className="w-full px-3 py-1.5 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-blue-700 dark:text-blue-300 mb-1">
                  Precio Ref. Venta ($/{newProdUnit}) *
                </label>
                <input
                  type="number"
                  min="1"
                  step="0.5"
                  value={newProdSalePrice}
                  onChange={(e) => setNewProdSalePrice(Math.max(1, Number(e.target.value)))}
                  className="w-full px-3 py-1.5 text-xs font-mono font-bold bg-blue-50/70 dark:bg-blue-950/50 border border-blue-400 dark:border-blue-700 rounded text-blue-800 dark:text-blue-200"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Descripción / Especificación (Opcional)
              </label>
              <input
                type="text"
                value={newProdDesc}
                onChange={(e) => setNewProdDesc(e.target.value)}
                placeholder="Ej. Incluye estructura metálica e iluminación LED"
                className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-white"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowNewProductModal(false)}
                className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded"
              >
                Guardar y Seleccionar en Cotizador
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Editor de Encabezado, Bancos y Datos de Proforma PDF */}
      <ProformaTemplateEditorModal
        isOpen={showProformaTemplateEditor}
        onClose={() => setShowProformaTemplateEditor(false)}
        onNotify={(msg) => {
          setProformaTemplateConfig(getProformaTemplateConfig());
          onNotify(msg);
        }}
      />
    </div>
  );
};
