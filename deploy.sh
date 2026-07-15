#!/bin/bash
# Rebuilds the site and pushes to gh-pages branch for GitHub Pages deployment
set -e

echo "Building..."
npm run build

echo "Deploying to gh-pages..."
cd dist
git init --quiet || true
git remote add origin https://github.com/ruchaheda/sankalp.git 2>/dev/null || true
git remote set-url origin https://github.com/ruchaheda/sankalp.git
git fetch origin gh-pages --quiet 2>/dev/null || true
git checkout gh-pages --quiet 2>/dev/null || git checkout -b gh-pages --track origin/gh-pages --quiet 2>/dev/null || git checkout -b gh-pages --quiet
touch .nojekyll
git add .
git commit -m "Deploy: $(date '+%Y-%m-%d %H:%M')" --quiet || echo "No changes"
git push --force --set-upstream origin gh-pages --quiet
cd ..

echo "Done! Live at https://ruchaheda.github.io/sankalp/"
