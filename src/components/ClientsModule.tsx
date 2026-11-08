import React, { useState, useMemo } from 'react';
import {
  Users,
  Search,
  Tag,
  Plus,
  MessageSquare,
  Calculator,
  DollarSign,
  FileText,
  CheckCircle2,
  Building2,
  Phone,
  Mail,
  MapPin,
  ArrowUpDown,
  UserCheck,
  Bell,
  ClipboardCheck,
  Clock,
  Megaphone,
  Send,
  X,
} from 'lucide-react';
import {
  ClientContact,
  WorkOrder,
  CashTransaction,
  RoleId,
  UserProfile,
  CrmTask,
  CrmTaskPriority,
  AVAILABLE_CLIENT_TAGS,
  CrmLeadStage,
  CRM_LEAD_STAGES,
} from '../data/initialData';

interface ClientsModuleProps {
  clients: ClientContact[];
  orders: WorkOrder[];
  transactions: CashTransaction[];
  currentRole: RoleId;
  users?: UserProfile[];
  currentUser?: UserProfile;
  crmTasks?: CrmTask[];
  onAddClient: (client: ClientContact) => void;
  onUpdateClient: (client: ClientContact) => void;
  onOpenWhatsAppForOrder: (orderId: string) => void;
  onStartQuoteForClient: (client: ClientContact) => void;
  onRegisterOrderPayment: (
    orderId: string,
    amount: number,
    method: 'Efectivo' | 'Transferencia Bancaria' | 'Tarjeta'
  ) => void;
  onAddCrmTask?: (task: Omit<CrmTask, 'id' | 'createdAt' | 'status'>) => void;
  onToggleCrmTaskStatus?: (taskId: string) => void;
  onAssignClientChatsToUser?: (clientName: string, userId: string) => void;
  onSendBatchWhatsAppMessage?: (orderId: string, text: string) => void;
  onNotify: (msg: string) => void;
}

type FinancialFilter = 'all' | 'with_debt' | 'paid_up' | 'vip_repeat';
type SortCriteria = 'total_spent' | 'pending_debt' | 'orders_count' | 'name_asc';

