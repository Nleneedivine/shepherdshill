import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export interface CellGroup {
  id: string
  name: string
  leader_name?: string
  meeting_day?: string
  meeting_time?: string
  meeting_location?: string
}

export function useCellGroups() {
  const [centres, setCentres] = useState<CellGroup[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchCentres()
  }, [])

  const fetchCentres = async () => {
    setLoading(true)
    try {
      const branchId = import.meta.env.VITE_DEFAULT_BRANCH_ID

      let query = supabase
        .from('cell_groups')
        .select('id, name, meeting_day, meeting_time, meeting_location')
        .order('name', { ascending: true })

      if (branchId) {
        query = query.eq('branch_id', branchId)
      }

      const { data } = await query
      setCentres(data || [])
    } catch {
      setCentres([])
    } finally {
      setLoading(false)
    }
  }

  return { centres, loading, isEmpty: centres.length === 0 }
}
