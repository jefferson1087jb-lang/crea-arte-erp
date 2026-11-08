import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  MessageSquare,
  Send,
  Check,
  CheckCheck,
  ExternalLink,
  Search,
  Settings,
  Lock,
  DollarSign,
  FileCheck2,
  PackageCheck,
  Receipt,
  Landmark,
  Eye,
  EyeOff,
  Reply,
  ShieldAlert,
  Copy,
  Activity,
  HelpCircle,
  Bot,
  Sparkles,
  User,
  RotateCcw,
  Link2,
  CheckCircle2,
  Clock,
  MapPin,
  Layers,
  Zap,
  ChevronDown,
  ChevronUp,
  Palette,
  Printer,
  FileDown,
  FolderPlus,
  Upload,
  Trash2,
  Share2,
  RefreshCw,
  FileText,
  Tag,
  Megaphone,
  Plus,
  X,
  Maximize2,
  Minimize2,
  Smile,
  Mic,
  Square,
  Image as ImageIcon,
  Video,
  Paperclip,
  PhoneCall,
  BarChart3,
  ShoppingBag,
} from 'lucide-react';
import {
  WorkOrder,
  UserProfile,
  ChatMessage,
  ChatMediaAttachment,
  WhatsAppApiConfig,
  RoleId,
  ORDER_STAGES,
  OrderStage,
  PaymentAuditDetails,
  BANK_ACCOUNTS_CATALOG,
  CATALOG_MATERIALS,
  isDesignOnlyOrder,
  CrmTask,
  CrmTaskPriority,
  ProjectDriveFileRecord,
  ClientContact,
  CrmLeadStage,
  CRM_LEAD_STAGES,
  AVAILABLE_CLIENT_TAGS,
} from '../data/initialData';
import { copyTextToClipboardSafe } from '../utils/deliveryActPdfGenerator';
import {
  buildProformaFromWorkOrder,
  generateQuotePdf,
  formatQuoteWhatsAppText,
} from '../utils/quotePdfGenerator';
import {
  initAuth,
  googleSignIn,
  logoutGoogleDrive,
  ensureProjectDriveFolder,
  listProjectDriveFiles,
  uploadFileToProjectDriveFolder,
  deleteProjectDriveFile,
} from '../utils/googleDriveService';
import { ProformaTemplateEditorModal } from './ProformaTemplateEditorModal';

interface WhatsAppCenterModuleProps {
  orders: WorkOrder[];
  users: UserProfile[];
  messages: ChatMessage[];
  waConfig: WhatsAppApiConfig;
  currentRole: RoleId;
  currentUser: UserProfile;
  preselectedOrderId?: string | null;
  crmTasks?: CrmTask[];
  onSendMessage: (
    orderId: string,
    text: string,
    channel: 'wa_direct' | 'meta_cloud_api',
    mediaAttachment?: ChatMediaAttachment
  ) => void;
  onSendInternalNote?: (
    orderId: string,
    text: string,
    mentionedUserId?: string,
    driveFileAttachment?: ProjectDriveFileRecord,
    mentionedUserIds?: string[],
    mentionAllTeam?: boolean,
    mediaAttachment?: ChatMediaAttachment
  ) => void;
  onAssignConversationAgent?: (orderId: string, newAgentId: string, transferNote?: string) => void;
  onAddCrmTask?: (task: Omit<CrmTask, 'id' | 'createdAt' | 'status'>) => void;
  onToggleCrmTaskStatus?: (taskId: string) => void;
  onSimulateIncomingMessage: (orderId: string, text: string) => void;
  onUpdateWaConfig: (newConfig: WhatsAppApiConfig) => void;
  onMoveOrderStage: (orderId: string, targetStage: OrderStage) => void;
  onUpdateOrder?: (updated: WorkOrder) => void;
  onRegisterOrderPayment: (
    orderId: string,
    amount: number,
    method: 'Efectivo' | 'Transferencia Bancaria' | 'Tarjeta',
    auditDetails?: PaymentAuditDetails
  ) => void;
  onOpenDriveModal?: (orderId: string) => void;
  clients?: ClientContact[];
  onUpdateClient?: (client: ClientContact) => void;
  onAddClient?: (client: ClientContact) => void;
  onSimulateMetaAdLead?: (opts?: {
    headline?: string;
    profileName?: string;
    phone?: string;
    text?: string;
    sourceType?: 'ad' | 'leadgen_form';
  }) => void;
  onPreQuoteLeadWithAi?: (order: WorkOrder) => void;
  onNotify: (msg: string) => void;
}

type ChatFilter =
  | 'all'
  | 'my_assigned'
  | 'meta_ads_leads'
  | 'new_prospects'
  | 'vip_recurrent'
  | 'awaiting_approval'
  | 'pending_balance'
  | 'in_production'
  | 'ready_delivery';

type TemplateType = 'menu_bot' | 'arte' | 'avance' | 'listo' | 'saldo' | 'bancos';

