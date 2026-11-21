import type { Metadata } from 'next'
import { AuthLanding } from '@/components/auth/auth-landing'

export const metadata: Metadata = { title: 'Criar conta', robots: { index: false, follow: true } }

export default function SignUpPage() { return <AuthLanding /> }
