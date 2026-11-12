import {
  Component,
  DestroyRef,
  inject,
  OnInit,
  ViewChild,
  ElementRef,
} from '@angular/core';
import { DecimalPipe, SlicePipe } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from '@auth/services/auth.service';
import { GlobalService } from '@user-front/services/global.service';
import {
  ReservaServicio,
  HorarioBloque,
  TransbankResponse,
} from '@user-front/interfaces/services';
import { HttpClient } from '@angular/common/http';
import { ToastrService } from 'ngx-toastr';
import { environment } from 'src/environments/environment';
import { getBusinessDateTime } from '@shared/utils/business-time.util';

@Component({
  selector: 'app-new-booking',
  imports: [DecimalPipe, SlicePipe, ReactiveFormsModule],
  templateUrl: './new-booking.component.html',
})
export class NewBookingComponent implements OnInit {
  authService = inject(AuthService);
  globalService = inject(GlobalService);
  private http = inject(HttpClient);
  private fb = inject(FormBuilder);
  private toastr = inject(ToastrService);
  private destroyRef = inject(DestroyRef);

  bookingForm!: FormGroup;
  currentStep = 1;
  totalSteps = 3;

  isProcessingPayment = false;
  transbankData: TransbankResponse | null = null;

  @ViewChild('formTransbank') formTransbank!: ElementRef<HTMLFormElement>;

  deportes: ReservaServicio[] = [];
  courts: { id_pista: number; nombre: string; precio_hora: number }[] = [];
  timeSlots: HorarioBloque[] = [];
  minDate: string;

  constructor() {
    this.minDate = getBusinessDateTime().date;
  }

  ngOnInit(): void {
    this.initializeForm();
    this.loadServices();
    this.setupCascade();
  }

  initializeForm(): void {
    const user = this.authService.user();

    let initialPhone = user?.telefono ? user.telefono.toString().trim() : '';

    if (initialPhone) {
      const cleanNumber = initialPhone.replace(/^(\+?56)?\s?(9)?\s?/, '');
      initialPhone = '+569' + cleanNumber;
    } else {
      initialPhone = '+569';
    }

    this.bookingForm = this.fb.group({
      fullName: [
        user?.nombre ?? '',
        [Validators.required, Validators.minLength(3)],
      ],
      email: [user?.email ?? '', [Validators.required, Validators.email]],
      phone: [
        initialPhone,
        [
          Validators.required,
          Validators.pattern(/^\+569[0-9\s\-\(\)]{8,}$/),
        ],
      ],
      sport: ['', Validators.required],
      court: ['', Validators.required],
      players: [
        10,
        [Validators.required, Validators.min(1), Validators.max(22)],
      ],
      timeSlot: ['', Validators.required],
      date: ['', Validators.required],
    });
  }

  loadServices(): void {
    this.globalService.buscarNombreServicios().subscribe((servicios) => {
      this.deportes = servicios;
    });
  }

