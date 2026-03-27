export const courierStatusMap = {
  available: {
    label: 'Disponível',
    badgeClass: 'ui-badge--success',
  },
  on_route: {
    label: 'Em rota',
    badgeClass: 'ui-badge--info',
  },
  delayed: {
    label: 'Atraso',
    badgeClass: 'ui-badge--warning',
  },
  offline: {
    label: 'Offline',
    badgeClass: 'ui-badge--danger',
  },
}

export const courierShiftMap = {
  morning: 'Manhã',
  afternoon: 'Tarde',
  night: 'Noite',
  full_day: 'Dia inteiro',
}

export const courierStatusOptions = [
  { value: 'all', label: 'Todos os status' },
  { value: 'available', label: 'Disponível' },
  { value: 'on_route', label: 'Em rota' },
  { value: 'delayed', label: 'Atraso' },
  { value: 'offline', label: 'Offline' },
]

export const courierShiftOptions = [
  { value: 'all', label: 'Todos os turnos' },
  { value: 'morning', label: 'Manhã' },
  { value: 'afternoon', label: 'Tarde' },
  { value: 'night', label: 'Noite' },
  { value: 'full_day', label: 'Dia inteiro' },
]
