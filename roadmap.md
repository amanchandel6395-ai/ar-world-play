# Roadmap

- [x] Connect saved CometAPI key as the photo provider; catalog returned 200 and actual BJP upload reached CometAPI using gpt-image-2 (12 focused tests passed).
- [ ] Successful Yogi/Modi/BJP AI output: CometAPI rejected the political-image request (HTTP 400). Do not reroute provider refusals; remaining blocker is provider acceptance.
- [x] Provider refusals now return a safe, non-retryable error; Yogi/Modi users get a direct 3D Room path using the original approved image.

- [x] Homepage: removed "Try the photo booth demo" section + modal and its camera/upload/AI logic; three cards still link to /experience/$scene (yogi, modi, bjp)
- [x] Experience intro: added Upload Photo alongside Start camera; back-home and setup-incomplete checks preserved
- [x] Typecheck passed; tests run (1 pre-existing env-dependent failure, unrelated)
- [x] Photo generation: removed the 45-second cutoff and exposed safe service errors; preview upload-to-result returned HTTP 200, and four focused recovery tests passed (three older workflow tests still fail).
- [x] Backup photo service: Gemini key fallback added in photo route (7 tests pass). Waiting on owner to save GEMINI_API_KEY.
- [ ] Clarify rejected photo requests and keep uploaded photo previews visible; preserve provider refusals without rerouting.
- [x] Selected security findings: protect video job routes with the existing booth password, verify the password before admin settings are returned, and validate settings against an explicit field allowlist.
- [x] Selected security findings: restrict app configuration access to the server so anonymous changes cannot approve artwork or influence private image links.
