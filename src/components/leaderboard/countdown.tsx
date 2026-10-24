'use client'

import { useEffect, useState } from 'react'

function parts(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000))
  return {
    dias: Math.floor(total / 86400),
    horas: Math.floor((total % 86400) / 3600),
    min: Math.floor((total % 3600) / 60),
    seg: total % 60,
  }
}

/** Contagem decrescente para a live de análise. */
export function Countdown({ target, label }: { target: string; label: string }) {
  const [remaining, setRemaining] = useState(() => new Date(target).getTime() - Date.now())

  useEffect(() => {
    const id = setInterval(() => setRemaining(new Date(target).getTime() - Date.now()), 1000)
    return () => clearInterval(id)
  }, [target])

  if (remaining <= 0) {
    return (
      <div className="rounded-lg border border-line bg-surface-2/60 px-5 py-4 text-center">
        <p className="text-[11px] font-medium tracking-[0.1em] text-fg-subtle uppercase">
          {label}
        </p>
        <p className="mt-2 text-sm font-medium text-fg">A acontecer agora</p>
      </div>
    )
  }

  const t = parts(remaining)

  return (
    <div className="rounded-lg border border-line bg-surface-2/60 px-5 py-4">
      <p className="text-center text-[11px] font-medium tracking-[0.1em] text-fg-subtle uppercase">
        {label}
      </p>
      <div className="mt-3 grid grid-cols-4 gap-2">
        {(
          [
            ['dias', t.dias],
            ['horas', t.horas],
            ['min', t.min],
            ['seg', t.seg],
          ] as const
        ).map(([unit, value]) => (
          <div key={unit} className="text-center">
            <div className="nums text-2xl font-semibold tracking-tight text-fg">
              {String(value).padStart(2, '0')}
            </div>
            <div className="mt-0.5 text-[10px] tracking-[0.1em] text-fg-subtle uppercase">
              {unit}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
