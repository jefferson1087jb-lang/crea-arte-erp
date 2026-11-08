import React, { useState } from 'react';
import {
  BookOpen,
  X,
  ArrowRight,
  CheckCircle2,
  ShieldCheck,
  Calculator,
  Palette,
  Wrench,
  Sparkles,
  ChevronRight,
  HelpCircle,
  EyeOff,
} from 'lucide-react';
import { RoleId } from '../data/initialData';

export type GuideModuleId =
  | 'dashboard'
  | 'ai_agents'
  | 'clients'
  | 'quoter'
  | 'kanban'
  | 'timetracking'
  | 'inventory'
  | 'optimizer'
  | 'finance'
  | 'maintenance'
  | 'whatsapp'
  | 'users';

interface RoleStep {
  stepNumber: number;
  shortTitle: string;
  actionLabel: string;
  targetModule: GuideModuleId;
  description: string;
  autoBenefit: string;
}

interface RoleGuideDefinition {
  role: RoleId;
  title: string;
  subtitle: string;
  badgeColor: string;
  icon: React.ComponentType<{ className?: string }>;
  summaryMission: string;
  steps: RoleStep[];
  quickTips: { question: string; answer: string; targetModule: GuideModuleId }[];
}

export const ROLE_GUIDES: Record<RoleId, RoleGuideDefinition> = {
  admin: {
    role: 'admin',
    title: 'Administrador / Gerente General',
    subtitle: 'Control financiero, compras por PDF, costos reales y supervisión de planta',
    badgeColor: 'bg-blue-600 text-white',
    icon: ShieldCheck,
    summaryMission:
      'Tu vista está diseñada para tomar decisiones en segundos: ver cuánto dinero entró hoy, cuál es la utilidad real descontando materiales y horas de taller, e ingresar compras de proveedores con Facturas PDF.',
    steps: [
      {
        stepNumber: 1,
        shortTitle: 'Revisar Rentabilidad y Alertas',
        actionLabel: 'Ir a Resumen Admin',
        targetModule: 'dashboard',
        description:
          'Consulta de un vistazo los 6 indicadores gerenciales: Utilidad Neta Real ($ y %), Caja Neta disponible, Cuentas por Cobrar y alertas de stock o máquinas.',
        autoBenefit: 'Calcula automáticamente el costo real de cada orden sumando sustrato + merma + minutos reales de empleados.',
      },
      {
        stepNumber: 2,
        shortTitle: 'Subir Facturas PDF de Compra',
        actionLabel: 'Ir a Inventario (PDF)',
        targetModule: 'inventory',
        description:
          'Entra a Inventario → pestaña "Ingresar Factura PDF". Sube el PDF del proveedor (o usa las 3 facturas de prueba) para cargar bobinas, planchas o tintas.',
        autoBenefit: 'Transforma rollos cerrados (ej. 3.20×50m) a m² (+160 m²), actualiza el costo unitario y registra el egreso bancario en Caja.',
      },
      {
        stepNumber: 3,
        shortTitle: 'Auditar Caja, Bancos y Deudas',
        actionLabel: 'Ir a Caja y Cobros',
        targetModule: 'finance',
        description:
          'Verifica cada anticipo, liquidación o gasto menor con su Banco/Cuenta, N° de Comprobante (SPI/Transferencia) y N° de Factura.',
        autoBenefit: 'Bloquea visualmente las órdenes terminadas que aún tienen saldo pendiente para evitar entregas sin cobro.',
      },
      {
        stepNumber: 4,
        shortTitle: 'Automatizar Bot de WhatsApp',
        actionLabel: 'Ir a CRM WhatsApp',
        targetModule: 'whatsapp',
        description:
          'Activa o desactiva las 6 reglas automáticas del Bot y usa el botón "Cobranza Automática" para enviar recordatorios de pago en 1 clic.',
        autoBenefit: 'El sistema responde solo cuando el cliente escribe "APROBADO" o "ESTADO" y envía recibos digitales al cobrar.',
      },
    ],
    quickTips: [
      {
        question: '¿Cómo ingreso una factura PDF de lona o acrílico que compré?',
        answer:
          'Ve a "Inventario" → botón azul "Ingresar Factura PDF". Arrastra el PDF, verifica la tabla de conversión a m²/planchas y pulsa "Confirmar e Ingresar".',
        targetModule: 'inventory',
      },
      {
        question: '¿Dónde veo todos mis clientes y cuánto me han comprado en el año?',
        answer:
          'En "Clientes CRM" tienes el directorio completo con etiquetas (VIP, Rótulos 3D, Con Deuda) y el historial de todas sus órdenes y abonos.',
        targetModule: 'clients',
      },
    ],
  },
  sales: {
    role: 'sales',
    title: 'Ventas / Atención al Cliente',
    subtitle: 'Cotización rápida en 3 pasos, creación de órdenes, cobros y seguimiento WhatsApp',
    badgeColor: 'bg-emerald-600 text-white',
    icon: Calculator,
    summaryMission:
      'Tu flujo está resumido para cotizar rápido sin ver fórmulas complejas: eliges el producto (o plantilla de letrero luminoso), pones medidas, copias el presupuesto para WhatsApp y lo conviertes en Orden de Trabajo en 1 clic.',
    steps: [
      {
        stepNumber: 1,
        shortTitle: 'Cotizar en 3 Pasos Simples',
        actionLabel: 'Abrir Cotizador',
        targetModule: 'quoter',
        description:
          'Usa los botones rápidos de "Plantillas de Rótulos" (Caja de Luz, Alucobond 3D, Lona con Estructura), ingresa Ancho × Alto y marca los acabados.',
        autoBenefit: 'Genera al instante el texto formal con desglose e IVA listo para pegar en el WhatsApp del cliente.',
      },
      {
        stepNumber: 2,
        shortTitle: 'Recibir Anticipo y Crear Orden',
        actionLabel: 'Crear Orden en Cotizador',
        targetModule: 'quoter',
        description:
          'En la columna derecha del Cotizador, anota el Anticipo recibido, elige el Banco y N° de Comprobante, y pulsa "Convertir en Orden de Trabajo".',
        autoBenefit: 'Crea la tarjeta en el Kanban de Taller, guarda al cliente en el Directorio CRM y le envía su mensaje de bienvenida por WhatsApp.',
      },
      {
        stepNumber: 3,
        shortTitle: 'Segmentar Clientes e Historial',
        actionLabel: 'Ir a Clientes CRM',
        targetModule: 'clients',
        description:
          'Filtra tu cartera por etiquetas (VIP, Corporativo, Rótulos 3D, Con Saldo Pendiente) y consulta qué pidió cada cliente anteriormente.',
        autoBenefit: 'Todo cliente nuevo que cotices se agrega solo al directorio sin tener que llenarlo dos veces.',
      },
      {
        stepNumber: 4,
        shortTitle: 'Atender Chats y Cobrar Saldos',
        actionLabel: 'Abrir CRM WhatsApp',
        targetModule: 'whatsapp',
        description:
          'Filtra los chats por "Con Saldo" o "Por Entregar", inserta plantillas en 1 clic (Datos bancarios, Pedido listo) y registra el pago final.',
        autoBenefit: 'Al registrar el cobro desde el chat o desde Caja, el cliente recibe su Recibo Digital automático en WhatsApp.',
      },
    ],
    quickTips: [
      {
        question: '¿Cómo cotizo un letrero luminoso o rótulo con estructura metálica?',
        answer:
          'En el Cotizador, haz clic en uno de los 4 botones superiores de "Plantillas en 1 Clic" (ej. Caja de Luz Backlight o Rótulo Alucobond 3D). Ya trae cargada la estructura y los LEDs.',
        targetModule: 'quoter',
      },
      {
        question: '¿Cómo registro el banco y número de transferencia de un abono?',
        answer:
          'Tanto al crear la orden en el Cotizador como en "Caja y Cobros" o dentro de la tarjeta Kanban, tienes los campos de Banco Destino, N° de Comprobante y N° de Factura.',
        targetModule: 'finance',
      },
    ],
  },
  designer: {
    role: 'designer',
    title: 'Diseñador / Pre-prensa y RIP',
    subtitle: 'Control de artes, optimización de material en bobina/plancha y cola de impresión',
    badgeColor: 'bg-purple-600 text-white',
    icon: Palette,
    summaryMission:
      'Tu entorno oculta la contabilidad para que te concentres en preparar archivos, aprovechar al máximo cada rollo o plancha de 1.22×2.44m y lograr la aprobación rápida del cliente.',
    steps: [
      {
        stepNumber: 1,
        shortTitle: 'Tomar Orden e Iniciar Tiempo',
        actionLabel: 'Ver Kanban Diseño',
        targetModule: 'kanban',
        description:
          'Ubica tus órdenes en la columna "En Diseño / Pre-prensa" y pulsa el botón "Tiempo" en la tarjeta para cronometrar tus minutos de diseño.',
        autoBenefit: 'El cronómetro queda activo en la barra lateral mientras navegas por cualquier módulo.',
      },
      {
        stepNumber: 2,
        shortTitle: 'Optimizar Planchas y Bobinas',
        actionLabel: 'Abrir Optimizador 2D',
        targetModule: 'optimizer',
        description:
          'Antes de mandar a corte o impresión, ingresa la medida de las piezas para ver cuántas caben por ancho de rollo (1.05m, 1.27m, 1.52m) o plancha (1.22×2.44m).',
        autoBenefit: 'Te muestra el dibujo de anidado 2D, gira las piezas automáticamente si caben más y calcula el % exacto de desperdicio.',
      },
      {
        stepNumber: 3,
        shortTitle: 'Enviar Arte a Aprobación',
        actionLabel: 'Ir a CRM WhatsApp',
        targetModule: 'whatsapp',
        description:
          'Pega el enlace o nombre del archivo final en la orden y muévela a la etapa "Aprobación del Cliente".',
        autoBenefit: 'El Bot envía el aviso al cliente por WhatsApp y cuando el cliente responde "APROBADO", la orden avanza sola a Cola de Impresión.',
      },
    ],
    quickTips: [
      {
        question: '¿Cómo sé si el cliente ya aprobó el diseño por WhatsApp?',
        answer:
          'En la tarjeta del Kanban verás el sello verde "Arte Aprobado". Además, si el cliente responde "APROBADO" en el chat, el sistema lo aprueba y lo pasa a impresión automáticamente.',
        targetModule: 'kanban',
      },
      {
        question: '¿Cómo me doy de baja de un proyecto cuando ya terminé mi parte (ej. el diseño)?',
        answer:
          'En la tarjeta del Tablero Kanban (o al detener el Cronómetro) haz clic en el botón verde "Finalizar mi parte / Darme de baja". Tu estado pasará a Finalizado y la orden saldrá de tu filtro de "Mis Activos".',
        targetModule: 'kanban',
      },
      {
        question: '¿Cómo verifico si hay suficiente vinil o acrílico antes de ripear?',
        answer:
          'Entra a "Inventario" para consultar los m² o planchas disponibles en tiempo real.',
        targetModule: 'inventory',
      },
    ],
  },
  operator: {
    role: 'operator',
    title: 'Operador de Taller / Instalador',
    subtitle: 'Vista simplificada de producción, cronómetro de máquinas, mermas y mantenimiento',
    badgeColor: 'bg-amber-600 text-white',
    icon: Wrench,
    summaryMission:
      'Tienes una vista directa y sin distracciones financieras: ves qué órdenes hay que imprimir, cortar, armar en 3D o instalar hoy, registras tus tiempos y cuidas las máquinas.',
    steps: [
      {
        stepNumber: 1,
        shortTitle: 'Ver Cola en Modo Simplificado',
        actionLabel: 'Ir a Kanban Taller',
        targetModule: 'kanban',
        description:
          'En el Kanban, el sistema activa tu vista operativa enfocada en: Impresión/Corte, Acabados/Armado 3D e Instalación.',
        autoBenefit: 'Al mover una orden a "En Cola de Impresión/Corte", el sistema descuenta automáticamente los m² o planchas del inventario.',
      },
      {
        stepNumber: 2,
        shortTitle: 'Cronometrar Máquina o Montaje',
        actionLabel: 'Abrir Cronómetro',
        targetModule: 'timetracking',
        description:
          'Selecciona la orden y elige si estás en fase de "Impresión / Corte / Taller 3D" o "Instalación en Sitio" para registrar el tiempo real.',
        autoBenefit: 'Compara tus horas reales contra las horas estimadas sin que tengas que llenar reportes en papel.',
      },
      {
        stepNumber: 3,
        shortTitle: 'Reportar Merma o Pedir Material',
        actionLabel: 'Ir a Bodega / Mermas',
        targetModule: 'inventory',
        description:
          'Si un material se atascó o necesitas que compren más lona/LEDs, usa los botones rápidos de "Reportar Merma" o "Pedir Reposición".',
        autoBenefit: 'Envía una alerta inmediata al Dashboard del Administrador para que apruebe la compra.',
      },
      {
        stepNumber: 4,
        shortTitle: 'Registrar Limpieza de Equipos',
        actionLabel: 'Ir a Mant. Maquinaria',
        targetModule: 'maintenance',
        description:
          'Registra limpiezas de cabezal, cambio de cuchillas o lubricación de rieles en los plotters, laminadora y láser.',
        autoBenefit: 'Reinicia automáticamente a 0 días el semáforo de mantenimiento preventivo de la máquina.',
      },
    ],
    quickTips: [
      {
        question: '¿Tengo que descontar manualmente el material cuando imprimo una orden?',
        answer:
          'No. Apenas pasas la orden a "En Cola de Impresión/Corte", el sistema resta automáticamente del inventario los m² o planchas más el % de merma.',
        targetModule: 'kanban',
      },
      {
        question: '¿Qué hago si una orden ya está lista para entregar o instalar?',
        answer:
          'Muévela a "Instalación / Listo para Retiro". El sistema le avisará automáticamente por WhatsApp al cliente que su trabajo está terminado.',
        targetModule: 'kanban',
      },
    ],
  },
};

