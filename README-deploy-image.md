Place the provided background image in this project at `assets/bg.jpg`.

Recommended steps (Windows PowerShell):

1. Create the folder and copy the attachment as `bg.jpg`:

```powershell
Push-Location 's:\MOTUS'
New-Item -ItemType Directory -Path assets -Force
# Copy the attached image file into s:\MOTUS\assets\bg.jpg using your file explorer
Pop-Location
```

2. Reload the page (https://localhost:8000 or your hosted URL). The site uses `assets/bg.jpg` as a blended background.

Notes:
- The CSS already includes a dark gradient overlay for legibility and a subtle blur via `backdrop-filter` on the `.app` panel.
- If the browser doesn't support `backdrop-filter`, the semi-transparent panel keeps text readable.
