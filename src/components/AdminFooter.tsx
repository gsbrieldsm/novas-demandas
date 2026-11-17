'use client'

import Image from 'next/image'

export function AdminFooter() {
  return (
    <footer
      className="mt-auto px-8 py-6 flex items-center justify-between"
      style={{
        background: 'var(--gm-hero)',
      }}
    >
      <div className="flex items-center gap-3">
        <Image
          src="/logo-full.png"
          alt="Gabriel Moraes & Co"
          width={80}
          height={80}
          className="object-contain opacity-90"
          style={{ filter: 'brightness(0) invert(1)' }}
        />
      </div>
      <p className="text-xs" style={{ color: 'rgb(var(--gm-muted))' }}>
        Nada do que fazemos existe por acaso.
      </p>
    </footer>
  )
}
