#!/bin/bash
rm -rf build || exit 0;
gulp
( cd build
git init
git config user.name "Travis-CI"
git config user.email "travis@88north.com"
git add .
git commit -m "Auto Deployed to Github Pages"
git push --force --quiet "https://${GH_TOKEN}@${GH_REF}" master:master > /dev/null 2>&1
)
