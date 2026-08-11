import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";

export function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const invitationToken = searchParams.get("invitation") ?? undefined;
  const { login } = useAuth();

  const invitationQuery = trpc.invitations.preview.useQuery(
    { token: invitationToken ?? "" },
    { enabled: !!invitationToken, retry: false },
  );

  useEffect(() => {
    if (invitationQuery.data) {
      setEmail(invitationQuery.data.email);
    }
  }, [invitationQuery.data]);

  const registerMutation = trpc.auth.register.useMutation({
    onSuccess: (data) => {
      // Auto-login after successful registration
      login(data.token, data.user);
      navigate("/");
    },
    onError: (error) => {
      setError(error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    registerMutation.mutate({
      name,
      email,
      password,
      invitationToken,
    });
  };

  const clearInvitation = () => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("invitation");
    setSearchParams(nextParams, { replace: true });
    setEmail("");
  };

  const invitationIsInvalid =
    invitationQuery.error?.data?.code === "NOT_FOUND" ||
    invitationQuery.error?.data?.code === "BAD_REQUEST";

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">
            Create an account
          </CardTitle>
          <CardDescription>
            Enter your details to get started with Probe
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {invitationQuery.error && (
              <Alert variant="destructive">
                <AlertDescription className="space-y-2">
                  <p>
                    {invitationIsInvalid
                      ? "This invitation link is invalid or has expired."
                      : "We could not verify this invitation right now. You can retry or register without it."}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={clearInvitation}
                  >
                    Register without invitation
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            {invitationQuery.data && (
              <Alert>
                <AlertDescription>
                  You were invited to{" "}
                  {invitationQuery.data.teamName
                    ? `${invitationQuery.data.teamName} in `
                    : ""}
                  {invitationQuery.data.projectName}. Creating your account will
                  accept the invitation.
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                type="text"
                placeholder="John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="m@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                readOnly={!!invitationQuery.data}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
              <p className="text-xs text-muted-foreground">
                Must be at least 6 characters
              </p>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={
                registerMutation.isPending ||
                (!!invitationToken && invitationQuery.isLoading) ||
                !!invitationQuery.error
              }
            >
              {registerMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating account...
                </>
              ) : (
                "Create account"
              )}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-wrap items-center justify-center gap-1">
          <span className="text-sm text-muted-foreground">
            Already have an account?
          </span>
          <Link to="/login" className="text-sm text-primary hover:underline">
            Sign in
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
