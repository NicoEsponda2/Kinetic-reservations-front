import {
  Component,
  Input,
  Output,
  EventEmitter,
  TemplateRef,
} from '@angular/core';
import { NgClass, NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface TableColumn {
  key: string;
  label: string;
  isCustom?: boolean;
}

export interface TableFilter {
  key: string;
  label: string;
  options: { value: string; label: string }[];
  value: string;
}

@Component({
  selector: 'app-table',
  imports: [NgClass, NgTemplateOutlet, FormsModule],
  templateUrl: './table.component.html',
  styleUrls: ['./table.component.css'],
})
export class TableComponent {
  @Input() columns: TableColumn[] = [];
  @Input() data: any[] = [];
  @Input() customTemplates: Record<string, TemplateRef<any>> = {};

  @Input() showExport: boolean = true;
  @Input() showAddAction: boolean = true;
  @Input() showFilterBar: boolean = true;
  @Input() addActionLabel: string = 'Agregar';
  @Input() addActionIcon: string = 'add';

  @Input() filters: TableFilter[] = [];

  @Input() currentPage: number = 1;
  @Input() pageSize: number = 10;
  @Input() totalItems: number = 0;
  @Input() loading: boolean = false;

  @Output() onExport = new EventEmitter<void>();
  @Output() onAdd = new EventEmitter<void>();
  @Output() onFilterChange = new EventEmitter<TableFilter[]>();
  @Output() onClearFilters = new EventEmitter<void>();
  @Output() onPageChange = new EventEmitter<number>();
  @Output() onRowAction = new EventEmitter<any>();

  Math = Math;

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.totalItems / this.pageSize));
  }

  get pages(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }

  get skeletonRows(): number[] {
    const count = Math.min(Math.max(this.pageSize || 5, 3), 6);
    return Array.from({ length: count }, (_, i) => i);
  }

  handleFilterChange() {
    this.onFilterChange.emit(this.filters);
  }

  clearFilters() {
    this.filters.forEach((f) => (f.value = ''));
    this.onClearFilters.emit();
  }

  previousPage() {
    if (this.currentPage > 1) {
      this.onPageChange.emit(this.currentPage - 1);
    }
  }

  nextPage() {
    if (this.currentPage < this.totalPages) {
      this.onPageChange.emit(this.currentPage + 1);
    }
  }

  goToPage(page: number) {
    this.onPageChange.emit(page);
  }
}
