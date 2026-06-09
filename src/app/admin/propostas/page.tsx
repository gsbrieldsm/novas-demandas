import { redirect } from 'next/navigation'

export default function PropostasRedirect() {
  redirect('/admin/comercial?tab=propostas')
}
