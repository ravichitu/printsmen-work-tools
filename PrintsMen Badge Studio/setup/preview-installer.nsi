Unicode true
RequestExecutionLevel user
SetCompressor /SOLID lzma
!include "MUI2.nsh"
!include "LogicLib.nsh"
!include "x64.nsh"
!include "FileFunc.nsh"
Var IsUpdate
Var NoIntegration
Name "PrintsMen Customised Studio - Local Preview"
OutFile "${OUTPUT}"
InstallDir "$LOCALAPPDATA\Programs\PrintsMen Badge Studio Preview"
ShowInstDetails show
ShowUninstDetails show
VIProductVersion "${VERSION_NUM}"
VIAddVersionKey "ProductName" "PrintsMen Customised Studio Local Preview"
VIAddVersionKey "FileDescription" "PrintsMen Local Preview Installer"
VIAddVersionKey "FileVersion" "${RELEASE_VERSION}"
VIAddVersionKey "ProductVersion" "${RELEASE_VERSION}"
VIAddVersionKey "LegalCopyright" "PrintsMen"
!define MUI_WELCOMEPAGE_TITLE "PrintsMen Local Preview"
!define MUI_WELCOMEPAGE_TEXT "This installs Customised Studio, the PrintsMen production tools, offline Job Assistant and Update Manager.$\r$\n$\r$\nSign in with the temporary operator account supplied by the owner. All tools are enabled in this preview.$\r$\n$\r$\nUpdate Manager installs verified owner releases when all editor tabs are closed and the studio is idle. Release hosting must be configured by the owner.$\r$\n$\r$\nProduction licensing, online activation and network accounts are NOT enabled. Existing browser artwork and installation identity are preserved during an update."
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_INSTFILES
!define MUI_FINISHPAGE_TITLE "Local preview installed"
!define MUI_FINISHPAGE_TEXT "Use the desktop or Start Menu shortcut to open PrintsMen.$\r$\n$\r$\nKeep this preview on the local computer. Owner licensing is a separate utility and is not included."
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "English"

Function .onInit
  StrCpy $IsUpdate "0"
  StrCpy $NoIntegration "0"
  ${GetParameters} $0
  ClearErrors
  ${GetOptions} $0 "/UPDATE" $1
  ${IfNot} ${Errors}
    StrCpy $IsUpdate "1"
  ${EndIf}
  ClearErrors
  ${GetOptions} $0 "/NOINTEGRATION" $1
  ${IfNot} ${Errors}
    StrCpy $NoIntegration "1"
  ${EndIf}
  ReadINIStr $1 "$INSTDIR\install-options.ini" "Install" "NoIntegration"
  ${If} $1 == "1"
    StrCpy $NoIntegration "1"
  ${EndIf}
  ${IfNot} ${RunningX64}
    MessageBox MB_ICONSTOP "This preview includes a 64-bit Node.js runtime and needs 64-bit Windows." /SD IDOK
    Abort
  ${EndIf}
  SetShellVarContext current
  ${If} $IsUpdate == "1"
    IfFileExists "$INSTDIR\.preview-installation.json" target_empty
    MessageBox MB_ICONSTOP "The update target is not a registered preview installation." /SD IDOK
    SetErrorLevel 1
    Abort
  ${EndIf}
  IfFileExists "$INSTDIR\*.*" 0 target_empty
    IfFileExists "$INSTDIR\.preview-installation.json" update_existing
    MessageBox MB_ICONSTOP "The destination is not empty and is not a registered preview. Nothing was overwritten." /SD IDOK
    SetErrorLevel 1
    Abort
  update_existing:
    MessageBox MB_YESNO "Save all jobs and close the design tabs before continuing. Update this installation while preserving its identity and settings?" /SD IDNO IDYES update_confirmed
    SetErrorLevel 1
    Abort
  update_confirmed:
    StrCpy $IsUpdate "1"
  target_empty:
FunctionEnd

