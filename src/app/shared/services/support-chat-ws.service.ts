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

/**
 * Servicio WebSocket (protocolo Socket.IO v4 sobre WebSocket nativo) para el chat híbrido
 * de Kinetic Reservations (tanto widget de cliente como módulo del administrador).
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
    if (this.socket && this.socket.readyState === WebSocket.OPEN && this.isConnected()) {
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
      adminName: adminName || this.getCurrentUserIdentity().userName || 'Administración Kinetic',
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

    if (this.socket) {
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
   * Inicia la conexión WebSocket con el gateway de NestJS si aún no está activa.
   */
  connect(): void {
    if (
      typeof window === 'undefined' ||
      (this.socket &&
        (this.socket.readyState === WebSocket.OPEN ||
          this.socket.readyState === WebSocket.CONNECTING))
    ) {
      return;
    }

    const wsUrl = this.buildSocketIoWsUrl();
    const ws = new WebSocket(wsUrl);
    this.socket = ws;

    ws.onmessage = (event: MessageEvent<string>) => {
      this.ngZone.run(() => {
        this.handleRawPacket(String(event.data ?? ''));
      });
    };

    ws.onclose = () => {
      this.ngZone.run(() => {
        this.isConnected.set(false);
        this.isTyping.set(false);
        this.socket = null;
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
   * Envía un mensaje de texto libre o una opción rápida seleccionada al servidor WebSocket.
   */
  sendMessage(message: string, quickOptionId?: string): void {
    const clean = message.trim();
    if (!clean) return;

    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      this.connect();
      return;
    }

    const { userName, userEmail } = this.getCurrentUserIdentity();
    this.emitEvent('message-from-client', {
      message: clean,
      quickOptionId,
      sessionId: this.sessionId,
      userName,
      userEmail,
    });
  }

  /**
   * Emite un evento Socket.IO v4 (`42["evento", payload]`) sobre el WebSocket activo.
   */
  private emitEvent(eventName: string, data: unknown): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return;
    }
    const payload = JSON.stringify([eventName, data]);
    this.socket.send(`42${payload}`);
  }

  /**
   * Construye la URL WebSocket compatible con desarrollo (Docker local) y producción (GCP).
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
   * Procesa los paquetes del protocolo Engine.IO / Socket.IO v4.
   */
  private handleRawPacket(raw: string): void {
    if (!raw) return;

    if (raw.startsWith('0')) {
      this.socket?.send('40');
      return;
    }

    if (raw === '2') {
      this.socket?.send('3');
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

    if (eventName === 'message-from-server' && data && typeof data === 'object') {
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
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
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
