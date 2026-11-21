// New-website wizard wiring (the new-website form, both steps).
// Moved verbatim out of AppController.postRenderSetup in src/app/main.js; it is called there with this = AppController.
import { AppUtils, SQLiteEngine, StudioRenderers, WEBSITE_BUILDER_DRAFT_PREVIOUS_TENANT_KEY, WEBSITE_BUILDER_DRAFT_SYNC_KEY, WEBSITE_BUILDER_DRAFT_TENANT_ID } from './main.js';

export function bindNewWebsiteForms(params) {
  const newWebsiteForm = document.getElementById("new-website-form");
  if (newWebsiteForm && !newWebsiteForm.querySelector('[name="username"]')) {
    newWebsiteForm.onsubmit = async event => {
      event.preventDefault();
      const formData = new FormData(newWebsiteForm);
      const name = String(formData.get("name") || "").trim();
      const id = String(formData.get("id") || "")
        .trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
      const sessionToken = window.localStorage.getItem("ESHOP_ACCOUNT_SESSION_V1") || "";
      const websiteDraft = StudioRenderers.websiteBuilderDraft();
      const errorElement = document.getElementById("new-website-error");
      const submitButton = newWebsiteForm.querySelector('button[type="submit"]');
      errorElement.hidden = true;
      if (!websiteDraft.categories.length) {
        errorElement.textContent = "Add a category in Webmaker before creating a website.";
        errorElement.hidden = false;
        return;
      }
      if (!name || !id || !sessionToken) {
        errorElement.textContent = "Enter a website name and address while signed in to your app account.";
        errorElement.hidden = false;
        return;
      }
      if (this.getActiveTenant().id !== WEBSITE_BUILDER_DRAFT_TENANT_ID) {
        errorElement.textContent = "The editor draft is not active. Return to the editor and finish again.";
        errorElement.hidden = false;
        return;
      }
      submitButton.disabled = true;
      submitButton.textContent = "Creating website…";
      let createdTenant = null;
      let tenantOwnerToken = "";
      let storefrontPublished = false;
      try {
        this.cacheActiveTenantCatalog();
        const draftCatalog = this.tenantCatalogs().find(item =>
          item.tenant_id === WEBSITE_BUILDER_DRAFT_TENANT_ID);
        if (!draftCatalog?.products?.length || !draftCatalog?.categories?.length) {
          throw new Error("The editor draft has no products or categories. Return to the editor and try again.");
        }
        const availableThemes = StudioRenderers.websiteThemesForPicker();
        const selectedThemeEntry = availableThemes.find(theme => theme.id === params.get("theme")) ||
          availableThemes.find(theme => theme.id === websiteDraft.selected_theme) ||
          availableThemes[0];
        const selectedTheme = selectedThemeEntry?.id;
        if (!selectedTheme) throw new Error("The Craft storefront theme is unavailable.");
        const appEditableTheme = selectedThemeEntry.editor_mode === "app";
        const liquidHtmlTheme = selectedThemeEntry.editor_mode === "liquid-html";
        const litrusMixerTheme = selectedThemeEntry.editor_mode === "litrus";
        if (!appEditableTheme && !liquidHtmlTheme && !litrusMixerTheme) {
          throw new Error(`${selectedThemeEntry.name} cannot be used for a new website yet.`);
        }
        const store = {
          ...(draftCatalog.store || {}),
          id,
          name,
          title: name,
          website_theme_id: selectedTheme,
          element_edits: []
        };
        const draftId = StudioRenderers.websiteBuilderDraft().draft_id || "new";
        const litrusDraftScope = `draft:${draftId}`;
        const themeDesignKey = litrusMixerTheme
          ? `liquid-html-theme-draft:litrus-mixer:${litrusDraftScope}`
          : `liquid-html-theme-draft:${selectedTheme}`;
        let savedThemeDesign = liquidHtmlTheme || litrusMixerTheme
          ? StudioRenderers.getWorkspaceSetting(themeDesignKey, "")
          : "";
        const savedLitrusRecipe = litrusMixerTheme
          ? StudioRenderers.getWorkspaceSetting(`litrus-mixer-recipe:${litrusDraftScope}`, null)
          : null;
        if (litrusMixerTheme) {
          savedThemeDesign = this.renameLitrusMixerStorefront(savedThemeDesign, name);
          StudioRenderers.setWorkspaceSetting(themeDesignKey, savedThemeDesign);
        }
        const initialCatalog = {
          products: draftCatalog.products.map(product => ({
            id: product.id,
            name: product.name,
            slug: product.slug,
            brand: product.brand,
            sku: product.sku,
            category_id: product.category_id,
            price: product.price,
            original_price: product.original_price,
            discount: product.discount,
            stock: product.stock,
            rating: product.rating,
            review_count: product.review_count,
            description: product.description,
            is_flagship: product.is_flagship,
            is_new: product.is_new,
            is_featured: product.is_featured,
            is_bestseller: product.is_bestseller,
            images: Array.isArray(product.images) ? product.images : [],
            sizes: product.sizes,
            colors: product.colors,
            tags: product.tags,
            status: product.status,
            duration_minutes: product.duration_minutes,
            booking_enabled: product.booking_enabled,
            option1_name: product.option1_name,
            option2_name: product.option2_name,
            option3_name: product.option3_name,
            option4_name: product.option4_name,
            options: Array.isArray(product.options) ? product.options : [],
            variants: Array.isArray(product.variants) ? product.variants : [],
            taxonomy_category_id: product.taxonomy_category_id || null,
            taxonomy_category_name: product.taxonomy_category_name || "",
            taxonomy_custom_category: product.taxonomy_custom_category || null,
            taxonomy_attributes: Array.isArray(product.taxonomy_attributes) ? product.taxonomy_attributes : [],
            priced_attributes: Array.isArray(product.priced_attributes) ? product.priced_attributes : []
          })),
          categories: draftCatalog.categories.map(category => ({
            id: category.id,
            name: category.name,
            slug: category.slug,
            description: category.description,
            image: "",
            featured: category.featured
          })),
          store: { ...(draftCatalog.store || {}), id, name, title: name,
            website_theme_id: selectedTheme, element_edits: [] },
          pages: draftCatalog.pages || []
        };
        const result = await this.cloudflareRequest("/api/tenants", {
          method: "PUT",
          body: JSON.stringify({ id, name })
        }, "main", false, sessionToken);
        if (!result.tenant || !result.owner_token) {
          throw new Error("Cloudflare did not return the new website's private key.");
        }
        createdTenant = result.tenant;
        tenantOwnerToken = result.owner_token;
        initialCatalog.store = { ...store, id: result.tenant.id };
        const tenantQuery = `?tenant=${encodeURIComponent(result.tenant.id)}`;
        const publishedCatalog = await this.cloudflareRequest(`/api/catalog${tenantQuery}`, {
          method: "PUT",
          body: JSON.stringify(initialCatalog)
        }, result.tenant.id, false, result.owner_token);
        if (publishedCatalog.ok !== true || typeof publishedCatalog.updated_at !== "string") {
          throw new Error("Cloudflare did not confirm the new website catalog.");
        }
        let filledHtml;
        if (litrusMixerTheme) {
          if (typeof savedThemeDesign !== "string" ||
              !savedThemeDesign.includes('<meta name="eshop-filled-theme" content="litrus-mixer">')) {
            throw new Error("Publish the Litrus Mixer design from Preview before creating this website.");
          }
          filledHtml = savedThemeDesign;
        } else if (appEditableTheme) {
          const renderLiquidStorefront = window.EshopLiquidStorefront?.render;
          if (typeof renderLiquidStorefront !== "function") {
            throw new Error("My Own Theme's Liquid renderer is not ready.");
          }
          const draftSettingsKey = `liquid-theme-viewer:${this.getActiveTenant().id}:draft:${selectedTheme}`;
          let draftSettings = StudioRenderers.getWorkspaceSetting(draftSettingsKey, null);
          if (typeof draftSettings === "string") {
            try {
              draftSettings = JSON.parse(draftSettings);
            } catch (error) {
              throw new Error(`Saved My Own Theme settings are invalid: ${error.message}`);
            }
          }
          if (draftSettings !== null &&
              (!draftSettings || typeof draftSettings !== "object" || Array.isArray(draftSettings))) {
            throw new Error("Saved My Own Theme settings are invalid.");
          }
          const themeRoot = new URL("/liquid-themes/my-own-theme/", window.location.origin);
          filledHtml = await renderLiquidStorefront(initialCatalog, {
            baseUrl: `https://${result.tenant.hostname}/`,
            settings: draftSettings,
            loadFile: async path => {
              const response = await fetch(new URL(path, themeRoot), { cache: "no-store" });
              if (!response.ok) throw new Error(`Could not load My Own Theme file ${path} (${response.status}).`);
              return response.text();
            }
          });
        } else {
          const renderTheme = window.EshopLiquidHtmlThemeRenderer?.render;
          if (typeof renderTheme !== "function") {
            throw new Error(`${selectedThemeEntry.name}'s Liquid renderer is not ready.`);
          }
          const themeRoot = new URL(`/theme-packages/${selectedTheme}/`, window.location.origin);
          filledHtml = await renderTheme(selectedTheme, initialCatalog, {
            baseUrl: `https://${result.tenant.hostname}/`,
            loadFile: async path => {
              if (path === "index.html" && savedThemeDesign) return savedThemeDesign;
              const response = await fetch(new URL(path, themeRoot), { cache: "no-store" });
              if (!response.ok) {
                throw new Error(`Could not load ${selectedThemeEntry.name} file ${path} (${response.status}).`);
              }
              return response.text();
            }
          });
        }
        const publishedTheme = await this.cloudflareRequest(`/api/theme-publish${tenantQuery}`, {
          method: "POST",
          body: JSON.stringify({
            theme_id: selectedTheme,
            catalog_updated_at: publishedCatalog.updated_at,
            html: filledHtml
          })
        }, result.tenant.id, false, result.owner_token);
        if (publishedTheme.ok !== true || publishedTheme.theme_id !== selectedTheme) {
          throw new Error("Cloudflare did not confirm the shop-specific storefront publish.");
        }
        storefrontPublished = true;
        this.setActiveTenantCatalog({ ...result.tenant, owner_token: result.owner_token }, {
          ...draftCatalog,
          owner_token: result.owner_token,
          store
        });
        if (savedThemeDesign) StudioRenderers.setWorkspaceSetting(
          `liquid-html-theme-draft:litrus-mixer:tenant:${result.tenant.id}`,
          savedThemeDesign
        );
        if (savedLitrusRecipe) StudioRenderers.setWorkspaceSetting(
          `litrus-mixer-recipe:tenant:${result.tenant.id}`,
          savedLitrusRecipe
        );
        const catalogs = this.tenantCatalogs();
        const temporaryIndex = catalogs.findIndex(item =>
          item.tenant_id === WEBSITE_BUILDER_DRAFT_TENANT_ID);
        if (temporaryIndex >= 0) catalogs.splice(temporaryIndex, 1);
        SQLiteEngine.save();
        if (!window.ShopSQLite) throw new Error("The app SQLite database is not ready.");
        await window.ShopSQLite.flush();
        window.localStorage.removeItem("ESHOP_NEW_WEBSITE_DRAFT_V1");
        window.localStorage.removeItem(WEBSITE_BUILDER_DRAFT_SYNC_KEY);
        window.localStorage.removeItem(WEBSITE_BUILDER_DRAFT_PREVIOUS_TENANT_KEY);
        AppUtils.showToast(`Website created at ${result.tenant.hostname}. It uses your app account's Paystack default.`);
        this.navigate(`/account/web/site?tenant=${encodeURIComponent(result.tenant.id)}`);
      } catch (error) {
        console.error("Website setup failed.", error);
        if (createdTenant && !storefrontPublished) {
          try {
            await this.cloudflareRequest(
              `/api/tenants/${encodeURIComponent(createdTenant.id)}`,
              { method: "DELETE" },
              createdTenant.id,
              false,
              tenantOwnerToken
            );
          } catch (cleanupError) {
            console.error("Could not remove the incomplete new website.", cleanupError);
            error.message = `${error.message || "Could not publish this website safely."} The website account was created but not fully published; do not share its address yet.`;
          }
        }
        if (error.status === 401) {
          window.localStorage.removeItem("ESHOP_ACCOUNT_SESSION_V1");
          window.localStorage.removeItem("ESHOP_ACCOUNT_USERNAME_V1");
          window.localStorage.removeItem("ESHOP_ACCOUNT_EMAIL_V1");
          const continueTheme = params.get("theme") || websiteDraft.selected_theme;
          const continueTo = this.currentRoute().split("?")[0] + `?new=1&finish=1&theme=${encodeURIComponent(continueTheme)}`;
          const accountRoute = `/app-account?continue=${encodeURIComponent(continueTo)}`;
          this.navigate(accountRoute);
          return;
        }
        errorElement.textContent = error.message || "Could not set up this website.";
        errorElement.hidden = false;
        submitButton.disabled = false;
        submitButton.textContent = "Set up";
      }
    };
  }
  if (newWebsiteForm?.querySelector('[name="username"]')) {
    const authError = document.getElementById("shop-account-error");
    const passwordField = newWebsiteForm.elements.namedItem("password");
    const confirmField = newWebsiteForm.elements.namedItem("confirmPassword");
    const confirmContainer = document.getElementById("shop-password-confirm-field");
    const accountPanel = document.getElementById("shop-account-panel");
    let existingAccountSession = window.localStorage.getItem("ESHOP_ACCOUNT_SESSION_V1") || "";
    const submitButton = newWebsiteForm.querySelector('button[type="submit"]');
    let turnstileWidgetId = null;
    let turnstileSetupStarted = false;
    let turnstileToken = "";
    if (existingAccountSession) {
      accountPanel.hidden = true;
      accountPanel.style.display = "none";
      accountPanel.querySelectorAll("input, button").forEach(control => { control.disabled = true; });
    }
    const setAuthMode = mode => {
      const registering = mode === "register";
      newWebsiteForm.dataset.authMode = registering ? "register" : "login";
      confirmContainer.hidden = !registering;
      const turnstileContainer = document.getElementById("shop-turnstile-widget");
      turnstileContainer.hidden = !registering;
      if (!registering) turnstileToken = "";
      confirmField.required = registering;
      confirmField.value = "";
      passwordField.autocomplete = registering ? "new-password" : "current-password";
      document.getElementById("shop-account-heading").textContent = registering ? "Create your account" : "Sign in";
      submitButton.textContent = registering ? "Create account & website" : "Sign in & create website";
      newWebsiteForm.querySelectorAll("[data-shop-auth-mode]").forEach(button => {
        const active = button.dataset.shopAuthMode === (registering ? "register" : "login");
        button.setAttribute("aria-pressed", String(active));
        button.className = active ? "btn-primary" : "btn-secondary";
      });
    };
    const getWorkerOrigin = () => this.cloudflareConnection("main").origin;
    const fetchAuth = async (path, body, sessionToken = "") => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      let response;
      try {
        response = await fetch(new URL(path, getWorkerOrigin()), {
          method: body ? "POST" : "GET",
          headers: {
            ...(body ? { "Content-Type": "application/json" } : {}),
            ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {})
          },
          ...(body ? { body: JSON.stringify(body) } : {}),
          signal: controller.signal
        });
      } catch (error) {
        throw new Error(error.name === "AbortError"
          ? "Cloudflare account service took too long to respond. Check your connection and try again."
          : `Could not connect to Cloudflare account service. ${error.message || ""}`.trim());
      } finally {
        clearTimeout(timeout);
      }
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = new Error(result.error || `Account service returned HTTP ${response.status}.`);
        error.status = response.status;
        throw error;
      }
      return result;
    };
    newWebsiteForm.querySelectorAll("[data-shop-auth-mode]").forEach(button => {
      button.onclick = () => {
        const registering = button.dataset.shopAuthMode === "register";
        setAuthMode(button.dataset.shopAuthMode);
        if (!registering) {
          turnstileToken = "";
          return;
        }
        if (turnstileWidgetId === null) void configureTurnstile();
        else window.turnstile?.reset(turnstileWidgetId);
      };
    });
    newWebsiteForm.querySelectorAll("[data-toggle-password]").forEach(button => {
      button.onclick = () => {
        const field = newWebsiteForm.elements.namedItem(button.dataset.togglePassword);
        if (!field) return;
        const visible = field.type === "password";
        field.type = visible ? "text" : "password";
        button.textContent = visible ? "Hide" : "Show";
        button.setAttribute("aria-label", `${visible ? "Hide" : "Show"} ${button.dataset.togglePassword === "password" ? "password" : "confirm password"}`);
      };
    });
    setAuthMode("register");
    const configureTurnstile = async () => {
      if (turnstileWidgetId !== null || turnstileSetupStarted) return;
      turnstileSetupStarted = true;
      const widget = document.getElementById("shop-turnstile-widget");
      try {
        const config = await fetchAuth("/api/auth/config");
        if (!config.turnstile_site_key) throw new Error("Human verification is not configured yet. Please try again later.");
        if (!window.turnstile) {
          await new Promise((resolve, reject) => {
            const script = document.createElement("script");
            script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
            script.async = true;
            script.defer = true;
            const timeout = setTimeout(() => reject(new Error("Cloudflare verification is taking too long to load. Check your connection and try again.")), 15000);
            script.onload = () => { clearTimeout(timeout); resolve(); };
            script.onerror = () => { clearTimeout(timeout); reject(new Error("Cloudflare human verification could not be loaded.")); };
            document.head.appendChild(script);
          });
        }
        turnstileWidgetId = window.turnstile.render(widget, {
          sitekey: config.turnstile_site_key,
          appearance: "always",
          callback(token) {
            turnstileToken = token;
            newWebsiteForm.elements.namedItem("turnstileToken").value = token;
          },
          "expired-callback"() {
            turnstileToken = "";
            newWebsiteForm.elements.namedItem("turnstileToken").value = "";
          },
          "error-callback"(code) {
            turnstileToken = "";
            newWebsiteForm.elements.namedItem("turnstileToken").value = "";
            widget.setAttribute("role", "alert");
            widget.textContent = `Cloudflare verification failed${code ? ` (${code})` : ""}. Check the site key and allowed hostnames, including localhost for Android.`;
          }
        });
      } catch (error) {
        widget.textContent = error.message || "Cloudflare human verification is unavailable.";
        widget.setAttribute("role", "alert");
        console.error("Turnstile could not be initialized.", error);
      } finally {
        turnstileSetupStarted = false;
      }
    };
    const checkExistingSession = async () => {
      if (!existingAccountSession) {
        if (newWebsiteForm.dataset.authMode === "register") void configureTurnstile();
        return;
      }
      submitButton.disabled = true;
      try {
        const session = await fetchAuth("/api/auth/session", null, existingAccountSession);
        window.localStorage.setItem("ESHOP_ACCOUNT_USERNAME_V1", session.username || "");
        window.localStorage.setItem("ESHOP_ACCOUNT_EMAIL_V1", session.email || "");
      } catch (error) {
        if (error.status === 401) {
          window.localStorage.removeItem("ESHOP_ACCOUNT_SESSION_V1");
          window.localStorage.removeItem("ESHOP_ACCOUNT_USERNAME_V1");
          existingAccountSession = "";
          accountPanel.hidden = false;
          accountPanel.style.display = "grid";
          accountPanel.querySelectorAll("input, button").forEach(control => { control.disabled = false; });
          setAuthMode("login");
          authError.textContent = "Your account session expired. Sign in again to continue; you do not need to create another account.";
          authError.hidden = false;
        } else {
          authError.textContent = error.message || "Could not check your account session.";
          authError.hidden = false;
        }
      } finally {
        submitButton.disabled = false;
      }
    };
    setAuthMode("login");
    void checkExistingSession();
    newWebsiteForm.onsubmit = async event => {
      event.preventDefault();
      const websiteDraft = StudioRenderers.websiteBuilderDraft();
      if (!websiteDraft.categories.length) {
        this.navigate("/account/web/studio/websites/list");
        AppUtils.showToast("Add a category before creating a website.", "danger");
        return;
      }
      const formData = new FormData(newWebsiteForm);
      const name = String(formData.get("name") || "").trim();
      const id = String(formData.get("id") || "")
        .trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
      const username = String(formData.get("username") || "").trim().toLowerCase();
      const password = String(formData.get("password") || "");
      const confirmPassword = String(formData.get("confirmPassword") || "");
      const registering = newWebsiteForm.dataset.authMode === "register";
      authError.hidden = true;
      if (!name || !id || (!existingAccountSession && (!username || !password))) {
        authError.textContent = "Enter the shop name, website address, username, and password.";
        authError.hidden = false;
        return;
      }
      if (!existingAccountSession && registering && password !== confirmPassword) {
        authError.textContent = "The passwords do not match.";
        authError.hidden = false;
        return;
      }
      if (!existingAccountSession && registering && !turnstileToken) {
        authError.textContent = "Complete the Cloudflare checkbox above before creating your account.";
        authError.hidden = false;
        return;
      }
      submitButton.disabled = true;
      submitButton.textContent = existingAccountSession
        ? "Creating website…"
        : registering ? "Creating account…" : "Signing in…";
      try {
        const origin = getWorkerOrigin();
        const accountResult = existingAccountSession
          ? { ok: true, session_token: existingAccountSession, tenants: [] }
          : await fetchAuth(`/api/auth/${registering ? "register" : "login"}`, {
            username,
            password,
            ...(registering ? { turnstile_token: turnstileToken } : {})
          });
        if (!accountResult.ok || !accountResult.session_token) throw new Error("The account service did not create a secure session.");
        if (!existingAccountSession) {
          window.localStorage.setItem("ESHOP_ACCOUNT_SESSION_V1", accountResult.session_token);
          window.localStorage.setItem("ESHOP_ACCOUNT_USERNAME_V1", accountResult.username || username);
          window.localStorage.setItem("ESHOP_ACCOUNT_EMAIL_V1", accountResult.email || "");
        }
        await this.restoreAccountWebsites(accountResult.tenants, origin);
        submitButton.textContent = "Creating website…";
        throw new Error("Website creation is available only from the final setup form.");
      } catch (error) {
        console.error("Account or website creation failed.", error);
        if (!existingAccountSession && registering && error.status === 409) {
          setAuthMode("login");
          authError.textContent = "This account already exists. Sign in to attach the new website to your existing account.";
          authError.hidden = false;
          submitButton.disabled = false;
          submitButton.textContent = "Sign in & create website";
          return;
        }
        if (existingAccountSession && error.status === 401) {
          window.localStorage.removeItem("ESHOP_ACCOUNT_SESSION_V1");
          window.localStorage.removeItem("ESHOP_ACCOUNT_USERNAME_V1");
          existingAccountSession = "";
          accountPanel.hidden = false;
          accountPanel.style.display = "grid";
          accountPanel.querySelectorAll("input, button").forEach(control => { control.disabled = false; });
          setAuthMode("login");
        }
        authError.textContent = `${error.message || "Could not create the website."}${existingAccountSession ? " If your account session expired, sign in again from Account on the home screen." : ""}`;
        authError.hidden = false;
        turnstileToken = "";
        newWebsiteForm.elements.namedItem("turnstileToken").value = "";
        if (registering && turnstileWidgetId !== null) window.turnstile?.reset(turnstileWidgetId);
        submitButton.disabled = false;
        submitButton.textContent = existingAccountSession
          ? "Set up"
          : registering ? "Create account & website" : "Sign in & create website";
      }
    };
  }
}
