// Message handling between the Craft app (host) and the Litrus Mixer website editor iframe.
//
// The editor is opened for ONE shop. Multi-shop owners can change the active shop while the
// editor (or one of its queued autosaves) is still alive, and the app's product tables always
// belong to the currently active shop. Every message that reads or writes shop data is therefore
// checked against the shop id pinned when the editor opened: a message that arrives after the
// active shop changed is refused instead of being applied to the wrong shop.

export const SHOP_CHANGED_MESSAGE = 'The active shop changed while the website editor was open, so nothing was saved. Reopen the website editor for the shop you want to edit.';

export function isValidLitrusHtml(html) {
  return typeof html === 'string' && html.length <= 3_000_000 &&
    /^<!doctype\s+html>/i.test(html) &&
    html.includes('<meta name="eshop-filled-theme" content="litrus-mixer">');
}

/**
 * @param {object} options
 * @param {string} options.tenantId                      shop the editor was opened for (the active shop at open time)
 * @param {boolean} options.isDraftEditor                true while designing a shop that is not created yet
 * @param {() => string} options.getActiveTenantId       the app's currently active shop id
 * @param {() => Window|null} options.getFrameWindow     the editor iframe's window
 * @param {string} options.origin                        only messages from this origin are accepted
 * @param {() => void} options.sendTheme                 replies to "ready" with the app colours
 * @param {() => void} options.sendCatalog               replies to "ready" with the shop catalog
 * @param {(payload: object) => Promise<void>} options.saveDesign   saves a draft/publish payload for `tenantId`
 * @param {(request: {tenantId: string, isDraft: boolean, images: any[]}) => Promise<object>} options.searchImages
 * @param {(window: Window|null, message: object) => void} options.reply   posts a message to the editor
 * @param {(mode: string) => void} options.setMode       updates the host toolbar for editor/preview mode
 * @param {(message: string, type?: string) => void} options.toast
 * @param {() => void} options.finishDraft               continues the new-website flow after a draft publish
 * @param {() => void} options.openPublish               opens the publish dialog for the saved shop
 */
export function createLitrusHostMessageHandler(options) {
  const {
    tenantId, isDraftEditor, getActiveTenantId, getFrameWindow, origin, sendTheme, sendCatalog, saveDesign,
    searchImages, reply, setMode, toast, finishDraft, openPublish, onError = console.error
  } = options;
  const shopChanged = () => getActiveTenantId() !== tenantId;

  return async function handleLitrusMessage(event) {
    const frameWindow = getFrameWindow();
    if (!frameWindow || event.origin !== origin || event.source !== frameWindow) return;
    const data = event.data;
    const type = data?.type;
    const post = (message) => reply(frameWindow, message);

    if (type === 'craft-litrus-ready') {
      if (shopChanged()) { toast(SHOP_CHANGED_MESSAGE, 'danger'); return; }
      sendTheme();
      sendCatalog();
      return;
    }
    if (type === 'craft-litrus-mode') {
      setMode(data.mode);
      return;
    }
    if (type === 'craft-litrus-error') {
      toast(String(data.message || 'Litrus Mixer could not load the shop catalog.'), 'danger');
      return;
    }
    if (type === 'craft-litrus-image-request') {
      const requestId = String(data.requestId || '');
      const respond = (body) => post({ type: 'craft-litrus-image-response', requestId, ...body });
      if (!/^[a-zA-Z0-9_-]{1,80}$/.test(requestId) || !Array.isArray(data.images) || data.images.length > 20) {
        respond({ error: 'Invalid Craft image request.' });
        return;
      }
      if (shopChanged()) { respond({ error: SHOP_CHANGED_MESSAGE }); return; }
      try {
        const result = await searchImages({ tenantId: isDraftEditor ? 'main' : tenantId, isDraft: isDraftEditor, images: data.images });
        respond({ images: result.images || [], errors: result.errors || [], error: result.error || '' });
      } catch (error) {
        respond({ error: error.message || 'Could not load Craft images.' });
      }
      return;
    }
    if (type === 'craft-litrus-draft') {
      const requestId = String(data.requestId || '');
      const respond = (error) => post({
        type: 'craft-litrus-draft-saved', requestId, error: error ? String(error.message || error) : ''
      });
      if (!/^\d+-\d+$/.test(requestId) || !isValidLitrusHtml(data.html)) {
        respond(new Error('Litrus Mixer returned an incomplete shop draft.'));
        return;
      }
      if (shopChanged()) { respond(new Error(SHOP_CHANGED_MESSAGE)); return; }
      try {
        await saveDesign(data);
        respond(null);
      } catch (error) {
        onError('Litrus Mixer draft could not be saved in Craft.', error);
        respond(error);
      }
      return;
    }
    if (type !== 'craft-litrus-publish') return;
    if (!isValidLitrusHtml(data.html)) {
      toast('Litrus Mixer returned an incomplete storefront.', 'danger');
      return;
    }
    if (shopChanged()) { toast(SHOP_CHANGED_MESSAGE, 'danger'); return; }
    try {
      await saveDesign(data);
      if (isDraftEditor) finishDraft();
      else openPublish();
    } catch (error) {
      onError('Litrus Mixer changes could not be saved in Craft.', error);
      toast(error.message || 'Could not save the Litrus Mixer design.', 'danger');
    }
  };
}
