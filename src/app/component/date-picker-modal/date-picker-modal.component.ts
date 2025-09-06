import { Component, Input } from '@angular/core';
import { ModalController } from '@ionic/angular';

@Component({
  selector: 'app-date-picker-modal',
  templateUrl: './date-picker-modal.component.html',
  styleUrls: ['./date-picker-modal.component.scss']
})
export class DatePickerModalComponent {
  @Input() selectedDate: string = '';
  maxDate: string = '';

  constructor(private modalController: ModalController) {
    this.maxDate = new Date().toISOString().split('T')[0];
  }

  onDateChange(event: any) {
    this.selectedDate = event.detail.value;
  }

  cancel() {
    this.modalController.dismiss();
  }

  confirm() {
    this.modalController.dismiss({
      selectedDate: this.selectedDate
    });
  }
}
