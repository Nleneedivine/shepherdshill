import { useState, useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'

export interface Department {
  id: string
  name: string
}

export function useDepartments() {
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchDepartments()
  }, [])

  const fetchDepartments = async () => {
    setLoading(true)
    setError(null)

    try {
      const branchId = import.meta.env.VITE_DEFAULT_BRANCH_ID

      let query = supabase
        .from('departments')
        .select('id, name')
        .eq('is_active', true)
        .order('name', { ascending: true })

      if (branchId) {
        query = query.eq('branch_id', branchId)
      }

      const { data, error: fetchError } = await query

      if (fetchError) throw fetchError

      if (data && data.length > 0) {
        setDepartments(data)
      } else {
        // Fallback if table empty
        setDepartments([
          { id: 'fallback-1', name: 'Sunday School' },
          { id: 'fallback-2', name: 'Choir' },
          { id: 'fallback-3', name: 'Ushering' },
          { id: 'fallback-4', name: 'Media and Technical Department' },
          { id: 'fallback-5', name: 'Evangelism and Follow-up' },
          { id: 'fallback-6', name: 'Prayer Warriors' },
          { id: 'fallback-7', name: 'Welfare' },
          { id: 'fallback-8', name: 'Junior Church' },
          { id: 'fallback-9', name: 'IT' },
          { id: 'fallback-10', name: 'Protocol' },
          { id: 'fallback-11', name: 'Redeemer\'s Volunteers (RV)' },
          { id: 'fallback-12', name: 'Sanitation' },
          { id: 'fallback-13', name: 'Family Affairs Department' },
          { id: 'fallback-14', name: 'Counselling Department' },
        ])
      }
    } catch (err) {
      console.error('Failed to fetch departments:', err)
      setError('Could not load departments')
      // Still show fallback on error
      setDepartments([
        { id: 'fallback-1', name: 'Sunday School' },
        { id: 'fallback-2', name: 'Choir' },
        { id: 'fallback-3', name: 'Ushering' },
        { id: 'fallback-4', name: 'Media and Technical Department' },
        { id: 'fallback-5', name: 'Evangelism and Follow-up' },
        { id: 'fallback-6', name: 'Prayer Warriors' },
        { id: 'fallback-7', name: 'Welfare' },
        { id: 'fallback-8', name: 'Junior Church' },
        { id: 'fallback-9', name: 'IT' },
        { id: 'fallback-10', name: 'Protocol' },
        { id: 'fallback-11', name: 'Redeemer\'s Volunteers (RV)' },
        { id: 'fallback-12', name: 'Sanitation' },
        { id: 'fallback-13', name: 'Family Affairs Department' },
        { id: 'fallback-14', name: 'Counselling Department' },
      ])
    } finally {
      setLoading(false)
    }
  }

  return { departments, loading, error, refetch: fetchDepartments }
}