  enforcePhonePrefix(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.value.startsWith('+569')) {
      const cleaned = input.value.replace(/^(\+?56)?\s?(9)?\s?/, '');
      this.bookingForm
        .get('phone')
        ?.setValue('+569' + cleaned, { emitEvent: false });
    }
  }

  setupCascade(): void {
    this.bookingForm
      .get('sport')
      ?.valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((sportId) => {
        this.updateCourts(sportId);
        this.bookingForm.patchValue({ court: '', date: '', timeSlot: '' });
        this.timeSlots = [];
      });

    this.bookingForm
      .get('court')
      ?.valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.bookingForm.get('date')?.reset('', { emitEvent: false });
        this.bookingForm.get('timeSlot')?.reset('', { emitEvent: false });
        this.timeSlots = [];
      });

    this.bookingForm
      .get('date')
      ?.valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((fecha) => {
        this.bookingForm.get('timeSlot')?.reset('', { emitEvent: false });
        this.timeSlots = [];
        const sportId = this.bookingForm.get('sport')?.value;
        const id_pista = this.bookingForm.get('court')?.value;
        if (fecha && sportId) {
          this.globalService
            .obtenerHorariosDisponibles(sportId, fecha, +id_pista)
            .subscribe((horarios) => {
              this.timeSlots = horarios;
            });
        }
      });
  }

  updateCourts(sportId: string): void {
    const selected = this.deportes.find((s) => s.id_servicio === sportId);
    this.courts = selected?.pistas ?? [];
  }

  get reservaRoute(): string {
    return this.authService.isAdmin()
      ? '/admin/confirmacion-reserva'
      : '/panel-usuario/confirmacion-reserva';
  }

  get selectedSportName(): string {
    const id = this.bookingForm.get('sport')?.value;
    return this.deportes.find((s) => s.id_servicio === id)?.nombre ?? '';
  }

  get selectedSportImage(): string {
    const id = this.bookingForm.get('sport')?.value;
    return (
      this.deportes.find((s) => s.id_servicio === id)?.imagen_principal ?? ''
    );
  }

  get selectedCourtName(): string {
    const id = +this.bookingForm.get('court')?.value;
    return this.courts.find((c) => c.id_pista === id)?.nombre ?? '';
  }

  get selectedCourtPrice(): number | null {
    const id = +this.bookingForm.get('court')?.value;
    const court = this.courts.find((c) => c.id_pista === id);
    return court ? court.precio_hora : null;
  }

  get formattedTimeSlot(): string {
    const raw: string = this.bookingForm.get('timeSlot')?.value ?? '';
    return raw.replace(/(\d{2}:\d{2}):\d{2}/g, '$1');
  }

  getProgressPercentage(): number {
    return (this.currentStep / this.totalSteps) * 100;
  }

  nextStep(): void {
    if (this.currentStep < this.totalSteps) {
      this.currentStep++;
    }
  }

  previousStep(): void {
    if (this.currentStep > 1) {
      this.currentStep--;
    }
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.bookingForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  onSubmit(): void {
    if (this.bookingForm.valid) {
      this.nextStep();
    } else {
      this.bookingForm.markAllAsTouched();
    }
  }

  iniciarPagoTransbank(): void {
    if (this.bookingForm.invalid) {
      this.bookingForm.markAllAsTouched();
      return;
    }

    this.isProcessingPayment = true;

    const user = this.authService.user();
    const tempReservationId = Math.floor(Math.random() * 1000000);
    const formValues = this.bookingForm.value;
    const [horaInicio, horaTermino] = String(formValues.timeSlot || '').split(' - ');

    const payload = {
      id_reserva: tempReservationId,
      id_usuario: user?.id_usuario || 'TESTUSER',
      role: this.authService.isAdmin() ? '2' : '3',
      monto: this.selectedCourtPrice ?? 0,
      id_pista: Number(formValues.court),
      fecha: formValues.date,
      hora_inicio: horaInicio,
      hora_termino: horaTermino,
    };

    this.http
      .post<TransbankResponse>(
        `${environment.baseUrl}/payment/initiate-payment`,
        payload,
      )
      .subscribe({
        next: (response) => {
          if (response.ok) {
            this.transbankData = {
              ok: response.ok,
              url: response.url,
              token: response.token,
            };

            sessionStorage.setItem(
              'reservaFormMemoria',
              JSON.stringify(this.bookingForm.value),
            );

            this.guardarReservaTemporal(tempReservationId);

            setTimeout(() => {
              if (this.formTransbank?.nativeElement) {
                this.formTransbank.nativeElement.submit();
              } else {
                this.toastr.error(
                  'No se pudo redirigir a la pasarela de pago.',
                  'Error',
                );
                this.isProcessingPayment = false;
              }
            }, 50);
          } else {
            this.toastr.error('No fue posible iniciar el pago.', 'Error');
            this.isProcessingPayment = false;
          }
        },
        error: () => {
          this.isProcessingPayment = false;
          this.toastr.error(
            'Hubo un error al intentar procesar el pago. Por favor intenta nuevamente.',
            'Error de pago',
          );
        },
      });
  }

  private guardarReservaTemporal(id: number) {
    const formValues = this.bookingForm.value;
    const user = this.authService.user();

    const detalleCompleto = {
      courtName: this.selectedCourtName,
      courtType: this.selectedSportName,
      schedule: this.formattedTimeSlot,
      imageUrl: this.selectedSportImage,
      idUsuario: user?.id_usuario || 'id-temporal',
      idServicio: formValues.sport,
      idPista: Number(formValues.court),
      fecha: formValues.date,
      horaInicio: formValues.timeSlot.split(' - ')[0],
      horaTermino: formValues.timeSlot.split(' - ')[1],
      comentario: formValues.comentario || '',
      email: formValues.email,
      nombreUsuario: formValues.fullName,
      nombreCancha: this.selectedCourtName,
    };

    const serialized = JSON.stringify(detalleCompleto);
    sessionStorage.setItem('reservaPendiente', serialized);
    localStorage.setItem('reservaPendiente', serialized);
  }
}
