import { useRef, useCallback, useState } from 'react';
import { RibbonToolbar } from '@/components/ribbon/RibbonToolbar';
import { Terminal, type TerminalHandle } from '@/components/terminal/Terminal';
import { TagInfoPanel, type TagInfo } from '@/components/panels/TagInfoPanel';
import { useWebSerial } from '@/hooks/useWebSerial';
import { useProxmarkWasm } from '@/hooks/useProxmarkWasm';
import { useTheme } from '@/hooks/useTheme';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Activity, Cpu, Usb } from 'lucide-react';

export type ConnectionMode = 'serial' | 'wasm';

function App() {
  const terminalRef = useRef<TerminalHandle>(null);
  const [tagInfo, setTagInfo] = useState<TagInfo | null>(null);
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [connectionMode, setConnectionMode] = useState<ConnectionMode>('wasm');
  const { theme, setTheme } = useTheme();

  // WASM output handler
  const handleWasmOutput = useCallback((text: string) => {
    terminalRef.current?.write(text);
    parseTagInfo(text);
  }, []);

  // WASM hooks
  const wasmState = useProxmarkWasm({
    onOutput: handleWasmOutput,
    onReady: () => {
      terminalRef.current?.writeln('\x1b[32mWASM client loaded successfully!\x1b[0m');
      terminalRef.current?.writeln('\x1b[90mProxmark3 WASM client ready. Type "help" for commands.\x1b[0m');
    },
    onError: (err) => {
      terminalRef.current?.writeln(`\x1b[31mWASM Error: ${err.message}\x1b[0m`);
    },
  });

  // Parse tag information from output
  const parseTagInfo = useCallback((text: string) => {
    if (text.includes('UID:') || text.includes('uid:')) {
      const uidMatch = text.match(/[Uu][Ii][Dd][:\s]+([A-Fa-f0-9\s:]+)/);
      if (uidMatch) {
        setTagInfo(prev => ({
          ...prev,
          uid: uidMatch[1].trim().replace(/\s+/g, ':'),
        }));
      }
    }
    if (text.includes('MIFARE')) {
      const typeMatch = text.match(/(MIFARE\s+\w+(?:\s+\w+)?)/i);
      if (typeMatch) {
        setTagInfo(prev => ({
          ...prev,
          type: typeMatch[1],
          protocol: 'HF',
          subtype: 'MIFARE',
        }));
      }
    }
    if (text.includes('SAK:') || text.includes('sak:')) {
      const sakMatch = text.match(/[Ss][Aa][Kk][:\s]+([A-Fa-f0-9]+)/);
      if (sakMatch) {
        setTagInfo(prev => ({
          ...prev,
          sak: sakMatch[1],
        }));
      }
    }
    if (text.includes('ATQA:') || text.includes('atqa:')) {
      const atqaMatch = text.match(/[Aa][Tt][Qq][Aa][:\s]+([A-Fa-f0-9\s]+)/);
      if (atqaMatch) {
        setTagInfo(prev => ({
          ...prev,
          atqa: atqaMatch[1].trim(),
        }));
      }
    }
  }, []);

  // Handle incoming serial data
  const handleSerialData = useCallback((data: Uint8Array) => {
    const text = new TextDecoder().decode(data);
    terminalRef.current?.write(text);
    parseTagInfo(text);
  }, [parseTagInfo]);

  const [serialState, serialActions] = useWebSerial(handleSerialData);

  // Handle command execution
  const handleCommand = useCallback((cmd: string) => {
    setCommandHistory(prev => [...prev.slice(-99), cmd]);

    // Handle local commands (only in serial mode)
    if (cmd === 'clear') {
      terminalRef.current?.clear();
      return;
    }

    // Route to appropriate backend
    if (connectionMode === 'wasm') {
      // In WASM mode, pass ALL commands to the WASM client
      if (wasmState.isReady) {
        wasmState.sendCommand(cmd);
      } else if (wasmState.isLoading) {
        terminalRef.current?.writeln('\x1b[33mWASM client is still loading...\x1b[0m');
      } else {
        terminalRef.current?.writeln('\x1b[31mWASM client failed to load.\x1b[0m');
      }
    } else {
      // Serial mode - handle local help
      if (cmd === 'help') {
        terminalRef.current?.writeln('\x1b[36mAvailable commands:\x1b[0m');
        terminalRef.current?.writeln('  \x1b[33mhf search\x1b[0m    - Search for HF tags');
        terminalRef.current?.writeln('  \x1b[33mhf 14a info\x1b[0m  - Get ISO14443A tag info');
        terminalRef.current?.writeln('  \x1b[33mhf mf info\x1b[0m   - Get MIFARE info');
        terminalRef.current?.writeln('  \x1b[33mhf mf autopwn\x1b[0m - Auto attack MIFARE');
        terminalRef.current?.writeln('  \x1b[33mlf search\x1b[0m    - Search for LF tags');
        terminalRef.current?.writeln('  \x1b[33mlf read\x1b[0m      - Read LF tag');
        terminalRef.current?.writeln('  \x1b[33mhw version\x1b[0m   - Device version');
        terminalRef.current?.writeln('  \x1b[33mhw tune\x1b[0m      - Antenna tuning');
        terminalRef.current?.writeln('  \x1b[33mclear\x1b[0m        - Clear terminal');
        return;
      }

      if (serialState.status === 'connected') {
        const encoder = new TextEncoder();
        serialActions.write(encoder.encode(cmd + '\r\n')).catch((err) => {
          terminalRef.current?.writeln(`\x1b[31mError: ${err.message}\x1b[0m`);
        });
      } else {
        terminalRef.current?.writeln('\x1b[33mNot connected. Use the Connect button or switch to WASM mode.\x1b[0m');
      }
    }
  }, [connectionMode, serialState.status, serialActions, wasmState]);

  const handleConnect = useCallback(async () => {
    if (connectionMode === 'wasm') {
      // WASM mode - connect WebSerial first, then tell WASM to use it
      terminalRef.current?.writeln('\x1b[36mConnecting to Proxmark3 via WebSerial...\x1b[0m');
      terminalRef.current?.writeln('\x1b[90mSelect your Proxmark3 device in the browser popup.\x1b[0m');
      const success = await wasmState.connectDevice();
      if (success) {
        terminalRef.current?.writeln('\x1b[32mWebSerial connected!\x1b[0m');
        terminalRef.current?.writeln('\x1b[90mNow connecting WASM client to device...\x1b[0m');
      } else {
        terminalRef.current?.writeln('\x1b[31mWebSerial connection failed or cancelled.\x1b[0m');
      }
      return;
    } else {
      // Serial mode
      terminalRef.current?.writeln('\x1b[36mConnecting to Proxmark3...\x1b[0m');
      const success = await serialActions.connect();
      if (success) {
        terminalRef.current?.writeln('\x1b[32mConnected successfully!\x1b[0m');
        terminalRef.current?.writeln('\x1b[90mReady for commands.\x1b[0m');
      } else {
        terminalRef.current?.writeln(`\x1b[31mConnection failed: ${serialState.error}\x1b[0m`);
      }
    }
  }, [connectionMode, serialActions, serialState.error, wasmState]);

  const handleDisconnect = useCallback(async () => {
    if (connectionMode === 'wasm') {
      await wasmState.disconnectDevice();
      terminalRef.current?.writeln('\x1b[33mWebUSB disconnected.\x1b[0m');
    } else {
      await serialActions.disconnect();
      terminalRef.current?.writeln('\x1b[33mDisconnected.\x1b[0m');
    }
    setTagInfo(null);
  }, [connectionMode, serialActions, wasmState]);

  const handleCopyUid = useCallback(() => {
    if (tagInfo?.uid) {
      navigator.clipboard.writeText(tagInfo.uid);
      terminalRef.current?.writeln(`\x1b[32mUID copied to clipboard: ${tagInfo.uid}\x1b[0m`);
    }
  }, [tagInfo]);

  const handleRefreshTag = useCallback(() => {
    handleCommand('hf 14a info');
  }, [handleCommand]);

  // Handle terminal input in WASM raw mode
  const handleTerminalInput = useCallback((char: string) => {
    if (connectionMode === 'wasm' && wasmState.isReady) {
      wasmState.sendInput(char);
    }
  }, [connectionMode, wasmState]);

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Ribbon Toolbar */}
      <RibbonToolbar
        connectionStatus={connectionMode === 'wasm'
          ? (wasmState.isDeviceConnected ? 'connected' : 'disconnected')
          : serialState.status
        }
        onConnect={handleConnect}
        onDisconnect={handleDisconnect}
        onCommand={handleCommand}
        theme={theme}
        onThemeChange={setTheme}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex gap-4 p-4 overflow-hidden">
        {/* Left Panel - Tag Info & Status */}
        <div className="w-80 flex flex-col gap-4">
          <TagInfoPanel
            tagInfo={tagInfo}
            onRefresh={handleRefreshTag}
            onCopyUid={handleCopyUid}
          />

          {/* Command History */}
          <Card className="flex-1 overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Recent Commands
              </CardTitle>
            </CardHeader>
            <CardContent className="overflow-auto">
              <div className="space-y-1">
                {commandHistory.slice(-10).reverse().map((cmd, i) => (
                  <div
                    key={i}
                    className="text-xs font-mono text-muted-foreground hover:text-foreground cursor-pointer"
                    onClick={() => handleCommand(cmd)}
                  >
                    {cmd}
                  </div>
                ))}
                {commandHistory.length === 0 && (
                  <p className="text-xs text-muted-foreground">No commands yet</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Connection Info */}
          {serialState.deviceInfo && (
            <Card>
              <CardContent className="py-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Device</span>
                  <Badge variant="outline" className="text-xs">
                    {serialState.deviceInfo.vendorId?.toString(16).toUpperCase()}:
                    {serialState.deviceInfo.productId?.toString(16).toUpperCase()}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Main Terminal */}
        <div className="flex-1 flex flex-col min-w-0">
          <Card className="flex-1 overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Terminal</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 p-0 overflow-hidden">
              <Terminal
                ref={terminalRef}
                onCommand={handleCommand}
                onInput={handleTerminalInput}
                rawMode={connectionMode === 'wasm'}
                className="h-full"
              />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Status Bar */}
      <div className="h-8 bg-card border-t border-border px-4 flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-4">
          <span>Proxmark3 Web Client</span>
          <span>•</span>
          <span>
            {connectionMode === 'wasm'
              ? (wasmState.isLoading
                ? 'Loading WASM...'
                : wasmState.isReady
                  ? (wasmState.isDeviceConnected ? 'WASM + Device Connected' : 'WASM Ready (Offline)')
                  : 'WASM Error')
              : (serialState.status === 'connected' ? 'Serial Connected' : 'Disconnected')
            }
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="mr-2">Mode:</span>
          <Button
            variant={connectionMode === 'serial' ? 'default' : 'outline'}
            size="sm"
            className="h-5 px-2 text-xs"
            onClick={async () => {
              if (connectionMode === 'wasm' && wasmState.isDeviceConnected) {
                await wasmState.disconnectDevice();
              }
              setConnectionMode('serial');
            }}
          >
            <Usb className="h-3 w-3 mr-1" />
            Serial
          </Button>
          <Button
            variant={connectionMode === 'wasm' ? 'default' : 'outline'}
            size="sm"
            className="h-5 px-2 text-xs"
            onClick={async () => {
              if (connectionMode === 'serial' && serialState.status === 'connected') {
                await serialActions.disconnect();
              }
              setConnectionMode('wasm');
            }}
          >
            <Cpu className="h-3 w-3 mr-1" />
            WASM
          </Button>
          <span className="ml-4">Commands: {commandHistory.length}</span>
        </div>
      </div>
    </div>
  );
}

export default App;
