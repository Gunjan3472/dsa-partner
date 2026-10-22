export default defineContentScript({
  matches: ['*://*.leetcode.com/problems/*'],
  world: 'MAIN',
  main() {
    setInterval(() => {
      const monaco = (window as any).monaco;
      const models = monaco?.editor?.getModels?.();
      if (!models || models.length === 0) return;

      const model = models[0];
      window.postMessage(
        {
          source: 'dsa-partner',
          code: model.getValue(),
          language: model.getLanguageId(),
        },
        '*'
      );
    }, 1000);
  },
});