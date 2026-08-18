import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PanelHeader } from "@/components/panels/shared/PanelHeader";
import { Cpu } from "lucide-react";
import { HexToolsSection } from "@/components/panels/utilities/HexToolsSection";
import { UidToolsSection } from "@/components/panels/utilities/UidToolsSection";
import { ApduToolsSection } from "@/components/panels/utilities/ApduToolsSection";
import { Pn532ToolsSection } from "@/components/panels/utilities/Pn532ToolsSection";

export function UtilitiesPanel() {
  return (
    <Card className="flex h-full flex-col overflow-hidden">
      <PanelHeader icon={Cpu} title="Browser Utilities" tag="Offline" />

      <CardContent className="flex-1 overflow-auto p-4">
        <Tabs defaultValue="hex" className="space-y-4">
          <TabsList className="h-auto flex-wrap justify-start">
            <TabsTrigger value="hex">Hex</TabsTrigger>
            <TabsTrigger value="uid">UID / BCC</TabsTrigger>
            <TabsTrigger value="apdu">APDU</TabsTrigger>
            <TabsTrigger value="pn532">PN532</TabsTrigger>
          </TabsList>

          <TabsContent value="hex" className="m-0 space-y-4">
            <HexToolsSection />
          </TabsContent>

          <TabsContent value="uid" className="m-0 space-y-4">
            <UidToolsSection />
          </TabsContent>

          <TabsContent value="apdu" className="m-0 space-y-4">
            <ApduToolsSection />
          </TabsContent>

          <TabsContent value="pn532" className="m-0 space-y-4">
            <Pn532ToolsSection />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

export default UtilitiesPanel;
