# 📱 Judy - iOS & Android Mobile Deployment Playbook

This project has been fully equipped with **CapacitorJS**—the industry-preferred framework to pack and coordinate your React/Vite progressive application into Native iOS (Swift/Xcode) and Android (Kotlin/Gradle) projects.

All native setups, bundle configurations (`com.hellojudy.app`), and display metadata has already been successfully scaffolded and initialised in your workspace!

---

## 🚀 How to Run & Build on Your Local Computer

To test, preview, and build your mobile app locally, first export this workspace (use **Export as ZIP** or **Push to GitHub** in the top-right settings dropdown).

### 1. Prerequisites
Make sure you have:
* **Node.js** (v18 or v20+) installed.
* For **Android Build**: [Android Studio](https://developer.android.com/studio) installed with modern SDK tools.
* For **iOS Build**: A macOS machine with [Xcode](https://developer.apple.com/xcode/) installed.

### 2. Local Installation & Web Build
Once unzipped on your computer, open a terminal in the folder and run:
```bash
# Install local node dependencies
npm install

# Build your production react interface and sync it to the native projects
npm run mobile:build
```

---

## 🛠️ Launching the Native Developers Tools

You can open your native apps in Xcode and Android Studio directly using the Capacitor commands:

### For Android (Android Studio)
Run this command from your terminal:
```bash
npm run cap:open-android
```
* **Android Studio** will launch automatically with the `android/` workspace open.
* Wait for Gradle sync to complete.
* Press the **Run** button to boot Judy onto an Android Emulator or any connected physical test device!

### For iOS (Xcode - macOS required)
Run this command from your macOS terminal:
```bash
npm run cap:open-ios
```
* **Xcode** will launch with the `ios/` workspace open.
* Select your target simulator (e.g., iPhone 15) or an active modern testing device.
* Click the **Play / Run** button to compile and execute the app on the simulator!

---

## 🎨 Setting up App Icons & Splash Screens

To easily generate high-quality app launchers, search bar icons, and mobile launch/splash screen assets for all screen sizes, follow this flow:

1. Create a pristine 1024x1024px file named `icon.png` and a 2732x2732px file named `splash.png` at the root of your project or inside an `assets/` directory.
2. Run the Capacitor Assets generator tools to automatically crop, resize, and inject icons into Xcode and Android Studio configurations:
```bash
# Install asset manager tool
npm install @capacitor/assets -D

# Generate and inject all asset variants across iOS & Android!
npx capacitor-assets generate
```

---

## 📂 Production Code Packaging & Store Upload

### 🤖 Google Play Store Deployment (Android)
To compile a native distribution app package:
1. In Android Studio, go to **Build** > **Generate Signed Bundle / APK...**
2. Choose **Android App Bundle (.aab)**—this is Google's modern preferred publishing standard.
3. Generate or select a matching Keystore certificate to sign your application safely.
4. Click **Build Release** to obtain the compiled `.aab` file located in `android/app/release/`.
5. Upload this App Bundle to your [Google Play Console](https://play.google.com/console) account!

### 🍏 Apple App Store Deployment (iOS)
To configure your App Store signing certificate and deploy:
1. In Xcode, click on the **App** project root node in the left file navigation column.
2. Under **Signing & Capabilities**, select your unique apple developer company portal team. Ensure **"Automatically manage signing"** is ticked.
3. Change the device target in the main selector header toolbar to **"Any iOS Device (arm64)"**.
4. Go to the top menu bar and select **Product** > **Archive**.
5. Once your archive builds successfully, Xcode Organizer will open. Click **Distribute App** to automatically sign, authenticate, and upload Judy directly into App Store Connect / TestFlight!

---

## 🔄 Synchronising Code Changes
Whenever you make updates to your React/Vite front-end files (`src/`), you only need to sync the web directory to update the native mobile builds:
```bash
# Quick build + update command
npm run mobile:build
```
This sync operation is lightning-fast and respects all pre-existing custom plugins/native changes!
