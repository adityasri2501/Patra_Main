# PATRA | Press AI-powered Title Registration Assistant

![PATRA Banner](https://img.shields.io/badge/Government%20of%20India-Hackathon%20Project-orange) ![Status](https://img.shields.io/badge/Status-Prototype-blue)

**PATRA** (Press AI-powered Title Registration Assistant) is a modern web platform designed to streamline the newspaper title verification process for the **Registrar of Newspapers for India (RNI)**. 

It acts as a bridge between publishers and government officers, using intelligent algorithms to instantly check for title similarity, phonetic duplicates, and policy violations (e.g., restricted keywords).

---

## 🚀 Key Features

### 1. 🏛️ Citizen/Publisher Portal
* **Instant Title Verification:** Users can input a proposed title and get an immediate "Risk Assessment" (Low, Medium, High).
* **AI Analysis:** Checks against:
    * **Similarity:** Levenshtein Distance algorithm checks against existing newspapers (e.g., *Times of India*).
    * **Phonetics:** Detects titles that sound similar but are spelled differently.
    * **Keywords:** Flags restricted terms like "Police", "Army", "Corruption", etc.
* **Educational Feedback:** Explains *why* a title was rejected with a visual timeline.

### 2. 📰 Publisher Tools
* **What-If Simulator:** A real-time typing playground where publishers can see how small changes to a title affect its acceptance probability.
* **Safe Alternatives:** Generates compliant title suggestions automatically if the original is blocked.

### 3. 🛡️ Officer Dashboard
* **Secure Login:** Restricted access for RNI officials.
* **Review System:** View pending applications with calculated risk scores.
* **One-Click Action:** Approve or Reject titles instantly.
* **Live Stats:** Dashboard widgets showing total verified, high-risk, and pending applications.

### 4. 💾 Hybrid Data Storage
* **Firebase Integration:** Real-time data syncing (if configured).
* **Local Storage Fallback:** Works fully offline/locally for demonstration purposes if no backend is connected.

---

## 🛠️ Tech Stack

* **Frontend:** HTML5, Vanilla JavaScript (ES6+)
* **Styling:** Tailwind CSS (via CDN) & Custom CSS
* **Icons:** Lucide Icons
* **Fonts:** Merriweather (Serif/Govt style) & Inter (UI)
* **Backend (Optional):** Firebase Firestore & Auth
* **Algorithms:** Custom Client-side logic for Levenshtein Distance & Phonetic hashing.

---

## ⚙️ Setup & Installation

Since this project uses Vanilla JS and CDN links, no build process (npm/webpack) is required.

1.  **Clone the repository:**
    ```bash
    git clone [https://github.com/your-username/patra.git](https://github.com/your-username/patra.git)
    cd patra
    ```

2.  **Run the application:**
    * Simply open `index.html` in any modern web browser.
    * *Recommended:* Use a local server (like Live Server in VS Code) for the best experience.

---

## 📖 Usage Guide

### 🧑‍💼 Testing the Officer Portal
To access the admin dashboard, use the following **hardcoded demo credentials**:

* **Access Button:** Click "Officer Login" in the navbar.
* **Password:** `admin123`
* *(The User ID is pre-filled for demo purposes)*

### 🔍 Testing the AI Logic
Try entering these titles in the **Title Verification** input to see different results:

1.  **High Risk (Keyword):** `The Police Corruption News`
    * *Result:* Blocked due to restricted keywords.
2.  **High Risk (Similarity):** `The Tymes of Indya`
    * *Result:* Blocked due to phonetic similarity to "The Times of India".
3.  **Low Risk (Success):** `The Tech Garden Chronicle`
    * *Result:* Likely Approved.

---

🧠 How the "AI" Works (Logic)
The logic is contained within the Logic object in script.js:

Levenshtein Distance: Calculates the number of edits required to change one string into another. If a user enters a title too close to an existing registered title (mocked in EXISTING_TITLES), it flags it.

Phonetic Hashing: Converts the title into a sound-code. If "Times" and "Tymes" produce the same code, it is flagged as a duplicate.

Keyword Filtering: Scans against a BANNED_KEYWORDS array for prohibited government or sensitive terms.

🎨 Design System
The UI follows the Government of India Web Guidelines (GIGW) aesthetic:

Primary Color: Navy Blue (#0B3C5D)

Secondary Color: Saffron/Orange (#F57C00)

Typography: 'Merriweather' for headings (authoritative) and 'Inter' for interface text (readability).

## 📂 Project Structure

```text
/
├── index.html          # Main application structure (Single Page Application view)
├── script.js           # Logic: Navigation, AI Algorithms, Auth, Data handling
├── style.css           # Custom overrides and specific UI tweaks
├── tailwind.config.js  # Tailwind theme configuration (Colors, Fonts)
└── assets/             # Images and logos

