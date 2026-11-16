import { DecimalPipe, NgClass } from '@angular/common';
import {
  Component,
  computed,
  inject,
  Input,
  OnDestroy,
  OnInit,
  signal,
} from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import { AdminService } from '@dashboard/services/admin.service';
import {
  HorarioBloque,
  Pista,
  Servicio,
} from '@user-front/interfaces/services';
import { ToastrService } from 'ngx-toastr';
import { CloudinaryImagePipe } from '../../../pipes/cloudinary-image.pipe';

export interface GalleryItem {
  id?: number | string;
  url: string;
  file?: File;
  isExisting: boolean;
}

export interface BloqueUI {
  horaInicio: string;
  horaTermino: string;
  bloqueActivo: boolean;
}

export interface DiaHorario {
  diaSemana: number;
  nombre: string;
  activo: boolean;
  bloques: BloqueUI[];
}

@Component({
  selector: 'app-service-form',
  imports: [
    NgClass,
    DecimalPipe,
    ReactiveFormsModule,
    FormsModule,
    CloudinaryImagePipe,
  ],
  templateUrl: './sport-form.component.html',
})
export class ServiceFormComponent implements OnInit, OnDestroy {
  @Input() serviceId?: string;
  @Input() service?: Servicio;

  isSubmitting = false;

  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly adminService = inject(AdminService);
  private readonly toastr = inject(ToastrService);

  readonly maxGalleryImages = 6;

  mainImagePreview = signal<string | null>(null);
  mainImageFile = signal<File | null>(null);
  galleryItems = signal<GalleryItem[]>([]);
  deletedGalleryUrls = signal<string[]>([]);
  galleryError = signal<string | null>(null);

  canAddMoreGallery = computed(
    () => this.galleryItems().length < this.maxGalleryImages,
  );

  isEditMode = false;
  loading = false;

  form: FormGroup = this.fb.group({
    nombre: ['', [Validators.required, Validators.maxLength(255)]],
    descripcion: ['', [Validators.required]],
    is_active: [true, [Validators.required]],
  });

  horarioSemanal: DiaHorario[] = [];
  pistas: Pista[] = [];

  modalPistaAbierto = false;
  nuevaPistaNombre = '';
  nuevaPistaPrecio: number | null = null;
  editandoPista: Pista | null = null;

  modalAbierto = false;
  modalDia: DiaHorario | null = null;
  modalHoraInicio = '09:00';
  modalHoraTermino = '20:00';

  readonly horasDisponibles: string[] = [
    '01:00',
    '02:00',
    '03:00',
    '04:00',
    '05:00',
    '06:00',
    '07:00',
    '08:00',
    '09:00',
    '10:00',
    '11:00',
    '12:00',
    '13:00',
    '14:00',
    '15:00',
    '16:00',
    '17:00',
    '18:00',
    '19:00',
    '20:00',
    '21:00',
    '22:00',
    '23:00',
    '00:00',
  ];

  private readonly DIAS_ORDEN = [1, 2, 3, 4, 5, 6, 0];
  private readonly DIAS_NOMBRES: Record<number, string> = {
    0: 'Domingo',
    1: 'Lunes',
    2: 'Martes',
    3: 'Miércoles',
    4: 'Jueves',
    5: 'Viernes',
    6: 'Sábado',
  };

  ngOnInit(): void {
    this.isEditMode = !!this.serviceId;
    if (!this.isEditMode || !this.serviceId) {
      this.initHorarioSemanal([]);
      return;
    }

    if (this.service) {
      this.applyService(this.service);
      if (!this.service.horarios || !this.service.pistas) {
        this.loadService(this.serviceId, this.service);
      }
    } else {
      this.loadService(this.serviceId);
    }
  }

  ngOnDestroy(): void {
    const mainPreview = this.mainImagePreview();
    if (mainPreview?.startsWith('blob:')) {
      URL.revokeObjectURL(mainPreview);
    }

    this.galleryItems().forEach((item) => {
      if (!item.isExisting && item.url.startsWith('blob:')) {
        URL.revokeObjectURL(item.url);
      }
    });
  }

