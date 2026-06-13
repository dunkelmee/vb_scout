"""Locale-aware text for insight cards.

English remains the canonical source (the labels / detail templates live in
``thresholds.py``). This module holds the German overrides plus a few dynamically
composed phrases, keyed by the same stable identifiers used elsewhere:

* strength entries  -> keyed by ``metric``        (e.g. ``own_pos_serve``)
* weakness entries  -> keyed by the weakness id   (e.g. ``error_in_service``)
* drills            -> keyed by ``metric``

Anything missing for a locale falls back to the English text, so partial
coverage degrades gracefully.
"""

SUPPORTED = ('en', 'de')


def normalise(locale):
    return locale if locale in SUPPORTED else 'en'


# ── Strength overrides (German) ──────────────────────────────────────────────

STRENGTH_LABELS_DE = {
    'own_pos_serve': 'Starker Aufschlagdruck',
    'own_pos_receive': 'Starke Angriffsumsetzung in der Annahme',
    'opp_err_serve': 'Aufschlag setzt Gegner unter Druck',
    'own_err_serve': 'Diszipliniert bei eigenem Aufschlag',
    'own_err_receive': 'Diszipliniert in der Annahme',
    'break_pct': 'Effektive Breakpunkt-Ausbeute',
    'sideout_pct': 'Zuverlässige Sideout-Effizienz',
    'timeout_effectiveness': 'Auszeiten wirken — früh nehmen',
    'clutch_score': 'Stark in der Crunchtime',
    'rbi': 'Konstant über alle Rotationen',
}

STRENGTH_DETAILS_DE = {
    'own_pos_serve': 'Dein Team gewinnt {val:.0%} der Aufschlag-Ballwechsel durch positives Spiel — über dem 30%-Richtwert.',
    'own_pos_receive': 'Dein Team verwandelt {val:.0%} der Annahme-Ballwechsel durch positives Spiel in Punkte.',
    'opp_err_serve': 'Gegner machen bei {val:.0%} deiner Aufschlag-Ballwechsel Fehler.',
    'own_err_serve': 'Dein Team macht nur bei {val:.0%} der Aufschlag-Ballwechsel Fehler.',
    'own_err_receive': 'Dein Team macht nur bei {val:.0%} der Annahme-Ballwechsel Fehler.',
    'break_pct': 'Du gewinnst {val:.0%} der Aufschlag-Ballwechsel — über dem 45%-Ziel.',
    'sideout_pct': 'Du gewinnst {val:.0%} der Annahme-Ballwechsel — ausgezeichnete Sideout-Disziplin.',
    'timeout_effectiveness': '{val:.0%} deiner Auszeiten führten zu einem positiven Laufwechsel.',
    'clutch_score': 'Siegquote ab Stand 20+: {val:.0%} — dein Team wächst über sich hinaus.',
    'rbi': 'Rotations-Balance-Index von {val:.2f} — starke Leistung über alle Positionen.',
}

# ── Weakness overrides (German) — keyed by weakness id ───────────────────────

WEAKNESS_LABELS_DE = {
    'error_in_service': 'Zu viele Fehler bei eigenem Aufschlag',
    'error_in_reception': 'Zu viele Fehler in der Annahme',
    'passive_sideout': 'Sideouts hängen von Gegnerfehlern ab',
    'passive_serve': 'Wenig positives Spiel beim Aufschlag',
    'low_sideout': 'Sideout-Effizienz unter Minimum',
    'low_break': 'Schwierigkeiten beim Breaken',
    'clutch_drop': 'Leistungsabfall in der Crunchtime',
    'fatigue_drop': 'Leistungsabfall in späten Sätzen',
    'error_clustering': 'Fehler kommen in Serien',
    'rotation_imbalance': 'Große Leistungsunterschiede zwischen Rotationen',
    'pressure_drops': 'Siegquote bricht bei Rückstand ein',
}

WEAKNESS_DETAILS_DE = {
    'error_in_service': 'Dein Team macht bei {val:.0%} der Aufschlag-Ballwechsel Fehler (Ziel: <30%).',
    'error_in_reception': 'Dein Team macht bei {val:.0%} der Annahme-Ballwechsel Fehler (Ziel: <25%).',
    'passive_sideout': 'Nur {val:.0%} der Sideout-Punkte stammen aus positivem Spiel (Ziel: >25%).',
    'passive_serve': 'Nur {val:.0%} der Aufschlag-Punkte stammen aus positivem Spiel (Ziel: >25%).',
    'low_sideout': 'Sideout-Effizienz bei {val:.0%} — unter dem 45%-Mindestziel.',
    'low_break': 'Breakpunkt-Ausbeute bei {val:.0%} — unter der 38%-Basislinie.',
    'clutch_drop': 'Siegquote ab Stand 20+ nur {val:.0%} — Drucksituationen brauchen Arbeit.',
    'fatigue_drop': 'Siegquote in Sätzen 4–5 deutlich niedriger als in Sätzen 1–3 — mögliches Konditionsproblem.',
    'error_clustering': 'Fehler-Häufungsindex von {val:.2f} — Fehler treten gehäuft statt verteilt auf.',
    'rotation_imbalance': 'Rotations-Balance-Index von {val:.2f} — deutliche Leistungslücke zwischen Rotationen.',
    'pressure_drops': 'Siegquote sinkt um {delta:.0%} bei Rückstand gegenüber komfortabler Führung.',
}

