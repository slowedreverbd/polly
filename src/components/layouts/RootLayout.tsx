import { Outlet } from "react-router";

import { Analytics } from "@vercel/analytics/react";

import { AppProvider } from "../../providers/app-provider";
import { Toaster } from "../ui/sonner";
import { TooltipProvider } from "../ui/tooltip";

export default function RootLayout() {
  return (
    <AppProvider>
      <TooltipProvider>
        <Outlet />
        <Toaster />
        <Analytics />
      </TooltipProvider>
    </AppProvider>
  );
}
