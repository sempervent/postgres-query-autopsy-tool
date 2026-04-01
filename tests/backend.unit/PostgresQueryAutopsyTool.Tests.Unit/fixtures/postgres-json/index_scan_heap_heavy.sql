-- Illustrative: index scan that still reports large heap fetches (non-covering / wide rows).
-- JSON is tuned so shared reads and heap fetches cross index-inefficiency heuristics.

SELECT * FROM events WHERE ts > '2020-01-01';
