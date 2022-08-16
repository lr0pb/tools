import { downloadData } from './highLevel/createBackup.js'

export const popups = {
  downloadBackup: (globals) => {
    return {
      emoji: emjs.box,
      text: 'Download your data backup?',
      strictClosing: true,
      action: async () => {
        const link = await downloadData(globals);
        link.click();
      }
    };
  }
};
