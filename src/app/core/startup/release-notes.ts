/** A short, plain-text summary for the update prompt; GitHub notes may contain Markdown. */
export function summarizeReleaseNotes(notes: string): string {
  const plain = (text: string) => text
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[*_`~]/g, '')
    .replace(/\s+/g, ' ').trim();
  const shorten = (text: string, limit: number) => text.length <= limit ? text :
    text.slice(0, limit - 1).replace(/\s+\S*$/, '').trim() + '…';
  const bullets: string[] = [];
  const paragraphs: string[] = [];
  let inCode = false;
  let bullet = -1;
  for (const line of notes.replace(/\r/g, '').split('\n')) {
    const trimmed = line.trim();
    if (/^```/.test(trimmed)) { inCode = !inCode; continue; }
    if (inCode) continue;
    if (/^#{1,6}\s/.test(trimmed)) {
      if (/download|install|changelog|muat turun|pemasangan|checksum|validation/i.test(trimmed)) break;
      bullet = -1;
      continue;
    }
    const match = trimmed.match(/^(?:[-*+•]|\d+[.)])\s+(.+)$/);
    if (match) {
      bullets.push(plain(match[1]));
      bullet = bullets.length - 1;
    } else if (trimmed && /^\s{2,}/.test(line) && bullet >= 0) {
      bullets[bullet] += ' ' + plain(trimmed);
    } else {
      bullet = -1;
      if (trimmed) paragraphs.push(plain(trimmed));
    }
  }
  const summary = bullets.filter(Boolean).slice(0, 4).map(text => '• ' + shorten(text, 110));
  return summary.length ? summary.join('\n\n') : shorten(paragraphs.filter(Boolean).join(' '), 360);
}
