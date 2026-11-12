import { Component, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '@auth/services/auth.service';
import { RegisterFormValues } from '@auth/interfaces/auth-response.interface';

import { NgClass } from '@angular/common';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-register-page',
  imports: [ReactiveFormsModule, NgClass],
  templateUrl: './register-page.component.html',
  styleUrls: ['../auth-page.component.css'],
})
export class RegisterPageComponent {
  submitted = false;
  private toastr = inject(ToastrService);
  showPassword = false;
  showConfirmPassword = false;

  fb = inject(FormBuilder);
  isPosting = signal(false);
  isGooglePosting = signal(false);
  router = inject(Router);
  authService = inject(AuthService);

  // ER para aceptar solo letras (incluye tildes y la ñ)
  private namePattern = /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/;
  // ER para exigir mayúscula, minúscula y número o carácter especial (alineado con CreateUserDto del backend)
  private passwordPattern =
    /(?:(?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/;

  registerForm = this.fb.group(
    {
      nombre: ['', [Validators.required, Validators.pattern(this.namePattern)]],
      apellido: [
        '',
        [Validators.required, Validators.pattern(this.namePattern)],
      ],
      email: ['', [Validators.required, Validators.email]],
      repetir_email: ['', [Validators.required]],
      password: [
        '',
        [
          Validators.required,
          Validators.minLength(6),
          Validators.pattern(this.passwordPattern),
        ],
      ],
      repetir_password: ['', [Validators.required]],
      terminos: [false, Validators.requiredTrue],
    },
    {
      validators: [
        this.matchValues('email', 'repetir_email'),
        this.matchValues('password', 'repetir_password'),
      ],
    },
  );

  togglePassword() {
    this.showPassword = !this.showPassword;
  }

  toggleConfirmPassword() {
    this.showConfirmPassword = !this.showConfirmPassword;
  }

  matchValues(field1: string, field2: string): ValidatorFn {
    return (formGroup: AbstractControl): ValidationErrors | null => {
      const control1 = formGroup.get(field1);
      const control2 = formGroup.get(field2);

      if (!control1 || !control2) return null;

      if (control1.value !== control2.value) {
        control2.setErrors({ ...control2.errors, mismatch: true });
      } else {
        if (control2.errors && control2.errors['mismatch']) {
          delete control2.errors['mismatch'];
          if (Object.keys(control2.errors).length === 0) {
            control2.setErrors(null);
          }
        }
      }
      return null;
    };
  }

  // Verifica si un campo tiene error y ya fue tocado o el form se intentó enviar
  isValidField(field: string): boolean | null {
    const control = this.registerForm.get(field);
    return control && control.errors && (control.touched || this.submitted);
  }

  getFieldError(field: string): string | null {
    const control = this.registerForm.get(field);
    if (!control || !control.errors) return null;

    const errors = control.errors;

    if (errors['required']) return 'Este campo es obligatorio';
    if (errors['pattern']) {
      if (field === 'password') {
        return 'Debe incluir mayúscula, minúscula y un número';
      }
      return 'Formato no válido (solo letras)';
    }
    if (errors['email']) return 'Debe ser un correo electrónico válido';
    if (errors['minlength'])
      return `Mínimo ${errors['minlength'].requiredLength} caracteres`;
    if (errors['mismatch']) return 'Los campos no coinciden';
    if (errors['requiredTrue']) return 'Debes aceptar los términos';

    return 'Campo inválido';
  }

  onSubmit() {
    this.submitted = true;

    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      this.showError('Por favor, revisa los campos marcados en rojo.');
      return;
    }

    this.isPosting.set(true);

    const formData = this.registerForm.value as RegisterFormValues;
    const userData = {
      nombre: formData.nombre,
      apellido: formData.apellido,
      email: formData.email,
      password: formData.password,
    };

    this.authService.register(userData).subscribe((response) => {
      this.isPosting.set(false);
      const [isAuthenticated, message] = response;

      if (isAuthenticated) {
        this.toastr.success(message || '¡Registro exitoso!', 'Bienvenido/a');
        this.router.navigateByUrl('/');
        return;
      }
      this.showError(message);
    });
  }

  onGoogleRegister() {
    if (this.isPosting() || this.isGooglePosting()) return;
    this.isGooglePosting.set(true);

    this.authService.loginWithGoogle().subscribe(([isAuthenticated, message]) => {
      this.isGooglePosting.set(false);

      if (isAuthenticated) {
        this.toastr.success(
          message || '¡Registro con Google exitoso!',
          'Bienvenido/a',
        );
        this.router.navigateByUrl('/');
        return;
      }

      this.showError(message);
    });
  }

  private showError(msg: string) {
    this.toastr.error(msg, 'Error en el registro');
  }
}
