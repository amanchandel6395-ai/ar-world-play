# Roadmap

- [x] Homepage: removed "Try the photo booth demo" section + modal and its camera/upload/AI logic; three cards still link to /experience/$scene (yogi, modi, bjp)
- [x] Experience intro: added Upload Photo alongside Start camera; back-home and setup-incomplete checks preserved
- [x] Typecheck passed; tests run (1 pre-existing env-dependent failure, unrelated)
- [x] Photo generation: removed the 45-second cutoff and exposed safe service errors; preview upload-to-result returned HTTP 200, and four focused recovery tests passed (three older workflow tests still fail).
