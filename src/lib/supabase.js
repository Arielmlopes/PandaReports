import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

export const STORAGE_BUCKET = import.meta.env.VITE_STORAGE_BUCKET || 'uploads'

export function publicUrlFor(path) {
  if (!path) return null
  if (path.startsWith('http')) return path
  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path)
  return data?.publicUrl || null
}

export async function uploadFile(file, folder = 'misc') {
  const sanitized = sanitizeFileName(file.name)
  const path = `${folder}/${Date.now()}_${sanitized}`
  const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false
  })
  if (error) throw error
  return publicUrlFor(path)
}

export function sanitizeFileName(name) {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
}
