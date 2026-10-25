import type { IconName } from './icons'

export type Tone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'accent'

export interface SelectOption<T = string> {
  value: T
  label: string
  disabled?: boolean
}

export interface MenuAction {
  id: string
  label: string
  icon?: IconName
  danger?: boolean
  /** draws a separator above this item */
  separatorBefore?: boolean
}

export interface TabItem {
  id: string
  label: string
  count?: number
}

export interface TableColumn {
  key: string
  label: string
  align?: 'left' | 'right' | 'center'
  width?: string
}

export interface NavItem {
  id?: string
  label?: string
  icon?: IconName
  badge?: string | number
  /** route for vue-router; renders a RouterLink when set */
  to?: string
  /** turns the entry into a section label instead of a link */
  section?: string
}
