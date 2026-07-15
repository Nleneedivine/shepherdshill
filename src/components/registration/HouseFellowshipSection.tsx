import { useState } from 'react'
import { MapPin, Home, Search, X } from 'lucide-react'
import { useCellGroups } from '@/hooks/useCellGroups'
import { TERMS } from '@/constants/terminology'

interface HouseFellowshipSectionProps {
  selectedId: string | null
  selectedText: string
  onSelect: (id: string | null, text: string) => void
}

export function HouseFellowshipSection({
  selectedId,
  selectedText,
  onSelect,
}: HouseFellowshipSectionProps) {
  const { centres, loading, isEmpty } = useCellGroups()
  const [search, setSearch] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)

  const filtered = centres.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  )

  const toBeAssigned = selectedText === 'to_be_assigned'

  if (loading) {
    return (
      <div>
        <h3 className="text-base font-medium text-white mb-1">
          {TERMS.CELL_GROUP}
        </h3>
        <div
          className="h-12 rounded-xl animate-pulse"
          style={{ background: 'rgba(255,255,255,0.05)' }}
        />
      </div>
    )
  }

  return (
    <div>
      <h3 className="text-base font-medium text-white mb-1">
        {TERMS.CELL_GROUP}
      </h3>
      <p className="text-sm text-slate-400 mb-4">
        Which {TERMS.CELL_GROUP} do you attend?
      </p>

      {isEmpty ? (
        /* No centres loaded yet */
        <div
          className="rounded-xl p-4 border mb-4"
          style={{
            background: 'rgba(245,158,11,0.08)',
            borderColor: 'rgba(245,158,11,0.25)',
            borderLeft: '3px solid #F59E0B',
          }}
        >
          <div className="flex items-start gap-3">
            <MapPin
              className="w-5 h-5 mt-0.5 flex-shrink-0"
              style={{ color: '#F59E0B' }}
            />
            <div>
              <p
                className="text-sm font-medium"
                style={{ color: '#FCD34D' }}
              >
                {TERMS.CELL_GROUPS} Being Set Up
              </p>
              <p className="text-xs mt-1" style={{ color: '#FDE68A', opacity: 0.8 }}>
                The list of Shepherd's Hill{' '}
                {TERMS.CELL_GROUPS.toLowerCase()} is being
                prepared. Please select the option below and
                our team will place you in the right centre.
              </p>
            </div>
          </div>
        </div>
      ) : (
        /* Centres exist — show search */
        <div className="relative mb-4">
          <div
            className="flex items-center gap-2 rounded-xl border px-4 py-3"
            style={{
              background: 'rgba(255,255,255,0.05)',
              borderColor: showDropdown
                ? 'rgba(124,58,237,0.6)'
                : 'rgba(255,255,255,0.1)',
            }}
          >
            <Search className="w-4 h-4 text-slate-500 flex-shrink-0" />
            <input
              type="text"
              value={
                selectedId && !toBeAssigned
                  ? centres.find((c) => c.id === selectedId)?.name ||
                    search
                  : search
              }
              onChange={(e) => {
                setSearch(e.target.value)
                setShowDropdown(true)
                if (selectedId) onSelect(null, '')
              }}
              onFocus={() => setShowDropdown(true)}
              placeholder={`Search for your ${TERMS.CELL_GROUP}...`}
              className="flex-1 bg-transparent text-white
                placeholder-slate-500 outline-none text-sm"
            />
            {(selectedId || search) && (
              <button
                type="button"
                onClick={() => {
                  setSearch('')
                  onSelect(null, '')
                  setShowDropdown(false)
                }}
              >
                <X className="w-4 h-4 text-slate-600
                  hover:text-white transition-colors" />
              </button>
            )}
          </div>

          {showDropdown && filtered.length > 0 && (
            <div
              className="absolute top-full left-0 right-0 z-50
                mt-1 rounded-xl border overflow-hidden"
              style={{
                background: 'rgba(13,17,23,0.98)',
                borderColor: 'rgba(255,255,255,0.12)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
              }}
            >
              {filtered.slice(0, 8).map((centre) => (
                <button
                  key={centre.id}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onSelect(centre.id, centre.name)
                    setSearch('')
                    setShowDropdown(false)
                  }}
                  className="w-full text-left px-4 py-3
                    hover:bg-white/5 transition-colors border-b
                    last:border-b-0"
                  style={{ borderColor: 'rgba(255,255,255,0.05)' }}
                >
                  <p className="text-sm text-white">{centre.name}</p>
                  {centre.meeting_day && (
                    <p className="text-xs text-slate-500 mt-0.5">
                      {centre.meeting_day}
                      {centre.meeting_time
                        ? ` at ${centre.meeting_time}`
                        : ''}
                    </p>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Always show the "assign me" option */}
      <button
        type="button"
        onClick={() => {
          onSelect(null, 'to_be_assigned')
          setSearch('')
          setShowDropdown(false)
        }}
        className="w-full flex items-center gap-4 p-4
          rounded-xl border transition-all duration-200 text-left"
        style={{
          background: toBeAssigned
            ? 'rgba(124,58,237,0.15)'
            : 'rgba(255,255,255,0.04)',
          borderColor: toBeAssigned
            ? 'rgba(124,58,237,0.6)'
            : 'rgba(255,255,255,0.1)',
        }}
      >
        <div
          className="w-10 h-10 rounded-xl flex items-center
            justify-center flex-shrink-0"
          style={{
            background: toBeAssigned
              ? 'rgba(124,58,237,0.3)'
              : 'rgba(255,255,255,0.05)',
          }}
        >
          <Home
            className="w-5 h-5"
            style={{ color: toBeAssigned ? '#C4B5FD' : '#64748B' }}
          />
        </div>
        <div className="flex-1">
          <p
            className="text-sm font-medium"
            style={{
              color: toBeAssigned ? '#C4B5FD' : '#94A3B8',
            }}
          >
            I will be assigned to a{' '}
            {TERMS.CELL_GROUP.toLowerCase()}
          </p>
          <p
            className="text-xs mt-0.5"
            style={{ color: toBeAssigned ? '#A78BFA' : '#475569' }}
          >
            An administrator will contact you
          </p>
        </div>
        {toBeAssigned && (
          <span
            className="w-5 h-5 rounded-full flex items-center
              justify-center text-white text-xs flex-shrink-0"
            style={{ background: '#7C3AED' }}
          >
            ✓
          </span>
        )}
      </button>
    </div>
  )
}
