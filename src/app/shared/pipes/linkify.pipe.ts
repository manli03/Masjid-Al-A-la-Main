import { Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Pipe({
  name: 'linkify',
})
export class LinkifyPipe implements PipeTransform {
  constructor(private sanitizer: DomSanitizer) {}

  transform(text: string): SafeHtml {
    if (!text) {
      return '';
    }

    // Regular expression to find URLs (http, https, www)
    // This regex is a balance between finding common URLs and avoiding false positives.
    // It looks for http://, https://, or www. followed by non-whitespace characters.
    const urlRegex =
      /(\b(https?:\/\/|www\.)[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/gi;

    const linkedText = text.replace(urlRegex, (url) => {
      let href = url;
      // Add http:// if it's just www.
      if (url.startsWith('www.')) {
        href = 'https://' + url;
      }
      // Escape HTML entities in the URL text displayed to avoid XSS issues within the <a> tag content
      const escapedUrlText = url
        .replace(/&/g, '&')
        .replace(/</g, '<')
        .replace(/>/g, '>');
      // Use target="_blank" to open in a new tab/external browser
      return `<a href="${href}" target="_blank" rel="noopener noreferrer">${escapedUrlText}</a>`;
    });

    // Use DomSanitizer to mark the resulting HTML as safe
    return this.sanitizer.bypassSecurityTrustHtml(linkedText);
  }
}
