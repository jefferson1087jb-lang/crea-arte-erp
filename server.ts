import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  // Permitir payloads PDF/imagen en base64 de hasta 20MB + Webhooks de Kommo CRM (x-www-form-urlencoded)
  app.use(express.json({ limit: '20mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Endpoint para interpretar Facturas PDF / Imágenes de Proveedores y transformarlas a unidades de inventario
  app.post('/api/invoices/parse-pdf', async (req, res) => {
    try {
      const { base64Data, mimeType, fileName, currentInventory } = req.body;

      if (!base64Data) {
        return res.status(400).json({ error: 'No se recibió contenido del archivo PDF.' });
      }

      if (!process.env.GEMINI_API_KEY) {
        return res.status(200).json({
          error: 'GEMINI_API_KEY no disponible en el servidor; usando motor local de extracción PDF.',
          warning:
            'GEMINI_API_KEY no configurada en el servidor. Se activó automáticamente el Motor OCR Local de respaldo.',
          fallbackRequired: true,
        });
      }

      const geminiModel = process.env.GEMINI_MODEL || 'gemini-3.8-flash';

      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const inventoryContext = Array.isArray(currentInventory)
        ? currentInventory
            .map(
              (i: any) =>
                `ID: "${i.id}" | SKU: "${i.sku}" | Nombre: "${i.name}" | Categoría: "${i.category}" | Unidad Taller: "${i.unit}" | Costo actual: $${i.unitCost}`
            )
            .join('\n')
        : '';

      const promptText = `Eres un auditor contable y jefe de bodega de un taller de gigantografía, impresión gran formato y rótulos 3D ("Crea Arte").
Analiza el documento de factura adjunto (Nombre de archivo: "${fileName || 'factura.pdf'}") e interpreta todos sus datos fiscales y líneas de materiales comprados.

CATÁLOGO ACTUAL DE INVENTARIO DEL TALLER:
${inventoryContext}

REGLAS CRÍTICAS DE TRANSFORMACIÓN DE UNIDADES (COMPRA PROVEEDOR -> BODEGA TALLER):
1. Si la factura vende por "Rollo" o "Bobina" (ej. "Rollo Lona Frontlight 3.20x50m" o "Bobina Vinil 1.52x50m"):
   - Calcula cuántos m² tiene cada rollo (ancho_m * largo_m, ej. 3.20 * 50 = 160 m² por rollo, o 1.52 * 50 = 76 m² por rollo).
   - "purchaseQty" es la cantidad de rollos en factura (ej. 2).
   - "purchaseUnit" es "Rollo 3.20x50m" o la unidad facturada.
   - "conversionFactor" es los m² por rollo (ej. 160).
   - "warehouseQty" es purchaseQty * conversionFactor (ej. 320 m²).
   - "warehouseUnit" es "m2".
   - "warehouseUnitCost" es el subtotal de la línea dividido entre "warehouseQty" (costo real por m²).
2. Si la factura vende en "Planchas" (ej. Acrílico, ACM Alucobond, Sintra PVC 1.22x2.44m):
   - "conversionFactor" = 1, "warehouseUnit" = "plancha".
3. Si la factura vende en "Litros" (ej. Tintas) o "Unidades" (ej. Módulos LED, Fuentes):
   - "conversionFactor" = 1, "warehouseUnit" = "litro" o "unidad".
4. En "matchedInventoryId", asigna el ID exacto del catálogo actual si corresponde al mismo material, o "NEW_ITEM" si es un material nuevo que no existe en el catálogo.`;

      const response = await ai.models.generateContent({
        model: geminiModel,
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: mimeType || 'application/pdf',
                data: base64Data,
              },
            },
            { text: promptText },
          ],
        },
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              supplierName: { type: Type.STRING, description: 'Nombre o Razón Social del proveedor' },
              supplierRuc: { type: Type.STRING, description: 'RUC, NIT o identificación fiscal del proveedor' },
              invoiceNumber: { type: Type.STRING, description: 'Número de factura o serie (ej. FAC-001-004821)' },
              issueDate: { type: Type.STRING, description: 'Fecha de emisión en formato YYYY-MM-DD' },
              subtotal: { type: Type.NUMBER, description: 'Subtotal sin impuestos en USD' },
              taxAmount: { type: Type.NUMBER, description: 'Monto de IVA / IGV en USD' },
              totalAmount: { type: Type.NUMBER, description: 'Total de la factura en USD' },
              suggestedPaymentMethod: {
                type: Type.STRING,
                description: 'Transferencia Bancaria, Efectivo o Tarjeta',
              },
              items: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    rawDescription: {
                      type: Type.STRING,
                      description: 'Descripción original tal como aparece en la factura PDF',
                    },
                    matchedInventoryId: {
                      type: Type.STRING,
                      description: 'ID del insumo existente en el catálogo (ej. inv-lona-front) o NEW_ITEM',
                    },
                    suggestedSku: {
                      type: Type.STRING,
                      description: 'SKU sugerido si es nuevo o SKU existente',
                    },
                    suggestedName: {
                      type: Type.STRING,
                      description: 'Nombre estandarizado para el inventario del taller',
                    },
                    suggestedCategory: {
                      type: Type.STRING,
                      description: 'Bobinas y Rollos, Planchas Rígidas, o Tintas y Consumibles',
                    },
                    purchaseQty: {
                      type: Type.NUMBER,
                      description: 'Cantidad facturada por el proveedor (ej. 2 rollos)',
                    },
                    purchaseUnit: {
                      type: Type.STRING,
                      description: 'Unidad en la factura (ej. Rollo 3.20x50m, Plancha 1.22x2.44m, Litro)',
                    },
                    purchaseUnitPrice: {
                      type: Type.NUMBER,
                      description: 'Precio unitario de compra según factura',
                    },
                    conversionFactor: {
                      type: Type.NUMBER,
                      description: 'Factor de multiplicación para convertir a unidad de taller (ej. 160 para rollo 3.20x50m, 1 para plancha)',
                    },
                    warehouseQty: {
                      type: Type.NUMBER,
                      description: 'Cantidad final transformada a ingresar al stock (purchaseQty * conversionFactor)',
                    },
                    warehouseUnit: {
                      type: Type.STRING,
                      description: 'm2, m_lineal, plancha, litro, o unidad',
                    },
                    warehouseUnitCost: {
                      type: Type.NUMBER,
                      description: 'Costo unitario transformado por unidad de taller (ej. $/m² o $/plancha)',
                    },
                    lineSubtotal: {
                      type: Type.NUMBER,
                      description: 'Subtotal de la línea en USD',
                    },
                  },
                  required: [
                    'rawDescription',
                    'matchedInventoryId',
                    'suggestedName',
                    'suggestedCategory',
                    'purchaseQty',
                    'purchaseUnit',
                    'purchaseUnitPrice',
                    'conversionFactor',
                    'warehouseQty',
                    'warehouseUnit',
                    'warehouseUnitCost',
                    'lineSubtotal',
                  ],
                },
              },
            },
            required: [
              'supplierName',
              'supplierRuc',
              'invoiceNumber',
              'issueDate',
              'subtotal',
              'taxAmount',
              'totalAmount',
              'items',
            ],
          },
        },
      });

      const rawText = response.text || '{}';
      const parsed = JSON.parse(rawText);
      return res.json({ source: 'gemini-ai', modelUsed: geminiModel, invoice: parsed });
    } catch (error: any) {
      console.error('Error procesando factura PDF con Gemini:', error?.message || error);
      return res.status(200).json({
        error: error?.message || 'Error al analizar el PDF en el servidor.',
        warning: `Aviso IA (${error?.message || 'Error al invocar Gemini'}): Se activó el Motor OCR Local de respaldo para interpretar la factura.`,
        fallbackRequired: true,
      });
    }
  });

  // =========================================================================
  // ENDPOINTS SEGUROS PARA WHATSAPP CLOUD API (META GRAPH API PROXY & WEBHOOK)
  // =========================================================================
  interface NormalizedMetaWebhookLead {
    id: string;
    receivedAt: string;
    processed: boolean;
    phone: string;
    profileName: string;
    text: string;
    originType: 'ctwa_ad' | 'leadgen_form' | 'organic_wa';
    referral?: {
      sourceUrl?: string;
      sourceId?: string;
      sourceType?: string;
      headline?: string;
      body?: string;
      ctwaClid?: string;
      campaignName?: string;
      receivedAt?: string;
    };
  }

  const recentWebhookEvents: Array<{ id: string; receivedAt: string; payload: any }> = [];
  const pendingNormalizedLeads: NormalizedMetaWebhookLead[] = [];

  const extractAndEnqueueWebhookLeads = (payload: any) => {
    const entries = Array.isArray(payload?.entry) ? payload.entry : [];
    const nowIso = new Date().toISOString();

    entries.forEach((entry: any) => {
      const changes = Array.isArray(entry?.changes) ? entry.changes : [];
      changes.forEach((change: any) => {
        const field = change?.field;
        const val = change?.value || {};

        // 1. Mensajes entrantes de WhatsApp Cloud API (con o sin objeto referral de Click-to-WhatsApp Ads)
        if (Array.isArray(val.messages)) {
          const contacts = Array.isArray(val.contacts) ? val.contacts : [];
          val.messages.forEach((msg: any, idx: number) => {
            const fromPhone = String(msg?.from || contacts[0]?.wa_id || '+593990000000');
            const profileName = String(
              contacts[0]?.profile?.name || msg?.profile_name || `Prospecto WhatsApp (${fromPhone.slice(-4)})`
            );
            const textBody = String(
              msg?.text?.body ||
                msg?.button?.text ||
                msg?.interactive?.button_reply?.title ||
                'Hola, vi su anuncio y deseo cotizar un proyecto publicitario.'
            );
            const rawRef = msg?.referral;
            const referral = rawRef
              ? {
                  sourceUrl: rawRef.source_url || rawRef.sourceUrl,
                  sourceId: rawRef.source_id || rawRef.sourceId,
                  sourceType: rawRef.source_type || rawRef.sourceType || 'ad',
                  headline: rawRef.headline || 'Campaña Meta Ads Click-to-WhatsApp',
                  body: rawRef.body,
                  ctwaClid: rawRef.ctwa_clid || rawRef.ctwaClid,
                  campaignName: rawRef.campaign_name || rawRef.headline || 'Meta Ads CTWA',
                  receivedAt: nowIso,
                }
              : undefined;

            const eventId = String(msg?.id || `wamid-${Date.now()}-${idx}`);
            if (!pendingNormalizedLeads.some((item) => item.id === eventId)) {
              pendingNormalizedLeads.unshift({
                id: eventId,
                receivedAt: nowIso,
                processed: false,
                phone: fromPhone,
                profileName,
                text: textBody,
                originType: referral ? 'ctwa_ad' : 'organic_wa',
                referral,
              });
            }
          });
        }

        // 2. Formularios Instantáneos de Meta Lead Ads (field === 'leadgen')
        if (field === 'leadgen' || val?.leadgen_id) {
          const leadgenId = String(val?.leadgen_id || `leadgen-${Date.now()}`);
          const phone = String(val?.phone_number || val?.phone || '+593 98 450 9120');
          const fullName = String(val?.full_name || val?.customer_name || 'Prospecto Formulario Meta Ads');
          const headline = String(val?.ad_name || val?.form_name || 'Formulario Instantáneo Meta Lead Ads');
          const noteText = String(
            val?.custom_disclaimer_responses ||
              val?.project_details ||
              `Lead recibido desde Formulario Meta Ads (${headline}). Solicita cotización e información.`
          );

          if (!pendingNormalizedLeads.some((item) => item.id === leadgenId)) {
            pendingNormalizedLeads.unshift({
              id: leadgenId,
              receivedAt: nowIso,
              processed: false,
              phone,
              profileName: fullName,
              text: noteText,
              originType: 'leadgen_form',
              referral: {
                sourceUrl: 'https://facebook.com/ads/leadgen',
                sourceId: String(val?.ad_id || val?.form_id || 'FORM-META-2026'),
                sourceType: 'leadgen_form',
                headline,
                body: 'Formulario Instantáneo de Clientes Potenciales Meta',
                ctwaClid: `LEADGEN_${leadgenId}`,
                campaignName: headline,
                receivedAt: nowIso,
              },
            });
          }
        }
      });
    });

    // 3. Soporte Nativo para Webhooks provenientes de KOMMO CRM (message[add], leads[add], unsorted[add])
    const kommoMessages = payload?.message?.add || payload?.messages?.add;
    const kommoLeads = payload?.leads?.add || payload?.leads?.status || payload?.unsorted?.add;

    if (Array.isArray(kommoMessages)) {
      kommoMessages.forEach((km: any, idx: number) => {
        const eventId = String(km?.id || `kommo-msg-${Date.now()}-${idx}`);
        const phone = String(km?.phone || km?.author?.phone || km?.contact_phone || '+593 99 500 1122');
        const profileName = String(
          km?.author?.name || km?.contact_name || `Cliente Kommo WhatsApp (${phone.slice(-4)})`
        );
        const textBody = String(km?.text || 'Mensaje sincronizado desde Kommo CRM.');

        if (!pendingNormalizedLeads.some((item) => item.id === eventId)) {
          pendingNormalizedLeads.unshift({
            id: eventId,
            receivedAt: nowIso,
            processed: false,
            phone,
            profileName,
            text: textBody,
            originType: 'ctwa_ad',
            referral: {
              sourceUrl: 'https://kommo.com',
              sourceId: String(km?.lead_id || km?.talk_id || 'KOMMO-SYNC'),
              sourceType: 'ad',
              headline: 'Sincronizado en Vivo desde Kommo CRM',
              body: textBody,
              ctwaClid: `KOMMO_${eventId}`,
              campaignName: 'Puente Kommo CRM + WhatsApp API',
              receivedAt: nowIso,
            },
          });
        }
      });
    } else if (Array.isArray(kommoLeads)) {
      kommoLeads.forEach((kl: any, idx: number) => {
        const eventId = String(kl?.id || `kommo-lead-${Date.now()}-${idx}`);
        const phone = String(kl?.phone || kl?.contact_phone || '+593 99 600 3344');
        const profileName = String(kl?.name || `Lead Kommo #${eventId}`);
        const textBody = `Lead recibido desde Kommo CRM: "${profileName}". Presupuesto ref: $${kl?.price || 0}.`;

        if (!pendingNormalizedLeads.some((item) => item.id === eventId)) {
          pendingNormalizedLeads.unshift({
            id: eventId,
            receivedAt: nowIso,
            processed: false,
            phone,
            profileName,
            text: textBody,
            originType: 'ctwa_ad',
            referral: {
              sourceUrl: 'https://kommo.com',
              sourceId: String(kl?.pipeline_id || 'KOMMO-PIPELINE'),
              sourceType: 'ad',
              headline: `Kommo CRM: ${profileName}`,
              body: textBody,
              ctwaClid: `KOMMO_LEAD_${eventId}`,
              campaignName: 'Embudo Kommo CRM',
              receivedAt: nowIso,
            },
          });
        }
      });
    }

    if (pendingNormalizedLeads.length > 100) {
      pendingNormalizedLeads.splice(100);
    }
  };

  // Bóveda persistente en servidor para Token Permanente / Usuario del Sistema Meta
  const serverPermanentWaConfig: {
    phoneNumberId: string;
    wabaId: string;
    accessToken: string;
    appId: string;
    appSecret: string;
    tokenType: 'permanent_system_user' | 'long_lived_60d' | 'env_configured' | 'unconfigured';
    updatedAt: string;
  } = {
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
    wabaId: process.env.WHATSAPP_WABA_ID || '',
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN || '',
    appId: process.env.META_APP_ID || '',
    appSecret: process.env.META_APP_SECRET || '',
    tokenType: process.env.WHATSAPP_ACCESS_TOKEN ? 'env_configured' : 'unconfigured',
    updatedAt: new Date().toISOString(),
  };

  //Guardar Token Permanente de Usuario del Sistema en el Servidor (No caduca nunca)
  app.post('/api/whatsapp/save-permanent-config', (req, res) => {
    const { phoneNumberId, wabaId, accessToken, appId, appSecret } = req.body || {};
    if (phoneNumberId) serverPermanentWaConfig.phoneNumberId = String(phoneNumberId).trim();
    if (wabaId) serverPermanentWaConfig.wabaId = String(wabaId).trim();
    if (accessToken && !String(accessToken).includes('...')) {
      serverPermanentWaConfig.accessToken = String(accessToken).trim();
      serverPermanentWaConfig.tokenType = 'permanent_system_user';
    }
    if (appId) serverPermanentWaConfig.appId = String(appId).trim();
    if (appSecret) serverPermanentWaConfig.appSecret = String(appSecret).trim();
    serverPermanentWaConfig.updatedAt = new Date().toISOString();

    return res.json({
      ok: true,
      tokenType: serverPermanentWaConfig.tokenType,
      updatedAt: serverPermanentWaConfig.updatedAt,
      detail:
        'Credenciales permanentes fijadas en el servidor backend. Todos los puestos del ERP usarán este token sin necesidad de volver a entrar a Meta Developers.',
    });
  });

  // Canjear automáticamente un Token Temporal de 24h por uno de Larga Duración usando App ID + App Secret
  app.post('/api/whatsapp/exchange-token', async (req, res) => {
    try {
      const { appId, appSecret, shortLivedToken, phoneNumberId, wabaId } = req.body || {};
      const cleanAppId = String(appId || serverPermanentWaConfig.appId || '').trim();
      const cleanSecret = String(appSecret || serverPermanentWaConfig.appSecret || '').trim();
      const cleanToken = String(shortLivedToken || serverPermanentWaConfig.accessToken || '').trim();

      if (!cleanAppId || !cleanSecret || !cleanToken || cleanToken.includes('...')) {
        return res.status(400).json({
          ok: false,
          error:
            'Ingresa tu Meta App ID, App Secret y el Access Token actual para realizar el canje automático contra graph.facebook.com.',
        });
      }

      const url = `https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${encodeURIComponent(
        cleanAppId
      )}&client_secret=${encodeURIComponent(cleanSecret)}&fb_exchange_token=${encodeURIComponent(
        cleanToken
      )}`;

      const resp = await fetch(url);
      const data: any = await resp.json();

      if (!resp.ok || !data?.access_token) {
        return res.status(200).json({
          ok: false,
          error:
            data?.error?.message ||
            'No se pudo canjear el token en Graph API. Verifica que el App ID, App Secret y el Token inicial sean reales.',
        });
      }

      serverPermanentWaConfig.accessToken = data.access_token;
      serverPermanentWaConfig.appId = cleanAppId;
      serverPermanentWaConfig.appSecret = cleanSecret;
      if (phoneNumberId) serverPermanentWaConfig.phoneNumberId = String(phoneNumberId).trim();
      if (wabaId) serverPermanentWaConfig.wabaId = String(wabaId).trim();
      serverPermanentWaConfig.tokenType = 'long_lived_60d';
      serverPermanentWaConfig.updatedAt = new Date().toISOString();

      return res.json({
        ok: true,
        newAccessToken: data.access_token,
        expiresInSeconds: data.expires_in || 5184000,
        detail:
          'Token canjeado con éxito en Meta Graph API y almacenado en el servidor backend para uso continuo.',
      });
    } catch (err: any) {
      return res.status(500).json({
        ok: false,
        error: err?.message || 'Error al conectar con el endpoint oauth/access_token de Meta.',
      });
    }
  });

  app.post('/api/whatsapp/send', async (req, res) => {
    try {
      const { to, bodyText, text, phoneNumberId, accessToken } = req.body || {};
      const messageBody = bodyText || text;
      const cleanRecipient = String(to || '').replace(/[^0-9]/g, '');
      const effectivePhoneId =
        (phoneNumberId && String(phoneNumberId).trim()) ||
        serverPermanentWaConfig.phoneNumberId ||
        process.env.WHATSAPP_PHONE_NUMBER_ID ||
        '';
      const effectiveToken =
        serverPermanentWaConfig.accessToken ||
        process.env.WHATSAPP_ACCESS_TOKEN ||
        (accessToken && !String(accessToken).includes('...')
          ? String(accessToken).trim()
          : '');

      if (!cleanRecipient || !messageBody) {
        return res.status(400).json({
          ok: false,
          simulated: false,
          error: 'Destinatario (to) y mensaje (bodyText) son obligatorios.',
        });
      }

      if (!effectiveToken || !effectivePhoneId) {
        return res.status(200).json({
          ok: true,
          simulated: true,
          detail:
            'Modo simulación activo en servidor (Configure su Token Permanente de Usuario del Sistema en Ajustes API para despacho real en la nube).',
        });
      }

      const graphResp = await fetch(
        `https://graph.facebook.com/v21.0/${effectivePhoneId}/messages`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${effectiveToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: cleanRecipient,
            type: 'text',
            text: { preview_url: false, body: String(messageBody) },
          }),
        }
      );

      const data: any = await graphResp.json();
      if (!graphResp.ok) {
        return res.status(graphResp.status).json({
          ok: false,
          simulated: false,
          error: data?.error?.message || `Error HTTP ${graphResp.status} desde Meta Graph API`,
        });
      }

      return res.json({
        ok: true,
        simulated: false,
        messageId: data?.messages?.[0]?.id || 'OK',
        detail: `Despachado vía Servidor Meta Cloud API (ID: ${data?.messages?.[0]?.id || 'OK'})`,
      });
    } catch (err: any) {
      return res.status(500).json({
        ok: false,
        simulated: false,
        error: err?.message || 'Error interno en el proxy /api/whatsapp/send',
      });
    }
  });

  app.get('/api/whatsapp/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    const expectedToken =
      process.env.WHATSAPP_VERIFY_TOKEN || 'CREA_ARTE_WEBHOOK_SECRET_2026';

    if (mode === 'subscribe' && token === expectedToken) {
      return res.status(200).send(String(challenge || 'OK'));
    }
    return res.status(403).json({
      error: 'Token de verificación de Webhook inválido.',
    });
  });

  app.post('/api/whatsapp/webhook', (req, res) => {
    recentWebhookEvents.unshift({
      id: `wh-${Date.now()}`,
      receivedAt: new Date().toISOString(),
      payload: req.body,
    });
    if (recentWebhookEvents.length > 50) {
      recentWebhookEvents.pop();
    }
    extractAndEnqueueWebhookLeads(req.body);
    return res.status(200).json({ status: 'EVENT_RECEIVED' });
  });

  app.get('/api/whatsapp/webhook/events', (_req, res) => {
    return res.status(200).json({
      ok: true,
      events: recentWebhookEvents,
      pendingLeads: pendingNormalizedLeads.filter((l) => !l.processed),
    });
  });

  app.post('/api/whatsapp/webhook/ack', (req, res) => {
    const { eventIds } = req.body || {};
    if (Array.isArray(eventIds)) {
      const idSet = new Set(eventIds.map(String));
      pendingNormalizedLeads.forEach((lead) => {
        if (idSet.has(lead.id)) {
          lead.processed = true;
        }
      });
    }
    return res.status(200).json({ ok: true });
  });

  app.post('/api/whatsapp/simulate-ad-lead', (req, res) => {
    const {
      phone,
      profileName,
      text,
      headline,
      sourceId,
      ctwaClid,
      sourceUrl,
      sourceType,
    } = req.body || {};

    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const simulatedPhone = phone || `+593 99 ${Math.floor(100 + Math.random() * 899)} ${randomSuffix}`;
    const simulatedName = profileName || `Comercializadora Andina ${randomSuffix}`;
    const simulatedHeadline =
      headline || 'Campaña Rótulos 3D & Corpóreos LED - 20% Off';
    const simulatedText =
      text ||
      'Hola Crea Arte, hice clic en su anuncio de Rótulos 3D & Corpóreos LED. Necesito cotizar un letrero luminoso de 3.80m x 1.20m con instalación para nuestro nuevo local.';
    const msgId = `wamid.ctwa.${Date.now()}`;

    const simulatedPayload = {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: '982736451092837',
          changes: [
            {
              field: 'messages',
              value: {
                messaging_product: 'whatsapp',
                metadata: {
                  display_phone_number: '593998001234',
                  phone_number_id: '109482716509182',
                },
                contacts: [
                  {
                    profile: { name: simulatedName },
                    wa_id: simulatedPhone.replace(/\D/g, ''),
                  },
                ],
                messages: [
                  {
                    from: simulatedPhone,
                    id: msgId,
                    timestamp: String(Math.floor(Date.now() / 1000)),
                    type: 'text',
                    text: { body: simulatedText },
                    referral: {
                      source_url:
                        sourceUrl || 'https://fb.me/ctwa-crea-arte-rotulos-3d-2026',
                      source_id: sourceId || '12021889944110025',
                      source_type: sourceType || 'ad',
                      headline: simulatedHeadline,
                      body: 'Fabricación e instalación de Rótulos Corpóreos 3D en Acrílico, Alucobond e Iluminación LED Samsung IP68.',
                      ctwa_clid: ctwaClid || `ARZ_CTWA_${Date.now().toString().slice(-6)}`,
                    },
                  },
                ],
              },
            },
          ],
        },
      ],
    };

    recentWebhookEvents.unshift({
      id: `wh-sim-${Date.now()}`,
      receivedAt: new Date().toISOString(),
      payload: simulatedPayload,
    });
    if (recentWebhookEvents.length > 50) {
      recentWebhookEvents.pop();
    }

    extractAndEnqueueWebhookLeads(simulatedPayload);
    const createdLead = pendingNormalizedLeads.find((l) => l.id === msgId);

    return res.status(200).json({
      ok: true,
      eventId: msgId,
      lead: createdLead,
      payload: simulatedPayload,
    });
  });

  // =========================================================================
  // ENDPOINT PARA CENTRO DE AGENTES OPERATIVOS IA (DELEGACIÓN DE TAREAS ERP)
  // =========================================================================
  app.post('/api/agents/delegate', async (req, res) => {
    try {
      const { agentType, userPrompt, erpSnapshot } = req.body || {};

      if (!process.env.GEMINI_API_KEY) {
        return res.status(200).json({
          ok: true,
          source: 'local-engine',
          warning:
            'GEMINI_API_KEY no configurada en el servidor. Se ejecutó el Motor Heurístico ERP Local para generar las propuestas.',
          fallbackRequired: true,
        });
      }

      const geminiModel = 'gemini-3.8-flash';
      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const systemInstruction = `Eres el Orquestador de Agentes Operativos IA de "Crea Arte ERP" (empresa de diseño gráfico, gigantografía, rotulación 3D, impresión digital y corte CNC/Láser en Ecuador, moneda USD).
Tu objetivo es analizar los datos reales del ERP enviados en el snapshot y la solicitud del usuario, y devolver entre 1 y 4 propuestas accionables ("proposals") listas para aprobar con 1 clic (Human-in-the-loop).
REGLAS ESTRICTAS:
1. Usa SIEMPRE los IDs reales de órdenes (ej. "#CA-001"), IDs reales de materiales del catálogo (ej. "mat-lona-front", "mat-vinil-micro", "mat-acrilico-3mm", "mat-acm-alucobond", "mat-sintra-pvc", "mat-diseno-hora") e IDs reales de inventario (ej. "inv-lona-front", "inv-vinil-gloss", "inv-acrilico-3mm") provistos en el contexto.
2. Si agentType es "quoter_agent", interpreta el pedido en lenguaje natural/WhatsApp, calcula medidas en metros (widthM, heightM), cantidad, precio unitario y total en USD basado en el tarifario real, y devuelve una propuesta con actionType = "CREATE_QUOTE_ORDER" que incluya quoteDraft completo.
3. Si agentType es "production_optimizer_agent", analiza órdenes activas y retazos disponibles (reusableOffcuts). Sugiere reutilizar retazos compatibles (actionType = "USE_OFFCUT"), enviar medidas a optimización 2D (actionType = "SEND_TO_OPTIMIZER") o priorizar avances de etapa (actionType = "ADVANCE_STAGE").
4. Si agentType es "inventory_kardex_agent", cruza stock actual vs mínimo y consumo de órdenes activas/mermas. Genera propuestas de reposición (actionType = "CREATE_RESTOCK") o tareas de control de merma (actionType = "CREATE_CRM_TASK").
5. Si agentType es "collections_crm_agent", identifica órdenes con saldo pendiente (totalPrice > paidAmount) y redacta mensajes formales y persuasivos de cobro/estado por WhatsApp con montos exactos y cuentas bancarias de Crea Arte (actionType = "SEND_WHATSAPP_COLLECTION").
6. Si agentType es "full_sweep", genera 4 propuestas de alto impacto combinando Cotización/Ventas, Producción/Retazos, Inventario/Kardex y Cobranza CxC.`;

      const promptContent = `AGENTE SOLICITADO: ${agentType || 'full_sweep'}
INSTRUCCIÓN / TEXTO DEL USUARIO:
${userPrompt || 'Analizar estado operativo actual y delegar tareas prioritarias.'}

SNAPSHOT REAL DEL ERP (Órdenes, Catálogo, Inventario, Retazos, Máquinas):
${JSON.stringify(erpSnapshot || {}, null, 2)}`;

      const response = await ai.models.generateContent({
        model: geminiModel,
        contents: promptContent,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              executiveSummary: {
                type: Type.STRING,
                description: 'Resumen ejecutivo breve del diagnóstico realizado por el agente IA.',
              },
              proposals: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING, description: 'Título claro de la tarea propuesta' },
                    agentId: {
                      type: Type.STRING,
                      description:
                        'quoter_agent | production_optimizer_agent | inventory_kardex_agent | collections_crm_agent',
                    },
                    priority: {
                      type: Type.STRING,
                      description: 'Crítica | Alta | Normal',
                    },
                    reasoning: {
                      type: Type.STRING,
                      description: 'Explicación técnica basada en los datos reales del ERP',
                    },
                    impactMetric: {
                      type: Type.STRING,
                      description: 'Métrica clave de impacto (ej. "$485.00 por cobrar", "Ahorro 2.8 m²", "+160 m² stock")',
                    },
                    actionType: {
                      type: Type.STRING,
                      description:
                        'CREATE_QUOTE_ORDER | SEND_TO_OPTIMIZER | USE_OFFCUT | CREATE_RESTOCK | SEND_WHATSAPP_COLLECTION | CREATE_CRM_TASK | ADVANCE_STAGE',
                    },
                    targetOrderId: {
                      type: Type.STRING,
                      description: 'ID de la orden relacionada si aplica (ej. #CA-001)',
                    },
                    targetInventoryId: {
                      type: Type.STRING,
                      description: 'ID del insumo de inventario si aplica (ej. inv-lona-front)',
                    },
                    targetOffcutId: {
                      type: Type.STRING,
                      description: 'ID del retazo reutilizable si aplica',
                    },
                    restockQty: {
                      type: Type.NUMBER,
                      description: 'Cantidad sugerida a reponer en inventario si actionType es CREATE_RESTOCK',
                    },
                    whatsappMessage: {
                      type: Type.STRING,
                      description: 'Mensaje listo para enviar por WhatsApp al cliente si aplica',
                    },
                    suggestedStage: {
                      type: Type.STRING,
                      description: 'Etapa destino sugerida si actionType es ADVANCE_STAGE',
                    },
                    crmTaskTitle: {
                      type: Type.STRING,
                      description: 'Título de tarea CRM si actionType es CREATE_CRM_TASK',
                    },
                    quoteDraft: {
                      type: Type.OBJECT,
                      properties: {
                        clientName: { type: Type.STRING },
                        clientPhone: { type: Type.STRING },
                        projectTitle: { type: Type.STRING },
                        category: { type: Type.STRING },
                        materialId: { type: Type.STRING },
                        materialName: { type: Type.STRING },
                        widthM: { type: Type.NUMBER },
                        heightM: { type: Type.NUMBER },
                        quantity: { type: Type.NUMBER },
                        finishings: {
                          type: Type.ARRAY,
                          items: { type: Type.STRING },
                        },
                        unitPrice: { type: Type.NUMBER },
                        totalPrice: { type: Type.NUMBER },
                        suggestedAdvance: { type: Type.NUMBER },
                        notes: { type: Type.STRING },
                      },
                    },
                  },
                  required: [
                    'title',
                    'agentId',
                    'priority',
                    'reasoning',
                    'impactMetric',
                    'actionType',
                  ],
                },
              },
            },
            required: ['executiveSummary', 'proposals'],
          },
        },
      });

      const rawText = (response.text ?? '{}').trim();
      const parsed = JSON.parse(rawText);
      return res.json({
        ok: true,
        source: 'gemini-ai',
        modelUsed: geminiModel,
        result: parsed,
      });
    } catch (error: any) {
      console.error('Error en /api/agents/delegate:', error?.message || error);
      return res.status(200).json({
        ok: true,
        source: 'local-engine',
        warning: `Aviso Gemini API (${error?.message || 'Error de conexión'}): Se ejecutó el Motor Analítico Local del ERP.`,
        fallbackRequired: true,
      });
    }
  });

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        allowedHosts: true,
        hmr: process.env.DISABLE_HMR !== 'true',
        watch: process.env.DISABLE_HMR === 'true' ? null : {},
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
