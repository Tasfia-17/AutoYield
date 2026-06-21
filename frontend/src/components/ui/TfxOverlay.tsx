'use client';
import { useEffect, useState } from 'react';

export function TfxOverlay({ trigger }: { trigger: number }) {
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (trigger === 0) return;
    setActive(true);
    const t = setTimeout(() => setActive(false), 600);
    return () => clearTimeout(t);
  }, [trigger]);

  return (
    <div className={`tfx-overlay ${active ? 'tfx-active' : ''}`}>
      {[...Array(6)].map((_, i) => <div key={i} className="tfx-line" />)}
    </div>
  );
}
