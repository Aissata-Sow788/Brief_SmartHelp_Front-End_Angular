import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TicketResponse } from '../models/ticket-response';

@Component({
  selector: 'app-ticket-result',
  imports: [CommonModule],
  templateUrl: './ticket-result.html',
  styleUrl: './ticket-result.css',
})
export class TicketResult {
    // Reçoit le résultat de l'API depuis le composant parent (TicketForm)

   @Input() result: TicketResponse | null = null;
}
