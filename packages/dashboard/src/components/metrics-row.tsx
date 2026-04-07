import { Activity, CheckCircle2, XCircle, Coins, Database } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface MetricsRowProps {
  total: number;
  success: number;
  failed: number;
  tokens: number;
  cacheHits: number;
  cacheHitRate: number;
}

/** Compact number formatter: 1234 → "1.2K", 1500000 → "1.5M" */
function formatCompact(n: number): string {
  if (n < 1000) return n.toString();
  if (n < 1_000_000) return `${(n / 1000).toFixed(1)}K`;
  if (n < 1_000_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  return `${(n / 1_000_000_000).toFixed(2)}B`;
}

export function MetricsRow({ total, success, failed, tokens, cacheHits, cacheHitRate }: MetricsRowProps) {
  const items = [
    {
      label: "Total",
      value: total.toLocaleString(),
      sub: undefined,
      icon: Activity,
      iconClass: "text-muted-foreground",
      bgClass: "bg-secondary/50",
      valueClass: "",
    },
    {
      label: "Success",
      value: success.toLocaleString(),
      sub: undefined,
      icon: CheckCircle2,
      iconClass: "text-primary",
      bgClass: "bg-primary/10",
      valueClass: "text-primary",
    },
    {
      label: "Failed",
      value: failed.toLocaleString(),
      sub: undefined,
      icon: XCircle,
      iconClass: "text-destructive",
      bgClass: "bg-destructive/10",
      valueClass: "text-destructive",
    },
    {
      label: "Cache Hits",
      value: formatCompact(cacheHits),
      sub: cacheHits > 0 ? `${(cacheHitRate * 100).toFixed(0)}% hit rate` : undefined,
      icon: Database,
      iconClass: "text-cyan-400",
      bgClass: "bg-cyan-400/10",
      valueClass: "text-cyan-400",
    },
    {
      label: "Tokens (24h)",
      value: formatCompact(tokens),
      sub: undefined,
      icon: Coins,
      iconClass: "text-amber-500",
      bgClass: "bg-amber-500/10",
      valueClass: "text-amber-500",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2 md:gap-3">
      {items.map((item) => (
        <Card key={item.label} className="bg-card/50 backdrop-blur-sm border-border/50">
          <CardContent className="p-3 md:p-5">
            <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-3">
              <div className={`hidden md:flex p-2.5 ${item.bgClass} rounded-md w-fit shrink-0`}>
                <item.icon className={`w-4 h-4 ${item.iconClass}`} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-muted-foreground truncate">
                  {item.label}
                </p>
                <p className={`text-xl md:text-2xl font-mono font-bold leading-tight ${item.valueClass}`}>
                  {item.value}
                </p>
                {item.sub && (
                  <p className="text-[10px] font-mono text-muted-foreground mt-0.5 truncate">
                    {item.sub}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
