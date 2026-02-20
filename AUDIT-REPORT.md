# ZeroTruster.com — DevSecOps Audit Report

**Date:** 2026-02-20  
**Domain:** zerotruster.com  
**Hosting:** GitHub Pages (Fastly CDN)  
**SSL:** Let's Encrypt R13 — valid until 2026-05-20  

---

## Executive Summary

The site is functional, fast, and well-structured. However, it has **critical email authentication gaps** (no DMARC/DKIM) and **missing HTTP security headers** that expose it to phishing abuse and client-side attacks. Code-level fixes have been applied; DNS and infrastructure items require manual action.

**Fixes Applied in This Commit:**
- ✅ Content Security Policy (CSP) via `<meta>` tag
- ✅ Referrer Policy via `<meta name="referrer">`
- ✅ Resource preloading (`dns-prefetch`, `preload`)
- ✅ PWA manifest `purpose` field split (W3C compliance)
- ✅ Service worker cache bumped to v3 + icon caching
- ✅ CI pipeline minification (CSS/JS/HTML) added

**Manual Action Required:**
- ❌ DMARC DNS record (CRITICAL)
- ❌ DKIM DNS records (CRITICAL)
- ❌ GitHub repo settings: Enforce HTTPS
- ❌ Consider Cloudflare for full HTTP header control

---

## 1. DNS & Infrastructure

### ✅ A Records — PASS
```
185.199.108.153
185.199.109.153
185.199.110.153
185.199.111.153
```
All 4 GitHub Pages IPs correctly configured.

### ✅ SPF — PASS
```
v=spf1 include:spf.protection.outlook.com -all
```
Hard-fail (`-all`) policy — correctly rejects unauthorized senders.

### ✅ MX — PASS
```
zerotruster-com.mail.protection.outlook.com (priority 0)
```
Microsoft 365 mail routing configured.

### ❌ DMARC — CRITICAL — NOT SET
No `_dmarc.zerotruster.com` TXT record exists. Without DMARC, anyone can spoof emails from `@zerotruster.com` and recipients' mail servers have no policy to follow.

**Fix — Add this TXT record at your DNS provider:**
```
Host:  _dmarc.zerotruster.com
Type:  TXT
Value: v=DMARC1; p=reject; rua=mailto:dmarc-reports@zerotruster.com; ruf=mailto:dmarc-forensics@zerotruster.com; adkim=s; aspf=s; pct=100
```

**Policy explanation:**
- `p=reject` — instruct receivers to reject spoofed mail (strongest)
- `adkim=s; aspf=s` — strict alignment for DKIM and SPF
- `rua` / `ruf` — aggregate and forensic report destinations (create these mailboxes or use a DMARC reporting service like dmarcian.com or Valimail)

### ❌ DKIM — CRITICAL — NOT SET
Neither `selector1._domainkey` nor `selector2._domainkey` CNAME records exist. Microsoft 365 requires these to sign outbound emails.

**Fix — Add these CNAME records:**
```
Host:  selector1._domainkey.zerotruster.com
Type:  CNAME
Value: selector1-zerotruster-com._domainkey.zerotruster.onmicrosoft.com

Host:  selector2._domainkey.zerotruster.com
Type:  CNAME
Value: selector2-zerotruster-com._domainkey.zerotruster.onmicrosoft.com
```

Then enable DKIM signing in Microsoft 365 Admin → Exchange → Authentication → DKIM.

> **Note:** The CNAME values above assume your Microsoft 365 tenant uses `zerotruster.onmicrosoft.com`. Adjust if your tenant initial domain differs. Check Microsoft 365 Admin → Settings → Domains for the exact DKIM CNAME values.

### ⚠️ DNSSEC — NOT VERIFIED
Microsoft-hosted nameservers (`ns1-4.bdm.microsoftonline.com`) generally do not support DNSSEC for custom domains. Consider transferring DNS to Cloudflare if DNSSEC is required.

---

## 2. Security Headers

GitHub Pages does **not** allow custom HTTP response headers. We can only set CSP and Referrer-Policy via `<meta>` tags. For full header control, a reverse proxy (Cloudflare, etc.) is needed.

