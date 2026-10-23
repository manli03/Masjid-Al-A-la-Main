import { summarizeReleaseNotes } from './release-notes';

describe('Update release-note summary', () => {
  it('removes Markdown and shows a short list instead of the full GitHub description', () => {
    const result = summarizeReleaseNotes('## Masjid A’la 1.3.1\nIntro\n### Improvements\n' +
      '- **Faster startup:** opens prayer links directly.\n- **Darker backgrounds:** easier reading.\n' +
      '- [Clearer progress](https://example.com)\n- Permission timing\n- Fifth item\n' +
      '### Download and install\n- Download app-release.apk');
    expect(result).toBe('• Faster startup: opens prayer links directly.\n\n• Darker backgrounds: easier reading.\n\n• Clearer progress\n\n• Permission timing');
    expect(result).not.toContain('**');
    expect(result).not.toContain('https://');
    expect(result).not.toContain('Download');
  });
  it('wraps continued list items and bounds lengthy summaries', () => {
    const result = summarizeReleaseNotes('- First line\n  continues here.\n- ' + 'Long description '.repeat(100));
    expect(result).toContain('First line continues here.');
    expect(result.length).toBeLessThan(150);
    expect(result.endsWith('…')).toBeTrue();
  });
  it('handles plain-text release notes, empty notes and code blocks', () => {
    expect(summarizeReleaseNotes('A small improvement.')).toBe('A small improvement.');
    expect(summarizeReleaseNotes('')).toBe('');
    expect(summarizeReleaseNotes('```\n- hidden code\n```\n- Visible change')).toBe('• Visible change');
  });
});
