import type { IconProps } from "@phosphor-icons/react";
import {
  CalendarBlankIcon,
  ChatCircleIcon,
  ChatCircleTextIcon,
  CrownIcon,
  HashIcon,
  TrendUpIcon,
} from "@phosphor-icons/react";
import type { ComponentType } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useMessageSentCount } from "@/hooks/use-message-sent-count";
import { useUserSettings } from "@/hooks/use-user-settings";
import { cn, resizeGoogleImageUrl } from "@/lib/utils";
import { useUserDataContext } from "@/providers/user-data-context";

function getInitials(name?: string | null) {
  if (!name) {
    return "U";
  }
  return name
    .split(" ")
    .map(n => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

const STAT_ICON_COLORS = [
  "hsl(var(--primary))",
  "hsl(260 85% 60%)",
  "hsl(280 75% 65%)",
];

type StatCardProps = {
  icon: ComponentType<IconProps>;
  label: string;
  value: number;
  color: string;
  showDivider: boolean;
};

const StatCard = ({
  icon: Icon,
  label,
  value,
  color,
  showDivider,
}: StatCardProps) => {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 px-4 py-3 text-sm",
        showDivider && "border-b border-border/60"
      )}
    >
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" style={{ color }} weight="duotone" />
        <span className="text-foreground">{label}</span>
      </div>
      <span className="font-mono text-sm text-foreground">{value}</span>
    </div>
  );
};

function formatResetDate(createdAt?: number | null) {
  if (!createdAt) {
    return "soon";
  }

  const joinDate = new Date(createdAt);
  const now = new Date();
  const joinDay = joinDate.getDate();

  let resetDate = new Date(now.getFullYear(), now.getMonth(), joinDay);

  if (resetDate <= now) {
    resetDate = new Date(now.getFullYear(), now.getMonth() + 1, joinDay);
  }

  if (resetDate.getDate() !== joinDay) {
    resetDate = new Date(resetDate.getFullYear(), resetDate.getMonth() + 1, 0);
  }

  return resetDate.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
  });
}

export const UserIdCard = () => {
  const { monthlyUsage, hasUnlimitedCalls, user } = useUserDataContext();
  const { monthlyMessagesSent } = useMessageSentCount();
  const userSettings = useUserSettings();

  const shouldAnonymize = userSettings?.anonymizeForDemo ?? false;

  if (!user || user.isAnonymous) {
    return null;
  }

  const usagePercentage = monthlyUsage
    ? Math.min(100, (monthlyMessagesSent / monthlyUsage.monthlyLimit) * 100)
    : 0;

  const stats = [
    {
      icon: ChatCircleTextIcon,
      label: "Conversations",
      value: user.conversationCount ?? 0,
      color: STAT_ICON_COLORS[0],
    },
    {
      icon: ChatCircleIcon,
      label: "Total Messages",
      value: user.totalMessageCount ?? 0,
      color: STAT_ICON_COLORS[1],
    },
    {
      icon: TrendUpIcon,
      label: "This Month",
      value: monthlyMessagesSent || 0,
      color: STAT_ICON_COLORS[2],
    },
  ];

  return (
    <div className="stack-lg">
      <div className="hidden overflow-hidden rounded-xl border border-border/60 bg-card/80 shadow-sm backdrop-blur lg:block">
        <div className="flex flex-col gap-5 border-b border-border/60 bg-muted/40 p-6">
          <div className="flex items-center justify-between">
            <Badge
              variant="secondary"
              className="flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-medium uppercase tracking-wide"
            >
              <CrownIcon className="h-3.5 w-3.5 text-primary" weight="fill" />
              Member
            </Badge>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <HashIcon className="h-3 w-3" />
              <span className="font-mono">
                {user._id?.slice(-6).toUpperCase() ?? "------"}
              </span>
            </div>
          </div>

          <div className="flex flex-col items-center gap-3">
            <div className={cn("relative", shouldAnonymize && "blur-lg")}>
              <Avatar className="h-24 w-24 ring-2 ring-border/60 shadow-sm">
                <AvatarImage
                  alt={user.name || "User"}
                  src={resizeGoogleImageUrl(user.image || "", 144)}
                />
                <AvatarFallback className="bg-gradient-primary text-base text-primary-foreground">
                  {getInitials(user.name)}
                </AvatarFallback>
              </Avatar>
            </div>
            <div className="text-center">
              <p
                className={cn(
                  "text-lg font-semibold",
                  shouldAnonymize && "blur-md"
                )}
              >
                {user.name || "Unnamed User"}
              </p>
              <p
                className={cn(
                  "font-mono text-xs text-muted-foreground",
                  shouldAnonymize && "blur-md"
                )}
              >
                {user.email}
              </p>
              <div className="mt-1 flex items-center justify-center gap-1 text-xs text-muted-foreground">
                <CalendarBlankIcon className="h-3.5 w-3.5" />
                <span>
                  {user.createdAt
                    ? new Date(user.createdAt).toLocaleDateString("en-US", {
                        month: "long",
                        year: "numeric",
                      })
                    : "Joined unknown"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {stats.map((stat, index) => (
          <StatCard
            key={stat.label}
            icon={stat.icon}
            label={stat.label}
            value={stat.value}
            color={stat.color}
            showDivider={index < stats.length - 1}
          />
        ))}

        {monthlyUsage &&
          monthlyUsage.monthlyLimit > 0 &&
          !hasUnlimitedCalls && (
            <div className="space-y-3 bg-muted/40 p-4">
              <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                <span>Monthly Usage</span>
                <span className="font-mono text-foreground">
                  {monthlyMessagesSent}/{monthlyUsage.monthlyLimit}
                </span>
              </div>
              <Progress className="h-2" value={usagePercentage} />
              {typeof monthlyUsage.remainingMessages === "number" && (
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{monthlyUsage.remainingMessages} remaining</span>
                  <span>Resets {formatResetDate(user.createdAt)}</span>
                </div>
              )}
            </div>
          )}
      </div>

      {monthlyUsage && monthlyUsage.monthlyLimit > 0 && !hasUnlimitedCalls && (
        <div className="rounded-xl border border-border/60 bg-muted/30 p-4 lg:hidden">
          <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
            <span>Monthly Usage</span>
            <span className="font-mono text-foreground">
              {monthlyMessagesSent}/{monthlyUsage.monthlyLimit}
            </span>
          </div>
          <Progress className="mt-3 h-2" value={usagePercentage} />
          {typeof monthlyUsage.remainingMessages === "number" && (
            <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
              <span className="font-mono">
                {monthlyUsage.remainingMessages} remaining
              </span>
              <span>Resets {formatResetDate(user.createdAt)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
