import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
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
  Search,
  X,
  Shield,
  User,
  Crown
} from 'lucide-react';

export function TeamsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const projectIdNum = Number(projectId);

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [selectedTeam, setSelectedTeam] = useState<{
    id: number;
    name: string;
  } | null>(null);
  const [isAddMemberDialogOpen, setIsAddMemberDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<{
    id: number;
    email: string;
    name: string;
    avatarUrl: string | null;
  } | null>(null);
  const [selectedRole, setSelectedRole] = useState<'admin' | 'qa' | 'manual_tester' | 'viewer'>('viewer');

  const { data: project, isLoading: isLoadingProject } = trpc.projects.get.useQuery(
    { id: projectIdNum },
    { enabled: !!projectId }
  );

  const { data: teams, isLoading: isLoadingTeams } = trpc.teams.list.useQuery(
    { projectId: projectIdNum },
    { enabled: !!projectId }
  );

  const { data: searchResults } = trpc.users.search.useQuery(
    { query: searchQuery, limit: 10 },
    { enabled: searchQuery.length > 2 && isAddMemberDialogOpen }
  );

  const utils = trpc.useContext();

  const createTeam = trpc.teams.create.useMutation({
    onSuccess: () => {
      utils.teams.list.invalidate({ projectId: projectIdNum });
      setIsCreateDialogOpen(false);
      setNewTeamName('');
    },
  });

  const addMember = trpc.teams.addMember.useMutation({
    onSuccess: () => {
      utils.teams.list.invalidate({ projectId: projectIdNum });
      setIsAddMemberDialogOpen(false);
      setSelectedTeam(null);
      setSelectedUser(null);
      setSearchQuery('');
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

  const handleAddMember = () => {
    if (selectedTeam && selectedUser) {
      addMember.mutate({
        teamId: selectedTeam.id,
        userId: selectedUser.id,
        role: selectedRole,
      });
    }
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
            <Link to="/" className="hover:text-foreground">Projects</Link>
            <span>/</span>
            <Link to={`/projects/${projectId}`} className="hover:text-foreground">{project.name}</Link>
            <span>/</span>
            <span>Teams</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Teams</h1>
          <p className="text-muted-foreground">
            Manage teams and their members for this project.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to={`/projects/${projectId}`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Link>
          </Button>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
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
        </div>
      </div>

      {/* Teams List */}
      <div className="grid gap-4 md:grid-cols-2">
        {teams?.map((team) => (
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
                      {team.members.length} member{team.members.length !== 1 ? 's' : ''}
                    </CardDescription>
                  </div>
                </div>
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
              </div>
            </CardHeader>
            <CardContent>
              {team.members.length > 0 ? (
                <div className="space-y-3">
                  {team.members.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          {member.user?.avatarUrl && (
                            <AvatarImage src={member.user.avatarUrl} alt={member.user.name} />
                          )}
                          <AvatarFallback className="text-xs bg-primary/10 text-primary">
                            {member.user?.name.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium">{member.user?.name}</p>
                          <p className="text-xs text-muted-foreground">{member.user?.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={`text-xs capitalize ${getRoleColor(member.role)}`}>
                          <span className="mr-1">{getRoleIcon(member.role)}</span>
                          {member.role.replace('_', ' ')}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 opacity-0 group-hover:opacity-100"
                          onClick={() => removeMember.mutate({ teamId: team.id, userId: member.userId })}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="mx-auto h-8 w-8 mb-2 opacity-50" />
                  <p className="text-sm">No members yet</p>
                  <p className="text-xs">Click "Add Member" to invite someone</p>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {teams?.length === 0 && (
        <div className="text-center py-12">
          <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No teams yet</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Create your first team to start organizing project members.
          </p>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create Team
          </Button>
        </div>
      )}

      {/* Add Member Dialog */}
      <Dialog open={isAddMemberDialogOpen} onOpenChange={setIsAddMemberDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add Member to {selectedTeam?.name}</DialogTitle>
            <DialogDescription>
              Search for a user by email and assign them a role.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Search */}
            <div className="space-y-2">
              <Label>Search User</Label>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by email (min 3 characters)"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setSelectedUser(null);
                  }}
                  className="pl-9"
                />
              </div>
              
              {/* Search Results */}
              {searchResults && searchResults.length > 0 && !selectedUser && (
                <div className="border rounded-lg max-h-48 overflow-y-auto">
                  {searchResults.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => setSelectedUser(user)}
                      className="w-full flex items-center gap-3 p-3 hover:bg-muted transition-colors text-left"
                    >
                      <Avatar className="h-8 w-8">
                        {user.avatarUrl && (
                          <AvatarImage src={user.avatarUrl} alt={user.name} />
                        )}
                        <AvatarFallback className="text-xs bg-primary/10 text-primary">
                          {user.name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium">{user.name}</p>
                        <p className="text-xs text-muted-foreground">{user.email}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              
              {/* Selected User */}
              {selectedUser && (
                <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                  <Avatar className="h-8 w-8">
                    {selectedUser.avatarUrl && (
                      <AvatarImage src={selectedUser.avatarUrl} alt={selectedUser.name} />
                    )}
                    <AvatarFallback className="text-xs bg-primary/10 text-primary">
                      {selectedUser.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{selectedUser.name}</p>
                    <p className="text-xs text-muted-foreground">{selectedUser.email}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setSelectedUser(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>

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
              onClick={handleAddMember}
              disabled={!selectedUser || addMember.isPending}
            >
              {addMember.isPending ? 'Adding...' : 'Add Member'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