interface QuickRoleWorkflowBannerProps {
  currentRole: RoleId;
  activeModule: GuideModuleId;
  onNavigate: (mod: GuideModuleId) => void;
  onOpenFullGuide: () => void;
}

export const QuickRoleWorkflowBanner: React.FC<QuickRoleWorkflowBannerProps> = ({
  currentRole,
  activeModule,
  onNavigate,
  onOpenFullGuide,
}) => {
  const [collapsed, setCollapsed] = useState<boolean>(true);
  const guide = ROLE_GUIDES[currentRole];

  if (collapsed) {
    return (
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl shadow-2xs text-xs">
        <div className="flex items-center gap-2.5 text-slate-600 dark:text-slate-400 min-w-0 flex-1">
          <span className={`px-2 py-0.5 text-[10px] font-bold rounded-md shrink-0 ${guide.badgeColor}`}>
            {guide.title.split('/')[0].trim()}
          </span>
          <span className="text-slate-500 dark:text-slate-400 truncate min-w-0">
            {guide.steps.map((s) => `${s.stepNumber}. ${s.shortTitle}`).join('  →  ')}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            className="text-indigo-600 dark:text-indigo-400 hover:underline font-semibold text-[11px]"
          >
            Desplegar 4 Pasos
          </button>
          <span className="text-slate-300 dark:text-slate-700">·</span>
          <button
            type="button"
            onClick={onOpenFullGuide}
            className="text-slate-600 dark:text-slate-300 hover:underline font-medium text-[11px]"
          >
            Manual del Rol
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-4 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 mb-3 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <span className={`px-2.5 py-0.5 text-[11px] font-bold rounded-md ${guide.badgeColor}`}>
            Ruta Rápida: {guide.title.split('/')[0].trim()}
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400 hidden md:inline">
            Sigue estos pasos en orden para operar tu turno sin complicaciones:
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onOpenFullGuide}
            className="px-3 py-1.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 border border-indigo-200/80 dark:border-indigo-800 rounded-lg inline-flex items-center gap-1.5 transition-all duration-200"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Guía Detallada de Uso</span>
          </button>
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            title="Ocultar barra de pasos rápidos"
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <EyeOff className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {guide.steps.map((step) => {
          const isCurrent = activeModule === step.targetModule;
          return (
            <button
              key={step.stepNumber}
              type="button"
              onClick={() => onNavigate(step.targetModule)}
              className={`text-left p-3 rounded-xl border transition-all duration-200 flex items-start justify-between gap-2 group ${
                isCurrent
                  ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30 shadow-2xs'
                  : 'border-slate-200/80 dark:border-slate-800 hover:border-indigo-400 bg-slate-50/60 dark:bg-slate-950/50'
              }`}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className={`w-5 h-5 rounded-full text-[11px] font-mono font-bold flex items-center justify-center shrink-0 ${
                      isCurrent
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {step.stepNumber}
                  </span>
                  <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                    {step.shortTitle}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-1 pl-7">
                  {step.actionLabel}
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 shrink-0 mt-0.5 transition-transform group-hover:translate-x-0.5" />
            </button>
          );
        })}
      </div>
    </div>
  );
};

interface RoleGuideModalProps {
  isOpen: boolean;
  initialRole: RoleId;
  onClose: () => void;
  onNavigateModule: (mod: GuideModuleId) => void;
  onSwitchRole?: (role: RoleId) => void;
}

export const RoleGuideModal: React.FC<RoleGuideModalProps> = ({
  isOpen,
  initialRole,
  onClose,
  onNavigateModule,
}) => {
  const [selectedTab, setSelectedTab] = useState<RoleId | 'full_cycle'>(initialRole);

  if (!isOpen) return null;

  const activeGuide = selectedTab !== 'full_cycle' ? ROLE_GUIDES[selectedTab] : null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden shadow-2xl my-auto">
        {/* Cabecera del Manual Interactivo Adaptativa (Claro / Oscuro) */}
        <div className="px-4 sm:px-6 py-3.5 sm:py-4 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white flex items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-xl bg-indigo-600 text-white shadow-xs shadow-indigo-500/20 shrink-0">
              <BookOpen className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate">
                Guía Interactiva de Uso por Roles — Crea Arte ERP
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-1">
                Aprende a manejar cada perfil en 4 pasos simples y salta directamente a la pantalla que necesites
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Selector de Pestañas por Rol */}
        <div className="px-4 sm:px-6 py-2.5 sm:py-3 bg-slate-100/80 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center gap-1.5 sm:gap-2 shrink-0">
          {(
            [
              { id: 'admin', label: '1. Administrador / Gerente' },
              { id: 'sales', label: '2. Ventas y Cotizaciones' },
              { id: 'designer', label: '3. Diseñador / Pre-prensa' },
              { id: 'operator', label: '4. Operador / Instalador' },
              { id: 'full_cycle', label: '⚡ Ciclo Completo de una Orden' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSelectedTab(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 ${
                selectedTab === tab.id
                  ? 'bg-indigo-600 text-white shadow-xs shadow-indigo-500/20'
                  : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 dark:hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Cuerpo de la Guía */}
        <div className="p-4 sm:p-6 flex-1 min-h-0 overflow-y-auto space-y-6">
          {activeGuide ? (
            <>
              {/* Resumen de Misión del Rol */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-0.5 text-xs font-bold rounded ${activeGuide.badgeColor}`}>
                      {activeGuide.title}
                    </span>
                    <span className="text-xs text-slate-500 font-medium">
                      {activeGuide.subtitle}
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed pt-1">
                    {activeGuide.summaryMission}
                  </p>
                </div>
              </div>

              {/* LosPasos del Rol */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                  Paso a Paso para operar con este Rol:
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {activeGuide.steps.map((step) => (
                    <div
                      key={step.stepNumber}
                      className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col justify-between gap-3 hover:border-blue-400 transition-colors"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="inline-flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white">
                            <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-mono text-xs flex items-center justify-center">
                              {step.stepNumber}
                            </span>
                            {step.shortTitle}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                          {step.description}
                        </p>
                        <div className="p-2 rounded-lg bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-900/60 text-[11px] text-emerald-800 dark:text-emerald-300 flex items-start gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 shrink-0 mt-0.5 text-emerald-600" />
                          <span>
                            <strong>Lo que el sistema hace solo:</strong> {step.autoBenefit}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          onNavigateModule(step.targetModule);
                          onClose();
                        }}
                        className="w-full py-2 px-3 text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-blue-600 hover:text-white text-slate-900 dark:text-white rounded-lg inline-flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <span>{step.actionLabel}</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Preguntas Frecuentes del Rol */}
              <div className="space-y-2.5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <HelpCircle className="w-3.5 h-3.5 text-blue-600" />
                  <span>Preguntas Frecuentes de este Rol</span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {activeGuide.quickTips.map((tip, i) => (
                    <div
                      key={i}
                      className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1.5"
                    >
                      <div className="text-xs font-bold text-slate-900 dark:text-white">
                        {tip.question}
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                        {tip.answer}
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          onNavigateModule(tip.targetModule);
                          onClose();
                        }}
                        className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1 pt-1"
                      >
                        <span>Ir a esa pantalla ahora</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            /* Pestaña del Ciclo Completo Resumido en 5 Pasos */
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 text-xs text-slate-700 dark:text-slate-300">
                <strong className="text-slate-900 dark:text-white block mb-1">
                  ¿Cómo funciona todo el taller conectado de principio a fin?
                </strong>
                No necesitas ingresar los datos dos veces. Cada vez que una orden avanza de etapa, el sistema descuenta inventario, registra bancos y avisa al cliente por WhatsApp automáticamente:
              </div>

              <div className="space-y-3">
                {[
                  {
                    step: 'Paso 1 (Ventas)',
                    title: 'Cotizar y Convertir en Orden con Anticipo',
                    desc: 'En el Cotizador eliges material o plantilla 3D, anotas el anticipo con su Banco/Comprobante y pulsas "Convertir en Orden". El cliente se guarda en el Directorio CRM y recibe bienvenida por WhatsApp.',
                    mod: 'quoter' as GuideModuleId,
                    btn: 'Ir al Cotizador',
                  },
                  {
                    step: 'Paso 2 (Diseño)',
                    title: 'Optimizar Corte y Aprobación Automática por WhatsApp',
                    desc: 'El diseñador calcula el acomodo en el Optimizador 2D y pasa la orden a "Aprobación del Cliente". Cuando el cliente responde "APROBADO" en el chat, la orden pasa sola a Impresión.',
                    mod: 'optimizer' as GuideModuleId,
                    btn: 'Ir al Optimizador 2D',
                  },
                  {
                    step: 'Paso 3 (Taller / Bodega)',
                    title: 'Impresión y Descuento Automático de Stock',
                    desc: 'Al entrar a "En Cola de Impresión/Corte", el sistema resta automáticamente los m² de lona/vinil o planchas rígidas del Inventario y registra los minutos del operador.',
                    mod: 'kanban' as GuideModuleId,
                    btn: 'Ir al Tablero Kanban',
                  },
                  {
                    step: 'Paso 4 (Compras PDF)',
                    title: 'Reposición de Material con Facturas PDF',
                    desc: 'Cuando compras más bobinas o planchas, subes la Factura PDF en Inventario. El sistema transforma rollos cerrados a m², actualiza el stock y registra el pago bancario.',
                    mod: 'inventory' as GuideModuleId,
                    btn: 'Ir a Lector Facturas PDF',
                  },
                  {
                    step: 'Paso 5 (Caja y Entrega)',
                    title: 'Liquidación de Saldo y Recibo Digital',
                    desc: 'Al terminar el trabajo, se registra el pago del saldo pendiente en Caja (con Banco y Comprobante). El sistema libera el bloqueo de entrega y envía el Recibo Digital por WhatsApp.',
                    mod: 'finance' as GuideModuleId,
                    btn: 'Ir a Caja y Cobros',
                  },
                ].map((item, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 text-[11px] font-mono font-bold rounded bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                          {item.step}
                        </span>
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                          {item.title}
                        </h4>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400">
                        {item.desc}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        onNavigateModule(item.mod);
                        onClose();
                      }}
                      className="px-3 py-1.5 text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-blue-600 hover:text-white text-slate-800 dark:text-slate-200 rounded-lg shrink-0 inline-flex items-center gap-1.5"
                    >
                      <span>{item.btn}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Pie del Modal */}
        <div className="px-4 sm:px-6 py-3 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Puedes abrir esta guía en cualquier momento desde el menú superior.</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-bold bg-slate-900 dark:bg-blue-600 text-white rounded-lg hover:opacity-90 shrink-0"
          >
            Entendido, volver al sistema
          </button>
        </div>
      </div>
    </div>
  );
};
