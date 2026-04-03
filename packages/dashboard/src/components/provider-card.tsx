import { AlertTriangle, RefreshCw, Clock } from "lucide-react";
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
  };
  onReset: (providerId: string) => void;
  resetPending: boolean;
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

export function ProviderCard({ provider, onReset, resetPending }: ProviderCardProps) {
  const showReset = provider.circuitBreakerState === "open" || provider.circuitBreakerState === "half_open";

  return (
    <Card className={cn("overflow-hidden border-border/50 bg-card/50 backdrop-blur-sm transition-all", !provider.enabled && "opacity-60")}>
      <CardHeader className="pb-3 border-b border-border/30">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="font-mono text-lg">{provider.name}</CardTitle>
            <CardDescription className="text-xs font-mono mt-1">{provider.id}</CardDescription>
          </div>
          <Badge variant="outline" className={cn("uppercase text-[10px] tracking-wider", getStatusColor(provider.circuitBreakerState, provider.enabled))}>
            {getStatusText(provider.circuitBreakerState, provider.enabled)}
          </Badge>
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
