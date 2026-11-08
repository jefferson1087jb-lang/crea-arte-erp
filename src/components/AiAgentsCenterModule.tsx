import React, { useState, useEffect, useMemo } from 'react';
import {
  Bot,
  Sparkles,
  CheckCircle2,
  ArrowRight,
  Calculator,
  Scissors,
  Package,
  MessageSquare,
  ShieldCheck,
  Clock,
  AlertTriangle,
  Play,
  RefreshCw,
  FileText,
  Send,
  Layers,
  Trash2,
  Filter,
  Zap,
} from 'lucide-react';
import {
  WorkOrder,
  InventoryItem,
  InventoryMovement,
  RestockRequest,
  ReusableOffcut,
  UserProfile,
  RoleId,
  OrderStage,
  CrmTask,
  QuoterTransferPayload,
  CATALOG_MATERIALS,
  ServiceCategory,
  getNowTimestamp,
  getTodayDateStr,
} from '../data/initialData';

export type AgentId =
  | 'quoter_agent'
  | 'production_optimizer_agent'
  | 'inventory_kardex_agent'
  | 'collections_crm_agent';

export type AgentActionType =
  | 'CREATE_QUOTE_ORDER'
  | 'SEND_TO_OPTIMIZER'
  | 'USE_OFFCUT'
  | 'CREATE_RESTOCK'
  | 'SEND_WHATSAPP_COLLECTION'
  | 'CREATE_CRM_TASK'
  | 'ADVANCE_STAGE';

export interface AgentQuoteDraft {
  clientName: string;
  clientPhone: string;
  projectTitle: string;
  category: ServiceCategory;
  materialId: string;
  materialName: string;
  widthM: number;
  heightM: number;
  quantity: number;
  finishings: string[];
  unitPrice: number;
  totalPrice: number;
  suggestedAdvance: number;
  notes: string;
}

export interface AgentDelegatedProposal {
  id: string;
  title: string;
  agentId: AgentId;
  priority: 'Crítica' | 'Alta' | 'Normal';
  reasoning: string;
  impactMetric: string;
  actionType: AgentActionType;
  status: 'pending' | 'executed' | 'dismissed';
  createdAt: string;
  executedAt?: string;
  executedBy?: string;
  sourceEngine: 'gemini-ai' | 'local-engine';
  targetOrderId?: string;
  targetInventoryId?: string;
  targetOffcutId?: string;
  restockQty?: number;
  whatsappMessage?: string;
  suggestedStage?: OrderStage;
  crmTaskTitle?: string;
  quoteDraft?: AgentQuoteDraft;
}

interface AiAgentsCenterModuleProps {
  orders: WorkOrder[];
  inventory: InventoryItem[];
  movements: InventoryMovement[];
  restockRequests: RestockRequest[];
  reusableOffcuts: ReusableOffcut[];
  users: UserProfile[];
  currentUser: UserProfile;
  currentRole: RoleId;
  nextOrderCode: string;
  onConvertOrder: (
    newOrder: WorkOrder,
    initialAdvance: number,
    paymentMethod: 'Efectivo' | 'Transferencia Bancaria' | 'Tarjeta'
  ) => void;
  onSendToQuoter: (payload: QuoterTransferPayload) => void;
  onSendToOptimizer: (payload: QuoterTransferPayload) => void;
  onUseOffcut: (offcutId: string, usedInOrderId: string) => void;
  onCreateRestockRequest: (
    itemId: string,
    qty: number,
    urgency: 'Normal' | 'Alta' | 'Crítica'
  ) => void;
  onSendWhatsAppMessage: (orderId: string, text: string) => void;
  onMoveOrderStage: (orderId: string, targetStage: OrderStage) => void;
  onAddCrmTask: (task: Omit<CrmTask, 'id' | 'createdAt' | 'status'>) => void;
  onLogAudit: (title: string, details: string, orderId?: string) => void;
  onNotify: (msg: string) => void;
}

const WHATSAPP_SAMPLE_PROMPTS = [
  {
    label: 'Pedido WhatsApp: Letrero Backlight + Vinil',
    text: 'Hola amigos de Crea Arte, soy Fernando Cevallos de Clínica Dental Sonrisa (+593 99 812 4410). Necesito cotizar urgente un rótulo luminoso en lona translúcida backlight de 3.20m de ancho por 1.10m de alto con estructura metálica e instalación en local, más 2 viniles microperforados para vitrina de 1.50m x 2.00m cada uno.',
  },
  {
    label: 'Pedido Corporativo: Letras 3D Acrílico + ACM',
    text: 'Estimados Crea Arte, les escribe Gabriela Torres de Hotel Mirador Real (+593 98 450 9921). Requerimos 1 letrero corpóreo 3D en Acrílico 3mm con iluminación LED de 2.40m x 0.80m con bastidor de Alucobond ACM e instalación en fachada.',
  },
  {
    label: 'Campaña: 4 Lonas Frontlight Promocionales',
    text: 'Buenas tardes, soy Marco Andrade de Importadora Andina (+593 99 310 7788). Necesito 4 gigantografías en lona frontlight 13oz de 2.50m x 1.50m con ojales perimetrales y termosellado para entregar mañana.',
  },
];

const AGENT_META: Record<
  AgentId,
  {
    name: string;
    roleTitle: string;
    badgeClass: string;
    icon: React.ComponentType<{ className?: string }>;
    description: string;
  }
> = {
  quoter_agent: {
    name: 'Agente Cotizador Técnico',
    roleTitle: 'Ventas & Recepción WhatsApp',
    badgeClass:
      'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800/70',
    icon: Calculator,
    description:
      'Transforma textos desordenados de WhatsApp o correos en cotizaciones estructuradas con medidas, materiales del catálogo y cálculo de anticipo 50%.',
  },
  production_optimizer_agent: {
    name: 'Agente Planificador Taller & 2D',
    roleTitle: 'Producción, Cortes y Retazos',
    badgeClass:
      'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/70',
    icon: Scissors,
    description:
      'Cruza órdenes en cola con el almacén de retazos reutilizables y sugiere agrupaciones de corte 2D y avances de etapa en Kanban.',
  },
  inventory_kardex_agent: {
    name: 'Agente Auditor de Kardex & Mermas',
    roleTitle: 'Bodega, Compras y Control',
    badgeClass:
      'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800/70',
    icon: Package,
    description:
      'Audita el stock comprometido vs. mínimo, detecta mermas anormales en taller y prepara solicitudes de reposición a proveedores.',
  },
  collections_crm_agent: {
    name: 'Agente de Cobranza CxC & CRM',
    roleTitle: 'Finanzas & Seguimiento Cliente',
    badgeClass:
      'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800/70',
    icon: MessageSquare,
    description:
      'Monitorea saldos pendientes del 50% en órdenes listas o en producción y redacta recordatorios personalizados con datos bancarios.',
  },
};

