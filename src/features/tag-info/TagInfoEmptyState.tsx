import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CreditCard, Zap } from "lucide-react";

interface TagInfoEmptyStateProps {
  onCommand?: (cmd: string) => void;
  disabled?: boolean;
}

export function TagInfoEmptyState({ onCommand, disabled = false }: TagInfoEmptyStateProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <CreditCard className="h-4 w-4" />
          Tag Information
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
          <CreditCard className="mb-3 h-10 w-10 opacity-20" />
          <p className="text-sm">No tag detected</p>
          <p className="mt-1 text-xs">Run a search command</p>
          {onCommand ? (
            <div className="mt-3 flex gap-2">
              <Button
                size="sm"
                variant="default"
                className="text-xs"
                onClick={() => onCommand("hf search")}
                disabled={disabled}
              >
                <Zap className="mr-1 h-3 w-3" />
                HF Search
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-xs"
                onClick={() => onCommand("lf search")}
                disabled={disabled}
              >
                <Zap className="mr-1 h-3 w-3" />
                LF Search
              </Button>
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
