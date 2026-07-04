"""
intelligence.py — the predictive core of the HR agent.

Small, transparent, *tunable* quantitative models. Deliberately NOT heavyweight
ML: the HR slice here is a handful of employees, so a trained model would be
theatre — a well-chosen linear projection and a logistic risk score are honest,
explainable, and correct on the edge cases. Every model is a pure function over
plain Odoo-shaped records, so each is trivially unit-tested and can be swapped
for a learned model later without touching a single caller.

The point of this module is the design: the LLM agent shouldn't do arithmetic it
is bad at. It calls these tools, gets a structured signal + a plain-English
narrative, and reasons over *that*. That's "AI at the core" done the way it
actually works in production — deterministic predictors feeding a language model.

Calibration knobs live at the top. Real HR data drifts (start times, allotments,
what "understaffed" means for a given team), so these are dials, not constants.
Tune them, don't rewrite the model.

Run `python intelligence.py` for a self-check.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta
from math import exp
from statistics import mean, pstdev
from typing import Any

__all__ = [
    "forecast_leave_balance",
    "attendance_risk",
    "team_capacity_forecast",
    "approval_risk",
    "simulate_leave_impact",
]

# --- Calibration knobs -------------------------------------------------------
ANNUAL_LEAVE_DAYS = 20        # fallback allotment when it can't be derived
NOMINAL_START_MIN = 9 * 60    # expected check-in, minutes past midnight (09:00)
GRACE_MINUTES = 15            # lateness grace before it counts against you
UNDER_UTILISE_RATIO = 0.35    # taken < 35% of pace-expected -> under-using leave
OVER_PACE_MARGIN = 1.05       # projected use > 105% of allotment -> over pace
COVERAGE_FLOOR = 0.70         # min fraction of a team that must stay present
BURNOUT_SCORE = 60            # attendance-risk score at/above which rest is advised


# --- small numeric helpers ---------------------------------------------------

def _is_leap(year: int) -> bool:
    return year % 4 == 0 and (year % 100 != 0 or year % 400 == 0)


def _logistic(x: float, midpoint: float, steepness: float) -> float:
    """Squash an unbounded score into (0, 1)."""
    return 1.0 / (1.0 + exp(-steepness * (x - midpoint)))


def _ols_slope(ys: list[float]) -> float:
    """Least-squares slope of ys against their index (units: y per step)."""
    n = len(ys)
    if n < 2:
        return 0.0
    xs = list(range(n))
    mx, my = mean(xs), mean(ys)
    den = sum((x - mx) ** 2 for x in xs)
    if den == 0:
        return 0.0
    return sum((x - mx) * (y - my) for x, y in zip(xs, ys)) / den


def _parse_date(value: Any) -> date | None:
    """Accept 'YYYY-MM-DD' or 'YYYY-MM-DD HH:MM[:SS]' (real Odoo uses the latter)."""
    if not value:
        return None
    try:
        return date.fromisoformat(str(value)[:10])
    except ValueError:
        return None


# --- 1. Leave-balance forecast (burn-rate projection) ------------------------

def forecast_leave_balance(
    leaves_taken: float,
    leave_balance: float,
    today: date | None = None,
) -> dict[str, Any]:
    """Project a year-end leave balance from the year-to-date burn rate.

    Linear extrapolation of the current daily usage to the end of the calendar
    year, plus an exhaustion-date estimate if the balance would hit zero first.
    """
    today = today or date.today()
    allotment = leaves_taken + leave_balance or ANNUAL_LEAVE_DAYS
    year_days = 366 if _is_leap(today.year) else 365
    doy = today.timetuple().tm_yday
    frac = doy / year_days

    daily = leaves_taken / doy if doy else 0.0
    projected_used = round(daily * year_days, 1)
    projected_remaining = round(allotment - projected_used, 1)

    exhaustion = None
    if daily > 0 and leave_balance > 0:
        est = today + timedelta(days=round(leave_balance / daily))
        if est.year == today.year:
            exhaustion = est.isoformat()

    expected_by_now = allotment * frac
    pace = round(leaves_taken / expected_by_now, 2) if expected_by_now else 1.0

    if projected_used > allotment * OVER_PACE_MARGIN:
        status = "over_pace"
    elif leaves_taken < expected_by_now * UNDER_UTILISE_RATIO:
        status = "under_utilising"
    else:
        status = "on_track"

    narratives = {
        "over_pace": (
            f"On the current pace this employee will use ~{projected_used} of "
            f"{allotment} days and run out"
            + (f" around {exhaustion}." if exhaustion else " before year-end.")
        ),
        "under_utilising": (
            f"Using leave slowly ({pace}× the even-burn pace) — projected to end "
            f"the year with ~{projected_remaining} days unused. Watch for burnout."
        ),
        "on_track": (
            f"On track: ~{projected_remaining} of {allotment} days projected to "
            f"remain at year-end ({pace}× even-burn pace)."
        ),
    }

    return {
        "allotment_days": allotment,
        "taken_ytd": leaves_taken,
        "remaining_now": leave_balance,
        "projected_used_eoy": projected_used,
        "projected_remaining_eoy": projected_remaining,
        "pace_multiplier": pace,
        "exhaustion_date": exhaustion,
        "status": status,
        "narrative": narratives[status],
    }


# --- 2. Attendance risk (punctuality / burnout signal) -----------------------

def attendance_risk(checkins: list[str]) -> dict[str, Any]:
    """Score punctuality risk from a chronological list of check-in timestamps.

    Combines average lateness, its trend (getting later over time), and
    variability, then squashes to 0–100. This is a heuristic *signal*, not a
    diagnosis — it flags "look here", it doesn't judge.
    """
    if not checkins:
        return {"score": None, "label": "unknown", "samples": 0,
                "narrative": "No attendance records available."}

    times_min: list[float] = []
    lateness: list[float] = []
    for c in checkins:
        t = datetime.strptime(str(c)[:16], "%Y-%m-%d %H:%M")
        m = t.hour * 60 + t.minute
        times_min.append(m)
        lateness.append(max(0.0, m - NOMINAL_START_MIN - GRACE_MINUTES))

    avg_late = mean(lateness)
    trend = _ols_slope(lateness)               # minutes later per day
    variability = pstdev(times_min) if len(times_min) > 1 else 0.0

    raw = 0.5 * avg_late + 6.0 * max(0.0, trend) + 0.25 * variability
    score = round(_logistic(raw, midpoint=25, steepness=0.08) * 100, 1)
    label = ("low" if score < 25 else "moderate" if score < 50
             else "elevated" if score < 75 else "high")

    if trend > 1:
        trend_note = "and slipping later over time"
    elif trend < -1:
        trend_note = "but improving"
    else:
        trend_note = "and steady"
    narrative = (
        f"Punctuality risk {label} ({score}/100): averages "
        f"{round(avg_late)} min late past grace {trend_note}."
    )

    return {"score": score, "label": label, "samples": len(checkins),
            "avg_lateness_min": round(avg_late, 1),
            "trend_min_per_day": round(trend, 2), "narrative": narrative}


# --- 3. Team capacity forecast (the timeline) --------------------------------

def team_capacity_forecast(
    leaves: list[dict[str, Any]],
    headcount: int,
    today: date | None = None,
    weeks: int = 8,
) -> dict[str, Any]:
    """Week-by-week staffing outlook: who's off, projected coverage, risk flag.

    Confirmed ('validate') leave counts against coverage firmly; pending
    ('confirm') leave is shown separately and only downgrades a week to 'watch'.
    """
    today = today or date.today()
    monday = today - timedelta(days=today.weekday())
    weeks_out: list[dict[str, Any]] = []
    worst: dict[str, Any] | None = None

    for w in range(weeks):
        ws = monday + timedelta(weeks=w)
        we = ws + timedelta(days=6)
        confirmed: set[Any] = set()
        pending: set[Any] = set()
        for lv in leaves:
            df, dt = _parse_date(lv.get("date_from")), _parse_date(lv.get("date_to"))
            if not df or not dt or df > we or dt < ws:
                continue
            emp = lv.get("employee_id")
            if lv.get("state") == "validate":
                confirmed.add(emp)
            elif lv.get("state") in ("confirm", "validate1"):
                pending.add(emp)
        pending -= confirmed

        conf_cov = (headcount - len(confirmed)) / headcount if headcount else 1.0
        proj_cov = (headcount - len(confirmed) - len(pending)) / headcount if headcount else 1.0
        risk = ("understaffed" if conf_cov < COVERAGE_FLOOR
                else "watch" if proj_cov < COVERAGE_FLOOR else "ok")

        wk = {
            "week_start": ws.isoformat(), "label": ws.strftime("%b %d"),
            "on_leave_confirmed": len(confirmed), "on_leave_pending": len(pending),
            "headcount": headcount, "coverage_pct": round(conf_cov * 100),
            "projected_coverage_pct": round(proj_cov * 100), "risk": risk,
        }
        weeks_out.append(wk)
        if risk == "understaffed" and (worst is None or conf_cov < worst["coverage_pct"] / 100):
            worst = wk

    if worst:
        narrative = (
            f"⚠ Coverage drops to {worst['coverage_pct']}% in the week of "
            f"{worst['label']} — below the {round(COVERAGE_FLOOR*100)}% floor. "
            f"Stagger approvals around it."
        )
    elif any(w["risk"] == "watch" for w in weeks_out):
        narrative = "Coverage holds on confirmed leave, but pending requests could tip a week under the floor — approve with care."
    else:
        narrative = f"Coverage stays above the {round(COVERAGE_FLOOR*100)}% floor across the next {weeks} weeks."

    return {"weeks": weeks_out, "headcount": headcount,
            "worst_week": worst, "narrative": narrative}


# --- 4. Approval risk (composite, explainable recommendation) ----------------

def approval_risk(
    days_requested: float | None,
    requester_remaining: float | None,
    team_overlap: int,
    attendance_score: float | None,
) -> dict[str, Any]:
    """Score the risk of *granting* a leave request and recommend an action.

    Explainable by construction: every point of risk comes with a stated reason.
    Higher score = more reason to scrutinise before approving.
    """
    risk = 0.0
    reasons: list[str] = []

    if requester_remaining is not None and days_requested is not None:
        if requester_remaining < days_requested:
            risk += 35
            reasons.append(
                f"Insufficient balance: {requester_remaining} day(s) left for a "
                f"{days_requested}-day request.")
        elif requester_remaining - days_requested < 3:
            risk += 12
            reasons.append("Leaves a thin balance (<3 days) afterwards.")

    if team_overlap:
        risk += min(40, 14 * team_overlap)
        reasons.append(
            f"{team_overlap} teammate(s) already off in the same window — "
            f"coverage pressure.")

    if attendance_score is not None and attendance_score >= BURNOUT_SCORE:
        risk = max(0.0, risk - 15)
        reasons.append(
            f"Elevated burnout signal (attendance risk {attendance_score}) — "
            f"time off is advisable.")

    if days_requested and days_requested >= 8:
        risk += 10
        reasons.append(f"Extended absence ({days_requested} days) warrants a closer look.")

    risk = round(min(100.0, risk), 1)
    recommendation = ("APPROVE" if risk < 30 else "REVIEW" if risk < 60 else "CAUTION")
    # Confidence: how far the score sits from the nearest decision boundary.
    confidence = round(0.55 + 0.45 * min(1.0, min(abs(risk - 30), abs(risk - 60)) / 30), 2)
    if not reasons:
        reasons.append("No balance, coverage, or burnout flags detected.")

    return {"risk_score": risk, "recommendation": recommendation,
            "confidence": confidence, "reasons": reasons,
            "narrative": f"{recommendation} — risk {risk}/100 (confidence {confidence}). "
                         + " ".join(reasons)}


# --- 5. Counterfactual approval simulation ("Impact Preview") ----------------

def simulate_leave_impact(
    leaves: list[dict[str, Any]],
    headcount: int,
    target_id: Any,
    today: date | None = None,
    weeks: int = 8,
) -> dict[str, Any]:
    """Recompute the capacity timeline *as if the target leave were approved*,
    and diff it against the current outlook.

    This is decision-support most tools don't offer: instead of approving and
    finding out, you see the second-order staffing consequence first — which
    weeks drop, and whether any cross the understaffing floor.
    """
    today = today or date.today()
    base = team_capacity_forecast(leaves, headcount, today, weeks)
    after_leaves = [({**l, "state": "validate"} if l.get("id") == target_id else l) for l in leaves]
    after = team_capacity_forecast(after_leaves, headcount, today, weeks)

    weeks_diff: list[dict[str, Any]] = []
    newly_understaffed: list[str] = []
    for b, a in zip(base["weeks"], after["weeks"]):
        weeks_diff.append({
            "label": b["label"], "before": b["coverage_pct"],
            "after": a["coverage_pct"], "delta": a["coverage_pct"] - b["coverage_pct"],
            "risk_after": a["risk"],
        })
        if b["risk"] != "understaffed" and a["risk"] == "understaffed":
            newly_understaffed.append(b["label"])

    if newly_understaffed:
        verdict = ("Approving this tips " + ", ".join(newly_understaffed)
                   + " below the coverage floor — stagger it or line up cover.")
    elif after.get("worst_week"):
        w = after["worst_week"]
        verdict = (f"Coverage dips to {w['coverage_pct']}% in {w['label']}, but that week "
                   f"was already tight — approving adds no *new* risk.")
    else:
        verdict = "No new coverage risk — safe to approve on staffing grounds."

    return {"weeks": weeks_diff, "newly_understaffed": newly_understaffed,
            "safe": not newly_understaffed, "verdict": verdict}


# --- self-check --------------------------------------------------------------

def _demo() -> None:
    ref = date(2026, 7, 4)

    # Ananya: 6 taken / 14 left — comfortably on track, won't run out.
    f = forecast_leave_balance(6, 14, ref)
    assert f["status"] == "on_track", f
    assert f["exhaustion_date"] is None, f
    assert 6 < f["projected_remaining_eoy"] < 10, f

    # Rohit: 11 taken / 9 left — burning too fast, will exhaust this year.
    f = forecast_leave_balance(11, 9, ref)
    assert f["status"] == "over_pace", f
    assert f["exhaustion_date"] is not None, f

    # Attendance: punctual employee scores low, chronically-late scores higher.
    punctual = attendance_risk(["2026-07-01 09:00", "2026-07-02 09:02", "2026-07-03 08:58"])
    late = attendance_risk(["2026-07-01 10:15", "2026-07-02 10:05", "2026-07-03 09:55"])
    assert punctual["label"] == "low", punctual
    assert late["score"] > punctual["score"], (late, punctual)
    assert attendance_risk([])["score"] is None

    # Capacity: a 2-person team with one pending leave -> that week goes 'watch'.
    leaves = [
        {"employee_id": 1, "date_from": "2026-07-14", "date_to": "2026-07-18", "state": "confirm"},
        {"employee_id": 2, "date_from": "2026-07-06", "date_to": "2026-07-07", "state": "confirm"},
    ]
    cap = team_capacity_forecast(leaves, headcount=2, today=ref, weeks=4)
    assert len(cap["weeks"]) == 4
    assert any(w["risk"] in ("watch", "understaffed") for w in cap["weeks"]), cap

    # Approval risk: clean request approves; over-drawn + crowded gets flagged.
    assert approval_risk(5, 14, 1, 54.0)["recommendation"] == "APPROVE"
    high = approval_risk(5, 1, 2, 30.0)
    assert high["recommendation"] == "CAUTION", high
    assert any("Insufficient balance" in r for r in high["reasons"]), high

    # Impact preview: in a 2-person team, approving the only pending leave takes
    # its week from healthy (100%) to understaffed (50%) — a NEW risk.
    sim_leaves = [
        {"id": 1, "employee_id": 1, "date_from": "2026-07-14", "date_to": "2026-07-18", "state": "confirm"},
    ]
    sim = simulate_leave_impact(sim_leaves, headcount=2, target_id=1, today=ref, weeks=4)
    assert sim["newly_understaffed"], sim
    assert sim["safe"] is False, sim
    assert len(sim["weeks"]) == 4
    assert sim["weeks"][2]["before"] == 100 and sim["weeks"][2]["after"] == 50, sim

    print("intelligence.py — all self-checks passed")


if __name__ == "__main__":
    _demo()
