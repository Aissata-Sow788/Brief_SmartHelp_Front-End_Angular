import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from "rxjs";


@Injectable({
  providedIn: 'root'
})

export class TicketService {
  private urlApi = 'http://127.0.0.1:8000/support-ticket';

  constructor (private http: HttpClient){}

  sendTicket(formData: FormData): any{
    return this.http.post(this.urlApi, formData)
  }



}
