# Test profiles

Test profiles define the browser identity and starting authentication state for
one environment. Every environment has a protected **Guest** profile. Teams can
add role-oriented profiles such as **Admin**, **Manager**, or **Regular user**.
Profiles are explicit and never inherit authentication from another profile or
environment.

## Modes and status

**Basic** is the default. Its encrypted Playwright-compatible storage state
contains cookies and origin-scoped local storage captured after interactive
sign-in. **Advanced** additionally supports direct cookies and request headers;
headers are applied only to the configured environment's exact origin and are
reevaluated after every redirect.

Profiles expose only safe metadata: name, role description, mode, status,
revision, and capture/verification timestamps. Authentication status is
`Ready`, `Needs verification`, or `Expired`. Guest is always ready and contains
no authentication material. Cookie expiration affects browser storage only and
does not extend server-side sessions or tokens.

Captured state, optional profile credentials, direct cookie values, and header
values are encrypted with AES-256-GCM. The authenticated-encryption associated
data includes both the environment and profile identity. Saved secret values
are never returned by the API.

## Generation and execution

Manual generation and automation authoring select an environment, a test
profile, and one of two starting states:

- **Use profile authentication** prepares the browser before the model sees the
  page. The model receives only the profile name and description and is told not
  to add login steps unless authentication itself is under test.
- **Start signed out** deliberately ignores saved authentication. This supports
  guest scenarios and login tests without creating a second role profile.

The test version, generated automation, browser-authoring session, and execution
job retain the profile ID, name, revision, and starting state. Disabled,
unverified, expired, unreadable, or revised authenticated profiles fail closed.
The generated Playwright source stays focused on application behavior; profile
state is injected by Probe's isolated runtime and secret values are redacted
from logs and browser transcripts.

## Migration

The migration renames existing Anonymous profiles to Guest. Existing profiles
with cookie or header bindings become Advanced and remain usable through the
compatibility runtime. Profiles without an unambiguous authentication binding
are marked Needs verification, so they cannot silently acquire or reuse an
authentication state. Existing automation revisions continue to use strict
revision matching and must be regenerated after profile changes.
