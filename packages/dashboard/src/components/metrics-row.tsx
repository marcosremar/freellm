import { Activity, CheckCircle2, XCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface MetricsRowProps {
  total: number;
  success: number;
  failed: number;
}

export function MetricsRow({ total, success, failed }: MetricsRowProps) {
  const items = [
    { label: "Total", value: total, icon: Activity, iconClass: "text-muted-foreground", bgClass: "bg-secondary/50", valueClass: "" },
    { label: "Success", value: success, icon: CheckCircle2, iconClass: "text-primary", bgClass: "bg-primary/10", valueClass: "text-primary" },
    { label: "Failed", value: failed, icon: XCircle, iconClass: "text-destructive", bgClass: "bg-destructive/10", valueClass: "text-destructive" },
  ];

  return (
    <div className="grid grid-cols-3 gap-2 md:gap-4">
      {items.map((item) => (
        <Card key={item.label} className="bg-card/50 backdrop-blur-sm border-border/50">
          <CardContent className="p-3 md:p-6">
            <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
              <div className={`hidden md:flex p-3 ${item.bgClass} rounded-md w-fit`}>
                <item.icon className={`w-5 h-5 ${item.iconClass}`} />
              </div>
              <div>
                <p className="text-xs md:text-sm font-medium text-muted-foreground">{item.label}</p>
                <p className={`text-2xl md:text-3xl font-mono font-bold ${item.valueClass}`}>
                  {item.value.toLocaleString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
