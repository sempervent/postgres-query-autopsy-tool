-- Illustrative: bitmap heap with recheck condition and measurable recheck-row removal.
SELECT * FROM wide_table WHERE value > 100 AND region = 'us';
