# Environment network-access policy

Environment records store an HTTP(S) base URL for authoring. Saving a URL does
not make a server-side request, and credentials must never be embedded in the URL
or stored in test-case text.

Future browser automation and other server-side clients must call
`assertEnvironmentNetworkTargetAllowed` immediately before every request and
redirect. They must also resolve DNS at request time and reject the request when
any resolved address is loopback, link-local, private, multicast, or a cloud
metadata address. The connection must be pinned to an approved resolved address
to prevent DNS rebinding. Redirects require the same validation and a small hop
limit. Outbound traffic should run through an allow-listing proxy in production.

Local and private base URLs may be saved for manual authoring, but the network
policy intentionally prevents future server-side execution against them unless a
separately reviewed deployment policy explicitly allows the destination.
