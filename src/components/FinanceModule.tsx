import React, { useState, useMemo } from 'react';
import {
  DollarSign,
  Lock,
  PlusCircle,
  ArrowDownLeft,
  ArrowUpRight,
  Wallet,
  AlertOctagon,
  Search,
  Landmark,
  FileText,
  Download,
} from 'lucide-react';
import {
  WorkOrder,
  CashTransaction,
  RoleId,
  UserProfile,
  PaymentAuditDetails,
  BANK_ACCOUNTS_CATALOG,
  getTodayDateStr,
} from '../data/initialData';
import { exportTransactionsToCsv } from '../utils/firebaseSyncService';
import { calculateSriTaxesAndRetentions } from '../domain/erpCalculations';

interface FinanceModuleProps {
  orders: WorkOrder[];
  transactions: CashTransaction[];
  currentRole: RoleId;
  currentUser: UserProfile;
  onRegisterOrderPayment: (
    orderId: string,
    amount: number,
    method: 'Efectivo' | 'Transferencia Bancaria' | 'Tarjeta',
    auditDetails?: PaymentAuditDetails
  ) => void;
  onRegisterPettyCashExpense: (
    concept: string,
    provider: string,
    amount: number,
    method: 'Efectivo' | 'Transferencia Bancaria' | 'Tarjeta',
    orderId?: string,
    auditDetails?: PaymentAuditDetails
  ) => void;
}

