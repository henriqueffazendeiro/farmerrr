import Link from 'next/link'
import { Wordmark } from '@/components/ui/wordmark'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative grid min-h-dvh place-items-center px-5 py-12">
      <div className="w-full max-w-[380px]">
        <Link href="/" className="mb-10 flex justify-center">
          <Wordmark size="lg" />
        </Link>
        {children}
      </div>
    </div>
  )
}
