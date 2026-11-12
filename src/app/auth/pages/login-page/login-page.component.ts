import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { NgClass } from '@angular/common';

import { AuthService } from '@auth/services/auth.service';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-login-page',
  imports: [ReactiveFormsModule, NgClass],
  templateUrl: './login-page.component.html',
  styleUrls: ['../../pages/auth-page.component.css'],
})
export class LoginPageComponent {
  submitted = false; // controla si se intentó enviar el formulario
  showPassword = false;
  isPosting = signal(false); // para deshabilitar el botón de submit
  isGooglePosting = signal(false); // estado de carga del botón de Google

  fb = inject(FormBuilder);
  router = inject(Router);
  private toastr = inject(ToastrService);
  authService = inject(AuthService);

  loginForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  isValidField(field: string): boolean | null {
    const control = this.loginForm.get(field);
    return control && control.errors && (control.touched || this.submitted);
  }

  // Retorna el mensaje de error específico
  getFieldError(field: string): string | null {
    const control = this.loginForm.get(field);
    if (!control || !control.errors) return null;

    const errors = control.errors;

    if (errors['required']) return 'Este campo es obligatorio';
    if (errors['email']) return 'Debe ser un correo electrónico válido';
    if (errors['minlength'])
      return `Mínimo ${errors['minlength'].requiredLength} caracteres`;

    return 'Campo inválido';
  }

  onSubmit() {
    this.submitted = true;

    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      this.showError('Por favor, revisa los campos marcados en rojo.');
      return;
    }

    this.isPosting.set(true);

    const { email = '', password = '' } = this.loginForm.value;

    this.authService.login(email!, password!).subscribe((response) => {
      this.isPosting.set(false);

      const [isAuthenticated, message] = response;
      if (isAuthenticated) {
        this.toastr.success(
          message || '¡Inicio de sesión exitoso!',
          'Bienvenido',
        );
        this.router.navigateByUrl('/');
        return;
      }
      this.showError(message);
    });
  }

  onGoogleLogin() {
    if (this.isPosting() || this.isGooglePosting()) return;
    this.isGooglePosting.set(true);

    this.authService.loginWithGoogle().subscribe(([isAuthenticated, message]) => {
      this.isGooglePosting.set(false);

      if (isAuthenticated) {
        this.toastr.success(
          message || '¡Inicio de sesión con Google exitoso!',
          'Bienvenido/a',
        );
        this.router.navigateByUrl('/');
        return;
      }

      this.showError(message);
    });
  }

  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

  private showError(msg: string) {
    this.toastr.error(msg);
  }
}
