@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
title Sync Humanoid Rig Lab Next to GitHub
set "REPO=https://github.com/haihao0307/Humanoid-Rig-Lab-Next.git"

where git >nul 2>nul
if errorlevel 1 (
  echo.
  echo 未找到 Git。
  echo 请安装 Git for Windows 或使用 GitHub Desktop 上传本文件夹。
  echo.
  pause
  exit /b 1
)

if not exist ".git" (
  git init
  if errorlevel 1 goto :failed
  git branch -M main
)

git config user.name >nul 2>nul
if errorlevel 1 git config user.name "haihao0307"
git config user.email >nul 2>nul
if errorlevel 1 git config user.email "haihao0307@users.noreply.github.com"

git remote get-url origin >nul 2>nul
if errorlevel 1 (
  git remote add origin "%REPO%"
) else (
  git remote set-url origin "%REPO%"
)

git add -A
set "STAMP=%date% %time%"
git diff --cached --quiet
if not errorlevel 1 (
  echo 当前没有需要提交的文件变化。
) else (
  git commit -m "Build Humanoid Rig Lab Next review platform %STAMP%"
  if errorlevel 1 goto :failed
)

echo.
echo 正在推送到 GitHub。首次使用可能打开浏览器进行账号授权。
git push -u origin main
if errorlevel 1 goto :failed

echo.
echo 同步完成：%REPO%
echo.
pause
exit /b 0

:failed
echo.
echo 同步没有完成。代码文件没有丢失。
echo 可以改用 GitHub Desktop 将当前文件夹发布到目标仓库。
echo.
pause
exit /b 1