  get title(): string {
    return this.isEditMode ? 'Editar Servicio' : 'Nuevo Servicio';
  }

  get subtitle(): string {
    return this.isEditMode
      ? 'Modifica la información del servicio existente.'
      : 'Configuración y gestión del nuevo servicio.';
  }

  private loadService(id: string, selectedService?: Servicio): void {
    this.loading = true;
    this.adminService.obtenerServicioById(id).subscribe({
      next: (servicio) => {
        if (servicio) {
          const mergedService = {
            ...servicio,
            ...selectedService,
            horarios: selectedService?.horarios ?? servicio.horarios ?? [],
            pistas: selectedService?.pistas ?? servicio.pistas ?? [],
          };
          this.applyService(mergedService);
          this.loadExistingImagesFromSport(mergedService);
        }
        this.loading = false;
      },
      error: (error) => {
        this.loading = false;
        this.toastr.error(error);
      },
    });
  }

  private applyService(
    servicio: Servicio & { imagen_principal?: string; imagenes?: any[] },
  ): void {
    this.form.patchValue({
      nombre: servicio.nombre,
      descripcion: servicio.descripcion,
      is_active: servicio.is_active,
    });
    this.initHorarioSemanal(servicio.horarios ?? []);
    this.pistas = (servicio.pistas ?? []).map((pista: Pista) => ({ ...pista }));
    this.loadExistingImagesFromSport(servicio);
  }

  private loadExistingImagesFromSport(sport: {
    imagen_principal?: string;
    imagenes?: { id?: number; url: string }[] | string[];
  }): void {
    if (sport.imagen_principal) {
      this.mainImagePreview.set(sport.imagen_principal);
    }

    if (sport.imagenes?.length) {
      const existingItems: GalleryItem[] = sport.imagenes
        .slice(0, this.maxGalleryImages)
        .map((img) => {
          if (typeof img === 'string') {
            return { url: img, isExisting: true };
          }
          return { id: img.id, url: img.url, isExisting: true };
        });

      this.galleryItems.set(existingItems);
    }
  }

  onMainImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    const currentPreview = this.mainImagePreview();
    if (currentPreview && currentPreview.startsWith('blob:')) {
      URL.revokeObjectURL(currentPreview);
    }

