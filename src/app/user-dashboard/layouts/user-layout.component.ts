import { Component } from '@angular/core';
import {
  MenuItem,
  SidebarComponent,
} from '../../components/sidebar/sidebar.component';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-user-layout',
  imports: [SidebarComponent, RouterOutlet],
  templateUrl: './user-layout.component.html',
})
export class UserLayoutComponent {
  userMenuItems: MenuItem[] = [
    { label: 'Panel', icon: 'dashboard', route: 'dashboard-usuario' },
    { label: 'Reservas', icon: 'calendar_today', route: 'reservas-usuario' },
    { label: 'Comentarios', icon: 'comment', route: 'comentarios-usuario' },
    { label: 'Configuración', icon: 'settings', route: 'configuracion-perfil' },
  ];
}
