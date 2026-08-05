# Environment profiles

Environment profiles define explicit browser authentication states for an
environment. Every environment has a protected **Anonymous** profile, and users
can add profiles such as **Authenticated User** or **Administrator**.

Profiles do not inherit from the environment or from each other. A profile
contains only references to selected environment variables, cookie templates,
and header templates. Plaintext values are never copied into profile records.
The Anonymous profile cannot be renamed, deleted, or assigned cookies or
headers, so an anonymous run never inherits browser authentication state. It
may expose selected variables to test code, which allows a login-flow test to
enter credentials while still starting from an unauthenticated browser.

Automation generation and execution each require an explicit enabled profile.
Automation and execution records store the selected profile id, name, and
revision. Editing a selected variable, cookie, header, or the profile itself
increments that revision. Generated automation is then shown as stale, and a
queued execution fails safely if its recorded revision no longer matches.
Disabling or removing a profile never falls back to another, potentially more
privileged profile.

Existing environments receive an Anonymous profile during migration. Existing
automation records remain unprofiled and must be regenerated; existing
execution history remains readable without inventing an authentication state.
