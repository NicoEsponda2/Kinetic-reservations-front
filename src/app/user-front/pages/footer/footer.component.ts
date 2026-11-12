import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '@auth/services/auth.service';
import { CookieConsentService } from '@shared/services/cookie-consent.service';

@Component({
  selector: 'app-footer',
  imports: [RouterLink],
  templateUrl: './footer.component.html',
  styleUrl: './footer.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FooterComponent {
  readonly cookieService = inject(CookieConsentService);
  readonly authService = inject(AuthService);
  readonly currentYear = new Date().getFullYear();
}
