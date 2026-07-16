import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { AppearanceControls } from "@/components/appearance-controls";
import { BrandMark } from "@/components/brand-mark";
import { LoginForm } from "@/components/login-form";
import { authClient } from "@/auth-client";

export function LoginRoute() {
  const navigate = useNavigate();
  const session = authClient.useSession();

  useEffect(() => {
    if (session.data) {
      void navigate({ to: "/" });
    }
  }, [navigate, session.data]);

  const signInWithGoogle = async () => {
    const callbackURL = new URL("/", window.location.origin).toString();

    await authClient.signIn.social({
      provider: "google",
      callbackURL,
      errorCallbackURL: window.location.href,
    });
  };

  return (
    <main className="relative flex min-h-svh flex-col items-center justify-center bg-muted p-6 md:p-10">
      <BrandMark className="absolute left-4 top-4 rounded-4xl bg-background/80 p-1 pr-3 shadow-xs ring-1 ring-border backdrop-blur md:left-6 md:top-6" />
      <AppearanceControls className="absolute right-4 top-4 rounded-4xl bg-background/80 p-1 shadow-xs ring-1 ring-border backdrop-blur md:right-6 md:top-6" />
      <div className="w-full max-w-sm">
        <LoginForm isCheckingSession={session.isPending} onGoogleLogin={signInWithGoogle} />
      </div>
    </main>
  );
}
