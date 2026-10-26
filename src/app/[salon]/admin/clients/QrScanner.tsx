'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

/** Камера телефона администратора читает личный QR клиента и открывает его карточку */
export default function QrScanner({ slug }: { slug: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="btn" style={{ minHeight: 48 }} onClick={() => setOpen(true)}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M7 12h10" /></svg>
        Сканировать QR клиента
      </button>
      {open && <ScanDialog slug={slug} onClose={() => setOpen(false)} />}
    </>
  );
}

function ScanDialog({ slug, onClose }: { slug: string; onClose: () => void }) {
  const router = useRouter();
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      } catch {
        setError('Нет доступа к камере. Разрешите камеру для этого приложения в настройках телефона.'); return;
      }
      const v = video.current!;
      v.srcObject = stream; await v.play().catch(() => {});
      const { default: jsQR } = await import('jsqr');
      const tick = () => {
        if (stopped) return;
        if (v.readyState >= 2 && ctx) {
          const w = 480; const h = Math.round((v.videoHeight / v.videoWidth) * w) || 480;
          canvas.width = w; canvas.height = h; ctx.drawImage(v, 0, 0, w, h);
          const code = jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: 'dontInvert' });
          const m = code?.data.match(new RegExp(`/${slug}/admin/clients/([\\w-]+)`));
          if (m) { stopped = true; navigator.vibrate?.(60); router.push(`/${slug}/admin/clients/${m[1]}`); onClose(); return; }
          if (code?.data) setError('Это не QR клиента нашего салона');
        }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    })();
    return () => { stopped = true; cancelAnimationFrame(raf); stream?.getTracks().forEach((t) => t.stop()); };
  }, [slug, router, onClose]);

  return (
    <div role="dialog" aria-modal="true" aria-label="Сканер QR" onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 70, background: 'rgba(10,16,12,.85)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ position: 'relative', width: 'min(86vw, 420px)', aspectRatio: '1', borderRadius: 20, overflow: 'hidden', background: '#000' }}>
        <video ref={video} playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        <div aria-hidden style={{ position: 'absolute', inset: '15%', border: '3px solid rgba(255,255,255,.9)', borderRadius: 16 }} />
      </div>
      <span style={{ color: '#fff', textAlign: 'center' }}>{error ?? 'Наведите камеру на QR-код клиента (раздел «Баллы» в его приложении)'}</span>
      <button type="button" className="btn" onClick={onClose}>Закрыть</button>
    </div>
  );
}
