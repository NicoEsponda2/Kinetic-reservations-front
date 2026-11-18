import {
  Component,
  ElementRef,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  QuickReplyOption,
  SupportChatWsService,
} from '@shared/services/support-chat-ws.service';

/**
 * Widget flotante de soporte híbrido en tiempo real (WebSocket + Bot + IA).
 */
@Component({
  selector: 'app-support-chat',
  imports: [CommonModule, FormsModule],
  templateUrl: './support-chat.component.html',
  styleUrl: './support-chat.component.css',
})
export class SupportChatComponent {
  readonly chatService = inject(SupportChatWsService);
  private readonly router = inject(Router);
  readonly isOpen = signal<boolean>(false);
  readonly draftMessage = signal<string>('');

  private readonly scrollContainer =
    viewChild<ElementRef<HTMLDivElement>>('messagesScroll');

  constructor() {
    effect(() => {
      this.chatService.messages();
      this.chatService.isTyping();
      setTimeout(() => this.scrollToBottom(), 40);
    });
  }

  /**
   * Oculta el widget flotante cuando el usuario navega dentro del panel de administración.
   */
  get isHiddenInAdminRoute(): boolean {
    return this.router.url.startsWith('/admin');
  }

  /**
   * Abre o cierra la ventana del chat y sincroniza la conexión WebSocket.
   */
  toggleChat(): void {
    const next = !this.isOpen();
    this.isOpen.set(next);
    this.chatService.setWidgetOpenState(next);
  }

  /**
   * Envía la opción rápida seleccionada por el usuario a través del WebSocket.
   */
  onSelectQuickOption(option: QuickReplyOption): void {
    this.chatService.sendMessage(option.label, option.id);
  }

  /**
   * Envía el mensaje de texto libre escrito por el usuario.
   */
  onSendFreeText(): void {
    const text = this.draftMessage().trim();
    if (!text) return;

    this.chatService.sendMessage(text);
    this.draftMessage.set('');
  }

  /**
   * Desplaza automáticamente la conversación hacia el último mensaje recibido.
   */
  private scrollToBottom(): void {
    const el = this.scrollContainer()?.nativeElement;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }
}
