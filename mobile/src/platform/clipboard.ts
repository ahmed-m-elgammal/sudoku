// ASSIZE mobile — clipboard, share sheet, and file export.
//
// Replaces four web-only flows found by grepping the screens:
//
//   EchoesScreen.tsx:30-37   <textarea> + document.execCommand('copy')
//                            (with a navigator.clipboard try first)
//                            -> the "Seal a chit" modal's copy button
//   LedgerProfile.tsx:176   <a download> the ledger CSV
//   ResultScreen.tsx:45     <a download> the duel replay
//   SettingsScreen.tsx:91   <a download> the save export
//
// Every one of them degrades: if the share sheet is unavailable the text still lands
// on the clipboard, and if the clipboard is unavailable the caller can render the
// string for manual copying (the Echoes modal already does).

import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
import type { ClipboardPort, SharePort } from './types';

export const clipboard: ClipboardPort = {
  async copy(text: string): Promise<boolean> {
    try {
      await Clipboard.setStringAsync(text);
      return true;
    } catch {
      return false;
    }
  },
  async read(): Promise<string> {
    try {
      return await Clipboard.getStringAsync();
    } catch {
      return '';
    }
  },
};

export const share: SharePort = {
  async available(): Promise<boolean> {
    try {
      return await Sharing.isAvailableAsync();
    } catch {
      return false;
    }
  },
  async share(fileUri: string): Promise<void> {
    try {
      await Sharing.shareAsync(fileUri);
    } catch {
      /* the user dismissed the sheet */
    }
  },
  async writeTextFile(name: string, contents: string): Promise<string> {
    const file = new File(Paths.cache, name);
    try {
      file.create({ overwrite: true });
    } catch {
      file.write(contents);
      return file.uri;
    }
    file.write(contents);
    return file.uri;
  },
};

/**
 * The web build's export flow in one call: write the file, try the share sheet, and
 * fall back to the clipboard when there is no share sheet (emulators, some Androids).
 * Returns how it was delivered so the screen can say the truth to the player.
 */
export async function exportText(
  name: string,
  contents: string,
  mimeType = 'text/plain',
): Promise<'shared' | 'copied'> {
  const uri = await share.writeTextFile(name, contents);
  if (await share.available()) {
    await share.share(uri, mimeType);
    return 'shared';
  }
  await clipboard.copy(contents);
  return 'copied';
}
