// Split shop screen.
// Moved verbatim out of src/app/main.js (the StudioRenderers object); main.js spreads these back in at the same spots.
import { AppController, AppUtils, SQLiteEngine } from './main.js';

export const splitShopScreen = {
  renderSplitShop(snapshot, tenant) {
    const savedBySku = new Map();
    [...(snapshot.localAllocations || []), ...(snapshot.remoteAllocations || [])]
      .forEach(allocation => savedBySku.set(String(allocation.sku || ""), allocation));
    const rows = snapshot.products.map((product, index) => {
      const skuKey = String(product.sku || "").trim();
      const saved = skuKey ? savedBySku.get(skuKey) : null;
      const sources = [...product.sources];
      const posEnabled = saved ? Number(saved.pos_enabled) === 1 : sources.includes("POS");
      const webEnabled = saved ? Number(saved.web_enabled) === 1 : sources.includes("Website");
      const posStock = Number(saved?.pos_stock ?? product.posStock) || 0;
      const webStock = Number(saved?.web_stock ?? product.webStock) || 0;
      const needsMasterConfirmation = !saved && sources.includes("POS") && sources.includes("Website");
      const masterStock = needsMasterConfirmation ? null : Number(saved?.master_stock ?? (posStock + webStock)) || 0;
      const posPercent = masterStock ? (posStock / masterStock * 100) : (posEnabled && !needsMasterConfirmation ? 100 : 0);
      const webPercent = masterStock ? (webStock / masterStock * 100) : (webEnabled && !posEnabled && !needsMasterConfirmation ? 100 : 0);
      const source = posEnabled && webEnabled ? "both" : posEnabled ? "pos" : "web";
      return `<tr data-split-row data-product-index="${index}" data-sku="${AppUtils.escapeHTML(product.sku || "")}" data-name="${AppUtils.escapeHTML(product.name)}" data-product-id="${AppUtils.escapeHTML(String(product.posProductId || product.webProductId || ""))}" data-source="${source}">
        <td><input type="checkbox" aria-label="Select ${AppUtils.escapeHTML(product.name)}" data-split-select ${skuKey ? "" : "disabled"}></td>
        <td><strong>${AppUtils.escapeHTML(product.name)}</strong><small style="display:block;color:var(--text-muted)">${AppUtils.escapeHTML(product.sku || "SKU required")} · ${sources.map(sourceName => sourceName === "Website" ? "Web" : sourceName).join(" + ")}</small></td>
        <td><label><input type="checkbox" data-split-pos ${posEnabled ? "checked" : ""}> POS</label></td>
        <td><label><input type="checkbox" data-split-web ${webEnabled ? "checked" : ""}> Web</label></td>
        <td><input type="number" min="0" step="1" value="${masterStock ?? ""}" placeholder="${needsMasterConfirmation ? "Enter total" : ""}" data-split-master aria-label="Master stock for ${AppUtils.escapeHTML(product.name)}"></td>
        <td><label><input type="number" min="0" max="100" step="0.01" value="${posPercent.toFixed(2)}" data-split-pos-percent aria-label="POS allocation percent for ${AppUtils.escapeHTML(product.name)}">%</label><strong data-split-pos-quantity>${posStock}</strong></td>
        <td><label><input type="number" min="0" max="100" step="0.01" value="${webPercent.toFixed(2)}" data-split-web-percent aria-label="Web allocation percent for ${AppUtils.escapeHTML(product.name)}">%</label><strong data-split-web-quantity>${webStock}</strong></td>
        <td><strong data-split-reserved>${masterStock === null ? "Set total" : Math.max(0, masterStock - posStock - webStock)}</strong></td>
      </tr>`;
    }).join("");
    const remoteStatus = snapshot.remoteAllocationsError
      ? `Cloud allocation settings could not be loaded: ${AppUtils.escapeHTML(snapshot.remoteAllocationsError)}`
      : snapshot.remoteAllocations
        ? `${snapshot.remoteAllocations.length} saved cloud allocation${snapshot.remoteAllocations.length === 1 ? "" : "s"} loaded for ${AppUtils.escapeHTML(tenant.name || tenant.id)}.`
        : "Cloud allocation settings have not been loaded.";
    return `<section class="studio-workspace-section">
      <article class="studio-panel">
        <span class="studio-workspace-kicker">MAIN STORE · INVENTORY CONTROL</span>
        <h2>Split shop</h2>
        <p class="studio-panel-note">POS and Web products stay in their existing channels until you select and save them here. Allocate whole units from one master total; Reserved is the remainder and cannot be sold.</p>
        <p class="studio-panel-note" role="status" data-split-status>${remoteStatus}</p>
        <div class="studio-inline-actions" style="align-items:end;flex-wrap:wrap">
          <label>Bulk POS % <input type="number" min="0" max="100" step="0.01" value="70" data-split-bulk-pos></label>
          <label>Bulk Web % <input type="number" min="0" max="100" step="0.01" value="20" data-split-bulk-web></label>
          <button type="button" class="btn-secondary" data-split-apply-bulk>Apply to selected</button>
          <button type="button" class="btn-primary" data-split-save>Save selected allocations</button>
        </div>
        <label style="display:block;margin:12px 0"><input type="checkbox" data-split-select-all> Select all products with SKUs</label>
        <div style="overflow-x:auto"><table class="studio-data-table" style="width:100%;min-width:980px">
          <thead><tr><th>Select</th><th>Product</th><th>POS</th><th>Web</th><th>Master units</th><th>POS units</th><th>Web units</th><th>Reserved</th></tr></thead>
          <tbody>${rows || `<tr><td colspan="8">No products are available. Add products in POS or Web first.</td></tr>`}</tbody>
        </table></div>
        <p class="studio-panel-note">Products without a SKU cannot be allocated. Giving a POS-only or Web-only product to the other channel will add it there when you save. After adding a new Web product, publish the website from Store → Products before customers can see it.</p>
      </article>
    </section>`;
  },

  bindSplitShopEvents(snapshot, path) {
    const container = document.getElementById("store-workspace-content");
    if (!container) return;
    const status = container.querySelector("[data-split-status]");
    const rows = [...container.querySelectorAll("[data-split-row]")];
    const recompute = row => {
      const masterInput = row.querySelector("[data-split-master]")?.value.trim() || "";
      const master = masterInput === "" ? Number.NaN : Number(masterInput);
      const posPercent = Number(row.querySelector("[data-split-pos-percent]")?.value);
      const webPercent = Number(row.querySelector("[data-split-web-percent]")?.value);
      const posEnabled = row.querySelector("[data-split-pos]")?.checked;
      const webEnabled = row.querySelector("[data-split-web]")?.checked;
      const pos = posEnabled ? Math.round(master * posPercent / 100) : 0;
      const web = webEnabled ? Math.min(
        Math.round(master * webPercent / 100), Math.max(0, master - pos)
      ) : 0;
      const valid = Number.isSafeInteger(master) && master >= 0
        && Number.isFinite(posPercent) && posPercent >= 0 && posPercent <= 100
        && Number.isFinite(webPercent) && webPercent >= 0 && webPercent <= 100
        && posPercent + webPercent <= 100.000001 && (posEnabled || webEnabled);
      row.querySelector("[data-split-pos-quantity]").textContent = Number.isSafeInteger(pos) ? String(pos) : "—";
      row.querySelector("[data-split-web-quantity]").textContent = Number.isSafeInteger(web) ? String(web) : "—";
      row.querySelector("[data-split-reserved]").textContent = Number.isSafeInteger(master)
        && Number.isSafeInteger(pos) && Number.isSafeInteger(web)
        ? String(Math.max(0, master - pos - web)) : "Set total";
      row.dataset.splitValid = valid ? "1" : "0";
      return valid;
    };
    const updateSelection = () => {
      const selectable = rows.filter(row => !row.querySelector("[data-split-select]").disabled);
      const checked = selectable.filter(row => row.querySelector("[data-split-select]").checked).length;
      const all = container.querySelector("[data-split-select-all]");
      if (all) {
        all.checked = selectable.length > 0 && checked === selectable.length;
        all.indeterminate = checked > 0 && checked < selectable.length;
      }
    };
    rows.forEach(row => {
      row.querySelector("[data-split-select]")?.addEventListener("change", updateSelection);
      row.querySelectorAll("[data-split-master], [data-split-pos-percent], [data-split-web-percent], [data-split-pos], [data-split-web]")
        .forEach(input => input.addEventListener("input", () => recompute(row)));
      recompute(row);
    });
    container.querySelector("[data-split-select-all]")?.addEventListener("change", event => {
      rows.forEach(row => {
        const select = row.querySelector("[data-split-select]");
        if (select && !select.disabled) select.checked = event.currentTarget.checked;
      });
      updateSelection();
    });
    container.querySelector("[data-split-apply-bulk]")?.addEventListener("click", () => {
      const posPercent = Number(container.querySelector("[data-split-bulk-pos]")?.value);
      const webPercent = Number(container.querySelector("[data-split-bulk-web]")?.value);
      if (!Number.isFinite(posPercent) || !Number.isFinite(webPercent)
        || posPercent < 0 || webPercent < 0 || posPercent > 100 || webPercent > 100
        || posPercent + webPercent > 100) {
        if (status) status.textContent = "Bulk POS and Web percentages must be between 0 and 100 and add up to no more than 100.";
        return;
      }
      rows.filter(row => row.querySelector("[data-split-select]")?.checked).forEach(row => {
        row.querySelector("[data-split-pos-percent]").value = String(posPercent);
        row.querySelector("[data-split-web-percent]").value = String(webPercent);
        recompute(row);
      });
      if (status) status.textContent = "Bulk percentages applied to selected products. Review the whole-unit quantities before saving.";
    });
    container.querySelector("[data-split-save]")?.addEventListener("click", async event => {
      const button = event.currentTarget;
      const selectedRows = rows.filter(row => row.querySelector("[data-split-select]")?.checked);
      if (!selectedRows.length) {
        if (status) status.textContent = "Select at least one product to save.";
        return;
      }
      if (!selectedRows.every(recompute)) {
        if (status) status.textContent = "Fix the selected rows: channel percentages must total at most 100%, quantities must be whole units, and at least one channel must be enabled.";
        return;
      }
      button.disabled = true;
      if (status) status.textContent = "Preparing selected products and saving allocations…";
      try {
        const allocations = [];
        const localAllocations = [];
        for (const row of selectedRows) {
          const product = snapshot.products[Number(row.dataset.productIndex)];
          const sku = String(row.dataset.sku || "").trim();
          let posProduct = product?.posProduct;
          let webProduct = product?.webProduct;
          const posEnabled = row.querySelector("[data-split-pos]").checked;
          const webEnabled = row.querySelector("[data-split-web]").checked;
          if (!sku || !product) throw new Error("A selected product is missing its SKU or product record.");
          if (!posEnabled && !webEnabled) throw new Error(`${product.name} must belong to POS, Web, or both.`);
          if (posEnabled && !posProduct) {
            if (!product.webProductId) throw new Error(`Could not find the Web record for ${product.name}.`);
            await this.addWebsiteProductToPos(product.webProductId);
            posProduct = (await window.ShopPOS.listProducts()).find(item => String(item.sku || "") === sku);
          }
          if (webEnabled && !webProduct) {
            posProduct ||= (await window.ShopPOS.listProducts()).find(item => String(item.sku || "") === sku);
            if (!posProduct) throw new Error(`Could not find the POS record for ${product.name}.`);
            await this.publishPosProduct(posProduct);
            webProduct = SQLiteEngine.select("products").find(item => String(item.sku || "") === sku);
          }
          const master = Number(row.querySelector("[data-split-master]").value);
          const posStock = Number(row.querySelector("[data-split-pos-quantity]").textContent);
          const webStock = Number(row.querySelector("[data-split-web-quantity]").textContent);
          const reservedStock = master - posStock - webStock;
          const source = posEnabled && webEnabled ? "both" : posEnabled ? "pos" : "web";
          const productId = String(webProduct?.id || posProduct?.id || "");
          const record = {
            sku, product_id: productId, product_name: product.name,
            source_channel: source, pos_enabled: posEnabled, web_enabled: webEnabled,
            master_stock: master, pos_stock: posStock, web_stock: webStock,
            reserved_stock: reservedStock
          };
          allocations.push(record);
          localAllocations.push({ tenant_id: AppController.getActiveTenant().id, ...record, updated_at: new Date().toISOString() });
        }
        await window.EshopInventoryBridge.request(
          AppController.getActiveTenant().id, "allocations", "PUT", { allocations }
        );
        for (const allocation of localAllocations) {
          const existing = SQLiteEngine.select("main_store_inventory", item =>
            item.tenant_id === allocation.tenant_id && item.sku === allocation.sku)[0];
          if (existing) SQLiteEngine.update("main_store_inventory", item => item.id === existing.id, () => ({ ...allocation, id: existing.id }));
          else SQLiteEngine.insert("main_store_inventory", allocation);
          const webRecord = SQLiteEngine.select("products", item =>
            String(item.sku || "") === allocation.sku)[0];
          if (webRecord) SQLiteEngine.saveProduct({ ...webRecord, stock: allocation.web_enabled ? allocation.web_stock : 0 });
        }
        await window.ShopPOS.applyMainStoreAllocations(AppController.getActiveTenant().id, allocations);
        AppController.cacheActiveTenantCatalog();
        await window.ShopSQLite.flush();
        await this.loadMainShopWorkspace(path);
        AppUtils.showToast(`${allocations.length} product allocation${allocations.length === 1 ? "" : "s"} saved.`);
      } catch (error) {
        console.error("Main Store allocations could not be saved.", error);
        if (status) status.textContent = error instanceof Error ? error.message : "The allocations could not be saved.";
        button.disabled = false;
      }
    });
    rows.forEach(recompute);
  },
};
