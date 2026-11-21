/** Coroa de louros usada no ranking, no pódio e no clip mais visto. A cor vem de `color` (currentColor). */
export function Laurel({ className }: { className?: string }) {
  return <svg viewBox="0 0 100 80" className={className} aria-hidden focusable="false">
    {[false, true].map(mirror => <g key={String(mirror)} transform={mirror ? 'translate(100 0) scale(-1 1)' : undefined}>
      <path d="M46 73 C13 65 9 35 27 10" fill="none" stroke="currentColor" strokeWidth="1.8" />
      {[{x:23,y:17,r:20},{x:17,y:28,r:0},{x:14,y:40,r:-20},{x:17,y:52,r:-42},{x:25,y:62,r:-62},{x:37,y:69,r:-80}].map(({x,y,r}, i) => <g key={i} transform={`translate(${x} ${y}) rotate(${r})`} fill="currentColor">
        <path d="M0 3 C-12 -1 -12 -10 -9 -14 C-2 -11 1 -5 0 3Z" />
        <path d="M1 4 C0 -4 4 -9 9 -10 C12 -3 8 2 1 4Z" opacity=".8" />
      </g>)}
      <path d="M38 76 Q46 69 53 72" fill="none" stroke="currentColor" strokeWidth="2" />
    </g>)}
  </svg>
}
