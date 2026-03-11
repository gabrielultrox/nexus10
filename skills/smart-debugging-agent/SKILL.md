---
name: smart-debugging-agent
description: Detect errors, performance issues, and structural problems in code by tracing symptoms back to likely root causes. Use when a user reports bugs, crashes, failing behavior, stack traces, regressions, slowdowns, or unexpected results and needs diagnosis, a fix, corrected code, and a brief explanation.
---

# Smart Debugging Agent

Start from the observable failure and work toward the root cause.

Inspect the code, error message, reproduction details, logs, and recent changes. If information is missing, infer the most likely failure path and state the assumptions clearly.

## Diagnose the Problem

Analyze before proposing changes:

1. Identify the visible symptom.
2. Trace the execution path that can produce it.
3. Separate root causes from secondary effects.
4. Check for structural or performance issues that may be contributing.

## Propose the Fix

Recommend the smallest fix that addresses the real cause:

- Explain why the issue happens.
- Suggest the change that resolves it.
- Avoid superficial workarounds unless they are explicitly the only safe short-term option.
- Preserve existing architecture and behavior unless the bug reveals a deeper design flaw.

## Produce Corrected Code

When generating code:

- Update only the parts needed to resolve the issue.
- Keep the fix maintainable and consistent with the surrounding codebase.
- Include guardrails, validation, or tests when they materially reduce recurrence.

## Output Format

Use this structure unless the user asks for something else:

### Problem Analysis

Summarize the symptom, likely root cause, and why it occurs.

### Fix

Describe the corrective change and its effect.

### Corrected Code

Provide the corrected implementation or patch.

## Quality Bar

- Prioritize root-cause analysis over symptom treatment.
- Call out uncertainty when multiple causes are plausible.
- Mention performance or structural risks when they materially affect the bug.
- Keep the explanation brief and practical.
