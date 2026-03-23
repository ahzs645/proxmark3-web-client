import { Separator } from "@/components/ui/separator";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RIBBON_TABS, getIcon } from "./config";

export function RibbonTabNav() {
  return (
    <div className="relative border-t border-border/60">
      <div className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-card via-card/85 to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-card via-card/85 to-transparent" />
      <div className="overflow-x-auto px-2 py-2 scrollbar-hide">
        <TabsList className="h-auto min-w-max gap-1 bg-transparent p-0">
          {RIBBON_TABS.map((tab) => (
            <RibbonNavTrigger key={tab.value} tab={tab} />
          ))}
        </TabsList>
      </div>
    </div>
  );
}

function RibbonNavTrigger({ tab }: { tab: (typeof RIBBON_TABS)[number] }) {
  return (
    <>
      {tab.separatorBefore ? (
        <Separator orientation="vertical" className="mx-1 h-5 shrink-0" />
      ) : null}
      <TabsTrigger
        value={tab.value}
        className="shrink-0 rounded-full border border-transparent px-3 py-1.5 text-xs data-[state=active]:border-border data-[state=active]:bg-background/80"
      >
        {tab.icon ? getIcon(tab.icon, "h-3 w-3") : null}
        {tab.label}
      </TabsTrigger>
    </>
  );
}

export default RibbonTabNav;
