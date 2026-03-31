## Scan rewrite: Seq Scan → Bitmap Heap Scan

**Intent**
- Stress scan-family mapping when the access path changes shape.
- Ensure the engine maps the relation correctly and keeps confidence honest.
- Validate deltas for reads/time and findings diff (seq scan concern resolves / indexing access appears).

