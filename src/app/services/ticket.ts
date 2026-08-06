import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from "rxjs";
import { TicketResponse } from '../models/ticket-response';


@Injectable({
  providedIn: 'root'
})

export class TicketService {
  // URL de l'endpoint FastAPI à contacter
  private urlApi = 'http://127.0.0.1:8000/support-ticket';

  ticketResult: TicketResponse | null = null;
  // Injection de HttpClient, fourni par Angular
  constructor(private http: HttpClient) {}

  // Envoie le FormData (audio/image/texte) à l'API et retourne la réponse (TicketResponse)
sendTicket(formData: FormData): Observable<TicketResponse> {
  return this.http.post<TicketResponse>(this.urlApi, formData);
}

}
