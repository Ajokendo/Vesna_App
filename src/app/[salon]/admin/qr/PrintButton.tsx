'use client';

export default function PrintButton() {
  return <button type="button" className="btn primary" style={{ alignSelf: 'flex-start' }} onClick={() => window.print()}>Распечатать / сохранить PDF</button>;
}
