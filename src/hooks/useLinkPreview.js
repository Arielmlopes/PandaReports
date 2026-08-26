import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const CACHE_HOURS = 24
const memCache = new Map()

export function useLinkPreview(url) {
  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!url) return
    let cancelled = false

    async function fetchPreview() {
      setLoading(true)
      setFailed(false)

      if (memCache.has(url)) {
        setPreview(memCache.get(url))
        setLoading(false)
        return
      }

      try {
        const { data: cached } = await supabase
          .from('link_previews')
          .select('*')
          .eq('url', url)
          .maybeSingle()

        if (cached) {
          const age = Date.now() - new Date(cached.fetched_at).getTime()
          if (age < CACHE_HOURS * 3600 * 1000) {
            if (!cancelled) {
              memCache.set(url, cached)
              setPreview(cached)
              setLoading(false)
            }
            return
          }
        }

        const { data, error } = await supabase.functions.invoke('link-preview', {
          body: { url }
        })
        if (error || !data) throw error || new Error('empty response')

        const record = {
          url,
          title: data.title || null,
          description: data.description || null,
          image: data.image || null,
          fetched_at: new Date().toISOString()
        }

        await supabase.from('link_previews').upsert(record)

        if (!cancelled) {
          memCache.set(url, record)
          setPreview(record)
        }
      } catch {
        if (!cancelled) setFailed(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchPreview()
    return () => {
      cancelled = true
    }
  }, [url])

  return { preview, loading, failed }
}
