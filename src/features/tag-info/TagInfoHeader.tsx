import { Button } from "@/components/ui/button";
import { CardTitle } from "@/components/ui/card";
import { CreditCard, RefreshCw } from "lucide-react";

interface TagInfoHeaderProps {
  onRefresh?: () => void;
}

export function TagInfoHeader({ onRefresh }: TagInfoHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <CardTitle className="text-sm flex items-center gap-2">
        <CreditCard className="h-4 w-4 text-primary" />
        Tag Information
      </CardTitle>
      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onRefresh}>
        <RefreshCw className="h-3 w-3" />
      </Button>
    </div>
  );
}