function parseNaturalLanguageQuoteLocal(rawText: string): AgentQuoteDraft {
  const lower = rawText.toLowerCase();

  // Detectar cliente
  let clientName = 'Cliente Corporativo WhatsApp';
  const nameMatch =
    rawText.match(/soy\s+([A-ZÁÉÍÓÚÑa-záéíóúñ]+\s+[A-ZÁÉÍÓÚÑa-záéíóúñ]+(?:\s+de\s+[A-ZÁÉÍÓÚÑa-záéíóúñ\s]+)?)/i) ||
    rawText.match(/escribe\s+([A-ZÁÉÍÓÚÑa-záéíóúñ]+\s+[A-ZÁÉÍÓÚÑa-záéíóúñ]+(?:\s+de\s+[A-ZÁÉÍÓÚÑa-záéíóúñ\s]+)?)/i);
  if (nameMatch?.[1]) {
    clientName = nameMatch[1].replace(/[,.]/g, '').trim().slice(0, 48);
  }

  // Detectar teléfono
  const phoneMatch = rawText.match(/(\+?\d[\d\s-]{7,15}\d)/);
  const clientPhone = phoneMatch ? phoneMatch[1].trim() : '+593 99 555 0199';

  // Detectar dimensiones (ej. 3.20m x 1.10m o 2.40 x 0.80)
  const dimMatch = rawText.match(/(\d+(?:[.,]\d+)?)\s*m?\s*(?:x|×|por|de ancho por)\s*(\d+(?:[.,]\d+)?)\s*m?/i);
  const widthM = dimMatch ? Math.max(0.5, Number(dimMatch[1].replace(',', '.'))) : 2.5;
  const heightM = dimMatch ? Math.max(0.5, Number(dimMatch[2].replace(',', '.'))) : 1.2;

  // Detectar cantidad
  const qtyMatch = rawText.match(/(?:necesito|requerimos|cotizar)\s+(\d+)\s+/i);
  const quantity = qtyMatch ? Math.max(1, Math.min(50, Number(qtyMatch[1]))) : 1;

  // Detectar material del catálogo real
  let selectedMat = CATALOG_MATERIALS[0];
  if (lower.includes('acrilico') || lower.includes('acrílico') || lower.includes('3d') || lower.includes('corpore')) {
    selectedMat =
      CATALOG_MATERIALS.find((m) => m.id.includes('acrilico')) ||
      CATALOG_MATERIALS.find((m) => m.category === 'Rótulos 3D y Estructurados') ||
      CATALOG_MATERIALS[0];
  } else if (lower.includes('microperforado') || lower.includes('vinil')) {
    selectedMat =
      CATALOG_MATERIALS.find((m) => m.id.includes('vinil')) || CATALOG_MATERIALS[1] || CATALOG_MATERIALS[0];
  } else if (lower.includes('backlight') || lower.includes('translucid') || lower.includes('luminoso')) {
    selectedMat =
      CATALOG_MATERIALS.find((m) => m.id.includes('back') || m.name.toLowerCase().includes('back')) ||
      CATALOG_MATERIALS[0];
  }

  const areaM2 = Number((widthM * heightM * quantity).toFixed(2));
  const installExtra = lower.includes('instalacion') || lower.includes('instalación') ? 65 : 0;
  const rawTotal = Number((areaM2 * selectedMat.suggestedPricePerUnit + installExtra).toFixed(2));
  const totalWithIva = Number((rawTotal * 1.15).toFixed(2));
  const unitPrice = Number((totalWithIva / quantity).toFixed(2));

  const finishings: string[] = [];
  if (lower.includes('ojal')) finishings.push('Ojales Metálicos Perimetrales');
  if (lower.includes('termosellado')) finishings.push('Termosellado Reforzado');
  if (lower.includes('estructura') || lower.includes('bastidor')) finishings.push('Estructura Metálica Tubo 20x20mm');
  if (lower.includes('led') || lower.includes('luminoso')) finishings.push('Módulos LED 12V IP65 + Fuente');
  if (finishings.length === 0) finishings.push('Acabado Estándar de Taller');

  return {
    clientName,
    clientPhone,
    projectTitle: `${selectedMat.name} (${widthM}m × ${heightM}m · ${quantity} und)`,
    category: selectedMat.category,
    materialId: selectedMat.id,
    materialName: selectedMat.name,
    widthM,
    heightM,
    quantity,
    finishings,
    unitPrice,
    totalPrice: totalWithIva,
    suggestedAdvance: Number((totalWithIva * 0.5).toFixed(2)),
    notes: `Extraído por Agente IA desde solicitud: "${rawText.slice(0, 140)}..."`,
  };
}

