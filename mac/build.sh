#!/bin/zsh
# Builds Burrow.app in the project folder from the game as it stands. Needs only Apple's Command Line Tools.
set -e
cd "$(dirname "$0")/.."
APP=Burrow.app
rm -rf $APP
mkdir -p $APP/Contents/MacOS $APP/Contents/Resources/game
T=$(mktemp -d)
swiftc -O -swift-version 5 -target arm64-apple-macos13.3 mac/main.swift -o $T/arm
swiftc -O -swift-version 5 -target x86_64-apple-macos13.3 mac/main.swift -o $T/intel
lipo -create $T/arm $T/intel -output $APP/Contents/MacOS/Burrow
if [ ! -f mac/Burrow.icns ]; then
  T=$(mktemp -d); swiftc -swift-version 5 mac/icon.swift -o $T/icon; $T/icon $T/icon.png
  mkdir $T/Burrow.iconset
  for s in 16 32 128 256 512; do
    sips -z $s $s $T/icon.png --out $T/Burrow.iconset/icon_${s}x${s}.png > /dev/null
    sips -z $((s*2)) $((s*2)) $T/icon.png --out $T/Burrow.iconset/icon_${s}x${s}@2x.png > /dev/null
  done
  iconutil -c icns $T/Burrow.iconset -o mac/Burrow.icns
fi
cp mac/Info.plist $APP/Contents/; cp mac/Burrow.icns $APP/Contents/Resources/
cp -R index.html manifest.webmanifest css js fonts icons $APP/Contents/Resources/game/
codesign --force --deep --sign - $APP
du -sh $APP
