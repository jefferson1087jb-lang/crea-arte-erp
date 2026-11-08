import React, { useState, useEffect } from 'react';
import {
  FileText,
  Save,
  RotateCcw,
  X,
  Building2,
  Landmark,
  Sliders,
  FileDown,
  UserCheck,
} from 'lucide-react';
import {
  ProformaTemplateConfig,
  DEFAULT_PROFORMA_TEMPLATE_CONFIG,
  getProformaTemplateConfig,
  saveProformaTemplateConfig,
  buildProformaFromWorkOrder,
  generateQuotePdf,
} from '../utils/quotePdfGenerator';
import { WorkOrder } from '../data/initialData';

interface ProformaTemplateEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeOrder?: WorkOrder | null;
  currentUserName?: string;
  onUpdateOrder?: (updatedOrder: WorkOrder) => void;
  onSaved?: (newConfig: ProformaTemplateConfig) => void;
  onNotify: (msg: string) => void;
}

export const ProformaTemplateEditorModal: React.FC<ProformaTemplateEditorModalProps> = ({
  isOpen,
  onClose,
  activeOrder,
  currentUserName = 'Departamento Comercial',
  onUpdateOrder,
  onSaved,
  onNotify,
}) => {
  const [config, setConfig] = useState<ProformaTemplateConfig>(() => getProformaTemplateConfig());

  // Campos individuales de la orden/proforma activa (si existe)
  const [orderClientName, setOrderClientName] = useState<string>('');
  const [orderClientRuc, setOrderClientRuc] = useState<string>('');
  const [orderClientPhone, setOrderClientPhone] = useState<string>('');
  const [orderTitle, setOrderTitle] = useState<string>('');
  const [orderNotes, setOrderNotes] = useState<string>('');
  const [advisorNameOverride, setAdvisorNameOverride] = useState<string>(currentUserName);

  useEffect(() => {
    if (isOpen) {
      setConfig(getProformaTemplateConfig());
      if (activeOrder) {
        setOrderClientName(activeOrder.clientName);
        setOrderClientRuc(activeOrder.clientRuc || '9999999999');
        setOrderClientPhone(activeOrder.clientPhone || '');
        setOrderTitle(activeOrder.title);
        setOrderNotes(activeOrder.notes || '');
      }
      setAdvisorNameOverride(currentUserName);
    }
  }, [isOpen, activeOrder, currentUserName]);

  if (!isOpen) return null;

  const handleSaveAll = (e: React.FormEvent) => {
    e.preventDefault();
    saveProformaTemplateConfig(config);
    if (onSaved) onSaved(config);

    if (activeOrder && onUpdateOrder) {
      onUpdateOrder({
        ...activeOrder,
        clientName: orderClientName.trim() || activeOrder.clientName,
        clientRuc: orderClientRuc.trim() || activeOrder.clientRuc,
        clientPhone: orderClientPhone.trim() || activeOrder.clientPhone,
        title: orderTitle.trim() || activeOrder.title,
        notes: orderNotes,
      });
    }

    onNotify('Encabezado corporativo y datos de la Proforma guardados correctamente');
    onClose();
  };

  const handleSaveAndDownloadPdf = () => {
    saveProformaTemplateConfig(config);
    if (onSaved) onSaved(config);

    if (activeOrder) {
      const updatedOrd: WorkOrder = {
        ...activeOrder,
        clientName: orderClientName.trim() || activeOrder.clientName,
        clientRuc: orderClientRuc.trim() || activeOrder.clientRuc,
        clientPhone: orderClientPhone.trim() || activeOrder.clientPhone,
        title: orderTitle.trim() || activeOrder.title,
        notes: orderNotes,
      };
      if (onUpdateOrder) {
        onUpdateOrder(updatedOrd);
      }
      const proforma = buildProformaFromWorkOrder(
        updatedOrd,
        advisorNameOverride.trim() || currentUserName
      );
      proforma.validDays = config.defaultValidDays || 15;
      proforma.deliveryDays = config.defaultDeliveryDays || proforma.deliveryDays;
      proforma.paymentTermsOverride = config.paymentTermsLabel;
      const { fileName } = generateQuotePdf(proforma, {
        download: true,
        customTemplate: config,
      });
      onNotify(`PDF "${fileName}" generado con el nuevo encabezado y datos actualizados`);
    } else {
      onNotify('Plantilla de encabezado guardada para todas las proformas');
    }
    onClose();
  };

  const handleRestoreDefaults = () => {
    setConfig(DEFAULT_PROFORMA_TEMPLATE_CONFIG);
    saveProformaTemplateConfig(DEFAULT_PROFORMA_TEMPLATE_CONFIG);
    if (onSaved) onSaved(DEFAULT_PROFORMA_TEMPLATE_CONFIG);
    onNotify('Encabezado de Proforma restaurado a los valores originales de Crea Arte');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-3 sm:p-5 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Cabecera del Modal */}
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between gap-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-blue-600/20 border border-blue-500/40 text-blue-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold">
                Configurar Encabezado, Condiciones y Datos de la Proforma PDF
              </h3>
              <p className="text-xs text-slate-400">
                Personaliza el membrete corporativo, cuentas bancarias, condiciones operativas y datos de la orden actual.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Cuerpo del Formulario */}
        <form onSubmit={handleSaveAll} className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
          {/* SECCIÓN 0: DATOS ESPECÍFICOS DE LA ORDEN / PROFORMA ACTUAL (SI APLICA) */}
          {activeOrder && (
            <div className="p-4 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/80 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-blue-900 dark:text-blue-200 flex items-center gap-1.5 uppercase tracking-wide">
                  <UserCheck className="w-4 h-4 text-blue-600" />
                  <span>
                    1. Datos del Cliente y Rubro en la Proforma Actual (PRO-{activeOrder.id})
                  </span>
                </h4>
                <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-blue-600 text-white">
                  Total: ${activeOrder.totalPrice.toFixed(2)}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Cliente / Empresa:
                  </label>
                  <input
                    type="text"
                    value={orderClientName}
                    onChange={(e) => setOrderClientName(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    RUC / Cédula:
                  </label>
                  <input
                    type="text"
                    value={orderClientRuc}
                    onChange={(e) => setOrderClientRuc(e.target.value)}
                    className="w-full px-3 py-2 font-mono bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    WhatsApp Cliente:
                  </label>
                  <input
                    type="text"
                    value={orderClientPhone}
                    onChange={(e) => setOrderClientPhone(e.target.value)}
                    className="w-full px-3 py-2 font-mono bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Descripción Principal del Trabajo / Ítem 1:
                  </label>
                  <input
                    type="text"
                    value={orderTitle}
                    onChange={(e) => setOrderTitle(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Asesor Comercial / Elaborado por:
                  </label>
                  <input
                    type="text"
                    value={advisorNameOverride}
                    onChange={(e) => setAdvisorNameOverride(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Observaciones y Garantía Técnica de esta Orden (Reemplaza el texto de campaña si lo deseas):
                </label>
                <textarea
                  rows={2}
                  value={orderNotes}
                  onChange={(e) => setOrderNotes(e.target.value)}
                  placeholder="Ej. Incluye estructura metálica anticorrosiva, iluminación LED 12V y garantía de 1 año..."
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                />
              </div>
            </div>
          )}

          {/* SECCIÓN 1: ENCABEZADO CORPORATIVO (MEMBRETE SUPERIOR) */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3">
            <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5 uppercase tracking-wide">
              <Building2 className="w-4 h-4 text-indigo-600" />
              <span>Membrete y Encabezado Corporativo (Franja Superior Oscura)</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nombre Comercial / Razón Social:
                </label>
                <input
                  type="text"
                  value={config.companyName}
                  onChange={(e) => setConfig({ ...config, companyName: e.target.value })}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-bold"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Título del Recuadro Derecho:
                </label>
                <input
                  type="text"
                  value={config.documentTitle}
                  onChange={(e) => setConfig({ ...config, documentTitle: e.target.value })}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Subtítulo de Especialidades / Giro de Negocio:
              </label>
              <input
                type="text"
                value={config.companySubtitle}
                onChange={(e) => setConfig({ ...config, companySubtitle: e.target.value })}
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Línea RUC y Dirección Matriz:
                </label>
                <input
                  type="text"
                  value={config.companyRucAndAddress}
                  onChange={(e) => setConfig({ ...config, companyRucAndAddress: e.target.value })}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Línea WhatsApp CRM y Correo Electrónico:
                </label>
                <input
                  type="text"
                  value={config.companyContactLine}
                  onChange={(e) => setConfig({ ...config, companyContactLine: e.target.value })}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                />
              </div>
            </div>
          </div>

          {/* SECCIÓN 2: CONDICIONES OPERATIVAS Y DE PAGO */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3">
            <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5 uppercase tracking-wide">
              <Sliders className="w-4 h-4 text-emerald-600" />
              <span>Condiciones Operativas, Tiempos y Garantía por Defecto</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Validez de Oferta (Días):
                </label>
                <input
                  type="number"
                  min={1}
                  max={90}
                  value={config.defaultValidDays}
                  onChange={(e) =>
                    setConfig({ ...config, defaultValidDays: Number(e.target.value) || 15 })
                  }
                  className="w-full px-3 py-2 font-mono bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Tiempo de Entrega (Días laborables):
                </label>
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={config.defaultDeliveryDays}
                  onChange={(e) =>
                    setConfig({ ...config, defaultDeliveryDays: Number(e.target.value) || 3 })
                  }
                  className="w-full px-3 py-2 font-mono bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Forma de Pago:
                </label>
                <input
                  type="text"
                  value={config.paymentTermsLabel}
                  onChange={(e) => setConfig({ ...config, paymentTermsLabel: e.target.value })}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Texto de Garantía Técnica por Defecto (cuando la orden no tiene observaciones):
              </label>
              <input
                type="text"
                value={config.defaultWarrantyNote}
                onChange={(e) => setConfig({ ...config, defaultWarrantyNote: e.target.value })}
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
              />
            </div>
          </div>

          {/* SECCIÓN 3: CUENTAS BANCARIAS OFICIALES Y PIE DE FIRMAS */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3">
            <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5 uppercase tracking-wide">
              <Landmark className="w-4 h-4 text-amber-600" />
              <span>Cuentas Bancarias Oficiales y Títulos de Firma</span>
            </h4>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Título del Recuadro Bancario:
              </label>
              <input
                type="text"
                value={config.bankHeaderTitle}
                onChange={(e) => setConfig({ ...config, bankHeaderTitle: e.target.value })}
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Cuenta Bancaria #1:
                </label>
                <input
                  type="text"
                  value={config.bankLine1}
                  onChange={(e) => setConfig({ ...config, bankLine1: e.target.value })}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Cuenta Bancaria #2:
                </label>
                <input
                  type="text"
                  value={config.bankLine2}
                  onChange={(e) => setConfig({ ...config, bankLine2: e.target.value })}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Titular, RUC y Correo de Confirmación de Pagos:
              </label>
              <input
                type="text"
                value={config.bankHolderLine}
                onChange={(e) => setConfig({ ...config, bankHolderLine: e.target.value })}
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Título Firma Izquierda (Empresa):
                </label>
                <input
                  type="text"
                  value={config.footerPreparedByTitle}
                  onChange={(e) => setConfig({ ...config, footerPreparedByTitle: e.target.value })}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Título Firma Derecha (Cliente):
                </label>
                <input
                  type="text"
                  value={config.footerClientTitle}
                  onChange={(e) => setConfig({ ...config, footerClientTitle: e.target.value })}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                />
              </div>
            </div>
          </div>

          {/* Botones de Acción */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={handleRestoreDefaults}
              className="px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 rounded-lg inline-flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Restaurar Valores por Defecto</span>
            </button>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg inline-flex items-center gap-1.5 shadow-2xs"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Guardar Cambios</span>
              </button>
              {activeOrder && (
                <button
                  type="button"
                  onClick={handleSaveAndDownloadPdf}
                  className="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-lg inline-flex items-center gap-1.5 shadow-2xs"
                >
                  <FileDown className="w-3.5 h-3.5" />
                  <span>Guardar y Descargar PDF Ahora</span>
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
