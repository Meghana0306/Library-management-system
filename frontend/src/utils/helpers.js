import { BORROW_DURATION_DAYS } from './constants'

export const getDueDate = (record) => {
  const persistedDue = new Date(record?.dueDate)
  if (!Number.isNaN(persistedDue.getTime())) return persistedDue

  const borrowed = new Date(record?.borrowedDate)
  if (Number.isNaN(borrowed.getTime())) return null
  borrowed.setDate(borrowed.getDate() + BORROW_DURATION_DAYS)
  return borrowed
}

export const formatDateTime = (value) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString()
}

export const loadLocalMap = (key) => {
  try {
    return JSON.parse(localStorage.getItem(key) || '{}')
  } catch {
    return {}
  }
}

export const saveLocalMap = (key, value) => {
  localStorage.setItem(key, JSON.stringify(value))
}
