import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ArrowLeft,
  Plus,
  Users,
  Trash2,
  Shield,
  User,
  Crown,
} from 'lucide-react';

export function TeamsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const projectIdNum = Number(projectId);

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [selectedTeam, setSelectedTeam] = useState<{
    id: number;
    name: string;
  } | null>(null);
  const [isAddMemberDialogOpen, setIsAddMemberDialogOpen] = useState(false);
  const [invitationEmail, setInvitationEmail] = useState('');
  const [invitationError, setInvitationError] = useState('');
  const [isProjectInviteOpen, setIsProjectInviteOpen] = useState(false);
  const [projectInvitationEmail, setProjectInvitationEmail] = useState('');
  const [projectInvitationError, setProjectInvitationError] = useState('');
  const [projectInvitationRole, setProjectInvitationRole] = useState<
    'admin' | 'qa' | 'manual_tester' | 'viewer'
  >('viewer');
  const [selectedRole, setSelectedRole] = useState<
    'admin' | 'qa' | 'manual_tester' | 'viewer'
  >('viewer');

  const { data: project, isLoading: isLoadingProject } =
    trpc.projects.get.useQuery({ id: projectIdNum }, { enabled: !!projectId });

  const canManageTeams =
    project?.currentUserRole === 'owner' ||
    project?.currentUserRole === 'admin';

  const { data: teams, isLoading: isLoadingTeams } = trpc.teams.list.useQuery(
    { projectId: projectIdNum },
    { enabled: !!projectId },
  );

  const { data: projectMembers, isLoading: isLoadingProjectMembers } =
    trpc.projectMembers.list.useQuery(
      { projectId: projectIdNum },
      { enabled: !!projectId && canManageTeams },
    );

  const { data: invitations, isLoading: isLoadingInvitations } =
    trpc.invitations.listForProject.useQuery(
      { projectId: projectIdNum },
      { enabled: !!projectId && canManageTeams },
    );

  const utils = trpc.useUtils();

  const createTeam = trpc.teams.create.useMutation({
    onSuccess: () => {
      utils.teams.list.invalidate({ projectId: projectIdNum });
      setIsCreateDialogOpen(false);
      setNewTeamName('');
    },
  });

  const inviteMember = trpc.invitations.invite.useMutation({
    onSuccess: () => {
      setIsAddMemberDialogOpen(false);
      setSelectedTeam(null);
      setInvitationEmail('');
      setInvitationError('');
    },
    onError: (error) => setInvitationError(error.message),
    onSettled: () =>
      utils.invitations.listForProject.invalidate({
        projectId: projectIdNum,
      }),
  });

  const cancelInvitation = trpc.invitations.cancel.useMutation({
    onSettled: () =>
      utils.invitations.listForProject.invalidate({
        projectId: projectIdNum,
      }),
  });

  const inviteProjectMember = trpc.invitations.inviteProject.useMutation({
    onSuccess: () => {
      setIsProjectInviteOpen(false);
      setProjectInvitationEmail('');
      setProjectInvitationError('');
      setProjectInvitationRole('viewer');
    },
    onError: (error) => setProjectInvitationError(error.message),
    onSettled: () =>
      utils.invitations.listForProject.invalidate({ projectId: projectIdNum }),
  });

  const updateProjectMemberRole = trpc.projectMembers.updateRole.useMutation({
    onSuccess: () =>
      utils.projectMembers.list.invalidate({ projectId: projectIdNum }),
  });

  const removeProjectMember = trpc.projectMembers.remove.useMutation({
    onSuccess: () => {
      utils.projectMembers.list.invalidate({ projectId: projectIdNum });
      utils.projects.list.invalidate();
    },
  });

  const removeMember = trpc.teams.removeMember.useMutation({
    onSuccess: () => {
      utils.teams.list.invalidate({ projectId: projectIdNum });
    },
  });

  const handleCreateTeam = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTeamName.trim()) {
      createTeam.mutate({
        projectId: projectIdNum,
        name: newTeamName.trim(),
      });
    }
  };

  const handleAddMember = (event: React.FormEvent) => {
    event.preventDefault();
    if (selectedTeam && invitationEmail.trim()) {
      setInvitationError('');
      inviteMember.mutate({
        teamId: selectedTeam.id,
        email: invitationEmail.trim(),
        role: selectedRole,
      });
    }
  };

  const handleProjectInvite = (event: React.FormEvent) => {
    event.preventDefault();
    if (!projectInvitationEmail.trim()) return;
    setProjectInvitationError('');
    inviteProjectMember.mutate({
      projectId: projectIdNum,
      email: projectInvitationEmail.trim(),
      role: projectInvitationRole,
    });
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin':
        return <Crown className="h-3 w-3" />;
      case 'qa':
        return <Shield className="h-3 w-3" />;
      default:
        return <User className="h-3 w-3" />;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'qa':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'manual_tester':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getInvitationStatusColor = (status: string) => {
    switch (status) {
      case 'accepted':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'declined':
      case 'cancelled':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'expired':
        return 'bg-gray-100 text-gray-700 border-gray-200';
      default:
        return 'bg-amber-100 text-amber-800 border-amber-200';
    }
  };

  if (isLoadingProject || isLoadingTeams) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-8 w-64" />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold">Project not found</h2>
        <Button className="mt-4" asChild>
          <Link to="/">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Projects
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link to="/" className="hover:text-foreground">
              Projects
            </Link>
            <span>/</span>
            <Link
              to={`/projects/${projectId}`}
              className="hover:text-foreground"
            >
              {project.name}
            </Link>
            <span>/</span>
            <span>Teams</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Project access</h1>
          <p className="text-muted-foreground">
            Manage direct project members and team-based access.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to={`/projects/${projectId}`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Link>
          </Button>
          {canManageTeams && (
            <Dialog
              open={isCreateDialogOpen}
              onOpenChange={setIsCreateDialogOpen}
            >
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  New Team
                </Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={handleCreateTeam}>
                  <DialogHeader>
                    <DialogTitle>Create Team</DialogTitle>
                    <DialogDescription>
                      Create a new team to organize project members.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="name">Team Name</Label>
                      <Input
                        id="name"
                        placeholder="Enter team name"
                        value={newTeamName}
                        onChange={(e) => setNewTeamName(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={createTeam.isPending}>
                      {createTeam.isPending ? 'Creating...' : 'Create Team'}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {canManageTeams && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <div>
                <CardTitle className="text-lg">
                  Direct project members
                </CardTitle>
                <CardDescription>
                  These roles apply without requiring membership in a team.
                </CardDescription>
              </div>
              <Button size="sm" onClick={() => setIsProjectInviteOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Invite to project
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingProjectMembers ? (
              <Skeleton className="h-16 w-full" />
            ) : projectMembers && projectMembers.length > 0 ? (
              <div className="space-y-2">
                {projectMembers.map((member) => (
                  <div
                    key={member.id}
                    className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        {member.user.avatarUrl && (
                          <AvatarImage
                            src={member.user.avatarUrl}
                            alt={member.user.name}
                          />
                        )}
                        <AvatarFallback className="text-xs bg-primary/10 text-primary">
                          {member.user.name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium">
                          {member.user.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {member.user.email}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        aria-label={`Role for ${member.user.name}`}
                        className="rounded-md border border-input bg-background px-3 py-2 text-sm capitalize"
                        value={member.role}
                        onChange={(event) =>
                          updateProjectMemberRole.mutate({
                            projectId: projectIdNum,
                            userId: member.userId,
                            role: event.target.value as typeof member.role,
                          })
                        }
                        disabled={updateProjectMemberRole.isPending}
                      >
                        <option value="admin">Admin</option>
                        <option value="qa">QA Engineer</option>
                        <option value="manual_tester">Manual Tester</option>
                        <option value="viewer">Viewer</option>
                      </select>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Remove ${member.user.name}`}
                        onClick={() =>
                          removeProjectMember.mutate({
                            projectId: projectIdNum,
                            userId: member.userId,
                          })
                        }
                        disabled={removeProjectMember.isPending}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No one has direct project access yet.
              </p>
            )}

            <div className="mt-6 border-t pt-4">
              <h3 className="mb-3 text-sm font-semibold">Direct invitations</h3>
              {(invitations?.filter((invitation) => !invitation.teamId) ?? [])
                .length > 0 ? (
                <div className="space-y-2">
                  {invitations
                    ?.filter((invitation) => !invitation.teamId)
                    .map((invitation) => (
                      <div
                        key={invitation.id}
                        className="flex flex-col gap-2 rounded-md border px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between"
                      >
                        <span className="truncate">{invitation.email}</span>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="capitalize">
                            {invitation.role.replace('_', ' ')}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={`capitalize ${getInvitationStatusColor(invitation.status)}`}
                          >
                            {invitation.status}
                          </Badge>
                          {invitation.status === 'pending' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive"
                              onClick={() =>
                                cancelInvitation.mutate({ id: invitation.id })
                              }
                            >
                              Cancel
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No direct invitations have been sent.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Teams List */}
      <div className="grid gap-4">
        {teams?.map((team) => {
          const teamInvitations =
            invitations?.filter(
              (invitation) => invitation.teamId === team.id,
            ) ?? [];
          return (
            <Card key={team.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Users className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{team.name}</CardTitle>
                      <CardDescription>
                        {team.members.length} member
                        {team.members.length !== 1 ? 's' : ''}
                      </CardDescription>
                    </div>
                  </div>
                  {canManageTeams && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedTeam({ id: team.id, name: team.name });
                        setIsAddMemberDialogOpen(true);
                      }}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add Member
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {team.members.length > 0 ? (
                  <div className="space-y-3">
                    {team.members.map((member) => (
                      <div
                        key={member.id}
                        className="group flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            {member.user?.avatarUrl && (
                              <AvatarImage
                                src={member.user.avatarUrl}
                                alt={member.user.name}
                              />
                            )}
                            <AvatarFallback className="text-xs bg-primary/10 text-primary">
                              {member.user?.name.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm font-medium">
                              {member.user?.name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {member.user?.email}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className={`text-xs capitalize ${getRoleColor(member.role)}`}
                          >
                            <span className="mr-1">
                              {getRoleIcon(member.role)}
                            </span>
                            {member.role.replace('_', ' ')}
                          </Badge>
                          {canManageTeams && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                              onClick={() =>
                                removeMember.mutate({
                                  teamId: team.id,
                                  userId: member.userId,
                                })
                              }
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="mx-auto h-8 w-8 mb-2 opacity-50" />
                    <p className="text-sm">No members yet</p>
                    {canManageTeams && (
                      <p className="text-xs">
                        Click "Add Member" to invite someone
                      </p>
                    )}
                  </div>
                )}

                {canManageTeams && (
                  <div className="mt-6 border-t pt-4">
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="text-sm font-semibold">Invitations</h3>
                      <span className="text-xs text-muted-foreground">
                        {isLoadingInvitations
                          ? 'Loading…'
                          : `${teamInvitations.length} total`}
                      </span>
                    </div>
                    {isLoadingInvitations ? (
                      <div
                        className="space-y-2"
                        aria-label="Loading invitations"
                      >
                        <Skeleton className="h-9 w-full" />
                        <Skeleton className="h-12 w-full" />
                      </div>
                    ) : teamInvitations.length > 0 ? (
                      <div className="overflow-x-auto rounded-md border">
                        <div className="grid min-w-[680px] grid-cols-[minmax(220px,1fr)_150px_110px_80px] gap-3 border-b bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground">
                          <span>Name / email</span>
                          <span>Permissions</span>
                          <span>Status</span>
                          <span className="text-right">Action</span>
                        </div>
                        {teamInvitations.map((invitation) => (
                          <div
                            key={invitation.id}
                            className="grid min-w-[680px] grid-cols-[minmax(220px,1fr)_150px_110px_80px] items-center gap-3 border-b px-3 py-3 text-sm last:border-b-0"
                          >
                            <div className="min-w-0">
                              {invitation.recipientName && (
                                <p className="truncate font-medium">
                                  {invitation.recipientName}
                                </p>
                              )}
                              <p
                                className={
                                  invitation.recipientName
                                    ? 'truncate text-xs text-muted-foreground'
                                    : 'truncate font-medium'
                                }
                              >
                                {invitation.email}
                              </p>
                            </div>
                            <Badge
                              variant="outline"
                              className={`w-fit text-xs capitalize ${getRoleColor(invitation.role)}`}
                            >
                              {invitation.role.replace('_', ' ')}
                            </Badge>
                            <Badge
                              variant="outline"
                              className={`w-fit text-xs capitalize ${getInvitationStatusColor(invitation.status)}`}
                            >
                              {invitation.status}
                            </Badge>
                            <div className="text-right">
                              {invitation.status === 'pending' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-destructive hover:text-destructive"
                                  onClick={() =>
                                    cancelInvitation.mutate({
                                      id: invitation.id,
                                    })
                                  }
                                  disabled={cancelInvitation.isPending}
                                >
                                  Cancel
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        No invitations have been sent to this team.
                      </p>
                    )}
                    {cancelInvitation.error && (
                      <p className="mt-2 text-sm text-destructive">
                        {cancelInvitation.error.message}
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {teams?.length === 0 && (
        <div className="text-center py-12">
          <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No teams yet</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Create your first team to start organizing project members.
          </p>
          {canManageTeams && (
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Team
            </Button>
          )}
        </div>
      )}

      <Dialog
        open={isProjectInviteOpen}
        onOpenChange={(open) => {
          setIsProjectInviteOpen(open);
          if (!open) {
            setProjectInvitationEmail('');
            setProjectInvitationError('');
            inviteProjectMember.reset();
          }
        }}
      >
        <DialogContent className="sm:max-w-[500px]">
          <form onSubmit={handleProjectInvite}>
            <DialogHeader>
              <DialogTitle>Invite directly to {project.name}</DialogTitle>
              <DialogDescription>
                The recipient will receive project access without joining a
                team.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="project-invitation-email">Email</Label>
                <Input
                  id="project-invitation-email"
                  type="email"
                  value={projectInvitationEmail}
                  onChange={(event) =>
                    setProjectInvitationEmail(event.target.value)
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="project-invitation-role">Role</Label>
                <select
                  id="project-invitation-role"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={projectInvitationRole}
                  onChange={(event) =>
                    setProjectInvitationRole(
                      event.target.value as typeof projectInvitationRole,
                    )
                  }
                >
                  <option value="admin">Admin</option>
                  <option value="qa">QA Engineer</option>
                  <option value="manual_tester">Manual Tester</option>
                  <option value="viewer">Viewer</option>
                </select>
              </div>
              {projectInvitationError && (
                <p className="text-sm text-destructive">
                  {projectInvitationError}
                </p>
              )}
            </div>
            <DialogFooter>
              <Button
                type="submit"
                disabled={
                  !projectInvitationEmail.trim() ||
                  inviteProjectMember.isPending
                }
              >
                {inviteProjectMember.isPending
                  ? 'Sending...'
                  : 'Send invitation'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Member Dialog */}
      <Dialog
        open={isAddMemberDialogOpen}
        onOpenChange={(open) => {
          setIsAddMemberDialogOpen(open);
          if (!open) {
            setSelectedTeam(null);
            setInvitationEmail('');
            setInvitationError('');
            setSelectedRole('viewer');
            inviteMember.reset();
          }
        }}
      >
        <DialogContent className="sm:max-w-[500px]">
          <form onSubmit={handleAddMember}>
            <DialogHeader>
              <DialogTitle>Add Member to {selectedTeam?.name}</DialogTitle>
              <DialogDescription>
                Enter an email and assign a role. They can accept or decline the
                invitation.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="invitation-email">Email</Label>
                <Input
                  id="invitation-email"
                  type="email"
                  placeholder="teammate@example.com"
                  value={invitationEmail}
                  onChange={(event) => setInvitationEmail(event.target.value)}
                  required
                />
              </div>

              {invitationError && (
                <p className="text-sm text-destructive">{invitationError}</p>
              )}

              {/* Role Selection */}
              <div className="space-y-2">
                <Label>Role</Label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value as any)}
                >
                  <option value="admin">Admin</option>
                  <option value="qa">QA Engineer</option>
                  <option value="manual_tester">Manual Tester</option>
                  <option value="viewer">Viewer</option>
                </select>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="submit"
                disabled={!invitationEmail.trim() || inviteMember.isPending}
              >
                {inviteMember.isPending ? 'Sending...' : 'Send Invitation'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
