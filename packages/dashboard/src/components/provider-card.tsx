import { AlertTriangle, RefreshCw, Clock, Key, Coins, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ProviderCardProps {
  provider: {
    id: string;
    name: string;
    enabled: boolean;
    circuitBreakerState: string;
    successRequests: number;
    failedRequests: number;
    lastError?: string | null;
    lastUsedAt?: string | null;
    keyCount?: number;
    keysAvailable?: number;
    usage?: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
      requestCount: number;
    };
    privacy?: {
      policy: string;
      sourceUrl: string;
      lastVerified: string;
    };
  };
  onReset: (providerId: string) => void;
  resetPending: boolean;
}

/**
 * Style a privacy label. The four policies carry real semantic weight:
 * emerald for "safe" (no-training, local), amber for "configurable"
 * (operator responsibility), rose for "free-tier trains" so it visually
 * warns anyone glancing at the dashboard.
 */
function getPrivacyStyle(policy: string) {
  switch (policy) {
    case "no-training":
      return "bg-emerald-500/10 text-emerald-500 border-emerald-500/30";
    case "local":
      return "bg-sky-500/10 text-sky-500 border-sky-500/30";
    case "configurable":
      return "bg-amber-500/10 text-amber-500 border-amber-500/30";
    case "free-tier-trains":
      return "bg-rose-500/10 text-rose-500 border-rose-500/30";
    default:
      return "bg-muted text-muted-foreground border-border/50";
  }
}

function getPrivacyLabel(policy: string) {
  switch (policy) {
    case "no-training":
      return "NO-TRAIN";
    case "local":
      return "LOCAL";
    case "configurable":
      return "CONFIG";
    case "free-tier-trains":
      return "TRAINS";
    default:
      return policy.toUpperCase();
  }
}

function getStatusColor(state: string, enabled: boolean) {
  if (!enabled) return "bg-muted text-muted-foreground border-muted";
  switch (state) {
    case "closed": return "bg-primary/10 text-primary border-primary/20";
    case "open": return "bg-destructive/10 text-destructive border-destructive/20";
    case "half_open": return "bg-amber-500/10 text-amber-500 border-amber-500/20";
    default: return "bg-muted text-muted-foreground border-muted";
  }
}

function getStatusText(state: string, enabled: boolean) {
  if (!enabled) return "Disabled";
  switch (state) {
    case "closed": return "Healthy";
    case "open": return "Failing";
    case "half_open": return "Testing";
    default: return "Unknown";
  }
}

/** Compact number formatter: 1234 → "1.2K", 1500000 → "1.5M" */
function formatCompact(n: number): string {
  if (n < 1000) return n.toString();
  if (n < 1_000_000) return `${(n / 1000).toFixed(1)}K`;
  if (n < 1_000_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  return `${(n / 1_000_000_000).toFixed(2)}B`;
}

export function ProviderCard({ provider, onReset, resetPending }: ProviderCardProps) {
  const showReset = provider.circuitBreakerState === "open" || provider.circuitBreakerState === "half_open";
  const keyCount = provider.keyCount ?? 1;
  const keysAvailable = provider.keysAvailable ?? keyCount;
  const hasMultiKey = keyCount > 1;
  const usage = provider.usage;
  const hasTokens = usage && usage.totalTokens > 0;

  return (
    <Card className={cn("overflow-hidden border-border/50 bg-card/50 backdrop-blur-sm transition-all", !provider.enabled && "opacity-60")}>
      <CardHeader className="pb-3 border-b border-border/30">
        <div className="flex justify-between items-start gap-2">
          <div className="min-w-0">
            <CardTitle className="font-mono text-lg">{provider.name}</CardTitle>
            <CardDescription className="text-xs font-mono mt-1">{provider.id}</CardDescription>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Badge variant="outline" className={cn("uppercase text-[10px] tracking-wider", getStatusColor(provider.circuitBreakerState, provider.enabled))}>
              {getStatusText(provider.circuitBreakerState, provider.enabled)}
            </Badge>
            {hasMultiKey && (
              <Badge
                variant="outline"
                className="uppercase text-[10px] tracking-wider bg-secondary/50 text-muted-foreground border-border/50 flex items-center gap-1"
                title={`${keysAvailable}/${keyCount} keys available`}
              >
                <Key className="w-2.5 h-2.5" />
                {keysAvailable}/{keyCount}
              </Badge>
            )}
            {provider.privacy && (
              <a
                href={provider.privacy.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                title={`Training policy: ${provider.privacy.policy}\nVerified ${provider.privacy.lastVerified}\nSource: ${provider.privacy.sourceUrl}`}
              >
                <Badge
                  variant="outline"
                  className={cn(
                    "uppercase text-[10px] tracking-wider flex items-center gap-1 cursor-help",
                    getPrivacyStyle(provider.privacy.policy),
                  )}
                >
                  <ShieldCheck className="w-2.5 h-2.5" />
                  {getPrivacyLabel(provider.privacy.policy)}
                </Badge>
              </a>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-4 space-y-4">
        <div className="grid grid-cols-2 gap-2 text-sm font-mono">
          <div className="flex flex-col p-2 bg-secondary/30 rounded-md border border-border/20">
            <span className="text-muted-foreground text-xs uppercase">Success</span>
            <span className="text-foreground">{provider.successRequests}</span>
          </div>
          <div className="flex flex-col p-2 bg-secondary/30 rounded-md border border-border/20">
            <span className="text-muted-foreground text-xs uppercase">Failed</span>
            <span className={cn("text-foreground", provider.failedRequests > 0 && "text-destructive")}>{provider.failedRequests}</span>
          </div>
        </div>

        {hasTokens && usage && (
          <div className="p-2 rounded-md border border-amber-500/20 bg-amber-500/5">
            <div className="flex items-center gap-1.5 text-[10px] uppercase text-amber-500/80 tracking-wider mb-1">
              <Coins className="w-3 h-3" /> Tokens (24h)
            </div>
            <div className="font-mono text-sm text-amber-500">
              {formatCompact(usage.totalTokens)}
            </div>
            <div className="font-mono text-[10px] text-muted-foreground mt-0.5">
              in {formatCompact(usage.promptTokens)} · out {formatCompact(usage.completionTokens)}
            </div>
          </div>
        )}

        {provider.lastError && (
          <div className="p-2 rounded border border-destructive/20 bg-destructive/5 text-xs text-destructive flex items-start gap-2 overflow-hidden">
            <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
            <span className="truncate" title={provider.lastError}>{provider.lastError}</span>
          </div>
        )}

        <div className="flex items-center justify-between pt-2">
          <div className="text-xs text-muted-foreground font-mono flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {provider.lastUsedAt ? new Date(provider.lastUsedAt).toLocaleTimeString() : "Never"}
          </div>
          {showReset && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onReset(provider.id)}
              disabled={resetPending}
              className="h-7 text-xs border-amber-500/30 text-amber-500 hover:bg-amber-500/10 hover:text-amber-500"
            >
              <RefreshCw className={cn("w-3 h-3 mr-1", resetPending && "animate-spin")} /> Reset
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
