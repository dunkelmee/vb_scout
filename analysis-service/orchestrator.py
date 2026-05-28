"""Analysis orchestrator — coordinates all modules and writes results."""
import os
import traceback
from typing import Dict

import db
from analysis.profiles import compute_profiles
from analysis.rotation_profiles import compute_rotation_profiles
from analysis.set_profiles import compute_set_profiles
from analysis.score_context import compute_score_context
from analysis.simulation import simulate_match, run_sensitivity
from analysis.substitution_impact import compute_substitution_impact
from analysis.timeout_impact import compute_timeout_impact
from analysis.tus_retrospective import compute_tus_retrospective
from analysis.season_prior import compute_season_prior
from analysis.clustering import wald_wolfowitz, error_sequence_from_rallies
from analysis.outcome_tracker import check_and_record_outcomes
from insights.assembler import assemble_insights

MIN_RALLIES = int(os.environ.get('MIN_RALLIES', '20'))
N_SIMS = int(os.environ.get('N_SIMS', '10000'))
N_SENSITIVITY = int(os.environ.get('N_SENSITIVITY', '5000'))


def run_analysis(match_id: str):
    """
    Full analysis pipeline for a completed match.
    Reads from DB, runs all modules, writes results.
    """
    try:
        db.upsert_match_analysis(match_id, 'running')

        match_data = db.get_match_data(match_id)
        if not match_data:
            db.upsert_match_analysis(match_id, 'error', error_message='Match not found')
            return

        rallies = match_data['rallies']
        n_rallies = len(rallies)

        if n_rallies < MIN_RALLIES:
            db.upsert_match_analysis(
                match_id, 'insufficient_data',
                n_rallies=n_rallies,
                error_message=f'Only {n_rallies} rallies (minimum {MIN_RALLIES})',
            )
            return

        # Extract player positions from match players
        player_positions: Dict[str, list] = {}
        # We need to get player positions from the DB
        try:
            import psycopg2
            import psycopg2.extras
            conn = db.get_connection()
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(
                    """SELECT p.id, p.positions FROM players p
                       JOIN match_players mp ON p.id = mp.player_id
                       WHERE mp.match_id = %s""",
                    (match_id,)
                )
                for row in cur.fetchall():
                    player_positions[str(row['id'])] = list(row['positions'] or [])
            conn.close()
        except Exception:
            pass

        # --- Module 1: Flat profiles
        profiles = compute_profiles(rallies)

        # --- Module 2: Rotation profiles
        rotation_profiles = compute_rotation_profiles(rallies, player_positions) if profiles else None

        # --- Module 3: Set profiles
        set_profiles = compute_set_profiles(match_data['sets'], rallies)

        # --- Module 4: Score context
        score_context = compute_score_context(rallies)

        # --- Module 5: Season prior + Simulation
        prior_rallies = match_data.get('prior_rallies', [])
        prior = compute_season_prior(prior_rallies, len(match_data['sets']))

        simulation = None
        sensitivity = None
        if profiles:
            first_serve = match_data['match'].get('first_serve', 'us')

            # Mix prior with current profiles using Dirichlet posterior
            def bayesian_profile(profile_probs, prior_params):
                from scipy.stats import dirichlet
                import numpy as np
                alpha = [p + c for p, c in zip(prior_params, profile_probs)]
                # Use mean of posterior
                total = sum(alpha)
                return [a / total for a in alpha]

            serve_p = profiles['us']['on_serve']
            receive_p = profiles['us']['on_receive']

            try:
                serve_posterior = bayesian_profile(
                    [x * profiles['serve_rallies'] for x in serve_p],
                    prior['serve']
                )
                receive_posterior = bayesian_profile(
                    [x * profiles['receive_rallies'] for x in receive_p],
                    prior['receive']
                )
            except Exception:
                serve_posterior = serve_p
                receive_posterior = receive_p

            simulation = simulate_match(serve_posterior, receive_posterior, first_serve, N_SIMS)
            sensitivity_result = run_sensitivity(serve_posterior, receive_posterior, first_serve, N_SENSITIVITY)
            simulation['sensitivity'] = sensitivity_result.get('scenarios', [])
            simulation['top_intervention'] = sensitivity_result.get('top_intervention')

        # --- Module 6: Substitution impact
        substitution_impact = compute_substitution_impact(rallies, match_data['substitutions'])

        # --- Module 7: Timeout impact
        timeout_impact_result = compute_timeout_impact(rallies, match_data['timeouts'])

        # --- Module 8: TUS retrospective
        tus_retro = compute_tus_retrospective(rallies, match_data['timeouts'])

        # --- Module 9: Error clustering (overall)
        error_seq = error_sequence_from_rallies(rallies)
        clustering_index = wald_wolfowitz(error_seq)

        # Compile full result
        analysis_result = {
            'match_id': match_id,
            'n_rallies': n_rallies,
            'profiles': profiles,
            'rotation_profiles': rotation_profiles,
            'set_profiles': set_profiles,
            'score_context': score_context,
            'simulation': simulation,
            'substitution_impact': substitution_impact,
            'timeout_impact': timeout_impact_result,
            'tus_retrospective': tus_retro,
            'clustering_index': clustering_index,
        }

        # --- Assemble insights
        insights, simulation_summary = assemble_insights(analysis_result)

        # --- Outcome tracking
        team_id = match_data['match'].get('team_id')
        if team_id:
            # Build current metrics for comparison
            current_metrics = insights.get('metrics', {})
            try:
                check_and_record_outcomes(str(team_id), match_id, current_metrics)
            except Exception as e:
                print(f"Outcome tracking failed: {e}")

            # Create training priorities from top weaknesses
            try:
                _create_training_priorities(
                    str(team_id), match_id, insights.get('weaknesses', []),
                    current_metrics
                )
            except Exception as e:
                print(f"Priority creation failed: {e}")

        # Write to DB
        full_result = {**analysis_result, 'simulation_summary': simulation_summary}
        full_insights = {**insights, 'simulation_summary': simulation_summary}

        db.upsert_match_analysis(
            match_id, 'ready',
            result=full_result,
            insights=full_insights,
            n_rallies=n_rallies,
        )

    except Exception as e:
        print(f"Analysis failed for {match_id}: {e}")
        traceback.print_exc()
        db.upsert_match_analysis(
            match_id, 'error',
            error_message=str(e),
        )


def _create_training_priorities(team_id: str, match_id: str, weaknesses: list, metrics: dict):
    """Create training priorities from top weaknesses."""
    for weakness in weaknesses[:5]:
        metric = weakness.get('metric', '')
        if not metric:
            continue

        current = weakness.get('current_value', 0)
        target = weakness.get('target_value', 0)
        direction = weakness.get('direction', 'up')

        try:
            db.upsert_training_priority(
                team_id=team_id,
                source_match_id=match_id,
                insight_type='improve',
                priority_class=weakness.get('category', 'weakness'),
                metric=metric,
                baseline_value=current,
                target_value=float(target),
                direction=direction,
                label=weakness.get('title', metric),
            )
        except Exception:
            pass
