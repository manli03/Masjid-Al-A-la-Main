import { Component, Input } from '@angular/core';
import { PopoverController } from '@ionic/angular';

@Component({
  selector: 'app-comment-options-popover',
  templateUrl: './comment-options-popover.component.html',
  styleUrls: ['./comment-options-popover.component.scss'],
})
export class CommentOptionsPopoverComponent {
  // These values will be passed in from the announcement page
  @Input() isOwner: boolean = false;
  @Input() isAdmin: boolean = false;

  constructor(private popoverController: PopoverController) {}

  /**
   * Dismisses the popover and sends back the selected action ('edit' or 'delete').
   * The announcement page will listen for this.
   * @param action The action that was selected by the user.
   */
  async selectOption(action: 'edit' | 'delete') {
    // Dismiss the popover, passing the chosen action back as data.
    await this.popoverController.dismiss({ action });
  }
}
