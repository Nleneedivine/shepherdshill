export interface FamilyGroupPrediction {
  name: string
  emoji: string
  colour: string
}

export function predictFamilyGroup(
  dobString: string,
  gender: string,
  maritalStatus: string
): FamilyGroupPrediction | null {
  if (!dobString) return null

  try {
    const dob = new Date(dobString)
    if (isNaN(dob.getTime())) return null

    const today = new Date()
    let age = today.getFullYear() - dob.getFullYear()
    const monthDiff = today.getMonth() - dob.getMonth()
    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < dob.getDate())
    ) {
      age--
    }

    const isMarried =
      maritalStatus?.toLowerCase() === 'married'
    const isMale = gender?.toLowerCase() === 'male'
    const isFemale = gender?.toLowerCase() === 'female'

    // Elders — highest priority
    if (age >= 60) {
      return {
        name: 'Elders Fellowship',
        emoji: '🧓',
        colour: '#059669',
      }
    }

    // Married people → RMF or GWF regardless of age
    if (isMarried && isMale) {
      return {
        name: 'RMF',
        emoji: '👨',
        colour: '#1D4ED8',
      }
    }
    if (isMarried && isFemale) {
      return {
        name: 'Good Women Fellowship',
        emoji: '👩',
        colour: '#BE185D',
      }
    }

    // 35+ unmarried → RMF or GWF by gender
    if (age >= 35 && isMale) {
      return {
        name: 'RMF',
        emoji: '👨',
        colour: '#1D4ED8',
      }
    }
    if (age >= 35 && isFemale) {
      return {
        name: 'Good Women Fellowship',
        emoji: '👩',
        colour: '#BE185D',
      }
    }

    // YAYA: 20-35 unmarried
    if (age >= 20 && age <= 35) {
      return {
        name: 'YAYA',
        emoji: '👤',
        colour: '#D97706',
      }
    }

    // Teens: 13-19
    if (age >= 13 && age <= 19) {
      return {
        name: 'Teens Church',
        emoji: '🧑',
        colour: '#7C3AED',
      }
    }

    // Junior Church: 0-12
    if (age >= 0 && age <= 12) {
      return {
        name: 'Junior Church',
        emoji: '👶',
        colour: '#0284C7',
      }
    }

    return null
  } catch {
    return null
  }
}
