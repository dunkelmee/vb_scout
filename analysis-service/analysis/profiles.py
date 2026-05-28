"""Flat probability profiles for serve and receive situations."""
from typing import Optional, Dict, List


INDEX = {
    'us_positive': 0,
    'them_positive': 1,
    'them_error': 2,
    'us_error': 3,
}

MIN_RALLIES = 10


def compute_profiles(rallies: List[Dict]) -> Optional[Dict]:
    """
    Compute 4-component probability vectors for serve and receive situations.

    Returns None if insufficient data.
    """
    serve_rallies = [r for r in rallies if r['serving_team'] == 'us']
    receive_rallies = [r for r in rallies if r['serving_team'] == 'them']

    if len(serve_rallies) < MIN_RALLIES or len(receive_rallies) < MIN_RALLIES:
        return None

    def make_profile(rally_subset: List[Dict]) -> List[float]:
        counts = [0, 0, 0, 0]
        for r in rally_subset:
            pt = r.get('point_type', '')
            if pt in INDEX:
                counts[INDEX[pt]] += 1
        total = sum(counts)
        if total == 0:
            return [0.25, 0.25, 0.25, 0.25]
        return [c / total for c in counts]

    # Opponent profiles (from their perspective when they serve/receive)
    opp_serve = [r for r in rallies if r['serving_team'] == 'them']
    opp_receive = [r for r in rallies if r['serving_team'] == 'us']

    return {
        'us': {
            'on_serve': make_profile(serve_rallies),
            'on_receive': make_profile(receive_rallies),
        },
        'opponent': {
            'on_serve': make_profile(opp_serve),
            'on_receive': make_profile(opp_receive),
        },
        'serve_rallies': len(serve_rallies),
        'receive_rallies': len(receive_rallies),
        'total_rallies': len(rallies),
    }
