import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { LogOut, Settings, Mail, Check, X } from 'lucide-react';
import { trpc } from '@/lib/trpc';

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const utils = trpc.useUtils();
  const { data: pendingInvitations } = trpc.invitations.listPending.useQuery();
  const acceptInvitation = trpc.invitations.accept.useMutation({
    onSuccess: () => {
      utils.projects.list.invalidate();
    },
    onSettled: () => utils.invitations.listPending.invalidate(),
  });
  const declineInvitation = trpc.invitations.decline.useMutation({
    onSettled: () => utils.invitations.listPending.invalidate(),
  });
  const invitationActionError =
    acceptInvitation.error?.message ?? declineInvitation.error?.message;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-6">
            <Link to="/" className="flex items-center gap-2 font-bold text-xl">
              <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-sm">
                  P
                </span>
              </div>
              <span>Probe</span>
            </Link>

            {location.pathname !== '/' && (
              <nav className="hidden md:flex items-center gap-4 text-sm font-medium">
                <Link
                  to="/"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  Projects
                </Link>
              </nav>
            )}
          </div>

          <div className="flex items-center gap-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="relative h-8 w-8 rounded-full"
                >
                  <Avatar className="h-8 w-8">
                    {user?.avatarUrl && (
                      <AvatarImage src={user.avatarUrl} alt={user.name} />
                    )}
                    <AvatarFallback className="bg-primary/10 text-primary text-sm">
                      {user?.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      {user?.avatarUrl && (
                        <AvatarImage src={user.avatarUrl} alt={user.name} />
                      )}
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {user?.name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">
                        {user?.name}
                      </p>
                      <p className="text-xs leading-none text-muted-foreground">
                        {user?.email}
                      </p>
                      <p className="text-xs leading-none text-muted-foreground capitalize">
                        {user?.role.replace('_', ' ')}
                      </p>
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/profile')}>
                  <Settings className="mr-2 h-4 w-4" />
                  Profile Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {pendingInvitations && pendingInvitations.length > 0 && (
        <div className="border-b border-primary/20 bg-primary/5">
          <div className="container mx-auto space-y-2 px-4 py-3">
            {invitationActionError && (
              <p className="text-sm text-destructive">
                {invitationActionError}
              </p>
            )}
            {pendingInvitations.map((invitation) => (
              <div
                key={invitation.id}
                className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-primary" />
                  <span>
                    <strong>{invitation.invitedByName}</strong> (
                    {invitation.invitedByEmail}) invited you to{' '}
                    <strong>{invitation.teamName}</strong> in{' '}
                    <strong>{invitation.projectName}</strong> as{' '}
                    {invitation.role.replace('_', ' ')}.
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() =>
                      acceptInvitation.mutate({ id: invitation.id })
                    }
                    disabled={
                      acceptInvitation.isPending || declineInvitation.isPending
                    }
                  >
                    <Check className="mr-1 h-4 w-4" />
                    Accept
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      declineInvitation.mutate({ id: invitation.id })
                    }
                    disabled={
                      acceptInvitation.isPending || declineInvitation.isPending
                    }
                  >
                    <X className="mr-1 h-4 w-4" />
                    Decline
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="container mx-auto py-6 px-4">
        <Outlet />
      </main>
    </div>
  );
}
