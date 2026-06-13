"""FastAPI analysis microservice for VB Scout."""
import os
from fastapi import FastAPI, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware

import db
import orchestrator

app = FastAPI(title="VB Scout Analysis Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    """Health check endpoint."""
    try:
        conn = db.get_connection()
        conn.close()
        db_status = "connected"
    except Exception as e:
        db_status = f"error: {e}"
    return {"status": "ok", "db": db_status}


@app.post("/analyse/{match_id}")
async def trigger_analysis(match_id: str, background_tasks: BackgroundTasks, body: dict | None = None):
    """Queue background analysis for a completed match.

    Accepts an optional JSON body ``{ "locale": "en" | "de" }`` controlling the
    language of the generated insight cards. Defaults to English.
    """
    locale = (body or {}).get("locale", "en")
    if locale not in ("en", "de"):
        locale = "en"

    # Create/update analysis row as pending
    db.upsert_match_analysis(match_id, 'running')

    # Run in background
    background_tasks.add_task(orchestrator.run_analysis, match_id, locale)

    return {
        "status": "queued",
        "match_id": match_id,
        "locale": locale,
        "estimated_seconds": 30,
    }


@app.get("/insights/{match_id}")
async def get_insights(match_id: str):
    """Get analysis status and insights for a match."""
    try:
        conn = db.get_connection()
        import psycopg2.extras
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SELECT * FROM match_analysis WHERE match_id = %s", (match_id,))
            row = cur.fetchone()
        conn.close()

        if not row:
            return {"status": "pending", "match_id": match_id}

        import json
        return {
            "status": row["status"],
            "match_id": match_id,
            "n_rallies": row["n_rallies"],
            "insights": json.loads(row["insights"]) if isinstance(row["insights"], str) else row["insights"],
            "result": None,  # Don't return full result — too large
            "error_message": row["error_message"],
            "updated_at": row["updated_at"].isoformat() if row["updated_at"] else None,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/training/{team_id}")
async def get_training_priorities(team_id: str):
    """Get active training priorities for a team."""
    try:
        priorities = db.get_active_priorities(team_id)
        active = [p for p in priorities if p.get('status') not in ('resolved', 'dismissed')]
        resolved = [p for p in priorities if p.get('status') == 'resolved']

        last_match = None
        if priorities:
            last_match = str(priorities[0].get('source_match_id'))

        return {
            "active_priorities": active,
            "resolved_priorities": resolved,
            "last_updated_match_id": last_match,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.patch("/training/priority/{priority_id}")
async def update_priority(priority_id: str, body: dict):
    """Update priority note and/or status."""
    try:
        if 'status' in body:
            db.update_priority_status(priority_id, body['status'])

        if 'note' in body:
            conn = db.get_connection()
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE training_priorities SET note = %s, updated_at = NOW() WHERE id = %s",
                    (body['note'], priority_id)
                )
            conn.commit()
            conn.close()

        return {"message": "Priority updated"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
