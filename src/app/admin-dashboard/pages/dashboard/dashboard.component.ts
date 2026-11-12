import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { DatePipe, DecimalPipe, NgClass } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ToastrService } from 'ngx-toastr';

import {
  AdminBookingItem,
  AdminCourtStatus,
  AdminDashboardData,
  AdminService,
  DailyTrendPoint,
} from '../../services/admin.service';
import { SportIconPipe } from '../../../pipes/sport-icon.pipe';
import { CachedImgDirective } from '@shared/directives/cached-img.directive';

type KpiVariant = 'green' | 'blue' | 'red';
type TrendRange = '7d' | '30d';

interface KpiTheme {
  iconBgClass: string;
  bgDecoration: string;
  valueClass: string;
}

interface KPI {
  title: string;
  value: string | number;
  icon: string;
  trend?: string;
  trendClass?: string;
  iconBgClass: string;
  bgDecoration: string;
  valueClass: string;
  highlight?: boolean;
}

interface ChartPoint extends DailyTrendPoint {
  x: number;
  yCompletadas: number;
  yCanceladas: number;
}

const KPI_THEMES: Record<KpiVariant, KpiTheme> = {
  green: {
    iconBgClass: 'bg-green-50 text-[#006b0a]',
    bgDecoration: 'bg-[#006b0a]/5',
    valueClass: 'text-slate-900',
  },
  blue: {
    iconBgClass: 'bg-blue-50 text-blue-600',
    bgDecoration: 'bg-blue-500/5',
    valueClass: 'text-slate-900',
  },
  red: {
    iconBgClass: 'bg-red-50 text-[#b02500]',
    bgDecoration: 'bg-[#b02500]/5',
    valueClass: 'text-[#b02500]',
  },
};

