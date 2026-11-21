'use client'

import { useEffect, useRef, useState } from 'react'
import { useProfileImageDraft } from './profile-image-draft'
import { Camera, LoaderCircle } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'

export function ProfileImage({ src, name }: { src: string | null; name: string }) {
  const input = useRef<HTMLInputElement>(null)
  const draft = useProfileImageDraft()
  const [preview, setPreview] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const pending = draft?.saving ?? false
  const url = preview ?? draft?.savedUrl ?? src

  useEffect(() => {
    if (!draft?.file) {
      setPreview(null)
      return
    }
    const objectUrl = URL.createObjectURL(draft.file)
    setPreview(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [draft?.file])

  function selectImage(file: File) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setMessage('Usa uma imagem JPG, PNG ou WebP.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setMessage('A imagem deve ter at\u00e9 5 MB.')
      return
    }
    setMessage('')
    draft?.setFile(file)
  }

  return (
    <div className="relative shrink-0">
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
          aria-label="Imagem de perfil" disabled={pending}
          onChange={(event) => {
            const file = event.target.files?.[0]
            event.target.value = ''
            if (file) selectImage(file)
          }} />
        <button type="button" disabled={pending} onClick={() => input.current?.click()}
          aria-label={pending ? 'A carregar imagem' : 'Alterar imagem de perfil'}
          aria-busy={pending}
          title="Alterar imagem de perfil"
          className="group relative block overflow-hidden rounded-sm disabled:cursor-wait">
          <Avatar src={url} name={name} size="lg" className="rounded-sm border-0 object-cover" />
          <span className={`absolute inset-0 grid place-items-center bg-black/40 text-white transition-opacity ${pending ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100'}`}>
            {pending ? <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" /> : <Camera className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" />}
          </span>
        </button>
        <p role="status" className={message ? 'absolute top-full mt-2 w-48 text-xs text-danger' : 'sr-only'}>{message}</p>
    </div>
  )
}
