import { RefreshCw } from 'lucide-react'
import { useDepartments } from '@/hooks/useDepartments'

interface DepartmentsSectionProps {
  selectedIds: string[]
  onChange: (ids: string[]) => void
}

export function DepartmentsSection({
  selectedIds,
  onChange,
}: DepartmentsSectionProps) {
  const { departments, loading, error, refetch } = useDepartments()

  const toggleDepartment = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((d) => d !== id))
    } else {
      onChange([...selectedIds, id])
    }
  }

  if (loading) {
    return (
      <div>
        <h3 className="text-base font-medium text-white mb-1">
          Departments
        </h3>
        <p className="text-sm text-slate-400 mb-4">
          Which departments do you serve in?
        </p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-14 rounded-xl animate-pulse"
              style={{ background: 'rgba(255,255,255,0.05)' }}
            />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-base font-medium text-white">
          Departments
        </h3>
        {error && (
          <button
            type="button"
            onClick={refetch}
            className="flex items-center gap-1 text-xs text-slate-500
              hover:text-white transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            Retry
          </button>
        )}
      </div>

      <p className="text-sm text-slate-400 mb-4">
        Which departments do you serve in? Select all that apply.
      </p>

      {error && (
        <div
          className="rounded-xl p-3 mb-4 text-sm border"
          style={{
            background: 'rgba(245,158,11,0.08)',
            borderColor: 'rgba(245,158,11,0.2)',
            color: '#FCD34D',
          }}
        >
          Could not load departments from server.
          Showing default list.
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {departments.map((dept) => {
          const isSelected = selectedIds.includes(dept.id)
          return (
            <button
              key={dept.id}
              type="button"
              onClick={() => toggleDepartment(dept.id)}
              className="relative p-3 rounded-xl text-left
                transition-all duration-200 border text-sm font-medium"
              style={{
                background: isSelected
                  ? 'rgba(124, 58, 237, 0.15)'
                  : 'rgba(255,255,255,0.04)',
                borderColor: isSelected
                  ? 'rgba(124, 58, 237, 0.6)'
                  : 'rgba(255,255,255,0.1)',
                color: isSelected ? '#C4B5FD' : '#94A3B8',
              }}
            >
              {/* Checkmark */}
              {isSelected && (
                <span
                  className="absolute top-2 right-2 w-4 h-4
                    rounded-full flex items-center justify-center
                    text-white text-xs"
                  style={{ background: '#7C3AED' }}
                >
                  ✓
                </span>
              )}
              {dept.name}
            </button>
          )
        })}
      </div>

      {selectedIds.length > 0 && (
        <p className="text-xs text-slate-500 mt-3">
          {selectedIds.length} department
          {selectedIds.length !== 1 ? 's' : ''} selected
        </p>
      )}
    </div>
  )
}
