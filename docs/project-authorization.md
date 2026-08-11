# Project authorization

Project ownership is derived from `projects.created_by_id`. Other project roles
come from direct `project_members` grants and team membership. When a user has
more than one grant, including both a direct and a team-derived role, the most
permissive role applies deterministically: admin, QA, manual tester, then viewer.
Direct membership can be removed without affecting team-derived access (and the
reverse is also true). The project owner is not represented by a mutable member
row and cannot be removed or demoted.

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
