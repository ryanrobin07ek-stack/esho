// Nearby phone-to-phone sync over Wi-Fi (WebRTC + QR pairing) or Bluetooth. Moved verbatim
// from pos.js: change sync behavior only with the owner's OK.
import { saveBusinessRecord } from './business-records.js';
import { rows, run } from './db.js';
import { escapeHtml } from './format.js';
import { NearbyBluetooth } from './native-plugins.js';
import { listSales } from './sales.js';

export function createNearbySync({
  state, applyRemoteChange, seedCatalogueSync, loadState, refresh
}) {
  let nearbyPeer = null;
  let nearbyChannel = null;
  let nearbyOverlay = null;
  let nearbyIncoming = null;
  let nearbyRelaySession = null;
  let nearbyRole = '';
  let nearbyReady = false;
  let nearbyRemoteName = '';
  let nearbyLastSyncAt = '';
  let nearbyPendingChanges = new Map();
  let nearbyTransport = '';
  let nearbyBluetoothListeners = [];

  function setNearbySyncStatus(message) {
    state.nearbySyncStatus = message;
    const status = document.querySelector('[data-nearby-sync-status]');
    if (status) status.textContent = message;
  }

  function nearbyLocalDeviceName() {
    return window.Capacitor?.getPlatform?.() === 'android' ? 'Android phone' : 'Browser register';
  }

  function nearbyConnectedStatus(detail = '') {
    const peerName = nearbyRemoteName || 'nearby register';
    const lastUpdate = nearbyLastSyncAt ? ` · Last update ${nearbyLastSyncAt}` : '';
    setNearbySyncStatus(`Connected to ${peerName} · Live sync on${lastUpdate}${detail ? ` · ${detail}` : ''}`);
  }

  async function sendNearbyChange(change) {
    if (!nearbyChannel || nearbyChannel.readyState !== 'open') return;
    const key = `${change.entity}\u0000${change.record_id}`;
    nearbyPendingChanges.set(key, change);
    if (!nearbyReady) return;
    try {
      await flushNearbyChanges();
    } catch (error) {
      nearbyConnectedStatus(`Live update waiting to retry (${error.message || 'connection issue'})`);
    }
  }

  async function flushNearbyChanges() {
    if (!nearbyReady || nearbyChannel?.readyState !== 'open' || nearbyPendingChanges.size === 0) return;
    const changes = [...nearbyPendingChanges.entries()];
    nearbyPendingChanges.clear();
    for (let index = 0; index < changes.length; index += 1) {
      const [key, change] = changes[index];
      try {
        nearbyChannel.send(JSON.stringify({ type: 'record-change', tenant_id: state.cloudScopeId, change }));
      } catch (error) {
        for (const [pendingKey, pendingChange] of changes.slice(index)) {
          nearbyPendingChanges.set(pendingKey, pendingChange);
        }
        throw error;
      }
    }
  }

  async function markNearbyReady(detail = '') {
    nearbyReady = true;
    nearbyLastSyncAt = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    nearbyConnectedStatus(detail);
    await flushNearbyChanges();
  }

  async function applyNearbyChange(change) {
    const supported = ['supplier', 'purchase', 'ticket', 'sale', 'product', 'category', 'expense', 'setting'];
    if (!change || !supported.includes(change.entity) || typeof change.record_id !== 'string'
      || !change.payload || typeof change.payload !== 'object' || Array.isArray(change.payload)) {
      throw new Error('Nearby sync received a malformed business record.');
    }
    const current = (await rows(`SELECT payload_json,deleted,updated_at FROM pos_business_records
      WHERE tenant_id=? AND entity=? AND record_id=? LIMIT 1`,
    [state.cloudScopeId, change.entity, change.record_id]))[0];
    const payloadJson = JSON.stringify(change.payload);
    if (current && current.payload_json === payloadJson
      && Number(current.deleted) === (change.deleted ? 1 : 0)) return false;
    const currentTime = Date.parse(current?.updated_at || '') || 0;
    const incomingTime = Date.parse(change.changed_at || '') || 0;
    if (current && incomingTime && currentTime >= incomingTime) return false;
    await applyRemoteChange(change);
    await saveBusinessRecord(change.entity, change.record_id, change.payload, Boolean(change.deleted),
      Number(change.revision) || 0, state.cloudScopeId);
    await run(`DELETE FROM pos_cloud_outbox WHERE tenant_id=? AND entity=? AND record_id=?`,
      [state.cloudScopeId, change.entity, change.record_id]);
    return true;
  }

  async function createNearbySnapshot() {
    const tenantId = state.cloudScopeId;
    if (!tenantId || tenantId === 'local') {
      throw new Error('Choose a shop in Studio on both devices before pairing them.');
    }
    await seedCatalogueSync();
    for (const sale of await listSales()) {
      await saveBusinessRecord('sale', sale.receipt_number, sale, false, 0, tenantId);
    }
    const stored = await rows(`SELECT entity,record_id,payload_json,deleted,server_revision,updated_at
      FROM pos_business_records WHERE tenant_id=? ORDER BY entity,record_id`, [tenantId]);
    if (stored.length > 10000) throw new Error('This register has too many records for one nearby sync. Sync to Cloudflare first.');
    const records = stored.map((record) => {
      let payload;
      try {
        payload = JSON.parse(record.payload_json);
      } catch {
        throw new Error(`Saved ${record.entity} record ${record.record_id} is invalid and cannot be transferred.`);
      }
      return {
        entity: record.entity, record_id: record.record_id, payload,
        deleted: record.deleted === 1, revision: Number(record.server_revision) || 0,
        changed_at: record.updated_at
      };
    });
    return { tenant_id: tenantId, records };
  }

  async function sendNearbySnapshot(channel, purpose = 'initial') {
    if (channel.readyState !== 'open') throw new Error('Nearby device connection closed before sync started.');
    const snapshot = await createNearbySnapshot();
    const text = JSON.stringify(snapshot);
    if (new TextEncoder().encode(text).byteLength > 6 * 1024 * 1024) {
      throw new Error('Nearby sync is larger than the 6 MB transfer limit. Sync to Cloudflare first.');
    }
    const chunks = text.match(/[\s\S]{1,8000}/gu) || [];
    if (!chunks.length || chunks.length > 1000) throw new Error('Nearby sync exceeds the safe chunk limit. Sync to Cloudflare first.');
    const transferId = crypto.randomUUID();
    const send = async (message) => {
      while (channel.bufferedAmount > 256 * 1024 && channel.readyState === 'open') {
        await new Promise((resolve) => window.setTimeout(resolve, 30));
      }
      if (channel.readyState !== 'open') throw new Error('Nearby device connection closed during sync.');
      await channel.send(JSON.stringify(message));
    };
    await send({
      type: 'snapshot-start', transfer_id: transferId, tenant_id: snapshot.tenant_id,
      chunks: chunks.length, purpose
    });
    for (let index = 0; index < chunks.length; index += 1) {
      await send({ type: 'snapshot-chunk', transfer_id: transferId, index, content: chunks[index] });
    }
    setNearbySyncStatus(`Sent ${snapshot.records.length} records. Waiting for the other register to apply them…`);
  }

  async function applyNearbySnapshot(snapshot) {
    if (!snapshot || snapshot.tenant_id !== state.cloudScopeId || !Array.isArray(snapshot.records)
      || snapshot.records.length > 10000) {
      throw new Error('The nearby device belongs to a different shop or sent an invalid record set.');
    }
    let applied = 0;
    for (const change of snapshot.records) {
      if (await applyNearbyChange(change)) applied += 1;
    }
    await loadState();
    return applied;
  }

  async function handleNearbyMessage(channel, raw) {
    let message;
    try {
      message = JSON.parse(raw);
    } catch {
      throw new Error('Nearby register sent an unreadable sync message.');
    }
    if (message.type === 'snapshot-start') {
      if (message.tenant_id !== state.cloudScopeId || !Number.isSafeInteger(message.chunks)
        || message.chunks < 1 || message.chunks > 1000 || typeof message.transfer_id !== 'string') {
        throw new Error('Nearby register sent invalid pairing data.');
      }
      nearbyIncoming = {
        transferId: message.transfer_id, tenantId: message.tenant_id,
        parts: new Array(message.chunks), received: 0, purpose: message.purpose || 'initial'
      };
      setNearbySyncStatus(`Receiving nearby POS data (${message.chunks} parts)…`);
      return;
    }
    if (message.type === 'snapshot-chunk') {
      if (!nearbyIncoming || message.transfer_id !== nearbyIncoming.transferId
        || !Number.isSafeInteger(message.index) || message.index < 0 || message.index >= nearbyIncoming.parts.length
        || typeof message.content !== 'string' || message.content.length > 8000) {
        throw new Error('Nearby register sent an invalid data chunk.');
      }
      if (nearbyIncoming.parts[message.index] === undefined) {
        nearbyIncoming.parts[message.index] = message.content;
        nearbyIncoming.received += 1;
        if (nearbyIncoming.received === nearbyIncoming.parts.length
          || nearbyIncoming.received % 20 === 0) {
          setNearbySyncStatus(`Receiving nearby POS data (${nearbyIncoming.received}/${nearbyIncoming.parts.length} parts)…`);
        }
      }
      if (nearbyIncoming.received === nearbyIncoming.parts.length) {
        const transfer = nearbyIncoming;
        nearbyIncoming = null;
        const snapshot = JSON.parse(transfer.parts.join(''));
        const count = await applyNearbySnapshot(snapshot);
        channel.send(JSON.stringify({ type: 'snapshot-ack', count, purpose: transfer.purpose }));
        if (transfer.purpose === 'initial') {
          if (nearbyRole === 'guest') {
            setNearbySyncStatus(`Connected to ${nearbyRemoteName || 'nearby register'}. Waiting for the first register…`);
          } else {
            await markNearbyReady(`${count} records received`);
          }
        } else {
          await markNearbyReady(`${count} records received`);
        }
        await refresh();
      }
      return;
    }
    if (message.type === 'snapshot-ack') {
      if (message.purpose === 'initial' && nearbyRole === 'host') {
        setNearbySyncStatus(`Initial records received. Getting the other register’s records…`);
        channel.send(JSON.stringify({ type: 'snapshot-request' }));
      } else if (message.purpose === 'initial-response') {
        await markNearbyReady(`${Number(message.count) || 0} records received`);
      } else {
        nearbyLastSyncAt = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        nearbyConnectedStatus('Change delivered');
      }
      await refresh();
      return;
    }
    if (message.type === 'snapshot-request') {
      await sendNearbySnapshot(channel, 'initial-response');
      return;
    }
    if (message.type === 'hello') {
      nearbyRemoteName = typeof message.device_name === 'string' ? message.device_name.slice(0, 60) : 'nearby register';
      if (nearbyReady) nearbyConnectedStatus();
      return;
    }
    if (message.type === 'record-change') {
      if (!nearbyReady || message.tenant_id !== state.cloudScopeId) {
        throw new Error('A live update arrived from a different shop or before pairing finished.');
      }
      const applied = await applyNearbyChange(message.change);
      nearbyLastSyncAt = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      nearbyConnectedStatus(applied ? 'New change received' : 'Already up to date');
      if (applied) await refresh();
      channel.send(JSON.stringify({
        type: 'record-change-ack',
        entity: message.change.entity,
        record_id: message.change.record_id
      }));
      return;
    }
    if (message.type === 'record-change-ack') {
      nearbyLastSyncAt = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      nearbyConnectedStatus('Change delivered');
      return;
    }
    throw new Error('Nearby register sent an unsupported sync message.');
  }

  function attachNearbyChannel(channel, alreadyOpen = false) {
    nearbyChannel = channel;
    const onopen = () => {
      nearbyReady = false;
      nearbyRemoteName = '';
      channel.send(JSON.stringify({ type: 'hello', device_name: nearbyLocalDeviceName() }));
      setNearbySyncStatus('Connection open. Checking shop records before live sync…');
      if (nearbyRole === 'host') {
        void sendNearbySnapshot(channel, 'initial').catch((error) => setNearbySyncStatus(error.message || 'Nearby sync failed.'));
      }
    };
    channel.onopen = onopen;
    channel.onmessage = (event) => {
      void handleNearbyMessage(channel, event.data).catch((error) => {
        setNearbySyncStatus(error.message || 'Nearby sync failed.');
      });
    };
    channel.onclose = () => {
      nearbyReady = false;
      nearbyPendingChanges.clear();
      setNearbySyncStatus('Nearby device disconnected. Live sync is off.');
    };
    channel.onerror = () => {
      nearbyReady = false;
      setNearbySyncStatus('Nearby device connection failed. Live sync is off.');
    };
    if (alreadyOpen) onopen();
  }

  async function clearNearbyBluetoothListeners() {
    const listeners = nearbyBluetoothListeners;
    nearbyBluetoothListeners = [];
    await Promise.all(listeners.map((listener) => listener.remove()));
  }

  async function connectNearbyBluetoothChannel() {
    if (nearbyChannel?.readyState === 'open') return;
    const channel = {
      readyState: 'open',
      bufferedAmount: 0,
      send: (data) => NearbyBluetooth.send({ data }),
      close: () => {}
    };
    attachNearbyChannel(channel, true);
  }

  async function listenForNearbyBluetoothDevices() {
    await clearNearbyBluetoothListeners();
    nearbyBluetoothListeners = await Promise.all([
      NearbyBluetooth.addListener('connected', (event) => {
        setNearbySyncStatus(`Connected to ${event.deviceName || 'nearby register'} over Bluetooth.`);
        void connectNearbyBluetoothChannel();
      }),
      NearbyBluetooth.addListener('message', (event) => {
        if (!nearbyChannel) return;
        void handleNearbyMessage(nearbyChannel, event.data).catch((error) => {
          setNearbySyncStatus(error.message || 'Bluetooth sync failed.');
        });
      }),
      NearbyBluetooth.addListener('deviceFound', (event) => {
        const list = nearbyOverlay?.querySelector('[data-bt-device-list]');
        if (!list || !event.address) return;
        const existing = [...list.querySelectorAll('[data-bt-address]')]
          .find((button) => button.dataset.btAddress === event.address);
        if (existing) return;
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'btn-secondary';
        item.dataset.btAddress = event.address;
        item.textContent = `${event.name || 'Nearby register'} (${event.address})`;
        item.addEventListener('click', async () => {
          item.disabled = true;
          setNearbySyncStatus(`Connecting to ${event.name || 'nearby register'}…`);
          try {
            await NearbyBluetooth.connect({ address: event.address });
            nearbyOverlay?.remove();
            nearbyOverlay = null;
          } catch (error) {
            item.disabled = false;
            setNearbySyncStatus(error.message || 'Could not connect over Bluetooth.');
          }
        });
        list.appendChild(item);
      }),
      NearbyBluetooth.addListener('discoveryFinished', () => {
        const status = nearbyOverlay?.querySelector('[data-bt-discovery-status]');
        if (status) status.textContent = 'Search finished. Tap Search again or select a discovered register.';
      }),
      NearbyBluetooth.addListener('disconnected', () => {
        if (nearbyChannel) nearbyChannel.readyState = 'closed';
        nearbyReady = false;
        nearbyPendingChanges.clear();
        setNearbySyncStatus('Bluetooth register disconnected. Live sync is off.');
      }),
      NearbyBluetooth.addListener('error', (event) => {
        setNearbySyncStatus(event.message || 'Bluetooth sync failed.');
      })
    ]);
  }

  async function startBluetoothNearbySync(mode) {
    if (window.Capacitor?.getPlatform?.() !== 'android') {
      throw new Error('Bluetooth phone-to-phone sync is available in the Android app, not in a browser or web register.');
    }
    if (nearbyChannel || nearbyPeer) throw new Error('End the current nearby sync session before starting another.');
    if (!state.cloudScopeId || state.cloudScopeId === 'local') {
      throw new Error('Choose the same shop in Studio on both phones before pairing.');
    }
    nearbyRole = mode === 'host' ? 'host' : 'guest';
    await refresh();
    nearbyTransport = 'bluetooth';
    await listenForNearbyBluetoothDevices();
    if (mode === 'host') {
      setNearbySyncStatus('Allow Bluetooth visibility so the other phone can find this register.');
      await NearbyBluetooth.startHosting();
      setNearbySyncStatus('Bluetooth receiver is ready. On the other phone, tap Find a Bluetooth register.');
      return;
    }
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:10001;background:#0009;display:grid;place-items:center;padding:16px';
    overlay.innerHTML = `<section role="dialog" aria-modal="true" style="width:min(100%,520px);max-height:90vh;overflow:auto;background:#fff;color:#18181b;padding:20px;border-radius:16px">
      <h2>Find a Bluetooth register</h2>
      <p>Ask the other phone to tap “Receive over Bluetooth” and approve visibility. Select only a phone you trust.</p>
      <p data-bt-discovery-status role="status">Searching for nearby phones…</p>
      <div data-bt-device-list style="display:grid;gap:8px"></div>
      <div class="pos-form-actions"><button type="button" class="btn-secondary" data-bt-search>Search again</button>
      <button type="button" class="btn-secondary" data-bt-cancel>Cancel</button></div></section>`;
    document.body.appendChild(overlay);
    nearbyOverlay = overlay;
    overlay.querySelector('[data-bt-cancel]').addEventListener('click', () => {
      overlay.remove();
      nearbyOverlay = null;
      void stopNearbySync();
    }, { once: true });
    overlay.querySelector('[data-bt-search]').addEventListener('click', async () => {
      overlay.querySelector('[data-bt-device-list]').replaceChildren();
      overlay.querySelector('[data-bt-discovery-status]').textContent = 'Searching for nearby phones…';
      try {
        await NearbyBluetooth.startDiscovery();
      } catch (error) {
        setNearbySyncStatus(error.message || 'Bluetooth search failed.');
      }
    });
    await NearbyBluetooth.startDiscovery();
  }

  function prepareNearbyPeer(peer) {
    nearbyPeer = peer;
    peer.ondatachannel = (event) => attachNearbyChannel(event.channel);
    peer.onconnectionstatechange = () => {
      if (['failed', 'disconnected', 'closed'].includes(peer.connectionState)) {
        setNearbySyncStatus(`Nearby connection ${peer.connectionState}.`);
      }
    };
  }

  async function waitForIceGathering(peer) {
    if (peer.iceGatheringState === 'complete') return;
    await new Promise((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        peer.removeEventListener('icegatheringstatechange', onStateChange);
        reject(new Error('Could not prepare the Wi-Fi pairing code. Put both devices on the same Wi-Fi or phone hotspot, then try again.'));
      }, 20000);
      const onStateChange = () => {
        if (peer.iceGatheringState === 'complete') {
          window.clearTimeout(timeout);
          peer.removeEventListener('icegatheringstatechange', onStateChange);
          resolve();
        }
      };
      peer.addEventListener('icegatheringstatechange', onStateChange);
      onStateChange();
    });
  }

  async function showNearbyQr(title, data, onClose = () => {}) {
    const { BrowserQRCodeSvgWriter } = await import('@zxing/browser');
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:10001;background:#0009;display:grid;place-items:center;padding:16px';
    overlay.innerHTML = `<section role="dialog" aria-modal="true" style="width:min(100%,520px);max-height:90vh;overflow:auto;background:#fff;color:#18181b;padding:20px;border-radius:16px;text-align:center">
      <h2>${escapeHtml(title)}</h2><p>Scan this QR once using the trusted phone you want to sync with. The PC will ask you before any data is transferred.</p>
      <div data-nearby-qr style="max-width:100%;overflow:auto"></div>
      <p data-nearby-qr-status role="status">Waiting for your phone to scan this code…</p>
      <button type="button" class="btn-secondary" data-nearby-close>Close</button></section>`;
    const svg = new BrowserQRCodeSvgWriter().write(JSON.stringify(data), 320, 320);
    svg.style.maxWidth = '100%';
    overlay.querySelector('[data-nearby-qr]').appendChild(svg);
    document.body.appendChild(overlay);
    nearbyOverlay?.remove();
    nearbyOverlay = overlay;
    overlay.querySelector('[data-nearby-close]').addEventListener('click', () => {
      overlay.remove();
      if (nearbyOverlay === overlay) nearbyOverlay = null;
      onClose();
    }, { once: true });
  }

  async function scanNearbyQr() {
    const { BrowserQRCodeReader } = await import('@zxing/browser');
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:10002;background:#0009;display:grid;place-items:center;padding:16px';
    overlay.innerHTML = `<section role="dialog" aria-modal="true" style="width:min(100%,520px);background:#fff;color:#18181b;padding:20px;border-radius:16px">
      <h2>Scan nearby pairing QR</h2><video style="width:100%;max-height:55vh;object-fit:contain"></video>
      <p data-nearby-scan-status>Allow camera access and center the QR in view.</p>
      <button type="button" class="btn-secondary" data-nearby-scan-close>Cancel</button></section>`;
    document.body.appendChild(overlay);
    const video = overlay.querySelector('video');
    let controls = null;
    let settled = false;
    return new Promise((resolve, reject) => {
      const close = (value, error) => {
        if (settled) return;
        settled = true;
        controls?.stop();
        video.srcObject?.getTracks().forEach((track) => track.stop());
        overlay.remove();
        if (nearbyOverlay === overlay) nearbyOverlay = null;
        if (error) reject(error);
        else resolve(value);
      };
      overlay.querySelector('[data-nearby-scan-close]').addEventListener('click', () => close(''), { once: true });
      const reader = new BrowserQRCodeReader();
      void reader.decodeFromVideoDevice(undefined, video, (result, error) => {
        if (result) {
          try {
            const data = JSON.parse(result.getText());
            if (data.type !== 'offer' || typeof data.pairingId !== 'string'
              || typeof data.guestToken !== 'string' || typeof data.tenantId !== 'string') {
              throw new Error('This QR is not a nearby pairing code.');
            }
            close(data);
          } catch (parseError) {
            overlay.querySelector('[data-nearby-scan-status]').textContent =
              parseError instanceof Error ? parseError.message : 'The pairing QR is invalid.';
          }
        } else if (error && error.name !== 'NotFoundException') {
          overlay.querySelector('[data-nearby-scan-status]').textContent = 'Keep the pairing QR inside the camera view.';
        }
      }).then((value) => {
        controls = value;
        if (settled) controls.stop();
      }).catch((error) => close('', error));
    });
  }

  async function startNearbySync(mode) {
    if (typeof window.RTCPeerConnection !== 'function') {
      throw new Error('This browser does not support encrypted nearby device sync. Use Cloudflare sync on this device.');
    }
    const tenantId = state.cloudScopeId;
    if (!tenantId || tenantId === 'local') throw new Error('Choose the same shop in Studio on both devices before pairing.');
    if (nearbyPeer) throw new Error('End the current nearby sync session before starting another.');
    if (typeof window.EshopInventoryBridge?.nearbyPairing !== 'function') {
      throw new Error('This register needs an app update to use one-scan Wi-Fi pairing.');
    }
    setNearbySyncStatus(`Preparing encrypted Wi-Fi pairing for shop “${tenantId}”…`);
    const peer = new RTCPeerConnection({ iceServers: [] });
    prepareNearbyPeer(peer);
    await refresh();
    if (mode === 'create') {
      nearbyRole = 'host';
      setNearbySyncStatus('Creating a secure pairing code. Keep both registers online and on the same Wi-Fi…');
      attachNearbyChannel(peer.createDataChannel('eshop-pos-sync', { ordered: true }));
      await peer.setLocalDescription(await peer.createOffer());
      await waitForIceGathering(peer);
      const relay = await window.EshopInventoryBridge.nearbyPairing(tenantId, 'POST', {
        action: 'create',
        offer: { type: 'offer', sdp: peer.localDescription.sdp }
      });
      nearbyRelaySession = { id: relay.pairing_id, tenantId, sessionToken: relay.host_token };
      await showNearbyQr('Scan this with your phone', {
        type: 'offer', pairingId: relay.pairing_id, guestToken: relay.guest_token, tenantId
      }, () => {
        if (nearbyRelaySession?.id === relay.pairing_id) {
          void stopNearbySync('Nearby pairing cancelled.');
        }
      });
      setNearbySyncStatus('QR ready. Scan it once with your phone; then approve the phone on this PC.');
      void waitForNearbyAnswer(peer, tenantId, relay.pairing_id, relay.host_token);
      return;
    }
    nearbyRole = 'guest';
    setNearbySyncStatus('Opening the camera to scan the PC pairing code…');
    const offer = await scanNearbyQr();
    if (!offer || offer.type !== 'offer') throw new Error('That QR is not a nearby pairing offer.');
    if (offer.tenantId !== tenantId) throw new Error('Select the same shop on the phone and PC before pairing.');
    const relayOffer = await window.EshopInventoryBridge.nearbyPairing(tenantId, 'GET', {
      id: offer.pairingId,
      sessionToken: offer.guestToken
    });
    if (!relayOffer.offer || relayOffer.offer.type !== 'offer' || typeof relayOffer.offer.sdp !== 'string') {
      throw new Error('The PC pairing code expired. Create a new QR and scan it again.');
    }
    await peer.setRemoteDescription(relayOffer.offer);
    setNearbySyncStatus('Sending a secure answer. Check the PC to approve this phone…');
    await peer.setLocalDescription(await peer.createAnswer());
    await waitForIceGathering(peer);
    await window.EshopInventoryBridge.nearbyPairing(tenantId, 'POST', {
      action: 'answer',
      id: offer.pairingId,
      answer: { type: 'answer', sdp: peer.localDescription.sdp },
      sessionToken: offer.guestToken
    });
    setNearbySyncStatus('Phone verified. Waiting for the PC to approve the connection…');
  }

  async function waitForNearbyAnswer(peer, tenantId, id, hostToken) {
    const expiresAt = Date.now() + 180_000;
    try {
      while (Date.now() < expiresAt && nearbyPeer === peer) {
        const result = await window.EshopInventoryBridge.nearbyPairing(tenantId, 'GET', {
          id, sessionToken: hostToken
        });
        if (result.answer) {
          const qrStatus = nearbyOverlay?.querySelector('[data-nearby-qr-status]');
          if (qrStatus) qrStatus.textContent = 'Your phone is ready. Approve the connection on this PC to transfer POS data.';
          setNearbySyncStatus('Your phone is ready. Approve the connection on this PC to transfer POS data.');
          const accepted = window.confirm(`A phone scanned this PC’s pairing QR for shop “${tenantId}”. Allow it to connect and transfer POS data?`);
          if (!accepted) {
            await stopNearbySync('Connection declined. No POS data was transferred.');
            return;
          }
          await peer.setRemoteDescription(result.answer);
          let cleanupWarning = '';
          try {
            await window.EshopInventoryBridge.nearbyPairing(tenantId, 'DELETE', {
              id, sessionToken: hostToken
            });
          } catch (error) {
            cleanupWarning = ` Temporary pairing data will expire shortly (${error.message || 'cleanup failed'}).`;
          }
          nearbyRelaySession = null;
          nearbyOverlay?.remove();
          nearbyOverlay = null;
          setNearbySyncStatus(`Connection approved. Connecting directly over Wi-Fi…${cleanupWarning}`);
          return;
        }
        await new Promise((resolve) => window.setTimeout(resolve, 1200));
      }
      if (nearbyPeer === peer) throw new Error('Pairing timed out. Create a new QR and try again.');
    } catch (error) {
      if (nearbyPeer === peer) {
        await stopNearbySync(error instanceof Error ? `Nearby pairing failed: ${error.message}` : 'Nearby pairing failed.');
      }
    }
  }

  async function stopNearbySync(message = 'Nearby sync session ended.') {
    const relay = nearbyRelaySession;
    nearbyRelaySession = null;
    if (relay) {
      try {
        await window.EshopInventoryBridge?.nearbyPairing?.(relay.tenantId, 'DELETE', {
          id: relay.id, sessionToken: relay.sessionToken
        });
      } catch (error) {
        message += ` Pairing cleanup failed: ${error.message || 'check your internet connection.'}`;
      }
    }
    if (nearbyTransport === 'bluetooth') {
      try {
        await NearbyBluetooth.stop();
      } catch (error) {
        setNearbySyncStatus(error.message || 'Could not stop Bluetooth sync cleanly.');
      }
      await clearNearbyBluetoothListeners();
    }
    nearbyTransport = '';
    nearbyChannel?.close();
    nearbyPeer?.close();
    nearbyChannel = null;
    nearbyPeer = null;
    nearbyIncoming = null;
    nearbyRole = '';
    nearbyReady = false;
    nearbyRemoteName = '';
    nearbyPendingChanges.clear();
    nearbyOverlay?.remove();
    nearbyOverlay = null;
    setNearbySyncStatus(message);
  }

  return { sendNearbyChange, startBluetoothNearbySync, startNearbySync, stopNearbySync };
}
