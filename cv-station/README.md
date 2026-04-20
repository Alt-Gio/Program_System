# CV Station — Face Recognition Attendance

Tkinter desktop app that recognizes faces with a webcam and posts check-ins to the DICT web app.

## Running from source (development)

```bat
cd cv-station
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python main_fixed.py
```

First launch opens the **Setup Wizard** and asks for:

- **Server URL** — e.g. `https://dict-r5.example.com`
- **API Key** — value of `FACE_CV_API_KEY` on the server

Clicking **Test Connection** hits `POST /api/cv-station/verify` and verifies:

1. Web app reachable
2. API key accepted
3. Convex backend reachable
4. Google Sheets reachable

**Save & Launch** is disabled until all four checks pass. Settings can be edited later from the **⚙️ Settings** tab.

## Building the distributable `.exe`

Requires Python 3.10+ on Windows.

```bat
cd cv-station
build.bat
```

Produces:

- `cv-station\dist\DICT-FaceCheckin.exe` — the standalone build
- `downloads\DICT-FaceCheckin.exe` — copy served by the web app's download endpoint

The web app exposes the build at **`GET /api/cv-station/download`** (admin auth required). The admin page at `/dtc-admin` shows a "Download CV Station" card that calls this route.

## Config & data locations

Everything lives under the current user's roaming AppData so the .exe can run from any install location without admin rights:

```
%APPDATA%\DICT-FaceCheckin\
  ├── config.json           # server URL + DPAPI-encrypted API key
  ├── attendance_system.log
  └── data\
      ├── attendance.db
      ├── recognizer.yml
      ├── registered_faces\
      └── unknown_faces\
```

The API key is encrypted with Windows DPAPI tied to the user's Windows account — copying `config.json` to another machine or user will **not** give access to the key.

## Startup registration

The Settings tab has a "Run on Windows startup" toggle that writes/removes a value under `HKCU\Software\Microsoft\Windows\CurrentVersion\Run`. Current user only — no admin rights required.

## Distribution flow

1. Developer: `build.bat` → produces `dist\DICT-FaceCheckin.exe`
2. `build.bat` also copies it to `downloads\` in the repo root
3. Deploy the web app (the `downloads/` folder ships with it)
4. Admin signs in → goes to `/dtc-admin` → clicks **Download CV Station**
5. On the target PC: run the .exe → Setup Wizard → enter URL + key → all checks go green → Save & Launch
6. Optionally enable "Run on Windows startup" in Settings

## Notes on SmartScreen

Unsigned PyInstaller binaries trigger the Windows "unrecognized app" prompt on first launch. For internal DICT use that's fine ("More info → Run anyway"). For wider distribution, sign with an Authenticode certificate.
