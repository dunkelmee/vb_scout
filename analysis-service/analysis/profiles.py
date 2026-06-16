"""Flat probability profiles for serve and receive situations."""
from typing import Optional, Dict, List


INDEX = {
    'us_positive': 0,
    'them_positive': 1,
    'them_error': 2,
    'us_error': 3,
}

MIN_RALLIES = 10

WINNER_SUBTYPES = ['ace', 'kill', 'block']
ERROR_SUBTYPES = ['serve', 'reception', 'attack', 'other']


def compute_subtype_breakdown(rallies: List[Dict]) -> Dict:
    """
    Point-attribution breakdown from the granular `point_subtype` field.
    Non-breaking / defensive: rallies without a subtype simply don't add to a
    classified bucket. Returns counts for our point source and error mix.
    """
    our = [r for r in rallies if r.get('scorer') == 'us']
    errs = [r for r in rallies if r.get('point_type') == 'us_error']

    def count(subset, st):
        return sum(1 for r in subset if r.get('point_subtype') == st)

    point_source = {
        'ace': count(our, 'ace'),
        'kill': count(our, 'kill'),
        'block': count(our, 'block'),
        'opp_error': sum(1 for r in our if r.get('point_type') == 'them_error'),
    }
    error_mix = {
        'serve': count(errs, 'serve'),
        'reception': count(errs, 'reception'),
        'attack': count(errs, 'attack'),
        'other': sum(1 for r in errs if r.get('point_subtype') not in ('serve', 'reception', 'attack')),
    }
    return {
        'point_source': point_source,
        'error_mix': error_mix,
        'our_points': len(our),
        'our_errors': len(errs),
    }


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
        'subtype_breakdown': compute_subtype_breakdown(rallies),
    }
