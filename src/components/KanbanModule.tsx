import React, { useState, useMemo, useEffect } from 'react';
import {
  Search,
  ChevronRight,
  ChevronLeft,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Lock,
  FileCheck,
  Printer,
  Edit3,
  X,
  DollarSign,
  PackageCheck,
  Users,
  UserPlus,
  UserCheck,
  RotateCcw,
  Trash2,
  LayoutGrid,
  Columns3,
  ListFilter,
  ArrowRight,
  GripVertical,
  FolderPlus,
  QrCode,
} from 'lucide-react';
import {
  WorkOrder,
  ORDER_STAGES,
  OrderStage,
  RoleId,
  UserProfile,
  PaymentAuditDetails,
  BANK_ACCOUNTS_CATALOG,
  ProjectAssignment,
  ProjectTaskRole,
  PROJECT_TASK_ROLES,
  getOrderTeamAssignments,
  isDesignOnlyOrder,
  getLiveSimulationNowMs,
  getLiveSimulationDateTimeStr,
  getAssignmentElapsedDuration,
} from '../data/initialData';
import {
  downloadDeliveryAndWarrantyActPdf,
  downloadBlindWorkOrderPdf,
} from '../utils/deliveryActPdfGenerator';

interface KanbanModuleProps {
  orders: WorkOrder[];
  users: UserProfile[];
  currentRole: RoleId;
  currentUser: UserProfile;
  onMoveOrderStage: (orderId: string, targetStage: OrderStage) => void;
  onUpdateOrder: (updated: WorkOrder) => void;
  onRegisterPayment: (
    orderId: string,
    amount: number,
    method: 'Efectivo' | 'Transferencia Bancaria' | 'Tarjeta',
    auditDetails?: PaymentAuditDetails
  ) => void;
  onStartTimerForOrder: (orderId: string, phase: 'design' | 'machine' | 'installation') => void;
  onOpenDriveModal?: (orderId: string) => void;
  onOpenQrTracker?: (orderId: string) => void;
  onNotify: (msg: string) => void;
}

// Fecha de referencia del sistema: 2026-10-16T19:43:00
const SYSTEM_NOW = new Date('2026-10-16T19:43:00').getTime();

// Agrupación intuitiva en 4 Estaciones operativas que caben en pantalla completa sin scroll horizontal
interface MacroStation {
  id: string;
  title: string;
  subtitle: string;
  accentBorder: string;
  headerBg: string;
  stages: OrderStage[];
  defaultDropStage: OrderStage;
}

const MACRO_STATIONS: MacroStation[] = [
  {
    id: 'station-design',
    title: '1. Comercial y Diseño',
    subtitle: 'Cotización, Pre-prensa y Aprobación',
    accentBorder: 'border-t-2 border-t-slate-400 dark:border-t-slate-600',
    headerBg: 'bg-slate-50 dark:bg-[#141a26]',
    stages: [
      'Cotizado / Anticipo Pendiente',
      'En Diseño y Arte',
      'Aprobación del Cliente',
    ],
    defaultDropStage: 'En Diseño y Arte',
  },
  {
    id: 'station-production',
    title: '2. Impresión y Taller 3D',
    subtitle: 'Plotter, Láser, CNC, Soldadura y Armado',
    accentBorder: 'border-t-2 border-t-slate-400 dark:border-t-slate-600',
    headerBg: 'bg-slate-50 dark:bg-[#141a26]',
    stages: ['En Cola de Impresión/Corte', 'Acabados y Armado 3D'],
    defaultDropStage: 'En Cola de Impresión/Corte',
  },
  {
    id: 'station-install',
    title: '3. Listo / En Instalación',
    subtitle: 'Montaje en sitio o retiro en local',
    accentBorder: 'border-t-2 border-t-slate-400 dark:border-t-slate-600',
    headerBg: 'bg-slate-50 dark:bg-[#141a26]',
    stages: ['Instalación / Listo para Retiro'],
    defaultDropStage: 'Instalación / Listo para Retiro',
  },
  {
    id: 'station-done',
    title: '4. Entregado y Liquidado',
    subtitle: 'Órdenes cerradas y cobradas al 100%',
    accentBorder: 'border-t-2 border-t-emerald-600/80 dark:border-t-emerald-500/70',
    headerBg: 'bg-slate-50 dark:bg-[#141a26]',
    stages: ['Finalizado y Liquidado'],
    defaultDropStage: 'Finalizado y Liquidado',
  },
];

// Etiquetas cortas y acción sugerida para el siguiente paso de cada etapa
const STAGE_META: Record<
  OrderStage,
  {
    stepNum: number;
    shortName: string;
    nextActionLabel: string;
    badgeClass: string;
  }
