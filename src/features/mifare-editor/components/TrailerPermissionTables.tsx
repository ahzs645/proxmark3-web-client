import { Badge } from "@/components/ui/badge";
import type { AccessBitsResult } from "@/lib/accessBits";
import { PermissionBadge } from "./PermissionBadge";

interface TrailerPermissionTablesProps {
  decoded: AccessBitsResult;
  cValues: [number, number, number, number];
}

export function TrailerPermissionTables({ decoded, cValues }: TrailerPermissionTablesProps) {
  return (
    <div className="space-y-3">
      <label className="text-xs font-medium text-muted-foreground">
        Data Blocks Permission Matrix
      </label>
      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-xs">
          <thead className="bg-secondary/50">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Block</th>
              <th className="px-3 py-2 text-center font-medium">Read</th>
              <th className="px-3 py-2 text-center font-medium">Write</th>
              <th className="px-3 py-2 text-center font-medium">Increment</th>
              <th className="px-3 py-2 text-center font-medium">Dec/Trans/Rest</th>
            </tr>
          </thead>
          <tbody>
            {[
              { label: "Block 0", access: decoded.sectorAccess.block0, c: cValues[0] },
              { label: "Block 1", access: decoded.sectorAccess.block1, c: cValues[1] },
              { label: "Block 2", access: decoded.sectorAccess.block2, c: cValues[2] },
            ].map((row, index) => (
              <tr key={index} className="border-t border-border/50">
                <td className="px-3 py-2 font-medium">
                  {row.label}
                  <Badge variant="outline" className="ml-2 text-[9px]">
                    C={row.c}
                  </Badge>
                </td>
                <td className="px-3 py-2 text-center">
                  <PermissionBadge perm={row.access.read} />
                </td>
                <td className="px-3 py-2 text-center">
                  <PermissionBadge perm={row.access.write} />
                </td>
                <td className="px-3 py-2 text-center">
                  <PermissionBadge perm={row.access.increment} />
                </td>
                <td className="px-3 py-2 text-center">
                  <PermissionBadge perm={row.access.decrement} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <label className="text-xs font-medium text-muted-foreground">Trailer Block Permissions</label>
      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-xs">
          <thead className="bg-secondary/50">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Operation</th>
              <th className="px-3 py-2 text-center font-medium">Key A</th>
              <th className="px-3 py-2 text-center font-medium">Access Bits</th>
              <th className="px-3 py-2 text-center font-medium">Key B</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-border/50">
              <td className="px-3 py-2 font-medium">
                Read
                <Badge variant="outline" className="ml-2 text-[9px]">
                  C3={cValues[3]}
                </Badge>
              </td>
              <td className="px-3 py-2 text-center">
                <PermissionBadge perm={decoded.sectorAccess.trailer.keyARead} />
              </td>
              <td className="px-3 py-2 text-center">
                <PermissionBadge perm={decoded.sectorAccess.trailer.accessBitsRead} />
              </td>
              <td className="px-3 py-2 text-center">
                <PermissionBadge perm={decoded.sectorAccess.trailer.keyBRead} />
              </td>
            </tr>
            <tr className="border-t border-border/50">
              <td className="px-3 py-2 font-medium">Write</td>
              <td className="px-3 py-2 text-center">
                <PermissionBadge perm={decoded.sectorAccess.trailer.keyAWrite} />
              </td>
              <td className="px-3 py-2 text-center">
                <PermissionBadge perm={decoded.sectorAccess.trailer.accessBitsWrite} />
              </td>
              <td className="px-3 py-2 text-center">
                <PermissionBadge perm={decoded.sectorAccess.trailer.keyBWrite} />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
