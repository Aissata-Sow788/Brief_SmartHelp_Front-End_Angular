import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-ticket-result',
  imports: [CommonModule],
  templateUrl: './ticket-result.html',
  styleUrl: './ticket-result.css',
})
export class TicketResult {
  @Input() result: any = null;
}