# ── Training drills (German) — keyed by metric ───────────────────────────────

DRILLS_DE = {
    'own_err_serve': 'Aufschlag-Genauigkeitsübungen — Fuß- und Schlagfehler reduzieren. Mit Drucksätzen arbeiten.',
    'own_err_receive': 'Annahmetechnik-Einheiten mit Fokus auf Brettwinkel und Beinarbeit unter Druck.',
    'own_pos_serve': 'Angriffsmuster-Übungen aus Aufschlagsituationen — Flatter-/Sprungaufschlag-Kombinationen.',
    'own_pos_receive': 'Übergangsangriff aus der Annahme — schnelle Zuspiele auf Außen und Diagonal.',
    'sideout_pct': 'Team-Sideout-Wiederholungen — Annahme + erster Angriff in Kombination.',
    'break_pct': 'Aufschlagdruck-Übungen — Zielzonen und Lauf-Simulationen.',
    'clutch_score': 'Drucksituations-Übungen ab Stand 20+ — Tie-Break-Simulationen.',
    'late_match_drop': 'Konditionsarbeit + Fokus auf späte Sätze. Taktik der Sätze 4/5 auswerten.',
    'error_clustering': 'Mentaltraining — Reset-Routinen nach Fehlerserien.',
    'rotation_imbalance': 'Gezieltes Training schwacher Rotationen — isoliertes Aufschlagen und Annehmen aus den schwächsten Zonen.',
    'pressure_sensitivity': 'Aufhol-Szenarien — Rückstände bei -3 bis -5 üben.',
}

# ── Dynamically composed phrases ─────────────────────────────────────────────

MISC = {
    'en': {
        'priority': 'Priority {i}: {title}',
        'recommended_drill': '{detail} Recommended drill: {drill}',
        'default_drill': 'Focused practice on this area during training sessions.',
        'rotation_strong_title': 'Rotation {rot} is a structural strength',
        'rotation_strong_detail': 'Rotation {rot} Efficiency: {re:.2f} (Strong). Win rate: {win:.0%}.',
        'rotation_weak_title': 'Rotation {rot} is critically weak',
        'rotation_weak_detail': 'Rotation {rot} Efficiency: {re:.2f} (Critical). Win rate: {win:.0%}.',
        'impact_addressed_pos': '+{pct:.1f}% win rate if addressed',
        'impact_addressed_neg': '{pct:.1f}% win rate if addressed',
        'impact_achieved': '+{pct:.1f}% win rate if achieved',
    },
    'de': {
        'priority': 'Priorität {i}: {title}',
        'recommended_drill': '{detail} Empfohlene Übung: {drill}',
        'default_drill': 'Gezieltes Training in diesem Bereich während der Einheiten.',
        'rotation_strong_title': 'Rotation {rot} ist eine strukturelle Stärke',
        'rotation_strong_detail': 'Rotation {rot} Effizienz: {re:.2f} (stark). Siegquote: {win:.0%}.',
        'rotation_weak_title': 'Rotation {rot} ist kritisch schwach',
        'rotation_weak_detail': 'Rotation {rot} Effizienz: {re:.2f} (kritisch). Siegquote: {win:.0%}.',
        'impact_addressed_pos': '+{pct:.1f}% Gewinnwahrscheinlichkeit bei Behebung',
        'impact_addressed_neg': '{pct:.1f}% Gewinnwahrscheinlichkeit bei Behebung',
        'impact_achieved': '+{pct:.1f}% Gewinnwahrscheinlichkeit bei Erreichen',
    },
}


# ── Accessors ────────────────────────────────────────────────────────────────

def misc(key, locale):
    loc = normalise(locale)
    return MISC.get(loc, MISC['en']).get(key, MISC['en'][key])


def strength_label(metric, en_label, locale):
    if normalise(locale) == 'de':
        return STRENGTH_LABELS_DE.get(metric, en_label)
    return en_label


def strength_detail(metric, en_detail_tmpl, locale):
    if normalise(locale) == 'de':
        return STRENGTH_DETAILS_DE.get(metric, en_detail_tmpl)
    return en_detail_tmpl


def weakness_label(weakness_id, en_label, locale):
    if normalise(locale) == 'de':
        return WEAKNESS_LABELS_DE.get(weakness_id, en_label)
    return en_label


def weakness_detail(weakness_id, en_detail_tmpl, locale):
    if normalise(locale) == 'de':
        return WEAKNESS_DETAILS_DE.get(weakness_id, en_detail_tmpl)
    return en_detail_tmpl


def drill(metric, en_drill, locale):
    if normalise(locale) == 'de':
        return DRILLS_DE.get(metric, en_drill)
    return en_drill
