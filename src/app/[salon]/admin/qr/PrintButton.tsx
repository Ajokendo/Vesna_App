'use client';

export default function PrintButton() {
  return <button type="button" className="btn primary" style={{ minHeight: 42, fontSize: 14, padding: '0 18px' }} onClick={() => window.print()}>Распечатать / сохранить PDF</button>;
}
