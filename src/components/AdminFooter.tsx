'use client'

import Image from 'next/image'

export function AdminFooter() {
  return (
    <footer
      className="mt-auto px-8 py-6 flex items-center justify-between"
      style={{
        background: 'radial-gradient(ellipse 80% 120% at 95% 50%, #C5A880 0%, #8B6840 40%, transparent 70%), #100E0B',
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
      <p className="text-xs" style={{ color: '#C5A88099' }}>
        Nada do que fazemos existe por acaso.
      </p>
    </footer>
  )
}
