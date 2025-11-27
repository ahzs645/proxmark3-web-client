import { useRef, useCallback, useState, useEffect, useMemo } from 'react';
import { RibbonToolbar } from '@/components/ribbon/RibbonToolbar';
import { Terminal, type TerminalHandle } from '@/components/terminal/Terminal';
import { TagInfoPanel, type TagInfo } from '@/components/panels/TagInfoPanel';
import { useWebSerial } from '@/hooks/useWebSerial';
import { useProxmarkWasm } from '@/hooks/useProxmarkWasm';
import { useTheme } from '@/hooks/useTheme';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { type CachedAsset, type CachedAssetKind } from '@/components/panels/KeyCachePanel';
import { MifareEditorPanel } from '@/components/panels/MifareEditorPanel';
import { HexAsciiViewer } from '@/components/panels/HexAsciiViewer';
import { CardMemoryMap } from '@/components/panels/CardMemoryMap';
import { Activity, Cpu, Send, Sparkles, Trash2, Usb, CreditCard, FileCode2, Edit3 } from 'lucide-react';

export type ConnectionMode = 'serial' | 'wasm';

type CachedAssetWithData = CachedAsset & { base64: string };

const CACHE_STORAGE_KEY = 'pm3-cache';
const CACHE_PATH_PREFIX = '/pm3-cache';

