import { Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ServiceFormComponent } from '@dashboard/components/sport-form/sport-form.component';
import { Servicio } from '@user-front/interfaces/services';

@Component({
  selector: 'app-edit-service',
  imports: [ServiceFormComponent],
  templateUrl: './edit-service.component.html',
})
export class EditServiceComponent implements OnInit {
  serviceId = '';
  servicio?: Servicio;

  private route = inject(ActivatedRoute);
  private router = inject(Router);

  ngOnInit(): void {
    this.serviceId = this.route.snapshot.paramMap.get('id') ?? '';
    const navigationState =
      this.router.getCurrentNavigation()?.extras.state ?? history.state;
    this.servicio = navigationState['servicio'] as Servicio | undefined;
  }
}
