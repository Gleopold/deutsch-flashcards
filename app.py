import json
import os
import threading
from datetime import datetime, timezone

from flask import Flask, jsonify, render_template, request

app = Flask(__name__)

REPORTS_FILE = os.environ.get(
    "REPORTS_FILE", os.path.join(os.path.dirname(__file__), "data", "reports.json")
)
MAX_REPORTS = 2000
_lock = threading.Lock()


def _load():
    try:
        with open(REPORTS_FILE) as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return []


def _save(reports):
    os.makedirs(os.path.dirname(REPORTS_FILE), exist_ok=True)
    tmp = REPORTS_FILE + ".tmp"
    with open(tmp, "w") as f:
        json.dump(reports, f, ensure_ascii=False, indent=1)
    os.replace(tmp, REPORTS_FILE)


def _field(data, name, limit=200):
    value = data.get(name)
    return value.strip()[:limit] if isinstance(value, str) else ""


@app.route("/")
def index():
    return render_template("index.html")


@app.get("/api/reports")
def list_reports():
    with _lock:
        return jsonify(_load())


@app.post("/api/reports")
def add_report():
    data = request.get_json(silent=True) or {}
    key = _field(data, "key")
    if not key:
        return jsonify(error="key required"), 400
    with _lock:
        reports = _load()
        # Each word appears in the list at most once.
        if not any(r["key"] == key for r in reports):
            if len(reports) >= MAX_REPORTS:
                return jsonify(error="report list is full"), 507
            reports.append({
                "key": key,
                "de": _field(data, "de"),
                "en": _field(data, "en"),
                "cat": _field(data, "cat", 50),
                "img": _field(data, "img"),
                "reported_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            })
            _save(reports)
        return jsonify(reports)


@app.delete("/api/reports")
def remove_report():
    key = request.args.get("key", "")
    with _lock:
        reports = [r for r in _load() if r["key"] != key] if key else []
        _save(reports)
        return jsonify(reports)


if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)