> = {
  'Cotizado / Anticipo Pendiente': {
    stepNum: 1,
    shortName: '1. Anticipo Pendiente',
    nextActionLabel: 'Pasar a Diseño →',
    badgeClass:
      'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700',
  },
  'En Diseño y Arte': {
    stepNum: 2,
    shortName: '2. En Diseño / RIP',
    nextActionLabel: 'Enviar a Aprobación →',
    badgeClass:
      'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
  },
  'Aprobación del Cliente': {
    stepNum: 3,
    shortName: '3. Esperando Aprobación',
    nextActionLabel: 'Aprobar y Mandar a Impresión →',
    badgeClass:
      'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800',
  },
  'En Cola de Impresión/Corte': {
    stepNum: 4,
    shortName: '4. Impresión / Corte',
    nextActionLabel: 'Pasar a Armado / Taller 3D →',
    badgeClass:
      'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  },
  'Acabados y Armado 3D': {
    stepNum: 5,
    shortName: '5. Taller / Armado 3D',
    nextActionLabel: 'Marcar Listo / Instalación →',
    badgeClass:
      'bg-orange-50 dark:bg-orange-950/60 text-orange-800 dark:text-orange-300 border-orange-200 dark:border-orange-800',
  },
  'Instalación / Listo para Retiro': {
    stepNum: 6,
    shortName: '6. Listo / En Montaje',
    nextActionLabel: 'Confirmar Entrega Final →',
    badgeClass:
      'bg-purple-50 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 border-purple-200 dark:border-purple-800',
  },
  'Finalizado y Liquidado': {
    stepNum: 7,
    shortName: '7. Entregado',
    nextActionLabel: 'Orden Finalizada',
    badgeClass:
      'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
  },
};

export function getTrafficLightStatus(deadlineIso: string, stage: OrderStage) {
  if (stage === 'Finalizado y Liquidado') {
    return {
      code: 'completed',
      label: 'Entregado',
      textColor: 'text-emerald-700 dark:text-emerald-400',
      pillBg: 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800',
      hoursLeft: 0,
    };
  }
  const deadlineMs = new Date(deadlineIso).getTime();
  const diffHours = (deadlineMs - SYSTEM_NOW) / (1000 * 60 * 60);

  if (diffHours < 0) {
    return {
      code: 'red',
      label: `Vencido (${Math.abs(Math.round(diffHours))}h)`,
      textColor: 'text-red-700 dark:text-red-400 font-semibold',
      pillBg: 'bg-red-50 dark:bg-red-950/60 border-red-200 dark:border-red-800',
      hoursLeft: diffHours,
    };
  }
  if (diffHours <= 24) {
    return {
      code: 'yellow',
      label: `Urgente (${Math.round(diffHours)}h)`,
      textColor: 'text-amber-700 dark:text-amber-400 font-semibold',
      pillBg: 'bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800',
      hoursLeft: diffHours,
    };
  }
  const days = Math.floor(diffHours / 24);
  return {
    code: 'green',
    label: `${days}d ${Math.round(diffHours % 24)}h rest.`,
    textColor: 'text-emerald-700 dark:text-emerald-400',
    pillBg: 'bg-emerald-50/60 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/70',
    hoursLeft: diffHours,
  };
}

export const KanbanModule: React.FC<KanbanModuleProps> = ({
  orders,
  users,
  currentRole,
  currentUser,
  onMoveOrderStage,
  onUpdateOrder,
  onRegisterPayment,
  onStartTimerForOrder,
  onOpenDriveModal,
  onOpenQrTracker,
  onNotify,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [urgencyFilter, setUrgencyFilter] = useState<'all' | 'red' | 'yellow' | 'green'>('all');
  const [assignmentFilter, setAssignmentFilter] = useState<'all' | 'my_active' | 'my_completed'>(
    'all'
  );
  const [selectedStageFilter, setSelectedStageFilter] = useState<OrderStage | 'all'>('all');

  // Reloj en vivo para mostrar cuánto tiempo lleva cada empleado dentro del proyecto hasta darse de baja
  const [liveNowMs, setLiveNowMs] = useState<number>(() => getLiveSimulationNowMs());
  useEffect(() => {
    const interval = setInterval(() => {
      setLiveNowMs(getLiveSimulationNowMs());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Vista por defecto: 'stations' (4 columnas que caben sin scroll horizontal), 'detailed' (7 columnas), o 'operator' (tabla)
  const [viewMode, setViewMode] = useState<'stations' | 'detailed' | 'operator'>('stations');

  // Soporte Drag & Drop intuitivo
  const [draggedOrderId, setDraggedOrderId] = useState<string | null>(null);
  const [dragOverTargetId, setDragOverTargetId] = useState<string | null>(null);

  // Modal de Ficha Completa
  const [selectedOrder, setSelectedOrder] = useState<WorkOrder | null>(null);
  const [activeModalTab, setActiveModalTab] = useState<'team' | 'production' | 'payment'>('team');

  // MEJORA 2: Modal de Orden de Trabajo (OT) Ciega para Taller e Instaladores (100% Sin Precios)
  const [blindOtOrder, setBlindOtOrder] = useState<WorkOrder | null>(null);

  const [paymentInput, setPaymentInput] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<
    'Efectivo' | 'Transferencia Bancaria' | 'Tarjeta'
  >('Transferencia Bancaria');
  const [paymentBank, setPaymentBank] = useState<string>(BANK_ACCOUNTS_CATALOG[0]);
  const [paymentRef, setPaymentRef] = useState<string>('SPI-20261017-99');
  const [paymentInvoice, setPaymentInvoice] = useState<string>('FAC-001-002-0004832');

  // Estado para agregar nuevos responsables en el modal de la orden
  const [newAssigneeUserId, setNewAssigneeUserId] = useState<string>(
    users[0]?.id || 'usr-operator-2'
  );
  const [newAssigneeRole, setNewAssigneeRole] = useState<ProjectTaskRole>(
    'Taller / Soldadura / Armado'
  );
  const [closingNoteDrafts, setClosingNoteDrafts] = useState<Record<string, string>>({});

  const canSeeFinancials = currentRole === 'admin' || currentRole === 'sales';

  const getUserName = (id: string) => {
    const found = users.find((u) => u.id === id);
    return found ? found.name : 'Sin asignar';
  };

  const defaultRoleForUser = (user?: UserProfile): ProjectTaskRole => {
    if (!user) return 'Taller / Soldadura / Armado';
    if (user.role === 'designer') return 'Diseño y Pre-prensa';
    if (user.department === 'Instalación') return 'Instalación y Montaje';
    if (user.department === 'Taller/Armado') return 'Taller / Soldadura / Armado';
    if (user.role === 'operator') return 'Impresión / Corte';
    return 'Supervisión / Comercial';
  };

  // Contadores de proyectos para el usuario activo
  const myCounts = useMemo(() => {
    let activeCount = 0;
    let completedCount = 0;
    orders.forEach((o) => {
      const team = getOrderTeamAssignments(o);
      const myAssign = team.find((a) => a.userId === currentUser.id);
      if (myAssign) {
        if (myAssign.status === 'active') activeCount++;
        if (myAssign.status === 'completed') completedCount++;
      }
    });
    return { activeCount, completedCount };
  }, [orders, currentUser.id]);

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      if (selectedStageFilter !== 'all' && o.stage !== selectedStageFilter) {
        return false;
      }

      const matchesSearch =
        o.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.materialName.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      if (urgencyFilter !== 'all') {
        const sem = getTrafficLightStatus(o.deadline, o.stage);
        if (sem.code !== urgencyFilter) return false;
      }

      if (assignmentFilter !== 'all') {
        const team = getOrderTeamAssignments(o);
        const myAssign = team.find((a) => a.userId === currentUser.id);
        if (assignmentFilter === 'my_active' && (!myAssign || myAssign.status !== 'active')) {
          return false;
        }
        if (
          assignmentFilter === 'my_completed' &&
          (!myAssign || myAssign.status !== 'completed')
        ) {
          return false;
        }
      }

      return true;
    });
  }, [
    orders,
    searchQuery,
    urgencyFilter,
    assignmentFilter,
    selectedStageFilter,
    currentUser.id,
  ]);

  const handleOpenModal = (
    order: WorkOrder,
    initialTab: 'team' | 'production' | 'payment' = 'team'
  ) => {
    const normalizedTeam = getOrderTeamAssignments(order);
    const orderWithTeam = { ...order, teamAssignments: normalizedTeam };
    setSelectedOrder(orderWithTeam);
    setActiveModalTab(initialTab);
    const pending = Math.max(0, Number((order.totalPrice - order.paidAmount).toFixed(2)));
    setPaymentInput(pending);

    const unassigned = users.find((u) => !normalizedTeam.some((a) => a.userId === u.id));
    if (unassigned) {
      setNewAssigneeUserId(unassigned.id);
      setNewAssigneeRole(defaultRoleForUser(unassigned));
    }
  };

  const actorSignature = `${currentUser.name} (${currentUser.roleLabel.split('/')[0].trim()})`;

  /**
   * Da de baja (finaliza el trabajo) de un colaborador dentro de la orden
   */
  const handleSignOffCollaborator = (
    order: WorkOrder,
    userId: string,
    customClosingNote?: string
  ) => {
    const currentTeam = getOrderTeamAssignments(order);
    const targetAssign = currentTeam.find((a) => a.userId === userId);
    const userName = getUserName(userId);

    const nowStamp = getLiveSimulationDateTimeStr();

    const updatedTeam: ProjectAssignment[] = currentTeam.map((a) =>
      a.userId === userId
        ? {
            ...a,
            status: 'completed',
            completedAt: nowStamp,
            completedBy: actorSignature,
            closingNote:
              customClosingNote?.trim() ||
              closingNoteDrafts[userId]?.trim() ||
              `Trabajo de ${a.taskRole} finalizado por ${userName}.`,
          }
        : a
    );

    const updatedOrder: WorkOrder = {
      ...order,
      teamAssignments: updatedTeam,
    };

    onUpdateOrder(updatedOrder);
    if (selectedOrder && selectedOrder.id === order.id) {
      setSelectedOrder(updatedOrder);
    }

    onNotify(
      `✓ Baja registrada en ${order.id} por ${actorSignature}: ${userName} terminó su parte (${
        targetAssign?.taskRole || 'Responsable'
      }) y su reloj en el proyecto quedó detenido.`
    );
  };

  const handleReactivateCollaborator = (order: WorkOrder, userId: string) => {
    const currentTeam = getOrderTeamAssignments(order);
    const updatedTeam: ProjectAssignment[] = currentTeam.map((a) =>
      a.userId === userId
        ? {
            ...a,
            status: 'active',
            assignedBy: actorSignature,
            completedAt: undefined,
            completedBy: undefined,
            closingNote: undefined,
          }
        : a
    );
    const updatedOrder: WorkOrder = {
      ...order,
      teamAssignments: updatedTeam,
    };
    onUpdateOrder(updatedOrder);
    if (selectedOrder && selectedOrder.id === order.id) {
      setSelectedOrder(updatedOrder);
    }
    onNotify(`${getUserName(userId)} fue reactivado como responsable activo en ${order.id} por ${actorSignature}.`);
  };

  const handleAddCollaboratorToOrder = (
    order: WorkOrder,
    userId: string,
    taskRole: ProjectTaskRole
  ) => {
    const currentTeam = getOrderTeamAssignments(order);
    if (currentTeam.some((a) => a.userId === userId)) {
      onNotify(`${getUserName(userId)} ya está asignado a este proyecto.`);
      return;
    }

    const newEntry: ProjectAssignment = {
      userId,
      taskRole,
      status: 'active',
      assignedAt: getLiveSimulationDateTimeStr(),
      assignedBy: actorSignature,
    };

    const updatedTeam = [...currentTeam, newEntry];
    const updatedOrder: WorkOrder = {
      ...order,
      teamAssignments: updatedTeam,
    };

    onUpdateOrder(updatedOrder);
    if (selectedOrder && selectedOrder.id === order.id) {
      setSelectedOrder(updatedOrder);
    }

    const nextUnassigned = users.find((u) => !updatedTeam.some((a) => a.userId === u.id));
    if (nextUnassigned) {
      setNewAssigneeUserId(nextUnassigned.id);
      setNewAssigneeRole(defaultRoleForUser(nextUnassigned));
    }

    onNotify(`${getUserName(userId)} asignado a ${order.id} en ${taskRole}.`);
  };

  const handleRemoveCollaboratorFromOrder = (order: WorkOrder, userId: string) => {
    const currentTeam = getOrderTeamAssignments(order);
    if (currentTeam.length <= 1) {
      onNotify('El proyecto debe mantener al menos 1 responsable registrado.');
      return;
    }
    const updatedTeam = currentTeam.filter((a) => a.userId !== userId);
    const updatedOrder: WorkOrder = {
      ...order,
      teamAssignments: updatedTeam,
    };
    onUpdateOrder(updatedOrder);
    if (selectedOrder && selectedOrder.id === order.id) {
      setSelectedOrder(updatedOrder);
    }
    onNotify(`${getUserName(userId)} fue retirado de la lista de responsables de ${order.id}.`);
  };

  const handleAttemptMoveStage = (order: WorkOrder, targetStage: OrderStage) => {
    if (order.stage === targetStage) return;
    const pendingBalance = Number((order.totalPrice - order.paidAmount).toFixed(2));
    const designOnly = isDesignOnlyOrder(order);

    // Regla 1 (Bloqueo de Producción): No permitir pasar a Impresión/Corte o Armado 3D sin Arte Aprobado (salvo Admin que lo autoriza)
    if (
      !designOnly &&
      (targetStage === 'En Cola de Impresión/Corte' || targetStage === 'Acabados y Armado 3D') &&
      !order.artworkApproved
    ) {
      if (currentRole === 'admin') {
        onUpdateOrder({ ...order, artworkApproved: true });
      } else {
        onNotify(
          `🔒 Bloqueo de Etapa (${order.id}): Confirma primero el Arte Aprobado por el cliente antes de enviar a Impresión/Corte.`
        );
        handleOpenModal(order, 'production');
        return;
      }
    }

    // Regla 2 (Bloqueo Financiero y de Entrega): si intenta pasar a Finalizado y Liquidado con saldo pendiente, abre directo la pestaña de cobro
    if (targetStage === 'Finalizado y Liquidado' && pendingBalance > 0.01) {
      onNotify(
        `🔒 Bloqueo de Entrega (${order.id}): Liquida primero el saldo pendiente de $${pendingBalance.toFixed(
          2
        )} antes de cerrar la orden.`
      );
      handleOpenModal(order, canSeeFinancials ? 'payment' : 'production');
      return;
    }

    onMoveOrderStage(order.id, targetStage);
  };

  const handleStepStage = (order: WorkOrder, direction: -1 | 1) => {
    const designOnly = isDesignOnlyOrder(order);

    // En trabajos de Solo Diseño Gráfico (ej. Creación de Logo), se omiten las etapas físicas de taller (4 y 5)
    if (designOnly) {
      const digitalPipeline: OrderStage[] = [
        'Cotizado / Anticipo Pendiente',
        'En Diseño y Arte',
        'Aprobación del Cliente',
        'Instalación / Listo para Retiro', // En digital = Listo para Entrega Digital de Editables
        'Finalizado y Liquidado',
      ];
      const currentDigitalIdx = digitalPipeline.indexOf(order.stage);
      if (currentDigitalIdx !== -1) {
        const nextDigitalIdx = currentDigitalIdx + direction;
        if (nextDigitalIdx < 0 || nextDigitalIdx >= digitalPipeline.length) return;
        const targetStage = digitalPipeline[nextDigitalIdx];
        if (
          order.stage === 'Aprobación del Cliente' &&
          targetStage === 'Instalación / Listo para Retiro' &&
          !order.artworkApproved
        ) {
          onUpdateOrder({ ...order, artworkApproved: true });
        }
        handleAttemptMoveStage(order, targetStage);
        return;
      }
    }

    const currentIndex = ORDER_STAGES.indexOf(order.stage);
    const nextIndex = currentIndex + direction;
    if (nextIndex < 0 || nextIndex >= ORDER_STAGES.length) return;
    const targetStage = ORDER_STAGES[nextIndex];
    handleAttemptMoveStage(order, targetStage);
  };

  // Drag & Drop handlers
  const handleDragStart = (e: React.DragEvent, orderId: string) => {
    setDraggedOrderId(orderId);
    e.dataTransfer.setData('text/plain', orderId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, targetKey: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverTargetId !== targetKey) {
      setDragOverTargetId(targetKey);
    }
  };

  const handleDropOnStage = (e: React.DragEvent, targetStage: OrderStage) => {
    e.preventDefault();
    const orderId = e.dataTransfer.getData('text/plain') || draggedOrderId;
    setDraggedOrderId(null);
    setDragOverTargetId(null);
    if (!orderId) return;
    const foundOrder = orders.find((o) => o.id === orderId);
    if (foundOrder) {
      handleAttemptMoveStage(foundOrder, targetStage);
    }
  };

  const [showStageStepper, setShowStageStepper] = useState<boolean>(false);

  // Determina si la orden requiere checklist de instalación en sitio (vallas, rótulos corpóreos, etc.)
  const requiresOnSiteInstallation = (order: WorkOrder): boolean => {
    if (isDesignOnlyOrder(order)) return false;
    if (order.estimatedInstallHours > 0) return true;
    if (order.category === 'Rótulos 3D y Estructurados') return true;
    if (order.stage === 'Instalación / Listo para Retiro') return true;
    return order.finishings.some((f) => {
      const low = f.toLowerCase();
      return (
        low.includes('instalaci') ||
        low.includes('estructura') ||
        low.includes('montaje') ||
        low.includes('grúa') ||
        low.includes('andamio')
      );
    });
  };

  // MEJORA 2: Actualizar checklist rápido de instalación en sitio
  const handleToggleInstallCheck = (
    order: WorkOrder,
    field: 'electricalPointVerified' | 'ladderOrScaffoldingReady' | 'locationConfirmed'
  ) => {
    const currentChecklist = order.installationChecklist || {
      electricalPointVerified: false,
      ladderOrScaffoldingReady: false,
      locationConfirmed: false,
    };
    const nextValue = !currentChecklist[field];
    const updatedChecklist = {
      ...currentChecklist,
      [field]: nextValue,
      updatedAt: getLiveSimulationDateTimeStr(),
      updatedBy: currentUser.name,
    };
    const updatedOrder: WorkOrder = {
      ...order,
      installationChecklist: updatedChecklist,
    };
    onUpdateOrder(updatedOrder);
    if (selectedOrder && selectedOrder.id === order.id) {
      setSelectedOrder(updatedOrder);
    }
    if (blindOtOrder && blindOtOrder.id === order.id) {
      setBlindOtOrder(updatedOrder);
    }
    const labels: Record<typeof field, string> = {
      electricalPointVerified: 'Punto eléctrico verificado',
      ladderOrScaffoldingReady: 'Equipo de altura/escalera listo',
      locationConfirmed: 'Dirección/Ubicación confirmada',
    };
    onNotify(
      `${nextValue ? '✓' : '○'} Checklist Instalación (${order.id}): ${labels[field]}`
    );
  };

  /**
   * Renderiza una tarjeta de Orden clara, legible y accionable en 1 clic
   */
  const renderOrderCard = (order: WorkOrder) => {
    const sem = getTrafficLightStatus(order.deadline, order.stage);
    const pendingBalance = Number((order.totalPrice - order.paidAmount).toFixed(2));
    const stageIdx = ORDER_STAGES.indexOf(order.stage);
    const stageMeta = STAGE_META[order.stage];
    const designOnly = isDesignOnlyOrder(order);

    const team = getOrderTeamAssignments(order);
    const activeTeam = team.filter((a) => a.status === 'active');
    const myAssignment = team.find((a) => a.userId === currentUser.id);
    const isReadyButUnpaid =
      order.stage === 'Instalación / Listo para Retiro' && pendingBalance > 0;

    const getSmartNextLabel = (): string => {
      if (designOnly) {
        if (order.stage === 'Cotizado / Anticipo Pendiente') return 'Pasar a Diseño →';
        if (order.stage === 'En Diseño y Arte') return 'Enviar a Aprobación →';
        if (order.stage === 'Aprobación del Cliente') return 'Aprobar → Entrega Digital';
        if (order.stage === 'Instalación / Listo para Retiro') return 'Entregar Editables →';
      }
      return stageMeta.nextActionLabel;
    };

    const installCheckedCount = [
      order.installationChecklist?.electricalPointVerified,
      order.installationChecklist?.ladderOrScaffoldingReady,
      order.installationChecklist?.locationConfirmed,
    ].filter(Boolean).length;

    return (
      <div
        key={order.id}
        draggable
        onDragStart={(e) => handleDragStart(e, order.id)}
        onDragEnd={() => {
          setDraggedOrderId(null);
          setDragOverTargetId(null);
        }}
        className={`bg-white dark:bg-slate-900 border rounded-2xl p-4 space-y-3 transition-all duration-200 shadow-xs hover:shadow-lg hover:-translate-y-0.5 cursor-grab active:cursor-grabbing ${
          draggedOrderId === order.id
            ? 'opacity-50 border-indigo-500 scale-[0.98]'
            : myAssignment?.status === 'active'
            ? 'border-l-4 border-l-indigo-600 border-slate-200/90 dark:border-slate-800'
            : 'border-slate-200/90 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-slate-700'
        }`}
      >
        {/* Fila 1: Código en Píldora + Etapa Corta + Semáforo en Badge */}
        <div className="flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={() => handleOpenModal(order, 'team')}
              className="px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/80 border border-indigo-200/70 dark:border-indigo-800/70 font-mono font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 shrink-0 transition-colors"
            >
              {order.id}
            </button>
            <span className="text-slate-500 dark:text-slate-400 truncate font-semibold">
              {designOnly ? 'Solo Diseño Digital' : stageMeta.shortName}
            </span>
          </div>

          <span className={`px-2 py-0.5 rounded-full bg-slate-100/80 dark:bg-slate-800/80 font-mono text-[11px] font-semibold tabular-nums shrink-0 ${sem.textColor}`}>
            {sem.label}
          </span>
        </div>

        {/* Fila 2: Título y Cliente + Resumen de Medida/Saldo destacado */}
        <div>
          <button
            type="button"
            onClick={() => handleOpenModal(order, 'team')}
            className="text-left text-sm font-bold text-slate-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors line-clamp-2 leading-snug"
          >
            {order.title}
          </button>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1 truncate">
            {order.clientName}
          </p>

          <div className="flex items-center justify-between gap-2 mt-2.5 px-3 py-2 rounded-xl bg-slate-50/90 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 text-xs">
            <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">
              {designOnly
                ? `${order.quantity} paq.`
                : order.category === 'Corte y Grabado Láser / CNC' && order.laserMinutes
                ? `🔥 ${order.laserMinutes} min láser`
                : order.category === 'Sublimación y Merchandising'
                ? `👕 ${order.quantity} und.`
                : `📐 ${order.widthM}×${order.heightM}m`}
            </span>
            {canSeeFinancials && (
              <span>
                {pendingBalance > 0 ? (
                  <button
                    type="button"
                    onClick={() => handleOpenModal(order, 'payment')}
                    className="px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/60 border border-amber-200/70 dark:border-amber-800/70 text-amber-700 dark:text-amber-300 font-mono font-bold hover:underline"
                  >
                    Debe ${pendingBalance.toFixed(0)}
                  </button>
                ) : (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/70 dark:border-emerald-800/70 text-emerald-700 dark:text-emerald-300 font-mono font-bold">
                    ✓ Pagado
                  </span>
                )}
              </span>
            )}
          </div>

          {/* Detalle rápido si tiene tallas/colores o minutos láser adicionales */}
          {(order.sizesAndColors || (order.laserMinutes && order.laserMinutes > 0 && order.category !== 'Corte y Grabado Láser / CNC')) && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
              {order.laserMinutes && order.laserMinutes > 0 && order.category !== 'Corte y Grabado Láser / CNC' && (
                <span className="px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 font-mono">
                  🔥 Láser: {order.laserMinutes} min
                </span>
              )}
              {order.sizesAndColors && (
                <span className="px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800 truncate max-w-full">
                  👕 {order.sizesAndColors}
                </span>
              )}
            </div>
          )}
        </div>

        {/* MEJORA 2: Checklist rápido de Instalación en Sitio (limpio y legible) */}
        {requiresOnSiteInstallation(order) && (
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 space-y-1.5">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-400">
              <span>Checklist Instalación:</span>
              <span className={`font-mono font-bold ${installCheckedCount === 3 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                {installCheckedCount}/3 listos
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() => handleToggleInstallCheck(order, 'electricalPointVerified')}
                title="Punto eléctrico verificado"
                className={`px-2 py-1.5 rounded-lg text-xs font-medium border text-center truncate transition-colors ${
                  order.installationChecklist?.electricalPointVerified
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 font-semibold'
                    : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                }`}
              >
                {order.installationChecklist?.electricalPointVerified ? '☑' : '☐'} Eléctrico
              </button>
              <button
                type="button"
                onClick={() => handleToggleInstallCheck(order, 'ladderOrScaffoldingReady')}
                title="Equipo de altura/escalera listo"
                className={`px-2 py-1.5 rounded-lg text-xs font-medium border text-center truncate transition-colors ${
                  order.installationChecklist?.ladderOrScaffoldingReady
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 font-semibold'
                    : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                }`}
              >
                {order.installationChecklist?.ladderOrScaffoldingReady ? '☑' : '☐'} Escalera
              </button>
              <button
                type="button"
                onClick={() => handleToggleInstallCheck(order, 'locationConfirmed')}
                title="Dirección/Ubicación confirmada"
                className={`px-2 py-1.5 rounded-lg text-xs font-medium border text-center truncate transition-colors ${
                  order.installationChecklist?.locationConfirmed
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 font-semibold'
                    : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                }`}
              >
                {order.installationChecklist?.locationConfirmed ? '☑' : '☐'} Ubicación
              </button>
            </div>
          </div>
        )}

        {/* Fila 3: Equipo Asignado + Acceso rápido a Equipo */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
            <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            {team.map((member, mIdx) => {
              const isDone = member.status === 'completed';
              const firstName = getUserName(member.userId).split(' ')[0];
              return (
                <span
                  key={`${order.id}-${member.userId}-${mIdx}`}
                  className={`${
                    isDone
                      ? 'line-through text-slate-400 dark:text-slate-600'
                      : member.userId === currentUser.id
                      ? 'font-bold text-blue-600 dark:text-blue-400'
                      : 'text-slate-600 dark:text-slate-300 font-medium'
                  }`}
                >
                  {firstName}
                  {mIdx < team.length - 1 ? ',' : ''}
                </span>
              );
            })}
            {activeTeam.length === 0 && (
              <span className="text-emerald-600 font-semibold">✓ Equipo listo</span>
            )}
          </div>

          <button
            type="button"
            onClick={() => handleOpenModal(order, 'team')}
            className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline shrink-0"
          >
            Equipo
          </button>
        </div>

        {/* Botón "Terminé mi parte" solo si el usuario activo está asignado */}
        {myAssignment && myAssignment.status === 'active' && (
          <button
            type="button"
            onClick={() => handleSignOffCollaborator(order, currentUser.id)}
            className="w-full py-2 px-3 text-xs font-bold bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-600 hover:text-white text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/80 rounded-lg transition-colors flex items-center justify-center gap-1.5"
          >
            <UserCheck className="w-3.5 h-3.5 shrink-0" />
            <span>✓ Terminé mi parte (Darme de baja)</span>
          </button>
        )}

        {/* Fila 4: Acción Principal de Avance + Herramientas bien enmarcadas */}
        <div className="pt-1.5 space-y-1.5 border-t border-slate-100 dark:border-slate-800/70">
          {/* Subfila 4A: Navegación de Etapa Principal + Ficha Completa */}
          <div className="flex items-center gap-1.5">
            {stageIdx > 0 && (
              <button
                type="button"
                onClick={() => handleStepStage(order, -1)}
                className="p-2 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-800 transition-colors shrink-0"
                title="Etapa anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            )}

            {order.stage !== 'Finalizado y Liquidado' ? (
              isReadyButUnpaid ? (
                <button
                  type="button"
                  onClick={() => handleOpenModal(order, canSeeFinancials ? 'payment' : 'production')}
                  className="flex-1 min-w-0 py-2 px-3 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition-all duration-200 inline-flex items-center justify-center gap-1.5 shadow-2xs"
                >
                  <Lock className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">Cobrar ${pendingBalance.toFixed(0)}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleStepStage(order, 1)}
                  className={`flex-1 min-w-0 py-2 px-3 text-xs font-bold text-white rounded-lg transition-all duration-200 inline-flex items-center justify-center gap-1.5 shadow-2xs ${
                    designOnly
                      ? 'bg-indigo-600 hover:bg-indigo-700'
                      : 'bg-indigo-600 dark:bg-indigo-600 hover:bg-indigo-500 dark:hover:bg-indigo-500'
                  }`}
                >
                  <span className="truncate">{getSmartNextLabel()}</span>
                </button>
              )
            ) : (
              <span className="flex-1 min-w-0 py-2 px-3 text-center text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 rounded-lg border border-emerald-200/70 dark:border-emerald-800/60 truncate">
                ✓ Entregado y Liquidado
              </span>
            )}

            <button
              type="button"
              onClick={() => handleOpenModal(order, 'production')}
              className="p-2 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-800 transition-colors shrink-0"
              title="Abrir ficha completa de orden"
            >
              <Edit3 className="w-4 h-4" />
            </button>
          </div>

          {/* Subfila 4B: Botonera de Documentos y Accesos Rápidos (4 columnas simétricas) */}
          <div className="grid grid-cols-4 gap-1.5">
            {onOpenDriveModal && (
              <button
                type="button"
                onClick={() => onOpenDriveModal(order.id)}
                className="px-2 py-1.5 text-[11px] font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900 rounded-lg border border-blue-200 dark:border-blue-800 transition-colors inline-flex items-center justify-center gap-1 min-w-0"
                title="Abrir Carpeta Google Drive del Proyecto y subir/compartir diseños"
              >
                <FolderPlus className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">
                  Drive{order.driveFiles && order.driveFiles.length > 0 ? ` (${order.driveFiles.length})` : ''}
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setBlindOtOrder(order)}
              className="px-2 py-1.5 text-[11px] font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/50 hover:text-blue-700 dark:hover:text-blue-300 rounded-lg border border-slate-200 dark:border-slate-700 transition-colors inline-flex items-center justify-center gap-1 min-w-0"
              title="Abrir Orden de Trabajo Ciega para Taller e Instaladores (Sin Precios)"
            >
              <Printer className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">OT</span>
            </button>

            <button
              type="button"
              onClick={() => {
                const pdfName = downloadDeliveryAndWarrantyActPdf(order, currentUser.name);
                onNotify(
                  `Acta de Entrega, Garantía y Código QR descargada: "${pdfName}"`
                );
              }}
              className="px-2 py-1.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900 rounded-lg border border-emerald-200 dark:border-emerald-800 transition-colors inline-flex items-center justify-center gap-1 min-w-0"
              title="Descargar Comprobante PDF de Entrega, Certificado de Garantía y Código QR"
            >
              <FileCheck className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Acta</span>
            </button>

            {onOpenQrTracker && (
              <button
                type="button"
                onClick={() => onOpenQrTracker(order.id)}
                className="px-2 py-1.5 text-[11px] font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900 rounded-lg border border-indigo-200 dark:border-indigo-800 transition-colors inline-flex items-center justify-center gap-1 min-w-0"
                title="Abrir Portal QR de Seguimiento en Vivo y Garantía del Cliente"
              >
                <QrCode className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">QR</span>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* BARRA UNIFICADA Y CLARA: Filtros Personales + Buscador + Selector de Vista */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
        {/* Izquierda: Filtro de Mis Tareas vs Todas */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setAssignmentFilter('all')}
            className={`px-3.5 py-2 text-xs font-bold rounded-lg transition-all duration-200 ${
              assignmentFilter === 'all'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Todas ({orders.length})
          </button>
          <button
            type="button"
            onClick={() => setAssignmentFilter('my_active')}
            className={`px-3.5 py-2 text-xs font-bold rounded-lg transition-all duration-200 inline-flex items-center gap-1.5 ${
              assignmentFilter === 'my_active'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/70 dark:border-indigo-800/70 hover:bg-indigo-100 dark:hover:bg-indigo-900/60'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>
              Mis Activos ({myCounts.activeCount})
            </span>
          </button>
          <button
            type="button"
            onClick={() => setAssignmentFilter('my_completed')}
            className={`px-3.5 py-2 text-xs font-bold rounded-lg transition-all duration-200 inline-flex items-center gap-1.5 ${
              assignmentFilter === 'my_completed'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            <span>Mis Bajas ({myCounts.completedCount})</span>
          </button>

          {/* Urgencia rápida */}
          <select
            value={urgencyFilter}
            onChange={(e) =>
              setUrgencyFilter(e.target.value as 'all' | 'red' | 'yellow' | 'green')
            }
            className="px-3 py-2 text-xs font-semibold bg-slate-50 dark:bg-slate-950 border border-slate-200/90 dark:border-slate-800 rounded-lg text-slate-700 dark:text-slate-200"
          >
            <option value="all">Plazos: Todos</option>
            <option value="red">🔴 Vencidos</option>
            <option value="yellow">🟡 Urgentes (&lt;24h)</option>
            <option value="green">🟢 A tiempo</option>
          </select>
        </div>

        {/* Derecha: Buscador + Filtro 7 etapas opcional + Selector de Vista */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar #CA, cliente..."
              className="pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-600 w-52"
            />
          </div>

          <button
            type="button"
            onClick={() => setShowStageStepper(!showStageStepper)}
            className={`px-3 py-2 text-xs font-semibold rounded-lg border transition-colors ${
              showStageStepper || selectedStageFilter !== 'all'
                ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300'
                : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            7 Etapas {selectedStageFilter !== 'all' ? '(Filtrado)' : ''}
          </button>

          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-950 rounded-xl border border-slate-200/80 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setViewMode('stations')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all duration-200 inline-flex items-center gap-1.5 ${
                viewMode === 'stations'
                  ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
              <span>4 Estaciones</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('detailed')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all duration-200 inline-flex items-center gap-1.5 ${
                viewMode === 'detailed'
                  ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Columns3 className="w-4 h-4" />
              <span>7 Cols</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('operator')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all duration-200 inline-flex items-center gap-1.5 ${
                viewMode === 'operator'
                  ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <ListFilter className="w-4 h-4" />
              <span>Lista</span>
            </button>
          </div>
        </div>
      </div>

      {/* BARRA DESPLEGABLE OPCIONAL DE LAS 7 ETAPAS */}
      {(showStageStepper || selectedStageFilter !== 'all') && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2">
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-1.5">
            {ORDER_STAGES.map((stage, idx) => {
              const count = orders.filter((o) => o.stage === stage).length;
              const isSelected = selectedStageFilter === stage;
              return (
                <button
                  key={stage}
                  type="button"
                  onClick={() =>
                    setSelectedStageFilter(selectedStageFilter === stage ? 'all' : stage)
                  }
                  className={`px-2 py-1.5 rounded border text-left transition-all flex items-center justify-between gap-1 ${
                    isSelected
                      ? 'bg-slate-900 text-white dark:bg-blue-600 border-slate-900'
                      : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <span className="text-[11px] font-medium truncate">
                    {idx + 1}. {STAGE_META[stage].shortName.replace(/^\d+\.\s*/, '')}
                  </span>
                  <span className="text-[11px] font-mono font-bold opacity-80">{count}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 4A. VISTA PRINCIPAL RECOMENDADA: 4 ESTACIONES OPERATIVAS (PANTALLA COMPLETA SIN SCROLL HORIZONTAL) */}
      {viewMode === 'stations' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-start">
          {MACRO_STATIONS.map((station) => {
            const stationOrders = filteredOrders.filter((o) =>
              station.stages.includes(o.stage)
            );
            const isDragTarget = dragOverTargetId === station.id;

            return (
              <div
                key={station.id}
                onDragOver={(e) => handleDragOver(e, station.id)}
                onDragLeave={() => setDragOverTargetId(null)}
                onDrop={(e) => handleDropOnStage(e, station.defaultDropStage)}
                className={`bg-white/70 dark:bg-slate-900/60 backdrop-blur-xs border rounded-2xl shadow-xs flex flex-col overflow-hidden transition-all duration-200 ${
                  station.accentBorder
                } ${
                  isDragTarget
                    ? 'border-indigo-500 ring-2 ring-indigo-500/40 bg-indigo-50/30 dark:bg-indigo-950/20'
                    : 'border-slate-200/90 dark:border-slate-800'
                }`}
              >
                {/* Cabecera de la Estación */}
                <div
                  className={`px-4 py-3.5 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between ${station.headerBg}`}
                >
                  <div>
                    <h3 className="text-xs font-extrabold tracking-tight text-slate-900 dark:text-white">
                      {station.title}
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      {station.subtitle}
                    </p>
                  </div>
                  <span className="px-2.5 py-0.5 text-xs font-mono font-bold bg-indigo-600 text-white rounded-full shadow-2xs">
                    {stationOrders.length}
                  </span>
                </div>

                {/* Tarjetas de la Estación */}
                <div className="p-3.5 space-y-3.5 min-h-[220px]">
                  {stationOrders.length === 0 ? (
                    <div className="py-12 px-4 text-center border border-dashed border-slate-300 dark:border-slate-800 rounded-xl text-xs text-slate-400 dark:text-slate-600">
                      Sin proyectos en esta estación.
                      <div className="mt-1 text-[11px]">
                        Arrastra una tarjeta aquí para moverla a{' '}
                        <strong>{station.defaultDropStage}</strong>.
                      </div>
                    </div>
                  ) : (
                    stationOrders.map((order) => renderOrderCard(order))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 4B. VISTA DETALLADA DE LAS 7 ETAPAS (CON SOPORTE DRAG & DROP) */}
      {viewMode === 'detailed' && (
        <div className="overflow-x-auto pb-4">
          <div className="inline-flex gap-3.5 min-w-full items-start">
            {ORDER_STAGES.map((stage, stageIdx) => {
              const stageOrders = filteredOrders.filter((o) => o.stage === stage);
              const isDragTarget = dragOverTargetId === stage;

              return (
                <div
                  key={stage}
                  onDragOver={(e) => handleDragOver(e, stage)}
                  onDragLeave={() => setDragOverTargetId(null)}
                  onDrop={(e) => handleDropOnStage(e, stage)}
                  className={`w-72 sm:w-80 shrink-0 bg-slate-100/80 dark:bg-slate-900/60 border rounded-xl flex flex-col transition-all ${
                    isDragTarget
                      ? 'border-blue-500 ring-2 ring-blue-500/40'
                      : 'border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <div className="px-3.5 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                      {stageIdx + 1}. {stage}
                    </span>
                    <span className="px-2 py-0.5 text-xs font-mono font-bold bg-white dark:bg-slate-800 rounded-full text-slate-600 dark:text-slate-300 shrink-0 ml-2">
                      {stageOrders.length}
                    </span>
                  </div>

                  <div className="p-2.5 space-y-2.5 min-h-[180px]">
                    {stageOrders.length === 0 ? (
                      <div className="py-10 text-center text-xs text-slate-400 dark:text-slate-600 border border-dashed border-slate-200 dark:border-slate-800 rounded">
                        Arrastra una orden aquí
                      </div>
                    ) : (
                      stageOrders.map((order) => renderOrderCard(order))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 4C. VISTA LISTA OPERATIVA DE TALLER */}
      {viewMode === 'operator' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between bg-slate-50/40 dark:bg-slate-950/30">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Lista Operativa de Taller, Cambio Rápido de Etapa y Baja de Responsables
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Cambia la etapa desde el selector de cada fila, inicia el cronómetro o date de baja al finalizar tu parte.
              </p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/90 dark:bg-slate-950 border-b border-slate-200/80 dark:border-slate-800 text-slate-600 dark:text-slate-400">
                <tr>
                  <th className="py-3 px-4">Orden y Etapa Actual</th>
                  <th className="py-3 px-4">Proyecto y Cliente</th>
                  <th className="py-3 px-4">Medidas y Sustrato</th>
                  <th className="py-3 px-4">Equipo (Activos / Bajas)</th>
                  <th className="py-3 px-4">Tiempo Límite</th>
                  <th className="py-3 px-4 text-right">Acciones Directas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/80 dark:divide-slate-800">
                {filteredOrders.map((order) => {
                  const sem = getTrafficLightStatus(order.deadline, order.stage);
                  const team = getOrderTeamAssignments(order);
                  const myAssignment = team.find((a) => a.userId === currentUser.id);
                  return (
                    <tr
                      key={order.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-3 px-4 whitespace-nowrap space-y-1">
                        <div className="font-mono font-bold text-blue-600 dark:text-blue-400">
                          {order.id}
                        </div>
                        <select
                          value={order.stage}
                          onChange={(e) =>
                            handleAttemptMoveStage(order, e.target.value as OrderStage)
                          }
                          className="px-2 py-1 text-[11px] font-medium bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-slate-800 dark:text-slate-200"
                        >
                          {ORDER_STAGES.map((st, idx) => (
                            <option key={st} value={st}>
                              {idx + 1}. {st}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {order.title}
                        </div>
                        <div className="text-slate-500 dark:text-slate-400 mt-0.5">
                          {order.clientName} · {order.finishings.join(' · ') || 'Estándar'}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono">
                        <div className="text-slate-900 dark:text-white">
                          {order.widthM}m × {order.heightM}m ({order.quantity}u ={' '}
                          {order.totalAreaM2} m²)
                        </div>
                        <div className="text-slate-500 text-[11px]">{order.materialName}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1">
                          {team.map((m, mIdx) => (
                            <span
                              key={`${order.id}-op-${m.userId}-${mIdx}`}
                              className={`px-2 py-0.5 rounded border text-[11px] inline-flex items-center gap-1 ${
                                m.status === 'completed'
                                  ? 'bg-emerald-50/50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-400 line-through'
                                  : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-medium'
                              }`}
                            >
                              <span>{getUserName(m.userId).split(' ')[0]}</span>
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className={`py-3 px-4 font-mono whitespace-nowrap ${sem.textColor}`}>
                        {sem.label}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap space-x-1.5">
                        {myAssignment && myAssignment.status === 'active' && (
                          <button
                            type="button"
                            onClick={() => handleSignOffCollaborator(order, currentUser.id)}
                            className="px-2.5 py-1.5 text-xs font-semibold bg-emerald-600 text-white rounded hover:bg-emerald-700 transition-colors inline-flex items-center gap-1"
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                            <span>Terminé mi parte / Baja</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => onStartTimerForOrder(order.id, 'machine')}
                          className="px-2.5 py-1.5 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors inline-flex items-center gap-1"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>Cronómetro</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenModal(order, 'team')}
                          className="px-2.5 py-1.5 text-xs font-medium border border-slate-300 dark:border-slate-700 rounded text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          Gestionar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. MODAL ORGANIZADO POR PESTAÑAS CLARAS (1. EQUIPO Y BAJAS · 2. ETAPA Y ARTE · 3. COBROS) */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-3xl w-full max-h-[92vh] overflow-y-auto shadow-xl flex flex-col">
            {/* Cabecera del Modal */}
            <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-start justify-between gap-4 shrink-0">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-slate-500 dark:text-slate-400">
                  <span className="font-bold text-blue-600 dark:text-blue-400">
                    {selectedOrder.id}
                  </span>
                  <span>·</span>
                  <span>{selectedOrder.category}</span>
                  <span>·</span>
                  <span>
                    {selectedOrder.widthM}×{selectedOrder.heightM}m ({selectedOrder.totalAreaM2} m²)
                  </span>
                </div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white mt-1 break-words">
                  {selectedOrder.title}
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 break-words">
                  Cliente: {selectedOrder.clientName} ({selectedOrder.clientRuc}) · Tel:{' '}
                  {selectedOrder.clientPhone}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Navegación por Pestañas dentro de la Orden para no saturar la vista */}
            <div className="px-4 sm:px-5 pt-2 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center gap-1.5 sm:gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setActiveModalTab('team')}
                className={`px-3.5 py-2 text-xs font-semibold border-b-2 transition-colors inline-flex items-center gap-1.5 ${
                  activeModalTab === 'team'
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>
                  1. Equipo Responsable y Bajas (
                  {getOrderTeamAssignments(selectedOrder).filter((a) => a.status === 'active').length}{' '}
                  activos)
                </span>
              </button>
              <button
                type="button"
                onClick={() => setActiveModalTab('production')}
                className={`px-3.5 py-2 text-xs font-semibold border-b-2 transition-colors inline-flex items-center gap-1.5 ${
                  activeModalTab === 'production'
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <FileCheck className="w-3.5 h-3.5" />
                <span>2. Etapa, Fecha Límite y Arte RIP</span>
              </button>
              {canSeeFinancials && (
                <button
                  type="button"
                  onClick={() => setActiveModalTab('payment')}
                  className={`px-3.5 py-2 text-xs font-semibold border-b-2 transition-colors inline-flex items-center gap-1.5 ${
                    activeModalTab === 'payment'
                      ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <DollarSign className="w-3.5 h-3.5" />
                  <span>
                    3. Pagos y Liquidación (Saldo: $
                    {Math.max(0, selectedOrder.totalPrice - selectedOrder.paidAmount).toFixed(2)})
                  </span>
                </button>
              )}
            </div>

            {/* CONTENIDO PESTAÑA 1: EQUIPO RESPONSABLE Y CONTROL DE BAJAS */}
            {activeModalTab === 'team' && (
              <div className="p-5 space-y-4">
                {(() => {
                  const team = getOrderTeamAssignments(selectedOrder);
                  const activeCount = team.filter((a) => a.status === 'active').length;
                  const completedCount = team.filter((a) => a.status === 'completed').length;

                  return (
                    <>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <p className="text-xs text-slate-600 dark:text-slate-400">
                          Asigna uno o varios colaboradores al proyecto. Cada uno puede pulsar{' '}
                          <strong>"Finalizar mi trabajo / Darme de baja"</strong> apenas termine su etapa.
                        </p>
                        <div className="flex items-center gap-2 text-xs font-mono shrink-0">
                          <span className="px-2.5 py-1 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded">
                            Activos: {activeCount}
                          </span>
                          <span className="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded">
                            Finalizados / Bajas: {completedCount}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-2.5">
                        {team.map((assign, aIdx) => {
                          const usr = users.find((u) => u.id === assign.userId);
                          const isMe = assign.userId === currentUser.id;
                          const isCompleted = assign.status === 'completed';
                          const elapsed = getAssignmentElapsedDuration(assign, liveNowMs);

                          return (
                            <div
                              key={`${selectedOrder.id}-modal-${assign.userId}-${aIdx}`}
                              className={`p-3 rounded-lg border transition-colors ${
                                isCompleted
                                  ? 'bg-slate-50/70 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800'
                                  : isMe
                                  ? 'bg-blue-50/40 dark:bg-blue-950/25 border-blue-300 dark:border-blue-800'
                                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                              }`}
                            >
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div className="space-y-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span
                                      className={`text-xs font-bold ${
                                        isCompleted
                                          ? 'line-through text-slate-500 dark:text-slate-400'
                                          : 'text-slate-900 dark:text-white'
                                      }`}
                                    >
                                      {usr ? usr.name : assign.userId}
                                    </span>
                                    {isMe && (
                                      <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-blue-600 text-white rounded">
                                        Tú (Sesión actual)
                                      </span>
                                    )}
                                    <span
                                      className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded ${
                                        isCompleted
                                          ? 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300'
                                          : 'bg-amber-100 dark:bg-amber-950/70 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-700'
                                      }`}
                                    >
                                      {isCompleted
                                        ? `✓ BAJA DEL PROYECTO · Duración total: ${elapsed.formattedShort}`
                                        : `⏱️ EN PROYECTO HACE: ${elapsed.formattedShort} (Hasta dar de baja)`}
                                    </span>
                                  </div>
                                  <div className="text-[11px] text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                                    <span>
                                      Tarea:{' '}
                                      <strong className="text-slate-700 dark:text-slate-300">
                                        {assign.taskRole}
                                      </strong>
                                    </span>
                                    <span className="font-mono text-[10px]">
                                      Ingreso: {assign.assignedAt}
                                      {assign.assignedBy ? ` (por ${assign.assignedBy})` : ''}
                                      {isCompleted && assign.completedAt
                                        ? ` → Baja: ${assign.completedAt} (Ejecutada por: ${
                                            assign.completedBy || (usr ? usr.name : assign.userId)
                                          })`
                                        : ''}
                                    </span>
                                  </div>
                                  {isCompleted && assign.closingNote && (
                                    <div className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium pt-0.5">
                                      Nota de entrega: "{assign.closingNote}"
                                    </div>
                                  )}
                                </div>

                                <div className="flex flex-wrap items-center gap-2 shrink-0">
                                  {!isCompleted ? (
                                    <div className="flex flex-wrap items-center gap-1.5">
                                      <input
                                        type="text"
                                        value={closingNoteDrafts[assign.userId] || ''}
                                        onChange={(e) =>
                                          setClosingNoteDrafts((prev) => ({
                                            ...prev,
                                            [assign.userId]: e.target.value,
                                          }))
                                        }
                                        placeholder="Nota entrega (opcional)..."
                                        className="px-2 py-1 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-white w-44"
                                      />
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleSignOffCollaborator(
                                            selectedOrder,
                                            assign.userId,
                                            closingNoteDrafts[assign.userId]
                                          )
                                        }
                                        className="px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded inline-flex items-center gap-1.5 whitespace-nowrap shadow-2xs"
                                      >
                                        <UserCheck className="w-3.5 h-3.5" />
                                        <span>
                                          {isMe
                                            ? 'Finalizar mi trabajo / Darme de baja'
                                            : 'Dar de baja (Finalizó)'}
                                        </span>
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleReactivateCollaborator(selectedOrder, assign.userId)
                                      }
                                      className="px-2.5 py-1 text-xs font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded inline-flex items-center gap-1"
                                    >
                                      <RotateCcw className="w-3.5 h-3.5" />
                                      <span>Reactivar</span>
                                    </button>
                                  )}

                                  {team.length > 1 && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleRemoveCollaboratorFromOrder(
                                          selectedOrder,
                                          assign.userId
                                        )
                                      }
                                      className="p-1.5 text-slate-400 hover:text-red-600 rounded"
                                      title="Quitar del proyecto"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Barra para sumar otro responsable al proyecto */}
                      <div className="p-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg space-y-2.5">
                        <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                          <UserPlus className="w-3.5 h-3.5 text-blue-600" />
                          <span>Asignar otro responsable a este proyecto</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
                          <div className="sm:col-span-5">
                            <label className="block text-[10px] text-slate-500 mb-0.5">
                              Colaborador
                            </label>
                            <select
                              value={newAssigneeUserId}
                              onChange={(e) => {
                                const uid = e.target.value;
                                setNewAssigneeUserId(uid);
                                const found = users.find((u) => u.id === uid);
                                if (found) setNewAssigneeRole(defaultRoleForUser(found));
                              }}
                              className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-white"
                            >
                              {users.map((u) => {
                                const alreadyIn = team.some((a) => a.userId === u.id);
                                return (
                                  <option key={u.id} value={u.id}>
                                    {u.name} ({u.department}){alreadyIn ? ' — Ya asignado' : ''}
                                  </option>
                                );
                              })}
                            </select>
                          </div>
                          <div className="sm:col-span-4">
                            <label className="block text-[10px] text-slate-500 mb-0.5">
                              Función en el Proyecto
                            </label>
                            <select
                              value={newAssigneeRole}
                              onChange={(e) =>
                                setNewAssigneeRole(e.target.value as ProjectTaskRole)
                              }
                              className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-white"
                            >
                              {PROJECT_TASK_ROLES.map((r) => (
                                <option key={r} value={r}>
                                  {r}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="sm:col-span-3">
                            <button
                              type="button"
                              onClick={() =>
                                handleAddCollaboratorToOrder(
                                  selectedOrder,
                                  newAssigneeUserId,
                                  newAssigneeRole
                                )
                              }
                              className="w-full px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded inline-flex items-center justify-center gap-1.5"
                            >
                              <UserPlus className="w-3.5 h-3.5" />
                              <span>+ Asignar</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            )}

            {/* CONTENIDO PESTAÑA 2: ETAPA, FECHA LÍMITE Y ARTE RIP */}
            {activeModalTab === 'production' && (
              <div className="p-5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Etapa Actual del Proyecto
                    </label>
                    <select
                      value={selectedOrder.stage}
                      onChange={(e) => {
                        const nextStage = e.target.value as OrderStage;
                        handleAttemptMoveStage(selectedOrder, nextStage);
                        if (
                          !(
                            nextStage === 'Finalizado y Liquidado' &&
                            selectedOrder.totalPrice - selectedOrder.paidAmount > 0
                          )
                        ) {
                          setSelectedOrder({ ...selectedOrder, stage: nextStage });
                        }
                      }}
                      className="w-full px-3 py-2 text-xs font-medium bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-md text-slate-900 dark:text-white"
                    >
                      {ORDER_STAGES.map((st, idx) => (
                        <option key={st} value={st}>
                          Paso {idx + 1}: {st}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Fecha y Hora Límite de Entrega
                    </label>
                    <input
                      type="datetime-local"
                      value={selectedOrder.deadline.slice(0, 16)}
                      onChange={(e) => {
                        const updated = { ...selectedOrder, deadline: e.target.value };
                        setSelectedOrder(updated);
                        onUpdateOrder(updated);
                      }}
                      className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-md text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                <div className="space-y-2 pt-1">
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Archivo de Arte / Ruta RIP Pre-prensa
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={selectedOrder.artworkUrl}
                      onChange={(e) => {
                        const updated = { ...selectedOrder, artworkUrl: e.target.value };
                        setSelectedOrder(updated);
                        onUpdateOrder(updated);
                      }}
                      placeholder="https://crea-arte.internal/artes/archivo_vectorial_curvas.pdf"
                      className="flex-1 px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-md text-slate-900 dark:text-white"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const updated = {
                          ...selectedOrder,
                          artworkApproved: !selectedOrder.artworkApproved,
                        };
                        setSelectedOrder(updated);
                        onUpdateOrder(updated);
                        onNotify(
                          updated.artworkApproved
                            ? `Arte de ${selectedOrder.id} marcado como APROBADO por el cliente`
                            : `Aprobación de arte revertida para ${selectedOrder.id}`
                        );
                      }}
                      className={`px-3 py-2 text-xs font-medium rounded-md inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
                        selectedOrder.artworkApproved
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <FileCheck className="w-3.5 h-3.5" />
                      <span>
                        {selectedOrder.artworkApproved ? 'Arte Aprobado' : 'Marcar Arte Aprobado'}
                      </span>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Instrucciones Técnicas de Taller y Montaje
                  </label>
                  <textarea
                    rows={3}
                    value={selectedOrder.notes}
                    onChange={(e) => {
                      const updated = { ...selectedOrder, notes: e.target.value };
                      setSelectedOrder(updated);
                      onUpdateOrder(updated);
                    }}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-md text-slate-900 dark:text-white"
                  />
                </div>

                {/* MEJORA 2: Checklist de Instalación en Sitio dentro de la Ficha Técnica */}
                <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      Checklist Rápido de Instalación en Sitio (Vallas / Rótulos Corpóreos)
                    </span>
                    <button
                      type="button"
                      onClick={() => setBlindOtOrder(selectedOrder)}
                      className="px-2.5 py-1 text-[11px] font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded inline-flex items-center gap-1"
                    >
                      <Printer className="w-3 h-3" />
                      <span>📄 Abrir OT Taller (Sin Precios)</span>
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <label className="flex items-center gap-2 p-2 rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 cursor-pointer text-xs">
                      <input
                        type="checkbox"
                        checked={Boolean(
                          selectedOrder.installationChecklist?.electricalPointVerified
                        )}
                        onChange={() =>
                          handleToggleInstallCheck(selectedOrder, 'electricalPointVerified')
                        }
                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      <span>⚡ Punto eléctrico verificado</span>
                    </label>
                    <label className="flex items-center gap-2 p-2 rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 cursor-pointer text-xs">
                      <input
                        type="checkbox"
                        checked={Boolean(
                          selectedOrder.installationChecklist?.ladderOrScaffoldingReady
                        )}
                        onChange={() =>
                          handleToggleInstallCheck(selectedOrder, 'ladderOrScaffoldingReady')
                        }
                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      <span>🪜 Equipo de altura/escalera listo</span>
                    </label>
                    <label className="flex items-center gap-2 p-2 rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 cursor-pointer text-xs">
                      <input
                        type="checkbox"
                        checked={Boolean(selectedOrder.installationChecklist?.locationConfirmed)}
                        onChange={() =>
                          handleToggleInstallCheck(selectedOrder, 'locationConfirmed')
                        }
                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      <span>📍 Dirección/Ubicación confirmada</span>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* CONTENIDO PESTAÑA 3: COBROS Y LIQUIDACIÓN */}
            {activeModalTab === 'payment' && canSeeFinancials && (
              <div className="p-5 space-y-4">
                <div className="grid grid-cols-3 gap-3 p-3.5 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 font-mono text-xs">
                  <div>
                    <div className="text-[10px] text-slate-500">TOTAL ORDEN</div>
                    <div className="text-sm font-bold text-slate-900 dark:text-white">
                      ${selectedOrder.totalPrice.toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-500">ABONADO</div>
                    <div className="text-sm font-bold text-emerald-600">
                      ${selectedOrder.paidAmount.toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-500">SALDO PENDIENTE</div>
                    <div className="text-sm font-bold text-amber-600">
                      ${Math.max(0, selectedOrder.totalPrice - selectedOrder.paidAmount).toFixed(2)}
                    </div>
                  </div>
                </div>

                {selectedOrder.totalPrice - selectedOrder.paidAmount > 0 ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                          Monto a Cobrar ($)
                        </label>
                        <input
                          type="number"
                          min="1"
                          max={Number(
                            (selectedOrder.totalPrice - selectedOrder.paidAmount).toFixed(2)
                          )}
                          step="0.5"
                          value={paymentInput}
                          onChange={(e) => setPaymentInput(Math.max(0, Number(e.target.value)))}
                          className="w-full px-3 py-2 text-xs font-mono font-bold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md text-slate-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                          Método de Pago
                        </label>
                        <select
                          value={paymentMethod}
                          onChange={(e) => setPaymentMethod(e.target.value as any)}
                          className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md text-slate-900 dark:text-white"
                        >
                          <option value="Transferencia Bancaria">Transferencia Bancaria</option>
                          <option value="Efectivo">Efectivo</option>
                          <option value="Tarjeta">Tarjeta POS</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                          Banco / Cuenta Destino
                        </label>
                        <select
                          value={paymentBank}
                          onChange={(e) => setPaymentBank(e.target.value)}
                          className="w-full px-2.5 py-2 text-xs font-mono bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md text-slate-900 dark:text-white"
                        >
                          {BANK_ACCOUNTS_CATALOG.map((b) => (
                            <option key={b} value={b}>
                              {b}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                      <div>
                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                          N° Comprobante / Ref.
                        </label>
                        <input
                          type="text"
                          value={paymentRef}
                          onChange={(e) => setPaymentRef(e.target.value)}
                          placeholder="Ej. SPI-994827"
                          className="w-full px-2.5 py-2 text-xs font-mono bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md text-slate-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                          N° Factura / Doc. SRI
                        </label>
                        <input
                          type="text"
                          value={paymentInvoice}
                          onChange={(e) => setPaymentInvoice(e.target.value)}
                          placeholder="FAC-001-002-..."
                          className="w-full px-2.5 py-2 text-xs font-mono bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md text-slate-900 dark:text-white"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (paymentInput <= 0) return;
                          onRegisterPayment(selectedOrder.id, paymentInput, paymentMethod, {
                            bankEntity: paymentBank,
                            referenceNumber: paymentRef.trim() || 'S/N',
                            invoiceOrDocNumber: paymentInvoice.trim() || 'Pendiente Facturar',
                            accountHolderOrNotes: `Registrado desde ficha Kanban ${selectedOrder.id}`,
                          });
                          const newPaid = Math.min(
                            selectedOrder.totalPrice,
                            Number((selectedOrder.paidAmount + paymentInput).toFixed(2))
                          );
                          setSelectedOrder({ ...selectedOrder, paidAmount: newPaid });
                          setPaymentInput(
                            Math.max(0, Number((selectedOrder.totalPrice - newPaid).toFixed(2)))
                          );
                        }}
                        className="w-full px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-md inline-flex items-center justify-center gap-1.5"
                      >
                        <DollarSign className="w-3.5 h-3.5" />
                        <span>Registrar Cobro</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-lg text-xs text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
                    <span>✓ Esta orden se encuentra 100% pagada y habilitada para entrega final.</span>
                    {selectedOrder.stage !== 'Finalizado y Liquidado' && (
                      <button
                        type="button"
                        onClick={() => {
                          onMoveOrderStage(selectedOrder.id, 'Finalizado y Liquidado');
                          setSelectedOrder({
                            ...selectedOrder,
                            stage: 'Finalizado y Liquidado',
                          });
                        }}
                        className="px-3 py-1.5 font-semibold bg-emerald-600 text-white rounded hover:bg-emerald-700"
                      >
                        Confirmar Entrega Final →
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Pie del Modal */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 bg-slate-50/50 dark:bg-slate-950/50">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onStartTimerForOrder(selectedOrder.id, 'design');
                    setSelectedOrder(null);
                  }}
                  className="px-3 py-1.5 text-xs font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                >
                  ⏱ Cronómetro Diseño
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onStartTimerForOrder(selectedOrder.id, 'machine');
                    setSelectedOrder(null);
                  }}
                  className="px-3 py-1.5 text-xs font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                >
                  ⏱ Cronómetro Taller
                </button>
                <button
                  type="button"
                  onClick={() => setBlindOtOrder(selectedOrder)}
                  className="px-3 py-1.5 text-xs font-semibold bg-blue-50 dark:bg-blue-950/70 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-100 transition-colors inline-flex items-center gap-1"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>📄 OT Taller (Sin Precios)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const fileName = downloadDeliveryAndWarrantyActPdf(
                      selectedOrder,
                      currentUser.name
                    );
                    onNotify(
                      `Acta de Entrega y Certificado de Garantía QR descargado: "${fileName}"`
                    );
                  }}
                  className="px-3 py-1.5 text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 rounded hover:bg-emerald-100 transition-colors inline-flex items-center gap-1"
                >
                  <FileCheck className="w-3.5 h-3.5" />
                  <span>📄 Acta Entrega + Garantía QR</span>
                </button>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="px-4 py-1.5 text-xs font-semibold bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-500 text-white rounded transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MEJORA 2: MODAL IMPRIMIBLE DE ORDEN DE TRABAJO CIEGA (SIN PRECIOS)
          Exclusivo para Producción, Operadores CNC/Láser e Instaladores
         ===================================================================== */}
      {blindOtOrder && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border-2 border-slate-900 dark:border-slate-700 rounded-2xl max-w-3xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto">
            {/* Barra superior de acciones (No sale al imprimir si usa print) */}
            <div className="px-4 sm:px-5 py-3 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <Printer className="w-4 h-4 text-blue-400 shrink-0" />
                <span className="text-xs font-mono font-bold uppercase tracking-wider truncate">
                  📄 ORDEN DE TRABAJO CIEGA — TALLER E INSTALACIÓN (SIN PRECIOS)
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    const fileName = downloadBlindWorkOrderPdf(
                      blindOtOrder,
                      currentUser.name
                    );
                    onNotify(
                      `PDF de Orden de Trabajo Ciega descargado: "${fileName}"`
                    );
                    try {
                      window.print();
                    } catch {
                      // Ignorar bloqueo de print en iframe
                    }
                  }}
                  className="px-3 py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-md inline-flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Descargar PDF / Imprimir OT</span>
                </button>
                <button
                  type="button"
                  onClick={() => setBlindOtOrder(null)}
                  className="p-1.5 text-slate-400 hover:text-white rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Contenido de la Ficha Técnica Ciega */}
            <div className="p-4 sm:p-6 space-y-5 text-xs text-slate-800 dark:text-slate-200 flex-1 min-h-0 overflow-y-auto">
              {/* Encabezado de Orden */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b-2 border-slate-900 dark:border-slate-700">
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
                    CREA ARTE PUBLICIDAD · FICHA DE PRODUCCIÓN INTERNA
                  </div>
                  <h3 className="text-lg font-extrabold text-slate-900 dark:text-white mt-0.5">
                    {blindOtOrder.id} — {blindOtOrder.title}
                  </h3>
                  <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                    Cliente: <strong className="text-slate-900 dark:text-white">{blindOtOrder.clientName}</strong> · Tel:{' '}
                    <span className="font-mono">{blindOtOrder.clientPhone}</span>
                  </div>
                </div>
                <div className="sm:text-right font-mono bg-slate-100 dark:bg-slate-800 px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 shrink-0">
                  <div className="text-[10px] text-slate-500 uppercase">ENTREGA COMPROMETIDA</div>
                  <div className="text-sm font-bold text-slate-900 dark:text-white">
                    {blindOtOrder.deadline.replace('T', ' ')}
                  </div>
                  <div className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold mt-0.5">
                    Etapa: {blindOtOrder.stage}
                  </div>
                </div>
              </div>

              {/* Especificaciones Técnicas de Producción (Sin ningún valor monetario) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                  <div className="text-[10px] font-mono uppercase text-slate-500">RUBRO / CATEGORÍA</div>
                  <div className="font-bold text-slate-900 dark:text-white mt-0.5">
                    {blindOtOrder.category}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                  <div className="text-[10px] font-mono uppercase text-slate-500">MATERIAL / SUSTRATO</div>
                  <div className="font-bold text-slate-900 dark:text-white mt-0.5">
                    {blindOtOrder.materialName}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono">
                  <div className="text-[10px] uppercase text-slate-500">MEDIDAS / CANTIDAD</div>
                  <div className="font-bold text-slate-900 dark:text-white mt-0.5">
                    {isDesignOnlyOrder(blindOtOrder)
                      ? `${blindOtOrder.quantity} Paquete(s) Digital`
                      : blindOtOrder.category === 'Sublimación y Merchandising'
                      ? `${blindOtOrder.quantity} Unidades`
                      : `${blindOtOrder.widthM}m × ${blindOtOrder.heightM}m (${blindOtOrder.quantity} und)`}
                  </div>
                  {blindOtOrder.totalAreaM2 > 0 &&
                    blindOtOrder.category !== 'Sublimación y Merchandising' && (
                      <div className="text-[10px] text-slate-500">
                        Área total: {blindOtOrder.totalAreaM2} m² (+{blindOtOrder.wastePercent}% merma)
                      </div>
                    )}
                </div>
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono">
                  <div className="text-[10px] uppercase text-slate-500">TIEMPOS ESTIMADOS</div>
                  <div className="font-bold text-slate-900 dark:text-white mt-0.5">
                    Dis: {blindOtOrder.estimatedDesignHours}h · Máq: {blindOtOrder.estimatedMachineHours}h · Inst: {blindOtOrder.estimatedInstallHours}h
                  </div>
                  {blindOtOrder.laserMinutes && blindOtOrder.laserMinutes > 0 ? (
                    <div className="text-[10px] font-bold text-amber-600 dark:text-amber-400">
                      🔥 Tiempo Láser/CNC: {blindOtOrder.laserMinutes} min
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Bloque especial para Tallas/Colores (Sublimación) o Minutos Láser */}
              {(blindOtOrder.sizesAndColors ||
                (blindOtOrder.laserMinutes && blindOtOrder.laserMinutes > 0)) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {blindOtOrder.laserMinutes && blindOtOrder.laserMinutes > 0 ? (
                    <div className="p-3 rounded-lg bg-amber-50/70 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800">
                      <div className="text-[10px] font-mono font-bold uppercase text-amber-800 dark:text-amber-300">
                        🔥 PARÁMETRO DE CORTE Y GRABADO LÁSER / CNC
                      </div>
                      <div className="text-sm font-mono font-bold text-amber-950 dark:text-amber-200 mt-0.5">
                        Tiempo programado de máquina: {blindOtOrder.laserMinutes} minutos
                      </div>
                    </div>
                  ) : null}
                  {blindOtOrder.sizesAndColors ? (
                    <div className="p-3 rounded-lg bg-purple-50/70 dark:bg-purple-950/30 border border-purple-300 dark:border-purple-800">
                      <div className="text-[10px] font-mono font-bold uppercase text-purple-800 dark:text-purple-300">
                        👕 DESGLOSE DE TALLAS / COLORES / PERSONALIZACIÓN
                      </div>
                      <div className="text-xs font-bold text-purple-950 dark:text-purple-200 mt-0.5">
                        {blindOtOrder.sizesAndColors}
                      </div>
                    </div>
                  ) : null}
                </div>
              )}

              {/* Resumen de Despiece 2D si fue guardado desde el Optimizador de Cortes */}
              {blindOtOrder.cutOptimizationSummary && (
                <div className="p-3.5 rounded-lg bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-xs font-mono space-y-1">
                  <div className="font-bold text-blue-900 dark:text-blue-200">
                    📐 DESPIECE TÉCNICO 2D GUARDADO ({blindOtOrder.cutOptimizationSummary.savedAt})
                  </div>
                  <div className="text-slate-700 dark:text-slate-300">
                    {blindOtOrder.cutOptimizationSummary.mode === 'roll'
                      ? `Bobina ${blindOtOrder.cutOptimizationSummary.rollWidthM?.toFixed(2)}m: ${blindOtOrder.cutOptimizationSummary.quantity} pzas (${blindOtOrder.cutOptimizationSummary.pieceWidthCm}×${blindOtOrder.cutOptimizationSummary.pieceHeightCm}cm) → ${blindOtOrder.cutOptimizationSummary.linearMeters} ml · Aprovechamiento: ${blindOtOrder.cutOptimizationSummary.utilizationPct}% · Merma: ${blindOtOrder.cutOptimizationSummary.wastePct}%`
                      : `Plancha 122×244cm: ${blindOtOrder.cutOptimizationSummary.quantity} pzas (${blindOtOrder.cutOptimizationSummary.pieceWidthCm}×${blindOtOrder.cutOptimizationSummary.pieceHeightCm}cm) → ${blindOtOrder.cutOptimizationSummary.sheetsNeeded} plancha(s) · Merma: ${blindOtOrder.cutOptimizationSummary.wastePct}% · Retazo Der: ${blindOtOrder.cutOptimizationSummary.offcutRightCm}×122cm`}
                  </div>
                </div>
              )}

              {/* Si la orden es multi-producto, mostrar renglones técnicos SIN PRECIOS */}
              {blindOtOrder.lineItems && blindOtOrder.lineItems.length > 0 && (
                <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
                  <div className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800 font-bold text-xs flex items-center justify-between">
                    <span>Desglose Técnico de Ítems a Producir ({blindOtOrder.lineItems.length})</span>
                    <span className="text-[10px] font-mono text-emerald-700 dark:text-emerald-400">
                      🔒 Precios y saldos ocultos para Taller
                    </span>
                  </div>
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-slate-500">
                      <tr>
                        <th className="py-2 px-3">#</th>
                        <th className="py-2 px-3">Trabajo / Rubro</th>
                        <th className="py-2 px-3">Material / Sustrato</th>
                        <th className="py-2 px-3">Medidas / Cant. / Parámetros</th>
                        <th className="py-2 px-3">Acabados / Tallas</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {blindOtOrder.lineItems.map((li, idx) => (
                        <tr key={li.id || idx}>
                          <td className="py-2 px-3 font-mono font-bold">{idx + 1}</td>
                          <td className="py-2 px-3 font-semibold text-slate-900 dark:text-white">
                            <div>{li.title}</div>
                            <div className="text-[10px] font-normal text-slate-500">
                              {li.category}
                            </div>
                          </td>
                          <td className="py-2 px-3">
                            {li.materialName.replace(/\s*\(\$[0-9.]+\/[a-zA-Z0-9_]+\)/g, '')}
                          </td>
                          <td className="py-2 px-3 font-mono">
                            <div>
                              {li.widthM && li.heightM
                                ? `${li.widthM}×${li.heightM}m`
                                : li.dimensionsText.replace(/\$[0-9.]+(\/[a-zA-Z0-9_]+)?/g, '')}{' '}
                              · <strong>{li.quantity} und</strong>
                            </div>
                            {li.laserMinutes && li.laserMinutes > 0 && (
                              <div className="text-[10px] text-amber-600 dark:text-amber-400 font-bold">
                                🔥 {li.laserMinutes} min láser/CNC
                              </div>
                            )}
                          </td>
                          <td className="py-2 px-3 text-[11px]">
                            <div>
                              {li.finishings && li.finishings.length > 0
                                ? li.finishings
                                    .map((f) => f.replace(/\s*\(\$[0-9.]+\)/g, ''))
                                    .join(', ')
                                : (li.finishingsText || 'Estándar').replace(
                                    /\s*\(\$[0-9.]+\)/g,
                                    ''
                                  )}
                            </div>
                            {li.sizesAndColors && (
                              <div className="text-[10px] font-semibold text-purple-700 dark:text-purple-300 mt-0.5">
                                👕 {li.sizesAndColors}
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Acabados e Instrucciones Técnicas */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                  <div className="text-[10px] font-mono uppercase text-slate-500 mb-1.5">
                    ACABADOS DE TALLER Y TERMINACIÓN
                  </div>
                  {blindOtOrder.finishings.length > 0 ? (
                    <ul className="space-y-1">
                      {blindOtOrder.finishings.map((fin, i) => (
                        <li key={i} className="flex items-center gap-1.5 font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>{fin}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-slate-500">Sin acabados adicionales especificados</span>
                  )}
                </div>

                <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                  <div className="text-[10px] font-mono uppercase text-slate-500 mb-1.5">
                    NOTAS TÉCNICAS Y ARCHIVO DE ARTE / RIP
                  </div>
                  <p className="text-xs text-slate-800 dark:text-slate-200 whitespace-pre-line">
                    {blindOtOrder.notes || 'Verificar medidas y colores antes de procesar.'}
                  </p>
                  <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-800 font-mono text-[11px] flex items-center justify-between">
                    <span className="truncate max-w-[220px]">
                      Archivo: {blindOtOrder.artworkUrl || 'En servidor RIP'}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded font-bold ${
                        blindOtOrder.artworkApproved
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                      }`}
                    >
                      {blindOtOrder.artworkApproved ? '✓ ARTE APROBADO' : '⏳ ARTE PENDIENTE'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Checklist de Instalación en Sitio (Interactivo e Imprimible) */}
              <div className="p-4 rounded-lg border-2 border-slate-300 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-950/60 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wide text-slate-900 dark:text-white">
                    📋 CHECKLIST DE VERIFICACIÓN PARA INSTALACIÓN Y ENTREGA
                  </span>
                  {blindOtOrder.installationChecklist?.updatedBy && (
                    <span className="text-[10px] font-mono text-slate-500">
                      Últ. check: {blindOtOrder.installationChecklist.updatedBy} (
                      {blindOtOrder.installationChecklist.updatedAt})
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <label className="flex items-center gap-2 p-2.5 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 cursor-pointer font-medium">
                    <input
                      type="checkbox"
                      checked={Boolean(
                        blindOtOrder.installationChecklist?.electricalPointVerified
                      )}
                      onChange={() =>
                        handleToggleInstallCheck(blindOtOrder, 'electricalPointVerified')
                      }
                      className="rounded border-slate-300 text-emerald-600"
                    />
                    <span>⚡ Punto eléctrico verificado</span>
                  </label>
                  <label className="flex items-center gap-2 p-2.5 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 cursor-pointer font-medium">
                    <input
                      type="checkbox"
                      checked={Boolean(
                        blindOtOrder.installationChecklist?.ladderOrScaffoldingReady
                      )}
                      onChange={() =>
                        handleToggleInstallCheck(blindOtOrder, 'ladderOrScaffoldingReady')
                      }
                      className="rounded border-slate-300 text-emerald-600"
                    />
                    <span>🪜 Equipo de altura/escalera listo</span>
                  </label>
                  <label className="flex items-center gap-2 p-2.5 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 cursor-pointer font-medium">
                    <input
                      type="checkbox"
                      checked={Boolean(blindOtOrder.installationChecklist?.locationConfirmed)}
                      onChange={() =>
                        handleToggleInstallCheck(blindOtOrder, 'locationConfirmed')
                      }
                      className="rounded border-slate-300 text-emerald-600"
                    />
                    <span>📍 Dirección/Ubicación confirmada</span>
                  </label>
                </div>
              </div>

              {/* Firmas de Conformidad de Taller y Recepción de Entrega */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-6 mt-2 border-t border-dashed border-slate-300 dark:border-slate-700">
                <div className="text-center pt-8 border-t border-slate-400 dark:border-slate-600">
                  <div className="font-bold text-slate-900 dark:text-white">
                    FIRMA RESPONSABLE DE TALLER / CONTROL CALIDAD
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Confirma medidas, acabados y prueba de encendido/calidad
                  </div>
                </div>
                <div className="text-center pt-8 border-t border-slate-400 dark:border-slate-600">
                  <div className="font-bold text-slate-900 dark:text-white">
                    FIRMA DE CONFORMIDAD CLIENTE / INSTALACIÓN EN SITIO
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Recibí conforme el trabajo instalado / entregado ({blindOtOrder.clientName})
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
