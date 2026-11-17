# Litrus defaults and existing-site preview

## What changed

- Removed Good Form from the selectable mood presets and stopped applying it as a new-site default. Its palette remains available so older saved recipes can still restore their colors.
- New Craft website drafts now choose and save a random style from the first eight available moods. Reopening the same draft restores its saved recipe instead of choosing again.
- When editing an existing website, Craft now passes its saved Litrus storefront HTML to the editor. The preview shows that saved storefront first; scripts, embedded frames, event-handler attributes, and JavaScript URLs are removed from this read-only preview.
- Existing recipes still restore editable settings. If an older site has no saved recipe, its appearance can be previewed, but the original settings cannot be reconstructed reliably from HTML. Making an editor change switches the preview to the current editable design.

## Scope and limitation

The preview uses the saved storefront HTML stored on this device. It is not a live screenshot of a remote site and cannot reflect external edits that were never saved back into this app. No APK build, install, or deployment was performed.
