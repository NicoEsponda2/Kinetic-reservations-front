import { Component, EventEmitter, inject, Input, Output } from '@angular/core';
import { NgClass } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '@auth/services/auth.service';
import { CloudinaryImagePipe } from '../../pipes/cloudinary-image.pipe';

export interface MenuItem {
  label: string;
  icon: string;
  route: string;
}

@Component({
  selector: 'app-sidebar',
  imports: [NgClass, RouterLink, RouterLinkActive, CloudinaryImagePipe],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.css',
})
export class SidebarComponent {
  authService = inject(AuthService);
  readonly defaultUserImage =
    'https://res.cloudinary.com/dhwoq5fdq/image/upload/f_auto,q_auto,w_800/v1792590759/KINETIC-RESERVATIONS/Static/xila8me2itmgmwxnskzy.jpg';

  isCollapsed = false;

  @Input() menuItems: MenuItem[] = [];
  @Input() logoText: string = '[Logo Recinto]';
  @Input() subtitleText: string = 'Panel Administrativo';
  @Input() userName: string = 'User name';
  @Input() userEmail: string = 'user@kinetic.com';
  @Input() userImage: string = '';
  @Input() buttonText?: string = '';

  @Output() newButtonClick = new EventEmitter<void>();

  activeClass =
    'bg-[#59ee50]/10 text-[#59ee50] border-r-4 border-[#59ee50] font-bold';
  inactiveClass =
    'text-slate-400 font-medium hover:bg-slate-800 hover:text-white';

  get reservaRoute(): string {
    return this.authService.isAdmin()
      ? '/admin/nueva-reserva'
      : '/panel-usuario/nueva-reserva';
  }

  get currentUserName(): string {
    return this.authService.user()?.fullName || this.userName;
  }

  get currentUserEmail(): string {
    return this.authService.user()?.email || this.userEmail;
  }

  get currentUserImage(): string {
    const authImage = this.authService.user()?.imagen?.trim();

    if (authImage) {
      return authImage.startsWith('http')
        ? authImage
        : `http://localhost:4200/as/${authImage}`;
    }

    return this.userImage || this.defaultUserImage;
  }

  toggleSidebar(): void {
    this.isCollapsed = !this.isCollapsed;
  }

  onNewButtonClick(): void {
    this.newButtonClick.emit();
  }
}
