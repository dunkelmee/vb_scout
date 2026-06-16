export const chartTheme = {
  // primary series colours
  turq:      '#23B5D3',
  turqLight: '#4EC8E4',
  bell:      '#279AF1',
  bellLight: '#5BB4F5',
  pink:      '#EA526F',
  pinkDeep:  '#A82848',

  // fills for area charts
  turqFill: 'rgba(35,181,211,0.15)',
  pinkFill: 'rgba(234,82,111,0.15)',
  bellFill: 'rgba(39,154,241,0.12)',

  // ── Point-attribution category palette (design tokens only) ──────────────
  // Winners read cool (turq/bell), our errors read pink (bubb), neutral grey.
  categories: {
    ace:        '#23B5D3', // turq-500
    kill:       '#279AF1', // bell-500
    block:      '#8DDFF0', // turq-300
    oppErr:     '#8A8A9A', // ghost-300
    serve:      '#A82848', // bubb-700
    reception:  '#EA526F', // bubb-500
    attack:     '#F07A90', // bubb-400
    other:      '#5A5560', // grey
    theirPoint: '#7C7C8A', // grey
  } as Record<string, string>,

  // axes + grid
  gridColor: 'rgba(47,45,40,0.80)',
  tickColor: '#4A4A5A',

  // tooltip
  tooltip: {
    backgroundColor: '#161412',
    titleColor:      '#F7F7FF',
    bodyColor:       '#8A8A9A',
    padding:         8,
    cornerRadius:    6,
  },
}
