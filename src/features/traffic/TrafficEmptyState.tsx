import { Radio } from "lucide-react";

export function TrafficEmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center p-8 text-muted-foreground">
      <Radio className="mb-4 h-12 w-12 opacity-20" />
      <p className="text-sm">No traffic captured</p>
      <p className="mt-1 text-xs">Start a sniff session to capture traffic</p>
    </div>
  );
}
