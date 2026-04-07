import { Activity, CheckCircle2, XCircle, Coins } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface MetricsRowProps {
  total: number;
  success: number;
  failed: number;
  tokens: number;
}

/** Compact number formatter: 1234 → "1.2K", 1500000 → "1.5M" */
function formatCompact(n: number): string {
  if (n < 1000) return n.toString();
  if (n < 1_000_000) return `${(n / 1000).toFixed(1)}K`;
  if (n < 1_000_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  return `${(n / 1_000_000_000).toFixed(2)}B`;
}

export function MetricsRow({ total, success, failed, tokens }: MetricsRowProps) {
  const items = [
    {
      label: "Total",
      value: total.toLocaleString(),
      icon: Activity,
      iconClass: "text-muted-foreground",
      bgClass: "bg-secondary/50",
      valueClass: "",
    },
    {
      label: "Success",
      value: success.toLocaleString(),
      icon: CheckCircle2,
      iconClass: "text-primary",
      bgClass: "bg-primary/10",
      valueClass: "text-primary",
    },
    {
      label: "Failed",
      value: failed.toLocaleString(),
      icon: XCircle,
      iconClass: "text-destructive",
      bgClass: "bg-destructive/10",
      valueClass: "text-destructive",
    },
    {
      label: "Tokens (24h)",
      value: formatCompact(tokens),
      icon: Coins,
      iconClass: "text-amber-500",
      bgClass: "bg-amber-500/10",
      valueClass: "text-amber-500",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4">
      {items.map((item) => (
        <Card key={item.label} className="bg-card/50 backdrop-blur-sm border-border/50">
          <CardContent className="p-3 md:p-6">
            <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
              <div className={`hidden md:flex p-3 ${item.bgClass} rounded-md w-fit`}>
                <item.icon className={`w-5 h-5 ${item.iconClass}`} />
              </div>
              <div className="min-w-0">
                <p className="text-xs md:text-sm font-medium text-muted-foreground truncate">
                  {item.label}
                </p>
                <p className={`text-2xl md:text-3xl font-mono font-bold ${item.valueClass}`}>
                  {item.value}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
