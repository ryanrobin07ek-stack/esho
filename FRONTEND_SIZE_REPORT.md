# Frontend size report

Measured from the existing files under `www` on 2026-11-17. This is an on-disk measurement only; no build or APK install was run for this report.

| Scope | Files | Size |
|---|---:|---:|
| Entire `www` directory | 103 | 12,556,086 bytes (11.97 MiB) |
| `www\assets` | — | 2,639,357 bytes (2.52 MiB) |
| Main `www\index.html` | 1 | 998,788 bytes (975 KiB) |

Largest files in `www\assets`:

| File | Size |
|---|---:|
| `sql-wasm.wasm` | 652,953 bytes |
| `sql-wasm-Bku9E_kW.wasm` | 652,953 bytes |
| `index-DSN73KLr.js` | 416,465 bytes |
| `jeep-sqlite.entry-DoJsnJ4x.js` | 299,539 bytes |
| `pos-Dl67ujJN.js` | 261,621 bytes |
| `app-BEP_Nssq.js` | 231,093 bytes |
| `register-AoV5SbIb.js` | 59,570 bytes |
| `index-D6WPuxkD.js` | 27,104 bytes |

The full `www` total includes storefront themes and other static files, which may not all load when the app first opens. These figures describe the files currently on disk, not a fresh build of the latest source changes.