Section "Install"
  ${If} $IsUpdate == "1"
    InitPluginsDir
    SetOutPath "$PLUGINSDIR\payload"
    File /r "${PAYLOAD}\*"
    nsExec::ExecToStack '"$PLUGINSDIR\payload\runtime\node.exe" "$PLUGINSDIR\payload\setup\apply-preview-update.mjs" "$INSTDIR" --restart'
  ${Else}
    SetOutPath "$INSTDIR"
    File /r "${PAYLOAD}\*"
    nsExec::ExecToStack '"$INSTDIR\runtime\node.exe" "$INSTDIR\setup\native-preview.mjs" register'
  ${EndIf}
  Pop $0
  Pop $1
  ${If} $0 != "0"
    DetailPrint "$1"
    MessageBox MB_ICONSTOP "Installation/update failed:$\r$\n$1" /SD IDOK
    SetErrorLevel 1
    Abort
  ${EndIf}
  WriteUninstaller "$INSTDIR\Uninstall.exe"
  WriteINIStr "$INSTDIR\install-options.ini" "Install" "NoIntegration" "$NoIntegration"
  ${If} $NoIntegration != "1"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\PrintsMenBadgeStudioPreview" "DisplayName" "PrintsMen Customised Studio - Local Preview"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\PrintsMenBadgeStudioPreview" "DisplayVersion" "${RELEASE_VERSION}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\PrintsMenBadgeStudioPreview" "Publisher" "PrintsMen"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\PrintsMenBadgeStudioPreview" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\PrintsMenBadgeStudioPreview" "UninstallString" '$\"$INSTDIR\Uninstall.exe$\"'
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\PrintsMenBadgeStudioPreview" "NoModify" 1
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\PrintsMenBadgeStudioPreview" "NoRepair" 1
  CreateDirectory "$SMPROGRAMS\PrintsMen Badge Studio Preview"
  CreateShortCut "$SMPROGRAMS\PrintsMen Badge Studio Preview\PrintsMen Studio.lnk" "$INSTDIR\Start Badge Studio.cmd" "" "$INSTDIR\runtime\node.exe"
  CreateShortCut "$SMPROGRAMS\PrintsMen Badge Studio Preview\Update Manager.lnk" "$INSTDIR\Start Update Manager.cmd" "" "$INSTDIR\runtime\node.exe"
  CreateShortCut "$SMPROGRAMS\PrintsMen Badge Studio Preview\Uninstall.lnk" "$INSTDIR\Uninstall.exe"
  CreateShortCut "$DESKTOP\PrintsMen Badge Studio Preview.lnk" "$INSTDIR\Start Badge Studio.cmd" "" "$INSTDIR\runtime\node.exe"
  CreateShortCut "$DESKTOP\PrintsMen Customised Studio Preview.lnk" "$INSTDIR\Start Customised Studio.cmd" "" "$INSTDIR\runtime\node.exe"
  ${EndIf}
SectionEnd

Section "Uninstall"
  SetShellVarContext current
  ReadINIStr $NoIntegration "$INSTDIR\install-options.ini" "Install" "NoIntegration"
  IfFileExists "$INSTDIR\.preview-installation.json" 0 refused
  nsExec::ExecToStack '"$INSTDIR\runtime\node.exe" "$INSTDIR\setup\native-preview.mjs" uninstall-check'
  Pop $0
  Pop $1
  ${If} $0 != "0"
    MessageBox MB_ICONSTOP "Cannot safely uninstall:$\r$\n$1" /SD IDOK
    SetErrorLevel 1
    Abort
  ${EndIf}
  !include "${DELETE_LIST}"
  Delete "$INSTDIR\.preview-installation.json"
  Delete "$INSTDIR\preview-manifest.json"
  Delete "$INSTDIR\Uninstall.exe"
  Delete "$INSTDIR\install-options.ini"
  RMDir "$INSTDIR"
  ${If} $NoIntegration != "1"
  Delete "$DESKTOP\PrintsMen Badge Studio Preview.lnk"
  Delete "$DESKTOP\PrintsMen Customised Studio Preview.lnk"
  Delete "$SMPROGRAMS\PrintsMen Badge Studio Preview\PrintsMen Studio.lnk"
  Delete "$SMPROGRAMS\PrintsMen Badge Studio Preview\Update Manager.lnk"
  Delete "$SMPROGRAMS\PrintsMen Badge Studio Preview\Uninstall.lnk"
  RMDir "$SMPROGRAMS\PrintsMen Badge Studio Preview"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\PrintsMenBadgeStudioPreview"
  ${EndIf}
  Goto finished
  refused:
    MessageBox MB_ICONSTOP "The preview registration marker is missing. No files were removed." /SD IDOK
    SetErrorLevel 1
    Abort
  finished:
SectionEnd
