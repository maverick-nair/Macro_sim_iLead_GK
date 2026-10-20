import { useState } from 'react';
import { IMAGE_BUDGET_BYTES, kb } from '../../engine/assets';
import { BUTTON } from './kit';
import { readImage } from './upload';

/**
 * Upload an image into the storyline (D183): the file is shrunk to fit the budget and embedded, so the participant sees
 * exactly what the author picked, in preview, in play and in a SCORM package. A file that cannot be used says why.
 */
export function ImageUpload({ label, onImage, maxSide = 1024, disabled = false, className = '' }: {
  label: string; onImage: (src: string) => void; maxSide?: number; disabled?: boolean; className?: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label className={`${BUTTON.secondary} justify-center has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-author-primary ${disabled || busy ? 'pointer-events-none opacity-50' : ''}`}>
        {busy ? 'Reading the image' : label}
        <input type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" className="sr-only" disabled={disabled || busy}
          onChange={async e => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            setBusy(true);
            const r = await readImage(f, maxSide);
            setBusy(false);
            if (r.ok) { setError(null); onImage(r.src); } else setError(r.message);
          }} />
      </label>
      {error ? <p role="alert" className="m-0 text-12 text-author-need">{error}</p> : <p className="m-0 text-12 text-author-muted">PNG, JPEG, WebP, GIF or SVG. Photos are resized to fit {kb(IMAGE_BUDGET_BYTES)} KB.</p>}
    </div>
  );
}
