"""Bayesian season prior from historical match data."""
from typing import List, Dict


FLAT_PRIOR = [2.0, 2.0, 2.0, 2.0]
INDEX = {'us_positive': 0, 'them_positive': 1, 'them_error': 2, 'us_error': 3}


def compute_season_prior(prior_rallies: List[Dict], n_matches: int) -> Dict:
    """
    Build Dirichlet concentration parameters from prior season matches.

    Cold start: 0 matches → flat prior [2,2,2,2]
    1-4 matches → weak prior
    5+ matches → data-driven
    """
    if n_matches == 0 or not prior_rallies:
        return {
            'serve': list(FLAT_PRIOR),
            'receive': list(FLAT_PRIOR),
            'strength': 'cold_start',
        }

    serve_counts = [0, 0, 0, 0]
    receive_counts = [0, 0, 0, 0]

    for r in prior_rallies:
        pt = r.get('point_type', '')
        if pt not in INDEX:
            continue
        idx = INDEX[pt]
        if r['serving_team'] == 'us':
            serve_counts[idx] += 1
        else:
            receive_counts[idx] += 1

    # Scale factor for weak prior
    scale = 0.5 if n_matches < 5 else 1.0

    serve_prior = [FLAT_PRIOR[i] + scale * serve_counts[i] for i in range(4)]
    receive_prior = [FLAT_PRIOR[i] + scale * receive_counts[i] for i in range(4)]

    return {
        'serve': serve_prior,
        'receive': receive_prior,
        'strength': 'weak' if n_matches < 5 else 'data_driven',
        'n_prior_rallies': len(prior_rallies),
        'n_matches': n_matches,
    }
