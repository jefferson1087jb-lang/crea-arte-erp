# Prompt de Actualización No Destructiva: CRM Meta Ads, Etiquetas de Clientes y Embudo en WhatsApp (Crea Arte ERP)

Copia y pega este prompt en Google AI Studio (o en tu asistente de programación) para extender **Crea Arte ERP** sin alterar ni romper ninguna funcionalidad actual de cotización, Kanban, inventario, finanzas, Google Drive ni sincronización con Firebase.

## Texto del Prompt para Copiar y Pegar

Actúa como un Ingeniero Senior Full-Stack experto en TypeScript, React y Express. Necesito realizar una **actualización estrictamente ADITIVA y NO DESTRUCTIVA** sobre el proyecto actual **Crea Arte ERP** para conectar el flujo completo de campañas de [Ads that Click to WhatsApp (CTWA)](https://developers.facebook.com/documentation/ads-commerce/marketing-api/ad-creative/messaging-ads/click-to-whatsapp) y [Formularios Instantáneos de Meta Lead Ads](https://developers.facebook.com/documentation/ads-commerce/marketing-api/guides/lead-ads), integrando etiquetas de clientes (Nuevos vs. Recurrentes) y etapas de embudo de mensajes directamente dentro del módulo de WhatsApp (`src/components/WhatsAppCenterModule.tsx`) y el Directorio CRM (`src/components/ClientsModule.tsx`).

### 1. Reglas Estrictas de Preservación (Cero Cambios Destructivos)

* **Prohibido eliminar o renombrar estado existente:** Mantén intactas todas las claves de `localStorage` (`crea_arte_orders_v2`, `crea_arte_clients_v2`, `crea_arte_chatmsgs_v2`, `crea_arte_waconfig_v2`, etc.) y la sincronización en `src/utils/firebaseSyncService.ts`.
* **retrocompatibilidad de interfaces TypeScript:** Cualquier propiedad nueva en `WorkOrder`, `ClientContact`, `ChatMessage` o `WhatsAppApiConfig` dentro de `src/data/initialData.ts` debe declararse como **opcional (`?`)** con valores por defecto seguros para no invalidar las órdenes (`INITIAL_ORDERS`) ni los clientes (`INITIAL_CLIENTS`) ya guardados.
* **Intocabilidad del Kanban de Producción:** No elimines ni renombres ninguna de las 7 etapas operativas de `ORDER_STAGES` (`'Cotizado / Anticipo Pendiente'` hasta `'Finalizado y Liquidado'`). El estado de embudo comercial de mensajes se manejará con una propiedad adicional opcional `crmLeadStage?: CrmLeadStage` en `WorkOrder` y `ClientContact`.
* **Conservación de módulos y endpoints actuales:** Mantén intactos los endpoints `/api/invoices/parse-pdf`, `/api/whatsapp/send`, `/api/agents/delegate` y `/api/health` en `server.ts`, así como el Bot 24/7 de comandos `1` al `6`, las notas internas con `@mención` y la integración con Google Drive en `src/components/WhatsAppCenterModule.tsx`.

### 2. Extensión de Modelos de Datos en `src/data/initialData.ts`

1. **Nuevas etiquetas oficiales en `AVAILABLE_CLIENT_TAGS`:**
   * Conserva las 8 etiquetas actuales (`'VIP / Recurrente'`, `'Corporativo'`, `'Rótulos 3D'`, `'Gran Formato'`, `'Vinil & Flotas'`, `'Crédito Autorizado'`, `'Exige Retención'`, `'Nuevo Prospecto'`) y añade:
     * `'Lead Meta Ads'`
     * `'Campaña Click-to-WhatsApp'`
     * `'Lead Formulario Meta'`
     * `'Cliente Inactivo / Reactivar'`
2. **Nuevo tipo `CrmLeadStage` para etapas de mensajes en el CRM y WhatsApp:**
   * Declara y exporta el tipo:
     ```ts
     export type CrmLeadStage =
       | 'Lead Entrante (Meta Ads)'
       | 'En Calificación / Consultando'
       | 'Cotización Enviada'
       | 'Esperando Anticipo / Cierre'
       | 'Cliente en Producción Activa'
       | 'Post-Venta / Recurrente';
     ```
   * Exporta el arreglo constante `CRM_LEAD_STAGES: CrmLeadStage[]` con esos 6 valores en orden.
3. **Campos opcionales de atribución publicitaria (`MetaAdReferralInfo`):**
   * Crea la interfaz `MetaAdReferralInfo` siguiendo la estructura del objeto `referral` documentado en la [Referencia de Webhook de Mensajes de Texto de WhatsApp](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/reference/messages/text):
     ```ts
     export interface MetaAdReferralInfo {
       sourceUrl?: string;      // referral.source_url
       sourceId?: string;       // referral.source_id (ID del anuncio/post)
       sourceType?: string;     // 'ad' | 'post' | 'leadgen_form'
       headline?: string;       // referral.headline (Título del anuncio)
       body?: string;           // referral.body
       ctwaClid?: string;       // referral.ctwa_clid (Click ID de Meta Ads)
       campaignName?: string;
       receivedAt?: string;
     }
     ```
   * Agrega en `WorkOrder`:
     * `crmLeadStage?: CrmLeadStage;`
     * `adReferral?: MetaAdReferralInfo;`
     * `isMetaAdLead?: boolean;`
   * Agrega en `ClientContact`:
     * `crmLeadStage?: CrmLeadStage;`
     * `adReferral?: MetaAdReferralInfo;`
     * `originChannel?: 'Meta Ads CTWA' | 'Meta Lead Form' | 'WhatsApp Orgánico' | 'Mostrador / Referido';`
   * Agrega en `ChatMessage`:
     * `adReferral?: MetaAdReferralInfo;`

### 3. Procesamiento Real de Webhooks de Meta Ads y WhatsApp en `server.ts`

Sin romper la lógica actual de `POST /api/whatsapp/send`, `GET /api/whatsapp/webhook` ni `POST /api/whatsapp/webhook` (líneas 213–313 de `server.ts`), amplía la sección de Webhooks con lo siguiente:

| Endpoint en `server.ts` | Comportamiento Aditivo Requerido | Especificación Oficial de Meta Asociada |
| :--- | :--- | :--- |
| `POST /api/whatsapp/webhook` | Además de guardar el evento crudo en `recentWebhookEvents`, extrae automáticamente los mensajes entrantes de `entry[].changes[].value.messages[]`, el nombre del perfil en `contacts[0].profile.name`, el teléfono (`from`) y el objeto `message.referral` si el usuario provino de un anuncio. También detecta eventos `field === 'leadgen'` de páginas conectadas y guárdalos en una cola en memoria `pendingNormalizedLeads` con ID único y bandera `processed: false`. | Basado en la [Descripción General de Webhooks de WhatsApp](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/overview) y el payload de [Webhooks para Leadgen](https://developers.facebook.com/docs/graph-api/webhooks/getting-started/webhooks-for-leadgen/). |
| `GET /api/whatsapp/webhook/events` | Nuevo endpoint que devuelve `{ ok: true, events: recentWebhookEvents, pendingLeads: pendingNormalizedLeads.filter(l => !l.processed) }` para que el frontend sincronice mensajes reales entrantes sin recargar la página. | Permite consumir en tiempo real los eventos recibidos desde la [API de Mensajes de WhatsApp Business](https://developers.facebook.com/documentation/business-messaging/whatsapp/reference/whatsapp-business-phone-number/message-api). |
| `POST /api/whatsapp/webhook/ack` | Nuevo endpoint que recibe `{ eventIds: string[] }` y marca esos mensajes/leads como `processed: true` para evitar duplicados en el frontend. | Garantiza idempotencia al procesar notificaciones descritas en la [Guía de Recuperación de Leads](https://developers.facebook.com/documentation/ads-commerce/marketing-api/guides/lead-ads/retrieving). |
| `POST /api/whatsapp/simulate-ad-lead` | Nuevo endpoint de prueba local que inyecta un payload idéntico al de Meta Graph API v21.0 con objeto `referral` (`headline`, `source_id`, `ctwa_clid`, `source_url`) para probar campañas en vivo sin gastar presupuesto publicitario. | Reproduce la estructura exacta de anuncios definida en [Text Messages Webhook Reference](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/reference/messages/text). |

### 4. Clasificación Automática (Cliente Nuevo vs. Recurrente) y Auto-Creación de Leads en `src/App.tsx`

1. **Función no destructiva `handleIncomingMetaWebhookOrAdLead` en `src/App.tsx`:**
   * Normaliza los últimos 9 dígitos del teléfono entrante (`phone.replace(/\D/g, '').slice(-9)`) y compáralos contra `clients` y `orders`:
     * **Caso A — Cliente Recurrente (el teléfono ya existe en `clients` o tiene 1+ órdenes previas en `orders`):**
       * Conserva sus etiquetas actuales y asegúrate de que tenga `'VIP / Recurrente'` si acumula 2 o más pedidos.
       * Si viene de un anuncio (`referral`), agrega `'Lead Meta Ads'` sin borrar sus etiquetas previas y vincula el mensaje entrante a su orden activa más reciente (o crea un nuevo expediente si todas sus órdenes están en `'Finalizado y Liquidado'`), actualizando `unreadClientReplies: (o.unreadClientReplies || 0) + 1`.
     * **Caso B — Cliente Nuevo (el teléfono NO existe en `clients` ni en `orders`):**
       * Crea automáticamente un nuevo registro en `clients` (`ClientContact`) con las etiquetas `['Nuevo Prospecto', ...(referral ? ['Lead Meta Ads', 'Campaña Click-to-WhatsApp'] : [])]`, `crmLeadStage: 'Lead Entrante (Meta Ads)'`, `originChannel: referral ? 'Meta Ads CTWA' : 'WhatsApp Orgánico'`, y `adReferral: referral`.
       * Crea automáticamente un expediente inicial en `orders` (`WorkOrder`) en etapa `'Cotizado / Anticipo Pendiente'`, con `crmLeadStage: 'Lead Entrante (Meta Ads)'`, `isMetaAdLead: Boolean(referral)`, `adReferral: referral`, asignado por defecto a Ventas (`assignedCrmAgentId: 'usr-sales'`) y con `unreadClientReplies: 1`.
       * Registra el mensaje entrante en `chatMessages` e incluye una notificación en la campana CRM (`crmNotifications`) indicando el nombre de la campaña (`referral.headline`).
2. **Polling ligero y seguro al Webhook:**
   * Agrega un `useEffect` en `src/App.tsx` que consulte `GET /api/whatsapp/webhook/events` cada 6 segundos cuando `activeWaConfig.mode === 'meta_cloud_api'` (o cuando se dispare una prueba de anuncio), procese cualquier mensaje nuevo mediante `handleIncomingMetaWebhookOrAdLead` y confirme con `POST /api/whatsapp/webhook/ack`.

### 5. Etiquetas de Clientes y Etapas de Mensajes en `src/components/WhatsAppCenterModule.tsx`

Modifica `src/components/WhatsAppCenterModule.tsx` de forma limpia manteniendo sus 3 vistas (`inbox`, `bot_studio`, `api_settings`) y sus 4 pestañas del panel derecho (`tasks`, `drive`, `finance_art`, `details`):

1. **Recibir `clients`, `onUpdateClient` y `onAddClient` por props (opcionales para no romper llamadas):**
   * Pasa `clients={clients}`, `onUpdateClient={handleUpdateClient}` y `onSimulateMetaAdLead` desde `src/App.tsx` hacia `<WhatsAppCenterModule />`.
2. **Insignias (Badges) de Cliente Nuevo vs. Recurrente y Campaña Meta Ads en la lista izquierda de chats:**
   * En cada tarjeta de conversación de la columna izquierda, cruza la orden con `clients` (por nombre o últimos 9 dígitos del teléfono) y muestra:
     * Una insignia verde `🆕 Nuevo Prospecto` o ámbar `⭐ VIP / Recurrente (N pedidos)` según su historial real.
     * Si la conversación tiene `adReferral` o la etiqueta `'Lead Meta Ads'`, muestra una insignia azul/violeta `📢 Meta Ads: {adReferral.headline}` y el resto de etiquetas del cliente (`tags`).
3. **Nuevos filtros rápidos en la Bandeja de Entrada (`ChatFilter` y filtro por Etiqueta/Etapa):**
   * Junto a los filtros actuales (`all`, `my_assigned`, `awaiting_approval`, `pending_balance`, `in_production`, `ready_delivery`), añade:
     * `meta_ads_leads` (`📢 Leads Meta Ads`)
     * `new_prospects` (`🆕 Clientes Nuevos`)
     * `vip_recurrent` (`⭐ Clientes Recurrentes`)
   * Agrega un selector compacto para filtrar chats por `CrmLeadStage` (`Todos los estados de mensaje`, `Lead Entrante (Meta Ads)`, `En Calificación / Consultando`, `Cotización Enviada`, `Esperando Anticipo / Cierre`, `Cliente en Producción Activa`, `Post-Venta / Recurrente`).
4. **Barra de Etiquetas de Cliente y Selector de Etapa de Mensaje en la cabecera del chat activo:**
   * En el encabezado de la conversación activa (arriba de la burbuja de mensajes), añade:
     * Un selector desplegable para cambiar en 1 clic la **Etapa de Mensaje CRM (`crmLeadStage`)** de esa conversación.
     * Chips interactivos con las etiquetas del cliente activo (`Nuevo Prospecto`, `VIP / Recurrente`, `Lead Meta Ads`, `Corporativo`, `Rótulos 3D`, `Gran Formato`, `Vinil & Flotas`) y un botón `+ Etiqueta` que actualice `onUpdateClient` en tiempo real y quede sincronizado con el módulo **Directorio de Clientes (`ClientsModule.tsx`)**.
     * Si el chat proviene de una campaña (`activeOrder.adReferral`), muestra un banner informativo compacto con el título del anuncio (`headline`), el ID de campaña (`sourceId` / `ctwaClid`) y un botón **"⚡ Pre-Cotizar Lead con IA"** que abra o invoque la sugerencia de cotización para convertir el lead en venta.
5. **Simulador de Campaña Meta Ads en la barra de simulación:**
   * Dentro de la barra `showSimulatorBar` de `WhatsAppCenterModule.tsx`, añade un botón **"📢 Simular Lead Nuevo desde Anuncio Meta Ads"** que dispare un mensaje entrante de un número nuevo con datos de campaña (`referral.headline: "Campaña Rótulos 3D & Corpóreos LED - 20% Off"`) para verificar de extremo a extremo la creación automática del contacto, la asignación de etiquetas y el paso a ventas.

### 6. Verificación de Integridad Antes de Entregar

* Verifica con TypeScript (`tsc --noEmit` o compilación de Vite) que no existan errores de tipos en `src/data/initialData.ts`, `src/App.tsx`, `src/components/WhatsAppCenterModule.tsx`, `src/components/ClientsModule.tsx` ni `server.ts`.
* Confirma que todas las órdenes iniciales (`#CA-001` a `#CA-006`) y todos los clientes iniciales (`cli-1` a `cli-7`) sigan cargando sin pérdida de datos.
