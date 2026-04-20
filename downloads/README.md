# downloads/

This folder is served by `GET /api/cv-station/download` (admin-auth-gated).

Expected contents:

- `DICT-FaceCheckin.exe` — built by `cv-station/build.bat`

The `.exe` itself is gitignored. Run the build script on a Windows machine with Python 3.10+:

```bat
cd cv-station
build.bat
```

The script copies the finished binary here automatically. After deploy, the admin page at `/dtc-admin` can download it.
