import { Component, OnDestroy, signal } from '@angular/core';
import { ReactiveFormsModule, FormControl, FormGroup } from '@angular/forms';
import { TicketService } from '../services/ticket';
import { TicketResult } from '../ticket-result/ticket-result';
import { CommonModule } from '@angular/common';
import { TicketResponse } from '../models/ticket-response';

@Component({
  selector: 'app-ticket-form',
  imports: [ReactiveFormsModule, CommonModule, TicketResult],
  templateUrl: './ticket-form.html',
  styleUrl: './ticket-form.css',
})
export class TicketForm implements OnDestroy {

  // Formulaire réactif : seul le champ texte est vraiment lié au FormGroup.
  // Les fichiers (audio/image) sont gérés à part, via des variables classiques,
  // car les <input type="file"> ne se prêtent pas bien au binding réactif standard.
  tickeForm = new FormGroup({
    text: new FormControl('')
  });

  // Fichier audio sélectionné (upload manuel OU enregistrement vocal converti en File)
  selectaudio: File | null = null;

  // Fichier image sélectionné (photo du produit)
  selectimage: File | null = null;

  // Résultat renvoyé par l'API après analyse (texte, audio, image).
  // C'est un signal pour que le template se mette à jour automatiquement
  // dès que ticketResult.set(...) est appelé.
  ticketResult = signal<TicketResponse | null>(null);

  // Signal qui pilote l'affichage du spinner pendant l'appel à l'API
  // (true = requête en cours, false = terminé ou pas encore lancé)
  isLoading = signal(false);

  // ---------- Enregistrement vocal réel ----------

  // true pendant que le micro est en train d'enregistrer
  isRecording = signal(false);

  // message d'erreur si l'accès au micro échoue (permission refusée, pas de micro, etc.)
  recordingError = signal('');

  // URL locale (blob:) utilisée pour réécouter l'audio (upload ou enregistrement) dans le template
  audioPreviewUrl = signal<string | null>(null);

  // URL locale (blob:) utilisée pour afficher un aperçu de la photo sélectionnée
  imagePreviewUrl = signal<string | null>(null);

  // Dernier texte envoyé par l'utilisateur, conservé pour affichage
  // (le champ du formulaire est vidé juste après l'envoi, donc on garde une copie ici)
  submittedText = signal<string | null>(null);

  // Objet natif du navigateur qui capture le son pendant l'enregistrement.
  // private car c'est un détail d'implémentation, le template n'y touche jamais directement.
  private mediaRecorder: MediaRecorder | null = null;

  // Accumule les morceaux de son (Blob) envoyés par le MediaRecorder au fil de l'enregistrement
  private audioChunks: Blob[] = [];

  // Flux micro obtenu du système. On le garde en mémoire pour pouvoir couper le micro
  // proprement (getTracks().stop()) une fois l'enregistrement terminé.
  private mediaStream: MediaStream | null = null;

  // Injection du service qui communique avec l'API FastAPI (POST /support-ticket)
  constructor(private ticketSErvice: TicketService) {}


  /**
   * Déclenché quand l'utilisateur choisit un fichier audio via l'input file classique.
   * Stocke le fichier et génère une URL d'aperçu pour le lecteur <audio>.
   */
  onAudioSelected(event: Event) {
    const input = event.target as HTMLInputElement;

    if (input.files && input.files.length > 0) {
      this.selectaudio = input.files[0];
      this.audioPreviewUrl.set(URL.createObjectURL(this.selectaudio));
    }
  }


  /**
   * Déclenché quand l'utilisateur choisit une photo via l'input file classique.
   * Stocke le fichier et génère une URL d'aperçu pour la balise <img>.
   */
  onImageSelected(event: Event) {
    const input = event.target as HTMLInputElement;

    if (input.files && input.files.length > 0) {
      this.selectimage = input.files[0];
      this.imagePreviewUrl.set(URL.createObjectURL(this.selectimage));
    }
  }


  // ---------- Micro : bascule démarrer / arrêter ----------

  /**
   * Point d'entrée unique appelé par le bouton micro dans le template.
   * Bascule simplement entre démarrer et arrêter selon l'état actuel.
   */
  toggleRecording(): void {
    if (this.isRecording()) {
      this.stopRecording();
    } else {
      this.startRecording();
    }
  }

