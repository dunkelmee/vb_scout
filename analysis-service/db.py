"""Database access layer for the analysis service."""
import os
import psycopg2
import psycopg2.extras
from typing import Optional, List, Dict, Any
from contextlib import contextmanager


def get_connection():
    database_url = os.environ.get("DATABASE_URL", "")
    return psycopg2.connect(database_url)


@contextmanager
def db_cursor():
    conn = get_connection()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            yield cur, conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def get_match_data(match_id: str) -> Optional[Dict]:
    """Fetch all data needed for analysis."""
    with db_cursor() as (cur, conn):
        # Match
        cur.execute("SELECT * FROM matches WHERE id = %s", (match_id,))
        match = cur.fetchone()
        if not match:
            return None

        # Sets
        cur.execute(
            "SELECT * FROM sets WHERE match_id = %s ORDER BY set_number",
            (match_id,)
        )
        sets = cur.fetchall()

        all_rallies = []
        all_substitutions = []
        all_timeouts = []

        for s in sets:
            cur.execute(
                "SELECT * FROM rallies WHERE set_id = %s ORDER BY rally_index",
                (s['id'],)
            )
            rallies = cur.fetchall()
            for r in rallies:
                r_dict = dict(r)
                r_dict['set_number'] = s['set_number']
                all_rallies.append(r_dict)

            cur.execute(
                "SELECT s.*, p_out.first_name || ' ' || p_out.last_name as player_out_name, "
                "p_in.first_name || ' ' || p_in.last_name as player_in_name "
                "FROM substitutions s "
                "LEFT JOIN players p_out ON s.player_out_id = p_out.id "
                "LEFT JOIN players p_in ON s.player_in_id = p_in.id "
                "WHERE s.set_id = %s ORDER BY s.rally_index",
                (s['id'],)
            )
            subs = cur.fetchall()
            all_substitutions.extend([dict(s) for s in subs])

            cur.execute(
                "SELECT * FROM timeouts WHERE set_id = %s ORDER BY rally_index",
                (s['id'],)
            )
            timeouts = cur.fetchall()
            all_timeouts.extend([dict(t) for t in timeouts])

        # Previous season matches (for prior)
        season_id = match.get('season_id')
        prior_rallies = []
        if season_id:
            cur.execute(
                """SELECT r.* FROM rallies r
                   JOIN sets s ON r.set_id = s.id
                   JOIN matches m ON s.match_id = m.id
                   WHERE m.season_id = %s AND m.id != %s AND m.status = 'completed'
                   ORDER BY m.date, r.rally_index""",
                (season_id, match_id)
            )
            prior_rallies = [dict(r) for r in cur.fetchall()]

        return {
            'match': dict(match),
            'sets': [dict(s) for s in sets],
            'rallies': all_rallies,
            'substitutions': all_substitutions,
            'timeouts': all_timeouts,
            'prior_rallies': prior_rallies,
        }


def upsert_match_analysis(match_id: str, status: str, result=None, insights=None,
                           error_message=None, n_rallies=None):
    """Create or update match_analysis row."""
    import json
    with db_cursor() as (cur, conn):
        cur.execute(
            """INSERT INTO match_analysis (match_id, status, result, insights, error_message, n_rallies, updated_at)
               VALUES (%s, %s, %s, %s, %s, %s, NOW())
               ON CONFLICT (match_id) DO UPDATE SET
                 status = EXCLUDED.status,
                 result = EXCLUDED.result,
                 insights = EXCLUDED.insights,
                 error_message = EXCLUDED.error_message,
                 n_rallies = EXCLUDED.n_rallies,
                 updated_at = NOW()""",
            (
                match_id, status,
                json.dumps(result) if result else None,
                json.dumps(insights) if insights else None,
                error_message,
                n_rallies,
            )
        )


def upsert_training_priority(team_id: str, source_match_id: str, insight_type: str,
                              priority_class: str, metric: str, baseline_value: float,
                              target_value: float, direction: str, label: str) -> str:
    """Insert training priority, return its id."""
    with db_cursor() as (cur, conn):
        cur.execute(
            """INSERT INTO training_priorities
               (team_id, source_match_id, insight_type, priority_class, metric,
                baseline_value, target_value, direction, label, status)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, 'active')
               RETURNING id""",
            (team_id, source_match_id, insight_type, priority_class, metric,
             baseline_value, target_value, direction, label)
        )
        row = cur.fetchone()
        return row['id']


def get_active_priorities(team_id: str) -> List[Dict]:
    with db_cursor() as (cur, conn):
        cur.execute(
            """SELECT tp.*, m.opponent as source_match_opponent, m.date as source_match_date
               FROM training_priorities tp
               LEFT JOIN matches m ON tp.source_match_id = m.id
               WHERE tp.team_id = %s AND tp.status NOT IN ('dismissed')
               ORDER BY tp.created_at DESC""",
            (team_id,)
        )
        return [dict(r) for r in cur.fetchall()]


def insert_priority_outcome(priority_id: str, measured_match_id: str,
                             measured_value: float, delta: float, verdict: str):
    with db_cursor() as (cur, conn):
        cur.execute(
            """INSERT INTO priority_outcomes
               (priority_id, measured_match_id, measured_value, delta, verdict)
               VALUES (%s, %s, %s, %s, %s)""",
            (priority_id, measured_match_id, measured_value, delta, verdict)
        )


def update_priority_status(priority_id: str, status: str):
    with db_cursor() as (cur, conn):
        cur.execute(
            "UPDATE training_priorities SET status = %s, updated_at = NOW() WHERE id = %s",
            (status, priority_id)
        )
