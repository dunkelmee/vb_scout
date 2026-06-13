type Locale = 'en' | 'de'

function locale(user: { locale?: string }): Locale {
  return (user.locale === 'de' ? 'de' : 'en') as Locale
}

export function rsvpRequestContent(
  entityType: 'training' | 'game',
  entityName: string,
  dateTime:   string,
  location:   string,
  loc:        Locale
) {
  if (loc === 'de') return {
    title: entityType === 'training'
      ? `Trainingserinnerung: ${entityName}`
      : `Spielerinnerung: ${entityName}`,
    body: `${dateTime} · ${location} — bitte Teilnahme bestätigen`,
  }
  return {
    title: entityType === 'training'
      ? `Training reminder: ${entityName}`
      : `Match reminder: ${entityName}`,
    body: `${dateTime} · ${location} — please confirm your attendance`,
  }
}

export function rsvpResponseContent(
  playerName: string,
  status:     'confirmed' | 'declined' | 'maybe',
  entityType: 'training' | 'game',
  loc:        Locale
) {
  const labels = {
    en: { confirmed: 'confirmed', declined: 'declined', maybe: 'marked as maybe' },
    de: { confirmed: 'hat zugesagt', declined: 'hat abgesagt', maybe: 'ist unsicher' },
  }
  const entityLabel = {
    en: { training: 'For the training session', game: 'For the match' },
    de: { training: 'Für die Trainingseinheit', game: 'Für das Spiel' },
  }
  return {
    title: `${playerName} ${labels[loc][status]}`,
    body:  entityLabel[loc][entityType],
  }
}

export function analysisReadyContent(opponent: string, loc: Locale) {
  if (loc === 'de') return {
    title: 'Spielanalyse bereit',
    body:  `Deine Nachspielanalyse gegen ${opponent} ist jetzt verfügbar`,
  }
  return {
    title: 'Match analysis ready',
    body:  `Your post-match analysis vs ${opponent} is ready to view`,
  }
}

export { locale }