  /**
   * Demande l'accès au micro (popup d'autorisation du navigateur), puis démarre
   * l'enregistrement via l'API MediaRecorder native du navigateur.
   */
  private async startRecording(): Promise<void> {
    this.recordingError.set('');

    // Vérifie que le navigateur supporte bien ces API avant de les utiliser
    if (!navigator.mediaDevices || !window.MediaRecorder) {
      this.recordingError.set("L'enregistrement audio n'est pas supporté par ce navigateur.");
      return;
    }

    try {
      // Ouvre le flux micro (déclenche la demande d'autorisation côté navigateur)
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.audioChunks = [];

      this.mediaRecorder = new MediaRecorder(this.mediaStream);

      // Appelé régulièrement par le navigateur avec un morceau de son capturé
      this.mediaRecorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      // Appelé une fois l'enregistrement effectivement arrêté (après le dernier chunk)
      this.mediaRecorder.onstop = () => this.handleRecordingStop();

      this.mediaRecorder.start();
      this.isRecording.set(true);

      // On désactive le champ texte pendant l'enregistrement pour éviter
      // que l'utilisateur tape en même temps qu'il parle
      this.tickeForm.get('text')?.disable();
    } catch (err) {
      // L'utilisateur a refusé l'accès au micro, ou aucun micro n'est disponible
      console.error('Erreur accès microphone :', err);
      this.recordingError.set("Impossible d'accéder au microphone. Vérifiez les autorisations du navigateur.");
      this.isRecording.set(false);
    }
  }

  /**
   * Arrête l'enregistrement en cours. Le traitement du résultat se fait dans
   * handleRecordingStop(), déclenché automatiquement par l'événement onstop.
   */
  private stopRecording(): void {
    // On vérifie que le recorder existe et n'est pas déjà arrêté,
    // pour éviter une erreur si stopRecording() est appelé deux fois
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
    this.isRecording.set(false);

    // On réactive le champ texte maintenant que l'enregistrement est terminé
    this.tickeForm.get('text')?.enable();
  }

  /**
   * Reconstitue le fichier audio final à partir des morceaux accumulés,
   * puis le branche sur le même circuit que l'upload manuel (selectaudio).
   */
  private handleRecordingStop(): void {
    // Fusionne tous les chunks en un seul Blob au format webm/opus (format natif du navigateur)
    const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });

    // On transforme le blob en File pour réutiliser exactement le même circuit
    // que l'upload via <input type="file"> (selectaudio -> formdata.append('audio', ...))
    this.selectaudio = new File([audioBlob], 'enregistrement.webm', { type: 'audio/webm' });
    this.audioPreviewUrl.set(URL.createObjectURL(this.selectaudio));

    // Coupe le micro : sans ça, le navigateur le laisserait "actif" même
    // après la fin de l'enregistrement (souvent visible dans l'onglet du navigateur)
    this.mediaStream?.getTracks().forEach(track => track.stop());
    this.mediaStream = null;
  }


  /**
   * Envoie la réclamation à l'API : texte, audio et/ou image, selon ce qui est disponible.
   * Rien n'est envoyé automatiquement à la sélection d'un fichier ou à l'arrêt d'un
   * enregistrement — tout part uniquement au clic sur le bouton d'envoi.
   */
  onSubmit() {

    // Rien à envoyer : ni texte, ni audio, ni image -> on ne fait rien du tout,
    // pas d'appel API inutile qui reviendrait forcément avec "À vérifier".
    const hasText = !!this.tickeForm.value.text?.trim();
    if (!hasText && !this.selectaudio && !this.selectimage) {
      return;
    }

    const formdata = new FormData();


    if (this.selectaudio) {
      formdata.append('audio', this.selectaudio);
    }


    if (this.selectimage) {
      formdata.append('image', this.selectimage);
    }


    const text = this.tickeForm.value.text;

    if (text) {
      formdata.append('text', text);

      // On garde une copie du texte pour l'afficher (le champ va être vidé juste après)
      this.submittedText.set(text);
    }

    // On vide le champ texte tout de suite, comme dans un chat
    // (l'utilisateur peut déjà retaper un message pendant que l'analyse tourne)
    this.tickeForm.patchValue({ text: '' });

    // On vide aussi l'audio et l'image utilisés pour l'envoi : sans ça, un second clic
    // sur "Envoyer" sans rien resélectionner renvoyait encore les anciens fichiers.
    // On ne touche PAS à audioPreviewUrl/imagePreviewUrl : ils doivent rester affichés
    // à l'écran comme "message envoyé", même après l'envoi.
    this.selectaudio = null;
    this.selectimage = null;


    // Activation du loader : affiche le spinner dans le template tant que la requête n'est pas terminée
    this.isLoading.set(true);


    this.ticketSErvice.sendTicket(formdata)
      .subscribe({

        // Cas de succès : l'API a renvoyé un résultat d'analyse
        next: (result: TicketResponse) => {

          // Mise à jour du signal : le template affiche automatiquement le résultat
          this.ticketResult.set(result);

          console.log(result);

          // Arrêt du loader
          this.isLoading.set(false);
        },


        // Cas d'erreur : requête échouée (réseau, serveur, etc.)
        error: (err) => {

          console.error(err);

          this.isLoading.set(false);
        }

      });
  }

  /**
   * Hook du cycle de vie Angular, appelé juste avant que le composant soit détruit
   * (ex: navigation vers une autre page). Filet de sécurité pour éviter que le micro
   * reste allumé si l'utilisateur quitte la page pendant un enregistrement en cours.
   */
  ngOnDestroy(): void {
    this.mediaStream?.getTracks().forEach(track => track.stop());
  }

}
