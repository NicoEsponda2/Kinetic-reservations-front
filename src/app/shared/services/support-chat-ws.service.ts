import { computed, Injectable, NgZone, signal } from '@angular/core';
import { environment } from 'src/environments/environment';

/**
 * Opción rápida interactiva entregada por el servidor WebSocket.
 */
export interface QuickReplyOption {
  id: string;
  label: string;
  icon: string;
}

/**
 * Mensaje recibido o enviado dentro del chat de soporte en tiempo real.
 */
export interface SupportChatMessage {
  id: string;
  sender: 'user' | 'bot' | 'ai' | 'admin';
  senderName: string;
  message: string;
  timestamp: string;
  options?: QuickReplyOption[];
}

/**
 * Conversación de soporte de un usuario gestionada desde el panel de administración.
 */
export interface SupportConversation {
  sessionId: string;
  clientSocketId: string | null;
  userName: string;
  userEmail: string;
  isOnline: boolean;
  needsHumanAdmin: boolean;
  unreadForAdmin: boolean;
  updatedAt: string;
  messages: SupportChatMessage[];
}

const DEFAULT_QUICK_OPTIONS: QuickReplyOption[] = [
  { id: 'horarios', label: 'Horarios y deportes', icon: 'schedule' },
  { id: 'lluvia', label: 'Política de lluvia', icon: 'rainy' },
  { id: 'implementos', label: 'Arriendo e instalaciones', icon: 'sports_tennis' },
  { id: 'pagos', label: 'Pagos y cancelaciones', icon: 'credit_card' },
  { id: 'humano', label: 'Hablar con administración', icon: 'support_agent' },
];

const SESSION_USER_KEY = 'kr_auth_user_v2';
const ENGINE_IO_SEPARATOR = '\x1e';

/**
 * Servicio Socket.IO v4 (con soporte dual WebSocket nativo + Engine.IO HTTP Long-Polling
 * para proxies HTTPS en producción como Vercel) para el chat híbrido de Kinetic Reservations.
 */
@Injectable({ providedIn: 'root' })
export class SupportChatWsService {
  readonly isConnected = signal<boolean>(false);
  readonly isTyping = signal<boolean>(false);
  readonly messages = signal<SupportChatMessage[]>([]);
  readonly quickOptions = signal<QuickReplyOption[]>(DEFAULT_QUICK_OPTIONS);
  readonly unreadCount = signal<number>(0);

  // Estado en tiempo real para el módulo del Administrador
  readonly adminConversations = signal<SupportConversation[]>([]);
  readonly adminUnreadTotal = computed(
    () =>
      this.adminConversations().filter(
        (c) => c.unreadForAdmin || c.needsHumanAdmin,
      ).length,
  );

  private socket: WebSocket | null = null;
  private transportMode: 'websocket' | 'polling' = 'websocket';
  private pollingSid: string | null = null;
  private pollingAbortController: AbortController | null = null;
  private activePollingToken = 0;
  private pollingTokenCounter = 0;
  private pollingOutbox: string[] = [];
  private isPosting = false;
  private pendingMessages: Array<{ message: string; quickOptionId?: string }> = [];

  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private isOpenWidget = false;
  private isAdminSubscribed = false;
  private sessionId = this.generateSessionId();

  constructor(private readonly ngZone: NgZone) {}

  /**
   * Notifica al servicio si la ventana flotante del cliente está visible.
   */
  setWidgetOpenState(isOpen: boolean): void {
    this.isOpenWidget = isOpen;
    if (isOpen) {
      this.unreadCount.set(0);
      this.connect();
    }
  }

  /**
   * Activa la suscripción en tiempo real del panel de administración.
   */
  joinAdminChannel(): void {
    this.isAdminSubscribed = true;
    if (this.isTransportActive() && this.isConnected()) {
      this.emitEvent('admin-join', {});
    } else {
      this.connect();
    }
  }