export const WhatsAppCenterModule: React.FC<WhatsAppCenterModuleProps> = ({
  orders,
  users,
  messages,
  waConfig,
  currentRole,
  currentUser,
  preselectedOrderId = null,
  crmTasks = [],
  onSendMessage,
  onSendInternalNote,
  onAssignConversationAgent,
  onAddCrmTask,
  onToggleCrmTaskStatus,
  onSimulateIncomingMessage,
  onUpdateWaConfig,
  onMoveOrderStage,
  onUpdateOrder,
  onRegisterOrderPayment,
  onOpenDriveModal,
  clients = [],
  onUpdateClient,
  onAddClient,
  onSimulateMetaAdLead,
  onPreQuoteLeadWithAi,
  onNotify,
}) => {
  const [activeView, setActiveView] = useState<
    'inbox' | 'batch_broadcast' | 'bot_studio' | 'api_settings'
  >('inbox');
  const [chatFilter, setChatFilter] = useState<ChatFilter>('all');
  const [leadStageFilter, setLeadStageFilter] = useState<CrmLeadStage | 'ALL'>('ALL');
  const [inboxTagFilter, setInboxTagFilter] = useState<string>('ALL');
  const [showQuickBatchModal, setShowQuickBatchModal] = useState<boolean>(false);
  const [lastSentBatchReport, setLastSentBatchReport] = useState<{
    sentAt: string;
    count: number;
    items: { orderId: string; clientName: string; phone: string; text: string }[];
  } | null>(null);
  const [showTagSelectorPopover, setShowTagSelectorPopover] = useState<boolean>(false);
  const [customNewTagText, setCustomNewTagText] = useState<string>('');
  const [showProformaEditorModal, setShowProformaEditorModal] = useState<boolean>(false);
  const [chatLayoutMode, setChatLayoutMode] = useState<'standard' | 'wide' | 'focus'>('standard');
  const [isChatFullscreen, setIsChatFullscreen] = useState<boolean>(false);
  const [showCrmHeaderDetails, setShowCrmHeaderDetails] = useState<boolean>(false);

  // Estados para Difusión Masiva / Selección de Lotes por Etiquetas Predefinidas
  const [batchSelectedTags, setBatchSelectedTags] = useState<string[]>([]);
  const [batchStageFilter, setBatchStageFilter] = useState<CrmLeadStage | 'ALL'>('ALL');
  const [batchSegmentMode, setBatchSegmentMode] = useState<
    'ALL' | 'META_ADS' | 'NEW_PROSPECTS' | 'RECURRENT_VIP'
  >('ALL');
  const [batchSelectedOrderIds, setBatchSelectedOrderIds] = useState<string[]>([]);
  const [batchPromoMessage, setBatchPromoMessage] = useState<string>(
    '🎉 *PROMOCIÓN ESPECIAL CREA ARTE — HOLA {cliente}*\n\nDurante esta semana contamos con *20% DE DESCUENTO* en Rótulos Corpóreos 3D, Cajas de Luz LED, Viniles y Lonas Gran Formato (referencia {orden}).\n\n✅ Incluye revisión técnica de arte sin costo.\n👉 Responda *PROMO* o *COTIZAR* a este mensaje y su ejecutivo *{ejecutivo}* le atenderá de inmediato.'
  );
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedOrderId, setSelectedOrderId] = useState<string>(
    preselectedOrderId || orders[1]?.id || orders[0]?.id || '#CA-002'
  );
  const [draftText, setDraftText] = useState<string>('');
  const [simulatedClientInput, setSimulatedClientInput] = useState<string>('');
  const [showSimulatorBar, setShowSimulatorBar] = useState<boolean>(false);
  const [showQuickTemplates, setShowQuickTemplates] = useState<boolean>(false);
  const [rightPanelTab, setRightPanelTab] = useState<
    'tasks' | 'drive' | 'finance_art' | 'details'
  >('drive');
  const [showToken, setShowToken] = useState<boolean>(false);
  const [quickPayAmount, setQuickPayAmount] = useState<number>(147.5);
  const [quickPayBank, setQuickPayBank] = useState<string>(BANK_ACCOUNTS_CATALOG[0]);
  const [quickPayRef, setQuickPayRef] = useState<string>('SPI-WA-99281');
  const [quickPayDoc, setQuickPayDoc] = useState<string>('FAC-001-002-0004835');
  const [apiTestStatus, setApiTestStatus] = useState<string | null>(null);
  const [metaAppId, setMetaAppId] = useState<string>('');
  const [metaAppSecret, setMetaAppSecret] = useState<string>('');
  const [isExchangingToken, setIsExchangingToken] = useState<boolean>(false);
  const [isSendingCloud, setIsSendingCloud] = useState<boolean>(false);
  const [artworkLinkDraft, setArtworkLinkDraft] = useState<string>('');

  // CRM Multiusuario: Filtro por Agente asignado, Modo Nota Interna (@mención simple, múltiple o @TODOS) y Creador de Tareas CRM
  const [agentFilterId, setAgentFilterId] = useState<string>('ALL');
  const [composerMode, setComposerMode] = useState<'client_wa' | 'internal_note'>('client_wa');
  const [mentionedUserId, setMentionedUserId] = useState<string>(users[2]?.id || 'usr-designer');
  const [mentionedUserIds, setMentionedUserIds] = useState<string[]>([
    users[2]?.id || 'usr-designer',
  ]);
  const [notifyAllUsersInNote, setNotifyAllUsersInNote] = useState<boolean>(false);
  const [isChatTallMode, setIsChatTallMode] = useState<boolean>(false);
  const [newTaskTitle, setNewTaskTitle] = useState<string>('');
  const [newTaskAssigneeId, setNewTaskAssigneeId] = useState<string>(users[1]?.id || 'usr-sales');
  const [newTaskPriority, setNewTaskPriority] = useState<CrmTaskPriority>('Alta');
  const [newTaskDueDate, setNewTaskDueDate] = useState<string>('2026-10-17 16:00');

  // Integración Google Drive por Proyecto y Compartición en Chat Interno
  const [needsDriveAuth, setNeedsDriveAuth] = useState<boolean>(true);
  const [driveUserEmail, setDriveUserEmail] = useState<string | null>(null);
  const [isLoggingInDrive, setIsLoggingInDrive] = useState<boolean>(false);
  const [isWorkingDrive, setIsWorkingDrive] = useState<boolean>(false);
  const [driveError, setDriveError] = useState<string | null>(null);
  const [autoShareOnUpload, setAutoShareOnUpload] = useState<boolean>(true);
  const [driveShareTargetUserId, setDriveShareTargetUserId] = useState<string>(
    users[2]?.id || 'usr-designer'
  );
  const [driveFileToDelete, setDriveFileToDelete] = useState<ProjectDriveFileRecord | null>(null);
  const driveFileInputRef = useRef<HTMLInputElement | null>(null);

  // Estados de la Barra Multimedia y Herramientas de WhatsApp Business (Emojis, Audio, Imagen, Video, Archivos, Polls, Ubicación)
  const [pendingMediaAttachment, setPendingMediaAttachment] = useState<ChatMediaAttachment | null>(
    null
  );
  const [showEmojiPicker, setShowEmojiPicker] = useState<boolean>(false);
  const [activeEmojiCategory, setActiveEmojiCategory] = useState<
    'ventas' | 'taller' | 'saludos' | 'finanzas'
  >('ventas');
  const [showWaToolsMenu, setShowWaToolsMenu] = useState<boolean>(false);
  const [isRecordingAudio, setIsRecordingAudio] = useState<boolean>(false);
  const [recordingSeconds, setRecordingSeconds] = useState<number>(0);
  const [lightboxImage, setLightboxImage] = useState<{ url: string; name: string } | null>(null);

  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);
  const audioInputRef = useRef<HTMLInputElement | null>(null);
  const docInputRef = useRef<HTMLInputElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<number | null>(null);

  // Generador de onda de audio WAV real en caso de que el navegador no tenga micrófono físico conectado
  const generateSyntheticVoiceNoteWav = (durationSeconds = 4): string => {
    const sampleRate = 8000;
    const numSamples = sampleRate * durationSeconds;
    const buffer = new ArrayBuffer(44 + numSamples * 2);
    const view = new DataView(buffer);
    const writeStr = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
    };
    writeStr(0, 'RIFF');
    view.setUint32(4, 36 + numSamples * 2, true);
    writeStr(8, 'WAVE');
    writeStr(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeStr(36, 'data');
    view.setUint32(40, numSamples * 2, true);
    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      const freq = t < 1.2 ? 440 : t < 2.5 ? 523.25 : 659.25;
      const env = Math.sin((Math.PI * (i % (sampleRate / 2))) / (sampleRate / 2));
      const sample = Math.sin(2 * Math.PI * freq * t) * 0.25 * env;
      view.setInt16(44 + i * 2, sample * 32767, true);
    }
    const blob = new Blob([buffer], { type: 'audio/wav' });
    return URL.createObjectURL(blob);
  };

  const handleStartAudioRecording = async () => {
    setShowEmojiPicker(false);
    setShowWaToolsMenu(false);
    setRecordingSeconds(0);
    setIsRecordingAudio(true);

    if (recordingTimerRef.current) {
      window.clearInterval(recordingTimerRef.current);
    }
    recordingTimerRef.current = window.setInterval(() => {
      setRecordingSeconds((prev) => prev + 1);
    }, 1000);

    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const recorder = new MediaRecorder(stream);
        audioChunksRef.current = [];
        recorder.ondataavailable = (ev) => {
          if (ev.data.size > 0) {
            audioChunksRef.current.push(ev.data);
          }
        };
        mediaRecorderRef.current = recorder;
        recorder.start();
      }
    } catch {
      // Si el usuario está en una PC sin micrófono o el navegador bloquea el permiso en iframe,
      // mantenemos el cronómetro activo y al detener generamos una nota de voz WAV reproducible.
    }
  };

  const handleCancelAudioRecording = () => {
    if (recordingTimerRef.current) {
      window.clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current.stream.getTracks().forEach((t) => t.stop());
      } catch {
        // ignore
      }
    }
    mediaRecorderRef.current = null;
    audioChunksRef.current = [];
    setIsRecordingAudio(false);
    setRecordingSeconds(0);
  };

  const handleFinishAndSendAudioRecording = () => {
    if (!activeOrder) return;
    const elapsed = Math.max(1, recordingSeconds);
    if (recordingTimerRef.current) {
      window.clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    const finalizeVoiceNote = (audioUrl: string, sizeBytes?: number) => {
      const channel = waConfig.mode === 'meta_cloud_api' ? 'meta_cloud_api' : 'wa_direct';
      const voiceAttachment: ChatMediaAttachment = {
        type: 'audio',
        url: audioUrl,
        name: `Nota_de_Voz_${activeOrder.id.replace('#', '')}_${elapsed}s.wav`,
        mimeType: 'audio/wav',
        durationSec: elapsed,
        sizeBytes: sizeBytes || elapsed * 16000,
      };
      const captionText =
        draftText.trim() ||
        `🎤 *Nota de voz enviada (${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(
          elapsed % 60
        ).padStart(2, '0')})* — Asesoría sobre ${activeOrder.title}`;
      onSendMessage(activeOrder.id, captionText, channel, voiceAttachment);
      setDraftText('');
      setIsRecordingAudio(false);
      setRecordingSeconds(0);
    };

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      const rec = mediaRecorderRef.current;
      rec.onstop = () => {
        rec.stream.getTracks().forEach((t) => t.stop());
        if (audioChunksRef.current.length > 0) {
          const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          const url = URL.createObjectURL(blob);
          finalizeVoiceNote(url, blob.size);
        } else {
          finalizeVoiceNote(generateSyntheticVoiceNoteWav(Math.min(elapsed, 8)));
        }
      };
      try {
        rec.stop();
      } catch {
        finalizeVoiceNote(generateSyntheticVoiceNoteWav(Math.min(elapsed, 8)));
      }
      mediaRecorderRef.current = null;
    } else {
      finalizeVoiceNote(generateSyntheticVoiceNoteWav(Math.min(elapsed, 8)));
    }
  };

  const handleFileUploadAttachment = (
    e: React.ChangeEvent<HTMLInputElement>,
    mediaType: 'image' | 'video' | 'audio' | 'document'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const objectUrl = URL.createObjectURL(file);
    setPendingMediaAttachment({
      type: mediaType,
      url: objectUrl,
      name: file.name,
      mimeType: file.type || undefined,
      sizeBytes: file.size,
    });
    if (!draftText.trim()) {
      const defaultCaptions: Record<typeof mediaType, string> = {
        image: `🖼️ Adjunto imagen / vista previa: *${file.name}*`,
        video: `🎬 Adjunto video de muestra / avance en planta: *${file.name}*`,
        audio: `🎵 Adjunto archivo de audio: *${file.name}*`,
        document: `📎 Adjunto archivo / documento técnico: *${file.name}*`,
      };
      setDraftText(defaultCaptions[mediaType]);
    }
    e.target.value = '';
    onNotify(`Adjunto "${file.name}" listo para enviar en la conversación.`);
  };

  useEffect(() => {
    const unsub = initAuth(
      (user) => {
        setNeedsDriveAuth(false);
        setDriveUserEmail(user.email || user.displayName || 'Cuenta Google Conectada');
      },
      () => {
        setNeedsDriveAuth(true);
        setDriveUserEmail(null);
      }
    );
    return () => unsub();
  }, []);

  const chatScrollContainerRef = useRef<HTMLDivElement | null>(null);
  const chatMessagesEndRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottomOfChat = (smooth = false) => {
    const runScroll = () => {
      if (chatScrollContainerRef.current) {
        chatScrollContainerRef.current.scrollTop =
          chatScrollContainerRef.current.scrollHeight + 240;
      }
      if (chatMessagesEndRef.current) {
        chatMessagesEndRef.current.scrollIntoView({
          behavior: smooth ? 'smooth' : 'auto',
          block: 'end',
        });
      }
    };
    runScroll();
    window.requestAnimationFrame(runScroll);
    window.setTimeout(runScroll, 90);
  };

  const isAdmin = currentRole === 'admin';
  const canSeeFinancials = currentRole === 'admin' || currentRole === 'sales';

  // Devuelve el ID del agente responsable de la conversación CRM de una orden
  const getOrderCrmAgentId = (order: WorkOrder): string => {
    if (order.assignedCrmAgentId) return order.assignedCrmAgentId;
    if (
      order.stage === 'En Diseño y Arte' ||
      order.stage === 'Aprobación del Cliente'
    ) {
      return order.designerId || 'usr-designer';
    }
    return 'usr-sales';
  };

  useEffect(() => {
    if (preselectedOrderId && orders.some((o) => o.id === preselectedOrderId)) {
      setSelectedOrderId(preselectedOrderId);
      setChatFilter('all');
      setAgentFilterId('ALL');
      setSearchQuery('');
      const target = orders.find((o) => o.id === preselectedOrderId);
      if (target) {
        const pending = Math.max(0, Number((target.totalPrice - target.paidAmount).toFixed(2)));
        setQuickPayAmount(pending);
        setArtworkLinkDraft(target.artworkUrl || '');
      }
    }
  }, [preselectedOrderId, orders]);

  const getUserName = (id: string) =>
    users.find((u) => u.id === id)?.name || 'Equipo Técnico';

  // Helper para cruzar cada orden con su ficha ClientContact y clasificar Recurrente vs Nuevo Prospecto
  const getClientInfoForOrder = (order: WorkOrder) => {
    const cleanOrderPhone = (order.clientPhone || '').replace(/\D/g, '').slice(-9);
    const normOrderName = (order.clientName || '').toLowerCase().trim();

    const matchedClient = clients.find((c) => {
      const cleanCPhone = (c.phone || '').replace(/\D/g, '').slice(-9);
      return (
        (cleanOrderPhone.length >= 8 && cleanCPhone === cleanOrderPhone) ||
        c.name.toLowerCase().trim() === normOrderName
      );
    });

    const clientOrders = orders.filter((o) => {
      const cleanOPhone = (o.clientPhone || '').replace(/\D/g, '').slice(-9);
      return (
        (cleanOrderPhone.length >= 8 && cleanOPhone === cleanOrderPhone) ||
        o.clientName.toLowerCase().trim() === normOrderName
      );
    });

    const ordersCount = clientOrders.length;
    const totalHistoricalPaid = clientOrders.reduce((acc, o) => acc + (o.paidAmount || 0), 0);
    const tags = matchedClient?.tags || (ordersCount > 1 ? ['Cliente Recurrente'] : ['Nuevo Prospecto']);
    const isRecurrent =
      ordersCount > 1 ||
      totalHistoricalPaid > 0 ||
      tags.includes('Cliente VIP') ||
      tags.includes('Corporativo / Agencia') ||
      tags.includes('Cliente Recurrente');
    const adRef = order.adReferral || matchedClient?.adReferral;
    const isMetaAd = Boolean(
      order.isMetaAdLead ||
        adRef ||
        matchedClient?.originChannel === 'meta_ads_wa' ||
        matchedClient?.originChannel === 'meta_lead_form' ||
        tags.includes('Lead Meta Ads') ||
        tags.includes('Campaña Click-to-WhatsApp') ||
        tags.includes('Lead Formulario Meta')
    );
    const crmLeadStage: CrmLeadStage =
      order.crmLeadStage ||
      matchedClient?.crmLeadStage ||
      (order.paidAmount > 0
        ? 'Cliente en Producción Activa'
        : order.stage === 'Cotizado / Anticipo Pendiente'
        ? 'Lead Entrante (Meta Ads)'
        : 'En Calificación / Consultando');

    return {
      matchedClient,
      ordersCount,
      totalHistoricalPaid,
      tags,
      isRecurrent,
      adRef,
      isMetaAd,
      crmLeadStage,
    };
  };

  // Contadores rápidos para los filtros y KPIs superiores
  const filterCounts = useMemo(() => {
    const myAssigned = orders.filter(
      (o) =>
        getOrderCrmAgentId(o) === currentUser.id ||
        o.designerId === currentUser.id ||
        o.operatorId === currentUser.id ||
        o.installerId === currentUser.id
    ).length;
    const awaitingApproval = orders.filter(
      (o) => o.stage === 'Aprobación del Cliente' || (!o.artworkApproved && o.stage === 'En Diseño y Arte')
    ).length;
    const pendingBalance = orders.filter(
      (o) => Number((o.totalPrice - o.paidAmount).toFixed(2)) > 0
    ).length;
    const inProduction = orders.filter(
      (o) =>
        o.stage === 'En Diseño y Arte' ||
        o.stage === 'Aprobación del Cliente' ||
        o.stage === 'En Cola de Impresión/Corte' ||
        o.stage === 'Acabados y Armado 3D'
    ).length;
    const readyDelivery = orders.filter(
      (o) => o.stage === 'Instalación / Listo para Retiro'
    ).length;
    const metaAdsLeads = orders.filter((o) => getClientInfoForOrder(o).isMetaAd).length;
    const newProspects = orders.filter((o) => !getClientInfoForOrder(o).isRecurrent).length;
    const vipRecurrent = orders.filter((o) => getClientInfoForOrder(o).isRecurrent).length;
    const botMessagesCount = messages.filter((m) =>
      m.senderName.toLowerCase().includes('bot')
    ).length;

    return {
      all: orders.length,
      myAssigned,
      metaAdsLeads,
      newProspects,
      vipRecurrent,
      awaitingApproval,
      pendingBalance,
      inProduction,
      readyDelivery,
      botMessagesCount,
    };
  }, [orders, messages, currentUser.id, clients]);

  const filteredChatOrders = useMemo(() => {
    return orders.filter((o) => {
      const q = searchQuery.toLowerCase();
      const crmAgentName = getUserName(getOrderCrmAgentId(o)).toLowerCase();
      const info = getClientInfoForOrder(o);
      const matchesSearch =
        o.id.toLowerCase().includes(q) ||
        o.clientName.toLowerCase().includes(q) ||
        o.clientPhone.toLowerCase().includes(q) ||
        o.title.toLowerCase().includes(q) ||
        crmAgentName.includes(q) ||
        (info.adRef?.headline || '').toLowerCase().includes(q) ||
        info.tags.some((t) => t.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      if (leadStageFilter !== 'ALL' && info.crmLeadStage !== leadStageFilter) {
        return false;
      }

      if (inboxTagFilter !== 'ALL' && !info.tags.includes(inboxTagFilter)) {
        return false;
      }

      // Filtro por usuario específico asignado a la conversación
      if (agentFilterId !== 'ALL') {
        const currentAgent = getOrderCrmAgentId(o);
        if (agentFilterId === 'UNASSIGNED_OR_REPLY') {
          const orderMsgs = messages.filter((m) => m.orderId === o.id && !m.isInternalNote);
          const lastMsg = orderMsgs[orderMsgs.length - 1];
          if (lastMsg?.sender !== 'client' && !(o.unreadClientReplies && o.unreadClientReplies > 0)) {
            return false;
          }
        } else if (currentAgent !== agentFilterId) {
          return false;
        }
      }

      const pendingBalance = Number((o.totalPrice - o.paidAmount).toFixed(2));

      if (chatFilter === 'my_assigned') {
        return (
          getOrderCrmAgentId(o) === currentUser.id ||
          o.designerId === currentUser.id ||
          o.operatorId === currentUser.id ||
          o.installerId === currentUser.id
        );
      }
      if (chatFilter === 'meta_ads_leads') return info.isMetaAd;
      if (chatFilter === 'new_prospects') return !info.isRecurrent;
      if (chatFilter === 'vip_recurrent') return info.isRecurrent;
      if (chatFilter === 'awaiting_approval') {
        return (
          o.stage === 'Aprobación del Cliente' ||
          (!o.artworkApproved && o.stage === 'En Diseño y Arte')
        );
      }
      if (chatFilter === 'pending_balance') return pendingBalance > 0;
      if (chatFilter === 'in_production') {
        return (
          o.stage === 'En Diseño y Arte' ||
          o.stage === 'Aprobación del Cliente' ||
          o.stage === 'En Cola de Impresión/Corte' ||
          o.stage === 'Acabados y Armado 3D'
        );
      }
      if (chatFilter === 'ready_delivery') {
        return o.stage === 'Instalación / Listo para Retiro';
      }
      return true;
    });
  }, [orders, searchQuery, chatFilter, leadStageFilter, agentFilterId, currentUser.id, messages, clients]);

  const activeOrder = useMemo(
    () => orders.find((o) => o.id === selectedOrderId) || filteredChatOrders[0] || orders[0],
    [orders, selectedOrderId, filteredChatOrders]
  );

  useEffect(() => {
    if (activeOrder) {
      const pending = Math.max(
        0,
        Number((activeOrder.totalPrice - activeOrder.paidAmount).toFixed(2))
      );
      setQuickPayAmount(pending);
      setArtworkLinkDraft(activeOrder.artworkUrl || '');
    }
  }, [activeOrder?.id, activeOrder?.paidAmount, activeOrder?.totalPrice, activeOrder?.artworkUrl]);

  const activeThreadMessages = useMemo(() => {
    if (!activeOrder) return [];
    return messages.filter((m) => m.orderId === activeOrder.id);
  }, [messages, activeOrder]);

  // Auto-scroll garantizado hasta el final del historial cuando llega un mensaje, se cambia de orden o se amplía la ventana
  useEffect(() => {
    scrollToBottomOfChat(false);
  }, [
    activeThreadMessages.length,
    activeOrder?.id,
    activeView,
    isChatFullscreen,
    chatLayoutMode,
    isChatTallMode,
  ]);

  const buildTemplateText = (type: TemplateType): string => {
    if (!activeOrder) return '';
    const pending = Math.max(
      0,
      Number((activeOrder.totalPrice - activeOrder.paidAmount).toFixed(2))
    );
    const advance50 = Number((activeOrder.totalPrice * 0.5).toFixed(2));
    const designOnly = isDesignOnlyOrder(activeOrder);

    switch (type) {
      case 'menu_bot':
        return `🤖 *ASISTENTE AUTOMÁTICO CREA ARTE (${activeOrder.id})*\nHola *${activeOrder.clientName}*, le escribimos respecto a su orden *${activeOrder.title}*.\n\nEn cualquier momento puede responder con el *número* o *palabra clave*:\n1️⃣ *ESTADO* — Consultar etapa actual y fecha de entrega\n2️⃣ *SALDO* — Ver estado de cuenta y bancos oficiales\n3️⃣ *APROBADO* — Autorizar el diseño/arte final\n4️⃣ *CORRECCION* — Solicitar un cambio en el boceto\n5️⃣ *COMPROBANTE* — Notificar envío de transferencia\n6️⃣ *HORARIO* — Dirección del taller y horarios de retiro`;
      case 'arte':
        if (designOnly) {
          return `🎨 *CREA ARTE — APROBACIÓN DE PROPUESTA GRÁFICA (${activeOrder.id})*\nEstimado/a *${activeOrder.clientName}*, enviamos la propuesta de diseño de *${activeOrder.title}*.\n📎 Enlace / Boceto: ${activeOrder.artworkUrl || 'Adjunto en este chat'}\n👉 Responda *"APROBADO"* (o el número *3*) para liberar su paquete de archivos editables finales (AI, PDF, SVG, PNG), o escriba *"CORRECCION"* (opción *4*) indicando los ajustes requeridos.`;
        }
        return `🎨 *CREA ARTE — APROBACIÓN DE ARTE FINAL (${activeOrder.id})*\nEstimado/a *${activeOrder.clientName}*, enviamos el arte final de *${activeOrder.title}* (${activeOrder.widthM}m × ${activeOrder.heightM}m — ${activeOrder.materialName}).\n📎 Archivo: ${activeOrder.artworkUrl || 'Adjunto en este chat'}\n⚠️ *Importante:* Por favor revise textos, ortografía y medidas. Con su respuesta *"APROBADO"* (o el número *3*) nuestro Bot pasará su orden automáticamente a cola de impresión.`;
      case 'avance':
        return `⚙️ *ACTUALIZACIÓN DE AVANCE EN PLANTA (${activeOrder.id})*\nEstimado/a *${activeOrder.clientName}*, le informamos que su proyecto *${activeOrder.title}* se encuentra actualmente en la etapa: *${activeOrder.stage}*.\n📅 Entrega programada: *${activeOrder.deadline.replace('T', ' ')}*\nEscriba *1* o *ESTADO* en cualquier momento para verificar su progreso en vivo.`;
      case 'listo':
        if (designOnly) {
          return `✅ *CREA ARTE — ARCHIVOS EDITABLES LISTOS (${activeOrder.id})*\nEstimado/a *${activeOrder.clientName}*, su paquete de diseño *${activeOrder.title}* está 100% finalizado.\n• Total Orden: $${activeOrder.totalPrice.toFixed(2)}\n• Abonado: $${activeOrder.paidAmount.toFixed(2)}\n• *Saldo pendiente para envío de link definitivo:* *$${pending.toFixed(2)}*\n📎 Link de entrega: ${activeOrder.artworkUrl || 'Se habilitará tras confirmar liquidación'}`;
        }
        return `✅ *CREA ARTE — PEDIDO LISTO PARA ENTREGA (${activeOrder.id})*\nEstimado/a *${activeOrder.clientName}*, su proyecto *${activeOrder.title}* se encuentra terminado en taller.\n• Total Orden: $${activeOrder.totalPrice.toFixed(2)}\n• Abonado: $${activeOrder.paidAmount.toFixed(2)}\n• *Saldo pendiente a liquidar:* *$${pending.toFixed(2)}*\n📍 Horario de retiro/despacho: Lunes a Viernes 08:30 a 18:00, Sábados 09:00 a 13:00.`;
      case 'saldo':
        return `💳 *CREA ARTE — RECORDATORIO DE SALDO PENDIENTE (${activeOrder.id})*\nEstimado/a *${activeOrder.clientName}*, le recordamos que su orden *${activeOrder.title}* mantiene un saldo pendiente de *$${pending.toFixed(2)}* (Total: $${activeOrder.totalPrice.toFixed(2)} | Abonado: $${activeOrder.paidAmount.toFixed(2)}).\nPor favor envíenos su comprobante de pago respondiendo *5* o *COMPROBANTE* para liberar la orden.`;
      case 'bancos':
        return `🏦 *CREA ARTE — DATOS BANCARIOS OFICIALES*\nPara procesar su anticipo del 50% (*$${advance50.toFixed(2)}*) o liquidación de saldo (*$${pending.toFixed(2)}*) de la orden *${activeOrder.id}*:\n• *Banco Pichincha* — Cuenta Corriente #2100492811\n• *Banco Guayaquil* — Cuenta Corriente #0019283746\n• *Beneficiario:* Crea Arte S.A. | *RUC:* 1790088123001\n• *Correo:* cobranzas@crea-arte.ec`;
    }
  };

  const handleInsertTemplate = (type: TemplateType) => {
    const text = buildTemplateText(type);
    setDraftText(text);
    onNotify('Plantilla inteligente cargada en el editor de chat');
  };

  // Envío Seguro a través del servidor (/api/whatsapp/send) o Simulador Local
  const dispatchViaMetaCloudApi = async (phone: string, bodyText: string) => {
    const cleanRecipient = phone.replace(/[^0-9]/g, '');
    const isDemoToken = waConfig.accessToken.includes('...');

    try {
      setIsSendingCloud(true);
      const response = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: cleanRecipient,
          bodyText,
          phoneNumberId: waConfig.phoneNumberId.trim(),
          accessToken: isDemoToken ? '' : waConfig.accessToken.trim(),
        }),
      });
      const data = await response.json();
      setIsSendingCloud(false);

      if (!response.ok) {
        return {
          ok: false,
          simulated: false,
          detail: data?.error || data?.detail || `Error HTTP ${response.status}`,
        };
      }
      return {
        ok: Boolean(data.ok),
        simulated: Boolean(data.simulated),
        detail:
          data.detail ||
          `Despachado vía Servidor Meta Cloud API (ID: ${data?.messageId || 'OK'})`,
      };
    } catch (err: any) {
      setIsSendingCloud(false);
      if (isDemoToken) {
        return {
          ok: true,
          simulated: true,
          detail: 'Modo simulación local (Token de demostración activo)',
        };
      }
      return {
        ok: false,
        simulated: false,
        detail: err?.message || 'Error de red al conectar con /api/whatsapp/send',
      };
    }
  };

  const submitChatMessage = async () => {
    if (!activeOrder || (!draftText.trim() && !pendingMediaAttachment)) return;
    const textToSend =
      draftText.trim() ||
      (pendingMediaAttachment ? `📎 Adjunto: *${pendingMediaAttachment.name}*` : '');

    // Si está en modo Nota Interna / Mención a 1 usuario, varios usuarios o @TODOS del CRM
    if (composerMode === 'internal_note') {
      if (onSendInternalNote) {
        const finalTargetIds = notifyAllUsersInNote
          ? users.map((u) => u.id)
          : mentionedUserIds.length > 0
          ? mentionedUserIds
          : [mentionedUserId];
        onSendInternalNote(
          activeOrder.id,
          textToSend,
          finalTargetIds[0] || mentionedUserId,
          undefined,
          finalTargetIds,
          notifyAllUsersInNote,
          pendingMediaAttachment || undefined
        );
      }
      setDraftText('');
      setPendingMediaAttachment(null);
      setShowEmojiPicker(false);
      setShowWaToolsMenu(false);
      scrollToBottomOfChat(true);
      return;
    }

    const channel =
      waConfig.mode === 'meta_cloud_api' ? 'meta_cloud_api' : 'wa_direct';

    const attachmentToSend = pendingMediaAttachment || undefined;
    onSendMessage(activeOrder.id, textToSend, channel, attachmentToSend);
    setDraftText('');
    setPendingMediaAttachment(null);
    setShowEmojiPicker(false);
    setShowWaToolsMenu(false);
    scrollToBottomOfChat(true);

    if (channel === 'meta_cloud_api') {
      const res = await dispatchViaMetaCloudApi(activeOrder.clientPhone, textToSend);
      if (!res.ok) {
        onNotify(`Guardado en CRM · Aviso Meta API: ${res.detail}`);
      } else if (!res.simulated) {
        onNotify(res.detail);
      }
    }
  };

  const handleSendInCrm = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitChatMessage();
  };

  const handleDispatchDirectWaMe = () => {
    if (!activeOrder) return;
    const msgToSend =
      draftText.trim() ||
      buildTemplateText(
        activeOrder.stage === 'Instalación / Listo para Retiro' ? 'listo' : 'arte'
      );

    onSendMessage(activeOrder.id, msgToSend, 'wa_direct');
    setDraftText('');

    const cleanPhone = activeOrder.clientPhone.replace(/[^0-9]/g, '');
    const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msgToSend)}`;
    void copyTextToClipboardSafe(msgToSend);
    onNotify(
      `Mensaje registrado en CRM y copiado al portapapeles para ${activeOrder.clientPhone} (${waUrl.slice(0, 38)}...)`
    );
  };

  const handleTestMetaConnection = async () => {
    if (!activeOrder) return;
    setApiTestStatus('Verificando credenciales contra graph.facebook.com/v21.0...');
    const res = await dispatchViaMetaCloudApi(
      activeOrder.clientPhone,
      `Prueba de conexión ERP Crea Arte (${activeOrder.id})`
    );
    if (res.simulated) {
      setApiTestStatus(
        'Simulación lista: Reemplaza el Access Token de ejemplo por tu Token real de Meta for Developers para despachar mensajes reales en la nube.'
      );
    } else if (res.ok) {
      setApiTestStatus(`Conexión Exitosa: ${res.detail}`);
    } else {
      setApiTestStatus(`Respuesta de Meta API: ${res.detail}`);
    }
  };

  const handleSimulateClientScenario = (
    scenario: 'APROBADO' | 'CORRECCION' | 'ESTADO' | 'SALDO' | 'COMPROBANTE' | 'MENU'
  ) => {
    if (!activeOrder) return;
    const phrases: Record<typeof scenario, string> = {
      APROBADO:
        '3 — APROBADO el arte final, textos y medidas verificados. Pueden pasar a producción.',
      CORRECCION:
        '4 — Solicito CORRECCION en el diseño: por favor agrandar el logotipo principal un 15% y revisar el teléfono.',
      ESTADO:
        '1 — Hola equipo de Crea Arte, por favor me ayudan con el ESTADO y fecha de entrega de mi orden.',
      SALDO:
        '2 — Por favor envíenme el SALDO pendiente de mi orden y los números de cuenta bancaria.',
      COMPROBANTE:
        '5 — Listo, les envío el COMPROBANTE de transferencia bancaria realizada hace unos minutos.',
      MENU: 'HOLA, buenos días, necesito información de mi pedido (MENU).',
    };
    onSimulateIncomingMessage(activeOrder.id, phrases[scenario]);
  };

  const handleSendCustomSimulatedClientMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrder || !simulatedClientInput.trim()) return;
    onSimulateIncomingMessage(activeOrder.id, simulatedClientInput.trim());
    setSimulatedClientInput('');
  };

  const handleBatchCollectionReminders = () => {
    const ordersWithDebt = orders.filter(
      (o) => Number((o.totalPrice - o.paidAmount).toFixed(2)) > 0
    );
    if (ordersWithDebt.length === 0) {
      onNotify('Todas las órdenes están 100% liquidadas. No hay saldos pendientes por cobrar.');
      return;
    }
    const channel = waConfig.mode === 'meta_cloud_api' ? 'meta_cloud_api' : 'wa_direct';
    ordersWithDebt.forEach((o) => {
      const pending = Number((o.totalPrice - o.paidAmount).toFixed(2));
      const msg = `🤖 *RECORDATORIO AUTOMÁTICO DE SALDO (${o.id})*\nEstimado/a *${o.clientName}*, le recordamos que su orden *${o.title}* (Etapa: *${o.stage}*) registra un saldo pendiente de *$${pending.toFixed(2)}*.\n🏦 Cta. Cte. Banco Pichincha #2100492811 (Crea Arte S.A.). Responda *5* o envíe su comprobante por este chat.`;
      onSendMessage(o.id, msg, channel);
    });
    onNotify(
      `Autocobranza ejecutada: Se enviaron ${ordersWithDebt.length} recordatorios de cobro a todas las órdenes con saldo pendiente.`
    );
  };

  const handleBatchArtApprovalReminders = () => {
    const ordersWaitingArt = orders.filter(
      (o) =>
        o.stage === 'Aprobación del Cliente' ||
        (!o.artworkApproved && o.stage === 'En Diseño y Arte')
    );
    if (ordersWaitingArt.length === 0) {
      onNotify('No hay órdenes esperando aprobación de arte en este momento.');
      return;
    }
    const channel = waConfig.mode === 'meta_cloud_api' ? 'meta_cloud_api' : 'wa_direct';
    ordersWaitingArt.forEach((o) => {
      const msg = `🤖 *RECORDATORIO DE APROBACIÓN DE ARTE (${o.id})*\nEstimado/a *${o.clientName}*, tenemos lista la propuesta gráfica de *${o.title}*.\n👉 Responda *"APROBADO"* (o el número *3*) para autorizar e iniciar producción en taller, o *"CORRECCION"* (opción *4*) si requiere algún cambio.`;
      onSendMessage(o.id, msg, channel);
    });
    onNotify(
      `Se enviaron ${ordersWaitingArt.length} solicitudes de aprobación de arte por WhatsApp.`
    );
  };

  const handleSaveArtworkUrl = () => {
    if (!activeOrder || !onUpdateOrder) return;
    onUpdateOrder({
      ...activeOrder,
      artworkUrl: artworkLinkDraft.trim(),
    });
    onNotify(`Enlace de arte actualizado en la orden ${activeOrder.id}`);
  };

  const handleToggleArtworkApproved = () => {
    if (!activeOrder || !onUpdateOrder) return;
    const nextState = !activeOrder.artworkApproved;
    onUpdateOrder({
      ...activeOrder,
      artworkApproved: nextState,
    });
    onNotify(
      nextState
        ? `Arte de ${activeOrder.id} marcado como APROBADO`
        : `Arte de ${activeOrder.id} marcado como Pendiente de Aprobación`
    );
  };

  // ============================================================================
  // HANDLERS DE GOOGLE DRIVE POR PROYECTO Y COMPARTICIÓN EN CHAT INTERNO
  // ============================================================================
  const handleGoogleDriveLogin = async () => {
    setIsLoggingInDrive(true);
    setDriveError(null);
    try {
      const result = await googleSignIn();
      if (result) {
        setNeedsDriveAuth(false);
        setDriveUserEmail(result.user.email || result.user.displayName || 'Google Drive Activo');
        onNotify(`Conectado a Google Drive como ${result.user.email || result.user.displayName}`);
      }
    } catch (err: any) {
      setDriveError(err?.message || 'No se pudo iniciar sesión con Google.');
    } finally {
      setIsLoggingInDrive(false);
    }
  };

  const handleCreateOrSyncProjectDriveFolder = async () => {
    if (!activeOrder || !onUpdateOrder) return;
    setIsWorkingDrive(true);
    setDriveError(null);
    try {
      const folder = await ensureProjectDriveFolder(
        activeOrder.id,
        activeOrder.clientName,
        activeOrder.title
      );
      const files = await listProjectDriveFiles(folder.folderId);
      const mappedFiles: ProjectDriveFileRecord[] = files.map((f) => {
        const isoTime = f.createdTime || new Date().toISOString();
        return {
          id: f.id,
          name: f.name,
          mimeType: f.mimeType,
          sizeBytes: f.size ? Number(f.size) : undefined,
          webViewLink: f.webViewLink,
          uploadedBy: f.uploadedBy || currentUser.name,
          createdTime: isoTime,
          uploadedAt: isoTime.slice(0, 16).replace('T', ' '),
        };
      });

      onUpdateOrder({
        ...activeOrder,
        driveFolderId: folder.folderId,
        driveFolderName: folder.folderName,
        driveFolderUrl: folder.webViewLink,
        driveFiles: mappedFiles,
      });

      onNotify(
        `Carpeta de Google Drive sincronizada para ${activeOrder.id} (${mappedFiles.length} archivo(s))`
      );
    } catch (err: any) {
      if (err?.message === 'NEEDS_AUTH') {
        setNeedsDriveAuth(true);
      } else {
        setDriveError(err?.message || 'Error al sincronizar la carpeta en Google Drive.');
      }
    } finally {
      setIsWorkingDrive(false);
    }
  };

  const handleShareDriveFileInInternalChat = (
    fileRec: ProjectDriveFileRecord,
    targetEmployeeId?: string
  ) => {
    if (!activeOrder || !onSendInternalNote) return;
    const recipientId = targetEmployeeId || driveShareTargetUserId;
    const recipientName = getUserName(recipientId);
    const noteText = `📁 Compartió archivo de diseño desde la carpeta de Google Drive del proyecto (${activeOrder.id}): "${fileRec.name}" — Enlace Drive: ${fileRec.webViewLink}`;
    onSendInternalNote(activeOrder.id, noteText, recipientId, fileRec);
    onNotify(`Archivo "${fileRec.name}" compartido en el chat interno con @${recipientName}`);
  };

  const handleUploadDesignFileToDrive = async (file: File) => {
    if (!activeOrder || !onUpdateOrder) return;
    setIsWorkingDrive(true);
    setDriveError(null);
    try {
      let folderId = activeOrder.driveFolderId;
      let folderName = activeOrder.driveFolderName;
      let folderUrl = activeOrder.driveFolderUrl;

      if (!folderId) {
        const folder = await ensureProjectDriveFolder(
          activeOrder.id,
          activeOrder.clientName,
          activeOrder.title
        );
        folderId = folder.folderId;
        folderName = folder.folderName;
        folderUrl = folder.webViewLink;
      }

      const uploaded = await uploadFileToProjectDriveFolder(
        folderId,
        file,
        currentUser.name
      );

      const isoNow = uploaded.createdTime || new Date().toISOString();
      const newRecord: ProjectDriveFileRecord = {
        id: uploaded.id,
        name: uploaded.name,
        mimeType: uploaded.mimeType,
        sizeBytes: uploaded.size ? Number(uploaded.size) : file.size,
        webViewLink: uploaded.webViewLink,
        uploadedBy: currentUser.name,
        createdTime: isoNow,
        uploadedAt: isoNow.slice(0, 16).replace('T', ' '),
      };

      const updatedFiles = [newRecord, ...(activeOrder.driveFiles || [])];

      onUpdateOrder({
        ...activeOrder,
        driveFolderId: folderId,
        driveFolderName: folderName,
        driveFolderUrl: folderUrl,
        driveFiles: updatedFiles,
        artworkUrl: activeOrder.artworkUrl || uploaded.webViewLink,
      });

      if (!artworkLinkDraft) {
        setArtworkLinkDraft(uploaded.webViewLink);
      }

      if (autoShareOnUpload && onSendInternalNote) {
        handleShareDriveFileInInternalChat(newRecord, driveShareTargetUserId);
      } else {
        onNotify(
          `Archivo "${uploaded.name}" subido a la carpeta de Google Drive de ${activeOrder.id}`
        );
      }
    } catch (err: any) {
      if (err?.message === 'NEEDS_AUTH') {
        setNeedsDriveAuth(true);
      } else {
        setDriveError(err?.message || 'Error al subir el archivo a Google Drive.');
      }
    } finally {
      setIsWorkingDrive(false);
    }
  };

  const handleConfirmDeleteDriveFile = async () => {
    if (!activeOrder || !onUpdateOrder || !driveFileToDelete) return;
    setIsWorkingDrive(true);
    setDriveError(null);
    try {
      await deleteProjectDriveFile(driveFileToDelete.id);
      const remaining = (activeOrder.driveFiles || []).filter(
        (f) => f.id !== driveFileToDelete.id
      );
      onUpdateOrder({
        ...activeOrder,
        driveFiles: remaining,
      });
      onNotify(`Archivo "${driveFileToDelete.name}" eliminado de Google Drive.`);
      setDriveFileToDelete(null);
    } catch (err: any) {
      if (err?.message === 'NEEDS_AUTH') {
        setNeedsDriveAuth(true);
      } else {
        setDriveError(err?.message || 'Error al eliminar el archivo de Google Drive.');
      }
    } finally {
      setIsWorkingDrive(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Encabezado Principal + Navegación de 3 Vistas */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3.5">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
              Centro de Mensajería WhatsApp & Bot Inteligente
            </h2>
            <span className="px-2 py-0.5 text-[11px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded">
              {waConfig.autoProcessClientKeywords !== false ? '🤖 Bot 24/7 Activo' : 'Bot en Pausa'}
            </span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
            Bandeja Multichat CRM, Bot con menú interactivo (1 al 6), simulador de cliente en vivo y 6 reglas conectadas al Kanban.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onSimulateMetaAdLead && (
            <button
              type="button"
              onClick={() => onSimulateMetaAdLead()}
              className="px-3 py-1.5 text-xs font-bold bg-fuchsia-600 hover:bg-fuchsia-500 text-white rounded-lg shadow-2xs transition-all duration-200 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
              title="Simular la llegada de un nuevo prospecto desde una campaña de Meta Ads (Click-to-WhatsApp)"
            >
              <Megaphone className="w-3.5 h-3.5" />
              <span>📢 Simular Lead Meta Ads</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleBatchArtApprovalReminders}
            className="px-3 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg shadow-2xs transition-all duration-200 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
            title="Enviar recordatorio de aprobación de arte a órdenes en revisión"
          >
            <FileCheck2 className="w-3.5 h-3.5" />
            <span>Recordar Aprobación ({filterCounts.awaitingApproval})</span>
          </button>

          {canSeeFinancials && (
            <button
              type="button"
              onClick={handleBatchCollectionReminders}
              className="px-3 py-1.5 text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white rounded-lg shadow-2xs transition-all duration-200 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
              title="Enviar recordatorio automático a todos los clientes con saldo pendiente"
            >
              <DollarSign className="w-3.5 h-3.5" />
              <span>Autocobranza Masiva ({filterCounts.pendingBalance})</span>
            </button>
          )}

          {/* Selector de 4 Vistas */}
          <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setActiveView('inbox')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all duration-200 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                activeView === 'inbox'
                  ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                  : 'text-slate-700 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>1. Bandeja Chat</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveView('batch_broadcast')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all duration-200 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                activeView === 'batch_broadcast'
                  ? 'bg-white dark:bg-slate-800 text-fuchsia-600 dark:text-fuchsia-400 shadow-2xs'
                  : 'text-slate-700 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Megaphone className="w-3.5 h-3.5" />
              <span>2. Difusión por Lotes / Etiquetas</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveView('bot_studio')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all duration-200 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                activeView === 'bot_studio'
                  ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                  : 'text-slate-700 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Bot className="w-3.5 h-3.5" />
              <span>3. Estudio del Bot (1-6)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (!isAdmin) {
                  onNotify(
                    'Cambia al perfil "Administrador / Gerente" arriba para editar credenciales de Meta Cloud API.'
                  );
                  return;
                }
                setActiveView('api_settings');
              }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all duration-200 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                activeView === 'api_settings'
                  ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-2xs'
                  : 'text-slate-700 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {isAdmin ? (
                <Settings className="w-3.5 h-3.5" />
              ) : (
                <Lock className="w-3.5 h-3.5 text-amber-500" />
              )}
              <span>4. API Meta</span>
            </button>
          </div>
        </div>
      </div>

      {/* VISTA 1: BANDEJA MULTICHAT AMPLIA Y ORGANIZADA */}
      {activeView === 'inbox' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 items-stretch bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl overflow-hidden divide-y lg:divide-y-0 lg:divide-x divide-slate-200/80 dark:divide-slate-800 shadow-xs">
          {/* PANEL IZQUIERDO: LISTA DE CHATS Y FILTROS PRINCIPALES (3 COLUMNAS, OCULTO EN MODO FOCUS) */}
          <div
            className={`${
              chatLayoutMode === 'focus' ? 'hidden' : 'lg:col-span-3 flex'
            } flex-col max-h-[420px] ${
              isChatTallMode
                ? 'lg:h-[1260px] lg:max-h-[1260px]'
                : 'lg:h-[calc(100vh-110px)] lg:min-h-[780px] lg:max-h-[1040px]'
            } overflow-hidden`}
          >
            <div className="p-3.5 border-b border-slate-200 dark:border-slate-800 space-y-3 bg-slate-50 dark:bg-slate-950/60">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar cliente, #CA-001 o teléfono..."
                  className="w-full pl-9 pr-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              {/* Pestañas principales de filtro de bandeja + Embudo Meta Ads y Segmentación */}
              <div className="grid grid-cols-2 gap-1.5">
                {(
                  [
                    { id: 'all', label: `Todos (${filterCounts.all})` },
                    { id: 'my_assigned', label: `👤 Mis Chats (${filterCounts.myAssigned})` },
                    { id: 'meta_ads_leads', label: `📢 Meta Ads (${filterCounts.metaAdsLeads})` },
                    { id: 'new_prospects', label: `🆕 Prospectos (${filterCounts.newProspects})` },
                    { id: 'vip_recurrent', label: `⭐ Recurrentes (${filterCounts.vipRecurrent})` },
                    { id: 'awaiting_approval', label: `🎨 Arte (${filterCounts.awaitingApproval})` },
                    { id: 'pending_balance', label: `💳 Saldo (${filterCounts.pendingBalance})` },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setChatFilter(tab.id)}
                    className={`px-2 py-1.5 text-[11px] font-semibold rounded-lg transition-all duration-200 text-center truncate ${
                      chatFilter === tab.id
                        ? 'bg-indigo-600 text-white shadow-2xs'
                        : 'bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Filtro por Etapa de Mensaje CRM (Embudo) */}
              <div className="grid grid-cols-1 gap-1.5">
                <select
                  value={leadStageFilter}
                  onChange={(e) => setLeadStageFilter(e.target.value as CrmLeadStage | 'ALL')}
                  className="w-full px-2.5 py-1.5 text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200"
                >
                  <option value="ALL">📊 Etapa Embudo: Todas las Etapas</option>
                  {CRM_LEAD_STAGES.map((stage) => (
                    <option key={stage} value={stage}>
                      🎯 {stage}
                    </option>
                  ))}
                </select>

                {/* Filtro por Etiqueta Predefinida en Bandeja */}
                <select
                  value={inboxTagFilter}
                  onChange={(e) => setInboxTagFilter(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200"
                >
                  <option value="ALL">🏷️ Etiqueta: Todas las Etiquetas</option>
                  {AVAILABLE_CLIENT_TAGS.map((tag) => (
                    <option key={tag} value={tag}>
                      🏷️ {tag}
                    </option>
                  ))}
                </select>

                {/* Selector de Agente CRM asignado */}
                <select
                  value={agentFilterId}
                  onChange={(e) => setAgentFilterId(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200"
                >
                  <option value="ALL">👥 Responsable: Todos los Usuarios</option>
                  <option value="UNASSIGNED_OR_REPLY">🔔 Con Respuesta por Atender</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      👤 Chats de: {u.name} ({u.department})
                    </option>
                  ))}
                </select>
              </div>

              {/* BOTÓN DIRECTO PARA ENVIAR PROMOCIÓN / MENSAJE A TODO EL LOTE FILTRADO */}
              <div className="pt-1 space-y-1.5">
                <button
                  type="button"
                  disabled={filteredChatOrders.length === 0}
                  onClick={() => {
                    setBatchSelectedOrderIds(filteredChatOrders.map((o) => o.id));
                    setLastSentBatchReport(null);
                    setShowQuickBatchModal(true);
                  }}
                  className="w-full py-2 px-3 text-xs font-bold bg-fuchsia-600 hover:bg-fuchsia-500 disabled:opacity-40 text-white rounded-lg shadow-2xs inline-flex items-center justify-center gap-1.5 transition-all"
                >
                  <Megaphone className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    🚀 Enviar Promo a este Lote Completo ({filteredChatOrders.length})
                  </span>
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-slate-200/70 dark:divide-slate-800/80">
              {filteredChatOrders.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400">
                  No hay conversaciones que coincidan con este filtro.
                </div>
              ) : (
                filteredChatOrders.map((order) => {
                  const orderMsgs = messages.filter((m) => m.orderId === order.id);
                  const lastMsg = orderMsgs[orderMsgs.length - 1];
                  const pending = Math.max(
                    0,
                    Number((order.totalPrice - order.paidAmount).toFixed(2))
                  );
                  const isSelected = activeOrder?.id === order.id;
                  const isLastFromBot = lastMsg?.senderName.toLowerCase().includes('bot');
                  const assignedAgentId = getOrderCrmAgentId(order);
                  const assignedAgentName = getUserName(assignedAgentId).split(' ').slice(0, 2).join(' ');
                  const awaitingReply =
                    (lastMsg && lastMsg.sender === 'client') ||
                    (order.unreadClientReplies && order.unreadClientReplies > 0);
                  const pendingOrderTasks = crmTasks.filter(
                    (t) => t.orderId === order.id && t.status === 'pending'
                  ).length;
                  const clientInfo = getClientInfoForOrder(order);

                  return (
                    <button
                      key={order.id}
                      type="button"
                      onClick={() => {
                        setSelectedOrderId(order.id);
                        setQuickPayAmount(pending);
                        if (order.unreadClientReplies && order.unreadClientReplies > 0 && onUpdateOrder) {
                          onUpdateOrder({ ...order, unreadClientReplies: 0 });
                        }
                      }}
                      className={`w-full p-3.5 text-left transition-colors block space-y-1.5 ${
                        isSelected
                          ? 'bg-blue-50/90 dark:bg-blue-950/40'
                          : awaitingReply
                          ? 'bg-amber-50/40 dark:bg-amber-950/15 hover:bg-amber-50/70'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs font-mono">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-blue-600 dark:text-blue-400">
                            {order.id}
                          </span>
                          {clientInfo.isRecurrent ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-sans font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300/60 dark:border-amber-800">
                              ⭐ Recurrente ({clientInfo.ordersCount})
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-sans font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300/60 dark:border-emerald-800">
                              🆕 Nuevo Prospecto
                            </span>
                          )}
                          {awaitingReply && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-sans font-bold bg-rose-600 text-white">
                              🔔 Por responder
                            </span>
                          )}
                        </div>
                        <span className="text-slate-500 dark:text-slate-400 shrink-0">
                          {lastMsg ? lastMsg.timestamp.split(' ')[1] || lastMsg.timestamp : 'Nuevo'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-bold text-slate-900 dark:text-white truncate">
                          {order.clientName}
                        </div>
                        {pendingOrderTasks > 0 && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300 shrink-0">
                            📌 {pendingOrderTasks}
                          </span>
                        )}
                      </div>

                      {/* Badge de Campaña Meta Ads y Etapa de Mensaje CRM */}
                      <div className="flex flex-wrap items-center gap-1">
                        {clientInfo.isMetaAd && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-950/80 dark:text-fuchsia-300 border border-fuchsia-300/60 dark:border-fuchsia-800 truncate max-w-full">
                            📢 Meta Ads: {clientInfo.adRef?.headline || 'Campaña Publicitaria'}
                          </span>
                        )}
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200/70 dark:border-indigo-800/70 truncate">
                          🎯 {clientInfo.crmLeadStage}
                        </span>
                      </div>

                      <div className="text-xs text-slate-600 dark:text-slate-400 truncate flex items-center gap-1.5">
                        {lastMsg ? (
                          <>
                            <span className="font-semibold shrink-0">
                              {lastMsg.isInternalNote
                                ? '🔒 Nota:'
                                : lastMsg.sender === 'client'
                                ? '💬 Cliente:'
                                : isLastFromBot
                                ? '🤖 Bot:'
                                : '👤 Tú:'}
                            </span>
                            <span className="truncate">{lastMsg.text.replace(/\*/g, '')}</span>
                          </>
                        ) : (
                          <span className="truncate">{order.title}</span>
                        )}
                      </div>

                      <div className="flex items-center justify-between text-xs font-mono pt-1 border-t border-slate-100 dark:border-slate-800/60">
                        <span
                          className={`truncate max-w-[150px] font-sans font-semibold ${
                            assignedAgentId === currentUser.id
                              ? 'text-blue-700 dark:text-blue-400'
                              : 'text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          👤 {assignedAgentName}
                        </span>
                        {pending > 0 ? (
                          <span className="text-amber-700 dark:text-amber-400 font-bold">
                            Debe: ${pending.toFixed(2)}
                          </span>
                        ) : order.totalPrice > 0 ? (
                          <span className="text-emerald-700 dark:text-emerald-400 font-bold">
                            ✓ Pagado
                          </span>
                        ) : (
                          <span className="text-fuchsia-700 dark:text-fuchsia-400 font-bold">
                            Por Cotizar
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* PANEL CENTRAL: CONVERSACIÓN AMPLIA, EXPANDIBLE Y CON DESPLAZAMIENTO COMPLETO HASTA EL FINAL */}
          <div
            className={
              isChatFullscreen
                ? 'fixed inset-2 sm:inset-4 z-50 flex flex-col bg-slate-100 dark:bg-slate-950 rounded-2xl border-2 border-indigo-500 shadow-2xl overflow-hidden'
                : `${
                    chatLayoutMode === 'focus'
                      ? 'lg:col-span-12'
                      : chatLayoutMode === 'wide'
                      ? 'lg:col-span-9'
                      : 'lg:col-span-5'
                  } flex flex-col ${
                    isChatTallMode
                      ? 'h-[1120px] lg:h-[1260px]'
                      : 'h-[760px] sm:h-[820px] lg:h-[calc(100vh-110px)] lg:min-h-[780px] lg:max-h-[1040px]'
                  } overflow-hidden bg-slate-100/70 dark:bg-slate-950/60`
            }
          >
            {activeOrder ? (
              <>
                {/* Cabecera del Chat con Botones de Ampliación / Pantalla Completa */}
                <div className="px-4 py-2.5 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 space-y-2 shrink-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0 flex items-center gap-2 flex-wrap">
                      {(isChatFullscreen || chatLayoutMode === 'focus') && (
                        <select
                          value={activeOrder.id}
                          onChange={(e) => setSelectedOrderId(e.target.value)}
                          className="px-2.5 py-1 text-xs font-bold bg-indigo-50 dark:bg-indigo-950 border border-indigo-300 dark:border-indigo-700 rounded-lg text-indigo-900 dark:text-indigo-200"
                          title="Cambiar rápidamente de cliente sin salir de la vista ampliada"
                        >
                          {filteredChatOrders.map((ord) => (
                            <option key={ord.id} value={ord.id}>
                              {ord.id} — {ord.clientName}
                            </option>
                          ))}
                        </select>
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400">
                            {activeOrder.id}
                          </span>
                          <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate">
                            {activeOrder.clientName}
                          </h3>
                        </div>
                        <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate">
                          {activeOrder.clientPhone} · {activeOrder.title}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                      {/* BOTÓN 1: AMPLIAR ANCHO EN PANTALLA (OCULTAR PANELES LATERALES) */}
                      {!isChatFullscreen && (
                        <button
                          type="button"
                          onClick={() =>
                            setChatLayoutMode((prev) =>
                              prev === 'standard'
                                ? 'wide'
                                : prev === 'wide'
                                ? 'focus'
                                : 'standard'
                            )
                          }
                          className={`px-2.5 py-1.5 text-xs font-bold rounded-lg border inline-flex items-center gap-1.5 transition-colors ${
                            chatLayoutMode !== 'standard'
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                              : 'bg-indigo-50 dark:bg-indigo-950/70 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'
                          }`}
                          title="Alternar ancho del chat: Normal (3 paneles) → Amplio (sin panel derecho) → 100% Ancho (solo conversación)"
                        >
                          <Maximize2 className="w-3.5 h-3.5" />
                          <span>
                            {chatLayoutMode === 'standard'
                              ? '↔️ Agrandar Chat'
                              : chatLayoutMode === 'wide'
                              ? '⬛ Ancho 100%'
                              : '↩️ Ver 3 Paneles'}
                          </span>
                        </button>
                      )}

                      {/* BOTÓN 1B: AMPLIAR ALTO VERTICAL DE LA VENTANA DE CONVERSACIÓN */}
                      {!isChatFullscreen && (
                        <button
                          type="button"
                          onClick={() => setIsChatTallMode((prev) => !prev)}
                          className={`px-2.5 py-1.5 text-xs font-bold rounded-lg border inline-flex items-center gap-1 transition-colors ${
                            isChatTallMode
                              ? 'bg-purple-600 text-white border-purple-600 shadow-2xs'
                              : 'bg-purple-50 dark:bg-purple-950/70 hover:bg-purple-100 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800'
                          }`}
                          title="Estirar hacia abajo la altura de la ventana de conversación para ver más historial sin recortes"
                        >
                          <span>{isChatTallMode ? '↕️ Alto Normal' : '↕️ Ampliar Alto'}</span>
                        </button>
                      )}

                      {/* BOTÓN 1C: IR DIRECTO AL FINAL DE LA CONVERSACIÓN */}
                      <button
                        type="button"
                        onClick={() => scrollToBottomOfChat(true)}
                        className="px-2 py-1.5 text-xs font-bold rounded-lg border bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700 inline-flex items-center gap-1 transition-colors"
                        title="Desplazar inmediatamente hasta el último mensaje abajo al final"
                      >
                        <ChevronDown className="w-3.5 h-3.5 text-emerald-600" />
                        <span>⬇ Ir al Final</span>
                      </button>

                      {/* BOTÓN 2: PANTALLA COMPLETA DE LA CONVERSACIÓN */}
                      <button
                        type="button"
                        onClick={() => setIsChatFullscreen((prev) => !prev)}
                        className={`px-2.5 py-1.5 text-xs font-bold rounded-lg border inline-flex items-center gap-1.5 transition-colors ${
                          isChatFullscreen
                            ? 'bg-rose-600 hover:bg-rose-500 text-white border-rose-600 shadow-sm'
                            : 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-600 shadow-2xs'
                        }`}
                        title={
                          isChatFullscreen
                            ? 'Salir de Pantalla Completa'
                            : 'Abrir esta conversación en Pantalla Completa'
                        }
                      >
                        {isChatFullscreen ? (
                          <>
                            <Minimize2 className="w-3.5 h-3.5" />
                            <span>Salir Pantalla Completa</span>
                          </>
                        ) : (
                          <>
                            <Maximize2 className="w-3.5 h-3.5" />
                            <span>⛶ Pantalla Completa</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setRightPanelTab('drive');
                          if (onOpenDriveModal) {
                            onOpenDriveModal(activeOrder.id);
                          }
                        }}
                        className="px-2.5 py-1.5 text-xs font-bold rounded-lg border bg-blue-600 hover:bg-blue-700 text-white border-blue-600 inline-flex items-center gap-1 transition-colors shadow-2xs"
                        title="Abrir Carpeta Google Drive del Proyecto"
                      >
                        <FolderPlus className="w-3.5 h-3.5" />
                        <span>
                          📁 Drive
                          {(activeOrder.driveFiles || []).length > 0
                            ? ` (${(activeOrder.driveFiles || []).length})`
                            : ''}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          const proformaData = buildProformaFromWorkOrder(
                            activeOrder,
                            currentUser.name
                          );
                          const { fileName } = generateQuotePdf(proformaData, {
                            download: true,
                          });
                          const proformaText = formatQuoteWhatsAppText(proformaData);
                          navigator.clipboard.writeText(proformaText);
                          onSendMessage(
                            activeOrder.id,
                            `${proformaText}\n\n📄 *Archivo PDF generado y descargado:* \`${fileName}\``,
                            waConfig.mode === 'meta_cloud_api' ? 'meta_cloud_api' : 'wa_direct'
                          );
                          onNotify(
                            `PDF "${fileName}" descargado y Proforma enviada al chat de ${activeOrder.clientName}`
                          );
                        }}
                        className="px-2.5 py-1.5 text-xs font-bold rounded-lg border bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800 inline-flex items-center gap-1 transition-colors"
                        title="Descargar Proforma Oficial en PDF y enviarla a este chat de WhatsApp"
                      >
                        <FileDown className="w-3.5 h-3.5" />
                        <span>PDF Proforma</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setShowProformaEditorModal(true)}
                        className="px-2 py-1.5 text-xs font-semibold rounded-lg border bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 inline-flex items-center gap-1 transition-colors"
                        title="Editar encabezado corporativo, cuentas bancarias, condiciones y datos de la Proforma"
                      >
                        <Settings className="w-3.5 h-3.5 text-blue-600" />
                        <span>Editar Proforma</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setShowCrmHeaderDetails((prev) => !prev)}
                        className={`px-2 py-1.5 text-xs font-semibold rounded-lg border inline-flex items-center gap-1 transition-colors ${
                          showCrmHeaderDetails
                            ? 'bg-slate-800 text-white border-slate-700'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                        }`}
                        title="Mostrar u ocultar etiquetas, etapa del embudo y origen Meta Ads para ganar más espacio vertical en el chat"
                      >
                        <Tag className="w-3.5 h-3.5" />
                        <span>{showCrmHeaderDetails ? '▲ Ocultar Detalles' : '▼ Etiquetas / Embudo'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setShowSimulatorBar(!showSimulatorBar)}
                        className={`px-2 py-1.5 text-xs font-semibold rounded-lg border inline-flex items-center gap-1 transition-colors ${
                          showSimulatorBar
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-200'
                        }`}
                        title="Probar el Bot simulando que el cliente escribe"
                      >
                        <Bot className="w-3.5 h-3.5" />
                        <span>Bot</span>
                      </button>
                    </div>
                  </div>

                  {/* Barra rápida para Asignar / Transferir esta conversación + Selector de Etapa CRM */}
                  {(() => {
                    const activeClientInfo = getClientInfoForOrder(activeOrder);
                    const handleChangeLeadStage = (newStage: CrmLeadStage) => {
                      if (onUpdateOrder) {
                        onUpdateOrder({
                          ...activeOrder,
                          crmLeadStage: newStage,
                        });
                      }
                      if (activeClientInfo.matchedClient && onUpdateClient) {
                        onUpdateClient({
                          ...activeClientInfo.matchedClient,
                          crmLeadStage: newStage,
                        });
                      }
                      onNotify(`Etapa CRM de ${activeOrder.clientName} actualizada a "${newStage}"`);
                    };

                    const handleToggleClientTag = (tagToToggle: string) => {
                      const existingClient = activeClientInfo.matchedClient;
                      if (existingClient && onUpdateClient) {
                        const hasTag = existingClient.tags.includes(tagToToggle);
                        const nextTags = hasTag
                          ? existingClient.tags.filter((t) => t !== tagToToggle)
                          : [...existingClient.tags, tagToToggle];
                        onUpdateClient({
                          ...existingClient,
                          tags: nextTags.length > 0 ? nextTags : ['Nuevo Prospecto'],
                        });
                        onNotify(
                          hasTag
                            ? `Etiqueta "${tagToToggle}" quitada de ${existingClient.name}`
                            : `Etiqueta "${tagToToggle}" asignada a ${existingClient.name}`
                        );
                      } else if (!existingClient && onAddClient) {
                        const newCli: ClientContact = {
                          id: `cli-${Date.now()}`,
                          name: activeOrder.clientName,
                          ruc: '9999999999',
                          phone: activeOrder.clientPhone,
                          email: 'contacto@cliente.ec',
                          cityAddress: 'Por confirmar',
                          tags: [tagToToggle],
                          notes: `Creado desde WhatsApp (${activeOrder.id})`,
                          createdAt: new Date().toISOString().slice(0, 10),
                          assignedExecutiveId: getOrderCrmAgentId(activeOrder),
                          crmLeadStage: activeClientInfo.crmLeadStage,
                          adReferral: activeOrder.adReferral,
                        };
                        onAddClient(newCli);
                        onNotify(`Cliente ${newCli.name} registrado con etiqueta "${tagToToggle}"`);
                      }
                    };

                    return showCrmHeaderDetails ? (
                      <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800/80 text-xs">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-slate-600 dark:text-slate-400">
                              📲 Agente:
                            </span>
                            <select
                              value={getOrderCrmAgentId(activeOrder)}
                              onChange={(e) => {
                                const newAgentId = e.target.value;
                                if (onAssignConversationAgent) {
                                  onAssignConversationAgent(activeOrder.id, newAgentId);
                                } else if (onUpdateOrder) {
                                  onUpdateOrder({
                                    ...activeOrder,
                                    assignedCrmAgentId: newAgentId,
                                  });
                                  onNotify(
                                    `Conversación ${activeOrder.id} asignada a ${getUserName(newAgentId)}`
                                  );
                                }
                              }}
                              className="px-2 py-1 text-xs font-semibold bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 rounded-md text-blue-800 dark:text-blue-200"
                            >
                              {users.map((u) => (
                                <option key={u.id} value={u.id}>
                                  {u.name} ({u.department})
                                </option>
                              ))}
                            </select>

                            <span className="font-semibold text-slate-600 dark:text-slate-400 ml-1">
                              🎯 Etapa Embudo:
                            </span>
                            <select
                              value={activeClientInfo.crmLeadStage}
                              onChange={(e) => handleChangeLeadStage(e.target.value as CrmLeadStage)}
                              className="px-2 py-1 text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 rounded-md text-indigo-800 dark:text-indigo-200"
                            >
                              {CRM_LEAD_STAGES.map((st) => (
                                <option key={st} value={st}>
                                  {st}
                                </option>
                              ))}
                            </select>
                          </div>

                          {getOrderCrmAgentId(activeOrder) !== currentUser.id && (
                            <button
                              type="button"
                              onClick={() => {
                                if (onAssignConversationAgent) {
                                  onAssignConversationAgent(activeOrder.id, currentUser.id);
                                } else if (onUpdateOrder) {
                                  onUpdateOrder({
                                    ...activeOrder,
                                    assignedCrmAgentId: currentUser.id,
                                  });
                                }
                              }}
                              className="px-2.5 py-1 text-xs font-bold bg-slate-900 dark:bg-blue-600 text-white rounded-md hover:opacity-90"
                            >
                              Tomar este Chat
                            </button>
                          )}
                        </div>

                        {/* Fila de Clasificación (Recurrente vs Nuevo) + Etiquetas de Cliente en 1 clic */}
                        <div className="flex flex-wrap items-center gap-1.5">
                          {activeClientInfo.isRecurrent ? (
                            <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                              ⭐ Cliente Recurrente ({activeClientInfo.ordersCount} pedidos)
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                              🆕 Nuevo Prospecto
                            </span>
                          )}

                          {activeClientInfo.tags.map((tag) => (
                            <button
                              key={tag}
                              type="button"
                              onClick={() => handleToggleClientTag(tag)}
                              title="Clic para quitar esta etiqueta"
                              className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 hover:bg-rose-100 dark:bg-slate-800 dark:hover:bg-rose-950/60 text-slate-700 hover:text-rose-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-colors"
                            >
                              🏷️ {tag} ✕
                            </button>
                          ))}

                          <button
                            type="button"
                            onClick={() => setShowTagSelectorPopover(!showTagSelectorPopover)}
                            className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 inline-flex items-center gap-1"
                          >
                            <Tag className="w-3 h-3" />
                            <span>+ Etiqueta</span>
                          </button>
                        </div>

                        {/* Popover / Barra desplegable de Etiquetas del Cliente sincronizada con ClientsModule */}
                        {showTagSelectorPopover && (
                          <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                                Etiquetas de Segmentación CRM (Sincronizadas con Cartera de Clientes):
                              </span>
                              <button
                                type="button"
                                onClick={() => setShowTagSelectorPopover(false)}
                                className="text-[11px] text-slate-500 hover:text-slate-800 dark:hover:text-white font-semibold"
                              >
                                Cerrar ✕
                              </button>
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {AVAILABLE_CLIENT_TAGS.map((tag) => {
                                const active = activeClientInfo.tags.includes(tag);
                                return (
                                  <button
                                    key={tag}
                                    type="button"
                                    onClick={() => handleToggleClientTag(tag)}
                                    className={`px-2 py-0.5 rounded text-[11px] font-medium border transition-colors ${
                                      active
                                        ? 'bg-blue-600 text-white border-blue-600'
                                        : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-blue-400'
                                    }`}
                                  >
                                    {active ? `✓ ${tag}` : `+ ${tag}`}
                                  </button>
                                );
                              })}
                            </div>
                            <form
                              onSubmit={(e) => {
                                e.preventDefault();
                                if (!customNewTagText.trim()) return;
                                handleToggleClientTag(customNewTagText.trim());
                                setCustomNewTagText('');
                              }}
                              className="flex gap-1.5"
                            >
                              <input
                                type="text"
                                value={customNewTagText}
                                onChange={(e) => setCustomNewTagText(e.target.value)}
                                placeholder="Crear etiqueta personalizada..."
                                className="flex-1 px-2 py-1 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-white"
                              />
                              <button
                                type="submit"
                                className="px-2.5 py-1 text-xs font-semibold bg-slate-900 dark:bg-blue-600 text-white rounded inline-flex items-center gap-1"
                              >
                                <Plus className="w-3 h-3" /> Añadir
                              </button>
                            </form>
                          </div>
                        )}

                        {/* Banner compacto de Atribución Meta Ads cuando la conversación proviene de Campaña */}
                        {activeClientInfo.adRef && (
                          <div className="p-2.5 rounded-lg bg-fuchsia-50/90 dark:bg-fuchsia-950/40 border border-fuchsia-200 dark:border-fuchsia-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="space-y-0.5 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-fuchsia-600 text-white">
                                  📢 ORIGEN META ADS
                                </span>
                                <strong className="text-xs text-fuchsia-950 dark:text-fuchsia-200 truncate">
                                  {activeClientInfo.adRef.headline || 'Campaña Publicitaria Click-to-WhatsApp'}
                                </strong>
                              </div>
                              <div className="text-[11px] font-mono text-fuchsia-800 dark:text-fuchsia-300/90 truncate">
                                {activeClientInfo.adRef.sourceType === 'leadgen_form'
                                  ? 'Formulario Instantáneo Meta'
                                  : 'Anuncio Click-to-WhatsApp'}{' '}
                                · ID: {activeClientInfo.adRef.sourceId || 'N/A'}
                                {activeClientInfo.adRef.ctwaClid
                                  ? ` · CLID: ${activeClientInfo.adRef.ctwaClid}`
                                  : ''}
                              </div>
                            </div>
                            {onPreQuoteLeadWithAi && (
                              <button
                                type="button"
                                onClick={() => onPreQuoteLeadWithAi(activeOrder)}
                                className="px-2.5 py-1.5 text-xs font-bold bg-fuchsia-600 hover:bg-fuchsia-700 text-white rounded-md shrink-0 inline-flex items-center gap-1 shadow-2xs transition-colors"
                              >
                                <Sparkles className="w-3.5 h-3.5" />
                                <span>⚡ Pre-Cotizar Lead con IA</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    ) : null;
                  })()}
                </div>

                {/* Barra Plegable: Simulador Interactivo de Cliente & Bot (Oculta por defecto para dar más espacio al chat) */}
                {showSimulatorBar && (
                  <div className="px-4 py-3 bg-indigo-50/90 dark:bg-indigo-950/40 border-b border-indigo-200 dark:border-indigo-900/60 space-y-2.5">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-xs font-bold text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                        <span>Simulador del Cliente y Webhook Meta Ads:</span>
                      </span>
                      <div className="flex items-center gap-2">
                        {onSimulateMetaAdLead && (
                          <button
                            type="button"
                            onClick={() => onSimulateMetaAdLead()}
                            className="px-2.5 py-1 text-xs font-bold bg-fuchsia-600 hover:bg-fuchsia-700 text-white rounded-md inline-flex items-center gap-1 shadow-2xs"
                          >
                            <Megaphone className="w-3.5 h-3.5" />
                            <span>📢 Simular Lead Nuevo desde Anuncio Meta Ads</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setShowSimulatorBar(false)}
                          className="text-xs text-indigo-700 dark:text-indigo-300 hover:underline font-semibold"
                        >
                          Cerrar ✕
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleSimulateClientScenario('MENU')}
                        className="px-2.5 py-1 text-xs font-semibold bg-white dark:bg-slate-900 hover:bg-indigo-100 text-indigo-800 dark:text-indigo-200 border border-indigo-200 dark:border-indigo-800 rounded-md"
                      >
                        "HOLA / MENÚ"
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSimulateClientScenario('ESTADO')}
                        className="px-2.5 py-1 text-xs font-semibold bg-white dark:bg-slate-900 hover:bg-indigo-100 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 rounded-md"
                      >
                        1️⃣ "ESTADO"
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSimulateClientScenario('SALDO')}
                        className="px-2.5 py-1 text-xs font-semibold bg-white dark:bg-slate-900 hover:bg-indigo-100 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 rounded-md"
                      >
                        2️⃣ "SALDO"
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSimulateClientScenario('APROBADO')}
                        className="px-2.5 py-1 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-md"
                      >
                        ✓ 3️⃣ "APROBADO"
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSimulateClientScenario('CORRECCION')}
                        className="px-2.5 py-1 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-md"
                      >
                        4️⃣ "CORRECCIÓN"
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSimulateClientScenario('COMPROBANTE')}
                        className="px-2.5 py-1 text-xs font-semibold bg-white dark:bg-slate-900 hover:bg-indigo-100 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 rounded-md"
                      >
                        5️⃣ "COMPROBANTE"
                      </button>
                    </div>

                    <form onSubmit={handleSendCustomSimulatedClientMessage} className="flex gap-2">
                      <input
                        type="text"
                        value={simulatedClientInput}
                        onChange={(e) => setSimulatedClientInput(e.target.value)}
                        placeholder="O escribe aquí como si fueras el cliente..."
                        className="flex-1 px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 rounded-md text-slate-900 dark:text-white"
                      />
                      <button
                        type="submit"
                        disabled={!simulatedClientInput.trim()}
                        className="px-3 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-md shrink-0"
                      >
                        Simular Cliente
                      </button>
                    </form>
                  </div>
                )}

                {/* Historial de Mensajes con Desplazamiento Completo Garantizado (min-h-0 flex-1) */}
                <div
                  ref={chatScrollContainerRef}
                  className="flex-1 min-h-0 p-4 sm:p-5 pb-8 space-y-3.5 overflow-y-auto overscroll-contain scroll-smooth"
                >
                  {activeThreadMessages.length === 0 ? (
                    <div className="py-16 text-center text-sm text-slate-500 dark:text-slate-400 space-y-2">
                      <MessageSquare className="w-8 h-8 mx-auto text-slate-400" />
                      <p>
                        Aún no hay mensajes registrados en la orden{' '}
                        <strong className="text-slate-800 dark:text-slate-200">
                          {activeOrder.id}
                        </strong>
                        .
                      </p>
                    </div>
                  ) : (
                    activeThreadMessages.map((msg) => {
                      const isAgent = msg.sender === 'agent';
                      const isBot = msg.senderName.toLowerCase().includes('bot');
                      const isInternal = Boolean(msg.isInternalNote);

                      return (
                        <div
                          key={msg.id}
                          className={`flex flex-col ${
                            isInternal ? 'items-center' : isAgent ? 'items-end' : 'items-start'
                          }`}
                        >
                          <div
                            className={`max-w-[92%] rounded-xl p-3.5 text-sm space-y-1.5 border shadow-2xs ${
                              isInternal
                                ? 'w-full bg-amber-50/95 dark:bg-amber-950/70 text-amber-950 dark:text-amber-100 border-amber-300 dark:border-amber-700'
                                : !isAgent
                                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-700 rounded-tl-xs'
                                : isBot
                                ? 'bg-indigo-50/95 dark:bg-indigo-950/80 text-indigo-950 dark:text-indigo-100 border-indigo-200 dark:border-indigo-800/90 rounded-tr-xs'
                                : 'bg-emerald-50/95 dark:bg-emerald-950/80 text-emerald-950 dark:text-emerald-50 border-emerald-200 dark:border-emerald-800/90 rounded-tr-xs'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-3 text-xs font-mono pb-1 border-b border-black/5 dark:border-white/10">
                              <span className="font-bold inline-flex items-center gap-1.5 flex-wrap">
                                {isInternal ? (
                                  <>
                                    <span className="px-2 py-0.5 rounded bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-200 font-bold">
                                      🔒 NOTA INTERNA CRM
                                    </span>
                                    <span>por {msg.senderName}</span>
                                    {msg.mentionAllTeam ? (
                                      <span className="px-2 py-0.5 rounded bg-rose-600 text-white font-bold">
                                        📢 @TODOS EL EQUIPO ({users.length})
                                      </span>
                                    ) : msg.mentionedUserIds && msg.mentionedUserIds.length > 0 ? (
                                      msg.mentionedUserIds.map((uid) => (
                                        <span
                                          key={uid}
                                          className="px-2 py-0.5 rounded bg-blue-600 text-white font-bold"
                                        >
                                          @{getUserName(uid)}
                                        </span>
                                      ))
                                    ) : msg.mentionedUserId ? (
                                      <span className="px-2 py-0.5 rounded bg-blue-600 text-white font-bold">
                                        @{getUserName(msg.mentionedUserId)}
                                      </span>
                                    ) : null}
                                  </>
                                ) : !isAgent ? (
                                  <>
                                    <User className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                                    <span>{msg.senderName} (Cliente)</span>
                                  </>
                                ) : isBot ? (
                                  <>
                                    <Bot className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                                    <span className="text-indigo-700 dark:text-indigo-300">
                                      {msg.senderName}
                                    </span>
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                    <span className="text-emerald-800 dark:text-emerald-300">
                                      {msg.senderName}
                                    </span>
                                  </>
                                )}
                              </span>

                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    navigator.clipboard.writeText(msg.text);
                                    onNotify('Texto del mensaje copiado al portapapeles');
                                  }}
                                  className="opacity-60 hover:opacity-100 transition-opacity"
                                  title="Copiar texto de este mensaje"
                                >
                                  <Copy className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            <div className="whitespace-pre-wrap leading-relaxed font-sans text-sm">
                              {msg.text}
                            </div>

                            {msg.mediaAttachment && (
                              <div className="mt-2 rounded-xl overflow-hidden bg-white/95 dark:bg-slate-900/95 border border-slate-200/90 dark:border-slate-700 shadow-2xs">
                                {msg.mediaAttachment.type === 'image' && (
                                  <div className="p-2 space-y-1.5">
                                    <div className="relative group rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-950 max-h-64 flex items-center justify-center">
                                      <img
                                        src={msg.mediaAttachment.url}
                                        alt={msg.mediaAttachment.name}
                                        onClick={() =>
                                          setLightboxImage({
                                            url: msg.mediaAttachment!.url,
                                            name: msg.mediaAttachment!.name,
                                          })
                                        }
                                        className="max-h-60 w-auto object-contain rounded-lg cursor-pointer hover:opacity-95 transition-opacity"
                                      />
                                    </div>
                                    <div className="flex items-center justify-between gap-2 px-1 text-[11px] text-slate-600 dark:text-slate-400">
                                      <span className="font-semibold truncate">
                                        🖼️ {msg.mediaAttachment.name}
                                      </span>
                                      <div className="flex items-center gap-2 shrink-0">
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setLightboxImage({
                                              url: msg.mediaAttachment!.url,
                                              name: msg.mediaAttachment!.name,
                                            })
                                          }
                                          className="text-blue-600 dark:text-blue-400 font-bold hover:underline"
                                        >
                                          🔍 Ampliar
                                        </button>
                                        <a
                                          href={msg.mediaAttachment.url}
                                          download={msg.mediaAttachment.name}
                                          className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline"
                                        >
                                          ⬇ Descargar
                                        </a>
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {msg.mediaAttachment.type === 'video' && (
                                  <div className="p-2 space-y-1.5">
                                    <video
                                      src={msg.mediaAttachment.url}
                                      controls
                                      className="w-full max-h-64 rounded-lg bg-black"
                                    />
                                    <div className="flex items-center justify-between gap-2 px-1 text-[11px] text-slate-600 dark:text-slate-400">
                                      <span className="font-semibold truncate">
                                        🎬 {msg.mediaAttachment.name}
                                      </span>
                                      <a
                                        href={msg.mediaAttachment.url}
                                        download={msg.mediaAttachment.name}
                                        className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline shrink-0"
                                      >
                                        ⬇ Descargar Video
                                      </a>
                                    </div>
                                  </div>
                                )}

                                {msg.mediaAttachment.type === 'audio' && (
                                  <div className="p-3 space-y-1.5 bg-emerald-50/60 dark:bg-emerald-950/40">
                                    <div className="flex items-center justify-between gap-2 text-xs font-bold text-emerald-900 dark:text-emerald-200">
                                      <span className="inline-flex items-center gap-1.5 truncate">
                                        <Mic className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                        <span className="truncate">{msg.mediaAttachment.name}</span>
                                      </span>
                                      {msg.mediaAttachment.durationSec && (
                                        <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-emerald-200/80 dark:bg-emerald-900 text-emerald-900 dark:text-emerald-200 shrink-0">
                                          00:{String(msg.mediaAttachment.durationSec).padStart(2, '0')}
                                        </span>
                                      )}
                                    </div>
                                    <audio
                                      src={msg.mediaAttachment.url}
                                      controls
                                      className="w-full h-9"
                                    />
                                  </div>
                                )}

                                {msg.mediaAttachment.type === 'document' && (
                                  <div className="p-2.5 flex items-center justify-between gap-2.5">
                                    <div className="flex items-center gap-2.5 min-w-0">
                                      <div className="w-9 h-9 rounded-lg bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 flex items-center justify-center font-mono text-xs font-bold shrink-0">
                                        DOC
                                      </div>
                                      <div className="min-w-0">
                                        <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                          {msg.mediaAttachment.name}
                                        </div>
                                        <div className="text-[10px] font-mono text-slate-500">
                                          {msg.mediaAttachment.sizeBytes
                                            ? `${(msg.mediaAttachment.sizeBytes / 1024).toFixed(1)} KB · `
                                            : ''}
                                          Archivo / Arte Adjunto
                                        </div>
                                      </div>
                                    </div>
                                    <a
                                      href={msg.mediaAttachment.url}
                                      download={msg.mediaAttachment.name}
                                      className="px-2.5 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-md inline-flex items-center gap-1 shrink-0 transition-colors"
                                    >
                                      <FileDown className="w-3.5 h-3.5" />
                                      <span>Descargar</span>
                                    </a>
                                  </div>
                                )}

                                {msg.mediaAttachment.type === 'location' && (
                                  <div className="p-3 flex items-center justify-between gap-3 bg-blue-50/70 dark:bg-blue-950/40">
                                    <div className="flex items-center gap-2.5 min-w-0">
                                      <MapPin className="w-5 h-5 text-rose-600 shrink-0" />
                                      <div className="min-w-0">
                                        <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                          {msg.mediaAttachment.name}
                                        </div>
                                        <div className="text-[11px] text-slate-600 dark:text-slate-400 truncate">
                                          {msg.mediaAttachment.locationAddress ||
                                            'Av. Principal Industrial N45-12, Sector Norte'}
                                        </div>
                                      </div>
                                    </div>
                                    <a
                                      href={msg.mediaAttachment.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="px-2.5 py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-md inline-flex items-center gap-1 shrink-0"
                                    >
                                      <ExternalLink className="w-3.5 h-3.5" />
                                      <span>Ver Mapa</span>
                                    </a>
                                  </div>
                                )}

                                {msg.mediaAttachment.type === 'contact' && (
                                  <div className="p-3 flex items-center justify-between gap-3 bg-indigo-50/70 dark:bg-indigo-950/40">
                                    <div className="flex items-center gap-2.5 min-w-0">
                                      <PhoneCall className="w-4 h-4 text-indigo-600 shrink-0" />
                                      <div className="min-w-0">
                                        <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                          📇 {msg.mediaAttachment.name}
                                        </div>
                                        <div className="text-[11px] font-mono text-slate-600 dark:text-slate-400">
                                          Tarjeta de Contacto vCard Oficial
                                        </div>
                                      </div>
                                    </div>
                                    <span className="px-2 py-0.5 text-[10px] font-bold bg-indigo-600 text-white rounded">
                                      vCard
                                    </span>
                                  </div>
                                )}

                                {msg.mediaAttachment.type === 'interactive_poll' &&
                                  msg.mediaAttachment.pollOptions && (
                                    <div className="p-3 space-y-2 bg-slate-50 dark:bg-slate-900">
                                      <div className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5">
                                        <BarChart3 className="w-3.5 h-3.5" />
                                        <span>Botones Interactivos de Respuesta Rápida (Clic para simular respuesta del cliente):</span>
                                      </div>
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                        {msg.mediaAttachment.pollOptions.map((opt, idx) => (
                                          <button
                                            key={idx}
                                            type="button"
                                            onClick={() =>
                                              onSimulateIncomingMessage(activeOrder.id, opt)
                                            }
                                            className="px-2.5 py-1.5 text-xs font-semibold bg-white dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 rounded-lg text-left transition-colors"
                                          >
                                            👉 {opt}
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                              </div>
                            )}

                            {msg.driveFileAttachment && (
                              <div className="mt-2 p-2.5 rounded-lg bg-white/95 dark:bg-slate-900/95 border border-blue-200 dark:border-blue-800/80 flex items-center justify-between gap-2.5 shadow-2xs">
                                <div className="flex items-center gap-2 min-w-0">
                                  <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                                  <div className="min-w-0">
                                    <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                      {msg.driveFileAttachment.name}
                                    </div>
                                    <div className="text-[10px] font-mono text-slate-500">
                                      Google Drive · Subido por {msg.driveFileAttachment.uploadedBy}
                                    </div>
                                  </div>
                                </div>
                                <a
                                  href={msg.driveFileAttachment.webViewLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-2.5 py-1 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-md inline-flex items-center gap-1 shrink-0 transition-colors"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                  <span>Abrir en Drive</span>
                                </a>
                              </div>
                            )}

                            <div className="flex items-center justify-end gap-1 text-[11px] font-mono opacity-75 pt-0.5">
                              <span>{msg.timestamp}</span>
                              {isAgent &&
                                !isInternal &&
                                (msg.status === 'read' ? (
                                  <CheckCheck className="w-4 h-4 text-blue-600 dark:text-sky-400" />
                                ) : (
                                  <Check className="w-4 h-4" />
                                ))}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={chatMessagesEndRef} className="h-4 shrink-0" />
                </div>

                {/* Barra Desplegable de Plantillas Rápidas */}
                {showQuickTemplates && (
                  <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shrink-0">
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          handleInsertTemplate('menu_bot');
                          setShowQuickTemplates(false);
                        }}
                        className="px-2.5 py-1.5 text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 rounded-md text-indigo-800 dark:text-indigo-200"
                      >
                        🤖 Menú Bot (1-6)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          handleInsertTemplate('arte');
                          setShowQuickTemplates(false);
                        }}
                        className="px-2.5 py-1.5 text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md text-slate-800 dark:text-slate-200"
                      >
                        🎨 Aprobar Arte
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          handleInsertTemplate('avance');
                          setShowQuickTemplates(false);
                        }}
                        className="px-2.5 py-1.5 text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md text-slate-800 dark:text-slate-200"
                      >
                        ⚙️ Avance Etapa
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          handleInsertTemplate('listo');
                          setShowQuickTemplates(false);
                        }}
                        className="px-2.5 py-1.5 text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md text-slate-800 dark:text-slate-200"
                      >
                        ✅ Pedido Listo
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          handleInsertTemplate('saldo');
                          setShowQuickTemplates(false);
                        }}
                        className="px-2.5 py-1.5 text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md text-slate-800 dark:text-slate-200"
                      >
                        💳 Cobrar Saldo
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          handleInsertTemplate('bancos');
                          setShowQuickTemplates(false);
                        }}
                        className="px-2.5 py-1.5 text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md text-slate-800 dark:text-slate-200"
                      >
                        🏦 Cuentas Bancarias
                      </button>
                    </div>
                  </div>
                )}

                {/* Editor de Mensaje con Selector: Responder al Cliente vs Nota Interna Multi-Usuario y @TODOS */}
                <form
                  onSubmit={handleSendInCrm}
                  className={`p-3.5 border-t border-slate-200 dark:border-slate-800 space-y-2.5 shrink-0 max-h-[48vh] overflow-y-auto ${
                    composerMode === 'internal_note'
                      ? 'bg-amber-50/70 dark:bg-amber-950/30'
                      : 'bg-white dark:bg-slate-900'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="inline-flex rounded-lg p-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                      <button
                        type="button"
                        onClick={() => setComposerMode('client_wa')}
                        className={`px-3 py-1 rounded-md font-semibold transition-colors ${
                          composerMode === 'client_wa'
                            ? 'bg-emerald-600 text-white'
                            : 'text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        💬 Mensaje a Cliente
                      </button>
                      <button
                        type="button"
                        onClick={() => setComposerMode('internal_note')}
                        className={`px-3 py-1 rounded-md font-semibold transition-colors ${
                          composerMode === 'internal_note'
                            ? 'bg-amber-600 text-white'
                            : 'text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        🔒 Nota Interna (@Usuarios / @Todos)
                      </button>
                    </div>

                    {composerMode !== 'internal_note' && (
                      <button
                        type="button"
                        onClick={() => setShowQuickTemplates((prev) => !prev)}
                        className="px-2.5 py-1 text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 rounded-md border border-slate-300 dark:border-slate-700 inline-flex items-center gap-1"
                      >
                        <Zap className="w-3.5 h-3.5 text-amber-500" />
                        <span>{showQuickTemplates ? 'Ocultar Plantillas' : '⚡ Plantillas Rápidas'}</span>
                      </button>
                    )}
                  </div>

                  {/* SELECTOR MULTI-USUARIO Y @TODOS PARA NOTA INTERNA */}
                  {composerMode === 'internal_note' && (
                    <div className="p-2.5 rounded-xl bg-amber-100/70 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-bold text-amber-950 dark:text-amber-200">
                          🔔 ¿A quién deseas notificar esta Nota Interna? (Selecciona 1, varios o TODOS):
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              const nextAll = !notifyAllUsersInNote;
                              setNotifyAllUsersInNote(nextAll);
                              if (nextAll) {
                                setMentionedUserIds(users.map((u) => u.id));
                              }
                            }}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all ${
                              notifyAllUsersInNote
                                ? 'bg-rose-600 text-white border-rose-600 shadow-2xs'
                                : 'bg-white dark:bg-slate-900 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800 hover:bg-rose-50'
                            }`}
                          >
                            {notifyAllUsersInNote
                              ? `✓ 📢 Notificando a @TODOS (${users.length})`
                              : `📢 Notificar a @TODOS (${users.length})`}
                          </button>

                          {!notifyAllUsersInNote && mentionedUserIds.length > 1 && (
                            <button
                              type="button"
                              onClick={() => {
                                setMentionedUserIds([mentionedUserIds[0] || users[0].id]);
                              }}
                              className="px-2 py-1 rounded-lg text-[11px] font-semibold bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-700"
                            >
                              Dejar solo 1
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        {users.map((u) => {
                          const isSelected =
                            notifyAllUsersInNote || mentionedUserIds.includes(u.id);
                          return (
                            <button
                              key={u.id}
                              type="button"
                              onClick={() => {
                                if (notifyAllUsersInNote) {
                                  setNotifyAllUsersInNote(false);
                                  setMentionedUserIds([u.id]);
                                  setMentionedUserId(u.id);
                                  return;
                                }
                                setMentionedUserIds((prev) => {
                                  const exists = prev.includes(u.id);
                                  if (exists) {
                                    const remaining = prev.filter((id) => id !== u.id);
                                    const nextList = remaining.length > 0 ? remaining : [u.id];
                                    setMentionedUserId(nextList[0]);
                                    return nextList;
                                  } else {
                                    const nextList = [...prev, u.id];
                                    setMentionedUserId(u.id);
                                    if (nextList.length === users.length) {
                                      setNotifyAllUsersInNote(true);
                                    }
                                    return nextList;
                                  }
                                });
                              }}
                              className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all inline-flex items-center gap-1 ${
                                isSelected
                                  ? 'bg-amber-600 text-white border-amber-700 shadow-2xs'
                                  : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-amber-300/80 dark:border-amber-800 hover:bg-amber-50'
                              }`}
                            >
                              <span>{isSelected ? '☑' : '☐'}</span>
                              <span>@{u.name}</span>
                              <span className="opacity-75 text-[10px]">({u.department})</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Inputs ocultos para selección de Imagen, Video, Audio y Documento */}
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleFileUploadAttachment(e, 'image')}
                  />
                  <input
                    ref={videoInputRef}
                    type="file"
                    accept="video/*"
                    className="hidden"
                    onChange={(e) => handleFileUploadAttachment(e, 'video')}
                  />
                  <input
                    ref={audioInputRef}
                    type="file"
                    accept="audio/*,.mp3,.ogg,.wav,.m4a"
                    className="hidden"
                    onChange={(e) => handleFileUploadAttachment(e, 'audio')}
                  />
                  <input
                    ref={docInputRef}
                    type="file"
                    accept=".pdf,.ai,.cdr,.psd,.eps,.svg,.doc,.docx,.xls,.xlsx,.zip,.rar,application/pdf"
                    className="hidden"
                    onChange={(e) => handleFileUploadAttachment(e, 'document')}
                  />

                  {/* BARRA DE HERRAMIENTAS MULTIMEDIA DE WHATSAPP: EMOJIS, AUDIO, IMAGEN, VIDEO, ARCHIVOS Y MÁS */}
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-1.5 p-1.5 rounded-xl bg-slate-100/90 dark:bg-slate-800/90 border border-slate-200/90 dark:border-slate-700">
                      <div className="flex flex-wrap items-center gap-1">
                        {/* 1. EMOJIS */}
                        <button
                          type="button"
                          onClick={() => {
                            setShowEmojiPicker((prev) => !prev);
                            setShowWaToolsMenu(false);
                          }}
                          className={`px-2.5 py-1.5 text-xs font-bold rounded-lg inline-flex items-center gap-1.5 transition-colors ${
                            showEmojiPicker
                              ? 'bg-amber-500 text-white shadow-2xs'
                              : 'bg-white dark:bg-slate-900 hover:bg-amber-50 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700'
                          }`}
                          title="Insertar Emojis de WhatsApp (Ventas, Imprenta, Rótulos, Saludos)"
                        >
                          <Smile className="w-3.5 h-3.5 text-amber-500" />
                          <span>😀 Emojis</span>
                        </button>

                        {/* 2. NOTA DE VOZ / AUDIO */}
                        {!isRecordingAudio ? (
                          <button
                            type="button"
                            onClick={handleStartAudioRecording}
                            className="px-2.5 py-1.5 text-xs font-bold rounded-lg bg-white dark:bg-slate-900 hover:bg-rose-50 dark:hover:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-slate-200 dark:border-slate-700 inline-flex items-center gap-1.5 transition-colors"
                            title="Grabar Nota de Voz en vivo con tu micrófono o enviar audio"
                          >
                            <Mic className="w-3.5 h-3.5 text-rose-600" />
                            <span>🎤 Grabar Audio</span>
                          </button>
                        ) : (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-600 text-white text-xs font-bold animate-pulse">
                            <Mic className="w-3.5 h-3.5" />
                            <span className="font-mono">
                              Grabando 00:{String(recordingSeconds).padStart(2, '0')}
                            </span>
                            <button
                              type="button"
                              onClick={handleFinishAndSendAudioRecording}
                              className="px-2 py-0.5 rounded bg-white text-rose-700 font-bold hover:bg-rose-50 ml-1"
                              title="Detener grabación y enviar nota de voz ahora"
                            >
                              ✓ Enviar Voz
                            </button>
                            <button
                              type="button"
                              onClick={handleCancelAudioRecording}
                              className="px-1.5 py-0.5 rounded bg-rose-800 text-white hover:bg-rose-900"
                              title="Cancelar grabación"
                            >
                              ✕
                            </button>
                          </div>
                        )}

                        {/* 3. IMAGEN / FOTO */}
                        <button
                          type="button"
                          onClick={() => imageInputRef.current?.click()}
                          className="px-2.5 py-1.5 text-xs font-bold rounded-lg bg-white dark:bg-slate-900 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 inline-flex items-center gap-1.5 transition-colors"
                          title="Enviar Imagen o Fotografía (.jpg, .png, .webp) desde tu computadora o celular"
                        >
                          <ImageIcon className="w-3.5 h-3.5 text-emerald-600" />
                          <span>🖼️ Imagen</span>
                        </button>

                        {/* 4. VIDEO */}
                        <button
                          type="button"
                          onClick={() => videoInputRef.current?.click()}
                          className="px-2.5 py-1.5 text-xs font-bold rounded-lg bg-white dark:bg-slate-900 hover:bg-purple-50 dark:hover:bg-purple-950/50 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 inline-flex items-center gap-1.5 transition-colors"
                          title="Enviar Video (.mp4, .mov, .webm) de avance en taller o muestra de rótulo"
                        >
                          <Video className="w-3.5 h-3.5 text-purple-600" />
                          <span>🎬 Video</span>
                        </button>

                        {/* 5. ARCHIVO / DOCUMENTO PDF / EDITABLE */}
                        <button
                          type="button"
                          onClick={() => docInputRef.current?.click()}
                          className="px-2.5 py-1.5 text-xs font-bold rounded-lg bg-white dark:bg-slate-900 hover:bg-blue-50 dark:hover:bg-blue-950/50 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 inline-flex items-center gap-1.5 transition-colors"
                          title="Adjuntar Archivo PDF, Illustrator (.ai), Corel (.cdr), Photoshop (.psd), Excel o ZIP"
                        >
                          <Paperclip className="w-3.5 h-3.5 text-blue-600" />
                          <span>📎 Archivo / PDF</span>
                        </button>

                        {/* 6. SUBIR AUDIO MP3/OGG */}
                        <button
                          type="button"
                          onClick={() => audioInputRef.current?.click()}
                          className="px-2 py-1.5 text-xs font-semibold rounded-lg bg-white dark:bg-slate-900 hover:bg-slate-100 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 inline-flex items-center gap-1 transition-colors"
                          title="Subir un archivo de audio existente (.mp3, .ogg, .wav, .m4a)"
                        >
                          <span>🎵 Subir Audio</span>
                        </button>
                      </div>

                      {/* 7. MÁS HERRAMIENTAS DE WHATSAPP BUSINESS */}
                      <button
                        type="button"
                        onClick={() => {
                          setShowWaToolsMenu((prev) => !prev);
                          setShowEmojiPicker(false);
                        }}
                        className={`px-2.5 py-1.5 text-xs font-bold rounded-lg inline-flex items-center gap-1.5 transition-colors ${
                          showWaToolsMenu
                            ? 'bg-indigo-600 text-white shadow-2xs'
                            : 'bg-indigo-50 dark:bg-indigo-950/80 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800'
                        }`}
                        title="Abrir más herramientas de WhatsApp Business: Ubicación GPS, Contacto vCard, Encuesta Interactiva, Catálogo de Productos"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>🧰 + Herramientas WhatsApp</span>
                      </button>
                    </div>

                    {/* POPOVER 1: SELECTOR DE EMOJIS POR CATEGORÍAS */}
                    {showEmojiPicker && (
                      <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-800 shadow-sm space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-1.5">
                          <div className="flex flex-wrap gap-1">
                            {(
                              [
                                { id: 'ventas', label: '🔥 Ventas & Cierre' },
                                { id: 'taller', label: '🖨️ Imprenta & Rótulos' },
                                { id: 'saludos', label: '👋 Saludos & Trato' },
                                { id: 'finanzas', label: '💳 Pagos & Entrega' },
                              ] as const
                            ).map((cat) => (
                              <button
                                key={cat.id}
                                type="button"
                                onClick={() => setActiveEmojiCategory(cat.id)}
                                className={`px-2 py-1 text-[11px] font-bold rounded-md ${
                                  activeEmojiCategory === cat.id
                                    ? 'bg-amber-500 text-white'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                                }`}
                              >
                                {cat.label}
                              </button>
                            ))}
                          </div>
                          <button
                            type="button"
                            onClick={() => setShowEmojiPicker(false)}
                            className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-white font-semibold"
                          >
                            Cerrar ✕
                          </button>
                        </div>

                        <div className="flex flex-wrap gap-1.5">
                          {(
                            {
                              ventas: [
                                '✅',
                                '🔥',
                                '🚀',
                                '⭐',
                                '🎯',
                                '📢',
                                '🎉',
                                '💎',
                                '⚡',
                                '🏆',
                                '💯',
                                '📌',
                                '👉',
                                '✨',
                                '📲',
                                '💬',
                              ],
                              taller: [
                                '🎨',
                                '🖨️',
                                '📐',
                                '✂️',
                                '🛠️',
                                '⚙️',
                                '💡',
                                '🏗️',
                                '📦',
                                '🚚',
                                '🖼️',
                                '🎬',
                                '📄',
                                '📁',
                                '🔍',
                                '📏',
                              ],
                              saludos: [
                                '👋',
                                '😊',
                                '🤝',
                                '🙌',
                                '👍',
                                '👏',
                                '🙏',
                                '😃',
                                '😎',
                                '🤩',
                                '💪',
                                '❤️',
                                '🌟',
                                '☀️',
                                '☕',
                                '🫡',
                              ],
                              finanzas: [
                                '💳',
                                '🏦',
                                '💵',
                                '💰',
                                '🧾',
                                '📊',
                                '📈',
                                '🔒',
                                '⏰',
                                '📅',
                                '📍',
                                '🔔',
                                '⚠️',
                                '✔️',
                                '🆔',
                                '📑',
                              ],
                            }[activeEmojiCategory] || []
                          ).map((emoji) => (
                            <button
                              key={emoji}
                              type="button"
                              onClick={() => setDraftText((prev) => `${prev}${emoji}`)}
                              className="w-8 h-8 text-lg rounded-lg bg-slate-50 hover:bg-amber-100 dark:bg-slate-800 dark:hover:bg-amber-950/60 flex items-center justify-center transition-transform hover:scale-110"
                              title={`Insertar ${emoji}`}
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* POPOVER 2: MÁS HERRAMIENTAS DE WHATSAPP BUSINESS */}
                    {showWaToolsMenu && (
                      <div className="p-3 rounded-xl bg-indigo-50/90 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-indigo-950 dark:text-indigo-200">
                            🧰 Herramientas Interactivas de WhatsApp Business (Envío en 1 clic):
                          </span>
                          <button
                            type="button"
                            onClick={() => setShowWaToolsMenu(false)}
                            className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 hover:underline"
                          >
                            Cerrar ✕
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                          {/* Herramienta A: Ubicación GPS Planta / Taller */}
                          <button
                            type="button"
                            onClick={() => {
                              const channel =
                                waConfig.mode === 'meta_cloud_api' ? 'meta_cloud_api' : 'wa_direct';
                              onSendMessage(
                                activeOrder.id,
                                `📍 *UBICACIÓN OFICIAL DE PLANTA & SHOWROOM CREA ARTE S.A.*\n• *Dirección:* Av. Principal Industrial N45-12, Sector Norte\n• *Horario:* Lunes a Viernes 08:30–18:00 | Sábados 09:00–13:00\n• *Google Maps:* https://maps.google.com/?q=-0.1512,-78.4832`,
                                channel,
                                {
                                  type: 'location',
                                  name: 'Planta & Showroom Crea Arte S.A.',
                                  locationAddress: 'Av. Principal Industrial N45-12, Sector Norte',
                                  locationLat: -0.1512,
                                  locationLng: -78.4832,
                                  url: 'https://maps.google.com/?q=-0.1512,-78.4832',
                                }
                              );
                              setShowWaToolsMenu(false);
                            }}
                            className="p-2.5 rounded-lg bg-white dark:bg-slate-900 hover:border-indigo-400 border border-slate-200 dark:border-slate-700 text-left space-y-0.5 transition-colors"
                          >
                            <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                              <MapPin className="w-3.5 h-3.5 text-rose-600" />
                              <span>📍 Enviar Ubicación GPS Taller</span>
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                              Envía tarjeta con mapa y horarios de retiro.
                            </p>
                          </button>

                          {/* Herramienta B: Tarjeta de Contacto vCard */}
                          <button
                            type="button"
                            onClick={() => {
                              const channel =
                                waConfig.mode === 'meta_cloud_api' ? 'meta_cloud_api' : 'wa_direct';
                              onSendMessage(
                                activeOrder.id,
                                `📇 *TARJETA DE CONTACTO OFICIAL (vCard)*\n• *Ejecutivo Asignado:* ${currentUser.name}\n• *Cargo:* ${currentUser.roleLabel}\n• *Empresa:* Crea Arte S.A. (RUC: 1790088123001)\n• *WhatsApp / Teléfono:* +593 99 800 1234\n• *Correo:* ventas@creaarte.ec`,
                                channel,
                                {
                                  type: 'contact',
                                  name: `${currentUser.name} — Crea Arte S.A.`,
                                  url: 'tel:+593998001234',
                                }
                              );
                              setShowWaToolsMenu(false);
                            }}
                            className="p-2.5 rounded-lg bg-white dark:bg-slate-900 hover:border-indigo-400 border border-slate-200 dark:border-slate-700 text-left space-y-0.5 transition-colors"
                          >
                            <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                              <PhoneCall className="w-3.5 h-3.5 text-indigo-600" />
                              <span>📇 Tarjeta Contacto (vCard)</span>
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                              Comparte ficha del asesor comercial en 1 clic.
                            </p>
                          </button>

                          {/* Herramienta C: Encuesta / Botones Interactivos WhatsApp */}
                          <button
                            type="button"
                            onClick={() => {
                              const channel =
                                waConfig.mode === 'meta_cloud_api' ? 'meta_cloud_api' : 'wa_direct';
                              onSendMessage(
                                activeOrder.id,
                                `📊 *CONFIRMACIÓN INTERACTIVA (${activeOrder.id})*\nEstimado/a *${activeOrder.clientName}*, seleccione una opción tocando uno de los botones interactivos para continuar con *${activeOrder.title}*:`,
                                channel,
                                {
                                  type: 'interactive_poll',
                                  name: `Botones Interactivos ${activeOrder.id}`,
                                  url: '#',
                                  pollOptions: [
                                    '3 — APROBADO el arte final',
                                    '4 — Solicito CORRECCION en el diseño',
                                    '5 — Envío COMPROBANTE de anticipo/pago',
                                    '1 — Consultar ESTADO y fecha de entrega',
                                  ],
                                }
                              );
                              setShowWaToolsMenu(false);
                            }}
                            className="p-2.5 rounded-lg bg-white dark:bg-slate-900 hover:border-indigo-400 border border-slate-200 dark:border-slate-700 text-left space-y-0.5 transition-colors"
                          >
                            <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                              <BarChart3 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>📊 Botones / Encuesta Interactiva</span>
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                              Envía botones rápidos para aprobar arte o pagar.
                            </p>
                          </button>

                          {/* Herramienta D: Ficha de Producto del Catálogo con Imagen */}
                          <button
                            type="button"
                            onClick={() => {
                              const sampleProduct =
                                CATALOG_MATERIALS.find((m) => m.id === activeOrder.materialId) ||
                                CATALOG_MATERIALS[0];
                              const svgCard = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360"><rect width="640" height="360" rx="18" fill="#0f172a"/><rect x="20" y="20" width="600" height="320" rx="14" fill="#1e293b" stroke="#3b82f6" stroke-width="2"/><text x="45" y="75" fill="#60a5fa" font-family="sans-serif" font-size="16" font-weight="bold">CATÁLOGO OFICIAL CREA ARTE S.A.</text><text x="45" y="125" fill="#ffffff" font-family="sans-serif" font-size="24" font-weight="bold">${activeOrder.title.slice(0, 36)}</text><text x="45" y="168" fill="#cbd5e1" font-family="sans-serif" font-size="16">Material: ${(sampleProduct?.name || activeOrder.materialName).slice(0, 48)}</text><text x="45" y="210" fill="#34d399" font-family="sans-serif" font-size="28" font-weight="bold">Total Orden: $${activeOrder.totalPrice.toFixed(2)} USD</text><text x="45" y="260" fill="#94a3b8" font-family="sans-serif" font-size="14">Incluye garantía técnica de fábrica · Orden ${activeOrder.id}</text></svg>`;
                              const dataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(svgCard)}`;
                              const channel =
                                waConfig.mode === 'meta_cloud_api' ? 'meta_cloud_api' : 'wa_direct';
                              onSendMessage(
                                activeOrder.id,
                                `🏷️ *FICHA DE PRODUCTO / CATÁLOGO CREA ARTE (${activeOrder.id})*\n• *Producto:* ${activeOrder.title}\n• *Especificación:* ${activeOrder.materialName}\n• *Medidas:* ${activeOrder.widthM}m × ${activeOrder.heightM}m (${activeOrder.quantity} und)\n• *Inversión Total:* *$${activeOrder.totalPrice.toFixed(2)} USD*`,
                                channel,
                                {
                                  type: 'image',
                                  name: `Ficha_Catalogo_${activeOrder.id.replace('#', '')}.svg`,
                                  url: dataUrl,
                                }
                              );
                              setShowWaToolsMenu(false);
                            }}
                            className="p-2.5 rounded-lg bg-white dark:bg-slate-900 hover:border-indigo-400 border border-slate-200 dark:border-slate-700 text-left space-y-0.5 transition-colors"
                          >
                            <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                              <ShoppingBag className="w-3.5 h-3.5 text-fuchsia-600" />
                              <span>🏷️ Ficha visual del Catálogo</span>
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                              Envía tarjeta visual con precio y medidas.
                            </p>
                          </button>

                          {/* Herramienta E: Nota de Voz Rápida Pregrabada */}
                          <button
                            type="button"
                            onClick={() => {
                              const wavUrl = generateSyntheticVoiceNoteWav(5);
                              const channel =
                                waConfig.mode === 'meta_cloud_api' ? 'meta_cloud_api' : 'wa_direct';
                              onSendMessage(
                                activeOrder.id,
                                `🎤 *Nota de voz de ${currentUser.name} (00:05)* — "Hola ${activeOrder.clientName}, le enviamos los detalles actualizados de su proyecto ${activeOrder.title} (${activeOrder.id}). Quedamos atentos a su confirmación."`,
                                channel,
                                {
                                  type: 'audio',
                                  name: `Audio_Asesor_${activeOrder.id.replace('#', '')}.wav`,
                                  url: wavUrl,
                                  durationSec: 5,
                                  mimeType: 'audio/wav',
                                }
                              );
                              setShowWaToolsMenu(false);
                            }}
                            className="p-2.5 rounded-lg bg-white dark:bg-slate-900 hover:border-indigo-400 border border-slate-200 dark:border-slate-700 text-left space-y-0.5 transition-colors"
                          >
                            <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                              <Mic className="w-3.5 h-3.5 text-rose-600" />
                              <span>🎤 Enviar Audio Rápido Demo</span>
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                              Inserta una nota de voz reproducible al instante.
                            </p>
                          </button>

                          {/* Herramienta F: Enviar Arte / Mockup Visual de Aprobación */}
                          <button
                            type="button"
                            onClick={() => {
                              const svgMockup = `<svg xmlns="http://www.w3.org/2000/svg" width="680" height="380" viewBox="0 0 680 380"><rect width="680" height="380" rx="16" fill="#090d16"/><rect x="24" y="24" width="632" height="332" rx="12" fill="#111827" stroke="#10b981" stroke-width="3"/><text x="48" y="72" fill="#10b981" font-family="sans-serif" font-size="15" font-weight="bold">PROPUESTA DE ARTE FINAL · ORDEN ${activeOrder.id}</text><text x="48" y="122" fill="#ffffff" font-family="sans-serif" font-size="26" font-weight="bold">${activeOrder.clientName.slice(0, 32)}</text><text x="48" y="164" fill="#93c5fd" font-family="sans-serif" font-size="18">${activeOrder.title.slice(0, 40)}</text><text x="48" y="212" fill="#e2e8f0" font-family="sans-serif" font-size="15">Medida de Corte/Impresión: ${activeOrder.widthM}m ancho × ${activeOrder.heightM}m alto (${activeOrder.totalAreaM2} m²)</text><rect x="48" y="250" width="584" height="68" rx="10" fill="#064e3b"/><text x="70" y="290" fill="#ecfdf5" font-family="sans-serif" font-size="16" font-weight="bold">Responda "3" o "APROBADO" para iniciar producción en planta</text></svg>`;
                              const mockupUrl = `data:image/svg+xml;utf8,${encodeURIComponent(svgMockup)}`;
                              const channel =
                                waConfig.mode === 'meta_cloud_api' ? 'meta_cloud_api' : 'wa_direct';
                              onSendMessage(
                                activeOrder.id,
                                `🎨 *PROPUESTA GRÁFICA / BOCETO PARA APROBACIÓN (${activeOrder.id})*\nEstimado/a *${activeOrder.clientName}*, adjuntamos la lámina visual de su proyecto *${activeOrder.title}* (${activeOrder.widthM}m × ${activeOrder.heightM}m).\n✅ Responda *3* o *APROBADO* para pasar a máquina.`,
                                channel,
                                {
                                  type: 'image',
                                  name: `Boceto_Aprobacion_${activeOrder.id.replace('#', '')}.svg`,
                                  url: mockupUrl,
                                }
                              );
                              setShowWaToolsMenu(false);
                            }}
                            className="p-2.5 rounded-lg bg-white dark:bg-slate-900 hover:border-indigo-400 border border-slate-200 dark:border-slate-700 text-left space-y-0.5 transition-colors"
                          >
                            <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                              <Palette className="w-3.5 h-3.5 text-emerald-600" />
                              <span>🎨 Enviar Lámina de Boceto</span>
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                              Envía imagen de prueba de arte con medidas.
                            </p>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* BARRA DE VISTA PREVIA CUANDO HAY UN ARCHIVO / IMAGEN / VIDEO / AUDIO SELECCIONADO PARA ENVIAR */}
                    {pendingMediaAttachment && (
                      <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          {pendingMediaAttachment.type === 'image' ? (
                            <img
                              src={pendingMediaAttachment.url}
                              alt={pendingMediaAttachment.name}
                              className="w-12 h-12 rounded-lg object-cover border border-emerald-300 shrink-0"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shrink-0 uppercase">
                              {pendingMediaAttachment.type.slice(0, 3)}
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-emerald-950 dark:text-emerald-100 truncate">
                              📎 Listo para enviar: {pendingMediaAttachment.name}
                            </div>
                            <div className="text-[11px] text-emerald-700 dark:text-emerald-300">
                              Puedes agregar un comentario abajo y pulsar "Enviar Mensaje"
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setPendingMediaAttachment(null)}
                          className="px-2.5 py-1 text-xs font-bold bg-rose-100 hover:bg-rose-200 text-rose-700 rounded-lg shrink-0"
                        >
                          Quitar ✕
                        </button>
                      </div>
                    )}
                  </div>

                  <textarea
                    rows={2}
                    value={draftText}
                    onChange={(e) => setDraftText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        submitChatMessage();
                      }
                    }}
                    placeholder={
                      composerMode === 'internal_note'
                        ? notifyAllUsersInNote
                          ? `Escribe una nota interna para @TODOS EL EQUIPO (${users.length} colaboradores) — El cliente NO verá este mensaje...`
                          : `Escribe una nota interna para ${mentionedUserIds
                              .map((id) => `@${getUserName(id).split(' ')[0]}`)
                              .join(', ')} (El cliente NO verá este mensaje)...`
                        : `Escribe un mensaje, agrega emojis 😀 o adjunta audios/imágenes/videos para ${activeOrder.clientName} (Enter para enviar)...`
                    }
                    className={`w-full px-3.5 py-2.5 text-sm border rounded-lg text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 ${
                      composerMode === 'internal_note'
                        ? 'bg-white dark:bg-slate-900 border-amber-300 dark:border-amber-700 focus:ring-amber-600'
                        : 'bg-slate-50 dark:bg-slate-950 border-slate-300 dark:border-slate-700 focus:ring-blue-600'
                    }`}
                  />
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      {composerMode === 'client_wa' ? (
                        <button
                          type="button"
                          onClick={handleDispatchDirectWaMe}
                          className="px-3 py-2 text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 rounded-lg inline-flex items-center gap-1.5"
                        >
                          <ExternalLink className="w-4 h-4 text-emerald-600" />
                          <span>Abrir wa.me / Copiar</span>
                        </button>
                      ) : (
                        <span className="text-xs text-amber-800 dark:text-amber-300 font-bold">
                          {notifyAllUsersInNote
                            ? `📢 Notificará a @TODOS (${users.length} colaboradores) en Alertas CRM`
                            : `🔔 Notificará a ${mentionedUserIds
                                .map((id) => `@${getUserName(id).split(' ')[0]}`)
                                .join(', ')} (${mentionedUserIds.length}) en Alertas CRM`}
                        </span>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          setRightPanelTab('drive');
                          if (onOpenDriveModal) {
                            onOpenDriveModal(activeOrder.id);
                          }
                        }}
                        className="px-3 py-2 text-xs font-bold bg-blue-50 dark:bg-blue-950/70 hover:bg-blue-100 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-800 rounded-lg inline-flex items-center gap-1.5"
                        title="Subir archivo de diseño a la Carpeta Drive del proyecto y compartirlo en el chat interno"
                      >
                        <FolderPlus className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        <span>📁 Carpeta Drive / Subir Diseño</span>
                      </button>
                    </div>

                    <button
                      type="submit"
                      disabled={(!draftText.trim() && !pendingMediaAttachment) || isSendingCloud}
                      className={`px-4 py-2 text-xs font-bold disabled:opacity-40 text-white rounded-lg inline-flex items-center gap-2 shadow-xs ${
                        composerMode === 'internal_note'
                          ? 'bg-amber-600 hover:bg-amber-700'
                          : 'bg-emerald-600 hover:bg-emerald-700'
                      }`}
                    >
                      <Send className="w-4 h-4" />
                      <span>
                        {composerMode === 'internal_note'
                          ? notifyAllUsersInNote
                            ? `Guardar Nota y Notificar a @TODOS (${users.length})`
                            : `Guardar Nota y Notificar (${mentionedUserIds.length})`
                          : isSendingCloud
                          ? 'Enviando...'
                          : pendingMediaAttachment
                          ? `Enviar Adjunto + Mensaje`
                          : `Enviar Mensaje`}
                      </span>
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-2 text-slate-500">
                <MessageSquare className="w-8 h-8 text-slate-400" />
                <div className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  No hay órdenes seleccionadas en la bandeja
                </div>
              </div>
            )}
          </div>

          {/* PANEL DERECHO REORGANIZADO EN 3 PESTAÑAS LIMPIAS (4 COLUMNAS, OCULTO EN MODO WIDE Y FOCUS) */}
          <div
            className={`${
              chatLayoutMode !== 'standard' ? 'hidden' : 'lg:col-span-4 flex'
            } flex-col ${
              isChatTallMode
                ? 'lg:h-[1260px] lg:max-h-[1260px]'
                : 'lg:h-[calc(100vh-110px)] lg:min-h-[780px] lg:max-h-[1040px]'
            } overflow-y-auto bg-white dark:bg-slate-900`}
          >
            {activeOrder ? (
              <>
                {/* Resumen Fijo Superior: Cliente + Saldo + Selector de Etapa */}
                <div className="p-4 border-b border-slate-200 dark:border-slate-800 space-y-3 bg-slate-50/70 dark:bg-slate-950/50">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-base font-bold text-slate-900 dark:text-white">
                        {activeOrder.clientName}
                      </h3>
                      <p className="text-xs font-mono text-slate-500 dark:text-slate-400">
                        RUC: {activeOrder.clientRuc} · {activeOrder.id}
                      </p>
                    </div>
                    {canSeeFinancials && (
                      <div className="text-right font-mono">
                        <span className="text-[11px] text-slate-500 block">Saldo Pendiente</span>
                        <strong
                          className={`text-sm ${
                            activeOrder.totalPrice - activeOrder.paidAmount > 0
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-emerald-600 dark:text-emerald-400'
                          }`}
                        >
                          $
                          {Math.max(
                            0,
                            Number((activeOrder.totalPrice - activeOrder.paidAmount).toFixed(2))
                          ).toFixed(2)}
                        </strong>
                      </div>
                    )}
                  </div>

                  {/* Selector directo de Etapa Kanban */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Etapa Actual en Taller (Kanban):
                    </label>
                    <select
                      value={activeOrder.stage}
                      onChange={(e) =>
                        onMoveOrderStage(activeOrder.id, e.target.value as OrderStage)
                      }
                      className="w-full px-3 py-2 text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                    >
                      {ORDER_STAGES.map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Navegación de 4 Pestañas del Panel Derecho incluyendo Google Drive */}
                  <div className="grid grid-cols-4 gap-1 p-1 bg-slate-200/70 dark:bg-slate-900 rounded-lg border border-slate-300/60 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => setRightPanelTab('drive')}
                      className={`py-1.5 px-1.5 text-[11px] font-semibold rounded-md transition-colors ${
                        rightPanelTab === 'drive'
                          ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-2xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                      }`}
                    >
                      📁 Drive ({(activeOrder.driveFiles || []).length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setRightPanelTab('tasks')}
                      className={`py-1.5 px-1.5 text-[11px] font-semibold rounded-md transition-colors ${
                        rightPanelTab === 'tasks'
                          ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-2xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                      }`}
                    >
                      📌 Tareas ({crmTasks.filter((t) => t.orderId === activeOrder.id && t.status === 'pending').length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setRightPanelTab('finance_art')}
                      className={`py-1.5 px-1.5 text-[11px] font-semibold rounded-md transition-colors ${
                        rightPanelTab === 'finance_art'
                          ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-2xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                      }`}
                    >
                      💳 Cobro/Arte
                    </button>
                    <button
                      type="button"
                      onClick={() => setRightPanelTab('details')}
                      className={`py-1.5 px-1.5 text-[11px] font-semibold rounded-md transition-colors ${
                        rightPanelTab === 'details'
                          ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-2xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                      }`}
                    >
                      📋 Ficha
                    </button>
                  </div>
                </div>

                {/* Contenido de la Pestaña Seleccionada en el Panel Derecho */}
                <div className="p-4 flex-1 overflow-y-auto space-y-4">
                  {/* PESTAÑA 0: CARPETA GOOGLE DRIVE DEL PROYECTO Y ARCHIVOS DE DISEÑO */}
                  {rightPanelTab === 'drive' && (
                    <div className="space-y-4">
                      {/* Estado de Conexión Google Drive */}
                      <div className="p-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <FolderPlus className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                            <div>
                              <div className="text-xs font-bold text-slate-900 dark:text-white">
                                Carpeta Google Drive del Proyecto
                              </div>
                              <div className="text-[11px] text-slate-500">
                                {driveUserEmail
                                  ? `Conectado: ${driveUserEmail} · 🔓 Acceso equipo activo`
                                  : 'Sube diseños, PDFs o artes y compártelos en el chat interno'}
                              </div>
                            </div>
                          </div>
                          {onOpenDriveModal && (
                            <button
                              type="button"
                              onClick={() => onOpenDriveModal(activeOrder.id)}
                              className="px-2 py-1 text-[11px] font-bold bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-md hover:bg-indigo-100 shrink-0"
                              title="Elegir o crear la Carpeta Principal en Drive y configurar permisos de empleados"
                            >
                              ⚙️ Carpeta Principal
                            </button>
                          )}
                        </div>

                        {needsDriveAuth ? (
                          <div className="space-y-2 pt-1">
                            <button
                              type="button"
                              onClick={handleGoogleDriveLogin}
                              disabled={isLoggingInDrive}
                              className="w-full flex items-center justify-center gap-3 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 font-semibold py-2.5 px-4 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-2xs text-xs disabled:opacity-50"
                            >
                              <img
                                src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
                                alt="Google logo"
                                className="w-4 h-4"
                              />
                              <span>
                                {isLoggingInDrive
                                  ? 'Conectando con Google Drive...'
                                  : 'Sign in with Google (Conectar Drive)'}
                              </span>
                            </button>
                            <p className="text-[11px] text-slate-500 text-center">
                              Permiso seguro <code>drive.file</code> para crear carpetas por proyecto y subir diseños.
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-2.5">
                            {activeOrder.driveFolderId ? (
                              <div className="p-2.5 rounded-lg bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/80 space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-xs font-mono font-bold text-blue-900 dark:text-blue-200 truncate">
                                    📁 {activeOrder.driveFolderName || `${activeOrder.id} - ${activeOrder.clientName}`}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={handleCreateOrSyncProjectDriveFolder}
                                    disabled={isWorkingDrive}
                                    className="p-1 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded"
                                    title="Sincronizar archivos de la carpeta en Google Drive"
                                  >
                                    <RefreshCw className={`w-3.5 h-3.5 ${isWorkingDrive ? 'animate-spin' : ''}`} />
                                  </button>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <a
                                    href={activeOrder.driveFolderUrl || `https://drive.google.com/drive/folders/${activeOrder.driveFolderId}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex-1 px-2.5 py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-md inline-flex items-center justify-center gap-1.5 transition-colors"
                                  >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                    <span>Abrir Carpeta en Drive</span>
                                  </a>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const url =
                                        activeOrder.driveFolderUrl ||
                                        `https://drive.google.com/drive/folders/${activeOrder.driveFolderId}`;
                                      onSendInternalNote?.(
                                        activeOrder.id,
                                        `📁 Carpeta de Google Drive del proyecto ${activeOrder.id} lista para subir o descargar diseños: ${url}`,
                                        driveShareTargetUserId
                                      );
                                      onNotify('Carpeta compartida en el Chat Interno');
                                    }}
                                    className="px-2.5 py-1.5 text-xs font-semibold bg-amber-100 hover:bg-amber-200 dark:bg-amber-950/80 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-800 rounded-md inline-flex items-center gap-1"
                                    title="Compartir link de carpeta en el chat interno"
                                  >
                                    <Share2 className="w-3.5 h-3.5" />
                                    <span>Compartir Carpeta</span>
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={handleCreateOrSyncProjectDriveFolder}
                                disabled={isWorkingDrive}
                                className="w-full py-2.5 px-3 text-xs font-bold bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg inline-flex items-center justify-center gap-2 shadow-2xs transition-colors"
                              >
                                <FolderPlus className="w-4 h-4" />
                                <span>
                                  {isWorkingDrive
                                    ? 'Creando carpeta en Google Drive...'
                                    : `Crear Carpeta Drive para ${activeOrder.id}`}
                                </span>
                              </button>
                            )}

                            {/* Subida de Archivos de Diseño a la Carpeta Drive + Compartir con Empleados */}
                            <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2.5">
                              <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                Subir Archivo de Diseño / Producción a Drive
                              </div>

                              <div className="space-y-1.5">
                                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                                  Al subir o compartir, notificar en Chat Interno a:
                                </label>
                                <select
                                  value={driveShareTargetUserId}
                                  onChange={(e) => setDriveShareTargetUserId(e.target.value)}
                                  className="w-full px-2.5 py-1.5 text-xs font-semibold bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-md text-slate-900 dark:text-white"
                                >
                                  {users.map((u) => (
                                    <option key={u.id} value={u.id}>
                                      @{u.name} ({u.department})
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={autoShareOnUpload}
                                  onChange={(e) => setAutoShareOnUpload(e.target.checked)}
                                  className="rounded border-slate-300 text-blue-600"
                                />
                                <span>Publicar automáticamente en 🔒 Nota Interna al subir</span>
                              </label>

                              <input
                                ref={driveFileInputRef}
                                type="file"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    handleUploadDesignFileToDrive(file);
                                  }
                                  e.target.value = '';
                                }}
                                className="hidden"
                              />
                              <button
                                type="button"
                                disabled={isWorkingDrive}
                                onClick={() => driveFileInputRef.current?.click()}
                                className="w-full py-2 px-3 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg inline-flex items-center justify-center gap-2 shadow-2xs transition-colors"
                              >
                                <Upload className="w-4 h-4" />
                                <span>
                                  {isWorkingDrive
                                    ? 'Subiendo archivo a Google Drive...'
                                    : 'Subir Diseño / PDF / Boceto a Drive'}
                                </span>
                              </button>
                            </div>
                          </div>
                        )}

                        {driveError && (
                          <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300">
                            {driveError}
                          </div>
                        )}
                      </div>

                      {/* Lista de Archivos de Diseño en la Carpeta del Proyecto */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                            Archivos en la Carpeta del Proyecto ({(activeOrder.driveFiles || []).length}):
                          </span>
                        </div>

                        {(activeOrder.driveFiles || []).length === 0 ? (
                          <div className="p-5 text-xs text-slate-500 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 text-center">
                            Aún no hay archivos cargados en la carpeta Drive de {activeOrder.id}.
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {(activeOrder.driveFiles || []).map((file) => (
                              <div
                                key={file.id}
                                className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2 text-xs"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <a
                                      href={file.webViewLink}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="font-bold text-blue-600 dark:text-blue-400 hover:underline truncate block"
                                    >
                                      {file.name}
                                    </a>
                                    <div className="text-[11px] font-mono text-slate-500">
                                      Por {file.uploadedBy}
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => setDriveFileToDelete(file)}
                                    className="p-1 text-slate-400 hover:text-rose-600 rounded"
                                    title="Eliminar archivo de Google Drive"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>

                                <div className="flex items-center gap-1.5 pt-1">
                                  <button
                                    type="button"
                                    onClick={() => handleShareDriveFileInInternalChat(file)}
                                    className="flex-1 py-1.5 px-2.5 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white rounded-md inline-flex items-center justify-center gap-1.5 transition-colors"
                                  >
                                    <Share2 className="w-3.5 h-3.5" />
                                    <span>Compartir en Chat Interno (@{getUserName(driveShareTargetUserId).split(' ')[0]})</span>
                                  </button>
                                  <a
                                    href={file.webViewLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="py-1.5 px-2.5 text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-md inline-flex items-center gap-1"
                                  >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                    <span>Abrir</span>
                                  </a>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* PESTAÑA 1: TAREAS Y RECORDATORIOS CRM */}
                  {rightPanelTab === 'tasks' && (
                    <div className="space-y-4">
                      {onAddCrmTask && (
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            if (!newTaskTitle.trim()) return;
                            onAddCrmTask({
                              clientName: activeOrder.clientName,
                              orderId: activeOrder.id,
                              title: newTaskTitle.trim(),
                              assignedToUserId: newTaskAssigneeId,
                              createdByUserId: currentUser.id,
                              dueDate: newTaskDueDate,
                              priority: newTaskPriority,
                            });
                            setNewTaskTitle('');
                          }}
                          className="p-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2.5"
                        >
                          <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                            + Asignar Nueva Tarea sobre este Chat
                          </div>
                          <input
                            type="text"
                            value={newTaskTitle}
                            onChange={(e) => setNewTaskTitle(e.target.value)}
                            placeholder="Ej. Llamar para confirmar medidas / Enviar boceto..."
                            className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                          />
                          <div className="grid grid-cols-2 gap-2">
                            <select
                              value={newTaskAssigneeId}
                              onChange={(e) => setNewTaskAssigneeId(e.target.value)}
                              className="px-2.5 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                            >
                              {users.map((u) => (
                                <option key={u.id} value={u.id}>
                                  Para: {u.name.split(' ').slice(0, 2).join(' ')}
                                </option>
                              ))}
                            </select>
                            <select
                              value={newTaskPriority}
                              onChange={(e) => setNewTaskPriority(e.target.value as CrmTaskPriority)}
                              className="px-2.5 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                            >
                              <option value="urgente">🔴 Prioridad Urgente</option>
                              <option value="alta">🟠 Prioridad Alta</option>
                              <option value="media">🔵 Prioridad Media</option>
                            </select>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={newTaskDueDate}
                              onChange={(e) => setNewTaskDueDate(e.target.value)}
                              placeholder="Vence (YYYY-MM-DD HH:mm)"
                              className="flex-1 px-2.5 py-2 text-xs font-mono bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                            />
                            <button
                              type="submit"
                              disabled={!newTaskTitle.trim()}
                              className="px-3.5 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-lg shrink-0"
                            >
                              + Crear Tarea
                            </button>
                          </div>
                        </form>
                      )}

                      <div className="space-y-2">
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                          Tareas Vinculadas a {activeOrder.id}:
                        </span>
                        {crmTasks.filter((t) => t.orderId === activeOrder.id).length === 0 ? (
                          <div className="p-5 text-xs text-slate-500 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 text-center">
                            No hay tareas pendientes en esta conversación.
                          </div>
                        ) : (
                          crmTasks
                            .filter((t) => t.orderId === activeOrder.id)
                            .map((task) => {
                              const isDone = task.status === 'completed';
                              const prioLow = String(task.priority).toLowerCase();
                              return (
                                <div
                                  key={task.id}
                                  className={`p-3 rounded-xl border text-xs flex items-start justify-between gap-2.5 ${
                                    isDone
                                      ? 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 opacity-65'
                                      : prioLow === 'urgente'
                                      ? 'bg-rose-50/70 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800'
                                      : 'bg-indigo-50/50 dark:bg-indigo-950/25 border-indigo-200 dark:border-indigo-800/70'
                                  }`}
                                >
                                  <div className="space-y-1 min-w-0">
                                    <div
                                      className={`font-semibold leading-snug ${
                                        isDone
                                          ? 'line-through text-slate-500'
                                          : 'text-slate-900 dark:text-white'
                                      }`}
                                    >
                                      {task.title}
                                    </div>
                                    <div className="text-[11px] font-mono text-slate-500 flex flex-wrap items-center gap-1.5">
                                      <span>👤 {getUserName(task.assignedToUserId).split(' ')[0]}</span>
                                      <span>·</span>
                                      <span>📅 {task.dueDate}</span>
                                      <span
                                        className={`px-1.5 py-0.5 rounded uppercase font-bold ${
                                          prioLow === 'urgente'
                                            ? 'bg-rose-600 text-white'
                                            : prioLow === 'alta'
                                            ? 'bg-amber-500 text-white'
                                            : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                                        }`}
                                      >
                                        {task.priority}
                                      </span>
                                    </div>
                                  </div>
                                  {onToggleCrmTaskStatus && (
                                    <button
                                      type="button"
                                      onClick={() => onToggleCrmTaskStatus(task.id)}
                                      className={`px-2.5 py-1.5 rounded-lg text-xs font-bold shrink-0 ${
                                        isDone
                                          ? 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                                          : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                      }`}
                                    >
                                      {isDone ? 'Reabrir' : '✓ Listo'}
                                    </button>
                                  )}
                                </div>
                              );
                            })
                        )}
                      </div>
                    </div>
                  )}

                  {/* PESTAÑA 2: COBRO DE COMPROBANTES Y APROBACIÓN DE ARTE */}
                  {rightPanelTab === 'finance_art' && (
                    <div className="space-y-4">
                      {/* Control Directo de Link de Arte y Aprobación */}
                      <div className="p-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                            <Link2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                            <span>Archivo de Arte / Boceto</span>
                          </span>
                          <button
                            type="button"
                            onClick={handleToggleArtworkApproved}
                            className={`px-2.5 py-1 text-xs font-bold rounded-md border transition-colors ${
                              activeOrder.artworkApproved
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/80 dark:text-emerald-300'
                                : 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/80 dark:text-amber-300'
                            }`}
                          >
                            {activeOrder.artworkApproved ? '✓ Arte Aprobado' : '⏳ Arte Pendiente'}
                          </button>
                        </div>

                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={artworkLinkDraft}
                            onChange={(e) => setArtworkLinkDraft(e.target.value)}
                            placeholder="Pegar link Drive / PDF / Boceto..."
                            className="flex-1 px-3 py-1.5 text-xs font-mono bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                          />
                          <button
                            type="button"
                            onClick={handleSaveArtworkUrl}
                            className="px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shrink-0"
                          >
                            Guardar
                          </button>
                        </div>
                      </div>

                      {/* Estado Financiero y Acreditación Rápida de Comprobantes */}
                      {canSeeFinancials && (
                        <div className="space-y-3">
                          <div className="grid grid-cols-3 gap-2 p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 font-mono text-xs">
                            <div>
                              <span className="text-[11px] text-slate-500 block">Total</span>
                              <strong className="text-slate-900 dark:text-white">
                                ${activeOrder.totalPrice.toFixed(2)}
                              </strong>
                            </div>
                            <div>
                              <span className="text-[11px] text-slate-500 block">Abonado</span>
                              <strong className="text-emerald-700 dark:text-emerald-400">
                                ${activeOrder.paidAmount.toFixed(2)}
                              </strong>
                            </div>
                            <div>
                              <span className="text-[11px] text-slate-500 block">Saldo</span>
                              <strong className="text-amber-600 dark:text-amber-400">
                                $
                                {Math.max(
                                  0,
                                  Number((activeOrder.totalPrice - activeOrder.paidAmount).toFixed(2))
                                ).toFixed(2)}
                              </strong>
                            </div>
                          </div>

                          {activeOrder.totalPrice - activeOrder.paidAmount > 0 ? (
                            <div className="space-y-2.5 p-3.5 bg-emerald-50/60 dark:bg-emerald-950/25 border border-emerald-200 dark:border-emerald-900/60 rounded-xl">
                              <div className="flex items-center justify-between">
                                <label className="text-xs font-bold text-emerald-900 dark:text-emerald-300">
                                  Registrar Pago / Comprobante ($)
                                </label>
                                <div className="flex gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setQuickPayAmount(
                                        Number((activeOrder.totalPrice * 0.5).toFixed(2))
                                      )
                                    }
                                    className="px-2 py-1 text-xs font-mono bg-white dark:bg-slate-900 border border-emerald-300 rounded-md text-emerald-800 dark:text-emerald-300"
                                  >
                                    50%
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setQuickPayAmount(
                                        Math.max(
                                          0,
                                          Number(
                                            (activeOrder.totalPrice - activeOrder.paidAmount).toFixed(2)
                                          )
                                        )
                                      )
                                    }
                                    className="px-2 py-1 text-xs font-mono bg-white dark:bg-slate-900 border border-emerald-300 rounded-md text-emerald-800 dark:text-emerald-300"
                                  >
                                    100% Saldo
                                  </button>
                                </div>
                              </div>

                              <select
                                value={quickPayBank}
                                onChange={(e) => setQuickPayBank(e.target.value)}
                                className="w-full px-3 py-2 text-xs font-mono bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                              >
                                {BANK_ACCOUNTS_CATALOG.map((b) => (
                                  <option key={b} value={b}>
                                    {b}
                                  </option>
                                ))}
                              </select>

                              <div className="grid grid-cols-2 gap-2">
                                <input
                                  type="text"
                                  value={quickPayRef}
                                  onChange={(e) => setQuickPayRef(e.target.value)}
                                  placeholder="N° Comprobante"
                                  className="px-2.5 py-1.5 text-xs font-mono bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                                />
                                <input
                                  type="text"
                                  value={quickPayDoc}
                                  onChange={(e) => setQuickPayDoc(e.target.value)}
                                  placeholder="N° Factura"
                                  className="px-2.5 py-1.5 text-xs font-mono bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                                />
                              </div>

                              <div className="flex gap-2">
                                <input
                                  type="number"
                                  min="1"
                                  step="0.5"
                                  value={quickPayAmount}
                                  onChange={(e) =>
                                    setQuickPayAmount(Math.max(0, Number(e.target.value)))
                                  }
                                  className="w-28 px-3 py-2 text-xs font-mono font-bold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const pending = Math.max(
                                      0,
                                      Number(
                                        (activeOrder.totalPrice - activeOrder.paidAmount).toFixed(2)
                                      )
                                    );
                                    const amt = quickPayAmount > 0 ? quickPayAmount : pending;
                                    if (amt <= 0) return;
                                    onRegisterOrderPayment(
                                      activeOrder.id,
                                      amt,
                                      'Transferencia Bancaria',
                                      {
                                        bankEntity: quickPayBank,
                                        referenceNumber: quickPayRef.trim() || 'S/N',
                                        invoiceOrDocNumber: quickPayDoc.trim() || 'Pendiente Facturar',
                                        accountHolderOrNotes: 'Comprobante verificado desde CRM WhatsApp',
                                      }
                                    );
                                  }}
                                  className="flex-1 px-3 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg inline-flex items-center justify-center gap-1.5"
                                >
                                  <DollarSign className="w-4 h-4" />
                                  <span>Acreditar y Enviar Recibo</span>
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/60 rounded-xl text-center text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                              ✓ Orden 100% Liquidada sin saldo pendiente
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* PESTAÑA 3: FICHA TÉCNICA Y EQUIPO ASIGNADO */}
                  {rightPanelTab === 'details' && (
                    <div className="space-y-4 text-xs">
                      <div className="p-3.5 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                        <div className="font-bold text-slate-900 dark:text-white text-sm">
                          {activeOrder.title}
                        </div>
                        <p className="font-mono text-slate-600 dark:text-slate-400">
                          Material: <strong>{activeOrder.materialName}</strong>
                        </p>
                        <p className="font-mono text-slate-600 dark:text-slate-400">
                          Especificación:{' '}
                          {isDesignOnlyOrder(activeOrder)
                            ? `${activeOrder.quantity} entregable(s) digital(es)`
                            : `${activeOrder.widthM}m × ${activeOrder.heightM}m (${activeOrder.quantity}u = ${activeOrder.totalAreaM2} m²)`}
                        </p>
                        {activeOrder.finishings.length > 0 && (
                          <p className="text-slate-600 dark:text-slate-400">
                            Acabados: {activeOrder.finishings.join(', ')}
                          </p>
                        )}
                      </div>

                      <div className="p-3.5 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                        <span className="font-bold text-slate-800 dark:text-slate-200 block">
                          Equipo Técnico del Proyecto:
                        </span>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Diseñador:</span>
                          <span className="font-semibold text-slate-900 dark:text-white">
                            {getUserName(activeOrder.designerId)}
                          </span>
                        </div>
                        {!isDesignOnlyOrder(activeOrder) && (
                          <>
                            <div className="flex justify-between">
                              <span className="text-slate-500">Taller / Máquina:</span>
                              <span className="font-semibold text-slate-900 dark:text-white">
                                {getUserName(activeOrder.operatorId)}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">Instalación:</span>
                              <span className="font-semibold text-slate-900 dark:text-white">
                                {getUserName(activeOrder.installerId)}
                              </span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="p-6 text-center text-xs text-slate-500">
                Selecciona una orden para ver su ficha técnica y tareas CRM.
              </div>
            )}
          </div>
        </div>
      )}

      {/* VISTA 2: DIFUSIÓN MASIVA DE PROMOCIONES Y SELECCIÓN DE LOTES POR ETIQUETAS PREDEFINIDAS */}
      {activeView === 'batch_broadcast' && (() => {
        const matchingBatchOrders = orders.filter((ord) => {
          const info = getClientInfoForOrder(ord);
          if (batchSegmentMode === 'META_ADS' && !info.isMetaAd) return false;
          if (batchSegmentMode === 'NEW_PROSPECTS' && info.isRecurrent) return false;
          if (batchSegmentMode === 'RECURRENT_VIP' && !info.isRecurrent) return false;
          if (batchStageFilter !== 'ALL' && info.crmLeadStage !== batchStageFilter) return false;
          if (batchSelectedTags.length > 0) {
            const hasAnySelectedTag = batchSelectedTags.some((t) => info.tags.includes(t));
            if (!hasAnySelectedTag) return false;
          }
          return true;
        });

        const selectedTargetOrders = matchingBatchOrders.filter((o) =>
          batchSelectedOrderIds.includes(o.id)
        );
        const effectiveTargets =
          selectedTargetOrders.length > 0 ? selectedTargetOrders : matchingBatchOrders;

        const handleToggleBatchTag = (tag: string) => {
          setBatchSelectedTags((prev) =>
            prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
          );
        };

        const handleToggleBatchOrder = (orderId: string) => {
          setBatchSelectedOrderIds((prev) =>
            prev.includes(orderId) ? prev.filter((id) => id !== orderId) : [...prev, orderId]
          );
        };

        const handleSelectAllBatch = () => {
          setBatchSelectedOrderIds(matchingBatchOrders.map((o) => o.id));
        };

        const handleClearBatchSelection = () => {
          setBatchSelectedOrderIds([]);
        };

        const handleDispatchBatchPromo = () => {
          if (effectiveTargets.length === 0) {
            onNotify('No hay destinatarios en el lote actual para enviar la promoción');
            return;
          }
          if (!batchPromoMessage.trim()) {
            onNotify('Escribe el mensaje de la promoción antes de enviarlo');
            return;
          }
          const ch = waConfig.mode === 'meta_cloud_api' ? 'meta_cloud_api' : 'wa_direct';
          const sentItems: { orderId: string; clientName: string; phone: string; text: string }[] = [];
          effectiveTargets.forEach((ord) => {
            const info = getClientInfoForOrder(ord);
            const execName = getUserName(getOrderCrmAgentId(ord));
            const personalized = batchPromoMessage
              .replace(/\{cliente\}/gi, ord.clientName)
              .replace(/\{orden\}/gi, ord.id)
              .replace(/\{etapa\}/gi, info.crmLeadStage)
              .replace(/\{ejecutivo\}/gi, execName);
            onSendMessage(ord.id, personalized, ch);
            if (ch === 'meta_cloud_api') {
              void dispatchViaMetaCloudApi(ord.clientPhone, personalized);
            }
            sentItems.push({
              orderId: ord.id,
              clientName: ord.clientName,
              phone: ord.clientPhone,
              text: personalized,
            });
          });
          setLastSentBatchReport({
            sentAt: new Date().toLocaleTimeString(),
            count: sentItems.length,
            items: sentItems,
          });
          onNotify(
            `🚀 Campaña enviada con éxito a ${effectiveTargets.length} cliente(s)/lead(s) del lote seleccionado`
          );
        };

        return (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* Columna Izquierda: Filtros por Etiquetas Predefinidas + Selección de Lote */}
            <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Tag className="w-4 h-4 text-fuchsia-600" />
                    <span>
                      Paso 1: Selección de Lotes por Etiquetas Predefinidas y Embudo CRM
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Filtra tus leads o clientes por etiquetas (ej. Rótulos 3D, Lead Meta Ads, VIP) y marca el lote a contactar.
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-fuchsia-50 dark:bg-fuchsia-950/60 text-fuchsia-700 dark:text-fuchsia-300 border border-fuchsia-200 dark:border-fuchsia-800 shrink-0">
                  {matchingBatchOrders.length} en este lote
                </span>
              </div>

              {/* Segmentos rápidos */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(
                  [
                    { id: 'ALL', label: `Todos (${orders.length})` },
                    { id: 'META_ADS', label: `📢 Leads Meta Ads (${filterCounts.metaAdsLeads})` },
                    { id: 'NEW_PROSPECTS', label: `🆕 Nuevos Prospectos (${filterCounts.newProspects})` },
                    { id: 'RECURRENT_VIP', label: `⭐ Recurrentes / VIP (${filterCounts.vipRecurrent})` },
                  ] as const
                ).map((seg) => (
                  <button
                    key={seg.id}
                    type="button"
                    onClick={() => setBatchSegmentMode(seg.id)}
                    className={`px-2.5 py-2 text-xs font-semibold rounded-lg border transition-colors ${
                      batchSegmentMode === seg.id
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-100'
                    }`}
                  >
                    {seg.label}
                  </button>
                ))}
              </div>

              {/* Selección múltiple de etiquetas predefinidas */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Filtrar por Etiquetas Predefinidas (Puedes marcar una o varias):
                  </span>
                  {batchSelectedTags.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setBatchSelectedTags([])}
                      className="text-xs text-rose-600 hover:underline font-semibold"
                    >
                      Limpiar etiquetas ({batchSelectedTags.length})
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {AVAILABLE_CLIENT_TAGS.map((tag) => {
                    const active = batchSelectedTags.includes(tag);
                    const countWithTag = orders.filter((o) =>
                      getClientInfoForOrder(o).tags.includes(tag)
                    ).length;
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => handleToggleBatchTag(tag)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                          active
                            ? 'bg-fuchsia-600 text-white border-fuchsia-600 shadow-2xs'
                            : 'bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-fuchsia-400'
                        }`}
                      >
                        {active ? `✓ ${tag}` : tag} ({countWithTag})
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Filtro por Etapa del Embudo + Acciones de Selección Masiva */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <select
                  value={batchStageFilter}
                  onChange={(e) => setBatchStageFilter(e.target.value as CrmLeadStage | 'ALL')}
                  className="px-3 py-1.5 text-xs font-semibold bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200"
                >
                  <option value="ALL">🎯 Todas las Etapas del Embudo CRM</option>
                  {CRM_LEAD_STAGES.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSelectAllBatch}
                    className="px-2.5 py-1.5 text-xs font-semibold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-lg"
                  >
                    ✓ Seleccionar Todos ({matchingBatchOrders.length})
                  </button>
                  <button
                    type="button"
                    onClick={handleClearBatchSelection}
                    className="px-2.5 py-1.5 text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg"
                  >
                    Limpiar Selección
                  </button>
                  <button
                    type="button"
                    onClick={handleDispatchBatchPromo}
                    disabled={effectiveTargets.length === 0}
                    className="px-3 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-lg shadow-2xs inline-flex items-center gap-1.5"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>🚀 Enviar al Lote Completo ({effectiveTargets.length})</span>
                  </button>
                </div>
              </div>

              {/* Tabla de Destinatarios del Lote */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden max-h-[380px] overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 sticky top-0">
                    <tr>
                      <th className="py-2.5 px-3 w-8">✓</th>
                      <th className="py-2.5 px-3">Folio / Cliente</th>
                      <th className="py-2.5 px-3">WhatsApp</th>
                      <th className="py-2.5 px-3">Segmento y Etiquetas</th>
                      <th className="py-2.5 px-3">Etapa Embudo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {matchingBatchOrders.map((ord) => {
                      const info = getClientInfoForOrder(ord);
                      const checked =
                        batchSelectedOrderIds.length === 0 ||
                        batchSelectedOrderIds.includes(ord.id);
                      return (
                        <tr
                          key={ord.id}
                          onClick={() => handleToggleBatchOrder(ord.id)}
                          className="hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer"
                        >
                          <td className="py-2.5 px-3">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => handleToggleBatchOrder(ord.id)}
                              onClick={(e) => e.stopPropagation()}
                              className="rounded border-slate-300 text-fuchsia-600"
                            />
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="font-mono font-bold text-blue-600 dark:text-blue-400 mr-1.5">
                              {ord.id}
                            </span>
                            <strong className="text-slate-900 dark:text-white">
                              {ord.clientName}
                            </strong>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-600 dark:text-slate-400">
                            {ord.clientPhone}
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="flex flex-wrap gap-1">
                              {info.isRecurrent ? (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300">
                                  ⭐ Recurrente
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300">
                                  🆕 Prospecto
                                </span>
                              )}
                              {info.tags.slice(0, 3).map((t) => (
                                <span
                                  key={t}
                                  className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                                >
                                  {t}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-[11px] font-medium text-indigo-700 dark:text-indigo-300">
                            {info.crmLeadStage}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Columna Derecha: Plantillas de Promoción + Disparo en Lote */}
            <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4 shadow-xs">
              <div className="border-b border-slate-200 dark:border-slate-800 pb-3">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Megaphone className="w-4 h-4 text-indigo-600" />
                  <span>Paso 2: Plantilla de Promoción y Envío Masivo al Lote</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Usa variables dinámicas como <code>{'{cliente}'}</code>, <code>{'{orden}'}</code>,{' '}
                  <code>{'{etapa}'}</code> y <code>{'{ejecutivo}'}</code>.
                </p>
              </div>

              <div className="space-y-1.5">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                  Cargar Plantilla Promocional Predefinida:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {[
                    {
                      label: '🏷️ Promo Rótulos 3D & LED (-20% Off)',
                      text: '🎉 *PROMOCIÓN ESPECIAL CREA ARTE — HOLA {cliente}*\n\nDurante esta semana contamos con *20% DE DESCUENTO* en Rótulos Corpóreos 3D, Cajas de Luz LED y Fachadas en Alucobond (Ref. {orden}).\n\n✅ Incluye montaje fotográfico 3D sin costo.\n👉 Responda *PROMO* y su asesor *{ejecutivo}* actualizará su proforma hoy mismo.',
                    },
                    {
                      label: '📢 Seguimiento Leads Meta Ads',
                      text: '👋 ¡Hola *{cliente}*! Le saludamos de *Crea Arte* respecto a su consulta en nuestra campaña publicitaria ({orden}).\n\n🎁 Si confirma su pedido hoy con el 50% de anticipo, le incluimos *el diseño y vectorizado sin recargo*.\n¿Desea que *{ejecutivo}* le envíe su Proforma PDF actualizada?',
                    },
                    {
                      label: '⭐ Beneficio VIP / Clientes Recurrentes',
                      text: '⭐ *BENEFICIO CLIENTE PREFERENCIAL CREA ARTE*\nEstimados *{cliente}*, por ser parte de nuestra cartera VIP tienen *prioridad en cola de impresión RIP y 15% de descuento por volumen* en Lonas, Viniles Microperforados y Señalética.\n\nSu ejecutivo de cuenta *{ejecutivo}* queda atento a sus requerimientos de este mes.',
                    },
                    {
                      label: '🔄 Reactivación / Renovación de Imagen',
                      text: '✨ *RENUEVA LA IMAGEN DE TU NEGOCIO CON CREA ARTE*\nHola *{cliente}*, tenemos tarifas especiales en renovación de viniles de vidriera, mantenimiento de letreros luminosos LED y lonas promocionales.\n\nEscríbenos las medidas aproximadas y te cotizamos en 5 minutos.',
                    },
                  ].map((tpl) => (
                    <button
                      key={tpl.label}
                      type="button"
                      onClick={() => setBatchPromoMessage(tpl.text)}
                      className="p-2 text-left text-[11px] font-semibold bg-slate-50 hover:bg-indigo-50 dark:bg-slate-950 dark:hover:bg-indigo-950/50 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-800 rounded-lg transition-colors"
                    >
                      {tpl.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Mensaje Personalizado para el Lote ({effectiveTargets.length} destinatarios):
                </label>
                <textarea
                  rows={7}
                  value={batchPromoMessage}
                  onChange={(e) => setBatchPromoMessage(e.target.value)}
                  className="w-full p-3 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                />
              </div>

              <button
                type="button"
                onClick={handleDispatchBatchPromo}
                className="w-full py-3 px-4 text-xs font-bold bg-fuchsia-600 hover:bg-fuchsia-500 text-white rounded-xl shadow-sm inline-flex items-center justify-center gap-2 transition-all"
              >
                <Send className="w-4 h-4" />
                <span>
                  🚀 Enviar Promoción al Lote Seleccionado ({effectiveTargets.length} chats)
                </span>
              </button>

              {lastSentBatchReport && (
                <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-900 dark:text-emerald-300">
                      ✅ Lote Enviado ({lastSentBatchReport.count} destinatarios · {lastSentBatchReport.sentAt})
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveView('inbox')}
                      className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                    >
                      Ver en Bandeja Chat →
                    </button>
                  </div>
                  <div className="max-h-40 overflow-y-auto divide-y divide-emerald-200/60 dark:divide-emerald-800/50 text-[11px]">
                    {lastSentBatchReport.items.map((it) => (
                      <div key={it.orderId} className="py-1.5 flex items-center justify-between gap-2">
                        <div className="truncate">
                          <strong className="font-mono text-emerald-900 dark:text-emerald-200">
                            {it.orderId}
                          </strong>{' '}
                          · {it.clientName} ({it.phone})
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedOrderId(it.orderId);
                            setActiveView('inbox');
                          }}
                          className="px-2 py-0.5 rounded bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 font-semibold shrink-0"
                        >
                          Abrir Chat
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* VISTA 3: ESTUDIO DEL BOT & MENÚ CONVERSACIONAL (1 AL 6) + REGLAS */}
      {activeView === 'bot_studio' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Columna Izquierda: Diccionario Interactivo del Bot (Comandos 1 al 6) */}
          <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Bot className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span>Menú Conversacional del Bot WhatsApp (Comandos 1 al 6)</span>
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Cuando el cliente escribe el número o la palabra clave, el Bot consulta o actualiza el ERP automáticamente.
                </p>
              </div>
              {activeOrder && (
                <span className="px-2.5 py-1 text-xs font-mono font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded shrink-0">
                  Orden en prueba: {activeOrder.id}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                {
                  cmd: '1 / ESTADO / AVANCE',
                  title: '1️⃣ Consulta de Etapa en Vivo',
                  desc: 'El Bot lee la orden en el Kanban y responde con la etapa actual, medidas, si el arte está aprobado y la fecha de entrega.',
                  actionLabel: 'Probar Comando 1',
                  scenario: 'ESTADO' as const,
                },
                {
                  cmd: '2 / SALDO / BANCOS',
                  title: '2️⃣ Estado de Cuenta y Bancos',
                  desc: 'Calcula Total, Abonado y Saldo Pendiente al instante, adjuntando las cuentas oficiales de Banco Pichincha y Guayaquil.',
                  actionLabel: 'Probar Comando 2',
                  scenario: 'SALDO' as const,
                },
                {
                  cmd: '3 / APROBADO / IMPRIMIR',
                  title: '3️⃣ Aprobación Automática de Arte',
                  desc: 'Marca "Arte Aprobado", avanza la tarjeta en el Kanban a Impresión (o Listo Digital) y descuenta el material de bodega.',
                  actionLabel: 'Probar Comando 3',
                  scenario: 'APROBADO' as const,
                },
                {
                  cmd: '4 / CORRECCION / CAMBIO',
                  title: '4️⃣ Solicitud de Ajuste de Diseño',
                  desc: 'Regresa automáticamente la orden a la columna "En Diseño y Arte", guarda la observación y alerta al diseñador.',
                  actionLabel: 'Probar Comando 4',
                  scenario: 'CORRECCION' as const,
                },
                {
                  cmd: '5 / COMPROBANTE / PAGO',
                  title: '5️⃣ Recepción de Transferencia',
                  desc: 'Registra acuse de recibo del comprobante bancario enviado por el cliente y notifica a Caja para emitir el recibo.',
                  actionLabel: 'Probar Comando 5',
                  scenario: 'COMPROBANTE' as const,
                },
                {
                  cmd: 'HOLA / MENU / 6 / HORARIO',
                  title: '6️⃣ Menú Principal y Ubicación',
                  desc: 'Despliega el menú interactivo de bienvenida (opciones 1 a 6) o envía la dirección de planta y horarios de retiro.',
                  actionLabel: 'Probar Menú Bot',
                  scenario: 'MENU' as const,
                },
              ].map((item) => (
                <div
                  key={item.cmd}
                  className="p-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg flex flex-col justify-between space-y-2.5"
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-slate-900 dark:text-white">
                        {item.title}
                      </span>
                    </div>
                    <div className="text-[10px] font-mono font-semibold text-indigo-600 dark:text-indigo-400">
                      Disparador: {item.cmd}
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                      {item.desc}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      handleSimulateClientScenario(item.scenario);
                      setActiveView('inbox');
                    }}
                    className="w-full px-2.5 py-1.5 text-[11px] font-semibold bg-white dark:bg-slate-900 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded inline-flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Zap className="w-3 h-3" />
                    <span>{item.actionLabel} en el Chat</span>
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Columna Derecha: Las 6 Reglas de Automatización del ERP */}
          <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-4">
            <div className="border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>6 Reglas de Disparo Automático por Eventos del Taller</span>
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Activa o pausa qué mensajes envía el Bot automáticamente cuando el equipo trabaja en el ERP.
              </p>
            </div>

            <div className="space-y-2.5 text-xs">
              {[
                {
                  key: 'autoWelcomeOnOrderCreated' as const,
                  checked: waConfig.autoWelcomeOnOrderCreated !== false,
                  title: '1. Bienvenida + Solicitud de 50% Anticipo',
                  desc: 'Se envía al instante al crear una orden desde el Cotizador.',
                },
                {
                  key: 'autoSendArtApproval' as const,
                  checked: waConfig.autoSendArtApproval !== false,
                  title: '2. Solicitud de Aprobación de Arte',
                  desc: 'Se envía al mover la orden a "Aprobación del Cliente" en el Kanban.',
                },
                {
                  key: 'autoProcessClientKeywords' as const,
                  checked: waConfig.autoProcessClientKeywords !== false,
                  title: '3. Bot Interactivo 24/7 (Comandos 1 al 6)',
                  desc: 'Responde consultas de estado, saldo, aprueba arte o regresa a diseño.',
                },
                {
                  key: 'autoNotifyProductionStart' as const,
                  checked: waConfig.autoNotifyProductionStart !== false,
                  title: '4. Aviso de Entrada a Máquina / Taller 3D',
                  desc: 'Notifica al cliente cuando su orden entra a Impresión o Armado 3D.',
                },
                {
                  key: 'autoSendStageNotifications' as const,
                  checked: waConfig.autoSendStageNotifications,
                  title: '5. Aviso de Pedido Listo + Saldo Exigible',
                  desc: 'Notifica cuando el trabajo está en "Instalación / Listo para Retiro".',
                },
                {
                  key: 'autoReceiptOnPayment' as const,
                  checked: waConfig.autoReceiptOnPayment !== false,
                  title: '6. Recibo Digital Automático de Caja',
                  desc: 'Envía recibo detallado al registrar cualquier abono o liquidación.',
                },
              ].map((rule) => (
                <label
                  key={rule.key}
                  className="flex items-start gap-2.5 p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg cursor-pointer hover:border-blue-400 transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={rule.checked}
                    onChange={(e) =>
                      onUpdateWaConfig({
                        ...waConfig,
                        [rule.key]: e.target.checked,
                      })
                    }
                    className="mt-0.5 rounded border-slate-300 text-blue-600"
                  />
                  <div>
                    <div className="font-bold text-slate-900 dark:text-white">
                      {rule.title}
                    </div>
                    <div className="text-[11px] text-slate-600 dark:text-slate-400">
                      {rule.desc}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* VISTA 3: PANEL DE CONFIGURACIÓN META CLOUD API / WEBHOOK (ADMINISTRADOR) */}
      {activeView === 'api_settings' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {!isAdmin ? (
            <div className="lg:col-span-12 p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-center space-y-2">
              <ShieldAlert className="w-8 h-8 text-amber-500 mx-auto" />
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Acceso Exclusivo para Administrador / Gerente
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Cambia al perfil "Administrador / Gerente (Ing. Carlos Mendoza)" en el selector superior para editar las credenciales de Meta WhatsApp Cloud API.
              </p>
            </div>
          ) : (
            <>
              <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-6 space-y-5">
                <div className="border-b border-slate-200 dark:border-slate-800 pb-3 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                      Credenciales Meta WhatsApp Business Cloud API (Graph v21.0)
                    </h3>
                    <p className="text-xs text-slate-500">
                      Configuración exclusiva de Administrador persistida automáticamente en LocalStorage.
                    </p>
                  </div>
                </div>

                {/* Conmutador de Modo de Conexión Dual */}
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200">
                    1. Selecciona el Modo de Conexión Activo
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateWaConfig({ ...waConfig, mode: 'direct_wa_me' })
                      }
                      className={`p-3 rounded-md border text-left transition-colors ${
                        waConfig.mode === 'direct_wa_me'
                          ? 'bg-blue-50/80 dark:bg-blue-950/40 border-blue-600'
                          : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800'
                      }`}
                    >
                      <div className="text-xs font-bold text-slate-900 dark:text-white">
                        Modo 1: Directo (wa.me / WhatsApp Web)
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        No requiere servidor ni cuenta de Meta Developer. Registra en CRM y copia el mensaje listo.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        onUpdateWaConfig({ ...waConfig, mode: 'meta_cloud_api' })
                      }
                      className={`p-3 rounded-md border text-left transition-colors ${
                        waConfig.mode === 'meta_cloud_api'
                          ? 'bg-blue-50/80 dark:bg-blue-950/40 border-blue-600'
                          : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800'
                      }`}
                    >
                      <div className="text-xs font-bold text-slate-900 dark:text-white">
                        Modo 2: Meta Cloud API Oficial (v21.0)
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Despacha peticiones HTTP POST directas a graph.facebook.com usando tu Phone Number ID y Token.
                      </p>
                    </button>
                  </div>
                </div>

                {/* Campos de Credenciales Meta */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Phone Number ID (Identificador de Teléfono)
                    </label>
                    <input
                      type="text"
                      value={waConfig.phoneNumberId}
                      onChange={(e) =>
                        onUpdateWaConfig({ ...waConfig, phoneNumberId: e.target.value })
                      }
                      placeholder="Ej. 109482716509182"
                      className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      WABA ID (WhatsApp Business Account ID)
                    </label>
                    <input
                      type="text"
                      value={waConfig.wabaId}
                      onChange={(e) =>
                        onUpdateWaConfig({ ...waConfig, wabaId: e.target.value })
                      }
                      placeholder="Ej. 982736451092837"
                      className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Access Token Permanente o Temporal (Bearer Token de Meta)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type={showToken ? 'text' : 'password'}
                      value={waConfig.accessToken}
                      onChange={(e) =>
                        onUpdateWaConfig({ ...waConfig, accessToken: e.target.value })
                      }
                      placeholder="EAAGm0PX4ZCpsBO..."
                      className="flex-1 px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-white"
                    />
                    <button
                      type="button"
                      onClick={() => setShowToken(!showToken)}
                      className="px-3 py-2 text-xs bg-slate-100 dark:bg-slate-800 rounded text-slate-700 dark:text-slate-300"
                    >
                      {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Endpoint de Webhook (Para recibir mensajes)
                    </label>
                    <input
                      type="text"
                      value={waConfig.webhookUrl}
                      onChange={(e) =>
                        onUpdateWaConfig({ ...waConfig, webhookUrl: e.target.value })
                      }
                      className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Webhook Verify Token
                    </label>
                    <input
                      type="text"
                      value={waConfig.verifyToken}
                      onChange={(e) =>
                        onUpdateWaConfig({ ...waConfig, verifyToken: e.target.value })
                      }
                      className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                <div className="pt-2 flex flex-wrap items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={handleTestMetaConnection}
                    className="px-3.5 py-2 text-xs font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded inline-flex items-center gap-1.5"
                  >
                    <Activity className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Probar Conexión API</span>
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const resp = await fetch('/api/whatsapp/save-permanent-config', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            phoneNumberId: waConfig.phoneNumberId,
                            wabaId: waConfig.wabaId,
                            accessToken: waConfig.accessToken,
                            appId: metaAppId,
                            appSecret: metaAppSecret,
                          }),
                        });
                        const data = await resp.json();
                        setApiTestStatus(
                          data?.detail ||
                            'Token permanente fijado en el servidor backend para toda la empresa.'
                        );
                        onNotify(
                          '🔒 Credenciales permanentes fijadas en el servidor y en LocalStorage'
                        );
                      } catch {
                        onNotify('Configuración de Meta Cloud API guardada en LocalStorage');
                      }
                    }}
                    className="px-4 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded inline-flex items-center gap-1.5 shadow-2xs"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>🔒 Fijar Token Permanente en Servidor</span>
                  </button>
                </div>

                {/* BLOQUE DE CANJE AUTOMÁTICO DE TOKEN (EVITA REGENERAR CADA 24H EN DEVELOPERS) */}
                <div className="p-4 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/80 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5">
                      <RefreshCw className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                      <span>
                        Auto-Canje en Servidor: Convertir Token Temporal (24h) en Larga Duración
                      </span>
                    </span>
                    <span className="px-2 py-0.5 text-[10px] font-bold bg-indigo-600 text-white rounded">
                      Opcional
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                    Si solo tienes el código temporal de <em>Meta Developers</em>, ingresa tu{' '}
                    <strong>App ID</strong> y <strong>App Secret</strong> una sola vez aquí y el
                    servidor lo canjeará automáticamente por un token extendido.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      type="text"
                      value={metaAppId}
                      onChange={(e) => setMetaAppId(e.target.value)}
                      placeholder="Meta App ID (Ej. 1283948571920)"
                      className="px-3 py-1.5 text-xs font-mono bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 rounded text-slate-900 dark:text-white"
                    />
                    <input
                      type="password"
                      value={metaAppSecret}
                      onChange={(e) => setMetaAppSecret(e.target.value)}
                      placeholder="Meta App Secret (Clave secreta)"
                      className="px-3 py-1.5 text-xs font-mono bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 rounded text-slate-900 dark:text-white"
                    />
                  </div>
                  <button
                    type="button"
                    disabled={isExchangingToken}
                    onClick={async () => {
                      setIsExchangingToken(true);
                      try {
                        const resp = await fetch('/api/whatsapp/exchange-token', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            appId: metaAppId,
                            appSecret: metaAppSecret,
                            shortLivedToken: waConfig.accessToken,
                            phoneNumberId: waConfig.phoneNumberId,
                            wabaId: waConfig.wabaId,
                          }),
                        });
                        const data = await resp.json();
                        if (data?.ok && data?.newAccessToken) {
                          onUpdateWaConfig({
                            ...waConfig,
                            accessToken: data.newAccessToken,
                          });
                          setApiTestStatus(`✅ ${data.detail}`);
                          onNotify('Token canjeado y fijado en el servidor exitosamente.');
                        } else {
                          setApiTestStatus(`⚠️ ${data?.error || 'No se pudo canjear el token.'}`);
                        }
                      } catch (err: any) {
                        setApiTestStatus(`Error de red al canjear token: ${err?.message || 'Error'}`);
                      } finally {
                        setIsExchangingToken(false);
                      }
                    }}
                    className="w-full py-2 px-3 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg inline-flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isExchangingToken ? 'animate-spin' : ''}`} />
                    <span>
                      {isExchangingToken
                        ? 'Canjeando contra graph.facebook.com...'
                        : '🔄 Canjear Ahora y Guardar en Bóveda del Servidor'}
                    </span>
                  </button>
                </div>

                {apiTestStatus && (
                  <div className="p-3 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded text-xs font-mono text-slate-700 dark:text-slate-300">
                    {apiTestStatus}
                  </div>
                )}
              </div>

              {/* Columna Derecha: Solución Definitiva para NO regenerar códigos cada 24h + Inspector */}
              <div className="lg:col-span-5 space-y-4">
                <div className="bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/80 rounded-lg p-5 space-y-3">
                  <h4 className="text-xs font-bold text-emerald-950 dark:text-emerald-200 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>
                      Solución Definitiva: Cómo sacar el Token que NUNCA CADUCA (1 sola vez)
                    </span>
                  </h4>
                  <p className="text-[11px] text-emerald-900/90 dark:text-emerald-200/90 leading-relaxed">
                    El código que sale en <em>developers.facebook.com</em> dura solo 24 horas porque es de prueba. Para <strong>no volver a generar códigos nunca más</strong>, sácalo desde <strong>Meta Business Suite</strong> así:
                  </p>
                  <ol className="text-xs text-slate-700 dark:text-slate-300 space-y-2 list-decimal list-inside leading-relaxed">
                    <li>
                      Entra a <strong>business.facebook.com/settings/system-users</strong> (Configuración del Negocio &gt; Usuarios &gt; <strong>Usuarios del sistema</strong>).
                    </li>
                    <li>
                      Haz clic en <strong>Añadir</strong>, ponle de nombre <code>ERP Crea Arte</code> y rol <strong>Administrador</strong>.
                    </li>
                    <li>
                      Haz clic en <strong>Asignar activos</strong> &gt; selecciona tu <strong>App</strong> y tu <strong>Cuenta de WhatsApp Business</strong> con control total.
                    </li>
                    <li>
                      Pulsa <strong>Generar nuevo token</strong>, elige tu App y en <strong>Caducidad del token</strong> selecciona <strong>«Nunca» (Never)</strong>. Marca los permisos <code>whatsapp_business_messaging</code> y <code>whatsapp_business_management</code>.
                    </li>
                    <li>
                      Pega ese token aquí a la izquierda y pulsa <strong>🔒 Fijar Token Permanente en Servidor</strong>. ¡Listo! Ese código dura para siempre.
                    </li>
                  </ol>
                </div>

                {/* TARJETA DE PUENTE Y COEXISTENCIA CON KOMMO CRM */}
                <div className="bg-fuchsia-50/70 dark:bg-fuchsia-950/30 border border-fuchsia-200 dark:border-fuchsia-800/80 rounded-lg p-5 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-xs font-bold text-fuchsia-950 dark:text-fuchsia-200 flex items-center gap-1.5">
                      <Share2 className="w-4 h-4 text-fuchsia-600 shrink-0" />
                      <span>¿Tienes tu número conectado a Kommo CRM?</span>
                    </h4>
                    <span className="px-2 py-0.5 text-[10px] font-bold bg-fuchsia-600 text-white rounded">
                      Compatible
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-700 dark:text-slate-300 leading-relaxed">
                    Puedes usar el <strong>mismo número de WhatsApp API</strong> al mismo tiempo en Kommo y aquí en <strong>Crea Arte ERP</strong>:
                  </p>
                  <ul className="text-xs text-slate-700 dark:text-slate-300 space-y-1.5 list-disc list-inside leading-relaxed">
                    <li>
                      <strong>Para ENVIAR desde Crea Arte:</strong> Como tu número ya está en Meta Cloud API, solo pega el mismo <code>Phone Number ID</code> y tu <code>Token Permanente</code> a la izquierda. Ambos sistemas pueden enviar mensajes sin desconectar Kommo.
                    </li>
                    <li>
                      <strong>Para RECIBIR los chats de Kommo aquí en vivo:</strong> En Kommo ve a <strong>Ajustes &gt; Integraciones &gt; Webhooks</strong> (o en tu Salesbot) y pega esta URL de puente:
                    </li>
                  </ul>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={`${window.location.origin}/api/whatsapp/webhook`}
                      className="flex-1 px-2.5 py-1.5 text-[11px] font-mono bg-white dark:bg-slate-900 border border-fuchsia-300 dark:border-fuchsia-800 rounded text-slate-800 dark:text-slate-200"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        void copyTextToClipboardSafe(
                          `${window.location.origin}/api/whatsapp/webhook`
                        );
                        onNotify('URL de Webhook para Kommo CRM copiada al portapapeles');
                      }}
                      className="px-3 py-1.5 text-xs font-bold bg-fuchsia-600 hover:bg-fuchsia-500 text-white rounded inline-flex items-center gap-1 shrink-0"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copiar URL</span>
                    </button>
                  </div>
                </div>

                <div className="bg-slate-900 text-slate-100 border border-slate-800 rounded-lg p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-blue-400">
                      ENDPOINT GRAPH API GENERADO
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        void copyTextToClipboardSafe(
                          `https://graph.facebook.com/v21.0/${waConfig.phoneNumberId}/messages`
                        );
                        onNotify('URL de Endpoint copiada al portapapeles');
                      }}
                      className="text-xs text-slate-400 hover:text-white inline-flex items-center gap-1"
                    >
                      <Copy className="w-3.5 h-3.5" /> Copiar URL
                    </button>
                  </div>
                  <div className="p-2.5 bg-slate-950 rounded border border-slate-800 text-[11px] font-mono text-emerald-400 break-all">
                    POST https://graph.facebook.com/v21.0/{waConfig.phoneNumberId}/messages
                  </div>
                  <pre className="p-3 bg-slate-950 rounded border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto">
                    {JSON.stringify(
                      {
                        messaging_product: 'whatsapp',
                        recipient_type: 'individual',
                        to: activeOrder?.clientPhone.replace(/[^0-9]/g, '') || '593993128840',
                        type: 'text',
                        text: {
                          preview_url: false,
                          body: `Actualización Crea Arte Orden ${activeOrder?.id || '#CA-001'}: Estado actual "${activeOrder?.stage || 'En Producción'}".`,
                        },
                      },
                      null,
                      2
                    )}
                  </pre>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* MODAL DE CONFIRMACIÓN ANTES DE ELIMINAR UN ARCHIVO DE GOOGLE DRIVE */}
      {driveFileToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-md w-full p-5 space-y-4 shadow-xl">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  ¿Eliminar archivo de Google Drive?
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Estás a punto de eliminar permanentemente el archivo{' '}
                  <strong className="text-slate-900 dark:text-white">
                    {driveFileToDelete.name}
                  </strong>{' '}
                  de la carpeta de Google Drive del proyecto.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setDriveFileToDelete(null)}
                disabled={isWorkingDrive}
                className="px-3.5 py-2 text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteDriveFile}
                disabled={isWorkingDrive}
                className="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-lg inline-flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isWorkingDrive ? 'Eliminando...' : 'Sí, Eliminar de Drive'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL RÁPIDO PARA ENVIAR PROMOCIÓN / MENSAJE A TODO EL LOTE FILTRADO DESDE LA BANDEJA */}
      {showQuickBatchModal && (() => {
        const targetOrders = filteredChatOrders.filter(
          (o) => batchSelectedOrderIds.length === 0 || batchSelectedOrderIds.includes(o.id)
        );

        const handleSendQuickBatchNow = () => {
          if (targetOrders.length === 0) {
            onNotify('Selecciona al menos un contacto del lote para enviar el mensaje.');
            return;
          }
          if (!batchPromoMessage.trim()) {
            onNotify('Escribe el mensaje promocional antes de enviar.');
            return;
          }
          const ch = waConfig.mode === 'meta_cloud_api' ? 'meta_cloud_api' : 'wa_direct';
          const sentItems: { orderId: string; clientName: string; phone: string; text: string }[] = [];
          targetOrders.forEach((ord) => {
            const info = getClientInfoForOrder(ord);
            const execName = getUserName(getOrderCrmAgentId(ord));
            const personalized = batchPromoMessage
              .replace(/\{cliente\}/gi, ord.clientName)
              .replace(/\{orden\}/gi, ord.id)
              .replace(/\{etapa\}/gi, info.crmLeadStage)
              .replace(/\{ejecutivo\}/gi, execName);
            onSendMessage(ord.id, personalized, ch);
            if (ch === 'meta_cloud_api') {
              void dispatchViaMetaCloudApi(ord.clientPhone, personalized);
            }
            sentItems.push({
              orderId: ord.id,
              clientName: ord.clientName,
              phone: ord.clientPhone,
              text: personalized,
            });
          });
          setLastSentBatchReport({
            sentAt: new Date().toLocaleTimeString(),
            count: sentItems.length,
            items: sentItems,
          });
          onNotify(
            `🚀 Promoción enviada con éxito al lote completo (${sentItems.length} conversaciones actualizadas)`
          );
        };

        return (
          <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto">
              <div className="flex items-center justify-between gap-2 px-5 py-3.5 bg-slate-900 text-white border-b border-slate-800 shrink-0">
                <div className="flex items-center gap-2">
                  <Megaphone className="w-4 h-4 text-fuchsia-400" />
                  <h3 className="text-sm font-bold">
                    Enviar Promoción / Mensaje al Lote Filtrado ({targetOrders.length} contactos)
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowQuickBatchModal(false)}
                  className="p-1 text-slate-400 hover:text-white rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 space-y-4 overflow-y-auto flex-1">
                {/* Destinatarios del Lote */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      1. Destinatarios incluidos en tu filtro actual ({targetOrders.length} de {filteredChatOrders.length}):
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setBatchSelectedOrderIds(filteredChatOrders.map((o) => o.id))}
                        className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        Marcar Todos
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowQuickBatchModal(false);
                          setActiveView('batch_broadcast');
                        }}
                        className="text-[11px] font-semibold text-fuchsia-600 dark:text-fuchsia-400 hover:underline"
                      >
                        Ir a Selector Avanzado por Etiquetas →
                      </button>
                    </div>
                  </div>

                  <div className="max-h-36 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-xl divide-y divide-slate-100 dark:divide-slate-800 bg-slate-50 dark:bg-slate-950 p-2">
                    {filteredChatOrders.map((ord) => {
                      const info = getClientInfoForOrder(ord);
                      const isChecked =
                        batchSelectedOrderIds.length === 0 ||
                        batchSelectedOrderIds.includes(ord.id);
                      return (
                        <label
                          key={ord.id}
                          className="flex items-center justify-between gap-2 py-1.5 px-2 text-xs cursor-pointer hover:bg-white dark:hover:bg-slate-900 rounded"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                setBatchSelectedOrderIds((prev) => {
                                  const base =
                                    prev.length === 0 ? filteredChatOrders.map((o) => o.id) : prev;
                                  return base.includes(ord.id)
                                    ? base.filter((id) => id !== ord.id)
                                    : [...base, ord.id];
                                });
                              }}
                              className="rounded border-slate-300 text-fuchsia-600"
                            />
                            <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                              {ord.id}
                            </span>
                            <span className="font-semibold text-slate-900 dark:text-white truncate">
                              {ord.clientName}
                            </span>
                            <span className="font-mono text-[11px] text-slate-500">
                              {ord.clientPhone}
                            </span>
                          </div>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 shrink-0">
                            {info.crmLeadStage}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Plantillas en 1 clic */}
                <div className="space-y-1.5">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                    2. Elige una Plantilla Rápida o personaliza el mensaje:
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {[
                      {
                        label: '🏷️ Promo Rótulos 3D & LED (-20% Off)',
                        text: '🎉 *PROMOCIÓN ESPECIAL CREA ARTE — HOLA {cliente}*\n\nDurante esta semana contamos con *20% DE DESCUENTO* en Rótulos Corpóreos 3D, Cajas de Luz LED y Fachadas en Alucobond (Ref. {orden}).\n\n✅ Incluye montaje fotográfico 3D sin costo.\n👉 Responda *PROMO* y su asesor *{ejecutivo}* actualizará su proforma hoy mismo.',
                      },
                      {
                        label: '📢 Seguimiento Leads Meta Ads',
                        text: '👋 ¡Hola *{cliente}*! Le saludamos de *Crea Arte* respecto a su consulta en nuestra campaña publicitaria ({orden}).\n\n🎁 Si confirma su pedido hoy con el 50% de anticipo, le incluimos *el diseño y vectorizado sin recargo*.\n¿Desea que *{ejecutivo}* le envíe su Proforma PDF actualizada?',
                      },
                      {
                        label: '⭐ Beneficio VIP / Clientes Recurrentes',
                        text: '⭐ *BENEFICIO CLIENTE PREFERENCIAL CREA ARTE*\nEstimados *{cliente}*, por ser parte de nuestra cartera VIP tienen *prioridad en cola de impresión RIP y 15% de descuento por volumen* en Lonas, Viniles Microperforados y Señalética.\n\nSu ejecutivo de cuenta *{ejecutivo}* queda atento a sus requerimientos de este mes.',
                      },
                      {
                        label: '🔄 Reactivación / Renovación de Imagen',
                        text: '✨ *RENUEVA LA IMAGEN DE TU NEGOCIO CON CREA ARTE*\nHola *{cliente}*, tenemos tarifas especiales en renovación de viniles de vidriera, mantenimiento de letreros luminosos LED y lonas promocionales.\n\nEscríbenos las medidas aproximadas y te cotizamos en 5 minutos.',
                      },
                    ].map((tpl) => (
                      <button
                        key={tpl.label}
                        type="button"
                        onClick={() => setBatchPromoMessage(tpl.text)}
                        className="p-2 text-left text-[11px] font-semibold bg-slate-50 hover:bg-indigo-50 dark:bg-slate-950 dark:hover:bg-indigo-950/50 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-800 rounded-lg transition-colors"
                      >
                        {tpl.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Mensaje */}
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    3. Mensaje a enviar (reemplaza automáticamente <code>{'{cliente}'}</code>,{' '}
                    <code>{'{orden}'}</code>, <code>{'{ejecutivo}'}</code>):
                  </label>
                  <textarea
                    rows={5}
                    value={batchPromoMessage}
                    onChange={(e) => setBatchPromoMessage(e.target.value)}
                    className="w-full p-3 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                  />
                </div>

                {lastSentBatchReport && (
                  <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-900 dark:text-emerald-200 font-semibold">
                    ✅ ¡Enviado con éxito a {lastSentBatchReport.count} contactos del lote a las{' '}
                    {lastSentBatchReport.sentAt}! Ya puedes ver el mensaje dentro del chat de cada cliente.
                  </div>
                )}
              </div>

              <div className="px-5 py-3.5 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowQuickBatchModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl"
                >
                  Cerrar
                </button>
                <button
                  type="button"
                  onClick={handleSendQuickBatchNow}
                  disabled={targetOrders.length === 0}
                  className="px-5 py-2.5 text-xs font-bold bg-fuchsia-600 hover:bg-fuchsia-500 disabled:opacity-40 text-white rounded-xl shadow-sm inline-flex items-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  <span>
                    🚀 Confirmar y Enviar a Todo el Lote ({targetOrders.length} contactos)
                  </span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL PARA EDITAR ENCABEZADO CORPORATIVO, CONDICIONES Y DATOS DE LA PROFORMA */}
      <ProformaTemplateEditorModal
        isOpen={showProformaEditorModal}
        onClose={() => setShowProformaEditorModal(false)}
        activeOrder={activeOrder}
        currentUserName={currentUser.name}
        onUpdateOrder={onUpdateOrder}
        onNotify={onNotify}
      />

      {/* MODAL LIGHTBOX PARA AMPLIAR IMÁGENES Y BOCETOS ENVIADOS EN EL CHAT */}
      {lightboxImage && (
        <div
          onClick={() => setLightboxImage(null)}
          className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-slate-900 border border-slate-700 rounded-2xl max-w-4xl w-full overflow-hidden shadow-2xl"
          >
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                🖼️ {lightboxImage.name}
              </span>
              <div className="flex items-center gap-2">
                <a
                  href={lightboxImage.url}
                  download={lightboxImage.name}
                  className="px-3 py-1 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg"
                >
                  ⬇ Descargar Imagen
                </a>
                <button
                  type="button"
                  onClick={() => setLightboxImage(null)}
                  className="px-2.5 py-1 text-xs font-bold bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-lg"
                >
                  Cerrar ✕
                </button>
              </div>
            </div>
            <div className="p-4 bg-slate-950 flex items-center justify-center max-h-[80vh] overflow-auto">
              <img
                src={lightboxImage.url}
                alt={lightboxImage.name}
                className="max-h-[72vh] w-auto object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

