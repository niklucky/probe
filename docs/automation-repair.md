# Bounded AI automation repair

Probe can diagnose a completed failed Playwright execution and, only when the
evidence indicates a likely automation-code failure, propose a bounded repair.
Infrastructure failures, general timeouts, likely product defects, and unknown
failures stop before any provider call.

Repair is opt-in for each failed run. The request records either
`review-before-retry` or `automatic` mode together with immutable attempt,
total-token, and elapsed-time limits. Automatic sessions are advanced by the API
coordinator and therefore continue when the review dialog is closed. Each
candidate is validated, formatted, and executed by the normal isolated runner.

Every provider call creates an audit attempt containing the provider, model,
prompt version, token usage, sanitized evidence snapshot, explanation, source
diff, candidate automation version, and execution result. Equivalent changes,
invalid candidates, non-repairable diagnoses, success, and exhausted budgets
terminate the loop predictably.

Provider context contains the current automation source, the linked manual test
specification, capped and redacted logs, Playwright error text, limited
trace/page-structure text, and artifact metadata. It excludes artifact object
names and bytes, URL credentials and query values, known credential patterns,
and secret-valued fields. Screenshots and traces remain in private artifact
storage and are referenced only by non-secret metadata.

A passing candidate means only that the repaired automation completed on that
run. It does not establish that the application is correct. Candidates remain
separate generated automation versions; an authorized user must explicitly
promote one. Probe never changes a manual test-case version during repair.
