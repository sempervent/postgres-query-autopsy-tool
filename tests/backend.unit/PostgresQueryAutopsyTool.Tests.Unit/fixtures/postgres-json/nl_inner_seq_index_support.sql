-- Illustrative nested loop: outer modest cardinality, inner seq scan repeated many times (index-support angle).
SELECT * FROM drivers d JOIN shipments s ON s.driver_id = d.id;
