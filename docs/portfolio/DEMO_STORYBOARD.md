# 75–90 second portfolio walkthrough

Record a **real interaction in the local app**. Use synthetic data only. This is a storyboard, **not evidence that a video has already been recorded**.

| Time | Screen / action | What to point out |
|---|---|---|
| 0–10 s | Open the dashboard, show published canvas | “Full-stack workflow orchestration, built with Next.js, Fastify, PostgreSQL and a separate worker.” |
| 10–25 s | Select a *high-priority synthetic lead* and start | A real execution record is created. Input is a **deterministic fixture**, not an LLM call. |
| 25–40 s | Show **waiting for approval**, inspect node + timeline | The proposed CRM effect is blocked until a human makes an authorized decision. |
| 40–55 s | Approve once, show completed state | Worker resumes and writes an idempotent record in PostgreSQL. |
| 55–70 s | Open CRM and follow link back to the run | Demonstrate confirmed record and traceability to a specific execution. |
| 70–85 s | Open History, reload while selected | The run and its events remain because they are **persisted**, not just client-side animations. |
| 85–90 s | Optional title card: repo + limitations | “Local, synthetic, read-only published graph. The product direction is future work.” |

### Suggested English voiceover

> I built Automation Control Room to explore reliable business automation from end to end. The interface is React and Next.js, with a Fastify API and a background worker using PostgreSQL and pg-boss. Here a synthetic lead is classified, but the CRM action is blocked pending a human decision. After approval, the worker completes an idempotent write. You can inspect every event, retry count and saved run—even after reloading. It runs locally in Docker, with E2E tests. This is an open-source engineering demo, not a hosted SaaS or a live AI agent.

### Production checklist for the actual recording

- Use a **new demo guest session**. Show no real customer data, personal notifications, credentials, browsers with identifying tabs or private repositories.
- Ensure docker services are healthy and the browser uses the same guest session throughout.
- Prefer **1440×900 or 1920×1080**, browser zoom 100%, with the published graph fitted visibly. Use the **Enfocar** control if a node must be inspected.
- Start recording **before** the run. Capture the waiting approval, actual approval and CRM confirmation as one continuous evidence sequence; avoid editing that creates the appearance of instant effects.
- For captions, say **“deterministic fixture”**, **“synthetic CRM”**, **“persisted events”** and **“human approval”**. Do not say “ChatGPT agent,” “live LLM,” “Make competitor,” “production-ready” or “real customer automation.”
- Save the reviewed recording outside the repo first. Publish or link it only after checking privacy, subtitle readability and version consistency.
- Screenshots from the Chromium CI artifact are real but temporary; do not point a LinkedIn post at an artifact with seven-day retention unless the selected images have been preserved elsewhere.
