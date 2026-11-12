import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FrontNavbarComponent } from '../pages/navbar/navbar.component';
import { HomeComponent } from '@user-front/pages/home/home.component';
import { ParkServicesComponent } from '@user-front/pages/park-services/park-services.component';
import { CommentsComponent } from '@user-front/pages/comments/comments.component';
import { FooterComponent } from '@user-front/pages/footer/footer.component';

@Component({
  selector: 'app-store-front-layout',
  imports: [
    FrontNavbarComponent,
    HomeComponent,
    ParkServicesComponent,
    CommentsComponent,
    FooterComponent,
  ],
  templateUrl: './user-front-layout.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserFrontLayoutComponent {}