@Component({
  selector: 'app-dashboard',
  imports: [
    NgClass,
    DatePipe,
    DecimalPipe,
    RouterLink,
    SportIconPipe,
    CachedImgDirective,
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent implements OnInit {
  private readonly adminService = inject(AdminService);
  private readonly toastr = inject(ToastrService);

  readonly currentDate = new Date();
  readonly titulo = 'DASHBOARD';

  readonly isLoading = signal<boolean>(true);
  readonly selectedRange = signal<TrendRange>('7d');
  readonly dashboardData = signal<AdminDashboardData | null>(null);

  readonly kpis = computed<KPI[]>(() => {
    const metrics = this.dashboardData()?.kpis;

    return [
      this.createKpiCard({
        title: 'Ingresos Totales',
        value: this.formatCurrency(metrics?.ingresosTotales ?? 0),
        icon: 'payments',
        variant: 'green',
        growth: metrics?.crecimientoIngresos,
      }),
      this.createKpiCard({
        title: 'Tasa de Ocupación',
        value: `${metrics?.tasaOcupacion ?? 0}%`,
        icon: 'leaderboard',
        variant: 'blue',
        growth: metrics?.crecimientoOcupacion,
      }),
      this.createKpiCard({
        title: 'Reservas Activas',
        value: metrics?.reservasActivas ?? 0,
        icon: 'event_available',
        variant: 'green',
        growth: metrics?.crecimientoReservas,
        highlight: true,
      }),
      this.createKpiCard({
        title: 'Pagos Pendientes',
        value: metrics?.pagosPendientes ?? 0,
        icon: 'error_outline',
        variant: 'red',
      }),
    ];
  });

  readonly activeSeries = computed<DailyTrendPoint[]>(() => {
    const tendencia = this.dashboardData()?.tendencia;
    if (!tendencia) return [];
    return this.selectedRange() === '7d'
      ? tendencia.ultimos7Dias
      : tendencia.ultimos30Dias;
  });

  readonly chartGeometry = computed(() => {
    const series = this.activeSeries();
    const width = 800;
    const height = 200;
    const padTop = 24;
    const padBottom = 18;
    const usableHeight = height - padTop - padBottom;

    if (!series.length) {
      const flatY = height - padBottom;
      return {
        areaPath: `M0,${flatY} L${width},${flatY} L${width},${height} L0,${height} Z`,
        linePath: `M0,${flatY} L${width},${flatY}`,
        cancelLinePath: `M0,${flatY} L${width},${flatY}`,
        points: [] as ChartPoint[],
        axisLabels: [] as string[],
      };
    }

    const maxVal = Math.max(
      1,
      ...series.map((d) => Math.max(d.completadas, d.canceladas)),
    );
    const stepX = series.length > 1 ? width / (series.length - 1) : width;

    const points: ChartPoint[] = series.map((item, idx) => {
      const x = Math.round(idx * stepX * 10) / 10;
      const yCompletadas =
        Math.round(
          (padTop + usableHeight * (1 - item.completadas / maxVal)) * 10,
        ) / 10;
      const yCanceladas =
        Math.round(
          (padTop + usableHeight * (1 - item.canceladas / maxVal)) * 10,
        ) / 10;

      return {
        ...item,
        x,
        yCompletadas,
        yCanceladas,
      };
    });

    const linePath = points
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.yCompletadas}`)
      .join(' ');
    const areaPath = `${linePath} L${width},${height} L0,${height} Z`;
    const cancelLinePath = points
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.yCanceladas}`)
      .join(' ');

    // Para 7 días mostramos las 7 etiquetas; para 30 días mostramos 7 etiquetas equidistantes
    const axisLabels =
      series.length <= 7
        ? series.map((s) => s.etiqueta)
        : [0, 5, 10, 15, 20, 25, series.length - 1].map(
            (idx) => series[idx]?.etiqueta ?? '',
          );

    return {
      areaPath,
      linePath,
      cancelLinePath,
      points,
      axisLabels,
    };
  });

  readonly estadoPistas = computed<AdminCourtStatus[]>(
    () => this.dashboardData()?.estadoPistas ?? [],
  );

  readonly proximoCierre = computed<string>(
    () =>
      this.dashboardData()?.proximoCierre ?? '22:00 - Cierre y Mantenimiento',
  );

  readonly reservas = computed<AdminBookingItem[]>(
    () => this.dashboardData()?.proximasReservas ?? [],
  );

  ngOnInit(): void {
    this.cargarDashboard();
  }

  cargarDashboard(): void {
    this.isLoading.set(true);
    this.adminService.obtenerDatosDashboard().subscribe({
      next: (data) => {
        this.dashboardData.set(data);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.isLoading.set(false);
        this.toastr.error(err, 'Error en Dashboard');
      },
    });
  }

  onRangeChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value as TrendRange;
    this.selectedRange.set(value);
  }

  getPaymentBadgeClass(estadoPago: AdminBookingItem['estadoPago']): string {
    switch (estadoPago) {
      case 'Pagado':
        return 'bg-primary/10 text-primary border-primary/20';
      case 'Cancelado':
        return 'bg-error/10 text-error border-error/20';
      default:
        return 'bg-amber-500/10 text-amber-700 border-amber-500/20';
    }
  }

  async exportarDatos(): Promise<void> {
    const data = this.dashboardData();
    if (!data) {
      this.toastr.warning('Aún no hay datos cargados para exportar.');
      return;
    }

    const totalRecaudadoTabla = data.proximasReservas
      .filter((r) => r.estadoPago === 'Pagado')
      .reduce((acc, r) => acc + Number(r.monto || 0), 0);

    const { ExcelExportService } = await import(
      '../../services/excel-export.service'
    );
    const exported = new ExcelExportService().exportWorkbook({
      fileName: 'reporte-dashboard-ejecutivo',
      sheets: [
        {
          sheetName: 'Próximas Reservas',
          title: 'Reporte Ejecutivo - Próximas Reservas',
          subtitle: 'Resumen de reservas y recaudación del panel principal',
          data: data.proximasReservas,
          columns: [
            {
              header: 'ID Reserva',
              width: 90,
              align: 'Center',
              value: (r) => `#${r.id}`,
            },
            {
              header: 'Fecha',
              width: 105,
              align: 'Center',
              value: (r) => r.fecha,
            },
            {
              header: 'Horario',
              width: 115,
              align: 'Center',
              value: (r) => r.hora,
            },
            {
              header: 'Instalación / Cancha',
              width: 210,
              value: (r) => r.instalacion,
            },
            {
              header: 'Jugador / Usuario',
              width: 170,
              value: (r) => r.usuario,
            },
            {
              header: 'Correo Electrónico',
              width: 210,
              value: (r) => r.emailUsuario || 'Sin correo',
            },
            {
              header: 'Monto (CLP)',
              width: 120,
              type: 'currency',
              value: (r) => r.monto,
            },
            {
              header: 'Estado de Pago',
              width: 120,
              type: 'status',
              value: (r) => r.estadoPago,
            },
          ],
          summaryRows: [
            {
              label: 'Total Ingresos Históricos (KPI)',
              value: data.kpis.ingresosTotales,
              type: 'currency',
            },
            {
              label: 'Tasa de Ocupación Actual',
              value: `${data.kpis.tasaOcupacion}%`,
              type: 'string',
            },
            {
              label: 'Total Recaudado en Listado Exportado',
              value: totalRecaudadoTabla,
              type: 'currency',
            },
          ],
        },
        {
          sheetName: 'Estado de Pistas',
          title: 'Estado Operativo de Pistas e Instalaciones',
          subtitle: `Horario de cierre programado: ${data.proximoCierre}`,
          data: data.estadoPistas,
          columns: [
            {
              header: 'ID Pista',
              width: 85,
              align: 'Center',
              value: (p) => `#${p.id_pista}`,
            },
            {
              header: 'Deporte / Servicio',
              width: 150,
              value: (p) => p.deporte,
            },
            {
              header: 'Instalación',
              width: 220,
              value: (p) => p.nombre,
            },
            {
              header: 'Tarifa por Hora (CLP)',
              width: 140,
              type: 'currency',
              value: (p) => p.precioHora,
            },
            {
              header: 'Turnos Hoy',
              width: 110,
              type: 'number',
              value: (p) => p.reservasHoy,
            },
            {
              header: 'Turnos Históricos',
              width: 130,
              type: 'number',
              value: (p) => p.reservasTotales,
            },
            {
              header: 'Estado Actual',
              width: 120,
              type: 'status',
              value: (p) => p.estado,
            },
          ],
        },
        {
          sheetName: 'Tendencia Diaria',
          title: 'Tendencia de Reservas e Ingresos Diarios',
          subtitle:
            this.selectedRange() === '7d'
              ? 'Serie correspondiente a los últimos 7 días'
              : 'Serie correspondiente a los últimos 30 días',
          data: this.activeSeries(),
          columns: [
            {
              header: 'Fecha',
              width: 110,
              align: 'Center',
              value: (d) => d.fecha,
            },
            {
              header: 'Día / Etiqueta',
              width: 120,
              align: 'Center',
              value: (d) => d.etiqueta,
            },
            {
              header: 'Reservas Completadas / Pagadas',
              width: 190,
              type: 'number',
              value: (d) => d.completadas,
            },
            {
              header: 'Reservas Canceladas',
              width: 150,
              type: 'number',
              value: (d) => d.canceladas,
            },
            {
              header: 'Ingresos del Día (CLP)',
              width: 160,
              type: 'currency',
              value: (d) => d.ingresos,
            },
          ],
        },
      ],
    });

    if (exported) {
      this.toastr.success(
        'Libro Excel (.xlsx) de Dashboard generado con 3 hojas de cálculo',
        'Exportación Exitosa',
      );
    }
  }

  private createKpiCard(config: {
    title: string;
    value: string | number;
    icon: string;
    variant: KpiVariant;
    growth?: number;
    highlight?: boolean;
  }): KPI {
    const theme = KPI_THEMES[config.variant];
    const hasGrowth =
      config.growth !== undefined && config.growth !== null;
    const isPositive = (config.growth ?? 0) >= 0;

    return {
      title: config.title,
      value: config.value,
      icon: config.icon,
      trend: hasGrowth
        ? `${isPositive ? '+' : ''}${config.growth}% ${isPositive ? '↑' : '↓'}`
        : undefined,
      trendClass: isPositive ? 'text-[#006b0a]' : 'text-[#b02500]',
      highlight: config.highlight,
      ...theme,
    };
  }

  private formatCurrency(amount: number): string {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      maximumFractionDigits: 0,
    }).format(amount);
  }
}