  /**
   * Envía una respuesta desde el panel de administración hacia el usuario en tiempo real.
   */
  sendAdminReply(sessionId: string, message: string, adminName?: string): void {
    const clean = message.trim();
    if (!clean || !sessionId) return;

    this.emitEvent('admin-reply', {
      sessionId,
      message: clean,
      adminName:
        adminName ||
        this.getCurrentUserIdentity().userName ||
        'Administración Kinetic',
    });
  }

  /**
   * Marca una conversación como leída desde la vista del administrador.
   */
  markAdminConversationRead(sessionId: string): void {
    if (!sessionId) return;
    this.emitEvent('admin-mark-read', { sessionId });
  }

  /**
   * Marca una solicitud de atención humana como resuelta.
   */
  resolveAdminConversation(sessionId: string): void {
    if (!sessionId) return;
    this.emitEvent('admin-resolve', { sessionId });
  }

  /**
   * Limpia por completo el historial del chat del cliente y reinicia la sesión
   * al iniciar o cerrar sesión para aislar cuentas.
   */
  resetSession(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.cleanupWebSocket();
    this.cleanupPolling();
    this.pendingMessages = [];

    this.sessionId = this.generateSessionId();
    this.isConnected.set(false);
    this.isTyping.set(false);
    this.messages.set([]);
    this.unreadCount.set(0);
    this.quickOptions.set(DEFAULT_QUICK_OPTIONS);
    this.adminConversations.set([]);
    this.isAdminSubscribed = false;

    if (this.isOpenWidget) {
      this.connect();
    }
  }

  /**
   * Inicia la conexión con el gateway Socket.IO de NestJS (WebSocket en desarrollo
   * o HTTP Long-Polling en producción HTTPS detrás de Vercel Rewrite).
   */
  connect(): void {
    if (typeof window === 'undefined' || this.isTransportActive()) {
      return;
    }

    if (this.shouldUseHttpPolling()) {
      void this.connectPolling();
    } else {
      this.connectWebSocket();
    }
  }

  /**
   * Envía un mensaje de texto libre o una opción rápida seleccionada al servidor.
   */
  sendMessage(message: string, quickOptionId?: string): void {
    const clean = message.trim();
    if (!clean) return;

    if (!this.isTransportActive() || !this.isConnected()) {
      this.pendingMessages.push({ message: clean, quickOptionId });
      this.connect();
      return;
    }

    this.dispatchClientMessage(clean, quickOptionId);
  }

  /**
   * Determina si hay una conexión o intento de conexión activo en curso.
   */
  private isTransportActive(): boolean {
    const wsActive =
      this.socket !== null &&
      (this.socket.readyState === WebSocket.OPEN ||
        this.socket.readyState === WebSocket.CONNECTING);
    const pollingActive = this.activePollingToken !== 0;
    return wsActive || pollingActive;
  }

  /**
   * En producción sobre HTTPS con proxy relativo (/api en Vercel), utiliza
   * directamente el transporte HTTP Long-Polling de Socket.IO para evitar errores
   * de protocolo wss:// no soportado por Vercel Rewrites.
   */
  private shouldUseHttpPolling(): boolean {
    const base = environment.baseUrl.trim();
    const isRelativeBase =
      !base.startsWith('http://') && !base.startsWith('https://');
    const isHttps = window.location.protocol === 'https:';
    return isRelativeBase && isHttps;
  }

  /**
   * Inicia el transporte WebSocket nativo y hace fallback a HTTP Polling si falla la apertura.
   */
  private connectWebSocket(): void {
    this.transportMode = 'websocket';
    const wsUrl = this.buildSocketIoWsUrl();
    const ws = new WebSocket(wsUrl);
    this.socket = ws;
    let openedOnce = false;

    ws.onopen = () => {
      openedOnce = true;
    };

    ws.onmessage = (event: MessageEvent<string>) => {
      this.ngZone.run(() => {
        this.handleIncomingPayload(String(event.data ?? ''));
      });
    };

    ws.onclose = () => {
      this.ngZone.run(() => {
        this.isConnected.set(false);
        this.isTyping.set(false);
        this.socket = null;

        if (!openedOnce && (this.isOpenWidget || this.isAdminSubscribed)) {
          void this.connectPolling();
          return;
        }

        if (this.isOpenWidget || this.isAdminSubscribed) {
          this.scheduleReconnect();
        }
      });
    };

    ws.onerror = () => {
      ws.close();
    };
  }

