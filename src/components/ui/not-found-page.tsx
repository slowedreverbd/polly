import { Link } from "react-router";

import { Button } from "@/components/ui/button";

type NotFoundPageProps = {
  title?: string;
  description?: string;
};

export const NotFoundPage = ({
  title = "Page not found",
  description = "The page you're looking for doesn't exist.",
}: NotFoundPageProps) => {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="mx-auto max-w-md space-y-6 p-6 text-center">
        <div className="space-y-4">
          <div className="mx-auto flex h-32 w-32 items-center justify-center">
            <img
              alt="Polly not found"
              className="h-32 w-32 object-contain"
              loading="lazy"
              src="/polly-404.png"
            />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold">{title}</h1>
            <p className="text-muted-foreground">{description}</p>
          </div>
        </div>

        <Button asChild>
          <Link to="/">New Chat</Link>
        </Button>
      </div>
    </div>
  );
};
