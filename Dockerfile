FROM python:3.12-slim
WORKDIR /app
RUN pip install --no-cache-dir flask==3.0.3 gunicorn==23.0.0
COPY app.py ./
COPY templates/ templates/
COPY static/ static/
ENV REPORTS_FILE=/data/reports.json
EXPOSE 8000
CMD ["gunicorn", "-w", "1", "--threads", "4", "-b", "0.0.0.0:8000", "app:app"]
