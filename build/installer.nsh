; Leventia installer theming. The branded glass sidebar/header BMPs are wired via
; package.json (installerSidebar/installerHeader). Here we push the wizard dark to
; echo the app's palette. NSIS is a Win32 wizard, so this is colours + branding —
; not true CSS glass (that isn't possible in NSIS).
!macro customHeader
  !define /redef MUI_BGCOLOR   "0B0716"   ; app background (near-black purple)
  !define /redef MUI_TEXTCOLOR "E9D5FF"   ; soft lilac text
  BrandingText "Leventia Alting"
!macroend
