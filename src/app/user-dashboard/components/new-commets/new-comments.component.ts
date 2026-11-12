import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  inject,
} from '@angular/core';
import { NgClass } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';

import { UserService } from '../../services/user.service';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-new-comments',
  imports: [NgClass, ReactiveFormsModule],
  templateUrl: './new-comments.component.html',
})
export class NewCommentsComponent implements OnInit {
  @Input() id_reserva!: number;
  @Input() id_servicio!: number | string;
  @Input() resenaExistente: any = null;

  @Output() cerrarModal = new EventEmitter<void>();
  @Output() resenaGuardada = new EventEmitter<any>();

  private fb = inject(FormBuilder);
  private userService = inject(UserService);
  private toastr = inject(ToastrService);

  resenaForm!: FormGroup;
  estrellas: number[] = [1, 2, 3, 4, 5];
  cargando = false;

  ngOnInit(): void {
    this.initForm();

    if (this.resenaExistente) {
      this.resenaForm.patchValue({
        calificacion: this.resenaExistente.calificacion,
        comentario: this.resenaExistente.comentario,
      });
    }
  }

  initForm(): void {
    this.resenaForm = this.fb.group({
      calificacion: [0, [Validators.required, Validators.min(1)]],
      comentario: [
        '',
        [
          Validators.required,
          Validators.minLength(20),
          Validators.maxLength(200),
        ],
      ],
    });
  }

  setCalificacion(valor: number): void {
    this.resenaForm.get('calificacion')?.setValue(valor);
    this.resenaForm.get('calificacion')?.markAsTouched();
  }

  cerrar(): void {
    this.cerrarModal.emit();
  }

  guardarResena(): void {
    if (this.resenaForm.invalid) {
      this.resenaForm.markAllAsTouched();
      return;
    }

    this.cargando = true;

    const payload = {
      id_reserva: this.id_reserva,
      id_servicio: this.id_servicio,
      calificacion: this.resenaForm.value.calificacion,
      comentario: this.resenaForm.value.comentario,
    };

    if (this.resenaExistente) {
      this.userService.actualizarResena(payload).subscribe({
        next: (respuesta) => {
          this.cargando = false;
          this.toastr.success(respuesta.msg);
          this.resenaGuardada.emit(true);
        },
        error: (err) => {
          this.toastr.error(err);
          this.cargando = false;
        },
      });
    } else {
      this.userService.crearResena(payload).subscribe({
        next: (respuesta: any) => {
          this.cargando = false;
          this.toastr.success(respuesta.msg);
          this.resenaGuardada.emit(respuesta);
        },
        error: (err: any) => {
          this.toastr.error(err);
          this.cargando = false;
        },
      });
    }
  }
}
