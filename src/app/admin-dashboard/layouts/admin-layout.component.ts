import { Component } from '@angular/core';
import {
  MenuItem,
  SidebarComponent,
} from '../../components/sidebar/sidebar.component';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-admin-dashboard-layout',
  imports: [RouterOutlet, SidebarComponent],
  templateUrl: './admin-layout.component.html',
  styleUrl: './admin-layout.component.css',
})
export class AdminLayoutComponent {
  adminMenuItems: MenuItem[] = [
    { label: 'Panel', icon: 'dashboard', route: '/admin/dashboard' },
    { label: 'Reservas', icon: 'calendar_today', route: '/admin/bookings' },
    { label: 'Usuarios', icon: 'groups', route: '/admin/users' },
    { label: 'Comentarios', icon: 'comment', route: '/admin/comentarios' },
    { label: 'Servicios', icon: 'payments', route: '/admin/servicios' },
    { label: 'Chat Soporte', icon: 'support_agent', route: '/admin/chat-soporte' },
  ];
}