| Header | Status | Fix Applied |
|--------|--------|-------------|
| Content-Security-Policy | ❌ Missing (server) | ✅ `<meta>` tag added |
| Referrer-Policy | ❌ Missing | ✅ `<meta name="referrer">` added |
| Strict-Transport-Security | ❌ Missing | ⚠️ Cannot set via meta — needs Cloudflare |
| X-Content-Type-Options | ❌ Missing | ⚠️ Cannot set via meta — needs Cloudflare |
| X-Frame-Options | ❌ Missing | Partially covered by CSP `frame-ancestors` (but ignored in meta CSP) |
| Permissions-Policy | ❌ Missing | ⚠️ Cannot set via meta — needs Cloudflare |
| X-XSS-Protection | ❌ Missing | Deprecated; CSP replaces this |

### CSP Policy Applied
```
default-src 'self';
script-src 'self';
style-src 'self' https://fonts.googleapis.com 'unsafe-inline';
font-src 'self' https://fonts.gstatic.com;
img-src 'self' data:;
connect-src 'self';
object-src 'none';
base-uri 'self';
form-action 'self';
```

**Why `'unsafe-inline'` for styles:** The particle system and cursor glow JS set inline `style.transform` on DOM elements. Removing `'unsafe-inline'` would break these effects unless refactored to use CSS classes or `CSS.setProperty()` (a future optimization).

### Recommendation: Cloudflare Free Plan
To get full HTTP security headers (HSTS, X-Content-Type-Options, Permissions-Policy, X-Frame-Options), set up Cloudflare as a DNS proxy:
1. Add site to Cloudflare (free plan)
2. Change nameservers to Cloudflare
3. Use Transform Rules or Workers to inject headers
4. Enables DNSSEC, full TLS controls, WAF rules, and Brotli compression

---

## 3. SSL / TLS

| Check | Result |
|-------|--------|
| Certificate | Let's Encrypt R13 |
| Subject | CN=zerotruster.com |
| Expiration | 2026-05-20 (auto-renews via GitHub Pages) |
| Protocol | TLS 1.2+ (Fastly enforced) |
| HSTS | ❌ Not set (GitHub Pages custom domains) |

**Recommendation:** Enable "Enforce HTTPS" in GitHub repo → Settings → Pages if not already done. This ensures HTTP→HTTPS redirects at the edge.

---

## 4. Performance

### Asset Sizes (Pre-Minification)
| Asset | Raw Size | Est. Minified | Est. Gzipped |
|-------|----------|---------------|--------------|
| index.html | 24,210 B | ~18 KB | ~5 KB |
| style.css | 19,079 B | ~14 KB | ~3.5 KB |
| script.js | 9,922 B | ~5.5 KB | ~2 KB |
| i18n.js | 16,164 B | ~10 KB | ~3 KB |
| **Total** | **69,375 B** | **~47.5 KB** | **~13.5 KB** |

### Fixes Applied
- **CI Minification:** Added `clean-css-cli`, `terser`, and `html-minifier-terser` to the deploy pipeline. All CSS, JS, and HTML are now minified before deployment.
- **Resource Preloading:** Added `<link rel="preload">` for style.css, i18n.js, and script.js to eliminate parser-discovered latency.
- **DNS Prefetch:** Added `<link rel="dns-prefetch">` for Google Fonts domains to parallel-resolve DNS.

### Cache Policy
```
Cache-Control: max-age=600 (10 minutes)
```
This is GitHub Pages' default and **cannot be changed**. The Fastly CDN layer provides additional caching. Service worker (network-first + cache fallback) compensates for the short server cache TTL.

### Google Fonts
The site loads Inter (7 weights) and JetBrains Mono (2 weights) from Google Fonts. This is a **render-blocking external request**.

**Future optimization:**
1. Self-host the fonts (download WOFF2 files, add `@font-face` declarations)
2. Remove the external `<link>` — eliminates ~200ms TTFB to Google's CDN
3. Add `font-display: swap` in local `@font-face` rules
4. Update CSP to remove `fonts.googleapis.com` and `fonts.gstatic.com`

> Note: Self-hosting eliminates a privacy concern (Google Fonts sends visitor IPs to Google) — relevant for GDPR/privacy compliance.

