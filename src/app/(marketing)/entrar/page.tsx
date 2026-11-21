import type { Metadata } from 'next'
import { AuthLanding } from '@/components/auth/auth-landing'

export const metadata: Metadata = { title: 'Entrar', robots: { index: false, follow: true } }

export default function SignInPage() { return <AuthLanding /> }
