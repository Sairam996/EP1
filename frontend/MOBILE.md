# Thara is a native mobile app (iOS + Android)

**Standing rule:** Thara is an Expo (SDK 54) mobile app for **iOS and Android, equally**. Web is **not** a product target.

- All future UI and feature work must be built and verified on **both iOS and Android** and run smoothly on each.
- Do not add web-only code paths, HTML mocks, or browser-based previews to the product.
- `app.json` declares `platforms: ["ios", "android"]`.
- Screenshots/QA come from a phone, simulator, or emulator — never a browser.

## Run
- Expo Go: `npm start`, scan the QR (or `npm run go:ios` / `npm run go:android`)
- Native: `npm run ios` (`expo run:ios`) / `npm run android` (`expo run:android`)
- EAS builds: `npm run build:dev`, `npm run build:preview`, or `build:ios` / `build:android` (profiles in `eas.json`)

## Login (phone OTP)
Country code + phone (`phone-pad`) first, Google/Apple below, OTP field with native SMS autofill
(`textContentType="oneTimeCode"` on iOS, `autoComplete="sms-otp"` on Android, `number-pad`), then
Gmail / username / city / partner. No READ_SMS permission needed (blocked in app.json).
