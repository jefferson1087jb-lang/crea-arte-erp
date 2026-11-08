import {
  WorkOrder,
  InventoryItem,
  InventoryMovement,
  TimeLogEntry,
  CashTransaction,
  WorkshopMachine,
  MachineMaintenanceLog,
  UserProfile,
  RestockRequest,
  ChatMessage,
  WhatsAppApiConfig,
  CATALOG_MATERIALS,
  ORDER_STAGES,
} from '../data/initialData';

export function downloadStandaloneHtmlBundle(state: {
  orders: WorkOrder[];
  inventory: InventoryItem[];
  movements: InventoryMovement[];
  timeLogs: TimeLogEntry[];
  transactions: CashTransaction[];
  machines: WorkshopMachine[];
  maintenanceLogs: MachineMaintenanceLog[];
  users: UserProfile[];
  restockRequests: RestockRequest[];
  chatMessages: ChatMessage[];
  waConfig: WhatsAppApiConfig;
}) {
  const serializedState = JSON.stringify({
    ...state,
    catalog: CATALOG_MATERIALS,
    stages: ORDER_STAGES,
  });

  const htmlContent = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Crea Arte - ERP & Taller Operativo Integral (Producción, Tiempos, Inventario, Roles y CRM WhatsApp)</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://unpkg.com/react@18/umd/react.production.min.js" crossorigin></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js" crossorigin></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=JetBrains+Mono:wght@400;600&family=Plus+Jakarta+Sans:wght@600;700&display=swap" rel="stylesheet" />
  <style>
    body { font-family: 'DM Sans', sans-serif; }
    h1, h2, h3, h4 { font-family: 'Plus Jakarta Sans', sans-serif; }
    .font-mono { font-family: 'JetBrains Mono', monospace; font-variant-numeric: tabular-nums; }
  </style>
</head>
<body class="bg-slate-50 text-slate-900 antialiased">
  <div id="root"></div>
  <script>
    window.__CREA_ARTE_SEED__ = ${serializedState};
  </script>
  <script type="text/babel">
    const { useState, useEffect, useMemo } = React;

    function StandaloneApp() {
      const seed = window.__CREA_ARTE_SEED__;
      const [userId, setUserId] = useState(seed.users[0].id);
      const [tab, setTab] = useState('kanban');
      const [orders, setOrders] = useState(() => {
        const s = localStorage.getItem('ca_sa_orders');
        return s ? JSON.parse(s) : seed.orders;
      });
      const [inventory, setInventory] = useState(() => {
        const s = localStorage.getItem('ca_sa_inv');
        return s ? JSON.parse(s) : seed.inventory;
      });
      const [messages, setMessages] = useState(() => {
        const s = localStorage.getItem('ca_sa_msgs');
        return s ? JSON.parse(s) : seed.chatMessages;
      });
      const [waConfig, setWaConfig] = useState(() => {
        const s = localStorage.getItem('ca_sa_waconf');
        return s ? JSON.parse(s) : seed.waConfig;
      });
      const [activeChatOrderId, setActiveChatOrderId] = useState(seed.orders[0]?.id || '#CA-001');
      const [draft, setDraft] = useState('');

      useEffect(() => { localStorage.setItem('ca_sa_orders', JSON.stringify(orders)); }, [orders]);
      useEffect(() => { localStorage.setItem('ca_sa_inv', JSON.stringify(inventory)); }, [inventory]);
      useEffect(() => { localStorage.setItem('ca_sa_msgs', JSON.stringify(messages)); }, [messages]);
      useEffect(() => { localStorage.setItem('ca_sa_waconf', JSON.stringify(waConfig)); }, [waConfig]);

      const currentUser = seed.users.find(u => u.id === userId) || seed.users[0];
      const role = currentUser.role;
      const activeChatOrder = orders.find(o => o.id === activeChatOrderId) || orders[0];

      const sendMsg = (e) => {
        e.preventDefault();
        if (!draft.trim() || !activeChatOrder) return;
        const m = {
          id: 'm-' + Date.now(),
          orderId: activeChatOrder.id,
          sender: 'agent',
          senderName: currentUser.name,
          text: draft.trim(),
          timestamp: '2026-10-16 20:25',
          status: 'read',
          channel: waConfig.mode === 'meta_cloud_api' ? 'meta_cloud_api' : 'wa_direct'
        };
        setMessages([...messages, m]);
        setDraft('');
      };

      return (
        <div class="min-h-screen flex flex-col">
          <header class="bg-slate-900 text-white px-6 py-4 flex flex-wrap items-center justify-between gap-4 border-b border-slate-800">
            <div>
              <h1 class="text-base font-bold tracking-tight">Crea Arte — ERP & Taller Operativo Integral + CRM WhatsApp</h1>
              <p class="text-xs text-slate-400">SPA Autónoma HTML5 con Persistencia LocalStorage y Control RBAC</p>
            </div>
            <div class="flex items-center gap-3">
              <span class="text-xs text-slate-400">Usuario / Rol Activo:</span>
              <select value={userId} onChange={e => setUserId(e.target.value)} class="bg-slate-800 text-white text-xs px-3 py-2 rounded border border-slate-700">
                {seed.users.map(u => (
                  <option key={u.id} value={u.id}>{u.roleLabel} — {u.name}</option>
                ))}
              </select>
            </div>
          </header>

          <div class="p-6 max-w-7xl mx-auto w-full space-y-6">
            <div class="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
              <button onClick={() => setTab('kanban')} class={"px-3 py-1.5 text-xs font-medium rounded " + (tab === 'kanban' ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200')}>1. Kanban Producción ({orders.length})</button>
              <button onClick={() => setTab('crm')} class={"px-3 py-1.5 text-xs font-medium rounded " + (tab === 'crm' ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200')}>2. CRM Multichat WhatsApp</button>
              <button onClick={() => setTab('inventory')} class={"px-3 py-1.5 text-xs font-medium rounded " + (tab === 'inventory' ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200')}>3. Inventario ({inventory.length})</button>
              {role === 'admin' && (
                <button onClick={() => setTab('api')} class={"px-3 py-1.5 text-xs font-medium rounded " + (tab === 'api' ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200')}>4. Config Meta Cloud API</button>
              )}
            </div>

            {tab === 'kanban' && (
              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {orders.map(o => (
                  <div key={o.id} class="bg-white p-4 rounded-lg border border-slate-200 space-y-2">
                    <div class="flex justify-between text-xs font-mono text-slate-500">
                      <span class="font-bold text-blue-600">{o.id}</span>
                      <span>{o.stage}</span>
                    </div>
                    <h3 class="font-semibold text-sm">{o.title}</h3>
                    <p class="text-xs text-slate-600">{o.clientName} · {o.widthM}m × {o.heightM}m ({o.totalAreaM2} m²)</p>
                    {(role === 'admin' || role === 'sales') && (
                      <div class="pt-2 border-t border-slate-100 flex justify-between text-xs font-mono">
                        <span>Total: \${o.totalPrice.toFixed(2)}</span>
                        <span class="font-bold text-amber-600">Saldo: \${(o.totalPrice - o.paidAmount).toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {tab === 'crm' && activeChatOrder && (
              <div class="grid grid-cols-1 lg:grid-cols-12 bg-white border border-slate-200 rounded-lg overflow-hidden min-h-[500px] divide-x divide-slate-200">
                <div class="lg:col-span-3 divide-y divide-slate-100">
                  {orders.map(o => (
                    <button key={o.id} onClick={() => setActiveChatOrderId(o.id)} class={"w-full p-3 text-left block " + (o.id === activeChatOrder.id ? 'bg-blue-50' : '')}>
                      <div class="text-xs font-mono font-bold text-blue-600">{o.id}</div>
                      <div class="text-xs font-semibold truncate">{o.clientName}</div>
                      <div class="text-[11px] text-slate-500">{o.stage}</div>
                    </button>
                  ))}
                </div>
                <div class="lg:col-span-6 flex flex-col justify-between p-4 bg-slate-50">
                  <div class="space-y-2 overflow-y-auto max-h-80">
                    {messages.filter(m => m.orderId === activeChatOrder.id).map(m => (
                      <div key={m.id} class={"p-2.5 rounded text-xs max-w-[85%] " + (m.sender === 'agent' ? 'ml-auto bg-emerald-900 text-white' : 'bg-white border border-slate-200')}>
                        <div class="text-[10px] opacity-75 font-mono">{m.senderName} · {m.timestamp}</div>
                        <div class="mt-1 whitespace-pre-wrap">{m.text}</div>
                      </div>
                    ))}
                  </div>
                  <form onSubmit={sendMsg} class="pt-3 flex gap-2">
                    <input value={draft} onChange={e => setDraft(e.target.value)} placeholder="Escribe un mensaje..." class="flex-1 px-3 py-2 text-xs border border-slate-300 rounded bg-white" />
                    <button type="submit" class="px-4 py-2 text-xs font-semibold bg-emerald-600 text-white rounded">Enviar</button>
                  </form>
                </div>
                <div class="lg:col-span-3 p-4 space-y-2 text-xs">
                  <div class="font-bold text-sm">{activeChatOrder.clientName}</div>
                  <div class="font-mono text-slate-500">{activeChatOrder.clientPhone}</div>
                  <div class="pt-2 border-t border-slate-100">Orden: <strong>{activeChatOrder.id}</strong></div>
                  <div>Estado: <strong>{activeChatOrder.stage}</strong></div>
                  <div>Total: <strong>\${activeChatOrder.totalPrice.toFixed(2)}</strong></div>
                  <div>Saldo: <strong class="text-amber-600">\${(activeChatOrder.totalPrice - activeChatOrder.paidAmount).toFixed(2)}</strong></div>
                </div>
              </div>
            )}

            {tab === 'inventory' && (
              <div class="bg-white rounded-lg border border-slate-200 overflow-hidden">
                <table class="w-full text-left text-xs">
                  <thead class="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th class="p-3">SKU</th>
                      <th class="p-3">Insumo</th>
                      <th class="p-3">Categoría</th>
                      <th class="p-3 text-right">Stock Actual</th>
                      {role === 'admin' && <th class="p-3 text-right">Costo Compra</th>}
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-200">
                    {inventory.map(item => (
                      <tr key={item.id}>
                        <td class="p-3 font-mono">{item.sku}</td>
                        <td class="p-3 font-medium">{item.name}</td>
                        <td class="p-3 text-slate-500">{item.category}</td>
                        <td class="p-3 text-right font-mono">{item.currentStock} {item.unit}</td>
                        {role === 'admin' && <td class="p-3 text-right font-mono">\${item.unitCost.toFixed(2)}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {tab === 'api' && role === 'admin' && (
              <div class="bg-white p-5 rounded-lg border border-slate-200 space-y-3 max-w-xl text-xs">
                <h3 class="font-bold text-sm">Configuración Meta WhatsApp Cloud API (Exclusivo Administrador)</h3>
                <div>Phone Number ID: <input value={waConfig.phoneNumberId} onChange={e => setWaConfig({...waConfig, phoneNumberId: e.target.value})} class="w-full mt-1 px-3 py-1.5 border rounded font-mono" /></div>
                <div>WABA ID: <input value={waConfig.wabaId} onChange={e => setWaConfig({...waConfig, wabaId: e.target.value})} class="w-full mt-1 px-3 py-1.5 border rounded font-mono" /></div>
                <div>Webhook Endpoint: <input value={waConfig.webhookUrl} onChange={e => setWaConfig({...waConfig, webhookUrl: e.target.value})} class="w-full mt-1 px-3 py-1.5 border rounded font-mono" /></div>
              </div>
            )}
          </div>
        </div>
      );
    }

    ReactDOM.createRoot(document.getElementById('root')).render(<StandaloneApp />);
  </script>
</body>
</html>`;

  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'Crea_Arte_ERP_Taller_Integral_CRM_WhatsApp.html';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