export const AiAgentsCenterModule: React.FC<AiAgentsCenterModuleProps> = ({
  orders,
  inventory,
  movements,
  restockRequests,
  reusableOffcuts,
  users,
  currentUser,
  nextOrderCode,
  onConvertOrder,
  onSendToQuoter,
  onSendToOptimizer,
  onUseOffcut,
  onCreateRestockRequest,
  onSendWhatsAppMessage,
  onMoveOrderStage,
  onAddCrmTask,
  onLogAudit,
  onNotify,
}) => {
  const [quoterPrompt, setQuoterPrompt] = useState<string>(WHATSAPP_SAMPLE_PROMPTS[0].text);
  const [runningAgent, setRunningAgent] = useState<AgentId | 'full_sweep' | null>(null);
  const [activeFilterAgent, setActiveFilterAgent] = useState<AgentId | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<'pending' | 'executed' | 'all'>('pending');
  const [lastExecutiveSummary, setLastExecutiveSummary] = useState<string>(
    'Los 4 Agentes Operativos están sincronizados en tiempo real con el Tablero Kanban, Inventario/Kardex, Retazos 2D y Cuentas por Cobrar.'
  );

  // Construir propuestas iniciales basadas en datos reales del ERP
  const buildInitialProposals = (): AgentDelegatedProposal[] => {
    const initial: AgentDelegatedProposal[] = [];
    const ts = getNowTimestamp();

    // 1. Propuesta real de Cobranza CxC si hay orden lista o en producción con saldo pendiente
    const pendingOrder =
      orders.find(
        (o) =>
          o.totalPrice - o.paidAmount > 10 &&
          (o.stage === 'Instalación / Listo para Retiro' ||
            o.stage === 'Acabados y Armado 3D' ||
            o.stage === 'En Cola de Impresión/Corte')
      ) || orders.find((o) => o.totalPrice - o.paidAmount > 0);

    if (pendingOrder) {
      const pendingAmt = Number((pendingOrder.totalPrice - pendingOrder.paidAmount).toFixed(2));
      initial.push({
        id: `prop-init-cxc-${pendingOrder.id}`,
        title: `Recordatorio de Cobro CxC ($${pendingAmt.toFixed(2)}) — ${pendingOrder.id} (${pendingOrder.clientName})`,
        agentId: 'collections_crm_agent',
        priority: pendingOrder.stage === 'Instalación / Listo para Retiro' ? 'Crítica' : 'Alta',
        reasoning: `La orden ${pendingOrder.id} ("${pendingOrder.title}") se encuentra en etapa "${pendingOrder.stage}" con un saldo pendiente de $${pendingAmt.toFixed(2)} sobre un total de $${pendingOrder.totalPrice.toFixed(2)}.`,
        impactMetric: `$${pendingAmt.toFixed(2)} por cobrar`,
        actionType: 'SEND_WHATSAPP_COLLECTION',
        status: 'pending',
        createdAt: ts,
        sourceEngine: 'local-engine',
        targetOrderId: pendingOrder.id,
        whatsappMessage: `🤖 *AVISO DE ESTADO Y LIQUIDACIÓN DE SALDO (${pendingOrder.id}) — CREA ARTE*\nEstimado/a *${pendingOrder.clientName}*, le informamos que su proyecto *${pendingOrder.title}* se encuentra en etapa *"${pendingOrder.stage}"*.\n\n💳 *Resumen de Cuenta:*\n• Total Orden: $${pendingOrder.totalPrice.toFixed(2)}\n• Abonado: $${pendingOrder.paidAmount.toFixed(2)}\n• *Saldo pendiente a liquidar:* *$${pendingAmt.toFixed(2)}*\n\n🏦 *Cuentas Oficiales Crea Arte S.A.:*\n• Banco Pichincha Cta. Cte. #2100492811\n• Banco Guayaquil Cta. Cte. #0019283746\nEnvíenos su comprobante por este chat para habilitar su Acta y Certificado QR.`,
      });
    }

    // 2. Propuesta real de Inventario / Kardex si hay stock bajo
    const lowStockItem =
      inventory.find((i) => i.currentStock <= i.minStock * 1.25) || inventory[0];
    if (lowStockItem) {
      const suggestedQty =
        lowStockItem.unit === 'm2'
          ? 160
          : lowStockItem.unit === 'plancha'
          ? 12
          : 10;
      initial.push({
        id: `prop-init-inv-${lowStockItem.id}`,
        title: `Reposición Preventiva de Stock: ${lowStockItem.name}`,
        agentId: 'inventory_kardex_agent',
        priority: lowStockItem.currentStock <= lowStockItem.minStock ? 'Crítica' : 'Alta',
        reasoning: `El insumo "${lowStockItem.name}" (${lowStockItem.sku}) registra ${lowStockItem.currentStock} ${lowStockItem.unit} frente a un mínimo de seguridad de ${lowStockItem.minStock} ${lowStockItem.unit}. Proveedor sugerido: ${lowStockItem.supplier}.`,
        impactMetric: `+${suggestedQty} ${lowStockItem.unit} ($${(suggestedQty * lowStockItem.unitCost).toFixed(2)})`,
        actionType: 'CREATE_RESTOCK',
        status: 'pending',
        createdAt: ts,
        sourceEngine: 'local-engine',
        targetInventoryId: lowStockItem.id,
        restockQty: suggestedQty,
      });
    }

    // 3. Propuesta real de Taller / Retazos 2D
    const availableOffcut = reusableOffcuts.find((o) => o.status === 'Disponible');
    const activeWorkshopOrder =
      orders.find(
        (o) =>
          o.stage === 'En Cola de Impresión/Corte' ||
          o.stage === 'En Diseño y Arte' ||
          o.stage === 'Aprobación del Cliente'
      ) || orders[0];

    if (availableOffcut && activeWorkshopOrder) {
      initial.push({
        id: `prop-init-offcut-${availableOffcut.id}`,
        title: `Aprovechar Retazo Disponible (${availableOffcut.widthCm}×${availableOffcut.heightCm} cm) en ${activeWorkshopOrder.id}`,
        agentId: 'production_optimizer_agent',
        priority: 'Normal',
        reasoning: `Existe un retazo disponible de "${availableOffcut.materialName}" (${availableOffcut.widthCm}×${availableOffcut.heightCm} cm, ${availableOffcut.thicknessMm}mm) en bodega que puede asignarse o validarse en el Optimizador 2D antes de abrir material virgen.`,
        impactMetric: `Ahorro ${((availableOffcut.widthCm * availableOffcut.heightCm) / 10000).toFixed(2)} m²`,
        actionType: 'SEND_TO_OPTIMIZER',
        status: 'pending',
        createdAt: ts,
        sourceEngine: 'local-engine',
        targetOrderId: activeWorkshopOrder.id,
        targetOffcutId: availableOffcut.id,
      });
    }

    return initial;
  };

  const [proposals, setProposals] = useState<AgentDelegatedProposal[]>(() => {
    try {
      const saved = localStorage.getItem('crea_arte_ai_proposals_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    return buildInitialProposals();
  });

  useEffect(() => {
    try {
      localStorage.setItem('crea_arte_ai_proposals_v1', JSON.stringify(proposals));
    } catch {
      // ignore
    }
  }, [proposals]);

  // Snapshot resumido para enviar al backend de Gemini
  const erpSnapshot = useMemo(() => {
    return {
      orders: orders.slice(0, 12).map((o) => ({
        id: o.id,
        clientName: o.clientName,
        clientPhone: o.clientPhone,
        title: o.title,
        category: o.category,
        materialId: o.materialId,
        materialName: o.materialName,
        widthM: o.widthM,
        heightM: o.heightM,
        quantity: o.quantity,
        stage: o.stage,
        totalPrice: o.totalPrice,
        paidAmount: o.paidAmount,
        pendingBalance: Number((o.totalPrice - o.paidAmount).toFixed(2)),
        deadline: o.deadline,
      })),
      catalogMaterials: CATALOG_MATERIALS.map((m) => ({
        id: m.id,
        name: m.name,
        category: m.category,
        unit: m.unit,
        suggestedPricePerUnit: m.suggestedPricePerUnit,
        inventoryItemId: m.inventoryItemId,
      })),
      inventory: inventory.map((i) => ({
        id: i.id,
        sku: i.sku,
        name: i.name,
        unit: i.unit,
        currentStock: i.currentStock,
        minStock: i.minStock,
        unitCost: i.unitCost,
        supplier: i.supplier,
      })),
      availableOffcuts: reusableOffcuts
        .filter((r) => r.status === 'Disponible')
        .map((r) => ({
          id: r.id,
          materialName: r.materialName,
          widthCm: r.widthCm,
          heightCm: r.heightCm,
          thicknessMm: r.thicknessMm,
        })),
      recentWasteMovements: movements
        .filter((m) => m.type === 'merma_taller')
        .slice(0, 5),
    };
  }, [orders, inventory, reusableOffcuts, movements]);

  // Generador determinista de respaldo si el servidor usa fallback local
  const generateLocalFallbackProposals = (
    agentType: AgentId | 'full_sweep',
    promptText: string
  ): { summary: string; items: AgentDelegatedProposal[] } => {
    const ts = getNowTimestamp();
    const generated: AgentDelegatedProposal[] = [];

    if (agentType === 'quoter_agent' || agentType === 'full_sweep') {
      const draft = parseNaturalLanguageQuoteLocal(promptText || WHATSAPP_SAMPLE_PROMPTS[0].text);
      generated.push({
        id: `prop-quote-${Date.now()}`,
        title: `Cotización Lista: ${draft.projectTitle} — ${draft.clientName}`,
        agentId: 'quoter_agent',
        priority: 'Alta',
        reasoning: `Se extrajeron medidas (${draft.widthM}m × ${draft.heightM}m, ${draft.quantity} und) y material "${draft.materialName}". Total calculado con IVA 15%: $${draft.totalPrice.toFixed(2)} (Anticipo 50%: $${draft.suggestedAdvance.toFixed(2)}).`,
        impactMetric: `Venta $${draft.totalPrice.toFixed(2)}`,
        actionType: 'CREATE_QUOTE_ORDER',
        status: 'pending',
        createdAt: ts,
        sourceEngine: 'local-engine',
        quoteDraft: draft,
      });
    }

    if (agentType === 'production_optimizer_agent' || agentType === 'full_sweep') {
      const targetOrder =
        orders.find((o) => o.stage === 'En Cola de Impresión/Corte' || o.stage === 'En Diseño y Arte') ||
        orders[0];
      const offcut = reusableOffcuts.find((r) => r.status === 'Disponible');

      if (targetOrder) {
        generated.push({
          id: `prop-prod-${Date.now() + 1}`,
          title: `Optimizar Despiece 2D para ${targetOrder.id} (${targetOrder.widthM}m × ${targetOrder.heightM}m)`,
          agentId: 'production_optimizer_agent',
          priority: 'Alta',
          reasoning: `La orden ${targetOrder.id} (${targetOrder.clientName}) requiere ${targetOrder.quantity} und de ${targetOrder.materialName}.${
            offcut
              ? ` Además hay un retazo disponible (${offcut.widthCm}×${offcut.heightCm} cm) compatible.`
              : ' Se recomienda calcular nesting antes de corte.'
          }`,
          impactMetric: `Optimizar ${targetOrder.totalAreaM2} m²`,
          actionType: 'SEND_TO_OPTIMIZER',
          status: 'pending',
          createdAt: ts,
          sourceEngine: 'local-engine',
          targetOrderId: targetOrder.id,
          targetOffcutId: offcut?.id,
        });
      }
    }

    if (agentType === 'inventory_kardex_agent' || agentType === 'full_sweep') {
      const criticalItems = inventory.filter((i) => i.currentStock <= i.minStock * 1.3);
      const targetInv = criticalItems[0] || inventory[0];
      if (targetInv) {
        const restockQty = targetInv.unit === 'm2' ? 160 : 10;
        generated.push({
          id: `prop-inv-${Date.now() + 2}`,
          title: `Orden de Reposición Sugerida: ${targetInv.name} (+${restockQty} ${targetInv.unit})`,
          agentId: 'inventory_kardex_agent',
          priority: targetInv.currentStock <= targetInv.minStock ? 'Crítica' : 'Alta',
          reasoning: `Stock actual en Kardex: ${targetInv.currentStock} ${targetInv.unit} (Mínimo: ${targetInv.minStock} ${targetInv.unit}). Se requiere abastecimiento con ${targetInv.supplier} para cubrir órdenes activas sin quiebre de stock.`,
          impactMetric: `+${restockQty} ${targetInv.unit} ($${(restockQty * targetInv.unitCost).toFixed(2)})`,
          actionType: 'CREATE_RESTOCK',
          status: 'pending',
          createdAt: ts,
          sourceEngine: 'local-engine',
          targetInventoryId: targetInv.id,
          restockQty,
        });
      }
    }

    if (agentType === 'collections_crm_agent' || agentType === 'full_sweep') {
      const unpaidOrders = orders.filter((o) => o.totalPrice - o.paidAmount > 5);
      const targetOrder = unpaidOrders[0] || orders[0];
      if (targetOrder) {
        const pending = Math.max(0, Number((targetOrder.totalPrice - targetOrder.paidAmount).toFixed(2)));
        generated.push({
          id: `prop-cxc-${Date.now() + 3}`,
          title: `Gestionar Cobro Pendiente ($${pending.toFixed(2)}) — ${targetOrder.id} (${targetOrder.clientName})`,
          agentId: 'collections_crm_agent',
          priority: pending > 150 ? 'Crítica' : 'Alta',
          reasoning: `El cliente ${targetOrder.clientName} mantiene un saldo por pagar de $${pending.toFixed(2)} en la orden ${targetOrder.id} (Etapa: ${targetOrder.stage}). Mensaje de cobro con cuentas bancarias listo para despachar.`,
          impactMetric: `Cobrar $${pending.toFixed(2)}`,
          actionType: 'SEND_WHATSAPP_COLLECTION',
          status: 'pending',
          createdAt: ts,
          sourceEngine: 'local-engine',
          targetOrderId: targetOrder.id,
          whatsappMessage: `🤖 *RECORDATORIO DE SALDO Y ESTADO DE ORDEN (${targetOrder.id}) — CREA ARTE*\nEstimado/a *${targetOrder.clientName}*, su orden *${targetOrder.title}* avanza en etapa *"${targetOrder.stage}"*.\n• Total: $${targetOrder.totalPrice.toFixed(2)}\n• Abonado: $${targetOrder.paidAmount.toFixed(2)}\n• *Saldo pendiente:* *$${pending.toFixed(2)}*\n\n🏦 *Transferencias a Crea Arte S.A.:*\n• Banco Pichincha Cta. Cte. #2100492811\n• Banco Guayaquil Cta. Cte. #0019283746\nPor favor envíenos su comprobante por esta vía.`,
        });
      }
    }

    return {
      summary: `Diagnóstico ejecutado sobre ${orders.length} órdenes activas, ${inventory.length} insumos en Kardex y ${reusableOffcuts.length} retazos. Se generaron ${generated.length} tarea(s) delegadas listas para tu aprobación.`,
      items: generated,
    };
  };

  // Delegar tarea a un Agente IA (Server-side Gemini + Fallback garantizado)
  const handleDelegateToAgent = async (
    agentType: AgentId | 'full_sweep',
    customPrompt?: string
  ) => {
    setRunningAgent(agentType);
    const effectivePrompt =
      customPrompt ||
      (agentType === 'quoter_agent'
        ? quoterPrompt
        : 'Analizar el estado operativo en vivo y generar propuestas accionables.');

    try {
      const response = await fetch('/api/agents/delegate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentType,
          userPrompt: effectivePrompt,
          erpSnapshot,
        }),
      });

      const data = await response.json();

      if (data?.source === 'gemini-ai' && data?.result?.proposals?.length > 0) {
        const ts = getNowTimestamp();
        const mappedProposals: AgentDelegatedProposal[] = data.result.proposals.map(
          (p: any, idx: number) => {
            const validAgentId: AgentId =
              p.agentId === 'quoter_agent' ||
              p.agentId === 'production_optimizer_agent' ||
              p.agentId === 'inventory_kardex_agent' ||
              p.agentId === 'collections_crm_agent'
                ? p.agentId
                : agentType === 'full_sweep'
                ? 'quoter_agent'
                : agentType;

            const fallbackDraft =
              p.actionType === 'CREATE_QUOTE_ORDER' && !p.quoteDraft
                ? parseNaturalLanguageQuoteLocal(effectivePrompt)
                : p.quoteDraft
                ? {
                    clientName: p.quoteDraft.clientName || 'Cliente Corporativo',
                    clientPhone: p.quoteDraft.clientPhone || '+593 99 555 0199',
                    projectTitle: p.quoteDraft.projectTitle || 'Proyecto Publicitario Crea Arte',
                    category: (p.quoteDraft.category as ServiceCategory) || 'Gran Formato / Gigantografía',
                    materialId: p.quoteDraft.materialId || CATALOG_MATERIALS[0].id,
                    materialName: p.quoteDraft.materialName || CATALOG_MATERIALS[0].name,
                    widthM: Number(p.quoteDraft.widthM) || 2.4,
                    heightM: Number(p.quoteDraft.heightM) || 1.2,
                    quantity: Number(p.quoteDraft.quantity) || 1,
                    finishings:
                      Array.isArray(p.quoteDraft.finishings) && p.quoteDraft.finishings.length > 0
                        ? p.quoteDraft.finishings
                        : ['Acabado Estándar de Taller'],
                    unitPrice: Number(p.quoteDraft.unitPrice) || 85,
                    totalPrice: Number(p.quoteDraft.totalPrice) || 85,
                    suggestedAdvance:
                      Number(p.quoteDraft.suggestedAdvance) ||
                      Number(((Number(p.quoteDraft.totalPrice) || 85) * 0.5).toFixed(2)),
                    notes: p.quoteDraft.notes || effectivePrompt,
                  }
                : undefined;

            return {
              id: `prop-ai-${Date.now()}-${idx}`,
              title: p.title || 'Propuesta Operativa IA',
              agentId: validAgentId,
              priority:
                p.priority === 'Crítica' || p.priority === 'Alta' || p.priority === 'Normal'
                  ? p.priority
                  : 'Alta',
              reasoning: p.reasoning || 'Propuesta generada por análisis del ERP.',
              impactMetric: p.impactMetric || 'Acción Sugerida',
              actionType: (p.actionType as AgentActionType) || 'CREATE_CRM_TASK',
              status: 'pending',
              createdAt: ts,
              sourceEngine: 'gemini-ai',
              targetOrderId: p.targetOrderId || orders[0]?.id,
              targetInventoryId: p.targetInventoryId || inventory[0]?.id,
              targetOffcutId: p.targetOffcutId,
              restockQty: Number(p.restockQty) || 100,
              whatsappMessage: p.whatsappMessage,
              suggestedStage: p.suggestedStage as OrderStage | undefined,
              crmTaskTitle: p.crmTaskTitle,
              quoteDraft: fallbackDraft,
            };
          }
        );

        setProposals((prev) => [...mappedProposals, ...prev]);
        setLastExecutiveSummary(
          data.result.executiveSummary ||
            `Gemini IA generó ${mappedProposals.length} propuesta(s) listas para revisión.`
        );
        setStatusFilter('pending');
        if (agentType !== 'full_sweep') {
          setActiveFilterAgent(agentType);
        } else {
          setActiveFilterAgent('all');
        }
        onLogAudit(
          'Delegación a Agente IA (Gemini)',
          `${currentUser.name} ejecutó el agente "${agentType}" generando ${mappedProposals.length} propuesta(s) en la Bandeja de Aprobación.`
        );
        onNotify(
          `🤖 Agente IA completó el análisis y agregó ${mappedProposals.length} propuesta(s) a tu bandeja.`
        );
      } else {
        const localResult = generateLocalFallbackProposals(agentType, effectivePrompt);
        setProposals((prev) => [...localResult.items, ...prev]);
        setLastExecutiveSummary(localResult.summary);
        setStatusFilter('pending');
        if (agentType !== 'full_sweep') {
          setActiveFilterAgent(agentType);
        } else {
          setActiveFilterAgent('all');
        }
        onLogAudit(
          'Delegación a Agente Operativo ERP',
          `${currentUser.name} ejecutó el agente "${agentType}" generando ${localResult.items.length} propuesta(s).`
        );
        onNotify(
          `🤖 Agente Operativo generó ${localResult.items.length} propuesta(s) listas para aprobar con 1 clic.`
        );
      }
    } catch {
      const localResult = generateLocalFallbackProposals(agentType, effectivePrompt);
      setProposals((prev) => [...localResult.items, ...prev]);
      setLastExecutiveSummary(localResult.summary);
      setStatusFilter('pending');
      onNotify(
        `🤖 Agente Operativo generó ${localResult.items.length} propuesta(s) en la Bandeja de Aprobación.`
      );
    } finally {
      setRunningAgent(null);
    }
  };

  // Ejecutar y aprobar con 1 clic una propuesta de la bandeja (Human-in-the-loop)
  const handleApproveAndExecuteProposal = (
    proposal: AgentDelegatedProposal,
    secondaryMode?: 'send_to_quoter_only'
  ) => {
    const ts = getNowTimestamp();

    if (proposal.actionType === 'CREATE_QUOTE_ORDER' && proposal.quoteDraft) {
      const d = proposal.quoteDraft;

      if (secondaryMode === 'send_to_quoter_only') {
        onSendToQuoter({
          mode: 'roll',
          widthM: d.widthM,
          heightM: d.heightM,
          quantity: d.quantity,
          wastePct: 8,
          summaryNote: `[Agente IA Cotizador] ${d.projectTitle} — Cliente: ${d.clientName}`,
        });
      } else {
        const deadlineDate = new Date();
        deadlineDate.setDate(deadlineDate.getDate() + 3);
        const deadlineStr = `${deadlineDate.toISOString().slice(0, 10)}T17:00`;
        const areaM2 = Number((d.widthM * d.heightM * d.quantity).toFixed(2));
        const designer = users.find((u) => u.role === 'designer') || users[0];
        const operator = users.find((u) => u.role === 'operator') || users[0];

        const newOrder: WorkOrder = {
          id: nextOrderCode,
          clientName: d.clientName,
          clientRuc: '1790011223001',
          clientPhone: d.clientPhone,
          title: d.projectTitle,
          category: d.category || 'Gran Formato / Gigantografía',
          materialId: d.materialId || CATALOG_MATERIALS[0].id,
          materialName: d.materialName || CATALOG_MATERIALS[0].name,
          widthM: d.widthM,
          heightM: d.heightM,
          quantity: d.quantity,
          totalAreaM2: areaM2,
          finishings: d.finishings,
          stage: 'Cotizado / Anticipo Pendiente',
          createdAt: ts.replace(' ', 'T'),
          deadline: deadlineStr,
          designerId: designer.id,
          operatorId: operator.id,
          installerId: operator.id,
          estimatedDesignHours: 1.5,
          estimatedMachineHours: 2,
          estimatedInstallHours: 1.5,
          rawMaterialCost: Number((d.totalPrice * 0.35).toFixed(2)),
          wastePercent: 8,
          installationFee: 0,
          subtotal: Number((d.totalPrice / 1.15).toFixed(2)),
          discount: 0,
          includeIva: true,
          totalPrice: d.totalPrice,
          paidAmount: 0,
          artworkUrl: '',
          artworkApproved: false,
          stockDeducted: false,
          notes: d.notes,
        };

        onConvertOrder(newOrder, 0, 'Transferencia Bancaria');
      }
    } else if (proposal.actionType === 'SEND_TO_OPTIMIZER') {
      const targetOrder =
        orders.find((o) => o.id === proposal.targetOrderId) || orders[0];
      if (proposal.targetOffcutId && targetOrder) {
        onUseOffcut(proposal.targetOffcutId, targetOrder.id);
      }
      onSendToOptimizer({
        mode: 'sheet',
        orderId: targetOrder?.id,
        widthM: targetOrder?.widthM || 1.2,
        heightM: targetOrder?.heightM || 0.8,
        quantity: targetOrder?.quantity || 2,
        wastePct: targetOrder?.wastePercent || 8,
        summaryNote: `[Agente IA Taller] Despiece sugerido para ${targetOrder?.id || 'Orden'}`,
      });
    } else if (proposal.actionType === 'USE_OFFCUT') {
      const targetOrder =
        orders.find((o) => o.id === proposal.targetOrderId) || orders[0];
      const offcut =
        reusableOffcuts.find((r) => r.id === proposal.targetOffcutId) ||
        reusableOffcuts.find((r) => r.status === 'Disponible');
      if (offcut && targetOrder) {
        onUseOffcut(offcut.id, targetOrder.id);
      }
    } else if (proposal.actionType === 'CREATE_RESTOCK') {
      const invItem =
        inventory.find((i) => i.id === proposal.targetInventoryId) || inventory[0];
      if (invItem) {
        onCreateRestockRequest(
          invItem.id,
          proposal.restockQty || 100,
          proposal.priority === 'Crítica' ? 'Crítica' : 'Alta'
        );
      }
    } else if (proposal.actionType === 'SEND_WHATSAPP_COLLECTION') {
      const targetOrder =
        orders.find((o) => o.id === proposal.targetOrderId) || orders[0];
      if (targetOrder) {
        const pending = Math.max(
          0,
          Number((targetOrder.totalPrice - targetOrder.paidAmount).toFixed(2))
        );
        const msg =
          proposal.whatsappMessage ||
          `🤖 *RECORDATORIO DE SALDO (${targetOrder.id}) — CREA ARTE*\nEstimado/a *${targetOrder.clientName}*, le recordamos que su proyecto *${targetOrder.title}* registra un saldo pendiente de *$${pending.toFixed(2)}*.`;
        onSendWhatsAppMessage(targetOrder.id, msg);
      }
    } else if (proposal.actionType === 'ADVANCE_STAGE') {
      const targetOrder =
        orders.find((o) => o.id === proposal.targetOrderId) || orders[0];
      if (targetOrder) {
        onMoveOrderStage(
          targetOrder.id,
          proposal.suggestedStage || 'En Cola de Impresión/Corte'
        );
      }
    } else if (proposal.actionType === 'CREATE_CRM_TASK') {
      const targetOrder =
        orders.find((o) => o.id === proposal.targetOrderId) || orders[0];
      onAddCrmTask({
        title: proposal.crmTaskTitle || proposal.title,
        clientName: targetOrder?.clientName || 'Taller Interno Crea Arte',
        orderId: targetOrder?.id,
        assignedToUserId: currentUser.id,
        createdByUserId: currentUser.id,
        dueDate: getTodayDateStr(),
        priority: proposal.priority === 'Crítica' ? 'Urgente' : 'Alta',
      });
    }

    setProposals((prev) =>
      prev.map((item) =>
        item.id === proposal.id
          ? {
              ...item,
              status: 'executed',
              executedAt: ts,
              executedBy: currentUser.name,
            }
          : item
      )
    );

    onLogAudit(
      `Propuesta IA Aprobada (${proposal.actionType})`,
      `${currentUser.name} aprobó y ejecutó la tarea delegada "${proposal.title}" del agente ${AGENT_META[proposal.agentId].name}.`,
      proposal.targetOrderId
    );
  };

  const handleDismissProposal = (proposalId: string) => {
    setProposals((prev) =>
      prev.map((p) => (p.id === proposalId ? { ...p, status: 'dismissed' } : p))
    );
    onNotify('Propuesta descartada de la bandeja.');
  };

  const visibleProposals = useMemo(() => {
    return proposals.filter((p) => {
      if (p.status === 'dismissed') return false;
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      if (activeFilterAgent !== 'all' && p.agentId !== activeFilterAgent) return false;
      return true;
    });
  }, [proposals, statusFilter, activeFilterAgent]);

  const pendingCount = useMemo(
    () => proposals.filter((p) => p.status === 'pending').length,
    [proposals]
  );
  const executedCount = useMemo(
    () => proposals.filter((p) => p.status === 'executed').length,
    [proposals]
  );

  return (
    <div className="space-y-6">
      {/* CABECERA EJECUTIVA DEL CENTRO DE AGENTES IA */}
      <div className="bg-white dark:bg-[#111620] border border-slate-200 dark:border-[#1e2636] rounded-xl p-5 shadow-2xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-indigo-600/10 dark:bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                    Centro de Agentes Operativos IA (Copiloto ERP)
                  </h2>
                  <span className="px-2.5 py-0.5 text-[10px] font-mono font-semibold uppercase rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/70 dark:text-indigo-300 dark:border-indigo-800/70">
                    Human-in-the-Loop
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Delega cotizaciones desde texto libre, planificación de cortes/retazos, auditoría de Kardex y cobranza CxC. Ningún agente modifica datos sin tu aprobación de 1 clic.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-[#151b26] border border-slate-200 dark:border-[#222c3c] text-xs flex items-center gap-3">
              <div>
                <span className="text-slate-500 dark:text-slate-400 block text-[10px] uppercase font-semibold">
                  En Bandeja
                </span>
                <span className="font-mono font-bold text-sm text-amber-600 dark:text-amber-400">
                  {pendingCount} pendientes
                </span>
              </div>
              <div className="h-6 w-px bg-slate-200 dark:bg-slate-800" />
              <div>
                <span className="text-slate-500 dark:text-slate-400 block text-[10px] uppercase font-semibold">
                  Aprobadas
                </span>
                <span className="font-mono font-bold text-sm text-emerald-600 dark:text-emerald-400">
                  {executedCount} ejecutadas
                </span>
              </div>
            </div>

            <button
              type="button"
              disabled={runningAgent !== null}
              onClick={() => handleDelegateToAgent('full_sweep')}
              className="px-4 py-2.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 rounded-lg transition-all duration-150 inline-flex items-center gap-2 shadow-2xs cursor-pointer"
            >
              {runningAgent === 'full_sweep' ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Analizando ERP con los 4 Agentes...</span>
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4" />
                  <span>⚡ Ejecutar Diagnóstico Integral (4 Agentes)</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Resumen del último análisis */}
        <div className="mt-4 pt-3.5 border-t border-slate-200/80 dark:border-[#1e2636] flex items-center justify-between gap-3 text-xs text-slate-600 dark:text-slate-300">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-500 shrink-0" />
            <span>
              <strong>Estado del Orquestador:</strong> {lastExecutiveSummary}
            </span>
          </div>
          <span className="text-[11px] font-mono text-slate-400 hidden sm:inline shrink-0">
            Auditoría RBAC Activa ({currentUser.name})
          </span>
        </div>
      </div>

      {/* GRID PRINCIPAL: DELEGACIÓN DE TAREAS (IZQUIERDA) + BANDEJA DE APROBACIÓN (DERECHA) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* COLUMNA IZQUIERDA (5 cols): DELEGACIÓN DIRECTA A LOS 4 AGENTES */}
        <div className="lg:col-span-5 space-y-4">
          {/* AGENTE 1: COTIZADOR DESDE WHATSAPP / TEXTO LIBRE */}
          <div className="bg-white dark:bg-[#111620] border border-slate-200 dark:border-[#1e2636] rounded-xl p-4 space-y-3.5 shadow-2xs">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800/70 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                  <Calculator className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    1. Delegar a Agente Cotizador (WhatsApp → OT)
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Pega el mensaje del cliente y el agente calculará medidas, materiales y proforma.
                  </p>
                </div>
              </div>
            </div>

            {/* Plantillas rápidas de prueba */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                Ejemplos rápidos de clientes:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {WHATSAPP_SAMPLE_PROMPTS.map((sample, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setQuoterPrompt(sample.text)}
                    className="px-2.5 py-1 text-[11px] font-medium rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-[#171e2b] dark:hover:bg-[#1e2738] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-[#253042] transition-colors cursor-pointer"
                  >
                    {sample.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label
                htmlFor="ai-quoter-prompt"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                Solicitud del cliente (WhatsApp, correo o nota de voz transcrita):
              </label>
              <textarea
                id="ai-quoter-prompt"
                rows={4}
                value={quoterPrompt}
                onChange={(e) => setQuoterPrompt(e.target.value)}
                placeholder="Ej. Hola, necesito 2 rótulos en lona frontlight de 3.00m x 1.50m con ojales e instalación..."
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-[#0d1119] border border-slate-300 dark:border-[#242f42] rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <button
              type="button"
              disabled={runningAgent !== null || !quoterPrompt.trim()}
              onClick={() => handleDelegateToAgent('quoter_agent', quoterPrompt)}
              className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-lg transition-all duration-150 inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              {runningAgent === 'quoter_agent' ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Calculando medidas, materiales y costos...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Interpretar Pedido y Armar Propuesta de Cotización</span>
                </>
              )}
            </button>
          </div>

          {/* AGENTES 2, 3 Y 4: TALLER/2D, KARDEX/MERMAS Y COBRANZA CXC */}
          {(
            [
              {
                id: 'production_optimizer_agent' as AgentId,
                btnLabel: 'Auditar Cola Kanban y Retazos 2D',
                kpiText: `${orders.filter((o) => o.stage !== 'Finalizado y Liquidado').length} órdenes activas · ${
                  reusableOffcuts.filter((r) => r.status === 'Disponible').length
                } retazos disponibles`,
              },
              {
                id: 'inventory_kardex_agent' as AgentId,
                btnLabel: 'Auditar Stock Crítico y Mermas de Taller',
                kpiText: `${
                  inventory.filter((i) => i.currentStock <= i.minStock * 1.25).length
                } insumos en alerta · ${
                  movements.filter((m) => m.type === 'merma_taller').length
                } registros de merma`,
              },
              {
                id: 'collections_crm_agent' as AgentId,
                btnLabel: 'Generar Recordatorios de Cobro CxC',
                kpiText: `${
                  orders.filter((o) => o.totalPrice - o.paidAmount > 5).length
                } órdenes con saldo pendiente ($${orders
                  .reduce((acc, o) => acc + Math.max(0, o.totalPrice - o.paidAmount), 0)
                  .toFixed(2)})`,
              },
            ] as const
          ).map((agentCard) => {
            const meta = AGENT_META[agentCard.id];
            const Icon = meta.icon;
            const isRunning = runningAgent === agentCard.id;

            return (
              <div
                key={agentCard.id}
                className="bg-white dark:bg-[#111620] border border-slate-200 dark:border-[#1e2636] rounded-xl p-4 space-y-3 shadow-2xs"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-[#171e2b] border border-slate-200 dark:border-[#253042] flex items-center justify-center text-slate-700 dark:text-slate-300">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                          {meta.name}
                        </h3>
                      </div>
                      <span className="text-[11px] font-mono text-indigo-600 dark:text-indigo-400">
                        {agentCard.kpiText}
                      </span>
                    </div>
                  </div>
                  <span
                    className={`px-2 py-0.5 text-[10px] font-semibold rounded-md border ${meta.badgeClass}`}
                  >
                    {meta.roleTitle}
                  </span>
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  {meta.description}
                </p>

                <button
                  type="button"
                  disabled={runningAgent !== null}
                  onClick={() => handleDelegateToAgent(agentCard.id)}
                  className="w-full py-2 px-3.5 text-xs font-semibold text-slate-800 dark:text-slate-100 bg-slate-100 hover:bg-slate-200 dark:bg-[#171e2b] dark:hover:bg-[#1e2738] border border-slate-200 dark:border-[#253042] rounded-lg transition-all duration-150 inline-flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isRunning ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-500" />
                      <span>Ejecutando agente...</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 text-indigo-500" />
                      <span>{agentCard.btnLabel}</span>
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>

        {/* COLUMNA DERECHA (7 cols): BANDEJA DE PROPUESTAS Y APROBACIÓN DE 1 CLIC */}
        <div className="lg:col-span-7 bg-white dark:bg-[#111620] border border-slate-200 dark:border-[#1e2636] rounded-xl overflow-hidden shadow-2xs">
          {/* Header de la Bandeja con Filtros */}
          <div className="p-4 bg-slate-50/80 dark:bg-[#141a26] border-b border-slate-200 dark:border-[#1e2636] space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-indigo-500" />
                  <span>Bandeja de Tareas Delegadas y Propuestas de Acción</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Revisa el razonamiento de cada agente y ejecuta la acción en el ERP con 1 clic.
                </p>
              </div>

              {/* Selector Pendientes vs Ejecutadas */}
              <div className="flex items-center gap-1 bg-slate-200/70 dark:bg-[#0d1119] p-1 rounded-lg border border-slate-200 dark:border-[#1e2636] self-start">
                {(
                  [
                    { id: 'pending', label: `Pendientes (${pendingCount})` },
                    { id: 'executed', label: `Ejecutadas (${executedCount})` },
                    { id: 'all', label: 'Todas' },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setStatusFilter(tab.id)}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                      statusFilter === tab.id
                        ? 'bg-white dark:bg-[#1c2536] text-slate-900 dark:text-slate-100 shadow-2xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Filtro por Agente */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <Filter className="w-3.5 h-3.5 text-slate-400 mr-1" />
              {(
                [
                  { id: 'all', label: 'Todos los Agentes' },
                  { id: 'quoter_agent', label: 'Cotizador IA' },
                  { id: 'production_optimizer_agent', label: 'Taller & Retazos 2D' },
                  { id: 'inventory_kardex_agent', label: 'Kardex & Stock' },
                  { id: 'collections_crm_agent', label: 'Cobranza CxC' },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setActiveFilterAgent(f.id)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold border transition-colors cursor-pointer ${
                    activeFilterAgent === f.id
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white dark:bg-[#171e2b] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-[#253042] hover:bg-slate-100'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Lista de Propuestas */}
          <div className="divide-y divide-slate-200/80 dark:divide-[#1e2636] max-h-[760px] overflow-y-auto">
            {visibleProposals.length === 0 ? (
              <div className="p-10 text-center space-y-3">
                <Bot className="w-10 h-10 text-slate-400 mx-auto stroke-[1.5]" />
                <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  No hay propuestas en esta vista
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                  Usa cualquiera de los botones de delegación a la izquierda o haz clic en{' '}
                  <strong>"Ejecutar Diagnóstico Integral"</strong> para que los agentes analicen el ERP.
                </p>
              </div>
            ) : (
              visibleProposals.map((prop) => {
                const meta = AGENT_META[prop.agentId] || AGENT_META.quoter_agent;
                const Icon = meta.icon;
                const isExecuted = prop.status === 'executed';

                return (
                  <div
                    key={prop.id}
                    className={`p-4 sm:p-5 space-y-3.5 transition-colors ${
                      isExecuted
                        ? 'bg-slate-50/60 dark:bg-[#0e131d] opacity-85'
                        : 'hover:bg-slate-50/50 dark:hover:bg-[#141a26]/60'
                    }`}
                  >
                    {/* Top row: Badge de Agente + Prioridad + Métrica de Impacto */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-semibold border ${meta.badgeClass}`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          <span>{meta.name}</span>
                        </span>

                        <span
                          className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-md border ${
                            prop.priority === 'Crítica'
                              ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800/70'
                              : prop.priority === 'Alta'
                              ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800/70'
                              : 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-[#171e2b] dark:text-slate-300 dark:border-[#253042]'
                          }`}
                        >
                          Prioridad {prop.priority}
                        </span>

                        <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {prop.createdAt}
                        </span>
                      </div>

                      <span className="px-2.5 py-1 rounded-md text-xs font-mono font-bold bg-slate-100 dark:bg-[#171e2b] text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-[#253042]">
                        {prop.impactMetric}
                      </span>
                    </div>

                    {/* Título y Razonamiento */}
                    <div className="space-y-1">
                      <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        {prop.title}
                      </h4>
                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                        {prop.reasoning}
                      </p>
                    </div>

                    {/* Ficha Técnica Desplegada si es Cotización IA */}
                    {prop.quoteDraft && (
                      <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#0d1119] border border-slate-200 dark:border-[#1e2636] grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                        <div>
                          <span className="text-[10px] uppercase text-slate-400 block font-semibold">
                            Cliente / Contacto
                          </span>
                          <span className="font-semibold text-slate-900 dark:text-slate-100 block truncate">
                            {prop.quoteDraft.clientName}
                          </span>
                          <span className="text-[11px] font-mono text-slate-500">
                            {prop.quoteDraft.clientPhone}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase text-slate-400 block font-semibold">
                            Material Catálogo
                          </span>
                          <span className="font-semibold text-slate-900 dark:text-slate-100 block truncate">
                            {prop.quoteDraft.materialName}
                          </span>
                          <span className="text-[11px] text-indigo-600 dark:text-indigo-400">
                            {prop.quoteDraft.category}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase text-slate-400 block font-semibold">
                            Medidas & Cantidad
                          </span>
                          <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                            {prop.quoteDraft.widthM}m × {prop.quoteDraft.heightM}m ({prop.quoteDraft.quantity} und)
                          </span>
                          <span className="text-[11px] text-slate-500 block truncate">
                            {prop.quoteDraft.finishings.join(', ')}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase text-slate-400 block font-semibold">
                            Total c/IVA (Anticipo 50%)
                          </span>
                          <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                            ${prop.quoteDraft.totalPrice.toFixed(2)}
                          </span>
                          <span className="text-[11px] font-mono text-slate-500 block">
                            50%: ${prop.quoteDraft.suggestedAdvance.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Vista previa del mensaje de WhatsApp si es Cobranza CxC */}
                    {prop.whatsappMessage && (
                      <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#0d1119] border border-slate-200 dark:border-[#1e2636] text-xs font-mono text-slate-700 dark:text-slate-300 whitespace-pre-line">
                        {prop.whatsappMessage}
                      </div>
                    )}

                    {/* Botones de Acción Human-in-the-Loop */}
                    <div className="pt-1 flex flex-wrap items-center justify-between gap-2">
                      {isExecuted ? (
                        <div className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>
                            Aprobada y ejecutada por {prop.executedBy || currentUser.name} ({prop.executedAt})
                          </span>
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center gap-2">
                          {prop.actionType === 'CREATE_QUOTE_ORDER' && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleApproveAndExecuteProposal(prop)}
                                className="px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Crear Orden {nextOrderCode} y Enviar a Kanban</span>
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  handleApproveAndExecuteProposal(prop, 'send_to_quoter_only')
                                }
                                className="px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-[#171e2b] dark:hover:bg-[#1e2738] border border-slate-200 dark:border-[#253042] rounded-lg inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                              >
                                <FileText className="w-3.5 h-3.5" />
                                <span>Abrir en Cotizador Técnico</span>
                              </button>
                            </>
                          )}

                          {(prop.actionType === 'SEND_TO_OPTIMIZER' ||
                            prop.actionType === 'USE_OFFCUT') && (
                            <button
                              type="button"
                              onClick={() => handleApproveAndExecuteProposal(prop)}
                              className="px-3.5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                            >
                              <Layers className="w-3.5 h-3.5" />
                              <span>Aprobar y Cargar en Optimizador 2D</span>
                            </button>
                          )}

                          {prop.actionType === 'CREATE_RESTOCK' && (
                            <button
                              type="button"
                              onClick={() => handleApproveAndExecuteProposal(prop)}
                              className="px-3.5 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-500 rounded-lg inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                            >
                              <Package className="w-3.5 h-3.5" />
                              <span>Generar Solicitud de Reposición en Bodega</span>
                            </button>
                          )}

                          {prop.actionType === 'SEND_WHATSAPP_COLLECTION' && (
                            <button
                              type="button"
                              onClick={() => handleApproveAndExecuteProposal(prop)}
                              className="px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                            >
                              <Send className="w-3.5 h-3.5" />
                              <span>Aprobar y Enviar Recordatorio al Chat WhatsApp</span>
                            </button>
                          )}

                          {prop.actionType === 'ADVANCE_STAGE' && (
                            <button
                              type="button"
                              onClick={() => handleApproveAndExecuteProposal(prop)}
                              className="px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                            >
                              <ArrowRight className="w-3.5 h-3.5" />
                              <span>Avanzar Etapa en Kanban</span>
                            </button>
                          )}

                          {prop.actionType === 'CREATE_CRM_TASK' && (
                            <button
                              type="button"
                              onClick={() => handleApproveAndExecuteProposal(prop)}
                              className="px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Asignar Tarea al Equipo CRM</span>
                            </button>
                          )}
                        </div>
                      )}

                      {!isExecuted && (
                        <button
                          type="button"
                          onClick={() => handleDismissProposal(prop.id)}
                          className="px-2.5 py-1.5 text-xs font-medium text-slate-400 hover:text-rose-500 rounded-lg inline-flex items-center gap-1 transition-colors cursor-pointer"
                          title="Descartar propuesta"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Descartar</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
