import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tráfego pago',
  description: 'Acompanhamento das campanhas no Meta Ads',
  robots: { index: false, follow: false }, // link privado do cliente
}

export default function TrafegoClienteLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
