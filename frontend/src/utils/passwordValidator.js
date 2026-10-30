/**
 * Frontend password validation utility
 * Mirrors the backend validation for consistent user experience
 */

export const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)

export const validatePassword = (password) => {
  if (!password || password.length === 0) {
    return {
      isValid: false,
      message: 'Password is required',
      strength: 0
    }
  }

  const errors = []
  let strengthScore = 0

  if (password.length < 8) {
    errors.push('At least 8 characters')
  } else {
    strengthScore += 1
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('One uppercase letter')
  } else {
    strengthScore += 1
  }

  if (!/[a-z]/.test(password)) {
    errors.push('One lowercase letter')
  } else {
    strengthScore += 1
  }

  if (!/\d/.test(password)) {
    errors.push('One digit')
  } else {
    strengthScore += 1
  }

  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
    errors.push('One special character (!@#$%^&* etc)')
  } else {
    strengthScore += 1
  }

  if (errors.length === 0) {
    return {
      isValid: true,
      message: 'Strong password',
      strength: 5,
      requirements: []
    }
  }

  return {
    isValid: false,
    message: `Password must have: ${errors.join(', ')}`,
    strength: strengthScore,
    requirements: errors
  }
}

/**
 * Get visual feedback for password strength. `color` is a Mantine palette name
 * rather than a hex value so the meter re-tints with the colour scheme.
 */
export const getPasswordStrengthFeedback = (strength) => {
  switch (strength) {
    case 0:
      return { color: 'red', label: 'Very Weak', percent: 20 }
    case 1:
      return { color: 'orange', label: 'Weak', percent: 40 }
    case 2:
      return { color: 'amber', label: 'Fair', percent: 60 }
    case 3:
      return { color: 'green', label: 'Good', percent: 80 }
    case 4:
      return { color: 'green', label: 'Very Good', percent: 90 }
    case 5:
      return { color: 'forest', label: 'Strong', percent: 100 }
    default:
      return { color: 'gray', label: 'Unknown', percent: 0 }
  }
}

