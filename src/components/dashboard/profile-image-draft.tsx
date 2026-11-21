'use client'

import { createContext, useContext, useState, type ReactNode } from 'react'

const ProfileImageContext = createContext<{
  file: File | null
  setFile: (file: File | null) => void
  saving: boolean
  setSaving: (saving: boolean) => void
  savedUrl: string | null
  setSavedUrl: (url: string) => void
} | null>(null)

export function ProfileImageDraft({ children }: { children: ReactNode }) {
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [savedUrl, setSavedUrl] = useState<string | null>(null)
  return <ProfileImageContext.Provider value={{ file, setFile, saving, setSaving, savedUrl, setSavedUrl }}>{children}</ProfileImageContext.Provider>
}

export const useProfileImageDraft = () => useContext(ProfileImageContext)