### Subresource Integrity (SRI)
SRI hashes **cannot** be applied to Google Fonts CSS because Google dynamically generates different CSS based on user-agent. SRI is only viable after self-hosting fonts.

---

## 5. PWA Compliance

| Check | Status |
|-------|--------|
| manifest.json | ✅ Valid |
| Service Worker | ✅ Network-first + cache fallback |
| Icons 192x192 | ✅ |
| Icons 512x512 | ✅ |
| `purpose` field | ✅ Fixed — split into separate `any` and `maskable` entries |
| Offline support | ✅ Cached assets served when offline |
| `theme_color` | ✅ `#0d1117` |
| `display` | ✅ `standalone` |

### Fix Applied
- **manifest.json:** Split `"purpose": "any maskable"` into separate icon entries with individual `purpose` values. Chrome DevTools flags the combined value as a warning.
- **Service worker v3:** Added `icon-192.png`, `icon-512.png`, and `apple-touch-icon.png` to the cache list for better offline PWA experience.

---

## 6. Code Quality & Accessibility

### Positive Findings
- ✅ All external links use `rel="noopener"` (prevents `window.opener` attacks)
- ✅ IIFE wrapper in script.js (no global scope pollution)
- ✅ `{ passive: true }` on scroll/mousemove listeners (smooth scrolling)
- ✅ `visibilitychange` handler pauses particles when tab is hidden (battery saver)
- ✅ Proper `aria-label` on nav toggle and language switcher buttons
- ✅ Semantic HTML structure (nav, section, footer, h1-h3 hierarchy)

### Observations
- `style-src 'unsafe-inline'` is needed because JS directly manipulates `element.style.transform`. Consider refactoring to CSS class toggles or `el.style.setProperty()` with nonces in the future.
- The i18n.js file (16 KB) loads all 6 languages on every page load. For a single-page site this is acceptable, but a future optimization could lazy-load translations on demand.

---

## 7. Zero Trust Alignment

For a security professional's website, the site should exemplify the principles it advocates. Current alignment:

| Principle | Implementation | Grade |
|-----------|---------------|-------|
| **Verify Explicitly** | CSP limits allowed sources ✅ | B+ |
| **Least Privilege** | CSP `object-src 'none'`; `form-action 'self'`; `base-uri 'self'` ✅ | A- |
| **Assume Breach** | Referrer-Policy limits data leakage ✅ | B |
| **Defense in Depth** | Missing HSTS, X-Content-Type-Options at server level | C+ |
| **Identity Verification** | SPF ✅ but no DMARC/DKIM ❌ | D |

**After applying DNS fixes (DMARC + DKIM) and Cloudflare headers, the grade improves to A-/A.**

---

## 8. Priority Action Items

### 🔴 CRITICAL (Do Immediately)
1. **Add DMARC TXT record** — prevents email spoofing from your domain
2. **Add DKIM CNAME records** — enables cryptographic email signing via M365
3. **Enable DKIM signing** in Microsoft 365 Admin Center

### 🟡 WARNING (Do This Week)
4. **Enable "Enforce HTTPS"** in GitHub repo → Settings → Pages
5. **Consider Cloudflare Free** — gains HSTS, X-Content-Type-Options, Permissions-Policy, DNSSEC, WAF, Brotli

### 🟢 OPTIMIZATION (Do When Convenient)
6. **Self-host Google Fonts** — eliminates render-blocking external request + GDPR concern
7. **Remove `'unsafe-inline'` from CSP** — refactor JS style manipulation to use CSS classes
8. **Add a dedicated offline fallback page** — improve PWA offline experience with a branded page

---

## Files Modified in This Audit

| File | Changes |
|------|---------|
| `index.html` | Added CSP meta tag, referrer-policy, dns-prefetch, preload hints |
| `manifest.json` | Split `purpose: "any maskable"` into separate icon entries |
| `service-worker.js` | Bumped cache to v3, added icon assets to cache list |
| `.github/workflows/deploy.yml` | Added Node.js setup + CSS/JS/HTML minification step |
| `AUDIT-REPORT.md` | This report |

---

*Report generated by DevSecOps audit — ZeroTruster.com*