function App() {
  const terminalRef = useRef<TerminalHandle>(null);
  const [tagInfo, setTagInfo] = useState<TagInfo | null>(null);
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [connectionMode, setConnectionMode] = useState<ConnectionMode>('wasm');
  const [activeTab, setActiveTab] = useState<string>('connect');
  const [quickCommand, setQuickCommand] = useState('hf search');
  const [cachedAssets, setCachedAssets] = useState<CachedAssetWithData[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(CACHE_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) as CachedAssetWithData[] : [];
      return parsed
        .filter(item => Boolean((item as CachedAssetWithData).base64))
        .map(item => ({ ...item, base64: (item as CachedAssetWithData).base64 || '' }));
    } catch (e) {
      console.error('Failed to parse cache', e);
      return [];
    }
  });
  const [isSyncingCache, setIsSyncingCache] = useState(false);
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

  const detectKind = useCallback((file: File): CachedAssetKind => {
    const ext = file.name.toLowerCase();
    if (ext.endsWith('.dic') || ext.includes('key')) return 'keys';
    if (ext.endsWith('.bin') || ext.endsWith('.dump') || ext.endsWith('.eml')) return 'dump';
    if (ext.endsWith('.lua')) return 'script';
    return 'raw';
  }, []);

  const fileToBase64 = useCallback((file: File) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const buffer = reader.result as ArrayBuffer;
      const uint8 = new Uint8Array(buffer);
      let binary = '';
      for (let i = 0; i < uint8.length; i++) {
        binary += String.fromCharCode(uint8[i]);
      }
      resolve(btoa(binary));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  }), []);

  const syncCacheToFS = useCallback(() => {
    if (!cachedAssets.length) return false;
    if (!wasmState.isReady) {
      terminalRef.current?.writeln('\x1b[33mWASM not ready yet; cache will sync once it is.\x1b[0m');
      return false;
    }

    const FS = (window as any).FS || (window as any).Module?.FS;
    if (!FS?.writeFile) {
      terminalRef.current?.writeln('\x1b[31mCannot push cache: Emscripten FS not available.\x1b[0m');
      return false;
    }

    setIsSyncingCache(true);
    try {
      const pathInfo = FS.analyzePath ? FS.analyzePath(CACHE_PATH_PREFIX) : { exists: false };
      if (!pathInfo?.exists && FS.mkdir) {
        FS.mkdir(CACHE_PATH_PREFIX);
      }

      for (const asset of cachedAssets) {
        if (!asset.base64) continue;
        const binary = atob(asset.base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        FS.writeFile(`${CACHE_PATH_PREFIX}/${asset.name}`, bytes, { flags: 'w+' });
      }
      terminalRef.current?.writeln(`\x1b[32mSynced ${cachedAssets.length} cached files to ${CACHE_PATH_PREFIX}/\x1b[0m`);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
      terminalRef.current?.writeln(`\x1b[31mCache sync failed: ${message}\x1b[0m`);
      return false;
    } finally {
      setIsSyncingCache(false);
    }
  }, [cachedAssets, wasmState.isReady]);

  const handleCacheUpload = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const uploads: CachedAssetWithData[] = [];

    for (const file of Array.from(files)) {
      const base64 = await fileToBase64(file);
      uploads.push({
        id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${file.name}`,
        name: file.name,
        kind: detectKind(file),
        size: file.size,
        base64,
        updatedAt: Date.now(),
      });
    }

    setCachedAssets(prev => [...uploads, ...prev].slice(0, 30));
    setTimeout(syncCacheToFS, 50);
  }, [detectKind, fileToBase64, syncCacheToFS]);

  const handleCacheDelete = useCallback((id: string) => {
    setCachedAssets(prev => prev.filter(item => item.id !== id));
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

  const handleCacheUse = useCallback((asset: CachedAsset, template: string) => {
    const synced = syncCacheToFS();
    const cmd = template.replace('{{path}}', `${CACHE_PATH_PREFIX}/${asset.name}`);
    if (synced === false) {
      terminalRef.current?.writeln('\x1b[33mCache not synced yet; sending command anyway.\x1b[0m');
    }
    handleCommand(cmd);
  }, [handleCommand, syncCacheToFS]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(cachedAssets));
    }
  }, [cachedAssets]);

  useEffect(() => {
    if (wasmState.isReady && cachedAssets.length) {
      syncCacheToFS();
    }
  }, [cachedAssets.length, wasmState.isReady, syncCacheToFS]);

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

  const canRunCommands = useMemo(() => {
    return connectionMode === 'wasm'
      ? wasmState.isReady
      : serialState.status === 'connected';
  }, [connectionMode, serialState.status, wasmState.isReady]);

  const runQuickCommand = useCallback(() => {
    if (!quickCommand.trim()) return;
    handleCommand(quickCommand.trim());
  }, [handleCommand, quickCommand]);

  return (
    <div className="min-h-screen flex flex-col bg-background bg-[radial-gradient(circle_at_20%_20%,rgba(34,197,94,0.08),transparent_25%),radial-gradient(circle_at_80%_10%,rgba(59,130,246,0.06),transparent_25%)]">
      {/* Ribbon Toolbar */}
      <RibbonToolbar
        connectionStatus={connectionMode === 'wasm'
          ? (wasmState.isDeviceConnected ? 'connected' : 'disconnected')
          : serialState.status
        }
        onConnect={handleConnect}
        onDisconnect={handleDisconnect}
        onCommand={handleCommand}
        onStopOperation={wasmState.sendBreak}
        theme={theme}
        onThemeChange={setTheme}
        canRunCommands={canRunCommands}
        cacheItems={cachedAssets}
        cacheSyncing={isSyncingCache}
        onCacheUpload={handleCacheUpload}
        onCacheUse={handleCacheUse}
        onCacheDelete={handleCacheDelete}
        onCacheSync={syncCacheToFS}
        cachePathPrefix={CACHE_PATH_PREFIX}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {/* Main Content Area */}
      {activeTab === 'workbench' ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          <Tabs defaultValue="memory" className="flex-1 flex flex-col overflow-hidden">
            <div className="px-4 pt-3 border-b bg-card/50">
              <TabsList className="h-9">
                <TabsTrigger value="memory" className="text-xs gap-1.5">
                  <CreditCard className="h-3 w-3" />
                  Memory Map
                </TabsTrigger>
                <TabsTrigger value="editor" className="text-xs gap-1.5">
                  <Edit3 className="h-3 w-3" />
                  Block Editor
                </TabsTrigger>
                <TabsTrigger value="hex" className="text-xs gap-1.5">
                  <FileCode2 className="h-3 w-3" />
                  Hex Viewer
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="memory" className="flex-1 p-4 overflow-auto m-0">
              <CardMemoryMap
                onCommand={handleCommand}
                disabled={!canRunCommands}
              />
            </TabsContent>

            <TabsContent value="editor" className="flex-1 p-4 overflow-auto m-0">
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 h-full">
                <MifareEditorPanel
                  onCommand={handleCommand}
                  cacheItems={cachedAssets}
                  disabled={!canRunCommands}
                />
                <HexAsciiViewer dumps={cachedAssets} />
              </div>
            </TabsContent>

            <TabsContent value="hex" className="flex-1 p-4 overflow-auto m-0">
              <div className="h-full max-w-4xl mx-auto">
                <HexAsciiViewer dumps={cachedAssets} />
              </div>
            </TabsContent>
          </Tabs>
        </div>
      ) : (
        <div className="flex-1 grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-4 p-4 overflow-hidden">
          {/* Left Panel - Tag Info & History */}
          <div className="flex flex-col gap-4 min-h-0">
            <TagInfoPanel
              tagInfo={tagInfo}
              onRefresh={handleRefreshTag}
              onCopyUid={handleCopyUid}
              onCommand={handleCommand}
              disabled={!canRunCommands}
            />

            <Card className="flex-1 overflow-hidden">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  Recent Commands
                </CardTitle>
              </CardHeader>
              <CardContent className="overflow-auto">
                <div className="space-y-1">
                  {commandHistory.slice(-12).reverse().map((cmd, i) => (
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
          <div className="flex flex-col gap-3 min-w-0 min-h-0">
            <Card className="flex-1 overflow-hidden">
              <CardHeader className="pb-3 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <span>Terminal</span>
                    <Badge variant={connectionMode === 'wasm' ? 'success' : 'secondary'}>
                      {connectionMode === 'wasm' ? 'WASM passthrough' : 'Serial shell'}
                    </Badge>
                    {canRunCommands ? (
                      <Badge variant="outline">Live</Badge>
                    ) : (
                      <Badge variant="warning">Offline</Badge>
                    )}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleCommand('help')}
                    >
                      Help
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => terminalRef.current?.clear()}
                    >
                      <Trash2 className="h-3 w-3 mr-1" />
                      Clear
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    value={quickCommand}
                    onChange={(e) => setQuickCommand(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && runQuickCommand()}
                    placeholder="Send raw pm3 commands (hf mf autopwn --1k -f /pm3-cache/mfc_default_keys)"
                    className="flex-1"
                  />
                  <Button size="sm" onClick={runQuickCommand}>
                    <Send className="h-3 w-3 mr-1" />
                    Send
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setQuickCommand('hf mf autopwn --1k')}
                  >
                    <Sparkles className="h-3 w-3 mr-1" />
                    Autopwn
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setQuickCommand('hw tune')}
                  >
                    Tune
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setQuickCommand('hf iclass dump --ki 0')}
                  >
                    iCLASS
                  </Button>
                </div>
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
      )}

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
        <div className="flex items-center gap-3">
          <span className="mr-1">Mode:</span>
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
          <span>| Commands: {commandHistory.length}</span>
          <span>| Cache: {cachedAssets.length}</span>
        </div>
      </div>
    </div>
  );
}

export default App;