  /**
   * Inicia el transporte oficial Engine.IO v4 HTTP Long-Polling (`transport=polling`)
   * compatible con el proxy HTTPS de Vercel hacia el backend en GCP.
   */
  private async connectPolling(): Promise<void> {
    if (this.activePollingToken !== 0) {
      return;
    }

    this.transportMode = 'polling';
    const token = ++this.pollingTokenCounter;
    this.activePollingToken = token;
    this.pollingSid = null;
    this.pollingOutbox = [];
    this.isPosting = false;

    const abortController = new AbortController();
    this.pollingAbortController = abortController;
    const pollingEndpoint = this.buildSocketIoPollingUrl();

    try {
      const openRes = await fetch(
        `${pollingEndpoint}?EIO=4&transport=polling&t=${Date.now()}`,
        {
          method: 'GET',
          cache: 'no-store',
          signal: abortController.signal,
        },
      );

      if (!openRes.ok) {
        throw new Error(`Engine.IO handshake status ${openRes.status}`);
      }

      const openBody = await openRes.text();
      if (this.activePollingToken !== token) return;

      const firstPacket = openBody.split(ENGINE_IO_SEPARATOR)[0] ?? '';
      if (!firstPacket.startsWith('0')) {
        throw new Error('Invalid Engine.IO handshake packet');
      }

      const handshake = JSON.parse(firstPacket.slice(1)) as { sid?: string };
      if (!handshake.sid) {
        throw new Error('Missing Engine.IO sid');
      }

      this.pollingSid = handshake.sid;

      this.ngZone.run(() => {
        this.handleIncomingPayload(openBody);
      });
      await this.flushPollingOutbox();

      while (this.activePollingToken === token && this.pollingSid) {
        const pollRes = await fetch(
          `${pollingEndpoint}?EIO=4&transport=polling&sid=${encodeURIComponent(this.pollingSid)}&t=${Date.now()}`,
          {
            method: 'GET',
            cache: 'no-store',
            signal: abortController.signal,
          },
        );

        if (!pollRes.ok) {
          throw new Error(`Engine.IO poll status ${pollRes.status}`);
        }

        const payload = await pollRes.text();
        if (this.activePollingToken !== token) return;

        this.ngZone.run(() => {
          this.handleIncomingPayload(payload);
        });
        await this.flushPollingOutbox();
      }
    } catch {
      if (this.activePollingToken !== token) {
        return;
      }

      this.ngZone.run(() => {
        this.cleanupPolling();
        this.isConnected.set(false);
        this.isTyping.set(false);
        if (this.isOpenWidget || this.isAdminSubscribed) {
          this.scheduleReconnect();
        }
      });
    }
  }

  /**
   * Cierra y limpia cualquier conexión WebSocket activa.
   */
  private cleanupWebSocket(): void {
    if (!this.socket) return;
    this.socket.onopen = null;
    this.socket.onclose = null;
    this.socket.onerror = null;
    this.socket.onmessage = null;
    if (
      this.socket.readyState === WebSocket.OPEN ||
      this.socket.readyState === WebSocket.CONNECTING
    ) {
      this.socket.close();
    }
    this.socket = null;
  }

  /**
   * Cancela y limpia el ciclo de HTTP Long-Polling activo.
   */
  private cleanupPolling(): void {
    this.activePollingToken = 0;
    this.pollingSid = null;
    this.pollingOutbox = [];
    this.isPosting = false;
    if (this.pollingAbortController) {
      this.pollingAbortController.abort();
      this.pollingAbortController = null;
    }
  }

