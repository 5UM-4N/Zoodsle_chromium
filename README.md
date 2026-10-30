# ZoodSle Chrome Edition 🌐👁️

> **The Web, Understood Aloud — Chrome Edition.**  
> *100% On-Device AI Visual Accessibility for Google Chrome, Brave, Edge & Arc. Standalone, private, zero cloud tracking.*

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Manifest V3](https://img.shields.io/badge/Chrome-Manifest%20V3-brightgreen.svg)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![Screen Reader Friendly](https://img.shields.io/badge/Accessibility-NVDA%20%7C%20JAWS%20%7C%20ChromeVox-success.svg)](https://www.w3.org/WAI/)
[![LM Studio Direct](https://img.shields.io/badge/AI%20Engine-LM%20Studio%20Direct-purple.svg)](https://lmstudio.ai)

---

## 🌟 Overview

**ZoodSle Chrome Edition** is a standalone Chromium WebExtension (Manifest V3) that brings local visual accessibility to any Chromium-based browser (Chrome, Brave, Arc, Microsoft Edge, Opera).

Blind and low-vision users encounter millions of unlabelled web photos every day. ZoodSle analyzes these photos locally using local multimodal AI and narrates them aloud in real time.

### ⚡ 100% Standalone (No Python Server Required!)
**ZoodSle Chrome Edition connects directly to LM Studio's local vision API** (`http://127.0.0.1:1234/v1`).
* No Python runtime or terminal server required.
* Zero cloud APIs, zero external tracking, zero cost.
* Just start LM Studio, load the extension, and browse any website!

---

## ✨ Features

* 🎙️ **Rich Audio Narration:** Built-in speech synthesis with configurable rate, pitch, and voice controls.
* ⌨️ **Universal Keyboard Shortcuts:**
  * **Describe Focused Image:** Press **`Alt + Shift + D`** (or **`⌥ + ⇧ + D`** on macOS).
  * **Stop Speech Immediately:** Press **`Alt + Shift + S`** (or **`⌥ + ⇧ + S`** on macOS).
* 🎯 **Smart Image Detection:** Intelligently ignores avatars, tracking pixels, emojis, and decorative SVGs ($\ge 180 \times 180$ px threshold) across any website (Facebook, X, Reddit, Wikipedia, news, e-commerce).
* 💬 **Interactive Chat & Follow-up Q&A:** Open the ZoodSle extension popup to ask specific questions about the photo (*"What color is the car?"*, *"Can you read the sign?"*).
* ♿ **Screen Reader Compatibility:** Real-time ARIA live regions for NVDA, JAWS, Narrator, ChromeVox, and VoiceOver.
* 🛡️ **SSRF & Intranet Security:** Built-in URL validation blocks requests to internal network ranges (`10.x`, `192.168.x`, cloud metadata endpoints).

---

## 🚀 Step-by-Step Setup Guide (Day 3 Launch)

### Step 1: Start LM Studio (The AI Engine)
1. Download [LM Studio](https://lmstudio.ai) (Windows, macOS, or Linux).
2. Download the vision model **`qwen/qwen3-vl-4b`** (4-bit MLX or GGUF).
3. Under the **Developer** tab, start the local server on port `1234` (`http://127.0.0.1:1234`).

---

### Step 2: Install the Extension in Chrome / Brave / Edge
1. Open your browser and navigate to:
   * **Chrome:** `chrome://extensions`
   * **Brave:** `brave://extensions`
   * **Edge:** `edge://extensions`
2. Turn ON **Developer mode** (toggle in the top-right corner).
3. Click the **Load unpacked** button in the top-left corner.
4. Select the `chromium/dist` folder (or root `chromium` folder).
5. Click the puzzle icon in your browser toolbar and **pin ZoodSle** for easy access.

---

### Step 3: Browse and Describe Photos!
1. Visit any website (e.g. [unsplash.com](https://unsplash.com), [wikipedia.org](https://wikipedia.org), Reddit, or Facebook).
2. Hover over any photo or focus on it using the keyboard.
3. Press **`Alt + Shift + D`** (or **`⌥ + ⇧ + D`** on Mac).
4. Hear ZoodSle describe the photograph aloud!

---

## ⚙️ Extension Settings

Click the ZoodSle toolbar icon and select **Settings** to customize:
* **Speech Rate:** Speed up or slow down narration from `0.5x` to `2.0x`.
* **Narration Verbosity:** Choose **Concise** (2-4 sentences) or **Detailed** (structured breakdown).
* **Auto-Narration (Opt-in):** Automatically queue and narrate photos as you scroll down articles and feeds.
* **AI Endpoint:** Defaults to `http://127.0.0.1:1234/v1` (Direct LM Studio). Also supports custom endpoints or `http://127.0.0.1:8000` (ZoodSle Python server).

---

## 👨‍💻 Creator & Contact

Created with ❤️ by **Suman Luitel** to make visual media accessible to everyone.

* **GitHub:** [@5UM-4N](https://github.com/5UM-4N)
* **X (Twitter):** [@auba9201](https://x.com/auba9201)
* **Feedback & Issues:** [GitHub Issues](https://github.com/5UM-4N/Zoodsle_chromium/issues)

---

## 📄 License

This extension is open-source under the **[MIT License](LICENSE)**.