    this.mainImageFile.set(file);
    this.mainImagePreview.set(URL.createObjectURL(file));
    input.value = '';
  }

  removeMainImage(): void {
    const currentPreview = this.mainImagePreview();
    if (currentPreview && currentPreview.startsWith('blob:')) {
      URL.revokeObjectURL(currentPreview);
    }
    this.mainImageFile.set(null);
    this.mainImagePreview.set(null);
  }

  onGalleryImagesSelected(event: Event): void {
    this.galleryError.set(null);
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const selectedFiles = Array.from(input.files);
    const currentCount = this.galleryItems().length;
    const availableSlots = this.maxGalleryImages - currentCount;

    if (availableSlots <= 0) {
      this.galleryError.set('Ya alcanzaste el límite máximo de 6 imágenes.');
      input.value = '';
      return;
    }

    if (selectedFiles.length > availableSlots) {
      this.galleryError.set(
        `Solo se agregaron ${availableSlots} imagen(es) para no superar el límite de 6.`,
      );
    }

    const filesToAdd = selectedFiles.slice(0, availableSlots);
    const newItems: GalleryItem[] = filesToAdd.map((file) => ({
      url: URL.createObjectURL(file),
      file,
      isExisting: false,
    }));

    this.galleryItems.update((current) => [...current, ...newItems]);
    input.value = '';
  }

  removeGalleryImage(index: number): void {
    this.galleryError.set(null);
    const itemToRemove = this.galleryItems()[index];
    if (!itemToRemove) return;

    if (itemToRemove.isExisting) {
      this.deletedGalleryUrls.update((urls) => [...urls, itemToRemove.url]);
    } else if (itemToRemove.url.startsWith('blob:')) {
      URL.revokeObjectURL(itemToRemove.url);
    }

    this.galleryItems.update((items) => items.filter((_, i) => i !== index));
  }

  private getFilesForUpload() {
    const newGalleryFiles: File[] = this.galleryItems()
      .filter((item) => !item.isExisting && item.file)
      .map((item) => item.file!);

    const keptExistingUrls: string[] = this.galleryItems()
      .filter((item) => item.isExisting)
      .map((item) => item.url);

    return {
      newMainImage: this.mainImageFile(),
      newGalleryFiles,
      keptExistingUrls,
      deletedUrls: this.deletedGalleryUrls(),
    };
  }

  abrirModalPista(): void {
    this.editandoPista = null;
    this.nuevaPistaNombre = '';
    this.nuevaPistaPrecio = null;
    this.modalPistaAbierto = true;
  }

  abrirModalEditarPista(pista: Pista): void {
    this.editandoPista = pista;
    this.nuevaPistaNombre = pista.nombre;
    this.nuevaPistaPrecio = pista.precio_hora;
    this.modalPistaAbierto = true;
  }

  cerrarModalPista(): void {
    this.modalPistaAbierto = false;
    this.nuevaPistaNombre = '';
    this.nuevaPistaPrecio = null;
    this.editandoPista = null;
  }

  guardarPista(): void {
    const nombre = this.nuevaPistaNombre.trim();
    if (!nombre || this.nuevaPistaPrecio == null || this.nuevaPistaPrecio < 0)
      return;

    if (this.editandoPista) {
      const data = { nombre, precio_hora: this.nuevaPistaPrecio };
      if (this.editandoPista.id_pista) {
        this.adminService
          .editarPista(this.editandoPista.id_pista, data)
          .subscribe({
            next: (msg) => {
              this.editandoPista!.nombre = nombre;
              this.editandoPista!.precio_hora = this.nuevaPistaPrecio!;
              this.toastr.success(`${msg}`, '');
              this.cerrarModalPista();
            },
            error: (err) => this.toastr.error(err),
          });
        return;
      }
      this.editandoPista.nombre = nombre;
      this.editandoPista.precio_hora = this.nuevaPistaPrecio;
      this.cerrarModalPista();
      return;
    }

    this.pistas.push({
      id_pista: null,
      nombre,
      precio_hora: this.nuevaPistaPrecio,
      is_active: true,
    });
    this.cerrarModalPista();
  }

  togglePista(pista: Pista): void {
    pista.is_active = !pista.is_active;
  }

  eliminarPista(index: number): void {
    this.pistas.splice(index, 1);
  }

  private initHorarioSemanal(horarios: HorarioBloque[]): void {
    this.horarioSemanal = this.DIAS_ORDEN.map((diaSemana) => {
      const bloquesDelDia = horarios
        .filter((h) => Number(h.dia_semana) === diaSemana)
        .map((h) => ({
          horaInicio: h.hora_inicio ? h.hora_inicio.substring(0, 5) : '',
          horaTermino: h.hora_termino ? h.hora_termino.substring(0, 5) : '',
          bloqueActivo: h.bloque_activo === true,
        }));

      return {
        diaSemana,
        nombre: this.DIAS_NOMBRES[diaSemana],
        activo: bloquesDelDia.length > 0,
        bloques: bloquesDelDia,
      };
    });
  }

  toggleDia(dia: DiaHorario): void {
    dia.activo = !dia.activo;
  }

  abrirModal(dia: DiaHorario): void {
    if (!dia.activo) return;
    this.modalDia = dia;
    this.modalHoraInicio = '09:00';
    this.modalHoraTermino = '20:00';
    this.modalAbierto = true;
  }

  cerrarModal(): void {
    this.modalAbierto = false;
    this.modalDia = null;
  }

  get horasTerminoDisponibles(): string[] {
    if (!this.modalHoraInicio) return this.horasDisponibles;
    return this.horasDisponibles.filter((hora) => hora > this.modalHoraInicio);
  }

  onHoraInicioChange(nuevaHoraInicio: string): void {
    this.modalHoraInicio = nuevaHoraInicio;
    if (this.modalHoraTermino <= this.modalHoraInicio) {
      const index = this.horasDisponibles.indexOf(nuevaHoraInicio);
      if (index !== -1 && index < this.horasDisponibles.length - 1) {
        this.modalHoraTermino = this.horasDisponibles[index + 1];
      } else {
        this.modalHoraTermino = nuevaHoraInicio;
      }
    }
  }

  guardarBloqueModal(): void {
    if (!this.modalDia) return;

    if (this.modalHoraTermino <= this.modalHoraInicio) {
      this.toastr.error(
        'La hora de término debe ser mayor a la hora de inicio.',
        'Horario inválido',
      );
      return;
    }

    const nuevoInicio = this.modalHoraInicio;
    const nuevoTermino = this.modalHoraTermino;

    const haySolapamiento = this.modalDia.bloques.some((bloque) => {
      return (
        nuevoInicio < bloque.horaTermino && bloque.horaInicio < nuevoTermino
      );
    });

    if (haySolapamiento) {
      this.toastr.error(
        'El turno se cruza o se superpone con otro horario existente en este día.',
        'Conflicto de horario',
      );
      return;
    }

    this.modalDia.bloques.push({
      horaInicio: nuevoInicio,
      horaTermino: nuevoTermino,
      bloqueActivo: true,
    });

    this.modalDia.activo = true;
    this.cerrarModal();
  }

  eliminarBloque(dia: DiaHorario, index: number): void {
    dia.bloques.splice(index, 1);
    if (dia.bloques.length === 0) {
      dia.activo = false;
    }
  }

  private buildHorariosPayload(): HorarioBloque[] {
    const horarios: HorarioBloque[] = [];
    for (const dia of this.horarioSemanal) {
      for (const bloque of dia.bloques) {
        horarios.push({
          dia_semana: dia.diaSemana,
          hora_inicio: `${bloque.horaInicio}:00`,
          hora_termino: `${bloque.horaTermino}:00`,
          bloque_activo: dia.activo ? true : false,
        });
      }
    }
    return horarios;
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.isSubmitting = true;
    const imagesData = this.getFilesForUpload();
    const formData = new FormData();

    Object.entries(this.form.value).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        formData.append(key, String(value));
      }
    });

    formData.append('horarios', JSON.stringify(this.buildHorariosPayload()));
    formData.append('pistas', JSON.stringify(this.pistas));

    if (imagesData.newMainImage) {
      formData.append('imagen_principal', imagesData.newMainImage);
    } else if (this.mainImagePreview()) {
      formData.append('imagen_principal_url', this.mainImagePreview()!);
    }

    imagesData.newGalleryFiles.forEach((file) => {
      formData.append('imagenes', file);
    });

    formData.append(
      'imagenes_existentes',
      JSON.stringify(imagesData.keptExistingUrls),
    );
    formData.append(
      'imagenes_eliminadas',
      JSON.stringify(imagesData.deletedUrls),
    );

    if (this.isEditMode && this.serviceId) {
      this.adminService.actualizarServicio(this.serviceId, formData).subscribe({
        next: () => {
          this.toastr.success('Servicio actualizado con éxito', '');
          this.router.navigate(['/admin/servicios']);
        },
        error: (err) => this.toastr.error(err),
        complete: () => (this.isSubmitting = false),
      });
    } else {
      this.adminService.crearServicio(formData).subscribe({
        next: (msg) => {
          this.toastr.success(`${msg}`, '');
          this.router.navigate(['/admin/servicios']);
        },
        error: (err) => {
          this.toastr.error(err);
          this.isSubmitting = false;
        },
        complete: () => (this.isSubmitting = false),
      });
    }
  }

  cancel(): void {
    this.router.navigate(['/admin/servicios']);
  }
}
