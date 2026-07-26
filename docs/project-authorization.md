# Project authorization

Project ownership is derived from `projects.created_by_id`. Other project roles
come from team membership. If a user belongs to multiple teams in the same
project, the most permissive role applies.

| Role          | Read project resources | Author products, suites, cases, environments | Execute runs and attach evidence | Manage teams and project settings | Delete project |
| ------------- | ---------------------- | -------------------------------------------- | -------------------------------- | --------------------------------- | -------------- |
| Owner         | Yes                    | Yes                                          | Yes                              | Yes                               | Yes            |
| Admin         | Yes                    | Yes                                          | Yes                              | Yes                               | No             |
| QA            | Yes                    | Yes                                          | Yes                              | No                                | No             |
| Manual tester | Yes                    | No                                           | Yes                              | No                                | No             |
| Viewer        | Yes                    | No                                           | No                               | No                                | No             |

The authorization service resolves every resource through its stored parent
chain to a project. Client-provided parent IDs are never treated as proof of
access. Denials use the same not-found response as missing resources to avoid
revealing whether another project's resource exists.

Both HTTP handlers and future background jobs must call the domain services
rather than repositories directly. The services are the shared policy boundary.