export const ClientsModule: React.FC<ClientsModuleProps> = ({
  clients,
  orders,
  transactions,
  currentRole,
  users = [],
  currentUser,
  crmTasks = [],
  onAddClient,
  onUpdateClient,
  onOpenWhatsAppForOrder,
  onStartQuoteForClient,
  onRegisterOrderPayment,
  onAddCrmTask,
  onToggleCrmTaskStatus,
  onAssignClientChatsToUser,
  onSendBatchWhatsAppMessage,
  onNotify,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedTag, setSelectedTag] = useState<string>('ALL');
  const [executiveFilter, setExecutiveFilter] = useState<string>('ALL');
  const [financialFilter, setFinancialFilter] = useState<FinancialFilter>('all');
  const [crmStageBlockFilter, setCrmStageBlockFilter] = useState<
    'ALL' | 'stage_prospect' | 'stage_quoting' | 'stage_production' | 'stage_recurrent'
  >('ALL');
  const [showTagSelectorDrawer, setShowTagSelectorDrawer] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<SortCriteria>('total_spent');
  const [selectedClientId, setSelectedClientId] = useState<string>(clients[0]?.id || 'cli-1');
  const [showBatchClientModal, setShowBatchClientModal] = useState<boolean>(false);
  const [selectedBatchClientIds, setSelectedBatchClientIds] = useState<string[]>([]);
  const [batchClientPromoText, setBatchClientPromoText] = useState<string>(
    '🎉 *PROMOCIÓN ESPECIAL CREA ARTE — HOLA {cliente}*\n\nDurante esta semana contamos con *20% DE DESCUENTO* en Rótulos Corpóreos 3D, Cajas de Luz LED, Viniles y Lonas Gran Formato.\n\n✅ Incluye revisión técnica de arte sin costo.\n👉 Responda *PROMO* o *COTIZAR* a este mensaje y su ejecutivo *{ejecutivo}* le atenderá de inmediato.'
  );
  const [batchSentCount, setBatchSentCount] = useState<number | null>(null);

  // Crear etiqueta personalizada
  const [customTagInput, setCustomTagInput] = useState<string>('');

  // Crear tarea CRM para el cliente activo
  const [newTaskTitle, setNewTaskTitle] = useState<string>('');
  const [newTaskAssigneeId, setNewTaskAssigneeId] = useState<string>(
    currentUser?.id || users[0]?.id || 'usr-sales'
  );
  const [newTaskPriority, setNewTaskPriority] = useState<CrmTaskPriority>('Alta');
  const [newTaskDueDate, setNewTaskDueDate] = useState<string>('2026-10-18 11:00');
  const [newTaskOrderId, setNewTaskOrderId] = useState<string>('');

  // Modal / Panel de Nuevo Cliente
  const [showNewClientForm, setShowNewClientForm] = useState<boolean>(false);
  const [newName, setNewName] = useState<string>('');
  const [newRuc, setNewRuc] = useState<string>('');
  const [newPhone, setNewPhone] = useState<string>('+593 99 ');
  const [newEmail, setNewEmail] = useState<string>('');
  const [newAddress, setNewAddress] = useState<string>('');
  const [newNotes, setNewNotes] = useState<string>('');
  const [newTags, setNewTags] = useState<string[]>(['Nuevo Prospecto']);
  const [newAssignedExecutiveId, setNewAssignedExecutiveId] = useState<string>(
    currentUser?.id || 'usr-sales'
  );

  const canSeeFinancials = currentRole === 'admin' || currentRole === 'sales';

  // Consolidar clientes del directorio + clientes que hayan sido creados desde el Cotizador
  const enrichedClients = useMemo(() => {
    const mapByKey = new Map<string, ClientContact>();

    clients.forEach((c) => {
      mapByKey.set(c.name.toLowerCase().trim(), c);
    });

    // Asegurar que cualquier orden nueva con un cliente no registrado aparezca también
    orders.forEach((o) => {
      const key = o.clientName.toLowerCase().trim();
      if (!mapByKey.has(key)) {
        mapByKey.set(key, {
          id: `cli-auto-${o.id}`,
          name: o.clientName,
          ruc: o.clientRuc || '9999999999',
          phone: o.clientPhone || '+593 99 000 0000',
          email: 'contacto@cliente.ec',
          cityAddress: 'Registrado desde Cotizador',
          tags: ['Nuevo Prospecto'],
          notes: `Generado automáticamente con la orden ${o.id}.`,
          createdAt: o.createdAt,
        });
      }
    });

    const list = Array.from(mapByKey.values());

    return list.map((client) => {
      const clientOrders = orders.filter(
        (o) =>
          o.clientName.toLowerCase().trim() === client.name.toLowerCase().trim() ||
          (client.ruc && o.clientRuc === client.ruc)
      );

      const totalPurchased = Number(
        clientOrders.reduce((acc, o) => acc + o.totalPrice, 0).toFixed(2)
      );
      const totalPaid = Number(
        clientOrders.reduce((acc, o) => acc + o.paidAmount, 0).toFixed(2)
      );
      const pendingDebt = Math.max(
        0,
        Number((totalPurchased - totalPaid).toFixed(2))
      );
      const ordersCount = clientOrders.length;
      const avgTicket =
        ordersCount > 0 ? Number((totalPurchased / ordersCount).toFixed(2)) : 0;

      const clientTransactions = transactions.filter(
        (tx) =>
          tx.clientOrProvider.toLowerCase().trim() ===
            client.name.toLowerCase().trim() ||
          clientOrders.some((co) => co.id === tx.orderId)
      );

      return {
        client,
        clientOrders,
        clientTransactions,
        totalPurchased,
        totalPaid,
        pendingDebt,
        ordersCount,
        avgTicket,
      };
    });
  }, [clients, orders, transactions]);

  // Todas las etiquetas únicas disponibles en el sistema
  const allSystemTags = useMemo(() => {
    const set = new Set<string>(AVAILABLE_CLIENT_TAGS);
    enrichedClients.forEach((item) => {
      item.client.tags.forEach((t) => set.add(t));
    });
    return Array.from(set);
  }, [enrichedClients]);

  // Filtrado y Ordenamiento
  const filteredClients = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    const filtered = enrichedClients.filter((item) => {
      const { client, pendingDebt, ordersCount } = item;

      // 1. Búsqueda por texto
      const matchesQuery =
        !q ||
        client.name.toLowerCase().includes(q) ||
        client.ruc.toLowerCase().includes(q) ||
        client.phone.toLowerCase().includes(q) ||
        client.cityAddress.toLowerCase().includes(q) ||
        client.tags.some((t) => t.toLowerCase().includes(q));

      if (!matchesQuery) return false;

      // 2. Filtro por Etiqueta
      if (selectedTag !== 'ALL' && !client.tags.includes(selectedTag)) {
        return false;
      }

      // 2.b Filtro por Ejecutivo Asignado
      if (executiveFilter === 'MINE' && currentUser) {
        if ((client.assignedExecutiveId || 'usr-sales') !== currentUser.id) return false;
      } else if (executiveFilter !== 'ALL' && executiveFilter !== 'MINE') {
        if ((client.assignedExecutiveId || 'usr-sales') !== executiveFilter) return false;
      }

      // 3. Filtro Financiero / Comportamiento
      if (financialFilter === 'with_debt' && pendingDebt <= 0) return false;
      if (financialFilter === 'paid_up' && pendingDebt > 0) return false;
      if (
        financialFilter === 'vip_repeat' &&
        ordersCount < 2 &&
        !client.tags.includes('VIP / Recurrente')
      ) {
        return false;
      }

      // 4. Filtro por Bloque de Etapa CRM
      if (crmStageBlockFilter !== 'ALL') {
        const stg = client.crmLeadStage || 'En Calificación / Medidas';
        const isProspect =
          stg === 'Lead Entrante (Meta Ads)' ||
          stg === 'Nuevo Lead (Sin Responder)' ||
          stg === 'En Calificación / Consultando' ||
          stg === 'En Calificación / Medidas';
        const isQuoting =
          stg === 'Cotización Enviada' || stg === 'Esperando Anticipo / Cierre';
        const isProduction =
          stg === 'Cliente en Producción Activa' || stg === 'Cerrado / En Producción';
        const isRecurrent =
          stg === 'Post-Venta / Recurrente' ||
          ordersCount >= 2 ||
          client.tags.includes('VIP / Recurrente');

        if (crmStageBlockFilter === 'stage_prospect' && !isProspect) return false;
        if (crmStageBlockFilter === 'stage_quoting' && !isQuoting) return false;
        if (crmStageBlockFilter === 'stage_production' && !isProduction) return false;
        if (crmStageBlockFilter === 'stage_recurrent' && !isRecurrent) return false;
      }

      return true;
    });

    return filtered.sort((a, b) => {
      if (sortBy === 'total_spent') return b.totalPurchased - a.totalPurchased;
      if (sortBy === 'pending_debt') return b.pendingDebt - a.pendingDebt;
      if (sortBy === 'orders_count') return b.ordersCount - a.ordersCount;
      return a.client.name.localeCompare(b.client.name);
    });
  }, [
    enrichedClients,
    searchQuery,
    selectedTag,
    executiveFilter,
    currentUser,
    financialFilter,
    crmStageBlockFilter,
    sortBy,
  ]);

  const activeClientData = useMemo(() => {
    return (
      enrichedClients.find((item) => item.client.id === selectedClientId) ||
      filteredClients[0] ||
      enrichedClients[0]
    );
  }, [enrichedClients, filteredClients, selectedClientId]);

  // KPIs Globales del Directorio
  const globalStats = useMemo(() => {
    const totalClients = enrichedClients.length;
    const vipCount = enrichedClients.filter((c) =>
      c.client.tags.includes('VIP / Recurrente')
    ).length;
    const clientsWithDebt = enrichedClients.filter((c) => c.pendingDebt > 0).length;
    const totalBilled = enrichedClients.reduce((acc, c) => acc + c.totalPurchased, 0);
    const totalReceivable = enrichedClients.reduce((acc, c) => acc + c.pendingDebt, 0);

    return {
      totalClients,
      vipCount,
      clientsWithDebt,
      totalBilled: Number(totalBilled.toFixed(2)),
      totalReceivable: Number(totalReceivable.toFixed(2)),
    };
  }, [enrichedClients]);

  const handleToggleTagOnActiveClient = (tag: string) => {
    if (!activeClientData) return;
    const currentTags = activeClientData.client.tags;
    const exists = currentTags.includes(tag);
    const nextTags = exists
      ? currentTags.filter((t) => t !== tag)
      : [...currentTags, tag];

    onUpdateClient({
      ...activeClientData.client,
      tags: nextTags,
    });
    onNotify(
      exists
        ? `Etiqueta "${tag}" removida de ${activeClientData.client.name}`
        : `Etiqueta "${tag}" asignada a ${activeClientData.client.name}`
    );
  };

  const handleAddCustomTag = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeClientData || !customTagInput.trim()) return;
    const clean = customTagInput.trim();
    if (!activeClientData.client.tags.includes(clean)) {
      onUpdateClient({
        ...activeClientData.client,
        tags: [...activeClientData.client.tags, clean],
      });
      onNotify(`Nueva etiqueta "${clean}" agregada a ${activeClientData.client.name}`);
    }
    setCustomTagInput('');
  };

  const handleCreateNewClient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    const created: ClientContact = {
      id: `cli-${Date.now()}`,
      name: newName.trim(),
      ruc: newRuc.trim() || '1790000000001',
      phone: newPhone.trim() || '+593 99 000 0000',
      email: newEmail.trim() || 'facturacion@empresa.ec',
      cityAddress: newAddress.trim() || 'Quito, Ecuador',
      tags: newTags.length > 0 ? newTags : ['Nuevo Prospecto'],
      notes: newNotes.trim() || 'Cliente registrado en el directorio comercial.',
      createdAt: '2026-10-17',
      assignedExecutiveId: newAssignedExecutiveId || currentUser?.id || 'usr-sales',
    };
    onAddClient(created);
    setSelectedClientId(created.id);
    setShowNewClientForm(false);
    setNewName('');
    setNewRuc('');
    setNewPhone('+593 99 ');
    setNewEmail('');
    setNewAddress('');
    setNewNotes('');
  };

  return (
    <div className="space-y-5">
      {/* Encabezado */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-200/80 dark:border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Directorio de Clientes, Etiquetas e Historial de Compras (CRM 360°)
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Segmentación por etiquetas comerciales, filtros de cartera vencida y expediente histórico de órdenes y pagos por cliente.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowNewClientForm(!showNewClientForm)}
          className="px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg shadow-xs inline-flex items-center gap-1.5 transition-all duration-200 self-start"
        >
          <Plus className="w-4 h-4" />
          <span>{showNewClientForm ? 'Cerrar Formulario' : 'Registrar Nuevo Cliente'}</span>
        </button>
      </div>

      {/* Formulario Desplegable para Nuevo Cliente */}
      {showNewClientForm && (
        <form
          onSubmit={handleCreateNewClient}
          className="bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-900/60 rounded-lg p-5 space-y-4"
        >
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2.5">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Alta de Nuevo Cliente / Contacto Comercial
            </h3>
            <span className="text-xs text-slate-500">
              Quedará disponible inmediatamente para Cotizador y WhatsApp
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Razón Social / Nombre del Cliente *
              </label>
              <input
                type="text"
                required
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Ej. Importadora Textil Andina S.A."
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                RUC / Cédula
              </label>
              <input
                type="text"
                value={newRuc}
                onChange={(e) => setNewRuc(e.target.value)}
                placeholder="Ej. 1792001122001"
                className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Teléfono WhatsApp
              </label>
              <input
                type="text"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                placeholder="+593 99 123 4567"
                className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Correo Electrónico (Facturación)
              </label>
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="compras@empresa.ec"
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Dirección / Ciudad de Instalación
              </label>
              <input
                type="text"
                value={newAddress}
                onChange={(e) => setNewAddress(e.target.value)}
                placeholder="Av. Galo Plaza Lasso N45, Quito"
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Notas Comerciales / Condiciones
              </label>
              <input
                type="text"
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                placeholder="Ej. Requiere factura antes de anticipo"
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="block text-xs font-medium text-slate-700 dark:text-slate-300">
              Seleccionar Etiquetas Iniciales:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {AVAILABLE_CLIENT_TAGS.map((tag) => {
                const active = newTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() =>
                      setNewTags((prev) =>
                        prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
                      )
                    }
                    className={`px-2.5 py-1 text-xs font-medium rounded border transition-colors ${
                      active
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700'
                    }`}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowNewClientForm(false)}
              className="px-3 py-1.5 text-xs font-medium bg-slate-100 dark:bg-slate-800 rounded text-slate-700 dark:text-slate-300"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded"
            >
              Guardar Cliente en Directorio
            </button>
          </div>
        </form>
      )}

      {/* KPIs de Cartera de Clientes */}
      <div className="grid grid-cols-2 sm:grid-cols-4 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl shadow-xs divide-y sm:divide-y-0 sm:divide-x divide-slate-200/80 dark:divide-slate-800">
        <div className="p-4">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center justify-between">
            <span>Total Clientes Registrados</span>
            <Users className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-1">
            {globalStats.totalClients}
          </div>
          <div className="text-[11px] font-mono text-slate-500">
            {globalStats.vipCount} etiquetados como VIP / Recurrente
          </div>
        </div>

        <div className="p-4">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center justify-between">
            <span>Compras Históricas Acumuladas</span>
            <Building2 className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-1">
            {canSeeFinancials ? `$${globalStats.totalBilled.toFixed(2)}` : 'Restringido'}
          </div>
          <div className="text-[11px] font-mono text-slate-500">
            En {orders.length} órdenes de trabajo históricas
          </div>
        </div>

        <div className="p-4">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center justify-between">
            <span>Clientes con Saldo Pendiente</span>
            <DollarSign className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <div className="text-xl font-bold font-mono tabular-nums text-amber-600 dark:text-amber-400 mt-1">
            {globalStats.clientsWithDebt} cliente(s)
          </div>
          <div className="text-[11px] font-mono text-slate-500">
            Cartera exigible: {canSeeFinancials ? `$${globalStats.totalReceivable.toFixed(2)}` : '—'}
          </div>
        </div>

        <div className="p-4">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center justify-between">
            <span>Etiquetas Activas</span>
            <Tag className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-1">
            {allSystemTags.length} etiquetas
          </div>
          <div className="text-[11px] font-mono text-slate-500">
            Filtro activo: {selectedTag === 'ALL' ? 'Todas' : selectedTag}
          </div>
        </div>
      </div>

      {/* BLOQUES VISUALES DIFERENCIADOS POR ETAPA DEL EMBUDO DE CLIENTES CRM */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {
            id: 'stage_prospect' as const,
            badge: 'ETAPA 1 · LEADS',
            title: 'Prospectos / Toma de Medidas',
            desc: 'Nuevos leads y calificación',
            count: enrichedClients.filter((c) => {
              const s = c.client.crmLeadStage || 'En Calificación / Medidas';
              return (
                s === 'Lead Entrante (Meta Ads)' ||
                s === 'Nuevo Lead (Sin Responder)' ||
                s === 'En Calificación / Consultando' ||
                s === 'En Calificación / Medidas'
              );
            }).length,
            activeBg:
              'bg-fuchsia-100/90 dark:bg-fuchsia-950/60 border-fuchsia-400 dark:border-fuchsia-700 ring-1 ring-fuchsia-400/50',
            idleBg:
              'bg-fuchsia-50/50 dark:bg-fuchsia-950/20 border-fuchsia-200/80 dark:border-fuchsia-900/50 hover:bg-fuchsia-50',
            badgeCls: 'bg-fuchsia-600 text-white',
          },
          {
            id: 'stage_quoting' as const,
            badge: 'ETAPA 2 · COTIZANDO',
            title: 'Proforma Enviada / Por Cobrar 50%',
            desc: 'En negociación comercial',
            count: enrichedClients.filter((c) => {
              const s = c.client.crmLeadStage || 'En Calificación / Medidas';
              return s === 'Cotización Enviada' || s === 'Esperando Anticipo / Cierre';
            }).length,
            activeBg:
              'bg-amber-100/90 dark:bg-amber-950/60 border-amber-400 dark:border-amber-700 ring-1 ring-amber-400/50',
            idleBg:
              'bg-amber-50/50 dark:bg-amber-950/20 border-amber-200/80 dark:border-amber-900/50 hover:bg-amber-50',
            badgeCls: 'bg-amber-600 text-white',
          },
          {
            id: 'stage_production' as const,
            badge: 'ETAPA 3 · PRODUCCIÓN',
            title: 'Ganados / Con Orden en Taller',
            desc: 'En diseño, impresión o montaje',
            count: enrichedClients.filter((c) => {
              const s = c.client.crmLeadStage;
              return s === 'Cliente en Producción Activa' || s === 'Cerrado / En Producción';
            }).length,
            activeBg:
              'bg-indigo-100/90 dark:bg-indigo-950/60 border-indigo-400 dark:border-indigo-700 ring-1 ring-indigo-400/50',
            idleBg:
              'bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-200/80 dark:border-indigo-900/50 hover:bg-indigo-50',
            badgeCls: 'bg-indigo-600 text-white',
          },
          {
            id: 'stage_recurrent' as const,
            badge: 'ETAPA 4 · FIDELIZADOS',
            title: 'Post-Venta / Clientes VIP',
            desc: 'Cartera recurrente y recompra',
            count: enrichedClients.filter(
              (c) =>
                c.client.crmLeadStage === 'Post-Venta / Recurrente' ||
                c.ordersCount >= 2 ||
                c.client.tags.includes('VIP / Recurrente')
            ).length,
            activeBg:
              'bg-emerald-100/90 dark:bg-emerald-950/60 border-emerald-400 dark:border-emerald-700 ring-1 ring-emerald-400/50',
            idleBg:
              'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200/80 dark:border-emerald-900/50 hover:bg-emerald-50',
            badgeCls: 'bg-emerald-600 text-white',
          },
        ].map((b) => {
          const isActive = crmStageBlockFilter === b.id;
          return (
            <button
              key={b.id}
              type="button"
              onClick={() =>
                setCrmStageBlockFilter((prev) => (prev === b.id ? 'ALL' : b.id))
              }
              className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between gap-1.5 ${
                isActive ? b.activeBg : b.idleBg
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider ${b.badgeCls}`}
                >
                  {b.badge}
                </span>
                <span className="text-xs font-mono tabular-nums font-extrabold text-slate-900 dark:text-white">
                  {b.count} clientes
                </span>
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                  {b.title}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                  {isActive ? '✓ Filtro activo (Clic para ver todos)' : b.desc}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* BARRA DE FILTROS INTELIGENTES (BÚSQUEDA, ETIQUETAS, ESTADO FINANCIERO Y ORDENAMIENTO) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl shadow-xs p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          {/* Buscador */}
          <div className="md:col-span-5 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por nombre, RUC, WhatsApp, dirección o etiqueta..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
            />
          </div>

          {/* Filtro por Estado Financiero */}
          <div className="md:col-span-4 flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-950 rounded-xl border border-slate-200/80 dark:border-slate-800 overflow-x-auto">
            {(
              [
                { id: 'all', label: 'Todos' },
                { id: 'with_debt', label: 'Con Deuda' },
                { id: 'paid_up', label: 'Al Día ($0)' },
                { id: 'vip_repeat', label: 'VIP / Recurrentes' },
              ] as { id: FinancialFilter; label: string }[]
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFinancialFilter(f.id)}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-all duration-200 whitespace-nowrap ${
                  financialFilter === f.id
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Ordenar por + Filtro Ejecutivo CRM */}
          <div className="md:col-span-3 flex items-center gap-2">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortCriteria)}
              className="w-full px-2.5 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-white"
            >
              <option value="total_spent">Ordenar: Mayor Compra ($)</option>
              <option value="pending_debt">Ordenar: Mayor Saldo Pendiente ($)</option>
              <option value="orders_count">Ordenar: Más Pedidos Realizados</option>
              <option value="name_asc">Ordenar: Alfabético (A - Z)</option>
            </select>
          </div>
        </div>

        {/* Barra de Filtro Rápido por Ejecutivo Responsable + Etiquetas (Tags) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-semibold text-slate-500 inline-flex items-center gap-1 mr-1">
              <Tag className="w-3 h-3 text-blue-600" /> Filtrar por Etiqueta:
            </span>
            <button
              type="button"
              onClick={() => setSelectedTag('ALL')}
              className={`px-2.5 py-1 text-[11px] font-medium rounded transition-colors ${
                selectedTag === 'ALL'
                  ? 'bg-slate-900 dark:bg-blue-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              Todas ({enrichedClients.length})
            </button>
            {allSystemTags.map((tag) => {
              const count = enrichedClients.filter((c) => c.client.tags.includes(tag)).length;
              const active = selectedTag === tag;
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setSelectedTag(active ? 'ALL' : tag)}
                  className={`px-2.5 py-1 text-[11px] font-medium rounded transition-colors ${
                    active
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {tag} ({count})
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {users.length > 0 && (
              <div className="flex items-center gap-1.5 shrink-0">
                <UserCheck className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <select
                  value={executiveFilter}
                  onChange={(e) => setExecutiveFilter(e.target.value)}
                  className="px-2.5 py-1 text-[11px] font-semibold bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded text-slate-800 dark:text-slate-200"
                >
                  <option value="ALL">👥 Todos los Ejecutivos CRM</option>
                  {currentUser && (
                    <option value="MINE">👤 Mis Clientes Asignados ({currentUser.name})</option>
                  )}
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      Cartera de: {u.name} ({u.roleLabel.split('/')[0].trim()})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              type="button"
              disabled={filteredClients.length === 0}
              onClick={() => {
                setSelectedBatchClientIds(filteredClients.map((fc) => fc.client.id));
                setBatchSentCount(null);
                setShowBatchClientModal(true);
              }}
              className="px-3 py-1.5 text-xs font-bold bg-fuchsia-600 hover:bg-fuchsia-500 disabled:opacity-40 text-white rounded-lg shadow-2xs inline-flex items-center gap-1.5 transition-all"
            >
              <Megaphone className="w-3.5 h-3.5 shrink-0" />
              <span>🚀 Enviar Promo a este Lote Completo ({filteredClients.length})</span>
            </button>
          </div>
        </div>
      </div>

      {/* VISTA MAESTRO-DETALLE: LISTA DE CLIENTES (4 COLS) + EXPEDIENTE E HISTORIAL DE PEDIDOS (8 COLS) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Columna Izquierda: Lista Filtrada de Contactos */}
        <div className="lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden divide-y divide-slate-200 dark:divide-slate-800">
          <div className="px-4 py-3 bg-slate-50 dark:bg-slate-950 flex items-center justify-between gap-2 text-xs">
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              Clientes Encontrados ({filteredClients.length})
            </span>
            <button
              type="button"
              disabled={filteredClients.length === 0}
              onClick={() => {
                setSelectedBatchClientIds(filteredClients.map((fc) => fc.client.id));
                setBatchSentCount(null);
                setShowBatchClientModal(true);
              }}
              className="px-2.5 py-1 text-[11px] font-bold bg-fuchsia-600 hover:bg-fuchsia-500 disabled:opacity-40 text-white rounded-md inline-flex items-center gap-1"
            >
              <Send className="w-3 h-3" />
              <span>Enviar al Lote ({filteredClients.length})</span>
            </button>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[680px] overflow-y-auto">
            {filteredClients.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                No hay clientes que coincidan con los filtros o etiquetas seleccionadas.
              </div>
            ) : (
              filteredClients.map((item) => {
                const { client, totalPurchased, pendingDebt, ordersCount } = item;
                const isSelected = activeClientData?.client.id === client.id;
                return (
                  <button
                    key={client.id}
                    type="button"
                    onClick={() => setSelectedClientId(client.id)}
                    className={`w-full text-left p-3.5 transition-colors space-y-1.5 ${
                      isSelected
                        ? 'bg-blue-50/90 dark:bg-blue-950/40'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-bold text-slate-900 dark:text-white leading-snug">
                        {client.name}
                      </span>
                      <span className="text-[11px] font-mono font-semibold text-blue-600 dark:text-blue-400 shrink-0">
                        {ordersCount} pedido(s)
                      </span>
                    </div>

                    <div className="text-[11px] font-mono text-slate-500 flex items-center justify-between">
                      <span>RUC: {client.ruc}</span>
                      <span>{client.phone}</span>
                    </div>

                    {/* Etiquetas del Cliente + Etapa CRM y Meta Ads */}
                    <div className="flex flex-wrap gap-1 pt-0.5">
                      {(client.adReferral ||
                        client.originChannel === 'meta_ads_wa' ||
                        client.originChannel === 'meta_lead_form' ||
                        client.tags.includes('Lead Meta Ads')) && (
                        <span className="px-1.5 py-0.5 text-[10px] font-bold bg-fuchsia-100 dark:bg-fuchsia-950/80 text-fuchsia-800 dark:text-fuchsia-300 border border-fuchsia-300/60 dark:border-fuchsia-800 rounded">
                          📢 Meta Ads
                        </span>
                      )}
                      {client.crmLeadStage && (
                        <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border border-indigo-200/70 dark:border-indigo-800 rounded">
                          🎯 {client.crmLeadStage}
                        </span>
                      )}
                      {client.tags.map((t) => (
                        <span
                          key={t}
                          className="px-1.5 py-0.5 text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded"
                        >
                          {t}
                        </span>
                      ))}
                    </div>

                    {canSeeFinancials && (
                      <div className="pt-1 flex items-center justify-between text-[11px] font-mono border-t border-slate-100 dark:border-slate-800/80">
                        <span className="text-slate-600 dark:text-slate-400">
                          Comprado: <strong>${totalPurchased.toFixed(2)}</strong>
                        </span>
                        {pendingDebt > 0 ? (
                          <span className="text-amber-600 dark:text-amber-400 font-bold">
                            Debe: ${pendingDebt.toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-emerald-600 dark:text-emerald-400">
                            Al día ($0)
                          </span>
                        )}
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Columna Derecha: Expediente 360°, Etiquetas e Historial de Pedidos del Cliente */}
        <div className="lg:col-span-8 space-y-5">
          {activeClientData ? (
            <>
              {/* Tarjeta Superior: Datos del Cliente + Acciones Directas + Gestor de Etiquetas */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                        {activeClientData.client.name}
                      </h3>
                      <span className="text-xs font-mono text-slate-500">
                        (Cliente desde {activeClientData.client.createdAt})
                      </span>
                      {activeClientData.ordersCount > 1 ? (
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                          ⭐ Cliente Recurrente ({activeClientData.ordersCount} pedidos)
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                          🆕 Nuevo Prospecto
                        </span>
                      )}
                    </div>
                    {activeClientData.client.adReferral && (
                      <div className="mt-1.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-fuchsia-50 dark:bg-fuchsia-950/50 border border-fuchsia-200 dark:border-fuchsia-800 text-xs text-fuchsia-900 dark:text-fuchsia-200">
                        <Megaphone className="w-3.5 h-3.5 text-fuchsia-600 shrink-0" />
                        <span>
                          <strong>Origen Meta Ads:</strong> {activeClientData.client.adReferral.headline || 'Campaña Click-to-WhatsApp'}{' '}
                          ({activeClientData.client.adReferral.sourceId || 'Ad'})
                        </span>
                      </div>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-xs text-slate-600 dark:text-slate-400 mt-2">
                      <span className="inline-flex items-center gap-1.5 font-mono">
                        <FileText className="w-3.5 h-3.5 text-slate-400" /> RUC/CI:{' '}
                        {activeClientData.client.ruc}
                      </span>
                      <span className="inline-flex items-center gap-1.5 font-mono">
                        <Phone className="w-3.5 h-3.5 text-emerald-600" /> WhatsApp:{' '}
                        {activeClientData.client.phone}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5 text-slate-400" />{' '}
                        {activeClientData.client.email}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />{' '}
                        {activeClientData.client.cityAddress}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => onStartQuoteForClient(activeClientData.client)}
                      className="px-3.5 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg shadow-2xs inline-flex items-center gap-1.5 transition-all duration-200"
                    >
                      <Calculator className="w-3.5 h-3.5" />
                      <span>Cotizar a este Cliente</span>
                    </button>
                    {activeClientData.clientOrders[0] && (
                      <button
                        type="button"
                        onClick={() =>
                          onOpenWhatsAppForOrder(activeClientData.clientOrders[0].id)
                        }
                        className="px-3.5 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg shadow-2xs inline-flex items-center gap-1.5 transition-all duration-200"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Abrir Chat WhatsApp</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Resumen Financiero Individual del Cliente */}
                {canSeeFinancials && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 dark:bg-slate-950 p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-mono">
                    <div>
                      <span className="text-[11px] font-sans text-slate-500 block">
                        Total Comprado
                      </span>
                      <strong className="text-sm text-slate-900 dark:text-white">
                        ${activeClientData.totalPurchased.toFixed(2)}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[11px] font-sans text-slate-500 block">
                        Total Abonado
                      </span>
                      <strong className="text-sm text-emerald-700 dark:text-emerald-400">
                        ${activeClientData.totalPaid.toFixed(2)}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[11px] font-sans text-slate-500 block">
                        Saldo Pendiente
                      </span>
                      <strong
                        className={`text-sm ${
                          activeClientData.pendingDebt > 0
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-emerald-700 dark:text-emerald-400'
                        }`}
                      >
                        ${activeClientData.pendingDebt.toFixed(2)}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[11px] font-sans text-slate-500 block">
                        Ticket Promedio ({activeClientData.ordersCount} ord.)
                      </span>
                      <strong className="text-sm text-slate-900 dark:text-white">
                        ${activeClientData.avgTicket.toFixed(2)}
                      </strong>
                    </div>
                  </div>
                )}

                {/* Gestor de Etiquetas Compacto y Plegable (Evita saturación visual) */}
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1 mr-1">
                        <Tag className="w-3.5 h-3.5 text-blue-600" />
                        <span>Etiquetas activas:</span>
                      </span>
                      {activeClientData.client.tags.map((tg) => (
                        <span
                          key={tg}
                          className="px-2.5 py-0.5 text-xs font-semibold rounded-md bg-blue-600 text-white inline-flex items-center gap-1"
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          <span>{tg}</span>
                        </span>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowTagSelectorDrawer((prev) => !prev)}
                      className="px-2.5 py-1 text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 border border-blue-200 dark:border-blue-800 rounded-lg"
                    >
                      {showTagSelectorDrawer
                        ? 'Ocultar catálogo de etiquetas'
                        : '+ Agregar / Quitar Etiquetas'}
                    </button>
                  </div>

                  {showTagSelectorDrawer && (
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2.5">
                      <div className="flex flex-wrap gap-1.5">
                        {allSystemTags.map((tag) => {
                          const hasTag = activeClientData.client.tags.includes(tag);
                          return (
                            <button
                              key={tag}
                              type="button"
                              onClick={() => handleToggleTagOnActiveClient(tag)}
                              className={`px-2.5 py-1 text-xs font-medium rounded border transition-colors inline-flex items-center gap-1 ${
                                hasTag
                                  ? 'bg-blue-600 text-white border-blue-600'
                                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:border-blue-400'
                              }`}
                            >
                              {hasTag && <CheckCircle2 className="w-3 h-3" />}
                              <span>{tag}</span>
                            </button>
                          );
                        })}
                      </div>

                      <form onSubmit={handleAddCustomTag} className="flex items-center gap-1.5">
                        <input
                          type="text"
                          value={customTagInput}
                          onChange={(e) => setCustomTagInput(e.target.value)}
                          placeholder="+ Crear etiqueta propia..."
                          className="px-2.5 py-1 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-white"
                        />
                        <button
                          type="submit"
                          className="px-2.5 py-1 text-xs font-medium bg-slate-900 dark:bg-slate-800 text-white rounded hover:bg-blue-600"
                        >
                          Añadir
                        </button>
                      </form>
                    </div>
                  )}
                </div>

                {/* Notas Comerciales Editables + Etapa Embudo CRM + Asignación de Ejecutivo Responsable */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-1 border-t border-slate-100 dark:border-slate-800">
                  <div className="sm:col-span-5">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Notas Comerciales y Preferencias Técnicas del Cliente:
                    </label>
                    <input
                      type="text"
                      value={activeClientData.client.notes}
                      onChange={(e) =>
                        onUpdateClient({
                          ...activeClientData.client,
                          notes: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-slate-800 dark:text-slate-200"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <label className="block text-xs font-semibold text-indigo-700 dark:text-indigo-300 mb-1">
                      🎯 Etapa del Embudo CRM:
                    </label>
                    <select
                      value={activeClientData.client.crmLeadStage || 'En Calificación / Medidas'}
                      onChange={(e) => {
                        const nextStage = e.target.value as CrmLeadStage;
                        onUpdateClient({
                          ...activeClientData.client,
                          crmLeadStage: nextStage,
                        });
                        onNotify(`Etapa CRM de ${activeClientData.client.name} cambiada a "${nextStage}"`);
                      }}
                      className="w-full px-2.5 py-2 text-xs font-semibold bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded text-slate-900 dark:text-white"
                    >
                      {CRM_LEAD_STAGES.map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                  </div>
                  {users.length > 0 && (
                    <div className="sm:col-span-4">
                      <label className="block text-xs font-semibold text-blue-700 dark:text-blue-300 mb-1">
                        👤 Ejecutivo / Usuario Asignado:
                      </label>
                      <div className="flex items-center gap-1.5">
                        <select
                          value={activeClientData.client.assignedExecutiveId || 'usr-sales'}
                          onChange={(e) => {
                            const newExecId = e.target.value;
                            const execUser = users.find((u) => u.id === newExecId);
                            onUpdateClient({
                              ...activeClientData.client,
                              assignedExecutiveId: newExecId,
                            });
                            if (onAssignClientChatsToUser) {
                              onAssignClientChatsToUser(activeClientData.client.name, newExecId);
                            }
                            onNotify(
                              `Cuenta "${activeClientData.client.name}" y sus chats asignados a ${
                                execUser?.name || newExecId
                              }`
                            );
                          }}
                          className="w-full px-2.5 py-2 text-xs font-semibold bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded text-slate-900 dark:text-white"
                        >
                          {users.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.name} ({u.roleLabel.split('/')[0].trim()})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* PANEL DE TAREAS Y RECORDATORIOS CRM DEL CLIENTE */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <ClipboardCheck className="w-4 h-4 text-blue-600" />
                      <span>
                        Tareas y Seguimientos CRM de {activeClientData.client.name}
                      </span>
                    </h4>
                    <p className="text-xs text-slate-500">
                      Crea tareas para cualquier usuario (Ventas, Diseño, Taller o Admin) y notifica automáticamente en la campana CRM.
                    </p>
                  </div>
                </div>

                {/* Formulario rápido para asignar tarea */}
                {onAddCrmTask && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!newTaskTitle.trim()) return;
                      const targetOrdId =
                        newTaskOrderId || activeClientData.clientOrders[0]?.id || undefined;
                      onAddCrmTask({
                        orderId: targetOrdId,
                        clientId: activeClientData.client.id,
                        clientName: activeClientData.client.name,
                        title: newTaskTitle.trim(),
                        assignedToUserId: newTaskAssigneeId,
                        createdByUserId: currentUser?.id || 'usr-admin',
                        dueDate: newTaskDueDate || 'Hoy 17:00',
                        priority: newTaskPriority,
                      });
                      setNewTaskTitle('');
                    }}
                    className="grid grid-cols-1 sm:grid-cols-12 gap-2 bg-slate-50 dark:bg-slate-950 p-3 rounded-lg border border-slate-200 dark:border-slate-800"
                  >
                    <input
                      type="text"
                      value={newTaskTitle}
                      onChange={(e) => setNewTaskTitle(e.target.value)}
                      placeholder="Ej. Llamar para confirmar medidas finales o cobrar anticipo..."
                      className="sm:col-span-5 px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-white"
                    />
                    <select
                      value={newTaskAssigneeId}
                      onChange={(e) => setNewTaskAssigneeId(e.target.value)}
                      className="sm:col-span-3 px-2 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-white"
                    >
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>
                          Asignar: {u.name}
                        </option>
                      ))}
                    </select>
                    <select
                      value={newTaskPriority}
                      onChange={(e) => setNewTaskPriority(e.target.value as CrmTaskPriority)}
                      className="sm:col-span-2 px-2 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-white"
                    >
                      <option value="Urgente">🔴 Urgente</option>
                      <option value="Alta">🟠 Alta</option>
                      <option value="Normal">🔵 Normal</option>
                    </select>
                    <button
                      type="submit"
                      className="sm:col-span-2 px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded inline-flex items-center justify-center gap-1"
                    >
                      <Bell className="w-3.5 h-3.5" />
                      <span>Crear Tarea</span>
                    </button>
                  </form>
                )}

                {/* Lista de tareas de este cliente */}
                {(() => {
                  const clientTasks = crmTasks.filter(
                    (t) =>
                      t.clientId === activeClientData.client.id ||
                      t.clientName.toLowerCase().trim() ===
                        activeClientData.client.name.toLowerCase().trim() ||
                      activeClientData.clientOrders.some((o) => o.id === t.orderId)
                  );
                  if (clientTasks.length === 0) {
                    return (
                      <div className="text-xs text-slate-400 text-center py-3">
                        No hay tareas CRM registradas para este cliente.
                      </div>
                    );
                  }
                  return (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                      {clientTasks.map((task) => {
                        const assignee = users.find((u) => u.id === task.assignedToUserId);
                        const isDone = task.status === 'completed';
                        return (
                          <div
                            key={task.id}
                            className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                          >
                            <div className="flex items-start gap-2.5">
                              <input
                                type="checkbox"
                                checked={isDone}
                                onChange={() =>
                                  onToggleCrmTaskStatus && onToggleCrmTaskStatus(task.id)
                                }
                                className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                              />
                              <div>
                                <div
                                  className={`font-semibold ${
                                    isDone
                                      ? 'line-through text-slate-400'
                                      : 'text-slate-900 dark:text-white'
                                  }`}
                                >
                                  {task.title}
                                </div>
                                <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-2 mt-0.5">
                                  <span>
                                    👤 Responsable:{' '}
                                    <strong className="text-slate-700 dark:text-slate-300">
                                      {assignee?.name || task.assignedToUserId}
                                    </strong>
                                  </span>
                                  {task.orderId && (
                                    <span className="font-mono text-blue-600 dark:text-blue-400">
                                      Orden {task.orderId}
                                    </span>
                                  )}
                                  <span className="inline-flex items-center gap-1">
                                    <Clock className="w-3 h-3" /> Vence: {task.dueDate}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <span
                              className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded self-start sm:self-center ${
                                isDone
                                  ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                                  : task.priority === 'Urgente'
                                  ? 'bg-red-100 dark:bg-red-950/70 text-red-700 dark:text-red-300'
                                  : task.priority === 'Alta'
                                  ? 'bg-amber-100 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300'
                                  : 'bg-blue-100 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300'
                              }`}
                            >
                              {isDone ? 'Completada' : task.priority}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>

              {/* TABLA DE HISTORIAL DE PEDIDOS / COMPRAS DEL CLIENTE */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
                <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                      Historial de Pedidos y Compras de {activeClientData.client.name} (
                      {activeClientData.clientOrders.length})
                    </h4>
                    <p className="text-xs text-slate-500">
                      Registro histórico de todas sus órdenes de trabajo, medidas, materiales y estado de pago.
                    </p>
                  </div>
                </div>

                {activeClientData.clientOrders.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400">
                    Este cliente aún no registra órdenes de trabajo. Usa el botón "Cotizar a este Cliente" para crear su primer pedido.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400">
                        <tr>
                          <th className="py-2.5 px-4">Folio / Fecha</th>
                          <th className="py-2.5 px-4">Trabajo / Material y Medidas</th>
                          <th className="py-2.5 px-4">Etapa Actual</th>
                          {canSeeFinancials && (
                            <>
                              <th className="py-2.5 px-4 text-right">Total</th>
                              <th className="py-2.5 px-4 text-right">Abonado</th>
                              <th className="py-2.5 px-4 text-right">Saldo</th>
                            </>
                          )}
                          <th className="py-2.5 px-4 text-right">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-mono">
                        {activeClientData.clientOrders.map((ord) => {
                          const saldo = Math.max(
                            0,
                            Number((ord.totalPrice - ord.paidAmount).toFixed(2))
                          );
                          return (
                            <tr
                              key={ord.id}
                              className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                            >
                              <td className="py-3 px-4">
                                <span className="font-bold text-blue-600 dark:text-blue-400 block">
                                  {ord.id}
                                </span>
                                <span className="text-[11px] text-slate-500">{ord.createdAt}</span>
                              </td>
                              <td className="py-3 px-4 font-sans">
                                <strong className="text-slate-900 dark:text-white block">
                                  {ord.title}
                                </strong>
                                <span className="text-[11px] font-mono text-slate-500">
                                  {ord.materialName} · {ord.widthM}m × {ord.heightM}m (
                                  {ord.quantity}u = {ord.totalAreaM2}m²)
                                </span>
                              </td>
                              <td className="py-3 px-4 font-sans">
                                <span
                                  className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold border ${
                                    ord.stage === 'Cotizado / Anticipo Pendiente'
                                      ? 'bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800'
                                      : ord.stage === 'En Diseño y Arte' ||
                                        ord.stage === 'Aprobación del Cliente'
                                      ? 'bg-indigo-100 dark:bg-indigo-950/70 text-indigo-800 dark:text-indigo-300 border-indigo-300 dark:border-indigo-800'
                                      : ord.stage === 'En Cola de Impresión/Corte' ||
                                        ord.stage === 'Acabados y Armado 3D'
                                      ? 'bg-purple-100 dark:bg-purple-950/70 text-purple-800 dark:text-purple-300 border-purple-300 dark:border-purple-800'
                                      : 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                                  }`}
                                >
                                  {ord.stage}
                                </span>
                              </td>
                              {canSeeFinancials && (
                                <>
                                  <td className="py-3 px-4 text-right font-semibold text-slate-900 dark:text-white">
                                    ${ord.totalPrice.toFixed(2)}
                                  </td>
                                  <td className="py-3 px-4 text-right text-emerald-700 dark:text-emerald-400">
                                    ${ord.paidAmount.toFixed(2)}
                                  </td>
                                  <td className="py-3 px-4 text-right">
                                    {saldo > 0 ? (
                                      <span className="text-amber-600 dark:text-amber-400 font-bold">
                                        ${saldo.toFixed(2)}
                                      </span>
                                    ) : (
                                      <span className="text-emerald-700 dark:text-emerald-400">
                                        Liquidado
                                      </span>
                                    )}
                                  </td>
                                </>
                              )}
                              <td className="py-3 px-4 text-right font-sans">
                                <div className="inline-flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => onOpenWhatsAppForOrder(ord.id)}
                                    className="px-2 py-1 text-[11px] font-medium bg-slate-100 dark:bg-slate-800 hover:bg-emerald-600 hover:text-white rounded transition-colors"
                                  >
                                    Chat WA
                                  </button>
                                  {canSeeFinancials && saldo > 0 && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        onRegisterOrderPayment(
                                          ord.id,
                                          saldo,
                                          'Transferencia Bancaria'
                                        )
                                      }
                                      className="px-2 py-1 text-[11px] font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded transition-colors"
                                    >
                                      Cobrar ${saldo.toFixed(0)}
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

              {/* HISTORIAL DE PAGOS Y ABONOS DEL CLIENTE */}
              {canSeeFinancials && activeClientData.clientTransactions.length > 0 && (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
                  <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-800">
                    <h4 className="text-xs font-semibold text-slate-900 dark:text-white">
                      Historial de Abonos, Bancos, Comprobantes y Facturas ({activeClientData.clientTransactions.length})
                    </h4>
                  </div>
                  <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs font-mono">
                    {activeClientData.clientTransactions.map((tx) => (
                      <div
                        key={tx.id}
                        className="px-5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                      >
                        <div className="font-sans space-y-0.5">
                          <span className="font-semibold text-slate-900 dark:text-white block">
                            {tx.concept}
                          </span>
                          <span className="block text-[11px] font-mono text-slate-600 dark:text-slate-400">
                            {tx.date} · <strong>{tx.bankEntity || tx.method}</strong> · Comprobante:{' '}
                            <strong className="text-slate-900 dark:text-white">
                              {tx.referenceNumber || 'S/N'}
                            </strong>{' '}
                            · Doc/Factura:{' '}
                            <span className="text-blue-600 dark:text-blue-400">
                              {tx.invoiceOrDocNumber || '—'}
                            </span>
                          </span>
                          {tx.accountHolderOrNotes && (
                            <span className="block text-[11px] text-slate-500">
                              Nota: {tx.accountHolderOrNotes} (Reg: {tx.registeredBy})
                            </span>
                          )}
                        </div>
                        <span className="font-bold text-emerald-700 dark:text-emerald-400 text-sm shrink-0">
                          +${tx.amount.toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>

      {/* MODAL DE ENVÍO MASIVO DE PROMOCIÓN AL LOTE FILTRADO DESDE CLIENTES CRM */}
      {showBatchClientModal && (() => {
        const targetClientItems = filteredClients.filter(
          (fc) =>
            selectedBatchClientIds.length === 0 ||
            selectedBatchClientIds.includes(fc.client.id)
        );

        const handleSendPromoToClientsBatch = () => {
          if (targetClientItems.length === 0) {
            onNotify('Selecciona al menos un cliente del lote para enviar la promoción.');
            return;
          }
          if (!batchClientPromoText.trim()) {
            onNotify('Escribe el mensaje promocional antes de enviar.');
            return;
          }

          let sentCount = 0;
          targetClientItems.forEach((fc) => {
            const matchedOrder =
              fc.clientOrders[0] ||
              orders.find(
                (o) =>
                  o.clientName.toLowerCase().trim() === fc.client.name.toLowerCase().trim()
              ) ||
              orders[0];

            const execUser = users.find((u) => u.id === fc.client.assignedExecutiveId);
            const execName = execUser?.name || currentUser?.name || 'Asesor Comercial';

            const personalized = batchClientPromoText
              .replace(/\{cliente\}/gi, fc.client.name)
              .replace(/\{orden\}/gi, matchedOrder?.id || '#CA-PROMO')
              .replace(/\{ejecutivo\}/gi, execName);

            if (matchedOrder && onSendBatchWhatsAppMessage) {
              onSendBatchWhatsAppMessage(matchedOrder.id, personalized);
            }
            sentCount += 1;
          });

          setBatchSentCount(sentCount);
          onNotify(
            `🚀 Promoción enviada con éxito al lote completo de ${sentCount} cliente(s) filtrados.`
          );
        };

        return (
          <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto">
              <div className="flex items-center justify-between gap-2 px-5 py-3.5 bg-slate-900 text-white border-b border-slate-800 shrink-0">
                <div className="flex items-center gap-2">
                  <Megaphone className="w-4 h-4 text-fuchsia-400" />
                  <h3 className="text-sm font-bold">
                    Enviar Promoción al Lote Filtrado de Clientes ({targetClientItems.length} clientes)
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowBatchClientModal(false)}
                  className="p-1 text-slate-400 hover:text-white rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 space-y-4 overflow-y-auto flex-1">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      1. Clientes en este lote ({targetClientItems.length} de {filteredClients.length}):
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedBatchClientIds(filteredClients.map((fc) => fc.client.id))
                      }
                      className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      Marcar Todos ({filteredClients.length})
                    </button>
                  </div>

                  <div className="max-h-36 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-xl divide-y divide-slate-100 dark:divide-slate-800 bg-slate-50 dark:bg-slate-950 p-2">
                    {filteredClients.map((fc) => {
                      const isChecked =
                        selectedBatchClientIds.length === 0 ||
                        selectedBatchClientIds.includes(fc.client.id);
                      return (
                        <label
                          key={fc.client.id}
                          className="flex items-center justify-between gap-2 py-1.5 px-2 text-xs cursor-pointer hover:bg-white dark:hover:bg-slate-900 rounded"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                setSelectedBatchClientIds((prev) => {
                                  const base =
                                    prev.length === 0
                                      ? filteredClients.map((x) => x.client.id)
                                      : prev;
                                  return base.includes(fc.client.id)
                                    ? base.filter((id) => id !== fc.client.id)
                                    : [...base, fc.client.id];
                                });
                              }}
                              className="rounded border-slate-300 text-fuchsia-600"
                            />
                            <span className="font-semibold text-slate-900 dark:text-white truncate">
                              {fc.client.name}
                            </span>
                            <span className="font-mono text-[11px] text-slate-500">
                              {fc.client.phone}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {fc.client.tags.slice(0, 2).map((tg) => (
                              <span
                                key={tg}
                                className="px-1.5 py-0.5 rounded text-[10px] bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                              >
                                {tg}
                              </span>
                            ))}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                    2. Elige una Plantilla Promocional en 1 clic:
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {[
                      {
                        label: '🏷️ Promo Rótulos 3D & LED (-20% Off)',
                        text: '🎉 *PROMOCIÓN ESPECIAL CREA ARTE — HOLA {cliente}*\n\nDurante esta semana contamos con *20% DE DESCUENTO* en Rótulos Corpóreos 3D, Cajas de Luz LED y Fachadas en Alucobond.\n\n✅ Incluye montaje fotográfico 3D sin costo.\n👉 Responda *PROMO* y su asesor *{ejecutivo}* actualizará su proforma hoy mismo.',
                      },
                      {
                        label: '📢 Seguimiento Leads Meta Ads',
                        text: '👋 ¡Hola *{cliente}*! Le saludamos de *Crea Arte* respecto a su consulta en nuestra campaña publicitaria ({orden}).\n\n🎁 Si confirma su pedido hoy con el 50% de anticipo, le incluimos *el diseño y vectorizado sin recargo*.',
                      },
                      {
                        label: '⭐ Beneficio VIP / Clientes Recurrentes',
                        text: '⭐ *BENEFICIO CLIENTE PREFERENCIAL CREA ARTE*\nEstimados *{cliente}*, por ser parte de nuestra cartera VIP tienen *prioridad en cola de impresión RIP y 15% de descuento por volumen* en Lonas, Viniles Microperforados y Señalética.',
                      },
                      {
                        label: '🔄 Reactivación / Renovación de Imagen',
                        text: '✨ *RENUEVA LA IMAGEN DE TU NEGOCIO CON CREA ARTE*\nHola *{cliente}*, tenemos tarifas especiales en renovación de viniles de vidriera, mantenimiento de letreros luminosos LED y lonas promocionales.',
                      },
                    ].map((tpl) => (
                      <button
                        key={tpl.label}
                        type="button"
                        onClick={() => setBatchClientPromoText(tpl.text)}
                        className="p-2 text-left text-[11px] font-semibold bg-slate-50 hover:bg-indigo-50 dark:bg-slate-950 dark:hover:bg-indigo-950/50 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-800 rounded-lg transition-colors"
                      >
                        {tpl.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    3. Mensaje personalizado (reemplaza <code>{'{cliente}'}</code> y{' '}
                    <code>{'{ejecutivo}'}</code>):
                  </label>
                  <textarea
                    rows={5}
                    value={batchClientPromoText}
                    onChange={(e) => setBatchClientPromoText(e.target.value)}
                    className="w-full p-3 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                  />
                </div>

                {batchSentCount !== null && (
                  <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-900 dark:text-emerald-200 font-semibold">
                    ✅ ¡Promoción enviada con éxito al lote completo ({batchSentCount} clientes)!
                  </div>
                )}
              </div>

              <div className="px-5 py-3.5 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowBatchClientModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl"
                >
                  Cerrar
                </button>
                <button
                  type="button"
                  onClick={handleSendPromoToClientsBatch}
                  disabled={targetClientItems.length === 0}
                  className="px-5 py-2.5 text-xs font-bold bg-fuchsia-600 hover:bg-fuchsia-500 disabled:opacity-40 text-white rounded-xl shadow-sm inline-flex items-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  <span>
                    🚀 Confirmar y Enviar a Todo el Lote ({targetClientItems.length} clientes)
                  </span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
