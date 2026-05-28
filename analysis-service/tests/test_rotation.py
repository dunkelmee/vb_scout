"""Tests for rotation logic (mirrors API tests)."""
import pytest

# These test the same logic as the TypeScript addPoint function
# validated in isolation as Python equivalents

def add_point(scorer, current_server, current_lineup):
    """Python mirror of the TypeScript addPoint function."""
    def rotate(lineup):
        return {
            'zone1': lineup['zone6'],
            'zone2': lineup['zone1'],
            'zone3': lineup['zone2'],
            'zone4': lineup['zone3'],
            'zone5': lineup['zone4'],
            'zone6': lineup['zone5'],
        }

    if scorer == 'us' and current_server == 'them':
        return {'newLineup': rotate(current_lineup), 'rotated': True, 'newServer': 'us'}
    if scorer == 'us' and current_server == 'us':
        return {'newLineup': current_lineup, 'rotated': False, 'newServer': 'us'}
    if scorer == 'them' and current_server == 'us':
        return {'newLineup': current_lineup, 'rotated': False, 'newServer': 'them'}
    return {'newLineup': current_lineup, 'rotated': False, 'newServer': 'them'}


SAMPLE_LINEUP = {
    'zone1': 'p1', 'zone2': 'p2', 'zone3': 'p3',
    'zone4': 'p4', 'zone5': 'p5', 'zone6': 'p6'
}


def test_us_scores_while_them_serving_rotates():
    result = add_point('us', 'them', SAMPLE_LINEUP)
    assert result['rotated'] is True
    assert result['newServer'] == 'us'
    assert result['newLineup']['zone1'] == 'p6'  # after rotation


def test_us_scores_while_us_serving_no_rotate():
    result = add_point('us', 'us', SAMPLE_LINEUP)
    assert result['rotated'] is False
    assert result['newServer'] == 'us'
    assert result['newLineup'] == SAMPLE_LINEUP


def test_them_scores_while_us_serving_no_rotate():
    result = add_point('them', 'us', SAMPLE_LINEUP)
    assert result['rotated'] is False
    assert result['newServer'] == 'them'


def test_them_scores_while_them_serving_no_rotate():
    result = add_point('them', 'them', SAMPLE_LINEUP)
    assert result['rotated'] is False
    assert result['newServer'] == 'them'


def test_six_rotations_returns_to_start():
    """After 6 rotations, lineup should be back to original."""
    def rotate(lineup):
        return {
            'zone1': lineup['zone6'],
            'zone2': lineup['zone1'],
            'zone3': lineup['zone2'],
            'zone4': lineup['zone3'],
            'zone5': lineup['zone4'],
            'zone6': lineup['zone5'],
        }

    lineup = dict(SAMPLE_LINEUP)
    for _ in range(6):
        lineup = rotate(lineup)
    assert lineup == SAMPLE_LINEUP
