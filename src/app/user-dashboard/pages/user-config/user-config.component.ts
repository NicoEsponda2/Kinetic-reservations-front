import { Component, inject, OnInit } from '@angular/core';
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
} from '@angular/forms';
import { AuthService } from '@auth/services/auth.service';
import { UserService } from '../../services/user.service';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-user-config',
  imports: [ReactiveFormsModule],
  templateUrl: './user-config.component.html',
  styleUrls: ['./user-config.component.css'],
})
export class UserConfigComponent implements OnInit {
  private fb = inject(FormBuilder);
  private userService = inject(UserService);
  private authService = inject(AuthService);
  private toastr = inject(ToastrService);

  perfilForm!: FormGroup;

  ngOnInit(): void {
    this.perfilForm = this.fb.group({
      nombre: ['', [Validators.required, Validators.minLength(2)]],
      apellido: [''],
      telefono: ['', [Validators.pattern('^[0-9+\\s-]*$')]],
      genero: ['N'],
      email: [''],
      fecha_nacimiento: [''],
    });

    if (this.authService.user()) {
      this.cargarDatosActuales();
    } else {
      this.authService.checkStatus().subscribe(() => {
        this.cargarDatosActuales();
      });
    }
  }

  private cargarDatosActuales(): void {
    const usuarioActual = this.authService.user();
    if (usuarioActual) {
      this.perfilForm.patchValue({
        nombre: usuarioActual.nombre ?? '',
        apellido: usuarioActual.apellido ?? '',
        telefono: usuarioActual.telefono ?? '',
        genero: usuarioActual.genero ? String(usuarioActual.genero) : 'N',
        email: usuarioActual.email ?? '',
        fecha_nacimiento: usuarioActual.fecha_nacimiento
          ? String(usuarioActual.fecha_nacimiento).substring(0, 10)
          : '',
      });
    }
  }

  guardarCambios(): void {
    if (this.perfilForm.invalid) {
      this.perfilForm.markAllAsTouched();
      this.toastr.warning('Por favor verifica los campos obligatorios.');
      return;
    }

    const idUsuario = this.authService.user()?.id_usuario;
    if (!idUsuario) {
      this.toastr.error('No se pudo identificar al usuario actual.');
      return;
    }

    const datosFormulario = this.perfilForm.value;

    this.userService.editarPerfilUsuario(idUsuario, datosFormulario).subscribe({
      next: (resp) => {
        if (resp?.usuario) {
          this.authService.updateUser(resp.usuario);
        }
        this.toastr.success(resp.msg || 'Perfil actualizado correctamente');
      },
      error: (err) => this.toastr.error(err),
    });
  }
}
