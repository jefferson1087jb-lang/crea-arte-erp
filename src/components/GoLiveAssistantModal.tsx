import React, { useState, useEffect } from 'react';
import {
  Rocket,
  X,
  CheckCircle2,
  Trash2,
  RotateCcw,
  DollarSign,
  Users,
  Copy,
  Check,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import {
  CatalogMaterial,
  UserProfile,
  RoleId,
  CATALOG_MATERIALS,
} from '../data/initialData';

interface GoLiveAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: UserProfile[];
  onUpdateUsers: (updatedUsers: UserProfile[]) => void;
  ordersCount: number;
  onClearDemoOrdersForProduction: () => void;
  onRestoreDemoData: () => void;
  onSwitchRoleAndGo: (role: RoleId, module: 'quoter' | 'kanban') => void;
  onNotify: (msg: string) => void;
}

export const GoLiveAssistantModal: React.FC<GoLiveAssistantModalProps> = ({
  isOpen,
  onClose,
  users,
  onUpdateUsers,
  ordersCount,
  onClearDemoOrdersForProduction,
  onRestoreDemoData,
  onSwitchRoleAndGo,
  onNotify,
}) => {
  const [activeStep, setActiveStep] = useState<1 | 2 | 3>(1);
  const [copiedRoleCard, setCopiedRoleCard] = useState<string | null>(null);
  const [confirmClean, setConfirmClean] = useState<boolean>(false);

  const loadCatalogFromStorage = (): CatalogMaterial[] => {
    try {
      const saved = localStorage.getItem('crea_arte_custom_catalog_v1');
      if (!saved) return CATALOG_MATERIALS;
      const parsed: CatalogMaterial[] = JSON.parse(saved);
      const missing = CATALOG_MATERIALS.filter((d) => !parsed.some((p) => p.id === d.id));
      return [...parsed, ...missing];
    } catch {
      return CATALOG_MATERIALS;
    }
  };

  // Catálogo editable en lote sincronizado con localStorage
  const [catalogList, setCatalogList] = useState<CatalogMaterial[]>(loadCatalogFromStorage);

  useEffect(() => {
    if (isOpen) {
      setCatalogList(loadCatalogFromStorage());
    }
  }, [isOpen]);

  useEffect(() => {
    const syncCatalog = () => setCatalogList(loadCatalogFromStorage());
    window.addEventListener('crea_arte_catalog_updated', syncCatalog);
    return () => window.removeEventListener('crea_arte_catalog_updated', syncCatalog);
  }, []);

  if (!isOpen) return null;

  const handlePriceChange = (
    id: string,
    field: 'baseCostPerUnit' | 'suggestedPricePerUnit',
    value: number
  ) => {
    const updated = catalogList.map((item) =>
      item.id === id ? { ...item, [field]: Math.max(0, value) } : item
    );
    setCatalogList(updated);
    localStorage.setItem('crea_arte_custom_catalog_v1', JSON.stringify(updated));
    window.dispatchEvent(new Event('crea_arte_catalog_updated'));
  };

  const handleUserFieldChange = (
    userId: string,
    field: 'name' | 'phone' | 'hourlyCost',
    value: string | number
  ) => {
    const updated = users.map((u) => (u.id === userId ? { ...u, [field]: value } : u));
    onUpdateUsers(updated);
  };

  const copyEmployeeWhatsAppGuide = (roleKey: string, title: string, instructions: string) => {
    navigator.clipboard.writeText(instructions);
    setCopiedRoleCard(roleKey);
    onNotify(`Instrucciones para ${title} copiadas para pegar en WhatsApp`);
    setTimeout(() => setCopiedRoleCard(null), 2500);
  };

  const rolePlaybooks = [
    {
      key: 'sales',
      roleId: 'sales' as RoleId,
      roleName: '1. Ventas / Recepción',
      goldenRule: 'Usa "Orden Express" (solo 3 datos en 10 seg) cuando ya tengas precio o urgencia.',
      whatToDo: [
        'Entra a "1. Cotizador" y usa la pestaña "⚡ Orden Express (10 seg)".',
        'Escribe solo: Cliente, Trabajo y Precio Total ($) + Anticipo ($).',
        'Haz clic en "Crear Orden". No necesitas llenar medidas ni costos internos.',
      ],
      whatsappText: `📌 *GUÍA RÁPIDA CREA ARTE — ROL VENTAS*\nTu trabajo en el sistema toma solo 10 segundos por pedido:\n1️⃣ Entra a *Cotizador* → modo *⚡ Orden Express*.\n2️⃣ Anota solo: *Cliente*, *Trabajo* y *Precio Total / Anticipo*.\n3️⃣ Pulsa *Crear Orden* y listo (el taller la verá al instante en su pantalla).`,
    },
    {
      key: 'designer',
      roleId: 'designer' as RoleId,
      roleName: '2. Diseñador / Pre-prensa',
      goldenRule: 'Solo mira tu filtro "Mis Activos" y toca 1 botón al terminar el diseño.',
      whatToDo: [
        'Entra a "Tablero Kanban" y activa el botón azul "Mis Activos".',
        'Cuando el cliente apruebe el diseño o logo, pulsa el botón de avance.',
        'Pulsa el botón verde "✓ Terminé mi parte" para salir de esa orden.',
      ],
      whatsappText: `🎨 *GUÍA RÁPIDA CREA ARTE — ROL DISEÑO*\nNo tienes que llenar formularios:\n1️⃣ En el *Tablero Kanban*, filtra por *Mis Activos*.\n2️⃣ Al tener el arte listo, avisa por WhatsApp o aprueba el arte en 1 clic.\n3️⃣ Pulsa el botón verde *✓ Terminé mi parte* para darte de baja del proyecto.`,
    },
    {
      key: 'operator',
      roleId: 'operator' as RoleId,
      roleName: '3. Taller / Impresión / Instalación',
      goldenRule: 'Cero escritura: solo mueve la tarjeta y toca "✓ Terminé mi parte".',
      whatToDo: [
        'Mira la columna "2. Impresión y Taller 3D" o "3. Listo / En Instalación".',
        'Al pasar a Impresión, el sistema descuenta solo los m² de bodega.',
        'Al terminar tu armado o montaje, toca "✓ Terminé mi parte".',
      ],
      whatsappText: `🛠️ *GUÍA RÁPIDA CREA ARTE — ROL TALLER E INSTALACIÓN*\nCero papeleo:\n1️⃣ Abre el *Tablero Kanban* en *Mis Activos*.\n2️⃣ Revisa la medida y material en la tarjeta.\n3️⃣ Cuando termines de imprimir, armar o instalar, pulsa el botón verde *✓ Terminé mi parte*.`,
    },
    {
      key: 'admin',
      roleId: 'admin' as RoleId,
      roleName: '4. Gerencia / Caja',
      goldenRule: 'Candado de cobro antes de entregar y compras por PDF en 1 clic.',
      whatToDo: [
        'Ningún trabajo pasa a "Entregado" si tiene saldo pendiente.',
        'Ajusta tus precios en la Tabla Rápida (Paso 2 de esta guía) cuando suban los insumos.',
        'Sube tus facturas PDF en Inventario para alimentar el stock sin digitar.',
      ],
      whatsappText: `💼 *GUÍA RÁPIDA CREA ARTE — GERENCIA Y CAJA*\n1️⃣ Revisa *Resumen Admin* para ver utilidad real y cuentas por cobrar.\n2️⃣ Cobra los saldos pendientes directamente desde las tarjetas listas para entregar.\n3️⃣ Carga compras de material subiendo la factura PDF en *Inventario*.`,
    },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden shadow-2xl my-auto">
        {/* Cabecera Adaptativa (Claro / Oscuro) */}
        <div className="px-4 sm:px-5 py-3.5 sm:py-4 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white flex items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30 shrink-0">
              <Rocket className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-bold tracking-tight text-slate-900 dark:text-white truncate">
                Puesta en Marcha Real en 3 Pasos (Método Anti-Abandono)
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-1">
                Configura tus precios en 1 tabla, asigna a tu equipo real y elimina la carga tediosa de datos.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Pestañas de los 3 Pasos */}
        <div className="grid grid-cols-3 border-b border-slate-200 dark:border-slate-800 bg-slate-100/80 dark:bg-slate-950 shrink-0">
          <button
            type="button"
            onClick={() => setActiveStep(1)}
            className={`py-2.5 sm:py-3 px-2.5 sm:px-4 text-left border-b-2 transition-colors flex items-center gap-2 min-w-0 ${
              activeStep === 1
                ? 'border-blue-600 bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 font-bold'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-900/50'
            }`}
          >
            <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-xs font-mono flex items-center justify-center shrink-0">
              1
            </span>
            <div className="min-w-0">
              <div className="text-xs font-bold truncate">Precios en 1 Tabla</div>
              <div className="text-[10px] opacity-80 truncate hidden sm:block">Sin formularios largos</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setActiveStep(2)}
            className={`py-2.5 sm:py-3 px-2.5 sm:px-4 text-left border-b-2 transition-colors flex items-center gap-2 min-w-0 ${
              activeStep === 2
                ? 'border-blue-600 bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 font-bold'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-900/50'
            }`}
          >
            <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-xs font-mono flex items-center justify-center shrink-0">
              2
            </span>
            <div className="min-w-0">
              <div className="text-xs font-bold truncate">Empleados y 1-Clic</div>
              <div className="text-[10px] opacity-80 truncate hidden sm:block">Qué hace cada rol</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setActiveStep(3)}
            className={`py-2.5 sm:py-3 px-2.5 sm:px-4 text-left border-b-2 transition-colors flex items-center gap-2 min-w-0 ${
              activeStep === 3
                ? 'border-emerald-600 bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 font-bold'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-900/50'
            }`}
          >
            <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-xs font-mono flex items-center justify-center shrink-0">
              3
            </span>
            <div className="min-w-0">
              <div className="text-xs font-bold truncate">Limpiar Demo</div>
              <div className="text-[10px] opacity-80 truncate hidden sm:block">Empezar desde #CA-001</div>
            </div>
          </button>
        </div>

        {/* Contenido del Paso Activo */}
        <div className="p-4 sm:p-5 flex-1 min-h-0 overflow-y-auto space-y-4">
          {activeStep === 1 && (
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/60 p-3 rounded-lg">
                <div className="text-xs text-slate-700 dark:text-slate-300">
                  <strong className="text-blue-800 dark:text-blue-300">
                    Edición Directa Tipo Excel:
                  </strong>{' '}
                  Cambia aquí tus precios reales de venta y costo base. Todo cambio se guarda al instante sin llenar formularios.
                </div>
                <span className="text-[11px] font-mono text-emerald-700 dark:text-emerald-400 font-semibold shrink-0">
                  ✓ Guardado automático
                </span>
              </div>

              <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400">
                    <tr>
                      <th className="py-2.5 px-3">Servicio / Material en Catálogo</th>
                      <th className="py-2.5 px-3">Categoría</th>
                      <th className="py-2.5 px-3 text-right w-32">Costo Base ($)</th>
                      <th className="py-2.5 px-3 text-right w-36">Precio Venta ($)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {catalogList.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                        <td className="py-2 px-3 font-medium text-slate-900 dark:text-white">
                          {item.name}
                        </td>
                        <td className="py-2 px-3 text-slate-500 dark:text-slate-400">
                          {item.category}
                        </td>
                        <td className="py-2 px-3 text-right">
                          <div className="inline-flex items-center gap-1">
                            <span className="text-slate-400 font-mono">$</span>
                            <input
                              type="number"
                              step="0.5"
                              min="0"
                              value={item.baseCostPerUnit}
                              onChange={(e) =>
                                handlePriceChange(
                                  item.id,
                                  'baseCostPerUnit',
                                  Number(e.target.value)
                                )
                              }
                              className="w-20 px-2 py-1 text-right font-mono text-xs bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-white"
                            />
                          </div>
                        </td>
                        <td className="py-2 px-3 text-right">
                          <div className="inline-flex items-center gap-1">
                            <span className="text-blue-600 font-mono font-bold">$</span>
                            <input
                              type="number"
                              step="1"
                              min="1"
                              value={item.suggestedPricePerUnit}
                              onChange={(e) =>
                                handlePriceChange(
                                  item.id,
                                  'suggestedPricePerUnit',
                                  Number(e.target.value)
                                )
                              }
                              className="w-24 px-2 py-1 text-right font-mono font-bold text-xs bg-blue-50/50 dark:bg-blue-950/40 border border-blue-300 dark:border-blue-800 rounded text-blue-700 dark:text-blue-300"
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeStep === 2 && (
            <div className="space-y-4">
              {/* Sub-bloque A: Nombres reales de tus empleados */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    A. Pon los Nombres Reales de tu Equipo (Se actualiza en todo el sistema)
                  </h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {users.map((u) => (
                    <div
                      key={u.id}
                      className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/60 flex items-center justify-between gap-2"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase">
                          {u.department} · {u.roleLabel.split('/')[0]}
                        </div>
                        <input
                          type="text"
                          value={u.name}
                          onChange={(e) => handleUserFieldChange(u.id, 'name', e.target.value)}
                          className="mt-1 w-full px-2 py-1 text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-white"
                        />
                      </div>
                      <div className="w-24 shrink-0">
                        <div className="text-[10px] text-slate-500 text-right">Costo $/h</div>
                        <input
                          type="number"
                          min="1"
                          value={u.hourlyCost}
                          onChange={(e) =>
                            handleUserFieldChange(
                              u.id,
                              'hourlyCost',
                              Math.max(1, Number(e.target.value))
                            )
                          }
                          className="mt-1 w-full px-2 py-1 text-xs font-mono text-right bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-white"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sub-bloque B: Qué hace cada rol para no fallar en la implementación */}
              <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  B. Regla de 1 Solo Clic por Rol (Copia y envía por WhatsApp a cada empleado)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {rolePlaybooks.map((rb) => (
                    <div
                      key={rb.key}
                      className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col justify-between space-y-2.5"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-900 dark:text-white">
                            {rb.roleName}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              onSwitchRoleAndGo(
                                rb.roleId,
                                rb.roleId === 'sales' ? 'quoter' : 'kanban'
                              )
                            }
                            className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            Probar vista →
                          </button>
                        </div>
                        <div className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50/70 dark:bg-emerald-950/30 px-2 py-1 rounded">
                          ⚡ {rb.goldenRule}
                        </div>
                        <ul className="space-y-1 text-xs text-slate-600 dark:text-slate-300 pt-1">
                          {rb.whatToDo.map((line, i) => (
                            <li key={i} className="flex items-start gap-1.5">
                              <span className="text-blue-600 font-bold">•</span>
                              <span>{line}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          copyEmployeeWhatsAppGuide(rb.key, rb.roleName, rb.whatsappText)
                        }
                        className="w-full py-1.5 px-3 text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-blue-600 hover:text-white text-slate-700 dark:text-slate-200 rounded transition-colors flex items-center justify-center gap-1.5"
                      >
                        {copiedRoleCard === rb.key ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                            <span>Copiado para WhatsApp</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copiar Instructivo para WhatsApp</span>
                          </>
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeStep === 3 && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/60 space-y-2">
                <div className="text-sm font-bold text-emerald-900 dark:text-emerald-200 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-emerald-600" />
                  <span>¿Por qué antes era tedioso y cómo empezar hoy sin fricción?</span>
                </div>
                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                  El error más común al implementar un sistema en un taller de gigantografía es obligar al vendedor o al operador a llenar 20 datos por cada letrero.{' '}
                  <strong>Aquí no necesitas hacerlo:</strong> usa el modo{' '}
                  <strong>⚡ Orden Express (10 seg)</strong> en el Cotizador para meter los trabajos que tienes hoy en planta escribiendo solo <em>Cliente, Trabajo y Precio</em>.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
                  <div className="text-xs font-bold text-slate-900 dark:text-white">
                    Opción A: Iniciar en Cero para Producción Real ({ordersCount} órdenes actuales)
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    Borra las órdenes de ejemplo, chats de prueba y cobros demo para empezar desde la orden <strong>#CA-001</strong> con tus clientes reales. Conserva tus empleados, máquinas y precios configurados.
                  </p>
                  {!confirmClean ? (
                    <button
                      type="button"
                      onClick={() => setConfirmClean(true)}
                      className="w-full py-2 px-3 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-md inline-flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Dejar Tablero en Cero (Listo para Clientes Reales)</span>
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          onClearDemoOrdersForProduction();
                          setConfirmClean(false);
                          onClose();
                        }}
                        className="flex-1 py-2 px-3 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-md"
                      >
                        Sí, limpiar órdenes de prueba
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmClean(false)}
                        className="py-2 px-3 text-xs font-medium text-slate-600 bg-slate-100 dark:bg-slate-800 rounded-md"
                      >
                        Cancelar
                      </button>
                    </div>
                  )}
                </div>

                <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
                  <div className="text-xs font-bold text-slate-900 dark:text-white">
                    Opción B: Restaurar Datos de Ejemplo (Modo Práctica)
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    Si quieres practicar con tus empleados antes de limpiar, puedes restaurar las 8 órdenes de ejemplo (#CA-001 a #CA-008) en cualquier momento.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      onRestoreDemoData();
                      onClose();
                    }}
                    className="w-full py-2 px-3 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-md inline-flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Restaurar Órdenes de Demostración</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Pie del Modal */}
        <div className="px-4 sm:px-5 py-3 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="text-xs text-slate-500">
            Paso {activeStep} de 3 · Todo se guarda en la memoria local de este equipo
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {activeStep > 1 && (
              <button
                type="button"
                onClick={() => setActiveStep((prev) => (prev - 1) as 1 | 2 | 3)}
                className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              >
                ← Anterior
              </button>
            )}
            {activeStep < 3 ? (
              <button
                type="button"
                onClick={() => setActiveStep((prev) => (prev + 1) as 1 | 2 | 3)}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md inline-flex items-center gap-1.5"
              >
                <span>Siguiente Paso</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-slate-900 dark:bg-blue-600 rounded-md"
              >
                Finalizar y Volver al Sistema
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
