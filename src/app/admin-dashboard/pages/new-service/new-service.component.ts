import { Component } from '@angular/core';
import { ServiceFormComponent } from '@dashboard/components/sport-form/sport-form.component';

@Component({
  selector: 'app-new-service',
  imports: [ServiceFormComponent],
  templateUrl: './new-service.component.html',
})
export class NewServiceComponent {}