export const FinanceModule: React.FC<FinanceModuleProps> = ({
  orders,
  transactions,
  currentRole,
  onRegisterOrderPayment,
  onRegisterPettyCashExpense,
}) => {
  const ordersWithPendingBalance = useMemo(
    () => orders.filter((o) => Number((o.totalPrice - o.paidAmount).toFixed(2)) > 0),
    [orders]
  );

  // Estado para Cobro de Anticipo / Saldo de Orden con trazabilidad bancaria y documental
  const [selectedOrderId, setSelectedOrderId] = useState<string>(
    ordersWithPendingBalance[0]?.id || orders[0]?.id || '#CA-001'
  );
  const [collectionAmount, setCollectionAmount] = useState<number>(147.5);
  const [collectionMethod, setCollectionMethod] = useState<
    'Efectivo' | 'Transferencia Bancaria' | 'Tarjeta'
  >('Transferencia Bancaria');
  const [collectionBank, setCollectionBank] = useState<string>(BANK_ACCOUNTS_CATALOG[0]);
  const [collectionRefNumber, setCollectionRefNumber] = useState<string>('SPI-20261017-884');
  const [collectionInvoiceDoc, setCollectionInvoiceDoc] = useState<string>('FAC-001-002-0004825');
  const [collectionNotes, setCollectionNotes] = useState<string>(
    'Verificado en estado de cuenta bancario · Sin novedades'
  );
  const [sriRentaRatePct, setSriRentaRatePct] = useState<number>(1.75);
  const [sriIvaRatePct, setSriIvaRatePct] = useState<number>(30);

  const selectedOrderObj = useMemo(
    () => orders.find((o) => o.id === selectedOrderId) || orders[0],
    [orders, selectedOrderId]
  );

  const sriBreakdown = useMemo(() => {
    const sub = selectedOrderObj?.subtotal || Number((collectionAmount / 1.15).toFixed(2));
    return calculateSriTaxesAndRetentions(sub, 15, sriRentaRatePct, sriIvaRatePct);
  }, [selectedOrderObj, collectionAmount, sriRentaRatePct, sriIvaRatePct]);

  // Estado para Salida Menor de Taller (Caja Chica) con soporte documental
  const [expenseConcept, setExpenseConcept] = useState<string>(
    'Compra de brocas de cobalto, pernos expansivos y cinta 3M VHB'
  );
  const [expenseProvider, setExpenseProvider] = useState<string>('Ferretería Industrial Titan');
  const [expenseAmount, setExpenseAmount] = useState<number>(18.5);
  const [expenseMethod, setExpenseMethod] = useState<
    'Efectivo' | 'Transferencia Bancaria' | 'Tarjeta'
  >('Efectivo');
  const [expenseOrderId, setExpenseOrderId] = useState<string>('#CA-001');
  const [expenseBank, setExpenseBank] = useState<string>('Caja Fuerte / Efectivo Ventanilla');
  const [expenseRefNumber, setExpenseRefNumber] = useState<string>('VALE-CAJA-091');
  const [expenseInvoiceDoc, setExpenseInvoiceDoc] = useState<string>('FAC-002-001-0092104');
  const [expenseNotes, setExpenseNotes] = useState<string>(
    'Entregado a instalador con respaldo de factura física'
  );

  // Filtros del Libro Mayor / Conciliación Bancaria
  const [ledgerSearch, setLedgerSearch] = useState<string>('');
  const [ledgerFilterMethod, setLedgerFilterMethod] = useState<string>('ALL');

  // Métricas Financieras en Tiempo Real
  const metrics = useMemo(() => {
    const realTodayPrefix = getTodayDateStr();
    const hasRealTodayTx = transactions.some((t) => t.date.startsWith(realTodayPrefix));
    const latestTxDatePrefix = transactions[0]?.date?.slice(0, 10) || realTodayPrefix;
    const todayPrefix = hasRealTodayTx ? realTodayPrefix : latestTxDatePrefix;
    const collectionsToday = transactions
      .filter((t) => t.date.startsWith(todayPrefix) && t.type !== 'gasto_chica')
      .reduce((acc, t) => acc + t.amount, 0);

    const totalInflows = transactions
      .filter((t) => t.type !== 'gasto_chica')
      .reduce((acc, t) => acc + t.amount, 0);

    const totalOutflows = transactions
      .filter((t) => t.type === 'gasto_chica')
      .reduce((acc, t) => acc + t.amount, 0);

    const accountsReceivable = orders.reduce(
      (acc, o) => acc + Math.max(0, o.totalPrice - o.paidAmount),
      0
    );

    const netCashBalance = totalInflows - totalOutflows;

    const blockedReadyOrders = orders.filter(
      (o) =>
        o.stage === 'Instalación / Listo para Retiro' &&
        Number((o.totalPrice - o.paidAmount).toFixed(2)) > 0
    );

    return {
      collectionsToday: Number(collectionsToday.toFixed(2)),
      accountsReceivable: Number(accountsReceivable.toFixed(2)),
      totalOutflows: Number(totalOutflows.toFixed(2)),
      netCashBalance: Number(netCashBalance.toFixed(2)),
      blockedReadyOrders,
    };
  }, [orders, transactions]);

  const filteredTransactions = useMemo(() => {
    const q = ledgerSearch.toLowerCase().trim();
    return transactions.filter((tx) => {
      if (ledgerFilterMethod !== 'ALL' && tx.method !== ledgerFilterMethod) {
        return false;
      }
      if (!q) return true;
      return (
        tx.concept.toLowerCase().includes(q) ||
        tx.clientOrProvider.toLowerCase().includes(q) ||
        (tx.orderId && tx.orderId.toLowerCase().includes(q)) ||
        (tx.bankEntity && tx.bankEntity.toLowerCase().includes(q)) ||
        (tx.referenceNumber && tx.referenceNumber.toLowerCase().includes(q)) ||
        (tx.invoiceOrDocNumber && tx.invoiceOrDocNumber.toLowerCase().includes(q)) ||
        (tx.accountHolderOrNotes && tx.accountHolderOrNotes.toLowerCase().includes(q))
      );
    });
  }, [transactions, ledgerSearch, ledgerFilterMethod]);

  const handleSelectOrderForPayment = (id: string) => {
    setSelectedOrderId(id);
    const found = orders.find((o) => o.id === id);
    if (found) {
      setCollectionAmount(Math.max(0, Number((found.totalPrice - found.paidAmount).toFixed(2))));
    }
  };

  const handleChangeCollectionMethod = (
    method: 'Efectivo' | 'Transferencia Bancaria' | 'Tarjeta'
  ) => {
    setCollectionMethod(method);
    if (method === 'Efectivo') {
      setCollectionBank('Caja Fuerte / Efectivo Ventanilla');
    } else if (method === 'Tarjeta') {
      setCollectionBank('Datafast / POS Tarjeta (Lote Comercio)');
    } else {
      setCollectionBank(BANK_ACCOUNTS_CATALOG[0]);
    }
  };

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Caja Chica, Conciliación Bancaria y Control Exhaustivo de Cobros
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Registro auditable de anticipos, liquidaciones y gastos con Banco/Cuenta, N° de Comprobante/Voucher, Factura/Retención SRI y glosa contable.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => exportTransactionsToCsv(transactions)}
            className="px-3.5 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-2xs inline-flex items-center gap-1.5 transition-colors"
            title="Descargar Libro Mayor de Caja y Bancos en formato .CSV compatible con Excel"
          >
            <Download className="w-4 h-4" />
            <span>📥 Exportar a Excel (.CSV)</span>
          </button>
        </div>
      </div>

      {/* 4 Indicadores Financieros en Tiempo Real */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl shadow-xs divide-y sm:divide-y-0 sm:divide-x divide-slate-200/80 dark:divide-slate-800">
        <div className="p-5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Cobros del Día (Hoy)
          </span>
          <div className="text-2xl font-bold font-mono tabular-nums text-emerald-700 dark:text-emerald-400 mt-1">
            ${metrics.collectionsToday.toFixed(2)}
          </div>
          <span className="text-[11px] text-slate-500">Ingresos conciliados hoy</span>
        </div>

        <div className="p-5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Cuentas por Cobrar Pendientes
          </span>
          <div className="text-2xl font-bold font-mono tabular-nums text-amber-600 dark:text-amber-400 mt-1">
            ${metrics.accountsReceivable.toFixed(2)}
          </div>
          <span className="text-[11px] text-slate-500">
            En {ordersWithPendingBalance.length} órdenes de trabajo activas
          </span>
        </div>

        <div className="p-5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Gastos Operativos / Caja Chica
          </span>
          <div className="text-2xl font-bold font-mono tabular-nums text-red-600 dark:text-red-400 mt-1">
            -${metrics.totalOutflows.toFixed(2)}
          </div>
          <span className="text-[11px] text-slate-500">Ferretería, solventes, viáticos</span>
        </div>

        <div className="p-5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Balance de Caja y Bancos Neto
          </span>
          <div className="text-2xl font-bold font-mono tabular-nums text-indigo-600 dark:text-indigo-400 mt-1">
            ${metrics.netCashBalance.toFixed(2)}
          </div>
          <span className="text-[11px] text-slate-500">Disponibilidad neta acumulada</span>
        </div>
      </div>

      {/* ALERTA DE BLOQUEO DE ENTREGA */}
      {metrics.blockedReadyOrders.length > 0 && (
        <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg space-y-3">
          <div className="flex items-center gap-2 text-red-700 dark:text-red-300 font-semibold text-xs">
            <AlertOctagon className="w-4 h-4 shrink-0" />
            <span>
              BLOQUEO DE ENTREGA ACTIVO: Proyectos en etapa "Instalación / Listo para Retiro" con saldo pendiente de cobro
            </span>
          </div>
          <div className="divide-y divide-red-200/60 dark:divide-red-900/50">
            {metrics.blockedReadyOrders.map((bo) => {
              const saldo = Number((bo.totalPrice - bo.paidAmount).toFixed(2));
              return (
                <div
                  key={bo.id}
                  className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                >
                  <div>
                    <span className="font-mono font-bold text-red-700 dark:text-red-300">
                      {bo.id}
                    </span>{' '}
                    · <strong className="text-slate-900 dark:text-white">{bo.clientName}</strong> —{' '}
                    <span className="text-slate-600 dark:text-slate-300">{bo.title}</span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 font-mono">
                    <span className="text-slate-600 dark:text-slate-400">
                      Abonado: ${bo.paidAmount.toFixed(2)} / ${bo.totalPrice.toFixed(2)}
                    </span>
                    <span className="font-bold text-red-700 dark:text-red-300">
                      Saldo Exigible: ${saldo.toFixed(2)}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        handleSelectOrderForPayment(bo.id);
                      }}
                      className="px-3 py-1.5 font-sans font-semibold bg-red-600 hover:bg-red-700 text-white rounded transition-colors inline-flex items-center gap-1"
                    >
                      <Lock className="w-3 h-3" />
                      <span>Cargar en Formulario de Cobro (${saldo.toFixed(2)})</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Formularios de Registro con Respaldo Bancario y Documental */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 1. Registro de Cobro (Anticipo / Liquidación) */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl shadow-xs p-5 space-y-4">
          <div className="border-b border-slate-200/80 dark:border-slate-800 pb-3 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-emerald-600" />
              <span>1. Registrar Cobro / Abono con Respaldo Bancario y Factura</span>
            </h3>
            <span className="px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/70 dark:border-emerald-800 text-[11px] font-mono font-semibold text-emerald-700 dark:text-emerald-400">
              Ingreso Auditable
            </span>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Seleccionar Orden de Trabajo
              </label>
              <select
                value={selectedOrderId}
                onChange={(e) => handleSelectOrderForPayment(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-white"
              >
                {orders.map((o) => {
                  const s = Math.max(0, Number((o.totalPrice - o.paidAmount).toFixed(2)));
                  return (
                    <option key={o.id} value={o.id}>
                      {o.id} · {o.clientName} — Saldo: ${s.toFixed(2)} (Total: ${o.totalPrice.toFixed(2)})
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Monto a Cobrar ($) *
                </label>
                <input
                  type="number"
                  min="1"
                  step="0.5"
                  value={collectionAmount}
                  onChange={(e) => setCollectionAmount(Math.max(0, Number(e.target.value)))}
                  className="w-full px-3 py-2 text-xs font-mono font-bold bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Método de Pago *
                </label>
                <select
                  value={collectionMethod}
                  onChange={(e) =>
                    handleChangeCollectionMethod(
                      e.target.value as 'Efectivo' | 'Transferencia Bancaria' | 'Tarjeta'
                    )
                  }
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-white"
                >
                  <option value="Transferencia Bancaria">Transferencia Bancaria</option>
                  <option value="Efectivo">Efectivo</option>
                  <option value="Tarjeta">Tarjeta / Datafast POS</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                <Landmark className="w-3.5 h-3.5 text-blue-600" />
                <span>Banco / Cuenta Bancaria Destino o Caja Receptora *</span>
              </label>
              <select
                value={collectionBank}
                onChange={(e) => setCollectionBank(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-white"
              >
                {BANK_ACCOUNTS_CATALOG.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  N° Comprobante / Transferencia / Lote POS *
                </label>
                <input
                  type="text"
                  value={collectionRefNumber}
                  onChange={(e) => setCollectionRefNumber(e.target.value)}
                  placeholder="Ej. SPI-99482716 o VOUCHER-4810"
                  className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5 text-slate-500" />
                  <span>N° Factura / Nota de Venta / Retención SRI</span>
                </label>
                <input
                  type="text"
                  value={collectionInvoiceDoc}
                  onChange={(e) => setCollectionInvoiceDoc(e.target.value)}
                  placeholder="Ej. FAC-001-002-0004825 + RET-0019"
                  className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Titular de Cuenta Origen / Observación de Auditoría Contable
              </label>
              <input
                type="text"
                value={collectionNotes}
                onChange={(e) => setCollectionNotes(e.target.value)}
                placeholder="Ej. Cta. Origen: Banco Pichincha del cliente · Acreditado en firme"
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-white"
              />
            </div>

            {/* Calculadora Tributaria SRI Ecuador (Retención Renta + IVA) */}
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  🇪🇨 Desglose de Retenciones SRI (Opcional Clientes Agentes de Retención)
                </span>
                <span className="font-mono text-[11px] text-blue-600 dark:text-blue-400">
                  Base Subt.: ${sriBreakdown.subtotal.toFixed(2)} | IVA 15%: ${sriBreakdown.ivaAmount.toFixed(2)}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-end">
                <div>
                  <label className="block text-[10px] text-slate-500 mb-0.5">Ret. Renta SRI</label>
                  <select
                    value={sriRentaRatePct}
                    onChange={(e) => setSriRentaRatePct(Number(e.target.value))}
                    className="w-full px-2 py-1 text-xs font-mono bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded"
                  >
                    <option value={0}>0% (Sin Ret.)</option>
                    <option value={1.75}>1.75% (Bienes/Publicidad)</option>
                    <option value={2}>2.00% (Servicios Taller)</option>
                    <option value={2.75}>2.75% (Servicios/Vallas)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 mb-0.5">Ret. IVA SRI</label>
                  <select
                    value={sriIvaRatePct}
                    onChange={(e) => setSriIvaRatePct(Number(e.target.value))}
                    className="w-full px-2 py-1 text-xs font-mono bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded"
                  >
                    <option value={0}>0% (Sin Ret.)</option>
                    <option value={30}>30% (Bienes)</option>
                    <option value={70}>70% (Servicios)</option>
                    <option value={100}>100% (Liquidación)</option>
                  </select>
                </div>
                <div className="font-mono text-[11px] bg-white dark:bg-slate-900 p-1.5 rounded border border-slate-200 dark:border-slate-800">
                  <div className="text-[10px] text-slate-500">Total Retenido</div>
                  <div className="font-bold text-amber-600 dark:text-amber-400">
                    -${(sriBreakdown.retentionRentaAmount + sriBreakdown.retentionIvaAmount).toFixed(2)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const totalRet = Number(
                      (sriBreakdown.retentionRentaAmount + sriBreakdown.retentionIvaAmount).toFixed(2)
                    );
                    setCollectionNotes(
                      `Incluye Retención SRI: Renta ${sriRentaRatePct}% ($${sriBreakdown.retentionRentaAmount.toFixed(
                        2
                      )}) + IVA ${sriIvaRatePct}% ($${sriBreakdown.retentionIvaAmount.toFixed(
                        2
                      )}) = -$${totalRet.toFixed(2)} (Líquido bancario: $${sriBreakdown.netReceivableAfterRetentions.toFixed(2)})`
                    );
                  }}
                  className="px-2.5 py-1.5 text-[11px] font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                >
                  Aplicar Glosa SRI
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                if (collectionAmount <= 0) return;
                onRegisterOrderPayment(selectedOrderId, collectionAmount, collectionMethod, {
                  bankEntity: collectionBank,
                  referenceNumber: collectionRefNumber.trim() || 'S/N',
                  invoiceOrDocNumber: collectionInvoiceDoc.trim() || 'Pendiente Facturar',
                  accountHolderOrNotes: collectionNotes.trim(),
                });
              }}
              className="w-full py-2.5 px-4 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow-2xs transition-all duration-200 inline-flex items-center justify-center gap-1.5"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Registrar Cobro con Respaldo Bancario y Enviar Recibo WhatsApp</span>
            </button>
          </div>
        </div>

        {/* 2. Registro de Salida Menor de Taller (Gastos Operativos) con Factura/Recibo */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl shadow-xs p-5 space-y-4">
          <div className="border-b border-slate-200/80 dark:border-slate-800 pb-3 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Wallet className="w-4 h-4 text-red-600" />
              <span>2. Registrar Egreso / Gasto Operativo con Documento de Respaldo</span>
            </h3>
            <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[11px] font-mono text-slate-500 dark:text-slate-400">
              Control de Salidas
            </span>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Concepto del Gasto (Tornillería, Solvente, Viáticos, Transporte, etc.)
              </label>
              <input
                type="text"
                value={expenseConcept}
                onChange={(e) => setExpenseConcept(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-white"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Proveedor / Beneficiario
                </label>
                <input
                  type="text"
                  value={expenseProvider}
                  onChange={(e) => setExpenseProvider(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Monto Salida ($)
                </label>
                <input
                  type="number"
                  min="0.5"
                  step="0.5"
                  value={expenseAmount}
                  onChange={(e) => setExpenseAmount(Math.max(0.5, Number(e.target.value)))}
                  className="w-full px-3 py-2 text-xs font-mono font-bold bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Orden Asociada
                </label>
                <select
                  value={expenseOrderId}
                  onChange={(e) => setExpenseOrderId(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-white"
                >
                  <option value="">General Taller</option>
                  {orders.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.id}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Método de Pago de Salida
                </label>
                <select
                  value={expenseMethod}
                  onChange={(e) =>
                    setExpenseMethod(
                      e.target.value as 'Efectivo' | 'Transferencia Bancaria' | 'Tarjeta'
                    )
                  }
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-white"
                >
                  <option value="Efectivo">Efectivo Caja Chica</option>
                  <option value="Transferencia Bancaria">Transferencia Bancaria</option>
                  <option value="Tarjeta">Tarjeta Corporativa</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Caja / Cuenta Origen de Fondos
                </label>
                <select
                  value={expenseBank}
                  onChange={(e) => setExpenseBank(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-white"
                >
                  {BANK_ACCOUNTS_CATALOG.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  N° Vale de Caja / Ref. Transferencia
                </label>
                <input
                  type="text"
                  value={expenseRefNumber}
                  onChange={(e) => setExpenseRefNumber(e.target.value)}
                  placeholder="Ej. VALE-CAJA-091 o SPI-8821"
                  className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  N° Factura / Nota de Venta Proveedor
                </label>
                <input
                  type="text"
                  value={expenseInvoiceDoc}
                  onChange={(e) => setExpenseInvoiceDoc(e.target.value)}
                  placeholder="Ej. FAC-002-001-0092104"
                  className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Responsable que Retira / Observación de Respaldo
              </label>
              <input
                type="text"
                value={expenseNotes}
                onChange={(e) => setExpenseNotes(e.target.value)}
                placeholder="Ej. Retira Diego Vargas · Factura física archivada en carpeta Octubre"
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-white"
              />
            </div>

            <button
              type="button"
              onClick={() =>
                onRegisterPettyCashExpense(
                  expenseConcept,
                  expenseProvider,
                  expenseAmount,
                  expenseMethod,
                  expenseOrderId || undefined,
                  {
                    bankEntity: expenseBank,
                    referenceNumber: expenseRefNumber.trim() || 'VALE-S/N',
                    invoiceOrDocNumber: expenseInvoiceDoc.trim() || 'Recibo Simple',
                    accountHolderOrNotes: expenseNotes.trim(),
                  }
                )
              }
              className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 rounded transition-colors"
            >
              Registrar Egreso Documentado en Libro Diario
            </button>
          </div>
        </div>
      </div>

      {/* Libro Diario de Movimientos de Caja y Conciliación Bancaria */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/40 dark:bg-slate-950/30">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Libro Diario y Conciliación Bancaria (Trazabilidad de Bancos, Comprobantes y Facturas)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Control exhaustivo de cada dólar ingresado o egresado con su respectivo número de transferencia, lote o factura.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={ledgerSearch}
                onChange={(e) => setLedgerSearch(e.target.value)}
                placeholder="Buscar N° comprobante, factura, banco..."
                className="pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
              />
            </div>

            <select
              value={ledgerFilterMethod}
              onChange={(e) => setLedgerFilterMethod(e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
            >
              <option value="ALL">Todos los Métodos</option>
              <option value="Transferencia Bancaria">Transferencias Bancarias</option>
              <option value="Efectivo">Efectivo</option>
              <option value="Tarjeta">Tarjeta / POS</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/90 dark:bg-slate-950 border-b border-slate-200/80 dark:border-slate-800 text-slate-600 dark:text-slate-400">
              <tr>
                <th className="py-3 px-4">Fecha / Tipo</th>
                <th className="py-3 px-4">Concepto / Cliente o Proveedor</th>
                <th className="py-3 px-4">Banco / Cuenta o Caja</th>
                <th className="py-3 px-4">N° Comprobante / Ref.</th>
                <th className="py-3 px-4">N° Factura / Doc. SRI</th>
                <th className="py-3 px-4">Observación / Auditoría</th>
                <th className="py-3 px-4 text-right">Monto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/80 dark:divide-slate-800">
              {filteredTransactions.map((tx) => {
                const isExpense = tx.type === 'gasto_chica';
                return (
                  <tr key={tx.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="font-mono text-slate-500 block">{tx.date}</span>
                      {isExpense ? (
                        <span className="text-red-600 dark:text-red-400 font-semibold inline-flex items-center gap-1 mt-0.5">
                          <ArrowUpRight className="w-3.5 h-3.5" /> Salida Taller
                        </span>
                      ) : (
                        <span className="text-emerald-700 dark:text-emerald-400 font-semibold inline-flex items-center gap-1 mt-0.5">
                          <ArrowDownLeft className="w-3.5 h-3.5" />{' '}
                          {tx.type === 'ingreso_anticipo' ? 'Anticipo' : 'Liquidación'}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900 dark:text-white">
                        {tx.concept}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {tx.clientOrProvider} · Reg: {tx.registeredBy}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-800 dark:text-slate-200">
                        {tx.bankEntity || tx.method}
                      </div>
                      <div className="text-[11px] font-mono text-slate-500">{tx.method}</div>
                    </td>
                    <td className="py-3 px-4 font-mono">
                      <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded font-semibold">
                        {tx.referenceNumber || 'S/N'}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-blue-600 dark:text-blue-400 font-medium">
                      {tx.invoiceOrDocNumber || '—'}
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400 max-w-xs">
                      {tx.accountHolderOrNotes || '—'}
                    </td>
                    <td
                      className={`py-3 px-4 text-right font-mono font-bold whitespace-nowrap ${
                        isExpense
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-emerald-700 dark:text-emerald-400'
                      }`}
                    >
                      {isExpense ? '-' : '+'}${tx.amount.toFixed(2)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
