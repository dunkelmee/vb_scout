// Minimal date formatting utilities

export function format(dateStr: string | Date, opts?: { time?: boolean }): string {
  const d = typeof dateStr === 'string' ? new Date(dateStr) : dateStr
  if (isNaN(d.getTime())) return '–'

  const dateFormatted = d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: d.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
  })

  if (opts?.time) {
    const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    return `${dateFormatted} · ${time}`
  }

  return dateFormatted
}

export function formatTime(timeStr: string): string {
  // Accepts HH:MM or HH:MM:SS
  if (!timeStr) return ''
  return timeStr.slice(0, 5)
}

export function isUpcoming(dateStr: string): boolean {
  return new Date(dateStr) >= new Date()
}

export function daysUntil(dateStr: string): number {
  const now = new Date()
  const then = new Date(dateStr)
  return Math.ceil((then.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

export function formatDuration(startTime: string, endTime?: string | null): string {
  if (!endTime) return formatTime(startTime)
  return `${formatTime(startTime)}–${formatTime(endTime)}`
}
