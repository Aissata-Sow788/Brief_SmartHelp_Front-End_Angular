import { Component} from '@angular/core';
import { ReactiveFormsModule, FormControl, FormGroup } from '@angular/forms';
import { TicketService } from '../services/ticket';
import { TicketResult } from '../ticket-result/ticket-result';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-ticket-form',
  imports: [ReactiveFormsModule, CommonModule, TicketResult],
  templateUrl: './ticket-form.html',
  styleUrl: './ticket-form.css',
})
export class TicketForm {

  tickeForm = new FormGroup({
    text: new FormControl('')
  })

  selectaudio: File | null = null;
  selectimage: File | null = null;
  ticketResult: any = null;


  constructor(private ticketSErvice: TicketService){}


  onAudioSelected(event: Event){
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0){
      this.selectaudio = input.files[0]
    }
  }

  onImageSelected(event: Event){
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0){
      this.selectimage = input.files[0]
    }
  }
  isLoading = false;
  onSubmit(){
    const formdata = new FormData();

    if (this.selectaudio){
      formdata.append('audio', this.selectaudio)
    }

    if (this.selectimage){
      formdata.append('image', this.selectimage)
    }

    const text = this.tickeForm.value.text;
    if (text){
      formdata.append('text', text)
    }
     this.isLoading = true;

    this.ticketSErvice.sendTicket(formdata).subscribe({
      next: (result: any) => {
        this.ticketResult = result;
        this.isLoading = false;
      },
      error: (err: any) => {
        console.error(err);
        this.isLoading = false
      }
    });
  }

}