  /**
   * Construye y emite un paquete `message-from-client` con la identidad actual.
   */
  private dispatchClientMessage(message: string, quickOptionId?: string): void {
    const { userName, userEmail } = this.getCurrentUserIdentity();
    this.emitEvent('message-from-client', {
      message,
      quickOptionId,
      sessionId: this.sessionId,
      userName,
      userEmail,
    });
  }

  /**
   * Emite un evento Socket.IO v4 (`42["evento", payload]`) sobre el transporte activo.
   */
  private emitEvent(eventName: string, data: unknown): void {
    const payload = JSON.stringify([eventName, data]);
    this.sendRawPacket(`42${payload}`);
  }

  /**
   * Envía una trama Engine.IO / Socket.IO por WebSocket o la encola en el canal HTTP POST.
   */
  private sendRawPacket(packet: string): void {
    if (this.transportMode === 'websocket') {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.socket.send(packet);
      }
      return;
    }

    this.pollingOutbox.push(packet);
    void this.flushPollingOutbox();
  }

  /**
   * Despacha en orden secuencial los paquetes pendientes por HTTP POST evitando colisiones en Engine.IO.
   */
  private async flushPollingOutbox(): Promise<void> {
    if (
      this.isPosting ||
      !this.pollingSid ||
      this.activePollingToken === 0 ||
      this.pollingOutbox.length === 0
    ) {
      return;
    }

    this.isPosting = true;
    const token = this.activePollingToken;
    const sid = this.pollingSid;
    const pollingEndpoint = this.buildSocketIoPollingUrl();

    try {
      while (
        this.pollingOutbox.length > 0 &&
        this.activePollingToken === token &&
        this.pollingSid === sid
      ) {
        const batch = this.pollingOutbox.splice(0, this.pollingOutbox.length);
        const body = batch.join(ENGINE_IO_SEPARATOR);

        const res = await fetch(
          `${pollingEndpoint}?EIO=4&transport=polling&sid=${encodeURIComponent(sid)}&t=${Date.now()}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
            body,
            signal: this.pollingAbortController?.signal,
          },
        );

        if (!res.ok) {
          throw new Error(`Engine.IO POST status ${res.status}`);
        }
      }
    } catch {
      if (this.activePollingToken === token) {
        this.ngZone.run(() => {
          this.cleanupPolling();
          this.isConnected.set(false);
          this.isTyping.set(false);
          if (this.isOpenWidget || this.isAdminSubscribed) {
            this.scheduleReconnect();
          }
        });
      }
    } finally {
      this.isPosting = false;
    }
  }

  /**
   * Construye la URL WebSocket para entorno de desarrollo local o backend con URL explícita.
   */
  private buildSocketIoWsUrl(): string {
    const base = environment.baseUrl.trim();
    if (base.startsWith('http://') || base.startsWith('https://')) {
      const httpOrigin = base.replace(/\/api\/?$/, '');
      const wsOrigin = httpOrigin.replace(/^http/, 'ws');
      return `${wsOrigin}/socket.io/?EIO=4&transport=websocket`;
    }

    const isSecure = window.location.protocol === 'https:';
    const wsProto = isSecure ? 'wss:' : 'ws:';
    const host = window.location.hostname || 'localhost';
    return `${wsProto}//${host}:3000/socket.io/?EIO=4&transport=websocket`;
  }

  /**
   * Construye la URL de Engine.IO HTTP Long-Polling compatible con `vercel.json` (`/socket.io/:path*`).
   */
  private buildSocketIoPollingUrl(): string {
    const base = environment.baseUrl.trim();
    if (base.startsWith('http://') || base.startsWith('https://')) {
      const httpOrigin = base.replace(/\/api\/?$/, '');
      return `${httpOrigin}/socket.io/polling`;
    }
    return '/socket.io/polling';
  }

  /**
   * Divide tramas múltiples separadas por `\x1e` y las procesa secuencialmente.
   */
  private handleIncomingPayload(payload: string): void {
    if (!payload) return;
    const packets = payload.split(ENGINE_IO_SEPARATOR);
    for (const packet of packets) {
      this.handleRawPacket(packet);
    }
  }

  /**
   * Procesa cada paquete individual del protocolo Engine.IO / Socket.IO v4.
   */
  private handleRawPacket(raw: string): void {
    if (!raw) return;

    if (raw.startsWith('0')) {
      this.sendRawPacket('40');
      return;
    }

    if (raw === '2') {
      this.sendRawPacket('3');
      return;
    }

    if (raw.startsWith('40')) {
      this.isConnected.set(true);
      const { userName, userEmail } = this.getCurrentUserIdentity();
      this.emitEvent('client-identify', {
        sessionId: this.sessionId,
        userName,
        userEmail,
      });

      if (this.isAdminSubscribed) {
        this.emitEvent('admin-join', {});
      }

      if (this.pendingMessages.length > 0) {
        const queued = this.pendingMessages.splice(
          0,
          this.pendingMessages.length,
        );
        for (const item of queued) {
          this.dispatchClientMessage(item.message, item.quickOptionId);
        }
      }
      return;
    }

    if (raw.startsWith('42')) {
      try {
        const parsed = JSON.parse(raw.slice(2)) as [string, unknown];
        const [eventName, data] = parsed;
        this.handleSocketEvent(eventName, data);
      } catch {
        // Ignorar tramas malformadas
      }
    }
  }

  /**
   * Enruta los eventos emitidos por MessageWsGateway hacia los signals del estado.
   */
  private handleSocketEvent(eventName: string, data: unknown): void {
    if (eventName === 'chat-welcome' && data && typeof data === 'object') {
      const welcome = data as SupportChatMessage;
      if (welcome.options?.length) {
        this.quickOptions.set(welcome.options);
      }
      if (this.messages().length === 0) {
        this.messages.set([welcome]);
      }
      return;
    }

    if (eventName === 'bot-typing' && data && typeof data === 'object') {
      const typingState = Boolean((data as { typing?: boolean }).typing);
      this.isTyping.set(typingState);
      return;
    }

    if (
      eventName === 'message-from-server' &&
      data &&
      typeof data === 'object'
    ) {
      const incoming = data as SupportChatMessage;
      if (incoming.options?.length) {
        this.quickOptions.set(incoming.options);
      }
      this.messages.update((prev) => [...prev.slice(-49), incoming]);
      if (!this.isOpenWidget && incoming.sender !== 'user') {
        this.unreadCount.update((n) => n + 1);
      }
      return;
    }

    if (eventName === 'admin-conversations-updated' && Array.isArray(data)) {
      this.adminConversations.set(data as SupportConversation[]);
    }
  }

  /**
   * Obtiene los datos del usuario autenticado actual desde el almacenamiento de sesión.
   */
  private getCurrentUserIdentity(): { userName: string; userEmail: string } {
    try {
      const raw =
        sessionStorage.getItem(SESSION_USER_KEY) ||
        localStorage.getItem(SESSION_USER_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as {
          fullName?: string;
          nombre?: string;
          apellido?: string;
          email?: string;
        };
        const userName =
          parsed.fullName ||
          [parsed.nombre, parsed.apellido].filter(Boolean).join(' ').trim() ||
          'Usuario Kinetic';
        return {
          userName,
          userEmail: parsed.email || 'Sin correo registrado',
        };
      }
    } catch {
      // No-op
    }
    return { userName: 'Visitante Web', userEmail: 'Visitante sin sesión' };
  }

  /**
   * Genera un identificador único de sesión para la conversación actual.
   */
  private generateSessionId(): string {
    if (
      typeof crypto !== 'undefined' &&
      typeof crypto.randomUUID === 'function'
    ) {
      return crypto.randomUUID();
    }
    return `kr-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  /**
   * Programa un reintento automático de conexión si se pierde el enlace con el servidor.
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    this.reconnectTimer = setTimeout(() => {
      if (this.isOpenWidget || this.isAdminSubscribed) {
        this.connect();
      }
    }, 3000);
  }
}
