import {
  Component,
  ElementRef,
  OnInit,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  SupportChatWsService,
  SupportConversation,
} from '@shared/services/support-chat-ws.service';
import { AuthService } from '@auth/services/auth.service';

type InboxFilter = 'all' | 'human' | 'unread';

/**
 * Módulo del Panel de Administración para supervisar y responder en tiempo real
 * las conversaciones del chat híbrido (WebSocket + Bot + IA Gemini).
 */
@Component({
  selector: 'app-admin-support-chat',
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-support-chat.component.html',
  styleUrl: './admin-support-chat.component.css',
})
export class AdminSupportChatComponent implements OnInit {
  readonly chatService = inject(SupportChatWsService);
  private readonly authService = inject(AuthService);

  readonly selectedSessionId = signal<string | null>(null);
  readonly activeFilter = signal<InboxFilter>('all');
  readonly replyDraft = signal<string>('');

  readonly adminQuickTemplates: readonly string[] = [
    '¡Hola! Te saluda la administración de Kinetic Sports Club, ¿cómo podemos ayudarte?',
    'Hemos verificado tu reserva en el sistema y todo se encuentra en orden.',
    'Tu solicitud ha sido procesada. ¡Te esperamos en el club!',
  ];

  private readonly threadScroll =
    viewChild<ElementRef<HTMLDivElement>>('threadScroll');

  readonly filteredConversations = computed<SupportConversation[]>(() => {
    const list = this.chatService.adminConversations();
    const filter = this.activeFilter();

    if (filter === 'human') {
      return list.filter((c) => c.needsHumanAdmin);
    }
    if (filter === 'unread') {
      return list.filter((c) => c.unreadForAdmin);
    }
    return list;
  });

  readonly selectedConversation = computed<SupportConversation | null>(() => {
    const list = this.chatService.adminConversations();
    const id = this.selectedSessionId();
    if (!list.length) return null;
    if (id) {
      const found = list.find((c) => c.sessionId === id);
      if (found) return found;
    }
    return list[0];
  });

  readonly totalHumanRequests = computed(
    () =>
      this.chatService
        .adminConversations()
        .filter((c) => c.needsHumanAdmin).length,
  );

  readonly totalUnread = computed(
    () =>
      this.chatService
        .adminConversations()
        .filter((c) => c.unreadForAdmin).length,
  );

  constructor() {
    effect(() => {
      const current = this.selectedConversation();
      current?.messages.length;
      setTimeout(() => this.scrollToBottom(), 40);
    });
  }

  /**
   * Conecta el panel de administración al canal de monitoreo WebSocket al iniciar.
   */
  ngOnInit(): void {
    this.chatService.joinAdminChannel();
  }

  /**
   * Selecciona una conversación de la lista y la marca como leída.
   */
  selectConversation(conv: SupportConversation): void {
    this.selectedSessionId.set(conv.sessionId);
    if (conv.unreadForAdmin) {
      this.chatService.markAdminConversationRead(conv.sessionId);
    }
  }

  /**
   * Cambia el filtro activo de la bandeja de entrada.
   */
  setFilter(filter: InboxFilter): void {
    this.activeFilter.set(filter);
  }

  /**
   * Inserta o envía una plantilla rápida de respuesta administrativa.
   */
  useQuickTemplate(template: string): void {
    this.replyDraft.set(template);
  }

  /**
   * Envía la respuesta del administrador en vivo al usuario seleccionado vía WebSocket.
   */
  sendReply(): void {
    const conv = this.selectedConversation();
    const text = this.replyDraft().trim();
    if (!conv || !text) return;

    const adminName =
      this.authService.user()?.fullName || 'Administración Kinetic';
    this.chatService.sendAdminReply(conv.sessionId, text, adminName);
    this.replyDraft.set('');
  }

  /**
   * Marca la solicitud de atención humana de la conversación actual como resuelta.
   */
  markAsResolved(conv: SupportConversation): void {
    this.chatService.resolveAdminConversation(conv.sessionId);
  }

  /**
   * Obtiene las iniciales del usuario para mostrar en el avatar de la conversación.
   */
  getInitials(name: string): string {
    const parts = (name || 'U').trim().split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return (parts[0]?.slice(0, 2) || 'UK').toUpperCase();
  }

  /**
   * Devuelve el último mensaje registrado en una conversación para la vista previa.
   */
  getLastMessagePreview(conv: SupportConversation): string {
    const last = conv.messages[conv.messages.length - 1];
    return last ? last.message : 'Sin mensajes';
  }

  /**
   * Desplaza el contenedor del hilo hacia el último mensaje recibido.
   */
  private scrollToBottom(): void {
    const el = this.threadScroll()?.nativeElement;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }
}
