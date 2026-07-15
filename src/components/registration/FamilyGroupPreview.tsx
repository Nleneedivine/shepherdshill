import { useMemo } from 'react'
import { Users, CheckCircle, Info } from 'lucide-react'
import { predictFamilyGroup } from '@/utils/familyGroup'

interface FamilyGroupPreviewProps {
  dob: string
  gender: string
  maritalStatus: string
}

export function FamilyGroupPreview({
  dob,
  gender,
  maritalStatus,
}: FamilyGroupPreviewProps) {
  const prediction = useMemo(
    () => predictFamilyGroup(dob, gender, maritalStatus),
    [dob, gender, maritalStatus]
  )

  const hasEnoughData = dob && gender && maritalStatus

  return (
    <div className="space-y-4">
      {/* Section header */}
      <div>
        <h3 className="text-base font-medium text-white">
          Family Group
        </h3>
        <p className="text-sm text-slate-400 mt-1">
          Your family group is assigned automatically based on
          your age and marital status. No selection needed.
        </p>
      </div>

      {/* Info card showing all groups */}
      <div
        className="rounded-xl p-4 border"
        style={{
          background: 'rgba(124, 58, 237, 0.08)',
          borderColor: 'rgba(124, 58, 237, 0.25)',
          borderLeft: '3px solid #7C3AED',
        }}
      >
        <div className="flex items-start gap-3">
          <Users
            className="w-5 h-5 mt-0.5 flex-shrink-0"
            style={{ color: '#7C3AED' }}
          />
          <div>
            <p
              className="text-sm font-medium mb-3"
              style={{ color: '#C4B5FD' }}
            >
              Shepherd's Hill Family Groups
            </p>
            <div className="grid grid-cols-1 gap-1.5">
              {[
                { emoji: '👶', label: 'Ages 0–12', group: 'Junior Church' },
                { emoji: '🧑', label: 'Ages 13–19', group: 'Teens Church' },
                {
                  emoji: '👤',
                  label: 'Ages 20–35 (unmarried)',
                  group: 'YAYA',
                },
                {
                  emoji: '👨',
                  label: 'Men 35+ or married',
                  group: 'RMF',
                },
                {
                  emoji: '👩',
                  label: 'Women 35+ or married',
                  group: 'Good Women Fellowship',
                },
                {
                  emoji: '🧓',
                  label: 'Ages 60+',
                  group: 'Elders Fellowship',
                },
              ].map((item) => (
                <div
                  key={item.group}
                  className="flex items-center gap-2 text-xs"
                >
                  <span>{item.emoji}</span>
                  <span className="text-slate-400">{item.label}</span>
                  <span className="text-slate-600">→</span>
                  <span
                    className="font-medium"
                    style={{ color: '#C4B5FD' }}
                  >
                    {item.group}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Prediction based on entered data */}
      {hasEnoughData && prediction ? (
        <div
          className="rounded-xl p-4 border"
          style={{
            background: 'rgba(16, 185, 129, 0.08)',
            borderColor: 'rgba(16, 185, 129, 0.25)',
            borderLeft: '3px solid #10B981',
          }}
        >
          <div className="flex items-start gap-3">
            <CheckCircle
              className="w-5 h-5 mt-0.5 flex-shrink-0"
              style={{ color: '#10B981' }}
            />
            <div>
              <p
                className="text-xs font-medium mb-1"
                style={{ color: '#6EE7B7' }}
              >
                Based on your details, you will likely be placed in:
              </p>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-2xl">{prediction.emoji}</span>
                <span
                  className="text-lg font-semibold"
                  style={{ color: prediction.colour }}
                >
                  {prediction.name}
                </span>
              </div>
              <p
                className="text-xs mt-2"
                style={{ color: '#6EE7B7', opacity: 0.7 }}
              >
                Final assignment confirmed on approval
              </p>
            </div>
          </div>
        </div>
      ) : hasEnoughData && !prediction ? (
        <div
          className="rounded-xl p-4 border"
          style={{
            background: 'rgba(245, 158, 11, 0.08)',
            borderColor: 'rgba(245, 158, 11, 0.25)',
          }}
        >
          <div className="flex items-center gap-3">
            <Info className="w-4 h-4" style={{ color: '#F59E0B' }} />
            <p className="text-sm" style={{ color: '#FCD34D' }}>
              Family group will be assigned by admin after approval.
            </p>
          </div>
        </div>
      ) : (
        <div
          className="rounded-xl p-4 border"
          style={{
            background: 'rgba(255,255,255,0.03)',
            borderColor: 'rgba(255,255,255,0.08)',
          }}
        >
          <div className="flex items-center gap-3">
            <Info className="w-4 h-4 text-slate-600" />
            <p className="text-sm text-slate-500">
              Complete your date of birth, gender, and marital status
              in the earlier steps to see your predicted family group.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
