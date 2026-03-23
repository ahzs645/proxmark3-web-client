import { useCallback, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { MagicHeader } from "@/features/magic/components/MagicHeader";
import { MagicCardTypeSection } from "@/features/magic/components/MagicCardTypeSection";
import { MagicUidSection } from "@/features/magic/components/MagicUidSection";
import { MagicBlock0Section } from "@/features/magic/components/MagicBlock0Section";
import { MagicQuickOperationsSection } from "@/features/magic/components/MagicQuickOperationsSection";
import { MagicWarningSection } from "@/features/magic/components/MagicWarningSection";
import { buildBlock0Preview } from "@/features/magic/block0";
import {
  buildDetectCommand,
  buildLoadDumpCommand,
  buildSetUidCommand,
  buildUnlockCommands,
  buildViewCardCommand,
  buildWipeCommand,
  buildWriteBlock0Command,
} from "@/features/magic/commands";
import { CARD_TYPES } from "@/features/magic/constants";
import { calculateBcc, generateRandomUid, validateUid } from "@/features/magic/uid";
import type { KeyType, MagicCardPanelProps, MagicCardType } from "@/features/magic/types";

export function MagicCardPanel({
  onCommand,
  disabled = false,
  currentUid = "",
  currentAtqa = "0004",
  currentSak = "08",
}: MagicCardPanelProps) {
  const [cardType, setCardType] = useState<MagicCardType>("gen1a");
  const [uid, setUid] = useState(currentUid || "");
  const [atqa, setAtqa] = useState(currentAtqa);
  const [sak, setSak] = useState(currentSak);
  const [gen4Password, setGen4Password] = useState("00000000");
  const [authKey, setAuthKey] = useState("FFFFFFFFFFFF");
  const [authKeyType, setAuthKeyType] = useState<KeyType>("A");
  const [showBlock0Builder, setShowBlock0Builder] = useState(false);

  const [block0Uid, setBlock0Uid] = useState("");
  const [block0Bcc, setBlock0Bcc] = useState("");
  const [block0Sak, setBlock0Sak] = useState("08");
  const [block0Atqa, setBlock0Atqa] = useState("0004");
  const [block0Manufacturer, setBlock0Manufacturer] = useState("00000000000000");

  const uidValidation = useMemo(() => validateUid(uid), [uid]);
  const calculatedBcc = useMemo(() => calculateBcc(block0Uid), [block0Uid]);
  const block0Preview = useMemo(
    () =>
      buildBlock0Preview({
        uid: block0Uid,
        bcc: block0Bcc,
        calculatedBcc,
        sak: block0Sak,
        atqa: block0Atqa,
        manufacturer: block0Manufacturer,
      }),
    [block0Uid, block0Bcc, calculatedBcc, block0Sak, block0Atqa, block0Manufacturer],
  );

  const handleUidChange = useCallback((value: string) => {
    setUid(
      value
        .toUpperCase()
        .replace(/[^A-F0-9]/gi, "")
        .slice(0, 20),
    );
  }, []);

  const handleRandomUid = useCallback(() => {
    const length = uid.length === 14 ? 7 : uid.length === 20 ? 10 : 4;
    setUid(generateRandomUid(length));
  }, [uid.length]);

  const copyToClipboard = useCallback((text: string) => {
    void navigator.clipboard.writeText(text);
  }, []);

  const handleSetUid = useCallback(() => {
    const command = buildSetUidCommand({
      cardType,
      uid,
      atqa,
      sak,
      gen4Password,
    });

    if (command) {
      onCommand(command);
    }
  }, [atqa, cardType, gen4Password, onCommand, sak, uid]);

  const handleWriteBlock0 = useCallback(() => {
    const command = buildWriteBlock0Command({
      cardType,
      block0Preview,
      authKeyType,
      authKey,
      gen4Password,
    });

    if (command) {
      onCommand(command);
    }
  }, [authKey, authKeyType, block0Preview, cardType, gen4Password, onCommand]);

  const handleUnlock = useCallback(() => {
    buildUnlockCommands(cardType, gen4Password).forEach((command) => onCommand(command));
  }, [cardType, gen4Password, onCommand]);

  const handleWipe = useCallback(() => {
    const command = buildWipeCommand(cardType, gen4Password);
    if (command) {
      onCommand(command);
    }
  }, [cardType, gen4Password, onCommand]);

  const handleDetect = useCallback(() => {
    onCommand(buildDetectCommand());
  }, [onCommand]);

  const handleViewCard = useCallback(() => {
    onCommand(buildViewCardCommand());
  }, [onCommand]);

  const handleLoadDump = useCallback(() => {
    onCommand(buildLoadDumpCommand());
  }, [onCommand]);

  const typeConfig = CARD_TYPES[cardType];

  return (
    <Card className="flex h-full flex-col overflow-hidden">
      <MagicHeader disabled={disabled} onDetect={handleDetect} />
      <CardContent className="flex-1 overflow-auto p-0">
        <MagicCardTypeSection
          cardType={cardType}
          onCardTypeChange={setCardType}
          typeConfig={typeConfig}
        />
        <MagicUidSection
          disabled={disabled}
          cardType={cardType}
          uid={uid}
          uidValidation={uidValidation}
          onUidChange={handleUidChange}
          onRandomUid={handleRandomUid}
          onCopyUid={copyToClipboard}
          atqa={atqa}
          onAtqaChange={setAtqa}
          sak={sak}
          onSakChange={setSak}
          gen4Password={gen4Password}
          onGen4PasswordChange={setGen4Password}
          onWriteUid={handleSetUid}
        />
        <MagicBlock0Section
          disabled={disabled}
          cardType={cardType}
          showBlock0Builder={showBlock0Builder}
          onToggleBlock0Builder={() => setShowBlock0Builder((prev) => !prev)}
          block0Uid={block0Uid}
          onBlock0UidChange={setBlock0Uid}
          block0Bcc={block0Bcc}
          onBlock0BccChange={setBlock0Bcc}
          calculatedBcc={calculatedBcc}
          block0Sak={block0Sak}
          onBlock0SakChange={setBlock0Sak}
          block0Atqa={block0Atqa}
          onBlock0AtqaChange={setBlock0Atqa}
          block0Manufacturer={block0Manufacturer}
          onBlock0ManufacturerChange={setBlock0Manufacturer}
          block0Preview={block0Preview}
          authKey={authKey}
          onAuthKeyChange={setAuthKey}
          authKeyType={authKeyType}
          onAuthKeyTypeChange={setAuthKeyType}
          gen4Password={gen4Password}
          onGen4PasswordChange={setGen4Password}
          onCopyBlock0Preview={copyToClipboard}
          onWriteBlock0={handleWriteBlock0}
        />
        <MagicQuickOperationsSection
          disabled={disabled}
          cardType={cardType}
          onUnlock={handleUnlock}
          onViewCard={handleViewCard}
          onWipe={handleWipe}
          onLoadDump={handleLoadDump}
        />
        <MagicWarningSection />
      </CardContent>
    </Card>
  );
}

export default MagicCardPanel;
